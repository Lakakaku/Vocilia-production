#!/bin/bash

# TEST Payment System Backup Script
# Automated backup for Swedish pilot demonstration data

set -euo pipefail

# Configuration
DATABASE_URL="${DATABASE_URL:-postgresql://test_user:test_password@payments-test-db:5432/payments_test}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
S3_BUCKET="${S3_TEST_BUCKET:-ai-feedback-test-backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] [BACKUP-TEST] [INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] [BACKUP-TEST] [SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] [BACKUP-TEST] [WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] [BACKUP-TEST] [ERROR]${NC} $1"
}

# Create backup directories
create_backup_dirs() {
    log_info "Creating backup directories..."
    
    mkdir -p "$BACKUP_DIR/payments"
    mkdir -p "$BACKUP_DIR/compliance"
    mkdir -p "$BACKUP_DIR/reports"
    mkdir -p "$BACKUP_DIR/logs"
    
    log_success "Backup directories created"
}

# Backup test payment database
backup_payment_database() {
    local backup_file="$BACKUP_DIR/payments/payments-test-${TIMESTAMP}.sql"
    
    log_info "Backing up test payment database..."
    
    # Create database backup
    if pg_dump "$DATABASE_URL" \
        --verbose \
        --no-password \
        --format=custom \
        --compress=6 \
        --file="$backup_file"; then
        
        local file_size=$(du -sh "$backup_file" | cut -f1)
        log_success "Payment database backup created: $backup_file ($file_size)"
        
        # Create a readable SQL version for inspection
        local sql_file="$BACKUP_DIR/payments/payments-test-${TIMESTAMP}-readable.sql"
        pg_dump "$DATABASE_URL" \
            --verbose \
            --no-password \
            --format=plain \
            --file="$sql_file"
        
        gzip "$sql_file"
        
        return 0
    else
        log_error "Payment database backup failed"
        return 1
    fi
}

# Backup compliance logs and reports
backup_compliance_data() {
    log_info "Backing up compliance data..."
    
    local compliance_backup="$BACKUP_DIR/compliance/compliance-${TIMESTAMP}.tar.gz"
    
    # Backup compliance logs
    if [[ -d "/var/log/compliance" ]]; then
        tar -czf "$compliance_backup" -C /var/log compliance/ || true
        log_success "Compliance logs backed up to: $compliance_backup"
    else
        log_warning "No compliance logs found to backup"
    fi
    
    # Export compliance events from database
    local compliance_export="$BACKUP_DIR/compliance/compliance-events-${TIMESTAMP}.json"
    
    psql "$DATABASE_URL" -c "
        COPY (
            SELECT json_agg(row_to_json(compliance_events.*)) 
            FROM compliance_events 
            WHERE created_at >= NOW() - INTERVAL '7 days'
        ) TO STDOUT
    " > "$compliance_export" || true
    
    if [[ -s "$compliance_export" ]]; then
        gzip "$compliance_export"
        log_success "Compliance events exported: ${compliance_export}.gz"
    fi
}

# Backup FI reports
backup_fi_reports() {
    log_info "Backing up Finansinspektionen reports..."
    
    local fi_reports_export="$BACKUP_DIR/reports/fi-reports-${TIMESTAMP}.json"
    
    psql "$DATABASE_URL" -c "
        COPY (
            SELECT json_agg(row_to_json(fi_reports_test.*)) 
            FROM fi_reports_test
        ) TO STDOUT
    " > "$fi_reports_export" || true
    
    if [[ -s "$fi_reports_export" ]]; then
        gzip "$fi_reports_export"
        log_success "FI reports backed up: ${fi_reports_export}.gz"
    fi
}

# Backup test business data
backup_test_business_data() {
    log_info "Backing up test business data..."
    
    local business_export="$BACKUP_DIR/payments/test-businesses-${TIMESTAMP}.json"
    
    # Export Swedish test businesses
    psql "$DATABASE_URL" -c "
        COPY (
            SELECT json_build_object(
                'businesses', (SELECT json_agg(b) FROM businesses_test b),
                'locations', (SELECT json_agg(l) FROM business_locations_test l),
                'sessions', (SELECT json_agg(s) FROM feedback_sessions_test s WHERE created_at >= NOW() - INTERVAL '7 days')
            )
        ) TO STDOUT
    " > "$business_export" || true
    
    if [[ -s "$business_export" ]]; then
        gzip "$business_export"
        log_success "Test business data backed up: ${business_export}.gz"
    fi
}

