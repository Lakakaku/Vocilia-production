'use client';

import { TrendingUp, TrendingDown, MessageSquare, Users, Star, CreditCard, Loader2 } from 'lucide-react';
import { useDashboardData } from '@/services/hooks';
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
  
  // Demo data while full dashboard API is being developed
  const stats: DashboardStats = {
    totalFeedback: 247,
    feedbackGrowth: 12.5,
    avgQualityScore: 73.5,
    qualityScoreChange: 4.2,
    uniqueCustomers: 189,
    customerGrowth: 8.3,
    totalRewards: 15750,
    rewardsChange: 15.7
  };

  const statItems = [
    {
      name: 'Total Feedback',
      value: stats.totalFeedback?.toString() || '0',
      change: `${stats.feedbackGrowth > 0 ? '+' : ''}${stats.feedbackGrowth?.toFixed(1) || 0}%`,
      changeType: (stats.feedbackGrowth || 0) >= 0 ? 'increase' as const : 'decrease' as const,
      icon: MessageSquare,
      period: 'denna månad'
    },
    {
      name: 'Avg Quality Score',
      value: stats.avgQualityScore?.toFixed(1) || '0.0',
      change: `${stats.qualityScoreChange > 0 ? '+' : ''}${stats.qualityScoreChange?.toFixed(1) || 0}`,
      changeType: (stats.qualityScoreChange || 0) >= 0 ? 'increase' as const : 'decrease' as const,
      icon: Star,
      period: 'poäng'
    },
    {
      name: 'Unique Customers',
      value: stats.uniqueCustomers?.toString() || '0',
      change: `${stats.customerGrowth > 0 ? '+' : ''}${stats.customerGrowth?.toFixed(1) || 0}%`,
      changeType: (stats.customerGrowth || 0) >= 0 ? 'increase' as const : 'decrease' as const,
      icon: Users,
      period: 'denna månad'
    },
    {
      name: 'Total Rewards',
      value: `${stats.totalRewards?.toLocaleString('sv-SE') || '0'} kr`,
      change: `${stats.rewardsChange > 0 ? '+' : ''}${stats.rewardsChange?.toFixed(1) || 0}%`,
      changeType: (stats.rewardsChange || 0) >= 0 ? 'increase' as const : 'decrease' as const,
      icon: CreditCard,
      period: 'denna månad'
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