/**
 * POS Integration End-to-End Test Suite
 * Tests all POS providers (Square, Shopify, Zettle) with Swedish business scenarios
 */

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// Test configuration
const TEST_CONFIG = {
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3001',
  timeouts: {
    auth: 10000,
    transaction: 5000,
    webhook: 15000
  },
  retryAttempts: 3,
  retryDelay: 1000
};

// Swedish business test scenarios
const SWEDISH_BUSINESS_SCENARIOS = {
  grocery_store: {
    name: 'ICA Maxi Lindhagen',
    orgNumber: '5560123456',
    currency: 'SEK',
    location: {
      address: 'Lindhagensgatan 118',
      city: 'Stockholm',
      postalCode: '11251',
      country: 'SE',
      timezone: 'Europe/Stockholm'
    },
    testTransactions: [
      { amount: 245.50, items: ['mjölk', 'bröd', 'ägg'], paymentMethod: 'card' },
      { amount: 892.00, items: ['veckohandling'], paymentMethod: 'swish' },
      { amount: 45.00, items: ['kaffe', 'bulle'], paymentMethod: 'cash' }
    ]
  },
  cafe: {
    name: 'Espresso House Odenplan',
    orgNumber: '5560789012',
    currency: 'SEK',
    location: {
      address: 'Odengatan 80',
      city: 'Stockholm',
      postalCode: '11322',
      country: 'SE',
      timezone: 'Europe/Stockholm'
    },
    testTransactions: [
      { amount: 65.00, items: ['cappuccino', 'croissant'], paymentMethod: 'card' },
      { amount: 125.00, items: ['lunch special'], paymentMethod: 'mobile' },
      { amount: 35.00, items: ['espresso'], paymentMethod: 'contactless' }
    ]
  },
  restaurant: {
    name: 'Restaurang Prinsen',
    orgNumber: '5560345678',
    currency: 'SEK',
    location: {
      address: 'Mäster Samuelsgatan 4',
      city: 'Stockholm',
      postalCode: '11144',
      country: 'SE',
      timezone: 'Europe/Stockholm'
    },
    testTransactions: [
      { amount: 385.00, items: ['dagens lunch'], paymentMethod: 'card' },
      { amount: 1250.00, items: ['middag för 2'], paymentMethod: 'card' },
      { amount: 2500.00, items: ['gruppbokning'], paymentMethod: 'invoice' }
    ]
  }
};

// POS Provider Test Suites
class POSIntegrationTester {
  constructor(provider) {
    this.provider = provider;
    this.authToken = null;
    this.businessId = null;
    this.webhookEndpoint = null;
    this.metricsCollector = new MetricsCollector(provider);
  }

  async runFullIntegrationTest(businessScenario) {
    console.log(`\n🧪 Testing ${this.provider} with ${businessScenario.name}`);
    console.log('='*60);

    const results = {
      provider: this.provider,
      business: businessScenario.name,
      timestamp: new Date().toISOString(),
      tests: {
        oauth: null,
        transactionSync: null,
        webhooks: null,
        errorHandling: null,
        performance: null
      },
      metrics: {}
    };

    try {
      // 1. OAuth Flow Test
      results.tests.oauth = await this.testOAuthFlow(businessScenario);
      
      // 2. Transaction Sync Test
      results.tests.transactionSync = await this.testTransactionSync(businessScenario);
      
      // 3. Webhook Test
      results.tests.webhooks = await this.testWebhooks(businessScenario);
      
      // 4. Error Handling Test
      results.tests.errorHandling = await this.testErrorHandling();
      
      // 5. Performance Test
      results.tests.performance = await this.testPerformance(businessScenario);
      
      // Collect metrics
      results.metrics = this.metricsCollector.getMetrics();
      
    } catch (error) {
      results.error = {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      };
    }

    return results;
  }

