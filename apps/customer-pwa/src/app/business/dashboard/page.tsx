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
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Business Dashboard</h1>
            {user && (
              <p className="text-gray-600 mt-2">
                Välkommen tillbaka, {user.business?.name || user.email}
              </p>
            )}
          </div>
          <button
            onClick={handleLogout}
            className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
          >
            Logga ut
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Total Feedback</h3>
            <p className="text-3xl font-bold text-blue-600">-</p>
            <p className="text-sm text-gray-500">Kommer snart</p>
          </div>
          
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Average Quality</h3>
            <p className="text-3xl font-bold text-green-600">-</p>
            <p className="text-sm text-gray-500">Kommer snart</p>
          </div>
          
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Total Rewards</h3>
            <p className="text-3xl font-bold text-purple-600">-</p>
            <p className="text-sm text-gray-500">Kommer snart</p>
          </div>
        </div>

        <div className="mt-8 card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Kom igång</h3>
          <div className="space-y-4">
            <p className="text-gray-700">
              Ditt företagskonto är nu skapat! Här kan du snart:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-600">
              <li>Se all kundåterkomst från dina butiker</li>
              <li>Hantera QR-koder för feedback-insamling</li>
              <li>Analysera kvalitetspoäng och trends</li>
              <li>Exportera data för rapporter</li>
            </ul>
            <div className="mt-6 p-4 bg-blue-50 rounded-md">
              <p className="text-blue-800 font-medium">
                Kontakta oss på support@vocilia.com för att aktivera alla funktioner.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}