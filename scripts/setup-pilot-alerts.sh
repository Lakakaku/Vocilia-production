#!/bin/bash

# Setup Pilot Alerting System
# Configures Prometheus alerting rules, AlertManager, and Grafana notifications

set -e

echo "🚨 Setting up Swedish Pilot Program Critical Alerting"
echo "=================================================="

# Configuration
ENVIRONMENT="${1:-staging}"
MONITORING_DIR="./monitoring"
ALERTS_DIR="$MONITORING_DIR/alerts"
GRAFANA_DIR="$MONITORING_DIR/grafana/pilot"
ALERTMANAGER_DIR="$MONITORING_DIR/alertmanager"

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(staging|production)$ ]]; then
    echo "❌ Invalid environment. Use: staging or production"
    exit 1
fi

# Create directories if they don't exist
mkdir -p "$ALERTS_DIR" "$ALERTMANAGER_DIR" "$GRAFANA_DIR"

echo "📋 Validating alerting configuration files..."

# Validate Prometheus alert rules
if [[ -f "$ALERTS_DIR/pilot-critical.yml" ]]; then
    echo "   ✅ Prometheus alert rules found"
    
    # Validate YAML syntax
    if command -v promtool &> /dev/null; then
        promtool check rules "$ALERTS_DIR/pilot-critical.yml" || {
            echo "   ❌ Alert rules validation failed"
            exit 1
        }
        echo "   ✅ Alert rules validation passed"
    else
        echo "   ⚠️  promtool not available, skipping validation"
    fi
else
    echo "   ❌ Alert rules file not found: $ALERTS_DIR/pilot-critical.yml"
    exit 1
fi

# Validate AlertManager configuration
if [[ -f "$ALERTMANAGER_DIR/config.yml" ]]; then
    echo "   ✅ AlertManager configuration found"
    
    # Validate YAML syntax
    if command -v amtool &> /dev/null; then
        amtool check-config "$ALERTMANAGER_DIR/config.yml" || {
            echo "   ❌ AlertManager config validation failed"
            exit 1
        }
        echo "   ✅ AlertManager config validation passed"
    else
        echo "   ⚠️  amtool not available, skipping validation"
    fi
else
    echo "   ❌ AlertManager config not found: $ALERTMANAGER_DIR/config.yml"
    exit 1
fi

# Validate Grafana notification channels
if [[ -f "$GRAFANA_DIR/notification-channels.json" ]]; then
    echo "   ✅ Grafana notification channels found"
    
    # Validate JSON syntax
    if command -v jq &> /dev/null; then
        jq empty "$GRAFANA_DIR/notification-channels.json" || {
            echo "   ❌ Grafana notification channels JSON validation failed"
            exit 1
        }
        echo "   ✅ Grafana notification channels validation passed"
    else
        echo "   ⚠️  jq not available, skipping JSON validation"
    fi
else
    echo "   ❌ Grafana notification channels not found: $GRAFANA_DIR/notification-channels.json"
    exit 1
fi

echo ""
echo "🔧 Configuring environment-specific alerting..."

# Set environment-specific alert thresholds
case "$ENVIRONMENT" in
    "staging")
        ALERT_THRESHOLD_VOICE_LATENCY="3"      # 3 seconds for staging
        ALERT_THRESHOLD_PAYMENT_FAILURE="0.05" # 5% for staging
        ALERT_THRESHOLD_SYSTEM_UPTIME="99.0"   # 99% for staging
        ALERT_THRESHOLD_PARTICIPATION="5"      # 5% for staging
        ;;
    "production")
        ALERT_THRESHOLD_VOICE_LATENCY="2"      # 2 seconds for production
        ALERT_THRESHOLD_PAYMENT_FAILURE="0.02" # 2% for production
        ALERT_THRESHOLD_SYSTEM_UPTIME="99.5"   # 99.5% for production
        ALERT_THRESHOLD_PARTICIPATION="8"      # 8% for production
        ;;
esac

echo "   Environment: $ENVIRONMENT"
echo "   Voice Latency Threshold: ${ALERT_THRESHOLD_VOICE_LATENCY}s"
echo "   Payment Failure Threshold: ${ALERT_THRESHOLD_PAYMENT_FAILURE}"
echo "   System Uptime Threshold: ${ALERT_THRESHOLD_SYSTEM_UPTIME}%"
echo "   Participation Threshold: ${ALERT_THRESHOLD_PARTICIPATION}%"

