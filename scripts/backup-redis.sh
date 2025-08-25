#!/bin/bash

# Redis Multi-Region Backup Script
# Backs up Redis data across all regions with cross-region replication

set -euo pipefail

# Configuration
REGIONS=("stockholm" "gothenburg" "malmo")
BACKUP_DIR="${BACKUP_DIR:-/opt/ai-feedback/backups/redis}"
S3_BUCKET="${S3_BUCKET:-ai-feedback-backups-eu-north-1}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# AWS Configuration for cross-region replication
export AWS_DEFAULT_REGION="eu-north-1"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] [INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] [SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] [WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] [ERROR]${NC} $1"
}

# Create backup directories
create_backup_dirs() {
    log_info "Creating backup directories..."
    
    for region in "${REGIONS[@]}"; do
        mkdir -p "$BACKUP_DIR/$region/$(date +%Y/%m/%d)"
    done
    
    mkdir -p "$BACKUP_DIR/consolidated/$(date +%Y/%m/%d)"
    mkdir -p "$BACKUP_DIR/logs"
    
    log_success "Backup directories created"
}

# Check Redis connectivity
check_redis_connectivity() {
    local region=$1
    local redis_host="redis-${region}-master"
    local redis_port=6379
    
    log_info "Checking Redis connectivity for $region..."
    
    if timeout 5 redis-cli -h "$redis_host" -p "$redis_port" ping > /dev/null 2>&1; then
        log_success "Redis $region is accessible"
        return 0
    else
        log_error "Cannot connect to Redis $region at $redis_host:$redis_port"
        return 1
    fi
}

# Backup Redis data
backup_redis_data() {
    local region=$1
    local redis_host="redis-${region}-master"
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$BACKUP_DIR/$region/$(date +%Y/%m/%d)/redis-${region}-${timestamp}.rdb"
    
    log_info "Starting Redis backup for $region..."
    
    # Create RDB snapshot
    if redis-cli -h "$redis_host" -p 6379 --rdb "$backup_file"; then
        log_success "Redis RDB backup created: $backup_file"
    else
        log_error "Failed to create RDB backup for $region"
        return 1
    fi
    
    # Export memory analytics
    local memory_info="$BACKUP_DIR/$region/$(date +%Y/%m/%d)/memory-${region}-${timestamp}.info"
    redis-cli -h "$redis_host" -p 6379 info memory > "$memory_info"
    
    # Export key statistics
    local key_stats="$BACKUP_DIR/$region/$(date +%Y/%m/%d)/keys-${region}-${timestamp}.stats"
    redis-cli -h "$redis_host" -p 6379 info keyspace > "$key_stats"
    
    # Compress backup
    gzip "$backup_file"
    gzip "$memory_info"
    
    log_success "Redis backup completed for $region"
    echo "${backup_file}.gz"
}

# Backup Redis cluster configuration
backup_cluster_config() {
    local region=$1
    local redis_host="redis-${region}-master"
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local config_file="$BACKUP_DIR/$region/$(date +%Y/%m/%d)/cluster-config-${region}-${timestamp}.conf"
    
    log_info "Backing up Redis cluster configuration for $region..."
    
    # Get cluster nodes
    redis-cli -h "$redis_host" -p 6379 cluster nodes > "$config_file"
    
    # Get cluster info
    redis-cli -h "$redis_host" -p 6379 cluster info >> "$config_file"
    
    # Get Redis configuration
    redis-cli -h "$redis_host" -p 6379 config get "*" >> "$config_file"
    
    gzip "$config_file"
    
    log_success "Cluster configuration backed up for $region"
    echo "${config_file}.gz"
}

