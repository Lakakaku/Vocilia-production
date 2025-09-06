# Verification Models Technical Documentation

## Overview

The AI Feedback Platform supports two distinct verification models to accommodate different business needs and technical capabilities. This document provides comprehensive technical details for both systems.

## Verification Model Comparison

| Feature | POS Integration | Simple Verification |
|---------|----------------|-------------------|
| **Setup Complexity** | High - OAuth integration required | Low - 6-digit store code only |
| **Verification Method** | Automatic via API | Manual by store staff |
| **Payment Timing** | Instant after feedback | Monthly aggregated |
| **Technical Dependencies** | Internet, POS API access | Minimal - just CSV processing |
| **Fraud Risk** | Low - automatic verification | Medium - manual verification |
| **Store Overhead** | Low - fully automated | Medium - monthly verification task |
| **Scalability** | High - no manual work | Limited by store capacity |
| **Best For** | Tech-savvy businesses with modern POS | Small businesses without POS integration |

## 1. POS Integration Verification Model

### Architecture Overview

```
Customer → QR Code → Session Creation → POS API Transaction Lookup → 
Real-time Verification → Voice Feedback → AI Scoring → Instant Stripe Payout
```

### Technical Components

#### Supported POS Systems
- **Square**: OAuth 2.0, Payments API, Webhooks
- **Shopify POS**: OAuth 2.0, Admin API, Order webhooks
- **Zettle (iZettle)**: OAuth 2.0, Transaction API, Swedish banking features

#### API Integration Flow
```typescript
// 1. Business OAuth Setup
const authUrl = await posAdapter.getAuthorizationUrl(businessId);
const tokens = await posAdapter.exchangeCodeForTokens(authCode);

// 2. Transaction Verification
const verification = await posAdapter.verifyTransaction({
  transactionId: session.transactionId,
  amount: session.purchaseAmount,
  timestamp: session.purchaseTime,
  locationId: session.locationId
});

// 3. Instant Payment Processing
if (verification.matches) {
  const payment = await stripeService.createTransfer({
    amount: calculatedReward,
    destination: business.stripeAccountId,
    metadata: { sessionId: session.id }
  });
}
```

#### Verification Logic
- **Exact match**: Transaction ID must exist in POS system
- **Time tolerance**: ±2 minutes from reported purchase time
- **Amount tolerance**: Exact match required for POS integration
- **Location validation**: Transaction location must match QR code location

#### Database Schema
```sql
-- POS Integration specific tables
CREATE TABLE pos_integrations (
  id UUID PRIMARY KEY,
  business_id UUID REFERENCES businesses(id),
  provider TEXT NOT NULL, -- 'square', 'shopify', 'zettle'
  access_token TEXT ENCRYPTED,
  refresh_token TEXT ENCRYPTED,
  location_mapping JSONB,
  webhook_config JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE pos_transactions (
  id UUID PRIMARY KEY,
  integration_id UUID REFERENCES pos_integrations(id),
  external_transaction_id TEXT NOT NULL,
  amount DECIMAL(10,2),
  timestamp TIMESTAMPTZ,
  location_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 2. Simple Verification Model

### Architecture Overview

```
Customer → Local QR Code → Phone/Time/Amount Input → Voice Feedback → 
Monthly Batch Creation → Store CSV Export → Manual Verification → 
CSV Import → Swish Aggregated Payouts
```

### Technical Components

#### Monthly Batch Processing Workflow

```typescript
// 1. Monthly Batch Creation (1st of month)
const createMonthlyBatches = async () => {
  const businesses = await getSimpleVerificationBusinesses();
  
  for (const business of businesses) {
    const batch = await createBillingBatch({
      businessId: business.id,
      month: getCurrentMonth(),
      verifications: await getUnprocessedVerifications(business.id)
    });
    
    await notifyBusinessOfBatch(business, batch);
  }
};

// 2. Store Verification Process
const processStoreVerification = async (batchId: string, csvData: Buffer) => {
  const decisions = await parseCSVDecisions(csvData);
  
  for (const decision of decisions) {
    await updateVerificationStatus(decision.verificationId, {
      reviewStatus: decision.approved ? 'approved' : 'rejected',
      reviewedAt: new Date(),
      reviewNotes: decision.notes
    });
  }
  
  await processBatchPayments(batchId);
};

// 3. Swish Payment Aggregation
const processSwishPayments = async (month: string) => {
  // Group approved verifications by phone number
  const paymentGroups = await groupVerificationsByPhone(month);
  
  for (const [phoneNumber, verifications] of paymentGroups) {
    const totalAmount = verifications.reduce((sum, v) => sum + v.rewardAmount, 0);
    
    await swishService.createPayment({
      phoneNumber,
      amount: totalAmount,
      reference: `Feedback-${month}-${phoneNumber.slice(-4)}`,
      message: `Månadsersättning för ${verifications.length} recensioner`
    });
  }
};
```

#### Tolerance Matching Algorithm

```typescript
interface VerificationClaim {
  customerPhone: string;
  purchaseTime: Date;
  purchaseAmount: number;
  feedbackScore: number;
}

