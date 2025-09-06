import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import { authManager, getCurrentUser, getSwedishErrorMessage, AdminUser } from '../../utils/auth';

interface Business {
  id: string;
  name: string;
  orgNumber: string;
  email: string;
  phone?: string;
  status: 'pending' | 'active' | 'suspended' | 'trial';
  trialFeedbacksRemaining?: number;
  trialExpiresAt?: string;
  rewardSettings: {
    commissionRate: number;
    maxDailyRewards: number;
    rewardTiers: Record<string, any>;
  };
  createdAt: string;
  updatedAt: string;
  // Stats
  totalFeedbacks?: number;
  totalRevenue?: number;
  totalCommission?: number;
  activeLocations?: number;
}

interface BusinessFilters {
  search?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}

interface BusinessListResponse {
  success: boolean;
  data: {
    businesses: Business[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  message?: string;
}

export default function BusinessesPage() {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<BusinessFilters>({});
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });
  const [selectedBusinesses, setSelectedBusinesses] = useState<string[]>([]);
  const router = useRouter();

  useEffect(() => {
    // Check authentication
    const currentUser = getCurrentUser();
    if (!currentUser) {
      router.push('/login');
      return;
    }
    
    setUser(currentUser);
    setLoading(false);
    
    // Start token refresh timer
    authManager.startTokenRefreshTimer();
    
    // Load initial data
    loadBusinesses();
  }, [router, filters, pagination.page]);

  const loadBusinesses = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      queryParams.set('page', pagination.page.toString());
      queryParams.set('limit', pagination.limit.toString());
      
      if (filters.search) queryParams.set('search', filters.search);
      if (filters.status) queryParams.set('status', filters.status);
      if (filters.dateFrom) queryParams.set('dateFrom', filters.dateFrom);
      if (filters.dateTo) queryParams.set('dateTo', filters.dateTo);

