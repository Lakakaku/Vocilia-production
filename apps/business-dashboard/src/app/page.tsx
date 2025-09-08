'use client';

import { useAuth } from '@/components/auth/AuthProvider';
import { StoreCodeDisplay } from '@/components/dashboard/StoreCodeDisplay';
import { RealTimeAnalytics } from '@/components/dashboard/RealTimeAnalytics';
import { RecentFeedback } from '@/components/dashboard/RecentFeedback';
import { QuickActions } from '@/components/dashboard/QuickActions';

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-8 text-white">
        <h1 className="text-3xl font-bold mb-2">
          Välkommen {user?.businessName || 'till Vocilia'}!
        </h1>
        <p className="text-blue-100 text-lg">
          Samla värdefull kundåterkoppling och öka kundnöjdheten
        </p>
      </div>

      {/* Essential Actions Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* QR Code - Most Important */}
        <div className="lg:col-span-1">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Din QR-kod
          </h2>
          <StoreCodeDisplay />
        </div>

        {/* Quick Actions */}
        <div className="lg:col-span-1">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Snabbåtgärder
          </h2>
          <QuickActions />
        </div>
      </div>

      {/* Analytics Overview */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Översikt
        </h2>
        <RealTimeAnalytics />
      </div>

      {/* Recent Feedback */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Senaste feedback
        </h2>
        <RecentFeedback />
      </div>
    </div>
  );
}