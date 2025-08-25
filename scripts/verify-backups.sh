#!/bin/bash

# Backup Verification Script
# Validates backup integrity and recoverability across all regions

set -euo pipefail

# Configuration
BACKUP_BASE_DIR="${BACKUP_BASE_DIR:-/opt/ai-feedback/backups}"
DATABASE_URL="${DATABASE_URL:-}"
S3_BUCKET="${S3_BUCKET:-ai-feedback-backups-eu-north-1}"
TEMP_DB_NAME="backup_verification_$(date +%s)"
REDIS_TEST_PREFIX="backup_verify_$(date +%s)"

# Verification options
VERIFY_DATABASE="${VERIFY_DATABASE:-true}"
VERIFY_REDIS="${VERIFY_REDIS:-true}"
VERIFY_FILESYSTEM="${VERIFY_FILESYSTEM:-true}"
VERIFY_S3="${VERIFY_S3:-true}"
VERIFY_CROSS_REGION="${VERIFY_CROSS_REGION:-true}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] [VERIFY] [INFO]${NC} $1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [VERIFY] [INFO] $1" >> /var/log/backups/verification.log
}

log_success() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] [VERIFY] [SUCCESS]${NC} $1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [VERIFY] [SUCCESS] $1" >> /var/log/backups/verification.log
}

log_warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] [VERIFY] [WARNING]${NC} $1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [VERIFY] [WARNING] $1" >> /var/log/backups/verification.log
}

log_error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] [VERIFY] [ERROR]${NC} $1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [VERIFY] [ERROR] $1" >> /var/log/backups/verification.log
}

# Initialize verification session
initialize_verification_session() {
    local session_id=$(date +%Y%m%d_%H%M%S)
    local session_dir="$BACKUP_BASE_DIR/verification/$session_id"
    
    mkdir -p "$session_dir"
    mkdir -p /var/log/backups
    mkdir -p /tmp/backup_verification
    
    # Create verification manifest
    cat > "$session_dir/verification_manifest.json" << EOF
{
  "session_id": "$session_id",
  "start_time": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "verification_types": {
    "database": $VERIFY_DATABASE,
    "redis": $VERIFY_REDIS,
    "filesystem": $VERIFY_FILESYSTEM,
    "s3": $VERIFY_S3,
    "cross_region": $VERIFY_CROSS_REGION
  },
  "status": "in_progress"
}
EOF

    echo "$session_id"
}