# Create consolidated cross-region backup
create_consolidated_backup() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local consolidated_dir="$BACKUP_DIR/consolidated/$(date +%Y/%m/%d)"
    local manifest_file="$consolidated_dir/backup-manifest-${timestamp}.json"
    
    log_info "Creating consolidated cross-region backup manifest..."
    
    cat > "$manifest_file" << EOF
{
  "backup_timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "backup_type": "redis_multi_region",
  "regions": [
EOF

    local first=true
    for region in "${REGIONS[@]}"; do
        if [ "$first" = false ]; then
            echo "," >> "$manifest_file"
        fi
        first=false
        
        local region_dir="$BACKUP_DIR/$region/$(date +%Y/%m/%d)"
        local rdb_file=$(find "$region_dir" -name "redis-${region}-*.rdb.gz" -type f | head -n1)
        local config_file=$(find "$region_dir" -name "cluster-config-${region}-*.conf.gz" -type f | head -n1)
        local memory_file=$(find "$region_dir" -name "memory-${region}-*.info.gz" -type f | head -n1)
        
        cat >> "$manifest_file" << EOF
    {
      "region": "$region",
      "rdb_backup": "$(basename "$rdb_file" 2>/dev/null || echo "null")",
      "cluster_config": "$(basename "$config_file" 2>/dev/null || echo "null")",
      "memory_info": "$(basename "$memory_file" 2>/dev/null || echo "null")",
      "backup_size": "$(du -sh "$region_dir" 2>/dev/null | cut -f1 || echo "unknown")"
    }
EOF
    done
    
    cat >> "$manifest_file" << EOF
  ],
  "total_backup_size": "$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1 || echo "unknown")",
  "retention_policy": "${RETENTION_DAYS} days",
  "s3_bucket": "$S3_BUCKET"
}
EOF

    log_success "Consolidated backup manifest created: $manifest_file"
}

# Upload backups to S3
upload_to_s3() {
    log_info "Uploading backups to S3..."
    
    local date_path=$(date +%Y/%m/%d)
    
    if command -v aws &> /dev/null; then
        for region in "${REGIONS[@]}"; do
            log_info "Uploading $region backups to S3..."
            
            aws s3 sync "$BACKUP_DIR/$region/$date_path/" \
                "s3://$S3_BUCKET/redis/$region/$date_path/" \
                --storage-class STANDARD_IA \
                --server-side-encryption AES256
                
            if [ $? -eq 0 ]; then
                log_success "Successfully uploaded $region backups to S3"
            else
                log_warning "Failed to upload $region backups to S3"
            fi
        done
        
        # Upload consolidated manifest
        aws s3 cp "$BACKUP_DIR/consolidated/$date_path/" \
            "s3://$S3_BUCKET/redis/consolidated/$date_path/" \
            --recursive \
            --storage-class STANDARD_IA \
            --server-side-encryption AES256
    else
        log_warning "AWS CLI not found, skipping S3 upload"
    fi
}

# Cross-region replication health check
check_replication_health() {
    log_info "Checking cross-region replication health..."
    
    local replication_status="$BACKUP_DIR/logs/replication-health-$(date +%Y%m%d_%H%M%S).log"
    
    for primary_region in "${REGIONS[@]}"; do
        for secondary_region in "${REGIONS[@]}"; do
            if [ "$primary_region" != "$secondary_region" ]; then
                log_info "Checking replication: $primary_region -> $secondary_region"
                
                # Test key consistency across regions
                local test_key="replication_test_$(date +%s)"
                local test_value="test_value_$(date +%s)"
                
                # Set test key in primary
                redis-cli -h "redis-${primary_region}-master" -p 6379 set "$test_key" "$test_value" EX 60 > /dev/null
                
                # Wait for replication
                sleep 2
                
                # Check if key exists in secondary
                local secondary_value=$(redis-cli -h "redis-${secondary_region}-master" -p 6379 get "$test_key" 2>/dev/null || echo "")
                
                if [ "$secondary_value" = "$test_value" ]; then
                    echo "OK: $primary_region -> $secondary_region replication working" >> "$replication_status"
                    log_success "Replication OK: $primary_region -> $secondary_region"
                else
                    echo "FAIL: $primary_region -> $secondary_region replication broken" >> "$replication_status"
                    log_error "Replication FAIL: $primary_region -> $secondary_region"
                fi
                
                # Cleanup test key
                redis-cli -h "redis-${primary_region}-master" -p 6379 del "$test_key" > /dev/null 2>&1
                redis-cli -h "redis-${secondary_region}-master" -p 6379 del "$test_key" > /dev/null 2>&1
            fi
        done
    done
}

# Cleanup old backups
cleanup_old_backups() {
    log_info "Cleaning up backups older than $RETENTION_DAYS days..."
    
    find "$BACKUP_DIR" -type f -mtime +$RETENTION_DAYS -delete
    find "$BACKUP_DIR" -type d -empty -delete
    
    # Cleanup S3 backups if AWS CLI is available
    if command -v aws &> /dev/null; then
        local cutoff_date=$(date -d "-$RETENTION_DAYS days" +%Y-%m-%d)
        
        aws s3api list-objects-v2 \
            --bucket "$S3_BUCKET" \
            --prefix "redis/" \
            --query "Contents[?LastModified<='$cutoff_date'].Key" \
            --output text | \
        while read -r key; do
            if [ -n "$key" ]; then
                aws s3 rm "s3://$S3_BUCKET/$key"
            fi
        done
    fi
    
    log_success "Old backups cleaned up"
}

