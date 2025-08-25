import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

type BanType = 'permanent' | 'temporary';
type BanSeverity = 'low' | 'medium' | 'high' | 'critical';
type AppealStatus = 'none' | 'pending' | 'approved' | 'rejected';
type TargetType = 'business' | 'customer';

interface Ban {
  id: string;
  type: TargetType;
  targetId: string;
  targetName: string;
  banType: BanType;
  severity: BanSeverity;
  reason: string;
  reasonLabel: string;
  description: string;
  bannedAt: string;
  bannedBy: string;
  adminName: string;
  evidenceIds: string[];
  swedishLegalBasis: string[];
  automaticTrigger: boolean;
  appealStatus: AppealStatus;
  appealSubmittedAt?: string;
  appealReason?: string;
  banExpiresAt?: string;
  estimatedLoss: number;
  affectedTransactions: number;
}

interface BanReason {
  id: string;
  code: string;
  label: string;
  category: BanReasonCategory;
  subcategory: string;
  severity: BanSeverity;
  swedishLegalBasis: string[];
  euRegulations: string[];
  recommendedAction: string;
  description: string;
  documentationRequired: string[];
  automationRules?: BanAutomationRule[];
  historicalUsage: {
    totalUses: number;
    successRate: number;
    appealOverrideRate: number;
  };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

type BanReasonCategory = 
  | 'fraud_financial' 
  | 'fraud_identity' 
  | 'fraud_technical'
  | 'abuse_platform'
  | 'abuse_staff'
  | 'legal_violation'
  | 'gdpr_violation'
  | 'contract_breach'
  | 'regulatory_compliance';

interface BanAutomationRule {
  id: string;
  condition: string;
  threshold: number;
  timeWindow: string; // e.g., "24h", "7d", "30d"
  autoExecute: boolean;
  requiredApproval: boolean;
  approverRoles: string[];
}

interface BanStatistics {
  totalActiveBans: number;
  businessBans: number;
  customerBans: number;
  permanentBans: number;
  temporaryBans: number;
  pendingAppeals: number;
  totalEstimatedLossPrevented: number;
  bansThisMonth: number;
  successfulAppeals: number;
  rejectedAppeals: number;
  averageAppealProcessingTime: number;
}

interface RecentActivity {
  id: string;
  type: string;
  timestamp: string;
  adminId: string | null;
  adminName: string;
  description: string;
  targetType: TargetType;
  severity: BanSeverity;
}

export default function BansPage() {
  const [bans, setBans] = useState<Ban[]>([]);
  const [banReasons, setBanReasons] = useState<BanReason[]>([]);
  const [statistics, setStatistics] = useState<BanStatistics | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [selectedBan, setSelectedBan] = useState<Ban | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'appeals' | 'reasons' | 'analytics'>('active');
  const [filterType, setFilterType] = useState<TargetType | 'all'>('all');
  const [filterSeverity, setFilterSeverity] = useState<BanSeverity | 'all'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const router = useRouter();

  useEffect(() => {
    fetchBanData();
  }, []);

  const fetchBanData = async () => {
    try {
      const token = localStorage.getItem('ADMIN_TOKEN');
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/bans`, {
        headers: { 'x-admin-token': token }
      });

      if (!response.ok) {
        throw new Error('Misslyckades att hämta ban-data');
      }

      const data = await response.json();
      setBans(data.data.activeBans || []);
      setBanReasons(data.data.banReasons || []);
      setStatistics(data.data.statistics || null);
      setRecentActivity(data.data.recentActivity || []);
      setLastUpdate(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ett fel inträffade');
    } finally {
      setIsLoading(false);
    }
  };

  const getSeverityColor = (severity: BanSeverity): string => {
    switch (severity) {
      case 'critical': return '#dc2626';
      case 'high': return '#ea580c';
      case 'medium': return '#d97706';
      case 'low': return '#65a30d';
      default: return '#6b7280';
    }
  };

  const getSeverityLabel = (severity: BanSeverity): string => {
    switch (severity) {
      case 'critical': return 'Kritisk';
      case 'high': return 'Hög';
      case 'medium': return 'Medium';
      case 'low': return 'Låg';
      default: return severity;
    }
  };

  const getAppealStatusLabel = (status: AppealStatus): string => {
    switch (status) {
      case 'none': return 'Inget överklagande';
      case 'pending': return 'Väntande granskning';
      case 'approved': return 'Godkänt';
      case 'rejected': return 'Avslaget';
      default: return status;
    }
  };

  const filteredBans = bans.filter(ban => {
    const typeMatch = filterType === 'all' || ban.type === filterType;
    const severityMatch = filterSeverity === 'all' || ban.severity === filterSeverity;
    return typeMatch && severityMatch;
  });

  const pendingAppeals = bans.filter(ban => ban.appealStatus === 'pending');

  if (isLoading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <div style={{ fontSize: '18px', color: '#6b7280' }}>Laddar ban management-data...</div>
      </div>
    );
  }

  return (
    <>
      {/* CSS Animations */}
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        .pulse {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>

      <div style={{ padding: '24px', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>
                🚫 Blockering & Överklaganden
              </h1>
              <p style={{ color: '#64748b', margin: 0, fontSize: '14px' }}>
                Hantera kund- och företagsblockningar med svenskt regelefterlevnad • 
                Senast uppdaterad: {lastUpdate.toLocaleString('sv-SE')}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={fetchBanData}
                style={{
                  backgroundColor: 'white',
                  color: '#374151',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                🔄 Uppdatera
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                style={{
                  backgroundColor: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                🚫 Ny blockering
              </button>
            </div>
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

        {/* Key Statistics */}
        {statistics && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div style={{ 
              backgroundColor: 'white', 
              borderRadius: '8px', 
              padding: '20px', 
              border: '1px solid #e2e8f0',
              borderLeft: '4px solid #dc2626'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '14px', color: '#64748b' }}>Aktiva blockeringar</span>
                <span style={{ fontSize: '20px' }}>🚫</span>
              </div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#dc2626' }}>
                {statistics.totalActiveBans}
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                {statistics.businessBans} företag • {statistics.customerBans} kunder
              </div>
            </div>

            <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '20px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '14px', color: '#64748b' }}>Väntande överklaganden</span>
                <span style={{ fontSize: '20px' }}>⚖️</span>
              </div>
              <div style={{ 
                fontSize: '24px', 
                fontWeight: 'bold', 
                color: statistics.pendingAppeals > 0 ? '#ea580c' : '#16a34a',
                ...(statistics.pendingAppeals > 0 ? { animation: 'pulse 2s infinite' } : {})
              }}>
                {statistics.pendingAppeals}
              </div>
              {statistics.pendingAppeals > 0 && (
                <div style={{ fontSize: '11px', color: '#ea580c', marginTop: '4px', fontWeight: '500' }}>
                  🔔 Kräver granskning
                </div>
              )}
            </div>

            <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '20px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '14px', color: '#64748b' }}>Förhindrad förlust</span>
                <span style={{ fontSize: '20px' }}>💰</span>
              </div>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#16a34a' }}>
                {statistics.totalEstimatedLossPrevented.toLocaleString('sv-SE')} SEK
              </div>
            </div>

            <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '20px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '14px', color: '#64748b' }}>Överklaganden</span>
                <span style={{ fontSize: '20px' }}>📊</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', fontSize: '12px' }}>
                <div>
                  <div style={{ color: '#16a34a', fontWeight: 'bold' }}>
                    {statistics.successfulAppeals} godkända
                  </div>
                </div>
                <div>
                  <div style={{ color: '#dc2626', fontWeight: 'bold' }}>
                    {statistics.rejectedAppeals} avslagna
                  </div>
                </div>
                <div style={{ gridColumn: '1 / -1', color: '#6b7280' }}>
                  Avg. tid: {statistics.averageAppealProcessingTime} dagar
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div style={{ borderBottom: '1px solid #e2e8f0', marginBottom: '24px' }}>
          <nav style={{ display: 'flex', gap: '32px' }}>
            {[
              { key: 'active', label: 'Aktiva blockeringar', icon: '🚫', count: filteredBans.length },
              { key: 'appeals', label: 'Överklaganden', icon: '⚖️', count: pendingAppeals.length },
              { key: 'reasons', label: 'Ban-anledningar', icon: '📝' },
              { key: 'analytics', label: 'Analys', icon: '📊' }
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
                {tab.count !== undefined && (
                  <span style={{
                    backgroundColor: activeTab === tab.key ? '#3b82f6' : '#e5e7eb',
                    color: activeTab === tab.key ? 'white' : '#6b7280',
                    padding: '2px 6px',
                    borderRadius: '10px',
                    fontSize: '11px',
                    fontWeight: 'bold'
                  }}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'active' && (
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
                  Måltyp
                </label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as TargetType | 'all')}
                  style={{
                    padding: '6px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                >
                  <option value="all">Alla</option>
                  <option value="business">Företag</option>
                  <option value="customer">Kunder</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px', display: 'block' }}>
                  Allvarlighetsgrad
                </label>
                <select
                  value={filterSeverity}
                  onChange={(e) => setFilterSeverity(e.target.value as BanSeverity | 'all')}
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

              <div style={{ marginLeft: 'auto', fontSize: '14px', color: '#64748b' }}>
                Visar {filteredBans.length} av {bans.length} blockeringar
              </div>
            </div>

            {/* Active Bans List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {filteredBans.map((ban) => (
                <div
                  key={ban.id}
                  style={{
                    backgroundColor: 'white',
                    borderRadius: '8px',
                    padding: '20px',
                    border: '1px solid #e2e8f0',
                    borderLeft: `4px solid ${getSeverityColor(ban.severity)}`
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <span
                          style={{
                            backgroundColor: getSeverityColor(ban.severity),
                            color: 'white',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: 'bold'
                          }}
                        >
                          {getSeverityLabel(ban.severity)}
                        </span>
                        <span
                          style={{
                            backgroundColor: ban.type === 'business' ? '#dbeafe' : '#f3e8ff',
                            color: ban.type === 'business' ? '#1e40af' : '#7c3aed',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '11px'
                          }}
                        >
                          {ban.type === 'business' ? '🏢 Företag' : '👤 Kund'}
                        </span>
                        <span
                          style={{
                            backgroundColor: ban.banType === 'permanent' ? '#fef2f2' : '#fef3c7',
                            color: ban.banType === 'permanent' ? '#991b1b' : '#92400e',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '11px'
                          }}
                        >
                          {ban.banType === 'permanent' ? 'Permanent' : 'Tillfällig'}
                        </span>
                        {ban.appealStatus === 'pending' && (
                          <span
                            style={{
                              backgroundColor: '#ea580c',
                              color: 'white',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              animation: 'pulse 2s infinite'
                            }}
                          >
                            ⚖️ Överklagande väntande
                          </span>
                        )}
                      </div>

                      <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#1e293b', margin: 0, marginBottom: '4px' }}>
                        {ban.targetName}
                      </h4>
                      <p style={{ fontSize: '14px', color: '#64748b', margin: 0, marginBottom: '12px' }}>
                        <strong>{ban.reasonLabel}:</strong> {ban.description}
                      </p>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
                        <div>
                          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '2px' }}>Blockerad av</div>
                          <div style={{ fontSize: '14px', fontWeight: '500', color: '#1e293b' }}>
                            {ban.automaticTrigger ? '🤖 Automatisk' : ban.adminName}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '2px' }}>Datum</div>
                          <div style={{ fontSize: '14px', fontWeight: '500', color: '#1e293b' }}>
                            {new Date(ban.bannedAt).toLocaleDateString('sv-SE')}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '2px' }}>Uppskattat skada</div>
                          <div style={{ fontSize: '14px', fontWeight: '500', color: '#dc2626' }}>
                            {ban.estimatedLoss.toLocaleString('sv-SE')} SEK
                          </div>
                        </div>
                        {ban.banExpiresAt && (
                          <div>
                            <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '2px' }}>Upphör</div>
                            <div style={{ fontSize: '14px', fontWeight: '500', color: '#ea580c' }}>
                              {new Date(ban.banExpiresAt).toLocaleDateString('sv-SE')}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Swedish Legal Basis */}
                      {ban.swedishLegalBasis.length > 0 && (
                        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
                          <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: '500', marginBottom: '6px' }}>
                            🇸🇪 Svensk rättslig grund:
                          </div>
                          <div style={{ fontSize: '11px', color: '#475569' }}>
                            {ban.swedishLegalBasis.slice(0, 2).join(' • ')}
                            {ban.swedishLegalBasis.length > 2 && ` • +${ban.swedishLegalBasis.length - 2} mer`}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Ban Actions */}
                    <div style={{ marginLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <button
                        onClick={() => setSelectedBan(ban)}
                        style={{
                          backgroundColor: '#3b82f6',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '6px 12px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        Granska detaljer
                      </button>

                      {ban.appealStatus === 'pending' && (
                        <button
                          style={{
                            backgroundColor: '#ea580c',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '6px 12px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          Granska överklagande
                        </button>
                      )}

                      {ban.banType === 'temporary' && (
                        <button
                          style={{
                            backgroundColor: '#16a34a',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '6px 12px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          Upphäv tidigt
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'appeals' && (
          <div>
            <div style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '20px',
              marginBottom: '20px',
              border: '1px solid #e2e8f0'
            }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1e293b', margin: 0, marginBottom: '16px' }}>
                ⚖️ Väntande överklaganden
              </h3>
              {pendingAppeals.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
                  <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#1e293b', margin: 0, marginBottom: '8px' }}>
                    Inga väntande överklaganden
                  </h4>
                  <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
                    Alla överklaganden har behandlats i enlighet med svensk förvaltningsrätt.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {pendingAppeals.map((ban) => (
                    <div
                      key={`appeal-${ban.id}`}
                      style={{
                        backgroundColor: '#fef3c7',
                        borderRadius: '8px',
                        padding: '16px',
                        border: '2px solid #f59e0b',
                        position: 'relative'
                      }}
                    >
                      <div style={{
                        position: 'absolute',
                        top: '12px',
                        right: '12px',
                        backgroundColor: '#ea580c',
                        color: 'white',
                        padding: '4px 8px',
                        borderRadius: '12px',
                        fontSize: '10px',
                        fontWeight: '600',
                        textTransform: 'uppercase'
                      }}>
                        Brådskande
                      </div>

                      <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#92400e', margin: 0, marginBottom: '8px' }}>
                        Överklagande: {ban.targetName}
                      </h4>
                      <p style={{ fontSize: '14px', color: '#451a03', margin: 0, marginBottom: '12px' }}>
                        <strong>Ursprunglig anledning:</strong> {ban.reasonLabel}
                      </p>
                      
                      {ban.appealReason && (
                        <div style={{
                          backgroundColor: 'white',
                          padding: '12px',
                          borderRadius: '6px',
                          marginBottom: '12px',
                          border: '1px solid #f3e8ff'
                        }}>
                          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                            Kundens motivering:
                          </div>
                          <div style={{ fontSize: '14px', color: '#1e293b' }}>
                            "{ban.appealReason}"
                          </div>
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: '12px', color: '#6b7280' }}>
                          Inlämnat: {ban.appealSubmittedAt ? new Date(ban.appealSubmittedAt).toLocaleDateString('sv-SE') : 'Okänt'}
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            style={{
                              backgroundColor: '#16a34a',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '8px 16px',
                              cursor: 'pointer',
                              fontSize: '12px'
                            }}
                          >
                            ✅ Godkänn
                          </button>
                          <button
                            style={{
                              backgroundColor: '#dc2626',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '8px 16px',
                              cursor: 'pointer',
                              fontSize: '12px'
                            }}
                          >
                            ❌ Avslå
                          </button>
                          <button
                            style={{
                              backgroundColor: '#3b82f6',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '8px 16px',
                              cursor: 'pointer',
                              fontSize: '12px'
                            }}
                          >
                            📝 Modifiera
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'reasons' && (
          <div>
            <div style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '20px',
              marginBottom: '20px',
              border: '1px solid #e2e8f0'
            }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1e293b', margin: 0, marginBottom: '16px' }}>
                📝 Ban-anledningar & Kategorier
              </h3>
              <p style={{ fontSize: '14px', color: '#64748b', margin: 0, marginBottom: '20px' }}>
                Fördefinierade anledningar med svensk rättslig grund för konsekvent hantering av blockeringar.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '16px' }}>
              {banReasons.map((reason) => (
                <div
                  key={reason.id}
                  style={{
                    backgroundColor: 'white',
                    borderRadius: '8px',
                    padding: '20px',
                    border: '1px solid #e2e8f0',
                    borderLeft: `4px solid ${getSeverityColor(reason.severity)}`
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#1e293b', margin: 0 }}>
                      {reason.label}
                    </h4>
                    <span
                      style={{
                        backgroundColor: getSeverityColor(reason.severity),
                        color: 'white',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: 'bold'
                      }}
                    >
                      {getSeverityLabel(reason.severity)}
                    </span>
                  </div>

                  <p style={{ fontSize: '14px', color: '#64748b', margin: 0, marginBottom: '16px' }}>
                    {reason.description}
                  </p>

                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                      Rättslig grund:
                    </div>
                    <div style={{ fontSize: '14px', color: '#1e293b', fontWeight: '500' }}>
                      🇸🇪 {reason.swedishLegalBasis}
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{
                        backgroundColor: reason.recommendedAction === 'permanent' ? '#fef2f2' : '#fef3c7',
                        color: reason.recommendedAction === 'permanent' ? '#991b1b' : '#92400e',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: '500'
                      }}>
                        Rekommenderad åtgärd: {reason.recommendedAction === 'permanent' ? 'Permanent' : 'Tillfällig'}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                      Kategori: {reason.category}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div>
            <div style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '20px',
              border: '1px solid #e2e8f0'
            }}>
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1e293b', margin: 0, marginBottom: '8px' }}>
                  Ban-analys & Rapporter
                </h3>
                <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
                  Detaljerad analys av ban-effektivitet och trender - implementeras i nästa fas
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Recent Activity */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '20px',
          marginTop: '24px',
          border: '1px solid #e2e8f0'
        }}>
          <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1e293b', margin: 0, marginBottom: '16px' }}>
            🕒 Senaste aktivitet
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {recentActivity.map((activity) => (
              <div
                key={activity.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '12px',
                  backgroundColor: '#f8fafc',
                  borderRadius: '6px',
                  borderLeft: `3px solid ${getSeverityColor(activity.severity)}`
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: '#1e293b', marginBottom: '2px' }}>
                    {activity.description}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>
                    {activity.adminName} • {new Date(activity.timestamp).toLocaleDateString('sv-SE', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
                <div style={{
                  backgroundColor: activity.targetType === 'business' ? '#dbeafe' : '#f3e8ff',
                  color: activity.targetType === 'business' ? '#1e40af' : '#7c3aed',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '11px'
                }}>
                  {activity.targetType === 'business' ? '🏢' : '👤'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Ban Detail Modal */}
        {selectedBan && (
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
              maxWidth: '700px',
              width: '100%',
              maxHeight: '80vh',
              overflowY: 'auto'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>
                  Blockering-detaljer #{selectedBan.id.slice(-6)}
                </h2>
                <button
                  onClick={() => setSelectedBan(null)}
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
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                  <span
                    style={{
                      backgroundColor: getSeverityColor(selectedBan.severity),
                      color: 'white',
                      padding: '4px 12px',
                      borderRadius: '16px',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}
                  >
                    {getSeverityLabel(selectedBan.severity)}
                  </span>
                  <span
                    style={{
                      backgroundColor: selectedBan.type === 'business' ? '#dbeafe' : '#f3e8ff',
                      color: selectedBan.type === 'business' ? '#1e40af' : '#7c3aed',
                      padding: '4px 12px',
                      borderRadius: '16px',
                      fontSize: '12px'
                    }}
                  >
                    {selectedBan.type === 'business' ? '🏢 Företag' : '👤 Kund'}
                  </span>
                  <span
                    style={{
                      backgroundColor: selectedBan.banType === 'permanent' ? '#fef2f2' : '#fef3c7',
                      color: selectedBan.banType === 'permanent' ? '#991b1b' : '#92400e',
                      padding: '4px 12px',
                      borderRadius: '16px',
                      fontSize: '12px'
                    }}
                  >
                    {selectedBan.banType === 'permanent' ? 'Permanent blockering' : 'Tillfällig blockering'}
                  </span>
                </div>

                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1e293b', marginBottom: '8px' }}>
                  {selectedBan.targetName}
                </h3>
                <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '16px' }}>
                  <strong>{selectedBan.reasonLabel}:</strong> {selectedBan.description}
                </p>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b', marginBottom: '12px' }}>
                  🇸🇪 Svensk rättslig grund
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {selectedBan.swedishLegalBasis.map((basis, index) => (
                    <div
                      key={index}
                      style={{
                        backgroundColor: '#f0fdf4',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid #bbf7d0',
                        fontSize: '12px',
                        color: '#166534'
                      }}
                    >
                      {basis}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Blockerad av</div>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: '#1e293b' }}>
                    {selectedBan.automaticTrigger ? '🤖 Automatisk upptäckt' : selectedBan.adminName}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Datum & tid</div>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: '#1e293b' }}>
                    {new Date(selectedBan.bannedAt).toLocaleString('sv-SE')}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Uppskattad skada</div>
                  <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#dc2626' }}>
                    {selectedBan.estimatedLoss.toLocaleString('sv-SE')} SEK
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Påverkade transaktioner</div>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: '#1e293b' }}>
                    {selectedBan.affectedTransactions} st
                  </div>
                </div>
              </div>

              {selectedBan.banExpiresAt && (
                <div style={{
                  backgroundColor: '#fef3c7',
                  padding: '12px',
                  borderRadius: '6px',
                  marginBottom: '20px',
                  border: '1px solid #f59e0b'
                }}>
                  <div style={{ fontSize: '12px', color: '#92400e', marginBottom: '4px' }}>
                    ⏰ Tillfällig blockering upphör:
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#92400e' }}>
                    {new Date(selectedBan.banExpiresAt).toLocaleString('sv-SE')}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                {selectedBan.appealStatus === 'pending' && (
                  <button
                    style={{
                      backgroundColor: '#ea580c',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '8px 16px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    ⚖️ Granska överklagande
                  </button>
                )}
                <button
                  onClick={() => setSelectedBan(null)}
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
                  Stäng
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}