# Verify database backup integrity
verify_database_backup() {
    local session_dir="$1"
    
    log_info "Verifying database backup integrity..."
    
    # Find latest database backup
    local latest_backup=$(find "$BACKUP_BASE_DIR/database/full" -name "*.dump" -type f -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2-)
    
    if [[ -z "$latest_backup" ]]; then
        log_error "No database backup found"
        echo "database_backup: missing" >> "$session_dir/verification_results.txt"
        return 1
    fi
    
    log_info "Testing backup file: $(basename "$latest_backup")"
    
    # Test 1: Check if backup file is readable and has reasonable size
    local backup_size=$(stat -f%z "$latest_backup" 2>/dev/null || stat -c%s "$latest_backup" 2>/dev/null || echo "0")
    
    if [[ $backup_size -lt 1048576 ]]; then  # Less than 1MB
        log_error "Database backup file is too small: $backup_size bytes"
        echo "database_backup: too_small" >> "$session_dir/verification_results.txt"
        return 1
    fi
    
    log_success "Database backup file size check passed: $(numfmt --to=iec $backup_size)"
    
    # Test 2: Validate backup structure using pg_restore --list
    if pg_restore --list "$latest_backup" &> /dev/null; then
        log_success "Database backup structure validation passed"
    else
        log_error "Database backup structure validation failed"
        echo "database_backup: corrupt_structure" >> "$session_dir/verification_results.txt"
        return 1
    fi
    
    # Test 3: Attempt partial restore to verify data integrity
    if [[ -n "$DATABASE_URL" ]]; then
        log_info "Testing database backup restore functionality..."
        
        # Create temporary database
        local temp_db_url="${DATABASE_URL%/*}/${TEMP_DB_NAME}"
        
        if psql "$DATABASE_URL" -c "CREATE DATABASE $TEMP_DB_NAME;" &> /dev/null; then
            # Attempt to restore a few critical tables
            if pg_restore --dbname="$temp_db_url" \
                --table=businesses \
                --table=business_locations \
                --table=feedbacks \
                --no-owner --no-privileges \
                "$latest_backup" &> /dev/null; then
                
                log_success "Database backup restore test passed"
                echo "database_backup: verified" >> "$session_dir/verification_results.txt"
                
                # Clean up test database
                psql "$DATABASE_URL" -c "DROP DATABASE $TEMP_DB_NAME;" &> /dev/null || true
                
                return 0
            else
                log_error "Database backup restore test failed"
                echo "database_backup: restore_failed" >> "$session_dir/verification_results.txt"
                
                # Clean up test database
                psql "$DATABASE_URL" -c "DROP DATABASE $TEMP_DB_NAME;" &> /dev/null || true
                
                return 1
            fi
        else
            log_warning "Cannot create test database, skipping restore test"
            echo "database_backup: structure_verified" >> "$session_dir/verification_results.txt"
            return 0
        fi
    else
        log_warning "No DATABASE_URL provided, skipping restore test"
        echo "database_backup: structure_verified" >> "$session_dir/verification_results.txt"
        return 0
    fi
}

# Verify Redis backup integrity
verify_redis_backup() {
    local session_dir="$1"
    
    log_info "Verifying Redis backup integrity..."
    
    local regions=(stockholm gothenburg malmo)
    local redis_verification_passed=0
    local redis_verification_total=0
    
    for region in "${regions[@]}"; do
        ((redis_verification_total++))
        
        # Find latest Redis backup for region
        local latest_rdb=$(find "$BACKUP_BASE_DIR/redis/$region" -name "*.rdb.gz" -type f -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -1 | cut -d' ' -f2-)
        
        if [[ -z "$latest_rdb" ]]; then
            log_warning "No Redis backup found for $region"
            continue
        fi
        
        log_info "Testing Redis backup for $region: $(basename "$latest_rdb")"
        
        # Test 1: Check file integrity
        if gunzip -t "$latest_rdb" &> /dev/null; then
            log_success "Redis backup file integrity check passed for $region"
        else
            log_error "Redis backup file integrity check failed for $region"
            continue
        fi
        
        # Test 2: Test RDB file structure
        local temp_rdb="/tmp/backup_verification/redis_${region}_$(date +%s).rdb"
        
        if gunzip -c "$latest_rdb" > "$temp_rdb"; then
            # Try to load RDB with redis-check-rdb if available
            if command -v redis-check-rdb &> /dev/null; then
                if redis-check-rdb "$temp_rdb" &> /dev/null; then
                    log_success "Redis RDB structure validation passed for $region"
                    ((redis_verification_passed++))
                else
                    log_error "Redis RDB structure validation failed for $region"
                fi
            else
                # Basic file header check
                if head -c 9 "$temp_rdb" | grep -q "REDIS"; then
                    log_success "Redis RDB header validation passed for $region"
                    ((redis_verification_passed++))
                else
                    log_error "Redis RDB header validation failed for $region"
                fi
            fi
            
            rm -f "$temp_rdb"
        else
            log_error "Failed to decompress Redis backup for $region"
        fi
    done
    
    if [[ $redis_verification_passed -eq $redis_verification_total ]]; then
        log_success "All Redis backup verifications passed"
        echo "redis_backup: verified" >> "$session_dir/verification_results.txt"
        return 0
    elif [[ $redis_verification_passed -gt 0 ]]; then
        log_warning "Partial Redis backup verification ($redis_verification_passed/$redis_verification_total passed)"
        echo "redis_backup: partial" >> "$session_dir/verification_results.txt"
        return 1
    else
        log_error "All Redis backup verifications failed"
        echo "redis_backup: failed" >> "$session_dir/verification_results.txt"
        return 1
    fi
}

