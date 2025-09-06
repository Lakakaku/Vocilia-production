import { useState, useEffect } from 'react';

export default function BusinessDashboard() {
  const [selectedTab, setSelectedTab] = useState('overview');
  const [businessData, setBusinessData] = useState<any>(null);

  useEffect(() => {
    // Simulate loading business data
    setBusinessData({
      name: 'Café Aurora Stockholm',
      orgNumber: '556123-4567',
      totalFeedbacks: 147,
      avgQualityScore: 73.2,
      totalRewards: 18450, // SEK
      monthlyRevenue: 250000, // SEK
      customerSatisfaction: 4.3,
      topCategories: ['Kaffe', 'Service', 'Atmosfär', 'Lokalens renlighet'],
      recentFeedbacks: [
        {
          id: 1,
          time: '2024-08-26 14:30',
          score: 87,
          reward: 15.60,
          category: 'Service',
          summary: 'Mycket nöjd med den nya kaffesorten och hjälpsam personal'
        },
        {
          id: 2,
          time: '2024-08-26 13:45',
          score: 72,
          reward: 12.40,
          category: 'Produkt',
          summary: 'Bra kaffe men vill ha fler veganska alternativ'
        },
        {
          id: 3,
          time: '2024-08-26 12:15',
          score: 91,
          reward: 18.20,
          category: 'Atmosfär',
          summary: 'Fantastisk miljö för att jobba, snabbt wifi och mysig lokal'
        },
        {
          id: 4,
          time: '2024-08-26 11:30',
          score: 65,
          reward: 9.75,
          category: 'Service',
          summary: 'Lite långsam service under lunchtid men trevlig personal'
        }
      ],
      insights: [
        { type: 'positive', text: 'Kunder uppskattar er nya kaffesortering särskilt mycket' },
        { type: 'improvement', text: 'Fler veganska alternativ efterfrågas av 23% av kunderna' },
        { type: 'positive', text: 'Personalens vänlighet nämns i 78% av positiva recensioner' },
        { type: 'improvement', text: 'Service under lunchtid (11:30-13:00) kan förbättras' }
      ]
    });
  }, []);

  const TabButton = ({ id, label, active }: { id: string; label: string; active: boolean }) => (
    <button
      onClick={() => setSelectedTab(id)}
      style={{
        padding: '12px 24px',
        border: 'none',
        borderRadius: '8px',
        backgroundColor: active ? '#3b82f6' : '#f1f5f9',
        color: active ? 'white' : '#64748b',
        fontWeight: active ? 'bold' : 'normal',
        cursor: 'pointer',
        transition: 'all 0.2s'
      }}
    >
      {label}
    </button>
  );

  if (!businessData) return <div>Laddar...</div>;

  return (
    <div style={{ 
      fontFamily: 'system-ui, -apple-system, sans-serif',
      backgroundColor: '#f8fafc',
      minHeight: '100vh',
      padding: '20px'
    }}>
      
      {/* Header */}
      <div style={{ 
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '30px',
        marginBottom: '20px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ 
              color: '#1e293b', 
              fontSize: '2rem', 
              marginBottom: '5px',
              margin: 0
            }}>
              🏪 {businessData.name}
            </h1>
            <p style={{ 
              color: '#64748b', 
              margin: '5px 0 0 0'
            }}>
              Org.nr: {businessData.orgNumber} • Business Dashboard
            </p>
          </div>
          <div style={{ 
            backgroundColor: '#ecfdf5',
            padding: '10px 20px',
            borderRadius: '8px',
            border: '1px solid #a7f3d0'
          }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#047857' }}>
              {businessData.avgQualityScore}/100
            </div>
            <div style={{ fontSize: '0.9rem', color: '#065f46' }}>
              Genomsnittlig kvalitet
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
        <TabButton id="overview" label="📊 Översikt" active={selectedTab === 'overview'} />
        <TabButton id="feedback" label="💬 Feedback" active={selectedTab === 'feedback'} />
        <TabButton id="insights" label="🔍 Insikter" active={selectedTab === 'insights'} />
        <TabButton id="revenue" label="💰 Intäkter" active={selectedTab === 'revenue'} />
      </div>

      {/* Overview Tab */}
      {selectedTab === 'overview' && (
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
              <h3 style={{ color: '#334155', marginTop: 0 }}>📈 Totalt Feedback</h3>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#3b82f6' }}>
                {businessData.totalFeedbacks}
              </div>
              <div style={{ color: '#64748b', fontSize: '0.9rem' }}>
                +23 denna vecka
              </div>
            </div>

            <div style={{ 
              backgroundColor: 'white', 
              padding: '20px', 
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ color: '#334155', marginTop: 0 }}>💰 Utbetalade Belöningar</h3>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#059669' }}>
                {businessData.totalRewards.toLocaleString()} SEK
              </div>
              <div style={{ color: '#64748b', fontSize: '0.9rem' }}>
                {((businessData.totalRewards / businessData.monthlyRevenue) * 100).toFixed(1)}% av omsättning
              </div>
            </div>

            <div style={{ 
              backgroundColor: 'white', 
              padding: '20px', 
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ color: '#334155', marginTop: 0 }}>⭐ Kundnöjdhet</h3>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f59e0b' }}>
                {businessData.customerSatisfaction}/5
              </div>
              <div style={{ color: '#64748b', fontSize: '0.9rem' }}>
                +0.3 från förra månaden
              </div>
            </div>

            <div style={{ 
              backgroundColor: 'white', 
              padding: '20px', 
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ color: '#334155', marginTop: 0 }}>💡 ROI Feedback</h3>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#dc2626' }}>
                347%
              </div>
              <div style={{ color: '#64748b', fontSize: '0.9rem' }}>
                Värde vs kostnad
              </div>
            </div>
          </div>

          <div style={{ 
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '30px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ color: '#334155', marginTop: 0 }}>🎯 Populära Kategorier</h3>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {businessData.topCategories.map((category: string, index: number) => (
                <div key={index} style={{ 
                  backgroundColor: '#f0f9ff',
                  padding: '8px 16px',
                  borderRadius: '20px',
                  border: '1px solid #7dd3fc',
                  color: '#0c4a6e',
                  fontSize: '0.9rem'
                }}>
                  {category}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Feedback Tab */}
      {selectedTab === 'feedback' && (
        <div style={{ 
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '30px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ color: '#334155', marginTop: 0 }}>💬 Senaste Feedback</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {businessData.recentFeedbacks.map((feedback: any) => (
              <div key={feedback.id} style={{ 
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '20px',
                backgroundColor: '#fafafa'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <div>
                    <div style={{ fontWeight: 'bold', color: '#334155' }}>
                      Kvalitetspoäng: {feedback.score}/100
                    </div>
                    <div style={{ color: '#64748b', fontSize: '0.9rem' }}>
                      {feedback.time} • {feedback.category}
                    </div>
                  </div>
                  <div style={{ 
                    backgroundColor: '#ecfdf5',
                    padding: '5px 12px',
                    borderRadius: '12px',
                    border: '1px solid #a7f3d0',
                    color: '#047857',
                    fontSize: '0.9rem',
                    fontWeight: 'bold'
                  }}>
                    +{feedback.reward} SEK
                  </div>
                </div>
                <p style={{ margin: 0, color: '#374151' }}>
                  {feedback.summary}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Insights Tab */}
      {selectedTab === 'insights' && (
        <div style={{ 
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '30px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ color: '#334155', marginTop: 0 }}>🔍 AI-Genererade Insikter</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {businessData.insights.map((insight: any, index: number) => (
              <div key={index} style={{ 
                border: `1px solid ${insight.type === 'positive' ? '#a7f3d0' : '#fde047'}`,
                borderRadius: '8px',
                padding: '20px',
                backgroundColor: insight.type === 'positive' ? '#ecfdf5' : '#fefce8'
              }}>
                <div style={{ 
                  color: insight.type === 'positive' ? '#047857' : '#a16207',
                  fontWeight: 'bold',
                  marginBottom: '8px'
                }}>
                  {insight.type === 'positive' ? '✅ Styrka' : '🔧 Förbättringsområde'}
                </div>
                <p style={{ 
                  margin: 0, 
                  color: insight.type === 'positive' ? '#065f46' : '#92400e'
                }}>
                  {insight.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Revenue Tab */}
      {selectedTab === 'revenue' && (
        <div style={{ 
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '30px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ color: '#334155', marginTop: 0 }}>💰 Intäktsanalys & ROI</h3>
          
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '20px',
            marginBottom: '30px'
          }}>
            <div style={{ 
              backgroundColor: '#f0f9ff',
              padding: '20px',
              borderRadius: '8px',
              border: '1px solid #7dd3fc'
            }}>
              <h4 style={{ color: '#0c4a6e', marginTop: 0 }}>📊 Månadsomsättning</h4>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#0369a1' }}>
                {businessData.monthlyRevenue.toLocaleString()} SEK
              </div>
            </div>

            <div style={{ 
              backgroundColor: '#ecfdf5',
              padding: '20px',
              borderRadius: '8px',
              border: '1px solid #a7f3d0'
            }}>
              <h4 style={{ color: '#065f46', marginTop: 0 }}>💸 Belöningskostnad</h4>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#047857' }}>
                {businessData.totalRewards.toLocaleString()} SEK
              </div>
              <div style={{ color: '#065f46', fontSize: '0.9rem' }}>
                {((businessData.totalRewards / businessData.monthlyRevenue) * 100).toFixed(1)}% av omsättning
              </div>
            </div>

            <div style={{ 
              backgroundColor: '#fefce8',
              padding: '20px',
              borderRadius: '8px',
              border: '1px solid #fde047'
            }}>
              <h4 style={{ color: '#a16207', marginTop: 0 }}>🎯 Plattformsavgift</h4>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#ca8a04' }}>
                {(businessData.totalRewards * 0.2).toLocaleString()} SEK
              </div>
              <div style={{ color: '#92400e', fontSize: '0.9rem' }}>
                20% av belöningar
              </div>
            </div>
          </div>

          <div style={{ 
            backgroundColor: '#f8fafc',
            padding: '20px',
            borderRadius: '8px',
            border: '1px solid #e2e8f0'
          }}>
            <h4 style={{ color: '#334155', marginTop: 0 }}>📈 Beräknat Värde från Feedback</h4>
            <div style={{ color: '#475569' }}>
              <div>✅ Ökad kundlojalitet: ~45,000 SEK/månad</div>
              <div>✅ Förbättrade produkter/service: ~32,000 SEK/månad</div>
              <div>✅ Minskat kundavhopp: ~28,000 SEK/månad</div>
              <div style={{ fontWeight: 'bold', marginTop: '10px', color: '#059669' }}>
                💡 Totalt uppskattat värde: 105,000 SEK/månad
              </div>
              <div style={{ fontWeight: 'bold', color: '#dc2626' }}>
                🎯 ROI: 347% (105k värde vs 18.5k + 3.7k kostnad)
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}