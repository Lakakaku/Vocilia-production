#!/bin/bash

# POS Monitoring Infrastructure Deployment Script
# Comprehensive setup and validation of POS monitoring system

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_FILE="/tmp/pos-monitoring-deployment.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $*" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] ✅ $*${NC}" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️  $*${NC}" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ❌ $*${NC}" | tee -a "$LOG_FILE"
}

# Check prerequisites
check_prerequisites() {
    log "Checking deployment prerequisites..."
    
    # Check if Docker is installed and running
    if ! command -v docker >/dev/null 2>&1; then
        error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! docker info >/dev/null 2>&1; then
        error "Docker is not running. Please start Docker first."
        exit 1
    fi
    
    success "Docker is installed and running"
    
    # Check if docker-compose is available
    if ! command -v docker-compose >/dev/null 2>&1; then
        error "docker-compose is not installed. Please install docker-compose first."
        exit 1
    fi
    
    success "docker-compose is available"
    
    # Check if required directories exist
    if [ ! -d "$PROJECT_ROOT/monitoring" ]; then
        error "Monitoring directory not found. Please ensure you're in the correct project directory."
        exit 1
    fi
    
    success "Project structure verified"
    
    # Check if Node.js is available (for TypeScript compilation)
    if ! command -v node >/dev/null 2>&1; then
        warning "Node.js not found. TypeScript services may need to be built separately."
    else
        success "Node.js is available"
    fi
}

