import React, { useState, useEffect, useCallback } from 'react';
import { POSProvider } from '@ai-feedback-platform/shared-types';
import { POSHealthMonitor, ProviderHealthStatus, HealthSummary } from '../monitoring/POSHealthMonitor';
import { POSIntegrationTestFramework, HealthCheckReport } from '../testing/POSIntegrationTestFramework';

/**
 * Integration Health Dashboard
 * 
 * Real-time health monitoring dashboard for all POS integrations
 * Shows connection status, performance metrics, and alerts
 */
export const IntegrationHealthDashboard: React.FC<DashboardProps> = ({
  providers = ['square', 'shopify', 'zettle'] as POSProvider[],
  refreshInterval = 60000, // 1 minute
  showPerformance = true,
  showAlerts = true,
  swedishLocale = true
}) => {
  const [healthStatus, setHealthStatus] = useState<Map<string, ProviderHealthStatus>>(new Map());
  const [healthSummary, setHealthSummary] = useState<HealthSummary | null>(null);
  const [performanceData, setPerformanceData] = useState<Map<string, PerformanceData>>(new Map());
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState<POSProvider | null>(null);

  // Initialize monitoring
  useEffect(() => {
    const monitor = new POSHealthMonitor();
    const testFramework = new POSIntegrationTestFramework();
    
    const startMonitoring = async () => {
      await monitor.startMonitoring(
        providers.map(p => ({
          provider: p,
          credentials: {}, // Would be provided from config
          checkInterval: refreshInterval
        }))
      );
      
      // Initial health check
      await updateHealthStatus(monitor, testFramework);
    };

    startMonitoring();

    // Set up periodic updates
    const interval = setInterval(async () => {
      await updateHealthStatus(monitor, testFramework);
    }, refreshInterval);

    // Listen to health events
    monitor.on('health:check', handleHealthCheck);
    monitor.on('health:state:changed', handleStateChange);
    monitor.on('alert:created', handleNewAlert);
    monitor.on('performance:anomaly', handlePerformanceAnomaly);

    return () => {
      clearInterval(interval);
      monitor.stopMonitoring();
    };
  }, [providers, refreshInterval]);

  const updateHealthStatus = async (monitor: POSHealthMonitor, framework: POSIntegrationTestFramework) => {
    setIsLoading(true);
    
    try {
      // Get health status from monitor
      const status = monitor.getHealthStatus();
      setHealthStatus(status as Map<string, ProviderHealthStatus>);
      
      // Get summary
      const summary = monitor.getHealthSummary();
      setHealthSummary(summary);
      
      // Get performance metrics
      const metrics = monitor.getPerformanceMetrics();
      const perfData = new Map<string, PerformanceData>();
      
      for (const [key, metric] of metrics.entries()) {
        perfData.set(key, {
          avgResponseTime: metric.averageResponseTime,
          successRate: metric.successRate,
          p95ResponseTime: metric.p95ResponseTime,
          p99ResponseTime: metric.p99ResponseTime,
          totalRequests: metric.totalRequests,
          failedRequests: metric.failedRequests
        });
      }
      
      setPerformanceData(perfData);
      
      // Get alerts
      const currentAlerts = monitor.getAlerts(true); // Unacknowledged only
      setAlerts(currentAlerts.map(a => ({
        id: a.id,
        severity: a.severity,
        provider: a.provider,
        message: a.message,
        timestamp: a.timestamp
      })));
      
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to update health status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleHealthCheck = useCallback((result: any) => {
    console.log('Health check completed:', result);
  }, []);

  const handleStateChange = useCallback((change: any) => {
    console.log('State changed:', change);
  }, []);

  const handleNewAlert = useCallback((alert: any) => {
    setAlerts(prev => [...prev, {
      id: alert.id,
      severity: alert.severity,
      provider: alert.provider,
      message: alert.message,
      timestamp: alert.timestamp
    }]);
  }, []);

  const handlePerformanceAnomaly = useCallback((anomaly: any) => {
    console.warn('Performance anomaly detected:', anomaly);
  }, []);

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'healthy': return '#10B981'; // green
      case 'degraded': return '#F59E0B'; // yellow
      case 'unhealthy': return '#EF4444'; // red
      default: return '#6B7280'; // gray
    }
  };

  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'critical': return '#DC2626';
      case 'warning': return '#F59E0B';
      case 'info': return '#3B82F6';
      default: return '#6B7280';
    }
  };

  const formatUptime = (uptime: number): string => {
    const hours = Math.floor(uptime / 3600000);
    const minutes = Math.floor((uptime % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  };

  const t = (key: string): string => {
    if (!swedishLocale) return translations.en[key] || key;
    return translations.sv[key] || key;
  };

  if (isLoading && healthStatus.size === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{t('loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          {t('integrationHealth')}
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          {t('lastUpdated')}: {lastUpdate.toLocaleTimeString()}
        </p>
      </div>

      {/* Summary Cards */}
      {healthSummary && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <SummaryCard
            title={t('totalProviders')}
            value={healthSummary.totalProviders}
            color="blue"
          />
          <SummaryCard
            title={t('healthy')}
            value={healthSummary.healthyProviders}
            color="green"
          />
          <SummaryCard
            title={t('degraded')}
            value={healthSummary.degradedProviders}
            color="yellow"
          />
          <SummaryCard
            title={t('unhealthy')}
            value={healthSummary.unhealthyProviders}
            color="red"
          />
        </div>
      )}

      {/* Provider Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {Array.from(healthStatus.entries()).map(([key, status]) => (
          <ProviderCard
            key={key}
            provider={status.provider}
            status={status}
            performance={performanceData.get(key)}
            onSelect={() => setSelectedProvider(status.provider)}
            selected={selectedProvider === status.provider}
            t={t}
          />
        ))}
      </div>

      {/* Performance Metrics */}
      {showPerformance && selectedProvider && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-4">
            {t('performanceMetrics')} - {selectedProvider}
          </h3>
          <PerformanceChart
            data={performanceData.get(selectedProvider) || performanceData.get(`${selectedProvider}_undefined`)}
            t={t}
          />
        </div>
      )}

      {/* Alerts */}
      {showAlerts && alerts.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-4">{t('activeAlerts')}</h3>
          <div className="space-y-2">
            {alerts.map(alert => (
              <AlertItem key={alert.id} alert={alert} t={t} />
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex space-x-4">
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          {t('refresh')}
        </button>
        <button
          onClick={() => console.log('Run tests')}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          {t('runTests')}
        </button>
        <button
          onClick={() => console.log('Export report')}
          className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
        >
          {t('exportReport')}
        </button>
      </div>
    </div>
  );
};

// Component: Summary Card
const SummaryCard: React.FC<{
  title: string;
  value: number;
  color: string;
}> = ({ title, value, color }) => {
  const bgColor = {
    blue: 'bg-blue-100',
    green: 'bg-green-100',
    yellow: 'bg-yellow-100',
    red: 'bg-red-100'
  }[color] || 'bg-gray-100';

  const textColor = {
    blue: 'text-blue-800',
    green: 'text-green-800',
    yellow: 'text-yellow-800',
    red: 'text-red-800'
  }[color] || 'text-gray-800';

  return (
    <div className={`p-4 rounded-lg ${bgColor}`}>
      <p className="text-sm font-medium text-gray-600">{title}</p>
      <p className={`text-2xl font-bold ${textColor}`}>{value}</p>
    </div>
  );
};

// Component: Provider Card
const ProviderCard: React.FC<{
  provider: POSProvider;
  status: ProviderHealthStatus;
  performance?: PerformanceData;
  onSelect: () => void;
  selected: boolean;
  t: (key: string) => string;
}> = ({ provider, status, performance, onSelect, selected, t }) => {
  const statusColor = getStatusColor(status.status);
  
  return (
    <div
      className={`p-4 border rounded-lg cursor-pointer transition-all ${
        selected ? 'border-blue-500 shadow-lg' : 'border-gray-200 hover:shadow-md'
      }`}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-lg capitalize">{provider}</h4>
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: statusColor }}
        />
      </div>
      
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">{t('status')}:</span>
          <span className="font-medium" style={{ color: statusColor }}>
            {t(status.status)}
          </span>
        </div>
        
        {performance && (
          <>
            <div className="flex justify-between">
              <span className="text-gray-600">{t('successRate')}:</span>
              <span className="font-medium">
                {performance.successRate.toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{t('avgResponse')}:</span>
              <span className="font-medium">
                {performance.avgResponseTime.toFixed(0)}ms
              </span>
            </div>
          </>
        )}
        
        <div className="flex justify-between">
          <span className="text-gray-600">{t('lastCheck')}:</span>
          <span className="font-medium">
            {new Date(status.lastCheck).toLocaleTimeString()}
          </span>
        </div>
      </div>
      
      {status.lastError && (
        <div className="mt-3 p-2 bg-red-50 rounded text-xs text-red-600">
          {status.lastError.message}
        </div>
      )}
    </div>
  );
};

// Component: Performance Chart
const PerformanceChart: React.FC<{
  data?: PerformanceData;
  t: (key: string) => string;
}> = ({ data, t }) => {
  if (!data) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <MetricCard
        label={t('totalRequests')}
        value={data.totalRequests.toString()}
      />
      <MetricCard
        label={t('failedRequests')}
        value={data.failedRequests.toString()}
        color="red"
      />
      <MetricCard
        label={t('p95Latency')}
        value={`${data.p95ResponseTime.toFixed(0)}ms`}
      />
      <MetricCard
        label={t('p99Latency')}
        value={`${data.p99ResponseTime.toFixed(0)}ms`}
      />
    </div>
  );
};

// Component: Metric Card
const MetricCard: React.FC<{
  label: string;
  value: string;
  color?: string;
}> = ({ label, value, color = 'gray' }) => {
  const textColor = color === 'red' ? 'text-red-600' : 'text-gray-900';
  
  return (
    <div className="p-3 bg-gray-50 rounded">
      <p className="text-xs text-gray-600 mb-1">{label}</p>
      <p className={`text-lg font-semibold ${textColor}`}>{value}</p>
    </div>
  );
};

// Component: Alert Item
const AlertItem: React.FC<{
  alert: Alert;
  t: (key: string) => string;
}> = ({ alert, t }) => {
  const bgColor = {
    critical: 'bg-red-50 border-red-200',
    warning: 'bg-yellow-50 border-yellow-200',
    info: 'bg-blue-50 border-blue-200'
  }[alert.severity] || 'bg-gray-50 border-gray-200';

  const iconColor = {
    critical: 'text-red-600',
    warning: 'text-yellow-600',
    info: 'text-blue-600'
  }[alert.severity] || 'text-gray-600';

  return (
    <div className={`p-3 border rounded-lg ${bgColor}`}>
      <div className="flex items-start">
        <div className={`mt-0.5 ${iconColor}`}>
          <AlertIcon severity={alert.severity} />
        </div>
        <div className="ml-3 flex-1">
          <p className="text-sm font-medium text-gray-900">
            {alert.provider ? `${alert.provider}: ` : ''}{alert.message}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {new Date(alert.timestamp).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
};

// Component: Alert Icon
const AlertIcon: React.FC<{ severity: string }> = ({ severity }) => {
  if (severity === 'critical') {
    return (
      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
    );
  }
  
  if (severity === 'warning') {
    return (
      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
    );
  }
  
  return (
    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
    </svg>
  );
};

// Type definitions
interface DashboardProps {
  providers?: POSProvider[];
  refreshInterval?: number;
  showPerformance?: boolean;
  showAlerts?: boolean;
  swedishLocale?: boolean;
}

interface PerformanceData {
  avgResponseTime: number;
  successRate: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  totalRequests: number;
  failedRequests: number;
}

interface Alert {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  provider?: POSProvider;
  message: string;
  timestamp: Date;
}

// Translations
const translations = {
  en: {
    integrationHealth: 'POS Integration Health',
    lastUpdated: 'Last updated',
    loading: 'Loading health status...',
    totalProviders: 'Total Providers',
    healthy: 'Healthy',
    degraded: 'Degraded',
    unhealthy: 'Unhealthy',
    status: 'Status',
    successRate: 'Success Rate',
    avgResponse: 'Avg Response',
    lastCheck: 'Last Check',
    performanceMetrics: 'Performance Metrics',
    totalRequests: 'Total Requests',
    failedRequests: 'Failed Requests',
    p95Latency: 'P95 Latency',
    p99Latency: 'P99 Latency',
    activeAlerts: 'Active Alerts',
    refresh: 'Refresh',
    runTests: 'Run Tests',
    exportReport: 'Export Report'
  },
  sv: {
    integrationHealth: 'POS-integrationshälsa',
    lastUpdated: 'Senast uppdaterad',
    loading: 'Laddar hälsostatus...',
    totalProviders: 'Totala Leverantörer',
    healthy: 'Frisk',
    degraded: 'Försämrad',
    unhealthy: 'Ohälsosam',
    status: 'Status',
    successRate: 'Framgångsgrad',
    avgResponse: 'Genomsnittlig svar',
    lastCheck: 'Senaste kontroll',
    performanceMetrics: 'Prestandamått',
    totalRequests: 'Totala förfrågningar',
    failedRequests: 'Misslyckade förfrågningar',
    p95Latency: 'P95 Latens',
    p99Latency: 'P99 Latens',
    activeAlerts: 'Aktiva varningar',
    refresh: 'Uppdatera',
    runTests: 'Kör tester',
    exportReport: 'Exportera rapport'
  }
};

export default IntegrationHealthDashboard;