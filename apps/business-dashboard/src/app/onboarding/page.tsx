'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function OnboardingPage() {
  const router = useRouter();
  
  useEffect(() => {
    // Redirect to signup page - onboarding wizard is deprecated
    router.replace('/signup');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Omdirigerar...</h2>
        <p className="text-gray-600">Du omdirigeras till registreringssidan...</p>
      </div>
    </div>
  );
}