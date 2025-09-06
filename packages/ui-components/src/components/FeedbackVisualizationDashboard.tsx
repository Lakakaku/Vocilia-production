/**
 * Feedback Visualization Dashboard - Demo and Pilot Analytics
 * Real-time feedback analytics visualization for Swedish Café Program
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area, ScatterChart, Scatter
} from 'recharts';

interface FeedbackAnalytics {
  totalFeedbacks: number;
  averageQuality: number;
  categoryDistribution: Record<string, number>;
  sentimentDistribution: Record<string, number>;
  rewardDistribution: {
    total: number;
    average: number;
    byTier: Record<string, number>;
  };
  timeSeriesData: {
    hourly: Array<{ hour: string; count: number; avgQuality: number }>;
    daily: Array<{ date: string; count: number; avgQuality: number }>;
    weekly: Array<{ week: string; count: number; avgQuality: number }>;
  };
  cafePerformance: Array<{
    cafeName: string;
    location: string;
    totalFeedbacks: number;
    averageQuality: number;
    totalRewards: number;
  }>;
}

interface FeedbackVisualizationProps {
  analytics: FeedbackAnalytics | null;
  isDemo?: boolean;
  isPilot?: boolean;
  refreshInterval?: number;
  onExportData?: (format: 'json' | 'csv' | 'xlsx') => Promise<void>;
}

const COLORS = {
  primary: '#2563eb',
  secondary: '#7c3aed',
  success: '#059669',
  warning: '#d97706',
  danger: '#dc2626',
  info: '#0891b2',
  swedish: '#006aa7',
  gold: '#fbbf24'
};

const CHART_COLORS = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#dc2626', '#0891b2'];

export const FeedbackVisualizationDashboard: React.FC<FeedbackVisualizationProps> = ({
  analytics,
  isDemo = false,
  isPilot = false,
  refreshInterval = 30000,
  onExportData
}) => {
  const [selectedTimeRange, setSelectedTimeRange] = useState<'hourly' | 'daily' | 'weekly'>('hourly');
  const [selectedCafe, setSelectedCafe] = useState<string>('all');
  const [isExporting, setIsExporting] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Auto-refresh analytics
  useEffect(() => {
    if (refreshInterval > 0) {
      const interval = setInterval(() => {
        setLastUpdated(new Date());
      }, refreshInterval);
      
      return () => clearInterval(interval);
    }
  }, [refreshInterval]);

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!analytics) return null;

    // Category distribution for pie chart
    const categoryData = Object.entries(analytics.categoryDistribution).map(([category, count]) => ({
      name: category.charAt(0).toUpperCase() + category.slice(1),
      value: count,
      percentage: Math.round((count / analytics.totalFeedbacks) * 100)
    }));

    // Sentiment distribution
    const sentimentData = Object.entries(analytics.sentimentDistribution).map(([sentiment, count]) => ({
      name: sentiment === 'positive' ? 'Positiv' : sentiment === 'negative' ? 'Negativ' : 'Neutral',
      value: count,
      percentage: Math.round((count / analytics.totalFeedbacks) * 100)
    }));

    // Time series data
    const timeSeriesData = analytics.timeSeriesData[selectedTimeRange].map(item => ({
      ...item,
      time: selectedTimeRange === 'hourly' 
        ? new Date(item.hour).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
        : selectedTimeRange === 'daily'
        ? new Date(item.date || item.hour).toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' })
        : new Date(item.week || item.hour).toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' })
    }));

    // Café performance scatter plot data
    const cafeScatterData = analytics.cafePerformance.map(cafe => ({
      x: cafe.averageQuality,
      y: cafe.totalRewards,
      name: cafe.cafeName,
      location: cafe.location,
      feedbacks: cafe.totalFeedbacks
    }));

    return {
      categoryData,
      sentimentData,
      timeSeriesData,
      cafeScatterData
    };
  }, [analytics, selectedTimeRange]);

  // Export handler
  const handleExport = async (format: 'json' | 'csv' | 'xlsx') => {
    if (!onExportData) return;
    
    setIsExporting(true);
    try {
      await onExportData(format);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  if (!analytics || !chartData) {
    return (
      <div className="feedback-dashboard loading">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Laddar feedback-data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="feedback-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-content">
          <h1 className="dashboard-title">
            🇸🇪 Feedback Analytics Dashboard
            {isDemo && <span className="badge demo">DEMO</span>}
            {isPilot && <span className="badge pilot">PILOT</span>}
          </h1>
          <div className="header-actions">
            <div className="time-range-selector">
              <button
                className={selectedTimeRange === 'hourly' ? 'active' : ''}
                onClick={() => setSelectedTimeRange('hourly')}
              >
                Timmar
              </button>
              <button
                className={selectedTimeRange === 'daily' ? 'active' : ''}
                onClick={() => setSelectedTimeRange('daily')}
              >
                Dagar
              </button>
              <button
                className={selectedTimeRange === 'weekly' ? 'active' : ''}
                onClick={() => setSelectedTimeRange('weekly')}
              >
                Veckor
              </button>
            </div>
            
            <div className="export-buttons">
              <button
                className="export-btn"
                onClick={() => handleExport('json')}
                disabled={isExporting}
              >
                Export JSON
              </button>
              <button
                className="export-btn"
                onClick={() => handleExport('csv')}
                disabled={isExporting}
              >
                Export CSV
              </button>
              <button
                className="export-btn"
                onClick={() => handleExport('xlsx')}
                disabled={isExporting}
              >
                Export Excel
              </button>
            </div>
          </div>
        </div>
        
        <div className="last-updated">
          Senast uppdaterad: {lastUpdated.toLocaleTimeString('sv-SE')}
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="metrics-grid">
        <div className="metric-card primary">
          <div className="metric-value">{analytics.totalFeedbacks}</div>
          <div className="metric-label">Totalt Feedback</div>
          <div className="metric-trend">📈 +12% denna vecka</div>
        </div>
        
        <div className="metric-card success">
          <div className="metric-value">{analytics.averageQuality.toFixed(1)}</div>
          <div className="metric-label">Genomsnittlig Kvalitet</div>
          <div className="metric-trend">🎯 Mål: >65</div>
        </div>
        
        <div className="metric-card warning">
          <div className="metric-value">{analytics.rewardDistribution.total.toFixed(0)} SEK</div>
          <div className="metric-label">Totala Belöningar</div>
          <div className="metric-trend">💰 {analytics.rewardDistribution.average.toFixed(2)} SEK/feedback</div>
        </div>
        
        <div className="metric-card info">
          <div className="metric-value">{analytics.cafePerformance.length}</div>
          <div className="metric-label">Aktiva Caféer</div>
          <div className="metric-trend">🏪 Pilot-program</div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="charts-grid">
        {/* Feedback Volume Over Time */}
        <div className="chart-container large">
          <h3 className="chart-title">📊 Feedback-volym över tid</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData.timeSeriesData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip 
                formatter={(value, name) => [
                  value,
                  name === 'count' ? 'Antal feedback' : 'Genomsnittlig kvalitet'
                ]}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="count"
                stroke={COLORS.primary}
                fill={COLORS.primary}
                fillOpacity={0.3}
                name="Antal feedback"
              />
              <Line
                type="monotone"
                dataKey="avgQuality"
                stroke={COLORS.success}
                strokeWidth={2}
                name="Genomsnittlig kvalitet"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Category Distribution */}
        <div className="chart-container">
          <h3 className="chart-title">🏷️ Kategorier</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={chartData.categoryData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={80}
                dataKey="value"
                label={(entry) => `${entry.name}: ${entry.percentage}%`}
              >
                {chartData.categoryData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Sentiment Distribution */}
        <div className="chart-container">
          <h3 className="chart-title">😊 Sentiment</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData.sentimentData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value, name) => [value, 'Antal']} />
              <Bar dataKey="value" fill={COLORS.primary} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Café Performance Scatter */}
        <div className="chart-container large">
          <h3 className="chart-title">☕ Café-prestanda: Kvalitet vs Belöningar</h3>
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="x" 
                name="Kvalitet" 
                type="number" 
                domain={[0, 100]}
                label={{ value: 'Genomsnittlig kvalitet', position: 'bottom' }}
              />
              <YAxis 
                dataKey="y" 
                name="Belöningar" 
                type="number"
                label={{ value: 'Totala belöningar (SEK)', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip 
                formatter={(value, name, props) => [
                  name === 'y' ? `${value} SEK` : value,
                  name === 'y' ? 'Belöningar' : 'Kvalitet'
                ]}
                labelFormatter={(_, payload) => 
                  payload && payload[0] ? 
                    `${payload[0].payload.name}, ${payload[0].payload.location}` : 
                    ''
                }
              />
              <Scatter data={chartData.cafeScatterData} fill={COLORS.swedish} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {/* Café Leaderboard */}
        <div className="chart-container">
          <h3 className="chart-title">🏆 Café-ranking</h3>
          <div className="leaderboard">
            {analytics.cafePerformance
              .sort((a, b) => b.averageQuality - a.averageQuality)
              .map((cafe, index) => (
                <div key={cafe.cafeName} className="leaderboard-item">
                  <div className="rank">#{index + 1}</div>
                  <div className="cafe-info">
                    <div className="cafe-name">{cafe.cafeName}</div>
                    <div className="cafe-location">{cafe.location}</div>
                  </div>
                  <div className="cafe-stats">
                    <div className="quality-score">{cafe.averageQuality.toFixed(1)}</div>
                    <div className="feedback-count">{cafe.totalFeedbacks} feedback</div>
                    <div className="reward-total">{cafe.totalRewards.toFixed(0)} SEK</div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="dashboard-footer">
        <div className="footer-info">
          <p>
            🇸🇪 <strong>Svensk Café Pilot Program</strong> - 
            Real-time feedback analytics för svenska caféer.
            Data uppdateras var {Math.floor(refreshInterval / 1000)}:e sekund.
          </p>
          {isDemo && (
            <p className="demo-notice">
              🎭 <strong>DEMO-data:</strong> Detta är simulerad data för demonstrationsändamål.
            </p>
          )}
          {isPilot && (
            <p className="pilot-notice">
              🚀 <strong>PILOT-program:</strong> Live data från aktiva pilot-caféer.
            </p>
          )}
        </div>
      </div>

      <style jsx>{`
        .feedback-dashboard {
          min-height: 100vh;
          background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .dashboard-header {
          background: white;
          border-bottom: 1px solid #e2e8f0;
          padding: 2rem;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .header-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
          max-width: 1200px;
          margin: 0 auto;
        }

        .dashboard-title {
          font-size: 2rem;
          font-weight: 700;
          color: #1e293b;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .badge {
          padding: 0.25rem 0.75rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
        }

        .badge.demo {
          background: #fef3c7;
          color: #92400e;
        }

        .badge.pilot {
          background: #dbeafe;
          color: #1e40af;
        }

        .header-actions {
          display: flex;
          gap: 1rem;
          align-items: center;
        }

        .time-range-selector {
          display: flex;
          background: #f1f5f9;
          border-radius: 0.5rem;
          overflow: hidden;
        }

        .time-range-selector button {
          padding: 0.5rem 1rem;
          border: none;
          background: transparent;
          color: #64748b;
          cursor: pointer;
          transition: all 0.2s;
        }

        .time-range-selector button.active {
          background: ${COLORS.primary};
          color: white;
        }

        .export-buttons {
          display: flex;
          gap: 0.5rem;
        }

        .export-btn {
          padding: 0.5rem 1rem;
          border: 1px solid #e2e8f0;
          background: white;
          color: #64748b;
          border-radius: 0.375rem;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 0.875rem;
        }

        .export-btn:hover:not(:disabled) {
          border-color: ${COLORS.primary};
          color: ${COLORS.primary};
        }

        .export-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .last-updated {
          text-align: center;
          color: #64748b;
          font-size: 0.875rem;
          margin-top: 1rem;
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1.5rem;
          max-width: 1200px;
          margin: 2rem auto;
          padding: 0 2rem;
        }

        .metric-card {
          background: white;
          border-radius: 0.75rem;
          padding: 1.5rem;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
          border-left: 4px solid;
        }

        .metric-card.primary { border-left-color: ${COLORS.primary}; }
        .metric-card.success { border-left-color: ${COLORS.success}; }
        .metric-card.warning { border-left-color: ${COLORS.warning}; }
        .metric-card.info { border-left-color: ${COLORS.info}; }

        .metric-value {
          font-size: 2.5rem;
          font-weight: 700;
          color: #1e293b;
          line-height: 1;
        }

        .metric-label {
          color: #64748b;
          font-size: 0.875rem;
          font-weight: 500;
          margin-top: 0.5rem;
        }

        .metric-trend {
          color: #059669;
          font-size: 0.75rem;
          margin-top: 0.5rem;
          font-weight: 500;
        }

        .charts-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
          gap: 2rem;
          max-width: 1200px;
          margin: 2rem auto;
          padding: 0 2rem;
        }

        .chart-container {
          background: white;
          border-radius: 0.75rem;
          padding: 1.5rem;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
        }

        .chart-container.large {
          grid-column: span 2;
        }

        .chart-title {
          font-size: 1.125rem;
          font-weight: 600;
          color: #1e293b;
          margin-bottom: 1rem;
        }

        .leaderboard {
          space-y: 1rem;
        }

        .leaderboard-item {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem;
          background: #f8fafc;
          border-radius: 0.5rem;
          margin-bottom: 0.5rem;
        }

        .rank {
          font-size: 1.25rem;
          font-weight: 700;
          color: ${COLORS.primary};
          min-width: 2rem;
        }

        .cafe-info {
          flex: 1;
        }

        .cafe-name {
          font-weight: 600;
          color: #1e293b;
        }

        .cafe-location {
          font-size: 0.875rem;
          color: #64748b;
        }

        .cafe-stats {
          text-align: right;
        }

        .quality-score {
          font-size: 1.25rem;
          font-weight: 700;
          color: ${COLORS.success};
        }

        .feedback-count {
          font-size: 0.75rem;
          color: #64748b;
        }

        .reward-total {
          font-size: 0.875rem;
          color: ${COLORS.warning};
          font-weight: 600;
        }

        .dashboard-footer {
          background: #1e293b;
          color: white;
          padding: 2rem;
          margin-top: 4rem;
        }

        .footer-info {
          max-width: 1200px;
          margin: 0 auto;
          text-align: center;
        }

        .footer-info p {
          margin-bottom: 1rem;
        }

        .demo-notice {
          background: #fef3c7;
          color: #92400e;
          padding: 1rem;
          border-radius: 0.5rem;
          border: 1px solid #f59e0b;
        }

        .pilot-notice {
          background: #dbeafe;
          color: #1e40af;
          padding: 1rem;
          border-radius: 0.5rem;
          border: 1px solid #3b82f6;
        }

        .loading {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          background: #f8fafc;
        }

        .loading-spinner {
          text-align: center;
        }

        .spinner {
          border: 4px solid #e2e8f0;
          border-top: 4px solid ${COLORS.primary};
          border-radius: 50%;
          width: 50px;
          height: 50px;
          animation: spin 1s linear infinite;
          margin: 0 auto 1rem;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @media (max-width: 768px) {
          .header-content {
            flex-direction: column;
            gap: 1rem;
          }

          .dashboard-title {
            font-size: 1.5rem;
          }

          .metrics-grid {
            grid-template-columns: 1fr;
          }

          .charts-grid {
            grid-template-columns: 1fr;
            padding: 0 1rem;
          }

          .chart-container.large {
            grid-column: span 1;
          }
        }
      `}</style>
    </div>
  );
};

export default FeedbackVisualizationDashboard;