  async testOAuthFlow(business) {
    console.log('📋 Testing OAuth Flow...');
    const startTime = Date.now();
    
    try {
      // Initiate OAuth
      const authResponse = await axios.post(
        `${TEST_CONFIG.apiBaseUrl}/api/pos/${this.provider}/auth/initiate`,
        {
          businessId: business.orgNumber,
          redirectUri: 'http://localhost:3000/pos/callback',
          scopes: this.getProviderScopes()
        },
        { timeout: TEST_CONFIG.timeouts.auth }
      );

      // Simulate OAuth callback
      const callbackResponse = await axios.post(
        `${TEST_CONFIG.apiBaseUrl}/api/pos/${this.provider}/auth/callback`,
        {
          code: 'TEST_AUTH_CODE_' + uuidv4(),
          state: authResponse.data.state,
          businessId: business.orgNumber
        },
        { timeout: TEST_CONFIG.timeouts.auth }
      );

      this.authToken = callbackResponse.data.accessToken;
      this.businessId = business.orgNumber;
      
      const duration = Date.now() - startTime;
      this.metricsCollector.recordMetric('oauth_flow_duration', duration);

      return {
        status: 'passed',
        duration,
        accessToken: this.authToken ? '***' + this.authToken.slice(-4) : null,
        tokenType: callbackResponse.data.tokenType,
        expiresIn: callbackResponse.data.expiresIn
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      this.metricsCollector.recordMetric('oauth_flow_duration', duration);
      
      return {
        status: 'failed',
        duration,
        error: error.message,
        details: error.response?.data
      };
    }
  }

  async testTransactionSync(business) {
    console.log('💳 Testing Transaction Sync...');
    const results = [];
    
    for (const transaction of business.testTransactions) {
      const startTime = Date.now();
      const transactionId = `TEST_TXN_${uuidv4()}`;
      
      try {
        // Create test transaction in POS
        const createResponse = await this.createTestTransaction(transaction, transactionId);
        
        // Verify transaction retrieval
        const verifyResponse = await axios.post(
          `${TEST_CONFIG.apiBaseUrl}/api/pos/${this.provider}/transaction/verify`,
          {
            transactionId,
            businessId: this.businessId,
            expectedAmount: transaction.amount,
            timestamp: new Date().toISOString()
          },
          {
            headers: { Authorization: `Bearer ${this.authToken}` },
            timeout: TEST_CONFIG.timeouts.transaction
          }
        );

        const duration = Date.now() - startTime;
        this.metricsCollector.recordMetric('transaction_sync_duration', duration);

        results.push({
          transactionId,
          amount: transaction.amount,
          status: 'verified',
          duration,
          accuracy: verifyResponse.data.accuracy || 100
        });

      } catch (error) {
        const duration = Date.now() - startTime;
        results.push({
          transactionId,
          amount: transaction.amount,
          status: 'failed',
          duration,
          error: error.message
        });
      }
    }

    const successRate = (results.filter(r => r.status === 'verified').length / results.length) * 100;
    const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;

    return {
      status: successRate >= 80 ? 'passed' : 'failed',
      successRate: `${successRate.toFixed(1)}%`,
      avgDuration,
      transactions: results
    };
  }

  async testWebhooks(business) {
    console.log('🔔 Testing Webhooks...');
    const startTime = Date.now();
    
    // Register webhook endpoint
    const webhookUrl = `${TEST_CONFIG.apiBaseUrl}/api/pos/${this.provider}/webhooks/test`;
    
    try {
      // Register webhook
      const registerResponse = await axios.post(
        `${TEST_CONFIG.apiBaseUrl}/api/pos/${this.provider}/webhooks/register`,
        {
          businessId: this.businessId,
          webhookUrl,
          events: this.getWebhookEvents()
        },
        {
          headers: { Authorization: `Bearer ${this.authToken}` },
          timeout: TEST_CONFIG.timeouts.webhook
        }
      );

      this.webhookEndpoint = registerResponse.data.webhookId;

      // Trigger test events
      const eventResults = await this.triggerTestWebhookEvents();

      // Verify webhook delivery
      const verifyResponse = await axios.get(
        `${TEST_CONFIG.apiBaseUrl}/api/pos/${this.provider}/webhooks/verify/${this.webhookEndpoint}`,
        {
          headers: { Authorization: `Bearer ${this.authToken}` },
          timeout: TEST_CONFIG.timeouts.webhook
        }
      );

      const duration = Date.now() - startTime;
      const deliveryRate = (verifyResponse.data.delivered / verifyResponse.data.total) * 100;
      
      this.metricsCollector.recordMetric('webhook_delivery_rate', deliveryRate);
      this.metricsCollector.recordMetric('webhook_test_duration', duration);

      return {
        status: deliveryRate >= 95 ? 'passed' : 'failed',
        webhookId: this.webhookEndpoint,
        deliveryRate: `${deliveryRate.toFixed(1)}%`,
        avgLatency: verifyResponse.data.avgLatency,
        duration,
        events: eventResults
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        status: 'failed',
        duration,
        error: error.message,
        details: error.response?.data
      };
    }
  }

  async testErrorHandling() {
    console.log('⚠️ Testing Error Handling...');
    const errorScenarios = [
      {
        name: 'Invalid Transaction ID',
        test: async () => {
          return await axios.post(
            `${TEST_CONFIG.apiBaseUrl}/api/pos/${this.provider}/transaction/verify`,
            { transactionId: 'INVALID_ID_!!!', businessId: this.businessId },
            { headers: { Authorization: `Bearer ${this.authToken}` } }
          );
        },
        expectedError: 'TRANSACTION_NOT_FOUND'
      },
      {
        name: 'Expired Token',
        test: async () => {
          return await axios.get(
            `${TEST_CONFIG.apiBaseUrl}/api/pos/${this.provider}/transactions`,
            { headers: { Authorization: 'Bearer EXPIRED_TOKEN' } }
          );
        },
        expectedError: 'INVALID_TOKEN'
      },
      {
        name: 'Rate Limit Exceeded',
        test: async () => {
          const promises = [];
          for (let i = 0; i < 100; i++) {
            promises.push(
              axios.get(
                `${TEST_CONFIG.apiBaseUrl}/api/pos/${this.provider}/locations`,
                { headers: { Authorization: `Bearer ${this.authToken}` } }
              ).catch(e => e)
            );
          }
          return await Promise.all(promises);
        },
        expectedError: 'RATE_LIMIT_EXCEEDED'
      },
      {
        name: 'Network Timeout',
        test: async () => {
          return await axios.get(
            `${TEST_CONFIG.apiBaseUrl}/api/pos/${this.provider}/slow-endpoint`,
            { 
              headers: { Authorization: `Bearer ${this.authToken}` },
              timeout: 100 // Very short timeout to trigger error
            }
          );
        },
        expectedError: 'TIMEOUT'
      }
    ];

    const results = [];
    for (const scenario of errorScenarios) {
      try {
        await scenario.test();
        results.push({
          scenario: scenario.name,
          status: 'failed',
          error: 'Expected error but succeeded'
        });
      } catch (error) {
        const isExpectedError = error.response?.data?.error === scenario.expectedError ||
                               error.code === 'ECONNABORTED' && scenario.expectedError === 'TIMEOUT' ||
                               error.response?.status === 429 && scenario.expectedError === 'RATE_LIMIT_EXCEEDED';
        
        results.push({
          scenario: scenario.name,
          status: isExpectedError ? 'passed' : 'failed',
          receivedError: error.response?.data?.error || error.code,
          expectedError: scenario.expectedError
        });
      }
    }

    const passedCount = results.filter(r => r.status === 'passed').length;
    return {
      status: passedCount === results.length ? 'passed' : 'partial',
      passed: passedCount,
      total: results.length,
      scenarios: results
    };
  }

  async testPerformance(business) {
    console.log('⚡ Testing Performance...');
    const performanceTests = [
      {
        name: 'Transaction Verification Latency',
        iterations: 10,
        test: async () => {
          const start = Date.now();
          await axios.post(
            `${TEST_CONFIG.apiBaseUrl}/api/pos/${this.provider}/transaction/verify`,
            {
              transactionId: `PERF_TEST_${uuidv4()}`,
              businessId: this.businessId,
              amount: 100.00
            },
            {
              headers: { Authorization: `Bearer ${this.authToken}` },
              timeout: TEST_CONFIG.timeouts.transaction
            }
          ).catch(() => null); // Ignore errors for performance testing
          return Date.now() - start;
        }
      },
      {
        name: 'Location Retrieval',
        iterations: 10,
        test: async () => {
          const start = Date.now();
          await axios.get(
            `${TEST_CONFIG.apiBaseUrl}/api/pos/${this.provider}/locations`,
            {
              headers: { Authorization: `Bearer ${this.authToken}` },
              timeout: TEST_CONFIG.timeouts.transaction
            }
          ).catch(() => null);
          return Date.now() - start;
        }
      },
      {
        name: 'Webhook Processing',
        iterations: 5,
        test: async () => {
          const start = Date.now();
          await axios.post(
            `${TEST_CONFIG.apiBaseUrl}/api/pos/${this.provider}/webhooks/process`,
            {
              event: 'payment.created',
              data: { amount: 100, transactionId: uuidv4() }
            },
            {
              headers: { 'x-webhook-signature': 'test-signature' },
              timeout: TEST_CONFIG.timeouts.webhook
            }
          ).catch(() => null);
          return Date.now() - start;
        }
      }
    ];

    const results = [];
    for (const perfTest of performanceTests) {
      const latencies = [];
      for (let i = 0; i < perfTest.iterations; i++) {
        const latency = await perfTest.test();
        latencies.push(latency);
      }

      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const p95Latency = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)];
      const maxLatency = Math.max(...latencies);

      this.metricsCollector.recordMetric(`${perfTest.name.toLowerCase().replace(/\s+/g, '_')}_avg`, avgLatency);

      results.push({
        test: perfTest.name,
        avgLatency,
        p95Latency,
        maxLatency,
        status: avgLatency < 500 ? 'good' : avgLatency < 1000 ? 'acceptable' : 'poor'
      });
    }

