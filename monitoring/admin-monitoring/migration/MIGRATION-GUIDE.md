# Admin-to-Live Migration Guide

## Overview
This guide provides comprehensive instructions for migrating from the admin monitoring system to the live production environment while maintaining Swedish compliance and ensuring seamless operation of all integrated systems.

## Migration Architecture

```
Admin Environment                Live Environment
┌─────────────────┐            ┌─────────────────┐
│ Admin Prometheus│  ────────▶ │ Live Prometheus │
│ Admin Grafana   │            │ Live Grafana    │
│ Admin AlertMgr  │            │ Live AlertMgr   │
│ Admin DB        │            │ Live DB         │
│ Admin Redis     │            │ Live Redis      │
└─────────────────┘            └─────────────────┘
         │                               │
         ▼                               ▼
┌─────────────────┐            ┌─────────────────┐
│Swedish Compliance│  ────────▶ │Swedish Compliance│
│ GDPR Features   │            │ GDPR Features   │
│ FI Reporting    │            │ FI Reporting    │
│ Data Residency  │            │ Data Residency  │
└─────────────────┘            └─────────────────┘
```

## Prerequisites

### System Requirements
- **CPU:** 4+ cores
- **RAM:** 8GB+ available  
- **Storage:** 50GB+ free space
- **Network:** Stable internet connection
- **OS:** Ubuntu 20.04+ or compatible Linux distribution

### Required Software
- Docker 20.10+
- Docker Compose 2.0+
- PostgreSQL client tools
- Redis client tools
- OpenSSL
- jq
- bc (basic calculator)
- curl

### Environment Variables
Create `/etc/admin-migration/.env` with:

```bash
# Admin System Configuration
ADMIN_DB_HOST=admin-postgres
ADMIN_DB_PORT=5432
ADMIN_DB_NAME=admin_feedback_platform
ADMIN_DB_USER=admin_user
ADMIN_DB_PASSWORD=your_admin_db_password

ADMIN_REDIS_HOST=admin-redis
ADMIN_REDIS_PORT=6379

# Live System Configuration  
LIVE_DB_HOST=live-postgres
LIVE_DB_PORT=5432
LIVE_DB_NAME=live_feedback_platform
LIVE_DB_USER=live_user
LIVE_DB_PASSWORD=your_live_db_password

LIVE_REDIS_HOST=live-redis
LIVE_REDIS_PORT=6379

# Encryption and Security
BACKUP_ENCRYPTION_KEY=your_backup_encryption_key
JWT_SECRET=your_jwt_secret
ENCRYPTION_KEY=your_encryption_key
SESSION_SECRET=your_session_secret

# Payment Integration
STRIPE_LIVE_SECRET_KEY=your_stripe_live_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
SWISH_MERCHANT_ID=your_swish_merchant_id
SWISH_WEBHOOK_SECRET=your_swish_webhook_secret
BANKGIRO_ACCOUNT=your_bankgiro_account

# External Services
SLACK_WEBHOOK_URL=your_slack_webhook_url
TEAMS_WEBHOOK_URL=your_teams_webhook_url
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
```

## Migration Phases

### Phase 1: Pre-Migration Validation (30-45 minutes)
**What it does:**
- Validates admin system health
- Checks Swedish compliance requirements
- Verifies resource availability
- Tests backup integrity
- Confirms live environment readiness

**Commands:**
```bash
# Source environment variables
source /etc/admin-migration/.env

# Run pre-migration validation
./admin-to-live-migration.sh --phase=pre-validation

# Review validation results
cat /var/admin-migration/migration.log
```

**Expected Output:**
```
[2024-12-19 10:00:00] Setting up migration environment...
[2024-12-19 10:00:01] === PHASE 1: Pre-Migration Validation ===
[2024-12-19 10:00:01] Validating admin system health...
[2024-12-19 10:00:02] Validating Swedish compliance requirements...
[2024-12-19 10:00:05] Pre-migration validation completed successfully
```