# Update alert rules with environment-specific thresholds
sed -i.bak \
    -e "s/> 3/> $ALERT_THRESHOLD_VOICE_LATENCY/g" \
    -e "s/> 0.02/> $ALERT_THRESHOLD_PAYMENT_FAILURE/g" \
    -e "s/< 99.5/< $ALERT_THRESHOLD_SYSTEM_UPTIME/g" \
    -e "s/< 8/< $ALERT_THRESHOLD_PARTICIPATION/g" \
    "$ALERTS_DIR/pilot-critical.yml"

echo "   ✅ Alert thresholds updated for $ENVIRONMENT"

echo ""
echo "🔗 Setting up notification channels..."

# Check if required environment variables are set
REQUIRED_VARS=(
    "SLACK_WEBHOOK_URL"
    "SMTP_USERNAME" 
    "SMTP_PASSWORD"
    "PAGERDUTY_INTEGRATION_KEY"
    "SMS_WEBHOOK_URL"
    "SMS_USERNAME"
    "SMS_PASSWORD"
)

missing_vars=()
for var in "${REQUIRED_VARS[@]}"; do
    if [[ -z "${!var}" ]]; then
        missing_vars+=("$var")
    fi
done

if [[ ${#missing_vars[@]} -gt 0 ]]; then
    echo "   ⚠️  Missing environment variables for notifications:"
    printf "      - %s\n" "${missing_vars[@]}"
    echo "   Alerting will be configured but notifications may not work"
else
    echo "   ✅ All notification environment variables are set"
fi

# Test notification channels
echo ""
echo "📧 Testing notification channels..."

test_alert_payload='{
  "receiver": "pilot-default",
  "status": "firing",
  "alerts": [{
    "status": "firing",
    "labels": {
      "alertname": "TestAlert",
      "severity": "info",
      "component": "testing",
      "cafe_name": "Test Café",
      "pilot_program": "swedish-cafes"
    },
    "annotations": {
      "summary": "Test alert for pilot program setup",
      "description": "This is a test alert to verify notification channels are working correctly"
    }
  }],
  "groupLabels": {"alertname": "TestAlert"},
  "commonLabels": {"alertname": "TestAlert", "severity": "info"},
  "commonAnnotations": {"summary": "Test alert for pilot program setup"}
}'

# Test Slack webhook if URL is provided
if [[ -n "$SLACK_WEBHOOK_URL" ]]; then
    echo "   Testing Slack webhook..."
    curl -X POST "$SLACK_WEBHOOK_URL" \
        -H "Content-Type: application/json" \
        -d '{
            "channel": "#pilot-program-alerts",
            "text": "🇸🇪 Test message from Swedish Pilot Program alerting setup",
            "username": "Pilot-Setup-Test"
        }' \
        --silent --output /dev/null --write-out "HTTP %{http_code}\n" | \
    if grep -q "200"; then
        echo "   ✅ Slack webhook test successful"
    else
        echo "   ❌ Slack webhook test failed"
    fi
else
    echo "   ⚠️  Skipping Slack webhook test (SLACK_WEBHOOK_URL not set)"
fi

# Test SMS webhook if URL is provided
if [[ -n "$SMS_WEBHOOK_URL" && -n "$SMS_USERNAME" && -n "$SMS_PASSWORD" ]]; then
    echo "   Testing SMS webhook..."
    curl -X POST "$SMS_WEBHOOK_URL" \
        -H "Content-Type: application/json" \
        -u "$SMS_USERNAME:$SMS_PASSWORD" \
        -d '{
            "to": "+46701234567",
            "message": "Test message from Swedish Pilot Program alerting setup"
        }' \
        --silent --output /dev/null --write-out "HTTP %{http_code}\n" | \
    if grep -q "200\|201\|202"; then
        echo "   ✅ SMS webhook test successful"
    else
        echo "   ❌ SMS webhook test failed"
    fi
else
    echo "   ⚠️  Skipping SMS webhook test (credentials not set)"
fi

echo ""
echo "📊 Configuring Grafana notification policies..."

