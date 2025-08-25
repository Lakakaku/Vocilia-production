# Stripe Connect Testing Infrastructure - Swedish Market

This comprehensive testing suite validates the AI Feedback Platform's payment integration with Stripe Connect for the Swedish market. All tests use Stripe test keys and fake data - **NO REAL MONEY IS INVOLVED**.

## 🇸🇪 Swedish Market Focus

The platform targets Swedish retail businesses with:
- 20% platform commission on all rewards
- SEK currency (öre as smallest unit)
- Swedish business regulations (org numbers, VAT, personnummer)
- Nordic expansion capabilities (Norway, Denmark, Finland)

## Test Environment Setup

### Prerequisites

```bash
npm install
```

### Environment Variables

Create a `.env` file in the test directory:

```bash
# Stripe Test Keys (REQUIRED)
STRIPE_TEST_PUBLISHABLE_KEY=pk_test_51234567890abcdef  # Fake test key
STRIPE_TEST_SECRET_KEY=sk_test_51234567890abcdef       # Fake test key
STRIPE_TEST_WEBHOOK_SECRET=whsec_test_1234567890abcdef

# API Configuration
API_GATEWAY_URL=http://localhost:3001
WEBHOOK_URL=https://test-webhook.example.com/stripe/webhooks
```

**CRITICAL**: Only use Stripe test keys starting with `pk_test_` or `sk_test_`. Production keys will cause test failures.

## Running Tests

### Full Test Suite
```bash
npm test
```

### Individual Test Categories
```bash
npm run test:onboarding    # Swedish business onboarding (15 tests)
npm run test:webhooks      # Webhook validation (18 tests)
npm run test:payments      # Payment processing (16 tests)
npm run test:edge-cases    # Nordic edge cases (12 tests)
```

### Watch Mode
```bash
npm run test:watch
```

## Test Coverage

### Onboarding Tests (15 scenarios)
- **Individual Accounts**: Swedish café owner with personnummer
- **Company Accounts**: Restaurants and retail stores with organization numbers
- **Validation**: Phone numbers (+46), postal codes, email formats
- **Error Handling**: Invalid data rejection, duplicate prevention

### Webhook Tests (18 scenarios)
- **Security**: Signature validation, timestamp verification
- **Account Events**: Express account status changes, verification updates
- **Payment Events**: Successful transfers, failed payouts, commission collection
- **Swedish Specific**: Currency conversion, tax reporting, VAT handling

### Payment Tests (16 scenarios)
- **Reward Calculations**: Quality score tiers (1-12% rewards)
- **Commission System**: 20% platform fee collection
- **Test Cards**: Swedish Visa/Mastercard, 3DS authentication, declines
- **Fraud Protection**: Velocity limits, daily/monthly caps

### Edge Cases (12 scenarios)
- **Nordic Expansion**: Norwegian business accounts, multi-currency
- **Data Validation**: Swedish personnummer, organization numbers, VAT IDs
- **Concurrency**: Race conditions, duplicate processing prevention
- **Recovery**: Account suspension, closure, reactivation

## Swedish Business Test Data

### Mock Businesses Available

#### Café (Individual Account)
```javascript
{
  name: "Café Aurora Stockholm",
  owner: "Anna Andersson",
  personnummer: "850615-1234",  // Fake number
  city: "Stockholm",
  business_type: "individual"
}
```

#### Restaurant (Company Account)
```javascript
{
  name: "NordMat AB",
  org_number: "556987654321",   // Fake Swedish org number
  city: "Göteborg", 
  business_type: "company"
}
```

#### Retail Store (Partnership)
```javascript
{
  name: "Malmö Handel HB",
  org_number: "969876543210",   // Fake partnership number
  city: "Malmö",
  business_type: "company"
}
```

## Stripe Test Cards

### Success Scenarios
- `4000000000000002` - Generic success
- `4000007520000007` - Sweden-issued Visa
- `5200007520000007` - Sweden-issued Mastercard
- `4000000000003220` - Requires 3DS authentication

### Decline Scenarios
- `4000000000009995` - Insufficient funds
- `4000000000009987` - Stolen card
- `4000007520000015` - Sweden-specific decline

### Error Scenarios
- `4000000000000044` - Exceeds account limits
- `4000002760003184` - Always requires authentication

## Reward Tier System

Quality scores determine reward percentages:

| Score Range | Tier | Reward % | Example (100 SEK purchase) |
|-------------|------|----------|----------------------------|
| 90-100 | Exceptional | 8-12% | 8-12 SEK |
| 75-89 | Very Good | 4-7% | 4-7 SEK |
| 60-74 | Acceptable | 1-3% | 1-3 SEK |
| 0-59 | Insufficient | 0% | 0 SEK |

