# Swedish Pilot Program - Capacity Planning & Scaling Guide

## 📊 Current Capacity Baseline

### Pilot Program Target Metrics
- **3 Swedish Cafés**: Aurora (Stockholm), Malmö Huset, Göteborg Café
- **Expected Daily Volume**: 120-240 feedback sessions combined
- **Peak Hours**: 7-10 AM, 12-4 PM CET
- **Concurrent Sessions**: Up to 15 simultaneous voice feedbacks
- **Geographic Distribution**: Sweden (CET timezone)

### Current Infrastructure Allocation

#### Staging Environment Resources
```yaml
API Gateway:
  CPU: 1 core
  Memory: 1GB
  Storage: 10GB
  Instances: 1

Customer PWA:
  CPU: 0.5 cores
  Memory: 512MB
  Storage: 2GB
  Instances: 1

Business Dashboard:
  CPU: 1 core
  Memory: 1GB
  Storage: 5GB
  Instances: 1

Database (Supabase):
  Managed service
  Connection pool: 100
  Concurrent connections: 20

Redis Cache:
  Memory: 512MB
  Instances: 1

Voice Processing (Ollama):
  CPU: 2 cores
  Memory: 4GB
  Storage: 20GB (models)
  Instances: 1
```

## 📈 Capacity Planning Methodology

### 1. Traffic Pattern Analysis

#### Current Pilot Projections
- **Daily Sessions**: 120-240 (combined all cafés)
- **Peak Hour Sessions**: 30-50 sessions/hour
- **Session Duration**: Average 3-5 minutes
- **Voice Processing**: 2-3 seconds per interaction
- **Concurrent Voice Sessions**: 10-15 maximum

#### Growth Projections
```
Month 1: 3 cafés  (baseline)
Month 2: 5 cafés  (+67% traffic)
Month 3: 8 cafés  (+167% traffic)  
Month 6: 15 cafés (+400% traffic)
Month 12: 50 cafés (+1567% traffic)
```

### 2. Resource Utilization Monitoring

#### Key Metrics to Track
```yaml
CPU Utilization:
  Current Target: <70%
  Scale Trigger: >80% for 5 minutes
  Critical: >90%

Memory Usage:
  Current Target: <75%
  Scale Trigger: >85% for 5 minutes
  Critical: >95%

Response Time:
  Voice Processing: <2 seconds (95th percentile)
  API Endpoints: <500ms (95th percentile)
  Page Load: <3 seconds

Queue Depth:
  Feedback Processing: <10 items
  Voice Processing: <5 items
  Payment Processing: <3 items

Database Connections:
  Active: <50 (out of 100 pool)
  Scale Trigger: >80 active connections
  Critical: >95 active connections
```

### 3. Component-Specific Scaling Thresholds

#### API Gateway Scaling
```yaml
Current Capacity:
  - 1 instance: 50 concurrent requests
  - Response time: <200ms average
  - CPU: 1 core handles ~100 requests/minute

Scale Up Triggers:
  - CPU > 80% for 5 minutes
  - Response time > 500ms (95th percentile)
  - Queue depth > 20 requests
  - Memory > 85%

Scaling Actions:
  - Add 1 instance: Handles +50 concurrent requests
  - Add load balancer: Distribute traffic evenly
  - Scale to max 5 instances for pilot phase
```

#### Voice Processing (Ollama) Scaling
```yaml
Current Capacity:
  - 1 instance: 5-8 concurrent voice sessions
  - Processing time: 2-3 seconds per request
  - Memory: 4GB (model + processing)

Scale Up Triggers:
  - Concurrent sessions > 8
  - Processing time > 3 seconds (95th percentile)
  - Queue depth > 5 voice requests
  - Memory > 90% (model memory pressure)

Scaling Challenges:
  - Large model size (requires significant memory)
  - Startup time: 30-60 seconds (model loading)
  - GPU requirements for optimal performance

Scaling Actions:
  - Vertical scale: Increase memory to 8GB
  - Horizontal scale: Add second Ollama instance
  - Load balancing: Round-robin with health checks
  - Pre-warm instances during peak hours
```