# Generate backup report
generate_backup_report() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local report_file="$BACKUP_DIR/logs/backup-report-${timestamp}.log"
    
    log_info "Generating backup report..."
    
    cat > "$report_file" << EOF
Redis Multi-Region Backup Report
================================
Date: $(date)
Backup Directory: $BACKUP_DIR
S3 Bucket: $S3_BUCKET
Retention: $RETENTION_DAYS days

Regional Backup Status:
EOF

    for region in "${REGIONS[@]}"; do
        local region_dir="$BACKUP_DIR/$region/$(date +%Y/%m/%d)"
        local backup_count=$(find "$region_dir" -name "*.rdb.gz" -type f 2>/dev/null | wc -l)
        local backup_size=$(du -sh "$region_dir" 2>/dev/null | cut -f1 || echo "0B")
        
        cat >> "$report_file" << EOF
  $region:
    Backups Created: $backup_count
    Total Size: $backup_size
    Location: $region_dir
EOF
    done
    
    cat >> "$report_file" << EOF

Total Backup Size: $(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1 || echo "0B")
Backup Completed: $(date)
EOF

    log_success "Backup report generated: $report_file"
}

# Main backup function
main() {
    log_info "Starting Redis multi-region backup process..."
    
    # Check dependencies
    for cmd in redis-cli aws gzip; do
        if ! command -v "$cmd" &> /dev/null; then
            if [ "$cmd" = "aws" ]; then
                log_warning "$cmd is not installed (S3 upload will be skipped)"
            else
                log_error "$cmd is required but not installed"
                exit 1
            fi
        fi
    done
    
    # Create backup directories
    create_backup_dirs
    
    # Backup each region
    local backup_success=0
    local backup_total=${#REGIONS[@]}
    
    for region in "${REGIONS[@]}"; do
        if check_redis_connectivity "$region"; then
            if backup_redis_data "$region" && backup_cluster_config "$region"; then
                ((backup_success++))
            fi
        fi
    done
    
    # Create consolidated backup manifest
    create_consolidated_backup
    
    # Check replication health
    check_replication_health
    
    # Upload to S3
    upload_to_s3
    
    # Cleanup old backups
    cleanup_old_backups
    
    # Generate report
    generate_backup_report
    
    log_info "Backup Summary:"
    log_info "Successfully backed up: $backup_success/$backup_total regions"
    
    if [[ $backup_success -eq $backup_total ]]; then
        log_success "All Redis regions backed up successfully!"
        return 0
    else
        log_warning "Some Redis backups failed"
        return 1
    fi
}

# Script usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Multi-region Redis backup script for AI Feedback Platform"
    echo ""
    echo "Options:"
    echo "  -d, --backup-dir DIR    Backup directory (default: /opt/ai-feedback/backups/redis)"
    echo "  -b, --s3-bucket BUCKET  S3 bucket for remote backup (default: ai-feedback-backups-eu-north-1)"
    echo "  -r, --retention DAYS    Backup retention in days (default: 30)"
    echo "  -t, --test             Test mode - check connectivity only"
    echo "  -h, --help             Show this help message"
    echo ""
    echo "Environment variables:"
    echo "  BACKUP_DIR             Local backup directory"
    echo "  S3_BUCKET              S3 bucket for remote backup"
    echo "  RETENTION_DAYS         Backup retention period"
    echo ""
    echo "Examples:"
    echo "  $0                     # Full backup with defaults"
    echo "  $0 -d /custom/backup   # Custom backup directory"
    echo "  $0 -t                  # Test connectivity only"
}

# Test mode - connectivity check only
test_mode() {
    log_info "Testing Redis connectivity across all regions..."
    
    local success=0
    local total=${#REGIONS[@]}
    
    for region in "${REGIONS[@]}"; do
        if check_redis_connectivity "$region"; then
            ((success++))
        fi
    done
    
    check_replication_health
    
    log_info "Connectivity Test Results: $success/$total regions accessible"
    
    if [[ $success -eq $total ]]; then
        log_success "All Redis regions are accessible!"
        return 0
    else
        log_error "Some Redis regions are not accessible"
        return 1
    fi
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -d|--backup-dir)
            BACKUP_DIR="$2"
            shift 2
            ;;
        -b|--s3-bucket)
            S3_BUCKET="$2"
            shift 2
            ;;
        -r|--retention)
            RETENTION_DAYS="$2"
            shift 2
            ;;
        -t|--test)
            test_mode
            exit $?
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

# Run main function
main "$@"