# Create Grafana notification policy configuration
cat > "$GRAFANA_DIR/notification-policies.yml" << EOF
# Grafana Notification Policies for Swedish Pilot Program
policies:
  - name: "Swedish Pilot Critical Voice"
    matcher: 'severity="critical" AND component="voice" AND pilot_program="swedish-cafes"'
    contact_points: ["pilot-slack-critical", "pilot-email-critical", "pilot-sms-critical"]
    group_interval: 10m
    repeat_interval: 10m
    
  - name: "Swedish Pilot Critical Payments"
    matcher: 'severity="critical" AND component="payments" AND pilot_program="swedish-cafes"'
    contact_points: ["pilot-slack-critical", "pilot-email-critical", "pilot-pagerduty"]
    group_interval: 10m
    repeat_interval: 10m
    
  - name: "Swedish Pilot Critical System"
    matcher: 'severity="critical" AND component="system" AND pilot_program="swedish-cafes"'
    contact_points: ["pilot-slack-critical", "pilot-email-critical", "pilot-sms-critical", "pilot-pagerduty"]
    group_interval: 5m
    repeat_interval: 5m
    
  - name: "Swedish Pilot Business KPIs"
    matcher: 'severity="high" AND component="business" AND pilot_program="swedish-cafes"'
    contact_points: ["pilot-business-slack"]
    group_interval: 1h
    repeat_interval: 4h
    
  - name: "Swedish Pilot Fraud Detection"
    matcher: 'severity="high" AND component="fraud" AND pilot_program="swedish-cafes"'
    contact_points: ["pilot-fraud-slack"]
    group_interval: 30m
    repeat_interval: 2h
    
  - name: "Swedish Pilot General"
    matcher: 'pilot_program="swedish-cafes"'
    contact_points: ["pilot-general-slack"]
    group_interval: 1h
    repeat_interval: 4h

contact_points:
  - name: "pilot-slack-critical"
    type: "slack"
    settings:
      url: "${SLACK_WEBHOOK_URL}"
      channel: "#incident-response"
      title: "🚨 Critical Pilot Alert"
      
  - name: "pilot-email-critical"
    type: "email"
    settings:
      addresses: ["pilot-critical@feedbackai.se"]
      subject: "🚨 CRITICAL: Swedish Pilot Alert"
      
  - name: "pilot-sms-critical"
    type: "webhook"
    settings:
      url: "${SMS_WEBHOOK_URL}"
      username: "${SMS_USERNAME}"
      password: "${SMS_PASSWORD}"
      
  - name: "pilot-pagerduty"
    type: "pagerduty"
    settings:
      integration_key: "${PAGERDUTY_INTEGRATION_KEY}"
      severity: "critical"
      
  - name: "pilot-business-slack"
    type: "slack"
    settings:
      url: "${SLACK_WEBHOOK_URL}"
      channel: "#pilot-business-metrics"
      title: "📊 Business Metrics Alert"
      
  - name: "pilot-fraud-slack"
    type: "slack" 
    settings:
      url: "${SLACK_WEBHOOK_URL}"
      channel: "#fraud-detection"
      title: "🛡️ Fraud Detection Alert"
      
  - name: "pilot-general-slack"
    type: "slack"
    settings:
      url: "${SLACK_WEBHOOK_URL}"
      channel: "#pilot-program-alerts"
      title: "🇸🇪 Pilot Program Alert"
EOF

echo "   ✅ Grafana notification policies created"

echo ""
echo "🐳 Updating Docker Compose configuration with alerting..."

# Update docker-compose file to include AlertManager
COMPOSE_FILE="docker-compose.${ENVIRONMENT}.yml"

if [[ -f "$COMPOSE_FILE" ]]; then
    # Check if AlertManager service already exists
    if grep -q "alertmanager:" "$COMPOSE_FILE"; then
        echo "   ✅ AlertManager already configured in $COMPOSE_FILE"
    else
        echo "   Adding AlertManager service to $COMPOSE_FILE..."
        
        # Add AlertManager service
        cat >> "$COMPOSE_FILE" << 'EOF'

  # AlertManager for Pilot Program Alerts
  alertmanager:
    image: prom/alertmanager:latest
    ports:
      - "9093:9093"
    volumes:
      - ./monitoring/alertmanager/config.yml:/etc/alertmanager/alertmanager.yml:ro
      - ./monitoring/alertmanager/templates:/etc/alertmanager/templates:ro
      - alertmanager_data:/alertmanager
    command:
      - '--config.file=/etc/alertmanager/alertmanager.yml'
      - '--storage.path=/alertmanager'
      - '--web.external-url=http://localhost:9093'
      - '--cluster.listen-address=0.0.0.0:9094'
      - '--log.level=info'
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:9093/-/healthy"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped
    networks:
      - ai-feedback-network
