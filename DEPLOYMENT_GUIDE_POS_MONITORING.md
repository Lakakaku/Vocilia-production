# POS Integration Monitoring Infrastructure Deployment Guide

This guide covers the deployment and configuration of comprehensive POS integration monitoring for Square, Shopify, and Zettle integrations in the AI Feedback Platform.

## Overview

The POS monitoring infrastructure provides:
- Real-time health monitoring for all POS providers
- Webhook delivery reliability tracking
- API performance and error rate monitoring
- Authentication status monitoring
- Automated alerting and retry mechanisms
- Comprehensive Grafana dashboards
- Structured logging and metrics collection

## Architecture Components

### Core Monitoring Services

1. **POS Health Monitor** (`pos-health-monitor.ts`)
   - Tests API connectivity for each provider
   - Validates authentication status
   - Monitors webhook endpoints
   - Tracks rate limits and error rates

2. **POS Metrics Collector** (`pos-metrics-collector.ts`)
   - Collects Prometheus metrics
   - Interfaces with Redis for caching
   - Provides business-specific health scores
   - Tracks OAuth token expiry

3. **Webhook Processor** (`webhook-processor.ts`)
   - Handles incoming webhooks from all providers
   - Validates signatures and processes events
   - Implements retry mechanisms
   - Logs delivery metrics

### Monitoring Infrastructure

1. **Prometheus** (Port 9095)
   - POS-specific metrics collection
   - Custom alerting rules
   - 30-day retention with 5GB limit

2. **Grafana** (Port 3005)
   - Dedicated POS monitoring dashboards
   - Real-time alerting visualization
   - Business-specific health tracking

3. **AlertManager** (Port 9096)
   - Multi-channel alerting (Slack, email, PagerDuty)
   - Intelligent alert grouping and inhibition
   - Escalation policies for critical issues

4. **POS Metrics Exporter** (Port 3004)
   - Custom business logic metrics
   - Database and Redis integration
   - External provider status monitoring

## Deployment Instructions

### Prerequisites

1. **Environment Variables**
```bash
# Core API Configuration
API_GATEWAY_URL=http://api-gateway:3001
DATABASE_URL=postgresql://user:pass@host:5432/db
REDIS_URL=redis://redis:6379

# POS Provider Credentials
SQUARE_ACCESS_TOKEN=your_square_token
SQUARE_APPLICATION_ID=your_square_app_id
SQUARE_WEBHOOK_SIGNATURE_KEY=your_square_webhook_key

SHOPIFY_ACCESS_TOKEN=your_shopify_token
SHOPIFY_SHOP_DOMAIN=your-shop.myshopify.com
SHOPIFY_WEBHOOK_SECRET=your_shopify_webhook_secret

ZETTLE_ACCESS_TOKEN=your_zettle_token
ZETTLE_CLIENT_ID=your_zettle_client_id
ZETTLE_WEBHOOK_SECRET=your_zettle_webhook_secret

# Monitoring Configuration
GRAFANA_POS_ADMIN_PASSWORD=secure_password
PROMETHEUS_URL=http://pos-prometheus:9090

# Alerting Configuration
SLACK_POS_WEBHOOK_URL=https://hooks.slack.com/your-webhook
SLACK_POS_CRITICAL_WEBHOOK_URL=https://hooks.slack.com/critical-webhook
PAGERDUTY_POS_INTEGRATION_KEY=your_pagerduty_key
POS_PLATFORM_EMAIL=platform-team@company.com
```

### Step 1: Database Setup

Create the required database tables:

```sql
-- POS credentials table
CREATE TABLE pos_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES businesses(id),
    provider VARCHAR(20) NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_expires_at TIMESTAMP,
    shop_domain VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    last_health_check_at TIMESTAMP,
    is_healthy BOOLEAN DEFAULT true,
    last_sync_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- POS API logs table
CREATE TABLE pos_api_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES businesses(id),
    provider VARCHAR(20) NOT NULL,
    endpoint VARCHAR(255) NOT NULL,
    success BOOLEAN NOT NULL,
    response_time INTEGER, -- milliseconds
    error_message TEXT,
    error_type VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Webhook deliveries table
CREATE TABLE webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(20) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL, -- success, failed, pending
    processing_time INTEGER, -- milliseconds
    retry_count INTEGER DEFAULT 0,
    last_retry_at TIMESTAMP,
    error_message TEXT,
    payload_size INTEGER,
    source_ip INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- POS transactions table (for verification)
CREATE TABLE pos_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(20) NOT NULL,
    external_id VARCHAR(255) NOT NULL,
    business_id UUID REFERENCES businesses(id),
    amount DECIMAL(10,2),
    currency VARCHAR(3),
    status VARCHAR(50),
    location_id VARCHAR(255),
    order_id VARCHAR(255),
    customer_id VARCHAR(255),
    payment_method VARCHAR(50),
    refund_id VARCHAR(255),
    refund_amount DECIMAL(10,2),
    refund_status VARCHAR(50),
    refund_created_at TIMESTAMP,
    webhook_processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(provider, external_id)
);

-- Indexes for performance
CREATE INDEX idx_pos_credentials_business_provider ON pos_credentials(business_id, provider);
CREATE INDEX idx_pos_api_logs_provider_created ON pos_api_logs(provider, created_at DESC);
CREATE INDEX idx_webhook_deliveries_provider_status ON webhook_deliveries(provider, status);
CREATE INDEX idx_pos_transactions_provider_external ON pos_transactions(provider, external_id);
CREATE INDEX idx_pos_transactions_created ON pos_transactions(created_at DESC);
```

