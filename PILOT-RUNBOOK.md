# 🇸🇪 Swedish Pilot Program - Deployment Runbook

## Overview
This runbook covers the complete deployment and operational procedures for the Swedish café pilot program, targeting 3 pilot locations with enhanced monitoring and support.

## 🎯 Pilot Program Details

### Target Cafés
1. **Café Aurora** (Stockholm)
   - Domain: `aurora.feedbackai.se`
   - Expected volume: 50-100 feedbacks/day
   - Peak hours: 7-9 AM, 12-2 PM

2. **Malmö Huset** (Malmö)
   - Domain: `malmohuset.feedbackai.se`
   - Expected volume: 30-60 feedbacks/day
   - Peak hours: 8-10 AM, 2-4 PM

3. **Göteborg Café** (Göteborg)
   - Domain: `goteborg.feedbackai.se`
   - Expected volume: 40-80 feedbacks/day
   - Peak hours: 7:30-9:30 AM, 1-3 PM

### Success Metrics
- **Customer Participation**: >10% of daily customers
- **Feedback Completion Rate**: >70%
- **Voice Response Time**: <2 seconds (95th percentile)
- **System Uptime**: >99.5%
- **Payment Success Rate**: >98%

---

## 📋 Pre-Deployment Checklist

### Infrastructure Preparation
- [ ] Server provisioned (minimum 8GB RAM, 4 cores, 100GB SSD)
- [ ] Docker & Docker Compose installed
- [ ] SSL certificates configured for all domains
- [ ] DNS records propagated and verified
- [ ] Firewall configured (ports 80, 443, 22)
- [ ] Backup storage configured

### Service Dependencies
- [ ] Supabase project configured with Swedish locale
- [ ] Stripe Connect account approved for Swedish market
- [ ] Redis instance available (managed or Docker)
- [ ] Ollama service running with Llama 3.2 model
- [ ] Monitoring stack configured (Prometheus, Grafana, Loki)

### Business Setup
- [ ] 3 pilot businesses registered in system
- [ ] QR codes generated and printed for each location
- [ ] Business contexts configured (layouts, staff, specialties)
- [ ] Trial limits set (100 feedbacks per business)
- [ ] Business portal accounts created and tested

### Team Preparation
- [ ] Support team trained on pilot-specific procedures
- [ ] Emergency contact list shared with café managers
- [ ] Monitoring dashboard access configured
- [ ] Incident response procedures documented

---

## 🚀 Deployment Procedure

### Step 1: Infrastructure Setup
```bash
# 1. Clone repository and navigate to project directory
git clone https://github.com/your-org/ai-feedback-platform.git
cd ai-feedback-platform

# 2. Configure environment for staging
cp .env.production .env.staging
# Edit .env.staging with pilot-specific values

# 3. Set up pilot domains and SSL certificates
./scripts/setup-pilot-domains.sh

# 4. Verify domain accessibility
./scripts/verify-pilot-domains.sh
```

### Step 2: Service Deployment
```bash
# 1. Build and start staging environment
docker-compose -f docker-compose.staging.yml build --no-cache
docker-compose -f docker-compose.staging.yml up -d

# 2. Wait for all services to be healthy
sleep 120

# 3. Verify all services are running
./scripts/health-check.sh staging

# 4. Run pilot-specific smoke tests
./scripts/pilot-smoke-tests.sh
```

### Step 3: Pilot Configuration
```bash
# 1. Seed pilot business data
docker-compose -f docker-compose.staging.yml exec api-gateway npm run seed:pilot-businesses

# 2. Configure business contexts
./scripts/configure-pilot-businesses.sh

# 3. Generate and distribute QR codes
./scripts/generate-pilot-qr-codes.sh

# 4. Set up monitoring alerts
./scripts/setup-pilot-alerts.sh
```

### Step 4: Validation Testing
```bash
# 1. Test complete feedback journey for each café
./scripts/test-feedback-journey.sh aurora
./scripts/test-feedback-journey.sh malmohuset  
./scripts/test-feedback-journey.sh goteborg

# 2. Load test voice processing
./scripts/load-test-voice.sh --concurrent=10 --duration=300s

# 3. Validate payment processing
./scripts/test-stripe-payments.sh

# 4. Test business dashboard functionality
./scripts/test-business-analytics.sh
```

---

## 📊 Monitoring & Alerting

