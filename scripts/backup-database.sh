#!/bin/bash

# Database Multi-Region Backup Script
# Backs up Supabase database with cross-region replication

set -euo pipefail

# Configuration
DATABASE_URL="${DATABASE_URL:-}"
BACKUP_DIR="${BACKUP_DIR:-/opt/ai-feedback/backups/database}"
S3_BUCKET="${S3_BUCKET:-ai-feedback-backups-eu-north-1}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Backup options
BACKUP_FORMAT="${BACKUP_FORMAT:-custom}"  # custom, tar, directory
PARALLEL_JOBS="${PARALLEL_JOBS:-4}"
COMPRESS_LEVEL="${COMPRESS_LEVEL:-6}"

# AWS Configuration
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

# Validate environment
validate_environment() {
    log_info "Validating environment..."
    
    if [[ -z "$DATABASE_URL" ]]; then
        log_error "DATABASE_URL is not set"
        exit 1
    fi
    
    # Check if pg_dump is available
    if ! command -v pg_dump &> /dev/null; then
        log_error "pg_dump is required but not installed"
        exit 1
    fi
    
    # Test database connectivity
    if ! psql "$DATABASE_URL" -c "SELECT 1;" &> /dev/null; then
        log_error "Cannot connect to database"
        exit 1
    fi
    
    log_success "Environment validation passed"
}

# Create backup directories
create_backup_dirs() {
    log_info "Creating backup directories..."
    
    mkdir -p "$BACKUP_DIR/full/$(date +%Y/%m/%d)"
    mkdir -p "$BACKUP_DIR/schema/$(date +%Y/%m/%d)"
    mkdir -p "$BACKUP_DIR/data/$(date +%Y/%m/%d)"
    mkdir -p "$BACKUP_DIR/incremental/$(date +%Y/%m/%d)"
    mkdir -p "$BACKUP_DIR/logs"
    mkdir -p "$BACKUP_DIR/reports"
    
    log_success "Backup directories created"
}

# Create full database backup
create_full_backup() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$BACKUP_DIR/full/$(date +%Y/%m/%d)/full-backup-${timestamp}.dump"
    
    log_info "Creating full database backup..."
    
    # Full database backup with custom format for flexibility
    pg_dump "$DATABASE_URL" \
        --format=custom \
        --compress="$COMPRESS_LEVEL" \
        --verbose \
        --file="$backup_file" \
        --jobs="$PARALLEL_JOBS" \
        --no-password
    
    if [[ $? -eq 0 ]]; then
        local backup_size=$(du -sh "$backup_file" | cut -f1)
        log_success "Full backup created: $backup_file ($backup_size)"
        echo "$backup_file"
    else
        log_error "Full backup failed"
        return 1
    fi
}

# Create schema-only backup
create_schema_backup() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local schema_file="$BACKUP_DIR/schema/$(date +%Y/%m/%d)/schema-${timestamp}.sql"
    
    log_info "Creating schema-only backup..."
    
    pg_dump "$DATABASE_URL" \
        --schema-only \
        --verbose \
        --file="$schema_file" \
        --no-password
    
    if [[ $? -eq 0 ]]; then
        gzip "$schema_file"
        log_success "Schema backup created: ${schema_file}.gz"
        echo "${schema_file}.gz"
    else
        log_error "Schema backup failed"
        return 1
    fi
}

# Create data-only backup
create_data_backup() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local data_file="$BACKUP_DIR/data/$(date +%Y/%m/%d)/data-${timestamp}.dump"
    
    log_info "Creating data-only backup..."
    
    pg_dump "$DATABASE_URL" \
        --data-only \
        --format=custom \
        --compress="$COMPRESS_LEVEL" \
        --verbose \
        --file="$data_file" \
        --jobs="$PARALLEL_JOBS" \
        --no-password
    
    if [[ $? -eq 0 ]]; then
        local backup_size=$(du -sh "$data_file" | cut -f1)
        log_success "Data backup created: $data_file ($backup_size)"
        echo "$data_file"
    else
        log_error "Data backup failed"
        return 1
    fi
}

