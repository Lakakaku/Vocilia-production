# Integration Guide: AI Feedback Platform

*Complete guide for integrating with POS systems, payment providers, and third-party services*

## Table of Contents

1. [Integration Overview](#integration-overview)
2. [POS System Integration](#pos-system-integration)
3. [Payment Provider Integration](#payment-provider-integration) 
4. [Webhook Integration](#webhook-integration)
5. [Third-party Services](#third-party-services)
6. [Security Considerations](#security-considerations)
7. [Testing & Validation](#testing--validation)
8. [Troubleshooting](#troubleshooting)

---

## Integration Overview

### Integration Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   POS System    │◄──►│  AI Feedback     │◄──►│  Payment        │
│  (Square/Zettle)│    │    Platform      │    │  (Stripe/Swish) │
└─────────────────┘    └──────────────────┘    └─────────────────┘
        ▲                        ▲                      ▲
        │                        │                      │
        ▼                        ▼                      ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Webhooks      │    │   Your Business  │    │   Analytics     │
│   (Real-time)   │    │     System       │    │   (Optional)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Integration Types

**1. Standard Integration**
- Pre-built connectors for major POS systems
- Minimal technical setup required
- OAuth-based authentication
- Real-time transaction sync

**2. Custom Integration**
- REST API integration
- Webhook notifications
- Custom business logic
- Full control over data flow

**3. Manual Integration**
- No API connection required
- Staff-assisted verification
- Receipt-based validation
- Suitable for any POS system

---

## POS System Integration

### Supported POS Systems

#### 1. Square POS Integration

**Prerequisites:**
- Active Square account
- Square Developer application
- Production location(s) in Sweden

**Setup Process:**

1. **Square Developer Setup**
   ```bash
   # 1. Create Square application at https://developer.squareup.com
   # 2. Note your Application ID and Application Secret
   # 3. Add redirect URI: https://business.aifeedback.se/integrations/square/callback
   ```

2. **OAuth Configuration**
   ```javascript
   const SQUARE_OAUTH_CONFIG = {
     client_id: 'sq0idp-your-app-id',
     redirect_uri: 'https://business.aifeedback.se/integrations/square/callback',
     scope: [
       'MERCHANT_PROFILE_READ',
       'PAYMENTS_READ',
       'ORDERS_READ'
     ],
     session_state: 'random_state_string'
   };
   
   // Redirect URL for authorization
   const authUrl = `https://connect.squareup.com/oauth2/authorize?` +
     `client_id=${SQUARE_OAUTH_CONFIG.client_id}&` +
     `scope=${SQUARE_OAUTH_CONFIG.scope.join(',')}&` +
     `session=false&` +
     `state=${SQUARE_OAUTH_CONFIG.session_state}`;
   ```

3. **Integration Configuration**
   ```json
   {
     "pos_provider": "square",
     "merchant_id": "MLZPQQJ4H0XWG",
     "location_ids": ["L7HXY8Z2R3456"],
     "webhook_signature_key": "your_webhook_signature_key",
     "sync_settings": {
       "real_time": true,
       "transaction_retention_days": 30,
       "sync_order_items": true
     }
   }
   ```

4. **Transaction Verification API**
   ```javascript
   async function verifySquareTransaction(transactionId, locationId) {
     const client = new squareConnect.PaymentsApi();
     
     try {
       const payment = await client.getPayment(transactionId);
       
       return {
         verified: true,
         amount: payment.amount_money.amount,
         currency: payment.amount_money.currency,
         timestamp: payment.created_at,
         location_id: payment.location_id,
         order_id: payment.order_id
       };
     } catch (error) {
       return { verified: false, error: error.message };
     }
   }
   ```

#### 2. Zettle (PayPal) Integration

**Prerequisites:**
- Zettle merchant account
- API credentials from Zettle dashboard
- Swedish business registration

**Setup Process:**

1. **API Authentication**
   ```bash
   curl -X POST "https://oauth.izettle.com/token" \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer" \
     -d "client_id=your_client_id" \
     -d "assertion=your_jwt_assertion"
   ```

2. **Webhook Configuration**
   ```json
   {
     "webhook_url": "https://api.aifeedback.se/webhooks/zettle",
     "events": ["PaymentCreated"],
     "transport_name": "HttpTransport",
     "contact_email": "tech@yourbusiness.se"
   }
   ```

3. **Transaction Sync Implementation**
   ```python
   import requests
   
   class ZettleIntegration:
       def __init__(self, access_token):
           self.access_token = access_token
           self.base_url = "https://purchase.izettle.com"
       
       def verify_transaction(self, transaction_id):
           headers = {
               'Authorization': f'Bearer {self.access_token}',
               'Content-Type': 'application/json'
           }
           
           response = requests.get(
               f"{self.base_url}/purchases/v2/{transaction_id}",
               headers=headers
           )
           
           if response.status_code == 200:
               purchase = response.json()
               return {
                   'verified': True,
                   'amount': purchase['amount'],
                   'currency': purchase['currency'], 
                   'timestamp': purchase['timestamp'],
                   'products': purchase['products']
               }
           
           return {'verified': False}
   ```

#### 3. Shopify POS Integration

**Prerequisites:**
- Shopify Plus account (POS API access)
- Custom app with appropriate permissions
- Location-based setup

**Setup Process:**

1. **Custom App Creation**
   ```json
   {
     "scopes": [
       "read_orders",
       "read_products", 
       "read_locations",
       "read_inventory"
     ],
     "webhook_endpoints": [
       {
         "topic": "orders/paid",
         "address": "https://api.aifeedback.se/webhooks/shopify"
       }
     ]
   }
   ```

2. **GraphQL Transaction Verification**
   ```graphql
   query getOrder($id: ID!) {
     order(id: $id) {
       id
       name
       createdAt
       totalPrice
       currencyCode
       lineItems(first: 10) {
         edges {
           node {
             title
             quantity
             price
           }
         }
       }
       physicalLocation {
         id
         name
       }
     }
   }
   ```

3. **Integration Implementation**
   ```javascript
   const { Shopify } = require('@shopify/shopify-api');
   
   class ShopifyPOSIntegration {
     constructor(shop, accessToken) {
       this.client = new Shopify.Clients.Graphql(shop, accessToken);
     }
     
     async verifyTransaction(orderId) {
       const query = `
         query getOrder($id: ID!) {
           order(id: $id) {
             id
             totalPriceSet {
               shopMoney {
                 amount
                 currencyCode
               }
             }
             createdAt
             lineItems(first: 10) {
               edges {
                 node {
                   title
                   quantity
                 }
               }
             }
           }
         }
       `;
       
       const response = await this.client.query({
         data: { query, variables: { id: orderId } }
       });
       
       return response.body.data.order;
     }
   }
   ```

### Generic POS Integration Framework

**For unsupported POS systems:**

```python
class GenericPOSAdapter:
    def __init__(self, config):
        self.config = config
        self.api_client = self.create_api_client()
    
    def verify_transaction(self, transaction_id, expected_amount):
        """
        Generic transaction verification interface
        All POS adapters must implement this method
        """
        try:
            transaction = self.fetch_transaction(transaction_id)
            
            return {
                'verified': self.validate_transaction(transaction, expected_amount),
                'amount': transaction.get('amount'),
                'currency': transaction.get('currency', 'SEK'),
                'timestamp': transaction.get('timestamp'),
                'items': self.parse_line_items(transaction),
                'location_id': transaction.get('location_id')
            }
        except Exception as e:
            return {
                'verified': False,
                'error': str(e)
            }
    
    def setup_webhook(self, events):
        """Setup webhooks for real-time updates"""
        pass
    
    def fetch_transaction(self, transaction_id):
        """Fetch transaction from POS system API"""
        raise NotImplementedError()
    
    def validate_transaction(self, transaction, expected_amount):
        """Business logic for transaction validation"""
        actual_amount = transaction.get('amount', 0)
        tolerance = 0.01  # 1 öre tolerance
        
        return abs(actual_amount - expected_amount) <= tolerance
```

---

## Payment Provider Integration

### Stripe Connect Integration

**Architecture Overview:**
```
Customer ──► AI Feedback ──► Stripe ──► Business Account
         Platform              Connect
         (Reward Processing)    (Express Account)
```

**Setup Process:**

1. **Express Account Creation**
   ```javascript
   const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
   
   async function createExpressAccount(businessData) {
     const account = await stripe.accounts.create({
       type: 'express',
       country: 'SE',
       email: businessData.email,
       business_type: 'company',
       company: {
         name: businessData.businessName,
         tax_id: businessData.orgNumber,
         phone: businessData.phone,
         address: {
           line1: businessData.address.street,
           city: businessData.address.city,
           postal_code: businessData.address.postalCode,
           country: 'SE'
         }
       },
       capabilities: {
         transfers: { requested: true },
         card_payments: { requested: true }
       },
       tos_acceptance: {
         service_agreement: 'full'
       }
     });
     
     return account;
   }
   ```

2. **Onboarding Link Generation**
   ```javascript
   async function createOnboardingLink(accountId, refreshUrl, returnUrl) {
     const accountLink = await stripe.accountLinks.create({
       account: accountId,
       refresh_url: refreshUrl,
       return_url: returnUrl,
       type: 'account_onboarding'
     });
     
     return accountLink;
   }
   ```

3. **Customer Reward Processing**
   ```javascript
   async function processCustomerReward(rewardData) {
     try {
       // Create transfer to business account
       const transfer = await stripe.transfers.create({
         amount: rewardData.totalAmount, // in öre
         currency: 'sek',
         destination: rewardData.businessStripeAccount,
         metadata: {
           session_id: rewardData.sessionId,
           quality_score: rewardData.qualityScore,
           business_id: rewardData.businessId
         }
       });
       
       // Create payout to customer
       const payout = await stripe.payouts.create({
         amount: rewardData.customerReward,
         currency: 'sek',
         method: 'instant',
         destination: rewardData.customerPaymentMethod
       }, {
         stripeAccount: rewardData.businessStripeAccount
       });
       
       return {
         transfer_id: transfer.id,
         payout_id: payout.id,
         status: 'completed'
       };
       
     } catch (error) {
       return {
         status: 'failed',
         error: error.message
       };
     }
   }
   ```

### Swish Integration

**Direct Swish API Integration:**

```javascript
class SwishPaymentProcessor {
  constructor(config) {
    this.merchantId = config.merchantId;
    this.certificate = config.certificate;
    this.baseUrl = 'https://mss.cpc.getswish.net/swish-cpcapi/api/v1';
  }
  
  async createPaymentRequest(phoneNumber, amount, message) {
    const paymentData = {
      payeePaymentReference: this.generateReference(),
      callbackUrl: 'https://api.aifeedback.se/webhooks/swish',
      payerAlias: phoneNumber,
      payeeAlias: this.merchantId,
      amount: amount,
      currency: 'SEK',
      message: message
    };
    
    const response = await this.makeSecureRequest(
      'POST',
      '/paymentrequests',
      paymentData
    );
    
    return response;
  }
  
  async checkPaymentStatus(paymentReference) {
    return await this.makeSecureRequest(
      'GET',
      `/paymentrequests/${paymentReference}`
    );
  }
  
  makeSecureRequest(method, endpoint, data = null) {
    // Implementation with client certificates
    // and proper SSL configuration for Swish API
  }
}
```

### Alternative Payment Methods

**Klarna Integration:**
```javascript
const klarna = require('@klarna/kco-node-sdk');

class KlarnaPaymentProcessor {
  async createPaymentSession(orderData) {
    const client = klarna({
      username: process.env.KLARNA_USERNAME,
      password: process.env.KLARNA_PASSWORD,
      apiUrl: klarna.ApiUrls.EU_TEST // or EU_LIVE
    });
    
    const order = {
      purchase_country: 'SE',
      purchase_currency: 'SEK',
      locale: 'sv-SE',
      order_amount: orderData.amount,
      order_lines: [
        {
          type: 'digital',
          name: 'AI Feedback Reward',
          quantity: 1,
          unit_price: orderData.amount,
          total_amount: orderData.amount
        }
      ]
    };
    
    return await client.checkoutAPI.createOrder(order);
  }
}
```

---

## Webhook Integration

### Webhook Event Processing

**Event Handler Framework:**
```javascript
class WebhookEventHandler {
  constructor() {
    this.handlers = new Map();
    this.registerHandlers();
  }
  
  registerHandlers() {
    this.handlers.set('square.payment.created', this.handleSquarePayment);
    this.handlers.set('zettle.purchase.completed', this.handleZettlePurchase);
    this.handlers.set('stripe.transfer.created', this.handleStripeTransfer);
    this.handlers.set('swish.payment.completed', this.handleSwishPayment);
  }
  
  async processEvent(eventType, payload, headers) {
    // Verify webhook signature
    if (!this.verifySignature(eventType, payload, headers)) {
      throw new Error('Invalid webhook signature');
    }
    
    const handler = this.handlers.get(eventType);
    if (!handler) {
      console.warn(`No handler for event type: ${eventType}`);
      return { status: 'ignored' };
    }
    
    try {
      return await handler(payload);
    } catch (error) {
      console.error(`Error processing ${eventType}:`, error);
      throw error;
    }
  }
  
  async handleSquarePayment(payload) {
    const payment = payload.data.object.payment;
    
    // Update internal transaction records
    await this.updateTransactionRecord({
      pos_transaction_id: payment.id,
      amount: payment.amount_money.amount,
      status: payment.status,
      location_id: payment.location_id,
      created_at: payment.created_at
    });
    
    return { status: 'processed' };
  }
}
```

### Webhook Security

**Signature Verification:**
```javascript
const crypto = require('crypto');

function verifyWebhookSignature(provider, payload, signature, secret) {
  switch (provider) {
    case 'square':
      return verifySquareSignature(payload, signature, secret);
    case 'stripe':
      return verifyStripeSignature(payload, signature, secret);
    case 'zettle':
      return verifyZettleSignature(payload, signature, secret);
    default:
      return false;
  }
}

function verifySquareSignature(payload, signature, webhookSignatureKey) {
  const hmac = crypto.createHmac('sha256', webhookSignatureKey);
  hmac.update(payload);
  const hash = hmac.digest('base64');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'base64'),
    Buffer.from(hash, 'base64')
  );
}

function verifyStripeSignature(payload, signature, endpointSecret) {
  const stripe = require('stripe');
  
  try {
    stripe.webhooks.constructEvent(payload, signature, endpointSecret);
    return true;
  } catch (err) {
    return false;
  }
}
```

### Webhook Retry Logic

**Exponential Backoff Implementation:**
```javascript
class WebhookRetryHandler {
  constructor(maxRetries = 5, baseDelay = 1000) {
    this.maxRetries = maxRetries;
    this.baseDelay = baseDelay;
  }
  
  async processWithRetry(eventProcessor, event) {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await eventProcessor(event);
        
        // Log successful processing
        await this.logWebhookEvent(event, 'success', result);
        return result;
        
      } catch (error) {
        const isLastAttempt = attempt === this.maxRetries;
        
        if (isLastAttempt) {
          // Log final failure
          await this.logWebhookEvent(event, 'failed', error);
          throw error;
        }
        
        // Calculate delay with jitter
        const delay = this.baseDelay * Math.pow(2, attempt - 1);
        const jitter = Math.random() * 0.1 * delay;
        
        await this.sleep(delay + jitter);
        
        // Log retry attempt
        await this.logWebhookEvent(event, 'retry', { 
          attempt, 
          error: error.message 
        });
      }
    }
  }
  
  async logWebhookEvent(event, status, details) {
    // Implementation for logging webhook processing
    const logEntry = {
      event_id: event.id,
      event_type: event.type,
      status,
      details,
      timestamp: new Date().toISOString()
    };
    
    // Store in database or logging service
    await this.persistWebhookLog(logEntry);
  }
}
```

---

## Third-party Services

### Analytics Integrations

**Google Analytics 4 Integration:**
```javascript
const { GoogleAnalyticsData } = require('@google-analytics/data');

class GAIntegration {
  constructor(propertyId, keyFile) {
    this.analyticsData = new GoogleAnalyticsData({
      keyFilename: keyFile
    });
    this.propertyId = propertyId;
  }
  
  async trackFeedbackEvent(sessionData) {
    const event = {
      client_id: sessionData.customer_hash,
      events: [
        {
          name: 'feedback_completed',
          parameters: {
            quality_score: sessionData.quality_score,
            reward_amount: sessionData.reward_amount,
            business_name: sessionData.business_name,
            categories: sessionData.categories.join(',')
          }
        }
      ]
    };
    
    // Send to GA4 Measurement Protocol
    return await this.sendGAEvent(event);
  }
}
```

**Mixpanel Integration:**
```javascript
const Mixpanel = require('mixpanel');

class MixpanelIntegration {
  constructor(token) {
    this.mixpanel = Mixpanel.init(token);
  }
  
  trackFeedbackSession(sessionData) {
    this.mixpanel.track('Feedback Session Completed', {
      distinct_id: sessionData.customer_hash,
      business_id: sessionData.business_id,
      quality_score: sessionData.quality_score,
      reward_tier: sessionData.reward_tier,
      categories: sessionData.categories,
      language: sessionData.language,
      device_type: sessionData.device_type
    });
  }
  
  updateBusinessProfile(businessId, properties) {
    this.mixpanel.people.set(businessId, properties);
  }
}
```

### CRM Integrations

**HubSpot Integration:**
```javascript
const hubspot = require('@hubspot/api-client');

class HubSpotIntegration {
  constructor(accessToken) {
    this.hubspotClient = new hubspot.Client({ accessToken });
  }
  
  async syncBusinessData(businessData) {
    try {
      // Create or update company
      const company = await this.hubspotClient.crm.companies.basicApi.create({
        properties: {
          name: businessData.name,
          domain: businessData.website,
          city: businessData.address.city,
          country: 'Sweden',
          industry: businessData.industry,
          feedback_platform_tier: businessData.tier,
          total_feedback_sessions: businessData.stats.total_sessions,
          average_quality_score: businessData.stats.avg_quality
        }
      });
      
      return company;
    } catch (error) {
      console.error('HubSpot sync error:', error);
      throw error;
    }
  }
}
```

### Email Service Integrations

**SendGrid Integration:**
```javascript
const sgMail = require('@sendgrid/mail');

class EmailNotificationService {
  constructor(apiKey) {
    sgMail.setApiKey(apiKey);
    this.templates = {
      business_onboarding: 'd-abc123def456',
      monthly_report: 'd-def456abc123',
      fraud_alert: 'd-ghi789jkl012'
    };
  }
  
  async sendBusinessOnboardingEmail(businessData) {
    const msg = {
      to: businessData.email,
      from: 'onboarding@aifeedback.se',
      templateId: this.templates.business_onboarding,
      dynamicTemplateData: {
        business_name: businessData.name,
        setup_url: businessData.setup_url,
        support_email: 'support@aifeedback.se'
      }
    };
    
    return await sgMail.send(msg);
  }
  
  async sendMonthlyReport(businessId, reportData) {
    const msg = {
      to: reportData.business_email,
      from: 'reports@aifeedback.se',
      templateId: this.templates.monthly_report,
      dynamicTemplateData: reportData,
      attachments: [
        {
          content: reportData.pdf_report_base64,
          filename: `report-${businessId}-${reportData.month}.pdf`,
          type: 'application/pdf',
          disposition: 'attachment'
        }
      ]
    };
    
    return await sgMail.send(msg);
  }
}
```

---

## Security Considerations

### API Security Best Practices

**1. Authentication & Authorization**
```javascript
// API Key rotation
class APIKeyManager {
  async rotateAPIKey(businessId, keyType) {
    // Deactivate old key
    await this.deactivateKey(businessId, keyType);
    
    // Generate new key
    const newKey = await this.generateKey(businessId, keyType);
    
    // Notify business owner
    await this.notifyKeyRotation(businessId, newKey);
    
    return newKey;
  }
  
  validateKeyPermissions(apiKey, requiredPermissions) {
    const keyData = this.decodeAPIKey(apiKey);
    
    return requiredPermissions.every(permission => 
      keyData.permissions.includes(permission)
    );
  }
}
```

**2. Data Encryption**
```javascript
const crypto = require('crypto');

class DataEncryption {
  constructor(encryptionKey) {
    this.algorithm = 'aes-256-gcm';
    this.key = Buffer.from(encryptionKey, 'hex');
  }
  
  encrypt(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(this.algorithm, this.key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }
  
  decrypt(encryptedData) {
    const decipher = crypto.createDecipher(
      this.algorithm, 
      this.key, 
      Buffer.from(encryptedData.iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}
```

**3. Rate Limiting Implementation**
```javascript
const Redis = require('redis');

class RateLimiter {
  constructor(redisClient) {
    this.redis = redisClient;
  }
  
  async checkRateLimit(key, limit, windowMs) {
    const multi = this.redis.multi();
    const now = Date.now();
    const window = Math.floor(now / windowMs);
    const redisKey = `rate_limit:${key}:${window}`;
    
    multi.incr(redisKey);
    multi.expire(redisKey, Math.ceil(windowMs / 1000));
    
    const [count] = await multi.exec();
    
    return {
      allowed: count <= limit,
      count: count,
      resetTime: (window + 1) * windowMs
    };
  }
}
```

### GDPR Compliance

**Data Processing Audit Trail:**
```javascript
class GDPRAuditLogger {
  async logDataAccess(userId, dataType, purpose, legalBasis) {
    const auditEntry = {
      timestamp: new Date().toISOString(),
      user_id: userId,
      data_type: dataType,
      processing_purpose: purpose,
      legal_basis: legalBasis,
      ip_address: this.getClientIP(),
      user_agent: this.getUserAgent()
    };
    
    await this.persistAuditLog(auditEntry);
  }
  
  async processDataDeletionRequest(customerHash) {
    const deletionTasks = [
      this.anonymizeTranscripts(customerHash),
      this.deleteVoiceRecordings(customerHash),
      this.removePaymentDetails(customerHash),
      this.updateConsentRecords(customerHash)
    ];
    
    const results = await Promise.allSettled(deletionTasks);
    
    // Log deletion completion
    await this.logDataAccess(
      'system',
      'personal_data_deletion',
      'gdpr_right_to_erasure',
      'legal_obligation'
    );
    
    return results;
  }
}
```

---

## Testing & Validation

### Integration Testing Framework

**Test Environment Setup:**
```javascript
const testConfig = {
  apiBaseUrl: 'https://staging-api.aifeedback.se/v1',
  testAPIKey: 'sk_test_1234567890abcdef',
  testBusinessId: 'biz_test_cafe_aurora',
  testLocationId: 'loc_test_main_store',
  webhookTestEndpoint: 'https://webhook.site/test-endpoint'
};

class IntegrationTestSuite {
  constructor(config) {
    this.config = config;
    this.client = new AIFeedbackClient(config.testAPIKey);
  }
  
  async runFullTestSuite() {
    const testResults = await Promise.allSettled([
      this.testPOSIntegration(),
      this.testPaymentFlow(),
      this.testWebhookDelivery(),
      this.testErrorHandling(),
      this.testRateLimiting()
    ]);
    
    return this.generateTestReport(testResults);
  }
  
  async testPOSIntegration() {
    console.log('Testing POS integration...');
    
    // Test transaction creation
    const transaction = await this.createTestTransaction();
    
    // Test transaction verification
    const verification = await this.client.verifyTransaction(
      transaction.id,
      transaction.amount
    );
    
    assert(verification.verified, 'Transaction should be verified');
    
    return { test: 'pos_integration', status: 'passed' };
  }
  
  async testPaymentFlow() {
    console.log('Testing payment flow...');
    
    // Create test session
    const session = await this.client.createSession({
      qr_token: 'qr_test_token',
      customer_hash: 'test_customer_hash'
    });
    
    // Submit test feedback
    const feedbackResult = await this.client.submitFeedback(
      session.id,
      this.generateTestAudio()
    );
    
    assert(feedbackResult.reward_amount > 0, 'Should calculate reward');
    
    return { test: 'payment_flow', status: 'passed' };
  }
}
```

### Mock Services for Testing

**Mock POS System:**
```javascript
class MockPOSSystem {
  constructor() {
    this.transactions = new Map();
    this.webhookUrl = null;
  }
  
  createTransaction(data) {
    const transactionId = `test_txn_${Date.now()}`;
    const transaction = {
      id: transactionId,
      amount: data.amount,
      currency: 'SEK',
      timestamp: new Date().toISOString(),
      items: data.items,
      status: 'completed'
    };
    
    this.transactions.set(transactionId, transaction);
    
    // Simulate webhook delivery
    if (this.webhookUrl) {
      this.sendWebhook('transaction.created', transaction);
    }
    
    return transaction;
  }
  
  getTransaction(transactionId) {
    return this.transactions.get(transactionId);
  }
  
  async sendWebhook(event, data) {
    const payload = {
      event,
      data,
      timestamp: new Date().toISOString()
    };
    
    // Simulate webhook delivery with delay
    setTimeout(async () => {
      await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }, 100);
  }
}
```

### Load Testing

**Load Test Configuration:**
```javascript
const k6 = require('k6');

// Load test for feedback submission flow
export let options = {
  stages: [
    { duration: '2m', target: 100 },  // Ramp up to 100 users
    { duration: '5m', target: 100 },  // Stay at 100 users
    { duration: '2m', target: 200 },  // Ramp up to 200 users
    { duration: '5m', target: 200 },  // Stay at 200 users
    { duration: '2m', target: 0 },    // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests under 2s
    http_req_failed: ['rate<0.01'],    // Error rate under 1%
  },
};

export default function() {
  // Create session
  let sessionResponse = k6.http.post(
    'https://staging-api.aifeedback.se/v1/feedback/sessions',
    JSON.stringify({
      qr_token: 'qr_test_token',
      customer_hash: `test_customer_${__VU}_${__ITER}`
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer sk_test_...'
      }
    }
  );
  
  k6.check(sessionResponse, {
    'session created': (r) => r.status === 201
  });
  
  // Submit feedback
  if (sessionResponse.status === 201) {
    let session = JSON.parse(sessionResponse.body);
    
    let feedbackResponse = k6.http.post(
      `https://staging-api.aifeedback.se/v1/feedback/sessions/${session.id}/voice`,
      {
        audio: k6.http.file(loadTestAudioFile),
        duration: '30.5',
        language: 'sv'
      },
      {
        headers: {
          'Authorization': 'Bearer sk_test_...'
        }
      }
    );
    
    k6.check(feedbackResponse, {
      'feedback submitted': (r) => r.status === 202
    });
  }
  
  k6.sleep(1);
}
```

---

## Troubleshooting

### Common Integration Issues

**1. Authentication Problems**

*Issue: "Invalid API key" errors*
```bash
# Check API key format
echo $AIFEEDBACK_API_KEY | grep -E '^(pk|sk|rk)_(live|test)_[a-zA-Z0-9]{32,}$'

# Test API key with simple request  
curl -H "Authorization: Bearer $AIFEEDBACK_API_KEY" \
  https://api.aifeedback.se/v1/business/profile
```

*Issue: OAuth callback failures*
```javascript
// Debug OAuth flow
app.get('/integrations/square/callback', (req, res) => {
  console.log('OAuth callback received:');
  console.log('Query params:', req.query);
  console.log('Headers:', req.headers);
  
  if (req.query.error) {
    console.error('OAuth error:', req.query.error_description);
    return res.status(400).send('OAuth failed');
  }
  
  // Process authorization code
  exchangeAuthorizationCode(req.query.code);
});
```

**2. Webhook Delivery Issues**

*Issue: Webhooks not being received*
```javascript
// Debug webhook endpoint
app.post('/webhooks/debug', (req, res) => {
  console.log('Webhook received:');
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  console.log('Timestamp:', new Date().toISOString());
  
  res.status(200).send('Webhook received');
});

// Test webhook delivery
const testWebhook = async () => {
  const response = await fetch('https://your-domain.com/webhooks/debug', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ test: true })
  });
  
  console.log('Webhook test response:', response.status);
};
```

*Issue: Webhook signature verification failing*
```javascript
// Debug signature verification
function debugWebhookSignature(payload, signature, secret) {
  console.log('Payload length:', payload.length);
  console.log('Signature received:', signature);
  
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('hex');
    
  console.log('Expected signature:', expectedSignature);
  console.log('Signatures match:', signature === expectedSignature);
  
  return signature === expectedSignature;
}
```

**3. POS Integration Issues**

*Issue: Transaction verification failing*
```javascript
// Debug transaction lookup
async function debugTransactionVerification(transactionId) {
  console.log(`Looking up transaction: ${transactionId}`);
  
  try {
    const transaction = await posClient.getTransaction(transactionId);
    console.log('Transaction found:', JSON.stringify(transaction, null, 2));
    
    return transaction;
  } catch (error) {
    console.error('Transaction lookup failed:', error.message);
    console.error('Error details:', error);
    
    return null;
  }
}
```

*Issue: Rate limiting from POS APIs*
```javascript
// Implement retry with exponential backoff
async function retryWithBackoff(fn, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (error.status === 429 && attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`Rate limited, retrying in ${delay}ms...`);
        await sleep(delay);
        continue;
      }
      throw error;
    }
  }
}
```

### Monitoring & Alerting

**Integration Health Checks:**
```javascript
class IntegrationHealthMonitor {
  constructor() {
    this.healthChecks = new Map();
    this.setupHealthChecks();
  }
  
  setupHealthChecks() {
    this.healthChecks.set('square_api', {
      check: () => this.checkSquareAPI(),
      interval: 60000, // 1 minute
      timeout: 10000   // 10 seconds
    });
    
    this.healthChecks.set('stripe_api', {
      check: () => this.checkStripeAPI(),
      interval: 60000,
      timeout: 10000
    });
    
    this.healthChecks.set('webhook_delivery', {
      check: () => this.checkWebhookDelivery(),
      interval: 300000, // 5 minutes
      timeout: 30000
    });
  }
  
  async runHealthChecks() {
    const results = new Map();
    
    for (const [name, config] of this.healthChecks) {
      try {
        const startTime = Date.now();
        await config.check();
        const responseTime = Date.now() - startTime;
        
        results.set(name, {
          status: 'healthy',
          responseTime,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        results.set(name, {
          status: 'unhealthy',
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    return results;
  }
  
  async checkSquareAPI() {
    // Test Square API connectivity
    const response = await fetch('https://connect.squareup.com/v2/locations', {
      headers: {
        'Authorization': `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Square API returned ${response.status}`);
    }
  }
}
```

### Log Analysis

**Structured Logging for Integrations:**
```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'integration-service' },
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

class IntegrationLogger {
  logPOSOperation(operation, data, result) {
    logger.info('POS Operation', {
      operation,
      pos_provider: data.provider,
      transaction_id: data.transactionId,
      success: result.success,
      response_time: result.responseTime,
      correlation_id: data.correlationId
    });
  }
  
  logWebhookEvent(event, status, error = null) {
    logger.info('Webhook Event', {
      event_type: event.type,
      event_id: event.id,
      processing_status: status,
      error_message: error?.message,
      timestamp: new Date().toISOString()
    });
  }
  
  logPaymentProcessing(paymentData, result) {
    logger.info('Payment Processing', {
      payment_provider: paymentData.provider,
      amount: paymentData.amount,
      currency: paymentData.currency,
      success: result.success,
      transaction_id: result.transactionId,
      processing_time: result.processingTime
    });
  }
}
```

---

## Support & Resources

### Integration Support

**Technical Support Channels:**
- **Email:** integrations@aifeedback.se
- **Slack:** #integrations channel (for partners)
- **Phone:** +46-8-123-456-78 (Mon-Fri 9-17 CET)
- **Emergency:** +46-70-987-6543 (critical issues)

**Documentation Resources:**
- **API Reference:** https://api.aifeedback.se/docs
- **Integration Examples:** https://github.com/aifeedback/integration-examples
- **Postman Collection:** https://api.aifeedback.se/postman
- **OpenAPI Spec:** https://api.aifeedback.se/openapi.json

### Partner Program

**Integration Partner Benefits:**
- Priority technical support
- Early access to new API features
- Co-marketing opportunities
- Revenue sharing for referrals

**Certification Program:**
- Technical certification for developers
- Integration testing and validation
- Official partner directory listing
- Marketing materials and resources

---

*Last Updated: October 26, 2024*  
*Version: 1.3.0*  
*© 2024 AI Feedback Platform AB*