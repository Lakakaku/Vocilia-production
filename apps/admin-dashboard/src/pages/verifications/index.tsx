import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import { authManager, getCurrentUser, getSwedishErrorMessage, AdminUser } from '../../utils/auth';

interface VerificationBatch {
  id: string;
  businessId: string;
  businessName: string;
  billingMonth: string;
  status: 'collecting' | 'review_period' | 'payment_processing' | 'completed';
  totalVerifications: number;
  approvedVerifications: number;
  rejectedVerifications: number;
  pendingVerifications: number;
  totalCustomerPayments: number;
  totalCommission: number;
  totalStoreCost: number;
  reviewDeadline: string;
  paymentDueDate: string;
  createdAt: string;
  completedAt?: string;
}

interface SimpleVerification {
  id: string;
  sessionId: string;
  businessId: string;
  businessName: string;
  storeCode: string;
  purchaseTime: string;
  purchaseAmount: number;
  customerPhone: string;
  reviewStatus: 'pending' | 'approved' | 'rejected' | 'auto_approved';
  reviewedAt?: string;
  reviewedBy?: string;
  rejectionReason?: string;
  paymentAmount: number;
  commissionAmount: number;
  storeCost: number;
  fraudScore: number;
  fraudFlags: string[];
  qualityScore?: number;
  submittedAt: string;
}

interface VerificationFilters {
  status?: string;
  businessId?: string;
  dateFrom?: string;
  dateTo?: string;
  fraudRisk?: string;
}

