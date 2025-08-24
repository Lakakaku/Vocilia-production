# Stripe Webhook Setup Guide

This guide explains how to set up Stripe webhooks for the AI Feedback Platform's payment system.

## 🎯 Overview

Webhooks are essential for receiving real-time notifications from Stripe about:
- Account onboarding completion
- Transfer status updates  
- Payout processing results
- Account requirement changes

## 🚀 Quick Setup

### 1. Install Stripe CLI

**macOS (Homebrew):**
```bash
brew install stripe/stripe-cli/stripe
```

**Linux:**
```bash
wget -O - https://packages.stripe.dev/api/security/keypair/stripe-cli-gpg/public | gpg --dearmor | sudo tee /usr/share/keyrings/stripe.gpg
echo "deb [signed-by=/usr/share/keyrings/stripe.gpg] https://packages.stripe.dev/stripe-cli-debian-local stable main" | sudo tee -a /etc/apt/sources.list.d/stripe.list
sudo apt update && sudo apt install stripe
```

### 2. Login to Stripe

```bash
stripe login
```

*This opens your browser to authenticate with your Stripe test account.*

### 3. Start Local Webhook Forwarding

```bash
# Forward webhooks to your local API
stripe listen --forward-to localhost:3001/api/payments/webhooks/stripe

# Alternative: Forward specific events only
stripe listen --forward-to localhost:3001/api/payments/webhooks/stripe \
  --events account.updated,transfer.created,transfer.updated
```

### 4. Get Webhook Secret

When you run `stripe listen`, it will output a webhook secret like:
```
whsec_1234567890abcdef...
```

Add this to your `.env` file:
```bash
STRIPE_WEBHOOK_SECRET=whsec_1234567890abcdef...
```

## 🔧 Webhook Events We Handle

Our API (`/api/payments/webhooks/stripe`) processes these events:

### `account.updated`
- **Purpose**: Track business onboarding progress
- **Action**: Updates `stripe_onboarding_complete` status in database
- **Triggered**: When business completes/updates Stripe onboarding

### `transfer.created`
- **Purpose**: Log customer payout initiation
- **Action**: Records transfer details for audit trail
- **Triggered**: When we send money to customers

### `transfer.updated` 
- **Purpose**: Handle payout status changes
- **Action**: Updates feedback session if transfer fails
- **Triggered**: When transfer succeeds/fails/gets updated

## 🧪 Testing Webhooks

### Manual Event Triggering

```bash
# Simulate account update (business onboarding completion)
stripe trigger account.updated

# Simulate transfer creation (customer payout)
stripe trigger transfer.created

# Simulate transfer failure
stripe trigger transfer.updated --override destination_payment_failure=true
```

### View Recent Events

```bash
# List recent webhook events
stripe events list --limit 10

# Get specific event details
stripe events retrieve evt_1234567890
```

### Test with Real API Calls

1. **Start your API server:**
   ```bash
   cd apps/api-gateway
   npm run dev
   ```

2. **Start webhook forwarding:**
   ```bash
   stripe listen --forward-to localhost:3001/api/payments/webhooks/stripe
   ```

3. **Trigger business onboarding:**
   ```bash
   curl -X POST http://localhost:3001/api/payments/connect/onboard \
     -H "Content-Type: application/json" \
     -d '{
       "businessId": "test-business-123",
       "refreshUrl": "http://localhost:3000/onboarding/refresh", 
       "returnUrl": "http://localhost:3000/onboarding/return"
     }'
   ```

## 🔐 Production Webhook Setup

### 1. Create Production Webhook Endpoint

```bash
stripe webhook_endpoints create \
  --url https://yourdomain.com/api/payments/webhooks/stripe \
  --enabled-events account.updated,transfer.created,transfer.updated \
  --connect
```

### 2. Configure Environment Variables

```bash
STRIPE_WEBHOOK_SECRET=whsec_production_secret_here
STRIPE_SECRET_KEY=sk_live_your_production_key
```

### 3. Verify Webhook Security

Our webhook handler includes signature verification:

```javascript
// Verifies that webhook actually came from Stripe
const event = stripeService.verifyWebhookSignature(
  payload,
  signature, 
  process.env.STRIPE_WEBHOOK_SECRET
);
```

## 📊 Monitoring Webhooks

### View Webhook Logs

```bash
# Real-time webhook monitoring
stripe listen --print-json

# View webhook attempts in dashboard
stripe dashboard # Opens browser to Stripe Dashboard
```

### Common Issues & Solutions

**Issue**: `400 Bad Request - Missing signature`
- **Solution**: Ensure `STRIPE_WEBHOOK_SECRET` is set correctly

**Issue**: `Webhook signature verification failed`
- **Solution**: Check that webhook secret matches the endpoint

**Issue**: `Connection refused`
- **Solution**: Ensure your API server is running on the correct port

## 🎯 Integration with Business Dashboard

Webhooks automatically update the business dashboard:

1. **Account Status**: Shows onboarding progress in real-time
2. **Payout Status**: Displays successful/failed customer payouts  
3. **Requirements**: Lists any outstanding Stripe requirements

## 📝 Webhook Event Examples

### Account Updated (Onboarding Complete)

```json
{
  "type": "account.updated",
  "data": {
    "object": {
      "id": "acct_1234567890",
      "charges_enabled": true,
      "payouts_enabled": true,
      "details_submitted": true,
      "requirements": {
        "currently_due": [],
        "eventually_due": [],
        "past_due": []
      }
    }
  }
}
```

### Transfer Created (Customer Payout)

```json
{
  "type": "transfer.created", 
  "data": {
    "object": {
      "id": "tr_1234567890",
      "amount": 1250,
      "currency": "sek",
      "destination": "acct_business123",
      "metadata": {
        "sessionId": "feedback_session_456",
        "businessId": "business_789",
        "customerId": "customer_abc"
      }
    }
  }
}
```

## ✅ Setup Verification Checklist

- [ ] Stripe CLI installed and authenticated
- [ ] Webhook forwarding active (`stripe listen`)
- [ ] Webhook secret added to environment variables
- [ ] API server running and accessible
- [ ] Test webhook events working
- [ ] Business onboarding flow tested
- [ ] Customer payout flow tested

## 🚀 Ready for Swedish Pilot!

Once webhooks are properly configured, your Swedish pilot program can:

1. **Onboard businesses** automatically through Stripe Connect
2. **Process customer payouts** with real-time status updates
3. **Monitor payment health** through webhook event tracking
4. **Handle edge cases** like failed transfers or onboarding issues

The payment system is now production-ready for the Swedish market! 🇸🇪