### Phase 2: Data Migration (1-2 hours)
**What it does:**
- Creates pre-migration snapshots
- Migrates PostgreSQL data with Swedish compliance filtering
- Transfers Redis session data
- Migrates monitoring configuration data
- Validates data integrity

**Commands:**
```bash
# Execute data migration
./admin-to-live-migration.sh --phase=data-migration

# Monitor progress
tail -f /var/admin-migration/migration.log

# Verify data migration
./admin-to-live-migration.sh --verify-data
```

**Key Data Transferred:**
- Swedish pilot business configurations
- Regional settings (Stockholm, Gothenburg, Malmö)
- User sessions and authentication data
- Monitoring metrics and historical data
- Compliance audit logs

### Phase 3: Service Migration (45-60 minutes)
**What it does:**
- Deploys live monitoring stack
- Configures webhook integrations
- Sets up alert routing for Swedish pilot
- Validates all services are operational

**Commands:**
```bash
# Deploy live services
./admin-to-live-migration.sh --phase=service-migration

# Check service status
docker-compose -f /opt/live-monitoring/docker-compose.yml ps

# Verify service health
curl http://live-prometheus:9090/api/v1/targets
curl http://live-grafana:3000/api/health
```

### Phase 4: Configuration Migration (30 minutes)
**What it does:**
- Migrates environment configurations
- Installs SSL certificates
- Configures authentication systems
- Applies Swedish compliance settings
- Prepares DNS configurations

**Commands:**
```bash
# Migrate configurations
./admin-to-live-migration.sh --phase=config-migration

# Verify SSL certificates
openssl x509 -in /etc/ssl/live-monitoring/live-monitoring.crt -text -noout

# Test authentication
curl -X POST http://live-api:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"test"}'
```

### Phase 5: Validation and Rollback Preparation (30 minutes)
**What it does:**
- Validates migrated data integrity
- Tests all live service functionality
- Verifies Swedish compliance features
- Prepares rollback procedures
- Creates migration validation report

**Commands:**
```bash
# Run validation and prepare rollback
./admin-to-live-migration.sh --phase=validation-rollback

# Review validation report
cat /var/admin-migration/migration-validation-report.md

# Test rollback preparation
/var/admin-migration/rollback/rollback-to-admin.sh --test
```

### Phase 6: DNS and Traffic Cutover (30-45 minutes)
**What it does:**
- Performs pre-cutover health checks
- Updates load balancer configuration
- Executes DNS cutover
- Monitors traffic distribution
- Validates cutover success

**Critical Steps:**
```bash
# Pre-cutover health checks
./admin-to-live-migration.sh --phase=dns-cutover --step=health-checks

# Manual DNS updates (update with your DNS provider)
# Example for Cloudflare:
curl -X PUT "https://api.cloudflare.com/client/v4/zones/ZONE_ID/dns_records/RECORD_ID" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     --data '{"type":"A","name":"monitoring","content":"NEW_LIVE_IP","ttl":300}'

# Monitor traffic distribution
./admin-to-live-migration.sh --monitor-traffic
```

### Phase 7: Post-Migration Validation (45 minutes)
**What it does:**
- Comprehensive system testing
- Swedish compliance final validation
- Performance benchmarking
- Security validation
- Generate final migration report

**Commands:**
```bash
# Full post-migration validation
./admin-to-live-migration.sh --phase=post-validation

# Generate final report
./admin-to-live-migration.sh --generate-final-report

# Review final report
cat /var/admin-migration/FINAL-MIGRATION-REPORT.md
```

## Swedish Compliance Verification

### GDPR Compliance Checklist
- [ ] Data encryption at rest and in transit
- [ ] Data retention policies (7 years) configured
- [ ] User consent management active
- [ ] Data subject rights implementation verified
- [ ] Privacy policy and notices in Swedish
- [ ] Data processing lawful basis documented
- [ ] DPO contact information configured

### Finansinspektionen Compliance Checklist
- [ ] License number configured in system
- [ ] Monthly reporting schedule active
- [ ] Transaction logging enabled
- [ ] Fraud detection monitoring active
- [ ] System outage reporting configured
- [ ] Audit trail retention (7 years) verified
- [ ] Compliance officer access configured

