#!/bin/bash

# Swedish Pilot Deployment Script
# Production-ready deployment for Swedish businesses with comprehensive validation

set -euo pipefail

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_FILE="/var/log/ai-feedback/swedish-pilot-deployment.log"
DEPLOYMENT_ID="pilot-$(date +%Y%m%d-%H%M%S)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${timestamp} [$level] $message" | tee -a "$LOG_FILE"
}

info() { log "INFO" "$@"; }
warn() { log "WARN" "${YELLOW}$*${NC}"; }
error() { log "ERROR" "${RED}$*${NC}"; }
success() { log "SUCCESS" "${GREEN}$*${NC}"; }

# Deployment configuration
ENVIRONMENTS=("staging" "production")
DEPLOYMENT_REGIONS=("stockholm" "gothenburg" "malmo")
SWEDISH_BUSINESS_TYPES=("grocery_store" "cafe" "restaurant" "retail")

# Required environment variables
REQUIRED_VARS=(
    "DATABASE_URL"
    "REDIS_URL" 
    "SUPABASE_URL"
    "SUPABASE_ANON_KEY"
    "SQUARE_ACCESS_TOKEN"
    "SHOPIFY_ACCESS_TOKEN"
    "ZETTLE_ACCESS_TOKEN"
    "STRIPE_SECRET_KEY"
    "API_GATEWAY_URL"
    "MONITORING_WEBHOOK_URL"
)

# Deployment phases
declare -A DEPLOYMENT_PHASES=(
    ["pre-deployment"]="Pre-deployment validation and preparation"
    ["infrastructure"]="Infrastructure setup and configuration"
    ["database"]="Database migrations and seed data"
    ["services"]="Service deployment and configuration"
    ["pos-integration"]="POS system integration and validation"
    ["monitoring"]="Monitoring and alerting setup"
    ["validation"]="Comprehensive system validation"
    ["rollback-preparation"]="Rollback preparation and documentation"
)

# Swedish business configuration
setup_swedish_configuration() {
    info "Setting up Swedish business configuration..."
    
    # Create Swedish timezone configuration
    cat > "$PROJECT_ROOT/config/swedish-timezone.json" << EOF
{
  "timezone": "Europe/Stockholm",
  "businessHours": {
    "weekday": {
      "start": 9,
      "end": 18
    },
    "weekend": {
      "start": 10,
      "end": 16
    }
  },
  "holidays": [
    "2024-01-01", "2024-01-06", "2024-03-29", "2024-04-01",
    "2024-05-01", "2024-05-09", "2024-05-19", "2024-06-06",
    "2024-06-21", "2024-06-22", "2024-11-02", "2024-12-24",
    "2024-12-25", "2024-12-26", "2024-12-31"
  ],
  "currency": "SEK",
  "locale": "sv-SE",
  "vatRate": 0.25
}
EOF

    # Create Swedish business validation rules
    cat > "$PROJECT_ROOT/config/swedish-business-validation.json" << EOF
{
  "orgNumberValidation": {
    "pattern": "^[0-9]{6}-[0-9]{4}$",
    "required": true
  },
  "vatNumberValidation": {
    "pattern": "^SE[0-9]{12}01$",
    "required": false
  },
  "requiredDocuments": [
    "business_registration",
    "vat_registration",
    "bank_details"
  ],
  "supportedPOS": [
    "square",
    "shopify",
    "zettle"
  ],
  "complianceRequirements": {
    "gdpr": true,
    "pci_dss": true,
    "accountingStandards": "K3"
  }
}
EOF

    success "Swedish configuration files created"
}

# Validate environment
validate_environment() {
    info "Validating deployment environment..."
    
    # Check required environment variables
    local missing_vars=()
    for var in "${REQUIRED_VARS[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            missing_vars+=("$var")
        fi
    done
    
    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        error "Missing required environment variables: ${missing_vars[*]}"
        return 1
    fi
    
    # Check disk space
    local required_space_gb=10
    local available_space_gb=$(df /var/lib/docker --output=avail -BG | tail -1 | grep -o '[0-9]*')
    if [[ $available_space_gb -lt $required_space_gb ]]; then
        error "Insufficient disk space. Required: ${required_space_gb}GB, Available: ${available_space_gb}GB"
        return 1
    fi
    
    # Check memory
    local required_memory_gb=4
    local available_memory_gb=$(free -g | awk '/^Mem:/{print $7}')
    if [[ $available_memory_gb -lt $required_memory_gb ]]; then
        error "Insufficient memory. Required: ${required_memory_gb}GB, Available: ${available_memory_gb}GB"
        return 1
    fi
    
    # Test database connectivity
    info "Testing database connectivity..."
    if ! timeout 10 psql "$DATABASE_URL" -c "SELECT 1;" >/dev/null 2>&1; then
        error "Database connectivity test failed"
        return 1
    fi
    
    # Test Redis connectivity  
    info "Testing Redis connectivity..."
    if ! timeout 10 redis-cli -u "$REDIS_URL" ping >/dev/null 2>&1; then
        error "Redis connectivity test failed"
        return 1
    fi
    
    success "Environment validation completed successfully"
}

