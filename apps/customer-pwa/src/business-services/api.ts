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
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    this.loadTokensFromStorage();
  }

  private loadTokensFromStorage() {
    if (typeof window !== 'undefined') {
      this.accessToken = localStorage.getItem('ai-feedback-access-token');
      this.refreshToken = localStorage.getItem('ai-feedback-refresh-token');
    }
  }

  private saveTokensToStorage(accessToken: string, refreshToken: string) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('ai-feedback-access-token', accessToken);
      localStorage.setItem('ai-feedback-refresh-token', refreshToken);
    }
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
  }

  private clearTokensFromStorage() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('ai-feedback-access-token');
      localStorage.removeItem('ai-feedback-refresh-token');
      localStorage.removeItem('ai-feedback-user');
    }
    this.accessToken = null;
    this.refreshToken = null;
  }

  private async refreshAccessToken(): Promise<boolean> {
    if (!this.refreshToken) {
      return false;
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refreshToken: this.refreshToken
        }),
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const data = await response.json();
      if (data.success) {
        this.accessToken = data.data.accessToken;
        if (typeof window !== 'undefined') {
          localStorage.setItem('ai-feedback-access-token', this.accessToken!);
        }
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Token refresh error:', error);
      this.clearTokensFromStorage();
      return false;
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    skipAuth = false
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers as Record<string, string>,
    };

    // Add Authorization header if we have a token and not skipping auth
    if (!skipAuth && this.accessToken) {
      headers.Authorization = `Bearer ${this.accessToken}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      // Handle 401 unauthorized - try to refresh token
      if (response.status === 401 && !skipAuth && this.refreshToken) {
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          // Retry the original request with new token
          return this.request(endpoint, options, skipAuth);
        } else {
          // Refresh failed, redirect to login
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
          throw new APIError(401, 'Session expired, please log in again');
        }
      }

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        let errorData;
        
        try {
          errorData = await response.json();
          errorMessage = errorData.error?.message || errorData.message || errorMessage;
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

  // Authentication methods
  async login(email: string, password: string) {
    const response = await this.request<{
      success: boolean;
      data: {
        user: any;
        accessToken: string;
        refreshToken: string;
        expiresIn: string;
      };
    }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }, true); // Skip auth for login

    if (response.success) {
      this.saveTokensToStorage(response.data.accessToken, response.data.refreshToken);
      
      // Save user info to localStorage for compatibility
      if (typeof window !== 'undefined') {
        localStorage.setItem('ai-feedback-user', JSON.stringify(response.data.user));
      }
    }

    return response;
  }

  async logout() {
    try {
      await this.request('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      // Continue with logout even if API call fails
      console.error('Logout API error:', error);
    } finally {
      this.clearTokensFromStorage();
    }
  }

  async getCurrentUser() {
    return this.request<{
      success: boolean;
      data: { user: any };
    }>('/api/auth/me');
  }

  async createBusiness(businessData: any) {
    return this.request('/api/business', {
      method: 'POST',
      body: JSON.stringify(businessData),
    }, true); // Skip auth for business creation (signup)
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