### Step 2: Deploy Monitoring Infrastructure

```bash
# Create monitoring directories
sudo mkdir -p /opt/ai-feedback/monitoring/pos/{prometheus-data,grafana-data}
sudo chown -R 65534:65534 /opt/ai-feedback/monitoring/pos/prometheus-data
sudo chown -R 472:472 /opt/ai-feedback/monitoring/pos/grafana-data

# Deploy POS monitoring stack
docker-compose -f docker-compose.pos-monitoring.yml up -d

# Verify services are running
docker-compose -f docker-compose.pos-monitoring.yml ps
```

### Step 3: Configure API Gateway

Update your API Gateway to include POS monitoring routes:

```typescript
// Add to apps/api-gateway/src/index.ts
import { posHealthRoutes } from './routes/pos-health';
import { posWebhookRoutes } from './routes/pos-webhooks';

// Add routes
app.use('/pos', posHealthRoutes);
app.use('/webhooks', posWebhookRoutes);
```

### Step 4: Set Up Webhook Endpoints

Configure webhooks in each POS provider:

#### Square Webhooks
```bash
curl -X POST \
  https://connect.squareup.com/v2/webhooks/subscriptions \
  -H "Authorization: Bearer $SQUARE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "subscription": {
      "name": "AI Feedback Platform",
      "event_types": [
        "payment.created",
        "payment.updated",
        "refund.created",
        "order.created"
      ],
      "notification_url": "https://your-domain.com/webhooks/square",
      "api_version": "2023-10-18"
    }
  }'
```

#### Shopify Webhooks
```bash
curl -X POST \
  https://$SHOPIFY_SHOP_DOMAIN/admin/api/2023-10/webhooks.json \
  -H "X-Shopify-Access-Token: $SHOPIFY_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "webhook": {
      "topic": "orders/create",
      "address": "https://your-domain.com/webhooks/shopify",
      "format": "json"
    }
  }'
```

#### Zettle Webhooks
Configure webhooks through the Zettle Developer Portal or API.

## Configuration Files

### Prometheus Configuration (`prometheus-pos.yml`)
- Scrapes metrics from API Gateway and metrics exporter
- Includes POS-specific scraping jobs
- Configures alerting rules
- 15-second scrape intervals for real-time monitoring

### Grafana Dashboard (`grafana-pos-dashboard.json`)
- Real-time health status overview
- API response time and error rate graphs
- Webhook delivery success rates
- Authentication status monitoring
- Business-specific health scores
- OAuth token expiry tracking

### AlertManager Rules (`pos-alert-rules.yml`)
- Provider connectivity alerts
- Authentication failure alerts
- High error rate warnings
- Rate limit notifications
- Webhook delivery failures
- Business connection health alerts

## Monitoring Features

### Health Checks

1. **API Connectivity Tests**
   - Tests each provider's API endpoints
   - Measures response times
   - Validates API responses

2. **Authentication Monitoring**
   - Checks token validity
   - Monitors token expiry
   - Alerts on authentication failures

3. **Webhook Health**
   - Validates webhook endpoints
   - Monitors delivery success rates
   - Tracks processing times

### Metrics Collection

The system collects comprehensive metrics:

```prometheus
# Connection status
pos_connection_status{provider="square", business_id="123"} 1

# API response times
pos_api_response_time_seconds_bucket{provider="square", endpoint="/locations"} 0.5

# Error rates
pos_error_rate_percent{provider="shopify"} 2.5

# Webhook deliveries
pos_webhook_deliveries_total{provider="zettle", status="success"} 1500

# Authentication status
pos_auth_status{provider="square", business_id="123"} 1

# Rate limits
pos_rate_limit_remaining{provider="shopify"} 850

# Business health scores
pos_business_connection_health{provider="square", business_id="123"} 95
```

### Alerting

