import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import { authManager, getCurrentUser, getSwedishErrorMessage, AdminUser, hasPermission } from '../../utils/auth';

interface Business {
  id: string;
  name: string;
  orgNumber: string;
  email: string;
  phone?: string;
  address?: {
    street: string;
    city: string;
    postalCode: string;
    country: string;
  };
  status: 'pending' | 'active' | 'suspended' | 'trial';
  trialFeedbacksRemaining?: number;
  trialExpiresAt?: string;
  rewardSettings: {
    commissionRate: number;
    maxDailyRewards: number;
    rewardTiers: {
      exceptional: { min: number; max: number; reward: [number, number] };
      very_good: { min: number; max: number; reward: [number, number] };
      acceptable: { min: number; max: number; reward: [number, number] };
      insufficient: { min: number; max: number; reward: [number, number] };
    };
  };
  simpleVerificationSettings?: {
    enabled: boolean;
    verificationTolerance: {
      timeMinutes: number;
      amountSek: number;
    };
    reviewPeriodDays: number;
    autoApproveThreshold: number;
    dailyLimits: {
      maxPerPhone: number;
      maxPerIp: number;
    };
  };
  stripeAccountId?: string;
  stripeOnboardingComplete: boolean;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  approvedBy?: string;
}

interface BusinessStats {
  totalFeedbacks: number;
  totalRevenue: number;
  totalCommission: number;
  averageQualityScore: number;
  activeLocations: number;
  pendingVerifications: number;
  monthlyStats: {
    feedbacks: number;
    revenue: number;
    commission: number;
  };
  recentActivity: Array<{
    type: string;
    description: string;
    timestamp: string;
  }>;
}

interface BusinessLocation {
  id: string;
  name: string;
  address?: string;
  qrCodeUrl: string;
  qrCodeExpiresAt: string;
  active: boolean;
  createdAt: string;
}