# Setup infrastructure
setup_infrastructure() {
    info "Setting up infrastructure for Swedish pilot..."
    
    # Create deployment directories
    mkdir -p /opt/ai-feedback/{logs,config,backups,monitoring}
    mkdir -p /var/log/ai-feedback/{pos,webhooks,monitoring}
    
    # Setup Docker network for Swedish pilot
    if ! docker network ls | grep -q "swedish-pilot-network"; then
        docker network create \
            --driver bridge \
            --subnet=172.25.0.0/16 \
            --opt com.docker.network.bridge.enable_ip_masquerade=true \
            --label environment=swedish-pilot \
            swedish-pilot-network
        info "Created Swedish pilot Docker network"
    fi
    
    # Setup monitoring stack for Swedish pilot
    info "Setting up monitoring infrastructure..."
    
    # Copy monitoring configurations with Swedish settings
    cp "$PROJECT_ROOT/monitoring/prometheus-pos.yml" /opt/ai-feedback/config/
    cp "$PROJECT_ROOT/monitoring/alertmanager-pos.yml" /opt/ai-feedback/config/
    cp "$PROJECT_ROOT/monitoring/grafana-pos-dashboard.json" /opt/ai-feedback/config/
    
    # Update Prometheus configuration for Swedish timezone
    sed -i 's/UTC/Europe\/Stockholm/g' /opt/ai-feedback/config/prometheus-pos.yml
    
    success "Infrastructure setup completed"
}

# Run database migrations
run_database_migrations() {
    info "Running database migrations for Swedish pilot..."
    
    # Backup current database
    local backup_file="/opt/ai-feedback/backups/pre-migration-$(date +%Y%m%d-%H%M%S).sql"
    pg_dump "$DATABASE_URL" > "$backup_file"
    info "Database backup created: $backup_file"
    
    # Run migrations
    cd "$PROJECT_ROOT/packages/database"
    if ! npx prisma migrate deploy; then
        error "Database migration failed"
        return 1
    fi
    
    # Add Swedish-specific data
    info "Inserting Swedish business data..."
    
    # Create Swedish business categories
    psql "$DATABASE_URL" << EOF
INSERT INTO business_categories (name, description, swedish_name) VALUES 
('grocery_store', 'Grocery and food stores', 'Livsmedelsbutik'),
('cafe', 'Cafes and coffee shops', 'Kafé'),
('restaurant', 'Restaurants and dining', 'Restaurang'),
('retail', 'Retail and shopping', 'Detaljhandel')
ON CONFLICT (name) DO NOTHING;

-- Create Swedish regions
INSERT INTO service_regions (name, country_code, timezone, currency) VALUES
('Stockholm', 'SE', 'Europe/Stockholm', 'SEK'),
('Göteborg', 'SE', 'Europe/Stockholm', 'SEK'),
('Malmö', 'SE', 'Europe/Stockholm', 'SEK')
ON CONFLICT (name, country_code) DO NOTHING;

-- Create POS provider configurations for Sweden
INSERT INTO pos_provider_configs (provider, region, api_endpoint, webhook_endpoint, active) VALUES
('square', 'EU', 'https://connect.squareup.com', '/webhooks/square', true),
('shopify', 'EU', 'https://admin.shopify.com', '/webhooks/shopify', true),
('zettle', 'EU', 'https://oauth.izettle.com', '/webhooks/zettle', true)
ON CONFLICT (provider, region) DO UPDATE SET
api_endpoint = EXCLUDED.api_endpoint,
webhook_endpoint = EXCLUDED.webhook_endpoint,
active = EXCLUDED.active;
EOF

    success "Database migrations completed successfully"
}

