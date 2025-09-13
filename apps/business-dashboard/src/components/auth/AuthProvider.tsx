'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';

interface BusinessUser {
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
  user: BusinessUser | null;
  supabaseUser: User | null;
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
  const [user, setUser] = useState<BusinessUser | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing Supabase session on mount
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          setSupabaseUser(session.user);
          
          // Fetch business data from database
          const { data: businessData, error } = await supabase
            .from('businesses')
            .select('*')
            .eq('auth_user_id', session.user.id)
            .single();
          
          if (businessData && !error) {
            const businessUser: BusinessUser = {
              id: businessData.id,
              email: businessData.email || session.user.email || '',
              name: businessData.name,
              businessName: businessData.name,
              location: businessData.address?.city || ''
            };
            setUser(businessUser);
            
            // Set business ID in localStorage for compatibility
            if (typeof window !== 'undefined') {
              localStorage.setItem('businessId', businessData.id);
            }
          }
        }
      } catch (error) {
        console.error('Error checking auth status:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setSupabaseUser(session.user);
        
        // Fetch business data
        const { data: businessData } = await supabase
          .from('businesses')
          .select('*')
          .eq('auth_user_id', session.user.id)
          .single();
        
        if (businessData) {
          const businessUser: BusinessUser = {
            id: businessData.id,
            email: businessData.email || session.user.email || '',
            name: businessData.name,
            businessName: businessData.name,
            location: businessData.address?.city || ''
          };
          setUser(businessUser);
          
          if (typeof window !== 'undefined') {
            localStorage.setItem('businessId', businessData.id);
          }
        }
      } else {
        setSupabaseUser(null);
        setUser(null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('businessId');
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    setIsLoading(true);
    
    try {
      // Sign in with Supabase Auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) {
        throw new Error(error.message || 'Inloggning misslyckades');
      }
      
      if (data.user) {
        setSupabaseUser(data.user);
        
        // Fetch business data
        const { data: businessData, error: bizError } = await supabase
          .from('businesses')
          .select('*')
          .eq('auth_user_id', data.user.id)
          .single();
        
        if (bizError) {
          throw new Error('Kunde inte hämta företagsdata');
        }
        
        if (businessData) {
          const businessUser: BusinessUser = {
            id: businessData.id,
            email: businessData.email || data.user.email || '',
            name: businessData.name,
            businessName: businessData.name,
            location: businessData.address?.city || ''
          };
          setUser(businessUser);
          
          // Set business ID in localStorage for BusinessContext
          if (typeof window !== 'undefined') {
            localStorage.setItem('businessId', businessData.id);
            console.log(`✅ Business ID set in context: ${businessData.id}`);
          }
        }
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
      // Create Supabase Auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password
      });
      
      if (authError) {
        throw new Error(authError.message || 'Failed to create account');
      }
      
      if (authData.user) {
        // Create business record in database
        const { data: businessData, error: bizError } = await supabase
          .from('businesses')
          .insert({
            name: data.name,
            email: data.email,
            auth_user_id: authData.user.id,
            status: 'pending',
            trial_feedbacks_remaining: 30,
            trial_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
          })
          .select()
          .single();
        
        if (bizError) {
          // If business creation fails, log the error
          console.error('Failed to create business record:', bizError);
          throw new Error('Failed to create business record: ' + bizError.message);
        }
        
        console.log(`✅ Business created successfully: ${businessData.name} (ID: ${businessData.id})`);
        
        // Automatically login after successful signup
        console.log('🔐 Auto-logging in after signup...');
        await login(data.email, data.password);
        console.log('✅ Auto-login successful, user is now authenticated');
      }
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
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setSupabaseUser(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('businessId');
      }
      setIsLoading(false);
      window.location.href = '/login';
    }
  };

  const value: AuthContextType = {
    user,
    supabaseUser,
    isLoading,
    login,
    signup,
    logout,
    isAuthenticated: !!user && !!supabaseUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}