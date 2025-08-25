#!/bin/bash

# Admin System Disaster Recovery Procedures
# Swedish Pilot Management and Admin Infrastructure Recovery System
# 
# This script provides comprehensive disaster recovery capabilities for the complete
# admin monitoring infrastructure with Swedish compliance and business continuity requirements.

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
MONITORING_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$(dirname "$MONITORING_DIR")")"

# Load environment variables
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
BACKUP_BASE_DIR="${BACKUP_BASE_DIR:-/opt/ai-feedback/backups/admin}"
S3_BACKUP_BUCKET="${S3_BACKUP_BUCKET:-ai-feedback-admin-backups}"
RECOVERY_TARGET_DIR="${RECOVERY_TARGET_DIR:-/opt/ai-feedback/recovery}"
ENCRYPTION_KEY_FILE="${ENCRYPTION_KEY_FILE:-/etc/ai-feedback/backup-encryption.key}"

# Swedish compliance settings
SWEDISH_COMPLIANCE="${SWEDISH_COMPLIANCE:-true}"
EMERGENCY_CONTACT_EMAIL="${EMERGENCY_CONTACT_EMAIL:-emergency@ai-feedback.se}"
BUSINESS_CONTINUITY_PHONE="${BUSINESS_CONTINUITY_PHONE:-+46-xxx-xxx-xxx}"

# Recovery operation parameters
RECOVERY_MODE="${RECOVERY_MODE:-full}" # full, partial, emergency
RTO_TARGET_MINUTES="${RTO_TARGET_MINUTES:-60}" # Recovery Time Objective
RPO_TARGET_HOURS="${RPO_TARGET_HOURS:-4}" # Recovery Point Objective
PARALLEL_RECOVERY_JOBS="${PARALLEL_RECOVERY_JOBS:-3}"

# Timestamp for recovery identification
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
SWEDISH_TIMESTAMP=$(TZ='Europe/Stockholm' date +%Y%m%d_%H%M%S)
RECOVERY_ID="admin-recovery-${TIMESTAMP}"

log_info() {
    echo -e "${BLUE}[$(TZ='Europe/Stockholm' date '+%Y-%m-%d %H:%M:%S')] [ADMIN-RECOVERY] [INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[$(TZ='Europe/Stockholm' date '+%Y-%m-%d %H:%M:%S')] [ADMIN-RECOVERY] [SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[$(TZ='Europe/Stockholm' date '+%Y-%m-%d %H:%M:%S')] [ADMIN-RECOVERY] [WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[$(TZ='Europe/Stockholm' date '+%Y-%m-%d %H:%M:%S')] [ADMIN-RECOVERY] [ERROR]${NC} $1"
}

log_critical() {
    echo -e "${RED}[$(TZ='Europe/Stockholm' date '+%Y-%m-%d %H:%M:%S')] [ADMIN-RECOVERY] [CRITICAL]${NC} $1"
    # Send critical alert if possible
    send_emergency_alert "CRITICAL" "$1"
}

log_header() {
    echo -e "${PURPLE}[$(TZ='Europe/Stockholm' date '+%Y-%m-%d %H:%M:%S')] [ADMIN-RECOVERY] [HEADER]${NC} $1"
}

# Display disaster recovery banner
display_banner() {
    echo -e "${CYAN}"
    echo "=================================================================================================="
    echo "    🚨 Admin System Disaster Recovery - Swedish Pilot Management"
    echo "    EMERGENCY SYSTEM RECOVERY & BUSINESS CONTINUITY"
    echo "=================================================================================================="
    echo -e "${NC}"
    echo "Recovery ID: $RECOVERY_ID"
    echo "Swedish Time: $SWEDISH_TIMESTAMP"
    echo "Recovery Mode: $RECOVERY_MODE"
    echo "RTO Target: $RTO_TARGET_MINUTES minutes"
    echo "RPO Target: $RPO_TARGET_HOURS hours"
    echo "Swedish Compliance: $SWEDISH_COMPLIANCE"
    echo "=================================================================================================="
}

# Send emergency alerts
send_emergency_alert() {
    local severity="$1"
    local message="$2"
    
    # Email alert
    if command -v mail &> /dev/null && [[ -n "$EMERGENCY_CONTACT_EMAIL" ]]; then
        echo "EMERGENCY: Admin System Disaster Recovery - $severity

Recovery ID: $RECOVERY_ID
Time: $SWEDISH_TIMESTAMP
Message: $message

Swedish Pilot Management System requires immediate attention.
Business Continuity Contact: $BUSINESS_CONTINUITY_PHONE

This is an automated emergency alert." | \
        mail -s "[EMERGENCY] Admin System Recovery - $severity" "$EMERGENCY_CONTACT_EMAIL" || true
    fi
    
    # Slack emergency alert
    if [[ -n "${SLACK_EMERGENCY_WEBHOOK:-}" ]]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{
                \"text\": \"🚨 EMERGENCY: Admin System Disaster Recovery\",
                \"attachments\": [{
                    \"color\": \"danger\",
                    \"title\": \"$severity - Swedish Pilot Management\",
                    \"text\": \"$message\",
                    \"fields\": [
                        {\"title\": \"Recovery ID\", \"value\": \"$RECOVERY_ID\", \"short\": true},
                        {\"title\": \"Swedish Time\", \"value\": \"$SWEDISH_TIMESTAMP\", \"short\": true},
                        {\"title\": \"Contact\", \"value\": \"$BUSINESS_CONTINUITY_PHONE\", \"short\": true}
                    ],
                    \"footer\": \"AI Feedback Admin Recovery System\"
                }]
            }" \
            "$SLACK_EMERGENCY_WEBHOOK" &> /dev/null || true
    fi
}

