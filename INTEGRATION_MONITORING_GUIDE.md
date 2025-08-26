# Integration Monitoring & Manual Override Tools

## Overview
This document describes the newly implemented integration monitoring dashboard and manual override tools for the AI Feedback Platform's admin system.

## Features Implemented

### 13. Integration Monitoring Dashboard ✅

#### Real-time POS Integration Health Monitoring
- **Location**: `/integration-monitoring`
- **Components**:
  - Live health status for each business integration
  - Status indicators: Healthy (green), Degraded (yellow), Offline (red)
  - Connection metrics: Response time, uptime percentage
  - Webhook processing statistics
  - API call metrics and error rates

#### Transaction Sync Status Tracking
- **Features**:
  - View all pending, syncing, and failed transactions
  - Transaction details: ID, amount, business, attempts, errors
  - Real-time sync queue monitoring
  - Batch sync operations overview
  - Historical sync performance data

#### Automated Alerting System
- **Alert Types**:
  - Connection failures
  - High error rates (>5% threshold)
  - Rate limit warnings (>85% usage)
  - Sync delays (>5 minutes)
  - Webhook validation failures
- **Alert Display**:
  - Banner notifications at top of dashboard
  - Severity levels: Error (red), Warning (yellow), Info (blue)
  - Auto-dismiss after resolution
  - Alert history log

#### Performance Analytics & Optimization
- **Analytics Features**:
  - Response time trends (24-hour chart)
  - Success rate visualization
  - Throughput analysis (transactions/minute)
  - Provider comparison metrics
- **Optimization Suggestions**:
  - Batch processing recommendations
  - Rate limit optimization tips
  - Peak time pattern analysis
  - Retry strategy adjustments

### 14. Manual Override Tools ✅

#### Transaction Verification Override
- **Location**: `/manual-overrides`
- **Capabilities**:
  - Manually verify transactions that failed automatic verification
  - Input transaction ID, amount, and reason
  - Optional POS reference linking
  - Full audit trail of all overrides
  - Recent override history display

#### Forced Transaction Sync
- **Features**:
  - Trigger immediate sync for specific business
  - Options: Incremental (24h), Full, or Custom range
  - Priority levels: Low, Normal, High
  - Real-time sync progress tracking
  - Sync history and statistics

#### POS Reconfiguration Tools
- **Configuration Options**:
  - Change POS provider (Square, Shopify, Zettle)
  - Update API credentials (encrypted storage)
  - Modify webhook secrets
  - Adjust sync intervals and retry attempts
  - Switch between production/sandbox environments
  - Enable/disable auto-sync

#### Integration Debugging & Diagnostics
- **Diagnostic Tests**:
  - API connection test
  - Webhook validation test
  - Authentication verification
  - Transaction fetch test
  - Rate limit check
- **Debug Tools**:
  - Live console output
  - Webhook inspector
  - Request/response payload viewer
  - Error log access
  - Cache clearing

## Technical Implementation

### Backend Routes

#### Integration Monitoring Routes (`/api/admin/`)
- `GET /integration-health` - Get health status for all/specific businesses
- `GET /pending-syncs` - View pending transaction syncs
- `GET /integration-performance` - Fetch performance metrics
- `GET /integration-alerts` - Get active alerts
- `POST /force-sync` - Trigger manual sync
- `POST /retry-transaction` - Retry specific transaction

#### Manual Override Routes (`/api/admin/`)
- `POST /override-transaction` - Manual transaction verification
- `GET /recent-overrides` - View recent override history
- `GET /pos-config/:businessId` - Get POS configuration
- `PUT /reconfigure-pos` - Update POS settings
- `POST /diagnostics/:endpoint` - Run diagnostic tests

### Database Schema Updates

#### New Tables
- `transaction_sync` - Track sync status for transactions
- `pos_integrations` - Store POS configuration per business
- `audit_logs` - Log all admin actions
- `integration_health_metrics` - Store performance metrics