# Create business-specific backup
create_business_backup() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local business_file="$BACKUP_DIR/data/$(date +%Y/%m/%d)/business-data-${timestamp}.dump"
    
    log_info "Creating business-specific data backup..."
    
    # Backup business-critical tables separately
    local business_tables=(
        "businesses"
        "business_locations"
        "feedback_sessions" 
        "feedbacks"
        "qr_codes"
        "payments"
        "business_analytics"
    )
    
    local table_args=""
    for table in "${business_tables[@]}"; do
        table_args="$table_args --table=$table"
    done
    
    pg_dump "$DATABASE_URL" \
        $table_args \
        --format=custom \
        --compress="$COMPRESS_LEVEL" \
        --verbose \
        --file="$business_file" \
        --jobs="$PARALLEL_JOBS" \
        --no-password
    
    if [[ $? -eq 0 ]]; then
        local backup_size=$(du -sh "$business_file" | cut -f1)
        log_success "Business data backup created: $business_file ($backup_size)"
        echo "$business_file"
    else
        log_error "Business data backup failed"
        return 1
    fi
}

# Create incremental backup (based on timestamps)
create_incremental_backup() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local incremental_file="$BACKUP_DIR/incremental/$(date +%Y/%m/%d)/incremental-${timestamp}.sql"
    local last_backup_time=""
    
    log_info "Creating incremental backup..."
    
    # Find the last full backup time
    local last_full_backup=$(find "$BACKUP_DIR/full" -name "*.dump" -type f -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2-)
    
    if [[ -n "$last_full_backup" ]]; then
        last_backup_time=$(stat -c %Y "$last_full_backup")
        last_backup_time=$(date -d "@$last_backup_time" '+%Y-%m-%d %H:%M:%S')
        log_info "Last full backup: $last_backup_time"
    else
        last_backup_time=$(date -d "1 day ago" '+%Y-%m-%d %H:%M:%S')
        log_warning "No previous backup found, using 24 hours ago as baseline"
    fi
    
    # Create incremental backup query for tables with timestamps
    cat > "$incremental_file" << EOF
-- Incremental backup starting from: $last_backup_time
-- Generated on: $(date)

-- Business data changes
COPY (
    SELECT * FROM businesses 
    WHERE updated_at > '$last_backup_time'
) TO STDOUT WITH CSV HEADER;

-- Feedback sessions
COPY (
    SELECT * FROM feedback_sessions 
    WHERE created_at > '$last_backup_time'
) TO STDOUT WITH CSV HEADER;

-- Feedback data
COPY (
    SELECT * FROM feedbacks 
    WHERE created_at > '$last_backup_time'
) TO STDOUT WITH CSV HEADER;

-- QR codes
COPY (
    SELECT * FROM qr_codes 
    WHERE created_at > '$last_backup_time'
) TO STDOUT WITH CSV HEADER;

-- Payments
COPY (
    SELECT * FROM payments 
    WHERE created_at > '$last_backup_time'
) TO STDOUT WITH CSV HEADER;
EOF

    # Execute incremental backup
    psql "$DATABASE_URL" -f "$incremental_file" > "${incremental_file}.data" 2>/dev/null
    
    if [[ $? -eq 0 ]]; then
        gzip "$incremental_file"
        gzip "${incremental_file}.data"
        log_success "Incremental backup created: ${incremental_file}.gz"
        echo "${incremental_file}.gz"
    else
        log_error "Incremental backup failed"
        return 1
    fi
}

# Backup database statistics and analytics
backup_database_stats() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local stats_file="$BACKUP_DIR/reports/db-stats-${timestamp}.txt"
    
    log_info "Backing up database statistics..."
    
    cat > "$stats_file" << EOF
Database Statistics Report
=========================
Generated: $(date)
Database: $(echo "$DATABASE_URL" | sed 's/postgresql:\/\/[^@]*@/postgresql:\/\/***@/')

Connection Information:
EOF

    # Database size and connection info
    psql "$DATABASE_URL" -c "
        SELECT 
            pg_database.datname,
            pg_size_pretty(pg_database_size(pg_database.datname)) AS size
        FROM pg_database
        ORDER BY pg_database_size(pg_database.datname) DESC;
    " >> "$stats_file" 2>/dev/null

    cat >> "$stats_file" << EOF

Table Sizes:
EOF

    # Table sizes
    psql "$DATABASE_URL" -c "
        SELECT 
            schemaname,
            tablename,
            attname,
            n_distinct,
            correlation,
            pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
        FROM pg_stats 
        JOIN pg_tables ON pg_stats.tablename = pg_tables.tablename
        WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
    " >> "$stats_file" 2>/dev/null

    cat >> "$stats_file" << EOF

