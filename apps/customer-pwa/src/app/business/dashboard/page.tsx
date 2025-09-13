'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';

interface User {
  id: string;
  email: string;
  businessName: string;
  name: string;
  location?: string;
  status?: string;
  trialFeedbacksRemaining?: number;
  createdAt?: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Force service worker update on mount
  useEffect(() => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg) {
          reg.update().catch(console.error);
        }
      });
    }
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Check Supabase session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          // No session, check if demo mode
          const isDemoMode = window.location.hostname === 'localhost' || 
                            window.location.search.includes('demo=true') ||
                            localStorage.getItem('demo-mode') === 'true';
          
          if (isDemoMode) {
            const demoUser = {
              id: 'demo-user-001',
              email: 'demo@vocilia.com',
              businessName: 'Demo Business - Vocilia',
              name: 'Demo Business - Vocilia'
            };
            
            setUser(demoUser);
            localStorage.setItem('ai-feedback-user', JSON.stringify(demoUser));
            localStorage.setItem('businessId', demoUser.id);
            localStorage.setItem('demo-mode', 'true');
            localStorage.setItem('ai-feedback-onboarding-completed', 'true');
            setLoading(false);
          } else {
            router.push('/business/login');
          }
          return;
        }

        // Session exists, get business data
        const { data: businessData, error: businessError } = await supabase
          .from('businesses')
          .select('*')
          .eq('email', session.user.email)
          .single();

        if (businessError || !businessData) {
          // If no business exists, create one
          const { data: newBusiness, error: createError } = await supabase
            .from('businesses')
            .insert({
              email: session.user.email,
              name: session.user.email?.split('@')[0] || 'Business',
              auth_user_id: session.user.id // Correct column name
            })
            .select()
            .single();
          
          if (createError) {
            console.error('Failed to create business profile:', createError);
            router.push('/business/signup');
            return;
          }
          
          const userData = {
            id: newBusiness.id,
            email: session.user.email || '',
            businessName: newBusiness.name || '',
            name: newBusiness.name || ''
          };
          
          setUser(userData);
          localStorage.setItem('ai-feedback-user', JSON.stringify(userData));
          localStorage.setItem('businessId', newBusiness.id);
          
          // Check onboarding
          const onboardingCompleted = localStorage.getItem('ai-feedback-onboarding-completed');
          if (!onboardingCompleted) {
            router.push('/business/onboarding');
            return;
          }
        } else {
          // Business exists, use it
          const userData = {
            id: businessData.id,
            email: session.user.email || '',
            businessName: businessData.name || '',
            name: businessData.name || '',
            location: businessData.location || '',
            status: businessData.status || '',
            trialFeedbacksRemaining: businessData.trial_feedbacks_remaining,
            createdAt: businessData.created_at
          };
          
          setUser(userData);
          localStorage.setItem('ai-feedback-user', JSON.stringify(userData));
          localStorage.setItem('businessId', businessData.id);
          localStorage.removeItem('demo-mode');
          
          // Check onboarding (stored in context_data JSONB field)
          const onboardingCompleted = localStorage.getItem('ai-feedback-onboarding-completed') || 
                                     businessData.context_data?.onboarding_completed;
          if (!onboardingCompleted) {
            router.push('/business/onboarding');
            return;
          }
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Auth check failed:', error);
        
        // In case of any error, check if we should use demo mode
        const isDemoMode = window.location.hostname === 'localhost' || 
                          window.location.search.includes('demo=true') ||
                          localStorage.getItem('demo-mode') === 'true';
        
        if (isDemoMode) {
          const demoUser = {
            id: 'demo-user-001',
            email: 'demo@vocilia.com',
            businessName: 'Demo Business - Vocilia',
            name: 'Demo Business - Vocilia'
          };
          
          setUser(demoUser);
          localStorage.setItem('ai-feedback-user', JSON.stringify(demoUser));
          localStorage.setItem('businessId', demoUser.id);
          localStorage.setItem('demo-mode', 'true');
        } else {
          router.push('/business/login');
        }
      } finally {
        setLoading(false);
      }
    };

    checkAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        router.push('/business/login');
      } else if (event === 'SIGNED_IN' && session) {
        checkAuth();
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('ai-feedback-access-token');
      localStorage.removeItem('ai-feedback-refresh-token');
      localStorage.removeItem('ai-feedback-user');
      localStorage.removeItem('businessId');
      localStorage.removeItem('demo-mode');
      router.push('/business/login');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Laddar dashboard...</p>
        </div>
      </div>
    );
  }

  const isDemoMode = localStorage.getItem('demo-mode') === 'true';

  return (
    <div className="min-h-screen bg-white">
      {/* Demo mode indicator */}
      {isDemoMode && (
        <div className="bg-yellow-100 border-b border-yellow-300 px-4 py-2 text-center">
          <p className="text-sm text-yellow-800">
            Demo Mode - To use with real data, please{' '}
            <button
              onClick={() => {
                localStorage.removeItem('demo-mode');
                router.push('/business/login');
              }}
              className="underline font-semibold hover:text-yellow-900"
            >
              log in
            </button>
          </p>
        </div>
      )}
      
      {/* Header with business name */}
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {user?.businessName || 'Loading...'}
        </h1>
      </div>
      
      {/* Main content */}
      <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 100px)' }}>
        <div className="flex flex-col gap-4">
          <button
            onClick={() => router.push('/business/context')}
            className="px-6 py-3 bg-black text-white rounded hover:bg-gray-800 transition-colors"
          >
            Context
          </button>
          <button
            onClick={handleLogout}
            className="px-6 py-3 bg-black text-white rounded hover:bg-gray-800 transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}