'use client';

import { useState, useEffect } from 'react';
import { Users, TrendingUp, TrendingDown, Star, MessageSquare, Award, AlertTriangle } from 'lucide-react';

// Types for staff performance data
interface StaffMember {
  id: string;
  name: string;
  role: string;
  department: string;
  avatar?: string;
  startDate: string;
  metrics: {
    feedbackCount: number;
    averageScore: number;
    mentionCount: number;
    positiveRatio: number;
    improvementAreas: string[];
    strengths: string[];
    trend: 'up' | 'down' | 'stable';
    trendPercentage: number;
  };
  recentFeedback: Array<{
    date: string;
    score: number;
    comment: string;
    sentiment: 'positive' | 'neutral' | 'negative';
  }>;
}

interface DepartmentMetrics {
  department: string;
  averageScore: number;
  staffCount: number;
  topPerformer: string;
  improvementNeeded: string[];
  trend: 'up' | 'down' | 'stable';
}

export function StaffPerformanceTracker() {
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [departmentMetrics, setDepartmentMetrics] = useState<DepartmentMetrics[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [sortBy, setSortBy] = useState<'score' | 'mentions' | 'trend'>('score');

  useEffect(() => {
    loadStaffData();
  }, [timeRange]);

  const loadStaffData = async () => {
    try {
      setLoading(true);
      // TODO: Replace with actual API call
      // const response = await fetch(`/api/business/staff/performance?range=${timeRange}`);
      
      // Mock data
      const mockStaffData: StaffMember[] = [
        {
          id: '1',
          name: 'Anna Andersson',
          role: 'Barista',
          department: 'Café',
          startDate: '2023-06-15',
          metrics: {
            feedbackCount: 45,
            averageScore: 78.5,
            mentionCount: 32,
            positiveRatio: 85.2,
            improvementAreas: ['Hastighet i ruschtrafik'],
            strengths: ['Vänlig service', 'Kaffekunnighet'],
            trend: 'up',
            trendPercentage: 12.3
          },
          recentFeedback: [
            {
              date: '2024-12-18',
              score: 82,
              comment: 'Anna var mycket hjälpsam och gjorde fantastiskt kaffe',
              sentiment: 'positive'
            },
            {
              date: '2024-12-17',
              score: 75,
              comment: 'Bra service men lite långsam',
              sentiment: 'neutral'
            }
          ]
        },
        {
          id: '2',
          name: 'Erik Eriksson',
          role: 'Kassör',
          department: 'Butik',
          startDate: '2023-03-10',
          metrics: {
            feedbackCount: 67,
            averageScore: 72.1,
            mentionCount: 28,
            positiveRatio: 78.5,
            improvementAreas: ['Produktkännedom', 'Upselling'],
            strengths: ['Snabb kassaköring', 'Pålitlig'],
            trend: 'down',
            trendPercentage: -5.8
          },
          recentFeedback: [
            {
              date: '2024-12-19',
              score: 68,
              comment: 'Erik var snabb men kunde inte svara på frågor om produkterna',
              sentiment: 'neutral'
            }
          ]
        },
        {
          id: '3',
          name: 'Maria Svensson',
          role: 'Skiftledare',
          department: 'Café',
          startDate: '2022-11-20',
          metrics: {
            feedbackCount: 89,
            averageScore: 84.3,
            mentionCount: 56,
            positiveRatio: 91.2,
            improvementAreas: [],
            strengths: ['Ledarskap', 'Problemlösning', 'Kundservice'],
            trend: 'up',
            trendPercentage: 8.7
          },
          recentFeedback: [
            {
              date: '2024-12-19',
              score: 88,
              comment: 'Maria löste problemet snabbt och professionellt',
              sentiment: 'positive'
            }
          ]
        }
      ];

      const mockDepartmentData: DepartmentMetrics[] = [
        {
          department: 'Café',
          averageScore: 81.4,
          staffCount: 5,
          topPerformer: 'Maria Svensson',
          improvementNeeded: ['Hastighet under rush'],
          trend: 'up'
        },
        {
          department: 'Butik',
          averageScore: 74.8,
          staffCount: 3,
          topPerformer: 'Lisa Johansson',
          improvementNeeded: ['Produktkännedom', 'Upselling'],
          trend: 'stable'
        }
      ];

      await new Promise(resolve => setTimeout(resolve, 800));
      setStaffMembers(mockStaffData);
      setDepartmentMetrics(mockDepartmentData);
    } catch (error) {
      console.error('Failed to load staff data:', error);
    } finally {
      setLoading(false);
    }
  };

  const sortedStaff = [...staffMembers].sort((a, b) => {
    switch (sortBy) {
      case 'score':
        return b.metrics.averageScore - a.metrics.averageScore;
      case 'mentions':
        return b.metrics.mentionCount - a.metrics.mentionCount;
      case 'trend':
        return b.metrics.trendPercentage - a.metrics.trendPercentage;
      default:
        return 0;
    }
  });

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'down':
        return <TrendingDown className="w-4 h-4 text-red-500" />;
      default:
        return <div className="w-4 h-4 bg-gray-400 rounded-full" />;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-100';
    if (score >= 70) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="card p-6">
                <div className="h-6 bg-gray-200 rounded mb-4"></div>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Personalprestation</h2>
          <p className="text-gray-600">Följ upp personalens prestation baserat på kundåterkoppling</p>
        </div>

        <div className="flex space-x-3">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="score">Sortera på betyg</option>
            <option value="mentions">Sortera på omnämnanden</option>
            <option value="trend">Sortera på trend</option>
          </select>

          <div className="flex space-x-2">
            {(['7d', '30d', '90d'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-2 text-sm rounded-md ${
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
      </div>

      {/* Department Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {departmentMetrics.map(dept => (
          <div key={dept.department} className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">{dept.department}</h3>
              {getTrendIcon(dept.trend)}
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Genomsnittligt betyg:</span>
                <span className={`px-2 py-1 rounded-full text-sm font-medium ${getScoreColor(dept.averageScore)}`}>
                  {dept.averageScore.toFixed(1)}
                </span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-600">Antal anställda:</span>
                <span className="font-medium">{dept.staffCount}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-600">Topprestanda:</span>
                <span className="font-medium text-green-600">{dept.topPerformer}</span>
              </div>
              
              {dept.improvementNeeded.length > 0 && (
                <div>
                  <span className="text-gray-600 text-sm">Förbättringsområden:</span>
                  <div className="mt-1">
                    {dept.improvementNeeded.map((area, index) => (
                      <span key={index} className="inline-block bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-full mr-2">
                        {area}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Staff List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {sortedStaff.map(staff => (
          <div key={staff.id} className="card p-6 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setSelectedStaff(staff)}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 font-medium">{staff.name.charAt(0)}</span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{staff.name}</h3>
                  <p className="text-sm text-gray-600">{staff.role}</p>
                </div>
              </div>
              {getTrendIcon(staff.metrics.trend)}
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Genomsnitt:</span>
                <span className={`px-2 py-1 rounded-full text-sm font-medium ${getScoreColor(staff.metrics.averageScore)}`}>
                  {staff.metrics.averageScore.toFixed(1)}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-600">Omnämnd:</span>
                <div className="flex items-center space-x-2">
                  <MessageSquare className="w-4 h-4 text-gray-400" />
                  <span className="font-medium">{staff.metrics.mentionCount} gånger</span>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-600">Positiv ratio:</span>
                <span className="font-medium text-green-600">{staff.metrics.positiveRatio.toFixed(1)}%</span>
              </div>

              <div className="flex items-center space-x-2">
                <span className={`text-sm font-medium ${staff.metrics.trend === 'up' ? 'text-green-600' : staff.metrics.trend === 'down' ? 'text-red-600' : 'text-gray-600'}`}>
                  {staff.metrics.trend === 'up' ? '+' : staff.metrics.trend === 'down' ? '-' : '±'}
                  {Math.abs(staff.metrics.trendPercentage).toFixed(1)}%
                </span>
                <span className="text-xs text-gray-500">sen förra perioden</span>
              </div>
            </div>

            {/* Strengths & Areas for Improvement */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              {staff.metrics.strengths.length > 0 && (
                <div className="mb-2">
                  <div className="flex items-center space-x-1 mb-1">
                    <Star className="w-3 h-3 text-green-500" />
                    <span className="text-xs font-medium text-green-700">Styrkor:</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {staff.metrics.strengths.map((strength, index) => (
                      <span key={index} className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                        {strength}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {staff.metrics.improvementAreas.length > 0 && (
                <div>
                  <div className="flex items-center space-x-1 mb-1">
                    <AlertTriangle className="w-3 h-3 text-orange-500" />
                    <span className="text-xs font-medium text-orange-700">Förbättra:</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {staff.metrics.improvementAreas.map((area, index) => (
                      <span key={index} className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-full">
                        {area}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Detailed Staff Modal */}
      {selectedStaff && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-screen overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 font-bold text-lg">{selectedStaff.name.charAt(0)}</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{selectedStaff.name}</h3>
                    <p className="text-gray-600">{selectedStaff.role} • {selectedStaff.department}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedStaff(null)}
                  className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Performance Metrics */}
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Prestationsöversikt</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-gray-900">{selectedStaff.metrics.averageScore.toFixed(1)}</div>
                    <div className="text-sm text-gray-600">Genomsnittligt betyg</div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-gray-900">{selectedStaff.metrics.feedbackCount}</div>
                    <div className="text-sm text-gray-600">Total feedback</div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-gray-900">{selectedStaff.metrics.mentionCount}</div>
                    <div className="text-sm text-gray-600">Namngjord i feedback</div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{selectedStaff.metrics.positiveRatio.toFixed(1)}%</div>
                    <div className="text-sm text-gray-600">Positiv feedback</div>
                  </div>
                </div>
              </div>

              {/* Recent Feedback */}
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Senaste Feedback</h4>
                <div className="space-y-3">
                  {selectedStaff.recentFeedback.map((feedback, index) => (
                    <div key={index} className="bg-gray-50 p-4 rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-sm text-gray-600">{feedback.date}</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getScoreColor(feedback.score)}`}>
                          {feedback.score}
                        </span>
                      </div>
                      <p className="text-sm text-gray-800">"{feedback.comment}"</p>
                      <div className="mt-2">
                        <span className={`inline-block px-2 py-1 rounded-full text-xs ${
                          feedback.sentiment === 'positive' ? 'bg-green-100 text-green-800' :
                          feedback.sentiment === 'negative' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {feedback.sentiment === 'positive' ? 'Positiv' :
                           feedback.sentiment === 'negative' ? 'Negativ' : 'Neutral'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}