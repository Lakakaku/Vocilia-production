import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  RefreshCw,
  Zap,
  Clock,
  TrendingUp,
  TrendingDown,
  Server,
  Wifi,
  WifiOff,
  Settings,
  Terminal,
  LineChart,
  Database
} from 'lucide-react';
import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, BarChart, Bar } from 'recharts';

interface IntegrationHealth {
  businessId: string;
  businessName: string;
  posProvider: 'square' | 'shopify' | 'zettle' | 'custom';
  status: 'healthy' | 'degraded' | 'offline';
  lastSync: string;
  syncSuccess: number;
  syncFailures: number;
  avgResponseTime: number;
  webhookHealth: {
    received: number;
    processed: number;
    failed: number;
    lastReceived: string;
  };
  apiHealth: {
    calls: number;
    errors: number;
    avgLatency: number;
    lastCall: string;
  };
  issues: Array<{
    type: 'warning' | 'error';
    message: string;
    timestamp: string;
    code?: string;
  }>;
}

interface TransactionSync {
  transactionId: string;
  businessName: string;
  status: 'pending' | 'syncing' | 'completed' | 'failed';
  attempts: number;
  lastAttempt: string;
  error?: string;
  amount: number;
  posProvider: string;
}

interface PerformanceMetric {
  timestamp: string;
  responseTime: number;
  successRate: number;
  throughput: number;
}