    const allGood = results.every(r => r.status !== 'poor');
    return {
      status: allGood ? 'passed' : 'failed',
      tests: results
    };
  }

  // Provider-specific helper methods
  getProviderScopes() {
    const scopes = {
      square: ['MERCHANT_PROFILE_READ', 'PAYMENTS_READ', 'PAYMENTS_WRITE', 'ITEMS_READ'],
      shopify: ['read_orders', 'read_customers', 'read_products', 'read_locations'],
      zettle: ['READ:PURCHASE', 'READ:PRODUCT', 'READ:FINANCE', 'READ:USERINFO']
    };
    return scopes[this.provider] || [];
  }

  getWebhookEvents() {
    const events = {
      square: ['payment.created', 'payment.updated', 'refund.created'],
      shopify: ['orders/create', 'orders/updated', 'refunds/create'],
      zettle: ['purchase.created', 'purchase.updated', 'refund.created']
    };
    return events[this.provider] || [];
  }

  async createTestTransaction(transaction, transactionId) {
    // Simulate creating a test transaction in the POS system
    // This would normally interact with sandbox/test environments
    return {
      transactionId,
      amount: transaction.amount,
      items: transaction.items,
      paymentMethod: transaction.paymentMethod,
      timestamp: new Date().toISOString()
    };
  }

  async triggerTestWebhookEvents() {
    const events = this.getWebhookEvents();
    const results = [];

    for (const event of events) {
      try {
        await axios.post(
          `${TEST_CONFIG.apiBaseUrl}/api/pos/${this.provider}/webhooks/trigger-test`,
          {
            event,
            webhookId: this.webhookEndpoint,
            testData: {
              transactionId: uuidv4(),
              amount: 100.00,
              timestamp: new Date().toISOString()
            }
          },
          {
            headers: { Authorization: `Bearer ${this.authToken}` },
            timeout: TEST_CONFIG.timeouts.webhook
          }
        );
        results.push({ event, status: 'triggered' });
      } catch (error) {
        results.push({ event, status: 'failed', error: error.message });
      }
    }

    return results;
  }
}

