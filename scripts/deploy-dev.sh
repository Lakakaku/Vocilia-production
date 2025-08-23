#!/bin/bash

# AI Feedback Platform - Development Deployment Script
# This script sets up the development environment using Docker Compose

set -e  # Exit on any error

echo "🚀 Starting AI Feedback Platform Development Deployment..."

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if required environment file exists
if [[ ! -f .env.example ]]; then
    echo "❌ .env.example file not found. Please ensure you're in the project root directory."
    exit 1
fi

# Create .env.local for development if it doesn't exist
if [[ ! -f .env.local ]]; then
    echo "📝 Creating .env.local from .env.example..."
    cp .env.example .env.local
    echo "⚠️  Please edit .env.local with your development configuration before proceeding."
    echo "   Key variables to set:"
    echo "   - DATABASE_URL (if not using Docker Postgres)"
    echo "   - REDIS_URL (if not using Docker Redis)"
    echo "   - OLLAMA_ENDPOINT (if not using Docker Ollama)"
    echo ""
    read -p "Press Enter to continue after configuring .env.local..."
fi

# Check if package.json exists (basic project validation)
if [[ ! -f package.json ]]; then
    echo "❌ package.json not found. Please ensure you're in the project root directory."
    exit 1
fi

echo "🔧 Building Docker images..."

# Build and start services
docker-compose -f docker-compose.dev.yml down --volumes --remove-orphans
docker-compose -f docker-compose.dev.yml build --no-cache

echo "🐳 Starting development services..."
docker-compose -f docker-compose.dev.yml up -d

echo "⏳ Waiting for services to be healthy..."

# Wait for services to be ready
services=("postgres" "redis" "ollama")
for service in "${services[@]}"; do
    echo "   Checking $service..."
    timeout=60
    while ! docker-compose -f docker-compose.dev.yml exec -T $service echo "healthy" >/dev/null 2>&1 && [ $timeout -gt 0 ]; do
        sleep 2
        timeout=$((timeout-2))
    done
    
    if [ $timeout -le 0 ]; then
        echo "❌ $service failed to start within timeout"
        docker-compose -f docker-compose.dev.yml logs $service
        exit 1
    fi
    echo "   ✅ $service is ready"
done

echo "📦 Installing dependencies..."

# Install dependencies in the development containers
docker-compose -f docker-compose.dev.yml exec -T api-gateway npm ci
docker-compose -f docker-compose.dev.yml exec -T customer-pwa npm ci
docker-compose -f docker-compose.dev.yml exec -T business-dashboard npm ci
docker-compose -f docker-compose.dev.yml exec -T admin-dashboard npm ci

echo "🏗️  Setting up Ollama models..."

# Pull required models
docker-compose -f docker-compose.dev.yml exec -T ollama ollama pull llama3.2:3b || echo "⚠️  Failed to pull Llama3.2 model - will use fallback"

echo "🗄️  Setting up database..."

# Run database migrations (if using Prisma)
if [[ -f packages/database/package.json ]]; then
    docker-compose -f docker-compose.dev.yml exec -T api-gateway npm run db:migrate --workspace=@ai-feedback/database || echo "⚠️  Database migrations failed or not configured"
fi

echo "🌱 Seeding development data..."

# Seed development data
docker-compose -f docker-compose.dev.yml exec -T api-gateway npm run db:seed || echo "⚠️  Database seeding failed or not configured"

echo "🎉 Development environment is ready!"
echo ""
echo "📋 Service Status:"
echo "   🌐 Customer PWA:       http://localhost:3000"
echo "   🏢 Business Dashboard: http://localhost:3002"
echo "   👤 Admin Dashboard:    http://localhost:3003"
echo "   🔧 API Gateway:        http://localhost:3001"
echo "   🗄️  PostgreSQL:        localhost:5432"
echo "   📝 Redis:             localhost:6379"
echo "   🤖 Ollama:            http://localhost:11434"
echo ""
echo "📊 Monitoring:"
echo "   🎛️  Logs: docker-compose -f docker-compose.dev.yml logs -f [service]"
echo "   📈 Status: docker-compose -f docker-compose.dev.yml ps"
echo ""
echo "🛑 To stop: docker-compose -f docker-compose.dev.yml down"
echo ""

# Show logs for a few seconds to verify everything is working
echo "📜 Recent logs (last 20 lines):"
docker-compose -f docker-compose.dev.yml logs --tail=20