# Deploy services
deploy_services() {
    info "Deploying services for Swedish pilot..."
    
    # Build services with Swedish configuration
    cd "$PROJECT_ROOT"
    
    # Build API Gateway with Swedish configuration
    info "Building API Gateway..."
    docker build \
        --build-arg NODE_ENV=production \
        --build-arg DEPLOYMENT_REGION=stockholm \
        --build-arg BUSINESS_LOCALE=sv-SE \
        -t ai-feedback/api-gateway:swedish-pilot \
        -f apps/api-gateway/Dockerfile .
    
    # Build Business Dashboard
    info "Building Business Dashboard..."
    docker build \
        --build-arg NODE_ENV=production \
        --build-arg NEXT_PUBLIC_LOCALE=sv-SE \
        --build-arg NEXT_PUBLIC_CURRENCY=SEK \
        -t ai-feedback/business-dashboard:swedish-pilot \
        -f apps/business/Dockerfile .
    
    # Deploy services using Docker Compose
    info "Deploying service stack..."
    
    # Create environment-specific docker-compose file
    envsubst < "$PROJECT_ROOT/docker-compose.swedish-pilot.yml.template" > "/tmp/docker-compose.swedish-pilot.yml"
    
    # Start services
    docker-compose -f /tmp/docker-compose.swedish-pilot.yml up -d
    
    # Wait for services to be ready
    info "Waiting for services to start..."
    local max_attempts=30
    local attempt=0
    
    while [[ $attempt -lt $max_attempts ]]; do
        if curl -s "$API_GATEWAY_URL/health" | grep -q "healthy"; then
            success "API Gateway is healthy"
            break
        fi
        ((attempt++))
        sleep 10
        info "Waiting for API Gateway... (attempt $attempt/$max_attempts)"
    done
    
    if [[ $attempt -eq $max_attempts ]]; then
        error "API Gateway failed to start within expected time"
        return 1
    fi
    
    success "Services deployed successfully"
}

# Configure POS integrations
configure_pos_integrations() {
    info "Configuring POS integrations for Swedish businesses..."
    
    # Initialize Square webhooks for Sweden
    info "Initializing Square webhooks..."
    curl -X POST "$API_GATEWAY_URL/webhooks/square/initialize" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $ADMIN_API_KEY" \
        -d '{
            "eventTypes": [
                "payment.created",
                "payment.updated",
                "order.created",
                "order.updated"
            ],
            "region": "EU"
        }'
    
    # Test POS provider connectivity
    local providers=("square" "shopify" "zettle")
    for provider in "${providers[@]}"; do
        info "Testing $provider connectivity..."
        local response=$(curl -s "$API_GATEWAY_URL/pos/health/$provider")
        if echo "$response" | grep -q '"healthy":true'; then
            success "$provider connectivity validated"
        else
            warn "$provider connectivity issues detected: $response"
        fi
    done
    
    # Setup POS-specific monitoring
    info "Setting up POS monitoring..."
    
    # Create POS monitoring configuration
    cat > /opt/ai-feedback/config/pos-monitoring.json << EOF
{
    "providers": ["square", "shopify", "zettle"],
    "healthCheckInterval": 30,
    "alertThresholds": {
        "responseTime": 5000,
        "errorRate": 5,
        "failoverThreshold": 3
    },
    "businessHours": {
        "timezone": "Europe/Stockholm",
        "weekday": {"start": 9, "end": 18},
        "weekend": {"start": 10, "end": 16}
    },
    "swedishHolidays": [
        "2024-01-01", "2024-01-06", "2024-03-29", "2024-04-01",
        "2024-05-01", "2024-05-09", "2024-05-19", "2024-06-06",
        "2024-06-21", "2024-06-22", "2024-11-02", "2024-12-24",
        "2024-12-25", "2024-12-26", "2024-12-31"
    ]
}
EOF
    
    success "POS integrations configured successfully"
}

