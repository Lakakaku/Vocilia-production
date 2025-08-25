import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import { authManager, getCurrentUser, AdminUser } from '../utils/auth';

// Types for limit management
interface BusinessLimit {
  businessId: string;
  businessName: string;
  organizationNumber: string;
  currentTier: 1 | 2 | 3;
  limits: {
    dailyPayout: {
      limit: number;
      used: number;
      remaining: number;
      percentage: number;
    };
    monthlyTransactions: {
      limit: number;
      used: number;
      remaining: number;
      percentage: number;
    };
    customerVolume: {
      limit: number;
      used: number;
      remaining: number;
      percentage: number;
    };
  };
  overrides: LimitOverride[];
  violations: LimitViolation[];
  status: 'normal' | 'approaching_limit' | 'limit_exceeded' | 'suspended';
  lastActivity: string;
}

interface LimitOverride {
  id: string;
  businessId: string;
  type: 'daily_payout' | 'monthly_transactions' | 'customer_volume';
  originalLimit: number;
  newLimit: number;
  reason: string;
  requestedBy: string;
  approvedBy: string;
  createdAt: string;
  expiresAt: string;
  status: 'active' | 'expired' | 'revoked';
  isEmergency: boolean;
  adminNotes?: string;
}

interface LimitViolation {
  id: string;
  businessId: string;
  type: 'daily_payout' | 'monthly_transactions' | 'customer_volume';
  limit: number;
  attemptedAmount: number;
  exceedance: number;
  timestamp: string;
  resolvedAt?: string;
  resolution?: string;
  severity: 'minor' | 'major' | 'critical';
}

interface LimitAdjustmentRequest {
  businessId: string;
  type: 'daily_payout' | 'monthly_transactions' | 'customer_volume';
  newLimit: number;
  reason: string;
  duration: 'temporary' | 'permanent';
  expirationDate?: string;
  isEmergency?: boolean;
}

const LIMIT_TYPES = {
  daily_payout: {
    name: 'Daglig utbetalning',
    unit: 'SEK',
    icon: '💰'
  },
  monthly_transactions: {
    name: 'Månatliga transaktioner',
    unit: 'st',
    icon: '📊'
  },
  customer_volume: {
    name: 'Kundvolym',
    unit: 'kunder',
    icon: '👥'
  }
} as const;

