import React, { useState, useEffect } from 'react';
import { authManager } from '../utils/auth';

// System health types
interface SystemHealthMetrics {
  overview: {
    uptime: number; // seconds
    uptimePercentage: number;
    totalRequests: number;
    requestsPerSecond: number;
    lastHealthCheck: string;
    systemVersion: string;
  };
  performance: {
    apiLatency: {
      current: number;
      average: number;
      p95: number;
      p99: number;
    };
    throughput: {
      current: number;
      average: number;
      peak: number;
    };
    errorRates: {
      current: number;
      average: number;
      critical: number;
    };
  };
  capacity: {
    cpu: {
      usage: number;
      cores: number;
      load: number;
    };
    memory: {
      used: number;
      total: number;
      usage: number;
    };
    storage: {
      used: number;
      total: number;
      usage: number;
    };
    database: {
      connections: number;
      maxConnections: number;
      slowQueries: number;
    };
  };
  services: {
    aiService: {
      status: 'healthy' | 'degraded' | 'down';
      responseTime: number;
      successRate: number;
      queueSize: number;
    };
    voiceService: {
      status: 'healthy' | 'degraded' | 'down';
      responseTime: number;
      activeSessions: number;
      processingQueue: number;
    };
    database: {
      status: 'healthy' | 'degraded' | 'down';
      responseTime: number;
      connectionPool: number;
    };
    paymentService: {
      status: 'healthy' | 'degraded' | 'down';
      responseTime: number;
      transactionSuccess: number;
    };
  };
}

interface SwedishPilotMetrics {
  regional: {
    stockholm: {
      businesses: number;
      activeSessions: number;
      averageScore: number;
      monthlyRevenue: number;
    };
    goteborg: {
      businesses: number;
      activeSessions: number;
      averageScore: number;
      monthlyRevenue: number;
    };
    malmo: {
      businesses: number;
      activeSessions: number;
      averageScore: number;
      monthlyRevenue: number;
    };
    other: {
      businesses: number;
      activeSessions: number;
      averageScore: number;
      monthlyRevenue: number;
    };
  };
  businessTypes: {
    cafes: {
      count: number;
      averageScore: number;
      topPerformers: string[];
      commonIssues: string[];
    };
    restaurants: {
      count: number;
      averageScore: number;
      topPerformers: string[];
      commonIssues: string[];
    };
    retail: {
      count: number;
      averageScore: number;
      topPerformers: string[];
      commonIssues: string[];
    };
  };
  languageMetrics: {
    swedishAccuracy: number;
    dialectRecognition: number;
    commonMisunderstandings: string[];
  };
}

interface ScalingRecommendation {
  type: 'scale_up' | 'scale_down' | 'optimize' | 'alert';
  component: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  recommendation: string;
  estimatedImpact: string;
  timeframe: string;
}

