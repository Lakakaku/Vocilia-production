import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

type FraudSeverity = 'low' | 'medium' | 'high' | 'critical';
type FraudCategory = 'duplicate_feedback' | 'fake_business' | 'reward_abuse' | 'identity_fraud' | 'collusion' | 'bot_activity';
type FraudStatus = 'open' | 'investigating' | 'resolved' | 'false_positive';

interface FraudAlert {
  id: string;
  severity: FraudSeverity;
  category: FraudCategory;
  status: FraudStatus;
  title: string;
  description: string;
  riskScore: number;
  confidence: number;
  detectedAt: string;
  businessId: string;
  businessName: string;
  customerHash: string;
  transactionId: string;
  amount: number;
  evidence: {
    type: string;
    value: string;
    confidence: number;
  }[];
  swedishComplianceFlags: string[];
  assignedTo?: string;
  resolvedAt?: string;
  resolution?: string;
}

interface FraudPattern {
  id: string;
  name: string;
  description: string;
  occurrences: number;
  trend: 'increasing' | 'stable' | 'decreasing';
  lastDetected: string;
  riskLevel: FraudSeverity;
  affectedBusinesses: number;
  estimatedLoss: number;
}

interface ComplianceMetrics {
  gdprCompliance: {
    score: number;
    issues: string[];
    lastAudit: string;
  };
  finansinspektionen: {
    reportingStatus: 'compliant' | 'delayed' | 'issues';
    nextDeadline: string;
    pendingReports: number;
  };
  konsumentverket: {
    complaints: number;
    resolved: number;
    averageResolutionTime: number;
  };
}