export default function LimitsPage() {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [businessLimits, setBusinessLimits] = useState<BusinessLimit[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessLimit | null>(null);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [showViolationsModal, setShowViolationsModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [tierFilter, setTierFilter] = useState<number | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const router = useRouter();

  useEffect(() => {
    // Check authentication and permissions
    const currentUser = getCurrentUser();
    if (!currentUser) {
      router.push('/login');
      return;
    }
    
    // Check if user has limit management permissions
    if (!currentUser.permissions.includes('limits:read') && 
        !currentUser.permissions.includes('business:approve')) {
      router.push('/dashboard');
      return;
    }
    
    setUser(currentUser);
    loadBusinessLimits();
    setLoading(false);
  }, [router]);

  const loadBusinessLimits = async () => {
    try {
      setLoading(true);
      
      const response = await authManager.makeAuthenticatedRequest('/api/admin/business/limits');
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setBusinessLimits(data.data.businessLimits);
        }
      } else {
        console.error('Failed to load business limits');
      }
    } catch (err) {
      console.error('Load business limits error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'normal': return '#22c55e';
      case 'approaching_limit': return '#f59e0b';
      case 'limit_exceeded': return '#ef4444';
      case 'suspended': return '#dc2626';
      default: return '#6b7280';
    }
  };

  const getStatusText = (status: string): string => {
    switch (status) {
      case 'normal': return 'Normal';
      case 'approaching_limit': return 'Närmar sig gräns';
      case 'limit_exceeded': return 'Gräns överskriden';
      case 'suspended': return 'Avstängd';
      default: return status;
    }
  };

  const getLimitColor = (percentage: number): string => {
    if (percentage >= 90) return '#ef4444';
    if (percentage >= 75) return '#f59e0b';
    return '#22c55e';
  };

  const getFilteredBusinesses = (): BusinessLimit[] => {
    let filtered = businessLimits;
    
    if (statusFilter !== 'all') {
      filtered = filtered.filter(b => b.status === statusFilter);
    }
    
    if (tierFilter !== 'all') {
      filtered = filtered.filter(b => b.currentTier === tierFilter);
    }
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(b => 
        b.businessName.toLowerCase().includes(term) ||
        b.organizationNumber.includes(term)
      );
    }
    
    return filtered.sort((a, b) => {
      // Sort by status priority: suspended > limit_exceeded > approaching_limit > normal
      const statusPriority = { suspended: 4, limit_exceeded: 3, approaching_limit: 2, normal: 1 };
      return statusPriority[b.status] - statusPriority[a.status];
    });
  };

  const handleLimitOverride = async (overrideData: LimitAdjustmentRequest) => {
    try {
      const response = await authManager.makeAuthenticatedRequest(
        `/api/admin/business/${overrideData.businessId}/override-limits`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(overrideData)
        }
      );

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          alert(`Gräns-override genomfört!

• Typ: ${LIMIT_TYPES[overrideData.type].name}
• Ny gräns: ${overrideData.newLimit.toLocaleString('sv-SE')} ${LIMIT_TYPES[overrideData.type].unit}
• Varaktighet: ${overrideData.duration === 'temporary' ? 'Tillfällig' : 'Permanent'}
${overrideData.expirationDate ? `• Utgår: ${new Date(overrideData.expirationDate).toLocaleDateString('sv-SE')}` : ''}

Override-ID: ${result.data.overrideId}`);

          setShowOverrideModal(false);
          setSelectedBusiness(null);
          await loadBusinessLimits();
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Override misslyckades');
      }
    } catch (err: any) {
      console.error('Limit override error:', err);
      alert('Kunde inte genomföra gräns-override: ' + err.message);
    }
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
            <p style={{ color: '#64748b' }}>Laddar gräns-hantering...</p>
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
              Gräns-hantering
            </h1>
            <p style={{ 
              color: '#64748b', 
              fontSize: '16px',
              margin: 0
            }}>
              Övervaka och hantera företags tier-baserade gränser och overrides
            </p>
          </div>
          
          <div style={{
            padding: '8px 12px',
            backgroundColor: user.permissions.includes('limits:override') ? '#dcfce7' : '#fef3c7',
            color: user.permissions.includes('limits:override') ? '#166534' : '#92400e',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: '500'
          }}>
            {user.permissions.includes('limits:override') ? 
              '⚡ Override-behörighet' : 
              '👀 Endast läsbehörighet'}
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <div style={{
          backgroundColor: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '16px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#22c55e' }}>
            {businessLimits.filter(b => b.status === 'normal').length}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>Normal status</div>
        </div>
        
        <div style={{
          backgroundColor: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '16px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f59e0b' }}>
            {businessLimits.filter(b => b.status === 'approaching_limit').length}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>Närmar sig gräns</div>
        </div>
        
        <div style={{
          backgroundColor: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '16px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ef4444' }}>
            {businessLimits.filter(b => b.status === 'limit_exceeded').length}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>Gräns överskriden</div>
        </div>

        <div style={{
          backgroundColor: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '16px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#8b5cf6' }}>
            {businessLimits.reduce((sum, b) => sum + b.overrides.filter(o => o.status === 'active').length, 0)}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>Aktiva overrides</div>
        </div>
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
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '16px',
          alignItems: 'end'
        }}>
          <div>
            <label style={{ 
              display: 'block', 
              fontSize: '14px', 
              fontWeight: '500', 
              marginBottom: '4px',
              color: '#374151'
            }}>
              Status:
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                backgroundColor: 'white',
                fontSize: '14px'
              }}
            >
              <option value="all">Alla statusar</option>
              <option value="normal">Normal</option>
              <option value="approaching_limit">Närmar sig gräns</option>
              <option value="limit_exceeded">Gräns överskriden</option>
              <option value="suspended">Avstängd</option>
            </select>
          </div>

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
                width: '100%',
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
              display: 'block', 
              fontSize: '14px', 
              fontWeight: '500', 
              marginBottom: '4px',
              color: '#374151'
            }}>
              Sök företag:
            </label>
            <input
              type="text"
              placeholder="Företagsnamn eller org.nr..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
          </div>
        </div>
      </div>

      {/* Business Limits List */}
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
            Klicka på ett företag för att hantera gränser och overrides
          </p>
        </div>

        <div style={{ maxHeight: '800px', overflowY: 'auto' }}>
          {getFilteredBusinesses().map(business => (
            <div
              key={business.businessId}
              style={{
                padding: '20px',
                borderBottom: '1px solid #f1f5f9',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onClick={() => {
                setSelectedBusiness(business);
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <h4 style={{
                      fontSize: '16px',
                      fontWeight: '600',
                      color: '#1e293b',
                      margin: 0
                    }}>
                      {business.businessName}
                    </h4>
                    
                    <div style={{
                      padding: '4px 8px',
                      backgroundColor: `Tier ${business.currentTier}` === 'Tier 1' ? '#22c55e20' : 
                                        `Tier ${business.currentTier}` === 'Tier 2' ? '#3b82f620' : '#8b5cf620',
                      color: `Tier ${business.currentTier}` === 'Tier 1' ? '#22c55e' : 
                             `Tier ${business.currentTier}` === 'Tier 2' ? '#3b82f6' : '#8b5cf6',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: '500'
                    }}>
                      Tier {business.currentTier}
                    </div>
                    
                    <div style={{
                      padding: '4px 8px',
                      backgroundColor: getStatusColor(business.status) + '20',
                      color: getStatusColor(business.status),
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: '500'
                    }}>
                      {getStatusText(business.status)}
                    </div>

                    {business.overrides.filter(o => o.status === 'active').length > 0 && (
                      <div style={{
                        padding: '2px 6px',
                        backgroundColor: '#fef3c7',
                        color: '#92400e',
                        borderRadius: '8px',
                        fontSize: '10px',
                        fontWeight: '500'
                      }}>
                        🔧 {business.overrides.filter(o => o.status === 'active').length} Override(s)
                      </div>
                    )}
                  </div>
                  
                  <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '12px' }}>
                    <strong>Org.nr:</strong> {business.organizationNumber} • 
                    <strong> Senaste aktivitet:</strong> {new Date(business.lastActivity).toLocaleString('sv-SE')}
                  </div>

                  {/* Limit Usage Bars */}
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                    gap: '16px'
                  }}>
                    {Object.entries(business.limits).map(([key, limit]) => (
                      <div key={key} style={{ fontSize: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontWeight: '500', color: '#374151' }}>
                            {LIMIT_TYPES[key as keyof typeof LIMIT_TYPES].icon} {LIMIT_TYPES[key as keyof typeof LIMIT_TYPES].name}
                          </span>
                          <span style={{ color: getLimitColor(limit.percentage) }}>
                            {limit.percentage.toFixed(0)}%
                          </span>
                        </div>
                        <div style={{
                          width: '100%',
                          height: '6px',
                          backgroundColor: '#f1f5f9',
                          borderRadius: '3px',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            width: `${Math.min(limit.percentage, 100)}%`,
                            height: '100%',
                            backgroundColor: getLimitColor(limit.percentage),
                            transition: 'width 0.3s ease'
                          }} />
                        </div>
                        <div style={{ 
                          marginTop: '2px', 
                          fontSize: '10px', 
                          color: '#6b7280' 
                        }}>
                          {limit.used.toLocaleString('sv-SE')} / {limit.limit.toLocaleString('sv-SE')} {LIMIT_TYPES[key as keyof typeof LIMIT_TYPES].unit}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Recent Violations */}
                  {business.violations.length > 0 && (
                    <div style={{
                      marginTop: '12px',
                      fontSize: '11px',
                      color: '#dc2626'
                    }}>
                      ⚠️ {business.violations.length} gränsöverträdelse(r) senaste 7 dagarna
                    </div>
                  )}
                </div>

                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedBusiness(business);
                      setShowOverrideModal(true);
                    }}
                    disabled={!user.permissions.includes('limits:override')}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: user.permissions.includes('limits:override') ? '#8b5cf6' : '#d1d5db',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '11px',
                      cursor: user.permissions.includes('limits:override') ? 'pointer' : 'not-allowed',
                      fontWeight: '500'
                    }}
                  >
                    🔧 Override
                  </button>
                  
                  {business.violations.length > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedBusiness(business);
                        setShowViolationsModal(true);
                      }}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '11px',
                        cursor: 'pointer',
                        fontWeight: '500'
                      }}
                    >
                      ⚠️ Violations
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
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

      {/* Limit Override Modal */}
      {showOverrideModal && selectedBusiness && (
        <LimitOverrideModal
          business={selectedBusiness}
          onSave={handleLimitOverride}
          onCancel={() => {
            setShowOverrideModal(false);
            setSelectedBusiness(null);
          }}
          hasOverridePermission={user.permissions.includes('limits:override')}
        />
      )}

      {/* Violations Modal */}
      {showViolationsModal && selectedBusiness && (
        <ViolationsModal
          business={selectedBusiness}
          onClose={() => {
            setShowViolationsModal(false);
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

// Limit Override Modal Component
interface LimitOverrideModalProps {
  business: BusinessLimit;
  onSave: (data: LimitAdjustmentRequest) => void;
  onCancel: () => void;
  hasOverridePermission: boolean;
}

function LimitOverrideModal({ business, onSave, onCancel, hasOverridePermission }: LimitOverrideModalProps) {
  const [limitType, setLimitType] = useState<'daily_payout' | 'monthly_transactions' | 'customer_volume'>('daily_payout');
  const [newLimit, setNewLimit] = useState<number>(0);
  const [reason, setReason] = useState('');
  const [duration, setDuration] = useState<'temporary' | 'permanent'>('temporary');
  const [expirationDate, setExpirationDate] = useState(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 7 days from now
  );
  const [isEmergency, setIsEmergency] = useState(false);

  useEffect(() => {
    // Set initial new limit to current limit + 20%
    const currentLimit = business.limits[limitType].limit;
    setNewLimit(Math.round(currentLimit * 1.2));
  }, [limitType, business.limits]);

  const currentLimit = business.limits[limitType];
  const limitInfo = LIMIT_TYPES[limitType];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!reason.trim()) {
      alert('Anledning för override krävs');
      return;
    }

    if (newLimit <= currentLimit.limit) {
      alert('Ny gräns måste vara högre än nuvarande gräns');
      return;
    }

    onSave({
      businessId: business.businessId,
      type: limitType,
      newLimit,
      reason: reason.trim(),
      duration,
      expirationDate: duration === 'temporary' ? expirationDate : undefined,
      isEmergency
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
          Gräns-override för {business.businessName}
        </h3>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ 
              display: 'block', 
              fontSize: '14px', 
              fontWeight: '500', 
              marginBottom: '4px'
            }}>
              Gränstyp:
            </label>
            <select
              value={limitType}
              onChange={(e) => setLimitType(e.target.value as any)}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #d1d5db',
                borderRadius: '6px'
              }}
            >
              {Object.entries(LIMIT_TYPES).map(([key, info]) => (
                <option key={key} value={key}>
                  {info.icon} {info.name}
                </option>
              ))}
            </select>
          </div>

          {/* Current vs New Limit Display */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px',
            marginBottom: '20px'
          }}>
            <div style={{
              padding: '16px',
              border: '2px solid #ef4444',
              borderRadius: '8px',
              backgroundColor: '#fef2f2'
            }}>
              <h4 style={{ 
                color: '#dc2626',
                fontSize: '14px',
                fontWeight: '600',
                marginBottom: '8px'
              }}>
                Nuvarande Gräns
              </h4>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#dc2626' }}>
                {currentLimit.limit.toLocaleString('sv-SE')} {limitInfo.unit}
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                Använt: {currentLimit.used.toLocaleString('sv-SE')} ({currentLimit.percentage.toFixed(0)}%)
              </div>
            </div>

            <div style={{
              padding: '16px',
              border: '2px solid #22c55e',
              borderRadius: '8px',
              backgroundColor: '#f0fdf4'
            }}>
              <h4 style={{ 
                color: '#16a34a',
                fontSize: '14px',
                fontWeight: '600',
                marginBottom: '8px'
              }}>
                Ny Gräns (Override)
              </h4>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#16a34a' }}>
                {newLimit.toLocaleString('sv-SE')} {limitInfo.unit}
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                Ökning: +{((newLimit - currentLimit.limit) / currentLimit.limit * 100).toFixed(0)}%
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
              Ny gräns: *
            </label>
            <input
              type="number"
              value={newLimit}
              onChange={(e) => setNewLimit(parseInt(e.target.value) || 0)}
              min={currentLimit.limit + 1}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #d1d5db',
                borderRadius: '6px'
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
              Anledning för override: *
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Förklara varför denna gränsökning behövs..."
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
              Varaktighet:
            </label>
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value as 'temporary' | 'permanent')}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #d1d5db',
                borderRadius: '6px'
              }}
            >
              <option value="temporary">Tillfällig</option>
              <option value="permanent">Permanent</option>
            </select>
          </div>

          {duration === 'temporary' && (
            <div style={{ marginBottom: '16px' }}>
              <label style={{ 
                display: 'block', 
                fontSize: '14px', 
                fontWeight: '500', 
                marginBottom: '4px'
              }}>
                Utgångsdatum:
              </label>
              <input
                type="date"
                value={expirationDate}
                onChange={(e) => setExpirationDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px'
                }}
              />
            </div>
          )}

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', fontSize: '14px' }}>
              <input
                type="checkbox"
                checked={isEmergency}
                onChange={(e) => setIsEmergency(e.target.checked)}
                style={{ marginRight: '8px' }}
              />
              Akut override (hög prioritet, loggas speciellt)
            </label>
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
              disabled={!hasOverridePermission}
              style={{
                padding: '10px 16px',
                backgroundColor: hasOverridePermission ? (isEmergency ? '#ef4444' : '#8b5cf6') : '#d1d5db',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: hasOverridePermission ? 'pointer' : 'not-allowed',
                fontWeight: '500'
              }}
            >
              {isEmergency ? '🚨 Akut Override' : '🔧 Skapa Override'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Violations Modal Component
interface ViolationsModalProps {
  business: BusinessLimit;
  onClose: () => void;
}

function ViolationsModal({ business, onClose }: ViolationsModalProps) {
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
        width: '700px',
        maxHeight: '90vh',
        overflowY: 'auto'
      }}>
        <h3 style={{ 
          fontSize: '20px', 
          fontWeight: '600', 
          marginBottom: '16px',
          color: '#1e293b'
        }}>
          Gränsöverträdelser - {business.businessName}
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {business.violations.map(violation => (
            <div
              key={violation.id}
              style={{
                border: '1px solid #fca5a5',
                borderRadius: '8px',
                padding: '16px',
                backgroundColor: '#fef2f2'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#dc2626' }}>
                    {LIMIT_TYPES[violation.type].icon} {LIMIT_TYPES[violation.type].name}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>
                    {new Date(violation.timestamp).toLocaleString('sv-SE')}
                  </div>
                </div>
                
                <div style={{
                  padding: '2px 6px',
                  backgroundColor: violation.severity === 'critical' ? '#dc2626' : 
                                   violation.severity === 'major' ? '#f59e0b' : '#6b7280',
                  color: 'white',
                  borderRadius: '8px',
                  fontSize: '10px',
                  fontWeight: '500'
                }}>
                  {violation.severity.toUpperCase()}
                </div>
              </div>
              
              <div style={{ fontSize: '13px', lineHeight: '1.4' }}>
                <div>
                  <strong>Gräns:</strong> {violation.limit.toLocaleString('sv-SE')} {LIMIT_TYPES[violation.type].unit}
                </div>
                <div>
                  <strong>Försökte:</strong> {violation.attemptedAmount.toLocaleString('sv-SE')} {LIMIT_TYPES[violation.type].unit}
                </div>
                <div style={{ color: '#dc2626', fontWeight: '500' }}>
                  <strong>Överskriden med:</strong> {violation.exceedance.toLocaleString('sv-SE')} {LIMIT_TYPES[violation.type].unit} 
                  ({((violation.exceedance / violation.limit) * 100).toFixed(1)}%)
                </div>
                
                {violation.resolution && (
                  <div style={{ marginTop: '8px', padding: '8px', backgroundColor: '#f0fdf4', borderRadius: '4px' }}>
                    <div style={{ fontSize: '12px', color: '#166534' }}>
                      <strong>Löst:</strong> {violation.resolution}
                    </div>
                    {violation.resolvedAt && (
                      <div style={{ fontSize: '11px', color: '#6b7280' }}>
                        {new Date(violation.resolvedAt).toLocaleString('sv-SE')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: '20px', textAlign: 'right' }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 16px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            Stäng
          </button>
        </div>
      </div>
    </div>
  );
}