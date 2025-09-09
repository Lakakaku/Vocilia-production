'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiService } from '../services/api';

interface User {
  id: string;
  email: string;
  name: string;
  businessName: string;
  location: string;
}

interface SignupData {
  name: string;
  email: string;
  password: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (data: SignupData) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing session on mount
    const checkAuth = async () => {
      try {
        const userData = localStorage.getItem('ai-feedback-user');
        const accessToken = localStorage.getItem('ai-feedback-access-token');
        
        if (userData && accessToken) {
          // Try to verify the token is still valid
          try {
            const response = await apiService.getCurrentUser();
            if (response.success) {
              setUser(response.data.user);
            } else {
              // Token invalid, clear localStorage
              localStorage.removeItem('ai-feedback-user');
              localStorage.removeItem('ai-feedback-access-token');
              localStorage.removeItem('ai-feedback-refresh-token');
            }
          } catch (error) {
            // API call failed, but keep local user data if available
            // This allows offline functionality
            setUser(JSON.parse(userData));
          }
        }
      } catch (error) {
        console.error('Error checking auth status:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    setIsLoading(true);
    
    try {
      const response = await apiService.login(email, password);
      
      if (response.success) {
        const userData = response.data.user;
        setUser(userData);
        
        // Set business ID in localStorage for BusinessContext
        if (typeof window !== 'undefined' && userData.id) {
          localStorage.setItem('businessId', userData.id);
          console.log(`✅ Business ID set in context: ${userData.id}`);
        }
      } else {
        throw new Error(response.error?.message || 'Inloggning misslyckades');
      }
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (data: SignupData): Promise<void> => {
    console.log('🚀 Starting signup process with data:', { email: data.email, name: data.name });
    setIsLoading(true);
    
    try {
      // Create business via Railway backend API
      const businessData = {
        name: data.name,
        email: data.email,
        password: data.password
      };

      console.log('📡 Calling Railway API at:', `${process.env.NEXT_PUBLIC_API_URL || 'localhost:3001'}/api/business`);
      const response = await apiService.createBusiness(businessData);
      console.log('📥 API Response:', response);

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to create business account');
      }

      const business = response.data.business;
      console.log(`✅ REAL Business created successfully: ${business.name} (ID: ${business.id})`);
      
      // Automatically login after successful signup
      console.log('🔐 Auto-logging in after signup...');
      await login(data.email, data.password);
      console.log('✅ Auto-login successful, user is now authenticated');
      
    } catch (error) {
      console.error('❌ Signup error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    
    try {
      await apiService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setIsLoading(false);
      window.location.href = '/login';
    }
  };

  const value: AuthContextType = {
    user,
    isLoading,
    login,
    signup,
    logout,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}