'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiService } from '@/services/api';

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
  orgNumber?: string;
  phone?: string;
  address?: {
    street: string;
    city: string;
    postal_code: string;
  };
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
        if (userData) {
          setUser(JSON.parse(userData));
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
      // Mock authentication - replace with real auth service
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check if user exists in localStorage (for demo purposes)
      const savedUsers = JSON.parse(localStorage.getItem('ai-feedback-users') || '[]');
      const existingUser = savedUsers.find((u: any) => u.email === email && u.password === password);
      
      if (existingUser) {
        const mockUser: User = {
          id: existingUser.id,
          email: existingUser.email,
          name: existingUser.name,
          businessName: existingUser.businessName,
          location: existingUser.location
        };
        
        setUser(mockUser);
        localStorage.setItem('ai-feedback-user', JSON.stringify(mockUser));
      } else if (email === 'admin@testcafe.se' && password === 'password') {
        const mockUser: User = {
          id: '1',
          email: 'admin@testcafe.se',
          name: 'Test Användare',
          businessName: 'Test Café',
          location: 'Stockholm'
        };
        
        setUser(mockUser);
        localStorage.setItem('ai-feedback-user', JSON.stringify(mockUser));
      } else {
        throw new Error('Felaktiga inloggningsuppgifter');
      }
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (data: SignupData): Promise<void> => {
    setIsLoading(true);
    
    try {
      // Create business via real API
      const businessData = {
        name: data.name,
        email: data.email,
        orgNumber: data.orgNumber,
        phone: data.phone,
        address: data.address ? {
          street: data.address.street,
          city: data.address.city,
          postal_code: data.address.postal_code
        } : undefined,
        createStripeAccount: false, // Don't create Stripe account during signup
        verificationMethod: 'simple_verification' // Default to simple verification
      };

      const response = await apiService.request('/api/business', {
        method: 'POST',
        body: JSON.stringify(businessData)
      });

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to create business account');
      }

      const business = response.data.business;
      
      // Save user credentials to localStorage for login (not auto-login)
      const savedUsers = JSON.parse(localStorage.getItem('ai-feedback-users') || '[]');
      
      // Check if user already exists
      if (savedUsers.some((u: any) => u.email === data.email)) {
        throw new Error('En användare med denna e-post finns redan');
      }
      
      const newUser = {
        id: business.id,
        email: business.email,
        name: business.name,
        businessName: business.name,
        location: business.address?.city || 'Stockholm',
        password: data.password, // Store for mock login system
        orgNumber: business.org_number,
        phone: business.phone,
        address: business.address,
        createdAt: business.created_at
      };
      
      savedUsers.push(newUser);
      localStorage.setItem('ai-feedback-users', JSON.stringify(savedUsers));
      
      console.log(`✅ Business created successfully: ${business.name} (ID: ${business.id})`);
      
      // Don't auto-login - user will be redirected to login page
      
    } catch (error) {
      console.error('Signup error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('ai-feedback-user');
    window.location.href = '/login';
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