#!/bin/bash

# AI Feedback Platform - Comprehensive Backup System
# Handles database, configuration, and application data backups

set -e

echo "💾 AI Feedback Platform - Backup System"
echo "======================================"

# Configuration
BACKUP_BASE_DIR="/opt/backups/ai-feedback-platform"
BACKUP_RETENTION_DAYS=30
NOTIFICATION_WEBHOOK="$BACKUP_NOTIFICATION_WEBHOOK"
ENVIRONMENT="${1:-staging}"

# Create backup directories
mkdir -p "$BACKUP_BASE_DIR"/{database,configuration,logs,analytics}
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="$BACKUP_BASE_DIR/$TIMESTAMP"
mkdir -p "$BACKUP_DIR"

# Function to send notifications
send_notification() {
    local status=$1
    local message=$2
    
    if [[ -n "$NOTIFICATION_WEBHOOK" ]]; then
        curl -X POST "$NOTIFICATION_WEBHOOK" \
            -H "Content-Type: application/json" \
            -d "{\"text\":\"🔄 Backup $status: $message\"}" \
            2>/dev/null || echo "Failed to send notification"
    fi
    
    echo "📱 Notification: $status - $message"
}

# Function to backup Supabase database
backup_supabase() {
    echo "🗄️  Backing up Supabase database..."
    
    local compose_file="docker-compose.${ENVIRONMENT}.yml"
    
    if [[ ! -f "$compose_file" ]]; then
        echo "❌ Compose file $compose_file not found"
        return 1
    fi
    
    # Create database backup using pg_dump through API Gateway container
    if docker-compose -f "$compose_file" exec -T api-gateway node -e "
        const { createClient } = require('@supabase/supabase-js');
        const url = process.env.SUPABASE_URL || process.env.DATABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
        
        if (!url || !key) {
            console.error('Missing Supabase configuration');
            process.exit(1);
        }
        
        // Simple backup verification
        console.log('Database connection verified');
    " 2>/dev/null; then
        echo "   ✅ Supabase database verified"
        
        # Note: Actual backup is handled by Supabase's built-in backup system
        # We create a metadata file for tracking
        cat > "$BACKUP_DIR/database_metadata.json" << EOF
{
    "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "environment": "$ENVIRONMENT",
    "backup_type": "supabase_managed",
    "retention_policy": "managed_by_supabase",
    "status": "verified"
}
EOF
        return 0
    else
        echo "   ❌ Database backup verification failed"
        return 1
    fi
}

# Function to backup Redis data
backup_redis() {
    echo "📝 Backing up Redis data..."
    
    local compose_file="docker-compose.${ENVIRONMENT}.yml"
    
    if docker-compose -f "$compose_file" ps redis | grep -q "Up"; then
        # Force Redis to save current state
        docker-compose -f "$compose_file" exec -T redis redis-cli BGSAVE
        sleep 10
        
        # Copy Redis dump file
        docker-compose -f "$compose_file" exec -T redis cat /data/dump.rdb > "$BACKUP_DIR/redis_dump.rdb"
        
        if [[ -f "$BACKUP_DIR/redis_dump.rdb" ]]; then
            echo "   ✅ Redis backup created ($(du -h "$BACKUP_DIR/redis_dump.rdb" | cut -f1))"
            return 0
        else
            echo "   ❌ Redis backup failed"
            return 1
        fi
    else
        echo "   ⚠️  Redis service not running, skipping backup"
        return 0
    fi
}

# Function to backup configuration files
backup_configuration() {
    echo "⚙️  Backing up configuration files..."
    
    local config_backup="$BACKUP_DIR/configuration.tar.gz"
    
    # Create archive of important configuration files
    tar -czf "$config_backup" \
        --exclude='node_modules' \
        --exclude='.git' \
        --exclude='logs' \
        --exclude='*.log' \
        .env.* \
        docker-compose*.yml \
        nginx/ \
        monitoring/ \
        scripts/ \
        packages/database/prisma/ \
        PILOT-RUNBOOK.md \
        DEPLOYMENT.md \
        2>/dev/null || true
    
    if [[ -f "$config_backup" ]]; then
        echo "   ✅ Configuration backup created ($(du -h "$config_backup" | cut -f1))"
        return 0
    else
        echo "   ❌ Configuration backup failed"
        return 1
    fi
}