export default function SystemMetricsPage() {
  const [systemHealth, setSystemHealth] = useState<SystemHealthMetrics | null>(null);
  const [swedishMetrics, setSwedishMetrics] = useState<SwedishPilotMetrics | null>(null);
  const [scalingRecommendations, setScalingRecommendations] = useState<ScalingRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState<'system' | 'regional' | 'capacity' | 'services'>('system');

  useEffect(() => {
    const fetchSystemMetrics = async () => {
      try {
        const response = await authManager.makeAuthenticatedRequest('/api/admin/system-metrics', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });

        if (response.success) {
          setSystemHealth(response.data.systemHealth);
          setSwedishMetrics(response.data.swedishMetrics);
          setScalingRecommendations(response.data.scalingRecommendations);
        }
      } catch (error) {
        console.error('Failed to load system metrics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSystemMetrics();

    // Auto-refresh every 30 seconds
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(fetchSystemMetrics, 30000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const getServiceStatusColor = (status: 'healthy' | 'degraded' | 'down'): string => {
    const colors = {
      healthy: '#10b981',
      degraded: '#f59e0b',
      down: '#ef4444'
    };
    return colors[status];
  };

  const getServiceStatusText = (status: 'healthy' | 'degraded' | 'down'): string => {
    const text = {
      healthy: '✅ Frisk',
      degraded: '⚠️ Försämrad',
      down: '🚨 Nere'
    };
    return text[status];
  };

  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${mins}m`;
  };

  const formatBytes = (bytes: number): string => {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    while (bytes >= 1024 && i < units.length - 1) {
      bytes /= 1024;
      i++;
    }
    return `${bytes.toFixed(1)} ${units[i]}`;
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '400px',
        fontSize: '16px',
        color: '#6b7280'
      }}>
        Laddar systemstatistik...
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', minHeight: '100vh', backgroundColor: '#f8fafc' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '32px'
      }}>
        <div>
          <h1 style={{
            fontSize: '28px',
            fontWeight: 'bold',
            color: '#1e293b',
            margin: 0,
            marginBottom: '8px'
          }}>
            🔧 System Hälsoövervakning
          </h1>
          <p style={{
            fontSize: '16px',
            color: '#64748b',
            margin: 0
          }}>
            Realtidsövervakning av systemstatus och prestanda
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            <span style={{ fontSize: '14px', color: '#374151' }}>Auto-uppdatering (30s)</span>
          </label>
          
          <div style={{
            padding: '6px 12px',
            backgroundColor: systemHealth?.services.aiService.status === 'healthy' ? '#dcfce7' : '#fef3c7',
            color: systemHealth?.services.aiService.status === 'healthy' ? '#15803d' : '#a16207',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: '500'
          }}>
            System: {systemHealth?.services.aiService.status === 'healthy' ? 'Operationell' : 'Problem detekterat'}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{
        display: 'flex',
        gap: '4px',
        marginBottom: '24px',
        borderBottom: '1px solid #e2e8f0'
      }}>
        {[
          { key: 'system', label: '📊 Systemöversikt', icon: '📊' },
          { key: 'capacity', label: '💻 Kapacitet', icon: '💻' },
          { key: 'services', label: '⚙️ Tjänster', icon: '⚙️' },
          { key: 'regional', label: '🇸🇪 Sveriges Prestanda', icon: '🇸🇪' }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setSelectedMetric(tab.key as any)}
            style={{
              padding: '12px 20px',
              backgroundColor: selectedMetric === tab.key ? '#3b82f6' : 'transparent',
              color: selectedMetric === tab.key ? 'white' : '#6b7280',
              border: 'none',
              borderRadius: '8px 8px 0 0',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'all 0.2s'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* System Overview Tab */}
      {selectedMetric === 'system' && systemHealth && (
        <div>
          {/* Key System Metrics */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '20px',
            marginBottom: '32px'
          }}>
            <div style={{
              backgroundColor: 'white',
              padding: '24px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0'
            }}>
              <h3 style={{ fontSize: '16px', color: '#6b7280', margin: '0 0 8px 0' }}>System Uptime</h3>
              <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#1e293b', margin: '0 0 8px 0' }}>
                {systemHealth.overview.uptimePercentage}%
              </p>
              <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
                {formatUptime(systemHealth.overview.uptime)}
              </p>
            </div>

            <div style={{
              backgroundColor: 'white',
              padding: '24px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0'
            }}>
              <h3 style={{ fontSize: '16px', color: '#6b7280', margin: '0 0 8px 0' }}>Förfrågningar/sek</h3>
              <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#1e293b', margin: '0 0 8px 0' }}>
                {systemHealth.overview.requestsPerSecond}
              </p>
              <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
                {systemHealth.overview.totalRequests.toLocaleString()} totalt idag
              </p>
            </div>

            <div style={{
              backgroundColor: 'white',
              padding: '24px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0'
            }}>
              <h3 style={{ fontSize: '16px', color: '#6b7280', margin: '0 0 8px 0' }}>API Svarstid</h3>
              <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#1e293b', margin: '0 0 8px 0' }}>
                {systemHealth.performance.apiLatency.current}ms
              </p>
              <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
                P95: {systemHealth.performance.apiLatency.p95}ms
              </p>
            </div>

            <div style={{
              backgroundColor: 'white',
              padding: '24px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0'
            }}>
              <h3 style={{ fontSize: '16px', color: '#6b7280', margin: '0 0 8px 0' }}>Felfrekvens</h3>
              <p style={{
                fontSize: '28px',
                fontWeight: 'bold',
                color: systemHealth.performance.errorRates.current > 5 ? '#ef4444' :
                       systemHealth.performance.errorRates.current > 1 ? '#f59e0b' : '#10b981',
                margin: '0 0 8px 0'
              }}>
                {systemHealth.performance.errorRates.current.toFixed(2)}%
              </p>
              <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
                Genomsnitt: {systemHealth.performance.errorRates.average.toFixed(2)}%
              </p>
            </div>
          </div>

          {/* Performance Trends */}
          <div style={{
            backgroundColor: 'white',
            padding: '24px',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            marginBottom: '32px'
          }}>
            <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#1e293b', marginBottom: '20px' }}>
              📈 Prestandatrender (Senaste 24h)
            </h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: '24px'
            }}>
              <div>
                <h4 style={{ fontSize: '16px', color: '#374151', margin: '0 0 12px 0' }}>Svarstider</h4>
                <div style={{ height: '120px', backgroundColor: '#f8fafc', borderRadius: '6px', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ textAlign: 'center', color: '#6b7280' }}>
                    📊 Chart: API Latency<br/>
                    <small>Aktuell: {systemHealth.performance.apiLatency.current}ms</small>
                  </div>
                </div>
              </div>
              <div>
                <h4 style={{ fontSize: '16px', color: '#374151', margin: '0 0 12px 0' }}>Genomströmning</h4>
                <div style={{ height: '120px', backgroundColor: '#f0f9ff', borderRadius: '6px', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ textAlign: 'center', color: '#1e40af' }}>
                    📊 Chart: Throughput<br/>
                    <small>Aktuell: {systemHealth.performance.throughput.current} req/s</small>
                  </div>
                </div>
              </div>
              <div>
                <h4 style={{ fontSize: '16px', color: '#374151', margin: '0 0 12px 0' }}>Fel & Varningar</h4>
                <div style={{ height: '120px', backgroundColor: '#fef3c7', borderRadius: '6px', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ textAlign: 'center', color: '#a16207' }}>
                    📊 Chart: Error Rates<br/>
                    <small>Aktuell: {systemHealth.performance.errorRates.current.toFixed(1)}%</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Capacity Monitoring Tab */}
      {selectedMetric === 'capacity' && systemHealth && (
        <div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '24px',
            marginBottom: '32px'
          }}>
            {/* CPU & Memory */}
            <div style={{
              backgroundColor: 'white',
              padding: '24px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0'
            }}>
              <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#1e293b', marginBottom: '20px' }}>
                💻 CPU & Minne
              </h3>
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span>CPU Usage</span>
                  <span style={{ fontWeight: '600', color: systemHealth.capacity.cpu.usage > 80 ? '#ef4444' : systemHealth.capacity.cpu.usage > 60 ? '#f59e0b' : '#10b981' }}>
                    {systemHealth.capacity.cpu.usage}%
                  </span>
                </div>
                <div style={{
                  width: '100%',
                  height: '8px',
                  backgroundColor: '#e2e8f0',
                  borderRadius: '4px'
                }}>
                  <div style={{
                    width: `${systemHealth.capacity.cpu.usage}%`,
                    height: '100%',
                    backgroundColor: systemHealth.capacity.cpu.usage > 80 ? '#ef4444' : systemHealth.capacity.cpu.usage > 60 ? '#f59e0b' : '#10b981',
                    borderRadius: '4px'
                  }} />
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                  {systemHealth.capacity.cpu.cores} kärnor, Load: {systemHealth.capacity.cpu.load}
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span>Memory Usage</span>
                  <span style={{ fontWeight: '600', color: systemHealth.capacity.memory.usage > 80 ? '#ef4444' : systemHealth.capacity.memory.usage > 60 ? '#f59e0b' : '#10b981' }}>
                    {systemHealth.capacity.memory.usage}%
                  </span>
                </div>
                <div style={{
                  width: '100%',
                  height: '8px',
                  backgroundColor: '#e2e8f0',
                  borderRadius: '4px'
                }}>
                  <div style={{
                    width: `${systemHealth.capacity.memory.usage}%`,
                    height: '100%',
                    backgroundColor: systemHealth.capacity.memory.usage > 80 ? '#ef4444' : systemHealth.capacity.memory.usage > 60 ? '#f59e0b' : '#10b981',
                    borderRadius: '4px'
                  }} />
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                  {formatBytes(systemHealth.capacity.memory.used)} / {formatBytes(systemHealth.capacity.memory.total)}
                </div>
              </div>
            </div>

            {/* Storage & Database */}
            <div style={{
              backgroundColor: 'white',
              padding: '24px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0'
            }}>
              <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#1e293b', marginBottom: '20px' }}>
                💾 Lagring & Databas
              </h3>
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span>Disk Usage</span>
                  <span style={{ fontWeight: '600', color: systemHealth.capacity.storage.usage > 80 ? '#ef4444' : systemHealth.capacity.storage.usage > 60 ? '#f59e0b' : '#10b981' }}>
                    {systemHealth.capacity.storage.usage}%
                  </span>
                </div>
                <div style={{
                  width: '100%',
                  height: '8px',
                  backgroundColor: '#e2e8f0',
                  borderRadius: '4px'
                }}>
                  <div style={{
                    width: `${systemHealth.capacity.storage.usage}%`,
                    height: '100%',
                    backgroundColor: systemHealth.capacity.storage.usage > 80 ? '#ef4444' : systemHealth.capacity.storage.usage > 60 ? '#f59e0b' : '#10b981',
                    borderRadius: '4px'
                  }} />
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                  {formatBytes(systemHealth.capacity.storage.used)} / {formatBytes(systemHealth.capacity.storage.total)}
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span>DB Connections</span>
                  <span style={{ fontWeight: '600', color: '#374151' }}>
                    {systemHealth.capacity.database.connections}/{systemHealth.capacity.database.maxConnections}
                  </span>
                </div>
                <div style={{ fontSize: '14px', color: '#6b7280' }}>
                  Långsamma queries: {systemHealth.capacity.database.slowQueries}
                </div>
              </div>
            </div>
          </div>

          {/* Scaling Recommendations */}
          <div style={{
            backgroundColor: 'white',
            padding: '24px',
            borderRadius: '8px',
            border: '1px solid #e2e8f0'
          }}>
            <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#1e293b', marginBottom: '20px' }}>
              🚀 Skalningsrekommendationer
            </h3>
            <div style={{ display: 'grid', gap: '16px' }}>
              {scalingRecommendations.map((rec, index) => (
                <div key={index} style={{
                  padding: '16px',
                  borderRadius: '8px',
                  border: `1px solid ${
                    rec.priority === 'critical' ? '#fca5a5' :
                    rec.priority === 'high' ? '#fcd34d' :
                    rec.priority === 'medium' ? '#93c5fd' : '#d1d5db'
                  }`,
                  backgroundColor: `${
                    rec.priority === 'critical' ? '#fef2f2' :
                    rec.priority === 'high' ? '#fefbeb' :
                    rec.priority === 'medium' ? '#eff6ff' : '#f9fafb'
                  }`
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#374151', margin: '0 0 4px 0' }}>
                        {rec.type === 'scale_up' ? '📈 Skala upp' :
                         rec.type === 'scale_down' ? '📉 Skala ner' :
                         rec.type === 'optimize' ? '⚡ Optimera' : '🚨 Varning'} {rec.component}
                      </h4>
                      <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
                        {rec.recommendation}
                      </p>
                    </div>
                    <div style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '600',
                      backgroundColor: rec.priority === 'critical' ? '#dc2626' :
                                     rec.priority === 'high' ? '#d97706' :
                                     rec.priority === 'medium' ? '#2563eb' : '#6b7280',
                      color: 'white'
                    }}>
                      {rec.priority.toUpperCase()}
                    </div>
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>
                    <span><strong>Impact:</strong> {rec.estimatedImpact}</span>
                    <span style={{ marginLeft: '16px' }}><strong>Timeframe:</strong> {rec.timeframe}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Services Tab */}
      {selectedMetric === 'services' && systemHealth && (
        <div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '20px'
          }}>
            {Object.entries(systemHealth.services).map(([serviceName, service]) => (
              <div key={serviceName} style={{
                backgroundColor: 'white',
                padding: '24px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                borderLeft: `4px solid ${getServiceStatusColor(service.status)}`
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#374151', margin: 0 }}>
                    {serviceName === 'aiService' ? '🤖 AI-tjänst' :
                     serviceName === 'voiceService' ? '🎙️ Rösttjänst' :
                     serviceName === 'database' ? '🗄️ Databas' : '💳 Betalningar'}
                  </h3>
                  <div style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: '600',
                    backgroundColor: getServiceStatusColor(service.status) + '20',
                    color: getServiceStatusColor(service.status)
                  }}>
                    {getServiceStatusText(service.status)}
                  </div>
                </div>

                <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span>Svarstid:</span>
                    <span style={{ fontWeight: '600' }}>{service.responseTime}ms</span>
                  </div>
                  
                  {serviceName === 'aiService' && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span>Framgångsgrad:</span>
                        <span style={{ fontWeight: '600', color: service.successRate > 95 ? '#10b981' : service.successRate > 90 ? '#f59e0b' : '#ef4444' }}>
                          {service.successRate}%
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Kö-storlek:</span>
                        <span style={{ fontWeight: '600' }}>{service.queueSize}</span>
                      </div>
                    </>
                  )}

                  {serviceName === 'voiceService' && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span>Aktiva sessioner:</span>
                        <span style={{ fontWeight: '600' }}>{service.activeSessions}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Bearbetningskö:</span>
                        <span style={{ fontWeight: '600' }}>{service.processingQueue}</span>
                      </div>
                    </>
                  )}

                  {serviceName === 'database' && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Anslutningspool:</span>
                      <span style={{ fontWeight: '600' }}>{service.connectionPool}</span>
                    </div>
                  )}

                  {serviceName === 'paymentService' && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Transaktioner:</span>
                      <span style={{ fontWeight: '600', color: service.transactionSuccess > 98 ? '#10b981' : service.transactionSuccess > 95 ? '#f59e0b' : '#ef4444' }}>
                        {service.transactionSuccess}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Swedish Pilot Regional Tab */}
      {selectedMetric === 'regional' && swedishMetrics && (
        <div>
          {/* Regional Performance */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '20px',
            marginBottom: '32px'
          }}>
            {Object.entries(swedishMetrics.regional).map(([region, data]) => (
              <div key={region} style={{
                backgroundColor: 'white',
                padding: '24px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0'
              }}>
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#374151', margin: '0 0 16px 0' }}>
                  {region === 'stockholm' ? '🏛️ Stockholm' :
                   region === 'goteborg' ? '⚓ Göteborg' :
                   region === 'malmo' ? '🌉 Malmö' : '🇸🇪 Övriga Sverige'}
                </h3>
                
                <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span>Företag:</span>
                    <span style={{ fontWeight: '600' }}>{data.businesses}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span>Aktiva sessioner:</span>
                    <span style={{ fontWeight: '600' }}>{data.activeSessions}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span>Genomsnittspoäng:</span>
                    <span style={{ fontWeight: '600', color: data.averageScore > 80 ? '#10b981' : data.averageScore > 60 ? '#f59e0b' : '#ef4444' }}>
                      {data.averageScore}/100
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Månadsomsättning:</span>
                    <span style={{ fontWeight: '600' }}>{data.monthlyRevenue.toLocaleString()} SEK</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Business Type Performance */}
          <div style={{
            backgroundColor: 'white',
            padding: '24px',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            marginBottom: '32px'
          }}>
            <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#1e293b', marginBottom: '20px' }}>
              🏪 Prestanda per Företagstyp
            </h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: '24px'
            }}>
              {Object.entries(swedishMetrics.businessTypes).map(([type, data]) => (
                <div key={type} style={{
                  padding: '20px',
                  backgroundColor: '#f8fafc',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0'
                }}>
                  <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#374151', margin: '0 0 12px 0' }}>
                    {type === 'cafes' ? '☕ Kaféer' : type === 'restaurants' ? '🍽️ Restauranger' : '🛍️ Detaljhandel'} ({data.count})
                  </h4>
                  <div style={{ fontSize: '14px', lineHeight: '1.6', marginBottom: '12px' }}>
                    <div>Genomsnittspoäng: <span style={{ fontWeight: '600' }}>{data.averageScore}/100</span></div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Topppresterare:</div>
                    <div style={{ fontSize: '12px' }}>
                      {data.topPerformers.join(', ')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Swedish Language Metrics */}
          <div style={{
            backgroundColor: 'white',
            padding: '24px',
            borderRadius: '8px',
            border: '1px solid #e2e8f0'
          }}>
            <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#1e293b', marginBottom: '20px' }}>
              🗣️ Svenska Språkstatistik
            </h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '24px'
            }}>
              <div>
                <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#374151', margin: '0 0 16px 0' }}>
                  Språkprestanda
                </h4>
                <div style={{ fontSize: '14px', lineHeight: '1.8' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span>Svenska träffsäkerhet:</span>
                    <span style={{ fontWeight: '600', color: '#10b981' }}>
                      {swedishMetrics.languageMetrics.swedishAccuracy}%
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Dialektigenenkänning:</span>
                    <span style={{ fontWeight: '600', color: '#10b981' }}>
                      {swedishMetrics.languageMetrics.dialectRecognition}%
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#374151', margin: '0 0 16px 0' }}>
                  Vanliga Missförstånd
                </h4>
                <div style={{ fontSize: '14px' }}>
                  {swedishMetrics.languageMetrics.commonMisunderstandings.map((misunderstanding, index) => (
                    <div key={index} style={{
                      padding: '8px',
                      backgroundColor: '#fef3c7',
                      borderRadius: '4px',
                      marginBottom: '8px',
                      color: '#92400e'
                    }}>
                      "{misunderstanding}"
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