# Setup monitoring
setup_monitoring() {
    info "Setting up monitoring and alerting for Swedish pilot..."
    
    # Deploy monitoring stack
    docker-compose -f "$PROJECT_ROOT/docker-compose.pos-monitoring.yml" up -d
    
    # Wait for Prometheus to start
    info "Waiting for monitoring stack to start..."
    local max_attempts=20
    local attempt=0
    
    while [[ $attempt -lt $max_attempts ]]; do
        if curl -s "http://localhost:9095/-/ready" >/dev/null 2>&1; then
            success "Prometheus is ready"
            break
        fi
        ((attempt++))
        sleep 10
    done
    
    # Setup Swedish-specific alerting
    info "Configuring Swedish business hours alerting..."
    
    # Create Swedish alert rules
    cat > /opt/ai-feedback/config/swedish-alert-rules.yml << 'EOF'
groups:
  - name: swedish_business_hours
    rules:
      # High severity during business hours
      - alert: POSProviderDown_BusinessHours
        expr: pos_connection_status == 0 and ON() (hour() >= 9 and hour() < 18 and (day_of_week() > 0 and day_of_week() < 6))
        for: 1m
        labels:
          severity: critical
          business_impact: high
          swedish_context: business_hours
        annotations:
          summary: "POS provider {{ $labels.provider }} is down during Swedish business hours"
          description: "This requires immediate attention as it affects active business operations"
          
      # Reduced severity outside business hours
      - alert: POSProviderDown_OffHours
        expr: pos_connection_status == 0 and ON() (hour() < 9 or hour() >= 18 or day_of_week() == 0 or day_of_week() == 6)
        for: 5m
        labels:
          severity: warning
          business_impact: low
          swedish_context: off_hours
        annotations:
          summary: "POS provider {{ $labels.provider }} is down outside business hours"
          description: "Monitor for resolution, escalate if not resolved before next business day"
          
      # Swedish holiday awareness
      - alert: SystemIssue_SwedishHoliday
        expr: pos_error_rate_percent > 10 and ON() swedish_holiday() == 1
        for: 10m
        labels:
          severity: low
          business_impact: minimal
          swedish_context: holiday
        annotations:
          summary: "System issues detected during Swedish holiday"
          description: "Reduced priority due to holiday context, but monitor for trends"

EOF

    # Import Grafana dashboards
    info "Setting up Grafana dashboards..."
    
    # Wait for Grafana to start
    sleep 30
    
    # Import Swedish business dashboard
    curl -X POST \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $GRAFANA_API_KEY" \
        -d @"$PROJECT_ROOT/monitoring/grafana-swedish-business-dashboard.json" \
        "http://localhost:3005/api/dashboards/db"
    
    success "Monitoring setup completed"
}

# Comprehensive system validation
validate_deployment() {
    info "Running comprehensive deployment validation..."
    
    local validation_results=()
    
    # Test 1: Health checks
    info "Testing system health endpoints..."
    local health_response=$(curl -s "$API_GATEWAY_URL/health")
    if echo "$health_response" | grep -q '"status":"healthy"'; then
        validation_results+=("✓ Health endpoints working")
    else
        validation_results+=("✗ Health endpoints failed")
    fi
    
    # Test 2: POS provider connectivity
    info "Testing POS provider connectivity..."
    local providers=("square" "shopify" "zettle")
    for provider in "${providers[@]}"; do
        local pos_health=$(curl -s "$API_GATEWAY_URL/pos/health/$provider")
        if echo "$pos_health" | grep -q '"healthy":true'; then
            validation_results+=("✓ $provider connectivity working")
        else
            validation_results+=("✗ $provider connectivity failed")
        fi
    done
    
    # Test 3: Database connectivity
    info "Testing database operations..."
    if psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM businesses;" >/dev/null 2>&1; then
        validation_results+=("✓ Database operations working")
    else
        validation_results+=("✗ Database operations failed")
    fi
    
    # Test 4: Redis caching
    info "Testing Redis caching..."
    if redis-cli -u "$REDIS_URL" set test-key "test-value" >/dev/null 2>&1 && \
       [[ $(redis-cli -u "$REDIS_URL" get test-key) == "test-value" ]]; then
        validation_results+=("✓ Redis caching working")
        redis-cli -u "$REDIS_URL" del test-key >/dev/null 2>&1
    else
        validation_results+=("✗ Redis caching failed")
    fi
    
    # Test 5: Webhook endpoints
    info "Testing webhook endpoints..."
    local webhook_test=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_GATEWAY_URL/webhooks/square" \
        -H "Content-Type: application/json" \
        -d '{"test": true}')
    if [[ "$webhook_test" == "200" ]] || [[ "$webhook_test" == "401" ]]; then
        validation_results+=("✓ Webhook endpoints accessible")
    else
        validation_results+=("✗ Webhook endpoints failed")
    fi
    
    # Test 6: Monitoring endpoints
    info "Testing monitoring endpoints..."
    if curl -s "http://localhost:9095/metrics" | grep -q "prometheus_"; then
        validation_results+=("✓ Monitoring endpoints working")
    else
        validation_results+=("✗ Monitoring endpoints failed")
    fi
    
    # Test 7: Swedish business configuration
    info "Testing Swedish business configuration..."
    if [[ -f "/opt/ai-feedback/config/swedish-timezone.json" ]] && \
       [[ -f "/opt/ai-feedback/config/swedish-business-validation.json" ]]; then
        validation_results+=("✓ Swedish configuration loaded")
    else
        validation_results+=("✗ Swedish configuration missing")
    fi
    
    # Test 8: Load test
    info "Running basic load test..."
    local load_test_result=$(curl -s -w "%{time_total}" -o /dev/null "$API_GATEWAY_URL/health")
    if (( $(echo "$load_test_result < 1.0" | bc -l) )); then
        validation_results+=("✓ Response times acceptable (${load_test_result}s)")
    else
        validation_results+=("✗ Response times slow (${load_test_result}s)")
    fi
    
    # Print validation results
    echo -e "\n${BLUE}=== Deployment Validation Results ===${NC}"
    for result in "${validation_results[@]}"; do
        if [[ "$result" =~ ✓ ]]; then
            echo -e "${GREEN}$result${NC}"
        else
            echo -e "${RED}$result${NC}"
        fi
    done
    
    # Check if deployment is successful
    local failed_tests=$(printf '%s\n' "${validation_results[@]}" | grep -c "✗" || true)
    if [[ $failed_tests -eq 0 ]]; then
        success "All validation tests passed! Deployment successful."
        return 0
    else
        error "$failed_tests validation tests failed. Deployment needs attention."
        return 1
    fi
}

