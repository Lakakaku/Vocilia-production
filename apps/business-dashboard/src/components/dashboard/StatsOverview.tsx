'use client';

import { TrendingUp, TrendingDown, MessageSquare, Users, Star, CreditCard } from 'lucide-react';

const stats = [
  {
    name: 'Total Feedback',
    value: '247',
    change: '+12%',
    changeType: 'increase' as const,
    icon: MessageSquare,
    period: 'denna månad'
  },
  {
    name: 'Avg Quality Score',
    value: '73.5',
    change: '+5.2',
    changeType: 'increase' as const,
    icon: Star,
    period: 'poäng'
  },
  {
    name: 'Unique Customers',
    value: '189',
    change: '+8%',
    changeType: 'increase' as const,
    icon: Users,
    period: 'denna månad'
  },
  {
    name: 'Total Rewards',
    value: '2,847 kr',
    change: '-3%',
    changeType: 'decrease' as const,
    icon: CreditCard,
    period: 'denna månad'
  },
];

export function StatsOverview() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat) => {
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