export default function BusinessDetailPage() {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [stats, setStats] = useState<BusinessStats | null>(null);
  const [locations, setLocations] = useState<BusinessLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [editingSettings, setEditingSettings] = useState(false);
  const [rewardSettings, setRewardSettings] = useState<any>(null);
  const router = useRouter();
  const { id } = router.query;

  useEffect(() => {
    // Check authentication
    const currentUser = getCurrentUser();
    if (!currentUser) {
      router.push('/login');
      return;
    }
    
    setUser(currentUser);
    
    if (id) {
      loadBusinessData();
    }
  }, [router, id]);

  const loadBusinessData = async () => {
    setLoading(true);
    try {
      const [businessResponse, statsResponse, locationsResponse] = await Promise.all([
        authManager.makeAuthenticatedRequest(`/api/admin/businesses/${id}`),
        authManager.makeAuthenticatedRequest(`/api/admin/businesses/${id}/stats`),
        authManager.makeAuthenticatedRequest(`/api/admin/businesses/${id}/locations`)
      ]);
      
      const businessData = await businessResponse.json();
      const statsData = await statsResponse.json();
      const locationsData = await locationsResponse.json();
      
      if (businessData.success && businessData.data) {
        setBusiness(businessData.data);
        setRewardSettings(businessData.data.rewardSettings);
      }
      
      if (statsData.success && statsData.data) {
        setStats(statsData.data);
      }
      
      if (locationsData.success && locationsData.data) {
        setLocations(locationsData.data);
      }
      
      setError(null);
    } catch (err: any) {
      console.error('Load business data error:', err);
      
      if (err.message === 'Authentication required') {
        router.push('/login');
        return;
      }
      
      setError(getSwedishErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!confirm(`Är du säker på att du vill ändra status till "${newStatus}"?`)) {
      return;
    }

    setSaving(true);
    try {
      const response = await authManager.makeAuthenticatedRequest(
        `/api/admin/businesses/${id}/status`,
        {
          method: 'PUT',
          body: JSON.stringify({ status: newStatus })
        }
      );

      if (response.ok) {
        await loadBusinessData(); // Reload data
      } else {
        throw new Error('Statusändring misslyckades');
      }
    } catch (error) {
      alert(getSwedishErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRewardSettings = async () => {
    if (!rewardSettings) return;

    setSaving(true);
    try {
      const response = await authManager.makeAuthenticatedRequest(
        `/api/admin/businesses/${id}/reward-settings`,
        {
          method: 'PUT',
          body: JSON.stringify({ rewardSettings })
        }
      );

      if (response.ok) {
        setEditingSettings(false);
        await loadBusinessData(); // Reload data
      } else {
        throw new Error('Inställningar kunde inte sparas');
      }
    } catch (error) {
      alert(getSwedishErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK'
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('sv-SE');
  };

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      active: 'bg-green-100 text-green-800 border-green-200',
      suspended: 'bg-red-100 text-red-800 border-red-200',
      trial: 'bg-blue-100 text-blue-800 border-blue-200'
    };

    const labels = {
      pending: 'Väntande',
      active: 'Aktiv',
      suspended: 'Avstängd',
      trial: 'Provperiod'
    };

    return (
      <span className={`px-3 py-1 text-sm font-medium rounded-full border ${styles[status as keyof typeof styles]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center min-h-[60vh]">
          <div className="text-center">
            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Laddar företagsdata...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!user) {
    return null; // Will redirect to login
  }

  if (!business) {
    return (
      <Layout>
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold text-gray-900">Företag hittades inte</h2>
          <p className="text-gray-600 mt-2">Det begärda företaget kunde inte hittas.</p>
          <button
            onClick={() => router.push('/businesses')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Tillbaka till företagslistan
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => router.push('/businesses')}
            className="text-blue-600 hover:text-blue-800"
          >
            ← Tillbaka till företag
          </button>
        </div>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{business.name}</h1>
            <div className="flex items-center gap-4 mt-2">
              {getStatusBadge(business.status)}
              <span className="text-gray-500">{business.orgNumber}</span>
              <span className="text-gray-500">{business.email}</span>
            </div>
          </div>
          <div className="flex gap-3">
            {hasPermission('business:write') && (
              <>
                {business.status === 'pending' && (
                  <button
                    onClick={() => handleStatusChange('active')}
                    disabled={saving}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                  >
                    Godkänn
                  </button>
                )}
                {business.status === 'active' && (
                  <button
                    onClick={() => handleStatusChange('suspended')}
                    disabled={saving}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                  >
                    Stäng av
                  </button>
                )}
                {business.status === 'suspended' && (
                  <button
                    onClick={() => handleStatusChange('active')}
                    disabled={saving}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                  >
                    Aktivera
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
          <div className="text-red-800 font-medium">Fel</div>
          <div className="text-red-700 text-sm mt-1">{error}</div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', name: 'Översikt' },
            { id: 'settings', name: 'Inställningar' },
            { id: 'locations', name: 'Platser' },
            { id: 'verifications', name: 'Verifieringar' },
            { id: 'activity', name: 'Aktivitet' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Business Info */}
          <div className="bg-white rounded-lg border p-6">
            <h3 className="text-lg font-semibold mb-4">Företagsinformation</h3>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm font-medium text-gray-500">Organisationsnummer</dt>
                <dd className="text-sm text-gray-900">{business.orgNumber}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">E-post</dt>
                <dd className="text-sm text-gray-900">{business.email}</dd>
              </div>
              {business.phone && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Telefon</dt>
                  <dd className="text-sm text-gray-900">{business.phone}</dd>
                </div>
              )}
              {business.address && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Adress</dt>
                  <dd className="text-sm text-gray-900">
                    {business.address.street}<br />
                    {business.address.postalCode} {business.address.city}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-sm font-medium text-gray-500">Registrerad</dt>
                <dd className="text-sm text-gray-900">{formatDate(business.createdAt)}</dd>
              </div>
              {business.approvedAt && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Godkänd</dt>
                  <dd className="text-sm text-gray-900">{formatDate(business.approvedAt)}</dd>
                </div>
              )}
              {business.status === 'trial' && business.trialExpiresAt && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Provperiod slutar</dt>
                  <dd className="text-sm text-gray-900">{formatDate(business.trialExpiresAt)}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Statistics */}
          {stats && (
            <div className="bg-white rounded-lg border p-6">
              <h3 className="text-lg font-semibold mb-4">Statistik</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-blue-600">{stats.totalFeedbacks}</div>
                  <div className="text-sm text-blue-600">Totala feedback</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalRevenue)}</div>
                  <div className="text-sm text-green-600">Total intäkt</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-purple-600">{formatCurrency(stats.totalCommission)}</div>
                  <div className="text-sm text-purple-600">Total provision</div>
                </div>
                <div className="bg-yellow-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-yellow-600">{stats.averageQualityScore.toFixed(1)}</div>
                  <div className="text-sm text-yellow-600">Snitt kvalitet</div>
                </div>
              </div>
              
              <div className="mt-6">
                <h4 className="text-md font-medium mb-3">Denna månad</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Feedback:</span>
                    <span className="text-sm font-medium">{stats.monthlyStats.feedbacks}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Intäkt:</span>
                    <span className="text-sm font-medium">{formatCurrency(stats.monthlyStats.revenue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Provision:</span>
                    <span className="text-sm font-medium">{formatCurrency(stats.monthlyStats.commission)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="space-y-6">
          {/* Reward Settings */}
          <div className="bg-white rounded-lg border p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Belöningsinställningar</h3>
              {hasPermission('business:write') && (
                <div className="flex gap-2">
                  {editingSettings ? (
                    <>
                      <button
                        onClick={() => {
                          setEditingSettings(false);
                          setRewardSettings(business.rewardSettings);
                        }}
                        className="px-3 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                      >
                        Avbryt
                      </button>
                      <button
                        onClick={handleSaveRewardSettings}
                        disabled={saving}
                        className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                      >
                        Spara
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setEditingSettings(true)}
                      className="px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                    >
                      Redigera
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Commission Rate */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Provisionsgrad
                </label>
                {editingSettings ? (
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    value={rewardSettings?.commissionRate || 0}
                    onChange={(e) => setRewardSettings(prev => ({
                      ...prev,
                      commissionRate: parseFloat(e.target.value)
                    }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                ) : (
                  <div className="text-lg font-semibold text-gray-900">
                    {formatPercentage(business.rewardSettings.commissionRate)}
                  </div>
                )}
              </div>

              {/* Max Daily Rewards */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max dagliga belöningar (SEK)
                </label>
                {editingSettings ? (
                  <input
                    type="number"
                    min="0"
                    value={rewardSettings?.maxDailyRewards || 0}
                    onChange={(e) => setRewardSettings(prev => ({
                      ...prev,
                      maxDailyRewards: parseInt(e.target.value)
                    }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                ) : (
                  <div className="text-lg font-semibold text-gray-900">
                    {formatCurrency(business.rewardSettings.maxDailyRewards)}
                  </div>
                )}
              </div>
            </div>

            {/* Reward Tiers */}
            <div className="mt-6">
              <h4 className="text-md font-medium mb-4">Belöningsnivåer</h4>
              <div className="space-y-4">
                {Object.entries(business.rewardSettings.rewardTiers).map(([tier, settings]: [string, any]) => (
                  <div key={tier} className="border rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <h5 className="font-medium text-gray-900 capitalize">
                        {tier === 'exceptional' ? 'Exceptionell' : 
                         tier === 'very_good' ? 'Mycket bra' :
                         tier === 'acceptable' ? 'Acceptabel' : 'Otillräcklig'}
                      </h5>
                      <div className="text-sm text-gray-500">
                        {settings.min}-{settings.max} poäng
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Min belöning</label>
                        {editingSettings ? (
                          <input
                            type="number"
                            min="0"
                            max="1"
                            step="0.001"
                            value={rewardSettings?.rewardTiers?.[tier]?.reward?.[0] || 0}
                            onChange={(e) => setRewardSettings(prev => ({
                              ...prev,
                              rewardTiers: {
                                ...prev.rewardTiers,
                                [tier]: {
                                  ...prev.rewardTiers[tier],
                                  reward: [parseFloat(e.target.value), prev.rewardTiers[tier].reward[1]]
                                }
                              }
                            }))}
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                          />
                        ) : (
                          <div className="text-sm font-medium">
                            {formatPercentage(settings.reward[0])}
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Max belöning</label>
                        {editingSettings ? (
                          <input
                            type="number"
                            min="0"
                            max="1"
                            step="0.001"
                            value={rewardSettings?.rewardTiers?.[tier]?.reward?.[1] || 0}
                            onChange={(e) => setRewardSettings(prev => ({
                              ...prev,
                              rewardTiers: {
                                ...prev.rewardTiers,
                                [tier]: {
                                  ...prev.rewardTiers[tier],
                                  reward: [prev.rewardTiers[tier].reward[0], parseFloat(e.target.value)]
                                }
                              }
                            }))}
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                          />
                        ) : (
                          <div className="text-sm font-medium">
                            {formatPercentage(settings.reward[1])}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Simple Verification Settings */}
          {business.simpleVerificationSettings && (
            <div className="bg-white rounded-lg border p-6">
              <h3 className="text-lg font-semibold mb-4">Enkel verifiering</h3>
              <div className="space-y-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={business.simpleVerificationSettings.enabled}
                    className="rounded border-gray-300"
                    readOnly
                  />
                  <label className="ml-2 text-sm text-gray-700">Aktiverad</label>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tidstolerans (minuter)
                    </label>
                    <div className="text-sm text-gray-900">
                      ±{business.simpleVerificationSettings.verificationTolerance.timeMinutes}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Beloppstolerans (SEK)
                    </label>
                    <div className="text-sm text-gray-900">
                      ±{business.simpleVerificationSettings.verificationTolerance.amountSek}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Granskningsperiod (dagar)
                    </label>
                    <div className="text-sm text-gray-900">
                      {business.simpleVerificationSettings.reviewPeriodDays}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Auto-godkännande tröskel
                    </label>
                    <div className="text-sm text-gray-900">
                      {business.simpleVerificationSettings.autoApproveThreshold}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'locations' && (
        <div className="bg-white rounded-lg border">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold">Platser</h3>
            <p className="text-sm text-gray-600 mt-1">
              QR-koder och platser för detta företag
            </p>
          </div>
          <div className="divide-y divide-gray-200">
            {locations.map((location) => (
              <div key={location.id} className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium text-gray-900">{location.name}</h4>
                    {location.address && (
                      <p className="text-sm text-gray-600 mt-1">{location.address}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        location.active 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {location.active ? 'Aktiv' : 'Inaktiv'}
                      </span>
                      <span className="text-xs text-gray-500">
                        Skapad: {formatDate(location.createdAt)}
                      </span>
                      <span className="text-xs text-gray-500">
                        QR slutar: {formatDate(location.qrCodeExpiresAt)}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="px-3 py-1 text-blue-600 border border-blue-300 rounded text-sm hover:bg-blue-50">
                      Visa QR
                    </button>
                    {hasPermission('business:write') && (
                      <button className="px-3 py-1 text-gray-600 border border-gray-300 rounded text-sm hover:bg-gray-50">
                        Redigera
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {locations.length === 0 && (
              <div className="p-6 text-center text-gray-500">
                Inga platser registrerade ännu
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'verifications' && (
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-lg font-semibold mb-4">Väntande verifieringar</h3>
          <div className="text-center py-8 text-gray-500">
            Verifieringshantering kommer att implementeras här
          </div>
        </div>
      )}

      {activeTab === 'activity' && (
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-lg font-semibold mb-4">Senaste aktivitet</h3>
          {stats && stats.recentActivity.length > 0 ? (
            <div className="space-y-4">
              {stats.recentActivity.map((activity, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-blue-600 rounded-full mt-2" />
                  <div>
                    <div className="text-sm text-gray-900">{activity.description}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {formatDate(activity.timestamp)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              Ingen aktivitet att visa
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}