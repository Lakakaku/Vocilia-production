'use client';

import { TrendingUp, TrendingDown, MessageSquare, Star } from 'lucide-react';
import type { FeedbackFilter } from '@/app/feedback/page';

interface FeedbackStatsProps {
  filters: FeedbackFilter;
}

export function FeedbackStats({ filters }: FeedbackStatsProps) {
  // Mock data - in real app, this would be calculated based on filters
  const stats = [
    {
      label: 'Total Feedback',
      value: '247',
      change: '+12%',
      changeType: 'increase' as const,
      icon: MessageSquare,
    },
    {
      label: 'Genomsnittlig Poäng',
      value: '73.5',
      change: '+5.2',
      changeType: 'increase' as const,
      icon: Star,
    },
    {
      label: 'Positiv Feedback',
      value: '68%',
      change: '+8%',
      changeType: 'increase' as const,
      icon: TrendingUp,
    },
    {
      label: 'Negativ Feedback',
      value: '12%',
      change: '-3%',
      changeType: 'decrease' as const,
      icon: TrendingDown,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat) => {
        const Icon = stat.icon;
        
        return (
          <div key={stat.label} className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.label}</p>
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
              <span className="ml-1 text-sm text-gray-500">sedan förra månaden</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}