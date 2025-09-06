# AI Feedback Platform API Documentation

*Complete API reference and integration guide for developers*

## Table of Contents

1. [API Overview](#api-overview)
2. [Authentication](#authentication)
3. [Rate Limiting](#rate-limiting)
4. [Core Endpoints](#core-endpoints)
5. [Webhook Integration](#webhook-integration)
6. [SDK & Libraries](#sdk--libraries)
7. [Error Handling](#error-handling)
8. [Testing & Examples](#testing--examples)

---

## API Overview

### Base URL
```
Production: https://api.aifeedback.se/v1
Staging: https://staging-api.aifeedback.se/v1
```

### API Philosophy
- **RESTful Design:** Standard HTTP verbs and status codes
- **JSON-First:** All requests and responses in JSON format
- **Stateless:** No server-side session management required
- **Versioned:** Breaking changes managed through versioning
- **Secure:** TLS 1.3, API keys, rate limiting, input validation

### Content Types
```http
Content-Type: application/json
Accept: application/json
```

### API Versions
- **v1** (Current): Full feature set, stable
- **v2** (Beta): Enhanced feedback analytics
- **v3** (Planned): GraphQL support

---

## Authentication

### API Key Authentication

**Header Format:**
```http
Authorization: Bearer sk_live_1234567890abcdef...
```

**API Key Types:**
- **Public Keys** (`pk_`): Client-side, limited scope
- **Secret Keys** (`sk_`): Server-side, full access  
- **Restricted Keys** (`rk_`): Limited scope and permissions

**Obtaining API Keys:**
1. Login to business dashboard
2. Navigate to Settings → API Keys
3. Generate new key with appropriate permissions
4. Store securely (keys shown only once)

### Authentication Example
```bash
curl -X GET "https://api.aifeedback.se/v1/feedback/sessions" \
  -H "Authorization: Bearer sk_live_..." \
  -H "Content-Type: application/json"
```

### Session Tokens (Customer Flow)
```http
X-Session-Token: sess_1234567890abcdef...
```

Used for customer feedback sessions, automatically generated during QR scan.

---

## Rate Limiting

### Rate Limits by Key Type

| Key Type | Requests/Minute | Burst Limit |
|----------|----------------|-------------|
| Public | 100 | 200 |
| Secret | 1000 | 2000 |
| Restricted | 500 | 1000 |

### Rate Limit Headers
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 742
X-RateLimit-Reset: 1640995200
```

### Handling Rate Limits
```javascript
if (response.status === 429) {
  const retryAfter = response.headers['Retry-After'];
  await sleep(retryAfter * 1000);
  // Retry request
}
```

---

## Core Endpoints

### 1. Session Management

#### Create Feedback Session
```http
POST /v1/feedback/sessions
```

**Request Body:**
```json
{
  "qr_token": "qr_abc123def456",
  "customer_hash": "customer_anonymous_hash",
  "device_fingerprint": {
    "user_agent": "Mozilla/5.0...",
    "screen": "375x812",
    "timezone": "Europe/Stockholm",
    "language": "sv-SE"
  },
  "location_context": {
    "ip_address": "192.168.1.1",
    "approximate_location": "Stockholm, Sweden"
  }
}
```

**Response (201 Created):**
```json
{
  "id": "sess_1234567890abcdef",
  "session_token": "sess_token_abc123",
  "business": {
    "id": "biz_9876543210",
    "name": "Café Aurora Stockholm",
    "context": {
      "specialties": ["artisan coffee", "fresh pastries"],
      "atmosphere": "cozy urban café"
    }
  },
  "location": {
    "id": "loc_5555666677",
    "name": "Main Store",
    "address": "Drottninggatan 123, Stockholm"
  },
  "status": "pending_transaction",
  "created_at": "2024-10-26T14:30:00Z",
  "expires_at": "2024-10-26T15:00:00Z"
}
```

#### Verify Transaction
```http
POST /v1/feedback/sessions/{session_id}/transaction
```

**Request Body:**
```json
{
  "transaction_id": "TXN-20241026-142345",
  "amount": 4750,
  "currency": "SEK",
  "items": [
    {
      "name": "Cappuccino",
      "quantity": 1,
      "price": 3500
    },
    {
      "name": "Kanelbulle", 
      "quantity": 1,
      "price": 1250
    }
  ],
  "timestamp": "2024-10-26T14:23:45Z"
}
```

**Response (200 OK):**
```json
{
  "verified": true,
  "status": "ready_for_feedback",
  "transaction": {
    "id": "TXN-20241026-142345",
    "amount": 4750,
    "verified_at": "2024-10-26T14:31:12Z"
  }
}
```

#### Submit Voice Feedback
```http
POST /v1/feedback/sessions/{session_id}/voice
```

**Request (multipart/form-data):**
```
Content-Type: multipart/form-data

--boundary123
Content-Disposition: form-data; name="audio"; filename="feedback.webm"
Content-Type: audio/webm

[binary audio data]
--boundary123
Content-Disposition: form-data; name="duration"

45.2
--boundary123
Content-Disposition: form-data; name="language"

sv
--boundary123--
```

**Response (202 Accepted):**
```json
{
  "processing_id": "proc_abc123def456",
  "status": "processing",
  "estimated_completion": "2024-10-26T14:32:30Z"
}
```

#### Get Session Results
```http
GET /v1/feedback/sessions/{session_id}/results
```

**Response (200 OK):**
```json
{
  "session_id": "sess_1234567890abcdef",
  "status": "completed",
  "transcript": "Jag älskar verkligen denna plats! Anna var så vänlig...",
  "language_detected": "sv",
  "ai_evaluation": {
    "quality_score": 89,
    "scores": {
      "authenticity": 92,
      "concreteness": 88,
      "depth": 85
    },
    "reasoning": "Feedback visar hög kvalitet med specifika detaljer...",
    "categories": ["service", "food_quality", "atmosphere"],
    "sentiment": 0.83
  },
  "reward": {
    "tier": "excellent",
    "amount": 523,
    "percentage": 11.0,
    "payment_status": "processing",
    "estimated_arrival": "2024-10-26T14:37:00Z"
  },
  "fraud_assessment": {
    "risk_score": 0.12,
    "flags": [],
    "status": "clear"
  },
  "completed_at": "2024-10-26T14:32:18Z"
}
```

### 2. Business Management

#### Get Business Profile
```http
GET /v1/business/profile
```

**Response (200 OK):**
```json
{
  "id": "biz_9876543210",
  "name": "Café Aurora Stockholm",
  "org_number": "556123-4567",
  "status": "active",
  "tier": "professional",
  "locations": [
    {
      "id": "loc_5555666677",
      "name": "Main Store",
      "address": "Drottninggatan 123, Stockholm",
      "active": true,
      "qr_code_url": "https://demo.aifeedback.se/qr/xyz123"
    }
  ],
  "settings": {
    "reward_settings": {
      "tier_multipliers": {
        "poor": 0.01,
        "fair": 0.03,
        "good": 0.06,
        "very_good": 0.09,
        "excellent": 0.12
      },
      "max_daily_reward": 150.00,
      "fraud_threshold": 0.7
    }
  },
  "statistics": {
    "total_feedbacks": 1247,
    "average_quality_score": 78.4,
    "total_rewards_paid": 8947.50
  }
}
```

#### Get Feedback Analytics
```http
GET /v1/business/analytics
```

**Query Parameters:**
```
start_date: 2024-10-01 (ISO date)
end_date: 2024-10-31 (ISO date)
location_id: loc_5555666677 (optional)
group_by: day|week|month (default: day)
```

**Response (200 OK):**
```json
{
  "period": {
    "start_date": "2024-10-01",
    "end_date": "2024-10-31", 
    "group_by": "day"
  },
  "summary": {
    "total_sessions": 127,
    "average_quality_score": 76.4,
    "total_rewards": 8750.50,
    "commission_charged": 1750.10
  },
  "trends": [
    {
      "date": "2024-10-01",
      "sessions": 8,
      "avg_quality": 74.2,
      "total_rewards": 287.50
    }
  ],
  "categories": {
    "service": 45,
    "food_quality": 38, 
    "atmosphere": 29,
    "value": 15
  },
  "top_mentions": {
    "positive": [
      "Anna - vänlig personal (15 mentions)",
      "Perfekt cappuccino (12 mentions)"
    ],
    "negative": [
      "Lång kö på morgonen (8 mentions)",
      "Kallt kaffe (3 mentions)"
    ]
  }
}
```

### 3. QR Code Management

#### Generate QR Code
```http
POST /v1/qr-codes
```

**Request Body:**
```json
{
  "location_id": "loc_5555666677",
  "expires_at": "2025-10-26T00:00:00Z",
  "custom_data": {
    "campaign": "winter_promotion",
    "table_number": "12"
  }
}
```

**Response (201 Created):**
```json
{
  "id": "qr_abc123def456",
  "token": "qr_token_xyz789",
  "url": "https://demo.aifeedback.se/qr/abc123def456",
  "qr_code_svg": "<svg>...</svg>",
  "expires_at": "2025-10-26T00:00:00Z",
  "created_at": "2024-10-26T14:30:00Z"
}
```

#### List QR Codes
```http
GET /v1/qr-codes
```

**Query Parameters:**
```
location_id: loc_5555666677 (optional)
status: active|expired|all (default: active)
limit: 50 (default: 25, max: 100)
```

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "qr_abc123def456",
      "location_name": "Main Store",
      "status": "active",
      "usage_count": 47,
      "created_at": "2024-10-26T14:30:00Z",
      "expires_at": "2025-10-26T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 25,
    "total": 8,
    "has_more": false
  }
}
```

### 4. Payment & Commission

#### Get Payment History
```http
GET /v1/payments/history
```

**Query Parameters:**
```
start_date: 2024-10-01
end_date: 2024-10-31
type: commission|refund|adjustment
status: pending|completed|failed
```

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "pay_1234567890",
      "type": "commission",
      "amount": 1750.10,
      "currency": "SEK",
      "description": "October 2024 commission",
      "status": "completed",
      "stripe_charge_id": "ch_stripe123",
      "created_at": "2024-11-01T09:00:00Z",
      "paid_at": "2024-11-01T09:05:23Z"
    }
  ],
  "summary": {
    "total_amount": 8945.67,
    "commission_rate": 20.0,
    "period_rewards": 44728.35
  }
}
```

#### Request Refund
```http
POST /v1/payments/refunds
```

**Request Body:**
```json
{
  "session_id": "sess_1234567890abcdef",
  "reason": "duplicate_transaction",
  "amount": 523,
  "notes": "Customer accidentally submitted twice"
}
```

**Response (201 Created):**
```json
{
  "id": "refund_abc123def456",
  "session_id": "sess_1234567890abcdef", 
  "amount": 523,
  "status": "processing",
  "estimated_completion": "2024-10-26T16:00:00Z",
  "created_at": "2024-10-26T14:35:00Z"
}
```

---

## Webhook Integration

### Webhook Events

**Available Events:**
```
feedback.session_completed
feedback.quality_score_calculated
payment.reward_processed  
payment.reward_failed
fraud.risk_detected
business.trial_ending
system.maintenance_scheduled
```

### Webhook Configuration

#### Register Webhook Endpoint
```http
POST /v1/webhooks
```

**Request Body:**
```json
{
  "url": "https://your-server.com/webhooks/aifeedback",
  "events": [
    "feedback.session_completed",
    "payment.reward_processed",
    "fraud.risk_detected"
  ],
  "description": "Production webhook endpoint",
  "active": true
}
```

**Response (201 Created):**
```json
{
  "id": "wh_abc123def456",
  "url": "https://your-server.com/webhooks/aifeedback",
  "events": ["feedback.session_completed", "payment.reward_processed"],
  "secret": "whsec_xyz789...",
  "status": "active",
  "created_at": "2024-10-26T14:30:00Z"
}
```

### Webhook Payload Example

**Event: `feedback.session_completed`**
```json
{
  "id": "evt_1234567890",
  "event": "feedback.session_completed",
  "created": 1640995200,
  "data": {
    "session": {
      "id": "sess_1234567890abcdef",
      "business_id": "biz_9876543210",
      "quality_score": 89,
      "reward_amount": 523,
      "categories": ["service", "food_quality"],
      "fraud_risk_score": 0.12,
      "completed_at": "2024-10-26T14:32:18Z"
    }
  }
}
```

### Webhook Signature Verification

**Node.js Example:**
```javascript
const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('hex');
    
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}

// Express middleware
app.post('/webhooks/aifeedback', (req, res) => {
  const signature = req.headers['x-aifeedback-signature'];
  const payload = JSON.stringify(req.body);
  
  if (!verifyWebhookSignature(payload, signature, process.env.WEBHOOK_SECRET)) {
    return res.status(401).send('Invalid signature');
  }
  
  // Process webhook event
  const event = req.body;
  console.log(`Received ${event.event} event`);
  
  res.status(200).send('OK');
});
```

---

## SDK & Libraries

### Official SDKs

#### Node.js SDK
```bash
npm install @aifeedback/node-sdk
```

```javascript
const AIFeedback = require('@aifeedback/node-sdk');

const client = new AIFeedback('sk_live_...');

// Create feedback session
const session = await client.sessions.create({
  qr_token: 'qr_abc123def456',
  customer_hash: 'customer_anonymous_hash'
});

// Get business analytics
const analytics = await client.business.getAnalytics({
  start_date: '2024-10-01',
  end_date: '2024-10-31'
});
```

#### Python SDK
```bash
pip install aifeedback-python
```

```python
import aifeedback

client = aifeedback.Client('sk_live_...')

# Create feedback session
session = client.sessions.create(
    qr_token='qr_abc123def456',
    customer_hash='customer_anonymous_hash'
)

# Get business analytics  
analytics = client.business.get_analytics(
    start_date='2024-10-01',
    end_date='2024-10-31'
)
```

#### React Components
```bash
npm install @aifeedback/react-components
```

```jsx
import { FeedbackWidget, QRScanner } from '@aifeedback/react-components';

function App() {
  return (
    <div>
      <QRScanner
        onScan={(qrData) => console.log('Scanned:', qrData)}
        apiKey="pk_live_..."
      />
      
      <FeedbackWidget
        sessionToken="sess_token_abc123"
        onComplete={(result) => console.log('Feedback completed:', result)}
      />
    </div>
  );
}
```

### Community Libraries

- **PHP:** `aifeedback/php-client` (Composer)
- **Go:** `github.com/aifeedback/go-sdk`  
- **Ruby:** `aifeedback-ruby` (gem)
- **Java:** `com.aifeedback:java-sdk` (Maven)

---

## Error Handling

### HTTP Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 200 | OK | Request successful |
| 201 | Created | Resource created |
| 202 | Accepted | Async processing started |
| 400 | Bad Request | Invalid request data |
| 401 | Unauthorized | Invalid API key |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 422 | Unprocessable Entity | Validation errors |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |
| 503 | Service Unavailable | Maintenance mode |

### Error Response Format

**Standard Error Response:**
```json
{
  "error": {
    "type": "validation_error",
    "code": "INVALID_TRANSACTION_ID",
    "message": "Transaction ID format is invalid",
    "details": {
      "field": "transaction_id",
      "expected_format": "TXN-YYYYMMDD-HHMMSS",
      "provided": "invalid_id_123"
    },
    "request_id": "req_abc123def456"
  }
}
```

### Common Error Types

**Validation Errors (422):**
```json
{
  "error": {
    "type": "validation_error",
    "code": "REQUIRED_FIELD_MISSING",
    "message": "Required field 'customer_hash' is missing",
    "details": {
      "missing_fields": ["customer_hash"]
    }
  }
}
```

**Business Logic Errors (422):**
```json
{
  "error": {
    "type": "business_logic_error", 
    "code": "TRANSACTION_ALREADY_VERIFIED",
    "message": "This transaction has already been used for feedback",
    "details": {
      "transaction_id": "TXN-20241026-142345",
      "previous_session": "sess_previous123"
    }
  }
}
```

**Rate Limit Errors (429):**
```json
{
  "error": {
    "type": "rate_limit_error",
    "code": "REQUESTS_EXCEEDED",
    "message": "Rate limit of 1000 requests per hour exceeded",
    "details": {
      "limit": 1000,
      "reset_time": 1640998800
    }
  }
}
```

### Error Handling Best Practices

**Retry Logic:**
```javascript
async function apiRequestWithRetry(url, options, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After') || Math.pow(2, attempt);
        await sleep(retryAfter * 1000);
        continue;
      }
      
      if (response.status >= 500) {
        if (attempt === maxRetries) throw new Error('Server error after retries');
        await sleep(Math.pow(2, attempt) * 1000);
        continue;
      }
      
      return response;
    } catch (error) {
      if (attempt === maxRetries) throw error;
      await sleep(Math.pow(2, attempt) * 1000);
    }
  }
}
```

---

## Testing & Examples

### Testing Environment

**Test API Keys:**
```
Public Test Key: pk_test_1234567890abcdef...
Secret Test Key: sk_test_1234567890abcdef...
```

**Test Data:**
- Business ID: `biz_test_cafe_aurora`
- Location ID: `loc_test_main_store`
- QR Token: `qr_test_abc123def456`

### Example Integration

**Complete Customer Flow Example:**
```javascript
const express = require('express');
const AIFeedback = require('@aifeedback/node-sdk');

const app = express();
const client = new AIFeedback(process.env.AIFEEDBACK_SECRET_KEY);

// Step 1: Customer scans QR code
app.post('/qr-scan', async (req, res) => {
  try {
    const { qr_token, device_info } = req.body;
    
    const session = await client.sessions.create({
      qr_token,
      customer_hash: generateAnonymousHash(req.ip),
      device_fingerprint: device_info
    });
    
    res.json({ session_token: session.session_token });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Step 2: Verify transaction
app.post('/verify-transaction', async (req, res) => {
  try {
    const { session_token, transaction_id, amount } = req.body;
    
    const verification = await client.sessions.verifyTransaction(
      session_token,
      { transaction_id, amount }
    );
    
    res.json({ verified: verification.verified });
  } catch (error) {
    res.status(422).json({ error: error.message });
  }
});

// Step 3: Process voice feedback
app.post('/submit-feedback', async (req, res) => {
  try {
    const audioFile = req.files.audio;
    const { session_token } = req.body;
    
    const processing = await client.sessions.submitVoiceFeedback(
      session_token,
      audioFile
    );
    
    res.json({ processing_id: processing.processing_id });
  } catch (error) {
    res.status(422).json({ error: error.message });
  }
});

// Step 4: Get results
app.get('/feedback-results/:session_token', async (req, res) => {
  try {
    const results = await client.sessions.getResults(req.params.session_token);
    res.json(results);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});
```

### Testing Checklist

**Integration Testing:**
```bash
# 1. Test API key authentication
curl -H "Authorization: Bearer sk_test_..." \
  https://staging-api.aifeedback.se/v1/business/profile

# 2. Test QR code generation
curl -X POST -H "Authorization: Bearer sk_test_..." \
  -H "Content-Type: application/json" \
  -d '{"location_id":"loc_test_main_store"}' \
  https://staging-api.aifeedback.se/v1/qr-codes

# 3. Test session creation
curl -X POST -H "Authorization: Bearer sk_test_..." \
  -H "Content-Type: application/json" \
  -d '{"qr_token":"qr_test_abc123def456","customer_hash":"test_customer"}' \
  https://staging-api.aifeedback.se/v1/feedback/sessions

# 4. Test webhook endpoint
curl -X POST https://your-server.com/webhooks/aifeedback \
  -H "Content-Type: application/json" \
  -H "X-AIFeedback-Signature: test_signature" \
  -d '{"event":"feedback.session_completed","data":{"session":{"id":"test"}}}'
```

**Validation Tests:**
```javascript
describe('AI Feedback API Integration', () => {
  test('should create feedback session successfully', async () => {
    const session = await client.sessions.create({
      qr_token: 'qr_test_abc123def456',
      customer_hash: 'test_customer_hash'
    });
    
    expect(session).toHaveProperty('session_token');
    expect(session.status).toBe('pending_transaction');
  });
  
  test('should handle invalid QR token', async () => {
    await expect(client.sessions.create({
      qr_token: 'invalid_token',
      customer_hash: 'test_customer_hash'
    })).rejects.toThrow('QR token not found');
  });
  
  test('should verify transaction correctly', async () => {
    const verification = await client.sessions.verifyTransaction('sess_test_123', {
      transaction_id: 'TXN-20241026-142345',
      amount: 4750
    });
    
    expect(verification.verified).toBe(true);
  });
});
```

### Postman Collection

Download our complete Postman collection:
```
https://api.aifeedback.se/postman/collection.json
```

**Collection includes:**
- All API endpoints with examples
- Authentication setup
- Environment variables for staging/production
- Pre-request scripts for token generation
- Test assertions for response validation

---

## Advanced Features

### GraphQL API (Beta)

**Endpoint:** `https://api.aifeedback.se/graphql`

**Example Query:**
```graphql
query GetBusinessAnalytics($startDate: Date!, $endDate: Date!) {
  business {
    id
    name
    analytics(startDate: $startDate, endDate: $endDate) {
      summary {
        totalSessions
        averageQualityScore
        totalRewards
      }
      trends {
        date
        sessions
        avgQuality
      }
      categories {
        name
        count
        avgScore
      }
    }
  }
}
```

### Batch Operations

**Batch Session Processing:**
```http
POST /v1/batch/sessions/process
```

**Request Body:**
```json
{
  "operations": [
    {
      "type": "create_session",
      "data": {
        "qr_token": "qr_abc123def456",
        "customer_hash": "customer_1"
      }
    },
    {
      "type": "verify_transaction", 
      "session_id": "sess_previous123",
      "data": {
        "transaction_id": "TXN-20241026-142345",
        "amount": 4750
      }
    }
  ]
}
```

### Real-time Subscriptions

**WebSocket Connection:**
```javascript
const ws = new WebSocket('wss://api.aifeedback.se/v1/realtime?token=sk_live_...');

ws.on('open', () => {
  ws.send(JSON.stringify({
    type: 'subscribe',
    events: ['feedback.session_completed']
  }));
});

ws.on('message', (data) => {
  const event = JSON.parse(data);
  console.log('Real-time event:', event);
});
```

---

## Support & Resources

### Getting Help

**Developer Support:**
- Email: developers@aifeedback.se
- Discord: https://discord.gg/aifeedback-dev
- GitHub Issues: https://github.com/aifeedback/api-issues

**Documentation:**
- Interactive API Explorer: https://api.aifeedback.se/docs
- OpenAPI Specification: https://api.aifeedback.se/openapi.json
- Code Examples: https://github.com/aifeedback/examples

**Status & Updates:**
- API Status: https://status.aifeedback.se  
- Changelog: https://api.aifeedback.se/changelog
- Migration Guides: https://docs.aifeedback.se/migrations

### Community Resources

**Third-party Tools:**
- Zapier Integration
- Make (Integromat) connector  
- Bubble.io plugin
- WordPress plugin

**Open Source:**
- Client libraries on GitHub
- Example integrations
- Community contributions welcome

---

*Last Updated: October 26, 2024*  
*API Version: v1.2.0*  
*© 2024 AI Feedback Platform AB*