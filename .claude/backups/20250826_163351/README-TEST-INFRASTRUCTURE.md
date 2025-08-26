# 🇸🇪 Swedish Pilot - TEST Payment Infrastructure

**COMPREHENSIVE TEST ENVIRONMENT FOR PAYMENT SYSTEM DEMONSTRATION**

This infrastructure provides a complete TEST environment for demonstrating the AI Feedback Platform's payment system to Swedish businesses and financial authorities. All components use test data, mock APIs, and free-tier resources.

## 🎯 Purpose

- **Pilot Demonstration**: Show Swedish businesses how the payment system works
- **Compliance Testing**: Demonstrate Swedish financial authority (Finansinspektionen) compliance
- **Migration Preparation**: Prepare for seamless transition to production
- **Free Tier Compatible**: Uses only free/test resources

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose
- Node.js 18+
- PostgreSQL client tools
- AWS CLI (optional, for S3 backups)

### 1. Start TEST Infrastructure
```bash
cd payments/test-infrastructure
docker-compose -f docker-compose.payments-test.yml up -d
```

### 2. Access Services
- **Payment Gateway**: http://localhost:3010
- **Monitoring Dashboard**: http://localhost:3013 (admin/testpayments123)
- **Stripe Webhook Mock**: http://localhost:3011
- **FI Mock API**: http://localhost:3012
- **Test Database**: localhost:5433 (test_user/test_password)

### 3. Generate Test Data
```bash
# Simulate test payments
curl http://localhost:3010/api/test/simulate-payment

# View monitoring dashboard
open http://localhost:3013
```

## 📊 Components Overview

### Core Services

#### 1. Payment Gateway (Port 3010)
- **Full Stripe integration** in TEST mode
- **Swedish compliance logging** to mock Finansinspektionen API
- **Multi-payment method support** (Card, Swish, Bankgiro)
- **Comprehensive metrics** for monitoring
- **Auto-generated test transactions**

#### 2. Test Database (Port 5433)
- **Complete Swedish business data** (Stockholm, Gothenburg, Malmö)
- **Compliance event logging** for FI reporting
- **Payment transaction history**
- **Analytics views** for business metrics

#### 3. Monitoring Stack
- **Grafana Dashboard** (Port 3013) - Swedish Pilot specific visualizations
- **Prometheus Metrics** (Port 9093) - Payment system monitoring
- **Custom Metrics Exporter** (Port 9104) - Business-specific metrics

#### 4. Mock Services
- **Stripe Webhook Handler** - Simulates Stripe webhook events
- **Finansinspektionen Mock API** - Swedish compliance authority simulation
- **Test Data Generator** - Continuous generation of realistic test data

## 🏛️ Swedish Compliance Features

### Finansinspektionen (FI) Integration
- **Automated compliance reporting** to mock FI API
- **PSD2 compliance tracking** with detailed event logging
- **Monthly summary reports** with Swedish business breakdown
- **Real-time compliance event monitoring**
- **GDPR-compliant data handling** demonstrations

### Test Compliance Reports
```bash
# View compliance dashboard
curl http://localhost:3012/compliance/status

# Generate monthly report
curl -X POST http://localhost:3012/reports/generate
```

## 💳 Payment Testing

### Supported Test Scenarios
1. **Basic Card Payments** - Standard Stripe test cards
2. **Swedish Payment Methods** - Swish simulation, Bankgiro testing
3. **Multi-Location Testing** - Different Swedish regions
4. **Business Tier Testing** - Different subscription levels
5. **Compliance Event Testing** - FI reporting scenarios

### Test Payment Flow
```bash
# Create payment intent
curl -X POST http://localhost:3010/api/payments/create-intent \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 250.50,
    "currency": "SEK",
    "customer_id": "test_customer_123",
    "business_id": "550e8400-e29b-41d4-a716-446655440001",
    "location_id": "test_location_stockholm",
    "feedback_session_id": "test_session_abc",
    "payment_method": "card"
  }'

# Confirm payment
curl -X POST http://localhost:3010/api/payments/{payment_id}/confirm
```

## 📈 Monitoring & Analytics

### Business Dashboard Features
- **Real-time payment monitoring** across Swedish regions
- **Compliance event tracking** with FI reporting status
- **Business performance metrics** by location and tier
- **Payment method distribution** analysis
- **Swedish regulatory compliance** status indicators

### Key Metrics Tracked
- Payment success rates by region
- Average transaction values in SEK
- Compliance event frequencies
- FI reporting submission status
- Business onboarding progress

## 🔒 Security & Compliance

### Test Security Features
- **Encrypted test data** (simulating production security)
- **Mock PCI DSS compliance** for card handling
- **GDPR compliance demonstrations** with data anonymization
- **Swedish regulatory compliance** testing framework
- **Fraud detection simulation** with test scenarios

### Compliance Logging
All compliance events are logged with:
- **Finansinspektionen reference numbers**
- **PSD2 regulation compliance**
- **GDPR data protection compliance**
- **Swedish Payment Services Act adherence**

## 💾 Backup & Migration

### Automated Test Backups
```bash
# Manual backup
./scripts/backup-payments-test.sh

# Scheduled backups (every 4 hours)
# Configured in docker-compose.payments-test.yml
```