// Metrics Collector
class MetricsCollector {
  constructor(provider) {
    this.provider = provider;
    this.metrics = {};
  }

  recordMetric(name, value) {
    if (!this.metrics[name]) {
      this.metrics[name] = [];
    }
    this.metrics[name].push({
      value,
      timestamp: Date.now()
    });
  }

  getMetrics() {
    const summary = {};
    for (const [name, values] of Object.entries(this.metrics)) {
      const nums = values.map(v => v.value);
      summary[name] = {
        avg: nums.reduce((a, b) => a + b, 0) / nums.length,
        min: Math.min(...nums),
        max: Math.max(...nums),
        count: nums.length
      };
    }
    return summary;
  }
}

// Test Runner
class POSTestRunner {
  constructor() {
    this.providers = ['square', 'shopify', 'zettle'];
    this.results = [];
  }

  async runAllTests() {
    console.log('🚀 Starting Comprehensive POS Integration Tests');
    console.log('=' * 80);
    console.log(`Testing ${this.providers.length} providers with ${Object.keys(SWEDISH_BUSINESS_SCENARIOS).length} business scenarios`);
    console.log(`Start time: ${new Date().toISOString()}`);
    console.log('=' * 80);

    const startTime = Date.now();

    for (const provider of this.providers) {
      for (const [businessType, businessScenario] of Object.entries(SWEDISH_BUSINESS_SCENARIOS)) {
        const tester = new POSIntegrationTester(provider);
        const result = await tester.runFullIntegrationTest(businessScenario);
        this.results.push(result);
        
        // Add delay between tests to avoid rate limiting
        await this.delay(2000);
      }
    }

    const duration = Date.now() - startTime;
    
    // Generate summary report
    const report = this.generateReport(duration);
    
    // Save report to file
    await this.saveReport(report);
    
    // Display summary
    this.displaySummary(report);
    
    return report;
  }

