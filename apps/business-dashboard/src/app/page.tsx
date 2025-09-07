import { StatsOverview } from '@/components/dashboard/StatsOverview';
import { StoreCodeDisplay } from '@/components/dashboard/StoreCodeDisplay';
import { RecentFeedback } from '@/components/dashboard/RecentFeedback';
import { FeedbackTrends } from '@/components/dashboard/FeedbackTrends';
import { QualityDistribution } from '@/components/dashboard/QualityDistribution';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Demo banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">
              Demo Dashboard
            </h3>
            <div className="mt-1 text-sm text-blue-700">
              <p>Du ser just nu demo-data. Det fullständiga systemet för feedback-insamling utvecklas för närvarande. Din autentisering fungerar korrekt!</p>
            </div>
          </div>
        </div>
      </div>

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Översikt över din kundåterkoppling</p>
      </div>

      {/* Store Code Display - Prominently shown */}
      <StoreCodeDisplay />

      {/* Stats overview */}
      <StatsOverview />

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FeedbackTrends />
        <QualityDistribution />
      </div>

      {/* Recent feedback */}
      <RecentFeedback />
    </div>
  );
}