      const response = await authManager.makeAuthenticatedRequest(
        `/api/admin/businesses?${queryParams.toString()}`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data: BusinessListResponse = await response.json();
      
      if (data.success && data.data) {
        setBusinesses(data.data.businesses);
        setPagination(prev => ({
          ...prev,
          total: data.data.total,
          totalPages: data.data.totalPages
        }));
        setError(null);
      } else {
        throw new Error(data.message || 'Misslyckades att ladda företag');
      }
    } catch (err: any) {
      console.error('Load businesses error:', err);
      
      if (err.message === 'Authentication required') {
        router.push('/login');
        return;
      }
      
      setError(getSwedishErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (businessId: string, newStatus: string) => {
    try {
      const response = await authManager.makeAuthenticatedRequest(
        `/api/admin/businesses/${businessId}/status`,
        {
          method: 'PUT',
          body: JSON.stringify({ status: newStatus })
        }
      );

      if (response.ok) {
        loadBusinesses(); // Reload data
      } else {
        throw new Error('Statusändring misslyckades');
      }
    } catch (error) {
      alert(getSwedishErrorMessage(error));
    }
  };

  const handleBulkAction = async (action: string) => {
    if (selectedBusinesses.length === 0) {
      alert('Välj företag först');
      return;
    }

    if (!confirm(`Är du säker på att du vill ${action} ${selectedBusinesses.length} företag?`)) {
      return;
    }

    try {
      const response = await authManager.makeAuthenticatedRequest(
        `/api/admin/businesses/bulk-action`,
        {
          method: 'PUT',
          body: JSON.stringify({ 
            action, 
            businessIds: selectedBusinesses 
          })
        }
      );

      if (response.ok) {
        setSelectedBusinesses([]);
        loadBusinesses(); // Reload data
      } else {
        throw new Error('Massåtgärd misslyckades');
      }
    } catch (error) {
      alert(getSwedishErrorMessage(error));
    }
  };

  const formatCurrency = (amount?: number) => {
    if (!amount) return '0 SEK';
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK'
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('sv-SE');
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
      <span className={`px-2 py-1 text-xs font-medium rounded-full border ${styles[status as keyof typeof styles]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  if (loading && businesses.length === 0) {
    return (
      <Layout>
        <div className="flex justify-center items-center min-h-[60vh]">
          <div className="text-center">
            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Laddar företag...</p>
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
            <h1 className="text-2xl font-bold text-gray-900">Företag</h1>
            <p className="text-gray-600 mt-1">Hantera alla registrerade företag på plattformen</p>
          </div>
          <div className="flex gap-3">
            {selectedBusinesses.length > 0 && (
              <div className="flex gap-2">
                <button
                  onClick={() => handleBulkAction('approve')}
                  className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
                >
                  Godkänn ({selectedBusinesses.length})
                </button>
                <button
                  onClick={() => handleBulkAction('suspend')}
                  className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
                >
                  Stäng av ({selectedBusinesses.length})
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg border mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sök
            </label>
            <input
              type="text"
              placeholder="Företagsnamn, org.nr, e-post..."
              value={filters.search || ''}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={filters.status || ''}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="">Alla statusar</option>
              <option value="pending">Väntande</option>
              <option value="active">Aktiv</option>
              <option value="suspended">Avstängd</option>
              <option value="trial">Provperiod</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Från datum
            </label>
            <input
              type="date"
              value={filters.dateFrom || ''}
              onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Till datum
            </label>
            <input
              type="date"
              value={filters.dateTo || ''}
              onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="flex justify-between items-center mt-4">
          <button
            onClick={loadBusinesses}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
          >
            Sök
          </button>
          <div className="text-sm text-gray-600">
            Visar {businesses.length} av {pagination.total} företag
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

      {/* Businesses Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedBusinesses.length === businesses.length && businesses.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedBusinesses(businesses.map(b => b.id));
                      } else {
                        setSelectedBusinesses([]);
                      }
                    }}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Företag
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statistik
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Skapad
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Åtgärder
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {businesses.map((business) => (
                <tr 
                  key={business.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => router.push(`/businesses/${business.id}`)}
                >
                  <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedBusinesses.includes(business.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedBusinesses(prev => [...prev, business.id]);
                        } else {
                          setSelectedBusinesses(prev => prev.filter(id => id !== business.id));
                        }
                      }}
                      className="rounded border-gray-300"
                    />
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {business.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {business.orgNumber} • {business.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    {getStatusBadge(business.status)}
                    {business.status === 'trial' && business.trialFeedbacksRemaining !== undefined && (
                      <div className="text-xs text-gray-500 mt-1">
                        {business.trialFeedbacksRemaining} kvar
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-sm">
                      <div className="text-gray-900">{business.totalFeedbacks || 0} feedback</div>
                      <div className="text-gray-500">{formatCurrency(business.totalRevenue)} intäkter</div>
                      <div className="text-gray-500">{business.activeLocations || 0} platser</div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-500">
                    {formatDate(business.createdAt)}
                  </td>
                  <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-2">
                      {business.status === 'pending' && (
                        <button
                          onClick={() => handleStatusChange(business.id, 'active')}
                          className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200"
                        >
                          Godkänn
                        </button>
                      )}
                      {business.status === 'active' && (
                        <button
                          onClick={() => handleStatusChange(business.id, 'suspended')}
                          className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200"
                        >
                          Stäng av
                        </button>
                      )}
                      {business.status === 'suspended' && (
                        <button
                          onClick={() => handleStatusChange(business.id, 'active')}
                          className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200"
                        >
                          Aktivera
                        </button>
                      )}
                      <button
                        onClick={() => router.push(`/businesses/${business.id}`)}
                        className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200"
                      >
                        Visa
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {businesses.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    {filters.search || filters.status ? 
                      'Inga företag matchar dina filter.' : 
                      'Inga företag registrerade ännu.'
                    }
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="bg-white px-4 py-3 border-t sm:px-6">
            <div className="flex items-center justify-between">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                  disabled={pagination.page <= 1}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  Föregående
                </button>
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.totalPages, prev.page + 1) }))}
                  disabled={pagination.page >= pagination.totalPages}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  Nästa
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Visar{' '}
                    <span className="font-medium">{((pagination.page - 1) * pagination.limit) + 1}</span>
                    {' '}-{' '}
                    <span className="font-medium">
                      {Math.min(pagination.page * pagination.limit, pagination.total)}
                    </span>
                    {' '}av{' '}
                    <span className="font-medium">{pagination.total}</span> företag
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                    <button
                      onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                      disabled={pagination.page <= 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Föregående
                    </button>
                    
                    {/* Page numbers */}
                    {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                      const pageNum = pagination.page - 2 + i;
                      if (pageNum < 1 || pageNum > pagination.totalPages) return null;
                      
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setPagination(prev => ({ ...prev, page: pageNum }))}
                          className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                            pageNum === pagination.page
                              ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                              : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    
                    <button
                      onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.totalPages, prev.page + 1) }))}
                      disabled={pagination.page >= pagination.totalPages}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Nästa
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}