# Deployment Guide: AI Feedback Platform

*Complete guide for deploying and managing the AI Feedback Platform in production*

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Infrastructure Setup](#infrastructure-setup)
4. [Environment Configuration](#environment-configuration)
5. [Database Deployment](#database-deployment)
6. [Application Deployment](#application-deployment)
7. [Monitoring & Observability](#monitoring--observability)
8. [Security Hardening](#security-hardening)
9. [Scaling & Performance](#scaling--performance)
10. [Backup & Disaster Recovery](#backup--disaster-recovery)
11. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

### System Architecture

```
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│   Load Balancer     │    │    CDN (CloudFront) │    │   DNS (Route 53)    │
│   (Application LB)  │    │                     │    │                     │
└─────────┬───────────┘    └─────────┬───────────┘    └─────────┬───────────┘
          │                          │                          │
          ▼                          ▼                          ▼
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│   Web Applications  │    │   API Gateway       │    │   Voice Processing  │
│   (Customer PWA,    │    │   (Node.js/Fastify)│    │   (Python/WhisperX) │
│   Business, Admin)  │    │                     │    │                     │
└─────────┬───────────┘    └─────────┬───────────┘    └─────────┬───────────┘
          │                          │                          │
          ▼                          ▼                          ▼
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│   Redis Cache       │    │   PostgreSQL        │    │   AI Models         │
│   (Session/Cache)   │    │   (Supabase)        │    │   (Ollama/qwen2)    │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
```

### Technology Stack

**Frontend Applications:**
- Next.js 14 (React 18)
- TypeScript 5
- Tailwind CSS 3
- PWA capabilities

**Backend Services:**
- Node.js 20 LTS
- Fastify (API framework)
- TypeScript 5
- Prisma ORM

**Databases:**
- PostgreSQL 15 (Primary)
- Redis 7 (Caching/Sessions)
- Supabase (Managed PostgreSQL)

**AI/ML Services:**
- Ollama + qwen2:0.5b (Local inference)
- WhisperX (Voice processing)
- Python 3.11

**Infrastructure:**
- AWS/Azure/Vercel
- Docker containers
- Kubernetes (optional)

---

## Prerequisites

### System Requirements

**Production Environment:**
- **CPU:** 8+ cores (Intel/AMD x64)
- **RAM:** 32GB+ (AI models require significant memory)
- **Storage:** 500GB+ SSD (NVMe preferred)
- **Network:** 1Gbps+ bandwidth, low latency
- **OS:** Ubuntu 22.04 LTS or similar

**Development Environment:**
- **CPU:** 4+ cores
- **RAM:** 16GB+
- **Storage:** 200GB+ SSD
- **Docker:** 20.10+
- **Node.js:** 20 LTS
- **Python:** 3.11+

### Required Tools

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Python 3.11
sudo apt update
sudo apt install python3.11 python3.11-pip python3.11-venv

# Install essential tools
sudo apt install -y git curl wget unzip nginx certbot
```

### Cloud Provider Setup

**AWS Prerequisites:**
```bash
# Install AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Configure AWS CLI
aws configure
# AWS Access Key ID: [Your Access Key]
# AWS Secret Access Key: [Your Secret Key]  
# Default region name: eu-north-1 (Stockholm)
# Default output format: json

# Install eksctl (if using EKS)
curl --silent --location "https://github.com/weaveworks/eksctl/releases/latest/download/eksctl_$(uname -s)_amd64.tar.gz" | tar xz -C /tmp
sudo mv /tmp/eksctl /usr/local/bin
```

---

## Infrastructure Setup

### Docker Compose Deployment (Recommended for Small-Medium Scale)

**production-docker-compose.yml:**
```yaml
version: '3.8'

services:
  # Reverse Proxy
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./nginx/ssl:/etc/nginx/ssl
      - ./nginx/logs:/var/log/nginx
    depends_on:
      - api-gateway
      - customer-pwa
      - business-dashboard
      - admin-dashboard
    restart: unless-stopped

  # API Gateway
  api-gateway:
    image: aifeedback/api-gateway:latest
    environment:
      NODE_ENV: production
      DATABASE_URL: ${DATABASE_URL}
      REDIS_URL: redis://redis:6379
      OLLAMA_ENDPOINT: http://ollama:11434
      STRIPE_SECRET_KEY: ${STRIPE_SECRET_KEY}
      JWT_SECRET: ${JWT_SECRET}
    depends_on:
      - redis
      - ollama
    deploy:
      replicas: 3
      resources:
        limits:
          memory: 1G
          cpus: '1.0'
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Customer PWA
  customer-pwa:
    image: aifeedback/customer-pwa:latest
    environment:
      NODE_ENV: production
      NEXT_PUBLIC_API_URL: https://api.aifeedback.se
    deploy:
      replicas: 2
      resources:
        limits:
          memory: 512M
          cpus: '0.5'
    restart: unless-stopped

  # Business Dashboard
  business-dashboard:
    image: aifeedback/business-dashboard:latest
    environment:
      NODE_ENV: production
      NEXT_PUBLIC_API_URL: https://api.aifeedback.se
    deploy:
      replicas: 2
      resources:
        limits:
          memory: 512M
          cpus: '0.5'
    restart: unless-stopped

  # Admin Dashboard
  admin-dashboard:
    image: aifeedback/admin-dashboard:latest
    environment:
      NODE_ENV: production
      NEXT_PUBLIC_API_URL: https://api.aifeedback.se
    deploy:
      replicas: 1
      resources:
        limits:
          memory: 512M
          cpus: '0.5'
    restart: unless-stopped

  # AI Model Server (Ollama)
  ollama:
    image: ollama/ollama:latest
    volumes:
      - ollama_data:/root/.ollama
    environment:
      - OLLAMA_HOST=0.0.0.0
    deploy:
      resources:
        limits:
          memory: 8G
          cpus: '4.0'
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    restart: unless-stopped
    command: |
      sh -c "
        ollama serve &
        sleep 10
        ollama pull qwen2:0.5b
        wait
      "

  # Voice Processing Service
  voice-processor:
    image: aifeedback/voice-processor:latest
    environment:
      WHISPER_MODEL: large-v2
      REDIS_URL: redis://redis:6379
      API_GATEWAY_URL: http://api-gateway:3001
    volumes:
      - ./models:/app/models
    depends_on:
      - redis
      - api-gateway
    deploy:
      replicas: 2
      resources:
        limits:
          memory: 4G
          cpus: '2.0'
    restart: unless-stopped

  # Redis Cache
  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
      - ./redis/redis.conf:/usr/local/etc/redis/redis.conf
    command: redis-server /usr/local/etc/redis/redis.conf
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '1.0'
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Monitoring
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/usr/share/prometheus/console_libraries'
      - '--web.console.templates=/usr/share/prometheus/consoles'
      - '--web.enable-lifecycle'
    restart: unless-stopped

  grafana:
    image: grafana/grafana:latest
    environment:
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_ADMIN_PASSWORD}
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana/dashboards:/var/lib/grafana/dashboards
    depends_on:
      - prometheus
    restart: unless-stopped

volumes:
  redis_data:
  ollama_data:
  prometheus_data:
  grafana_data:
```

### Kubernetes Deployment (For Large Scale)

**k8s/namespace.yaml:**
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: aifeedback-prod
  labels:
    name: aifeedback-prod
```

**k8s/api-gateway-deployment.yaml:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-gateway
  namespace: aifeedback-prod
spec:
  replicas: 5
  selector:
    matchLabels:
      app: api-gateway
  template:
    metadata:
      labels:
        app: api-gateway
    spec:
      containers:
      - name: api-gateway
        image: aifeedback/api-gateway:latest
        ports:
        - containerPort: 3001
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: database-secrets
              key: url
        - name: REDIS_URL
          value: "redis://redis-service:6379"
        - name: OLLAMA_ENDPOINT
          value: "http://ollama-service:11434"
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3001
          initialDelaySeconds: 5
          periodSeconds: 5

---
apiVersion: v1
kind: Service
metadata:
  name: api-gateway-service
  namespace: aifeedback-prod
spec:
  selector:
    app: api-gateway
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3001
  type: ClusterIP
```

**k8s/ollama-deployment.yaml:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ollama
  namespace: aifeedback-prod
spec:
  replicas: 2
  selector:
    matchLabels:
      app: ollama
  template:
    metadata:
      labels:
        app: ollama
    spec:
      nodeSelector:
        gpu: "true"  # Deploy only on GPU nodes
      containers:
      - name: ollama
        image: ollama/ollama:latest
        ports:
        - containerPort: 11434
        volumeMounts:
        - name: ollama-data
          mountPath: /root/.ollama
        resources:
          requests:
            nvidia.com/gpu: 1
            memory: "4Gi"
            cpu: "2"
          limits:
            nvidia.com/gpu: 1
            memory: "8Gi"
            cpu: "4"
        lifecycle:
          postStart:
            exec:
              command:
              - /bin/sh
              - -c
              - |
                sleep 30
                ollama pull qwen2:0.5b
      volumes:
      - name: ollama-data
        persistentVolumeClaim:
          claimName: ollama-pvc

---
apiVersion: v1
kind: Service
metadata:
  name: ollama-service
  namespace: aifeedback-prod
spec:
  selector:
    app: ollama
  ports:
  - protocol: TCP
    port: 11434
    targetPort: 11434
  type: ClusterIP
```

### Cloud-Native Deployment

**AWS EKS with Terraform:**
```hcl
# eks-cluster.tf
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 19.0"

  cluster_name    = "aifeedback-prod"
  cluster_version = "1.28"

  vpc_id                         = module.vpc.vpc_id
  subnet_ids                     = module.vpc.private_subnets
  cluster_endpoint_public_access = true

  eks_managed_node_groups = {
    general = {
      desired_size = 3
      max_size     = 10
      min_size     = 1

      instance_types = ["m5.large"]
      capacity_type  = "ON_DEMAND"
      
      k8s_labels = {
        Environment = "production"
        NodeGroup   = "general"
      }
    }
    
    gpu = {
      desired_size = 2
      max_size     = 5
      min_size     = 1

      instance_types = ["p3.2xlarge"]
      capacity_type  = "ON_DEMAND"
      
      k8s_labels = {
        Environment = "production"
        NodeGroup   = "gpu"
        gpu         = "true"
      }
      
      taints = [
        {
          key    = "nvidia.com/gpu"
          value  = "true"
          effect = "NO_SCHEDULE"
        }
      ]
    }
  }

  tags = {
    Environment = "production"
    Project     = "aifeedback"
  }
}

# rds.tf
resource "aws_db_instance" "postgres" {
  allocated_storage    = 100
  max_allocated_storage = 1000
  storage_type         = "gp3"
  engine               = "postgres"
  engine_version       = "15.4"
  instance_class       = "db.r6g.xlarge"
  
  db_name  = "aifeedback"
  username = var.db_username
  password = var.db_password
  
  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = aws_db_subnet_group.postgres.name
  
  backup_retention_period = 7
  backup_window          = "03:00-04:00"
  maintenance_window     = "Sun:04:00-Sun:05:00"
  
  deletion_protection = true
  skip_final_snapshot = false
  
  performance_insights_enabled = true
  monitoring_interval         = 60
  
  tags = {
    Name = "aifeedback-postgres-prod"
    Environment = "production"
  }
}

# elasticache.tf
resource "aws_elasticache_replication_group" "redis" {
  replication_group_id       = "aifeedback-redis"
  description                = "Redis cluster for AI Feedback Platform"
  
  num_cache_clusters         = 3
  node_type                  = "cache.r6g.large"
  engine                     = "redis"
  engine_version             = "7.0"
  
  subnet_group_name          = aws_elasticache_subnet_group.redis.name
  security_group_ids         = [aws_security_group.redis.id]
  
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  
  snapshot_retention_limit   = 5
  snapshot_window           = "03:00-05:00"
  
  tags = {
    Name = "aifeedback-redis-prod"
    Environment = "production"
  }
}
```

---

## Environment Configuration

### Environment Variables

**Production .env file:**
```bash
# Application
NODE_ENV=production
PORT=3001
API_BASE_URL=https://api.aifeedback.se
FRONTEND_URL=https://aifeedback.se

# Database
DATABASE_URL=postgresql://user:pass@prod-db.aifeedback.se:5432/aifeedback?sslmode=require
REDIS_URL=redis://prod-redis.aifeedback.se:6379
REDIS_PASSWORD=your_redis_password

# Authentication & Security
JWT_SECRET=your_super_secure_jwt_secret_at_least_32_chars
JWT_EXPIRES_IN=24h
ENCRYPTION_KEY=your_32_byte_hex_encryption_key
SESSION_SECRET=your_session_secret_key

# AI Services
OLLAMA_ENDPOINT=http://ollama-service:11434
OPENAI_API_KEY=sk-your-openai-key-for-fallback
ANTHROPIC_API_KEY=your-anthropic-key-for-fallback

# Voice Processing
WHISPER_MODEL_PATH=/models/whisper-large-v2
TTS_SERVICE_URL=http://voice-processor:8000
VOICE_PROCESSING_TIMEOUT=30000

# Payment Services
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
STRIPE_CONNECT_CLIENT_ID=ca_your_connect_client_id

# POS Integrations
SQUARE_APPLICATION_ID=sq0idp-your-square-app-id
SQUARE_APPLICATION_SECRET=sq0csp-your-square-app-secret
ZETTLE_CLIENT_ID=your_zettle_client_id
ZETTLE_CLIENT_SECRET=your_zettle_client_secret
SHOPIFY_API_KEY=your_shopify_api_key
SHOPIFY_API_SECRET=your_shopify_api_secret

# External Services
SENDGRID_API_KEY=SG.your_sendgrid_api_key
SENTRY_DSN=https://your_sentry_dsn
MIXPANEL_TOKEN=your_mixpanel_token

# Monitoring & Logging
LOG_LEVEL=info
PROMETHEUS_METRICS_ENABLED=true
GRAFANA_URL=https://monitoring.aifeedback.se
NEW_RELIC_LICENSE_KEY=your_new_relic_key

# Storage
S3_BUCKET=aifeedback-prod-assets
S3_REGION=eu-north-1
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key

# CDN & Assets
CDN_URL=https://cdn.aifeedback.se
STATIC_ASSETS_URL=https://assets.aifeedback.se

# Feature Flags
ENABLE_FRAUD_DETECTION=true
ENABLE_A_B_TESTING=true
ENABLE_ANALYTICS=true
MAINTENANCE_MODE=false

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=1000
RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS=true

# GDPR & Privacy
DATA_RETENTION_DAYS=730
VOICE_DATA_RETENTION_HOURS=24
CONSENT_COOKIE_DOMAIN=.aifeedback.se
```

### Configuration Management

**Using AWS Systems Manager Parameter Store:**
```bash
# Store sensitive configuration
aws ssm put-parameter \
  --name "/aifeedback/prod/database-url" \
  --value "postgresql://..." \
  --type "SecureString" \
  --description "Production database URL"

aws ssm put-parameter \
  --name "/aifeedback/prod/stripe-secret-key" \
  --value "sk_live_..." \
  --type "SecureString" \
  --description "Stripe secret key for production"

# Retrieve configuration in application
const AWS = require('aws-sdk');
const ssm = new AWS.SSM();

async function getParameter(name) {
  const result = await ssm.getParameter({
    Name: name,
    WithDecryption: true
  }).promise();
  
  return result.Parameter.Value;
}
```

**Using Kubernetes Secrets:**
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: database-secrets
  namespace: aifeedback-prod
type: Opaque
data:
  url: <base64-encoded-database-url>
  username: <base64-encoded-username>
  password: <base64-encoded-password>

---
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: aifeedback-prod
data:
  NODE_ENV: "production"
  LOG_LEVEL: "info"
  RATE_LIMIT_WINDOW_MS: "900000"
  RATE_LIMIT_MAX_REQUESTS: "1000"
```

---

## Database Deployment

### PostgreSQL Setup

**Database Schema Migration:**
```bash
# Install Prisma CLI
npm install -g prisma

# Set database URL
export DATABASE_URL="postgresql://user:pass@prod-db:5432/aifeedback"

# Run migrations
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate

# Seed database with initial data
npx prisma db seed
```

**Production Database Configuration:**
```sql
-- PostgreSQL configuration for production
-- /etc/postgresql/15/main/postgresql.conf

# Memory settings
shared_buffers = 8GB                    # 25% of total RAM
effective_cache_size = 24GB             # 75% of total RAM
work_mem = 64MB                         # For complex queries
maintenance_work_mem = 1GB              # For maintenance operations

# Checkpoint settings
checkpoint_timeout = 10min
checkpoint_completion_target = 0.9
wal_buffers = 16MB
max_wal_size = 2GB
min_wal_size = 1GB

# Connection settings
max_connections = 200
shared_preload_libraries = 'pg_stat_statements'

# Logging
log_statement = 'mod'                   # Log modifications
log_min_duration_statement = 1000       # Log slow queries (1s+)
log_checkpoints = on
log_connections = on
log_disconnections = on

# Performance monitoring
track_activities = on
track_counts = on
track_functions = all
```

**Database Backup Strategy:**
```bash
#!/bin/bash
# /scripts/backup-database.sh

BACKUP_DIR="/backups/postgresql"
DB_NAME="aifeedback"
DB_HOST="prod-db.aifeedback.se"
DB_USER="backup_user"
RETENTION_DAYS=30

# Create backup directory
mkdir -p $BACKUP_DIR

# Create timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Full backup
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME \
  --format=custom \
  --compress=9 \
  --file="$BACKUP_DIR/aifeedback_full_$TIMESTAMP.backup"

# Incremental WAL backup (if using WAL-E or similar)
wal-e backup-push $BACKUP_DIR/wal_$TIMESTAMP

# Clean old backups
find $BACKUP_DIR -name "*.backup" -mtime +$RETENTION_DAYS -delete

# Upload to S3
aws s3 sync $BACKUP_DIR s3://aifeedback-backups/database/
```

### Redis Configuration

**Production Redis Configuration:**
```conf
# /etc/redis/redis.conf

# Basic settings
port 6379
bind 0.0.0.0
protected-mode yes
requirepass your_redis_password

# Memory management
maxmemory 4gb
maxmemory-policy allkeys-lru
maxmemory-samples 10

# Persistence
save 900 1
save 300 10
save 60 10000
stop-writes-on-bgsave-error yes
rdbcompression yes
dbfilename dump.rdb
dir /var/lib/redis

# AOF persistence
appendonly yes
appendfilename "appendonly.aof"
appendfsync everysec
no-appendfsync-on-rewrite no
auto-aof-rewrite-percentage 100
auto-aof-rewrite-min-size 64mb

# Networking
tcp-keepalive 300
timeout 0
tcp-backlog 511

# Security
rename-command FLUSHDB ""
rename-command FLUSHALL ""
rename-command DEBUG ""
rename-command CONFIG ""

# Logging
loglevel notice
logfile /var/log/redis/redis-server.log
```

---

## Application Deployment

### Container Images

**API Gateway Dockerfile:**
```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/database/package*.json ./packages/database/
RUN npm ci --only=production --ignore-scripts

# Copy source code
COPY packages/ ./packages/
COPY apps/api-gateway/ ./apps/api-gateway/

# Build application
RUN npm run build:api-gateway

FROM node:20-alpine AS runtime

# Install security updates
RUN apk upgrade --no-cache

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

WORKDIR /app

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node dist/health-check.js

USER nodejs

EXPOSE 3001

CMD ["node", "dist/apps/api-gateway/main.js"]
```

**Voice Processing Dockerfile:**
```dockerfile
FROM python:3.11-slim AS base

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    git \
    wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download AI models
RUN python -c "import whisper; whisper.load_model('large-v2')"

# Copy application code
COPY packages/ai-evaluator/src/ ./

# Create non-root user
RUN useradd -m -u 1001 voiceprocessor
USER voiceprocessor

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Deployment Scripts

**Automated Deployment Script:**
```bash
#!/bin/bash
# scripts/deploy.sh

set -e  # Exit on any error

# Configuration
ENVIRONMENT=${1:-production}
DOCKER_REGISTRY="your-registry.com"
VERSION=${2:-$(git rev-parse --short HEAD)}

echo "🚀 Starting deployment to $ENVIRONMENT (version: $VERSION)"

# Build and push Docker images
echo "📦 Building Docker images..."
docker build -t $DOCKER_REGISTRY/api-gateway:$VERSION -f apps/api-gateway/Dockerfile .
docker build -t $DOCKER_REGISTRY/customer-pwa:$VERSION -f apps/customer-pwa/Dockerfile .
docker build -t $DOCKER_REGISTRY/business-dashboard:$VERSION -f apps/business-dashboard/Dockerfile .
docker build -t $DOCKER_REGISTRY/admin-dashboard:$VERSION -f apps/admin-dashboard/Dockerfile .
docker build -t $DOCKER_REGISTRY/voice-processor:$VERSION -f packages/ai-evaluator/Dockerfile .

echo "🔄 Pushing images to registry..."
docker push $DOCKER_REGISTRY/api-gateway:$VERSION
docker push $DOCKER_REGISTRY/customer-pwa:$VERSION
docker push $DOCKER_REGISTRY/business-dashboard:$VERSION
docker push $DOCKER_REGISTRY/admin-dashboard:$VERSION
docker push $DOCKER_REGISTRY/voice-processor:$VERSION

if [ "$ENVIRONMENT" = "production" ]; then
  echo "⚠️  Deploying to PRODUCTION environment"
  read -p "Are you sure you want to continue? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Deployment cancelled"
    exit 1
  fi
fi

# Database migrations
echo "🗄️  Running database migrations..."
export DATABASE_URL=$(kubectl get secret database-secrets -n aifeedback-$ENVIRONMENT -o jsonpath="{.data.url}" | base64 --decode)
npx prisma migrate deploy

# Deploy to Kubernetes
echo "☸️  Deploying to Kubernetes..."
kubectl set image deployment/api-gateway api-gateway=$DOCKER_REGISTRY/api-gateway:$VERSION -n aifeedback-$ENVIRONMENT
kubectl set image deployment/customer-pwa customer-pwa=$DOCKER_REGISTRY/customer-pwa:$VERSION -n aifeedback-$ENVIRONMENT
kubectl set image deployment/business-dashboard business-dashboard=$DOCKER_REGISTRY/business-dashboard:$VERSION -n aifeedback-$ENVIRONMENT
kubectl set image deployment/admin-dashboard admin-dashboard=$DOCKER_REGISTRY/admin-dashboard:$VERSION -n aifeedback-$ENVIRONMENT
kubectl set image deployment/voice-processor voice-processor=$DOCKER_REGISTRY/voice-processor:$VERSION -n aifeedback-$ENVIRONMENT

# Wait for rollout to complete
echo "⏳ Waiting for deployment to complete..."
kubectl rollout status deployment/api-gateway -n aifeedback-$ENVIRONMENT --timeout=300s
kubectl rollout status deployment/customer-pwa -n aifeedback-$ENVIRONMENT --timeout=300s
kubectl rollout status deployment/business-dashboard -n aifeedback-$ENVIRONMENT --timeout=300s

# Health check
echo "🏥 Running health checks..."
sleep 30  # Wait for services to start

if curl -f https://api.aifeedback.se/health; then
  echo "✅ API Gateway health check passed"
else
  echo "❌ API Gateway health check failed"
  exit 1
fi

if curl -f https://aifeedback.se; then
  echo "✅ Customer PWA health check passed"
else
  echo "❌ Customer PWA health check failed"
  exit 1
fi

# Slack notification
curl -X POST -H 'Content-type: application/json' \
  --data "{\"text\":\"✅ AI Feedback Platform deployed successfully to $ENVIRONMENT (version: $VERSION)\"}" \
  $SLACK_WEBHOOK_URL

echo "🎉 Deployment completed successfully!"
```

### Blue-Green Deployment

**Blue-Green Deployment Strategy:**
```bash
#!/bin/bash
# scripts/blue-green-deploy.sh

CURRENT_ENV=$(kubectl get service api-gateway-active -o jsonpath='{.spec.selector.version}')
NEW_ENV=$([ "$CURRENT_ENV" = "blue" ] && echo "green" || echo "blue")

echo "Current environment: $CURRENT_ENV"
echo "Deploying to: $NEW_ENV"

# Deploy to inactive environment
kubectl apply -f k8s/deployments/$NEW_ENV/

# Wait for new environment to be ready
kubectl wait --for=condition=ready pod -l version=$NEW_ENV --timeout=300s

# Run health checks on new environment
kubectl port-forward service/api-gateway-$NEW_ENV 8080:80 &
PORT_FORWARD_PID=$!

sleep 5
if curl -f http://localhost:8080/health; then
  echo "Health check passed for $NEW_ENV environment"
else
  echo "Health check failed for $NEW_ENV environment"
  kill $PORT_FORWARD_PID
  exit 1
fi

kill $PORT_FORWARD_PID

# Switch traffic to new environment
kubectl patch service api-gateway-active -p "{\"spec\":{\"selector\":{\"version\":\"$NEW_ENV\"}}}"

echo "Traffic switched to $NEW_ENV environment"

# Wait and monitor for issues
echo "Monitoring new environment for 5 minutes..."
sleep 300

# If no issues, clean up old environment
echo "Cleaning up old environment: $CURRENT_ENV"
kubectl delete deployment api-gateway-$CURRENT_ENV
kubectl delete deployment customer-pwa-$CURRENT_ENV
kubectl delete deployment business-dashboard-$CURRENT_ENV
```

---

## Monitoring & Observability

### Metrics Collection

**Prometheus Configuration:**
```yaml
# monitoring/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "alert_rules.yml"

scrape_configs:
  - job_name: 'api-gateway'
    static_configs:
      - targets: ['api-gateway:3001']
    metrics_path: '/metrics'
    scrape_interval: 30s

  - job_name: 'voice-processor'
    static_configs:
      - targets: ['voice-processor:8000']
    metrics_path: '/metrics'

  - job_name: 'redis'
    static_configs:
      - targets: ['redis:6379']
    scrape_interval: 60s

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']

  - job_name: 'nginx'
    static_configs:
      - targets: ['nginx-exporter:9113']

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093
```

**Custom Application Metrics:**
```javascript
// packages/shared/src/metrics.js
const client = require('prom-client');

// Create metrics registry
const register = new client.Registry();

// Default metrics (CPU, memory, etc.)
client.collectDefaultMetrics({ register });

// Custom business metrics
const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

const feedbackSessionsTotal = new client.Counter({
  name: 'feedback_sessions_total',
  help: 'Total number of feedback sessions',
  labelNames: ['business_id', 'status', 'quality_tier']
});

const qualityScoreHistogram = new client.Histogram({
  name: 'feedback_quality_score',
  help: 'Distribution of feedback quality scores',
  buckets: [0, 20, 40, 60, 80, 100]
});

const voiceProcessingDuration = new client.Histogram({
  name: 'voice_processing_duration_seconds',
  help: 'Time spent processing voice feedback',
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30]
});

const rewardAmountHistogram = new client.Histogram({
  name: 'reward_amount_sek',
  help: 'Distribution of reward amounts in SEK',
  buckets: [0, 1, 5, 10, 20, 50, 100]
});

// Register metrics
register.registerMetric(httpRequestsTotal);
register.registerMetric(feedbackSessionsTotal);
register.registerMetric(qualityScoreHistogram);
register.registerMetric(voiceProcessingDuration);
register.registerMetric(rewardAmountHistogram);

module.exports = {
  register,
  httpRequestsTotal,
  feedbackSessionsTotal,
  qualityScoreHistogram,
  voiceProcessingDuration,
  rewardAmountHistogram
};
```

### Alert Rules

**Prometheus Alert Rules:**
```yaml
# monitoring/alert_rules.yml
groups:
  - name: api-gateway
    rules:
      - alert: APIGatewayDown
        expr: up{job="api-gateway"} == 0
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "API Gateway is down"
          description: "API Gateway has been down for more than 5 minutes"

      - alert: HighErrorRate
        expr: rate(http_requests_total{status_code=~"5.."}[5m]) > 0.1
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }} requests per second"

      - alert: HighResponseTime
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High response time"
          description: "95th percentile response time is {{ $value }}s"

  - name: voice-processing
    rules:
      - alert: VoiceProcessingFailed
        expr: rate(voice_processing_errors_total[5m]) > 0.05
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "High voice processing failure rate"
          description: "Voice processing error rate: {{ $value }} per second"

      - alert: VoiceProcessingSlowdown
        expr: histogram_quantile(0.95, rate(voice_processing_duration_seconds_bucket[5m])) > 30
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Voice processing is slow"
          description: "95th percentile processing time: {{ $value }}s"

  - name: business-metrics
    rules:
      - alert: FraudRateHigh
        expr: rate(feedback_sessions_total{status="fraud_detected"}[1h]) > 0.02
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High fraud detection rate"
          description: "Fraud rate is {{ $value }} per second"

  - name: infrastructure
    rules:
      - alert: DatabaseDown
        expr: up{job="postgres"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Database is down"
          description: "PostgreSQL database is unreachable"

      - alert: RedisDown
        expr: up{job="redis"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Redis is down"
          description: "Redis cache is unreachable"

      - alert: HighMemoryUsage
        expr: (node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes > 0.9
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage"
          description: "Memory usage is {{ $value }}%"
```

### Logging Strategy

**Structured Logging Configuration:**
```javascript
// packages/shared/src/logger.js
const winston = require('winston');
const { ElasticsearchTransport } = require('winston-elasticsearch');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: process.env.SERVICE_NAME,
    version: process.env.SERVICE_VERSION,
    environment: process.env.NODE_ENV
  },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error'
    }),
    new winston.transports.File({
      filename: 'logs/combined.log'
    })
  ]
});

// Production: Add Elasticsearch transport
if (process.env.NODE_ENV === 'production') {
  logger.add(new ElasticsearchTransport({
    level: 'info',
    clientOpts: { node: process.env.ELASTICSEARCH_URL },
    index: 'aifeedback-logs'
  }));
}

module.exports = logger;
```

---

## Security Hardening

### SSL/TLS Configuration

**Nginx SSL Configuration:**
```nginx
# nginx/ssl.conf
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name api.aifeedback.se;

    # SSL certificates
    ssl_certificate /etc/nginx/ssl/aifeedback.se.crt;
    ssl_certificate_key /etc/nginx/ssl/aifeedback.se.key;
    ssl_trusted_certificate /etc/nginx/ssl/aifeedback.se.ca-bundle;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;
    
    # HSTS
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy "strict-origin-when-cross-origin";
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self';";

    # OCSP stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    resolver 8.8.8.8 8.8.4.4 valid=300s;
    resolver_timeout 5s;

    location / {
        proxy_pass http://api-gateway-backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Security headers for proxied content
        proxy_hide_header X-Powered-By;
    }
}
```

### Container Security

**Security-hardened Dockerfile:**
```dockerfile
FROM node:20-alpine AS base

# Install security updates
RUN apk upgrade --no-cache && \
    apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set secure permissions
RUN mkdir -p /app && \
    chown -R nodejs:nodejs /app

WORKDIR /app

USER nodejs

# Copy package files with correct ownership
COPY --chown=nodejs:nodejs package*.json ./

# Install dependencies
RUN npm ci --only=production --ignore-scripts

# Copy application code
COPY --chown=nodejs:nodejs . .

# Remove unnecessary files
RUN rm -rf .git .gitignore README.md docs/ tests/

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node health-check.js

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

CMD ["node", "server.js"]
```

### Kubernetes Security Policies

**Pod Security Policy:**
```yaml
apiVersion: policy/v1beta1
kind: PodSecurityPolicy
metadata:
  name: aifeedback-psp
spec:
  privileged: false
  allowPrivilegeEscalation: false
  requiredDropCapabilities:
    - ALL
  volumes:
    - 'configMap'
    - 'emptyDir'
    - 'projected'
    - 'secret'
    - 'downwardAPI'
    - 'persistentVolumeClaim'
  runAsUser:
    rule: 'MustRunAsNonRoot'
  seLinux:
    rule: 'RunAsAny'
  fsGroup:
    rule: 'RunAsAny'
```

**Network Policies:**
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: api-gateway-netpol
  namespace: aifeedback-prod
spec:
  podSelector:
    matchLabels:
      app: api-gateway
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: nginx-ingress
    ports:
    - protocol: TCP
      port: 3001
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: redis
    ports:
    - protocol: TCP
      port: 6379
  - to:
    - podSelector:
        matchLabels:
          app: ollama
    ports:
    - protocol: TCP
      port: 11434
```

---

## Scaling & Performance

### Horizontal Pod Autoscaling

**HPA Configuration:**
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-gateway-hpa
  namespace: aifeedback-prod
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-gateway
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  - type: Pods
    pods:
      metric:
        name: http_requests_per_second
      target:
        type: AverageValue
        averageValue: "100"
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 100
        periodSeconds: 60
```

### Database Performance Optimization

**Connection Pooling:**
```javascript
// packages/database/src/connection-pool.js
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,                    // Maximum connections
  idleTimeoutMillis: 30000,   // Close idle connections after 30s
  connectionTimeoutMillis: 2000, // Timeout after 2s
  maxUses: 7500,              // Close connection after 7500 queries
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false
});

// Connection health check
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Received SIGINT. Graceful shutdown...');
  pool.end(() => {
    console.log('Pool has ended');
    process.exit(0);
  });
});

module.exports = pool;
```

### Caching Strategy

**Redis Caching Implementation:**
```javascript
// packages/shared/src/cache.js
const Redis = require('redis');

class CacheManager {
  constructor() {
    this.redis = Redis.createClient({
      url: process.env.REDIS_URL,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true
    });
    
    this.redis.on('error', (err) => {
      console.error('Redis error:', err);
    });
  }
  
  async connect() {
    if (!this.redis.isOpen) {
      await this.redis.connect();
    }
  }
  
  async get(key) {
    try {
      const data = await this.redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }
  
  async set(key, value, ttl = 3600) {
    try {
      await this.redis.setEx(key, ttl, JSON.stringify(value));
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }
  
  async del(key) {
    try {
      await this.redis.del(key);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }
  
  // Business-specific caching methods
  async cacheFeedbackAnalytics(businessId, data) {
    const key = `analytics:${businessId}:${new Date().toISOString().split('T')[0]}`;
    await this.set(key, data, 1800); // 30 minutes
  }
  
  async getCachedAnalytics(businessId) {
    const key = `analytics:${businessId}:${new Date().toISOString().split('T')[0]}`;
    return await this.get(key);
  }
  
  async cacheBusinessProfile(businessId, profile) {
    const key = `profile:${businessId}`;
    await this.set(key, profile, 3600); // 1 hour
  }
}

module.exports = new CacheManager();
```

---

## Backup & Disaster Recovery

### Backup Strategy

**Automated Backup System:**
```bash
#!/bin/bash
# scripts/backup-system.sh

set -e

BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/$BACKUP_DATE"
S3_BUCKET="aifeedback-backups"

mkdir -p $BACKUP_DIR

echo "🗄️  Starting database backup..."
pg_dump $DATABASE_URL \
  --format=custom \
  --compress=9 \
  --no-owner \
  --no-privileges \
  --file="$BACKUP_DIR/database.backup"

echo "📁 Backing up Redis data..."
redis-cli --rdb $BACKUP_DIR/redis.rdb

echo "🔧 Backing up configuration files..."
tar -czf $BACKUP_DIR/config.tar.gz \
  docker-compose.yml \
  .env.production \
  nginx/ \
  k8s/ \
  monitoring/

echo "📊 Creating backup manifest..."
cat > $BACKUP_DIR/manifest.json << EOF
{
  "backup_date": "$BACKUP_DATE",
  "components": [
    "postgresql_database",
    "redis_cache",
    "configuration_files"
  ],
  "database_size": "$(du -h $BACKUP_DIR/database.backup | cut -f1)",
  "total_size": "$(du -h $BACKUP_DIR | tail -1 | cut -f1)",
  "backup_host": "$(hostname)",
  "backup_user": "$(whoami)"
}
EOF

echo "☁️  Uploading to S3..."
aws s3 sync $BACKUP_DIR s3://$S3_BUCKET/backups/$BACKUP_DATE/

echo "🧹 Cleaning up local backups older than 7 days..."
find /backups -type d -mtime +7 -exec rm -rf {} +

echo "✅ Backup completed successfully"
```

### Disaster Recovery Plan

**Recovery Procedures:**
```bash
#!/bin/bash
# scripts/disaster-recovery.sh

BACKUP_DATE=${1:-latest}
S3_BUCKET="aifeedback-backups"

echo "🚨 Starting disaster recovery from backup: $BACKUP_DATE"

# Download backup from S3
echo "📥 Downloading backup from S3..."
aws s3 sync s3://$S3_BUCKET/backups/$BACKUP_DATE/ ./recovery/

# Restore database
echo "🗄️  Restoring database..."
createdb aifeedback_recovery
pg_restore --dbname=aifeedback_recovery \
  --clean --if-exists \
  ./recovery/database.backup

# Restore Redis (if needed)
echo "📁 Restoring Redis data..."
redis-cli --rdb ./recovery/redis.rdb

# Update DNS to maintenance page
echo "🚧 Switching to maintenance mode..."
aws route53 change-resource-record-sets \
  --hosted-zone-id Z123456789 \
  --change-batch file://dns-maintenance-mode.json

# Deploy recovered system
echo "🚀 Deploying recovered system..."
kubectl apply -f k8s/recovery/

# Wait for system to be healthy
echo "⏳ Waiting for system recovery..."
timeout 300 bash -c 'until kubectl get pods -l app=api-gateway | grep Running; do sleep 5; done'

# Run health checks
echo "🏥 Running health checks..."
if curl -f https://api.aifeedback.se/health; then
  echo "✅ System recovered successfully"
  
  # Switch DNS back to production
  aws route53 change-resource-record-sets \
    --hosted-zone-id Z123456789 \
    --change-batch file://dns-production-mode.json
    
  echo "🎉 Disaster recovery completed"
else
  echo "❌ Health check failed - system not fully recovered"
  exit 1
fi
```

### Point-in-Time Recovery

**Database PITR Setup:**
```sql
-- Enable point-in-time recovery
ALTER SYSTEM SET wal_level = replica;
ALTER SYSTEM SET archive_mode = on;
ALTER SYSTEM SET archive_command = 'test ! -f /backup/wal/%f && cp %p /backup/wal/%f';
ALTER SYSTEM SET max_wal_senders = 3;
ALTER SYSTEM SET wal_keep_size = '1GB';

-- Restart PostgreSQL to apply settings
SELECT pg_reload_conf();

-- Create base backup for PITR
SELECT pg_start_backup('Base backup for PITR', false, false);
-- Copy data directory to backup location
SELECT pg_stop_backup(false, true);
```

---

## Troubleshooting

### Common Issues

**1. Application Won't Start**
```bash
# Check container logs
docker logs aifeedback-api-gateway

# Check Kubernetes pod logs
kubectl logs -f deployment/api-gateway -n aifeedback-prod

# Check environment variables
kubectl describe pod <pod-name> -n aifeedback-prod

# Common fixes:
# - Verify database connectivity
# - Check environment variable configuration
# - Ensure sufficient resources allocated
# - Verify image pull secrets
```

**2. Database Connection Issues**
```bash
# Test database connection
psql $DATABASE_URL -c "SELECT version();"

# Check connection pool status
kubectl exec -it <api-gateway-pod> -- npm run db:status

# Check database logs
kubectl logs -f statefulset/postgres -n aifeedback-prod

# Common fixes:
# - Verify connection string format
# - Check network policies
# - Ensure database credentials are correct
# - Check SSL requirements
```

**3. High Memory Usage**
```bash
# Check memory usage by pod
kubectl top pods -n aifeedback-prod

# Check Node.js heap usage
kubectl exec -it <api-gateway-pod> -- node -e "console.log(process.memoryUsage())"

# Analyze memory leaks
kubectl exec -it <api-gateway-pod> -- npm run heap-snapshot

# Common fixes:
# - Increase memory limits
# - Check for memory leaks in application code
# - Optimize database queries
# - Adjust garbage collection settings
```

**4. Voice Processing Failures**
```bash
# Check voice processor logs
kubectl logs -f deployment/voice-processor -n aifeedback-prod

# Test voice processing endpoint
curl -X POST http://voice-processor:8000/health

# Check GPU resources (if using GPU)
kubectl describe node <gpu-node-name>

# Common fixes:
# - Verify audio file format
# - Check available GPU memory
# - Ensure proper model loading
# - Verify Python dependencies
```

### Performance Debugging

**Application Performance Analysis:**
```javascript
// Add to your Node.js application for debugging
const v8 = require('v8');
const fs = require('fs');

// Generate heap snapshot
function generateHeapSnapshot() {
  const heapSnapshot = v8.getHeapSnapshot();
  const fileName = `heap-${Date.now()}.heapsnapshot`;
  
  const fileStream = fs.createWriteStream(fileName);
  heapSnapshot.pipe(fileStream);
  
  console.log(`Heap snapshot saved to ${fileName}`);
}

// Profile CPU usage
function profileCPU(duration = 60000) {
  const session = new (require('inspector').Session)();
  session.connect();
  
  session.post('Profiler.enable', () => {
    session.post('Profiler.start', () => {
      setTimeout(() => {
        session.post('Profiler.stop', (err, { profile }) => {
          fs.writeFileSync(`cpu-profile-${Date.now()}.json`, JSON.stringify(profile));
          console.log('CPU profile saved');
          session.disconnect();
        });
      }, duration);
    });
  });
}

// Monitor event loop delay
const { monitorEventLoopDelay } = require('perf_hooks');
const histogram = monitorEventLoopDelay({ resolution: 20 });
histogram.enable();

setInterval(() => {
  console.log('Event Loop Delay:', {
    min: histogram.min,
    max: histogram.max,
    mean: histogram.mean,
    stddev: histogram.stddev,
    percentiles: {
      50: histogram.percentile(50),
      90: histogram.percentile(90),
      99: histogram.percentile(99)
    }
  });
  histogram.reset();
}, 60000);
```

### Log Analysis

**Centralized Logging with ELK Stack:**
```bash
# Search for errors in the last hour
curl -X POST "elasticsearch:9200/aifeedback-logs-*/_search" \
  -H "Content-Type: application/json" \
  -d '{
    "query": {
      "bool": {
        "must": [
          {"match": {"level": "error"}},
          {"range": {"@timestamp": {"gte": "now-1h"}}}
        ]
      }
    },
    "sort": [{"@timestamp": {"order": "desc"}}],
    "size": 100
  }'

# Find high-frequency error patterns
curl -X POST "elasticsearch:9200/aifeedback-logs-*/_search" \
  -H "Content-Type: application/json" \
  -d '{
    "aggs": {
      "error_messages": {
        "terms": {
          "field": "message.keyword",
          "size": 10
        }
      }
    },
    "query": {
      "bool": {
        "must": [
          {"match": {"level": "error"}},
          {"range": {"@timestamp": {"gte": "now-24h"}}}
        ]
      }
    },
    "size": 0
  }'
```

---

## Support & Maintenance

### Maintenance Procedures

**Regular Maintenance Checklist:**
```bash
#!/bin/bash
# scripts/maintenance.sh

echo "🔧 Starting system maintenance..."

# Update system packages
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Clean up Docker resources
echo "🐳 Cleaning Docker resources..."
docker system prune -f
docker image prune -f

# Update SSL certificates
echo "🔒 Checking SSL certificates..."
certbot renew --nginx --quiet

# Rotate log files
echo "📄 Rotating log files..."
logrotate -f /etc/logrotate.conf

# Backup database
echo "🗄️  Creating database backup..."
./scripts/backup-database.sh

# Check disk space
echo "💾 Checking disk space..."
df -h | grep -E "(8[0-9]|9[0-9])%" && echo "⚠️  Warning: Low disk space detected"

# Security updates check
echo "🛡️  Checking for security updates..."
unattended-upgrade --dry-run

echo "✅ Maintenance completed"
```

### Monitoring Dashboard

**Grafana Dashboard Configuration:**
```json
{
  "dashboard": {
    "id": null,
    "title": "AI Feedback Platform - Production",
    "tags": ["aifeedback", "production"],
    "timezone": "Europe/Stockholm",
    "panels": [
      {
        "title": "API Gateway Requests/sec",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "{{method}} {{route}}"
          }
        ]
      },
      {
        "title": "Response Time (95th percentile)",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "95th percentile"
          }
        ]
      },
      {
        "title": "Voice Processing Queue",
        "type": "singlestat",
        "targets": [
          {
            "expr": "voice_processing_queue_size",
            "legendFormat": "Queue Size"
          }
        ]
      },
      {
        "title": "Error Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total{status_code=~\"5..\"}[5m])",
            "legendFormat": "5xx errors"
          }
        ]
      }
    ]
  }
}
```

### Contact Information

**Emergency Contacts:**
- **On-Call Engineer:** +46-70-123-4567
- **DevOps Team:** devops@aifeedback.se
- **Security Team:** security@aifeedback.se

**Escalation Procedures:**
1. **Level 1:** On-call engineer (15 min response)
2. **Level 2:** Senior DevOps engineer (30 min response)
3. **Level 3:** CTO and senior management (1 hour response)

**External Support:**
- **AWS Support:** Enterprise support plan
- **Database Support:** PostgreSQL commercial support
- **Monitoring:** New Relic/DataDog enterprise support

---

*Last Updated: October 26, 2024*  
*Version: 1.0.0*  
*© 2024 AI Feedback Platform AB*