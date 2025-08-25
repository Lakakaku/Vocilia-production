// JWT Authentication utilities for admin dashboard

export interface AdminUser {
  id: string;
  email: string;
  name?: string;
  role: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthState {
  user: AdminUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

class AuthManager {
  private refreshPromise: Promise<AuthTokens> | null = null;

  // Get stored access token
  getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('admin_access_token');
  }

  // Get stored refresh token
  getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('admin_refresh_token') || 
           sessionStorage.getItem('admin_refresh_token');
  }

  // Get stored user info
  getUser(): AdminUser | null {
    if (typeof window === 'undefined') return null;
    const userStr = localStorage.getItem('admin_user');
    if (!userStr) return null;
    
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  }

  // Store authentication data
  setAuth(tokens: AuthTokens, user: AdminUser, rememberMe: boolean = false) {
    if (typeof window === 'undefined') return;
    
    localStorage.setItem('admin_access_token', tokens.accessToken);
    localStorage.setItem('admin_user', JSON.stringify(user));
    
    if (rememberMe) {
      localStorage.setItem('admin_refresh_token', tokens.refreshToken);
    } else {
      sessionStorage.setItem('admin_refresh_token', tokens.refreshToken);
    }
  }

  // Clear authentication data
  clearAuth() {
    if (typeof window === 'undefined') return;
    
    localStorage.removeItem('admin_access_token');
    localStorage.removeItem('admin_refresh_token');
    localStorage.removeItem('admin_user');
    sessionStorage.removeItem('admin_refresh_token');
    
    this.refreshPromise = null;
  }

  // Check if token is expired (basic check)
  isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Date.now() / 1000;
      return payload.exp < currentTime;
    } catch {
      return true;
    }
  }

  // Get API base URL
  private getApiUrl(): string {
    return process.env.NEXT_PUBLIC_API_URL || '';
  }

  // Make authenticated API request
  async makeAuthenticatedRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
    let accessToken = this.getAccessToken();
    
    // Try to refresh token if expired
    if (!accessToken || this.isTokenExpired(accessToken)) {
      try {
        const tokens = await this.refreshAccessToken();
        accessToken = tokens.accessToken;
      } catch (error) {
        throw new Error('Authentication required');
      }
    }

    return fetch(`${this.getApiUrl()}${endpoint}`, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  // Refresh access token using refresh token
  async refreshAccessToken(): Promise<AuthTokens> {
    // Prevent multiple simultaneous refresh requests
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    this.refreshPromise = this._performTokenRefresh(refreshToken);
    
    try {
      const tokens = await this.refreshPromise;
      this.refreshPromise = null;
      return tokens;
    } catch (error) {
      this.refreshPromise = null;
      throw error;
    }
  }

  private async _performTokenRefresh(refreshToken: string): Promise<AuthTokens> {
    const response = await fetch(`${this.getApiUrl()}/api/admin/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      throw new Error('Token refresh failed');
    }

    const data = await response.json();
    if (!data.success || !data.data) {
      throw new Error('Invalid refresh response');
    }

    // Update stored access token
    localStorage.setItem('admin_access_token', data.data.accessToken);
    
    return {
      accessToken: data.data.accessToken,
      refreshToken: data.data.refreshToken
    };
  }

  // Logout user
  async logout(): Promise<void> {
    try {
      // Call logout endpoint to invalidate session on server
      const accessToken = this.getAccessToken();
      if (accessToken) {
        await fetch(`${this.getApiUrl()}/api/admin/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });
      }
    } catch (error) {
      // Ignore logout API errors - still clear local storage
      console.warn('Logout API call failed:', error);
    } finally {
      this.clearAuth();
    }
  }

  // Check current authentication status
  getAuthState(): AuthState {
    const user = this.getUser();
    const accessToken = this.getAccessToken();
    
    return {
      user,
      isAuthenticated: !!user && !!accessToken,
      isLoading: false
    };
  }

  // Auto-refresh token before expiry
  startTokenRefreshTimer() {
    if (typeof window === 'undefined') return;

    const accessToken = this.getAccessToken();
    if (!accessToken) return;

    try {
      const payload = JSON.parse(atob(accessToken.split('.')[1]));
      const expiryTime = payload.exp * 1000;
      const currentTime = Date.now();
      const refreshTime = expiryTime - (5 * 60 * 1000); // Refresh 5 minutes before expiry
      
      const timeUntilRefresh = refreshTime - currentTime;
      
      if (timeUntilRefresh > 0) {
        setTimeout(() => {
          this.refreshAccessToken().catch(() => {
            // If refresh fails, logout user
            this.clearAuth();
            window.location.href = '/login';
          });
        }, timeUntilRefresh);
      }
    } catch (error) {
      console.error('Error setting up token refresh timer:', error);
    }
  }
}

// Export singleton instance
export const authManager = new AuthManager();

// Utility functions
export const getAuthHeaders = (): Record<string, string> => {
  const token = authManager.getAccessToken();
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

export const isAuthenticated = (): boolean => {
  return authManager.getAuthState().isAuthenticated;
};

export const getCurrentUser = (): AdminUser | null => {
  return authManager.getUser();
};

// Role-based access control
export const hasPermission = (requiredRole: string): boolean => {
  const user = getCurrentUser();
  if (!user) return false;
  
  const roleHierarchy = {
    'super_admin': ['super_admin', 'admin'],
    'admin': ['admin']
  };
  
  return roleHierarchy[user.role as keyof typeof roleHierarchy]?.includes(requiredRole) || false;
};

// Swedish localization helpers
export const getSwedishErrorMessage = (error: any): string => {
  if (typeof error === 'string') {
    return error;
  }
  
  if (error?.code) {
    const messages: Record<string, string> = {
      'UNAUTHORIZED': 'Ej auktoriserad. Logga in igen.',
      'TOKEN_EXPIRED': 'Session har gått ut. Logga in igen.',
      'INVALID_TOKEN': 'Ogiltig token. Logga in igen.',
      'NETWORK_ERROR': 'Nätverksfel. Kontrollera internetanslutningen.',
      'INTERNAL_ERROR': 'Internt serverfel. Försök igen senare.',
      'INSUFFICIENT_PERMISSIONS': 'Otillräckliga behörigheter för denna åtgärd.'
    };
    
    return messages[error.code] || error.message || 'Ett okänt fel uppstod';
  }
  
  return error?.message || 'Ett okänt fel uppstod';
};