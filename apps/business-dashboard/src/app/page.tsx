import { StatsOverview } from '@/components/dashboard/StatsOverview';
import { RecentFeedback } from '@/components/dashboard/RecentFeedback';
import { FeedbackTrends } from '@/components/dashboard/FeedbackTrends';
import { QualityDistribution } from '@/components/dashboard/QualityDistribution';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Översikt över din kundåterkoppling</p>
      </div>

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