### TEST to LIVE Migration
```bash
# Prepare migration
cd migration
node test-to-live-migration.js

# Review migration artifacts
ls migration-artifacts/

# Execute production migration (when ready)
./migration-artifacts/migrate-to-production.sh
```

## 🇸🇪 Swedish Market Features

### Regional Support
- **Stockholm Region** - Primary financial hub
- **Gothenburg Region** - Secondary market
- **Malmö Region** - Southern Sweden coverage
- **Multi-region failover** and load balancing

### Local Payment Methods
- **Swish Integration** (TEST mode)
- **Bankgiro Support** (simulation)
- **Swedish Krona (SEK)** as primary currency
- **Swedish banking compliance**

### Test Businesses Included
1. **Stockholms Test Café AB** (Stockholm)
2. **Göteborgs Handels AB** (Gothenburg)  
3. **Malmö Restaurang HB** (Malmö)
4. **Uppsala Bokhandel AB** (Uppsala)
5. **Linköping Tech Store AB** (Linköping)

## 🎛️ Configuration

### Environment Variables
```bash
# Stripe TEST Configuration
STRIPE_TEST_SECRET_KEY=sk_test_...
STRIPE_TEST_WEBHOOK_SECRET=whsec_test_...

# Database Configuration  
TEST_DATABASE_URL=postgresql://test_user:test_password@payments-test-db:5432/payments_test

# Swedish Compliance
FINANSINSPEKTIONEN_ENDPOINT=http://finansinspektionen-mock:3000
FI_TEST_API_KEY=test_fi_key_12345

# Monitoring
SLACK_PERFORMANCE_WEBHOOK=https://hooks.slack.com/...
GRAFANA_ADMIN_PASSWORD=testpayments123

# Backup Configuration
S3_TEST_BUCKET=ai-feedback-test-backups
BACKUP_RETENTION_DAYS=7
```

## 🚧 Development & Testing

### Adding Test Scenarios
1. **Create test business** in database
2. **Configure payment flow** in payment gateway
3. **Set up monitoring** for new metrics  
4. **Add compliance logging** for new events
5. **Update dashboard** with new visualizations

### Testing Checklist
- [ ] Payment creation and confirmation
- [ ] Multi-region functionality
- [ ] Compliance event generation
- [ ] FI report submission
- [ ] Monitoring dashboard updates
- [ ] Backup and restore procedures
- [ ] Migration preparation scripts

## 📋 Demo Script for Swedish Businesses

### 1. Payment System Demo
```bash
# Show payment gateway
curl http://localhost:3010/health

# Generate test payment
curl http://localhost:3010/api/test/simulate-payment

# Show monitoring dashboard
open http://localhost:3013
```

### 2. Compliance Demo
```bash
# Show compliance status
curl http://localhost:3012/compliance/status

# Generate FI report
curl -X POST http://localhost:3012/reports/generate

# View compliance events
curl http://localhost:3012/compliance/events
```

### 3. Regional Demo
```bash
# Show Stockholm payments
curl "http://localhost:3010/api/analytics?region=stockholm"

# Show all Swedish regions
curl "http://localhost:3010/api/analytics?region=all"
```

## 🔄 Migration to Production

### Pre-Migration Checklist
- [ ] **Test environment validation** complete
- [ ] **Business data integrity** verified
- [ ] **Compliance records** validated
- [ ] **Swedish pilot data** confirmed
- [ ] **Migration scripts** prepared

### Migration Process
1. **Validate TEST environment** - Ensure all data is correct
2. **Prepare production schema** - Generate production database
3. **Migrate business data** - Transfer validated businesses
4. **Configure compliance** - Set up live FI reporting
5. **Deploy production services** - Switch to live environment
6. **Verify live system** - Comprehensive testing

### Post-Migration
- **DNS switching** from test to production domains
- **Stripe webhook** configuration for live environment
- **FI API** configuration for real compliance reporting
- **Monitoring setup** for production metrics

## 🆘 Troubleshooting

### Common Issues

#### Payment Gateway Not Starting
```bash
# Check logs
docker logs payments-test-gateway

# Verify environment variables
docker exec payments-test-gateway env | grep STRIPE
```

#### Database Connection Issues
```bash
# Test connection
docker exec payments-test-db psql -U test_user -d payments_test -c "SELECT 1;"

# Reset database
docker-compose restart payments-test-db
```

#### Monitoring Dashboard Issues
```bash
# Reset Grafana
docker-compose restart payments-monitoring

# Check Prometheus targets
curl http://localhost:9093/api/v1/targets
```

### Support Contacts
- **Technical Issues**: devops@feedback.your-domain.com
- **Compliance Questions**: compliance@feedback.your-domain.com
- **Swedish Business Support**: sweden@feedback.your-domain.com

## 📞 Contact Information

### Development Team
- **Lead Developer**: dev-team@ai-feedback.se
- **DevOps Engineer**: devops@ai-feedback.se
- **Compliance Officer**: compliance@ai-feedback.se

### Swedish Market
- **Business Development**: business-sweden@ai-feedback.se
- **Regulatory Affairs**: regulatory@ai-feedback.se
- **Customer Support**: support-sweden@ai-feedback.se

---

**🎉 Ready to demonstrate the future of customer feedback in Sweden!**

This TEST infrastructure provides everything needed to showcase the AI Feedback Platform's payment system to Swedish businesses while ensuring full compliance with local financial regulations.