export default function VerificationsPage() {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [verificationBatches, setVerificationBatches] = useState<VerificationBatch[]>([]);
  const [simpleVerifications, setSimpleVerifications] = useState<SimpleVerification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('batches');
  const [filters, setFilters] = useState<VerificationFilters>({});
  const [selectedVerifications, setSelectedVerifications] = useState<string[]>([]);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Check authentication
    const currentUser = getCurrentUser();
    if (!currentUser) {
      router.push('/login');
      return;
    }
    
    setUser(currentUser);
    
    // Start token refresh timer
    authManager.startTokenRefreshTimer();
    
    // Load initial data
    loadData();
  }, [router, filters]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [batchesResponse, verificationsResponse] = await Promise.all([
        authManager.makeAuthenticatedRequest('/api/admin/verification-batches'),
        authManager.makeAuthenticatedRequest('/api/admin/simple-verifications?' + new URLSearchParams({
          status: filters.status || '',
          businessId: filters.businessId || '',
          fraudRisk: filters.fraudRisk || '',
          limit: '50'
        }))
      ]);
      
      const batchesData = await batchesResponse.json();
      const verificationsData = await verificationsResponse.json();
      
      if (batchesData.success && batchesData.data) {
        setVerificationBatches(batchesData.data);
      }
      
      if (verificationsData.success && verificationsData.data) {
        setSimpleVerifications(verificationsData.data);
      }
      
      setError(null);
    } catch (err: any) {
      console.error('Load verification data error:', err);
      
      if (err.message === 'Authentication required') {
        router.push('/login');
        return;
      }
      
      setError(getSwedishErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleBulkAction = async (action: 'approve' | 'reject', rejectionReason?: string) => {
    if (selectedVerifications.length === 0) {
      alert('Välj verifieringar först');
      return;
    }

    const confirmMessage = action === 'approve' 
      ? `Godkänn ${selectedVerifications.length} verifieringar?`
      : `Avslå ${selectedVerifications.length} verifieringar?`;

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      const response = await authManager.makeAuthenticatedRequest(
        `/api/admin/simple-verifications/bulk-action`,
        {
          method: 'PUT',
          body: JSON.stringify({ 
            action, 
            verificationIds: selectedVerifications,
            rejectionReason: action === 'reject' ? rejectionReason : undefined
          })
        }
      );

      if (response.ok) {
        setSelectedVerifications([]);
        setShowBulkActions(false);
        await loadData(); // Reload data
      } else {
        throw new Error('Massåtgärd misslyckades');
      }
    } catch (error) {
      alert(getSwedishErrorMessage(error));
    }
  };

  const handleProcessDeadline = async (batchId: string) => {
    if (!confirm('Processa deadline för denna batch? Detta kommer att auto-godkänna väntande verifieringar.')) {
      return;
    }

    try {
      const response = await authManager.makeAuthenticatedRequest(
        `/api/admin/verification-batches/${batchId}/process-deadline`,
        { method: 'POST' }
      );

      if (response.ok) {
        await loadData(); // Reload data
      } else {
        throw new Error('Deadline-processering misslyckades');
      }
    } catch (error) {
      alert(getSwedishErrorMessage(error));
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK'
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('sv-SE');
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('sv-SE');
  };

  const getStatusBadge = (status: string, type: 'batch' | 'verification' = 'batch') => {
    if (type === 'batch') {
      const styles = {
        collecting: 'bg-blue-100 text-blue-800 border-blue-200',
        review_period: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        payment_processing: 'bg-purple-100 text-purple-800 border-purple-200',
        completed: 'bg-green-100 text-green-800 border-green-200'
      };

      const labels = {
        collecting: 'Samlar in',
        review_period: 'Granskningsperiod',
        payment_processing: 'Betalning pågår',
        completed: 'Slutförd'
      };

      return (
        <span className={`px-2 py-1 text-xs font-medium rounded-full border ${styles[status as keyof typeof styles]}`}>
          {labels[status as keyof typeof labels]}
        </span>
      );
    } else {
      const styles = {
        pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        approved: 'bg-green-100 text-green-800 border-green-200',
        rejected: 'bg-red-100 text-red-800 border-red-200',
        auto_approved: 'bg-blue-100 text-blue-800 border-blue-200'
      };

      const labels = {
        pending: 'Väntande',
        approved: 'Godkänd',
        rejected: 'Avslagen',
        auto_approved: 'Auto-godkänd'
      };

      return (
        <span className={`px-2 py-1 text-xs font-medium rounded-full border ${styles[status as keyof typeof styles]}`}>
          {labels[status as keyof typeof labels]}
        </span>
      );
    }
  };

  const getRiskBadge = (fraudScore: number) => {
    if (fraudScore >= 0.7) {
      return <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">Hög risk</span>;
    } else if (fraudScore >= 0.3) {
      return <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">Medel risk</span>;
    } else {
      return <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">Låg risk</span>;
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center min-h-[60vh]">
          <div className="text-center">
            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Laddar verifieringsdata...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!user) {
    return null; // Will redirect to login
  }

  return (
    <Layout>
      {/* Page Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Verifieringshantering</h1>
            <p className="text-gray-600 mt-1">Hantera månadsvis verifieringar och batch-processer</p>
          </div>
          <div className="flex gap-3">
            {selectedVerifications.length > 0 && (
              <div className="flex gap-2">
                <button
                  onClick={() => setShowBulkActions(true)}
                  className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                >
                  Massåtgärd ({selectedVerifications.length})
                </button>
              </div>
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
            { id: 'batches', name: 'Batch-översikt' },
            { id: 'verifications', name: 'Individuella verifieringar' },
            { id: 'analytics', name: 'Analytik' }
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
      {activeTab === 'batches' && (
        <div className="bg-white rounded-lg border overflow-hidden">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold">Verifieringsbatcher</h3>
            <p className="text-sm text-gray-600 mt-1">
              Månadsvis batchar för företags verifieringsprocesser
            </p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Företag
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Månad
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Verifieringar
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Värde
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Deadline
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Åtgärder
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {verificationBatches.map((batch) => (
                  <tr key={batch.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <div className="font-medium text-gray-900">{batch.businessName}</div>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900">
                      {new Date(batch.billingMonth).toLocaleDateString('sv-SE', { year: 'numeric', month: 'long' })}
                    </td>
                    <td className="px-4 py-4">
                      {getStatusBadge(batch.status, 'batch')}
                    </td>
                    <td className="px-4 py-4 text-sm">
                      <div className="space-y-1">
                        <div>Totalt: {batch.totalVerifications}</div>
                        <div className="flex gap-4 text-xs">
                          <span className="text-green-600">✓ {batch.approvedVerifications}</span>
                          <span className="text-red-600">✗ {batch.rejectedVerifications}</span>
                          <span className="text-yellow-600">⏳ {batch.pendingVerifications}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm">
                      <div className="space-y-1">
                        <div>Kund: {formatCurrency(batch.totalCustomerPayments)}</div>
                        <div className="text-gray-500">Provision: {formatCurrency(batch.totalCommission)}</div>
                        <div className="font-medium">Totalt: {formatCurrency(batch.totalStoreCost)}</div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm">
                      <div className="space-y-1">
                        <div>Granskning: {formatDate(batch.reviewDeadline)}</div>
                        <div className="text-gray-500">Betalning: {formatDate(batch.paymentDueDate)}</div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => router.push(`/verifications/batch/${batch.id}`)}
                          className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200"
                        >
                          Visa detaljer
                        </button>
                        {batch.status === 'review_period' && (
                          <button
                            onClick={() => handleProcessDeadline(batch.id)}
                            className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs hover:bg-yellow-200"
                          >
                            Processa deadline
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {verificationBatches.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      Inga verifieringsbatcher att visa
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'verifications' && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="bg-white p-4 rounded-lg border">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={filters.status || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                >
                  <option value="">Alla statusar</option>
                  <option value="pending">Väntande</option>
                  <option value="approved">Godkända</option>
                  <option value="rejected">Avslagna</option>
                  <option value="auto_approved">Auto-godkända</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bedrägeri-risk</label>
                <select
                  value={filters.fraudRisk || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, fraudRisk: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                >
                  <option value="">All risk</option>
                  <option value="high">Hög risk (≥0.7)</option>
                  <option value="medium">Medel risk (0.3-0.7)</option>
                  <option value="low">Låg risk (<0.3)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Från datum</label>
                <input
                  type="date"
                  value={filters.dateFrom || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Till datum</label>
                <input
                  type="date"
                  value={filters.dateTo || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Verifications Table */}
          <div className="bg-white rounded-lg border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedVerifications.length === simpleVerifications.length && simpleVerifications.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedVerifications(simpleVerifications.map(v => v.id));
                          } else {
                            setSelectedVerifications([]);
                          }
                        }}
                        className="rounded border-gray-300"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Företag
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Kund
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Köp
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Risk
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Belöning
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Åtgärder
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {simpleVerifications.map((verification) => (
                    <tr key={verification.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          checked={selectedVerifications.includes(verification.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedVerifications(prev => [...prev, verification.id]);
                            } else {
                              setSelectedVerifications(prev => prev.filter(id => id !== verification.id));
                            }
                          }}
                          className="rounded border-gray-300"
                        />
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm font-medium text-gray-900">{verification.businessName}</div>
                        <div className="text-xs text-gray-500">Kod: {verification.storeCode}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm text-gray-900">{verification.customerPhone}</div>
                        <div className="text-xs text-gray-500">{formatDateTime(verification.submittedAt)}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm text-gray-900">{formatCurrency(verification.purchaseAmount)}</div>
                        <div className="text-xs text-gray-500">{formatDateTime(verification.purchaseTime)}</div>
                        {verification.qualityScore && (
                          <div className="text-xs text-blue-600">Kvalitet: {verification.qualityScore}/100</div>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {getStatusBadge(verification.reviewStatus, 'verification')}
                        {verification.rejectionReason && (
                          <div className="text-xs text-red-600 mt-1">{verification.rejectionReason}</div>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {getRiskBadge(verification.fraudScore)}
                        {verification.fraudFlags.length > 0 && (
                          <div className="text-xs text-gray-500 mt-1">
                            {verification.fraudFlags.join(', ')}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm text-gray-900">{formatCurrency(verification.paymentAmount)}</div>
                        <div className="text-xs text-gray-500">
                          Provision: {formatCurrency(verification.commissionAmount)}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex gap-2">
                          {verification.reviewStatus === 'pending' && (
                            <>
                              <button
                                onClick={() => handleBulkAction('approve')}
                                className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200"
                              >
                                Godkänn
                              </button>
                              <button
                                onClick={() => handleBulkAction('reject', 'Manuell granskning')}
                                className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200"
                              >
                                Avslå
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => router.push(`/verifications/verification/${verification.id}`)}
                            className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200"
                          >
                            Visa
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {simpleVerifications.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                        Inga verifieringar att visa
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-lg font-semibold mb-4">Verifieringsanalytik</h3>
          <div className="text-center py-8 text-gray-500">
            Analytik-dashboard kommer att implementeras här
          </div>
        </div>
      )}

      {/* Bulk Actions Modal */}
      {showBulkActions && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Massåtgärd</h3>
            <p className="text-sm text-gray-600 mb-4">
              {selectedVerifications.length} verifieringar valda
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => handleBulkAction('approve')}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                Godkänn alla
              </button>
              <button
                onClick={() => handleBulkAction('reject', 'Bulk avslag')}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Avslå alla
              </button>
            </div>
            
            <button
              onClick={() => setShowBulkActions(false)}
              className="w-full mt-3 px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Avbryt
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
}