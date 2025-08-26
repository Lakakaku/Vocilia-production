# POS Adapters Package

Complete Point-of-Sale integration system with support for Square, Shopify, and Zettle.

## 🎯 Overview

This package provides a unified interface for integrating with multiple POS systems, featuring automatic provider detection, intelligent retry mechanisms, comprehensive error handling, and Swedish market optimizations.

## 📦 Installation

```bash
npm install @ai-feedback-platform/pos-adapters
```

## 🚀 Quick Start

```typescript
import { posAdapterFactory } from '@ai-feedback-platform/pos-adapters';

// Create an adapter
const adapter = await posAdapterFactory.createAdapter('square', {
  accessToken: process.env.SQUARE_ACCESS_TOKEN
});

// Test connection
const isConnected = await adapter.testConnection();

// Get transactions
const transactions = await adapter.getTransactions({
  startDate: '2024-01-01',
  endDate: '2024-08-26'
});
```

## 🏪 Supported POS Systems

### Square
- Full OAuth2 authentication
- Real-time transaction retrieval
- Webhook event processing
- Location mapping
- Catalog integration

### Shopify
- OAuth2 with HMAC verification
- Multi-store support
- Order and inventory sync
- Webhook subscriptions
- Product-level details

### Zettle (Swedish Market)
- PayPal OAuth integration
- Swish payment support
- Kassaregister compliance
- VAT reporting
- Swedish organization validation

## 🔧 Core Components

### POSAdapterFactory
Automatic provider selection and adapter creation.

```typescript
const factory = posAdapterFactory;

// Get provider recommendation
const recommendation = await factory.getRecommendation({
  businessType: 'cafe',
  location: 'Stockholm',
  features: ['swedish_payments']
});

// Create adapter
const adapter = await factory.createAdapter(recommendation.provider, config);
```

### RetryManager
Intelligent retry system with exponential backoff and circuit breaker.

```typescript
import { RetryManager } from '@ai-feedback-platform/pos-adapters';

const retryManager = new RetryManager({
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  enableCircuitBreaker: true
});

const result = await retryManager.executeWithRetry(
  () => fetchTransactions(),
  { 
    onRetry: (attempt, error) => console.log(`Retry ${attempt}: ${error.message}`)
  }
);
```

### POSErrorHandler
Comprehensive error categorization and handling.

```typescript
import { createPOSErrorHandler } from '@ai-feedback-platform/pos-adapters';

const errorHandler = createPOSErrorHandler('square');

const result = errorHandler.handleError(error, {
  operation: 'getTransactions',
  provider: 'square'
});

if (result.shouldRetry) {
  // Retry operation
} else {
  // Handle permanent failure
}
```

### POSHealthMonitor
Real-time health monitoring with automatic failover.

```typescript
import { createPOSHealthMonitor } from '@ai-feedback-platform/pos-adapters';

const monitor = createPOSHealthMonitor({
  checkInterval: 60000, // 1 minute
  unhealthyThreshold: 3,
  healthyThreshold: 2
});

await monitor.startMonitoring([
  { provider: 'square', adapter: squareAdapter },
  { provider: 'shopify', adapter: shopifyAdapter }
]);

monitor.on('unhealthy', (provider) => {
  console.log(`Provider ${provider} is unhealthy, switching to backup`);
});
```

## 🧪 Testing Framework

### Integration Testing
```typescript
import { POSIntegrationTestFramework } from '@ai-feedback-platform/pos-adapters';

const testFramework = new POSIntegrationTestFramework();

const report = await testFramework.runAllTests('square', {
  useMockServer: process.env.NODE_ENV === 'test',
  testCategories: ['oauth', 'transactions', 'webhooks']
});

console.log(`Tests passed: ${report.summary.passed}/${report.summary.total}`);
```

### Connection Validation
```typescript
import { createConnectionValidator } from '@ai-feedback-platform/pos-adapters';

const validator = createConnectionValidator(adapter, {
  provider: 'square',
  apiKey: process.env.SQUARE_ACCESS_TOKEN
});

const result = await validator.validateConnection('en');
console.log(result.success ? '✅ Connected' : '❌ Connection failed');

// Generate detailed report
const report = await validator.generateDetailedReport('sv'); // Swedish
```

## 🎨 UI Components

### Setup Wizard
React component for guided POS integration.

