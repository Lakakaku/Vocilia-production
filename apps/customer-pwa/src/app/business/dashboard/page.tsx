'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  email: string;
  business: {
    id: string;
    name: string;
  };
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
        const accessToken = localStorage.getItem('ai-feedback-access-token');
        
        // Immediately activate demo mode if no token
        if (!accessToken) {
          // Set demo mode immediately
          const demoUser = {
            id: 'demo-user-001',
            email: 'demo@vocilia.com',
            business: {
              id: 'demo-business-001',
              name: 'Demo Business - Vocilia'
            }
          };
          
          setUser(demoUser);
          localStorage.setItem('ai-feedback-user', JSON.stringify(demoUser));
          localStorage.setItem('businessId', demoUser.business.id);
          localStorage.setItem('demo-mode', 'true');
          localStorage.setItem('ai-feedback-onboarding-completed', 'true');
          setLoading(false);
          return;
        }

        // Try to verify the token with a timeout
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
          
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/me`, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);

          if (response.ok) {
            const data = await response.json();
            if (data.success && data.data?.user) {
              setUser(data.data.user);
              
              // Store user data and business ID in localStorage for context service
              localStorage.setItem('ai-feedback-user', JSON.stringify(data.data.user));
              
              // Store business ID separately for easy access
              if (data.data.user.business?.id) {
                localStorage.setItem('businessId', data.data.user.business.id);
              }
              
              // Clear demo mode if real auth succeeded
              localStorage.removeItem('demo-mode');
                
                // Check if user has completed onboarding
                const onboardingCompleted = localStorage.getItem('ai-feedback-onboarding-completed');
                if (!onboardingCompleted) {
                  // Check with backend if onboarding is needed
                  try {
                    const onboardingResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/business/onboarding/status`, {
                      headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                      },
                    });
                    
                    if (onboardingResponse.ok) {
                      const onboardingData = await onboardingResponse.json();
                      if (!onboardingData.completed) {
                        router.push('/business/onboarding');
                        return;
                      } else {
                        localStorage.setItem('ai-feedback-onboarding-completed', 'true');
                      }
                    }
                  } catch (onboardingError) {
                    // If onboarding check fails, continue anyway
                    console.log('Onboarding check failed, continuing...');
                  }
                }
                
              setLoading(false);
              return; // Successfully authenticated
            } else {
              throw new Error('Invalid auth response');
            }
          } else {
            throw new Error('Auth failed');
          }
        } catch (authError) {
          console.error('Auth verification failed:', authError);
          
          // Auth failed, use demo mode
          const demoUser = {
            id: 'demo-user-001',
            email: 'demo@vocilia.com',
            business: {
              id: 'demo-business-001',
              name: 'Demo Business - Vocilia'
            }
          };
          
          setUser(demoUser);
          localStorage.setItem('ai-feedback-user', JSON.stringify(demoUser));
          localStorage.setItem('businessId', demoUser.business.id);
          localStorage.setItem('demo-mode', 'true');
          localStorage.setItem('ai-feedback-onboarding-completed', 'true');
          
          // Clear invalid token
          localStorage.removeItem('ai-feedback-access-token');
          localStorage.removeItem('ai-feedback-refresh-token');
          
          setLoading(false);
        }
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
            business: {
              id: 'demo-business-001',
              name: 'Demo Business - Vocilia'
            }
          };
          
          setUser(demoUser);
          localStorage.setItem('ai-feedback-user', JSON.stringify(demoUser));
          localStorage.setItem('businessId', demoUser.business.id);
          localStorage.setItem('demo-mode', 'true');
        } else {
          router.push('/business/login');
        }
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  const handleLogout = async () => {
    try {
      const accessToken = localStorage.getItem('ai-feedback-access-token');
      if (accessToken) {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('ai-feedback-access-token');
      localStorage.removeItem('ai-feedback-refresh-token');
      localStorage.removeItem('ai-feedback-user');
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
          {user?.business?.name || 'Loading...'}
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