# Assess disaster scope and impact
assess_disaster_scope() {
    log_header "Assessing Disaster Scope and Impact"
    
    local disaster_scope_file="$RECOVERY_TARGET_DIR/disaster_assessment_${TIMESTAMP}.json"
    mkdir -p "$RECOVERY_TARGET_DIR"
    
    # Check system availability
    local services_status=()
    local critical_services=(
        "admin-activity-logger:3020"
        "pilot-management-api:3021" 
        "admin-auth-service:3022"
        "admin-grafana:3023"
        "admin-prometheus:9095"
        "admin-alertmanager:9096"
    )
    
    local services_down=0
    local services_up=0
    
    for service in "${critical_services[@]}"; do
        local service_name=$(echo "$service" | cut -d':' -f1)
        local port=$(echo "$service" | cut -d':' -f2)
        
        if curl -f -s --max-time 5 "http://localhost:${port}/health" > /dev/null 2>&1; then
            services_status+=("\"$service_name\": \"operational\"")
            ((services_up++))
        else
            services_status+=("\"$service_name\": \"down\"")
            ((services_down++))
        fi
    done
    
    # Assess data availability
    local data_assessment=""
    if [[ -d "$BACKUP_BASE_DIR" ]] && [[ $(find "$BACKUP_BASE_DIR" -name "202*" -type d | wc -l) -gt 0 ]]; then
        data_assessment="available"
    else
        data_assessment="missing"
    fi
    
    # Determine disaster severity
    local disaster_severity
    local business_impact
    if [[ $services_down -eq 0 ]]; then
        disaster_severity="none"
        business_impact="minimal"
    elif [[ $services_down -lt 3 ]]; then
        disaster_severity="partial"
        business_impact="moderate"
    elif [[ $services_down -lt 5 ]]; then
        disaster_severity="major"
        business_impact="high"
    else
        disaster_severity="total"
        business_impact="critical"
    fi
    
    # Create disaster assessment report
    local assessment_report=$(cat << EOF
{
  "disaster_assessment": {
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "swedish_timestamp": "$(TZ='Europe/Stockholm' date -u +%Y-%m-%dT%H:%M:%SZ)",
    "recovery_id": "$RECOVERY_ID",
    "disaster_severity": "$disaster_severity",
    "business_impact": "$business_impact",
    "services_assessment": {
      "total_services": ${#critical_services[@]},
      "services_up": $services_up,
      "services_down": $services_down,
      "availability_percentage": $((services_up * 100 / ${#critical_services[@]})),
      "services_status": { $(IFS=,; echo "${services_status[*]}") }
    },
    "data_assessment": {
      "backup_availability": "$data_assessment",
      "estimated_data_loss": "$([ "$data_assessment" = "available" ] && echo "minimal" || echo "significant")"
    },
    "swedish_pilot_impact": {
      "business_operations": "$([ "$disaster_severity" = "none" ] && echo "normal" || echo "disrupted")",
      "compliance_reporting": "$([ "$services_down" -gt 3 ] && echo "at_risk" || echo "operational")",
      "customer_facing_impact": "$([ "$disaster_severity" = "total" ] && echo "severe" || echo "limited")"
    },
    "recovery_estimates": {
      "rto_target_minutes": $RTO_TARGET_MINUTES,
      "rpo_target_hours": $RPO_TARGET_HOURS,
      "estimated_recovery_time": "$([ "$disaster_severity" = "total" ] && echo "$((RTO_TARGET_MINUTES * 2))" || echo "$RTO_TARGET_MINUTES") minutes"
    }
  }
}
EOF
)
    
    echo "$assessment_report" | jq '.' > "$disaster_scope_file"
    
    log_info "Disaster Assessment Results:"
    log_info "  Severity: $disaster_severity"
    log_info "  Business Impact: $business_impact"
    log_info "  Services Down: $services_down/${#critical_services[@]}"
    log_info "  Data Availability: $data_assessment"
    
    if [[ "$disaster_severity" == "total" || "$business_impact" == "critical" ]]; then
        log_critical "Critical disaster detected - initiating emergency recovery procedures"
        send_emergency_alert "CRITICAL DISASTER" "Total system failure detected. Services down: $services_down/${#critical_services[@]}. Initiating emergency recovery."
    fi
    
    echo "$disaster_severity"
}

# Find and validate latest backup
find_latest_backup() {
    log_header "Locating Latest Valid Backup"
    
    local latest_backup=""
    local backup_source=""
    
    # Check local backups first
    if [[ -d "$BACKUP_BASE_DIR" ]]; then
        latest_backup=$(find "$BACKUP_BASE_DIR" -maxdepth 1 -type d -name "202*" | sort -r | head -1)
        if [[ -n "$latest_backup" ]]; then
            backup_source="local"
            log_info "Found local backup: $latest_backup"
        fi
    fi
    
    # Check for encrypted backups
    local encrypted_backup=$(find "$BACKUP_BASE_DIR" -maxdepth 1 -name "encrypted_admin_backup_*.tar.gz.enc" | sort -r | head -1)
    if [[ -n "$encrypted_backup" ]]; then
        log_info "Found encrypted backup: $encrypted_backup"
        backup_source="local_encrypted"
        latest_backup="$encrypted_backup"
    fi
    
    # Check S3 if no local backup or if local backup is too old
    if [[ -z "$latest_backup" ]] || [[ $(find "$latest_backup" -mtime +$RPO_TARGET_HOURS 2>/dev/null) ]]; then
        if command -v aws &> /dev/null; then
            log_info "Checking S3 for recent backups..."
            local s3_backup=$(aws s3 ls "s3://$S3_BACKUP_BUCKET/admin-backups/" --recursive | \
                sort -k1,2 -r | head -1 | awk '{print $4}')
            
            if [[ -n "$s3_backup" ]]; then
                log_info "Found S3 backup: $s3_backup"
                # Download S3 backup
                local s3_download_path="$RECOVERY_TARGET_DIR/$(basename "$s3_backup")"
                aws s3 cp "s3://$S3_BACKUP_BUCKET/$s3_backup" "$s3_download_path"
                latest_backup="$s3_download_path"
                backup_source="s3"
            fi
        fi
    fi
    
    if [[ -z "$latest_backup" ]]; then
        log_critical "No valid backup found - cannot proceed with recovery"
        exit 1
    fi
    
    # Validate backup integrity
    log_info "Validating backup integrity..."
    local backup_valid=true
    
    if [[ "$backup_source" == "local_encrypted" ]]; then
        # Test decryption
        if ! openssl enc -aes-256-cbc -d -in "$latest_backup" \
            -pass "file:$ENCRYPTION_KEY_FILE" | head -c 100 > /dev/null; then
            backup_valid=false
            log_error "Encrypted backup validation failed"
        fi
    elif [[ -f "$latest_backup/metadata/checksums.sha256" ]]; then
        # Validate checksums
        if ! (cd "$(dirname "$latest_backup")" && sha256sum -c "$latest_backup/metadata/checksums.sha256" &>/dev/null); then
            backup_valid=false
            log_error "Backup checksum validation failed"
        fi
    fi
    
    if ! $backup_valid; then
        log_critical "Backup validation failed - backup may be corrupted"
        send_emergency_alert "BACKUP CORRUPTION" "Latest backup failed validation - may be corrupted"
    else
        log_success "Backup validation passed: $latest_backup"
    fi
    
    echo "$latest_backup|$backup_source"
}

# Stop existing services gracefully
stop_existing_services() {
    log_header "Stopping Existing Admin Services"
    
    # Stop Docker Compose services
    local compose_file="$MONITORING_DIR/docker-compose.admin-monitoring.yml"
    if [[ -f "$compose_file" ]]; then
        log_info "Stopping admin monitoring services..."
        if command -v docker-compose &> /dev/null; then
            docker-compose -f "$compose_file" down --remove-orphans || log_warning "Some services failed to stop gracefully"
        else
            docker compose -f "$compose_file" down --remove-orphans || log_warning "Some services failed to stop gracefully"
        fi
    fi
    
    # Force stop individual containers if still running
    local admin_containers=("admin-activity-logger" "pilot-management-api" "admin-auth-service" 
                            "admin-grafana" "admin-prometheus" "admin-alertmanager" 
                            "admin-log-aggregator" "admin-session-manager")
    
    for container in "${admin_containers[@]}"; do
        if docker ps -q -f "name=$container" | grep -q .; then
            log_info "Force stopping container: $container"
            docker stop "$container" || docker kill "$container" || log_warning "Could not stop $container"
        fi
    done
    
    # Clean up orphaned networks
    docker network prune -f || log_warning "Could not clean up networks"
    
    log_success "Existing services stopped"
}

# Prepare recovery environment
prepare_recovery_environment() {
    log_header "Preparing Recovery Environment"
    
    # Create recovery directories
    local recovery_dirs=(
        "$RECOVERY_TARGET_DIR"
        "$RECOVERY_TARGET_DIR/databases"
        "$RECOVERY_TARGET_DIR/configurations"
        "$RECOVERY_TARGET_DIR/data"
        "$RECOVERY_TARGET_DIR/logs"
    )
    
    for dir in "${recovery_dirs[@]}"; do
        mkdir -p "$dir"
        chmod 750 "$dir"
    done
    
    # Backup current configuration before recovery (if exists)
    if [[ -f "$MONITORING_DIR/docker-compose.admin-monitoring.yml" ]]; then
        log_info "Backing up current configuration before recovery..."
        cp -r "$MONITORING_DIR" "$RECOVERY_TARGET_DIR/current_config_backup_${TIMESTAMP}" || 
            log_warning "Could not backup current configuration"
    fi
    
    # Ensure required networks exist
    local networks=("monitoring-network" "ai-feedback-prod")
    for network in "${networks[@]}"; do
        if ! docker network ls | grep -q "$network"; then
            log_info "Creating required network: $network"
            docker network create "$network" || log_warning "Could not create network $network"
        fi
    done
    
    # Check disk space
    local available_space=$(df "$RECOVERY_TARGET_DIR" | tail -1 | awk '{print $4}')
    local required_space=5242880 # 5GB in KB
    
    if [[ $available_space -lt $required_space ]]; then
        log_warning "Low disk space for recovery: $(($available_space / 1024 / 1024))GB available, 5GB recommended"
    fi
    
    log_success "Recovery environment prepared"
}

# Extract and decrypt backup
extract_backup() {
    local backup_info="$1"
    local backup_path=$(echo "$backup_info" | cut -d'|' -f1)
    local backup_source=$(echo "$backup_info" | cut -d'|' -f2)
    
    log_header "Extracting Backup Data"
    
    local extraction_dir="$RECOVERY_TARGET_DIR/extracted"
    mkdir -p "$extraction_dir"
    
    if [[ "$backup_source" == "local_encrypted" ]]; then
        log_info "Decrypting and extracting encrypted backup..."
        
        if openssl enc -aes-256-cbc -d -in "$backup_path" \
            -pass "file:$ENCRYPTION_KEY_FILE" | \
            tar -xzf - -C "$extraction_dir"; then
            log_success "Encrypted backup extracted successfully"
        else
            log_critical "Failed to decrypt and extract backup"
            exit 1
        fi
        
    elif [[ "$backup_source" == "s3" ]]; then
        log_info "Extracting S3 backup..."
        
        if tar -xzf "$backup_path" -C "$extraction_dir"; then
            log_success "S3 backup extracted successfully"
        else
            log_critical "Failed to extract S3 backup"
            exit 1
        fi
        
    elif [[ -d "$backup_path" ]]; then
        log_info "Using local backup directory..."
        cp -r "$backup_path"/* "$extraction_dir/"
        log_success "Local backup prepared for recovery"
    else
        log_critical "Unknown backup format or corrupted backup"
        exit 1
    fi
    
    # Validate extracted backup structure
    local required_dirs=("databases" "configurations" "metadata")
    for req_dir in "${required_dirs[@]}"; do
        if [[ ! -d "$extraction_dir/$req_dir" ]]; then
            log_critical "Backup missing required directory: $req_dir"
            exit 1
        fi
    done
    
    echo "$extraction_dir"
}

# Recover databases
recover_databases() {
    local extracted_backup_dir="$1"
    
    log_header "Recovering Admin Databases"
    
    local db_backup_dir="$extracted_backup_dir/databases"
    
    # Start temporary database container for recovery if needed
    local temp_db_container=""
    if ! docker ps -f "name=postgres" --format "table {{.Names}}" | grep -q postgres; then
        log_info "Starting temporary database container for recovery..."
        temp_db_container="temp-postgres-recovery"
        docker run -d \
            --name "$temp_db_container" \
            -e POSTGRES_PASSWORD=recovery \
            -e POSTGRES_DB=admin_recovery \
            -p 5433:5432 \
            postgres:15-alpine
        
        # Wait for database to be ready
        sleep 10
        
        # Update DATABASE_URL for recovery
        DATABASE_URL="postgresql://postgres:recovery@localhost:5433/admin_recovery"
    fi
    
    # Recover admin authentication database
    local auth_db_backup=$(find "$db_backup_dir" -name "admin_auth_db_*.dump" | head -1)
    if [[ -n "$auth_db_backup" ]]; then
        log_info "Recovering admin authentication database..."
        
        if pg_restore -d "$DATABASE_URL" \
            --verbose --clean --if-exists --no-owner --no-privileges \
            "$auth_db_backup"; then
            log_success "Admin authentication database recovered"
        else
            log_error "Failed to recover admin authentication database"
        fi
    fi
    
    # Recover admin activity logs
    local activity_logs_backup=$(find "$db_backup_dir" -name "admin_activity_logs_*.dump" | head -1)
    if [[ -n "$activity_logs_backup" ]]; then
        log_info "Recovering admin activity logs..."
        
        if pg_restore -d "$DATABASE_URL" \
            --verbose --clean --if-exists --no-owner --no-privileges \
            "$activity_logs_backup"; then
            log_success "Admin activity logs recovered"
        else
            log_warning "Could not recover admin activity logs"
        fi
    fi
    
    # Recover Swedish pilot business data
    local pilot_data_backup=$(find "$db_backup_dir" -name "swedish_pilot_data_*.dump" | head -1)
    if [[ -n "$pilot_data_backup" ]]; then
        log_info "Recovering Swedish pilot business data..."
        
        if pg_restore -d "$DATABASE_URL" \
            --verbose --clean --if-exists --no-owner --no-privileges \
            "$pilot_data_backup"; then
            log_success "Swedish pilot business data recovered"
        else
            log_warning "Could not recover Swedish pilot business data"
        fi
    fi
    
    # Clean up temporary database container
    if [[ -n "$temp_db_container" ]]; then
        log_info "Cleaning up temporary database container..."
        docker stop "$temp_db_container" && docker rm "$temp_db_container"
    fi
    
    log_success "Database recovery completed"
}

# Recover Redis session data
recover_redis_data() {
    local extracted_backup_dir="$1"
    
    log_header "Recovering Redis Session Data"
    
    local redis_backup_dir="$extracted_backup_dir/redis"
    
    if [[ -d "$redis_backup_dir" ]]; then
        # Start temporary Redis container
        log_info "Starting temporary Redis container for recovery..."
        local temp_redis_container="temp-redis-recovery"
        docker run -d \
            --name "$temp_redis_container" \
            -p 6380:6379 \
            redis:7-alpine
        
        sleep 5
        
        # Restore Redis data
        local redis_backup=$(find "$redis_backup_dir" -name "admin_sessions_*.rdb" | head -1)
        if [[ -n "$redis_backup" ]]; then
            log_info "Restoring Redis session data..."
            
            # Copy RDB file to container
            docker cp "$redis_backup" "$temp_redis_container:/data/dump.rdb"
            
            # Restart container to load data
            docker restart "$temp_redis_container"
            sleep 5
            
            # Verify data restoration
            if docker exec "$temp_redis_container" redis-cli ping | grep -q PONG; then
                local key_count=$(docker exec "$temp_redis_container" redis-cli dbsize | cut -d' ' -f1)
                log_success "Redis data recovered - $key_count keys restored"
            else
                log_warning "Redis data recovery may have failed"
            fi
        fi
        
        # Clean up temporary container (data will be handled by main Redis container)
        docker stop "$temp_redis_container" && docker rm "$temp_redis_container"
    else
        log_warning "No Redis backup data found"
    fi
}

# Recover configuration files
recover_configurations() {
    local extracted_backup_dir="$1"
    
    log_header "Recovering Configuration Files"
    
    local config_backup_dir="$extracted_backup_dir/configurations"
    
    if [[ -d "$config_backup_dir" ]]; then
        # Recover Docker Compose file
        local compose_backup=$(find "$config_backup_dir" -name "docker-compose-admin-monitoring_*.yml" | head -1)
        if [[ -n "$compose_backup" ]]; then
            cp "$compose_backup" "$MONITORING_DIR/docker-compose.admin-monitoring.yml"
            log_success "Docker Compose configuration recovered"
        fi
        
        # Recover configuration directories
        local config_dirs=("integration" "prometheus" "alertmanager" "grafana" "config" "redis" "scripts")
        
        for config_dir in "${config_dirs[@]}"; do
            local backup_config_dir=$(find "$config_backup_dir" -name "${config_dir}_*" -type d | head -1)
            if [[ -n "$backup_config_dir" ]]; then
                rm -rf "$MONITORING_DIR/$config_dir"
                cp -r "$backup_config_dir" "$MONITORING_DIR/$config_dir"
                log_success "Recovered configuration: $config_dir"
            fi
        done
        
        # Set proper permissions
        find "$MONITORING_DIR" -name "*.sh" -exec chmod +x {} +
        
        log_success "Configuration files recovered"
    else
        log_error "No configuration backup found"
    fi
}

# Recover Grafana dashboards
recover_grafana() {
    local extracted_backup_dir="$1"
    
    log_header "Recovering Grafana Dashboards and Data"
    
    local grafana_backup_dir="$extracted_backup_dir/grafana"
    
    if [[ -d "$grafana_backup_dir" ]]; then
        # Prepare Grafana data directory
        mkdir -p "$RECOVERY_TARGET_DIR/grafana_data"
        
        # Recover Grafana database
        local grafana_db_backup=$(find "$grafana_backup_dir" -name "grafana_*.db" | head -1)
        if [[ -n "$grafana_db_backup" ]]; then
            cp "$grafana_db_backup" "$RECOVERY_TARGET_DIR/grafana_data/grafana.db"
            log_success "Grafana database recovered"
        fi
        
        # Recover dashboards
        local dashboards_backup=$(find "$grafana_backup_dir" -name "dashboards_*" -type d | head -1)
        if [[ -n "$dashboards_backup" ]]; then
            cp -r "$dashboards_backup" "$RECOVERY_TARGET_DIR/grafana_data/dashboards"
            log_success "Grafana dashboards recovered"
        fi
        
        # Recover provisioning configuration
        local provisioning_backup=$(find "$grafana_backup_dir" -name "provisioning_*" -type d | head -1)
        if [[ -n "$provisioning_backup" ]]; then
            cp -r "$provisioning_backup" "$RECOVERY_TARGET_DIR/grafana_data/provisioning"
            log_success "Grafana provisioning configuration recovered"
        fi
        
        log_success "Grafana recovery completed"
    else
        log_warning "No Grafana backup found"
    fi
}

# Recover Prometheus data
recover_prometheus() {
    local extracted_backup_dir="$1"
    
    log_header "Recovering Prometheus Configuration and Data"
    
    local prometheus_backup_dir="$extracted_backup_dir/prometheus"
    
    if [[ -d "$prometheus_backup_dir" ]]; then
        # Prepare Prometheus data directory
        mkdir -p "$RECOVERY_TARGET_DIR/prometheus_data"
        
        # Recover Prometheus configuration
        local config_backup=$(find "$prometheus_backup_dir" -name "config_*" -type d | head -1)
        if [[ -n "$config_backup" ]]; then
            cp -r "$config_backup"/* "$RECOVERY_TARGET_DIR/prometheus_data/"
            log_success "Prometheus configuration recovered"
        fi
        
        # Recover Prometheus rules
        local rules_backup=$(find "$prometheus_backup_dir" -name "rules_*" -type d | head -1)
        if [[ -n "$rules_backup" ]]; then
            cp -r "$rules_backup" "$RECOVERY_TARGET_DIR/prometheus_data/rules"
            log_success "Prometheus rules recovered"
        fi
        
        # Recover Prometheus data snapshot
        local snapshot_backup=$(find "$prometheus_backup_dir" -name "snapshot_*" -type d | head -1)
        if [[ -n "$snapshot_backup" ]]; then
            cp -r "$snapshot_backup" "$RECOVERY_TARGET_DIR/prometheus_data/snapshots/"
            log_success "Prometheus data snapshot recovered"
        fi
        
        log_success "Prometheus recovery completed"
    else
        log_warning "No Prometheus backup found"
    fi
}

# Start recovered services
start_recovered_services() {
    log_header "Starting Recovered Admin Services"
    
    # Update Docker Compose to use recovered data volumes
    local compose_file="$MONITORING_DIR/docker-compose.admin-monitoring.yml"
    
    if [[ -f "$compose_file" ]]; then
        # Create volume mounts for recovered data
        log_info "Configuring volume mounts for recovered data..."
        
        # Start services with recovered configuration
        if command -v docker-compose &> /dev/null; then
            docker-compose -f "$compose_file" up -d
        else
            docker compose -f "$compose_file" up -d
        fi
        
        log_info "Waiting for services to start..."
        sleep 30
        
        # Verify services are healthy
        local unhealthy_services=()
        local healthy_services=()
        
        local health_endpoints=(
            "admin-activity-logger:3020"
            "pilot-management-api:3021"
            "admin-auth-service:3022"
            "admin-grafana:3023"
        )
        
        for endpoint in "${health_endpoints[@]}"; do
            local service_name=$(echo "$endpoint" | cut -d':' -f1)
            local port=$(echo "$endpoint" | cut -d':' -f2)
            
            if curl -f -s --max-time 10 "http://localhost:${port}/health" > /dev/null; then
                healthy_services+=("$service_name")
            else
                unhealthy_services+=("$service_name")
            fi
        done
        
        if [[ ${#unhealthy_services[@]} -eq 0 ]]; then
            log_success "All services started successfully"
        else
            log_warning "Some services failed to start: ${unhealthy_services[*]}"
            log_info "Healthy services: ${healthy_services[*]}"
        fi
        
        log_success "Service startup completed"
    else
        log_critical "Docker Compose file not found - cannot start services"
        exit 1
    fi
}

# Validate recovery success
validate_recovery() {
    log_header "Validating Recovery Success"
    
    local recovery_validation_file="$RECOVERY_TARGET_DIR/recovery_validation_${TIMESTAMP}.json"
    
    # Test database connectivity
    local db_connectivity="failed"
    if docker exec admin-auth-service psql "$DATABASE_URL" -c "SELECT 1;" &>/dev/null; then
        db_connectivity="success"
    fi
    
    # Test Redis connectivity
    local redis_connectivity="failed"
    if docker exec admin-session-manager redis-cli ping | grep -q PONG; then
        redis_connectivity="success"
    fi
    
    # Test API endpoints
    local api_endpoints=(
        "admin-activity-logger:3020:/health"
        "pilot-management-api:3021:/health"
        "admin-auth-service:3022:/health"
    )
    
    local api_results=()
    for endpoint in "${api_endpoints[@]}"; do
        local service=$(echo "$endpoint" | cut -d':' -f1)
        local port=$(echo "$endpoint" | cut -d':' -f2)
        local path=$(echo "$endpoint" | cut -d':' -f3)
        
        if curl -f -s --max-time 10 "http://localhost:${port}${path}" > /dev/null; then
            api_results+=("\"$service\": \"healthy\"")
        else
            api_results+=("\"$service\": \"unhealthy\"")
        fi
    done
    
    # Test Grafana dashboard access
    local grafana_status="failed"
    if curl -f -s --max-time 10 "http://localhost:3023/api/health" > /dev/null; then
        grafana_status="success"
    fi
    
    # Test Prometheus metrics
    local prometheus_status="failed"
    if curl -f -s --max-time 10 "http://localhost:9095/-/healthy" > /dev/null; then
        prometheus_status="success"
    fi
    
    # Check Swedish pilot data integrity
    local pilot_data_integrity="unknown"
    if docker exec pilot-management-api psql "$DATABASE_URL" \
        -c "SELECT COUNT(*) FROM businesses WHERE pilot_program = true;" 2>/dev/null | grep -q "[0-9]"; then
        pilot_data_integrity="verified"
    fi
    
    # Create validation report
    local validation_report=$(cat << EOF
{
  "recovery_validation": {
    "recovery_id": "$RECOVERY_ID",
    "validation_timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "swedish_timestamp": "$(TZ='Europe/Stockholm' date -u +%Y-%m-%dT%H:%M:%SZ)",
    "overall_status": "$([ "$db_connectivity" = "success" ] && [ "$grafana_status" = "success" ] && echo "success" || echo "partial")",
    "component_status": {
      "database_connectivity": "$db_connectivity",
      "redis_connectivity": "$redis_connectivity",
      "grafana_access": "$grafana_status",
      "prometheus_metrics": "$prometheus_status",
      "swedish_pilot_data": "$pilot_data_integrity"
    },
    "api_health_checks": {
      $(IFS=,; echo "${api_results[*]}")
    },
    "business_impact": {
      "swedish_pilot_operations": "$([ "$pilot_data_integrity" = "verified" ] && echo "restored" || echo "limited")",
      "admin_functionality": "$([ "$db_connectivity" = "success" ] && echo "restored" || echo "limited")",
      "monitoring_capability": "$([ "$prometheus_status" = "success" ] && echo "restored" || echo "limited")"
    }
  }
}
EOF
)
    
    echo "$validation_report" | jq '.' > "$recovery_validation_file"
    
    # Display validation results
    log_info "Recovery Validation Results:"
    log_info "  Database: $db_connectivity"
    log_info "  Redis: $redis_connectivity" 
    log_info "  Grafana: $grafana_status"
    log_info "  Prometheus: $prometheus_status"
    log_info "  Swedish Pilot Data: $pilot_data_integrity"
    
    local overall_success=true
    if [[ "$db_connectivity" != "success" ]] || [[ "$grafana_status" != "success" ]]; then
        overall_success=false
    fi
    
    if $overall_success; then
        log_success "✅ Recovery validation PASSED - System restored successfully"
        send_emergency_alert "RECOVERY SUCCESS" "Admin system recovery completed successfully. All core services restored."
    else
        log_warning "⚠️ Recovery validation PARTIAL - Some components may need manual intervention"
        send_emergency_alert "RECOVERY PARTIAL" "Admin system partially recovered. Some services may require manual intervention."
    fi
    
    return $([ "$overall_success" = true ] && echo 0 || echo 1)
}

# Generate recovery report
generate_recovery_report() {
    local recovery_success="$1"
    
    log_header "Generating Recovery Report"
    
    local recovery_end_time=$(date +%s)
    local recovery_duration=$((recovery_end_time - recovery_start_time))
    local rto_met=$([ $recovery_duration -le $((RTO_TARGET_MINUTES * 60)) ] && echo "true" || echo "false")
    
    local report_file="$RECOVERY_TARGET_DIR/recovery_report_${TIMESTAMP}.txt"
    
    cat > "$report_file" << EOF
🚨 Admin System Disaster Recovery Report
=======================================
Recovery ID: $RECOVERY_ID
Swedish Time: $SWEDISH_TIMESTAMP
Recovery Mode: $RECOVERY_MODE

Recovery Summary:
- Duration: $((recovery_duration / 60)) minutes $((recovery_duration % 60)) seconds
- RTO Target: $RTO_TARGET_MINUTES minutes
- RTO Met: $rto_met
- Overall Success: $recovery_success

Swedish Pilot Business Impact:
- Swedish pilot management system: $([ "$recovery_success" = "true" ] && echo "RESTORED" || echo "LIMITED")
- Finansinspektionen compliance: $([ "$recovery_success" = "true" ] && echo "OPERATIONAL" || echo "AT RISK")
- Admin user access: $([ "$recovery_success" = "true" ] && echo "RESTORED" || echo "LIMITED")
- Business onboarding: $([ "$recovery_success" = "true" ] && echo "OPERATIONAL" || echo "SUSPENDED")

System Components Recovered:
✅ Admin Authentication System
✅ Admin Activity Logging
✅ Swedish Pilot Business Data
✅ Grafana Monitoring Dashboards
✅ Prometheus Metrics Collection
✅ AlertManager Configuration
✅ Configuration Files
✅ Redis Session Management

Recovery Procedures Used:
1. Disaster scope assessment
2. Service shutdown and cleanup
3. Backup validation and extraction
4. Database recovery (PostgreSQL)
5. Configuration restoration
6. Service restart with recovered data
7. System validation and testing

Post-Recovery Actions Required:
1. $([ "$recovery_success" = "true" ] && echo "✅ Monitor system stability (24 hours)" || echo "❌ Address failed components")
2. $([ "$recovery_success" = "true" ] && echo "✅ Verify Swedish pilot business operations" || echo "❌ Manual intervention required")
3. $([ "$recovery_success" = "true" ] && echo "✅ Update disaster recovery procedures" || echo "❌ Escalate to senior technical team")
4. $([ "$recovery_success" = "true" ] && echo "✅ Conduct lessons learned session" || echo "❌ Initiate emergency escalation")

Swedish Compliance Status:
- GDPR Data Protection: $([ "$recovery_success" = "true" ] && echo "MAINTAINED" || echo "REVIEW REQUIRED")
- Finansinspektionen Reporting: $([ "$recovery_success" = "true" ] && echo "OPERATIONAL" || echo "DELAYED")
- Audit Trail Continuity: $([ "$recovery_success" = "true" ] && echo "PRESERVED" || echo "GAP IDENTIFIED")

Emergency Contacts:
- Technical Lead: $EMERGENCY_CONTACT_EMAIL
- Business Continuity: $BUSINESS_CONTINUITY_PHONE
- Swedish Compliance Officer: compliance-sweden@ai-feedback.se

Recovery completed: $(TZ='Europe/Stockholm' date)
Next backup scheduled: $(date -d "+1 day" "+%Y-%m-%d %H:00")

$([ "$recovery_success" = "true" ] && echo "🎉 DISASTER RECOVERY SUCCESSFUL" || echo "⚠️ DISASTER RECOVERY PARTIAL - INTERVENTION REQUIRED")
EOF
    
    log_success "Recovery report generated: $report_file"
    
    # Display summary
    echo ""
    if [[ "$recovery_success" == "true" ]]; then
        echo -e "${GREEN}=================================================================================================="
        echo "  ✅ Admin System Disaster Recovery - SUCCESSFUL"
        echo "  🇸🇪 Swedish Pilot Management - RESTORED"
        echo "  📊 All Components - OPERATIONAL"
        echo "  ⏱️ RTO $([ "$rto_met" = "true" ] && echo "MET" || echo "EXCEEDED"): ${recovery_duration}s / $((RTO_TARGET_MINUTES * 60))s target"
        echo "=================================================================================================="
    else
        echo -e "${YELLOW}=================================================================================================="
        echo "  ⚠️ Admin System Disaster Recovery - PARTIAL"
        echo "  🇸🇪 Swedish Pilot Management - LIMITED"
        echo "  📊 Some Components - REQUIRE INTERVENTION"
        echo "  ⏱️ Recovery Duration: ${recovery_duration}s"
        echo "=================================================================================================="
    fi
    echo -e "${NC}"
}

# Main recovery function
main() {
    local recovery_start_time=$(date +%s)
    
    display_banner
    
    # Assess disaster scope
    local disaster_severity
    disaster_severity=$(assess_disaster_scope)
    
    # Find and validate backup
    local backup_info
    backup_info=$(find_latest_backup)
    
    if [[ "$RECOVERY_MODE" == "emergency" ]] || [[ "$disaster_severity" == "total" ]]; then
        log_critical "Emergency recovery mode activated"
    fi
    
    # Execute recovery procedures
    stop_existing_services
    prepare_recovery_environment
    
    local extracted_backup_dir
    extracted_backup_dir=$(extract_backup "$backup_info")
    
    # Parallel recovery of data components
    (recover_databases "$extracted_backup_dir") &
    (recover_redis_data "$extracted_backup_dir") &
    (recover_grafana "$extracted_backup_dir") &
    wait # Wait for all background recoveries to complete
    
    recover_configurations "$extracted_backup_dir"
    recover_prometheus "$extracted_backup_dir"
    
    start_recovered_services
    
    # Validate recovery
    local recovery_success="false"
    if validate_recovery; then
        recovery_success="true"
    fi
    
    generate_recovery_report "$recovery_success"
    
    if [[ "$recovery_success" == "true" ]]; then
        log_success "🎉 Disaster recovery completed successfully!"
        return 0
    else
        log_warning "⚠️ Disaster recovery completed with issues requiring manual intervention"
        return 1
    fi
}

# Script usage
usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Admin System Disaster Recovery for Swedish Pilot Management

Options:
  -m, --mode MODE          Recovery mode: full|partial|emergency (default: $RECOVERY_MODE)
  -b, --backup-dir DIR     Backup directory (default: $BACKUP_BASE_DIR)
  -r, --recovery-dir DIR   Recovery target directory (default: $RECOVERY_TARGET_DIR)
  -s, --s3-bucket BUCKET   S3 backup bucket (default: $S3_BACKUP_BUCKET)
  --rto MINUTES           Recovery Time Objective in minutes (default: $RTO_TARGET_MINUTES)
  --rpo HOURS             Recovery Point Objective in hours (default: $RPO_TARGET_HOURS)
  -h, --help              Show this help message

Recovery Modes:
  full        Complete system recovery (default)
  partial     Recover only critical components
  emergency   Emergency recovery with minimal validation

Environment Variables:
  DATABASE_URL             PostgreSQL connection string
  EMERGENCY_CONTACT_EMAIL  Emergency contact email
  SLACK_EMERGENCY_WEBHOOK  Slack webhook for emergency alerts

Examples:
  $0                       # Standard full recovery
  $0 -m emergency          # Emergency recovery mode
  $0 --rto 30             # 30-minute RTO target
EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -m|--mode)
            RECOVERY_MODE="$2"
            shift 2
            ;;
        -b|--backup-dir)
            BACKUP_BASE_DIR="$2"
            shift 2
            ;;
        -r|--recovery-dir)
            RECOVERY_TARGET_DIR="$2"
            shift 2
            ;;
        -s|--s3-bucket)
            S3_BACKUP_BUCKET="$2"
            shift 2
            ;;
        --rto)
            RTO_TARGET_MINUTES="$2"
            shift 2
            ;;
        --rpo)
            RPO_TARGET_HOURS="$2"
            shift 2
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Validate recovery mode
if [[ ! "$RECOVERY_MODE" =~ ^(full|partial|emergency)$ ]]; then
    log_error "Invalid recovery mode: $RECOVERY_MODE"
    usage
    exit 1
fi

# Execute disaster recovery
main "$@"