The system provides multi-level alerting:

#### Critical Alerts
- POS provider completely down
- Multiple authentication failures
- Platform-wide issues affecting multiple businesses

#### Warning Alerts
- High error rates (>25%)
- Slow API responses
- Webhook delivery failures
- OAuth tokens expiring soon

#### Informational Alerts
- Rate limit approaching
- Sync operation failures
- Individual business connection issues

## Dashboard Access

### Grafana (Port 3005)
- **URL**: http://your-server:3005
- **Username**: admin
- **Password**: Set via `GRAFANA_POS_ADMIN_PASSWORD`

### Prometheus (Port 9095)
- **URL**: http://your-server:9095
- Direct access to metrics and alerting rules

### AlertManager (Port 9096)
- **URL**: http://your-server:9096
- Alert management and silencing

## API Endpoints

### Health Check Endpoints

```bash
# Overall POS health
GET /pos/health

# Provider-specific health
GET /pos/health/square
GET /pos/health/shopify  
GET /pos/health/zettle

# Business connections for a provider
GET /pos/health/square/connections

# Webhook health for a provider
GET /pos/health/square/webhooks

# Test connection
POST /pos/health/square/test
```

### Webhook Endpoints

```bash
# Provider webhook receivers
POST /webhooks/square
POST /webhooks/shopify
POST /webhooks/zettle

# Webhook delivery status
GET /webhooks/deliveries/square

# Retry failed delivery
POST /webhooks/retry/square/delivery-id

# Webhook health check
GET /webhooks/health
```

## Troubleshooting

### Common Issues

1. **High API Response Times**
   - Check provider status pages
   - Verify network connectivity
   - Review rate limiting status

2. **Authentication Failures**
   - Verify OAuth tokens haven't expired
   - Check token scopes and permissions
   - Refresh tokens if needed

3. **Webhook Delivery Failures**
   - Verify webhook endpoints are accessible
   - Check SSL certificates
   - Review webhook signature validation

4. **Missing Metrics**
   - Verify metrics exporter is running
   - Check database connectivity
   - Review Prometheus scraping configuration

### Log Locations

```bash
# Health check logs
/var/log/pos-health/health-checker.log

# Webhook monitoring logs  
/var/log/pos-webhooks/webhook-monitor.log

# Metrics exporter logs
/var/log/pos-metrics/exporter.log

# Synthetic test logs
/var/log/pos-synthetic/synthetic-tester.log
```

### Performance Tuning

1. **Prometheus Storage**
   - Adjust retention time based on needs
   - Monitor disk usage in `/opt/ai-feedback/monitoring/pos/prometheus-data`

2. **Scraping Intervals**
   - Balance real-time monitoring with resource usage
   - Adjust intervals in `prometheus-pos.yml`

3. **Alert Frequency**
   - Configure appropriate group intervals in AlertManager
   - Set reasonable repeat intervals to avoid alert fatigue

## Security Considerations

1. **Webhook Signature Validation**
   - All webhooks validate signatures
   - Use secure webhook secrets
   - Rotate secrets regularly

2. **Credential Management**
   - Store credentials securely in environment variables
   - Use encrypted database fields for sensitive data
   - Implement regular token rotation

3. **Network Security**
   - Use HTTPS for all webhook endpoints
   - Implement proper firewall rules
   - Monitor for suspicious traffic patterns

4. **Access Control**
   - Secure Grafana with proper authentication
   - Limit access to monitoring endpoints
   - Use proper RBAC for alert management

## Maintenance

### Daily Tasks
- Review alert status in Grafana
- Check for failed webhook deliveries
- Monitor OAuth token expiry dates

### Weekly Tasks
- Review error trends and patterns
- Analyze performance metrics
- Update provider credentials if needed

### Monthly Tasks
- Review and update alerting thresholds
- Analyze long-term trends
- Update monitoring configurations
- Test disaster recovery procedures

## Support and Monitoring

### Key Metrics to Monitor

1. **Provider Uptime**: Should be >99.5%
2. **Webhook Success Rate**: Should be >98%
3. **API Response Times**: P95 should be <2 seconds
4. **Error Rates**: Should be <5%
5. **Authentication Health**: All tokens should be valid

### Emergency Procedures

1. **Provider Outage**
   - Check provider status pages
   - Implement graceful degradation
   - Communicate status to users

2. **Mass Authentication Failure**
   - Check for API changes
   - Verify credential validity
   - Implement batch token refresh

3. **Webhook Delivery Issues**
   - Verify endpoint accessibility
   - Check SSL certificate status
   - Review firewall configurations

This comprehensive monitoring infrastructure ensures high reliability and visibility into your POS integrations, enabling proactive issue resolution and optimal system performance.