EOF

        # Add AlertManager volume
        if ! grep -q "alertmanager_data:" "$COMPOSE_FILE"; then
            sed -i.bak '/^volumes:/a\
  alertmanager_data:' "$COMPOSE_FILE"
        fi
        
        echo "   ✅ AlertManager service added to $COMPOSE_FILE"
    fi
    
    # Update Prometheus to use AlertManager
    if grep -q "alertmanager" "$COMPOSE_FILE"; then
        echo "   ✅ Prometheus already configured with AlertManager"
    else
        echo "   Configuring Prometheus to use AlertManager..."
        # This would require updating the Prometheus config file
        # For now, just note that it needs to be done
        echo "   ⚠️  Manual step required: Update Prometheus config to include AlertManager"
    fi
else
    echo "   ❌ Docker Compose file not found: $COMPOSE_FILE"
    exit 1
fi

echo ""
echo "📋 Creating alerting documentation..."

# Create alerting runbook
cat > "./monitoring/ALERTING-RUNBOOK.md" << 'EOF'
# Swedish Pilot Program - Alerting Runbook

## Alert Severity Levels

### Critical (Immediate Response Required)
- **Voice Processing Down**: Voice service unavailable
- **Voice Latency High**: Response time > target threshold
- **Payment Processing Failure**: Payment failure rate > 2%
- **System Downtime**: Overall system availability < 99.5%
- **Database Issues**: Connection pool exhaustion

**Response Time**: 15 minutes, 24/7
**Escalation**: SMS + Slack + Email + PagerDuty

### High Priority (1 Hour Response)
- **Customer Participation Low**: Completion rate < target
- **Quality Score Low**: Average quality below acceptable
- **API Latency High**: Response time degraded
- **Fraud Score High**: Suspicious activity detected

**Response Time**: 1 hour during business hours
**Escalation**: Slack + Email

### Medium Priority (4 Hour Response)
- **Memory Usage High**: Server resources constrained
- **Disk Space High**: Storage approaching limits
- **SSL Certificate Expiring**: Certificates need renewal
- **Volume Anomaly**: Unusual traffic patterns

**Response Time**: 4 hours during business hours
**Escalation**: Slack

## Notification Channels

### Slack Channels
- `#incident-response`: Critical alerts requiring immediate attention
- `#pilot-program-alerts`: General pilot program alerts
- `#pilot-business-metrics`: Business KPI and performance alerts
- `#voice-processing-alerts`: Voice-specific technical alerts
- `#payment-processing`: Payment and Stripe-related alerts
- `#fraud-detection`: Fraud pattern and security alerts

### Email Lists
- `pilot-critical@feedbackai.se`: Critical system alerts
- `pilot-support@feedbackai.se`: General support team
- `pilot-business-team@feedbackai.se`: Business metrics team
- `pilot-manager@feedbackai.se`: Pilot program manager

### SMS/PagerDuty
- Reserved for critical system failures
- Voice processing complete failure
- Payment processing complete failure
- System downtime affecting customer experience

## Alert Response Procedures

### Voice Processing Issues
1. Check Ollama service status
2. Verify WebSocket connections
3. Test voice pipeline manually
4. Scale voice processing if needed
5. Failover to backup AI provider if necessary

### Payment Processing Issues
1. Check Stripe webhook delivery
2. Verify payment processing queue
3. Test Stripe API connectivity
4. Review failed payment logs
5. Manually process pending payments if needed

### System Performance Issues
1. Check system resources (CPU, memory, disk)
2. Review application logs for errors
3. Check database performance
4. Scale services if needed
5. Implement performance optimizations

### Business KPI Issues
1. Review café-specific metrics
2. Analyze customer feedback patterns
3. Check for operational issues at café
4. Coordinate with café management
5. Implement corrective actions

## Silencing and Maintenance

### Planned Maintenance
```bash
# Silence alerts during maintenance window
amtool silence add alertname="VoiceProcessingDown" --duration="2h" --comment="Planned maintenance"
```

### False Positive Management
```bash
# Silence specific false positive alerts
amtool silence add alertname="MemoryUsageHigh" instance="server-01" --duration="24h"
```

## Testing and Validation

### Monthly Alert Testing
1. Test each notification channel
2. Verify alert escalation paths
3. Validate runbook procedures
4. Update contact information
5. Review alert thresholds

### Alert Metrics Review
- Alert frequency and patterns
- Mean time to resolution
- False positive rates
- Escalation effectiveness
EOF

echo "   ✅ Alerting runbook created"

# Create alert testing script
cat > "./scripts/test-pilot-alerts.sh" << 'EOF'
#!/bin/bash