### Data Residency Checklist
- [ ] All data stored in Swedish regions only
- [ ] Cross-border data transfers disabled
- [ ] Regional configurations (Stockholm, Gothenburg, Malmö)
- [ ] Swedish language support enabled
- [ ] Local backup storage in Sweden

## Troubleshooting

### Common Issues

#### Migration Script Fails to Start
**Symptoms:** Permission denied or environment variable errors
**Solution:**
```bash
# Fix permissions
chmod +x /Users/lucasjenner/task-feedback/monitoring/admin-monitoring/migration/admin-to-live-migration.sh

# Check environment variables
env | grep -E "(ADMIN_|LIVE_|BACKUP_)"

# Verify required tools
which docker docker-compose psql redis-cli openssl jq bc curl
```

#### Database Migration Fails
**Symptoms:** Connection refused or authentication errors
**Solution:**
```bash
# Test admin database connection
PGPASSWORD="$ADMIN_DB_PASSWORD" psql -h "$ADMIN_DB_HOST" -U "$ADMIN_DB_USER" -d "$ADMIN_DB_NAME" -c "SELECT 1;"

# Test live database connection
PGPASSWORD="$LIVE_DB_PASSWORD" psql -h "$LIVE_DB_HOST" -U "$LIVE_DB_USER" -d "$LIVE_DB_NAME" -c "SELECT 1;"

# Check database logs
docker logs admin-postgres
docker logs live-postgres
```

#### Service Migration Issues
**Symptoms:** Services fail to start or health checks fail
**Solution:**
```bash
# Check Docker daemon
systemctl status docker

# Verify Docker Compose file
docker-compose -f /opt/live-monitoring/docker-compose.yml config

# Check service logs
docker-compose -f /opt/live-monitoring/docker-compose.yml logs
```

#### DNS Cutover Problems
**Symptoms:** Traffic not routing to live system
**Solution:**
```bash
# Check DNS propagation
nslookup monitoring.ai-feedback.se
dig monitoring.ai-feedback.se

# Verify load balancer
curl -I http://monitoring.ai-feedback.se

# Check certificate validity
openssl s_client -connect monitoring.ai-feedback.se:443
```

### Rollback Procedures

#### Emergency Rollback (< 1 hour post-migration)
```bash
# Execute automated rollback
/var/admin-migration/rollback/rollback-to-admin.sh

# Verify admin system health
curl http://admin-prometheus:9090/api/v1/targets
curl http://admin-grafana:3000/api/health
```

#### Data Rollback (> 1 hour post-migration)
```bash
# Stop live services
docker-compose -f /opt/live-monitoring/docker-compose.yml down

# Restore database from snapshot
PGPASSWORD="$ADMIN_DB_PASSWORD" pg_restore -h "$ADMIN_DB_HOST" -U "$ADMIN_DB_USER" -d "$ADMIN_DB_NAME" /var/admin-migration/rollback/pre-migration-*/admin-database.dump

# Restore Redis from backup
redis-cli -h "$ADMIN_REDIS_HOST" -p "$ADMIN_REDIS_PORT" --rdb /var/admin-migration/rollback/pre-migration-*/admin-redis.rdb

# Start admin services
docker-compose -f /opt/admin-monitoring/docker-compose.yml up -d
```

## Post-Migration Tasks

### Immediate (First 24 Hours)
1. **Monitor System Performance**
   ```bash
   # Check error rates
   curl "http://live-prometheus:9090/api/v1/query?query=sum(rate(http_requests_total{status=~'5..'}[5m]))/sum(rate(http_requests_total[5m]))*100"
   
   # Check response times
   curl "http://live-prometheus:9090/api/v1/query?query=histogram_quantile(0.95,sum(rate(http_request_duration_seconds_bucket[5m]))by(le))"
   ```

2. **Validate Swedish Pilot Operations**
   ```bash
   # Test Swedish pilot business operations
   curl -X POST "http://live-api:3000/api/feedback/sessions" \
     -H "Content-Type: application/json" \
     -d '{"business_id":"swedish-pilot-business-1","transaction_id":"TEST-12345"}'
   ```