# Setup rollback preparation
prepare_rollback() {
    info "Preparing rollback procedures..."
    
    # Create rollback script
    cat > "/opt/ai-feedback/rollback-${DEPLOYMENT_ID}.sh" << 'EOF'
#!/bin/bash
# Automated rollback script for Swedish pilot deployment

set -euo pipefail

DEPLOYMENT_ID="${1:-unknown}"
ROLLBACK_REASON="${2:-manual}"

echo "Starting rollback for deployment: $DEPLOYMENT_ID"
echo "Reason: $ROLLBACK_REASON"

# Stop current services
echo "Stopping current services..."
docker-compose -f /tmp/docker-compose.swedish-pilot.yml down

# Restore database backup
echo "Restoring database backup..."
BACKUP_FILE="/opt/ai-feedback/backups/pre-migration-$(date +%Y%m%d -d 'yesterday')*.sql"
if ls $BACKUP_FILE 1> /dev/null 2>&1; then
    psql "$DATABASE_URL" < $(ls -t $BACKUP_FILE | head -n1)
    echo "Database restored"
else
    echo "No backup file found for rollback"
fi

# Restart previous version
echo "Starting previous version..."
docker-compose -f /opt/ai-feedback/previous-deployment.yml up -d

echo "Rollback completed for deployment: $DEPLOYMENT_ID"
EOF

    chmod +x "/opt/ai-feedback/rollback-${DEPLOYMENT_ID}.sh"
    
    # Save current deployment configuration for rollback
    cp /tmp/docker-compose.swedish-pilot.yml "/opt/ai-feedback/deployment-${DEPLOYMENT_ID}.yml"
    
    success "Rollback procedures prepared"
}