### Key Dashboards
1. **Pilot Overview Dashboard**: `https://staging.feedbackai.se:3100/d/pilot-overview`
2. **Business KPIs Dashboard**: `https://staging.feedbackai.se:3100/d/business-kpis`
3. **Technical Performance**: `https://staging.feedbackai.se:3100/d/system-metrics`
4. **Voice Quality Metrics**: `https://staging.feedbackai.se:3100/d/voice-analytics`

### Critical Alerts

#### High Priority (Immediate Response)
- Voice response time > 3 seconds (5 consecutive measurements)
- System error rate > 5% (1-minute window)
- Payment processing failure rate > 2%
- Any service down for > 2 minutes

#### Medium Priority (Response within 1 hour)
- Quality score average < 65 for any café
- Customer participation rate < 8% for any café
- Database connection issues
- SSL certificate expiring within 7 days

#### Low Priority (Response within 4 hours)
- Disk space > 80% utilization
- Memory usage > 85%
- Feedback volume anomalies
- Business dashboard slow response times

### Alert Channels
- **Slack**: `#pilot-program-alerts`
- **Email**: `pilot-support@yourcompany.com`
- **SMS**: Critical alerts only (system down, payment failures)
- **PagerDuty**: After-hours escalation

---

## 🛠️ Operational Procedures

### Daily Operations Checklist
```bash
# Morning checklist (8:00 AM CET)
./scripts/daily-health-check.sh
./scripts/check-pilot-metrics.sh
./scripts/verify-certificates.sh

# Review overnight activity
docker-compose -f docker-compose.staging.yml logs --since="24h" | grep ERROR
```

### Weekly Maintenance
```bash
# Every Sunday 2:00 AM CET
./scripts/weekly-maintenance.sh
# - Update system packages
# - Rotate logs
# - Backup verification
# - Performance analysis report
```

### Business Hour Support (8 AM - 6 PM CET)

#### Level 1 Support (Café Staff Issues)
**Common Issues:**
1. **QR Code Not Working**
   - Check: Is café's internet working?
   - Check: Is QR code visible and clean?
   - Solution: Refresh QR code or provide direct link

2. **Customer Can't Complete Feedback**
   - Check: Voice permissions granted?
   - Check: Browser compatibility (recommend Chrome/Safari)
   - Solution: Guide through permission setup

3. **Payment Not Received**
   - Check: Feedback actually completed (score > 60)?
   - Check: Payment processing status in admin dashboard
   - Solution: Manual payment trigger if needed

#### Level 2 Support (Technical Issues)
**Response Time:** 30 minutes during business hours

1. **System Performance Issues**
   ```bash
   # Check system resources
   docker stats
   
   # Check specific service health
   ./scripts/health-check.sh staging
   
   # Review recent errors
   docker-compose -f docker-compose.staging.yml logs --tail=100 api-gateway
   ```

2. **Voice Processing Issues**
   ```bash
   # Check Ollama service status
   docker-compose -f docker-compose.staging.yml exec api-gateway curl -f http://ollama:11434/api/version
   
   # Test voice pipeline
   ./scripts/test-voice-pipeline.sh
   
   # Check WebSocket connections
   docker-compose -f docker-compose.staging.yml logs nginx | grep "websocket"
   ```

3. **Database Performance Issues**
   ```bash
   # Check database connections
   docker-compose -f docker-compose.staging.yml exec api-gateway npm run db:status
   
   # Monitor query performance
   # Access Supabase dashboard for query analysis
   ```

#### Level 3 Support (Critical System Issues)
**Response Time:** 15 minutes, 24/7

**Escalation Triggers:**
- System completely down
- Payment processing broken
- Data corruption suspected
- Security incident

**Incident Response:**
1. **Immediate Actions**
   ```bash
   # Capture system state
   ./scripts/capture-incident-data.sh
   
   # Scale up resources if needed
   docker-compose -f docker-compose.staging.yml up -d --scale api-gateway=2
   
   # Switch to fallback configuration
   ./scripts/enable-fallback-mode.sh
   ```

2. **Communication**
   - Post in `#incident-response` Slack channel
   - Notify café managers via SMS if system will be down >15 minutes
   - Update status page

3. **Resolution**
   - Follow incident response playbook
   - Document root cause analysis
   - Plan prevention measures

---

## 🔄 Backup & Recovery

### Automated Backups
- **Database**: Every 6 hours via Supabase
- **Application Data**: Daily at 2 AM CET
- **Configuration Files**: Daily at 3 AM CET
- **Logs**: Retained for 30 days

### Backup Verification
```bash
# Weekly backup verification
./scripts/verify-backups.sh

# Test restore procedure (monthly)
./scripts/test-restore.sh --dry-run
```

