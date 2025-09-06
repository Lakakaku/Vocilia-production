class APIError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

class ApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        let errorData;
        
        try {
          errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch {
          // If response is not JSON, use status text
        }
        
        throw new APIError(response.status, errorMessage, errorData);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      
      // Network or other errors
      throw new APIError(0, `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Business endpoints
  async getDashboardData(businessId: string) {
    return this.request(`/api/business/${businessId}/dashboard`);
  }

  async getFeedback(businessId: string, params?: {
    page?: number;
    limit?: number;
    sentiment?: string;
    category?: string;
    search?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.set('page', params.page.toString());
    if (params?.limit) queryParams.set('limit', params.limit.toString());
    if (params?.sentiment && params.sentiment !== 'all') queryParams.set('sentiment', params.sentiment);
    if (params?.category && params.category !== 'all') queryParams.set('category', params.category);
    if (params?.search) queryParams.set('search', params.search);

    const query = queryParams.toString();
    return this.request(`/api/business/${businessId}/feedback/released${query ? `?${query}` : ''}`);
  }

  async getPendingFeedback(businessId: string) {
    return this.request(`/api/business/${businessId}/feedback/pending`);
  }

  async getLocations(businessId: string) {
    return this.request(`/api/business/${businessId}/locations`);
  }

  async createLocation(businessId: string, location: any) {
    return this.request(`/api/business/${businessId}/locations`, {
      method: 'POST',
      body: JSON.stringify(location),
    });
  }

  async updateLocation(businessId: string, locationId: string, location: any) {
    return this.request(`/api/business/${businessId}/locations/${locationId}`, {
      method: 'PUT',
      body: JSON.stringify(location),
    });
  }

  async deleteLocation(businessId: string, locationId: string) {
    return this.request(`/api/business/${businessId}/locations/${locationId}`, {
      method: 'DELETE',
    });
  }

  async generateQRCode(businessId: string, locationData: any) {
    return this.request(`/api/business/${businessId}/qr`, {
      method: 'POST',
      body: JSON.stringify(locationData),
    });
  }

  async getVerificationStatus(businessId: string) {
    return this.request(`/api/business/${businessId}/verification`);
  }

  async submitVerificationDocuments(businessId: string, documents: any) {
    return this.request(`/api/business/${businessId}/verification/documents`, {
      method: 'POST',
      body: JSON.stringify(documents),
    });
  }

  async submitForVerification(businessId: string) {
    return this.request(`/api/business/${businessId}/verification/submit`, {
      method: 'POST',
    });
  }

  async exportFeedback(businessId: string, format: 'csv' | 'json', filters?: any) {
    const params = { format, ...filters };
    const queryParams = new URLSearchParams(params);
    return this.request(`/api/business/${businessId}/export?${queryParams.toString()}`);
  }
}

export const apiService = new ApiService();
export { APIError };