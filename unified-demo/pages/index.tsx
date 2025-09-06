import { useState, useEffect } from 'react';
import CustomerDemo from '../components/CustomerDemo';
import BusinessDemo from '../components/BusinessDemo';
import AdminDemo from '../components/AdminDemo';
import BusinessRegistrationDemo from '../components/BusinessRegistrationDemo';

type DemoRole = 'welcome' | 'customer' | 'business' | 'admin' | 'register';

export default function UnifiedDemo() {
  const [currentRole, setCurrentRole] = useState<DemoRole>('welcome');
  const [demoData, setDemoData] = useState<any>({
    feedbackSessions: [],
    businessMetrics: {},
    adminStats: {}
  });
  const [registeredBusiness, setRegisteredBusiness] = useState<any>(null);

  // Generate demo data on mount
  useEffect(() => {
    generateDemoData();
  }, []);

  const generateDemoData = () => {
    // Generate realistic Swedish cafe feedback data
    const cafes = [
      'Café Aurora Stockholm', 'Kaffehörnan Göteborg', 'Espresso Corner Malmö',
      'Barista Dreams Uppsala', 'Swedish Coffee Co.', 'Fika & Co.'
    ];

    const feedbackSessions = Array.from({ length: 150 }, (_, i) => ({
      id: `session_${i + 1}`,
      cafe: cafes[Math.floor(Math.random() * cafes.length)],
      timestamp: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
      purchaseAmount: Math.floor(Math.random() * 500 + 50), // 50-550 SEK
      qualityScore: Math.floor(Math.random() * 40 + 60), // 60-100
      rewardAmount: 0,
      category: ['service', 'product', 'atmosphere', 'price', 'cleanliness'][Math.floor(Math.random() * 5)],
      sentiment: ['positive', 'neutral', 'negative'][Math.floor(Math.random() * 3)],
      feedback: [
        "Fantastisk service och utmärkt kaffe! Personalen var mycket vänlig.",
        "Bra kaffe men lite långsam service. Atmosfären var dock mycket mysig.",
        "Älskar den nya menyn! Fler veganska alternativ skulle vara fantastiskt.",
        "Lokalen kändes ren och välkomnande. Kaffet hade perfekt temperatur.",
        "Lite dyrt men kvaliteten motiverar priset. Kommer definitivt tillbaka."
      ][Math.floor(Math.random() * 5)]
    }));

    // Calculate rewards for each session
    feedbackSessions.forEach(session => {
      let rewardPercentage;
      if (session.qualityScore >= 90) rewardPercentage = 12;
      else if (session.qualityScore >= 80) rewardPercentage = 10;
      else if (session.qualityScore >= 70) rewardPercentage = 8;
      else if (session.qualityScore >= 60) rewardPercentage = 6;
      else rewardPercentage = 4;
      
      session.rewardAmount = (session.purchaseAmount * rewardPercentage) / 100;
    });

    const businessMetrics = {
      totalRevenue: feedbackSessions.reduce((sum, s) => sum + s.purchaseAmount, 0),
      totalRewards: feedbackSessions.reduce((sum, s) => sum + s.rewardAmount, 0),
      avgQualityScore: Math.round(feedbackSessions.reduce((sum, s) => sum + s.qualityScore, 0) / feedbackSessions.length),
      totalSessions: feedbackSessions.length,
      platformCommission: feedbackSessions.reduce((sum, s) => sum + s.rewardAmount * 0.2, 0)
    };

    const adminStats = {
      totalBusinesses: 125,
      activeSessions: 47,
      totalPlatformRevenue: businessMetrics.platformCommission * 10,
      fraudDetected: 3,
      systemHealth: 98.7
    };

    setDemoData({
      feedbackSessions,
      businessMetrics,
      adminStats
    });
  };

  const handleBusinessRegistrationComplete = (businessData: any) => {
    console.log('Business registration completed:', businessData);
    setRegisteredBusiness(businessData);
    
    // Show success message and redirect to business dashboard
    setTimeout(() => {
      alert(`🎉 Registrering slutförd!\n\nFöretagsnamn: ${businessData.name}\nFöretags-ID: ${businessData.id}\nStripe-konto: ${businessData.stripeAccountId}\n\nDu omdirigeras nu till företagsdashboarden...`);
      setCurrentRole('business');
    }, 500);
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc' }}>
      {currentRole === 'welcome' && (
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px' }}>
          {/* Header */}
          <div className="text-center mb-6">
            <h1 style={{ 
              fontSize: '3.5rem', 
              fontWeight: 'bold', 
              color: '#1e293b',
              marginBottom: '16px'
            }}>
              🇸🇪 AI Feedback Platform
            </h1>
            <p style={{ 
              fontSize: '1.5rem', 
              color: '#64748b',
              marginBottom: '32px'
            }}>
              Complete Interactive Demo - Svensk AI-driven kundåterkoppling
            </p>
          </div>

          {/* Platform Overview Stats */}
          <div className="grid grid-4 mb-6">
            <div className="card info-bg text-center">
              <h3 style={{ fontSize: '2rem', fontWeight: 'bold' }}>
                {demoData.adminStats.totalBusinesses}
              </h3>
              <p>Anslutna företag</p>
            </div>
            <div className="card success-bg text-center">
              <h3 style={{ fontSize: '2rem', fontWeight: 'bold' }}>
                {demoData.businessMetrics.totalSessions}
              </h3>
              <p>Feedback sessioner</p>
            </div>
            <div className="card warning-bg text-center">
              <h3 style={{ fontSize: '2rem', fontWeight: 'bold' }}>
                {Math.round(demoData.businessMetrics.totalRewards)} SEK
              </h3>
              <p>Utbetalda belöningar</p>
            </div>
            <div className="card info-bg text-center">
              <h3 style={{ fontSize: '2rem', fontWeight: 'bold' }}>
                {demoData.businessMetrics.avgQualityScore}%
              </h3>
              <p>Genomsnittlig kvalitet</p>
            </div>
          </div>

          {/* Registration Call-to-Action */}
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{ 
              backgroundColor: '#fef3c7', 
              border: '2px solid #f59e0b',
              borderRadius: '12px',
              padding: '24px',
              marginBottom: '16px'
            }}>
              <h3 style={{ color: '#92400e', margin: '0 0 12px 0', fontSize: '1.2rem' }}>
                🚀 Vill du testa att registrera ett företag?
              </h3>
              <p style={{ color: '#b45309', margin: '0 0 16px 0' }}>
                Upplev hela registreringsprocessen med svensk företagsdata och Stripe Connect-integration
              </p>
              <button
                onClick={() => setCurrentRole('register')}
                style={{
                  padding: '12px 32px',
                  backgroundColor: '#f59e0b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}
              >
                📝 Registrera ett testföretag
              </button>
            </div>
          </div>

          {/* Role Selection */}
          <div className="grid grid-3 mb-6">
            <div className="card">
              <h3 style={{ color: '#1e40af', marginBottom: '16px' }}>
                👤 Kund Demo
              </h3>
              <p style={{ marginBottom: '20px', color: '#64748b' }}>
                Upplev hela kundresan från QR-skanning till belöning. 
                Testa AI-röstanalys och kvalitetspoäng i realtid.
              </p>
              <ul style={{ marginBottom: '20px', color: '#64748b', paddingLeft: '20px' }}>
                <li>QR-kod skanning</li>
                <li>Röst feedback med AI</li>
                <li>Omedelbar kvalitetspoäng</li>
                <li>Cashback beräkning</li>
                <li>Stripe payout demo</li>
              </ul>
              <button
                className="btn btn-primary"
                onClick={() => setCurrentRole('customer')}
              >
                🚀 Starta Kund Demo
              </button>
            </div>

            <div className="card">
              <h3 style={{ color: '#059669', marginBottom: '16px' }}>
                🏪 Företag Demo
              </h3>
              <p style={{ marginBottom: '20px', color: '#64748b' }}>
                Utforska företagsdashboarden med riktig data från svenska caféer. 
                Se insikter och ROI-analys.
              </p>
              <ul style={{ marginBottom: '20px', color: '#64748b', paddingLeft: '20px' }}>
                <li>Real-time feedback dashboard</li>
                <li>Kategoriserad kundinsikter</li>
                <li>ROI och kostnadsanalys</li>
                <li>Personalprestandaanalys</li>
                <li>Trendanalys och rapporter</li>
              </ul>
              <button
                className="btn btn-success"
                onClick={() => setCurrentRole('business')}
              >
                📊 Öppna Företag Dashboard
              </button>
            </div>

            <div className="card">
              <h3 style={{ color: '#dc2626', marginBottom: '16px' }}>
                ⚙️ Admin Demo
              </h3>
              <p style={{ marginBottom: '20px', color: '#64748b' }}>
                Administrera plattformen med avancerade verktyg för 
                övervakning, säkerhet och systemhälsa.
              </p>
              <ul style={{ marginBottom: '20px', color: '#64748b', paddingLeft: '20px' }}>
                <li>Plattformsövervakning</li>
                <li>Bedrägeridetektering</li>
                <li>Företagshantering</li>
                <li>AI-modell prestanda</li>
                <li>Systemhälsa och metriker</li>
              </ul>
              <button
                className="btn"
                style={{ backgroundColor: '#dc2626', color: 'white' }}
                onClick={() => setCurrentRole('admin')}
              >
                🛡️ Öppna Admin Panel
              </button>
            </div>
          </div>

          {/* Technical Highlights */}
          <div className="card">
            <h3 style={{ color: '#1e293b', marginBottom: '20px', textAlign: 'center' }}>
              🔧 Teknisk Implementation
            </h3>
            <div className="grid grid-4">
              <div className="text-center">
                <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🤖</div>
                <h4 style={{ color: '#3b82f6' }}>Ollama + qwen2:0.5b</h4>
                <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
                  Lokal AI med &lt;2s svarstid
                </p>
              </div>
              <div className="text-center">
                <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🎤</div>
                <h4 style={{ color: '#10b981' }}>WhisperX STT</h4>
                <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
                  Svensk röstbehandling
                </p>
              </div>
              <div className="text-center">
                <div style={{ fontSize: '2rem', marginBottom: '8px' }}>💳</div>
                <h4 style={{ color: '#f59e0b' }}>Stripe Connect</h4>
                <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
                  Omedelbar utbetalning
                </p>
              </div>
              <div className="text-center">
                <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🛡️</div>
                <h4 style={{ color: '#dc2626' }}>AI Fraud Detection</h4>
                <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
                  Avancerat bedrägerisskydd
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ textAlign: 'center', marginTop: '40px', color: '#64748b' }}>
            <p>✅ GDPR-kompatibel • ✅ Mobil PWA • ✅ POS Integration • ✅ Skalbar arkitektur</p>
          </div>
        </div>
      )}

      {currentRole === 'customer' && (
        <CustomerDemo 
          onBack={() => setCurrentRole('welcome')} 
          demoData={demoData}
        />
      )}

      {currentRole === 'business' && (
        <BusinessDemo 
          onBack={() => setCurrentRole('welcome')} 
          demoData={demoData}
          registeredBusiness={registeredBusiness}
        />
      )}

      {currentRole === 'admin' && (
        <AdminDemo 
          onBack={() => setCurrentRole('welcome')} 
          demoData={demoData}
        />
      )}

      {currentRole === 'register' && (
        <BusinessRegistrationDemo 
          onBack={() => setCurrentRole('welcome')} 
          onComplete={handleBusinessRegistrationComplete}
        />
      )}
    </div>
  );
}