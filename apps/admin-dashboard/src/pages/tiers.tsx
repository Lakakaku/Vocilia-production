import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import { authManager, getCurrentUser, AdminUser } from '../utils/auth';

// Types for tier management
interface Business {
  id: string;
  name: string;
  organizationNumber: string;
  currentTier: 1 | 2 | 3;
  approvedAt: string;
  monthlyRevenue: number;
  transactionVolume: number;
  customerCount: number;
  performanceScore: number;
  complianceScore: number;
  lastTierChange?: {
    date: string;
    previousTier: number;
    newTier: number;
    reason: string;
    adminName: string;
  };
  eligibleForUpgrade: boolean;
  upgradeRecommendation?: {
    toTier: number;
    confidence: number;
    reasons: string[];
  };
}

interface TierConfiguration {
  tier: 1 | 2 | 3;
  name: string;
  description: string;
  limits: {
    dailyPayouts: string;
    monthlyTransactions: number;
    customerVolume: number;
  };
  commission: {
    rate: number;
    description: string;
  };
  requirements: {
    minimumScore: number;
    monthlyRevenue: number;
    performanceCriteria: string[];
  };
  benefits: string[];
  color: string;
}

const TIER_CONFIGURATIONS: TierConfiguration[] = [
  {
    tier: 1,
    name: 'Starter',
    description: 'Perfekt för nya företag som vill testa plattformen',
    limits: {
      dailyPayouts: '200 SEK/dag',
      monthlyTransactions: 500,
      customerVolume: 150
    },
    commission: {
      rate: 20,
      description: '20% provision på alla utbetalningar'
    },
    requirements: {
      minimumScore: 60,
      monthlyRevenue: 0,
      performanceCriteria: [
        'Grundläggande regelefterlevnad',
        'Verifierade affärshandlingar',
        'Ingen negativ kredithistorik'
      ]
    },
    benefits: [
      'Grundläggande AI-feedback analys',
      'Email support',
      'Månadsrapporter',
      'Grundläggande bedrägeri-skydd'
    ],
    color: '#22c55e'
  },
  {
    tier: 2,
    name: 'Professional',  
    description: 'För etablerade företag med stabilt kassaflöde',
    limits: {
      dailyPayouts: '1000 SEK/dag',
      monthlyTransactions: 2000,
      customerVolume: 600
    },
    commission: {
      rate: 18,
      description: '18% provision på alla utbetalningar'
    },
    requirements: {
      minimumScore: 75,
      monthlyRevenue: 50000,
      performanceCriteria: [
        'Hög regelefterlevnad',
        'Stabil ekonomisk historia',
        'Positiv kundrespons',
        'Konsekvent transaktionsvolym'
      ]
    },
    benefits: [
      'Avancerad AI-feedback analys',
      'Prioriterat support',
      'Veckorapporter och insights',
      'Avancerat bedrägeri-skydd',
      'Anpassade kampanjer'
    ],
    color: '#3b82f6'
  },
  {
    tier: 3,
    name: 'Enterprise',
    description: 'För stora företag med hög transaktionsvolym',
    limits: {
      dailyPayouts: '5000 SEK/dag',
      monthlyTransactions: 10000,
      customerVolume: 3000
    },
    commission: {
      rate: 15,
      description: '15% provision på alla utbetalningar'
    },
    requirements: {
      minimumScore: 90,
      monthlyRevenue: 200000,
      performanceCriteria: [
        'Exceptionell regelefterlevnad',
        'Bevisad lönsamhet och tillväxt',
        'Utmärkt kundbetyg',
        'Hög transaktions framgång',
        'Branschledarskap'
      ]
    },
    benefits: [
      'Premium AI-feedback analys',
      'Dedikerad account manager',
      'Realtidsrapporter och dashboards',
      'Premiumbedrägeri-skydd',
      'Anpassade integrationer',
      'Prioriterade funktionsförfrågningar'
    ],
    color: '#8b5cf6'
  }
];

