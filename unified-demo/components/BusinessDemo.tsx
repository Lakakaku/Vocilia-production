import { useState, useEffect } from 'react';

interface BusinessDemoProps {
  onBack: () => void;
  demoData: any;
  registeredBusiness?: any;
}

type BusinessView = 'overview' | 'feedback' | 'analytics' | 'insights' | 'settings';

export default function BusinessDemo({ onBack, demoData, registeredBusiness }: BusinessDemoProps) {
  const [currentView, setCurrentView] = useState<BusinessView>('overview');
  const [selectedTimeframe, setSelectedTimeframe] = useState('30d');
  const [feedbackFilter, setFeedbackFilter] = useState('all');

  const businessInfo = registeredBusiness ? {
    name: registeredBusiness.name,
    tier: registeredBusiness.tier || 1,
    trialDaysRemaining: registeredBusiness.trialDaysRemaining || 30,
    subscriptionStatus: registeredBusiness.status || 'trial',
    locations: [registeredBusiness.city || 'Stockholm'],
    orgNumber: registeredBusiness.organizationNumber,
    stripeAccountId: registeredBusiness.stripeAccountId,
    registeredAt: registeredBusiness.createdAt
  } : {
    name: 'Café Aurora Stockholm',
    tier: 2,
    trialDaysRemaining: 0,
    subscriptionStatus: 'active',
    locations: ['Gamla Stan', 'Södermalm', 'Östermalm']
  };

  const getFilteredFeedback = () => {
    if (feedbackFilter === 'all') return demoData.feedbackSessions;
    return demoData.feedbackSessions.filter((session: any) => 
      feedbackFilter === 'positive' ? session.sentiment === 'positive' :
      feedbackFilter === 'negative' ? session.sentiment === 'negative' :
      session.category === feedbackFilter
    );
  };

  const getCategoryInsights = () => {
    const categories = ['service', 'product', 'atmosphere', 'price', 'cleanliness'];
    return categories.map(category => {
      const categoryFeedback = demoData.feedbackSessions.filter((s: any) => s.category === category);
      const avgScore = categoryFeedback.length > 0 ? 
        Math.round(categoryFeedback.reduce((sum: number, s: any) => sum + s.qualityScore, 0) / categoryFeedback.length) : 0;
      
      return {
        category,
        count: categoryFeedback.length,
        avgScore,
        trend: Math.random() > 0.5 ? 'up' : 'down'
      };
    });
  };

  const renderOverview = () => (
    <div className="fade-in">
      <div className="grid grid-4 mb-6">
        <div className="card info-bg text-center">
          <h3 style={{ fontSize: '2.5rem', fontWeight: 'bold', margin: '0 0 8px 0' }}>
            {demoData.businessMetrics.totalSessions}
          </h3>
          <p style={{ margin: 0, fontWeight: '600' }}>Feedback sessioner</p>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>+12% från förra månaden</p>
        </div>
        
        <div className="card warning-bg text-center">
          <h3 style={{ fontSize: '2.5rem', fontWeight: 'bold', margin: '0 0 8px 0' }}>
            {demoData.businessMetrics.avgQualityScore}
          </h3>
          <p style={{ margin: 0, fontWeight: '600' }}>Genomsnittlig kvalitet</p>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>+3.2 från förra månaden</p>
        </div>
        
        <div className="card success-bg text-center">
          <h3 style={{ fontSize: '2.5rem', fontWeight: 'bold', margin: '0 0 8px 0' }}>
            {Math.round(demoData.businessMetrics.totalRewards)} SEK
          </h3>
          <p style={{ margin: 0, fontWeight: '600' }}>Utbetalda belöningar</p>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
            Kostnad: {Math.round(demoData.businessMetrics.totalRewards * 1.2)} SEK
          </p>
        </div>
        
        <div className="card text-center">
          <h3 style={{ fontSize: '2.5rem', fontWeight: 'bold', margin: '0 0 8px 0' }}>
            4.7⭐
          </h3>
          <p style={{ margin: 0, fontWeight: '600' }}>Kundnöjdhet</p>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>Baserat på AI-analys</p>
        </div>
      </div>

      <div className="grid grid-2 mb-6">
        <div className="card">
          <h3 style={{ color: '#1e293b', marginTop: 0 }}>📊 Senaste aktivitet</h3>
          <div style={{ space: '12px' }}>
            {demoData.feedbackSessions.slice(0, 5).map((session: any, index: number) => (
              <div key={index} style={{ 
                padding: '12px', 
                backgroundColor: '#f8fafc',
                borderRadius: '6px',
                marginBottom: '8px',
                borderLeft: `4px solid ${session.qualityScore >= 80 ? '#10b981' : session.qualityScore >= 60 ? '#f59e0b' : '#ef4444'}`
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong>{session.qualityScore}/100</strong>
                    <span style={{ color: '#64748b', marginLeft: '8px', fontSize: '0.9rem' }}>
                      {session.category}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    {new Date(session.timestamp).toLocaleDateString('sv-SE')}
                  </div>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#475569' }}>
                  {session.feedback.substring(0, 80)}...
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 style={{ color: '#1e293b', marginTop: 0 }}>💡 AI-genererade insikter</h3>
          <div style={{ space: '16px' }}>
            <div className="success-bg p-4 rounded mb-4">
              <h4 style={{ color: '#065f46', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>🔥</span> Trendande positiv feedback
              </h4>
              <p style={{ color: '#047857', margin: 0, fontSize: '0.9rem' }}>
                "Nya kaffesorten" nämns positivt i 73% av senaste feedbacken. 
                Överväg att göra denna till en permanent menyalternativ.
              </p>
            </div>
            
            <div className="warning-bg p-4 rounded mb-4">
              <h4 style={{ color: '#92400e', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>⚠️</span> Förbättringsområde
              </h4>
              <p style={{ color: '#ca8a04', margin: 0, fontSize: '0.9rem' }}>
                "Veganska alternativ" efterfrågas i 34% av feedbacken. 
                Potentiell omsättningsökning: 15-20%.
              </p>
            </div>

            <div className="info-bg p-4 rounded">
              <h4 style={{ color: '#0c4a6e', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>👥</span> Personalprestation
              </h4>
              <p style={{ color: '#0369a1', margin: 0, fontSize: '0.9rem' }}>
                Personalen får beröm i 89% av feedbacken. 
                Service-relaterad kvalitet: +23% över genomsnittet.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ color: '#1e293b', marginTop: 0 }}>💰 ROI-analys</h3>
        <div className="grid grid-3">
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#059669', marginBottom: '8px' }}>
              +{Math.round(demoData.businessMetrics.totalRevenue * 0.08)} SEK
            </div>
            <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>
              Uppskattad omsättningsökning från feedback-implementering
            </p>
          </div>
          
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#dc2626', marginBottom: '8px' }}>
              -{Math.round(demoData.businessMetrics.totalRewards * 1.2)} SEK
            </div>
            <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>
              Total kostnad för belöningar och plattformsavgifter
            </p>
          </div>
          
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#3b82f6', marginBottom: '8px' }}>
              +{Math.round((demoData.businessMetrics.totalRevenue * 0.08) - (demoData.businessMetrics.totalRewards * 1.2))} SEK
            </div>
            <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>
              Nettovinst från AI-feedback systemet
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderFeedback = () => (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ color: '#1e293b', margin: 0 }}>📝 Feedback Översikt</h2>
        <div style={{ display: 'flex', gap: '16px' }}>
          <select
            value={feedbackFilter}
            onChange={(e) => setFeedbackFilter(e.target.value)}
            style={{
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px'
            }}
          >
            <option value="all">Alla kategorier</option>
            <option value="service">Service</option>
            <option value="product">Produkt</option>
            <option value="atmosphere">Atmosfär</option>
            <option value="price">Pris</option>
            <option value="cleanliness">Renlighet</option>
            <option value="positive">Positiv feedback</option>
            <option value="negative">Negativ feedback</option>
          </select>
        </div>
      </div>

      <div style={{ marginBottom: '24px' }}>
        {getFilteredFeedback().slice(0, 8).map((session: any, index: number) => (
          <div key={index} className="card" style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <span style={{
                    backgroundColor: session.qualityScore >= 80 ? '#dcfce7' : session.qualityScore >= 60 ? '#fef3c7' : '#fee2e2',
                    color: session.qualityScore >= 80 ? '#166534' : session.qualityScore >= 60 ? '#92400e' : '#991b1b',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '0.8rem',
                    fontWeight: '600'
                  }}>
                    {session.qualityScore}/100
                  </span>
                  <span style={{
                    backgroundColor: '#f1f5f9',
                    color: '#334155',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '0.8rem'
                  }}>
                    {session.category}
                  </span>
                  <span style={{
                    color: session.sentiment === 'positive' ? '#059669' : session.sentiment === 'negative' ? '#dc2626' : '#64748b'
                  }}>
                    {session.sentiment === 'positive' ? '😊' : session.sentiment === 'negative' ? '😞' : '😐'}
                  </span>
                </div>
                <p style={{ color: '#374151', margin: '0 0 8px 0', lineHeight: 1.5 }}>
                  "{session.feedback}"
                </p>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Köp: {session.purchaseAmount} SEK • Belöning: {session.rewardAmount.toFixed(2)} SEK • {new Date(session.timestamp).toLocaleString('sv-SE')}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="text-center">
        <p style={{ color: '#64748b' }}>
          Visar {Math.min(8, getFilteredFeedback().length)} av {getFilteredFeedback().length} feedback sessioner
        </p>
      </div>
    </div>
  );

  const renderAnalytics = () => (
    <div className="fade-in">
      <h2 style={{ color: '#1e293b', marginBottom: '24px' }}>📈 Analys & Trender</h2>
      
      <div className="grid grid-2 mb-6">
        <div className="card">
          <h3 style={{ color: '#1e293b', marginTop: 0 }}>📊 Kvalitetspoäng per kategori</h3>
          <div style={{ space: '12px' }}>
            {getCategoryInsights().map((insight) => (
              <div key={insight.category} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px',
                backgroundColor: '#f8fafc',
                borderRadius: '6px',
                marginBottom: '8px'
              }}>
                <div>
                  <strong style={{ textTransform: 'capitalize' }}>{insight.category}</strong>
                  <span style={{ color: '#64748b', marginLeft: '8px', fontSize: '0.9rem' }}>
                    ({insight.count} sessioner)
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ 
                    fontWeight: 'bold', 
                    color: insight.avgScore >= 80 ? '#059669' : insight.avgScore >= 60 ? '#ca8a04' : '#dc2626' 
                  }}>
                    {insight.avgScore}/100
                  </span>
                  <span style={{ color: insight.trend === 'up' ? '#059669' : '#dc2626' }}>
                    {insight.trend === 'up' ? '↗️' : '↘️'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 style={{ color: '#1e293b', marginTop: 0 }}>🎯 Prestationsmål</h3>
          <div style={{ space: '16px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span>Genomsnittlig kvalitetspoäng</span>
                <span style={{ fontWeight: 'bold', color: demoData.businessMetrics.avgQualityScore >= 75 ? '#059669' : '#ca8a04' }}>
                  {demoData.businessMetrics.avgQualityScore}/100
                </span>
              </div>
              <div className="progress-bar mb-4">
                <div 
                  className="progress-fill"
                  style={{ 
                    width: `${demoData.businessMetrics.avgQualityScore}%`,
                    backgroundColor: demoData.businessMetrics.avgQualityScore >= 75 ? '#059669' : '#ca8a04'
                  }}
                ></div>
              </div>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 16px' }}>
                Mål: 75/100 (Uppnått: {demoData.businessMetrics.avgQualityScore >= 75 ? '✅' : '❌'})
              </p>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span>Månadsaktivitet</span>
                <span style={{ fontWeight: 'bold', color: '#3b82f6' }}>
                  {demoData.businessMetrics.totalSessions}/200
                </span>
              </div>
              <div className="progress-bar mb-4">
                <div 
                  className="progress-fill"
                  style={{ width: `${Math.min(100, (demoData.businessMetrics.totalSessions / 200) * 100)}%` }}
                ></div>
              </div>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 16px' }}>
                Mål: 200 sessioner (Kvar: {Math.max(0, 200 - demoData.businessMetrics.totalSessions)})
              </p>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span>Kundnöjdhet</span>
                <span style={{ fontWeight: 'bold', color: '#059669' }}>4.7/5.0</span>
              </div>
              <div className="progress-bar mb-4">
                <div 
                  className="progress-fill"
                  style={{ width: '94%', backgroundColor: '#059669' }}
                ></div>
              </div>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>
                Mål: 4.0/5.0 (Uppnått: ✅)
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ color: '#1e293b', marginTop: 0 }}>🔍 Nyckelinsikter från AI-analys</h3>
        <div className="grid grid-2">
          <div>
            <h4 style={{ color: '#059669', margin: '0 0 12px 0' }}>💪 Styrkor</h4>
            <ul style={{ color: '#64748b', paddingLeft: '20px' }}>
              <li>Exceptionell personalservice (89% positiv feedback)</li>
              <li>Ren och välkomnande miljö (94% nöjdhet)</li>
              <li>Hög produktkvalitet på kaffe (86% betyg ≥80)</li>
              <li>Konsekvent leverans över alla tider</li>
            </ul>
          </div>
          <div>
            <h4 style={{ color: '#ca8a04', margin: '0 0 12px 0' }}>📈 Förbättringsmöjligheter</h4>
            <ul style={{ color: '#64748b', paddingLeft: '20px' }}>
              <li>Utöka veganska menyalternativ (+34% efterfrågan)</li>
              <li>Optimera prissättning för konkurrenskraft</li>
              <li>Implementera snabbare beställningsprocess</li>
              <li>Säsongsanpassade specialkaffe-alternativ</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="fade-in">
      <h2 style={{ color: '#1e293b', marginBottom: '24px' }}>⚙️ Företagsinställningar</h2>
      
      <div className="grid grid-2">
        <div className="card">
          <h3 style={{ color: '#1e293b', marginTop: 0 }}>🏢 Företagsinformation</h3>
          <div style={{ space: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                Företagsnamn
              </label>
              <input
                type="text"
                value={businessInfo.name}
                disabled
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  backgroundColor: '#f9fafb',
                  marginBottom: '16px'
                }}
              />
            </div>
            
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                Prenumerationsnivå
              </label>
              <div style={{
                padding: '12px',
                backgroundColor: '#f0f9ff',
                border: '1px solid #7dd3fc',
                borderRadius: '6px',
                marginBottom: '16px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: '600', color: '#0c4a6e' }}>
                    Tier {businessInfo.tier} - Professional
                  </span>
                  <span style={{ color: '#0369a1' }}>✅ Aktiv</span>
                </div>
                <p style={{ color: '#0369a1', fontSize: '0.9rem', margin: '4px 0 0' }}>
                  Obegränsade feedback sessioner, avancerad analys
                </p>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                Platser
              </label>
              <div style={{ space: '8px' }}>
                {businessInfo.locations.map((location, index) => (
                  <div key={index} style={{
                    padding: '8px 12px',
                    backgroundColor: '#f1f5f9',
                    border: '1px solid #e2e8f0',
                    borderRadius: '4px',
                    marginBottom: '8px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span>{location}</span>
                    <span style={{ color: '#059669', fontSize: '0.8rem' }}>🟢 Aktiv</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 style={{ color: '#1e293b', marginTop: 0 }}>🔧 AI-inställningar</h3>
          <div style={{ space: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                Feedback språk
              </label>
              <select
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  marginBottom: '16px'
                }}
                defaultValue="sv"
              >
                <option value="sv">Svenska</option>
                <option value="en">English</option>
                <option value="multi">Flerspråkig</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                Minimum kvalitetspoäng för belöning
              </label>
              <input
                type="range"
                min="30"
                max="80"
                defaultValue="50"
                style={{
                  width: '100%',
                  marginBottom: '8px'
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#64748b' }}>
                <span>30</span>
                <span>Nuvarande: 50</span>
                <span>80</span>
              </div>
              <p style={{ color: '#64748b', fontSize: '0.9rem', margin: '8px 0 16px' }}>
                Kunder måste uppnå minst detta poäng för att få belöning
              </p>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                Prioriterade feedback områden
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                {['Service', 'Produktkvalitet', 'Atmosfär', 'Renlighet', 'Pris', 'Innovation'].map((area) => (
                  <label key={area} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input type="checkbox" defaultChecked={Math.random() > 0.3} />
                    <span style={{ fontSize: '0.9rem' }}>{area}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '24px' }}>
        <h3 style={{ color: '#1e293b', marginTop: 0 }}>📊 Export & Integration</h3>
        <div className="grid grid-3">
          <button className="btn btn-primary">
            📄 Exportera feedback (CSV)
          </button>
          <button className="btn btn-secondary">
            📈 Generera månadsrapport
          </button>
          <button className="btn btn-secondary">
            🔗 API-dokumentation
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px', minHeight: '100vh' }}>
      {/* Registration Success Banner */}
      {registeredBusiness && (
        <div style={{ 
          backgroundColor: '#ecfdf5', 
          border: '2px solid #10b981',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '24px'
        }}>
          <h3 style={{ color: '#059669', margin: '0 0 12px 0', display: 'flex', alignItems: 'center' }}>
            <span style={{ marginRight: '8px' }}>🎉</span>
            Grattis! Ditt företag är nu registrerat
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', color: '#047857' }}>
            <div><strong>Företag:</strong> {businessInfo.name}</div>
            <div><strong>Org.nr:</strong> {businessInfo.orgNumber}</div>
            <div><strong>Tier:</strong> {businessInfo.tier} ({businessInfo.subscriptionStatus})</div>
            <div><strong>Testperiod:</strong> {businessInfo.trialDaysRemaining} dagar kvar</div>
            <div><strong>Stripe-konto:</strong> {businessInfo.stripeAccountId}</div>
          </div>
        </div>
      )}
      
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <button className="btn btn-secondary" onClick={onBack}>
            ← Tillbaka till huvudmeny
          </button>
          <h1 style={{ color: '#1e293b', margin: 0 }}>
            🏪 {businessInfo.name} - Dashboard
          </h1>
          <div style={{ fontSize: '0.9rem', color: '#64748b', textAlign: 'right' }}>
            <div>Tier {businessInfo.tier} Professional</div>
            <div style={{ color: '#059669' }}>✅ Prenumeration aktiv</div>
          </div>
        </div>
        
        {/* Navigation */}
        <div style={{ 
          display: 'flex', 
          gap: '16px', 
          borderBottom: '1px solid #e5e7eb',
          paddingBottom: '16px'
        }}>
          {[
            { key: 'overview', label: '📊 Översikt', icon: '📊' },
            { key: 'feedback', label: '📝 Feedback', icon: '📝' },
            { key: 'analytics', label: '📈 Analys', icon: '📈' },
            { key: 'settings', label: '⚙️ Inställningar', icon: '⚙️' }
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => setCurrentView(item.key as BusinessView)}
              style={{
                padding: '12px 20px',
                border: 'none',
                borderRadius: '6px',
                backgroundColor: currentView === item.key ? '#3b82f6' : 'transparent',
                color: currentView === item.key ? 'white' : '#64748b',
                cursor: 'pointer',
                fontWeight: currentView === item.key ? '600' : '400',
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
      {currentView === 'feedback' && renderFeedback()}
      {currentView === 'analytics' && renderAnalytics()}
      {currentView === 'settings' && renderSettings()}
    </div>
  );
}