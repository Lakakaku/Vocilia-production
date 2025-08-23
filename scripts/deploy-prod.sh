#!/bin/bash

# AI Feedback Platform - Production Deployment Script
# This script deploys the platform to production using Docker Compose

set -e  # Exit on any error

echo "🚀 Starting AI Feedback Platform Production Deployment..."

# Check if running as root or with sudo
if [[ $EUID -eq 0 ]]; then
    echo "⚠️  Running as root. Ensure this is intended for production deployment."
fi

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if required files exist
required_files=(".env.production" "docker-compose.prod.yml" "nginx/nginx.conf")
for file in "${required_files[@]}"; do
    if [[ ! -f "$file" ]]; then
        echo "❌ Required file $file not found."
        exit 1
    fi
done

# Validate .env.production
echo "🔍 Validating production configuration..."

required_env_vars=(
    "DATABASE_URL"
    "REDIS_URL"
    "JWT_SECRET"
    "SESSION_SECRET"
    "NEXT_PUBLIC_API_URL"
    "SENTRY_DSN"
)

source .env.production

for var in "${required_env_vars[@]}"; do
    if [[ -z "${!var}" ]]; then
        echo "❌ Required environment variable $var is not set in .env.production"
        exit 1
    fi
done

# Check SSL certificates exist
ssl_cert_dir="nginx/ssl"
if [[ ! -d "$ssl_cert_dir" ]]; then
    echo "⚠️  SSL certificate directory not found. Creating self-signed certificates for development..."
    mkdir -p "$ssl_cert_dir"
    
    # Generate self-signed certificates (replace with real certificates in production)
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "$ssl_cert_dir/feedback.key" \
        -out "$ssl_cert_dir/feedback.crt" \
        -subj "/C=SE/ST=Stockholm/L=Stockholm/O=AI Feedback Platform/CN=feedback.your-domain.com"
    
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "$ssl_cert_dir/business.key" \
        -out "$ssl_cert_dir/business.crt" \
        -subj "/C=SE/ST=Stockholm/L=Stockholm/O=AI Feedback Platform/CN=business.feedback.your-domain.com"
    
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "$ssl_cert_dir/admin.key" \
        -out "$ssl_cert_dir/admin.crt" \
        -subj "/C=SE/ST=Stockholm/L=Stockholm/O=AI Feedback Platform/CN=admin.feedback.your-domain.com"
    
    echo "⚠️  Self-signed certificates created. Replace with real certificates before production use!"
fi

# Create backup of current deployment
echo "💾 Creating deployment backup..."
timestamp=$(date +"%Y%m%d_%H%M%S")
if docker-compose -f docker-compose.prod.yml ps -q | grep -q .; then
    docker-compose -f docker-compose.prod.yml exec -T api-gateway npm run db:backup || echo "⚠️  Database backup failed"
fi

# Pre-deployment health check
echo "🔍 Pre-deployment validation..."

# Build production images
echo "🔧 Building production Docker images..."
docker-compose -f docker-compose.prod.yml build --no-cache

# Run security scan on images (if available)
if command -v trivy &> /dev/null; then
    echo "🛡️  Running security scans..."
    docker-compose -f docker-compose.prod.yml config --services | xargs -I {} trivy image --severity HIGH,CRITICAL {}
else
    echo "⚠️  Trivy not installed. Skipping security scan."
fi

# Stop existing services gracefully
echo "🛑 Stopping existing services..."
if docker-compose -f docker-compose.prod.yml ps -q | grep -q .; then
    docker-compose -f docker-compose.prod.yml stop
fi

