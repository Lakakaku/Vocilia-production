#!/bin/bash

# Admin Monitoring Infrastructure Startup Script
# Swedish Pilot Management and Admin System Monitoring
# 
# This script orchestrates the startup of the complete admin monitoring infrastructure,
# including Swedish pilot management, authentication, metrics collection, and alerting.

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
MONITORING_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$(dirname "$MONITORING_DIR")")"

# Load environment variables if .env file exists
if [[ -f "$PROJECT_ROOT/.env" ]]; then
    source "$PROJECT_ROOT/.env"
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration defaults
COMPOSE_FILE="${MONITORING_DIR}/docker-compose.admin-monitoring.yml"
ENVIRONMENT="${ENVIRONMENT:-production}"
ADMIN_GRAFANA_PASSWORD="${ADMIN_GRAFANA_PASSWORD:-admin123}"
SWEDISH_PILOT_MODE="${SWEDISH_PILOT_MODE:-true}"

log_info() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] [ADMIN-MONITORING] [INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] [ADMIN-MONITORING] [SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] [ADMIN-MONITORING] [WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] [ADMIN-MONITORING] [ERROR]${NC} $1"
}

log_header() {
    echo -e "${PURPLE}[$(date '+%Y-%m-%d %H:%M:%S')] [ADMIN-MONITORING] [HEADER]${NC} $1"
}

# Display banner
display_banner() {
    echo -e "${CYAN}"
    echo "=================================================================================================="
    echo "    🇸🇪 AI Feedback Platform - Admin Monitoring Infrastructure"
    echo "    Swedish Pilot Management & Admin System Monitoring"
    echo "=================================================================================================="
    echo -e "${NC}"
    echo "Environment: $ENVIRONMENT"
    echo "Swedish Pilot Mode: $SWEDISH_PILOT_MODE"
    echo "Monitoring Directory: $MONITORING_DIR"
    echo "Compose File: $COMPOSE_FILE"
    echo "Time: $(date '+%Y-%m-%d %H:%M:%S %Z')"
    echo "Swedish Time: $(TZ='Europe/Stockholm' date '+%Y-%m-%d %H:%M:%S %Z')"
    echo "=================================================================================================="
}

