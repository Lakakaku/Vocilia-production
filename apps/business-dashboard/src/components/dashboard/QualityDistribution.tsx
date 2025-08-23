'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const distributionData = [
  { range: '0-20', count: 8, percentage: 3.2 },
  { range: '21-40', count: 15, percentage: 6.1 },
  { range: '41-60', count: 34, percentage: 13.8 },
  { range: '61-80', count: 127, percentage: 51.4 },
  { range: '81-100', count: 63, percentage: 25.5 },
];

export function QualityDistribution() {
  return (
    <div className="card">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Kvalitetsfördelning</h3>
        <p className="text-sm text-gray-600">Fördelning av feedback kvalitetspoäng</p>
      </div>
      
      <div className="p-6">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={distributionData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="range" 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#6b7280' }}
            />
            <YAxis 
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
              formatter={(value, name) => [
                `${value} feedback (${distributionData.find(d => d.count === value)?.percentage}%)`,
                'Antal'
              ]}
            />
            <Bar 
              dataKey="count" 
              fill="#8b5cf6"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
        
        <div className="mt-6 grid grid-cols-5 gap-4">
          {distributionData.map((item) => (
            <div key={item.range} className="text-center">
              <div className="text-2xl font-bold text-gray-900">{item.count}</div>
              <div className="text-sm text-gray-600">{item.range} poäng</div>
              <div className="text-xs text-gray-500">{item.percentage}%</div>
            </div>
          ))}
        </div>
        
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Genomsnittlig kvalitet:</span>
            <span className="font-semibold text-gray-900">73.5 poäng</span>
          </div>
          <div className="flex items-center justify-between text-sm mt-1">
            <span className="text-gray-600">Högsta möjliga belöning:</span>
            <span className="font-semibold text-green-600">25% cashback</span>
          </div>
        </div>
      </div>
    </div>
  );
}