export default function FraudPage() {
  const [fraudAlerts, setFraudAlerts] = useState<FraudAlert[]>([]);
  const [fraudPatterns, setFraudPatterns] = useState<FraudPattern[]>([]);
  const [complianceMetrics, setComplianceMetrics] = useState<ComplianceMetrics | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<FraudAlert | null>(null);
  const [activeTab, setActiveTab] = useState<'alerts' | 'patterns' | 'compliance' | 'cases'>('alerts');
  const [filterSeverity, setFilterSeverity] = useState<FraudSeverity | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<FraudStatus | 'all'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const router = useRouter();

  useEffect(() => {
    fetchFraudData();
    const interval = setInterval(fetchFraudData, 30000); // Update every 30 seconds
    
    // Initialize real-time WebSocket connection for instant fraud alerts
    const initWebSocket = () => {
      const token = localStorage.getItem('ADMIN_TOKEN');
      if (token && window.WebSocket) {
        try {
          const wsUrl = process.env.NODE_ENV === 'production' 
            ? `wss://${window.location.host}/admin-ws`
            : `ws://${window.location.host}/admin-ws`;
          
          const ws = new WebSocket(wsUrl);
          
          ws.onopen = () => {
            console.log('🔗 Fraud monitoring WebSocket connected');
            ws.send(JSON.stringify({
              type: 'auth',
              token: token,
              subscribe: ['fraud_alerts', 'fraud_patterns', 'compliance_updates']
            }));
          };
          
          ws.onmessage = (event) => {
            try {
              const message = JSON.parse(event.data);
              
              if (message.type === 'fraud_alert_new') {
                // Add new alert to the beginning of the list
                setFraudAlerts(prev => [message.alert, ...prev]);
                
                // Show browser notification for critical alerts
                if (message.alert.severity === 'critical' && 'Notification' in window) {
                  if (Notification.permission === 'granted') {
                    new Notification(`Kritisk bedrägervarning: ${message.alert.title}`, {
                      body: message.alert.description,
                      icon: '/favicon.ico',
                      tag: `fraud-alert-${message.alert.id}`
                    });
                  } else if (Notification.permission !== 'denied') {
                    Notification.requestPermission().then(permission => {
                      if (permission === 'granted') {
                        new Notification(`Kritisk bedrägervarning: ${message.alert.title}`, {
                          body: message.alert.description,
                          icon: '/favicon.ico',
                          tag: `fraud-alert-${message.alert.id}`
                        });
                      }
                    });
                  }
                }
              } else if (message.type === 'fraud_alert_update') {
                // Update existing alert
                setFraudAlerts(prev => 
                  prev.map(alert => 
                    alert.id === message.alert.id ? message.alert : alert
                  )
                );
              } else if (message.type === 'fraud_pattern_update') {
                // Update fraud patterns
                setFraudPatterns(prev => 
                  prev.map(pattern => 
                    pattern.id === message.pattern.id ? message.pattern : pattern
                  )
                );
              } else if (message.type === 'compliance_update') {
                // Update compliance metrics
                setComplianceMetrics(message.compliance);
              }
            } catch (err) {
              console.error('WebSocket message parsing error:', err);
            }
          };
          
          ws.onclose = () => {
            console.log('🔌 Fraud monitoring WebSocket disconnected, attempting to reconnect...');
            setTimeout(initWebSocket, 5000); // Reconnect after 5 seconds
          };
          
          ws.onerror = (error) => {
            console.error('WebSocket error:', error);
          };
          
          return ws;
        } catch (error) {
          console.error('Failed to initialize WebSocket:', error);
        }
      }
    };
    
    const ws = initWebSocket();
    
    return () => {
      clearInterval(interval);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, []);

  const fetchFraudData = async () => {
    try {
      const token = localStorage.getItem('ADMIN_TOKEN');
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/fraud/dashboard`, {
        headers: { 'x-admin-token': token }
      });

      if (!response.ok) {
        throw new Error('Misslyckades att hämta bedrägerdata');
      }

      const data = await response.json();
      setFraudAlerts(data.alerts || []);
      setFraudPatterns(data.patterns || []);
      setComplianceMetrics(data.compliance || null);
      setLastUpdate(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ett fel inträffade');
    } finally {
      setIsLoading(false);
    }
  };

  const getSeverityColor = (severity: FraudSeverity): string => {
    switch (severity) {
      case 'critical': return '#dc2626';
      case 'high': return '#ea580c';
      case 'medium': return '#d97706';
      case 'low': return '#65a30d';
      default: return '#6b7280';
    }
  };

  const getSeverityLabel = (severity: FraudSeverity): string => {
    switch (severity) {
      case 'critical': return 'Kritisk';
      case 'high': return 'Hög';
      case 'medium': return 'Medium';
      case 'low': return 'Låg';
      default: return severity;
    }
  };

  const getStatusLabel = (status: FraudStatus): string => {
    switch (status) {
      case 'open': return 'Öppen';
      case 'investigating': return 'Utreds';
      case 'resolved': return 'Löst';
      case 'false_positive': return 'Falskt alarm';
      default: return status;
    }
  };

  const getCategoryLabel = (category: FraudCategory): string => {
    switch (category) {
      case 'duplicate_feedback': return 'Duplicerad återkoppling';
      case 'fake_business': return 'Falskt företag';
      case 'reward_abuse': return 'Belöningsmissbruk';
      case 'identity_fraud': return 'Identitetsbedrägeri';
      case 'collusion': return 'Samverkan';
      case 'bot_activity': return 'Bot-aktivitet';
      default: return category;
    }
  };

  const filteredAlerts = fraudAlerts.filter(alert => {
    const severityMatch = filterSeverity === 'all' || alert.severity === filterSeverity;
    const statusMatch = filterStatus === 'all' || alert.status === filterStatus;
    return severityMatch && statusMatch;
  });

  const criticalAlerts = fraudAlerts.filter(alert => alert.severity === 'critical' && alert.status === 'open').length;
  const activeInvestigations = fraudAlerts.filter(alert => alert.status === 'investigating').length;
  const totalEstimatedLoss = fraudPatterns.reduce((sum, pattern) => sum + pattern.estimatedLoss, 0);

  if (isLoading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <div style={{ fontSize: '18px', color: '#6b7280' }}>Laddar bedrägerdata...</div>
      </div>
    );
  }

  return (
    <>
      {/* CSS Animations for Real-time Indicators */}
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        @keyframes ping {
          75%, 100% {
            transform: scale(2);
            opacity: 0;
          }
        }
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .pulse {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        .ping {
          animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;
        }
        .slide-in {
          animation: slideInRight 0.5s ease-out;
        }
      `}</style>
      
      <div style={{ padding: '24px', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>
              Bedrägerdetektering
            </h1>
            <p style={{ color: '#64748b', margin: 0, fontSize: '14px' }}>
              Senast uppdaterad: {lastUpdate.toLocaleString('sv-SE')}
            </p>
          </div>
          <button
            onClick={fetchFraudData}
            style={{
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 16px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            🔄 Uppdatera
          </button>
        </div>

        {error && (
          <div style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '6px',
            padding: '12px',
            color: '#991b1b',
            marginBottom: '16px'
          }}>
            ⚠️ {error}
          </div>
        )}
      </div>

      {/* Key Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ 
          backgroundColor: 'white', 
          borderRadius: '8px', 
          padding: '20px', 
          border: '1px solid #e2e8f0',
          position: 'relative',
          ...(criticalAlerts > 0 ? {
            borderLeft: '4px solid #dc2626',
            animation: 'pulse 2s infinite'
          } : {})
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '14px', color: '#64748b' }}>Kritiska varningar</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '20px' }}>🚨</span>
              {criticalAlerts > 0 && (
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#dc2626',
                  animation: 'ping 1s cubic-bezier(0, 0, 0.2, 1) infinite'
                }} />
              )}
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: criticalAlerts > 0 ? '#dc2626' : '#16a34a' }}>
            {criticalAlerts}
          </div>
          {criticalAlerts > 0 && (
            <div style={{ fontSize: '11px', color: '#dc2626', marginTop: '4px', fontWeight: '500' }}>
              🔴 Kräver omedelbar åtgärd
            </div>
          )}
        </div>

        <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '20px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '14px', color: '#64748b' }}>Aktiva utredningar</span>
            <span style={{ fontSize: '20px' }}>🔍</span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b' }}>
            {activeInvestigations}
          </div>
        </div>

        <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '20px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '14px', color: '#64748b' }}>Uppskattad förlust</span>
            <span style={{ fontSize: '20px' }}>💸</span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: totalEstimatedLoss > 0 ? '#dc2626' : '#16a34a' }}>
            {totalEstimatedLoss.toLocaleString('sv-SE')} SEK
          </div>
        </div>

        <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '20px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '14px', color: '#64748b' }}>GDPR-efterlevnad</span>
            <span style={{ fontSize: '20px' }}>🛡️</span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: complianceMetrics?.gdprCompliance.score ?? 0 > 90 ? '#16a34a' : '#dc2626' }}>
            {complianceMetrics?.gdprCompliance.score ?? 0}%
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ borderBottom: '1px solid #e2e8f0', marginBottom: '24px' }}>
        <nav style={{ display: 'flex', gap: '32px' }}>
          {[
            { key: 'alerts', label: 'Varningar', icon: '🚨' },
            { key: 'patterns', label: 'Mönster', icon: '📊' },
            { key: 'compliance', label: 'Efterlevnad', icon: '🛡️' },
            { key: 'cases', label: 'Ärenden', icon: '📋' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              style={{
                background: 'none',
                border: 'none',
                padding: '12px 0',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                color: activeTab === tab.key ? '#3b82f6' : '#64748b',
                borderBottom: activeTab === tab.key ? '2px solid #3b82f6' : '2px solid transparent',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'alerts' && (
        <div>
          {/* Filters */}
          <div style={{ 
            backgroundColor: 'white', 
            borderRadius: '8px', 
            padding: '16px', 
            marginBottom: '16px',
            border: '1px solid #e2e8f0',
            display: 'flex',
            gap: '16px',
            alignItems: 'center'
          }}>
            <div>
              <label style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px', display: 'block' }}>
                Allvarlighetsgrad
              </label>
              <select
                value={filterSeverity}
                onChange={(e) => setFilterSeverity(e.target.value as FraudSeverity | 'all')}
                style={{
                  padding: '6px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              >
                <option value="all">Alla</option>
                <option value="critical">Kritisk</option>
                <option value="high">Hög</option>
                <option value="medium">Medium</option>
                <option value="low">Låg</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px', display: 'block' }}>
                Status
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as FraudStatus | 'all')}
                style={{
                  padding: '6px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              >
                <option value="all">Alla</option>
                <option value="open">Öppen</option>
                <option value="investigating">Utreds</option>
                <option value="resolved">Löst</option>
                <option value="false_positive">Falskt alarm</option>
              </select>
            </div>

            <div style={{ marginLeft: 'auto', fontSize: '14px', color: '#64748b' }}>
              Visar {filteredAlerts.length} av {fraudAlerts.length} varningar
            </div>
          </div>

          {/* Alerts List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {filteredAlerts.map((alert) => (
              <div
                key={alert.id}
                style={{
                  backgroundColor: 'white',
                  borderRadius: '8px',
                  padding: '20px',
                  border: `2px solid ${getSeverityColor(alert.severity)}20`,
                  borderLeft: `4px solid ${getSeverityColor(alert.severity)}`,
                  cursor: 'pointer'
                }}
                onClick={() => setSelectedAlert(alert)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span
                        style={{
                          backgroundColor: getSeverityColor(alert.severity),
                          color: 'white',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 'bold'
                        }}
                      >
                        {getSeverityLabel(alert.severity)}
                      </span>
                      <span
                        style={{
                          backgroundColor: '#f1f5f9',
                          color: '#475569',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '11px'
                        }}
                      >
                        {getCategoryLabel(alert.category)}
                      </span>
                      <span
                        style={{
                          backgroundColor: alert.status === 'open' ? '#fef3c7' : alert.status === 'investigating' ? '#dbeafe' : '#dcfce7',
                          color: alert.status === 'open' ? '#92400e' : alert.status === 'investigating' ? '#1e40af' : '#166534',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '11px'
                        }}
                      >
                        {getStatusLabel(alert.status)}
                      </span>
                    </div>
                    <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#1e293b', margin: 0, marginBottom: '4px' }}>
                      {alert.title}
                    </h3>
                    <p style={{ fontSize: '14px', color: '#64748b', margin: 0, marginBottom: '8px' }}>
                      {alert.description}
                    </p>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                      Företag: {alert.businessName} • Belopp: {alert.amount.toLocaleString('sv-SE')} SEK • 
                      Upptäckt: {new Date(alert.detectedAt).toLocaleDateString('sv-SE')}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: getSeverityColor(alert.severity) }}>
                      {alert.riskScore}/100
                    </div>
                    <div style={{ fontSize: '11px', color: '#6b7280' }}>
                      Förtroende: {Math.round(alert.confidence * 100)}%
                    </div>
                  </div>
                </div>

                {alert.swedishComplianceFlags.length > 0 && (
                  <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
                    <div style={{ fontSize: '12px', color: '#dc2626', fontWeight: '500', marginBottom: '4px' }}>
                      🇸🇪 Svenska efterlevnadsflaggor:
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {alert.swedishComplianceFlags.map((flag, index) => (
                        <span
                          key={index}
                          style={{
                            backgroundColor: '#fef2f2',
                            color: '#991b1b',
                            padding: '1px 6px',
                            borderRadius: '8px',
                            fontSize: '10px'
                          }}
                        >
                          {flag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'patterns' && (
        <div>
          {/* Pattern Overview Summary */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '20px',
            marginBottom: '20px',
            border: '1px solid #e2e8f0'
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1e293b', margin: 0, marginBottom: '16px' }}>
              📊 Mönsteranalys-översikt
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#dc2626' }}>
                  {fraudPatterns.filter(p => p.trend === 'increasing').length}
                </div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>Ökande mönster</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#16a34a' }}>
                  {fraudPatterns.filter(p => p.trend === 'decreasing').length}
                </div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>Minskande mönster</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b' }}>
                  {fraudPatterns.reduce((sum, p) => sum + p.affectedBusinesses, 0)}
                </div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>Påverkade företag totalt</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#dc2626' }}>
                  {fraudPatterns.reduce((sum, p) => sum + p.estimatedLoss, 0).toLocaleString('sv-SE')} SEK
                </div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>Total uppskattad förlust</div>
              </div>
            </div>
          </div>

          {/* Individual Pattern Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '16px' }}>
            {fraudPatterns.map((pattern) => (
              <div
                key={pattern.id}
                style={{
                  backgroundColor: 'white',
                  borderRadius: '8px',
                  padding: '20px',
                  border: '1px solid #e2e8f0',
                  position: 'relative',
                  ...(pattern.trend === 'increasing' ? { borderLeft: '4px solid #dc2626' } : {}),
                  ...(pattern.riskLevel === 'critical' ? { boxShadow: '0 4px 12px rgba(220, 38, 38, 0.15)' } : {})
                }}
              >
                {/* Trend Indicator */}
                <div style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <div style={{
                    fontSize: '18px',
                    ...(pattern.trend === 'increasing' ? { color: '#dc2626' } : 
                       pattern.trend === 'decreasing' ? { color: '#16a34a' } : { color: '#64748b' })
                  }}>
                    {pattern.trend === 'increasing' ? '📈' : pattern.trend === 'decreasing' ? '📉' : '📊'}
                  </div>
                  <span
                    style={{
                      backgroundColor: getSeverityColor(pattern.riskLevel),
                      color: 'white',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: 'bold'
                    }}
                  >
                    {getSeverityLabel(pattern.riskLevel)}
                  </span>
                </div>

                <div style={{ marginRight: '80px', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#1e293b', margin: 0, marginBottom: '4px' }}>
                    {pattern.name}
                  </h3>
                  <p style={{ fontSize: '14px', color: '#64748b', margin: 0, lineHeight: '1.4' }}>
                    {pattern.description}
                  </p>
                </div>

                {/* Enhanced Metrics Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '16px' }}>
                  <div style={{ 
                    backgroundColor: '#f8fafc', 
                    padding: '12px', 
                    borderRadius: '6px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1e293b', marginBottom: '2px' }}>
                      {pattern.occurrences}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Förekomster
                    </div>
                  </div>
                  
                  <div style={{ 
                    backgroundColor: pattern.trend === 'increasing' ? '#fef2f2' : pattern.trend === 'decreasing' ? '#f0fdf4' : '#f8fafc',
                    padding: '12px', 
                    borderRadius: '6px',
                    textAlign: 'center'
                  }}>
                    <div style={{ 
                      fontSize: '14px', 
                      fontWeight: '600',
                      color: pattern.trend === 'increasing' ? '#dc2626' : pattern.trend === 'decreasing' ? '#16a34a' : '#64748b',
                      marginBottom: '2px'
                    }}>
                      {pattern.trend === 'increasing' ? '↗️ Ökar' : pattern.trend === 'decreasing' ? '↘️ Minskar' : '→ Stabil'}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Trend
                    </div>
                  </div>

                  <div style={{ 
                    backgroundColor: '#f8fafc', 
                    padding: '12px', 
                    borderRadius: '6px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e293b', marginBottom: '2px' }}>
                      {pattern.affectedBusinesses}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Företag
                    </div>
                  </div>
                  
                  <div style={{ 
                    backgroundColor: '#fef2f2', 
                    padding: '12px', 
                    borderRadius: '6px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#dc2626', marginBottom: '2px' }}>
                      {pattern.estimatedLoss.toLocaleString('sv-SE')}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      SEK förlust
                    </div>
                  </div>
                </div>

                {/* Time and Risk Indicators */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  paddingTop: '12px', 
                  borderTop: '1px solid #f1f5f9'
                }}>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>
                    🕒 Senast upptäckt: {new Date(pattern.lastDetected).toLocaleDateString('sv-SE', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                  
                  {pattern.trend === 'increasing' && (
                    <div style={{
                      backgroundColor: '#fee2e2',
                      color: '#991b1b',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '10px',
                      fontWeight: '600',
                      textTransform: 'uppercase'
                    }}>
                      Prioritera granskning
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'compliance' && complianceMetrics && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '16px' }}>
          {/* GDPR Compliance */}
          <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '20px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
              <span style={{ fontSize: '24px', marginRight: '12px' }}>🛡️</span>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1e293b', margin: 0 }}>
                  GDPR-efterlevnad
                </h3>
                <div style={{ fontSize: '14px', color: '#64748b' }}>
                  Senaste granskning: {new Date(complianceMetrics.gdprCompliance.lastAudit).toLocaleDateString('sv-SE')}
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '14px', color: '#64748b' }}>Efterlevnadsgrad</span>
                <span style={{ 
                  fontSize: '20px', 
                  fontWeight: 'bold', 
                  color: complianceMetrics.gdprCompliance.score > 90 ? '#16a34a' : '#dc2626' 
                }}>
                  {complianceMetrics.gdprCompliance.score}%
                </span>
              </div>
              <div style={{ 
                width: '100%', 
                height: '8px', 
                backgroundColor: '#f1f5f9', 
                borderRadius: '4px',
                overflow: 'hidden'
              }}>
                <div style={{ 
                  width: `${complianceMetrics.gdprCompliance.score}%`, 
                  height: '100%', 
                  backgroundColor: complianceMetrics.gdprCompliance.score > 90 ? '#16a34a' : '#dc2626',
                  transition: 'width 0.3s ease'
                }} />
              </div>
            </div>

            {complianceMetrics.gdprCompliance.issues.length > 0 && (
              <div>
                <div style={{ fontSize: '14px', fontWeight: '500', color: '#dc2626', marginBottom: '8px' }}>
                  Identifierade problem:
                </div>
                <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px', color: '#64748b' }}>
                  {complianceMetrics.gdprCompliance.issues.map((issue, index) => (
                    <li key={index} style={{ marginBottom: '4px' }}>{issue}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Finansinspektionen */}
          <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '20px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
              <span style={{ fontSize: '24px', marginRight: '12px' }}>🏛️</span>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1e293b', margin: 0 }}>
                  Finansinspektionen
                </h3>
                <div style={{ fontSize: '14px', color: '#64748b' }}>
                  Rapporteringsstatus
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>Status</div>
                <div style={{ 
                  fontSize: '14px', 
                  fontWeight: '500',
                  color: complianceMetrics.finansinspektionen.reportingStatus === 'compliant' ? '#16a34a' : '#dc2626'
                }}>
                  {complianceMetrics.finansinspektionen.reportingStatus === 'compliant' ? '✅ Efterföljd' :
                   complianceMetrics.finansinspektionen.reportingStatus === 'delayed' ? '⏳ Försenad' : '❌ Problem'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>Väntande rapporter</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1e293b' }}>
                  {complianceMetrics.finansinspektionen.pendingReports}
                </div>
              </div>
            </div>

            <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f1f5f9', fontSize: '12px', color: '#6b7280' }}>
              Nästa deadline: {new Date(complianceMetrics.finansinspektionen.nextDeadline).toLocaleDateString('sv-SE')}
            </div>
          </div>

          {/* Konsumentverket */}
          <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '20px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
              <span style={{ fontSize: '24px', marginRight: '12px' }}>⚖️</span>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1e293b', margin: 0 }}>
                  Konsumentverket
                </h3>
                <div style={{ fontSize: '14px', color: '#64748b' }}>
                  Konsumentklagomål
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>Totala klagomål</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1e293b' }}>
                  {complianceMetrics.konsumentverket.complaints}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>Lösta</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#16a34a' }}>
                  {complianceMetrics.konsumentverket.resolved}
                </div>
              </div>
            </div>

            <div style={{ marginTop: '12px' }}>
              <div style={{ fontSize: '12px', color: '#64748b' }}>Genomsnittlig lösningstid</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e293b' }}>
                {complianceMetrics.konsumentverket.averageResolutionTime} dagar
              </div>
            </div>

            <div style={{ 
              marginTop: '12px', 
              paddingTop: '12px', 
              borderTop: '1px solid #f1f5f9',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ fontSize: '12px', color: '#6b7280' }}>
                Lösta: {Math.round((complianceMetrics.konsumentverket.resolved / complianceMetrics.konsumentverket.complaints) * 100)}%
              </span>
              <div style={{ 
                width: '60px', 
                height: '4px', 
                backgroundColor: '#f1f5f9', 
                borderRadius: '2px',
                overflow: 'hidden'
              }}>
                <div style={{ 
                  width: `${(complianceMetrics.konsumentverket.resolved / complianceMetrics.konsumentverket.complaints) * 100}%`, 
                  height: '100%', 
                  backgroundColor: '#16a34a'
                }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'cases' && (
        <div>
          {/* Case Management Header */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '20px',
            marginBottom: '20px',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1e293b', margin: 0 }}>
                📋 Ärendehantering & Utredning
              </h3>
              <button
                style={{
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                + Nytt ärende
              </button>
            </div>

            {/* Case Statistics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '16px' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#dc2626' }}>
                  {fraudAlerts.filter(a => a.status === 'open').length}
                </div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>Öppna ärenden</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ea580c' }}>
                  {fraudAlerts.filter(a => a.status === 'investigating').length}
                </div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>Under utredning</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#16a34a' }}>
                  {fraudAlerts.filter(a => a.status === 'resolved').length}
                </div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>Lösta ärenden</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1e293b' }}>
                  4.2
                </div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>Avg. lösningstid (dagar)</div>
              </div>
            </div>
          </div>

          {/* Active Cases List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Sample fraud cases based on alerts */}
            {fraudAlerts.filter(alert => alert.status !== 'resolved').map((alert) => (
              <div
                key={`case-${alert.id}`}
                style={{
                  backgroundColor: 'white',
                  borderRadius: '8px',
                  padding: '20px',
                  border: '1px solid #e2e8f0',
                  borderLeft: `4px solid ${getSeverityColor(alert.severity)}`
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span
                        style={{
                          backgroundColor: getSeverityColor(alert.severity),
                          color: 'white',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 'bold'
                        }}
                      >
                        {getSeverityLabel(alert.severity)}
                      </span>
                      <span
                        style={{
                          backgroundColor: '#f1f5f9',
                          color: '#475569',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '11px'
                        }}
                      >
                        Ärende #{alert.id.slice(-6)}
                      </span>
                      <span
                        style={{
                          backgroundColor: alert.status === 'open' ? '#fef3c7' : '#dbeafe',
                          color: alert.status === 'open' ? '#92400e' : '#1e40af',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '11px'
                        }}
                      >
                        {alert.status === 'open' ? 'Ej tilldelad' : 'Under utredning'}
                      </span>
                    </div>

                    <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#1e293b', margin: 0, marginBottom: '4px' }}>
                      {alert.title}
                    </h4>
                    <p style={{ fontSize: '14px', color: '#64748b', margin: 0, marginBottom: '12px' }}>
                      {alert.description}
                    </p>

                    {/* Case Details */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                      <div>
                        <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '2px' }}>Påverkat företag</div>
                        <div style={{ fontSize: '14px', fontWeight: '500', color: '#1e293b' }}>{alert.businessName}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '2px' }}>Transaktionsbelopp</div>
                        <div style={{ fontSize: '14px', fontWeight: '500', color: '#1e293b' }}>
                          {alert.amount.toLocaleString('sv-SE')} SEK
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '2px' }}>Upptäckt</div>
                        <div style={{ fontSize: '14px', fontWeight: '500', color: '#1e293b' }}>
                          {new Date(alert.detectedAt).toLocaleDateString('sv-SE')}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '2px' }}>Riskpoäng</div>
                        <div style={{ fontSize: '14px', fontWeight: 'bold', color: getSeverityColor(alert.severity) }}>
                          {alert.riskScore}/100
                        </div>
                      </div>
                    </div>

                    {/* Evidence Summary */}
                    {alert.evidence.length > 0 && (
                      <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
                        <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>
                          🔍 Bevis ({alert.evidence.length} st)
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {alert.evidence.slice(0, 3).map((evidence, index) => (
                            <span
                              key={index}
                              style={{
                                backgroundColor: '#f8fafc',
                                color: '#475569',
                                padding: '2px 6px',
                                borderRadius: '8px',
                                fontSize: '10px'
                              }}
                            >
                              {evidence.type}: {Math.round(evidence.confidence * 100)}%
                            </span>
                          ))}
                          {alert.evidence.length > 3 && (
                            <span style={{ fontSize: '10px', color: '#64748b' }}>
                              +{alert.evidence.length - 3} mer
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Swedish Compliance Flags */}
                    {alert.swedishComplianceFlags.length > 0 && (
                      <div style={{ marginTop: '12px' }}>
                        <div style={{ fontSize: '12px', color: '#dc2626', fontWeight: '500', marginBottom: '4px' }}>
                          🇸🇪 Regelefterlevnad:
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {alert.swedishComplianceFlags.slice(0, 2).map((flag, index) => (
                            <span
                              key={index}
                              style={{
                                backgroundColor: '#fef2f2',
                                color: '#991b1b',
                                padding: '2px 6px',
                                borderRadius: '8px',
                                fontSize: '10px'
                              }}
                            >
                              {flag}
                            </span>
                          ))}
                          {alert.swedishComplianceFlags.length > 2 && (
                            <span style={{ fontSize: '10px', color: '#64748b' }}>
                              +{alert.swedishComplianceFlags.length - 2} mer
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Case Actions */}
                  <div style={{ marginLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {alert.status === 'open' ? (
                      <button
                        style={{
                          backgroundColor: '#3b82f6',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '6px 12px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        Tilldela mig
                      </button>
                    ) : (
                      <div style={{
                        backgroundColor: '#dbeafe',
                        color: '#1e40af',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        textAlign: 'center'
                      }}>
                        {alert.assignedTo || 'admin_456_erik'}
                      </div>
                    )}

                    <button
                      onClick={() => setSelectedAlert(alert)}
                      style={{
                        backgroundColor: 'white',
                        color: '#374151',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        padding: '6px 12px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      Granska
                    </button>

                    {alert.severity === 'critical' && (
                      <button
                        style={{
                          backgroundColor: '#dc2626',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '6px 12px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        Blockera
                      </button>
                    )}
                  </div>
                </div>

                {/* Case Timeline/Progress */}
                <div style={{
                  marginTop: '16px',
                  paddingTop: '16px',
                  borderTop: '1px solid #f1f5f9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                      Skapad: {new Date(alert.detectedAt).toLocaleDateString('sv-SE', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                    
                    {alert.status === 'investigating' && (
                      <div style={{ fontSize: '12px', color: '#1e40af' }}>
                        ⏱️ Pågått: {Math.floor((Date.now() - new Date(alert.detectedAt).getTime()) / (1000 * 60 * 60))}h
                      </div>
                    )}
                  </div>

                  {/* Priority Actions */}
                  {alert.severity === 'critical' && (
                    <div style={{
                      backgroundColor: '#fef2f2',
                      color: '#991b1b',
                      padding: '4px 8px',
                      borderRadius: '12px',
                      fontSize: '10px',
                      fontWeight: '600',
                      textTransform: 'uppercase',
                      animation: 'pulse 2s infinite'
                    }}>
                      Hög prioritet
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Recently Resolved Cases */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '20px',
              border: '1px solid #e2e8f0',
              marginTop: '16px'
            }}>
              <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#1e293b', margin: 0, marginBottom: '16px' }}>
                ✅ Nyligen lösta ärenden
              </h4>
              
              {fraudAlerts.filter(alert => alert.status === 'resolved').map((alert) => (
                <div key={`resolved-${alert.id}`} style={{
                  padding: '12px',
                  backgroundColor: '#f0fdf4',
                  borderRadius: '6px',
                  marginBottom: '8px',
                  borderLeft: '3px solid #16a34a'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '500', color: '#1e293b', marginBottom: '2px' }}>
                        {alert.title}
                      </div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>
                        {alert.businessName} • Löst: {alert.resolvedAt ? new Date(alert.resolvedAt).toLocaleDateString('sv-SE') : 'N/A'}
                      </div>
                    </div>
                    <div style={{
                      backgroundColor: '#dcfce7',
                      color: '#166534',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: '500'
                    }}>
                      {alert.resolution || 'Löst'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Alert Detail Modal */}
      {selectedAlert && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '24px',
            maxWidth: '600px',
            width: '100%',
            maxHeight: '80vh',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>
                Bedrägervarning #{selectedAlert.id}
              </h2>
              <button
                onClick={() => setSelectedAlert(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '20px',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <span
                  style={{
                    backgroundColor: getSeverityColor(selectedAlert.severity),
                    color: 'white',
                    padding: '4px 12px',
                    borderRadius: '16px',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}
                >
                  {getSeverityLabel(selectedAlert.severity)}
                </span>
                <span
                  style={{
                    backgroundColor: '#f1f5f9',
                    color: '#475569',
                    padding: '4px 12px',
                    borderRadius: '16px',
                    fontSize: '12px'
                  }}
                >
                  {getCategoryLabel(selectedAlert.category)}
                </span>
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1e293b', marginBottom: '8px' }}>
                {selectedAlert.title}
              </h3>
              <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '16px' }}>
                {selectedAlert.description}
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '20px' }}>
              <div>
                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Riskpoäng</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: getSeverityColor(selectedAlert.severity) }}>
                  {selectedAlert.riskScore}/100
                </div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Förtroende</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b' }}>
                  {Math.round(selectedAlert.confidence * 100)}%
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b', marginBottom: '8px' }}>
                Bevis
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {selectedAlert.evidence.map((evidence, index) => (
                  <div
                    key={index}
                    style={{
                      backgroundColor: '#f8fafc',
                      padding: '12px',
                      borderRadius: '6px',
                      border: '1px solid #e2e8f0'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '14px', fontWeight: '500', color: '#1e293b' }}>
                        {evidence.type}
                      </span>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>
                        {Math.round(evidence.confidence * 100)}% förtroende
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px' }}>
                      {evidence.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {selectedAlert.swedishComplianceFlags.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b', marginBottom: '8px' }}>
                  🇸🇪 Svenska efterlevnadsflaggor
                </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {selectedAlert.swedishComplianceFlags.map((flag, index) => (
                    <span
                      key={index}
                      style={{
                        backgroundColor: '#fef2f2',
                        color: '#991b1b',
                        padding: '4px 8px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: '500'
                      }}
                    >
                      {flag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  // Handle assign investigation
                  setSelectedAlert(null);
                }}
                style={{
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Tilldela utredning
              </button>
              <button
                onClick={() => {
                  // Handle mark as false positive
                  setSelectedAlert(null);
                }}
                style={{
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Falskt alarm
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
}

