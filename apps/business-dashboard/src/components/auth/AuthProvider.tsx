'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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
      // Mock signup - simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Check if user already exists
      const savedUsers = JSON.parse(localStorage.getItem('ai-feedback-users') || '[]');
      if (savedUsers.some((u: any) => u.email === data.email)) {
        throw new Error('En användare med denna e-post finns redan');
      }
      
      // Create new user
      const userId = Date.now().toString();
      const newUser = {
        id: userId,
        email: data.email,
        name: data.name,
        businessName: data.name,
        location: data.address?.city || 'Stockholm',
        password: data.password, // In real app, this would be hashed
        orgNumber: data.orgNumber,
        phone: data.phone,
        address: data.address,
        createdAt: new Date().toISOString()
      };
      
      // Save to localStorage
      savedUsers.push(newUser);
      localStorage.setItem('ai-feedback-users', JSON.stringify(savedUsers));
      
      // Also save business data for onboarding
      localStorage.setItem('ai-feedback-signup-data', JSON.stringify({
        businessInfo: {
          name: data.name,
          organizationNumber: data.orgNumber || '',
          address: data.address?.street || '',
          city: data.address?.city || '',
          postalCode: data.address?.postal_code || '',
          phone: data.phone || '',
          email: data.email,
          website: '',
          description: ''
        }
      }));
      
      // Auto-login the new user
      const userForLogin: User = {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        businessName: newUser.businessName,
        location: newUser.location
      };
      
      setUser(userForLogin);
      localStorage.setItem('ai-feedback-user', JSON.stringify(userForLogin));
      
    } catch (error) {
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