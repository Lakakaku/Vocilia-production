# 🇸🇪 Admin System Training Guide - Swedish Pilot Management

**COMPREHENSIVE TRAINING DOCUMENTATION FOR ADMIN USERS**

This guide provides complete training materials for AI Feedback Platform administrators, with specialized focus on Swedish pilot program management, compliance requirements, and operational procedures.

## 📋 Table of Contents

1. [Getting Started](#getting-started)
2. [User Roles and Permissions](#user-roles-and-permissions)
3. [Swedish Pilot Management](#swedish-pilot-management)
4. [Authentication and Security](#authentication-and-security)
5. [Monitoring and Dashboards](#monitoring-and-dashboards)
6. [Compliance and Reporting](#compliance-and-reporting)
7. [Troubleshooting Guide](#troubleshooting-guide)
8. [Emergency Procedures](#emergency-procedures)
9. [Best Practices](#best-practices)
10. [Reference Materials](#reference-materials)

---

## 🚀 Getting Started

### First-Time Login

1. **Access the Admin System**
   ```
   Primary URL: http://localhost:3023 (Grafana)
   Admin API: http://localhost:3021
   Authentication: http://localhost:3022
   ```

2. **Initial Credentials** (CHANGE IMMEDIATELY)
   ```
   Email: admin@ai-feedback.se
   Password: admin123!
   ```

3. **First Login Checklist**
   - [ ] Change default password
   - [ ] Set up Multi-Factor Authentication (MFA)
   - [ ] Verify assigned role permissions
   - [ ] Review Swedish pilot business data
   - [ ] Check system health status

### System Overview

The admin system consists of several integrated components:

- **Authentication Service**: Secure login with MFA
- **Pilot Management API**: Swedish business operations
- **Activity Logger**: Audit trail and compliance
- **Grafana Dashboards**: Monitoring and analytics
- **Prometheus Metrics**: System performance data
- **AlertManager**: Alert routing and notifications

---

## 👥 User Roles and Permissions

### Role Hierarchy

#### 1. Super Administrator (`super_admin`)
**Full System Access**
- All system functions and data
- User management capabilities
- System configuration changes
- Emergency recovery procedures

**Typical Responsibilities:**
- System maintenance and updates
- User account management
- Security policy enforcement
- Disaster recovery coordination

#### 2. Pilot Administrator (`pilot_admin`)
**Swedish Pilot Program Management**
- View and manage Swedish pilot businesses
- Approve/suspend business applications
- Generate compliance reports
- Access pilot analytics and metrics

**Typical Responsibilities:**
- Business onboarding workflows
- Regional performance monitoring
- Finansinspektionen reporting
- Swedish market expansion

#### 3. Finance Administrator (`finance_admin`)
**Financial Operations and Compliance**
- Payment system monitoring
- Revenue and reward analytics
- Budget control and alerts
- Financial compliance reporting

**Typical Responsibilities:**
- Payment issue resolution
- Budget monitoring and alerts
- Financial report generation
- Compliance verification

#### 4. Support Administrator (`support_admin`)
**Customer and Business Support**
- Business support case management
- Feedback system monitoring
- Customer issue resolution
- Basic reporting capabilities

**Typical Responsibilities:**
- Business user support
- System status communication
- Issue escalation management
- User training assistance

#### 5. Monitoring Administrator (`monitoring_admin`)
**System Monitoring and Alerting**
- System health monitoring
- Alert configuration and management
- Performance analysis
- Infrastructure monitoring

**Typical Responsibilities:**
- Alert rule configuration
- Dashboard maintenance
- Performance optimization
- System health reporting

### Permission Matrix

| Function | Super Admin | Pilot Admin | Finance Admin | Support Admin | Monitoring Admin |
|----------|:-----------:|:-----------:|:-------------:|:-------------:|:----------------:|
| User Management | ✅ | ❌ | ❌ | ❌ | ❌ |
| Business Management | ✅ | ✅ | ❌ | 👁️ | ❌ |
| Financial Data | ✅ | 👁️ | ✅ | ❌ | ❌ |
| System Configuration | ✅ | ❌ | ❌ | ❌ | ✅ |
| Compliance Reports | ✅ | ✅ | ✅ | ❌ | ❌ |
| Support Cases | ✅ | 👁️ | ❌ | ✅ | ❌ |
| Monitoring Config | ✅ | ❌ | ❌ | ❌ | ✅ |

Legend: ✅ Full Access | 👁️ Read Only | ❌ No Access

---

## 🇸🇪 Swedish Pilot Management

### Business Onboarding Workflow

#### Step 1: Application Review
1. Navigate to **Pilot Management** → **Pending Applications**
2. Review business application details:
   - Organization number (Organisationsnummer)
   - Business type and industry
   - Proposed locations
   - Contact information
3. Verify Swedish business registration
4. Check regional distribution balance

#### Step 2: Compliance Verification
1. Validate GDPR compliance documentation
2. Verify Finansinspektionen registration (if applicable)
3. Check anti-money laundering requirements
4. Review data processing agreements

#### Step 3: Business Approval Process
```bash
# Using the Pilot Management API
curl -X POST http://localhost:3021/api/pilot/businesses/BUSINESS_ID/status \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "approved_active",
    "tier": 2,
    "reason": "Completed all compliance requirements"
  }'
```

#### Step 4: Regional Configuration
1. Assign business to appropriate Swedish region:
   - **Stockholm** (Primary financial hub)
   - **Gothenburg** (Secondary market)
   - **Malmö** (Southern coverage)
2. Configure regional-specific settings
3. Set up location-based QR codes
4. Enable regional monitoring

### Business Tier Management

#### Tier 1: Startup Level
- Maximum 1 location
- 100 feedback sessions/month
- 25% platform commission
- Basic support level

#### Tier 2: Growth Level  
- Maximum 5 locations
- 500 feedback sessions/month
- 22% platform commission
- Priority support

#### Tier 3: Enterprise Level
- Maximum 50 locations
- 2,500 feedback sessions/month
- 20% platform commission
- Premium support + dedicated manager

### Regional Analytics Dashboard

#### Key Metrics to Monitor
1. **Business Distribution**
   ```
   Stockholm: XX businesses (XX% of total)
   Gothenburg: XX businesses (XX% of total)
   Malmö: XX businesses (XX% of total)
   ```

2. **Performance Indicators**
   - Average feedback quality score by region
   - Customer engagement rates
   - Revenue per business
   - Tier upgrade opportunities

3. **Compliance Status**
   - FI reporting compliance rate
   - GDPR audit status
   - Data retention compliance

---

## 🔐 Authentication and Security

### Multi-Factor Authentication Setup

#### Step 1: Enable MFA
1. Go to **Profile** → **Security Settings**
2. Click **Set up MFA**
3. Scan QR code with authenticator app:
   - Google Authenticator
   - Microsoft Authenticator
   - Authy

#### Step 2: Verify Setup
1. Enter 6-digit code from authenticator app
2. Save backup codes in secure location
3. Test login with MFA

#### Step 3: MFA Recovery
If you lose access to your authenticator:
1. Contact super administrator
2. Provide identity verification
3. Request MFA reset
4. Set up new authenticator device

### Security Best Practices

#### Password Requirements
- Minimum 12 characters
- Mix of uppercase, lowercase, numbers, symbols
- No common dictionary words
- Change every 90 days (recommended)

#### Session Security
- Sessions timeout after 8 hours by default
- Always log out when finished
- Never share login credentials
- Report suspicious activity immediately

#### Access Control
- Use principle of least privilege
- Regularly review user permissions
- Disable unused accounts
- Monitor failed login attempts

### Account Lockout Policy
- Account locks after 5 failed attempts
- 15-minute lockout duration (first offense)
- Escalating lockout periods for repeated failures
- Manual unlock required after 10 attempts

---

## 📊 Monitoring and Dashboards

### Primary Dashboards

#### 1. Swedish Pilot Overview Dashboard
**Location:** http://localhost:3023/d/swedish-pilot-overview

**Key Panels:**
- Active pilot businesses count
- Regional session distribution (pie chart)
- Average quality score gauge
- Total rewards paid (SEK)
- Business status trends
- Regional business map

**How to Use:**
1. Monitor overall pilot program health
2. Identify regional performance patterns
3. Track quality score trends
4. Review financial metrics

#### 2. Admin System Health Dashboard
**Key Metrics:**
- Service uptime percentages
- API response times
- Database performance
- Error rates and logs

**Alert Indicators:**
- 🟢 Green: All systems operational
- 🟡 Yellow: Warning conditions present
- 🔴 Red: Critical issues requiring attention

#### 3. Compliance Monitoring Dashboard
**Key Panels:**
- GDPR compliance status
- FI reporting schedule
- Data retention status
- Audit log activity

### Using Grafana Effectively

#### Navigation Tips
1. **Time Range Selection:** Use top-right picker
2. **Panel Refresh:** Click refresh icon or set auto-refresh
3. **Zoom:** Click and drag on time series charts
4. **Panel Inspection:** Click panel title → Inspect

#### Creating Custom Views
1. **Variables:** Use template variables for dynamic filtering
2. **Annotations:** Mark important events on charts
3. **Alerting:** Set up custom alert rules
4. **Sharing:** Generate public links for specific views

#### Dashboard Maintenance
- Review and update panels monthly
- Remove unused dashboards
- Optimize query performance
- Document custom modifications

---

## 📋 Compliance and Reporting

### Finansinspektionen (FI) Reporting

#### Monthly Compliance Report Generation
```bash
# Generate monthly FI report
curl -X POST http://localhost:3021/api/pilot/fi-report \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reportType": "monthly",
    "startDate": "2024-01-01",
    "endDate": "2024-01-31"
  }'
```

#### Report Contents
- Business transaction volumes
- Payment method usage statistics
- Regional business distribution
- Compliance event summaries
- Risk assessment outcomes

#### Submission Process
1. Generate report by 5th of following month
2. Review report accuracy
3. Submit to FI portal
4. Archive report for audit trail

### GDPR Compliance Management

#### Data Subject Rights
1. **Right to Access:** Export user data on request
2. **Right to Rectification:** Correct inaccurate data
3. **Right to Erasure:** Delete personal data when requested
4. **Right to Portability:** Provide data in machine-readable format

#### Data Retention Schedule
- Admin activity logs: 365 days
- Business data: 7 years (FI requirement)
- Personal data: As per consent or legal basis
- Audit logs: 7 years (compliance requirement)

#### GDPR Data Export
```bash
# Export user data for GDPR request
curl http://localhost:3020/api/gdpr/export/USER_ID?format=json \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Audit Trail Management

#### Activity Categories
- **Authentication Events:** Login, logout, MFA
- **Business Operations:** Approvals, suspensions, configurations
- **Data Access:** Report generation, data exports
- **System Changes:** Configuration updates, user management

#### Audit Log Review
1. **Daily:** Review failed authentication attempts
2. **Weekly:** Analyze unusual activity patterns
3. **Monthly:** Generate compliance activity report
4. **Quarterly:** Comprehensive audit trail review

---

## 🔧 Troubleshooting Guide

### Common Issues and Solutions

#### 1. Login Problems

**Issue:** Cannot log into admin system
**Solutions:**
1. Check credentials and caps lock
2. Verify MFA code is current (30-second window)
3. Check for account lockout status
4. Clear browser cache and cookies
5. Try incognito/private browsing mode

**Escalation:** Contact super administrator if issue persists

#### 2. Dashboard Loading Issues

**Issue:** Grafana dashboards not loading or showing data
**Solutions:**
1. Check time range selection (not too far in past/future)
2. Verify Prometheus data sources are connected
3. Refresh browser or try different browser
4. Check network connectivity
5. Verify service health status

**Escalation:** Contact monitoring administrator

#### 3. Swedish Business Approval Failures

**Issue:** Cannot approve Swedish pilot businesses
**Solutions:**
1. Verify you have pilot_admin role
2. Check business meets all requirements
3. Ensure organization number is valid
4. Review regional capacity limits
5. Check for system maintenance mode

**Escalation:** Contact development team with business ID

#### 4. Compliance Report Generation Errors

**Issue:** FI reports failing to generate
**Solutions:**
1. Verify date range parameters
2. Check database connectivity
3. Ensure sufficient data exists for period
4. Review system logs for errors
5. Try generating smaller date range

**Escalation:** Critical issue - contact compliance team immediately

#### 5. Alert Configuration Issues

**Issue:** Not receiving expected alerts
**Solutions:**
1. Check alert rule configuration
2. Verify notification channels (email/Slack)
3. Review alert history in AlertManager
4. Check for alert silencing/inhibition rules
5. Test notification channels manually

**Escalation:** Contact monitoring administrator

### System Health Checks

#### Daily Health Verification
```bash
# Check service status
curl http://localhost:3020/health  # Activity Logger
curl http://localhost:3021/health  # Pilot Management
curl http://localhost:3022/health  # Authentication
curl http://localhost:3023/api/health  # Grafana

# Expected response: {"status": "healthy"}
```

#### Performance Monitoring
1. **Response Times:** Should be < 2 seconds
2. **Error Rates:** Should be < 1%
3. **System Load:** Monitor CPU/memory usage
4. **Database Performance:** Check query execution times

---

## 🚨 Emergency Procedures

### Incident Response Matrix

#### Severity Levels

**Critical (P1):**
- Multiple admin systems down
- Swedish pilot operations halted
- Data breach or security incident
- Compliance violation with legal impact

**High (P2):**
- Single admin system down
- Regional service degradation
- Payment system issues
- Compliance reporting delays

**Medium (P3):**
- Performance degradation
- Non-critical feature issues
- Dashboard problems
- Minor alert configuration issues

**Low (P4):**
- Cosmetic UI issues
- Documentation updates needed
- Enhancement requests
- Training questions

### Critical Incident Response

#### Immediate Actions (0-15 minutes)
1. **Assess Impact**
   - Identify affected systems
   - Determine business impact
   - Estimate user impact

2. **Initiate Communication**
   ```
   Emergency Contacts:
   - Technical Lead: devops@ai-feedback.se
   - Business Continuity: +46-xxx-xxx-xxx
   - Swedish Compliance: compliance-sweden@ai-feedback.se
   ```

3. **Begin Containment**
   - Stop further damage
   - Preserve evidence if security incident
   - Activate backup systems if available

#### Short-term Response (15-60 minutes)
1. **Detailed Assessment**
   - Run disaster recovery assessment script
   - Document timeline and impact
   - Identify root cause if possible

2. **Recovery Actions**
   - Execute disaster recovery procedures
   - Restore from backups if necessary
   - Implement workarounds

3. **Stakeholder Communication**
   - Notify Swedish pilot businesses if needed
   - Update internal teams
   - Prepare external communications

#### Long-term Response (1+ hours)
1. **Full Recovery**
   - Restore all services
   - Verify data integrity
   - Conduct system validation

2. **Post-Incident**
   - Document lessons learned
   - Update procedures
   - Schedule follow-up reviews

### Disaster Recovery Execution

#### When to Execute Disaster Recovery
- Complete system failure (multiple services down)
- Data corruption detected
- Security breach requiring system rebuild
- Infrastructure failure (hardware/network)

#### Disaster Recovery Command
```bash
# Execute disaster recovery
cd /monitoring/admin-monitoring/disaster-recovery
sudo ./admin-disaster-recovery.sh --mode emergency

# Monitor recovery progress
tail -f /opt/ai-feedback/recovery/recovery_log_*.txt
```

### Business Continuity

#### Swedish Pilot Continuity Plan
1. **Customer Communication**
   - Notify businesses of system issues
   - Provide estimated restoration time
   - Set up temporary support channels

2. **Compliance Continuity**
   - Document service interruption
   - Ensure FI reporting continuity
   - Maintain GDPR compliance during outage

3. **Financial Operations**
   - Secure payment processing continuity
   - Document any financial impact
   - Coordinate with finance team

---

## ✅ Best Practices

### Daily Operations

#### Morning Checklist
- [ ] Check system health dashboards
- [ ] Review overnight alerts and incidents  
- [ ] Verify backup completion status
- [ ] Check Swedish pilot business metrics
- [ ] Review pending business applications

#### Weekly Tasks
- [ ] Generate and review compliance reports
- [ ] Analyze regional performance trends
- [ ] Update business tier recommendations
- [ ] Review and update alert configurations
- [ ] Conduct user access reviews

#### Monthly Tasks
- [ ] Generate FI compliance reports
- [ ] Review and update disaster recovery procedures
- [ ] Analyze system performance trends
- [ ] Update training documentation
- [ ] Conduct security access reviews

### Security Best Practices

#### Access Management
1. **Regular Reviews:** Monthly user access review
2. **Least Privilege:** Grant minimum required permissions
3. **Separation of Duties:** No single user has complete control
4. **Time-based Access:** Limit administrative access windows

#### Data Protection
1. **Encryption:** All sensitive data encrypted at rest and in transit
2. **Access Logging:** All data access logged and monitored
3. **Data Minimization:** Collect only necessary data
4. **Retention Management:** Automated data cleanup per policy

#### Incident Prevention
1. **Monitoring:** Comprehensive system and security monitoring
2. **Updates:** Regular security updates and patches
3. **Training:** Ongoing security awareness training
4. **Testing:** Regular disaster recovery and security testing

### Swedish Compliance Best Practices

#### Finansinspektionen Compliance
1. **Timely Reporting:** Submit reports by deadline
2. **Data Accuracy:** Verify all report data before submission
3. **Documentation:** Maintain comprehensive audit trails
4. **Risk Management:** Regular risk assessments and updates

#### GDPR Compliance
1. **Privacy by Design:** Build privacy into all processes
2. **Consent Management:** Clear consent tracking and management
3. **Data Subject Rights:** Efficient processes for rights requests
4. **Breach Notification:** 72-hour breach notification procedure

---

## 📚 Reference Materials

### API Documentation

#### Authentication API
```
Base URL: http://localhost:3022
Endpoints:
- POST /api/auth/login - User authentication
- POST /api/auth/logout - End session
- POST /api/auth/verify - Verify token
- POST /api/auth/mfa/setup - Configure MFA
```

#### Pilot Management API
```
Base URL: http://localhost:3021
Endpoints:
- GET /api/pilot/businesses - List businesses
- GET /api/pilot/businesses/:id - Get business details
- POST /api/pilot/businesses/:id/status - Update status
- GET /api/pilot/analytics - Get analytics
- POST /api/pilot/fi-report - Generate FI report
```

### Monitoring Queries

#### Common Prometheus Queries
```promql
# Service uptime
up{job="admin-monitoring"}

# Request rate by service
rate(http_requests_total[5m])

# Error rate
rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])

# Swedish pilot businesses by region
admin_swedish_pilot_businesses_total{region="stockholm"}

# Average quality score
avg(admin_swedish_pilot_avg_quality_score)
```

### Grafana Dashboard Queries

#### Business Metrics Panel
```sql
-- Business count by tier
SELECT tier, COUNT(*) as count 
FROM businesses 
WHERE pilot_program = true 
GROUP BY tier;

-- Regional performance
SELECT bl.region, AVG(f.quality_score_total) as avg_score
FROM businesses b
JOIN business_locations bl ON b.id = bl.business_id
JOIN feedback_sessions fs ON bl.id = fs.location_id  
JOIN feedback f ON fs.id = f.session_id
WHERE b.pilot_program = true
GROUP BY bl.region;
```

### Configuration Templates

#### Alert Rule Template
```yaml
- alert: SwedishBusinessDown
  expr: admin_swedish_pilot_businesses_total{status="approved_active", region="REGION"} == 0
  for: 15m
  labels:
    severity: warning
    region: REGION
  annotations:
    summary: "No active businesses in REGION"
    description: "All businesses in REGION are inactive"
```

### Useful Commands

#### Docker Management
```bash
# View admin containers
docker ps -f "name=admin-"

# Check container logs
docker logs admin-activity-logger

# Restart specific service
docker restart admin-grafana

# View container resource usage
docker stats admin-*
```

#### Database Queries
```sql
-- Count pilot businesses by status
SELECT pilot_status, COUNT(*) 
FROM businesses 
WHERE pilot_program = true 
GROUP BY pilot_status;

-- Recent admin activity
SELECT activity, created_at, user_role 
FROM admin_activity_logs 
ORDER BY created_at DESC 
LIMIT 10;
```

### Contact Information

#### Internal Teams
- **Development Team:** dev@ai-feedback.se
- **DevOps Team:** devops@ai-feedback.se  
- **Security Team:** security@ai-feedback.se
- **Compliance Team:** compliance@ai-feedback.se

#### Swedish Operations
- **Pilot Manager:** pilot-manager@ai-feedback.se
- **Regional Coordinator:** regional@ai-feedback.se
- **Compliance Officer:** compliance-sweden@ai-feedback.se

#### Emergency Contacts
- **Technical Emergency:** +46-xxx-xxx-xxx
- **Business Continuity:** emergency@ai-feedback.se
- **Legal/Compliance Emergency:** legal-emergency@ai-feedback.se

---

## 📖 Training Resources

### Self-Paced Learning Modules

1. **Module 1: System Overview** (30 minutes)
   - Admin system architecture
   - Component interactions
   - Basic navigation

2. **Module 2: Swedish Pilot Management** (45 minutes)  
   - Business onboarding workflow
   - Regional management
   - Compliance requirements

3. **Module 3: Monitoring and Analytics** (30 minutes)
   - Dashboard usage
   - Key metrics interpretation
   - Alert management

4. **Module 4: Security and Compliance** (45 minutes)
   - Authentication and MFA setup
   - GDPR requirements
   - FI reporting procedures

5. **Module 5: Troubleshooting** (30 minutes)
   - Common issues resolution
   - Escalation procedures
   - Emergency response

### Hands-On Exercises

#### Exercise 1: Business Onboarding
1. Review a mock Swedish business application
2. Verify compliance documentation
3. Approve business and assign tier
4. Configure regional settings
5. Verify monitoring setup

#### Exercise 2: Compliance Reporting
1. Generate monthly FI report
2. Review report contents for accuracy
3. Export report in required format
4. Document submission process
5. Archive report appropriately

#### Exercise 3: Incident Response
1. Simulate system degradation
2. Use monitoring to identify issue
3. Execute troubleshooting steps
4. Document incident timeline
5. Conduct post-incident review

### Certification Requirements

#### Admin User Certification
- Complete all 5 training modules
- Pass practical exercises with 80% score
- Demonstrate troubleshooting competency
- Complete security awareness training
- Acknowledge compliance responsibilities

#### Annual Recertification
- Complete updated training modules
- Review policy and procedure updates
- Pass annual competency assessment
- Complete security refresher training

---

**🎉 Ready to manage the AI Feedback Platform Swedish pilot program!**

This training guide provides comprehensive knowledge and practical skills needed to effectively administer the AI Feedback Platform, with specialized focus on Swedish market operations, regulatory compliance, and operational excellence.

For additional support or questions, contact the admin training team at: admin-training@ai-feedback.se