Active Connections:
EOF

    # Active connections
    psql "$DATABASE_URL" -c "
        SELECT 
            state,
            count(*) as count
        FROM pg_stat_activity 
        WHERE state IS NOT NULL
        GROUP BY state;
    " >> "$stats_file" 2>/dev/null

    cat >> "$stats_file" << EOF

Business Analytics Summary:
EOF

    # Business-specific statistics
    psql "$DATABASE_URL" -c "
        SELECT 
            'Total Businesses' as metric,
            COUNT(*)::text as value
        FROM businesses
        UNION ALL
        SELECT 
            'Active Business Locations',
            COUNT(*)::text
        FROM business_locations
        WHERE is_active = true
        UNION ALL
        SELECT 
            'Total Feedback Sessions (Last 30 days)',
            COUNT(*)::text
        FROM feedback_sessions
        WHERE created_at >= NOW() - INTERVAL '30 days'
        UNION ALL
        SELECT 
            'Total Payments (Last 30 days)',
            COUNT(*)::text
        FROM payments
        WHERE created_at >= NOW() - INTERVAL '30 days';
    " >> "$stats_file" 2>/dev/null

    gzip "$stats_file"
    log_success "Database statistics backed up: ${stats_file}.gz"
    echo "${stats_file}.gz"
}

# Test backup integrity
test_backup_integrity() {
    local backup_file="$1"
    
    if [[ ! -f "$backup_file" ]]; then
        log_error "Backup file not found: $backup_file"
        return 1
    fi
    
    log_info "Testing backup integrity: $(basename "$backup_file")"
    
    # Test if backup can be listed (validates format)
    if pg_restore --list "$backup_file" &> /dev/null; then
        log_success "Backup integrity test passed"
        return 0
    else
        log_error "Backup integrity test failed"
        return 1
    fi
}

# Upload backups to S3
upload_to_s3() {
    log_info "Uploading backups to S3..."
    
    local date_path=$(date +%Y/%m/%d)
    
    if command -v aws &> /dev/null; then
        # Upload full backups
        aws s3 sync "$BACKUP_DIR/full/$date_path/" \
            "s3://$S3_BUCKET/database/full/$date_path/" \
            --storage-class STANDARD_IA \
            --server-side-encryption AES256
        
        # Upload schema backups
        aws s3 sync "$BACKUP_DIR/schema/$date_path/" \
            "s3://$S3_BUCKET/database/schema/$date_path/" \
            --storage-class STANDARD_IA \
            --server-side-encryption AES256
        
        # Upload data backups
        aws s3 sync "$BACKUP_DIR/data/$date_path/" \
            "s3://$S3_BUCKET/database/data/$date_path/" \
            --storage-class STANDARD_IA \
            --server-side-encryption AES256
        
        # Upload incremental backups
        aws s3 sync "$BACKUP_DIR/incremental/$date_path/" \
            "s3://$S3_BUCKET/database/incremental/$date_path/" \
            --storage-class STANDARD_IA \
            --server-side-encryption AES256
        
        # Upload reports
        aws s3 sync "$BACKUP_DIR/reports/" \
            "s3://$S3_BUCKET/database/reports/" \
            --storage-class STANDARD_IA \
            --server-side-encryption AES256
        
        log_success "Backups uploaded to S3"
    else
        log_warning "AWS CLI not found, skipping S3 upload"
    fi
}

# Cleanup old backups
cleanup_old_backups() {
    log_info "Cleaning up backups older than $RETENTION_DAYS days..."
    
    # Cleanup local backups
    find "$BACKUP_DIR" -type f -mtime +$RETENTION_DAYS -delete
    find "$BACKUP_DIR" -type d -empty -delete
    
    # Cleanup S3 backups if AWS CLI is available
    if command -v aws &> /dev/null; then
        local cutoff_date=$(date -d "-$RETENTION_DAYS days" +%Y-%m-%d)
        
        aws s3api list-objects-v2 \
            --bucket "$S3_BUCKET" \
            --prefix "database/" \
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
    local report_file="$BACKUP_DIR/reports/backup-report-${timestamp}.txt"
    
    log_info "Generating backup report..."
    
    cat > "$report_file" << EOF
Database Backup Report
=====================
Date: $(date)
Database: $(echo "$DATABASE_URL" | sed 's/postgresql:\/\/[^@]*@/postgresql:\/\/***@/')
Backup Directory: $BACKUP_DIR
S3 Bucket: $S3_BUCKET
Retention: $RETENTION_DAYS days

Backup Summary:
EOF

    # Count and size each backup type
    local backup_types=("full" "schema" "data" "incremental")
    local date_path=$(date +%Y/%m/%d)
    
    for backup_type in "${backup_types[@]}"; do
        local backup_dir="$BACKUP_DIR/$backup_type/$date_path"
        if [[ -d "$backup_dir" ]]; then
            local file_count=$(find "$backup_dir" -type f | wc -l)
            local total_size=$(du -sh "$backup_dir" 2>/dev/null | cut -f1 || echo "0B")
            
            cat >> "$report_file" << EOF
  ${backup_type^} Backups:
    Files: $file_count
    Size: $total_size
    Location: $backup_dir
EOF
        fi
    done
    
    cat >> "$report_file" << EOF

Total Backup Size: $(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1 || echo "0B")
Backup Completed: $(date)
EOF

    log_success "Backup report generated: $report_file"
}

