import { useState, useEffect } from 'react';

export default function AdminPanel() {
  const [selectedTab, setSelectedTab] = useState('dashboard');
  const [adminData, setAdminData] = useState<any>(null);

  useEffect(() => {
    // Simulate loading admin data
    setAdminData({
      platform: {
        totalBusinesses: 89,
        totalFeedbacks: 12847,
        totalRevenue: 147650, // SEK platform fees
        avgQualityScore: 71.4,
        uptime: 99.8,
        aiProcessingTime: 1.3 // seconds
      },
      businesses: [
        {
          id: 1,
          name: 'Café Aurora Stockholm',
          orgNumber: '556123-4567',
          status: 'active',
          feedbacks: 147,
          revenue: 18450,
          avgScore: 73.2,
          riskLevel: 'low',
          lastActivity: '2024-08-26 14:30'
        },
        {
          id: 2,
          name: 'Bageri Solen Göteborg',
          orgNumber: '556789-0123',
          status: 'active',
          feedbacks: 203,
          revenue: 24680,
          avgScore: 79.1,
          riskLevel: 'low',
          lastActivity: '2024-08-26 13:45'
        },
        {
          id: 3,
          name: 'Restaurang Viking Malmö',
          orgNumber: '556456-7890',
          status: 'pending',
          feedbacks: 0,
          revenue: 0,
          avgScore: 0,
          riskLevel: 'medium',
          lastActivity: 'Never'
        }
      ],
      alerts: [
        {
          id: 1,
          type: 'fraud',
          severity: 'high',
          business: 'Pizzeria Roma Stockholm',
          message: 'Misstänkta repetitiva feedback-mönster upptäckta',
          time: '2024-08-26 14:15'
        },
        {
          id: 2,
          type: 'system',
          severity: 'medium',
          business: null,
          message: 'AI-processering tar 15% längre tid än normalt',
          time: '2024-08-26 13:30'
        },
        {
          id: 3,
          type: 'business',
          severity: 'low',
          business: 'Café Mokka Uppsala',
          message: 'Kvalitetspoäng har sjunkit med 12% senaste veckan',
          time: '2024-08-26 12:45'
        }
      ],
      systemMetrics: {
        voiceProcessingLatency: 1.3,
        fraudDetectionAccuracy: 96.7,
        apiUptime: 99.8,
        databaseConnections: 47,
        activeWebSockets: 23,
        queuedJobs: 5
      }
    });
  }, []);

  const TabButton = ({ id, label, active }: { id: string; label: string; active: boolean }) => (
    <button
      onClick={() => setSelectedTab(id)}
      style={{
        padding: '12px 24px',
        border: 'none',
        borderRadius: '8px',
        backgroundColor: active ? '#dc2626' : '#f1f5f9',
        color: active ? 'white' : '#64748b',
        fontWeight: active ? 'bold' : 'normal',
        cursor: 'pointer',
        transition: 'all 0.2s'
      }}
    >
      {label}
    </button>
  );

  const StatusBadge = ({ status }: { status: string }) => {
    const colors = {
      active: { bg: '#ecfdf5', border: '#a7f3d0', text: '#047857' },
      pending: { bg: '#fefce8', border: '#fde047', text: '#a16207' },
      suspended: { bg: '#fef2f2', border: '#fca5a5', text: '#dc2626' }
    };
    const color = colors[status as keyof typeof colors] || colors.pending;
    
    return (
      <div style={{ 
        backgroundColor: color.bg,
        padding: '4px 12px',
        borderRadius: '12px',
        border: `1px solid ${color.border}`,
        color: color.text,
        fontSize: '0.8rem',
        fontWeight: 'bold',
        display: 'inline-block'
      }}>
        {status.toUpperCase()}
      </div>
    );
  };

  const RiskBadge = ({ level }: { level: string }) => {
    const colors = {
      low: { bg: '#ecfdf5', border: '#a7f3d0', text: '#047857' },
      medium: { bg: '#fefce8', border: '#fde047', text: '#a16207' },
      high: { bg: '#fef2f2', border: '#fca5a5', text: '#dc2626' }
    };
    const color = colors[level as keyof typeof colors] || colors.low;
    
    return (
      <div style={{ 
        backgroundColor: color.bg,
        padding: '4px 12px',
        borderRadius: '12px',
        border: `1px solid ${color.border}`,
        color: color.text,
        fontSize: '0.8rem',
        fontWeight: 'bold',
        display: 'inline-block'
      }}>
        {level.toUpperCase()} RISK
      </div>
    );
  };

  if (!adminData) return <div>Laddar admin panel...</div>;

  return (
    <div style={{ 
      fontFamily: 'system-ui, -apple-system, sans-serif',
      backgroundColor: '#f8fafc',
      minHeight: '100vh',
      padding: '20px'
    }}>
      
      {/* Header */}
      <div style={{ 
        backgroundColor: '#dc2626',
        borderRadius: '12px',
        padding: '30px',
        marginBottom: '20px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        color: 'white'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ 
              fontSize: '2rem', 
              marginBottom: '5px',
              margin: 0
            }}>
              🛡️ AI Feedback Platform - Admin Panel
            </h1>
            <p style={{ 
              margin: '5px 0 0 0',
              opacity: 0.9
            }}>
              System Administration & Monitoring
            </p>
          </div>
          <div style={{ 
            backgroundColor: 'rgba(255,255,255,0.2)',
            padding: '15px 25px',
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
              {adminData.platform.uptime}%
            </div>
            <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>
              System Uptime
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div style={{ 
        display: 'flex', 
        gap: '10px', 
        marginBottom: '20px',
        flexWrap: 'wrap'
      }}>
        <TabButton id="dashboard" label="📊 Dashboard" active={selectedTab === 'dashboard'} />
        <TabButton id="businesses" label="🏪 Företag" active={selectedTab === 'businesses'} />
        <TabButton id="fraud" label="🛡️ Bedrägeri" active={selectedTab === 'fraud'} />
        <TabButton id="system" label="⚙️ System" active={selectedTab === 'system'} />
      </div>

      {/* Dashboard Tab */}
      {selectedTab === 'dashboard' && (
        <div>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '20px',
            marginBottom: '30px'
          }}>
            <div style={{ 
              backgroundColor: 'white', 
              padding: '20px', 
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ color: '#334155', marginTop: 0 }}>🏪 Aktiva Företag</h3>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#3b82f6' }}>
                {adminData.platform.totalBusinesses}
              </div>
              <div style={{ color: '#64748b', fontSize: '0.9rem' }}>
                +7 denna månad
              </div>
            </div>

            <div style={{ 
              backgroundColor: 'white', 
              padding: '20px', 
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ color: '#334155', marginTop: 0 }}>💬 Total Feedback</h3>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#059669' }}>
                {adminData.platform.totalFeedbacks.toLocaleString()}
              </div>
              <div style={{ color: '#64748b', fontSize: '0.9rem' }}>
                +428 idag
              </div>
            </div>

            <div style={{ 
              backgroundColor: 'white', 
              padding: '20px', 
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ color: '#334155', marginTop: 0 }}>💰 Plattformsintäkter</h3>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f59e0b' }}>
                {adminData.platform.totalRevenue.toLocaleString()} SEK
              </div>
              <div style={{ color: '#64748b', fontSize: '0.9rem' }}>
                20% av alla belöningar
              </div>
            </div>

            <div style={{ 
              backgroundColor: 'white', 
              padding: '20px', 
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ color: '#334155', marginTop: 0 }}>🤖 AI-Prestanda</h3>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#8b5cf6' }}>
                {adminData.platform.aiProcessingTime}s
              </div>
              <div style={{ color: '#64748b', fontSize: '0.9rem' }}>
                Genomsnittlig processtid
              </div>
            </div>
          </div>

          {/* Alerts */}
          <div style={{ 
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '30px',
            marginBottom: '20px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ color: '#334155', marginTop: 0 }}>🚨 Aktiva Varningar</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {adminData.alerts.map((alert: any) => (
                <div key={alert.id} style={{ 
                  border: `1px solid ${
                    alert.severity === 'high' ? '#fca5a5' : 
                    alert.severity === 'medium' ? '#fde047' : '#a7f3d0'
                  }`,
                  borderRadius: '8px',
                  padding: '15px',
                  backgroundColor: 
                    alert.severity === 'high' ? '#fef2f2' : 
                    alert.severity === 'medium' ? '#fefce8' : '#ecfdf5'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ 
                        fontWeight: 'bold', 
                        color: alert.severity === 'high' ? '#dc2626' : 
                               alert.severity === 'medium' ? '#a16207' : '#047857',
                        marginBottom: '5px'
                      }}>
                        {alert.type === 'fraud' ? '🛡️ BEDRÄGERILARM' : 
                         alert.type === 'system' ? '⚙️ SYSTEMVARNING' : '🏪 FÖRETAGSVARNING'}
                      </div>
                      <div style={{ color: '#374151', marginBottom: '5px' }}>
                        {alert.message}
                      </div>
                      {alert.business && (
                        <div style={{ color: '#64748b', fontSize: '0.9rem' }}>
                          Företag: {alert.business}
                        </div>
                      )}
                    </div>
                    <div style={{ 
                      color: '#64748b', 
                      fontSize: '0.8rem',
                      textAlign: 'right'
                    }}>
                      {alert.time}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Businesses Tab */}
      {selectedTab === 'businesses' && (
        <div style={{ 
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '30px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ color: '#334155', marginTop: 0 }}>🏪 Företagshantering</h3>
          
          <div style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc' }}>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Företag</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Status</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Feedback</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Intäkter</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Risk</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Senast Aktiv</th>
                </tr>
              </thead>
              <tbody>
                {adminData.businesses.map((business: any) => (
                  <tr key={business.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px' }}>
                      <div>
                        <div style={{ fontWeight: 'bold', color: '#334155' }}>
                          {business.name}
                        </div>
                        <div style={{ color: '#64748b', fontSize: '0.8rem' }}>
                          {business.orgNumber}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <StatusBadge status={business.status} />
                    </td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ fontWeight: 'bold', color: '#334155' }}>
                        {business.feedbacks}
                      </div>
                      <div style={{ color: '#64748b', fontSize: '0.8rem' }}>
                        Ø {business.avgScore}/100
                      </div>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ fontWeight: 'bold', color: '#059669' }}>
                        {business.revenue.toLocaleString()} SEK
                      </div>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <RiskBadge level={business.riskLevel} />
                    </td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ color: '#64748b', fontSize: '0.9rem' }}>
                        {business.lastActivity}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Fraud Tab */}
      {selectedTab === 'fraud' && (
        <div style={{ 
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '30px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ color: '#334155', marginTop: 0 }}>🛡️ Bedrägeriskydd & Säkerhetsövervakning</h3>
          
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '20px',
            marginBottom: '30px'
          }}>
            <div style={{ 
              backgroundColor: '#fef2f2',
              padding: '20px',
              borderRadius: '8px',
              border: '1px solid #fca5a5'
            }}>
              <h4 style={{ color: '#dc2626', marginTop: 0 }}>🚨 Aktiva Hotvarningar</h4>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#dc2626' }}>
                3
              </div>
              <div style={{ color: '#991b1b', fontSize: '0.9rem' }}>
                Kräver omedelbar granskning
              </div>
            </div>

            <div style={{ 
              backgroundColor: '#ecfdf5',
              padding: '20px',
              borderRadius: '8px',
              border: '1px solid #a7f3d0'
            }}>
              <h4 style={{ color: '#065f46', marginTop: 0 }}>✅ AI-Noggrannhet</h4>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#047857' }}>
                {adminData.systemMetrics.fraudDetectionAccuracy}%
              </div>
              <div style={{ color: '#065f46', fontSize: '0.9rem' }}>
                Bedrägeridetektering
              </div>
            </div>

            <div style={{ 
              backgroundColor: '#f0f9ff',
              padding: '20px',
              borderRadius: '8px',
              border: '1px solid #7dd3fc'
            }}>
              <h4 style={{ color: '#0c4a6e', marginTop: 0 }}>⚡ Processtid</h4>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#0369a1' }}>
                {adminData.systemMetrics.voiceProcessingLatency}s
              </div>
              <div style={{ color: '#0c4a6e', fontSize: '0.9rem' }}>
                Genomsnittlig AI-analys
              </div>
            </div>
          </div>

          <div style={{ 
            backgroundColor: '#f8fafc',
            padding: '20px',
            borderRadius: '8px',
            border: '1px solid #e2e8f0'
          }}>
            <h4 style={{ color: '#334155', marginTop: 0 }}>🔍 Aktiva Säkerhetsåtgärder</h4>
            <div style={{ color: '#475569' }}>
              <div>✅ Enhetsfingertryck-analys: Aktiv</div>
              <div>✅ Geografisk konsistenskontroll: Aktiv</div>
              <div>✅ Röstmönsterigenkänning: Aktiv</div>
              <div>✅ Innehållsduplikering: Kontrollerad</div>
              <div>✅ Frekvensanalys per kund: Övervakad</div>
              <div>✅ Real-time riskbedömning: Online</div>
            </div>
          </div>
        </div>
      )}

      {/* System Tab */}
      {selectedTab === 'system' && (
        <div style={{ 
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '30px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ color: '#334155', marginTop: 0 }}>⚙️ Systemövervakning</h3>
          
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '20px',
            marginBottom: '30px'
          }}>
            <div style={{ 
              backgroundColor: '#f0fdf4',
              padding: '15px',
              borderRadius: '8px',
              border: '1px solid #a7f3d0'
            }}>
              <h4 style={{ color: '#065f46', marginTop: 0, fontSize: '1rem' }}>📡 API Uptime</h4>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#047857' }}>
                {adminData.systemMetrics.apiUptime}%
              </div>
            </div>

            <div style={{ 
              backgroundColor: '#f0f9ff',
              padding: '15px',
              borderRadius: '8px',
              border: '1px solid #7dd3fc'
            }}>
              <h4 style={{ color: '#0c4a6e', marginTop: 0, fontSize: '1rem' }}>🔗 DB Connections</h4>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#0369a1' }}>
                {adminData.systemMetrics.databaseConnections}
              </div>
            </div>

            <div style={{ 
              backgroundColor: '#fefce8',
              padding: '15px',
              borderRadius: '8px',
              border: '1px solid #fde047'
            }}>
              <h4 style={{ color: '#a16207', marginTop: 0, fontSize: '1rem' }}>⚡ WebSockets</h4>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#ca8a04' }}>
                {adminData.systemMetrics.activeWebSockets}
              </div>
            </div>

            <div style={{ 
              backgroundColor: '#f3e8ff',
              padding: '15px',
              borderRadius: '8px',
              border: '1px solid #c084fc'
            }}>
              <h4 style={{ color: '#7c2d12', marginTop: 0, fontSize: '1rem' }}>📋 Queue Jobs</h4>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#8b5cf6' }}>
                {adminData.systemMetrics.queuedJobs}
              </div>
            </div>
          </div>

          <div style={{ 
            backgroundColor: '#f8fafc',
            padding: '20px',
            borderRadius: '8px',
            border: '1px solid #e2e8f0'
          }}>
            <h4 style={{ color: '#334155', marginTop: 0 }}>🔧 Systemstatus</h4>
            <div style={{ color: '#475569' }}>
              <div>🟢 API Gateway: Online</div>
              <div>🟢 PostgreSQL Database: Healthy</div>
              <div>🟢 Redis Cache: Connected</div>
              <div>🟢 Ollama AI Service: Running</div>
              <div>🟢 WhisperX Voice Processing: Active</div>
              <div>🟢 Stripe Payment System: Connected</div>
              <div>🟡 Backup System: Scheduled (23:00)</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}