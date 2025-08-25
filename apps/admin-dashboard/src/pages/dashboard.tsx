import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import VoiceAnalytics from '../components/VoiceAnalytics';
import WidgetDashboard from '../components/WidgetDashboard';
import { authManager, getCurrentUser, getSwedishErrorMessage, AdminUser } from '../utils/auth';
import { adminWebSocket, AdminMetrics, WebSocketState, getWebSocketErrorMessage } from '../utils/websocket';

interface SystemMetrics {
  system: {
    activeVoiceSessions: number;
    activeSessionIds: string[];
    uptime: number;
    memoryUsage: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
      external: number;
      arrayBuffers: number;
    };
    timestamp: string;
  };
  admin: {
    role: string;
    permissions: number;
    sessionId: string;
  };
}

interface DashboardResponse {
  success: boolean;
  data?: SystemMetrics;
  message?: string;
  code?: string;
}

export default function Dashboard() {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Check authentication
    const currentUser = getCurrentUser();
    if (!currentUser) {
      router.push('/login');
      return;
    }
    
    setUser(currentUser);
    setLoading(false);
    
    // Start token refresh timer
    authManager.startTokenRefreshTimer();
    
    // Load initial metrics
    loadMetrics();
    
    // Set up auto-refresh for metrics
    const interval = setInterval(loadMetrics, 30000); // Refresh every 30 seconds
    
    return () => clearInterval(interval);
  }, [router]);

  const loadMetrics = async () => {
    try {
      const response = await authManager.makeAuthenticatedRequest('/api/admin/metrics');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data: DashboardResponse = await response.json();
      
      if (data.success && data.data) {
        setMetrics(data.data);
        setLastUpdated(new Date());
        setError(null);
      } else {
        throw new Error(data.message || 'Misslyckades att ladda mätvärden');
      }
    } catch (err: any) {
      console.error('Metrics error:', err);
      
      if (err.message === 'Authentication required') {
        router.push('/login');
        return;
      }
      
      setError(getSwedishErrorMessage(err));
    }
  };


  const formatUptime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}t ${minutes}m`;
  };

  const formatMemory = (bytes: number): string => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };


  if (loading) {
    return (
      <Layout>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          minHeight: '60vh'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ 
              width: '32px', 
              height: '32px', 
              border: '3px solid #e2e8f0',
              borderTop: '3px solid #3b82f6',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 16px'
            }} />
            <p style={{ color: '#64748b' }}>Laddar...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!user) {
    return null; // Will redirect to login
  }

  return (
    <Layout>
      {/* Page Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ 
          fontSize: '28px', 
          fontWeight: 'bold', 
          color: '#1e293b',
          margin: '0 0 8px 0'
        }}>
          Systemöversikt
        </h1>
        <p style={{ 
          color: '#64748b', 
          fontSize: '16px',
          margin: 0
        }}>
          Översikt över plattformens status och prestanda
        </p>
      </div>
        {/* Status Bar */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '24px',
          border: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '12px',
              height: '12px',
              backgroundColor: error ? '#ef4444' : '#22c55e',
              borderRadius: '50%'
            }} />
            <span style={{ fontSize: '14px', color: '#374151' }}>
              {error ? 'Anslutningsfel' : 'System Online'}
            </span>
          </div>
          
          {lastUpdated && (
            <div style={{ fontSize: '12px', color: '#6b7280' }}>
              Senast uppdaterad: {lastUpdated.toLocaleTimeString('sv-SE')}
            </div>
          )}
          
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {!useRealTime && (
              <button
                onClick={loadMetrics}
                disabled={loading}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                Uppdatera
              </button>
            )}
            
            {useRealTime && wsState.reconnectCount > 0 && (
              <div style={{ 
                fontSize: '12px', 
                color: '#f59e0b',
                padding: '6px 8px'
              }}>
                Återanslutningsförsök: {wsState.reconnectCount}
              </div>
            )}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '24px'
          }}>
            <div style={{ color: '#dc2626', fontSize: '14px', fontWeight: '500' }}>
              Systemfel
            </div>
            <div style={{ color: '#991b1b', fontSize: '12px', marginTop: '4px' }}>
              {error}
            </div>
          </div>
        )}

        {/* System Metrics Grid */}
        {metrics && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '20px',
            marginBottom: '24px'
          }}>
            {/* Voice Sessions Card */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '20px',
              border: '1px solid #e2e8f0'
            }}>
              <h3 style={{ 
                fontSize: '16px', 
                fontWeight: '600', 
                color: '#1e293b', 
                margin: '0 0 12px 0'
              }}>
                Aktiva Röstsessioner
              </h3>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#3b82f6' }}>
                {metrics.system.activeVoiceSessions}
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                {metrics.system.activeSessionIds.length > 0 ? 
                  `Sessions: ${metrics.system.activeSessionIds.slice(0, 3).join(', ')}${metrics.system.activeSessionIds.length > 3 ? '...' : ''}` :
                  'Inga aktiva sessioner'
                }
              </div>
            </div>

            {/* System Uptime Card */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '20px',
              border: '1px solid #e2e8f0'
            }}>
              <h3 style={{ 
                fontSize: '16px', 
                fontWeight: '600', 
                color: '#1e293b', 
                margin: '0 0 12px 0'
              }}>
                Systemupptid
              </h3>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#059669' }}>
                {formatUptime(metrics.system.uptime)}
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                Sedan senaste omstart
              </div>
            </div>

            {/* Memory Usage Card */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '20px',
              border: '1px solid #e2e8f0'
            }}>
              <h3 style={{ 
                fontSize: '16px', 
                fontWeight: '600', 
                color: '#1e293b', 
                margin: '0 0 12px 0'
              }}>
                Minnesanvändning
              </h3>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#dc2626' }}>
                {formatMemory(metrics.system.memoryUsage.heapUsed)}
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                av {formatMemory(metrics.system.memoryUsage.heapTotal)} totalt
              </div>
            </div>

            {/* Admin Session Card */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '20px',
              border: '1px solid #e2e8f0'
            }}>
              <h3 style={{ 
                fontSize: '16px', 
                fontWeight: '600', 
                color: '#1e293b', 
                margin: '0 0 12px 0'
              }}>
                Din Session
              </h3>
              <div style={{ fontSize: '14px', color: '#374151', marginBottom: '8px' }}>
                Roll: <strong>{getRoleDisplayName(metrics.admin.role)}</strong>
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>
                {metrics.admin.permissions} behörigheter tillgängliga
              </div>
              <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '8px' }}>
                Session: {metrics.admin.sessionId.slice(0, 8)}...
              </div>
            </div>
          </div>
        )}

      {/* Voice Analytics Section */}
      <div style={{ marginBottom: '32px' }}>
        <VoiceAnalytics />
      </div>

      {/* Swedish Business Widgets Dashboard */}
      <div style={{ marginTop: '32px' }}>
        <WidgetDashboard />
      </div>
      
      {/* Add CSS animation for loading spinner */}
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </Layout>
  );
}