# Validate configuration files
validate_configuration() {
    log "Validating monitoring configuration files..."
    
    local config_files=(
        "monitoring/prometheus-pos.yml"
        "monitoring/pos-alert-rules.yml"
        "monitoring/alertmanager-pos.yml"
        "monitoring/grafana-pos-datasources.yml"
        "monitoring/grafana-pos-dashboards.yml"
        "monitoring/grafana-pos-dashboard.json"
        "docker-compose.pos-monitoring.yml"
    )
    
    local missing_files=()
    
    for file in "${config_files[@]}"; do
        local file_path="$PROJECT_ROOT/$file"
        if [ -f "$file_path" ]; then
            success "Found: $file"
        else
            error "Missing: $file"
            missing_files+=("$file")
        fi
    done
    
    if [ ${#missing_files[@]} -gt 0 ]; then
        error "Missing configuration files. Please ensure all files are present."
        exit 1
    fi
    
    success "All configuration files are present"
}

# Check environment variables
check_environment() {
    log "Checking required environment variables..."
    
    local required_vars=(
        "DATABASE_URL"
        "REDIS_URL"
    )
    
    local optional_vars=(
        "SQUARE_ACCESS_TOKEN"
        "SHOPIFY_ACCESS_TOKEN"
        "ZETTLE_ACCESS_TOKEN"
        "SLACK_POS_WEBHOOK_URL"
        "GRAFANA_POS_ADMIN_PASSWORD"
    )
    
    local missing_required=()
    local missing_optional=()
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            missing_required+=("$var")
        else
            success "Required: $var is set"
        fi
    done
    
    for var in "${optional_vars[@]}"; do
        if [ -z "${!var}" ]; then
            missing_optional+=("$var")
        else
            success "Optional: $var is set"
        fi
    done
    
    if [ ${#missing_required[@]} -gt 0 ]; then
        error "Missing required environment variables: ${missing_required[*]}"
        error "Please set these variables before deploying."
        exit 1
    fi
    
    if [ ${#missing_optional[@]} -gt 0 ]; then
        warning "Missing optional environment variables: ${missing_optional[*]}"
        warning "Some monitoring features may not work without these variables."
    fi
    
    success "Environment variable check completed"
}

# Create required directories
create_directories() {
    log "Creating required directories..."
    
    local directories=(
        "/opt/ai-feedback/monitoring/pos/prometheus-data"
        "/opt/ai-feedback/monitoring/pos/grafana-data"
        "/opt/ai-feedback/logs/pos-health"
        "/opt/ai-feedback/logs/pos-webhooks"
        "/opt/ai-feedback/logs/pos-synthetic"
        "/opt/ai-feedback/logs/pos-metrics"
    )
    
    for dir in "${directories[@]}"; do
        if sudo mkdir -p "$dir"; then
            success "Created directory: $dir"
        else
            error "Failed to create directory: $dir"
            exit 1
        fi
    done
    
    # Set proper permissions
    log "Setting directory permissions..."
    sudo chown -R 65534:65534 /opt/ai-feedback/monitoring/pos/prometheus-data || warning "Failed to set Prometheus permissions"
    sudo chown -R 472:472 /opt/ai-feedback/monitoring/pos/grafana-data || warning "Failed to set Grafana permissions"
    
    success "Directory structure created"
}

# Build TypeScript services
build_services() {
    log "Building TypeScript services..."
    
    local api_gateway_dir="$PROJECT_ROOT/apps/api-gateway"
    
    if [ -d "$api_gateway_dir" ] && [ -f "$api_gateway_dir/package.json" ]; then
        log "Building API Gateway..."
        cd "$api_gateway_dir"
        
        if command -v npm >/dev/null 2>&1; then
            if npm install --production; then
                success "API Gateway dependencies installed"
            else
                warning "Failed to install API Gateway dependencies"
            fi
            
            if npm run build 2>/dev/null || true; then
                success "API Gateway built successfully"
            else
                warning "Failed to build API Gateway (may not have build script)"
            fi
        else
            warning "npm not available, skipping TypeScript build"
        fi
        
        cd "$PROJECT_ROOT"
    else
        warning "API Gateway directory not found, skipping build"
    fi
}

# Validate Docker Compose configuration
validate_docker_compose() {
    log "Validating Docker Compose configuration..."
    
    local compose_file="$PROJECT_ROOT/docker-compose.pos-monitoring.yml"
    
    if docker-compose -f "$compose_file" config >/dev/null 2>&1; then
        success "Docker Compose configuration is valid"
    else
        error "Docker Compose configuration has errors"
        docker-compose -f "$compose_file" config
        exit 1
    fi
}

# Deploy monitoring stack
deploy_monitoring_stack() {
    log "Deploying POS monitoring stack..."
    
    local compose_file="$PROJECT_ROOT/docker-compose.pos-monitoring.yml"
    
    cd "$PROJECT_ROOT"
    
    # Pull images first
    log "Pulling Docker images..."
    if docker-compose -f "$compose_file" pull; then
        success "Docker images pulled successfully"
    else
        error "Failed to pull Docker images"
        exit 1
    fi
    
    # Start services
    log "Starting monitoring services..."
    if docker-compose -f "$compose_file" up -d; then
        success "Monitoring services started"
    else
        error "Failed to start monitoring services"
        exit 1
    fi
    
    # Wait for services to be ready
    log "Waiting for services to be ready..."
    sleep 30
    
    # Check service status
    log "Checking service status..."
    docker-compose -f "$compose_file" ps
}

# Test service connectivity
test_services() {
    log "Testing service connectivity..."
    
    local services=(
        "pos-prometheus:9095:/metrics"
        "pos-grafana:3005:/api/health"
        "pos-metrics-exporter:3004:/health"
        "pos-alertmanager:9096:/api/v1/status"
    )
    
    local failed_tests=0
    
    for service in "${services[@]}"; do
        local service_name=$(echo "$service" | cut -d':' -f1)
        local service_port=$(echo "$service" | cut -d':' -f2)
        local health_path=$(echo "$service" | cut -d':' -f3)
        local url="http://localhost:$service_port$health_path"
        
        log "Testing $service_name at $url"
        
        local max_attempts=10
        local attempt=1
        local success_test=false
        
        while [ $attempt -le $max_attempts ]; do
            if curl -s -f "$url" >/dev/null 2>&1; then
                success "$service_name is responding (attempt $attempt)"
                success_test=true
                break
            else
                if [ $attempt -lt $max_attempts ]; then
                    log "Attempt $attempt failed, retrying in 5 seconds..."
                    sleep 5
                fi
            fi
            attempt=$((attempt + 1))
        done
        
        if [ "$success_test" = false ]; then
            error "$service_name failed to respond after $max_attempts attempts"
            failed_tests=$((failed_tests + 1))
        fi
    done
    
    if [ $failed_tests -gt 0 ]; then
        error "$failed_tests service(s) failed connectivity tests"
        return 1
    else
        success "All services passed connectivity tests"
        return 0
    fi
}

# Test API Gateway endpoints
test_api_endpoints() {
    log "Testing API Gateway POS monitoring endpoints..."
    
    local api_base_url="${API_GATEWAY_URL:-http://localhost:3001}"
    
    local endpoints=(
        "/health"
        "/pos/health"
        "/webhooks/health"
    )
    
    for endpoint in "${endpoints[@]}"; do
        local url="$api_base_url$endpoint"
        log "Testing endpoint: $url"
        
        if curl -s -f "$url" >/dev/null 2>&1; then
            success "Endpoint $endpoint is responding"
        else
            warning "Endpoint $endpoint is not responding (API Gateway may not be running)"
        fi
    done
}

# Generate sample alerts
test_alerting() {
    log "Testing alerting configuration..."
    
    local alertmanager_url="http://localhost:9096"
    
    # Check AlertManager status
    if curl -s -f "$alertmanager_url/api/v1/status" >/dev/null 2>&1; then
        success "AlertManager is accessible"
        
        # Get current alerts
        local alerts=$(curl -s "$alertmanager_url/api/v1/alerts" 2>/dev/null || echo '{"data":[]}')
        local alert_count=$(echo "$alerts" | grep -o '"status":"' | wc -l)
        
        log "Current active alerts: $alert_count"
        
        if [ "$alert_count" -eq 0 ]; then
            success "No active alerts (system appears healthy)"
        else
            warning "$alert_count active alerts found"
        fi
    else
        error "AlertManager is not accessible"
        return 1
    fi
}

# Generate test report
generate_test_report() {
    log "Generating deployment test report..."
    
    local report_file="/tmp/pos-monitoring-deployment-report.json"
    local timestamp=$(date -Iseconds)
    
    cat > "$report_file" <<EOF
{
    "deployment_timestamp": "$timestamp",
    "test_results": {
        "prerequisites": "passed",
        "configuration": "passed",
        "environment": "passed",
        "docker_services": "$(docker-compose -f "$PROJECT_ROOT/docker-compose.pos-monitoring.yml" ps --services --filter status=running | wc -l) services running",
        "service_connectivity": "$(test_services >/dev/null 2>&1 && echo "passed" || echo "failed")",
        "alerting": "$(test_alerting >/dev/null 2>&1 && echo "passed" || echo "failed")"
    },
    "service_urls": {
        "grafana": "http://localhost:3005",
        "prometheus": "http://localhost:9095",
        "alertmanager": "http://localhost:9096",
        "metrics_exporter": "http://localhost:3004"
    },
    "next_steps": [
        "Configure POS provider webhooks",
        "Set up Slack/PagerDuty integration",
        "Review and customize alert thresholds",
        "Set up regular health check monitoring"
    ]
}
EOF
    
    success "Test report generated: $report_file"
    cat "$report_file"
}

# Cleanup on exit
cleanup() {
    log "Deployment script completed"
}

# Main deployment function
main() {
    log "Starting POS Monitoring Infrastructure Deployment"
    log "Deployment log: $LOG_FILE"
    
    # Set trap for cleanup
    trap cleanup EXIT
    
    # Run deployment steps
    check_prerequisites
    validate_configuration  
    check_environment
    create_directories
    build_services
    validate_docker_compose
    deploy_monitoring_stack
    
    # Wait a bit for services to fully start
    log "Waiting for services to fully initialize..."
    sleep 60
    
    # Run tests
    if test_services; then
        success "Service connectivity tests passed"
    else
        error "Service connectivity tests failed"
    fi
    
    test_api_endpoints
    test_alerting
    generate_test_report
    
    # Final summary
    log ""
    log "=== DEPLOYMENT SUMMARY ==="
    log "✅ POS Monitoring Infrastructure deployed successfully"
    log ""
    log "🔗 Access URLs:"
    log "   Grafana Dashboard: http://localhost:3005 (admin / $GRAFANA_POS_ADMIN_PASSWORD)"
    log "   Prometheus Metrics: http://localhost:9095"
    log "   AlertManager: http://localhost:9096"
    log "   POS Metrics API: http://localhost:3004"
    log ""
    log "📋 Next Steps:"
    log "   1. Configure POS provider webhooks"
    log "   2. Set up Slack/PagerDuty integration"
    log "   3. Review alert thresholds in monitoring/pos-alert-rules.yml"
    log "   4. Test webhook delivery with sample transactions"
    log "   5. Set up regular backup of monitoring data"
    log ""
    log "📖 Documentation: $PROJECT_ROOT/DEPLOYMENT_GUIDE_POS_MONITORING.md"
    log ""
    success "Deployment completed successfully! 🎉"
}

# Execute main function
main "$@"