#### Updated Tables
- `transactions` - Added override fields (overridden, override_reason, overridden_by)
- `businesses` - Added pos_integration JSONB field

### Security Features

#### Permission Requirements
- `system:read` - View monitoring dashboard
- `system:admin` - Access manual override tools
- `business:approve` - Modify POS configurations
- All actions logged in audit trail

#### Data Protection
- API keys and secrets encrypted at rest
- Masked sensitive data in UI
- Rate limiting on all endpoints
- Session-based authentication required

## Usage Instructions

### Accessing the Features

1. **Integration Monitoring**:
   - Navigate to Admin Dashboard
   - Click "Integration Övervakning" (Integration Monitoring) in sidebar
   - Select business from dropdown or view all
   - Monitor real-time health status

2. **Manual Overrides**:
   - Navigate to Admin Dashboard
   - Click "Manuell Kontroll" (Manual Control) in sidebar
   - Select business from dropdown
   - Choose operation tab (Transaction, Sync, Config, Diagnostics)

### Common Operations

#### Force Sync a Business
1. Go to Manual Overrides page
2. Select business from dropdown
3. Click "Force Sync" tab
4. Choose sync type (Incremental/Full)
5. Click "Start Sync" button

#### Override Transaction Verification
1. Go to Manual Overrides page
2. Select business from dropdown
3. Enter transaction ID and amount
4. Provide detailed reason
5. Click "Override Transaction"

#### Run Diagnostics
1. Go to Manual Overrides page
2. Select business from dropdown
3. Click "Diagnostics" tab
4. Click "Run Tests" button
5. Review test results

## Monitoring Best Practices

### Daily Tasks
- Check integration health dashboard for offline systems
- Review pending syncs queue
- Address any critical alerts

### Weekly Tasks
- Analyze performance trends
- Review optimization suggestions
- Check rate limit usage patterns

### Monthly Tasks
- Audit manual overrides
- Review integration error patterns
- Update POS configurations as needed

## Troubleshooting Guide

### Common Issues & Solutions

#### Integration Shows as Offline
1. Run diagnostic tests
2. Check API credentials
3. Verify webhook configuration
4. Test connection manually

#### High Sync Failure Rate
1. Check rate limits
2. Review error logs
3. Adjust retry settings
4. Consider batch processing

#### Slow Response Times
1. Check current load
2. Review integration performance metrics
3. Optimize sync intervals
4. Consider upgrading tier

## API Examples

### Force Sync Request
```bash
curl -X POST https://api.example.com/api/admin/force-sync \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "businessId": "123e4567-e89b-12d3-a456-426614174000",
    "fullSync": false
  }'
```

### Override Transaction
```bash
curl -X POST https://api.example.com/api/admin/override-transaction \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "businessId": "123e4567-e89b-12d3-a456-426614174000",
    "transactionId": "TXN-12345",
    "amount": "150.00",
    "reason": "Manual verification - customer provided receipt"
  }'
```

## Future Enhancements

### Planned Features
- Automated sync optimization based on patterns
- Machine learning for anomaly detection
- Bulk transaction override capabilities
- Integration health scoring algorithm
- Custom alert rules configuration
- Mobile app for monitoring

### Performance Improvements
- Implement caching for frequently accessed data
- Add WebSocket support for real-time updates
- Optimize database queries with better indexing
- Implement connection pooling for POS APIs

## Support & Documentation

For additional support or to report issues:
- Check system logs in `/logs` directory
- Review audit trail for recent changes
- Contact technical support team
- Submit feature requests via GitHub

## Conclusion

The integration monitoring dashboard and manual override tools provide comprehensive control over POS integrations, enabling administrators to:
- Monitor system health in real-time
- Quickly identify and resolve issues
- Manually intervene when necessary
- Maintain audit compliance
- Optimize integration performance

These tools significantly improve operational efficiency and reduce downtime for the AI Feedback Platform.