'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthProvider';

interface OnboardingGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function OnboardingGuard({ children, fallback }: OnboardingGuardProps) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      // User not authenticated, redirect to login
      router.replace('/login');
      return;
    }

    if (user && !user.onboardingCompleted) {
      // User authenticated but onboarding not completed
      console.log('🚀 OnboardingGuard: User needs onboarding, redirecting...');
      router.replace('/onboarding');
      return;
    }

    // User is authenticated and has completed onboarding
    setIsChecking(false);
  }, [user, isLoading, router]);

  if (isLoading || isChecking) {
    return fallback || (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Laddar...</h2>
          <p className="text-gray-600">Kontrollerar din konfiguration...</p>
        </div>
      </div>
    );
  }

  if (!user || !user.onboardingCompleted) {
    return null; // Will redirect in useEffect
  }

  return <>{children}</>;
}

// Higher-order component version
export function withOnboardingGuard<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: React.ReactNode
) {
  return function OnboardingGuardedComponent(props: P) {
    return (
      <OnboardingGuard fallback={fallback}>
        <Component {...props} />
      </OnboardingGuard>
    );
  };
}