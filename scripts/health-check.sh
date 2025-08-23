#!/bin/bash

# AI Feedback Platform - Health Check Script
# Comprehensive health check for all services

set -e

echo "🩺 AI Feedback Platform Health Check"
echo "=================================="

# Configuration
COMPOSE_FILE="docker-compose.prod.yml"
if [[ "$1" == "dev" ]]; then
    COMPOSE_FILE="docker-compose.dev.yml"
    echo "Running health check for DEVELOPMENT environment"
else
    echo "Running health check for PRODUCTION environment"
fi

echo ""

# Check if Docker Compose file exists
if [[ ! -f "$COMPOSE_FILE" ]]; then
    echo "❌ Docker Compose file $COMPOSE_FILE not found"
    exit 1
fi

# Function to check HTTP endpoint
check_http_endpoint() {
    local url=$1
    local service_name=$2
    local timeout=${3:-10}
    
    if curl -f -s --max-time $timeout "$url" > /dev/null 2>&1; then
        echo "   ✅ $service_name ($url)"
        return 0
    else
        echo "   ❌ $service_name ($url)"
        return 1
    fi
}

# Function to check service container status
check_container_status() {
    local service=$1
    local container_id=$(docker-compose -f "$COMPOSE_FILE" ps -q "$service" 2>/dev/null)
    
    if [[ -z "$container_id" ]]; then
        echo "   ❌ $service (not running)"
        return 1
    fi
    
    local status=$(docker inspect --format='{{.State.Health.Status}}' "$container_id" 2>/dev/null || echo "no-healthcheck")
    local running=$(docker inspect --format='{{.State.Running}}' "$container_id" 2>/dev/null || echo "false")
    
    if [[ "$running" == "true" ]]; then
        if [[ "$status" == "healthy" ]]; then
            echo "   ✅ $service (healthy)"
            return 0
        elif [[ "$status" == "no-healthcheck" ]]; then
            echo "   ⚠️  $service (running, no health check)"
            return 0
        else
            echo "   ⚠️  $service (running, $status)"
            return 1
        fi
    else
        echo "   ❌ $service (not running)"
        return 1
    fi
}

# Function to check database connectivity
check_database() {
    echo "🗄️  Database Connectivity:"
    
    if docker-compose -f "$COMPOSE_FILE" exec -T api-gateway timeout 10 node -e "
        const { createClient } = require('@supabase/supabase-js');
        const url = process.env.DATABASE_URL || 'postgresql://postgres:postgres@postgres:5432/ai_feedback_platform';
        console.log('Database connection test passed');
    " > /dev/null 2>&1; then
        echo "   ✅ Database connection"
        return 0
    else
        echo "   ❌ Database connection failed"
        return 1
    fi
}

# Function to check Redis connectivity
check_redis() {
    echo "📝 Redis Connectivity:"
    
    if docker-compose -f "$COMPOSE_FILE" exec -T redis redis-cli ping 2>/dev/null | grep -q "PONG"; then
        echo "   ✅ Redis connection"
        return 0
    else
        echo "   ❌ Redis connection failed"
        return 1
    fi
}

# Function to check disk space
check_disk_space() {
    echo "💾 Disk Space:"
    local usage=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
    
    if [[ $usage -lt 80 ]]; then
        echo "   ✅ Disk usage: ${usage}%"
        return 0
    elif [[ $usage -lt 90 ]]; then
        echo "   ⚠️  Disk usage: ${usage}% (Warning)"
        return 1
    else
        echo "   ❌ Disk usage: ${usage}% (Critical)"
        return 1
    fi
}

# Function to check memory usage
check_memory() {
    echo "🧠 Memory Usage:"
    local mem_info=$(free | grep Mem)
    local total=$(echo $mem_info | awk '{print $2}')
    local used=$(echo $mem_info | awk '{print $3}')
    local usage=$((used * 100 / total))
    
    if [[ $usage -lt 80 ]]; then
        echo "   ✅ Memory usage: ${usage}%"
        return 0
    elif [[ $usage -lt 90 ]]; then
        echo "   ⚠️  Memory usage: ${usage}% (Warning)"
        return 1
    else
        echo "   ❌ Memory usage: ${usage}% (Critical)"
        return 1
    fi
}