3. **Confirm Compliance Reporting**
   ```bash
   # Check GDPR compliance reports
   curl "http://live-api:3000/api/compliance/gdpr/reports/status"
   
   # Check Finansinspektionen reporting
   curl "http://live-api:3000/api/compliance/fi-report/status"
   ```

### Weekly Tasks
1. **Performance Optimization**
   - Review monitoring dashboards
   - Adjust alert thresholds
   - Optimize database queries
   - Review resource utilization

2. **Security Review**
   - Review access logs
   - Update SSL certificates if needed
   - Validate authentication systems
   - Check for security updates

3. **Compliance Validation**
   - Review GDPR compliance metrics
   - Validate Finansinspektionen reports
   - Check data retention policies
   - Verify audit log integrity

### Monthly Tasks
1. **System Health Review**
   - Analyze performance trends
   - Review capacity planning
   - Update disaster recovery procedures
   - Test backup and restore procedures

2. **Compliance Audit**
   - Generate monthly compliance reports
   - Review data processing activities
   - Update privacy impact assessments
   - Validate data residency compliance

## Support and Escalation

### Support Contacts
- **Operations Team:** ops-team@ai-feedback.se
- **Swedish Pilot Team:** swedish-pilot-team@ai-feedback.se  
- **Compliance Officer:** compliance@ai-feedback.se
- **Security Team:** security-team@ai-feedback.se

### Escalation Procedures

#### Severity 1 (Critical System Down)
1. Contact on-call engineer: +46-XXX-XXX-XXX
2. Create incident in monitoring system
3. Execute emergency rollback if needed
4. Notify Swedish pilot team immediately

#### Severity 2 (Major Impact)
1. Create support ticket in system
2. Notify relevant team leads
3. Begin troubleshooting procedures
4. Update stakeholders every 30 minutes

#### Severity 3 (Minor Impact)
1. Create support ticket
2. Follow standard troubleshooting
3. Update during business hours

## Migration Checklist

### Pre-Migration
- [ ] Environment variables configured
- [ ] All required software installed
- [ ] Admin system health verified
- [ ] Live environment prepared
- [ ] Backup integrity confirmed
- [ ] Team notifications sent
- [ ] Rollback procedures tested

### During Migration
- [ ] Phase 1: Pre-validation completed
- [ ] Phase 2: Data migration completed
- [ ] Phase 3: Service migration completed
- [ ] Phase 4: Configuration migration completed
- [ ] Phase 5: Validation and rollback prep completed
- [ ] Phase 6: DNS cutover completed
- [ ] Phase 7: Post-migration validation completed

### Post-Migration
- [ ] Final migration report reviewed
- [ ] System performance validated
- [ ] Swedish compliance confirmed
- [ ] Team training completed
- [ ] Documentation updated
- [ ] Admin system decommissioning scheduled
- [ ] Go-live communication sent

## Appendix

### Migration Timeline Template
```
Day -7: Pre-migration preparations begin
Day -3: Final environment setup and testing
Day -1: Team briefing and final preparations
Day 0: Migration execution (estimated 4-6 hours)
Day +1: Post-migration monitoring and validation
Day +7: Performance review and optimization
Day +30: Admin system decommissioning
```

### Key Metrics to Monitor
- **System Uptime:** Target >99.9%
- **API Response Time:** Target <500ms
- **Error Rate:** Target <1%
- **Database Performance:** Target <100ms query time
- **Swedish Pilot Success Rate:** Target >95%

### Emergency Rollback Decision Matrix
| Scenario | Time Since Migration | Action |
|----------|---------------------|---------|
| Critical service failure | <1 hour | Automated rollback |
| Data integrity issues | <2 hours | Manual data rollback |
| Performance degradation | >2 hours | Troubleshoot first, rollback if needed |
| Minor issues | Any time | Fix forward |

This migration guide ensures a systematic, well-documented approach to transitioning from admin to live environment while maintaining all Swedish compliance requirements and system integrity.