#### Database Scaling (Supabase)
```yaml
Current Capacity:
  - Connection pool: 100 connections
  - Read replicas: Available if needed
  - Storage: Unlimited (managed)

Scale Up Triggers:
  - Active connections > 80
  - Query response time > 100ms
  - Connection pool exhaustion warnings
  - Database CPU > 80%

Scaling Actions:
  - Increase connection pool to 200
  - Enable read replicas for analytics queries
  - Optimize slow queries
  - Implement connection pooling in application
```

#### Redis Cache Scaling
```yaml
Current Capacity:
  - Memory: 512MB
  - Single instance
  - Used for session storage, rate limiting

Scale Up Triggers:
  - Memory usage > 400MB (80%)
  - Eviction rate > 100/minute
  - Connection count > 500

Scaling Actions:
  - Increase memory to 1GB
  - Enable Redis clustering
  - Implement Redis Sentinel for HA
  - Optimize cache expiration policies
```

## 🚀 Scaling Procedures

### Automatic Scaling Configuration

#### Docker Compose Auto-scaling
```yaml
# docker-compose.scale.yml already configured with:
api-gateway:
  deploy:
    replicas: 2-5
    resources:
      limits:
        memory: 1.5G
        cpus: "1"
      reservations:
        memory: 1G
        cpus: "0.5"
    
customer-pwa:
  deploy:
    replicas: 2
    resources:
      limits:
        memory: 512M
        cpus: "0.5"

business-dashboard:
  deploy:
    replicas: 2
    resources:
      limits:
        memory: 2G
        cpus: "1.5"
```

#### Manual Scaling Commands
```bash
# Scale specific service
docker-compose -f docker-compose.staging.yml up -d --scale api-gateway=3

# Switch to high-capacity configuration
docker-compose -f docker-compose.scale.yml up -d

# Emergency scaling (all services)
./scripts/emergency-scale.sh --instances=5
```

### Progressive Scaling Strategy

#### Phase 1: Current Pilot (3 Cafés)
```yaml
API Gateway: 1-2 instances
Voice Processing: 1 instance (vertical scaling priority)
Database: Default pool (100 connections)
Redis: 512MB single instance
Monitoring: Basic Grafana dashboards
```

#### Phase 2: Extended Pilot (5-8 Cafés)
```yaml
API Gateway: 2-3 instances
Voice Processing: 2 instances + load balancer
Database: Increased pool (200 connections)
Redis: 1GB + clustering preparation
Monitoring: Enhanced alerting, business metrics
```

#### Phase 3: Regional Rollout (15-25 Cafés)
```yaml
API Gateway: 3-5 instances + HAProxy
Voice Processing: 3-4 instances + dedicated GPU
Database: Read replicas, connection pooling
Redis: Cluster mode (3 nodes)
Monitoring: Multi-tenant dashboards, SLA tracking
```

#### Phase 4: National Scale (50+ Cafés)
```yaml
API Gateway: 5-10 instances + CDN
Voice Processing: Dedicated cluster (8+ instances)
Database: Multi-region, read replicas, partitioning
Redis: Production cluster (6+ nodes)
Monitoring: Full observability stack, predictive scaling
```

## 📋 Scaling Decision Matrix

### When to Scale Up

| Metric | Threshold | Action | Timeline |
|--------|-----------|--------|----------|
| CPU > 80% (5 min) | Scale trigger | Add 1 instance | 5 minutes |
| Memory > 85% (5 min) | Scale trigger | Vertical scale | 2 minutes |
| Response time > 2s | Performance | Add voice instance | 10 minutes |
| Queue depth > 10 | Capacity | Scale processing | 3 minutes |
| DB connections > 80 | Database | Increase pool | 1 minute |
| Error rate > 5% | Reliability | Emergency scale | 2 minutes |

### When to Scale Down