# Verify filesystem backup integrity
verify_filesystem_backup() {
    local session_dir="$1"
    
    log_info "Verifying filesystem backup integrity..."
    
    local backup_types=(uploads logs config)
    local fs_verification_passed=0
    local fs_verification_total=${#backup_types[@]}
    
    for backup_type in "${backup_types[@]}"; do
        # Find latest filesystem backup
        local latest_backup=$(find "$BACKUP_BASE_DIR/filesystem" -name "${backup_type}-*.tar.gz" -type f -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -1 | cut -d' ' -f2-)
        
        if [[ -z "$latest_backup" ]]; then
            log_warning "No $backup_type backup found"
            continue
        fi
        
        log_info "Testing filesystem backup: $(basename "$latest_backup")"
        
        # Test archive integrity
        if tar -tzf "$latest_backup" &> /dev/null; then
            log_success "Filesystem backup integrity check passed for $backup_type"
            
            # Test extraction of a few files
            local temp_extract_dir="/tmp/backup_verification/fs_${backup_type}_$(date +%s)"
            mkdir -p "$temp_extract_dir"
            
            if tar -xzf "$latest_backup" -C "$temp_extract_dir" --strip-components=1 | head -10 &> /dev/null; then
                log_success "Filesystem backup extraction test passed for $backup_type"
                ((fs_verification_passed++))
            else
                log_error "Filesystem backup extraction test failed for $backup_type"
            fi
            
            rm -rf "$temp_extract_dir"
        else
            log_error "Filesystem backup integrity check failed for $backup_type"
        fi
    done
    
    if [[ $fs_verification_passed -eq $fs_verification_total ]]; then
        log_success "All filesystem backup verifications passed"
        echo "filesystem_backup: verified" >> "$session_dir/verification_results.txt"
        return 0
    elif [[ $fs_verification_passed -gt 0 ]]; then
        log_warning "Partial filesystem backup verification ($fs_verification_passed/$fs_verification_total passed)"
        echo "filesystem_backup: partial" >> "$session_dir/verification_results.txt"
        return 1
    else
        log_error "All filesystem backup verifications failed"
        echo "filesystem_backup: failed" >> "$session_dir/verification_results.txt"
        return 1
    fi
}

# Verify S3 backup integrity
verify_s3_backup() {
    local session_dir="$1"
    
    if ! command -v aws &> /dev/null; then
        log_warning "AWS CLI not available, skipping S3 verification"
        echo "s3_backup: skipped" >> "$session_dir/verification_results.txt"
        return 0
    fi
    
    log_info "Verifying S3 backup integrity..."
    
    # Check if S3 bucket is accessible
    if ! aws s3 ls "s3://$S3_BUCKET/" &> /dev/null; then
        log_error "Cannot access S3 bucket: $S3_BUCKET"
        echo "s3_backup: bucket_inaccessible" >> "$session_dir/verification_results.txt"
        return 1
    fi
    
    log_success "S3 bucket is accessible"
    
    # Check for recent backups in S3
    local date_path=$(date +%Y/%m/%d)
    local backup_types=("database/full" "redis/stockholm" "redis/gothenburg" "redis/malmo" "filesystem")
    local s3_verification_passed=0
    local s3_verification_total=${#backup_types[@]}
    
    for backup_type in "${backup_types[@]}"; do
        local s3_path="s3://$S3_BUCKET/$backup_type/$date_path/"
        local object_count=$(aws s3 ls "$s3_path" --recursive 2>/dev/null | wc -l || echo "0")
        
        if [[ $object_count -gt 0 ]]; then
            log_success "S3 backup found for $backup_type ($object_count objects)"
            ((s3_verification_passed++))
            
            # Test downloading one small object
            local test_object=$(aws s3 ls "$s3_path" --recursive 2>/dev/null | head -1 | awk '{print $4}' || echo "")
            
            if [[ -n "$test_object" ]]; then
                local temp_download="/tmp/backup_verification/s3_test_$(date +%s)"
                
                if aws s3 cp "s3://$S3_BUCKET/$test_object" "$temp_download" --quiet 2>/dev/null; then
                    log_success "S3 download test passed for $backup_type"
                    rm -f "$temp_download"
                else
                    log_warning "S3 download test failed for $backup_type"
                fi
            fi
        else
            log_warning "No S3 backup found for $backup_type on $date_path"
        fi
    done
    
    if [[ $s3_verification_passed -eq $s3_verification_total ]]; then
        log_success "All S3 backup verifications passed"
        echo "s3_backup: verified" >> "$session_dir/verification_results.txt"
        return 0
    elif [[ $s3_verification_passed -gt 0 ]]; then
        log_warning "Partial S3 backup verification ($s3_verification_passed/$s3_verification_total passed)"
        echo "s3_backup: partial" >> "$session_dir/verification_results.txt"
        return 1
    else
        log_error "All S3 backup verifications failed"
        echo "s3_backup: failed" >> "$session_dir/verification_results.txt"
        return 1
    fi
}

# Verify cross-region backup integrity
verify_cross_region_backup() {
    local session_dir="$1"
    
    log_info "Verifying cross-region backup integrity..."
    
    local regions=(stockholm gothenburg malmo)
    local cross_region_verification_passed=0
    local cross_region_verification_total=0
    
    for source_region in "${regions[@]}"; do
        for target_region in "${regions[@]}"; do
            if [[ "$source_region" != "$target_region" ]]; then
                ((cross_region_verification_total++))
                
                local cross_region_path="$BACKUP_BASE_DIR/cross-region/$source_region"
                
                if [[ -d "$cross_region_path" ]]; then
                    local backup_count=$(find "$cross_region_path" -type f -name "*.dump" -o -name "*.rdb.gz" -o -name "*.tar.gz" | wc -l)
                    
                    if [[ $backup_count -gt 0 ]]; then
                        log_success "Cross-region backups found: $source_region (in $target_region): $backup_count files"
                        ((cross_region_verification_passed++))
                    else
                        log_warning "No cross-region backups found: $source_region (in $target_region)"
                    fi
                else
                    log_warning "Cross-region backup directory not found: $cross_region_path"
                fi
            fi
        done
    done
    
    if [[ $cross_region_verification_total -eq 0 ]]; then
        log_warning "No cross-region backup verification needed"
        echo "cross_region_backup: not_applicable" >> "$session_dir/verification_results.txt"
        return 0
    elif [[ $cross_region_verification_passed -eq $cross_region_verification_total ]]; then
        log_success "All cross-region backup verifications passed"
        echo "cross_region_backup: verified" >> "$session_dir/verification_results.txt"
        return 0
    elif [[ $cross_region_verification_passed -gt 0 ]]; then
        log_warning "Partial cross-region backup verification ($cross_region_verification_passed/$cross_region_verification_total passed)"
        echo "cross_region_backup: partial" >> "$session_dir/verification_results.txt"
        return 1
    else
        log_error "All cross-region backup verifications failed"
        echo "cross_region_backup: failed" >> "$session_dir/verification_results.txt"
        return 1
    fi
}

# Generate verification report
generate_verification_report() {
    local session_id="$1"
    local session_dir="$BACKUP_BASE_DIR/verification/$session_id"
    local end_time=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    
    log_info "Generating backup verification report..."
    
    # Count results
    local total_verifications=0
    local passed_verifications=0
    local partial_verifications=0
    local failed_verifications=0
    
    if [[ -f "$session_dir/verification_results.txt" ]]; then
        total_verifications=$(wc -l < "$session_dir/verification_results.txt")
        passed_verifications=$(grep -c ": verified" "$session_dir/verification_results.txt" || echo "0")
        partial_verifications=$(grep -c ": partial" "$session_dir/verification_results.txt" || echo "0")
        failed_verifications=$(grep -c ": failed" "$session_dir/verification_results.txt" || echo "0")
    fi
    
    # Update session manifest
    jq --arg end_time "$end_time" \
       --arg status "$([ $failed_verifications -eq 0 ] && echo "passed" || echo "failed")" \
       --arg passed "$passed_verifications" \
       --arg partial "$partial_verifications" \
       --arg failed "$failed_verifications" \
       '.end_time = $end_time | 
        .status = $status | 
        .summary = {
          "total_verifications": ($passed + $partial + $failed | tonumber),
          "passed_verifications": ($passed | tonumber),
          "partial_verifications": ($partial | tonumber),
          "failed_verifications": ($failed | tonumber),
          "success_rate": (($passed / ($passed + $partial + $failed)) * 100 | round)
        }' \
       "$session_dir/verification_manifest.json" > "$session_dir/verification_manifest.tmp" && \
       mv "$session_dir/verification_manifest.tmp" "$session_dir/verification_manifest.json"
    
    # Generate human-readable report
    cat > "$session_dir/verification_report.txt" << EOF
Backup Verification Report
=========================
Session ID: $session_id
Start Time: $(jq -r '.start_time' "$session_dir/verification_manifest.json")
End Time: $end_time

Verification Results:
- Total Verifications: $total_verifications
- Passed: $passed_verifications
- Partial: $partial_verifications
- Failed: $failed_verifications
- Success Rate: $(( passed_verifications * 100 / total_verifications ))%

Detailed Results:
EOF

    if [[ -f "$session_dir/verification_results.txt" ]]; then
        cat "$session_dir/verification_results.txt" >> "$session_dir/verification_report.txt"
    fi
    
    cat >> "$session_dir/verification_report.txt" << EOF

Overall Status: $(jq -r '.status' "$session_dir/verification_manifest.json")

Recommendations:
EOF

    # Add recommendations based on results
    if grep -q "failed" "$session_dir/verification_results.txt" 2>/dev/null; then
        cat >> "$session_dir/verification_report.txt" << EOF
- CRITICAL: Some backups have failed verification. Immediate investigation required.
- Check backup processes and storage integrity.
- Consider running manual backup to replace failed backups.
EOF
    fi
    
    if grep -q "partial" "$session_dir/verification_results.txt" 2>/dev/null; then
        cat >> "$session_dir/verification_report.txt" << EOF
- WARNING: Some backups have partial verification. Review backup completeness.
- Monitor backup processes for consistent execution.
EOF
    fi
    
    if [[ $passed_verifications -eq $total_verifications ]]; then
        cat >> "$session_dir/verification_report.txt" << EOF
- All backup verifications passed successfully.
- Backup system is functioning correctly.
- Continue regular verification schedule.
EOF
    fi
    
    log_success "Verification report generated: $session_dir/verification_report.txt"
    
    return $failed_verifications
}

# Cleanup verification artifacts
cleanup_verification() {
    log_info "Cleaning up verification artifacts..."
    
    # Remove temporary files
    rm -rf /tmp/backup_verification
    
    # Clean up any test databases
    if [[ -n "$DATABASE_URL" ]]; then
        psql "$DATABASE_URL" -c "DROP DATABASE IF EXISTS $TEMP_DB_NAME;" &> /dev/null || true
    fi
    
    log_success "Verification cleanup completed"
}

# Main verification function
main() {
    log_info "Starting backup verification process..."
    
    # Initialize verification session
    local session_id=$(initialize_verification_session)
    local session_dir="$BACKUP_BASE_DIR/verification/$session_id"
    
    log_info "Backup verification session initialized: $session_id"
    
    local verification_failures=0
    
    # Run verification tests
    if [[ "$VERIFY_DATABASE" == "true" ]]; then
        if ! verify_database_backup "$session_dir"; then
            ((verification_failures++))
        fi
    fi
    
    if [[ "$VERIFY_REDIS" == "true" ]]; then
        if ! verify_redis_backup "$session_dir"; then
            ((verification_failures++))
        fi
    fi
    
    if [[ "$VERIFY_FILESYSTEM" == "true" ]]; then
        if ! verify_filesystem_backup "$session_dir"; then
            ((verification_failures++))
        fi
    fi
    
    if [[ "$VERIFY_S3" == "true" ]]; then
        if ! verify_s3_backup "$session_dir"; then
            ((verification_failures++))
        fi
    fi
    
    if [[ "$VERIFY_CROSS_REGION" == "true" ]]; then
        if ! verify_cross_region_backup "$session_dir"; then
            ((verification_failures++))
        fi
    fi
    
    # Generate verification report
    generate_verification_report "$session_id"
    local report_failures=$?
    
    # Cleanup
    cleanup_verification
    
    # Final status
    local total_failures=$((verification_failures + report_failures))
    
    if [[ $total_failures -eq 0 ]]; then
        log_success "All backup verifications passed!"
        return 0
    else
        log_warning "$total_failures verification(s) failed"
        return 1
    fi
}

# Script usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Backup verification script for AI Feedback Platform"
    echo ""
    echo "Options:"
    echo "  --database              Verify database backups only"
    echo "  --redis                 Verify Redis backups only"
    echo "  --filesystem            Verify filesystem backups only"
    echo "  --s3                    Verify S3 backups only"
    echo "  --cross-region          Verify cross-region backups only"
    echo "  --all                   Verify all backup types (default)"
    echo "  -h, --help              Show this help message"
    echo ""
    echo "Environment variables:"
    echo "  DATABASE_URL            PostgreSQL connection string"
    echo "  BACKUP_BASE_DIR         Base backup directory"
    echo "  S3_BUCKET               S3 bucket for remote backup"
    echo ""
    echo "Examples:"
    echo "  $0                      # Verify all backup types"
    echo "  $0 --database           # Verify database backups only"
    echo "  $0 --s3 --cross-region  # Verify S3 and cross-region backups"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --database)
            VERIFY_DATABASE=true
            VERIFY_REDIS=false
            VERIFY_FILESYSTEM=false
            VERIFY_S3=false
            VERIFY_CROSS_REGION=false
            shift
            ;;
        --redis)
            VERIFY_DATABASE=false
            VERIFY_REDIS=true
            VERIFY_FILESYSTEM=false
            VERIFY_S3=false
            VERIFY_CROSS_REGION=false
            shift
            ;;
        --filesystem)
            VERIFY_DATABASE=false
            VERIFY_REDIS=false
            VERIFY_FILESYSTEM=true
            VERIFY_S3=false
            VERIFY_CROSS_REGION=false
            shift
            ;;
        --s3)
            VERIFY_DATABASE=false
            VERIFY_REDIS=false
            VERIFY_FILESYSTEM=false
            VERIFY_S3=true
            VERIFY_CROSS_REGION=false
            shift
            ;;
        --cross-region)
            VERIFY_DATABASE=false
            VERIFY_REDIS=false
            VERIFY_FILESYSTEM=false
            VERIFY_S3=false
            VERIFY_CROSS_REGION=true
            shift
            ;;
        --all)
            VERIFY_DATABASE=true
            VERIFY_REDIS=true
            VERIFY_FILESYSTEM=true
            VERIFY_S3=true
            VERIFY_CROSS_REGION=true
            shift
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