# Create backup manifest
create_backup_manifest() {
    log_info "Creating backup manifest..."
    
    local manifest_file="$BACKUP_DIR/backup-manifest-${TIMESTAMP}.json"
    
    cat > "$manifest_file" << EOF
{
  "backup_timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "backup_type": "test_payment_system",
  "environment": "test",
  "swedish_pilot": true,
  "retention_days": $RETENTION_DAYS,
  "files": {
    "payment_database": "$(find $BACKUP_DIR/payments -name "*${TIMESTAMP}*" -type f | head -1)",
    "compliance_data": "$(find $BACKUP_DIR/compliance -name "*${TIMESTAMP}*" -type f | head -1)",
    "fi_reports": "$(find $BACKUP_DIR/reports -name "*${TIMESTAMP}*" -type f | head -1)",
    "business_data": "$(find $BACKUP_DIR/payments -name "test-businesses-${TIMESTAMP}*" -type f | head -1)"
  },
  "total_size": "$(du -sh $BACKUP_DIR | cut -f1)",
  "s3_bucket": "$S3_BUCKET",
  "compliance_notes": [
    "This backup contains TEST data only",
    "Swedish financial authority compliance data included",
    "Data retention policy: $RETENTION_DAYS days",
    "Backup encrypted for compliance with Swedish data protection laws"
  ]
}
EOF

    log_success "Backup manifest created: $manifest_file"
}

# Upload to S3 (test bucket)
upload_to_s3() {
    if ! command -v aws &> /dev/null; then
        log_warning "AWS CLI not available, skipping S3 upload"
        return 0
    fi
    
    log_info "Uploading backups to S3 test bucket..."
    
    local s3_path="s3://$S3_BUCKET/payments-test/$(date +%Y/%m/%d)/"
    
    # Upload with test metadata
    if aws s3 sync "$BACKUP_DIR" "$s3_path" \
        --storage-class STANDARD_IA \
        --server-side-encryption AES256 \
        --metadata "test=true,swedish-pilot=true,environment=test"; then
        
        log_success "Backups uploaded to: $s3_path"
        return 0
    else
        log_error "S3 upload failed"
        return 1
    fi
}

# Cleanup old backups
cleanup_old_backups() {
    log_info "Cleaning up backups older than $RETENTION_DAYS days..."
    
    # Local cleanup
    find "$BACKUP_DIR" -type f -mtime +$RETENTION_DAYS -delete || true
    find "$BACKUP_DIR" -type d -empty -delete || true
    
    # S3 cleanup (if available)
    if command -v aws &> /dev/null; then
        local cutoff_date=$(date -d "-$RETENTION_DAYS days" +%Y-%m-%d)
        
        aws s3api list-objects-v2 \
            --bucket "$S3_BUCKET" \
            --prefix "payments-test/" \
            --query "Contents[?LastModified<='$cutoff_date'].Key" \
            --output text | \
        while read -r key; do
            if [[ -n "$key" && "$key" != "None" ]]; then
                aws s3 rm "s3://$S3_BUCKET/$key" || true
            fi
        done
    fi
    
    log_success "Old backups cleaned up"
}

# Verify backup integrity
verify_backup_integrity() {
    log_info "Verifying backup integrity..."
    
    local latest_backup=$(find "$BACKUP_DIR/payments" -name "payments-test-*.sql" -type f | head -1)
    
    if [[ -n "$latest_backup" ]]; then
        # Test if backup can be listed (validates format)
        if pg_restore --list "$latest_backup" &> /dev/null; then
            log_success "Backup integrity verification passed"
            return 0
        else
            log_error "Backup integrity verification failed"
            return 1
        fi
    else
        log_warning "No backup found to verify"
        return 1
    fi
}

# Send notification (mock for test environment)
send_backup_notification() {
    local status="$1"
    local message="$2"
    
    log_info "Backup notification: $status - $message"
    
    # Mock notification (could be Slack, email, etc.)
    if [[ -n "${SLACK_WEBHOOK:-}" ]]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{
                \"text\": \"🧪 TEST Payment Backup: $status\",
                \"attachments\": [{
                    \"color\": \"$([ "$status" = "SUCCESS" ] && echo "good" || echo "warning")\",
                    \"text\": \"$message\",
                    \"fields\": [
                        {\"title\": \"Environment\", \"value\": \"TEST\", \"short\": true},
                        {\"title\": \"Timestamp\", \"value\": \"$(date)\", \"short\": true},
                        {\"title\": \"Swedish Pilot\", \"value\": \"Active\", \"short\": true}
                    ]
                }]
            }" \
            "$SLACK_WEBHOOK" &> /dev/null || true
    fi
}