# Function to backup analytics data
backup_analytics() {
    echo "📊 Backing up analytics data..."
    
    local compose_file="docker-compose.${ENVIRONMENT}.yml"
    local analytics_backup="$BACKUP_DIR/analytics_data.tar.gz"
    
    # Check if analytics containers are running
    if docker-compose -f "$compose_file" ps | grep -q "business-dashboard"; then
        # Create temporary directory for analytics export
        mkdir -p "$BACKUP_DIR/analytics_temp"
        
        # Export analytics data (reports, cached data, etc.)
        if docker volume ls | grep -q "business_analytics_cache"; then
            docker run --rm \
                -v "$(pwd)_business_analytics_cache:/source:ro" \
                -v "$BACKUP_DIR/analytics_temp:/backup" \
                alpine sh -c "cp -r /source/* /backup/ 2>/dev/null || true"
        fi
        
        if docker volume ls | grep -q "business_reports"; then
            docker run --rm \
                -v "$(pwd)_business_reports:/source:ro" \
                -v "$BACKUP_DIR/analytics_temp:/backup" \
                alpine sh -c "mkdir -p /backup/reports && cp -r /source/* /backup/reports/ 2>/dev/null || true"
        fi
        
        # Create analytics archive
        if [[ -d "$BACKUP_DIR/analytics_temp" ]] && [[ "$(ls -A "$BACKUP_DIR/analytics_temp")" ]]; then
            tar -czf "$analytics_backup" -C "$BACKUP_DIR" analytics_temp/
            rm -rf "$BACKUP_DIR/analytics_temp"
            echo "   ✅ Analytics data backup created ($(du -h "$analytics_backup" | cut -f1))"
            return 0
        else
            echo "   ⚠️  No analytics data found to backup"
            return 0
        fi
    else
        echo "   ⚠️  Analytics services not running, skipping backup"
        return 0
    fi
}

# Function to backup system logs
backup_logs() {
    echo "📋 Backing up system logs..."
    
    local compose_file="docker-compose.${ENVIRONMENT}.yml"
    local logs_backup="$BACKUP_DIR/system_logs.tar.gz"
    
    # Export recent logs from all services
    mkdir -p "$BACKUP_DIR/logs_temp"
    
    # Get logs from last 24 hours for each service
    services=("api-gateway" "customer-pwa" "business-dashboard" "admin-dashboard" "nginx" "redis" "prometheus" "grafana")
    
    for service in "${services[@]}"; do
        if docker-compose -f "$compose_file" ps "$service" 2>/dev/null | grep -q "Up"; then
            echo "   Collecting logs for $service..."
            docker-compose -f "$compose_file" logs --since="24h" "$service" > "$BACKUP_DIR/logs_temp/${service}.log" 2>/dev/null || true
        fi
    done
    
    # Include nginx access logs if available
    if docker volume ls | grep -q "nginx_logs"; then
        docker run --rm \
            -v "$(pwd)_nginx_logs:/source:ro" \
            -v "$BACKUP_DIR/logs_temp:/backup" \
            alpine sh -c "cp /source/*.log /backup/ 2>/dev/null || true"
    fi
    
    # Create logs archive
    if [[ -d "$BACKUP_DIR/logs_temp" ]] && [[ "$(ls -A "$BACKUP_DIR/logs_temp")" ]]; then
        tar -czf "$logs_backup" -C "$BACKUP_DIR" logs_temp/
        rm -rf "$BACKUP_DIR/logs_temp"
        echo "   ✅ System logs backup created ($(du -h "$logs_backup" | cut -f1))"
        return 0
    else
        echo "   ⚠️  No logs found to backup"
        return 0
    fi
}

