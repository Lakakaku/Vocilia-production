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

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const accessToken = localStorage.getItem('ai-feedback-access-token');
        if (!accessToken) {
          router.push('/business/login');
          return;
        }

        // Verify token with backend
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/me`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setUser(data.data.user);
            
            // Store user data and business ID in localStorage for context service
            if (data.data.user) {
              localStorage.setItem('ai-feedback-user', JSON.stringify(data.data.user));
              
              // Store business ID separately for easy access
              if (data.data.user.business?.id) {
                localStorage.setItem('businessId', data.data.user.business.id);
              }
            }
            
            // Check if user has completed onboarding
            const onboardingCompleted = localStorage.getItem('ai-feedback-onboarding-completed');
            if (!onboardingCompleted) {
              // Check with backend if onboarding is needed
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
              } else {
                // If we can't verify onboarding status, redirect to onboarding to be safe
                router.push('/business/onboarding');
                return;
              }
            }
          } else {
            router.push('/business/login');
          }
        } else {
          // Token invalid, redirect to login
          localStorage.removeItem('ai-feedback-access-token');
          localStorage.removeItem('ai-feedback-refresh-token');
          localStorage.removeItem('ai-feedback-user');
          router.push('/business/login');
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        router.push('/business/login');
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

  return (
    <div className="min-h-screen bg-white">
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