**Platform Commission**: 20% of all rewards distributed

## Currency Handling

Swedish Krona (SEK) with öre as smallest unit:
- 1 SEK = 100 öre
- Stripe amounts in öre (e.g., 25000 öre = 250 SEK)
- Test utilities handle conversion automatically

```javascript
const reward = StripeTestUtils.convertSEKToOre(25.50); // 2550 öre
const display = StripeTestUtils.formatSEK(2550);       // "25.50 kr"
```

## Fraud Protection Limits

Per customer daily/monthly limits:
- **Daily Rewards**: Max 500 SEK per customer
- **Monthly Rewards**: Max 10,000 SEK per customer  
- **Transfer Velocity**: Max 10/hour, 50/day per customer
- **Risk Scoring**: Automated fraud detection

## Nordic Market Expansion

Tests include scenarios for:
- 🇳🇴 **Norway**: NOK currency, Norwegian org numbers
- 🇩🇰 **Denmark**: DKK currency, CVR numbers
- 🇫🇮 **Finland**: EUR currency, Y-tunnus identifiers

## Webhook Security

All webhook tests verify:
- **Signature Validation**: HMAC-SHA256 with webhook secret
- **Timestamp Verification**: Prevents replay attacks (5-minute window)
- **Event Idempotency**: Duplicate event handling
- **Error Recovery**: Failed webhook retry logic

Example signature validation:
```javascript
const signature = crypto
  .createHmac('sha256', webhookSecret)
  .update(`${timestamp}.${payload}`)
  .digest('hex');
```

## Error Handling

Tests cover common error scenarios:
- **Invalid Business Data**: Missing required fields, format errors
- **Payment Failures**: Declined cards, insufficient funds, expired cards
- **Webhook Failures**: Invalid signatures, malformed payloads
- **Rate Limiting**: Too many requests, velocity violations
- **Account Issues**: Suspended accounts, verification failures

## Debugging

### Enable Debug Logging
```bash
DEBUG=stripe:* npm test
```

### View Webhook Events
```bash
# Start mock webhook server
npm run webhook:mock

# View received events
curl http://localhost:3333/webhooks/events
```

### Test Specific Scenario
```javascript
// In test file
describe.only('Specific scenario', () => {
  it('should handle edge case', async () => {
    // Test implementation
  });
});
```

## Safety Measures

Multiple safeguards prevent real money usage:

1. **Environment Validation**: Tests fail if production keys detected
2. **Key Prefix Checks**: Only `sk_test_` and `pk_test_` keys accepted
3. **Fake Data Only**: All business data is clearly marked as fake
4. **Test Mode Verification**: Stripe SDK configured for test mode
5. **Isolated Environment**: No production database or webhook endpoints

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Stripe Connect Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
        working-directory: tests/stripe-connect
      
      - name: Run Stripe tests
        run: npm test
        working-directory: tests/stripe-connect
        env:
          STRIPE_TEST_SECRET_KEY: ${{ secrets.STRIPE_TEST_SECRET_KEY }}
          STRIPE_TEST_WEBHOOK_SECRET: ${{ secrets.STRIPE_TEST_WEBHOOK_SECRET }}
```

## Monitoring & Metrics

Production integration should monitor:
- **Payment Success Rate**: Target >99.5%
- **Webhook Processing**: <1 second average response time  
- **Fraud Detection**: False positive rate <2%
- **Commission Collection**: 100% accuracy on reward calculations
- **Customer Satisfaction**: Smooth payout experience

## Support & Troubleshooting

### Common Issues

**Test fails with "Must use test keys"**
- Verify `STRIPE_TEST_SECRET_KEY` starts with `sk_test_`
- Check `.env` file configuration

**Webhook signature validation fails**
- Ensure `STRIPE_TEST_WEBHOOK_SECRET` matches test setup
- Verify webhook payload is raw bytes, not parsed JSON

**Swedish validation errors**
- Use fake but properly formatted data (org numbers, phone numbers)
- Follow Swedish business registration patterns

**Currency conversion errors**  
- Remember Stripe uses smallest currency unit (öre for SEK)
- Use provided utility functions for conversions

### Getting Help

1. Review test logs for specific error messages
2. Check Stripe test dashboard for webhook delivery status
3. Verify environment variable configuration
4. Ensure all test data follows Swedish formatting rules

---

**⚠️ IMPORTANT REMINDER**: This testing infrastructure uses only Stripe test keys and fake Swedish business data. No real payments or business accounts are created. All Swedish organization numbers, personnummer, and business details are fictional for testing purposes only.