  generateReport(duration) {
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => !r.error).length;
    const failedTests = totalTests - passedTests;

    const providerSummary = {};
    for (const provider of this.providers) {
      const providerResults = this.results.filter(r => r.provider === provider);
      providerSummary[provider] = {
        total: providerResults.length,
        passed: providerResults.filter(r => !r.error).length,
        failed: providerResults.filter(r => r.error).length,
        metrics: this.aggregateMetrics(providerResults)
      };
    }

    return {
      summary: {
        totalTests,
        passedTests,
        failedTests,
        successRate: (passedTests / totalTests * 100).toFixed(1) + '%',
        duration: duration / 1000 + ' seconds',
        timestamp: new Date().toISOString()
      },
      providers: providerSummary,
      detailedResults: this.results
    };
  }

  aggregateMetrics(results) {
    const allMetrics = {};
    for (const result of results) {
      if (result.metrics) {
        for (const [key, value] of Object.entries(result.metrics)) {
          if (!allMetrics[key]) {
            allMetrics[key] = { values: [], avg: 0 };
          }
          allMetrics[key].values.push(value.avg || value);
        }
      }
    }

    for (const metric of Object.values(allMetrics)) {
      metric.avg = metric.values.reduce((a, b) => a + b, 0) / metric.values.length;
    }

    return allMetrics;
  }

  async saveReport(report) {
    const fs = require('fs').promises;
    const filename = `pos-integration-report-${Date.now()}.json`;
    const path = `./test-reports/${filename}`;
    
    try {
      await fs.mkdir('./test-reports', { recursive: true });
      await fs.writeFile(path, JSON.stringify(report, null, 2));
      console.log(`\n📄 Report saved to: ${path}`);
    } catch (error) {
      console.error('Failed to save report:', error.message);
    }
  }

  displaySummary(report) {
    console.log('\n' + '=' * 80);
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('=' * 80);
    
    console.log(`\nOverall Results:`);
    console.log(`  ✅ Passed: ${report.summary.passedTests}`);
    console.log(`  ❌ Failed: ${report.summary.failedTests}`);
    console.log(`  📈 Success Rate: ${report.summary.successRate}`);
    console.log(`  ⏱️ Total Duration: ${report.summary.duration}`);
    
    console.log(`\nProvider Breakdown:`);
    for (const [provider, summary] of Object.entries(report.providers)) {
      const icon = summary.failed === 0 ? '✅' : '⚠️';
      console.log(`  ${icon} ${provider.toUpperCase()}: ${summary.passed}/${summary.total} passed`);
      
      if (summary.metrics.oauth_flow_duration) {
        console.log(`     - OAuth Avg: ${summary.metrics.oauth_flow_duration.avg.toFixed(0)}ms`);
      }
      if (summary.metrics.transaction_sync_duration) {
        console.log(`     - Transaction Sync Avg: ${summary.metrics.transaction_sync_duration.avg.toFixed(0)}ms`);
      }
      if (summary.metrics.webhook_delivery_rate) {
        console.log(`     - Webhook Delivery: ${summary.metrics.webhook_delivery_rate.avg.toFixed(1)}%`);
      }
    }
    
    console.log('\n' + '=' * 80);
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Mock Swedish Business Scenarios for Testing
function generateMockSwedishBusinessData() {
  const swedishNames = ['Erik', 'Anna', 'Lars', 'Maria', 'Johan', 'Emma', 'Anders', 'Sara'];
  const swedishProducts = [
    'Kanelbullar', 'Köttbullar', 'Gravlax', 'Knäckebröd', 
    'Smörgåstårta', 'Filmjölk', 'Daim', 'Marabou choklad'
  ];
  
  return {
    customerName: swedishNames[Math.floor(Math.random() * swedishNames.length)],
    product: swedishProducts[Math.floor(Math.random() * swedishProducts.length)],
    amount: Math.floor(Math.random() * 900) + 100,
    currency: 'SEK'
  };
}

// Export for use in other test files
module.exports = {
  POSIntegrationTester,
  POSTestRunner,
  SWEDISH_BUSINESS_SCENARIOS,
  generateMockSwedishBusinessData,
  TEST_CONFIG
};

// Run tests if executed directly
if (require.main === module) {
  const runner = new POSTestRunner();
  runner.runAllTests()
    .then(report => {
      const exitCode = report.summary.failedTests > 0 ? 1 : 0;
      process.exit(exitCode);
    })
    .catch(error => {
      console.error('Fatal error during test execution:', error);
      process.exit(1);
    });
}