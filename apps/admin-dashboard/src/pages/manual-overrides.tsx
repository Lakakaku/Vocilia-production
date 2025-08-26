import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { 
  Shield, 
  RefreshCw, 
  Settings, 
  CheckCircle, 
  AlertTriangle,
  Terminal,
  Database,
  Key,
  Link,
  Zap,
  UserCheck,
  FileText,
  Clock,
  DollarSign,
  Hash
} from 'lucide-react';

interface TransactionOverride {
  transactionId: string;
  businessName: string;
  amount: number;
  status: string;
  posProvider: string;
  timestamp: string;
}

interface POSConfiguration {
  businessId: string;
  businessName: string;
  provider: string;
  apiKey: string;
  webhookSecret: string;
  merchantId: string;
  storeId?: string;
  environment: 'production' | 'sandbox';
  autoSync: boolean;
  syncInterval: number;
  retryAttempts: number;
  customSettings: Record<string, any>;
}

interface DiagnosticResult {
  test: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: any;
}

export default function ManualOverrides() {
  const [selectedBusiness, setSelectedBusiness] = useState<string>('');
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [overrideTransaction, setOverrideTransaction] = useState({
    transactionId: '',
    amount: '',
    reason: '',
    posReference: ''
  });
  const [posConfig, setPosConfig] = useState<POSConfiguration | null>(null);
  const [diagnosticResults, setDiagnosticResults] = useState<DiagnosticResult[]>([]);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [forceSyncStatus, setForceSyncStatus] = useState<any>(null);
  const [recentOverrides, setRecentOverrides] = useState<TransactionOverride[]>([]);

  useEffect(() => {
    fetchBusinesses();
    fetchRecentOverrides();
  }, []);

  useEffect(() => {
    if (selectedBusiness) {
      fetchPOSConfiguration(selectedBusiness);
    }
  }, [selectedBusiness]);

  const fetchBusinesses = async () => {
    try {
      const response = await fetch('/api/admin/businesses');
      const data = await response.json();
      setBusinesses(data);
    } catch (error) {
      console.error('Error fetching businesses:', error);
    }
  };

  const fetchRecentOverrides = async () => {
    try {
      const response = await fetch('/api/admin/recent-overrides');
      const data = await response.json();
      setRecentOverrides(data);
    } catch (error) {
      console.error('Error fetching recent overrides:', error);
    }
  };

  const fetchPOSConfiguration = async (businessId: string) => {
    try {
      const response = await fetch(`/api/admin/pos-config/${businessId}`);
      const data = await response.json();
      setPosConfig(data);
    } catch (error) {
      console.error('Error fetching POS configuration:', error);
    }
  };

  const handleTransactionOverride = async () => {
    try {
      const response = await fetch('/api/admin/override-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: selectedBusiness,
          ...overrideTransaction
        })
      });
      
      if (response.ok) {
        alert('Transaction override successful');
        setOverrideTransaction({
          transactionId: '',
          amount: '',
          reason: '',
          posReference: ''
        });
        fetchRecentOverrides();
      }
    } catch (error) {
      console.error('Error overriding transaction:', error);
    }
  };

  const handleForceSync = async () => {
    setForceSyncStatus({ status: 'syncing', message: 'Initiating forced sync...' });
    try {
      const response = await fetch('/api/admin/force-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          businessId: selectedBusiness,
          fullSync: true 
        })
      });
      
      const data = await response.json();
      setForceSyncStatus({
        status: 'success',
        message: `Sync completed: ${data.synced} transactions synced, ${data.failed} failed`
      });
    } catch (error) {
      setForceSyncStatus({
        status: 'error',
        message: 'Force sync failed. Check logs for details.'
      });
    }
  };

  const handlePOSReconfiguration = async () => {
    if (!posConfig) return;
    
    try {
      const response = await fetch(`/api/admin/reconfigure-pos`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(posConfig)
      });
      
      if (response.ok) {
        alert('POS configuration updated successfully');
      }
    } catch (error) {
      console.error('Error updating POS configuration:', error);
    }
  };

  const runDiagnostics = async () => {
    setIsTestingConnection(true);
    setDiagnosticResults([]);
    
    const tests = [
      { name: 'API Connection', endpoint: '/test-api' },
      { name: 'Webhook Validation', endpoint: '/test-webhook' },
      { name: 'Authentication', endpoint: '/test-auth' },
      { name: 'Transaction Fetch', endpoint: '/test-transactions' },
      { name: 'Rate Limits', endpoint: '/test-rate-limits' }
    ];
    
    for (const test of tests) {
      try {
        const response = await fetch(`/api/admin/diagnostics${test.endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ businessId: selectedBusiness })
        });
        
        const result = await response.json();
        setDiagnosticResults(prev => [...prev, {
          test: test.name,
          status: result.success ? 'pass' : 'fail',
          message: result.message,
          details: result.details
        }]);
      } catch (error) {
        setDiagnosticResults(prev => [...prev, {
          test: test.name,
          status: 'fail',
          message: 'Test failed to execute',
          details: error
        }]);
      }
    }
    
    setIsTestingConnection(false);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Manual Override Tools</h1>
          <p className="text-gray-600 mt-2">Administrative tools for manual intervention and troubleshooting</p>
        </div>

        <div className="flex gap-4">
          <Select value={selectedBusiness} onValueChange={setSelectedBusiness}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select a business" />
            </SelectTrigger>
            <SelectContent>
              {businesses.map((business) => (
                <SelectItem key={business.id} value={business.id}>
                  {business.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {selectedBusiness && (
            <Badge variant="outline" className="self-center">
              {businesses.find(b => b.id === selectedBusiness)?.posProvider?.toUpperCase()}
            </Badge>
          )}
        </div>

        <Tabs defaultValue="transaction" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="transaction">Transaction Override</TabsTrigger>
            <TabsTrigger value="sync">Force Sync</TabsTrigger>
            <TabsTrigger value="config">POS Configuration</TabsTrigger>
            <TabsTrigger value="diagnostics">Diagnostics</TabsTrigger>
          </TabsList>

          <TabsContent value="transaction" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Manual Transaction Verification Override</CardTitle>
                <CardDescription>
                  Override transaction verification for troubleshooting or manual intervention
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertDescription>
                    This action bypasses normal verification. All overrides are logged and audited.
                  </AlertDescription>
                </Alert>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="transactionId">Transaction ID</Label>
                    <div className="flex gap-2">
                      <Input
                        id="transactionId"
                        placeholder="e.g., TXN-123456"
                        value={overrideTransaction.transactionId}
                        onChange={(e) => setOverrideTransaction({
                          ...overrideTransaction,
                          transactionId: e.target.value
                        })}
                      />
                      <Button size="sm" variant="outline">
                        <Hash className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="amount">Amount (SEK)</Label>
                    <div className="flex gap-2">
                      <Input
                        id="amount"
                        type="number"
                        placeholder="0.00"
                        value={overrideTransaction.amount}
                        onChange={(e) => setOverrideTransaction({
                          ...overrideTransaction,
                          amount: e.target.value
                        })}
                      />
                      <Button size="sm" variant="outline">
                        <DollarSign className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="posReference">POS Reference (Optional)</Label>
                  <Input
                    id="posReference"
                    placeholder="Original POS transaction reference"
                    value={overrideTransaction.posReference}
                    onChange={(e) => setOverrideTransaction({
                      ...overrideTransaction,
                      posReference: e.target.value
                    })}
                  />
                </div>
                
                <div>
                  <Label htmlFor="reason">Override Reason</Label>
                  <Textarea
                    id="reason"
                    placeholder="Provide detailed reason for override..."
                    value={overrideTransaction.reason}
                    onChange={(e) => setOverrideTransaction({
                      ...overrideTransaction,
                      reason: e.target.value
                    })}
                    rows={3}
                  />
                </div>
                
                <div className="flex justify-between items-center">
                  <div className="text-sm text-gray-500">
                    <UserCheck className="w-4 h-4 inline mr-1" />
                    Admin approval will be logged
                  </div>
                  <Button 
                    onClick={handleTransactionOverride}
                    disabled={!selectedBusiness || !overrideTransaction.transactionId || !overrideTransaction.amount || !overrideTransaction.reason}
                  >
                    Override Transaction
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Overrides</CardTitle>
                <CardDescription>Last 10 transaction overrides</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {recentOverrides.map((override, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{override.transactionId}</p>
                        <p className="text-sm text-gray-600">{override.businessName}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{override.amount} SEK</p>
                        <p className="text-sm text-gray-500">{new Date(override.timestamp).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sync" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Force Transaction Sync</CardTitle>
                <CardDescription>
                  Manually trigger synchronization with POS system
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Force sync may cause temporary performance degradation. Use during low-traffic periods.
                  </AlertDescription>
                </Alert>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Sync Type</Label>
                      <Select defaultValue="incremental">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="incremental">Incremental (Last 24h)</SelectItem>
                          <SelectItem value="full">Full Sync (All transactions)</SelectItem>
                          <SelectItem value="custom">Custom Range</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label>Priority</Label>
                      <Select defaultValue="normal">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <RefreshCw className="w-5 h-5 text-blue-500" />
                      <div>
                        <p className="font-medium">Force Synchronization</p>
                        <p className="text-sm text-gray-600">
                          Immediately sync all pending transactions
                        </p>
                      </div>
                    </div>
                    <Button 
                      onClick={handleForceSync}
                      disabled={!selectedBusiness}
                    >
                      <Zap className="w-4 h-4 mr-2" />
                      Start Sync
                    </Button>
                  </div>
                  
                  {forceSyncStatus && (
                    <Alert variant={forceSyncStatus.status === 'error' ? 'destructive' : 'default'}>
                      <AlertDescription>{forceSyncStatus.message}</AlertDescription>
                    </Alert>
                  )}
                </div>
                
                <div className="border rounded-lg p-4 bg-gray-50">
                  <h4 className="font-medium mb-3">Sync History</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Last sync:</span>
                      <span className="font-mono">2 hours ago</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Transactions synced:</span>
                      <span className="font-mono">1,234</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Failed transactions:</span>
                      <span className="font-mono text-red-500">3</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Average sync time:</span>
                      <span className="font-mono">2.3s</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="config" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>POS Reconfiguration</CardTitle>
                <CardDescription>
                  Modify POS integration settings and credentials
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {posConfig && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Provider</Label>
                        <Select 
                          value={posConfig.provider} 
                          onValueChange={(value) => setPosConfig({...posConfig, provider: value})}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="square">Square</SelectItem>
                            <SelectItem value="shopify">Shopify POS</SelectItem>
                            <SelectItem value="zettle">Zettle</SelectItem>
                            <SelectItem value="custom">Custom API</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Label>Environment</Label>
                        <Select 
                          value={posConfig.environment}
                          onValueChange={(value: 'production' | 'sandbox') => 
                            setPosConfig({...posConfig, environment: value})}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="production">Production</SelectItem>
                            <SelectItem value="sandbox">Sandbox</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div>
                      <Label>API Key</Label>
                      <div className="flex gap-2">
                        <Input
                          type="password"
                          value={posConfig.apiKey}
                          onChange={(e) => setPosConfig({...posConfig, apiKey: e.target.value})}
                        />
                        <Button size="sm" variant="outline">
                          <Key className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    
                    <div>
                      <Label>Webhook Secret</Label>
                      <Input
                        type="password"
                        value={posConfig.webhookSecret}
                        onChange={(e) => setPosConfig({...posConfig, webhookSecret: e.target.value})}
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Merchant ID</Label>
                        <Input
                          value={posConfig.merchantId}
                          onChange={(e) => setPosConfig({...posConfig, merchantId: e.target.value})}
                        />
                      </div>
                      
                      <div>
                        <Label>Store ID (Optional)</Label>
                        <Input
                          value={posConfig.storeId || ''}
                          onChange={(e) => setPosConfig({...posConfig, storeId: e.target.value})}
                        />
                      </div>
                    </div>
                    
                    <div className="border rounded-lg p-4 space-y-3">
                      <h4 className="font-medium">Sync Settings</h4>
                      
                      <div className="flex items-center justify-between">
                        <Label htmlFor="autoSync">Auto Sync</Label>
                        <Switch
                          id="autoSync"
                          checked={posConfig.autoSync}
                          onCheckedChange={(checked) => 
                            setPosConfig({...posConfig, autoSync: checked})}
                        />
                      </div>
                      
                      <div>
                        <Label>Sync Interval (minutes)</Label>
                        <Input
                          type="number"
                          value={posConfig.syncInterval}
                          onChange={(e) => setPosConfig({
                            ...posConfig, 
                            syncInterval: parseInt(e.target.value)
                          })}
                        />
                      </div>
                      
                      <div>
                        <Label>Max Retry Attempts</Label>
                        <Input
                          type="number"
                          value={posConfig.retryAttempts}
                          onChange={(e) => setPosConfig({
                            ...posConfig,
                            retryAttempts: parseInt(e.target.value)
                          })}
                        />
                      </div>
                    </div>
                    
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => fetchPOSConfiguration(selectedBusiness)}>
                        Reset
                      </Button>
                      <Button onClick={handlePOSReconfiguration}>
                        <Settings className="w-4 h-4 mr-2" />
                        Update Configuration
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="diagnostics" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Integration Debugging & Diagnostics</CardTitle>
                <CardDescription>
                  Run comprehensive tests to identify integration issues
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Run Full Diagnostics</p>
                    <p className="text-sm text-gray-600">
                      Test API connection, authentication, webhooks, and more
                    </p>
                  </div>
                  <Button 
                    onClick={runDiagnostics}
                    disabled={!selectedBusiness || isTestingConnection}
                  >
                    {isTestingConnection ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      <>
                        <Terminal className="w-4 h-4 mr-2" />
                        Run Tests
                      </>
                    )}
                  </Button>
                </div>
                
                {diagnosticResults.length > 0 && (
                  <div className="space-y-2">
                    {diagnosticResults.map((result, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          {result.status === 'pass' ? (
                            <CheckCircle className="w-5 h-5 text-green-500" />
                          ) : result.status === 'warning' ? (
                            <AlertTriangle className="w-5 h-5 text-yellow-500" />
                          ) : (
                            <AlertTriangle className="w-5 h-5 text-red-500" />
                          )}
                          <div>
                            <p className="font-medium">{result.test}</p>
                            <p className="text-sm text-gray-600">{result.message}</p>
                          </div>
                        </div>
                        {result.details && (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button size="sm" variant="outline">
                                <FileText className="w-4 h-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>{result.test} Details</DialogTitle>
                              </DialogHeader>
                              <pre className="bg-gray-50 p-3 rounded text-xs overflow-auto max-h-96">
                                {JSON.stringify(result.details, null, 2)}
                              </pre>
                            </DialogContent>
                          </Dialog>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">API Endpoints</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <Button variant="outline" size="sm" className="w-full justify-start">
                        <Link className="w-4 h-4 mr-2" />
                        Test Auth Endpoint
                      </Button>
                      <Button variant="outline" size="sm" className="w-full justify-start">
                        <Database className="w-4 h-4 mr-2" />
                        Test Transaction Fetch
                      </Button>
                      <Button variant="outline" size="sm" className="w-full justify-start">
                        <Clock className="w-4 h-4 mr-2" />
                        Check Rate Limits
                      </Button>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Debug Tools</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <Button variant="outline" size="sm" className="w-full justify-start">
                        <Terminal className="w-4 h-4 mr-2" />
                        View Logs
                      </Button>
                      <Button variant="outline" size="sm" className="w-full justify-start">
                        <FileText className="w-4 h-4 mr-2" />
                        Export Debug Report
                      </Button>
                      <Button variant="outline" size="sm" className="w-full justify-start">
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Clear Cache
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}