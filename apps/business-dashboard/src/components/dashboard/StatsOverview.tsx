'use client';

import { TrendingUp, TrendingDown, MessageSquare, Users, Star, CreditCard, Loader2 } from 'lucide-react';
import { useDashboardData } from '../../services/hooks';
import { useBusinessContext } from '@/contexts/BusinessContext';

interface DashboardStats {
  totalFeedback: number;
  feedbackGrowth: number;
  avgQualityScore: number;
  qualityScoreChange: number;
  uniqueCustomers: number;
  customerGrowth: number;
  totalRewards: number;
  rewardsChange: number;
}

export function StatsOverview() {
  const { businessId } = useBusinessContext();
  const { data: dashboardData, loading, error } = useDashboardData(businessId || '');
  
  // Use real data from API, with fallbacks for new businesses
  const stats: DashboardStats = {
    totalFeedback: dashboardData?.analytics.totalSessions || 0,
    feedbackGrowth: 0, // TODO: Calculate growth when we have historical data
    avgQualityScore: dashboardData?.analytics.averageQuality || 0,
    qualityScoreChange: 0, // TODO: Calculate change when we have historical data
    uniqueCustomers: dashboardData?.analytics.totalSessions || 0, // Use sessions as proxy for now
    customerGrowth: 0, // TODO: Calculate growth when we have historical data
    totalRewards: dashboardData?.analytics.totalRewards || 0,
    rewardsChange: 0 // TODO: Calculate change when we have historical data
  };
  
  // Show loading state
  if (loading && !businessId) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="stat-card animate-pulse">
            <div className="h-4 bg-gray-200 rounded mb-3"></div>
            <div className="h-8 bg-gray-200 rounded mb-4"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
          </div>
        ))}
      </div>
    );
  }
  
  // Show error state
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600 text-sm">Kunde inte ladda statistik: {error}</p>
      </div>
    );
  }

  const statItems = [
    {
      name: 'Total Feedback',
      value: stats.totalFeedback?.toString() || '0',
      change: stats.totalFeedback > 0 ? 'Aktiv' : 'Ingen data än',
      changeType: 'increase' as const,
      icon: MessageSquare,
      period: stats.totalFeedback > 0 ? 'feedback sessioner' : ''
    },
    {
      name: 'Avg Quality Score',
      value: stats.avgQualityScore > 0 ? stats.avgQualityScore.toFixed(1) : '0.0',
      change: stats.avgQualityScore > 0 ? 'Aktiv' : 'Ingen data än',
      changeType: 'increase' as const,
      icon: Star,
      period: 'av 100 poäng'
    },
    {
      name: 'Customer Sessions',
      value: stats.uniqueCustomers?.toString() || '0',
      change: stats.uniqueCustomers > 0 ? 'Aktiv' : 'Ingen data än',
      changeType: 'increase' as const,
      icon: Users,
      period: stats.uniqueCustomers > 0 ? 'sessioner' : ''
    },
    {
      name: 'Total Rewards',
      value: `${stats.totalRewards?.toLocaleString('sv-SE') || '0'} kr`,
      change: stats.totalRewards > 0 ? 'Aktiv' : 'Ingen data än',
      changeType: 'increase' as const,
      icon: CreditCard,
      period: stats.totalRewards > 0 ? 'utbetalat' : ''
    },
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {statItems.map((stat) => {
        const Icon = stat.icon;
        
        return (
          <div key={stat.name} className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
              </div>
              <div className={`p-3 rounded-lg ${
                stat.changeType === 'increase' ? 'bg-green-100' : 'bg-red-100'
              }`}>
                <Icon className={`w-6 h-6 ${
                  stat.changeType === 'increase' ? 'text-green-600' : 'text-red-600'
                }`} />
              </div>
            </div>
            
            <div className="mt-4 flex items-center">
              {stat.changeType === 'increase' ? (
                <TrendingUp className="w-4 h-4 text-green-500" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-500" />
              )}
              <span className={`ml-1 text-sm font-medium ${
                stat.changeType === 'increase' ? 'text-green-600' : 'text-red-600'
              }`}>
                {stat.change}
              </span>
              <span className="ml-1 text-sm text-gray-500">{stat.period}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}