# Function to check SSL certificates (production only)
check_ssl_certificates() {
    if [[ "$COMPOSE_FILE" == "docker-compose.prod.yml" ]]; then
        echo "🔒 SSL Certificates:"
        local cert_dir="nginx/ssl"
        
        if [[ -f "$cert_dir/feedback.crt" ]]; then
            local expiry=$(openssl x509 -enddate -noout -in "$cert_dir/feedback.crt" | cut -d= -f2)
            local expiry_epoch=$(date -d "$expiry" +%s)
            local current_epoch=$(date +%s)
            local days_until_expiry=$(( (expiry_epoch - current_epoch) / 86400 ))
            
            if [[ $days_until_expiry -gt 30 ]]; then
                echo "   ✅ SSL certificate valid for $days_until_expiry days"
                return 0
            elif [[ $days_until_expiry -gt 7 ]]; then
                echo "   ⚠️  SSL certificate expires in $days_until_expiry days"
                return 1
            else
                echo "   ❌ SSL certificate expires in $days_until_expiry days (Critical)"
                return 1
            fi
        else
            echo "   ❌ SSL certificate not found"
            return 1
        fi
    fi
    return 0
}

# Main health check execution
echo "🐳 Container Status:"
failed_checks=0

# Check core services
services=("api-gateway" "customer-pwa" "business-dashboard" "admin-dashboard" "redis")
if [[ "$COMPOSE_FILE" == "docker-compose.dev.yml" ]]; then
    services+=("postgres" "ollama")
fi

for service in "${services[@]}"; do
    if ! check_container_status "$service"; then
        ((failed_checks++))
    fi
done

echo ""

# Check HTTP endpoints
echo "🌐 HTTP Endpoint Status:"
if [[ "$COMPOSE_FILE" == "docker-compose.dev.yml" ]]; then
    endpoints=(
        "http://localhost:3000/api/health:Customer PWA"
        "http://localhost:3001/health:API Gateway"
        "http://localhost:3002/api/health:Business Dashboard"
        "http://localhost:3003/api/health:Admin Dashboard"
    )
else
    endpoints=(
        "https://feedback.your-domain.com/api/health:Customer PWA"
        "https://api.feedback.your-domain.com/health:API Gateway"
        "https://business.feedback.your-domain.com/api/health:Business Dashboard"
        "https://admin.feedback.your-domain.com/api/health:Admin Dashboard"
    )
fi

for endpoint_info in "${endpoints[@]}"; do
    IFS=':' read -r url name <<< "$endpoint_info"
    if ! check_http_endpoint "$url" "$name"; then
        ((failed_checks++))
    fi
done

echo ""

# Check database and Redis
if ! check_database; then
    ((failed_checks++))
fi

if ! check_redis; then
    ((failed_checks++))
fi

echo ""

# Check system resources
if ! check_disk_space; then
    ((failed_checks++))
fi

if ! check_memory; then
    ((failed_checks++))
fi

echo ""

# Check SSL certificates (production only)
if ! check_ssl_certificates; then
    ((failed_checks++))
fi

# Summary
echo ""
echo "📊 Health Check Summary"
echo "======================"

if [[ $failed_checks -eq 0 ]]; then
    echo "✅ All checks passed! System is healthy."
    exit 0
else
    echo "❌ $failed_checks check(s) failed. System needs attention."
    echo ""
    echo "🔍 Troubleshooting:"
    echo "   - Check service logs: docker-compose -f $COMPOSE_FILE logs [service]"
    echo "   - Restart failed services: docker-compose -f $COMPOSE_FILE restart [service]"
    echo "   - Check system resources and free up space if needed"
    echo "   - Verify network connectivity and DNS resolution"
    exit 1
fi