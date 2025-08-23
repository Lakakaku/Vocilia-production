# AI Feedback Platform - Deployment Guide

This guide covers the complete production deployment setup for the AI Feedback Platform.

## 🚀 Quick Start

### Development Environment
```bash
# Clone and setup
git clone <repository>
cd ai-feedback-platform

# Start development environment
./scripts/deploy-dev.sh
```

### Production Deployment
```bash
# Setup production environment
cp .env.production .env.local  # Configure with real values
./scripts/deploy-prod.sh
```

## 📋 Prerequisites

### System Requirements
- **OS**: Ubuntu 20.04+ LTS (recommended)
- **CPU**: 4+ cores (8+ recommended for production)
- **RAM**: 8GB minimum (16GB+ recommended)
- **Storage**: 50GB+ SSD
- **Network**: Static IP with domain access

### Software Dependencies
- Docker 24.0+ & Docker Compose 2.0+
- Git 2.30+
- SSL certificates (Let's Encrypt recommended)
- Domain name with DNS access

### External Services Required
- **Supabase**: PostgreSQL database hosting
- **Redis**: Managed Redis service (optional - Docker included)
- **Ollama**: AI model hosting (self-hosted or cloud)
- **Stripe**: Payment processing
- **Sentry**: Error monitoring (optional)

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                    Nginx (Port 80/443)             │
│           SSL Termination & Load Balancing         │
└─────────────────┬───────────────────────────────────┘
                  │
    ┌─────────────┼─────────────┐
    │             │             │
┌───▼───┐    ┌───▼───┐    ┌───▼───┐
│  PWA  │    │Business│    │ Admin │
│:3000  │    │ :3002  │    │ :3003 │
└───┬───┘    └───┬───┘    └───┬───┘
    │            │            │
    └─────────┬──┴────────────┘
              │
         ┌────▼────┐
         │   API   │
         │ Gateway │
         │  :3001  │
         └────┬────┘
              │
    ┌─────────┼─────────────┐
    │         │             │
┌───▼───┐ ┌──▼──┐ ┌─────────▼──────────┐
│ Redis │ │Supabase     External       │
│ :6379 │ │Database     Services       │
└───────┘ └─────┘ └────────────────────┘
```

## 📁 Project Structure

```
ai-feedback-platform/
├── apps/
│   ├── api-gateway/           # Main backend API
│   ├── customer-pwa/          # Customer mobile web app
│   ├── business-dashboard/    # Business insights portal
│   └── admin-dashboard/       # Admin management panel
├── packages/
│   ├── database/              # Database schemas & migrations
│   ├── shared-types/          # Shared TypeScript types
│   └── ai-evaluator/          # AI feedback evaluation logic
├── services/                  # Microservices (future expansion)
├── nginx/                     # Reverse proxy configuration
├── monitoring/                # Grafana, Prometheus, Loki configs
├── scripts/                   # Deployment & management scripts
├── .github/workflows/         # CI/CD pipelines
├── docker-compose.dev.yml     # Development environment
├── docker-compose.prod.yml    # Production environment
└── DEPLOYMENT.md             # This file
```

## 🔧 Configuration

### Environment Variables

#### Core Application (.env.production)
```bash
# Database - Supabase
DATABASE_URL="postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres"
SUPABASE_URL="https://[PROJECT].supabase.co"
SUPABASE_ANON_KEY="[ANON_KEY]"
SUPABASE_SERVICE_ROLE_KEY="[SERVICE_KEY]"

# Redis
REDIS_URL="redis://[HOST]:6379"

# AI Services
OLLAMA_ENDPOINT="http://localhost:11434"
OPENAI_API_KEY="sk-[KEY]"  # Fallback
ANTHROPIC_API_KEY="[KEY]"  # Fallback

# Security
JWT_SECRET="[256_BIT_SECRET]"
SESSION_SECRET="[256_BIT_SECRET]"
ENCRYPTION_KEY="[32_CHAR_KEY]"

# Payment Processing
STRIPE_SECRET_KEY="sk_live_[KEY]"
STRIPE_WEBHOOK_SECRET="whsec_[SECRET]"

# External URLs
NEXT_PUBLIC_API_URL="https://api.feedback.your-domain.com"
NEXT_PUBLIC_WS_URL="wss://api.feedback.your-domain.com"
```

### SSL Certificates

#### Using Let's Encrypt (Recommended)
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Generate certificates
sudo certbot certonly --nginx -d feedback.your-domain.com
sudo certbot certonly --nginx -d business.feedback.your-domain.com
sudo certbot certonly --nginx -d admin.feedback.your-domain.com

# Copy to nginx directory
sudo cp /etc/letsencrypt/live/feedback.your-domain.com/fullchain.pem nginx/ssl/feedback.crt
sudo cp /etc/letsencrypt/live/feedback.your-domain.com/privkey.pem nginx/ssl/feedback.key
# Repeat for other domains...

# Setup auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### DNS Configuration
```
# Required DNS records:
feedback.your-domain.com        A    [SERVER_IP]
business.feedback.your-domain.com A   [SERVER_IP]
admin.feedback.your-domain.com    A   [SERVER_IP]
api.feedback.your-domain.com      A   [SERVER_IP]
```

## 🚀 Deployment Process

### 1. Server Preparation
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Create application directory
sudo mkdir -p /opt/ai-feedback-platform
sudo chown $USER:$USER /opt/ai-feedback-platform
cd /opt/ai-feedback-platform
```

### 2. Application Setup
```bash
# Clone repository
git clone https://github.com/your-org/ai-feedback-platform.git .

# Setup environment
cp .env.production .env.local
# Edit .env.local with production values

# Setup SSL certificates
mkdir -p nginx/ssl
# Copy your SSL certificates here

# Make scripts executable
chmod +x scripts/*.sh
```

### 3. Production Deployment
```bash
# Deploy production environment
./scripts/deploy-prod.sh

# Verify deployment
./scripts/health-check.sh

# Monitor logs
docker-compose -f docker-compose.prod.yml logs -f
```

## 📊 Monitoring & Observability

### Built-in Monitoring Stack
- **Prometheus**: Metrics collection (port 9090)
- **Grafana**: Visualization dashboard (port 3001)
- **Loki**: Log aggregation (port 3100)
- **Promtail**: Log shipping

### Key Metrics Monitored
- **Performance**: Response times, throughput, error rates
- **Voice Processing**: Audio processing latency, quality scores
- **AI Services**: Model response times, accuracy metrics
- **Infrastructure**: CPU, memory, disk usage
- **Business**: Feedback sessions, conversion rates, fraud detection

### Accessing Monitoring
```bash
# Grafana Dashboard
https://your-domain.com:3001
Username: admin
Password: [GRAFANA_ADMIN_PASSWORD]

# Prometheus Metrics
https://your-domain.com:9090

# Direct container logs
docker-compose -f docker-compose.prod.yml logs [service_name]
```

## 🔒 Security Configuration

### Firewall Setup (UFW)
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### Security Headers (Nginx)
The nginx configuration includes:
- SSL/TLS enforcement
- Security headers (CSP, HSTS, etc.)
- Rate limiting
- CORS configuration
- Request size limits

### Application Security
- JWT token authentication
- Rate limiting per IP/user
- Input validation and sanitization
- SQL injection prevention (Prisma ORM)
- XSS protection
- Fraud detection algorithms

## 🔄 CI/CD Pipeline

### GitHub Actions Workflows

#### CI Pipeline (.github/workflows/ci.yml)
- Code quality checks (ESLint, Prettier)
- TypeScript compilation
- Unit and integration tests
- Security scanning (CodeQL, Snyk, npm audit)
- Docker image building and scanning
- iOS Safari compatibility tests

#### CD Pipeline (.github/workflows/deploy.yml)
- Automated staging deployment
- Smoke testing
- Production deployment with approval
- Health monitoring
- Automatic rollback on failure

### Deployment Environments
- **Development**: Local Docker Compose
- **Staging**: Automated deployment from main branch
- **Production**: Manual approval required

## 📚 Operation Procedures

### Daily Operations
```bash
# Check system health
./scripts/health-check.sh

# View recent logs
docker-compose -f docker-compose.prod.yml logs --tail=100

# Monitor system resources
docker stats

# Check running services
docker-compose -f docker-compose.prod.yml ps
```

### Scaling Operations
```bash
# Scale specific services
docker-compose -f docker-compose.prod.yml up -d --scale customer-pwa=3

# Update resource limits
# Edit docker-compose.prod.yml and restart services
```

### Maintenance
```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Update Docker images
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d

# Clean up unused resources
docker system prune -f --volumes
```

### Backup Procedures
```bash
# Database backup (automated via Supabase)
# Verify backups are working in Supabase dashboard

# Application backup
tar -czf "app-backup-$(date +%Y%m%d).tar.gz" \
    --exclude=node_modules --exclude=.git .

# Redis backup (if using local Redis)
docker-compose -f docker-compose.prod.yml exec redis redis-cli BGSAVE
```

## 🆘 Troubleshooting

### Common Issues

#### Service Won't Start
```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs [service_name]

# Check container status
docker-compose -f docker-compose.prod.yml ps

# Restart service
docker-compose -f docker-compose.prod.yml restart [service_name]
```

#### High CPU/Memory Usage
```bash
# Monitor resources
docker stats

# Scale down if needed
docker-compose -f docker-compose.prod.yml up -d --scale [service]=1

# Check for memory leaks in logs
docker-compose -f docker-compose.prod.yml logs [service] | grep -i "memory\|heap"
```

#### SSL Certificate Issues
```bash
# Check certificate expiry
openssl x509 -enddate -noout -in nginx/ssl/feedback.crt

# Renew Let's Encrypt certificates
sudo certbot renew --dry-run
sudo certbot renew

# Reload nginx after renewal
docker-compose -f docker-compose.prod.yml restart nginx
```

#### Database Connection Issues
```bash
# Check Supabase status
curl -f https://[project].supabase.co/rest/v1/

# Verify environment variables
cat .env.production | grep DATABASE_URL

# Test connection from container
docker-compose -f docker-compose.prod.yml exec api-gateway \
    node -e "console.log('DB:', process.env.DATABASE_URL)"
```

### Performance Optimization

#### Application Performance
- **Enable caching**: Redis caching for API responses
- **CDN setup**: Use CloudFlare or similar for static assets
- **Database optimization**: Query optimization, proper indexing
- **Load balancing**: Scale horizontally with multiple instances

#### Infrastructure Optimization
- **SSD storage**: Ensure fast disk I/O
- **Network optimization**: Use high-bandwidth connections
- **Resource monitoring**: Monitor CPU, RAM, disk usage
- **Container limits**: Set appropriate resource limits

## 📞 Support & Maintenance

### Getting Help
- **Documentation**: Check this deployment guide
- **Logs**: Always check application logs first
- **Health checks**: Run health check script
- **Monitoring**: Check Grafana dashboards

### Regular Maintenance Schedule
- **Daily**: Health checks, log review
- **Weekly**: Security updates, performance review
- **Monthly**: Full system backup verification
- **Quarterly**: Security audit, dependency updates

### Emergency Contacts
- **Technical**: [Your technical team]
- **Infrastructure**: [Your infrastructure provider]
- **External Services**: Supabase, Stripe support

---

For additional support or questions, please refer to the main project documentation or contact the development team.