# Check prerequisites
check_prerequisites() {
    log_header "Checking Prerequisites"
    
    local missing_deps=()
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        missing_deps+=("docker")
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        missing_deps+=("docker-compose")
    fi
    
    # Check if compose file exists
    if [[ ! -f "$COMPOSE_FILE" ]]; then
        log_error "Docker Compose file not found: $COMPOSE_FILE"
        exit 1
    fi
    
    if [[ ${#missing_deps[@]} -gt 0 ]]; then
        log_error "Missing required dependencies: ${missing_deps[*]}"
        log_info "Please install the missing dependencies and try again"
        exit 1
    fi
    
    # Check Docker daemon
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running"
        log_info "Please start Docker and try again"
        exit 1
    fi
    
    log_success "All prerequisites met"
}

# Setup directories and permissions
setup_directories() {
    log_header "Setting Up Directories and Permissions"
    
    local directories=(
        "/opt/ai-feedback/logs/admin"
        "/opt/ai-feedback/monitoring/admin/grafana"
        "/opt/ai-feedback/monitoring/admin/prometheus"
        "/var/lib/admin-grafana"
        "/var/lib/admin-prometheus"
    )
    
    for dir in "${directories[@]}"; do
        if [[ ! -d "$dir" ]]; then
            log_info "Creating directory: $dir"
            sudo mkdir -p "$dir" || {
                log_warning "Could not create $dir (continuing without sudo)"
                mkdir -p "$dir" 2>/dev/null || true
            }
        fi
        
        # Set appropriate permissions
        sudo chown -R $(id -u):$(id -g) "$dir" 2>/dev/null || {
            log_warning "Could not set permissions for $dir (continuing)"
        }
    done
    
    log_success "Directories and permissions configured"
}

# Validate environment variables
validate_environment() {
    log_header "Validating Environment Variables"
    
    local required_vars=(
        "DATABASE_URL"
        "REDIS_URL"
        "JWT_SECRET"
    )
    
    local missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            missing_vars+=("$var")
        fi
    done
    
    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        log_error "Missing required environment variables: ${missing_vars[*]}"
        log_info "Please set these environment variables and try again"
        log_info "You can create a .env file in the project root with these variables"
        exit 1
    fi
    
    # Validate database connection
    log_info "Testing database connection..."
    if command -v psql &> /dev/null; then
        if ! psql "$DATABASE_URL" -c "SELECT 1;" &> /dev/null; then
            log_warning "Could not connect to database (service may start anyway)"
        else
            log_success "Database connection validated"
        fi
    else
        log_warning "psql not available, skipping database validation"
    fi
    
    # Validate Redis connection
    log_info "Testing Redis connection..."
    if command -v redis-cli &> /dev/null; then
        local redis_host=$(echo "$REDIS_URL" | sed -n 's/.*@\([^:]*\).*/\1/p')
        local redis_port=$(echo "$REDIS_URL" | sed -n 's/.*:\([0-9]*\).*/\1/p')
        
        if [[ -n "$redis_host" && -n "$redis_port" ]]; then
            if ! redis-cli -h "$redis_host" -p "$redis_port" ping &> /dev/null; then
                log_warning "Could not connect to Redis (service may start anyway)"
            else
                log_success "Redis connection validated"
            fi
        fi
    else
        log_warning "redis-cli not available, skipping Redis validation"
    fi
    
    log_success "Environment validation completed"
}

# Check external dependencies
check_external_dependencies() {
    log_header "Checking External Dependencies"
    
    # Check if main monitoring stack is running
    log_info "Checking for existing monitoring infrastructure..."
    
    local main_prometheus_running=false
    local payment_monitoring_running=false
    
    if docker ps --filter "name=prometheus" --filter "status=running" | grep -q prometheus; then
        main_prometheus_running=true
        log_success "Main Prometheus instance detected"
    else
        log_warning "Main Prometheus instance not running - federation may not work"
    fi
    
    if docker ps --filter "name=payments-prometheus" --filter "status=running" | grep -q payments; then
        payment_monitoring_running=true
        log_success "Payment monitoring infrastructure detected"
    else
        log_info "Payment monitoring infrastructure not detected (optional)"
    fi
    
    # Check networks
    log_info "Checking Docker networks..."
    
    local networks=("monitoring-network" "ai-feedback-prod")
    for network in "${networks[@]}"; do
        if ! docker network ls | grep -q "$network"; then
            log_info "Creating Docker network: $network"
            docker network create "$network" || {
                log_warning "Could not create network $network (may already exist)"
            }
        else
            log_success "Docker network exists: $network"
        fi
    done
}

# Generate configuration files
generate_config() {
    log_header "Generating Configuration Files"
    
    # Generate admin RBAC configuration
    local rbac_config="$MONITORING_DIR/config/admin-rbac.json"
    mkdir -p "$(dirname "$rbac_config")"
    
    cat > "$rbac_config" << EOF
{
  "version": "1.0",
  "swedish_pilot": true,
  "roles": {
    "super_admin": {
      "permissions": ["*"],
      "description": "Full system access"
    },
    "pilot_admin": {
      "permissions": [
        "pilot:*",
        "business:view",
        "business:manage", 
        "monitoring:view",
        "reports:view"
      ],
      "description": "Swedish pilot management"
    },
    "finance_admin": {
      "permissions": [
        "payments:*",
        "reports:*",
        "compliance:view"
      ],
      "description": "Financial operations"
    },
    "support_admin": {
      "permissions": [
        "business:view",
        "support:*",
        "feedback:view"
      ],
      "description": "Customer support"
    }
  },
  "created": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "swedish_compliance": true
}
EOF
    
    # Generate Redis configuration
    local redis_config="$MONITORING_DIR/redis/admin-redis.conf"
    mkdir -p "$(dirname "$redis_config")"
    
    cat > "$redis_config" << EOF
# Admin Redis Configuration for Session Management
bind 0.0.0.0
port 6379
timeout 300
tcp-keepalive 60

# Memory management
maxmemory 128mb
maxmemory-policy allkeys-lru

# Persistence for admin sessions
save 900 1
save 300 10
save 60 10000

# Security
requirepass admin-session-secret
rename-command FLUSHDB ""
rename-command FLUSHALL ""
rename-command CONFIG ""

# Logging
loglevel notice
logfile /var/log/redis/admin-redis.log

# Swedish timezone logging
syslog-enabled yes
syslog-ident admin-redis
syslog-facility local0
EOF
    
    log_success "Configuration files generated"
}

# Pull Docker images
pull_images() {
    log_header "Pulling Docker Images"
    
    log_info "Pulling required Docker images..."
    
    if command -v docker-compose &> /dev/null; then
        docker-compose -f "$COMPOSE_FILE" pull --quiet || {
            log_warning "Some images could not be pulled (continuing anyway)"
        }
    else
        docker compose -f "$COMPOSE_FILE" pull --quiet || {
            log_warning "Some images could not be pulled (continuing anyway)"
        }
    fi
    
    log_success "Docker images ready"
}

# Start services
start_services() {
    log_header "Starting Admin Monitoring Services"
    
    log_info "Starting admin monitoring infrastructure..."
    
    # Export environment variables for Docker Compose
    export DATABASE_URL
    export REDIS_URL
    export JWT_SECRET
    export ADMIN_GRAFANA_PASSWORD
    export SWEDISH_PILOT_MODE
    export ENVIRONMENT
    
    if command -v docker-compose &> /dev/null; then
        docker-compose -f "$COMPOSE_FILE" up -d
    else
        docker compose -f "$COMPOSE_FILE" up -d
    fi
    
    log_success "Admin monitoring services started"
}

# Verify service health
verify_services() {
    log_header "Verifying Service Health"
    
    local services=(
        "admin-activity-logger:3000"
        "admin-metrics-exporter:3000" 
        "pilot-management-api:3000"
        "admin-auth-service:3000"
        "admin-grafana:3000"
        "admin-prometheus:9090"
        "admin-alertmanager:9093"
    )
    
    log_info "Waiting for services to start (30 seconds)..."
    sleep 30
    
    local failed_services=()
    
    for service in "${services[@]}"; do
        local service_name=$(echo "$service" | cut -d':' -f1)
        local port=$(echo "$service" | cut -d':' -f2)
        
        log_info "Checking health of $service_name..."
        
        local health_url="http://localhost:${port}/health"
        if [[ "$service_name" == "admin-grafana" ]]; then
            health_url="http://localhost:${port}/api/health"
        elif [[ "$service_name" == "admin-prometheus" ]]; then
            health_url="http://localhost:${port}/-/healthy"
        elif [[ "$service_name" == "admin-alertmanager" ]]; then
            health_url="http://localhost:${port}/-/healthy"
        fi
        
        if curl -f -s "$health_url" > /dev/null; then
            log_success "$service_name is healthy"
        else
            log_warning "$service_name health check failed"
            failed_services+=("$service_name")
        fi
    done
    
    if [[ ${#failed_services[@]} -eq 0 ]]; then
        log_success "All services are healthy"
    else
        log_warning "Some services failed health checks: ${failed_services[*]}"
        log_info "Services may still be starting up. Check logs with: docker-compose -f $COMPOSE_FILE logs"
    fi
}

# Display access information
display_access_info() {
    log_header "Access Information"
    
    echo -e "${CYAN}Admin Monitoring Services:${NC}"
    echo "  🇸🇪 Admin Grafana:              http://localhost:3023 (admin/${ADMIN_GRAFANA_PASSWORD})"
    echo "  📊 Admin Prometheus:           http://localhost:9095"
    echo "  🚨 Admin AlertManager:         http://localhost:9096"
    echo "  📝 Admin Activity Logger:      http://localhost:3020"
    echo "  📈 Admin Metrics Exporter:     http://localhost:9105/metrics"
    echo "  🏛️ Pilot Management API:       http://localhost:3021"
    echo "  🔐 Admin Authentication:       http://localhost:3022"
    echo ""
    echo -e "${CYAN}Integration Services:${NC}"
    echo "  💾 Admin Session Manager:      localhost:6381 (Redis)"
    echo "  📋 Admin Log Aggregator:       http://localhost:24224"
    echo "  🔍 Pilot Status Monitor:       Background service"
    echo "  📧 Admin Notifications:        Background service"
    echo ""
    echo -e "${CYAN}Swedish Pilot Features:${NC}"
    echo "  • Regional business monitoring (Stockholm, Gothenburg, Malmö)"
    echo "  • Finansinspektionen compliance reporting"
    echo "  • GDPR-compliant admin activity logging"
    echo "  • Swedish Krona (SEK) financial tracking"
    echo "  • Multi-factor authentication for admin users"
    echo "  • Role-based access control (RBAC)"
    echo ""
    echo -e "${CYAN}Default Admin Credentials:${NC}"
    echo "  Email: admin@ai-feedback.se"
    echo "  Password: admin123!"
    echo "  ${YELLOW}⚠️ Please change this password immediately after first login${NC}"
    echo ""
    echo -e "${CYAN}Useful Commands:${NC}"
    echo "  View logs:      docker-compose -f $COMPOSE_FILE logs -f"
    echo "  Stop services:  docker-compose -f $COMPOSE_FILE down"
    echo "  Restart:        docker-compose -f $COMPOSE_FILE restart"
    echo "  Status:         docker-compose -f $COMPOSE_FILE ps"
}

# Setup log rotation
setup_log_rotation() {
    log_header "Setting Up Log Rotation"
    
    local logrotate_config="/etc/logrotate.d/ai-feedback-admin"
    
    sudo tee "$logrotate_config" > /dev/null << EOF || {
        log_warning "Could not create logrotate configuration (skipping)"
        return 0
    }
/opt/ai-feedback/logs/admin/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    copytruncate
    sharedscripts
    postrotate
        # Signal services to reopen log files
        docker-compose -f $COMPOSE_FILE exec admin-activity-logger kill -USR1 1 2>/dev/null || true
        docker-compose -f $COMPOSE_FILE exec pilot-management-api kill -USR1 1 2>/dev/null || true
        docker-compose -f $COMPOSE_FILE exec admin-auth-service kill -USR1 1 2>/dev/null || true
    endscript
}
EOF
    
    log_success "Log rotation configured"
}

# Main function
main() {
    display_banner
    
    check_prerequisites
    setup_directories
    validate_environment
    check_external_dependencies
    generate_config
    pull_images
    start_services
    verify_services
    setup_log_rotation
    display_access_info
    
    log_success "🎉 Admin monitoring infrastructure started successfully!"
    log_info "Swedish pilot management system is ready for operations"
    log_info "Monitor service health at: http://localhost:3023 (Grafana)"
    
    echo ""
    echo -e "${GREEN}=================================================================================================="
    echo "  ✅ Admin Monitoring Infrastructure - OPERATIONAL"
    echo "  🇸🇪 Swedish Pilot Management - READY"
    echo "  📊 Monitoring & Alerting - ACTIVE"
    echo "  🔒 Authentication & Security - ENABLED"
    echo "=================================================================================================="
    echo -e "${NC}"
}

# Handle script arguments
case "${1:-start}" in
    "start"|"")
        main
        ;;
    "stop")
        log_info "Stopping admin monitoring services..."
        if command -v docker-compose &> /dev/null; then
            docker-compose -f "$COMPOSE_FILE" down
        else
            docker compose -f "$COMPOSE_FILE" down
        fi
        log_success "Admin monitoring services stopped"
        ;;
    "restart")
        log_info "Restarting admin monitoring services..."
        if command -v docker-compose &> /dev/null; then
            docker-compose -f "$COMPOSE_FILE" restart
        else
            docker compose -f "$COMPOSE_FILE" restart
        fi
        log_success "Admin monitoring services restarted"
        ;;
    "status")
        log_info "Admin monitoring services status:"
        if command -v docker-compose &> /dev/null; then
            docker-compose -f "$COMPOSE_FILE" ps
        else
            docker compose -f "$COMPOSE_FILE" ps
        fi
        ;;
    "logs")
        log_info "Showing admin monitoring logs..."
        if command -v docker-compose &> /dev/null; then
            docker-compose -f "$COMPOSE_FILE" logs -f
        else
            docker compose -f "$COMPOSE_FILE" logs -f
        fi
        ;;
    "help")
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  start    Start admin monitoring infrastructure (default)"
        echo "  stop     Stop all admin monitoring services"
        echo "  restart  Restart all admin monitoring services"
        echo "  status   Show status of all services"
        echo "  logs     Show live logs from all services"
        echo "  help     Show this help message"
        echo ""
        echo "Swedish Pilot Admin Monitoring Infrastructure"
        echo "Comprehensive monitoring, authentication, and management for Swedish pilot program"
        ;;
    *)
        log_error "Unknown command: $1"
        echo "Use '$0 help' for usage information"
        exit 1
        ;;
esac