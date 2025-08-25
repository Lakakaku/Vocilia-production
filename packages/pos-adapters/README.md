# POS Adapters Package

Universal POS system integration package supporting Square, Shopify, and Zettle with intelligent provider detection and standardized APIs.

## Features

🔄 **Universal Interface** - Single adapter interface for all POS systems
🔐 **OAuth Management** - Secure OAuth flows for all providers
🎯 **Smart Detection** - Automatic POS system detection based on business context
🏭 **Factory Pattern** - Easy adapter creation with automatic provider selection
📊 **Capability Discovery** - Understand what each POS system supports
🔒 **Error Handling** - Robust retry logic and error management

## Quick Start

```typescript
import { posAdapterFactory, BusinessContext } from '@ai-feedback-platform/pos-adapters';

// Automatic provider detection
const businessContext: BusinessContext = {
  name: 'Aurora Café',
  industry: 'restaurant',
  country: 'SE',
  size: 'small'
};

const adapter = await posAdapterFactory.createAdapter({
  autoDetect: true,
  businessContext,
  requiredCapabilities: ['transactions', 'webhooks']
});

// Manual provider selection
const credentials = {
  provider: 'square',
  accessToken: 'your-access-token',
  environment: 'sandbox'
};

const squareAdapter = await posAdapterFactory.createAdapter({
  provider: 'square',
  credentials
});
```

## Architecture

### Core Components

1. **POSAdapter Interface** - Universal interface for all POS systems
2. **BasePOSAdapter** - Common functionality and error handling
3. **OAuthManager** - OAuth flow management for all providers
4. **POSDetector** - Intelligent provider detection and capability discovery
5. **POSAdapterFactory** - Factory for creating and configuring adapters

### Provider Support

| Provider | Transactions | Webhooks | Inventory | Customers | Refunds | Regions |
|----------|-------------|----------|-----------|-----------|---------|---------|
| **Square** | ✅ | ✅ | ✅ | ✅ | ❌ | US, CA, AU, JP, UK, IE |
| **Shopify** | ✅ | ✅ | ✅ | ✅ | ✅ | Global |
| **Zettle** | ✅ | ❌ | ✅ | ❌ | ❌ | EU, Nordic, BR, MX |

## Usage Examples

### OAuth Flow

```typescript
import { OAuthManager } from '@ai-feedback-platform/pos-adapters';

const oauthManager = new OAuthManager();

// Register provider configuration
oauthManager.registerProvider({
  provider: 'square',
  clientId: 'your-square-client-id',
  clientSecret: 'your-square-client-secret',
  redirectUri: 'https://your-app.com/oauth/callback',
  environment: 'sandbox'
});

// Generate authorization URL
const authUrl = await oauthManager.generateAuthorizationUrl('square', 'business-123');

// Exchange code for token
const tokenResponse = await oauthManager.exchangeCodeForToken(
  'square',
  'authorization-code',
  'oauth-state'
);
```

### Provider Detection

```typescript
import { POSDetector } from '@ai-feedback-platform/pos-adapters';

const detector = new POSDetector();

const detectionResult = await detector.detectPOSSystems({
  name: 'Tech Retail Store',
  website: 'https://shop.example.com',
  industry: 'retail',
  country: 'SE',
  size: 'medium',
  existingIntegrations: ['shopify']
});

console.log('Primary suggestion:', detectionResult.primarySuggestion);
console.log('Alternatives:', detectionResult.alternativeSuggestions);
```

### Transaction Search

```typescript
// Search for transactions
const searchResult = await adapter.searchTransactions({
  locationId: 'location-123',
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-01-31'),
  minAmount: 100, // SEK
  limit: 50
});

// Find matching transaction for verification
const matchingTransaction = await adapter.findMatchingTransaction(
  'location-123',
  250, // SEK
  new Date('2024-01-15T14:30:00Z'),
  2 // 2 minutes tolerance
);
```

### Webhook Management

```typescript
// Create webhook
const webhook = await adapter.createWebhook({
  url: 'https://your-app.com/webhooks/pos',
  events: ['payment.created', 'payment.updated'],
  secret: 'your-webhook-secret',
  active: true
});

// Validate webhook payload
const validation = await adapter.validateWebhook(
  payload,
  signature,
  webhookSecret
);
```

## Error Handling

The package includes comprehensive error handling with automatic retry logic:

```typescript
import { POSApiError } from '@ai-feedback-platform/pos-adapters';

try {
  const transaction = await adapter.getTransaction('tx-123');
} catch (error) {
  if (error instanceof POSApiError) {
    console.log('Error code:', error.code);
    console.log('Retryable:', error.retryable);
    console.log('Status code:', error.statusCode);
  }
}
```

## Configuration

### Environment Variables

```bash
# Square Configuration
SQUARE_CLIENT_ID=your-square-client-id
SQUARE_CLIENT_SECRET=your-square-client-secret
SQUARE_ENVIRONMENT=sandbox # or production

# Shopify Configuration
SHOPIFY_CLIENT_ID=your-shopify-client-id
SHOPIFY_CLIENT_SECRET=your-shopify-client-secret

# Zettle Configuration
ZETTLE_CLIENT_ID=your-zettle-client-id
ZETTLE_CLIENT_SECRET=your-zettle-client-secret
```

## Development

### Building

```bash
npm run build
```

### Type Checking

```bash
npm run type-check
```

### Development Mode

```bash
npm run dev
```

## Implementation Status

✅ **Core Infrastructure Complete**
- [x] Universal POS adapter interface
- [x] OAuth flow management
- [x] Provider detection system
- [x] Adapter factory with auto-selection
- [x] Error handling and retry logic
- [x] Comprehensive TypeScript types

🔄 **Next Steps**
- [ ] Square adapter implementation
- [ ] Shopify adapter implementation  
- [ ] Zettle adapter implementation
- [ ] Webhook processing system
- [ ] Integration testing suite

## Contributing

When implementing new POS adapters:

1. Extend `BasePOSAdapter`
2. Implement all required methods from `POSAdapter` interface
3. Add provider-specific capabilities to `POSDetector`
4. Register the adapter in `POSAdapterFactory`
5. Add comprehensive tests

## License

This package is part of the AI Feedback Platform and follows the same licensing terms.