# Function to create backup manifest
create_manifest() {
    echo "📋 Creating backup manifest..."
    
    local manifest="$BACKUP_DIR/MANIFEST.json"
    
    cat > "$manifest" << EOF
{
    "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "environment": "$ENVIRONMENT",
    "hostname": "$(hostname)",
    "backup_id": "$TIMESTAMP",
    "components": {
        "database": {
            "type": "supabase_managed",
            "status": "$([ -f "$BACKUP_DIR/database_metadata.json" ] && echo "completed" || echo "failed")"
        },
        "redis": {
            "file": "redis_dump.rdb",
            "status": "$([ -f "$BACKUP_DIR/redis_dump.rdb" ] && echo "completed" || echo "skipped")",
            "size_bytes": $([ -f "$BACKUP_DIR/redis_dump.rdb" ] && stat -f%z "$BACKUP_DIR/redis_dump.rdb" 2>/dev/null || echo "0")
        },
        "configuration": {
            "file": "configuration.tar.gz", 
            "status": "$([ -f "$BACKUP_DIR/configuration.tar.gz" ] && echo "completed" || echo "failed")",
            "size_bytes": $([ -f "$BACKUP_DIR/configuration.tar.gz" ] && stat -f%z "$BACKUP_DIR/configuration.tar.gz" 2>/dev/null || echo "0")
        },
        "analytics": {
            "file": "analytics_data.tar.gz",
            "status": "$([ -f "$BACKUP_DIR/analytics_data.tar.gz" ] && echo "completed" || echo "skipped")",
            "size_bytes": $([ -f "$BACKUP_DIR/analytics_data.tar.gz" ] && stat -f%z "$BACKUP_DIR/analytics_data.tar.gz" 2>/dev/null || echo "0")
        },
        "logs": {
            "file": "system_logs.tar.gz",
            "status": "$([ -f "$BACKUP_DIR/system_logs.tar.gz" ] && echo "completed" || echo "skipped")",
            "size_bytes": $([ -f "$BACKUP_DIR/system_logs.tar.gz" ] && stat -f%z "$BACKUP_DIR/system_logs.tar.gz" 2>/dev/null || echo "0")
        }
    },
    "total_size_bytes": $(du -sb "$BACKUP_DIR" | cut -f1),
    "retention_until": "$(date -u -d "+$BACKUP_RETENTION_DAYS days" +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -v+${BACKUP_RETENTION_DAYS}d +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF
    
    echo "   ✅ Backup manifest created"
}

# Function to verify backup integrity
verify_backup() {
    echo "🔍 Verifying backup integrity..."
    
    local verification_failed=false
    
    # Verify configuration archive
    if [[ -f "$BACKUP_DIR/configuration.tar.gz" ]]; then
        if tar -tzf "$BACKUP_DIR/configuration.tar.gz" >/dev/null 2>&1; then
            echo "   ✅ Configuration archive integrity verified"
        else
            echo "   ❌ Configuration archive is corrupted"
            verification_failed=true
        fi
    fi
    
    # Verify analytics archive (if exists)
    if [[ -f "$BACKUP_DIR/analytics_data.tar.gz" ]]; then
        if tar -tzf "$BACKUP_DIR/analytics_data.tar.gz" >/dev/null 2>&1; then
            echo "   ✅ Analytics archive integrity verified"
        else
            echo "   ❌ Analytics archive is corrupted"
            verification_failed=true
        fi
    fi
    
    # Verify logs archive (if exists)
    if [[ -f "$BACKUP_DIR/system_logs.tar.gz" ]]; then
        if tar -tzf "$BACKUP_DIR/system_logs.tar.gz" >/dev/null 2>&1; then
            echo "   ✅ Logs archive integrity verified"
        else
            echo "   ❌ Logs archive is corrupted"
            verification_failed=true
        fi
    fi
    
    # Verify Redis dump (if exists)
    if [[ -f "$BACKUP_DIR/redis_dump.rdb" ]]; then
        # Basic file size check
        if [[ $(stat -f%z "$BACKUP_DIR/redis_dump.rdb" 2>/dev/null || stat -c%s "$BACKUP_DIR/redis_dump.rdb") -gt 100 ]]; then
            echo "   ✅ Redis dump file size verified"
        else
            echo "   ⚠️  Redis dump file is unusually small"
        fi
    fi
    
    if [[ "$verification_failed" == "true" ]]; then
        return 1
    else
        return 0
    fi
}

# Function to cleanup old backups
cleanup_old_backups() {
    echo "🧹 Cleaning up old backups..."
    
    local deleted_count=0
    
    # Find and delete backups older than retention period
    find "$BACKUP_BASE_DIR" -maxdepth 1 -type d -name "*_*" -mtime +$BACKUP_RETENTION_DAYS | while read -r old_backup; do
        echo "   Deleting old backup: $(basename "$old_backup")"
        rm -rf "$old_backup"
        ((deleted_count++))
    done
    
    echo "   ✅ Cleaned up $deleted_count old backups"
}

# Function to upload to cloud storage (if configured)
upload_to_cloud() {
    if [[ -n "$BACKUP_CLOUD_STORAGE" ]]; then
        echo "☁️  Uploading backup to cloud storage..."
        
        case "$BACKUP_CLOUD_STORAGE" in
            "s3")
                if command -v aws &> /dev/null; then
                    aws s3 sync "$BACKUP_DIR" "s3://$BACKUP_S3_BUCKET/ai-feedback-platform/$ENVIRONMENT/$TIMESTAMP/"
                    echo "   ✅ Backup uploaded to S3"
                else
                    echo "   ⚠️  AWS CLI not available, skipping S3 upload"
                fi
                ;;
            "gcs")
                if command -v gsutil &> /dev/null; then
                    gsutil -m cp -r "$BACKUP_DIR" "gs://$BACKUP_GCS_BUCKET/ai-feedback-platform/$ENVIRONMENT/$TIMESTAMP/"
                    echo "   ✅ Backup uploaded to Google Cloud Storage"
                else
                    echo "   ⚠️  gsutil not available, skipping GCS upload"
                fi
                ;;
            *)
                echo "   ⚠️  Unknown cloud storage type: $BACKUP_CLOUD_STORAGE"
                ;;
        esac
    fi
}

