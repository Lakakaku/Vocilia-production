'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';

export default function OnboardingPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const supabase = createClientComponentClient();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Auth error:', error);
          router.replace('/login');
          return;
        }

        if (!session?.user) {
          router.replace('/login');
          return;
        }

        // Check if business exists for this user
        const { data: business, error: businessError } = await supabase
          .from('businesses')
          .select('id, onboarding_completed')
          .eq('email', session.user.email)
          .single();

        if (businessError) {
          console.error('Business lookup error:', businessError);
          router.replace('/signup');
          return;
        }

        // If onboarding is already completed, redirect to dashboard
        if (business.onboarding_completed) {
          router.replace('/');
          return;
        }

        setIsAuthenticated(true);
      } catch (error) {
        console.error('Error checking authentication:', error);
        router.replace('/login');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [router, supabase]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Laddar...</h2>
          <p className="text-gray-600">Förbereder din konfiguration...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect in useEffect
  }

  return <OnboardingWizard />;
}