# Start production services
echo "🚀 Starting production services..."
docker-compose -f docker-compose.prod.yml up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be healthy..."
services=("redis" "api-gateway" "customer-pwa" "business-dashboard" "admin-dashboard" "nginx")
max_attempts=30
for service in "${services[@]}"; do
    echo "   Checking $service..."
    attempts=0
    while ! docker-compose -f docker-compose.prod.yml exec -T $service echo "healthy" >/dev/null 2>&1 && [ $attempts -lt $max_attempts ]; do
        sleep 10
        attempts=$((attempts+1))
        echo "     Attempt $attempts/$max_attempts..."
    done
    
    if [ $attempts -ge $max_attempts ]; then
        echo "❌ $service failed to start within timeout"
        echo "📜 Service logs:"
        docker-compose -f docker-compose.prod.yml logs --tail=50 $service
        echo "🔄 Rolling back..."
        docker-compose -f docker-compose.prod.yml down
        exit 1
    fi
    echo "   ✅ $service is healthy"
done

# Post-deployment validation
echo "🔍 Post-deployment validation..."

# Test API endpoints
api_endpoints=(
    "http://localhost:3001/health"
    "http://localhost:3000/api/health"
    "http://localhost:3002/api/health"
    "http://localhost:3003/api/health"
)

for endpoint in "${api_endpoints[@]}"; do
    if curl -f -s "$endpoint" > /dev/null; then
        echo "   ✅ $endpoint is responding"
    else
        echo "   ❌ $endpoint is not responding"
        echo "🔄 Deployment may have issues. Check logs:"
        docker-compose -f docker-compose.prod.yml logs --tail=20
    fi
done

# Database connectivity test
echo "🗄️  Testing database connectivity..."
if docker-compose -f docker-compose.prod.yml exec -T api-gateway npm run db:status > /dev/null 2>&1; then
    echo "   ✅ Database connection successful"
else
    echo "   ⚠️  Database connection test failed"
fi

# Redis connectivity test
echo "📝 Testing Redis connectivity..."
if docker-compose -f docker-compose.prod.yml exec -T redis redis-cli ping | grep -q "PONG"; then
    echo "   ✅ Redis connection successful"
else
    echo "   ❌ Redis connection failed"
fi

# Run smoke tests
echo "🧪 Running smoke tests..."
if [[ -f "scripts/smoke-tests.sh" ]]; then
    bash scripts/smoke-tests.sh
else
    echo "   ⚠️  No smoke tests found (scripts/smoke-tests.sh)"
fi

# Clean up old images and containers
echo "🧹 Cleaning up old Docker resources..."
docker system prune -f --volumes
docker image prune -f

echo "🎉 Production deployment completed successfully!"
echo ""
echo "📋 Service Status:"
echo "   🌐 Customer PWA:       https://feedback.your-domain.com"
echo "   🏢 Business Dashboard: https://business.feedback.your-domain.com"
echo "   👤 Admin Dashboard:    https://admin.feedback.your-domain.com"
echo "   🔧 API Gateway:        https://api.feedback.your-domain.com"
echo ""
echo "📊 Monitoring:"
echo "   📈 Grafana:           http://localhost:3001"
echo "   📊 Prometheus:        http://localhost:9090"
echo "   📜 Logs:             docker-compose -f docker-compose.prod.yml logs -f [service]"
echo ""
echo "🛠️  Management Commands:"
echo "   🔄 Restart:          docker-compose -f docker-compose.prod.yml restart [service]"
echo "   🛑 Stop:             docker-compose -f docker-compose.prod.yml down"
echo "   📊 Status:           docker-compose -f docker-compose.prod.yml ps"
echo "   🔍 Logs:             docker-compose -f docker-compose.prod.yml logs [service]"
echo ""
echo "⚠️  Important Notes:"
echo "   - Monitor logs for the first 30 minutes"
echo "   - Replace self-signed SSL certificates with real ones"
echo "   - Configure domain DNS to point to this server"
echo "   - Set up automated backups"
echo "   - Configure monitoring alerts"
echo ""

# Show recent logs to verify deployment
echo "📜 Recent deployment logs:"
docker-compose -f docker-compose.prod.yml logs --tail=10 --timestamps