# Generate deployment report
generate_deployment_report() {
    info "Generating deployment report..."
    
    local report_file="/opt/ai-feedback/deployment-report-${DEPLOYMENT_ID}.md"
    
    cat > "$report_file" << EOF
# Swedish Pilot Deployment Report

**Deployment ID:** $DEPLOYMENT_ID  
**Date:** $(date)  
**Environment:** Swedish Pilot Production  

## Deployment Summary

### Services Deployed
- API Gateway: ai-feedback/api-gateway:swedish-pilot
- Business Dashboard: ai-feedback/business-dashboard:swedish-pilot  
- Monitoring Stack: Prometheus, Grafana, AlertManager
- POS Integration: Square, Shopify, Zettle

### Infrastructure
- Docker Network: swedish-pilot-network (172.25.0.0/16)
- Storage: /opt/ai-feedback/ 
- Logs: /var/log/ai-feedback/
- Configuration: Swedish timezone, business hours, holidays

### Database Changes
- Added Swedish business categories
- Created Swedish service regions
- Configured POS providers for EU region

### Monitoring Configuration
- Swedish business hours alerting
- Holiday-aware monitoring
- POS provider health checks
- Performance monitoring

### Rollback Information
- Rollback script: /opt/ai-feedback/rollback-${DEPLOYMENT_ID}.sh
- Database backup: Available in /opt/ai-feedback/backups/
- Previous deployment config: Saved

### Validation Results
$(printf '%s\n' "${validation_results[@]}" | sed 's/^/- /')

### Next Steps
1. Monitor system performance for first 24 hours
2. Validate with pilot Swedish businesses
3. Review monitoring alerts and adjust thresholds
4. Document any issues or improvements needed

### Support Information
- Logs: /var/log/ai-feedback/swedish-pilot-deployment.log
- Monitoring: http://localhost:3005 (Grafana)
- Metrics: http://localhost:9095 (Prometheus)
- API Health: $API_GATEWAY_URL/health
EOF

    success "Deployment report generated: $report_file"
}

# Main deployment function
main() {
    info "Starting Swedish Pilot Deployment - ID: $DEPLOYMENT_ID"
    
    # Ensure log directory exists
    mkdir -p "$(dirname "$LOG_FILE")"
    
    # Execute deployment phases
    for phase in "${!DEPLOYMENT_PHASES[@]}"; do
        info "=== Starting Phase: $phase - ${DEPLOYMENT_PHASES[$phase]} ==="
        
        case $phase in
            "pre-deployment")
                setup_swedish_configuration
                validate_environment
                ;;
            "infrastructure")
                setup_infrastructure
                ;;
            "database")
                run_database_migrations
                ;;
            "services")
                deploy_services
                ;;
            "pos-integration")
                configure_pos_integrations
                ;;
            "monitoring")
                setup_monitoring
                ;;
            "validation")
                if ! validate_deployment; then
                    error "Deployment validation failed!"
                    exit 1
                fi
                ;;
            "rollback-preparation")
                prepare_rollback
                ;;
        esac
        
        success "Phase completed: $phase"
    done
    
    # Generate final report
    generate_deployment_report
    
    success "Swedish Pilot Deployment completed successfully!"
    info "Deployment ID: $DEPLOYMENT_ID"
    info "Report: /opt/ai-feedback/deployment-report-${DEPLOYMENT_ID}.md"
    info "Rollback: /opt/ai-feedback/rollback-${DEPLOYMENT_ID}.sh"
}

# Handle script interruption
cleanup() {
    error "Deployment interrupted!"
    info "Cleaning up partial deployment..."
    
    # Stop any running containers
    docker-compose -f /tmp/docker-compose.swedish-pilot.yml down 2>/dev/null || true
    
    # Remove temporary files
    rm -f /tmp/docker-compose.swedish-pilot.yml
    
    exit 1
}

trap cleanup SIGINT SIGTERM

# Check if running as root or with sufficient privileges
if [[ $EUID -eq 0 ]]; then
    warn "Running as root. Consider using a dedicated deployment user."
fi

# Parse command line arguments
ENVIRONMENT="production"
DRY_RUN=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --environment=*)
            ENVIRONMENT="${1#*=}"
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --help)
            echo "Usage: $0 [--environment=production] [--dry-run] [--help]"
            echo "  --environment: Target environment (staging/production)"
            echo "  --dry-run: Validate configuration without deploying"
            echo "  --help: Show this help message"
            exit 0
            ;;
        *)
            error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Validate environment argument
if [[ ! " ${ENVIRONMENTS[*]} " =~ " $ENVIRONMENT " ]]; then
    error "Invalid environment: $ENVIRONMENT. Must be one of: ${ENVIRONMENTS[*]}"
    exit 1
fi

info "Deployment environment: $ENVIRONMENT"
info "Dry run: $DRY_RUN"

if [[ "$DRY_RUN" == "true" ]]; then
    info "Dry run mode - validation only"
    setup_swedish_configuration
    validate_environment
    success "Dry run completed successfully"
    exit 0
fi

# Execute main deployment
main

info "Swedish Pilot Deployment script completed"