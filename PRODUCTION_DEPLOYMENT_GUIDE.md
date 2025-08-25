# AI Feedback Platform - Production Deployment Guide

## Table of Contents
1. [Pre-deployment Checklist](#pre-deployment-checklist)
2. [Infrastructure Setup](#infrastructure-setup)
3. [Environment Configuration](#environment-configuration)
4. [Database Deployment](#database-deployment)
5. [Redis Cluster Setup](#redis-cluster-setup)
6. [Application Deployment](#application-deployment)
7. [Business Dashboard Deployment](#business-dashboard-deployment)
8. [Location Routing Setup](#location-routing-setup)
9. [CDN Configuration](#cdn-configuration)
10. [Monitoring Setup](#monitoring-setup)
11. [Security Configuration](#security-configuration)
12. [SSL/TLS Setup](#ssltls-setup)
13. [Backup Configuration](#backup-configuration)
14. [Health Checks](#health-checks)
15. [Rollback Procedures](#rollback-procedures)
16. [Post-deployment Validation](#post-deployment-validation)

## Pre-deployment Checklist

### Infrastructure Requirements
- [ ] **Servers**: 3 regions (Stockholm, Gothenburg, Malmö) with minimum specifications:
  - Stockholm: 4 vCPUs, 16GB RAM, 200GB SSD (Primary)
  - Gothenburg: 2 vCPUs, 8GB RAM, 100GB SSD (Secondary)
  - Malmö: 2 vCPUs, 8GB RAM, 100GB SSD (Tertiary)

- [ ] **Network**: 
  - Load balancers in each region
  - Cross-region VPN connectivity
  - SSL certificates for all domains
  - CDN accounts (Cloudflare/CloudFront)

- [ ] **External Services**:
  - Supabase production database
  - Stripe Connect account
  - SendGrid/Resend email service
  - Sentry error tracking
  - PagerDuty/alerting service

### Required Credentials
- [ ] Database connection strings
- [ ] Redis passwords and cluster configuration
- [ ] SSL certificates and private keys
- [ ] API keys for external services
- [ ] Docker registry credentials
- [ ] Domain DNS control

## Infrastructure Setup

### 1. Docker Swarm Cluster Initialization

```bash
# On Stockholm primary node
docker swarm init --advertise-addr=<STOCKHOLM_PRIVATE_IP>

# Join Gothenburg and Malmö nodes
docker swarm join --token <WORKER_TOKEN> <STOCKHOLM_PRIVATE_IP>:2377

# Label nodes for region-specific deployments
docker node update --label-add region=stockholm <STOCKHOLM_NODE_ID>
docker node update --label-add region=gothenburg <GOTHENBURG_NODE_ID>
docker node update --label-add region=malmo <MALMO_NODE_ID>
```

### 2. Network Setup

```bash
# Create overlay networks for cross-region communication
docker network create --driver overlay --attachable ai-feedback-prod
docker network create --driver overlay --attachable cross-region-replication
docker network create --driver overlay --attachable monitoring-network
```

### 3. Docker Registry Setup

```bash
# Deploy private registry if using one
docker service create \
  --name registry \
  --publish 5000:5000 \
  --mount type=volume,source=registry-data,target=/var/lib/registry \
  registry:2
```

## Environment Configuration

### 1. Create Production Environment Files

```bash
# Create secure environment directory
sudo mkdir -p /opt/ai-feedback/env
sudo chmod 700 /opt/ai-feedback/env

# Copy environment files
sudo cp .env.production /opt/ai-feedback/env/
sudo cp .env.business /opt/ai-feedback/env/
sudo chmod 600 /opt/ai-feedback/env/*
```

### 2. Configure Docker Secrets

```bash
# Create Docker secrets for sensitive data
echo "$DATABASE_URL" | docker secret create database_url -
echo "$REDIS_PASSWORD" | docker secret create redis_password -
echo "$JWT_SECRET" | docker secret create jwt_secret -
echo "$STRIPE_SECRET_KEY" | docker secret create stripe_secret -
echo "$QR_ENCRYPTION_KEY" | docker secret create qr_encryption_key -
```

### 3. Environment Variable Validation

```bash
# Run validation script
cd /opt/ai-feedback-platform
./scripts/validate-env.sh production
```

## Database Deployment

### 1. Supabase Configuration

```bash
# Initialize database schema
npm run db:migrate:production

# Set up Row Level Security policies
npm run db:setup-rls

# Create database indexes for performance
npm run db:create-indexes

# Seed initial data
npm run db:seed:production
```

### 2. Database Connection Pooling

```bash
# Deploy PgBouncer for connection pooling
docker service create \
  --name pgbouncer \
  --replicas 3 \
  --network ai-feedback-prod \
  --env DATABASE_URL="$DATABASE_URL" \
  --env POOL_MODE=transaction \
  --env DEFAULT_POOL_SIZE=25 \
  --env MAX_CLIENT_CONN=1000 \
  pgbouncer/pgbouncer:latest
```

## Redis Cluster Setup

### 1. Deploy Redis Cluster

```bash
# Deploy Redis cluster using Docker Stack
docker stack deploy -c redis/redis-cluster.yml redis-cluster

# Wait for cluster to be ready
./scripts/wait-for-redis-cluster.sh

# Verify cluster health
docker exec redis-stockholm-master redis-cli cluster info
```

### 2. Configure Cross-Region Replication

```bash
# Deploy sync service
docker service create \
  --name redis-sync \
  --replicas 1 \
  --network cross-region-replication \
  --env REDIS_STOCKHOLM="redis://redis-stockholm-master:6379" \
  --env REDIS_GOTHENBURG="redis://redis-gothenburg-master:6379" \
  --env REDIS_MALMO="redis://redis-malmo-master:6379" \
  ai-feedback/redis-sync:latest
```

## Application Deployment

### 1. Build and Push Docker Images

```bash
# Build all services
docker-compose -f docker-compose.prod.yml build

# Tag images for production
docker tag ai-feedback/api-gateway:latest ai-feedback/api-gateway:prod-$(git rev-parse --short HEAD)
docker tag ai-feedback/customer-pwa:latest ai-feedback/customer-pwa:prod-$(git rev-parse --short HEAD)
docker tag ai-feedback/business-dashboard:latest ai-feedback/business-dashboard:prod-$(git rev-parse --short HEAD)

# Push to registry
docker push ai-feedback/api-gateway:prod-$(git rev-parse --short HEAD)
docker push ai-feedback/customer-pwa:prod-$(git rev-parse --short HEAD)
docker push ai-feedback/business-dashboard:prod-$(git rev-parse --short HEAD)
```

### 2. Deploy Application Stack

```bash
# Deploy main application stack
docker stack deploy -c docker-compose.prod.yml ai-feedback

# Verify deployment
docker service ls
docker stack services ai-feedback
```

### 3. Scale Services by Region

```bash
# Scale services based on region capacity
docker service scale ai-feedback_api-gateway=6
docker service scale ai-feedback_customer-pwa=4
docker service scale ai-feedback_business-dashboard=3

# Update placement constraints
docker service update \
  --constraint-add 'node.labels.region == stockholm' \
  --replicas 3 \
  ai-feedback_api-gateway
```

## Business Dashboard Deployment

### 1. Business Dashboard Specific Configuration

```bash
# Create business-specific secrets
echo "$BUSINESS_JWT_SECRET" | docker secret create business_jwt_secret -
echo "$BUSINESS_ENCRYPTION_KEY" | docker secret create business_encryption_key -

# Deploy business dashboard with enhanced configuration
docker service create \
  --name business-dashboard \
  --replicas 3 \
  --network ai-feedback-prod \
  --secret business_jwt_secret \
  --secret business_encryption_key \
  --env NODE_ENV=production \
  --env BUSINESS_DASHBOARD_PORT=3002 \
  --constraint 'node.labels.region != malmo' \
  ai-feedback/business-dashboard:latest
```

### 2. Business Load Balancer Configuration

```bash
# Deploy nginx configuration for business portal
sudo cp nginx/sites/business-portal.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/business-portal.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## Location Routing Setup

### 1. Deploy Location Routing Services

```bash
# Deploy location routing stack
docker stack deploy -c services/location-routing/docker-compose.location-routing.yml location-routing

# Verify location services
curl -f http://location-router-stockholm:3010/health
curl -f http://location-router-gothenburg:3011/health
curl -f http://location-router-malmo:3012/health
```

### 2. Configure Geo-IP Routing

```bash
# Update nginx with GeoIP configuration
sudo apt-get install nginx-module-geoip
sudo cp nginx/geoip.conf /etc/nginx/conf.d/
sudo systemctl reload nginx
```

## CDN Configuration

### 1. Cloudflare Setup

```bash
# Deploy CDN configuration
node cdn/deploy-cloudflare.js production

# Verify CDN endpoints
curl -H "Accept: application/json" \
  https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records
```

### 2. Asset Optimization

```bash
# Deploy optimized assets to CDN
npm run build:assets:production
npm run deploy:assets:cdn
```

## Monitoring Setup

### 1. Deploy Prometheus and Grafana

```bash
# Deploy monitoring stack
docker stack deploy -c monitoring/docker-compose.monitoring.yml monitoring

# Import Grafana dashboards
curl -X POST \
  -H "Content-Type: application/json" \
  -d @monitoring/grafana-location-dashboard.json \
  http://admin:$GRAFANA_PASSWORD@grafana:3000/api/dashboards/db
```

### 2. Configure AlertManager

```bash
# Deploy alert configuration
docker config create alertmanager_config monitoring/location-alerts.yml
docker service update \
  --config-add source=alertmanager_config,target=/etc/alertmanager/alertmanager.yml \
  monitoring_alertmanager
```

### 3. Set Up Log Aggregation

```bash
# Deploy ELK stack for log aggregation
docker stack deploy -c monitoring/elk-stack.yml logging

# Configure log forwarding
sudo cp monitoring/filebeat.yml /etc/filebeat/
sudo systemctl restart filebeat
```

## Security Configuration

### 1. Firewall Configuration

```bash
# Configure UFW firewall
sudo ufw enable
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow necessary ports
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 2376/tcp  # Docker Swarm (secure)
sudo ufw allow 7946     # Docker Swarm (overlay network)
sudo ufw allow 4789/udp  # Docker Swarm (overlay network)
```

### 2. Docker Security Configuration

```bash
# Configure Docker daemon security
sudo cp docker/daemon.json /etc/docker/
sudo systemctl restart docker

# Enable Docker content trust
export DOCKER_CONTENT_TRUST=1
```

### 3. Application Security Headers

```bash
# Deploy security middleware
docker service update \
  --env-add SECURITY_HEADERS_ENABLED=true \
  --env-add CSP_ENABLED=true \
  --env-add HSTS_ENABLED=true \
  ai-feedback_api-gateway
```

## SSL/TLS Setup

### 1. Certificate Installation

```bash
# Install SSL certificates
sudo mkdir -p /etc/nginx/ssl
sudo cp ssl/feedback.crt /etc/nginx/ssl/
sudo cp ssl/feedback.key /etc/nginx/ssl/
sudo cp ssl/business.crt /etc/nginx/ssl/
sudo cp ssl/business.key /etc/nginx/ssl/
sudo cp ssl/admin.crt /etc/nginx/ssl/
sudo cp ssl/admin.key /etc/nginx/ssl/

# Set proper permissions
sudo chmod 644 /etc/nginx/ssl/*.crt
sudo chmod 600 /etc/nginx/ssl/*.key
```

### 2. OCSP Stapling Configuration

```bash
# Configure OCSP stapling for better SSL performance
sudo cp ssl/ca-bundle.crt /etc/nginx/ssl/
sudo nginx -t && sudo systemctl reload nginx
```

## Backup Configuration

### 1. Database Backup

```bash
# Set up automated database backups
sudo cp scripts/backup-database.sh /opt/ai-feedback/
sudo crontab -e
# Add: 0 2 * * * /opt/ai-feedback/backup-database.sh
```

### 2. Redis Backup

```bash
# Configure Redis persistence
docker service update \
  --mount-add type=volume,source=redis-backup,target=/data/backup \
  redis-cluster_redis-stockholm-master

# Set up Redis backup script
sudo cp scripts/backup-redis.sh /opt/ai-feedback/
```

### 3. Application Backup

```bash
# Set up application state backup
sudo cp scripts/backup-application.sh /opt/ai-feedback/
sudo chmod +x /opt/ai-feedback/backup-*.sh
```

## Health Checks

### 1. Application Health Checks

```bash
# Test all health endpoints
curl -f https://feedback.your-domain.com/api/health
curl -f https://business.feedback.your-domain.com/api/health
curl -f https://admin.feedback.your-domain.com/api/health

# Test WebSocket connections
wscat -c wss://feedback.your-domain.com/ws
```

### 2. Database Health Checks

```bash
# Test database connectivity
npm run db:health:check

# Test Redis cluster
redis-cli -h redis-loadbalancer -p 6390 ping
```

### 3. External Service Health Checks

```bash
# Test external services
./scripts/health-check-external.sh
```

## Rollback Procedures

### 1. Application Rollback

```bash
# Rollback to previous version
export PREVIOUS_VERSION=$(git rev-parse --short HEAD~1)

docker service update \
  --image ai-feedback/api-gateway:prod-$PREVIOUS_VERSION \
  ai-feedback_api-gateway

docker service update \
  --image ai-feedback/business-dashboard:prod-$PREVIOUS_VERSION \
  ai-feedback_business-dashboard
```

### 2. Database Rollback

```bash
# Rollback database migration
npm run db:rollback:production

# Restore from backup if needed
./scripts/restore-database.sh backup-2024-08-24.sql
```

### 3. Configuration Rollback

```bash
# Rollback nginx configuration
sudo cp nginx/nginx.conf.backup /etc/nginx/nginx.conf
sudo nginx -t && sudo systemctl reload nginx
```

## Post-deployment Validation

### 1. Functional Testing

```bash
# Run end-to-end tests
npm run test:e2e:production

# Test customer journey
./scripts/test-customer-journey.sh

# Test business dashboard functionality
./scripts/test-business-dashboard.sh
```

### 2. Performance Testing

```bash
# Load testing
npm run test:load:production

# Monitor performance metrics
curl -s http://prometheus:9090/api/v1/query?query=up | jq
```

### 3. Security Testing

```bash
# Run security scan
npm run security:scan

# Test SSL configuration
sslscan feedback.your-domain.com
testssl.sh feedback.your-domain.com
```

### 4. Business Metrics Validation

```bash
# Check business dashboard metrics
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://business.feedback.your-domain.com/api/analytics/health

# Validate location routing
./scripts/test-location-routing.sh

# Test QR code generation
./scripts/test-qr-generation.sh
```

## Production Monitoring Checklist

### Immediate Post-Deployment (First 24 hours)
- [ ] All services are running and healthy
- [ ] Database connections are stable
- [ ] Redis cluster is functioning correctly
- [ ] SSL certificates are valid and properly configured
- [ ] CDN is serving assets correctly
- [ ] Monitoring dashboards are receiving data
- [ ] Alerts are configured and firing appropriately
- [ ] Business dashboard is accessible and functional
- [ ] Location routing is working correctly
- [ ] QR code generation is operational

### Weekly Monitoring
- [ ] Review error rates and performance metrics
- [ ] Check backup integrity and restoration procedures
- [ ] Validate SSL certificate expiration dates
- [ ] Review security logs and anomalies
- [ ] Update monitoring thresholds based on usage patterns
- [ ] Review and optimize resource utilization
- [ ] Test disaster recovery procedures

## Emergency Contacts and Procedures

### Contact Information
- **DevOps Lead**: devops@feedback.your-domain.com
- **Infrastructure Team**: infrastructure@feedback.your-domain.com
- **On-call Engineer**: +46-XXX-XXX-XXX
- **Business Team**: business@feedback.your-domain.com

### Emergency Procedures
1. **Service Down**: Follow incident response playbook
2. **Data Breach**: Execute security incident response plan
3. **Performance Degradation**: Scale services and investigate
4. **Database Issues**: Contact DBA and follow database recovery procedures

## Compliance and Audit Requirements

### GDPR Compliance Checklist
- [ ] Data processing agreements in place
- [ ] Right to erasure functionality tested
- [ ] Data export functionality verified
- [ ] Privacy notices updated and accessible
- [ ] Audit logging is functioning correctly

### SOC 2 Compliance
- [ ] Access controls are properly configured
- [ ] Audit logging is comprehensive
- [ ] Change management processes are followed
- [ ] Backup and disaster recovery procedures tested

---

## Deployment Verification Commands

```bash
# Complete deployment verification script
./scripts/verify-deployment.sh

# Individual service verification
docker service ls
docker stack services ai-feedback
docker stack services redis-cluster
docker stack services location-routing
docker stack services monitoring

# Performance baseline establishment
./scripts/establish-performance-baseline.sh
```

---

**Last Updated**: 2024-08-24  
**Version**: 1.0  
**Reviewed By**: DevOps Team  

For questions or issues during deployment, contact the DevOps team at devops@feedback.your-domain.com or create an issue in the project repository.