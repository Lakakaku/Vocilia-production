import React, { useState, useEffect } from 'react';
import { authManager } from '../utils/auth';

// Session status types
type SessionStatus = 'active' | 'paused' | 'completed' | 'terminated' | 'flagged' | 'error';
type SessionQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'critical';

interface LiveVoiceSession {
  sessionId: string;
  sessionToken: string;
  businessId: string;
  businessName: string;
  customerHash: string;
  status: SessionStatus;
  quality: SessionQuality;
  startTime: string;
  duration: number; // seconds
  currentPhase: 'greeting' | 'context_gathering' | 'feedback_collection' | 'quality_analysis' | 'closing';
  metrics: {
    audioQuality: number; // 0-100
    responseLatency: number; // ms
    conversationFlow: number; // 0-100
    aiPerformance: number; // 0-100
    customerEngagement: number; // 0-100
  };
  realTimeData: {
    currentTranscript: string;
    lastAIResponse: string;
    emotionalTone: 'positive' | 'neutral' | 'negative' | 'frustrated';
    speechRate: number; // words per minute
    volumeLevel: number; // 0-100
    backgroundNoise: number; // 0-100
  };
  interventions: Array<{
    id: string;
    type: 'pause' | 'resume' | 'flag' | 'terminate' | 'admin_note';
    timestamp: string;
    adminId: string;
    reason: string;
  }>;
  location: {
    city: string;
    region: string;
    coordinates?: { lat: number; lng: number };
  };
  device: {
    type: 'mobile' | 'tablet' | 'desktop';
    browser: string;
    connection: 'wifi' | '4g' | '5g' | 'ethernet';
    connectionQuality: number; // 0-100
  };
}

interface SystemMetrics {
  activeSessions: number;
  totalSessionsToday: number;
  averageSessionDuration: number;
  systemLoad: number;
  errorRate: number;
  responseLatency: number;
}