```tsx
import { POSSetupWizard } from '@ai-feedback-platform/pos-adapters';

function SetupPage() {
  return (
    <POSSetupWizard
      businessContext={businessContext}
      language="sv" // Swedish
      onComplete={(config) => {
        console.log('Setup complete:', config);
      }}
    />
  );
}
```

### Integration Health Dashboard
Real-time monitoring dashboard.

```tsx
import { IntegrationHealthDashboard } from '@ai-feedback-platform/pos-adapters';

function MonitoringPage() {
  return (
    <IntegrationHealthDashboard
      providers={['square', 'shopify', 'zettle']}
      language="en"
      refreshInterval={30000}
    />
  );
}
```

### Tutorials Component
Interactive integration tutorials.

```tsx
import { POSIntegrationTutorials } from '@ai-feedback-platform/pos-adapters';

function TutorialPage() {
  return (
    <POSIntegrationTutorials
      provider="zettle"
      language="sv"
      onComplete={() => console.log('Tutorial completed')}
    />
  );
}
```

### Troubleshooting Guide
Built-in issue resolution system.

```tsx
import { TroubleshootingGuide } from '@ai-feedback-platform/pos-adapters';

function SupportPage() {
  return (
    <TroubleshootingGuide
      provider="square"
      language="en"
      onIssueResolved={(issueId) => {
        console.log(`Issue ${issueId} resolved`);
      }}
    />
  );
}
```

## 🇸🇪 Swedish Market Features

### Zettle Integration
- **Swish Payments**: Native support for Sweden's most popular payment method
- **Kassaregister**: Full compliance with Swedish cash register laws
- **VAT Reporting**: Automated Swedish VAT calculations and reporting
- **Organization Validation**: Swedish organization number verification with Luhn algorithm

### Swedish Localization
- All UI components support Swedish language
- Error messages and troubleshooting in Swedish
- Swedish business context optimization
- Regional payment method priorities

## 📊 Performance

- **Connection validation**: < 2 seconds
- **Transaction retrieval**: < 500ms (cached)
- **Webhook processing**: < 100ms
- **Error recovery**: Automatic with exponential backoff
- **Health checks**: Every 60 seconds

## 🔒 Security

- OAuth token encryption
- Webhook signature verification
- Sensitive data redaction in logs
- PCI DSS compliance ready
- GDPR compliant data handling

## 🛠️ Configuration

### Environment Variables
```bash
# Square
SQUARE_CLIENT_ID=your_client_id
SQUARE_CLIENT_SECRET=your_client_secret
SQUARE_WEBHOOK_SECRET=your_webhook_secret

# Shopify
SHOPIFY_CLIENT_ID=your_client_id
SHOPIFY_CLIENT_SECRET=your_client_secret
SHOPIFY_WEBHOOK_SECRET=your_webhook_secret

# Zettle
ZETTLE_CLIENT_ID=your_client_id
ZETTLE_CLIENT_SECRET=your_client_secret
ZETTLE_WEBHOOK_SECRET=your_webhook_secret

# Optional
POS_ADAPTER_LOG_LEVEL=info
POS_ADAPTER_RETRY_MAX_ATTEMPTS=3
POS_ADAPTER_HEALTH_CHECK_INTERVAL=60000
```

## 📚 API Reference

### POSAdapter Interface
```typescript
interface POSAdapter {
  provider: POSProvider;
  capabilities: POSCapability[];
  
  testConnection(): Promise<boolean>;
  getMerchant(): Promise<Merchant>;
  getLocations(): Promise<Location[]>;
  getTransactions(options: TransactionOptions): Promise<Transaction[]>;
  getTransaction(id: string): Promise<Transaction | null>;
  subscribeToWebhooks(events: string[], url: string): Promise<WebhookSubscription>;
  processWebhook(payload: any, signature?: string): Promise<WebhookEvent>;
}
```

## 🧪 Testing

```bash
# Run unit tests
npm run test

# Run integration tests
npm run test:integration

# Run with mock servers
npm run test:mock

# Generate coverage report
npm run test:coverage
```

## 📈 Monitoring

The package includes built-in monitoring capabilities:

- Transaction success rates
- API latency tracking
- Error rate monitoring
- Webhook delivery tracking
- Provider availability metrics

## 🤝 Contributing

See the main repository's CONTRIBUTING.md for guidelines.

## 📄 License

MIT - See LICENSE file for details.

## 🆘 Support

For issues or questions:
- Check the built-in troubleshooting guide
- Review the interactive tutorials
- Contact support@aifeedbackplatform.com

---

Built with ❤️ for the Swedish market and beyond.