export default function TiersPage() {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [showTierChangeModal, setShowTierChangeModal] = useState(false);
  const [tierFilter, setTierFilter] = useState<number | 'all'>('all');
  const [upgradeOnlyFilter, setUpgradeOnlyFilter] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Check authentication and permissions
    const currentUser = getCurrentUser();
    if (!currentUser) {
      router.push('/login');
      return;
    }
    
    // Check if user has tier management permissions
    if (!currentUser.permissions.includes('business:approve') && 
        !currentUser.permissions.includes('tier:manage')) {
      router.push('/dashboard');
      return;
    }
    
    setUser(currentUser);
    loadBusinesses();
    setLoading(false);
  }, [router]);

  const loadBusinesses = async () => {
    try {
      setLoading(true);
      
      const response = await authManager.makeAuthenticatedRequest('/api/admin/business/tiers');
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setBusinesses(data.data.businesses);
        }
      } else {
        console.error('Failed to load businesses for tier management');
      }
    } catch (err) {
      console.error('Load businesses error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTierChange = async (tierChangeData: any) => {
    try {
      const response = await authManager.makeAuthenticatedRequest(
        `/api/admin/business/${tierChangeData.businessId}/change-tier`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(tierChangeData)
        }
      );

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // Show success message
          const changeType = result.data.changeType;
          const tierName = getTierConfig(result.data.newTier as 1 | 2 | 3).name;
          
          alert(`Tier-ändring genomförd!
          
${changeType === 'upgrade' ? '⬆️ Uppgradering' : changeType === 'downgrade' ? '⬇️ Nedgradering' : '🔄 Uppdatering'} till Tier ${result.data.newTier} (${tierName})

• Provision: ${result.data.tierConfig.commission}%
• Daglig gräns: ${result.data.tierConfig.dailyLimit}
• Genomförd av: ${result.data.processedBy.adminEmail}

${result.data.notification ? 'Företaget har meddelats om ändringen.' : ''}`);

          // Close modal and refresh data
          setShowTierChangeModal(false);
          setSelectedBusiness(null);
          await loadBusinesses();
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Tier-ändring misslyckades');
      }
    } catch (err: any) {
      console.error('Tier change error:', err);
      alert('Kunde inte genomföra tier-ändring: ' + err.message);
    }
  };

  const getTierConfig = (tier: 1 | 2 | 3): TierConfiguration => {
    return TIER_CONFIGURATIONS.find(config => config.tier === tier) || TIER_CONFIGURATIONS[0];
  };

  const getPerformanceColor = (score: number): string => {
    if (score >= 90) return '#22c55e';
    if (score >= 75) return '#f59e0b';
    return '#ef4444';
  };

  const getFilteredBusinesses = (): Business[] => {
    let filtered = businesses;
    
    if (tierFilter !== 'all') {
      filtered = filtered.filter(b => b.currentTier === tierFilter);
    }
    
    if (upgradeOnlyFilter) {
      filtered = filtered.filter(b => b.eligibleForUpgrade);
    }
    
    return filtered.sort((a, b) => b.performanceScore - a.performanceScore);
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
            <p style={{ color: '#64748b' }}>Laddar tier-hantering...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <Layout>
      {/* Page Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ 
              fontSize: '28px', 
              fontWeight: 'bold', 
              color: '#1e293b',
              margin: '0 0 8px 0'
            }}>
              Tier-hantering
            </h1>
            <p style={{ 
              color: '#64748b', 
              fontSize: '16px',
              margin: 0
            }}>
              Hantera företags tier-nivåer, uppgraderingar och provisioner
            </p>
          </div>
          
          <div style={{
            padding: '8px 12px',
            backgroundColor: user.permissions.includes('tier:manage') ? '#dcfce7' : '#fef3c7',
            color: user.permissions.includes('tier:manage') ? '#166534' : '#92400e',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: '500'
          }}>
            {user.permissions.includes('tier:manage') ? 
              '⚡ Full Tier-behörighet' : 
              '👀 Endast läsbehörighet'}
          </div>
        </div>
      </div>

      {/* Tier Configuration Overview */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
        gap: '20px',
        marginBottom: '32px'
      }}>
        {TIER_CONFIGURATIONS.map(config => (
          <div
            key={config.tier}
            style={{
              backgroundColor: 'white',
              border: '2px solid ' + config.color,
              borderRadius: '12px',
              padding: '20px',
              position: 'relative'
            }}
          >
            <div style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              backgroundColor: config.color,
              color: 'white',
              padding: '4px 8px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: '500'
            }}>
              Tier {config.tier}
            </div>
            
            <h3 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: config.color,
              margin: '0 0 8px 0'
            }}>
              {config.name}
            </h3>
            
            <p style={{
              fontSize: '14px',
              color: '#64748b',
              margin: '0 0 16px 0',
              lineHeight: '1.4'
            }}>
              {config.description}
            </p>

            <div style={{ fontSize: '12px', lineHeight: '1.5' }}>
              <div style={{ marginBottom: '8px' }}>
                <strong>Gränser:</strong>
                <div style={{ color: '#64748b', marginLeft: '8px' }}>
                  • {config.limits.dailyPayouts}<br/>
                  • {config.limits.monthlyTransactions.toLocaleString('sv-SE')} transaktioner/månad<br/>
                  • {config.limits.customerVolume.toLocaleString('sv-SE')} kunder/månad
                </div>
              </div>
              
              <div style={{ marginBottom: '8px' }}>
                <strong>Provision:</strong>
                <span style={{ color: config.color, marginLeft: '8px', fontWeight: '500' }}>
                  {config.commission.rate}%
                </span>
              </div>
              
              <div>
                <strong>Min. poäng:</strong>
                <span style={{ 
                  marginLeft: '8px', 
                  color: getPerformanceColor(config.requirements.minimumScore),
                  fontWeight: '500'
                }}>
                  {config.requirements.minimumScore}/100
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{
        backgroundColor: 'white',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '24px'
      }}>
        <h3 style={{ 
          fontSize: '16px', 
          fontWeight: '600', 
          color: '#1e293b',
          margin: '0 0 16px 0'
        }}>
          Filter och Sök
        </h3>
        
        <div style={{ 
          display: 'flex', 
          gap: '16px', 
          alignItems: 'center',
          flexWrap: 'wrap'
        }}>
          <div>
            <label style={{ 
              display: 'block', 
              fontSize: '14px', 
              fontWeight: '500', 
              marginBottom: '4px',
              color: '#374151'
            }}>
              Tier:
            </label>
            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
              style={{
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                backgroundColor: 'white',
                fontSize: '14px'
              }}
            >
              <option value="all">Alla Tiers</option>
              <option value={1}>Tier 1 - Starter</option>
              <option value={2}>Tier 2 - Professional</option>
              <option value={3}>Tier 3 - Enterprise</option>
            </select>
          </div>

          <div>
            <label style={{ 
              display: 'flex', 
              alignItems: 'center',
              fontSize: '14px',
              marginTop: '20px',
              cursor: 'pointer'
            }}>
              <input
                type="checkbox"
                checked={upgradeOnlyFilter}
                onChange={(e) => setUpgradeOnlyFilter(e.target.checked)}
                style={{ marginRight: '8px' }}
              />
              Visa endast uppgraderingsberättigade
            </label>
          </div>
        </div>
      </div>

      {/* Businesses List */}
      <div style={{ 
        backgroundColor: 'white',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        overflow: 'hidden'
      }}>
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #e2e8f0',
          backgroundColor: '#f8fafc'
        }}>
          <h3 style={{ 
            fontSize: '18px', 
            fontWeight: '600', 
            color: '#1e293b',
            margin: '0 0 8px 0'
          }}>
            Företag ({getFilteredBusinesses().length})
          </h3>
          <p style={{ 
            fontSize: '14px', 
            color: '#64748b',
            margin: 0
          }}>
            Klicka på ett företag för att hantera dess tier-nivå
          </p>
        </div>

        <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
          {getFilteredBusinesses().map(business => {
            const tierConfig = getTierConfig(business.currentTier);
            
            return (
              <div
                key={business.id}
                style={{
                  padding: '20px',
                  borderBottom: '1px solid #f1f5f9',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  ':hover': { backgroundColor: '#f8fafc' }
                }}
                onClick={() => {
                  setSelectedBusiness(business);
                  setShowTierChangeModal(true);
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f8fafc';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                      <h4 style={{
                        fontSize: '16px',
                        fontWeight: '600',
                        color: '#1e293b',
                        margin: 0
                      }}>
                        {business.name}
                      </h4>
                      
                      <div style={{
                        padding: '4px 8px',
                        backgroundColor: tierConfig.color + '20',
                        color: tierConfig.color,
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: '500'
                      }}>
                        Tier {business.currentTier} - {tierConfig.name}
                      </div>
                      
                      {business.eligibleForUpgrade && (
                        <div style={{
                          padding: '2px 6px',
                          backgroundColor: '#dcfce7',
                          color: '#166534',
                          borderRadius: '8px',
                          fontSize: '10px',
                          fontWeight: '500'
                        }}>
                          ⬆️ Uppgraderingsberättigad
                        </div>
                      )}
                    </div>
                    
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                      gap: '12px',
                      fontSize: '13px',
                      color: '#64748b'
                    }}>
                      <div>
                        <strong>Org.nr:</strong> {business.organizationNumber}<br/>
                        <strong>Godkänd:</strong> {new Date(business.approvedAt).toLocaleDateString('sv-SE')}
                      </div>
                      <div>
                        <strong>Månadsomsättning:</strong> {business.monthlyRevenue.toLocaleString('sv-SE')} SEK<br/>
                        <strong>Transaktioner:</strong> {business.transactionVolume.toLocaleString('sv-SE')}/månad
                      </div>
                      <div>
                        <strong>Performance:</strong> 
                        <span style={{ 
                          color: getPerformanceColor(business.performanceScore),
                          fontWeight: '500',
                          marginLeft: '4px'
                        }}>
                          {business.performanceScore}/100
                        </span><br/>
                        <strong>Compliance:</strong>
                        <span style={{ 
                          color: getPerformanceColor(business.complianceScore),
                          fontWeight: '500',
                          marginLeft: '4px'
                        }}>
                          {business.complianceScore}/100
                        </span>
                      </div>
                    </div>

                    {business.upgradeRecommendation && (
                      <div style={{
                        marginTop: '8px',
                        padding: '8px',
                        backgroundColor: '#f0f9ff',
                        border: '1px solid #bae6fd',
                        borderRadius: '6px',
                        fontSize: '12px'
                      }}>
                        <strong style={{ color: '#0369a1' }}>
                          🤖 AI-rekommendation: Uppgradera till Tier {business.upgradeRecommendation.toTier}
                        </strong>
                        <div style={{ color: '#0369a1', marginTop: '2px' }}>
                          Säkerhet: {Math.round(business.upgradeRecommendation.confidence * 100)}%
                        </div>
                      </div>
                    )}

                    {business.lastTierChange && (
                      <div style={{
                        marginTop: '8px',
                        fontSize: '11px',
                        color: '#6b7280'
                      }}>
                        Senaste tier-ändring: Tier {business.lastTierChange.previousTier} → {business.lastTierChange.newTier} 
                        ({new Date(business.lastTierChange.date).toLocaleDateString('sv-SE')})
                        av {business.lastTierChange.adminName}
                      </div>
                    )}
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedBusiness(business);
                        setShowTierChangeModal(true);
                      }}
                      disabled={!user.permissions.includes('tier:manage')}
                      style={{
                        padding: '8px 12px',
                        backgroundColor: user.permissions.includes('tier:manage') ? '#3b82f6' : '#d1d5db',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '12px',
                        cursor: user.permissions.includes('tier:manage') ? 'pointer' : 'not-allowed',
                        fontWeight: '500'
                      }}
                    >
                      Hantera Tier
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {getFilteredBusinesses().length === 0 && (
          <div style={{ 
            textAlign: 'center', 
            padding: '40px', 
            color: '#64748b',
            backgroundColor: '#f8fafc'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
            <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>Inga företag att visa</h3>
            <p style={{ fontSize: '14px' }}>Det finns inga företag som matchar de valda filtren.</p>
          </div>
        )}
      </div>

      {/* Tier Change Modal */}
      {showTierChangeModal && selectedBusiness && (
        <TierChangeModal
          business={selectedBusiness}
          onSave={handleTierChange}
          onCancel={() => {
            setShowTierChangeModal(false);
            setSelectedBusiness(null);
          }}
        />
      )}

      {/* CSS for loading animation */}
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </Layout>
  );
}

