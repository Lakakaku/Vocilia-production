import { useState, useEffect } from 'react';

export default function AiFeedbackDemo() {
  const [currentDemo, setCurrentDemo] = useState('welcome');
  const [qualityScore, setQualityScore] = useState<any>(null);
  const [reward, setReward] = useState<any>(null);

  // Simulate AI quality scoring
  const calculateQualityScore = (feedback: string) => {
    const authenticity = Math.random() * 40 + 60; // 60-100
    const concreteness = Math.random() * 30 + 50; // 50-80  
    const depth = Math.random() * 30 + 40; // 40-70
    
    const total = (authenticity * 0.4) + (concreteness * 0.3) + (depth * 0.3);
    
    return {
      authenticity: Math.round(authenticity),
      concreteness: Math.round(concreteness), 
      depth: Math.round(depth),
      total: Math.round(total)
    };
  };

  // Calculate reward based on quality score
  const calculateReward = (qualityScore: number, purchaseAmount: number) => {
    let rewardPercentage;
    
    if (qualityScore >= 90) rewardPercentage = 12;
    else if (qualityScore >= 80) rewardPercentage = 10; 
    else if (qualityScore >= 70) rewardPercentage = 8;
    else if (qualityScore >= 60) rewardPercentage = 6;
    else if (qualityScore >= 50) rewardPercentage = 4;
    else rewardPercentage = 2;
    
    const rewardAmount = (purchaseAmount * rewardPercentage) / 100;
    const platformFee = rewardAmount * 0.20; // 20% platform commission
    const businessCost = rewardAmount + platformFee;
    
    return {
      qualityScore,
      rewardPercentage,
      purchaseAmount: purchaseAmount / 100, // Convert from öre to SEK
      rewardAmount: rewardAmount / 100,
      platformFee: platformFee / 100,
      businessCost: businessCost / 100
    };
  };

  const handleFeedbackDemo = () => {
    const sampleFeedback = "Jag gillade verkligen den nya kaffesorten ni har. Personalen var mycket hjälpsam och lokalen kändes ren och välkomnande. Det enda som kunde vara bättre är att ha fler veganska alternativ.";
    
    const score = calculateQualityScore(sampleFeedback);
    const rewardCalc = calculateReward(score.total, 25000); // 250 SEK purchase
    
    setQualityScore(score);
    setReward(rewardCalc);
    setCurrentDemo('results');
  };

  return (
    <div style={{ 
      fontFamily: 'system-ui, -apple-system, sans-serif',
      maxWidth: '800px',
      margin: '0 auto',
      padding: '20px',
      backgroundColor: '#f8fafc',
      minHeight: '100vh'
    }}>
      <div style={{ 
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '30px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
      }}>
        
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <h1 style={{ 
            color: '#1e293b', 
            fontSize: '2.5rem', 
            marginBottom: '10px',
            fontWeight: 'bold'
          }}>
            🎯 AI Feedback Platform
          </h1>
          <p style={{ 
            color: '#64748b', 
            fontSize: '1.2rem',
            margin: 0
          }}>
            Svensk AI-driven kundåterkoppling med omedelbar belöning
          </p>
        </div>

        {currentDemo === 'welcome' && (
          <div>
            <div style={{ 
              backgroundColor: '#f1f5f9', 
              padding: '20px', 
              borderRadius: '8px', 
              marginBottom: '30px',
              border: '1px solid #e2e8f0'
            }}>
              <h2 style={{ color: '#334155', marginTop: 0 }}>🏪 Café Aurora Stockholm</h2>
              <p style={{ color: '#475569', margin: '10px 0' }}>
                <strong>Scenario:</strong> Du har precis köpt kaffe för 250 SEK och skannat QR-koden för att lämna feedback.
              </p>
              <p style={{ color: '#475569', margin: '10px 0' }}>
                <strong>Feedback:</strong> "Jag gillade verkligen den nya kaffesorten ni har. Personalen var mycket hjälpsam och lokalen kändes ren och välkomnande. Det enda som kunde vara bättre är att ha fler veganska alternativ."
              </p>
            </div>

            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '15px',
              marginBottom: '30px'
            }}>
              <div style={{ 
                backgroundColor: '#ecfdf5', 
                padding: '15px', 
                borderRadius: '8px',
                border: '1px solid #a7f3d0'
              }}>
                <h3 style={{ color: '#065f46', marginTop: 0 }}>✅ Kvalitetspoäng</h3>
                <p style={{ color: '#047857', margin: 0 }}>AI analyserar äkthet, konkrethet och djup</p>
              </div>
              
              <div style={{ 
                backgroundColor: '#fefce8', 
                padding: '15px', 
                borderRadius: '8px',
                border: '1px solid #fde047'
              }}>
                <h3 style={{ color: '#a16207', marginTop: 0 }}>💰 Belöning</h3>
                <p style={{ color: '#ca8a04', margin: 0 }}>1-12% av köpet baserat på kvalitet</p>
              </div>
              
              <div style={{ 
                backgroundColor: '#f0f9ff', 
                padding: '15px', 
                borderRadius: '8px',
                border: '1px solid #7dd3fc'
              }}>
                <h3 style={{ color: '#0c4a6e', marginTop: 0 }}>🛡️ Bedrägerisskydd</h3>
                <p style={{ color: '#0369a1', margin: 0 }}>AI-driven riskanalys och validering</p>
              </div>
            </div>

            <button
              onClick={handleFeedbackDemo}
              style={{
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '15px 30px',
                fontSize: '1.1rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                width: '100%',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
            >
              🚀 Testa AI-Feedback Systemet
            </button>
          </div>
        )}

        {currentDemo === 'results' && qualityScore && reward && (
          <div>
            <div style={{ 
              backgroundColor: '#f0fdf4', 
              padding: '20px', 
              borderRadius: '8px', 
              marginBottom: '20px',
              border: '2px solid #22c55e'
            }}>
              <h2 style={{ color: '#15803d', marginTop: 0 }}>
                ✅ AI-Analys Slutförd!
              </h2>
              <p style={{ color: '#16a34a', margin: 0 }}>
                Din feedback har analyserats och belöning beräknad
              </p>
            </div>

            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '20px',
              marginBottom: '30px'
            }}>
              
              {/* Quality Score */}
              <div style={{ 
                backgroundColor: '#fefce8', 
                padding: '20px', 
                borderRadius: '8px',
                border: '1px solid #fde047'
              }}>
                <h3 style={{ color: '#a16207', marginTop: 0 }}>🧠 Kvalitetspoäng</h3>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#ca8a04', marginBottom: '10px' }}>
                  {qualityScore.total}/100
                </div>
                <div style={{ color: '#92400e', fontSize: '0.9rem' }}>
                  <div>Äkthet: {qualityScore.authenticity}/100 (40%)</div>
                  <div>Konkrethet: {qualityScore.concreteness}/100 (30%)</div>
                  <div>Djup: {qualityScore.depth}/100 (30%)</div>
                </div>
              </div>

              {/* Reward */}
              <div style={{ 
                backgroundColor: '#ecfdf5', 
                padding: '20px', 
                borderRadius: '8px',
                border: '1px solid #a7f3d0'
              }}>
                <h3 style={{ color: '#065f46', marginTop: 0 }}>💰 Din Belöning</h3>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#047857', marginBottom: '10px' }}>
                  {reward.rewardAmount.toFixed(2)} SEK
                </div>
                <div style={{ color: '#047857', fontSize: '0.9rem' }}>
                  <div>{reward.rewardPercentage}% av {reward.purchaseAmount} SEK köp</div>
                  <div>Plattformsavgift: {reward.platformFee.toFixed(2)} SEK</div>
                  <div>Kostnad för företag: {reward.businessCost.toFixed(2)} SEK</div>
                </div>
              </div>
            </div>

            {/* Business Value */}
            <div style={{ 
              backgroundColor: '#f8fafc', 
              padding: '20px', 
              borderRadius: '8px', 
              border: '1px solid #e2e8f0',
              marginBottom: '20px'
            }}>
              <h3 style={{ color: '#334155', marginTop: 0 }}>📊 Företagsvärde</h3>
              <div style={{ color: '#475569' }}>
                <div>✅ Konkret feedback om nya kaffesorten</div>
                <div>✅ Personalprestationsinsikter</div>
                <div>✅ Förbättringsförslag: Fler veganska alternativ</div>
                <div>✅ Kvalificerad kunddata för framtida beslut</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setCurrentDemo('welcome')}
                style={{
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px 24px',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  flex: 1
                }}
              >
                🔄 Testa Igen
              </button>
              
              <button
                onClick={() => window.open('https://github.com/your-repo/ai-feedback-platform', '_blank')}
                style={{
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px 24px',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  flex: 1
                }}
              >
                📱 Fullständig Demo
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ 
        textAlign: 'center', 
        marginTop: '30px',
        color: '#64748b',
        fontSize: '0.9rem'
      }}>
        <p>🇸🇪 AI Feedback Platform - Utvecklad för den svenska marknaden</p>
        <p>✅ GDPR-kompatibel • ✅ Stripe Connect • ✅ Ollama AI • ✅ WhisperX röstanalys</p>
      </div>
    </div>
  );
}