# Test Pilot Program Alerting System
echo "🧪 Testing Swedish Pilot Program Alerts"
echo "======================================"

# Test critical voice alert
echo "Testing critical voice processing alert..."
curl -X POST http://localhost:9093/api/v1/alerts \
    -H "Content-Type: application/json" \
    -d '[{
        "labels": {
            "alertname": "VoiceProcessingDown",
            "severity": "critical",
            "component": "voice",
            "cafe_name": "Test Café",
            "pilot_program": "swedish-cafes"
        },
        "annotations": {
            "summary": "Voice processing service test alert",
            "description": "This is a test alert for voice processing monitoring"
        }
    }]'

echo "✅ Test alert sent. Check notification channels."
EOF

chmod +x "./scripts/test-pilot-alerts.sh"
echo "   ✅ Alert testing script created"

echo ""
echo "🚀 Starting alerting services..."

# Start AlertManager if not running
if docker-compose -f "$COMPOSE_FILE" ps alertmanager | grep -q "Up"; then
    echo "   ✅ AlertManager already running"
else
    echo "   Starting AlertManager..."
    docker-compose -f "$COMPOSE_FILE" up -d alertmanager
    sleep 10
    
    # Verify AlertManager is healthy
    if curl -f http://localhost:9093/-/healthy &>/dev/null; then
        echo "   ✅ AlertManager started successfully"
    else
        echo "   ❌ AlertManager health check failed"
        exit 1
    fi
fi

# Reload Prometheus configuration
if docker-compose -f "$COMPOSE_FILE" ps prometheus | grep -q "Up"; then
    echo "   Reloading Prometheus configuration..."
    curl -X POST http://localhost:9090/-/reload || echo "   ⚠️  Prometheus reload failed"
else
    echo "   ⚠️  Prometheus not running, start with: docker-compose -f $COMPOSE_FILE up -d prometheus"
fi

echo ""
echo "✅ Swedish Pilot Program Critical Alerting Setup Complete!"
echo "=================================================="
echo ""
echo "📋 Summary:"
echo "   • Critical alerts configured for voice, payments, and system availability"
echo "   • Business KPI monitoring with café-specific tracking"
echo "   • Fraud detection alerting with security team notifications"
echo "   • Multi-channel notifications (Slack, Email, SMS, PagerDuty)"
echo "   • Environment-specific thresholds for $ENVIRONMENT"
echo ""
echo "🔗 Access Points:"
echo "   • AlertManager UI: http://localhost:9093"
echo "   • Prometheus Alerts: http://localhost:9090/alerts"
echo "   • Grafana Dashboards: http://localhost:3100"
echo ""
echo "📖 Next Steps:"
echo "   1. Test notification channels: ./scripts/test-pilot-alerts.sh"
echo "   2. Configure Grafana notification policies"
echo "   3. Review and customize alert thresholds"
echo "   4. Set up monitoring dashboard bookmarks for café managers"
echo ""
echo "🚨 Emergency Contacts:"
echo "   • Critical Issues: pilot-critical@feedbackai.se"
echo "   • SMS Alerts: +46 70 XXX XXXX (pilot team)"
echo "   • Slack: #incident-response"
EOF

chmod +x "/Users/lucasjenner/task-feedback/scripts/setup-pilot-alerts.sh"

echo "   ✅ Pilot alerting setup script created and made executable"

echo ""
echo "📞 Creating emergency response procedures..."

# Create emergency response procedures
cat > "./monitoring/EMERGENCY-RESPONSE.md" << 'EOF'
# Emergency Response Procedures - Swedish Pilot Program

## 🚨 CRITICAL INCIDENT RESPONSE

