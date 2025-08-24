'use client';

import { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  Download, 
  Calendar,
  MapPin,
  Star,
  MessageSquare,
  Users,
  DollarSign
} from 'lucide-react';

interface LocationMetrics {
  locationId: string;
  locationName: string;
  city: string;
  totalFeedbacks: number;
  averageQualityScore: number;
  totalRewardsPaid: number;
  averageRewardPerFeedback: number;
  customerReturnRate: number;
  topCategories: string[];
  sentiment: {
    positive: number;
    neutral: number;
    negative: number;
  };
  trendData: {
    feedbacksLastMonth: number;
    qualityScoreLastMonth: number;
    rewardsLastMonth: number;
  };
}

interface ComparisonFilters {
  timeRange: '7d' | '30d' | '90d' | '1y';
  metric: 'feedbacks' | 'quality' | 'rewards' | 'sentiment';
}

export function LocationComparison() {
  const [locations, setLocations] = useState<LocationMetrics[]>([]);
  const [filters, setFilters] = useState<ComparisonFilters>({
    timeRange: '30d',
    metric: 'feedbacks'
  });
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState<keyof LocationMetrics>('totalFeedbacks');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    // Mock data - in real implementation, this would fetch from API
    setTimeout(() => {
      setLocations([
        {
          locationId: '1',
          locationName: 'Café Aurora - Stockholm',
          city: 'Stockholm',
          totalFeedbacks: 1247,
          averageQualityScore: 78.5,
          totalRewardsPaid: 24687,
          averageRewardPerFeedback: 19.8,
          customerReturnRate: 34.2,
          topCategories: ['Service', 'Kvalitet', 'Miljö'],
          sentiment: { positive: 68, neutral: 24, negative: 8 },
          trendData: {
            feedbacksLastMonth: 1156,
            qualityScoreLastMonth: 76.2,
            rewardsLastMonth: 22890
          }
        },
        {
          locationId: '2',
          locationName: 'Café Aurora - Malmö',
          city: 'Malmö',
          totalFeedbacks: 892,
          averageQualityScore: 82.1,
          totalRewardsPaid: 19456,
          averageRewardPerFeedback: 21.8,
          customerReturnRate: 41.5,
          topCategories: ['Kvalitet', 'Service', 'Utbud'],
          sentiment: { positive: 74, neutral: 20, negative: 6 },
          trendData: {
            feedbacksLastMonth: 798,
            qualityScoreLastMonth: 79.8,
            rewardsLastMonth: 17234
          }
        },
        {
          locationId: '3',
          locationName: 'Café Aurora - Göteborg',
          city: 'Göteborg',
          totalFeedbacks: 654,
          averageQualityScore: 75.3,
          totalRewardsPaid: 12789,
          averageRewardPerFeedback: 19.6,
          customerReturnRate: 28.7,
          topCategories: ['Miljö', 'Service', 'Pris'],
          sentiment: { positive: 62, neutral: 28, negative: 10 },
          trendData: {
            feedbacksLastMonth: 598,
            qualityScoreLastMonth: 73.9,
            rewardsLastMonth: 11567
          }
        }
      ]);
      setIsLoading(false);
    }, 1000);
  }, [filters.timeRange]);

  const sortedLocations = [...locations].sort((a, b) => {
    const aVal = a[sortBy];
    const bVal = b[sortBy];
    
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
    }
    
    const aStr = String(aVal);
    const bStr = String(bVal);
    return sortOrder === 'desc' 
      ? bStr.localeCompare(aStr, 'sv') 
      : aStr.localeCompare(bStr, 'sv');
  });

  const handleSort = (key: keyof LocationMetrics) => {
    if (sortBy === key) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(key);
      setSortOrder('desc');
    }
  };

  const formatTrend = (current: number, previous: number) => {
    const change = ((current - previous) / previous) * 100;
    const isPositive = change > 0;
    const TrendIcon = isPositive ? TrendingUp : TrendingDown;
    
    return (
      <div className={`flex items-center gap-1 text-sm ${
        isPositive ? 'text-green-600' : 'text-red-600'
      }`}>
        <TrendIcon className="w-3 h-3" />
        <span>{Math.abs(change).toFixed(1)}%</span>
      </div>
    );
  };


  const handleExport = () => {
    // In real implementation, this would generate and download a report
    const csvData = [
      ['Plats', 'Stad', 'Feedback', 'Kvalitetspoäng', 'Belöningar', 'Sentiment'],
      ...sortedLocations.map(loc => [
        loc.locationName,
        loc.city,
        loc.totalFeedbacks.toString(),
        loc.averageQualityScore.toFixed(1),
        `${loc.totalRewardsPaid} SEK`,
        `${loc.sentiment.positive}% pos`
      ])
    ];
    
    const csv = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `platsvergleich-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with filters and export */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Platsjämförelse</h2>
          <p className="text-gray-600">Jämför prestanda mellan dina olika platser</p>
        </div>
        
        <div className="flex gap-4">
          {/* Time range filter */}
          <select
            value={filters.timeRange}
            onChange={(e) => setFilters({...filters, timeRange: e.target.value as any})}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="7d">Senaste 7 dagarna</option>
            <option value="30d">Senaste 30 dagarna</option>
            <option value="90d">Senaste 90 dagarna</option>
            <option value="1y">Senaste året</option>
          </select>

          {/* Export button */}
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
          >
            <Download className="w-4 h-4" />
            Exportera
          </button>
        </div>
      </div>

      {/* Comparison overview cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Totalt feedback</p>
              <p className="text-2xl font-bold text-gray-900">
                {locations.reduce((sum, loc) => sum + loc.totalFeedbacks, 0).toLocaleString()}
              </p>
            </div>
            <MessageSquare className="w-8 h-8 text-primary-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Genomsnittlig kvalitet</p>
              <p className="text-2xl font-bold text-gray-900">
                {(locations.reduce((sum, loc) => sum + loc.averageQualityScore, 0) / locations.length).toFixed(1)}
              </p>
            </div>
            <Star className="w-8 h-8 text-yellow-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Totala belöningar</p>
              <p className="text-2xl font-bold text-gray-900">
                {locations.reduce((sum, loc) => sum + loc.totalRewardsPaid, 0).toLocaleString()} SEK
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Återkommande kunder</p>
              <p className="text-2xl font-bold text-gray-900">
                {(locations.reduce((sum, loc) => sum + loc.customerReturnRate, 0) / locations.length).toFixed(1)}%
              </p>
            </div>
            <Users className="w-8 h-8 text-blue-500" />
          </div>
        </div>
      </div>

      {/* Location comparison table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('locationName')}
                >
                  <div className="flex items-center gap-2">
                    Plats
                    {sortBy === 'locationName' && (
                      sortOrder === 'desc' ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('totalFeedbacks')}
                >
                  <div className="flex items-center gap-2">
                    Feedback
                    {sortBy === 'totalFeedbacks' && (
                      sortOrder === 'desc' ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('averageQualityScore')}
                >
                  <div className="flex items-center gap-2">
                    Kvalitetspoäng
                    {sortBy === 'averageQualityScore' && (
                      sortOrder === 'desc' ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('totalRewardsPaid')}
                >
                  <div className="flex items-center gap-2">
                    Belöningar
                    {sortBy === 'totalRewardsPaid' && (
                      sortOrder === 'desc' ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />
                    )}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sentiment
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Trend
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('customerReturnRate')}
                >
                  <div className="flex items-center gap-2">
                    Återkommande
                    {sortBy === 'customerReturnRate' && (
                      sortOrder === 'desc' ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />
                    )}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedLocations.map((location, index) => (
                <tr key={location.locationId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <MapPin className="w-4 h-4 text-gray-400 mr-2" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {location.locationName}
                        </div>
                        <div className="text-sm text-gray-500">{location.city}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {location.totalFeedbacks.toLocaleString()}
                    </div>
                    {formatTrend(location.totalFeedbacks, location.trendData.feedbacksLastMonth)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="text-sm text-gray-900">
                        {location.averageQualityScore.toFixed(1)}
                      </div>
                      <div className="ml-2 w-16 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-primary-600 h-2 rounded-full" 
                          style={{ width: `${location.averageQualityScore}%` }}
                        />
                      </div>
                    </div>
                    {formatTrend(location.averageQualityScore, location.trendData.qualityScoreLastMonth)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {location.totalRewardsPaid.toLocaleString()} SEK
                    </div>
                    <div className="text-xs text-gray-500">
                      {location.averageRewardPerFeedback.toFixed(1)} SEK/feedback
                    </div>
                    {formatTrend(location.totalRewardsPaid, location.trendData.rewardsLastMonth)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div className="flex h-2 rounded-full">
                          <div 
                            className="bg-green-500 rounded-l-full" 
                            style={{ width: `${location.sentiment.positive}%` }}
                          />
                          <div 
                            className="bg-yellow-400" 
                            style={{ width: `${location.sentiment.neutral}%` }}
                          />
                          <div 
                            className="bg-red-500 rounded-r-full" 
                            style={{ width: `${location.sentiment.negative}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {location.sentiment.positive}% positiv
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-xs text-gray-500 space-y-1">
                      <div>F: {formatTrend(location.totalFeedbacks, location.trendData.feedbacksLastMonth)}</div>
                      <div>K: {formatTrend(location.averageQualityScore, location.trendData.qualityScoreLastMonth)}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {location.customerReturnRate.toFixed(1)}%
                    </div>
                    <div className="w-16 bg-gray-200 rounded-full h-1.5 mt-1">
                      <div 
                        className="bg-blue-500 h-1.5 rounded-full" 
                        style={{ width: `${location.customerReturnRate}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top performers section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Bäst feedback-volym
          </h3>
          <div className="space-y-3">
            {sortedLocations.slice(0, 3).map((location, index) => (
              <div key={location.locationId} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                    index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : 'bg-orange-500'
                  }`}>
                    {index + 1}
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {location.city}
                  </span>
                </div>
                <span className="text-sm text-gray-600">
                  {location.totalFeedbacks.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Högst kvalitetspoäng
          </h3>
          <div className="space-y-3">
            {[...locations]
              .sort((a, b) => b.averageQualityScore - a.averageQualityScore)
              .slice(0, 3)
              .map((location, index) => (
                <div key={location.locationId} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                      index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : 'bg-orange-500'
                    }`}>
                      {index + 1}
                    </div>
                    <span className="text-sm font-medium text-gray-900">
                      {location.city}
                    </span>
                  </div>
                  <span className="text-sm text-gray-600">
                    {location.averageQualityScore.toFixed(1)}
                  </span>
                </div>
              ))
            }
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Bäst kundlojalitet
          </h3>
          <div className="space-y-3">
            {[...locations]
              .sort((a, b) => b.customerReturnRate - a.customerReturnRate)
              .slice(0, 3)
              .map((location, index) => (
                <div key={location.locationId} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                      index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : 'bg-orange-500'
                    }`}>
                      {index + 1}
                    </div>
                    <span className="text-sm font-medium text-gray-900">
                      {location.city}
                    </span>
                  </div>
                  <span className="text-sm text-gray-600">
                    {location.customerReturnRate.toFixed(1)}%
                  </span>
                </div>
              ))
            }
          </div>
        </div>
      </div>
    </div>
  );
}