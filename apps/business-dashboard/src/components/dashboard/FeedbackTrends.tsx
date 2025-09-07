'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Loader2, TrendingUp } from 'lucide-react';
import { useBusinessContext } from '@/contexts/BusinessContext';
import { useDashboardData } from '@/services/hooks';

export function FeedbackTrends() {
  const { businessId } = useBusinessContext();
  const { data: dashboardData, loading, error } = useDashboardData(businessId || '');

  if (loading) {
    return (
      <div className="card">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Feedback Trender</h3>
          <p className="text-sm text-gray-600">Feedback volym och genomsnittlig kvalitet över tid</p>
        </div>
        <div className="p-6 flex items-center justify-center h-80">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Feedback Trender</h3>
          <p className="text-sm text-gray-600">Feedback volym och genomsnittlig kvalitet över tid</p>
        </div>
        <div className="p-6 flex items-center justify-center h-80">
          <div className="text-center">
            <p className="text-red-600">Kunde inte ladda trenddata</p>
            <p className="text-sm text-gray-500 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // Generate empty trend data for new businesses
  const trendData = [];
  if (!dashboardData || dashboardData.totalSessions === 0) {
    // Empty state
    return (
      <div className="card">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Feedback Trender</h3>
          <p className="text-sm text-gray-600">Feedback volym och genomsnittlig kvalitet över tid</p>
        </div>
        <div className="p-6 flex items-center justify-center h-80">
          <div className="text-center">
            <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 font-medium">Inga trender än</p>
            <p className="text-sm text-gray-500 mt-1">
              Trender kommer att visas när du har fått feedback från kunder
            </p>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="card">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Feedback Trender</h3>
        <p className="text-sm text-gray-600">Feedback volym och genomsnittlig kvalitet över tid</p>
      </div>
      
      <div className="p-6">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="date" 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#6b7280' }}
            />
            <YAxis 
              yAxisId="left"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#6b7280' }}
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#6b7280' }}
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
              }}
            />
            <Line 
              yAxisId="left"
              type="monotone" 
              dataKey="feedback" 
              stroke="#3b82f6" 
              strokeWidth={3}
              dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
              name="Antal Feedback"
            />
            <Line 
              yAxisId="right"
              type="monotone" 
              dataKey="score" 
              stroke="#10b981" 
              strokeWidth={3}
              dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
              name="Genomsnittlig Poäng"
            />
          </LineChart>
        </ResponsiveContainer>
        
        <div className="mt-4 flex items-center justify-center space-x-6 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span className="text-gray-600">Antal Feedback</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="text-gray-600">Genomsnittlig Poäng</span>
          </div>
        </div>
      </div>
    </div>
  );
}