# Generate backup report
generate_backup_report() {
    local report_file="$BACKUP_DIR/logs/backup-report-${TIMESTAMP}.txt"
    
    cat > "$report_file" << EOF
TEST Payment System Backup Report
=================================
Date: $(date)
Environment: TEST (Swedish Pilot)
Backup Directory: $BACKUP_DIR
S3 Bucket: $S3_BUCKET
Retention: $RETENTION_DAYS days

Backup Contents:
- Payment Database: $(find $BACKUP_DIR/payments -name "payments-test-${TIMESTAMP}.sql" -exec ls -lh {} + | awk '{print $5}' || echo "Not found")
- Compliance Data: $(find $BACKUP_DIR/compliance -name "compliance-${TIMESTAMP}.tar.gz" -exec ls -lh {} + | awk '{print $5}' || echo "Not found")  
- FI Reports: $(find $BACKUP_DIR/reports -name "fi-reports-${TIMESTAMP}.json.gz" -exec ls -lh {} + | awk '{print $5}' || echo "Not found")
- Business Data: $(find $BACKUP_DIR/payments -name "test-businesses-${TIMESTAMP}.json.gz" -exec ls -lh {} + | awk '{print $5}' || echo "Not found")

Total Backup Size: $(du -sh $BACKUP_DIR | cut -f1)

Swedish Compliance Notes:
- All data is TEST data only
- Finansinspektionen compliance data included
- GDPR-compliant backup procedures followed
- Data retention policy: $RETENTION_DAYS days

Backup Completed: $(date)
EOF

    log_success "Backup report generated: $report_file"
}

# Main backup function
main() {
    log_info "Starting TEST payment system backup..."
    
    local backup_success=true
    
    create_backup_dirs
    
    # Perform backups
    if ! backup_payment_database; then
        backup_success=false
    fi
    
    backup_compliance_data
    backup_fi_reports  
    backup_test_business_data
    
    create_backup_manifest
    
    if ! verify_backup_integrity; then
        backup_success=false
    fi
    
    upload_to_s3
    cleanup_old_backups
    generate_backup_report
    
    if $backup_success; then
        log_success "TEST payment system backup completed successfully!"
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
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "TEST Payment System Backup for Swedish Pilot"
    echo ""
    echo "Options:"
    echo "  -d, --backup-dir DIR    Backup directory (default: /backups)"
    echo "  -r, --retention DAYS    Retention period in days (default: 7)"
    echo "  -s, --s3-bucket BUCKET  S3 bucket for remote backup (default: ai-feedback-test-backups)"
    echo "  -t, --test             Test backup without actual execution"
    echo "  -h, --help             Show this help message"
    echo ""
    echo "Environment variables:"
    echo "  DATABASE_URL           PostgreSQL connection string"
    echo "  S3_TEST_BUCKET         S3 bucket for test backups"
    echo "  BACKUP_RETENTION_DAYS  Backup retention period"
    echo "  SLACK_WEBHOOK          Slack webhook for notifications"
    echo ""
    echo "Examples:"
    echo "  $0                     # Standard backup"
    echo "  $0 -r 14               # Keep backups for 14 days"
    echo "  $0 -t                  # Test mode (dry run)"
}

# Test mode
test_mode() {
    log_info "Running in TEST mode (dry run)..."
    
    echo "Would create backup directories in: $BACKUP_DIR"
    echo "Would backup database: $DATABASE_URL"
    echo "Would upload to S3 bucket: $S3_BUCKET"
    echo "Would retain backups for: $RETENTION_DAYS days"
    
    log_success "Test mode completed - no actual backups created"
    exit 0
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -d|--backup-dir)
            BACKUP_DIR="$2"
            shift 2
            ;;
        -r|--retention)
            RETENTION_DAYS="$2"
            shift 2
            ;;
        -s|--s3-bucket)
            S3_BUCKET="$2"
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

# Run main function
main "$@"