### Disaster Recovery Procedures

#### Scenario 1: Single Service Failure
```bash
# Restart failed service
docker-compose -f docker-compose.staging.yml restart [service-name]

# If restart fails, rebuild and restart
docker-compose -f docker-compose.staging.yml up -d --build [service-name]
```

#### Scenario 2: Database Corruption/Loss
```bash
# 1. Stop application services
docker-compose -f docker-compose.staging.yml stop api-gateway business-dashboard

# 2. Restore from Supabase backup
# Follow Supabase restoration procedure

# 3. Verify data integrity
./scripts/verify-data-integrity.sh

# 4. Restart services
docker-compose -f docker-compose.staging.yml start api-gateway business-dashboard
```

#### Scenario 3: Complete System Failure
```bash
# 1. Provision new server
# 2. Run full deployment procedure
./scripts/deploy-staging.sh

# 3. Restore from backups
./scripts/restore-from-backup.sh --date=latest

# 4. Update DNS if server IP changed
# 5. Verify all services operational
```

**Recovery Time Objectives:**
- Single service: < 5 minutes
- Database issues: < 30 minutes  
- Complete system rebuild: < 2 hours

---

## 📈 Scaling Procedures

### Automatic Scaling Triggers
- CPU usage > 80% for 5 minutes
- Memory usage > 85% for 5 minutes
- Response time > 2 seconds (95th percentile)
- Queue depth > 100 pending requests

### Manual Scaling
```bash
# Scale up API Gateway
docker-compose -f docker-compose.staging.yml up -d --scale api-gateway=2

# Scale up Business Dashboard for analytics load
docker-compose -f docker-compose.staging.yml up -d --scale business-dashboard=2

# Switch to full scale configuration
docker-compose -f docker-compose.scale.yml up -d
```

### Performance Optimization
```bash
# Enable caching optimizations
./scripts/enable-performance-mode.sh

# Optimize database queries
./scripts/optimize-database.sh

# Configure CDN (if needed)
./scripts/setup-cdn.sh
```

---

## 📞 Contact Information

### Primary Contacts
- **Pilot Program Manager**: +46 70 XXX XXXX
- **Technical Lead**: +46 70 XXX XXXX  
- **DevOps Engineer**: +46 70 XXX XXXX

### Café Emergency Contacts
- **Café Aurora**: +46 8 XXX XXXX
- **Malmö Huset**: +46 40 XXX XXXX
- **Göteborg Café**: +46 31 XXX XXXX

### External Service Contacts
- **Supabase Support**: Via dashboard or email
- **Stripe Support**: Via dashboard (Swedish support available)
- **DNS Provider**: Contact details in DNS management portal

---

## 📋 Post-Pilot Procedures

### Success Evaluation (After 30 Days)
```bash
# Generate pilot success report
./scripts/generate-pilot-report.sh --period=30-days

# Analyze business impact
./scripts/analyze-business-impact.sh

# Collect café feedback
./scripts/collect-cafe-feedback.sh
```

### Expansion Planning
- Review capacity requirements for additional cafés
- Analyze geographic expansion opportunities
- Plan infrastructure scaling for full launch
- Evaluate feature enhancement priorities

### Knowledge Transfer
- Document lessons learned
- Update operational procedures
- Train support team on identified patterns
- Refine monitoring and alerting thresholds

---

## 🔍 Troubleshooting Quick Reference

### Common Issues & Solutions

| Issue | Symptoms | Quick Fix | Prevention |
|-------|----------|-----------|------------|
| Voice timeout | Users report "no response" | Restart Ollama service | Monitor model loading time |
| Payment delays | Rewards not appearing | Check Stripe webhook logs | Monitor webhook delivery |
| QR scan failures | "Invalid QR code" errors | Regenerate QR codes | Regular QR code validation |
| Dashboard slow | Analytics loading >30s | Restart business-dashboard | Optimize query caching |
| SSL warnings | Certificate errors in browser | Renew SSL certificates | Automated renewal setup |

### Emergency Commands
```bash
# Emergency system restart
./scripts/emergency-restart.sh

# Enable maintenance mode
./scripts/maintenance-mode.sh --enable

# Disable pilot temporarily
./scripts/disable-pilot.sh --reason="maintenance"

# Emergency scale up
./scripts/emergency-scale.sh --instances=3
```

---

This runbook should be reviewed and updated after each incident and at least monthly during the pilot program. All procedures should be tested regularly in a staging environment to ensure they work when needed in production.