| Metric | Threshold | Action | Timeline |
|--------|-----------|--------|----------|
| CPU < 30% (30 min) | Over-provisioned | Remove 1 instance | 15 minutes |
| Memory < 50% (30 min) | Over-provisioned | Reduce allocation | 10 minutes |
| Traffic < 20% baseline | Low utilization | Scale down by 50% | 20 minutes |
| Night hours (10 PM - 6 AM CET) | Predictable | Scheduled scale down | Automated |

### Cost Optimization Rules

```yaml
Business Hours (8 AM - 8 PM CET):
  - Maintain full capacity
  - Enable auto-scaling
  - Pre-warm voice processing

Off Hours (8 PM - 8 AM CET):
  - Scale down by 50%
  - Keep 1 instance minimum
  - Slower startup acceptable

Weekend Scaling:
  - Reduced capacity (cafés closed)
  - Maintenance window opportunity
  - Testing and updates
```

## 🔧 Scaling Automation Scripts

### Automated Scaling Script
```bash
#!/bin/bash
# scripts/auto-scale.sh

ENVIRONMENT="${1:-staging}"
SCALE_DIRECTION="${2:-up}"  # up/down
SERVICE="${3:-all}"  # api-gateway/voice/all

current_load=$(docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}" | grep api-gateway | awk '{print $2}' | sed 's/%//')

if [[ "$SCALE_DIRECTION" == "up" ]]; then
    if [[ $current_load -gt 80 ]]; then
        echo "High CPU detected ($current_load%), scaling up..."
        docker-compose -f docker-compose.$ENVIRONMENT.yml up -d --scale api-gateway=3
    fi
elif [[ "$SCALE_DIRECTION" == "down" ]]; then
    if [[ $current_load -lt 30 ]]; then
        echo "Low CPU detected ($current_load%), scaling down..."
        docker-compose -f docker-compose.$ENVIRONMENT.yml up -d --scale api-gateway=1
    fi
fi
```

### Capacity Monitoring Script
```bash
#!/bin/bash
# scripts/monitor-capacity.sh

# Collect current metrics
CPU_USAGE=$(docker stats --no-stream --format "{{.CPUPerc}}" | head -1 | sed 's/%//')
MEMORY_USAGE=$(docker stats --no-stream --format "{{.MemPerc}}" | head -1 | sed 's/%//')
DB_CONNECTIONS=$(curl -s "http://localhost:9090/api/v1/query?query=pg_stat_activity_count" | jq '.data.result[0].value[1]' 2>/dev/null || echo "0")

# Check thresholds
if [[ $CPU_USAGE -gt 80 ]]; then
    echo "WARNING: High CPU usage: $CPU_USAGE%"
    ./scripts/auto-scale.sh staging up api-gateway
fi

if [[ $MEMORY_USAGE -gt 85 ]]; then
    echo "WARNING: High memory usage: $MEMORY_USAGE%"
    # Trigger memory optimization or scaling
fi

if [[ $DB_CONNECTIONS -gt 80 ]]; then
    echo "WARNING: High database connections: $DB_CONNECTIONS"
    # Alert database team
fi
```

### Predictive Scaling (Cron Jobs)
```bash
# Crontab entries for predictive scaling

# Scale up before morning rush (7 AM CET)
0 6 * * 1-5 /app/scripts/auto-scale.sh staging up all

# Scale down after evening hours (9 PM CET)  
0 21 * * 1-5 /app/scripts/auto-scale.sh staging down all

# Weekend scaling (reduced capacity)
0 8 * * 6-7 /app/scripts/auto-scale.sh staging down all
0 20 * * 6-7 /app/scripts/auto-scale.sh staging down all

# Monitor capacity every 5 minutes during business hours
*/5 8-20 * * 1-5 /app/scripts/monitor-capacity.sh

# Generate capacity reports weekly
0 9 * * 1 /app/scripts/generate-capacity-report.sh
```

## 📊 Performance Benchmarking

### Load Testing Scenarios

#### Scenario 1: Normal Peak Load
```yaml
Concurrent Users: 15
Session Duration: 4 minutes average
Voice Interactions: 3-5 per session
Expected TPS: 50-75 transactions/second
Duration: 30 minutes
```

