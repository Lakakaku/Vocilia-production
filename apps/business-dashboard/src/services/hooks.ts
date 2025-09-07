import { useState, useEffect } from 'react';
import { apiService, APIError } from './api';

interface UseDataResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useBusinessData<T>(
  fetcher: () => Promise<T>,
  dependencies: any[] = []
): UseDataResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetcher();
      setData(result);
    } catch (err) {
      if (err instanceof APIError) {
        setError(`API Error (${err.status}): ${err.message}`);
      } else {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, dependencies);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
  };
}

export function useDashboardData(businessId: string) {
  return useBusinessData(
    () => apiService.getDashboardData(businessId),
    [businessId]
  );
}

export function useFeedbackData(
  businessId: string, 
  filters?: {
    page?: number;
    limit?: number;
    sentiment?: string;
    category?: string;
    search?: string;
  }
) {
  return useBusinessData(
    () => apiService.getFeedback(businessId, filters),
    [businessId, JSON.stringify(filters)]
  );
}

export function usePendingFeedback(businessId: string) {
  return useBusinessData(
    () => apiService.getPendingFeedback(businessId),
    [businessId]
  );
}

export function useLocationsData(businessId: string) {
  return useBusinessData(
    () => apiService.getLocations(businessId),
    [businessId]
  );
}

export function useVerificationStatus(businessId: string) {
  return useBusinessData(
    () => apiService.getVerificationStatus(businessId),
    [businessId]
  );
}

// Legacy mock business ID - now use BusinessContext for real business ID
export const MOCK_BUSINESS_ID = 'test-business-id';