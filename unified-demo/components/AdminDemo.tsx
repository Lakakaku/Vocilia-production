import { useState, useEffect } from 'react';

interface AdminDemoProps {
  onBack: () => void;
  demoData: any;
}

type AdminView = 'overview' | 'businesses' | 'monitoring' | 'fraud' | 'ai-models' | 'reports';

export default function AdminDemo({ onBack, demoData }: AdminDemoProps) {
  const [currentView, setCurrentView] = useState<AdminView>('overview');
  const [selectedBusiness, setSelectedBusiness] = useState<any>(null);
  
  const adminStats = {
    totalBusinesses: 125,
    activeBusinesses: 118,
    pendingApproval: 7,
    totalSessions: 15847,
    totalRevenue: 89650,
    fraudDetected: 23,
    systemHealth: 98.7,
    aiProcessingTime: 1.8, // seconds
    platformUptime: 99.94
  };

  const businessesData = [
    { 
      id: 1, 
      name: 'Café Aurora Stockholm', 
      tier: 2, 
      status: 'active', 
      revenue: 15420, 
      sessions: 234, 
      quality: 84,
      riskScore: 0.12,
      lastActivity: new Date(Date.now() - 2 * 60 * 60 * 1000)
    },
    { 
      id: 2, 
      name: 'Kaffehörnan Göteborg', 
      tier: 1, 
      status: 'active', 
      revenue: 8930, 
      sessions: 156, 
      quality: 78,
      riskScore: 0.08,
      lastActivity: new Date(Date.now() - 5 * 60 * 60 * 1000)
    },
    { 
      id: 3, 
      name: 'Espresso Corner Malmö', 
      tier: 3, 
      status: 'pending', 
      revenue: 0, 
      sessions: 0, 
      quality: 0,
      riskScore: 0.03,
      lastActivity: new Date(Date.now() - 24 * 60 * 60 * 1000)
    },
    { 
      id: 4, 
      name: 'Coffee House Uppsala', 
      tier: 2, 
      status: 'suspended', 
      revenue: 2340, 
      sessions: 45, 
      quality: 92,
      riskScore: 0.85,
      lastActivity: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    }
  ];

  const fraudAlerts = [
    {
      id: 1,
      type: 'suspicious_pattern',
      business: 'Coffee House Uppsala',
      description: 'Ovanligt hög belöningsfrekvens från samma enhet',
      severity: 'high',
      timestamp: new Date(Date.now() - 30 * 60 * 1000),
      status: 'investigating'
    },
    {
      id: 2,
      type: 'quality_anomaly',
      business: 'Café Corner Västerås',
      description: 'AI-poäng avviker markant från historiskt mönster',
      severity: 'medium',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      status: 'resolved'
    },
    {
      id: 3,
      type: 'device_fingerprint',
      business: 'Barista Dreams Linköping',
      description: 'Flera konton kopplade till samma enhets-fingeravtryck',
      severity: 'medium',
      timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
      status: 'monitoring'
    }
  ];

  const aiModelStats = [
    {
      name: 'qwen2-0.5b-main',
      version: '2024.12.1',
      status: 'active',
      avgResponseTime: 1.6,
      accuracy: 94.2,
      uptime: 99.8,
      requestsToday: 1247,
      errorRate: 0.3
    },
    {
      name: 'gpt4o-mini-fallback',
      version: '2024.11.1',
      status: 'standby',
      avgResponseTime: 3.2,
      accuracy: 96.1,
      uptime: 100.0,
      requestsToday: 23,
      errorRate: 0.1
    },
    {
      name: 'claude-3-5-haiku-secondary',
      version: '2024.10.1',
      status: 'standby',
      avgResponseTime: 2.8,
      accuracy: 95.7,
      uptime: 99.9,
      requestsToday: 8,
      errorRate: 0.0
    }
  ];

  const renderOverview = () => (
    <div className="fade-in">
      <div className="grid grid-4 mb-6">
        <div className="card info-bg text-center">
          <h3 style={{ fontSize: '2.5rem', fontWeight: 'bold', margin: '0 0 8px 0' }}>
            {adminStats.totalBusinesses}
          </h3>
          <p style={{ margin: 0, fontWeight: '600' }}>Totalt företag</p>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
            {adminStats.activeBusinesses} aktiva, {adminStats.pendingApproval} väntar
          </p>
        </div>
        
        <div className="card success-bg text-center">
          <h3 style={{ fontSize: '2.5rem', fontWeight: 'bold', margin: '0 0 8px 0' }}>
            {adminStats.totalSessions.toLocaleString()}
          </h3>
          <p style={{ margin: 0, fontWeight: '600' }}>Feedback sessioner</p>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>+847 idag</p>
        </div>
        
        <div className="card warning-bg text-center">
          <h3 style={{ fontSize: '2.5rem', fontWeight: 'bold', margin: '0 0 8px 0' }}>
            {adminStats.totalRevenue.toLocaleString()} SEK
          </h3>
          <p style={{ margin: 0, fontWeight: '600' }}>Plattformsintäkter</p>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>20% kommission</p>
        </div>
        
        <div className="card text-center" style={{ 
          backgroundColor: adminStats.systemHealth >= 99 ? '#ecfdf5' : '#fefce8',
          borderColor: adminStats.systemHealth >= 99 ? '#a7f3d0' : '#fde047'
        }}>
          <h3 style={{ 
            fontSize: '2.5rem', 
            fontWeight: 'bold', 
            margin: '0 0 8px 0',
            color: adminStats.systemHealth >= 99 ? '#065f46' : '#92400e'
          }}>
            {adminStats.systemHealth}%
          </h3>
          <p style={{ margin: 0, fontWeight: '600' }}>Systemhälsa</p>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
            {adminStats.platformUptime}% uptime
          </p>
        </div>
      </div>

      <div className="grid grid-2 mb-6">
        <div className="card">
          <h3 style={{ color: '#1e293b', marginTop: 0 }}>🚨 Senaste varningar</h3>
          <div style={{ space: '12px' }}>
            {fraudAlerts.slice(0, 4).map((alert) => (
              <div key={alert.id} style={{
                padding: '12px',
                backgroundColor: alert.severity === 'high' ? '#fee2e2' : '#fef3c7',
                borderRadius: '6px',
                marginBottom: '8px',
                borderLeft: `4px solid ${alert.severity === 'high' ? '#ef4444' : '#f59e0b'}`
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div>
                    <strong style={{ 
                      color: alert.severity === 'high' ? '#991b1b' : '#92400e',
                      fontSize: '0.9rem'
                    }}>
                      {alert.business}
                    </strong>
                    <p style={{ 
                      margin: '4px 0 0', 
                      fontSize: '0.85rem',
                      color: alert.severity === 'high' ? '#7f1d1d' : '#78350f'
                    }}>
                      {alert.description}
                    </p>
                    <div style={{ 
                      fontSize: '0.75rem', 
                      color: '#64748b',
                      marginTop: '8px'
                    }}>
                      {alert.timestamp.toLocaleString('sv-SE')}
                    </div>
                  </div>
                  <span style={{
                    padding: '2px 6px',
                    borderRadius: '3px',
                    fontSize: '0.7rem',
                    fontWeight: '600',
                    backgroundColor: 
                      alert.status === 'investigating' ? '#fecaca' :
                      alert.status === 'resolved' ? '#bbf7d0' : '#fed7aa',
                    color: 
                      alert.status === 'investigating' ? '#991b1b' :
                      alert.status === 'resolved' ? '#166534' : '#9a3412'
                  }}>
                    {alert.status === 'investigating' ? 'Utreder' :
                     alert.status === 'resolved' ? 'Löst' : 'Övervakar'}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <button className="btn btn-primary" style={{ width: '100%', marginTop: '12px' }}>
            Se alla varningar →
          </button>
        </div>

        <div className="card">
          <h3 style={{ color: '#1e293b', marginTop: 0 }}>⚡ AI-prestanda</h3>
          <div style={{ space: '16px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px',
              backgroundColor: '#f0f9ff',
              borderRadius: '6px',
              marginBottom: '12px'
            }}>
              <div>
                <strong style={{ color: '#0c4a6e' }}>Qwen2 0.5B (Primär)</strong>
                <div style={{ fontSize: '0.8rem', color: '#0369a1' }}>
                  {aiModelStats[0].requestsToday} förfrågningar idag
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 'bold', color: '#059669' }}>
                  {aiModelStats[0].avgResponseTime}s
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  {aiModelStats[0].accuracy}% noggrannhet
                </div>
              </div>
            </div>

            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '12px'
            }}>
              <div className="text-center">
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#3b82f6' }}>
                  {adminStats.aiProcessingTime}s
                </div>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                  Genomsnittlig AI-tid
                </p>
              </div>
              <div className="text-center">
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#059669' }}>
                  99.7%
                </div>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                  AI tillgänglighet
                </p>
              </div>
            </div>

            <div style={{ marginTop: '16px' }}>
              <p style={{ fontSize: '0.9rem', color: '#64748b', margin: '0 0 8px' }}>
                Fallback-system status:
              </p>
              <div style={{ fontSize: '0.8rem', color: '#059669' }}>
                ✅ GPT-4o Mini (Redo) • ✅ Claude 3.5 Haiku (Redo)
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ color: '#1e293b', marginTop: 0 }}>📈 Dagens aktivitet</h3>
        <div className="grid grid-4">
          <div className="text-center">
            <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🆕</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#3b82f6' }}>
              247
            </div>
            <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>
              Nya feedback sessioner
            </p>
          </div>
          <div className="text-center">
            <div style={{ fontSize: '2rem', marginBottom: '8px' }}>💰</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#10b981' }}>
              4,850 SEK
            </div>
            <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>
              Utbetalda belöningar
            </p>
          </div>
          <div className="text-center">
            <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🏢</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f59e0b' }}>
              3
            </div>
            <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>
              Nya företag registrerade
            </p>
          </div>
          <div className="text-center">
            <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🛡️</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#dc2626' }}>
              2
            </div>
            <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>
              Bedrägeriförsök blockerade
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderBusinesses = () => (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ color: '#1e293b', margin: 0 }}>🏢 Företagshantering</h2>
        <div style={{ display: 'flex', gap: '12px' }}>
          <select style={{
            padding: '8px 12px',
            border: '1px solid #d1d5db',
            borderRadius: '6px'
          }}>
            <option>Alla status</option>
            <option>Aktiva</option>
            <option>Väntande</option>
            <option>Suspenderade</option>
          </select>
          <button className="btn btn-primary">
            ➕ Lägg till företag
          </button>
        </div>
      </div>

      <div style={{ marginBottom: '24px' }}>
        {businessesData.map((business) => (
          <div key={business.id} className="card" style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <h4 style={{ margin: 0, color: '#1e293b' }}>{business.name}</h4>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '0.7rem',
                    fontWeight: '600',
                    backgroundColor: 
                      business.status === 'active' ? '#dcfce7' :
                      business.status === 'pending' ? '#fef3c7' :
                      business.status === 'suspended' ? '#fee2e2' : '#f1f5f9',
                    color: 
                      business.status === 'active' ? '#166534' :
                      business.status === 'pending' ? '#92400e' :
                      business.status === 'suspended' ? '#991b1b' : '#475569'
                  }}>
                    {business.status === 'active' ? 'Aktiv' :
                     business.status === 'pending' ? 'Väntande' :
                     business.status === 'suspended' ? 'Suspenderad' : business.status}
                  </span>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '0.7rem',
                    backgroundColor: '#e0e7ff',
                    color: '#3730a3'
                  }}>
                    Tier {business.tier}
                  </span>
                  {business.riskScore > 0.5 && (
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '0.7rem',
                      backgroundColor: '#fee2e2',
                      color: '#991b1b'
                    }}>
                      🚨 Hög risk
                    </span>
                  )}
                </div>
                
                <div className="grid grid-4" style={{ gap: '16px' }}>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Intäkter</div>
                    <div style={{ fontWeight: '600' }}>{business.revenue.toLocaleString()} SEK</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Sessioner</div>
                    <div style={{ fontWeight: '600' }}>{business.sessions}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Kvalitetspoäng</div>
                    <div style={{ 
                      fontWeight: '600',
                      color: business.quality >= 80 ? '#059669' : business.quality >= 60 ? '#ca8a04' : '#dc2626'
                    }}>
                      {business.quality > 0 ? `${business.quality}/100` : 'N/A'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Senaste aktivitet</div>
                    <div style={{ fontSize: '0.8rem', fontWeight: '600' }}>
                      {business.lastActivity.toLocaleDateString('sv-SE')}
                    </div>
                  </div>
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '8px', marginLeft: '20px' }}>
                <button 
                  className="btn"
                  style={{ 
                    backgroundColor: '#f1f5f9',
                    color: '#334155',
                    padding: '6px 12px',
                    fontSize: '0.8rem'
                  }}
                  onClick={() => setSelectedBusiness(business)}
                >
                  📊 Detaljer
                </button>
                {business.status === 'pending' && (
                  <>
                    <button className="btn btn-success" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                      ✅ Godkänn
                    </button>
                    <button className="btn" style={{ 
                      backgroundColor: '#fee2e2',
                      color: '#991b1b',
                      padding: '6px 12px',
                      fontSize: '0.8rem'
                    }}>
                      ❌ Avvisa
                    </button>
                  </>
                )}
                {business.status === 'active' && (
                  <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                    ⚙️ Hantera
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Business Detail Modal */}
      {selectedBusiness && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="card" style={{ maxWidth: '600px', width: '90%', maxHeight: '80%', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ color: '#1e293b', margin: 0 }}>{selectedBusiness.name}</h3>
              <button
                onClick={() => setSelectedBusiness(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: '#64748b'
                }}
              >
                ✕
              </button>
            </div>
            
            <div className="grid grid-2" style={{ gap: '16px', marginBottom: '20px' }}>
              <div>
                <strong>Status:</strong> {selectedBusiness.status}
              </div>
              <div>
                <strong>Tier:</strong> {selectedBusiness.tier}
              </div>
              <div>
                <strong>Riskpoäng:</strong> {(selectedBusiness.riskScore * 100).toFixed(1)}%
              </div>
              <div>
                <strong>Totala sessioner:</strong> {selectedBusiness.sessions}
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ color: '#1e293b', marginBottom: '12px' }}>Senaste 30 dagar</h4>
              <div className="grid grid-3" style={{ gap: '12px' }}>
                <div className="success-bg p-4 text-center">
                  <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
                    {Math.floor(Math.random() * 50 + 20)}
                  </div>
                  <div style={{ fontSize: '0.8rem' }}>Nya sessioner</div>
                </div>
                <div className="warning-bg p-4 text-center">
                  <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
                    {Math.floor(Math.random() * 5000 + 2000)} SEK
                  </div>
                  <div style={{ fontSize: '0.8rem' }}>Intäkter</div>
                </div>
                <div className="info-bg p-4 text-center">
                  <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
                    {Math.floor(Math.random() * 20 + 75)}/100
                  </div>
                  <div style={{ fontSize: '0.8rem' }}>Kvalitetspoäng</div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn btn-primary">
                📧 Kontakta företag
              </button>
              <button className="btn btn-secondary">
                📊 Fullständig rapport
              </button>
              {selectedBusiness.riskScore > 0.5 && (
                <button className="btn" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>
                  🛡️ Riskanalys
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderMonitoring = () => (
    <div className="fade-in">
      <h2 style={{ color: '#1e293b', marginBottom: '24px' }}>📡 Systemövervakning</h2>
      
      <div className="grid grid-3 mb-6">
        <div className="card success-bg">
          <h3 style={{ color: '#065f46', marginTop: 0 }}>🟢 System Status</h3>
          <div style={{ fontSize: '2rem', textAlign: 'center', margin: '16px 0' }}>
            {adminStats.platformUptime}%
          </div>
          <div style={{ fontSize: '0.9rem', color: '#047857' }}>
            <div>✅ API Gateway: Operativ</div>
            <div>✅ Database: Operativ</div>
            <div>✅ AI Service: Operativ</div>
            <div>✅ Payment System: Operativ</div>
          </div>
        </div>

        <div className="card warning-bg">
          <h3 style={{ color: '#92400e', marginTop: 0 }}>⚡ Prestanda</h3>
          <div style={{ space: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>AI Response Time:</span>
              <strong>{adminStats.aiProcessingTime}s</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>API Response Time:</span>
              <strong>245ms</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Database Queries:</span>
              <strong>89ms</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Memory Usage:</span>
              <strong>68%</strong>
            </div>
          </div>
        </div>

        <div className="card info-bg">
          <h3 style={{ color: '#0c4a6e', marginTop: 0 }}>📊 Traffic</h3>
          <div style={{ space: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Requests/min:</span>
              <strong>1,247</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Active Sessions:</span>
              <strong>47</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Error Rate:</span>
              <strong>0.12%</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Cache Hit Rate:</span>
              <strong>94.3%</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ color: '#1e293b', marginTop: 0 }}>🚨 System Alerts & Logs</h3>
        <div style={{ space: '8px' }}>
          {[
            { time: new Date(Date.now() - 15 * 60 * 1000), level: 'info', message: 'AI model fallback activated for 0.3 seconds due to high load' },
            { time: new Date(Date.now() - 45 * 60 * 1000), level: 'warning', message: 'Database query timeout detected, auto-retry successful' },
            { time: new Date(Date.now() - 2 * 60 * 60 * 1000), level: 'info', message: 'Daily backup completed successfully (1.2GB)' },
            { time: new Date(Date.now() - 3 * 60 * 60 * 1000), level: 'error', message: 'Payment webhook from Stripe failed, retrying...' },
            { time: new Date(Date.now() - 4 * 60 * 60 * 1000), level: 'info', message: 'New business onboarding: Café Nordic Stockholm' }
          ].map((log, index) => (
            <div key={index} style={{
              padding: '8px 12px',
              backgroundColor: 
                log.level === 'error' ? '#fee2e2' :
                log.level === 'warning' ? '#fef3c7' : '#f1f5f9',
              borderRadius: '4px',
              marginBottom: '6px',
              fontSize: '0.9rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ 
                    color: 
                      log.level === 'error' ? '#dc2626' :
                      log.level === 'warning' ? '#ca8a04' : '#3b82f6',
                    fontWeight: '600'
                  }}>
                    {log.level === 'error' ? '🔴' : log.level === 'warning' ? '🟡' : '🔵'}
                  </span>
                  <span>{log.message}</span>
                </div>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  {log.time.toLocaleTimeString('sv-SE')}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderFraud = () => (
    <div className="fade-in">
      <h2 style={{ color: '#1e293b', marginBottom: '24px' }}>🛡️ Bedrägerianalys</h2>
      
      <div className="grid grid-3 mb-6">
        <div className="card" style={{ backgroundColor: '#fee2e2', borderColor: '#fca5a5' }}>
          <h3 style={{ color: '#991b1b', marginTop: 0 }}>🚨 Aktiva varningar</h3>
          <div style={{ fontSize: '3rem', fontWeight: 'bold', textAlign: 'center', color: '#dc2626' }}>
            {fraudAlerts.filter(a => a.status === 'investigating').length}
          </div>
          <p style={{ color: '#7f1d1d', textAlign: 'center', margin: 0 }}>
            Kräver omedelbar uppmärksamhet
          </p>
        </div>

        <div className="card warning-bg">
          <h3 style={{ color: '#92400e', marginTop: 0 }}>⚠️ Under övervakning</h3>
          <div style={{ fontSize: '3rem', fontWeight: 'bold', textAlign: 'center', color: '#ca8a04' }}>
            {fraudAlerts.filter(a => a.status === 'monitoring').length}
          </div>
          <p style={{ color: '#78350f', textAlign: 'center', margin: 0 }}>
            Misstänkta mönster identifierade
          </p>
        </div>

        <div className="card success-bg">
          <h3 style={{ color: '#065f46', marginTop: 0 }}>✅ Lösta idag</h3>
          <div style={{ fontSize: '3rem', fontWeight: 'bold', textAlign: 'center', color: '#047857' }}>
            {fraudAlerts.filter(a => a.status === 'resolved').length}
          </div>
          <p style={{ color: '#14532d', textAlign: 'center', margin: 0 }}>
            Framgångsrik intervention
          </p>
        </div>
      </div>

      <div className="card mb-6">
        <h3 style={{ color: '#1e293b', marginTop: 0 }}>📊 Bedrägeridetaljer</h3>
        <div style={{ space: '12px' }}>
          {fraudAlerts.map((alert) => (
            <div key={alert.id} style={{
              padding: '16px',
              backgroundColor: alert.severity === 'high' ? '#fee2e2' : '#fef3c7',
              borderRadius: '8px',
              marginBottom: '12px',
              border: `1px solid ${alert.severity === 'high' ? '#fca5a5' : '#fde047'}`
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                <div>
                  <h4 style={{ 
                    margin: '0 0 8px 0',
                    color: alert.severity === 'high' ? '#991b1b' : '#92400e',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    {alert.severity === 'high' ? '🔴' : '🟡'} {alert.business}
                  </h4>
                  <p style={{ margin: '0 0 8px 0', color: '#374151' }}>
                    {alert.description}
                  </p>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    Typ: {alert.type} • Upptäckt: {alert.timestamp.toLocaleString('sv-SE')}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {alert.status === 'investigating' && (
                    <>
                      <button className="btn" style={{ 
                        backgroundColor: '#dcfce7',
                        color: '#166534',
                        padding: '6px 12px',
                        fontSize: '0.8rem'
                      }}>
                        ✅ Ignorera
                      </button>
                      <button className="btn" style={{ 
                        backgroundColor: '#fee2e2',
                        color: '#991b1b',
                        padding: '6px 12px',
                        fontSize: '0.8rem'
                      }}>
                        🚫 Suspendera
                      </button>
                    </>
                  )}
                  <button className="btn btn-secondary" style={{ 
                    padding: '6px 12px',
                    fontSize: '0.8rem'
                  }}>
                    📊 Detaljer
                  </button>
                </div>
              </div>

              {alert.type === 'suspicious_pattern' && (
                <div className="grid grid-2" style={{ gap: '12px', marginTop: '12px' }}>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Aktivitetsmönster</div>
                    <div style={{ fontWeight: '600' }}>47 sessioner från samma IP</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Genomsnittlig belöning</div>
                    <div style={{ fontWeight: '600' }}>28.4 SEK (340% över normal)</div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3 style={{ color: '#1e293b', marginTop: 0 }}>🔍 Automatiska skydd</h3>
        <div className="grid grid-2">
          <div>
            <h4 style={{ color: '#059669', margin: '0 0 12px 0' }}>✅ Aktiva skydd</h4>
            <ul style={{ color: '#64748b', paddingLeft: '20px' }}>
              <li>Enhets-fingeravtryck analys</li>
              <li>Geografisk anomali detektering</li>
              <li>AI-kvalitetspoäng validering</li>
              <li>Hastighetsbegränsning per användare</li>
              <li>Dubbla transaktions-kontroll</li>
              <li>Voice pattern analysis</li>
            </ul>
          </div>
          <div>
            <h4 style={{ color: '#3b82f6', margin: '0 0 12px 0' }}>📊 Senaste 30 dagars statistik</h4>
            <div style={{ space: '8px', color: '#64748b' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Totala varningar:</span>
                <strong>156</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Bekräftat bedrägeri:</span>
                <strong>23 (14.7%)</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Falska positiva:</span>
                <strong>12 (7.7%)</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Sparat belopp:</span>
                <strong>15,420 SEK</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAIModels = () => (
    <div className="fade-in">
      <h2 style={{ color: '#1e293b', marginBottom: '24px' }}>🤖 AI-modeller & Prestanda</h2>
      
      <div style={{ marginBottom: '24px' }}>
        {aiModelStats.map((model, index) => (
          <div key={model.name} className="card" style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: '0 0 8px 0', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {model.name}
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '0.7rem',
                    fontWeight: '600',
                    backgroundColor: 
                      model.status === 'active' ? '#dcfce7' : '#f1f5f9',
                    color: 
                      model.status === 'active' ? '#166534' : '#64748b'
                  }}>
                    {model.status === 'active' ? 'AKTIV' : 'STANDBY'}
                  </span>
                </h3>
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b' }}>
                  Version {model.version} • {model.requestsToday} förfrågningar idag
                </p>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                  📊 Prestanda
                </button>
                {model.status === 'standby' && (
                  <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                    ▶️ Aktivera
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-4" style={{ gap: '16px' }}>
              <div className="text-center">
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#3b82f6' }}>
                  {model.avgResponseTime}s
                </div>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                  Genomsnittlig svarstid
                </p>
              </div>
              <div className="text-center">
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#059669' }}>
                  {model.accuracy}%
                </div>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                  Noggrannhet
                </p>
              </div>
              <div className="text-center">
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#10b981' }}>
                  {model.uptime}%
                </div>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                  Tillgänglighet
                </p>
              </div>
              <div className="text-center">
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: model.errorRate > 0.5 ? '#dc2626' : '#059669' }}>
                  {model.errorRate}%
                </div>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                  Felfrekvens
                </p>
              </div>
            </div>

            {index === 0 && ( // Only show details for primary model
              <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
                <h4 style={{ margin: '0 0 8px 0', color: '#1e293b', fontSize: '0.9rem' }}>
                  Senaste prestanda-trender (24h)
                </h4>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  • Svarstid förbättrad med 12% sedan igår<br/>
                  • 99.7% av förfrågningar under 2s målsättning<br/>
                  • Automatisk skalning aktiverad 3 gånger<br/>
                  • Ingen downtime eller systemfel
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="card">
        <h3 style={{ color: '#1e293b', marginTop: 0 }}>⚙️ AI-systemkonfiguration</h3>
        <div className="grid grid-2" style={{ gap: '20px' }}>
          <div>
            <h4 style={{ color: '#3b82f6', margin: '0 0 12px 0' }}>🎯 Målsättningar</h4>
            <div style={{ space: '12px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '0.9rem' }}>Max svarstid:</span>
                  <strong>2.0s</strong>
                </div>
                <div className="progress-bar">
                  <div 
                    className="progress-fill"
                    style={{ 
                      width: `${100 - (aiModelStats[0].avgResponseTime / 2.0) * 100}%`,
                      backgroundColor: aiModelStats[0].avgResponseTime <= 2.0 ? '#059669' : '#dc2626'
                    }}
                  ></div>
                </div>
                <p style={{ fontSize: '0.7rem', color: '#64748b', margin: '4px 0 12px' }}>
                  Nuvarande: {aiModelStats[0].avgResponseTime}s
                </p>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '0.9rem' }}>Min tillgänglighet:</span>
                  <strong>99.5%</strong>
                </div>
                <div className="progress-bar">
                  <div 
                    className="progress-fill"
                    style={{ width: `${aiModelStats[0].uptime}%` }}
                  ></div>
                </div>
                <p style={{ fontSize: '0.7rem', color: '#64748b', margin: '4px 0' }}>
                  Nuvarande: {aiModelStats[0].uptime}%
                </p>
              </div>
            </div>
          </div>

          <div>
            <h4 style={{ color: '#059669', margin: '0 0 12px 0' }}>🔧 Systemhälsa</h4>
            <div style={{ space: '8px', fontSize: '0.9rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Fallback-system:</span>
                <span style={{ color: '#059669' }}>✅ Funktionellt</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Load balancing:</span>
                <span style={{ color: '#059669' }}>✅ Aktivt</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Caching:</span>
                <span style={{ color: '#059669' }}>✅ 94% hit rate</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Monitoring:</span>
                <span style={{ color: '#059669' }}>✅ Real-time</span>
              </div>
            </div>

            <div style={{ marginTop: '16px' }}>
              <button className="btn btn-primary" style={{ width: '100%' }}>
                🔄 Uppdatera modeller
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <button className="btn btn-secondary" onClick={onBack}>
            ← Tillbaka till huvudmeny
          </button>
          <h1 style={{ color: '#1e293b', margin: 0 }}>
            🛡️ Admin Panel - AI Feedback Platform
          </h1>
          <div style={{ fontSize: '0.9rem', color: '#64748b', textAlign: 'right' }}>
            <div>Administrator</div>
            <div style={{ color: '#059669' }}>✅ Alla system operativa</div>
          </div>
        </div>
        
        {/* Navigation */}
        <div style={{ 
          display: 'flex', 
          gap: '12px', 
          borderBottom: '1px solid #e5e7eb',
          paddingBottom: '16px',
          flexWrap: 'wrap'
        }}>
          {[
            { key: 'overview', label: '📊 Översikt' },
            { key: 'businesses', label: '🏢 Företag' },
            { key: 'monitoring', label: '📡 Övervakning' },
            { key: 'fraud', label: '🛡️ Bedrägeri' },
            { key: 'ai-models', label: '🤖 AI-modeller' }
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => setCurrentView(item.key as AdminView)}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderRadius: '6px',
                backgroundColor: currentView === item.key ? '#dc2626' : 'transparent',
                color: currentView === item.key ? 'white' : '#64748b',
                cursor: 'pointer',
                fontWeight: currentView === item.key ? '600' : '400',
                fontSize: '0.9rem',
                transition: 'all 0.2s'
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {currentView === 'overview' && renderOverview()}
      {currentView === 'businesses' && renderBusinesses()}
      {currentView === 'monitoring' && renderMonitoring()}
      {currentView === 'fraud' && renderFraud()}
      {currentView === 'ai-models' && renderAIModels()}
    </div>
  );
}