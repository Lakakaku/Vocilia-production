'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../../lib/supabase';
import { User as SupabaseUser } from '@supabase/supabase-js';

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
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          // Fetch business data for the user
          const { data: businessData } = await supabase
            .from('businesses')
            .select('*')
            .eq('email', session.user.email)
            .single();
          
          if (businessData) {
            setUser({
              id: businessData.id,
              email: session.user.email || '',
              name: businessData.name || '',
              businessName: businessData.name || '',
              location: businessData.location || ''
            });
            
            // Set business ID in localStorage for BusinessContext
            if (typeof window !== 'undefined' && businessData.id) {
              localStorage.setItem('businessId', businessData.id);
              console.log(`✅ Business ID set in context: ${businessData.id}`);
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
      if (event === 'SIGNED_IN' && session) {
        // Fetch business data for the user
        const { data: businessData } = await supabase
          .from('businesses')
          .select('*')
          .eq('email', session.user.email)
          .single();
        
        if (businessData) {
          setUser({
            id: businessData.id,
            email: session.user.email || '',
            name: businessData.name || '',
            businessName: businessData.name || '',
            location: businessData.location || ''
          });
          
          // Set business ID in localStorage for BusinessContext
          if (typeof window !== 'undefined' && businessData.id) {
            localStorage.setItem('businessId', businessData.id);
            console.log(`✅ Business ID set in context: ${businessData.id}`);
          }
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('businessId');
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        throw new Error(error.message || 'Inloggning misslyckades');
      }

      if (data.session) {
        // Fetch business data for the user
        const { data: businessData, error: businessError } = await supabase
          .from('businesses')
          .select('*')
          .eq('email', email)
          .single();
        
        if (businessError || !businessData) {
          // If no business exists, create one
          const { data: newBusiness, error: createError } = await supabase
            .from('businesses')
            .insert({
              email: email,
              name: email.split('@')[0], // Use email prefix as default name
              auth_user_id: data.user.id // Correct column name
            })
            .select()
            .single();
          
          if (createError) {
            throw new Error('Failed to create business profile');
          }
          
          setUser({
            id: newBusiness.id,
            email: email,
            name: newBusiness.name || '',
            businessName: newBusiness.name || '',
            location: newBusiness.location || ''
          });
          
          if (typeof window !== 'undefined' && newBusiness.id) {
            localStorage.setItem('businessId', newBusiness.id);
          }
        } else {
          setUser({
            id: businessData.id,
            email: email,
            name: businessData.name || '',
            businessName: businessData.name || '',
            location: businessData.location || ''
          });
          
          if (typeof window !== 'undefined' && businessData.id) {
            localStorage.setItem('businessId', businessData.id);
            console.log(`✅ Business ID set in context: ${businessData.id}`);
          }
        }
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (data: SignupData): Promise<void> => {
    console.log('🚀 Starting signup process with data:', { email: data.email, name: data.name });
    setIsLoading(true);
    
    try {
      // Create user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            name: data.name
          }
        }
      });

      if (authError) {
        throw new Error(authError.message || 'Failed to create account');
      }

      if (authData.user) {
        // Create business profile
        const { data: businessData, error: businessError } = await supabase
          .from('businesses')
          .insert({
            email: data.email,
            name: data.name,
            user_id: authData.user.id
          })
          .select()
          .single();

        if (businessError) {
          console.error('Failed to create business profile:', businessError);
          // Don't throw here, user is created and can login
        }

        console.log(`✅ Account created successfully: ${data.name} (Email: ${data.email})`);
        
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
      if (typeof window !== 'undefined') {
        localStorage.removeItem('businessId');
      }
      setIsLoading(false);
      window.location.href = '/business/login';
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