#### Scenario 2: High Traffic Spike
```yaml
Concurrent Users: 50
Session Duration: 3 minutes average
Voice Interactions: 2-4 per session
Expected TPS: 150-200 transactions/second
Duration: 15 minutes (burst test)
```

#### Scenario 3: Sustained High Load
```yaml
Concurrent Users: 30
Session Duration: 5 minutes average
Voice Interactions: 4-6 per session
Expected TPS: 100-150 transactions/second
Duration: 2 hours (endurance test)
```

### Performance Targets

```yaml
Response Time Targets:
  Voice Processing: <2s (95th percentile)
  API Endpoints: <500ms (95th percentile)
  Page Load Time: <3s (95th percentile)
  Database Queries: <100ms (95th percentile)

Throughput Targets:
  Feedback Sessions: 100/hour sustained
  Voice Processing: 20 concurrent sessions
  Payment Processing: 10/minute
  Database TPS: 500 transactions/second

Reliability Targets:
  System Uptime: >99.5%
  Error Rate: <1%
  Voice Processing Success: >98%
  Payment Success Rate: >99%
```

## 🎯 Capacity Planning Timeline

### Week 1-2: Monitoring & Baseline
- ✅ Deploy comprehensive monitoring
- ✅ Establish baseline metrics
- ✅ Configure automatic alerts
- ✅ Set up scaling procedures

### Week 3-4: Load Testing
- 🔄 Execute load testing scenarios
- 🔄 Identify bottlenecks and limits
- 🔄 Tune scaling thresholds
- 🔄 Validate auto-scaling behavior

### Month 2: Optimization
- 📊 Analyze performance patterns
- 🔧 Optimize resource allocation
- 📈 Implement predictive scaling
- 🎯 Fine-tune alert thresholds

### Month 3+: Growth Planning
- 📊 Plan for 5-8 café expansion
- 🏗️ Design regional infrastructure
- 💡 Evaluate new technologies (GPU acceleration)
- 📋 Prepare national scaling architecture

## 🚦 Scaling Readiness Checklist

### Before Scaling Up
- [ ] Current performance metrics reviewed
- [ ] Resource utilization confirmed below 80%
- [ ] Database connection pool has capacity
- [ ] Monitoring alerts configured for new instances
- [ ] Load balancer configured (if horizontal scaling)
- [ ] Health checks validated for all services
- [ ] Rollback plan documented and tested

### After Scaling
- [ ] New instances healthy and receiving traffic
- [ ] Performance improved as expected
- [ ] No increase in error rates
- [ ] Resource utilization balanced across instances
- [ ] Monitoring dashboards updated
- [ ] Cost impact reviewed and approved
- [ ] Documentation updated with new capacity

## 💰 Cost Management

### Cost Optimization Strategies

#### Resource Right-sizing
- Monitor actual vs. allocated resources
- Scale down during off-hours
- Use spot instances for development/testing
- Optimize container resource requests/limits

#### Scheduled Scaling
- Reduce capacity during café closed hours
- Weekend scaling adjustments
- Holiday schedule considerations
- Predictive scaling based on historical patterns

#### Cost Monitoring
- Track cost per feedback session
- Monitor resource utilization efficiency
- Set budget alerts and limits
- Regular cost optimization reviews

### Budget Planning
```yaml
Current Monthly Costs (3 Cafés):
  Compute: $200/month
  Database: $100/month
  Storage: $50/month
  Networking: $30/month
  Monitoring: $40/month
  Total: $420/month

Projected Costs (50 Cafés):
  Compute: $2,000/month
  Database: $800/month
  Storage: $200/month
  Networking: $150/month
  Monitoring: $200/month
  Total: $3,350/month

Cost per Feedback Session:
  Current: ~$0.10 per session
  Target at scale: ~$0.05 per session
```

This comprehensive capacity planning guide ensures the Swedish pilot program can scale efficiently while maintaining performance and controlling costs.