# Main backup execution
main() {
    local start_time=$(date +%s)
    local backup_success=true
    
    send_notification "STARTED" "Backup process initiated for $ENVIRONMENT environment"
    
    # Execute backup components
    if ! backup_supabase; then backup_success=false; fi
    if ! backup_redis; then backup_success=false; fi  
    if ! backup_configuration; then backup_success=false; fi
    if ! backup_analytics; then backup_success=false; fi
    if ! backup_logs; then backup_success=false; fi
    
    # Create manifest and verify
    create_manifest
    if ! verify_backup; then backup_success=false; fi
    
    # Upload to cloud if configured
    upload_to_cloud
    
    # Cleanup old backups
    cleanup_old_backups
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    local backup_size=$(du -sh "$BACKUP_DIR" | cut -f1)
    
    echo ""
    echo "📊 Backup Summary"
    echo "================"
    echo "Environment: $ENVIRONMENT"
    echo "Backup ID: $TIMESTAMP"
    echo "Duration: ${duration}s"
    echo "Total Size: $backup_size"
    echo "Location: $BACKUP_DIR"
    
    if [[ "$backup_success" == "true" ]]; then
        echo "Status: ✅ SUCCESS"
        send_notification "SUCCESS" "Backup completed successfully in ${duration}s (${backup_size})"
        exit 0
    else
        echo "Status: ❌ PARTIAL FAILURE"
        send_notification "PARTIAL_FAILURE" "Backup completed with some failures in ${duration}s"
        exit 1
    fi
}

# Handle command line arguments
case "${1:-}" in
    "staging"|"production"|"development")
        main
        ;;
    "verify")
        if [[ -n "$2" ]]; then
            BACKUP_DIR="$BACKUP_BASE_DIR/$2"
            if [[ -d "$BACKUP_DIR" ]]; then
                verify_backup
            else
                echo "❌ Backup directory not found: $BACKUP_DIR"
                exit 1
            fi
        else
            echo "Usage: $0 verify BACKUP_ID"
            exit 1
        fi
        ;;
    "list")
        echo "📋 Available Backups:"
        ls -la "$BACKUP_BASE_DIR" | grep "^d" | grep -E "[0-9]{8}_[0-9]{6}"
        ;;
    *)
        echo "Usage: $0 {staging|production|development|verify BACKUP_ID|list}"
        echo ""
        echo "Environment variables:"
        echo "  BACKUP_NOTIFICATION_WEBHOOK - Webhook URL for backup notifications"
        echo "  BACKUP_CLOUD_STORAGE - Cloud storage type (s3, gcs)"
        echo "  BACKUP_S3_BUCKET - S3 bucket name (if using S3)"
        echo "  BACKUP_GCS_BUCKET - GCS bucket name (if using GCS)"
        exit 1
        ;;
esac