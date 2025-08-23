'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, AlertTriangle, Target, Users, Star } from 'lucide-react';

// Types for real analytics data
interface BusinessMetrics {
  totalFeedback: number;
  averageQualityScore: number;
  uniqueCustomers: number;
  totalRewards: number;
  trends: {
    feedbackChange: number;
    scoreChange: number;
    customerChange: number;
    rewardChange: number;
  };
  qualityBreakdown: {
    authenticity: number;
    concreteness: number;
    depth: number;
  };
  sentimentDistribution: {
    positive: number;
    neutral: number;
    negative: number;
  };
  topCategories: Array<{
    category: string;
    count: number;
    averageScore: number;
  }>;
  recentInsights: Array<{
    type: 'opportunity' | 'concern' | 'achievement';
    title: string;
    description: string;
    impact: 'high' | 'medium' | 'low';
  }>;
}

export function RealTimeAnalytics() {
  const [metrics, setMetrics] = useState<BusinessMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      // TODO: Replace with actual API call
      // const response = await fetch(`/api/business/analytics?range=${timeRange}`);
      // const data = await response.json();
      
      // Mock data for now - will be replaced with real API integration
      const mockData: BusinessMetrics = {
        totalFeedback: 247,
        averageQualityScore: 73.5,
        uniqueCustomers: 189,
        totalRewards: 2847,
        trends: {
          feedbackChange: 12.3,
          scoreChange: 5.2,
          customerChange: 8.1,
          rewardChange: -3.2
        },
        qualityBreakdown: {
          authenticity: 75.2,
          concreteness: 71.8,
          depth: 73.5
        },
        sentimentDistribution: {
          positive: 68.2,
          neutral: 23.1,
          negative: 8.7
        },
        topCategories: [
          { category: 'Service', count: 89, averageScore: 76.3 },
          { category: 'Produkter', count: 67, averageScore: 71.2 },
          { category: 'Atmosfär', count: 45, averageScore: 78.9 },
          { category: 'Priser', count: 32, averageScore: 65.4 }
        ],
        recentInsights: [
          {
            type: 'opportunity',
            title: 'Förbättra produktkvalitet',
            description: 'Kunder nämner ofta produktkvalitet som förbättringsområde',
            impact: 'high'
          },
          {
            type: 'achievement', 
            title: 'Utmärkt service',
            description: 'Servicebetyget har ökat med 8% denna månad',
            impact: 'medium'
          },
          {
            type: 'concern',
            title: 'Långa köer',
            description: 'Flera kunder klagar på väntetider',
            impact: 'medium'
          }
        ]
      };

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      setMetrics(mockData);
      
    } catch (err) {
      setError('Kunde inte hämta analytics data');
      console.error('Analytics fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Loading skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-3/4 mb-4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/3"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-6 border-red-200 bg-red-50">
        <div className="flex items-center space-x-2 text-red-600">
          <AlertTriangle className="w-5 h-5" />
          <span>{error}</span>
        </div>
        <button 
          onClick={fetchAnalytics}
          className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Försök igen
        </button>
      </div>
    );
  }

  if (!metrics) return null;

  const formatTrend = (change: number) => ({
    value: change > 0 ? `+${change.toFixed(1)}%` : `${change.toFixed(1)}%`,
    isPositive: change > 0,
    icon: change > 0 ? TrendingUp : TrendingDown
  });

  return (
    <div className="space-y-6">
      {/* Time Range Selector */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900">Realtidsanalys</h2>
        <div className="flex space-x-2">
          {(['7d', '30d', '90d'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1 text-sm rounded-md ${
                timeRange === range
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {range === '7d' ? '7 dagar' : range === '30d' ? '30 dagar' : '90 dagar'}
            </button>
          ))}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Feedback"
          value={metrics.totalFeedback.toString()}
          trend={formatTrend(metrics.trends.feedbackChange)}
          icon={Users}
          color="blue"
        />
        <MetricCard
          title="Genomsnittlig Kvalitet"
          value={`${metrics.averageQualityScore.toFixed(1)}/100`}
          trend={formatTrend(metrics.trends.scoreChange)}
          icon={Star}
          color="green"
        />
        <MetricCard
          title="Unika Kunder"
          value={metrics.uniqueCustomers.toString()}
          trend={formatTrend(metrics.trends.customerChange)}
          icon={Users}
          color="purple"
        />
        <MetricCard
          title="Total Belöning"
          value={`${metrics.totalRewards.toLocaleString('sv-SE')} kr`}
          trend={formatTrend(metrics.trends.rewardChange)}
          icon={Target}
          color="orange"
        />
      </div>

      {/* Quality Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <QualityBreakdownCard breakdown={metrics.qualityBreakdown} />
        <SentimentDistributionCard distribution={metrics.sentimentDistribution} />
      </div>

      {/* Top Categories */}
      <TopCategoriesCard categories={metrics.topCategories} />

      {/* AI Insights */}
      <AIInsightsCard insights={metrics.recentInsights} />
    </div>
  );
}

// Supporting components
interface MetricCardProps {
  title: string;
  value: string;
  trend: { value: string; isPositive: boolean; icon: any };
  icon: any;
  color: 'blue' | 'green' | 'purple' | 'orange';
}

function MetricCard({ title, value, trend, icon: Icon, color }: MetricCardProps) {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    purple: 'bg-purple-100 text-purple-600',
    orange: 'bg-orange-100 text-orange-600'
  };

  const TrendIcon = trend.icon;

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
      <div className="mt-4 flex items-center">
        <TrendIcon className={`w-4 h-4 ${trend.isPositive ? 'text-green-500' : 'text-red-500'}`} />
        <span className={`ml-1 text-sm font-medium ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
          {trend.value}
        </span>
        <span className="ml-2 text-sm text-gray-500">från föregående period</span>
      </div>
    </div>
  );
}

function QualityBreakdownCard({ breakdown }: { breakdown: BusinessMetrics['qualityBreakdown'] }) {
  return (
    <div className="card p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Kvalitetsfördelning</h3>
      <div className="space-y-4">
        {Object.entries(breakdown).map(([key, value]) => {
          const labels = {
            authenticity: 'Äkthet',
            concreteness: 'Konkrethet',
            depth: 'Djup'
          };
          
          return (
            <div key={key}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-700">{labels[key as keyof typeof labels]}</span>
                <span className="font-medium">{value.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${value}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SentimentDistributionCard({ distribution }: { distribution: BusinessMetrics['sentimentDistribution'] }) {
  return (
    <div className="card p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Sentimentfördelning</h3>
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
            <span className="text-sm text-gray-700">Positiv</span>
          </div>
          <span className="font-medium">{distribution.positive.toFixed(1)}%</span>
        </div>
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></div>
            <span className="text-sm text-gray-700">Neutral</span>
          </div>
          <span className="font-medium">{distribution.neutral.toFixed(1)}%</span>
        </div>
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
            <span className="text-sm text-gray-700">Negativ</span>
          </div>
          <span className="font-medium">{distribution.negative.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
}

function TopCategoriesCard({ categories }: { categories: BusinessMetrics['topCategories'] }) {
  return (
    <div className="card p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Mest Diskuterade Kategorier</h3>
      <div className="space-y-3">
        {categories.map((category, index) => (
          <div key={category.category} className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium mr-3">
                {index + 1}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{category.category}</p>
                <p className="text-xs text-gray-500">{category.count} omnämnanden</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">{category.averageScore.toFixed(1)}</p>
              <p className="text-xs text-gray-500">genomsnitt</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AIInsightsCard({ insights }: { insights: BusinessMetrics['recentInsights'] }) {
  const iconMap = {
    opportunity: '🎯',
    concern: '⚠️',
    achievement: '🏆'
  };

  const colorMap = {
    high: 'border-red-200 bg-red-50',
    medium: 'border-yellow-200 bg-yellow-50',
    low: 'border-blue-200 bg-blue-50'
  };

  return (
    <div className="card p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">AI-Insikter</h3>
      <div className="space-y-3">
        {insights.map((insight, index) => (
          <div key={index} className={`p-4 rounded-lg border ${colorMap[insight.impact]}`}>
            <div className="flex items-start space-x-3">
              <span className="text-lg">{iconMap[insight.type]}</span>
              <div className="flex-1">
                <h4 className="text-sm font-medium text-gray-900">{insight.title}</h4>
                <p className="text-sm text-gray-600 mt-1">{insight.description}</p>
                <span className="inline-block mt-2 px-2 py-1 text-xs font-medium bg-white border rounded">
                  {insight.impact === 'high' ? 'Hög påverkan' : 
                   insight.impact === 'medium' ? 'Medel påverkan' : 'Låg påverkan'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}