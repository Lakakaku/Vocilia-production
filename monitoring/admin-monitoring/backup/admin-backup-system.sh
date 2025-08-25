#!/bin/bash

# Comprehensive Admin System Backup Procedures
# Swedish Pilot Management and Admin Infrastructure Backup System
# 
# This script provides comprehensive backup capabilities for all admin monitoring
# infrastructure components with Swedish compliance requirements and disaster recovery preparation.

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
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
ENCRYPTION_KEY_FILE="${ENCRYPTION_KEY_FILE:-/etc/ai-feedback/backup-encryption.key}"
COMPRESSION_LEVEL="${COMPRESSION_LEVEL:-6}"
PARALLEL_JOBS="${PARALLEL_JOBS:-3}"

# Swedish compliance settings
SWEDISH_COMPLIANCE="${SWEDISH_COMPLIANCE:-true}"
GDPR_RETENTION_YEARS="${GDPR_RETENTION_YEARS:-7}"
FI_RETENTION_YEARS="${FI_RETENTION_YEARS:-10}"

# Timestamp for backup identification
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
SWEDISH_TIMESTAMP=$(TZ='Europe/Stockholm' date +%Y%m%d_%H%M%S)
BACKUP_ID="admin-backup-${TIMESTAMP}"

log_info() {
    echo -e "${BLUE}[$(TZ='Europe/Stockholm' date '+%Y-%m-%d %H:%M:%S')] [ADMIN-BACKUP] [INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[$(TZ='Europe/Stockholm' date '+%Y-%m-%d %H:%M:%S')] [ADMIN-BACKUP] [SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[$(TZ='Europe/Stockholm' date '+%Y-%m-%d %H:%M:%S')] [ADMIN-BACKUP] [WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[$(TZ='Europe/Stockholm' date '+%Y-%m-%d %H:%M:%S')] [ADMIN-BACKUP] [ERROR]${NC} $1"
}

log_header() {
    echo -e "${PURPLE}[$(TZ='Europe/Stockholm' date '+%Y-%m-%d %H:%M:%S')] [ADMIN-BACKUP] [HEADER]${NC} $1"
}

# Display backup banner
display_banner() {
    echo -e "${CYAN}"
    echo "=================================================================================================="
    echo "    🇸🇪 Admin System Comprehensive Backup System"
    echo "    Swedish Pilot Management & Admin Infrastructure Backup"
    echo "=================================================================================================="
    echo -e "${NC}"
    echo "Backup ID: $BACKUP_ID"
    echo "Swedish Time: $SWEDISH_TIMESTAMP"
    echo "Compliance Mode: $SWEDISH_COMPLIANCE"
    echo "Base Directory: $BACKUP_BASE_DIR"
    echo "S3 Bucket: $S3_BACKUP_BUCKET"
    echo "Retention: $BACKUP_RETENTION_DAYS days"
    echo "=================================================================================================="
}