export default function IntegrationMonitoring() {
  const [integrations, setIntegrations] = useState<IntegrationHealth[]>([]);
  const [pendingSyncs, setPendingSyncs] = useState<TransactionSync[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<string>('all');
  const [performanceData, setPerformanceData] = useState<PerformanceMetric[]>([]);
  const [activeAlerts, setActiveAlerts] = useState<any[]>([]);
  const [refreshInterval, setRefreshInterval] = useState<number>(5000);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);

  useEffect(() => {
    fetchIntegrationHealth();
    fetchPendingSyncs();
    fetchPerformanceMetrics();
    fetchActiveAlerts();

    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchIntegrationHealth();
        fetchPendingSyncs();
        fetchPerformanceMetrics();
        fetchActiveAlerts();
      }, refreshInterval);

      return () => clearInterval(interval);
    }
  }, [selectedBusiness, refreshInterval, autoRefresh]);

  const fetchIntegrationHealth = async () => {
    try {
      const response = await fetch('/api/admin/integration-health' + 
        (selectedBusiness !== 'all' ? `?businessId=${selectedBusiness}` : ''));
      const data = await response.json();
      setIntegrations(data);
    } catch (error) {
      console.error('Error fetching integration health:', error);
    }
  };

  const fetchPendingSyncs = async () => {
    try {
      const response = await fetch('/api/admin/pending-syncs' + 
        (selectedBusiness !== 'all' ? `?businessId=${selectedBusiness}` : ''));
      const data = await response.json();
      setPendingSyncs(data);
    } catch (error) {
      console.error('Error fetching pending syncs:', error);
    }
  };

  const fetchPerformanceMetrics = async () => {
    try {
      const response = await fetch('/api/admin/integration-performance' + 
        (selectedBusiness !== 'all' ? `?businessId=${selectedBusiness}` : ''));
      const data = await response.json();
      setPerformanceData(data);
    } catch (error) {
      console.error('Error fetching performance metrics:', error);
    }
  };

  const fetchActiveAlerts = async () => {
    try {
      const response = await fetch('/api/admin/integration-alerts' + 
        (selectedBusiness !== 'all' ? `?businessId=${selectedBusiness}` : ''));
      const data = await response.json();
      setActiveAlerts(data);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    }
  };

  const handleForceSync = async (businessId: string) => {
    try {
      await fetch('/api/admin/force-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId })
      });
      fetchIntegrationHealth();
      fetchPendingSyncs();
    } catch (error) {
      console.error('Error forcing sync:', error);
    }
  };

  const handleRetryTransaction = async (transactionId: string) => {
    try {
      await fetch('/api/admin/retry-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId })
      });
      fetchPendingSyncs();
    } catch (error) {
      console.error('Error retrying transaction:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'completed':
        return 'text-green-500';
      case 'degraded':
      case 'syncing':
      case 'pending':
        return 'text-yellow-500';
      case 'offline':
      case 'failed':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'completed':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'degraded':
      case 'syncing':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'offline':
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Activity className="w-5 h-5 text-gray-500" />;
    }
  };

  const calculateUptime = (integration: IntegrationHealth) => {
    const total = integration.syncSuccess + integration.syncFailures;
    return total > 0 ? ((integration.syncSuccess / total) * 100).toFixed(2) : '0';
  };

  const healthySystems = integrations.filter(i => i.status === 'healthy').length;
  const degradedSystems = integrations.filter(i => i.status === 'degraded').length;
  const offlineSystems = integrations.filter(i => i.status === 'offline').length;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Integration Monitoring</h1>
            <p className="text-gray-600 mt-2">Real-time POS integration health and performance monitoring</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Auto-refresh:</span>
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-gray-300"
              />
              <Select value={String(refreshInterval)} onValueChange={(value) => setRefreshInterval(Number(value))}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5000">5s</SelectItem>
                  <SelectItem value="10000">10s</SelectItem>
                  <SelectItem value="30000">30s</SelectItem>
                  <SelectItem value="60000">1m</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => {
              fetchIntegrationHealth();
              fetchPendingSyncs();
            }} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* System Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Integrations</CardTitle>
              <Server className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{integrations.length}</div>
              <p className="text-xs text-muted-foreground">Active POS connections</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Healthy Systems</CardTitle>
              <Wifi className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">{healthySystems}</div>
              <Progress value={(healthySystems / integrations.length) * 100} className="mt-2" />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Degraded Systems</CardTitle>
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-500">{degradedSystems}</div>
              <p className="text-xs text-muted-foreground">Require attention</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Offline Systems</CardTitle>
              <WifiOff className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">{offlineSystems}</div>
              <p className="text-xs text-muted-foreground">Connection lost</p>
            </CardContent>
          </Card>
        </div>

        {/* Active Alerts */}
        {activeAlerts.length > 0 && (
          <div className="space-y-2">
            {activeAlerts.map((alert, idx) => (
              <Alert key={idx} variant={alert.severity === 'error' ? 'destructive' : 'default'}>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{alert.title}</AlertTitle>
                <AlertDescription>{alert.description}</AlertDescription>
              </Alert>
            ))}
          </div>
        )}

        <Tabs defaultValue="health" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="health">System Health</TabsTrigger>
            <TabsTrigger value="syncs">Transaction Syncs</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="diagnostics">Diagnostics</TabsTrigger>
          </TabsList>

          <TabsContent value="health" className="space-y-4">
            <div className="grid gap-4">
              {integrations.map((integration) => (
                <Card key={integration.businessId}>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(integration.status)}
                        <div>
                          <CardTitle className="text-lg">{integration.businessName}</CardTitle>
                          <CardDescription>
                            <Badge variant="outline" className="mr-2">{integration.posProvider.toUpperCase()}</Badge>
                            Last sync: {new Date(integration.lastSync).toLocaleString()}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleForceSync(integration.businessId)}>
                          <RefreshCw className="w-4 h-4 mr-1" />
                          Force Sync
                        </Button>
                        <Button size="sm" variant="outline">
                          <Settings className="w-4 h-4 mr-1" />
                          Configure
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Uptime</p>
                        <p className="text-xl font-semibold">{calculateUptime(integration)}%</p>
                        <Progress value={Number(calculateUptime(integration))} className="mt-1" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Response Time</p>
                        <p className="text-xl font-semibold">{integration.avgResponseTime}ms</p>
                        <p className="text-xs text-gray-500">Avg. latency</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Webhooks</p>
                        <p className="text-xl font-semibold">
                          {integration.webhookHealth.processed}/{integration.webhookHealth.received}
                        </p>
                        <p className="text-xs text-red-500">{integration.webhookHealth.failed} failed</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">API Calls</p>
                        <p className="text-xl font-semibold">{integration.apiHealth.calls}</p>
                        <p className="text-xs text-red-500">{integration.apiHealth.errors} errors</p>
                      </div>
                    </div>
                    
                    {integration.issues.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <p className="text-sm font-medium text-gray-700">Recent Issues:</p>
                        {integration.issues.map((issue, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-sm">
                            {issue.type === 'error' ? (
                              <XCircle className="w-4 h-4 text-red-500" />
                            ) : (
                              <AlertTriangle className="w-4 h-4 text-yellow-500" />
                            )}
                            <span>{issue.message}</span>
                            <span className="text-gray-500">({new Date(issue.timestamp).toLocaleTimeString()})</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="syncs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Pending Transaction Syncs</CardTitle>
                <CardDescription>Transactions awaiting synchronization with POS systems</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {pendingSyncs.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">All transactions are synchronized</p>
                  ) : (
                    pendingSyncs.map((sync) => (
                      <div key={sync.transactionId} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              {getStatusIcon(sync.status)}
                              <span className="font-medium">{sync.transactionId}</span>
                              <Badge variant="outline">{sync.posProvider}</Badge>
                            </div>
                            <p className="text-sm text-gray-600">{sync.businessName}</p>
                            <div className="flex gap-4 text-sm text-gray-500">
                              <span>Amount: ${sync.amount}</span>
                              <span>Attempts: {sync.attempts}</span>
                              <span>Last attempt: {new Date(sync.lastAttempt).toLocaleTimeString()}</span>
                            </div>
                            {sync.error && (
                              <p className="text-sm text-red-500 mt-1">Error: {sync.error}</p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleRetryTransaction(sync.transactionId)}
                            >
                              <RefreshCw className="w-4 h-4 mr-1" />
                              Retry
                            </Button>
                            <Button size="sm" variant="outline">
                              <Terminal className="w-4 h-4 mr-1" />
                              Debug
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Response Time Trend</CardTitle>
                  <CardDescription>Average API response time over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={performanceData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="timestamp" />
                      <YAxis />
                      <Tooltip />
                      <Area type="monotone" dataKey="responseTime" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Success Rate</CardTitle>
                  <CardDescription>Transaction sync success rate</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <RechartsLineChart data={performanceData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="timestamp" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="successRate" stroke="#82ca9d" strokeWidth={2} />
                    </RechartsLineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Throughput Analysis</CardTitle>
                <CardDescription>Transactions processed per minute</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={performanceData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="timestamp" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="throughput" fill="#ffc658" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Integration Performance Analytics</CardTitle>
                <CardDescription>Optimization recommendations based on system performance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4">
                  <div className="border rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <TrendingUp className="w-5 h-5 text-green-500 mt-0.5" />
                      <div>
                        <p className="font-medium">Webhook Processing Optimization</p>
                        <p className="text-sm text-gray-600 mt-1">
                          3 businesses show improved webhook processing after implementing batch processing.
                          Consider enabling for remaining integrations.
                        </p>
                        <Button size="sm" variant="link" className="px-0 mt-2">Apply optimization →</Button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="border rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <Zap className="w-5 h-5 text-yellow-500 mt-0.5" />
                      <div>
                        <p className="font-medium">API Rate Limit Warning</p>
                        <p className="text-sm text-gray-600 mt-1">
                          Square integration approaching rate limit (85% utilized). 
                          Consider implementing request queuing.
                        </p>
                        <Button size="sm" variant="link" className="px-0 mt-2">View details →</Button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="border rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <Clock className="w-5 h-5 text-blue-500 mt-0.5" />
                      <div>
                        <p className="font-medium">Sync Timing Pattern</p>
                        <p className="text-sm text-gray-600 mt-1">
                          Peak sync failures occur between 14:00-16:00. Consider adjusting retry logic
                          during high-traffic periods.
                        </p>
                        <Button size="sm" variant="link" className="px-0 mt-2">Analyze pattern →</Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Provider Comparison</CardTitle>
                <CardDescription>Performance metrics by POS provider</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Square</span>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-gray-600">98.5% uptime</span>
                      <span className="text-sm text-gray-600">120ms avg</span>
                      <TrendingUp className="w-4 h-4 text-green-500" />
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Shopify POS</span>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-gray-600">96.2% uptime</span>
                      <span className="text-sm text-gray-600">180ms avg</span>
                      <TrendingDown className="w-4 h-4 text-red-500" />
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Zettle</span>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-gray-600">99.1% uptime</span>
                      <span className="text-sm text-gray-600">95ms avg</span>
                      <TrendingUp className="w-4 h-4 text-green-500" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="diagnostics" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Integration Diagnostics</CardTitle>
                <CardDescription>Debug tools and system diagnostics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border rounded-lg p-4 bg-gray-50">
                  <h4 className="font-medium mb-3">Connection Test</h4>
                  <div className="flex gap-2">
                    <Select>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Select business" />
                      </SelectTrigger>
                      <SelectContent>
                        {integrations.map((int) => (
                          <SelectItem key={int.businessId} value={int.businessId}>
                            {int.businessName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="outline">
                      <Database className="w-4 h-4 mr-2" />
                      Test Connection
                    </Button>
                    <Button variant="outline">
                      <Terminal className="w-4 h-4 mr-2" />
                      View Logs
                    </Button>
                  </div>
                </div>

                <div className="border rounded-lg p-4 bg-gray-50">
                  <h4 className="font-medium mb-3">Webhook Inspector</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Last webhook received:</span>
                      <span className="font-mono">2 minutes ago</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Signature validation:</span>
                      <Badge variant="success">Valid</Badge>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Processing time:</span>
                      <span className="font-mono">145ms</span>
                    </div>
                    <Button size="sm" variant="outline" className="w-full mt-3">
                      View Webhook Payload
                    </Button>
                  </div>
                </div>

                <div className="border rounded-lg p-4 bg-gray-50">
                  <h4 className="font-medium mb-3">Debug Console</h4>
                  <div className="bg-black text-green-400 font-mono text-xs p-3 rounded-md h-32 overflow-y-auto">
                    <div>[2024-12-19 10:23:45] INFO: Connection established to Square API</div>
                    <div>[2024-12-19 10:23:46] INFO: Fetching transactions batch 1/5</div>
                    <div>[2024-12-19 10:23:47] SUCCESS: 25 transactions synced</div>
                    <div>[2024-12-19 10:23:48] INFO: Webhook received from Shopify</div>
                    <div>[2024-12-19 10:23:48] INFO: Processing order #12345</div>
                    <div>[2024-12-19 10:23:49] WARNING: Rate limit approaching (85%)</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}