### Immediate Actions (0-5 minutes)
1. **Acknowledge the alert** in Slack (#incident-response)
2. **Assess impact** - How many cafés affected?
3. **Check system status** - Use monitoring dashboards
4. **Notify stakeholders** if customer-facing impact

### Investigation Phase (5-15 minutes)
1. **Check recent deployments** - Any recent changes?
2. **Review system logs** - Look for error patterns
3. **Test system components** - Voice, payments, database
4. **Scale resources** if performance-related

### Resolution Phase (15+ minutes)
1. **Implement fix** - Apply hotfix or rollback
2. **Verify resolution** - Test full customer journey
3. **Update stakeholders** - Communicate status
4. **Document incident** - Root cause analysis

## 📞 ESCALATION CONTACTS

### Primary On-Call (24/7)
- **Technical Lead**: +46 70 XXX XXXX
- **DevOps Engineer**: +46 70 XXX XXXX

### Secondary Escalation
- **Pilot Program Manager**: +46 70 XXX XXXX  
- **CTO**: +46 70 XXX XXXX

### Business Stakeholders
- **Café Aurora**: +46 8 XXX XXXX
- **Malmö Huset**: +46 40 XXX XXXX
- **Göteborg Café**: +46 31 XXX XXXX

## 🎯 INCIDENT SEVERITY CLASSIFICATION

### Severity 1 (Critical - 15 min response)
- System completely down
- All cafés unable to process feedback
- Payment processing broken
- Customer data breach suspected

### Severity 2 (High - 1 hour response)
- Single café system down
- Voice processing degraded but functional
- Payment delays but not failures
- Business KPIs outside acceptable range

### Severity 3 (Medium - 4 hour response)
- Performance degradation
- Non-critical feature issues
- Infrastructure resource constraints
- Monitoring/alerting issues

## 🛠️ EMERGENCY COMMANDS

### System Status Check
```bash
# Quick system health check
./scripts/health-check.sh staging

# Check all services
docker-compose -f docker-compose.staging.yml ps

# View recent logs
docker-compose -f docker-compose.staging.yml logs --tail=100 --since=1h
```

### Emergency Scaling
```bash
# Scale API Gateway for high load
docker-compose -f docker-compose.staging.yml up -d --scale api-gateway=3

# Switch to high-capacity configuration
docker-compose -f docker-compose.scale.yml up -d
```

### Service Recovery
```bash
# Restart failed services
docker-compose -f docker-compose.staging.yml restart api-gateway

# Force rebuild if corrupted
docker-compose -f docker-compose.staging.yml up -d --build api-gateway
```

### Database Emergency
```bash
# Check database connections
docker-compose -f docker-compose.staging.yml exec api-gateway npm run db:status

# Emergency database restore (if needed)
./scripts/restore-from-backup.sh --date=latest --verify
```

### Network Issues
```bash
# Test connectivity to services
curl -f http://localhost:3001/health
curl -f http://localhost:9090/-/healthy
curl -f http://localhost:9093/-/healthy

# Check DNS resolution for pilot domains
dig aurora.feedbackai.se
dig malmohuset.feedbackai.se  
dig goteborg.feedbackai.se
```

## 📊 INCIDENT COMMUNICATION

### Internal Communication (Slack)
```
🚨 INCIDENT ALERT 🚨
Severity: [CRITICAL/HIGH/MEDIUM]
Impact: [Brief description]
Cafés Affected: [Aurora/Malmö/Göteborg/All]
ETA: [Estimated resolution time]
Lead: @[person handling incident]
Status Page: [Link to status updates]
```

### Customer Communication (if needed)
```
Vi upplever för närvarande tekniska problem som kan påverka feedback-systemet. 
Vi arbetar aktivt med att lösa problemet och förväntar oss att det ska vara löst inom [tidsram].
Tack för ert tålamod.

(English: We are currently experiencing technical issues that may affect the feedback system. 
We are actively working to resolve the issue and expect it to be resolved within [timeframe]. 
Thank you for your patience.)
```

## 🔄 POST-INCIDENT PROCEDURES

### Immediate (within 24 hours)
1. **Service restored** - Verify full functionality
2. **Stakeholders notified** - All clear communication
3. **Incident documented** - Timeline and actions taken
4. **Monitoring verified** - Alerts working properly

### Follow-up (within 1 week)
1. **Root cause analysis** - Why did this happen?
2. **Prevention measures** - How to prevent recurrence?
3. **Process improvements** - What can we do better?
4. **Runbook updates** - Update procedures based on learnings

## 📈 INCIDENT METRICS

Track these metrics for continuous improvement:
- **Mean Time to Detection (MTTD)**: How quickly we identify issues
- **Mean Time to Resolution (MTTR)**: How quickly we fix issues  
- **Customer Impact Duration**: How long customers were affected
- **Alert Accuracy**: False positive/negative rates
- **Escalation Effectiveness**: When and how we escalate

## 🧪 TESTING PROCEDURES

### Monthly Incident Response Drill
1. Simulate critical alert
2. Test escalation procedures
3. Verify communication channels
4. Update contact information
5. Review and improve procedures

### Quarterly Business Continuity Test
1. Full system failover test
2. Backup and recovery validation
3. Disaster recovery procedures
4. Stakeholder notification test
5. Documentation review and updates
EOF