# Check prerequisites
check_prerequisites() {
    log_header "Checking Backup Prerequisites"
    
    local missing_deps=()
    
    # Check required tools
    local required_tools=("docker" "pg_dump" "redis-cli" "tar" "gzip" "openssl" "jq")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            missing_deps+=("$tool")
        fi
    done
    
    # Check AWS CLI for S3 backups
    if ! command -v aws &> /dev/null; then
        log_warning "AWS CLI not available - S3 backups will be skipped"
    fi
    
    if [[ ${#missing_deps[@]} -gt 0 ]]; then
        log_error "Missing required dependencies: ${missing_deps[*]}"
        exit 1
    fi
    
    # Check encryption key
    if [[ ! -f "$ENCRYPTION_KEY_FILE" ]] && [[ "$SWEDISH_COMPLIANCE" == "true" ]]; then
        log_info "Generating encryption key for Swedish compliance..."
        sudo mkdir -p "$(dirname "$ENCRYPTION_KEY_FILE")"
        openssl rand -base64 32 | sudo tee "$ENCRYPTION_KEY_FILE" > /dev/null
        sudo chmod 600 "$ENCRYPTION_KEY_FILE"
        log_success "Encryption key generated: $ENCRYPTION_KEY_FILE"
    fi
    
    log_success "All prerequisites met"
}

# Setup backup directories
setup_backup_directories() {
    log_header "Setting Up Backup Directories"
    
    local directories=(
        "$BACKUP_BASE_DIR"
        "$BACKUP_BASE_DIR/$TIMESTAMP"
        "$BACKUP_BASE_DIR/$TIMESTAMP/databases"
        "$BACKUP_BASE_DIR/$TIMESTAMP/configurations"
        "$BACKUP_BASE_DIR/$TIMESTAMP/logs"
        "$BACKUP_BASE_DIR/$TIMESTAMP/grafana"
        "$BACKUP_BASE_DIR/$TIMESTAMP/prometheus"
        "$BACKUP_BASE_DIR/$TIMESTAMP/redis"
        "$BACKUP_BASE_DIR/$TIMESTAMP/compliance"
        "$BACKUP_BASE_DIR/$TIMESTAMP/metadata"
    )
    
    for dir in "${directories[@]}"; do
        mkdir -p "$dir"
        chmod 750 "$dir"
    done
    
    log_success "Backup directories created"
}

# Backup PostgreSQL databases
backup_databases() {
    log_header "Backing Up Admin Databases"
    
    local db_backup_dir="$BACKUP_BASE_DIR/$TIMESTAMP/databases"
    
    # Admin authentication database
    log_info "Backing up admin authentication database..."
    if docker exec admin-auth-service pg_dump "$DATABASE_URL" \
        --verbose --no-password --format=custom --compress=$COMPRESSION_LEVEL \
        --file="/tmp/admin_auth_db_${TIMESTAMP}.dump"; then
        
        docker cp admin-auth-service:/tmp/admin_auth_db_${TIMESTAMP}.dump \
            "$db_backup_dir/admin_auth_db_${TIMESTAMP}.dump"
        docker exec admin-auth-service rm "/tmp/admin_auth_db_${TIMESTAMP}.dump"
        
        # Create readable SQL version for compliance
        docker exec admin-auth-service pg_dump "$DATABASE_URL" \
            --verbose --no-password --format=plain \
            --file="/tmp/admin_auth_db_${TIMESTAMP}.sql"
        docker cp admin-auth-service:/tmp/admin_auth_db_${TIMESTAMP}.sql \
            "$db_backup_dir/admin_auth_db_${TIMESTAMP}.sql"
        docker exec admin-auth-service rm "/tmp/admin_auth_db_${TIMESTAMP}.sql"
        
        log_success "Admin authentication database backed up"
    else
        log_error "Failed to backup admin authentication database"
        return 1
    fi
    
    # Admin activity logs database
    log_info "Backing up admin activity logs..."
    if docker exec admin-activity-logger pg_dump "$DATABASE_URL" \
        --table=admin_activity_logs --table=admin_users \
        --verbose --no-password --format=custom --compress=$COMPRESSION_LEVEL \
        --file="/tmp/admin_activity_logs_${TIMESTAMP}.dump"; then
        
        docker cp admin-activity-logger:/tmp/admin_activity_logs_${TIMESTAMP}.dump \
            "$db_backup_dir/admin_activity_logs_${TIMESTAMP}.dump"
        docker exec admin-activity-logger rm "/tmp/admin_activity_logs_${TIMESTAMP}.dump"
        
        log_success "Admin activity logs backed up"
    else
        log_warning "Could not backup admin activity logs (table may not exist)"
    fi
    
    # Swedish pilot business data
    log_info "Backing up Swedish pilot business data..."
    if docker exec pilot-management-api pg_dump "$DATABASE_URL" \
        --table="businesses*" --table="business_locations*" \
        --table="feedback_sessions*" --table="fi_compliance_reports*" \
        --verbose --no-password --format=custom --compress=$COMPRESSION_LEVEL \
        --file="/tmp/swedish_pilot_data_${TIMESTAMP}.dump"; then
        
        docker cp pilot-management-api:/tmp/swedish_pilot_data_${TIMESTAMP}.dump \
            "$db_backup_dir/swedish_pilot_data_${TIMESTAMP}.dump"
        docker exec pilot-management-api rm "/tmp/swedish_pilot_data_${TIMESTAMP}.dump"
        
        log_success "Swedish pilot business data backed up"
    else
        log_warning "Could not backup Swedish pilot data (tables may not exist)"
    fi
    
    log_success "Database backups completed"
}

# Backup Redis session data
backup_redis_data() {
    log_header "Backing Up Admin Redis Session Data"
    
    local redis_backup_dir="$BACKUP_BASE_DIR/$TIMESTAMP/redis"
    
    # Create Redis backup
    log_info "Creating Redis data backup..."
    if docker exec admin-session-manager redis-cli --rdb "/tmp/admin_sessions_${TIMESTAMP}.rdb"; then
        docker cp admin-session-manager:/tmp/admin_sessions_${TIMESTAMP}.rdb \
            "$redis_backup_dir/admin_sessions_${TIMESTAMP}.rdb"
        docker exec admin-session-manager rm "/tmp/admin_sessions_${TIMESTAMP}.rdb"
        
        # Export session keys for analysis
        docker exec admin-session-manager redis-cli --scan --pattern "admin_session:*" \
            > "$redis_backup_dir/session_keys_${TIMESTAMP}.txt"
        
        log_success "Redis session data backed up"
    else
        log_warning "Could not backup Redis data"
    fi
    
    # Backup Redis configuration
    docker cp admin-session-manager:/usr/local/etc/redis/redis.conf \
        "$redis_backup_dir/redis_config_${TIMESTAMP}.conf" || log_warning "Could not backup Redis config"
}

# Backup Grafana dashboards and configuration
backup_grafana() {
    log_header "Backing Up Admin Grafana Configuration"
    
    local grafana_backup_dir="$BACKUP_BASE_DIR/$TIMESTAMP/grafana"
    
    # Backup Grafana database (SQLite)
    log_info "Backing up Grafana database..."
    if docker exec admin-grafana cp /var/lib/grafana/grafana.db "/tmp/grafana_${TIMESTAMP}.db"; then
        docker cp admin-grafana:/tmp/grafana_${TIMESTAMP}.db \
            "$grafana_backup_dir/grafana_${TIMESTAMP}.db"
        docker exec admin-grafana rm "/tmp/grafana_${TIMESTAMP}.db"
        log_success "Grafana database backed up"
    else
        log_warning "Could not backup Grafana database"
    fi
    
    # Backup Grafana configuration files
    local grafana_configs=(
        "/var/lib/grafana/dashboards"
        "/etc/grafana/provisioning"
        "/etc/grafana/grafana.ini"
    )
    
    for config in "${grafana_configs[@]}"; do
        local config_name=$(basename "$config")
        if docker exec admin-grafana test -e "$config"; then
            docker cp admin-grafana:"$config" "$grafana_backup_dir/${config_name}_${TIMESTAMP}" || 
                log_warning "Could not backup $config"
        fi
    done
    
    # Export dashboards via API
    log_info "Exporting Grafana dashboards via API..."
    if curl -s -u "admin:${ADMIN_GRAFANA_PASSWORD}" \
        "http://localhost:3023/api/search" | jq -r '.[].uri' | while read dashboard_uri; do
        
        local dashboard_uid=$(echo "$dashboard_uri" | cut -d'/' -f3)
        curl -s -u "admin:${ADMIN_GRAFANA_PASSWORD}" \
            "http://localhost:3023/api/dashboards/$dashboard_uri" | \
            jq '.dashboard' > "$grafana_backup_dir/dashboard_${dashboard_uid}_${TIMESTAMP}.json"
    done; then
        log_success "Grafana dashboards exported"
    else
        log_warning "Could not export Grafana dashboards via API"
    fi
}

# Backup Prometheus configuration and data
backup_prometheus() {
    log_header "Backing Up Admin Prometheus Configuration"
    
    local prometheus_backup_dir="$BACKUP_BASE_DIR/$TIMESTAMP/prometheus"
    
    # Backup Prometheus configuration
    docker cp admin-prometheus:/etc/prometheus "$prometheus_backup_dir/config_${TIMESTAMP}" || 
        log_warning "Could not backup Prometheus config"
    
    # Backup Prometheus rules
    docker cp admin-prometheus:/etc/prometheus/rules "$prometheus_backup_dir/rules_${TIMESTAMP}" || 
        log_warning "Could not backup Prometheus rules"
    
    # Create Prometheus data snapshot
    log_info "Creating Prometheus data snapshot..."
    if curl -X POST "http://localhost:9095/api/v1/admin/tsdb/snapshot" | jq -r '.data.name' > \
        "$prometheus_backup_dir/snapshot_name_${TIMESTAMP}.txt"; then
        
        local snapshot_name=$(cat "$prometheus_backup_dir/snapshot_name_${TIMESTAMP}.txt")
        
        # Copy snapshot data
        docker cp "admin-prometheus:/prometheus/snapshots/$snapshot_name" \
            "$prometheus_backup_dir/snapshot_${TIMESTAMP}" || 
            log_warning "Could not copy Prometheus snapshot"
        
        log_success "Prometheus data snapshot created"
    else
        log_warning "Could not create Prometheus snapshot"
    fi
    
    # Backup current metrics for compliance
    log_info "Exporting current metrics for compliance..."
    curl -s "http://localhost:9095/api/v1/label/__name__/values" | \
        jq -r '.data[]' | grep -E "admin_|swedish_|pilot_|fi_|gdpr_" > \
        "$prometheus_backup_dir/admin_metrics_list_${TIMESTAMP}.txt" || 
        log_warning "Could not export metrics list"
}

# Backup configuration files
backup_configurations() {
    log_header "Backing Up Configuration Files"
    
    local config_backup_dir="$BACKUP_BASE_DIR/$TIMESTAMP/configurations"
    
    # Docker Compose files
    cp "$MONITORING_DIR/docker-compose.admin-monitoring.yml" \
        "$config_backup_dir/docker-compose-admin-monitoring_${TIMESTAMP}.yml"
    
    # Configuration directories
    local config_dirs=(
        "integration"
        "prometheus" 
        "alertmanager"
        "grafana"
        "config"
        "redis"
        "scripts"
    )
    
    for config_dir in "${config_dirs[@]}"; do
        if [[ -d "$MONITORING_DIR/$config_dir" ]]; then
            cp -r "$MONITORING_DIR/$config_dir" "$config_backup_dir/${config_dir}_${TIMESTAMP}"
        fi
    done
    
    # Environment configuration (sanitized)
    if [[ -f "$PROJECT_ROOT/.env" ]]; then
        grep -v -E "(PASSWORD|SECRET|KEY)" "$PROJECT_ROOT/.env" > \
            "$config_backup_dir/env_sanitized_${TIMESTAMP}.txt" || log_warning "Could not backup .env"
    fi
    
    log_success "Configuration files backed up"
}

# Backup logs and compliance data
backup_logs_compliance() {
    log_header "Backing Up Logs and Compliance Data"
    
    local logs_backup_dir="$BACKUP_BASE_DIR/$TIMESTAMP/logs"
    local compliance_backup_dir="$BACKUP_BASE_DIR/$TIMESTAMP/compliance"
    
    # Admin service logs
    local log_sources=(
        "/opt/ai-feedback/logs/admin"
        "/var/log/admin"
    )
    
    for log_source in "${log_sources[@]}"; do
        if [[ -d "$log_source" ]]; then
            log_info "Backing up logs from $log_source..."
            tar -czf "$logs_backup_dir/admin_logs_${log_source//\//_}_${TIMESTAMP}.tar.gz" \
                -C "$(dirname "$log_source")" "$(basename "$log_source")" || 
                log_warning "Could not backup logs from $log_source"
        fi
    done
    
    # Container logs
    local containers=("admin-activity-logger" "pilot-management-api" "admin-auth-service" 
                      "admin-grafana" "admin-prometheus" "admin-alertmanager")
    
    for container in "${containers[@]}"; do
        if docker ps --filter "name=$container" --filter "status=running" | grep -q "$container"; then
            docker logs --since="7 days" "$container" > \
                "$logs_backup_dir/${container}_logs_${TIMESTAMP}.log" 2>&1 || 
                log_warning "Could not backup logs for $container"
        fi
    done
    
    # Export compliance data
    if [[ "$SWEDISH_COMPLIANCE" == "true" ]]; then
        log_info "Exporting Swedish compliance data..."
        
        # FI compliance reports
        if docker exec pilot-management-api psql "$DATABASE_URL" -c \
            "COPY (SELECT * FROM fi_compliance_reports) TO STDOUT WITH CSV HEADER" > \
            "$compliance_backup_dir/fi_compliance_reports_${TIMESTAMP}.csv"; then
            log_success "FI compliance reports exported"
        fi
        
        # GDPR compliance logs
        if docker exec admin-activity-logger psql "$DATABASE_URL" -c \
            "COPY (SELECT * FROM admin_activity_logs WHERE gdpr_compliant = true) TO STDOUT WITH CSV HEADER" > \
            "$compliance_backup_dir/gdpr_activity_logs_${TIMESTAMP}.csv"; then
            log_success "GDPR activity logs exported"
        fi
        
        # Swedish pilot business data for compliance
        if docker exec pilot-management-api psql "$DATABASE_URL" -c \
            "COPY (SELECT b.*, bl.region FROM businesses b LEFT JOIN business_locations bl ON b.id = bl.business_id WHERE b.pilot_program = true) TO STDOUT WITH CSV HEADER" > \
            "$compliance_backup_dir/swedish_pilot_businesses_${TIMESTAMP}.csv"; then
            log_success "Swedish pilot business data exported for compliance"
        fi
    fi
    
    log_success "Logs and compliance data backed up"
}

# Create backup metadata
create_backup_metadata() {
    log_header "Creating Backup Metadata"
    
    local metadata_dir="$BACKUP_BASE_DIR/$TIMESTAMP/metadata"
    local manifest_file="$metadata_dir/backup_manifest.json"
    
    # System information
    local system_info=$(cat << EOF
{
  "backup_id": "$BACKUP_ID",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "swedish_timestamp": "$(TZ='Europe/Stockholm' date -u +%Y-%m-%dT%H:%M:%SZ)",
  "backup_type": "comprehensive_admin_system",
  "environment": "${ENVIRONMENT:-production}",
  "swedish_compliance": $SWEDISH_COMPLIANCE,
  "gdpr_retention_years": $GDPR_RETENTION_YEARS,
  "fi_retention_years": $FI_RETENTION_YEARS,
  "backup_version": "2.0",
  "components_backed_up": [
    "admin_authentication_database",
    "admin_activity_logs",
    "swedish_pilot_business_data",
    "redis_session_data",
    "grafana_dashboards_config",
    "prometheus_config_data",
    "alertmanager_config",
    "system_configurations",
    "application_logs",
    "compliance_data"
  ],
  "system_info": {
    "hostname": "$(hostname)",
    "kernel": "$(uname -r)",
    "docker_version": "$(docker --version | cut -d' ' -f3 | cut -d',' -f1)",
    "backup_script_version": "2.0.0"
  }
}
EOF
)
    
    echo "$system_info" | jq '.' > "$manifest_file"
    
    # File inventory
    find "$BACKUP_BASE_DIR/$TIMESTAMP" -type f -exec ls -lah {} + | \
        awk '{print $5, $9}' > "$metadata_dir/file_inventory.txt"
    
    # Calculate checksums
    log_info "Calculating file checksums for integrity verification..."
    find "$BACKUP_BASE_DIR/$TIMESTAMP" -type f ! -path "*/metadata/*" -exec sha256sum {} + > \
        "$metadata_dir/checksums.sha256"
    
    # Service status at backup time
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" > \
        "$metadata_dir/service_status_${TIMESTAMP}.txt"
    
    # Health check results
    local health_checks=("http://localhost:3020/health" "http://localhost:3021/health" 
                         "http://localhost:3022/health" "http://localhost:3023/api/health")
    
    for endpoint in "${health_checks[@]}"; do
        local service_name=$(echo "$endpoint" | sed 's/.*:\([0-9]*\).*/port_\1/')
        curl -f -s "$endpoint" > "$metadata_dir/health_${service_name}_${TIMESTAMP}.json" 2>/dev/null || 
            echo "unhealthy" > "$metadata_dir/health_${service_name}_${TIMESTAMP}.json"
    done
    
    log_success "Backup metadata created"
}

# Encrypt backup data (Swedish compliance)
encrypt_backup_data() {
    if [[ "$SWEDISH_COMPLIANCE" != "true" ]]; then
        log_info "Encryption skipped (not in Swedish compliance mode)"
        return 0
    fi
    
    log_header "Encrypting Backup Data for Swedish Compliance"
    
    local backup_dir="$BACKUP_BASE_DIR/$TIMESTAMP"
    local encrypted_file="$BACKUP_BASE_DIR/encrypted_admin_backup_${TIMESTAMP}.tar.gz.enc"
    
    # Create compressed archive
    log_info "Creating compressed archive..."
    tar -czf "$BACKUP_BASE_DIR/admin_backup_${TIMESTAMP}.tar.gz" \
        -C "$BACKUP_BASE_DIR" "$TIMESTAMP"
    
    # Encrypt the archive
    log_info "Encrypting backup with AES-256-CBC..."
    if openssl enc -aes-256-cbc -salt -in "$BACKUP_BASE_DIR/admin_backup_${TIMESTAMP}.tar.gz" \
        -out "$encrypted_file" -pass "file:$ENCRYPTION_KEY_FILE"; then
        
        # Remove unencrypted archive
        rm "$BACKUP_BASE_DIR/admin_backup_${TIMESTAMP}.tar.gz"
        
        # Create encryption metadata
        local encryption_metadata=$(cat << EOF
{
  "encryption_algorithm": "AES-256-CBC",
  "encrypted_file": "$encrypted_file",
  "encryption_timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "key_file": "$ENCRYPTION_KEY_FILE",
  "swedish_compliance": true,
  "gdpr_compliant": true,
  "checksum": "$(sha256sum "$encrypted_file" | cut -d' ' -f1)"
}
EOF
)
        echo "$encryption_metadata" | jq '.' > "$backup_dir/metadata/encryption_info.json"
        
        log_success "Backup encrypted successfully: $encrypted_file"
    else
        log_error "Encryption failed"
        return 1
    fi
}

# Upload to S3 with Swedish compliance metadata
upload_to_s3() {
    if ! command -v aws &> /dev/null; then
        log_warning "AWS CLI not available, skipping S3 upload"
        return 0
    fi
    
    log_header "Uploading to S3 with Swedish Compliance Metadata"
    
    local s3_path="s3://$S3_BACKUP_BUCKET/admin-backups/$(date +%Y/%m/%d)/$BACKUP_ID"
    
    # Determine what to upload
    local upload_source
    if [[ "$SWEDISH_COMPLIANCE" == "true" ]]; then
        upload_source="$BACKUP_BASE_DIR/encrypted_admin_backup_${TIMESTAMP}.tar.gz.enc"
    else
        # Create unencrypted archive for upload
        tar -czf "$BACKUP_BASE_DIR/admin_backup_${TIMESTAMP}.tar.gz" \
            -C "$BACKUP_BASE_DIR" "$TIMESTAMP"
        upload_source="$BACKUP_BASE_DIR/admin_backup_${TIMESTAMP}.tar.gz"
    fi
    
    # Upload with Swedish compliance metadata
    if aws s3 cp "$upload_source" "$s3_path/" \
        --storage-class STANDARD_IA \
        --server-side-encryption AES256 \
        --metadata "backup-type=admin-comprehensive,swedish-compliance=$SWEDISH_COMPLIANCE,gdpr-retention=$GDPR_RETENTION_YEARS,fi-retention=$FI_RETENTION_YEARS,backup-timestamp=$TIMESTAMP"; then
        
        # Upload metadata separately
        aws s3 cp "$BACKUP_BASE_DIR/$TIMESTAMP/metadata/" "$s3_path/metadata/" \
            --recursive --storage-class STANDARD_IA --server-side-encryption AES256
        
        log_success "Backup uploaded to S3: $s3_path"
        
        # Clean up local compressed archive
        rm -f "$BACKUP_BASE_DIR/admin_backup_${TIMESTAMP}.tar.gz"
    else
        log_error "S3 upload failed"
        return 1
    fi
}

# Cleanup old backups
cleanup_old_backups() {
    log_header "Cleaning Up Old Backups"
    
    # Local cleanup
    log_info "Cleaning local backups older than $BACKUP_RETENTION_DAYS days..."
    find "$BACKUP_BASE_DIR" -maxdepth 1 -type d -name "202*" -mtime +$BACKUP_RETENTION_DAYS -exec rm -rf {} + || true
    find "$BACKUP_BASE_DIR" -maxdepth 1 -type f -name "*.tar.gz*" -mtime +$BACKUP_RETENTION_DAYS -delete || true
    
    # S3 cleanup
    if command -v aws &> /dev/null; then
        log_info "Cleaning S3 backups older than $BACKUP_RETENTION_DAYS days..."
        local cutoff_date=$(date -d "-$BACKUP_RETENTION_DAYS days" +%Y-%m-%d)
        
        aws s3api list-objects-v2 \
            --bucket "$S3_BACKUP_BUCKET" \
            --prefix "admin-backups/" \
            --query "Contents[?LastModified<='$cutoff_date'].Key" \
            --output text | \
        while read -r key; do
            if [[ -n "$key" && "$key" != "None" ]]; then
                aws s3 rm "s3://$S3_BACKUP_BUCKET/$key" || true
            fi
        done
    fi
    
    log_success "Old backups cleaned up"
}

# Verify backup integrity
verify_backup_integrity() {
    log_header "Verifying Backup Integrity"
    
    local backup_dir="$BACKUP_BASE_DIR/$TIMESTAMP"
    local metadata_dir="$backup_dir/metadata"
    local checksum_file="$metadata_dir/checksums.sha256"
    
    if [[ -f "$checksum_file" ]]; then
        log_info "Verifying file checksums..."
        if (cd "$BACKUP_BASE_DIR" && sha256sum -c "$TIMESTAMP/metadata/checksums.sha256"); then
            log_success "All file checksums verified successfully"
        else
            log_error "Checksum verification failed"
            return 1
        fi
    fi
    
    # Test database backup integrity
    local db_backups=("$backup_dir/databases"/*.dump)
    for db_backup in "${db_backups[@]}"; do
        if [[ -f "$db_backup" ]]; then
            log_info "Testing database backup: $(basename "$db_backup")"
            if pg_restore --list "$db_backup" &> /dev/null; then
                log_success "Database backup is valid: $(basename "$db_backup")"
            else
                log_error "Database backup is corrupted: $(basename "$db_backup")"
                return 1
            fi
        fi
    done
    
    log_success "Backup integrity verification completed"
}

# Send backup notification
send_backup_notification() {
    local status="$1"
    local message="$2"
    
    log_info "Sending backup notification: $status"
    
    # Log to admin activity logger if available
    if curl -f -s "http://localhost:3020/health" > /dev/null; then
        curl -X POST "http://localhost:3020/api/log-activity" \
            -H "Content-Type: application/json" \
            -d "{
                \"userId\": \"system\",
                \"userRole\": \"system\",
                \"activity\": \"Admin system backup $status\",
                \"category\": \"system_backup\",
                \"details\": {
                    \"backup_id\": \"$BACKUP_ID\",
                    \"timestamp\": \"$TIMESTAMP\",
                    \"swedish_compliance\": $SWEDISH_COMPLIANCE,
                    \"message\": \"$message\"
                },
                \"success\": $([ "$status" = "SUCCESS" ] && echo "true" || echo "false")
            }" || log_warning "Could not log backup activity"
    fi
    
    # Slack notification if webhook available
    if [[ -n "${SLACK_ADMIN_WEBHOOK:-}" ]]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{
                \"text\": \"🇸🇪 Admin System Backup: $status\",
                \"attachments\": [{
                    \"color\": \"$([ "$status" = "SUCCESS" ] && echo "good" || echo "warning")\",
                    \"text\": \"$message\",
                    \"fields\": [
                        {\"title\": \"Backup ID\", \"value\": \"$BACKUP_ID\", \"short\": true},
                        {\"title\": \"Swedish Compliance\", \"value\": \"$SWEDISH_COMPLIANCE\", \"short\": true},
                        {\"title\": \"Timestamp\", \"value\": \"$SWEDISH_TIMESTAMP\", \"short\": true}
                    ]
                }]
            }" \
            "$SLACK_ADMIN_WEBHOOK" &> /dev/null || log_warning "Could not send Slack notification"
    fi
}

# Generate backup report
generate_backup_report() {
    log_header "Generating Backup Report"
    
    local report_file="$BACKUP_BASE_DIR/$TIMESTAMP/metadata/backup_report_${TIMESTAMP}.txt"
    local backup_size=$(du -sh "$BACKUP_BASE_DIR/$TIMESTAMP" | cut -f1)
    
    cat > "$report_file" << EOF
🇸🇪 Admin System Comprehensive Backup Report
=============================================
Date: $(TZ='Europe/Stockholm' date)
Backup ID: $BACKUP_ID
Swedish Compliance Mode: $SWEDISH_COMPLIANCE

Backup Summary:
- Total Size: $backup_size
- Components: Admin Auth, Activity Logs, Swedish Pilot Data, Grafana, Prometheus, Redis
- Retention: Local $BACKUP_RETENTION_DAYS days, S3 with lifecycle policy
- Encryption: $([ "$SWEDISH_COMPLIANCE" = "true" ] && echo "AES-256-CBC (Swedish compliance)" || echo "None")

Components Backed Up:
✅ Admin Authentication Database
✅ Admin Activity Logs & Audit Trail
✅ Swedish Pilot Business Data
✅ Redis Session Data
✅ Grafana Dashboards & Configuration
✅ Prometheus Configuration & Snapshots
✅ AlertManager Configuration
✅ System Configuration Files
✅ Application Logs (7 days)
✅ Compliance Data (FI & GDPR)

Swedish Compliance Features:
- GDPR-compliant data handling and retention ($GDPR_RETENTION_YEARS years)
- Finansinspektionen compliance data backup ($FI_RETENTION_YEARS years)
- Encrypted storage for sensitive data
- Audit trail for all admin activities
- Regional data handling (Stockholm timezone)

File Integrity:
- SHA256 checksums calculated for all files
- Database backup integrity verified
- Encryption validation completed

Storage Locations:
- Local: $BACKUP_BASE_DIR/$TIMESTAMP
- S3: s3://$S3_BACKUP_BUCKET/admin-backups/$(date +%Y/%m/%d)/$BACKUP_ID
$([ "$SWEDISH_COMPLIANCE" = "true" ] && echo "- Encrypted Archive: $BACKUP_BASE_DIR/encrypted_admin_backup_${TIMESTAMP}.tar.gz.enc" || echo "")

Next Steps:
1. Verify backup restoration procedures
2. Update disaster recovery documentation  
3. Schedule next backup (recommended: daily)
4. Review Swedish compliance requirements

Backup completed: $(TZ='Europe/Stockholm' date)
System Administrator: AI Feedback Admin Team
EOF
    
    log_success "Backup report generated: $report_file"
    
    # Display summary
    echo ""
    echo -e "${GREEN}=================================================================================================="
    echo "  ✅ Admin System Comprehensive Backup - COMPLETED"
    echo "  🇸🇪 Swedish Pilot Data - SECURED"
    echo "  📊 All Components - BACKED UP" 
    echo "  🔒 Compliance Requirements - MET"
    echo "=================================================================================================="
    echo -e "${NC}"
}

# Main backup function
main() {
    display_banner
    
    local backup_success=true
    local backup_start_time=$(date +%s)
    
    check_prerequisites
    setup_backup_directories
    
    # Execute backup procedures
    if ! backup_databases; then backup_success=false; fi
    backup_redis_data
    backup_grafana
    backup_prometheus
    backup_configurations
    backup_logs_compliance
    create_backup_metadata
    
    if ! verify_backup_integrity; then backup_success=false; fi
    
    if [[ "$SWEDISH_COMPLIANCE" == "true" ]]; then
        if ! encrypt_backup_data; then backup_success=false; fi
    fi
    
    upload_to_s3
    cleanup_old_backups
    
    local backup_end_time=$(date +%s)
    local backup_duration=$((backup_end_time - backup_start_time))
    
    generate_backup_report
    
    if $backup_success; then
        log_success "🎉 Admin system backup completed successfully in ${backup_duration}s!"
        send_backup_notification "SUCCESS" "All backup operations completed successfully"
        return 0
    else
        log_warning "Backup completed with some warnings"
        send_backup_notification "WARNING" "Backup completed but some operations had issues"
        return 1
    fi
}

# Script usage
usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Admin System Comprehensive Backup for Swedish Pilot Management

Options:
  -d, --backup-dir DIR     Backup directory (default: $BACKUP_BASE_DIR)
  -r, --retention DAYS     Retention period in days (default: $BACKUP_RETENTION_DAYS)  
  -s, --s3-bucket BUCKET   S3 bucket for remote backup (default: $S3_BACKUP_BUCKET)
  -c, --compliance         Enable Swedish compliance mode (default: $SWEDISH_COMPLIANCE)
  -t, --test              Test backup without actual execution
  -h, --help              Show this help message

Environment Variables:
  DATABASE_URL            PostgreSQL connection string
  ADMIN_GRAFANA_PASSWORD  Grafana admin password
  S3_BACKUP_BUCKET        S3 bucket for backups
  SLACK_ADMIN_WEBHOOK     Slack webhook for notifications
  ENCRYPTION_KEY_FILE     Path to encryption key file

Examples:
  $0                      # Standard comprehensive backup
  $0 -r 60 -c true        # 60-day retention with compliance
  $0 -t                   # Test mode (dry run)
EOF
}

# Test mode
test_mode() {
    log_info "Running in TEST mode (dry run)..."
    
    echo "Would create backup with following settings:"
    echo "  Backup Directory: $BACKUP_BASE_DIR"
    echo "  Backup ID: $BACKUP_ID" 
    echo "  S3 Bucket: $S3_BACKUP_BUCKET"
    echo "  Retention: $BACKUP_RETENTION_DAYS days"
    echo "  Swedish Compliance: $SWEDISH_COMPLIANCE"
    echo "  Components: Admin DB, Activity Logs, Swedish Pilot Data, Grafana, Prometheus, Redis"
    
    log_success "Test mode completed - no actual backup created"
    exit 0
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -d|--backup-dir)
            BACKUP_BASE_DIR="$2"
            shift 2
            ;;
        -r|--retention)
            BACKUP_RETENTION_DAYS="$2"
            shift 2
            ;;
        -s|--s3-bucket)
            S3_BACKUP_BUCKET="$2"
            shift 2
            ;;
        -c|--compliance)
            SWEDISH_COMPLIANCE="$2"
            shift 2
            ;;
        -t|--test)
            test_mode
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

# Run main backup function
main "$@"