export default function LiveSessionsPage() {
  const [liveSessions, setLiveSessions] = useState<LiveVoiceSession[]>([]);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
  const [selectedSession, setSelectedSession] = useState<LiveVoiceSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(2000); // 2 seconds
  const [filterStatus, setFilterStatus] = useState<SessionStatus | 'all'>('all');
  const [sortBy, setSortBy] = useState<'duration' | 'quality' | 'startTime' | 'businessName'>('startTime');

  // Real-time data fetching
  useEffect(() => {
    const fetchLiveData = async () => {
      try {
        const response = await authManager.makeAuthenticatedRequest('/api/admin/live-sessions', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });

        if (response.success) {
          setLiveSessions(response.data.sessions);
          setSystemMetrics(response.data.systemMetrics);
        }
      } catch (error) {
        console.error('Failed to load live sessions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLiveData();

    // Set up auto-refresh interval
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(fetchLiveData, refreshInterval);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, refreshInterval]);

  const handleSessionIntervention = async (
    sessionId: string, 
    action: 'pause' | 'resume' | 'terminate' | 'flag',
    reason: string
  ) => {
    try {
      const response = await authManager.makeAuthenticatedRequest(
        `/api/admin/live-sessions/${sessionId}/intervene`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, reason })
        }
      );

      if (response.success) {
        // Update the session in state
        setLiveSessions(prev =>
          prev.map(session =>
            session.sessionId === sessionId
              ? { ...session, status: action === 'pause' ? 'paused' : action === 'flag' ? 'flagged' : 'terminated' }
              : session
          )
        );
      }
    } catch (error) {
      console.error('Failed to intervene in session:', error);
    }
  };

  const getStatusColor = (status: SessionStatus): string => {
    const colors = {
      active: '#10b981',      // green
      paused: '#f59e0b',      // yellow
      completed: '#6b7280',   // gray
      terminated: '#ef4444',  // red
      flagged: '#f97316',     // orange
      error: '#dc2626'        // dark red
    };
    return colors[status] || '#6b7280';
  };

  const getQualityColor = (quality: SessionQuality): string => {
    const colors = {
      excellent: '#10b981',   // green
      good: '#84cc16',        // lime
      fair: '#f59e0b',        // yellow
      poor: '#f97316',        // orange
      critical: '#ef4444'     // red
    };
    return colors[quality] || '#6b7280';
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getFilteredAndSortedSessions = (): LiveVoiceSession[] => {
    let filtered = liveSessions;
    
    if (filterStatus !== 'all') {
      filtered = filtered.filter(session => session.status === filterStatus);
    }

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'duration':
          return b.duration - a.duration;
        case 'quality':
          const qualityOrder = { excellent: 5, good: 4, fair: 3, poor: 2, critical: 1 };
          return qualityOrder[b.quality] - qualityOrder[a.quality];
        case 'startTime':
          return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
        case 'businessName':
          return a.businessName.localeCompare(b.businessName);
        default:
          return 0;
      }
    });
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '400px',
        fontSize: '16px',
        color: '#6b7280'
      }}>
        Laddar live-sessioner...
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', minHeight: '100vh', backgroundColor: '#f8fafc' }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '32px' 
      }}>
        <div>
          <h1 style={{ 
            fontSize: '28px', 
            fontWeight: 'bold', 
            color: '#1e293b', 
            margin: 0,
            marginBottom: '8px' 
          }}>
            🎙️ Live Röstsessioner
          </h1>
          <p style={{ 
            fontSize: '16px', 
            color: '#64748b', 
            margin: 0 
          }}>
            Realtidsövervakning av aktiva feedback-sessioner
          </p>
        </div>
        
        {/* Auto-refresh controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            <span style={{ fontSize: '14px', color: '#374151' }}>Auto-uppdatering</span>
          </label>
          <select
            value={refreshInterval}
            onChange={(e) => setRefreshInterval(Number(e.target.value))}
            style={{
              padding: '6px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          >
            <option value={1000}>1s</option>
            <option value={2000}>2s</option>
            <option value={5000}>5s</option>
            <option value={10000}>10s</option>
          </select>
        </div>
      </div>

      {/* System Metrics Overview */}
      {systemMetrics && (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '16px',
          marginBottom: '32px'
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            border: '1px solid #e2e8f0'
          }}>
            <h3 style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 8px 0' }}>Aktiva Sessioner</h3>
            <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>
              {systemMetrics.activeSessions}
            </p>
          </div>
          
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            border: '1px solid #e2e8f0'
          }}>
            <h3 style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 8px 0' }}>Idag Totalt</h3>
            <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>
              {systemMetrics.totalSessionsToday}
            </p>
          </div>
          
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            border: '1px solid #e2e8f0'
          }}>
            <h3 style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 8px 0' }}>Avg. Varaktighet</h3>
            <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>
              {formatDuration(systemMetrics.averageSessionDuration)}
            </p>
          </div>
          
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            border: '1px solid #e2e8f0'
          }}>
            <h3 style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 8px 0' }}>Systembelastning</h3>
            <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>
              {systemMetrics.systemLoad}%
            </p>
          </div>
          
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            border: '1px solid #e2e8f0'
          }}>
            <h3 style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 8px 0' }}>Felfrekvens</h3>
            <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>
              {systemMetrics.errorRate.toFixed(2)}%
            </p>
          </div>
          
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            border: '1px solid #e2e8f0'
          }}>
            <h3 style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 8px 0' }}>Svarstid</h3>
            <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>
              {systemMetrics.responseLatency}ms
            </p>
          </div>
        </div>
      )}

      {/* Filters and Controls */}
      <div style={{ 
        display: 'flex', 
        gap: '16px', 
        marginBottom: '24px',
        alignItems: 'center'
      }}>
        <div>
          <label style={{ fontSize: '14px', color: '#374151', marginRight: '8px' }}>Filter:</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as SessionStatus | 'all')}
            style={{
              padding: '6px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          >
            <option value="all">Alla Sessioner</option>
            <option value="active">Aktiva</option>
            <option value="paused">Pausade</option>
            <option value="flagged">Flaggade</option>
            <option value="error">Fel</option>
          </select>
        </div>
        
        <div>
          <label style={{ fontSize: '14px', color: '#374151', marginRight: '8px' }}>Sortera:</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            style={{
              padding: '6px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          >
            <option value="startTime">Starttid</option>
            <option value="duration">Varaktighet</option>
            <option value="quality">Kvalitet</option>
            <option value="businessName">Företagsnamn</option>
          </select>
        </div>
      </div>

      {/* Live Sessions Grid */}
      {getFilteredAndSortedSessions().length === 0 ? (
        <div style={{
          backgroundColor: 'white',
          padding: '48px',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          textAlign: 'center'
        }}>
          <p style={{ fontSize: '16px', color: '#6b7280', margin: 0 }}>
            Inga aktiva sessioner för närvarande
          </p>
        </div>
      ) : (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', 
          gap: '20px' 
        }}>
          {getFilteredAndSortedSessions().map((session) => (
            <div key={session.sessionId} style={{
              backgroundColor: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '20px',
              position: 'relative'
            }}>
              {/* Session Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <div style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: getStatusColor(session.status)
                    }} />
                    <h3 style={{ 
                      fontSize: '16px', 
                      fontWeight: '600', 
                      color: '#1e293b', 
                      margin: 0 
                    }}>
                      {session.businessName}
                    </h3>
                  </div>
                  
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '2px' }}>
                    {session.location.city}, {session.location.region}
                  </div>
                  
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>
                    Varaktighet: {formatDuration(session.duration)}
                  </div>
                </div>
                
                <div style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: '500',
                  backgroundColor: getQualityColor(session.quality) + '20',
                  color: getQualityColor(session.quality),
                  border: `1px solid ${getQualityColor(session.quality)}40`
                }}>
                  {session.quality === 'excellent' ? 'Utmärkt' :
                   session.quality === 'good' ? 'Bra' :
                   session.quality === 'fair' ? 'OK' :
                   session.quality === 'poor' ? 'Dålig' : 'Kritisk'}
                </div>
              </div>

              {/* Current Phase */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Nuvarande Fas:</div>
                <div style={{ fontSize: '14px', color: '#374151', fontWeight: '500' }}>
                  {session.currentPhase === 'greeting' ? 'Hälsning' :
                   session.currentPhase === 'context_gathering' ? 'Kontextsamling' :
                   session.currentPhase === 'feedback_collection' ? 'Feedback-insamling' :
                   session.currentPhase === 'quality_analysis' ? 'Kvalitetsanalys' : 'Avslutning'}
                </div>
              </div>

              {/* Performance Metrics */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>Prestandamått:</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
                  <div>
                    <span style={{ color: '#6b7280' }}>Ljudkvalitet: </span>
                    <span style={{ fontWeight: '500', color: '#374151' }}>{session.metrics.audioQuality}%</span>
                  </div>
                  <div>
                    <span style={{ color: '#6b7280' }}>Svarstid: </span>
                    <span style={{ fontWeight: '500', color: '#374151' }}>{session.metrics.responseLatency}ms</span>
                  </div>
                  <div>
                    <span style={{ color: '#6b7280' }}>AI-prestanda: </span>
                    <span style={{ fontWeight: '500', color: '#374151' }}>{session.metrics.aiPerformance}%</span>
                  </div>
                  <div>
                    <span style={{ color: '#6b7280' }}>Engagemang: </span>
                    <span style={{ fontWeight: '500', color: '#374151' }}>{session.metrics.customerEngagement}%</span>
                  </div>
                </div>
              </div>

              {/* Real-time Status */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Känslotillstånd:</div>
                <div style={{ 
                  fontSize: '12px', 
                  color: session.realTimeData.emotionalTone === 'positive' ? '#059669' :
                         session.realTimeData.emotionalTone === 'negative' ? '#dc2626' :
                         session.realTimeData.emotionalTone === 'frustrated' ? '#ea580c' : '#6b7280',
                  fontWeight: '500'
                }}>
                  {session.realTimeData.emotionalTone === 'positive' ? '😊 Positiv' :
                   session.realTimeData.emotionalTone === 'negative' ? '😞 Negativ' :
                   session.realTimeData.emotionalTone === 'frustrated' ? '😤 Frustrerad' : '😐 Neutral'}
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setSelectedSession(session)}
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  📊 Detaljer
                </button>
                
                {session.status === 'active' && (
                  <button
                    onClick={() => handleSessionIntervention(session.sessionId, 'pause', 'Admin pausade session för granskning')}
                    style={{
                      padding: '6px 12px',
                      fontSize: '12px',
                      backgroundColor: '#f59e0b',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    ⏸️ Pausa
                  </button>
                )}
                
                {session.status === 'paused' && (
                  <button
                    onClick={() => handleSessionIntervention(session.sessionId, 'resume', 'Admin återupptog session')}
                    style={{
                      padding: '6px 12px',
                      fontSize: '12px',
                      backgroundColor: '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    ▶️ Återuppta
                  </button>
                )}
                
                <button
                  onClick={() => handleSessionIntervention(session.sessionId, 'flag', 'Admin flaggade session för kvalitetsgranskning')}
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    backgroundColor: '#f97316',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  🚩 Flagga
                </button>
                
                <button
                  onClick={() => handleSessionIntervention(session.sessionId, 'terminate', 'Admin terminerade session på grund av kvalitetsproblem')}
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    backgroundColor: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  ⛔ Terminera
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Session Detail Modal with Replay & Analysis */}
      {selectedSession && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '0',
            maxWidth: '1200px',
            maxHeight: '90vh',
            overflowY: 'auto',
            width: '95%'
          }}>
            {/* Modal Header */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              padding: '24px',
              borderBottom: '1px solid #e2e8f0'
            }}>
              <div>
                <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b', margin: '0 0 8px 0' }}>
                  🎙️ Session Analys & Återuppspelning
                </h2>
                <p style={{ fontSize: '16px', color: '#64748b', margin: 0 }}>
                  {selectedSession.businessName} • {selectedSession.location.city}
                </p>
              </div>
              <button
                onClick={() => setSelectedSession(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '28px',
                  cursor: 'pointer',
                  color: '#6b7280'
                }}
              >
                ×
              </button>
            </div>
            
            {/* Session Overview Cards */}
            <div style={{ padding: '24px' }}>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
                gap: '16px',
                marginBottom: '32px'
              }}>
                <div style={{
                  backgroundColor: '#f8fafc',
                  padding: '20px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0'
                }}>
                  <h3 style={{ fontSize: '16px', color: '#374151', margin: '0 0 12px 0', fontWeight: '600' }}>Session Information</h3>
                  <div style={{ fontSize: '14px', color: '#6b7280', lineHeight: '1.6' }}>
                    <p><strong>Session ID:</strong> {selectedSession.sessionId.slice(-8)}</p>
                    <p><strong>Status:</strong> <span style={{ color: getStatusColor(selectedSession.status) }}>{selectedSession.status}</span></p>
                    <p><strong>Varaktighet:</strong> {formatDuration(selectedSession.duration)}</p>
                    <p><strong>Aktuell Fas:</strong> {
                      selectedSession.currentPhase === 'greeting' ? 'Hälsning' :
                      selectedSession.currentPhase === 'context_gathering' ? 'Kontextsamling' :
                      selectedSession.currentPhase === 'feedback_collection' ? 'Feedback-insamling' :
                      selectedSession.currentPhase === 'quality_analysis' ? 'Kvalitetsanalys' : 'Avslutning'
                    }</p>
                  </div>
                </div>
                
                <div style={{
                  backgroundColor: '#f0f9ff',
                  padding: '20px',
                  borderRadius: '8px',
                  border: '1px solid #bae6fd'
                }}>
                  <h3 style={{ fontSize: '16px', color: '#0c4a6e', margin: '0 0 12px 0', fontWeight: '600' }}>AI Performance Metrics</h3>
                  <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span>Ljudkvalitet:</span>
                      <span style={{ fontWeight: '600', color: selectedSession.metrics.audioQuality > 80 ? '#059669' : selectedSession.metrics.audioQuality > 60 ? '#f59e0b' : '#dc2626' }}>
                        {selectedSession.metrics.audioQuality}%
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span>Svarstid:</span>
                      <span style={{ fontWeight: '600', color: selectedSession.metrics.responseLatency < 2000 ? '#059669' : selectedSession.metrics.responseLatency < 4000 ? '#f59e0b' : '#dc2626' }}>
                        {selectedSession.metrics.responseLatency}ms
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span>AI-prestanda:</span>
                      <span style={{ fontWeight: '600', color: selectedSession.metrics.aiPerformance > 80 ? '#059669' : selectedSession.metrics.aiPerformance > 60 ? '#f59e0b' : '#dc2626' }}>
                        {selectedSession.metrics.aiPerformance}%
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Engagemang:</span>
                      <span style={{ fontWeight: '600', color: selectedSession.metrics.customerEngagement > 70 ? '#059669' : selectedSession.metrics.customerEngagement > 50 ? '#f59e0b' : '#dc2626' }}>
                        {selectedSession.metrics.customerEngagement}%
                      </span>
                    </div>
                  </div>
                </div>
                
                <div style={{
                  backgroundColor: '#f0fdf4',
                  padding: '20px',
                  borderRadius: '8px',
                  border: '1px solid #bbf7d0'
                }}>
                  <h3 style={{ fontSize: '16px', color: '#14532d', margin: '0 0 12px 0', fontWeight: '600' }}>Real-time Status</h3>
                  <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
                    <p><strong>Känslotillstånd:</strong> 
                      <span style={{ 
                        marginLeft: '8px',
                        color: selectedSession.realTimeData.emotionalTone === 'positive' ? '#059669' :
                               selectedSession.realTimeData.emotionalTone === 'negative' ? '#dc2626' :
                               selectedSession.realTimeData.emotionalTone === 'frustrated' ? '#ea580c' : '#6b7280'
                      }}>
                        {selectedSession.realTimeData.emotionalTone === 'positive' ? '😊 Positiv' :
                         selectedSession.realTimeData.emotionalTone === 'negative' ? '😞 Negativ' :
                         selectedSession.realTimeData.emotionalTone === 'frustrated' ? '😤 Frustrerad' : '😐 Neutral'}
                      </span>
                    </p>
                    <p><strong>Talhastighet:</strong> {selectedSession.realTimeData.speechRate} ord/min</p>
                    <p><strong>Volymnivå:</strong> {selectedSession.realTimeData.volumeLevel}%</p>
                    <p><strong>Bakgrundsbrus:</strong> {selectedSession.realTimeData.backgroundNoise}%</p>
                  </div>
                </div>
                
                <div style={{
                  backgroundColor: '#fefce8',
                  padding: '20px',
                  borderRadius: '8px',
                  border: '1px solid #fde047'
                }}>
                  <h3 style={{ fontSize: '16px', color: '#713f12', margin: '0 0 12px 0', fontWeight: '600' }}>Teknisk Information</h3>
                  <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
                    <p><strong>Enhet:</strong> {selectedSession.device.type} ({selectedSession.device.browser})</p>
                    <p><strong>Anslutning:</strong> {selectedSession.device.connection}</p>
                    <p><strong>Anslutningskvalitet:</strong> {selectedSession.device.connectionQuality}%</p>
                    <p><strong>Plats:</strong> {selectedSession.location.city}, {selectedSession.location.region}</p>
                  </div>
                </div>
              </div>

              {/* Real-time Transcript Section */}
              <div style={{ marginBottom: '32px' }}>
                <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#1e293b', marginBottom: '16px' }}>
                  📝 Live-transkription & Konversation
                </h3>
                
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '1fr 1fr', 
                  gap: '20px',
                  marginBottom: '20px'
                }}>
                  <div style={{
                    backgroundColor: '#f8fafc',
                    padding: '16px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0'
                  }}>
                    <h4 style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 8px 0' }}>Kund Säger Nu:</h4>
                    <div style={{ 
                      fontSize: '14px', 
                      color: '#374151', 
                      lineHeight: '1.5',
                      fontStyle: 'italic',
                      minHeight: '60px'
                    }}>
                      "{selectedSession.realTimeData.currentTranscript}"
                    </div>
                  </div>
                  
                  <div style={{
                    backgroundColor: '#eff6ff',
                    padding: '16px',
                    borderRadius: '8px',
                    border: '1px solid #bfdbfe'
                  }}>
                    <h4 style={{ fontSize: '14px', color: '#1e40af', margin: '0 0 8px 0' }}>AI Senaste Svar:</h4>
                    <div style={{ 
                      fontSize: '14px', 
                      color: '#1e40af', 
                      lineHeight: '1.5',
                      fontStyle: 'italic',
                      minHeight: '60px'
                    }}>
                      "{selectedSession.realTimeData.lastAIResponse}"
                    </div>
                  </div>
                </div>
                
                {/* Session Replay Controls */}
                <div style={{
                  backgroundColor: 'white',
                  border: '2px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '20px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#1e293b', margin: 0 }}>
                      🎬 Session Återuppspelning
                    </h4>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button style={{
                        padding: '8px 12px',
                        backgroundColor: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}>
                        ⏮️ Början
                      </button>
                      <button style={{
                        padding: '8px 12px',
                        backgroundColor: '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}>
                        ▶️ Spela
                      </button>
                      <button style={{
                        padding: '8px 12px',
                        backgroundColor: '#f59e0b',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}>
                        ⏸️ Pausa
                      </button>
                      <button style={{
                        padding: '8px 12px',
                        backgroundColor: '#6b7280',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}>
                        ⏭️ Slut
                      </button>
                    </div>
                  </div>
                  
                  {/* Progress Bar */}
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{
                      width: '100%',
                      height: '8px',
                      backgroundColor: '#e2e8f0',
                      borderRadius: '4px',
                      position: 'relative'
                    }}>
                      <div style={{
                        width: '60%', // Mock progress
                        height: '100%',
                        backgroundColor: '#3b82f6',
                        borderRadius: '4px'
                      }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                      <span>{formatDuration(Math.floor(selectedSession.duration * 0.6))}</span>
                      <span>{formatDuration(selectedSession.duration)}</span>
                    </div>
                  </div>
                  
                  {/* Mock Conversation Timeline */}
                  <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
                      {/* Mock conversation entries */}
                      <div style={{ marginBottom: '12px', padding: '8px', backgroundColor: '#f0f9ff', borderRadius: '6px' }}>
                        <div style={{ fontSize: '12px', color: '#6b7280' }}>00:15 - AI</div>
                        <div>Hej! Tack för att du besökte {selectedSession.businessName} idag.</div>
                      </div>
                      <div style={{ marginBottom: '12px', padding: '8px', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
                        <div style={{ fontSize: '12px', color: '#6b7280' }}>00:32 - Kund</div>
                        <div>Hej! Ja, det var en bra upplevelse överlag.</div>
                      </div>
                      <div style={{ marginBottom: '12px', padding: '8px', backgroundColor: '#f0f9ff', borderRadius: '6px' }}>
                        <div style={{ fontSize: '12px', color: '#6b7280' }}>00:45 - AI</div>
                        <div>Vad var det bästa med din upplevelse idag?</div>
                      </div>
                      <div style={{ marginBottom: '12px', padding: '8px', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
                        <div style={{ fontSize: '12px', color: '#6b7280' }}>01:12 - Kund</div>
                        <div>{selectedSession.realTimeData.currentTranscript}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quality Analysis Section */}
              <div style={{ marginBottom: '32px' }}>
                <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#1e293b', marginBottom: '16px' }}>
                  📊 Kvalitetsanalys & QA-verktyg
                </h3>
                
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '1fr 1fr', 
                  gap: '20px'
                }}>
                  {/* Quality Metrics Chart */}
                  <div style={{
                    backgroundColor: 'white',
                    padding: '20px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0'
                  }}>
                    <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#374151', marginBottom: '16px' }}>
                      Prestanda över Tid
                    </h4>
                    <div style={{ height: '120px', backgroundColor: '#f8fafc', borderRadius: '6px', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ textAlign: 'center', color: '#6b7280' }}>
                        📈 Mock Chart Area<br/>
                        <small>AI-prestanda, Ljudkvalitet, Engagemang</small>
                      </div>
                    </div>
                  </div>
                  
                  {/* Issue Detection */}
                  <div style={{
                    backgroundColor: 'white',
                    padding: '20px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0'
                  }}>
                    <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#374151', marginBottom: '16px' }}>
                      Automatisk Problemdetektering
                    </h4>
                    <div style={{ fontSize: '14px' }}>
                      {selectedSession.status === 'error' ? (
                        <div style={{ padding: '8px', backgroundColor: '#fef2f2', borderRadius: '6px', marginBottom: '8px' }}>
                          <span style={{ color: '#dc2626' }}>🚨 Kritiskt fel</span>
                          <div style={{ color: '#6b7280', fontSize: '12px' }}>WebSocket-anslutning avbruten</div>
                        </div>
                      ) : selectedSession.status === 'flagged' ? (
                        <div style={{ padding: '8px', backgroundColor: '#fef3c7', borderRadius: '6px', marginBottom: '8px' }}>
                          <span style={{ color: '#d97706' }}>⚠️ Kvalitetsproblem</span>
                          <div style={{ color: '#6b7280', fontSize: '12px' }}>Låg AI-prestanda detekterad</div>
                        </div>
                      ) : (
                        <div style={{ padding: '8px', backgroundColor: '#f0fdf4', borderRadius: '6px', marginBottom: '8px' }}>
                          <span style={{ color: '#059669' }}>✅ Inga problem</span>
                          <div style={{ color: '#6b7280', fontSize: '12px' }}>Session presterar inom normalområdet</div>
                        </div>
                      )}
                      
                      <div style={{ marginTop: '12px' }}>
                        <div style={{ fontSize: '12px', color: '#6b7280' }}>Kvalitetspoäng:</div>
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '8px',
                          padding: '8px',
                          backgroundColor: getQualityColor(selectedSession.quality) + '20',
                          borderRadius: '6px',
                          marginTop: '4px'
                        }}>
                          <div style={{
                            width: '12px',
                            height: '12px',
                            borderRadius: '50%',
                            backgroundColor: getQualityColor(selectedSession.quality)
                          }} />
                          <span style={{ color: getQualityColor(selectedSession.quality), fontWeight: '600' }}>
                            {selectedSession.quality === 'excellent' ? 'Utmärkt (90-100)' :
                             selectedSession.quality === 'good' ? 'Bra (75-89)' :
                             selectedSession.quality === 'fair' ? 'OK (60-74)' :
                             selectedSession.quality === 'poor' ? 'Dålig (40-59)' : 'Kritisk (0-39)'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Intervention History */}
              {selectedSession.interventions.length > 0 && (
                <div style={{ marginBottom: '32px' }}>
                  <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#1e293b', marginBottom: '16px' }}>
                    ⚡ Interventionshistorik
                  </h3>
                  <div style={{
                    backgroundColor: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    overflow: 'hidden'
                  }}>
                    {selectedSession.interventions.map((intervention, index) => (
                      <div key={intervention.id} style={{
                        padding: '16px',
                        borderBottom: index < selectedSession.interventions.length - 1 ? '1px solid #e2e8f0' : 'none',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start'
                      }}>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
                            {intervention.type === 'pause' ? '⏸️ Session pausad' :
                             intervention.type === 'flag' ? '🚩 Session flaggad' :
                             intervention.type === 'terminate' ? '⛔ Session terminerad' : '📝 Admin-anteckning'}
                          </div>
                          <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>
                            {intervention.reason}
                          </div>
                          <div style={{ fontSize: '12px', color: '#9ca3af' }}>
                            {new Date(intervention.timestamp).toLocaleString('sv-SE')} • Admin ID: {intervention.adminId}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ 
                display: 'flex', 
                gap: '12px', 
                justifyContent: 'flex-end',
                paddingTop: '20px',
                borderTop: '1px solid #e2e8f0'
              }}>
                <button style={{
                  padding: '10px 16px',
                  backgroundColor: '#f3f4f6',
                  color: '#374151',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}>
                  📋 Exportera Rapport
                </button>
                <button style={{
                  padding: '10px 16px',
                  backgroundColor: '#f59e0b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}>
                  🚩 Flagga för Granskning
                </button>
                <button
                  onClick={() => setSelectedSession(null)}
                  style={{
                    padding: '10px 16px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  ✅ Stäng Analys
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