interface POSTransaction {
  timestamp: Date;
  amount: number;
  transactionId: string;
}

const verifyWithTolerance = (
  claim: VerificationClaim, 
  transactions: POSTransaction[]
): VerificationMatch | null => {
  
  const TIME_TOLERANCE_MS = 2 * 60 * 1000; // ±2 minutes
  const AMOUNT_TOLERANCE_SEK = 0.5; // ±0.5 SEK
  
  for (const transaction of transactions) {
    const timeDiff = Math.abs(claim.purchaseTime.getTime() - transaction.timestamp.getTime());
    const amountDiff = Math.abs(claim.purchaseAmount - transaction.amount);
    
    if (timeDiff <= TIME_TOLERANCE_MS && amountDiff <= AMOUNT_TOLERANCE_SEK) {
      return {
        matched: true,
        confidence: calculateConfidence(timeDiff, amountDiff),
        transaction: transaction,
        tolerances: {
          timeWithinTolerance: timeDiff <= TIME_TOLERANCE_MS,
          amountWithinTolerance: amountDiff <= AMOUNT_TOLERANCE_SEK
        }
      };
    }
  }
  
  return null;
};
```

#### Database Schema

```sql
-- Simple verification specific tables
CREATE TABLE simple_verifications (
  id UUID PRIMARY KEY,
  session_id UUID REFERENCES feedback_sessions(id),
  business_id UUID REFERENCES businesses(id),
  customer_phone TEXT NOT NULL,
  purchase_time TIMESTAMPTZ NOT NULL,
  purchase_amount DECIMAL(10,2) NOT NULL,
  reward_amount DECIMAL(10,2) NOT NULL,
  platform_commission DECIMAL(10,2) NOT NULL,
  review_status verification_review_status DEFAULT 'pending',
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  billing_batch_id UUID REFERENCES billing_batches(id),
  payment_batch_id UUID REFERENCES payment_batches(id),
  fraud_score DECIMAL(3,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE billing_batches (
  id UUID PRIMARY KEY,
  business_id UUID REFERENCES businesses(id),
  batch_month TEXT NOT NULL, -- Format: YYYY-MM
  total_verifications INTEGER NOT NULL,
  total_amount DECIMAL(12,2) NOT NULL,
  total_commission DECIMAL(12,2) NOT NULL,
  deadline_date DATE NOT NULL,
  status batch_status DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  auto_approved_at TIMESTAMPTZ
);

CREATE TABLE payment_batches (
  id UUID PRIMARY KEY,
  batch_month TEXT NOT NULL,
  total_customers INTEGER NOT NULL,
  total_amount DECIMAL(12,2) NOT NULL,
  swish_batch_id TEXT,
  status payment_batch_status DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);
```

#### Store Code Generation

```typescript
const generateStoreCode = (): string => {
  // Generate 6-digit code that's easy to read and type
  // Excludes confusing characters: 0, O, I, l, 1
  const chars = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  let code = '';
  
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return code;
};

const validateStoreCode = async (code: string): Promise<Business | null> => {
  return await prisma.business.findFirst({
    where: {
      verificationType: 'simple_verification',
      storeCode: code,
      status: 'active'
    }
  });
};
```

## 3. API Endpoints

### POS Integration Endpoints

```typescript
// OAuth Management
POST /api/pos/square/authorize        - Start Square OAuth flow
POST /api/pos/shopify/authorize       - Start Shopify OAuth flow  
POST /api/pos/zettle/authorize        - Start Zettle OAuth flow
GET  /api/pos/callback               - OAuth callback handler
DELETE /api/pos/{provider}/disconnect - Disconnect POS integration

// Transaction Verification
POST /api/pos/verify                 - Verify transaction via POS
GET  /api/pos/transactions          - List recent transactions
POST /api/pos/webhook               - POS webhook receiver
```

### Simple Verification Endpoints

```typescript
// Customer Flow
POST /api/simple-verification/validate  - Validate store code
POST /api/simple-verification/create    - Submit verification claim
GET  /api/simple-verification/status    - Check verification status

// Store Management
GET  /api/store-verification/export     - Download monthly CSV
POST /api/store-verification/import     - Upload reviewed CSV
GET  /api/store-verification/batches    - List billing batches

// Admin Management  
GET  /api/billing-admin/overview        - System overview
GET  /api/billing-admin/batches         - List all batches
POST /api/billing-admin/deadline-enforcement - Force deadline processing
GET  /api/billing-admin/statistics      - Verification statistics

// Payment Processing
POST /api/payment-processing/process-monthly - Process Swish payments
GET  /api/payment-processing/status     - Payment batch status
```

## 4. Fraud Detection

### POS Integration Fraud Detection
- **Transaction tampering**: Compare API data with webhook data
- **Time manipulation**: Detect unrealistic timestamps
- **Amount manipulation**: Check for systematic rounding
- **Duplicate transactions**: Prevent multiple submissions

### Simple Verification Fraud Detection
```typescript
const detectSimpleVerificationFraud = (verification: SimpleVerification): FraudScore => {
  let riskScore = 0;
  const flags: string[] = [];
  
  // Round amount pattern (fake claims often use round numbers)
  if (verification.purchaseAmount % 10 === 0) {
    riskScore += 0.2;
    flags.push('ROUND_AMOUNT');
  }
  
  // Peak time clustering (many claims at exact same time)
  const sameTimeCount = await countVerificationsAtTime(
    verification.purchaseTime, 
    60000 // 1 minute window
  );
  if (sameTimeCount > 5) {
    riskScore += 0.3;
    flags.push('TIME_CLUSTERING');
  }
  
  // Phone number patterns
  if (await isPhoneNumberSuspicious(verification.customerPhone)) {
    riskScore += 0.4;
    flags.push('SUSPICIOUS_PHONE');
  }
  
  return { score: Math.min(riskScore, 1.0), flags };
};
```

## 5. Monitoring & Analytics

### Key Metrics

#### POS Integration Metrics
- OAuth connection success rate
- Transaction verification latency
- Webhook delivery success rate
- API error rates by provider

#### Simple Verification Metrics
- Store verification completion rate
- Deadline compliance rate  
- Fraud detection accuracy
- Swish payment success rate

### Monitoring Dashboard

```typescript
const getVerificationMetrics = async (timeRange: DateRange) => {
  const [posMetrics, simpleMetrics] = await Promise.all([
    // POS Integration metrics
    {
      totalTransactions: await countPOSTransactions(timeRange),
      verificationSuccessRate: await getPOSVerificationRate(timeRange),
      averageVerificationTime: await getAvgPOSVerificationTime(timeRange),
      topErrorCategories: await getPOSErrorCategories(timeRange)
    },
    
    // Simple Verification metrics  
    {
      totalBatches: await countBillingBatches(timeRange),
      deadlineComplianceRate: await getDeadlineComplianceRate(timeRange),
      averageVerificationAccuracy: await getStoreVerificationAccuracy(timeRange),
      fraudDetectionRate: await getFraudDetectionRate(timeRange)
    }
  ]);
  
  return { posMetrics, simpleMetrics };
};
```

## 6. Configuration & Deployment

### Environment Variables

```bash
# POS Integration
SQUARE_CLIENT_ID=your_square_client_id
SQUARE_CLIENT_SECRET=your_square_client_secret
SHOPIFY_CLIENT_ID=your_shopify_client_id
SHOPIFY_CLIENT_SECRET=your_shopify_client_secret
ZETTLE_CLIENT_ID=your_zettle_client_id
ZETTLE_CLIENT_SECRET=your_zettle_client_secret

# Simple Verification
SWISH_API_URL=https://mss.cpc.getswish.net/swish-cpcapi/api/v1
SWISH_CERT_PATH=/path/to/swish-client.crt
SWISH_KEY_PATH=/path/to/swish-client.key
SWISH_MERCHANT_ID=your_merchant_id

# Batch Processing
BILLING_BATCH_DAY=1          # Day of month to create batches
VERIFICATION_DEADLINE_DAY=15  # Deadline for store verification
PAYMENT_PROCESSING_DAY=20     # Day to process Swish payments

# Email Notifications
EMAIL_SERVICE_API_KEY=your_email_key
EMAIL_FROM_ADDRESS=noreply@your-domain.com
```

### Job Scheduling

```typescript
// Monthly batch creation (1st of month)
cron.schedule('0 10 1 * *', createMonthlyBatches);

// Deadline warnings (12th of month)  
cron.schedule('0 10 12 * *', sendDeadlineWarnings);

// Deadline enforcement (15th of month)
cron.schedule('0 10 15 * *', enforceDeadlines);

// Payment processing (20th of month)
cron.schedule('0 10 20 * *', processMonthlyPayments);
```

## 7. Testing Strategy

### POS Integration Testing
- **Unit Tests**: OAuth flows, API adapters, webhook processing
- **Integration Tests**: End-to-end POS verification flows
- **Mock Testing**: POS API responses, error handling
- **Load Testing**: Concurrent transaction verification

### Simple Verification Testing
- **Unit Tests**: Tolerance matching, fraud detection, CSV processing
- **Integration Tests**: Complete monthly batch workflow
- **Mock Testing**: Swish API responses, store verification scenarios
- **E2E Testing**: Full customer journey with manual verification

### Test Data Generation
```typescript
const generateTestVerifications = (count: number): SimpleVerification[] => {
  const verifications = [];
  const baseTime = new Date('2024-01-15T14:00:00Z');
  
  for (let i = 0; i < count; i++) {
    verifications.push({
      customerPhone: `+4670${String(Math.floor(Math.random() * 9000000) + 1000000)}`,
      purchaseTime: new Date(baseTime.getTime() + (i * 60000)), // 1 minute apart
      purchaseAmount: Math.floor(Math.random() * 500) + 50, // 50-550 SEK
      feedbackScore: Math.floor(Math.random() * 40) + 60, // 60-100 score
      businessId: 'test-business-id'
    });
  }
  
  return verifications;
};
```

This comprehensive technical documentation provides all the implementation details needed for both verification models, including architecture, APIs, database schemas, fraud detection, and deployment considerations.