// Tier Change Modal Component
interface TierChangeModalProps {
  business: Business;
  onSave: (data: any) => void;
  onCancel: () => void;
}

function TierChangeModal({ business, onSave, onCancel }: TierChangeModalProps) {
  const [newTier, setNewTier] = useState<1 | 2 | 3>(business.currentTier);
  const [reason, setReason] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split('T')[0]);
  const [notifyBusiness, setNotifyBusiness] = useState(true);

  const currentTierConfig = TIER_CONFIGURATIONS.find(c => c.tier === business.currentTier);
  const newTierConfig = TIER_CONFIGURATIONS.find(c => c.tier === newTier);

  const isUpgrade = newTier > business.currentTier;
  const isDowngrade = newTier < business.currentTier;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!reason.trim() && newTier !== business.currentTier) {
      alert('Anledning för tier-ändring krävs');
      return;
    }

    onSave({
      businessId: business.id,
      newTier,
      previousTier: business.currentTier,
      reason: reason.trim(),
      effectiveDate,
      notifyBusiness,
      changeType: isUpgrade ? 'upgrade' : isDowngrade ? 'downgrade' : 'no-change'
    });
  };

  return (
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
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '24px',
        width: '600px',
        maxHeight: '90vh',
        overflowY: 'auto'
      }}>
        <h3 style={{ 
          fontSize: '20px', 
          fontWeight: '600', 
          marginBottom: '16px',
          color: '#1e293b'
        }}>
          Hantera Tier för {business.name}
        </h3>

        <form onSubmit={handleSubmit}>
          {/* Current vs New Tier Comparison */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr', 
            gap: '16px',
            marginBottom: '24px'
          }}>
            <div style={{
              padding: '16px',
              border: '2px solid ' + currentTierConfig?.color,
              borderRadius: '8px',
              backgroundColor: currentTierConfig?.color + '10'
            }}>
              <h4 style={{ 
                color: currentTierConfig?.color,
                fontSize: '14px',
                fontWeight: '600',
                marginBottom: '8px'
              }}>
                Nuvarande Tier {business.currentTier}
              </h4>
              <div style={{ fontSize: '12px', lineHeight: '1.4' }}>
                <strong>{currentTierConfig?.name}</strong><br/>
                Provision: {currentTierConfig?.commission.rate}%<br/>
                Gräns: {currentTierConfig?.limits.dailyPayouts}
              </div>
            </div>

            <div style={{
              padding: '16px',
              border: '2px solid ' + newTierConfig?.color,
              borderRadius: '8px',
              backgroundColor: newTierConfig?.color + '10'
            }}>
              <h4 style={{ 
                color: newTierConfig?.color,
                fontSize: '14px',
                fontWeight: '600',
                marginBottom: '8px'
              }}>
                Ny Tier {newTier}
              </h4>
              <div style={{ fontSize: '12px', lineHeight: '1.4' }}>
                <strong>{newTierConfig?.name}</strong><br/>
                Provision: {newTierConfig?.commission.rate}%<br/>
                Gräns: {newTierConfig?.limits.dailyPayouts}
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ 
              display: 'block', 
              fontSize: '14px', 
              fontWeight: '500', 
              marginBottom: '4px'
            }}>
              Ny Tier:
            </label>
            <select
              value={newTier}
              onChange={(e) => setNewTier(parseInt(e.target.value) as 1 | 2 | 3)}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #d1d5db',
                borderRadius: '6px'
              }}
            >
              <option value={1}>Tier 1 - Starter (20% provision)</option>
              <option value={2}>Tier 2 - Professional (18% provision)</option>
              <option value={3}>Tier 3 - Enterprise (15% provision)</option>
            </select>
          </div>

          {newTier !== business.currentTier && (
            <>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ 
                  display: 'block', 
                  fontSize: '14px', 
                  fontWeight: '500', 
                  marginBottom: '4px'
                }}>
                  Anledning för tier-ändring: *
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={`Beskriv anledningen för ${isUpgrade ? 'uppgradering' : 'nedgradering'}...`}
                  style={{
                    width: '100%',
                    minHeight: '80px',
                    padding: '8px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    resize: 'vertical'
                  }}
                  required
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ 
                  display: 'block', 
                  fontSize: '14px', 
                  fontWeight: '500', 
                  marginBottom: '4px'
                }}>
                  Giltig från:
                </label>
                <input
                  type="date"
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px'
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'flex', alignItems: 'center', fontSize: '14px' }}>
                  <input
                    type="checkbox"
                    checked={notifyBusiness}
                    onChange={(e) => setNotifyBusiness(e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  Meddela företaget om tier-ändringen
                </label>
              </div>
            </>
          )}

          {/* Performance Summary */}
          <div style={{
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '20px'
          }}>
            <h4 style={{ 
              fontSize: '14px', 
              fontWeight: '600',
              marginBottom: '8px',
              color: '#374151'
            }}>
              Performance Sammanfattning
            </h4>
            <div style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.4' }}>
              Performance Score: {business.performanceScore}/100 • 
              Compliance Score: {business.complianceScore}/100 • 
              Månadsomsättning: {business.monthlyRevenue.toLocaleString('sv-SE')} SEK
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onCancel}
              style={{
                padding: '10px 16px',
                backgroundColor: '#f3f4f6',
                color: '#374151',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              Avbryt
            </button>
            <button
              type="submit"
              style={{
                padding: '10px 16px',
                backgroundColor: newTier !== business.currentTier ? 
                  (isUpgrade ? '#22c55e' : '#f59e0b') : '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              {newTier === business.currentTier ? 'Ingen ändring' : 
               isUpgrade ? `⬆️ Uppgradera till Tier ${newTier}` : 
               `⬇️ Nedgradera till Tier ${newTier}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}