# Main backup function
main() {
    log_info "Starting database backup process..."
    
    # Validate environment
    validate_environment
    
    # Create backup directories
    create_backup_dirs
    
    local backup_success=0
    local backup_total=0
    
    # Create different types of backups
    log_info "Creating full database backup..."
    if create_full_backup; then
        ((backup_success++))
    fi
    ((backup_total++))
    
    log_info "Creating schema backup..."
    if create_schema_backup; then
        ((backup_success++))
    fi
    ((backup_total++))
    
    log_info "Creating data backup..."
    if create_data_backup; then
        ((backup_success++))
    fi
    ((backup_total++))
    
    log_info "Creating business-specific backup..."
    if create_business_backup; then
        ((backup_success++))
    fi
    ((backup_total++))
    
    log_info "Creating incremental backup..."
    if create_incremental_backup; then
        ((backup_success++))
    fi
    ((backup_total++))
    
    # Backup database statistics
    if backup_database_stats; then
        ((backup_success++))
    fi
    ((backup_total++))
    
    # Test backup integrity for latest full backup
    local latest_full_backup=$(find "$BACKUP_DIR/full/$(date +%Y/%m/%d)" -name "*.dump" -type f | head -n1)
    if [[ -n "$latest_full_backup" ]]; then
        test_backup_integrity "$latest_full_backup"
    fi
    
    # Upload to S3
    upload_to_s3
    
    # Cleanup old backups
    cleanup_old_backups
    
    # Generate report
    generate_backup_report
    
    log_info "Backup Summary:"
    log_info "Successfully completed: $backup_success/$backup_total backup tasks"
    
    if [[ $backup_success -eq $backup_total ]]; then
        log_success "All database backups completed successfully!"
        return 0
    else
        log_warning "Some database backups failed"
        return 1
    fi
}

# Script usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Database backup script for AI Feedback Platform"
    echo ""
    echo "Options:"
    echo "  -d, --backup-dir DIR    Backup directory (default: /opt/ai-feedback/backups/database)"
    echo "  -b, --s3-bucket BUCKET  S3 bucket for remote backup (default: ai-feedback-backups-eu-north-1)"
    echo "  -r, --retention DAYS    Backup retention in days (default: 30)"
    echo "  -f, --format FORMAT     Backup format: custom|tar|directory (default: custom)"
    echo "  -j, --jobs JOBS         Parallel jobs for pg_dump (default: 4)"
    echo "  -t, --test             Test mode - connectivity check only"
    echo "  -h, --help             Show this help message"
    echo ""
    echo "Environment variables:"
    echo "  DATABASE_URL           PostgreSQL connection string (required)"
    echo "  BACKUP_DIR             Local backup directory"
    echo "  S3_BUCKET              S3 bucket for remote backup"
    echo "  RETENTION_DAYS         Backup retention period"
    echo ""
    echo "Examples:"
    echo "  $0                     # Full backup with defaults"
    echo "  $0 -f tar -j 8         # TAR format with 8 parallel jobs"
    echo "  $0 -t                  # Test database connectivity"
}

# Test mode
test_mode() {
    log_info "Testing database connectivity..."
    
    if validate_environment; then
        log_success "Database connectivity test passed!"
        return 0
    else
        log_error "Database connectivity test failed!"
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
        -f|--format)
            BACKUP_FORMAT="$2"
            shift 2
            ;;
        -j|--jobs)
            PARALLEL_JOBS="$2"
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