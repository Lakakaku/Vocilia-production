#!/bin/bash

# Backup Coordinator Script
# Orchestrates all backup operations across regions

set -euo pipefail

# Configuration
REGIONS=(stockholm gothenburg malmo)
BACKUP_BASE_DIR="${BACKUP_BASE_DIR:-/opt/ai-feedback/backups}"
S3_BUCKET="${S3_BUCKET:-ai-feedback-backups-eu-north-1}"
SLACK_WEBHOOK="${SLACK_WEBHOOK:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Backup job configuration
PARALLEL_JOBS="${PARALLEL_JOBS:-3}"
MAX_RETRY_ATTEMPTS="${MAX_RETRY_ATTEMPTS:-3}"
BACKUP_TIMEOUT="${BACKUP_TIMEOUT:-3600}"  # 1 hour timeout

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] [COORDINATOR] [INFO]${NC} $1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [COORDINATOR] [INFO] $1" >> /var/log/backups/coordinator.log
}

log_success() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] [COORDINATOR] [SUCCESS]${NC} $1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [COORDINATOR] [SUCCESS] $1" >> /var/log/backups/coordinator.log
}

log_warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] [COORDINATOR] [WARNING]${NC} $1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [COORDINATOR] [WARNING] $1" >> /var/log/backups/coordinator.log
}

log_error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] [COORDINATOR] [ERROR]${NC} $1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [COORDINATOR] [ERROR] $1" >> /var/log/backups/coordinator.log
}

# Send Slack notification
send_slack_notification() {
    local message="$1"
    local color="${2:-good}"  # good, warning, danger
    
    if [[ -n "$SLACK_WEBHOOK" ]]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{
                \"attachments\": [{
                    \"color\": \"$color\",
                    \"title\": \"AI Feedback Platform - Backup Status\",
                    \"text\": \"$message\",
                    \"ts\": $(date +%s)
                }]
            }" \
            "$SLACK_WEBHOOK" &> /dev/null || true
    fi
}

# Initialize backup session
initialize_backup_session() {
    local session_id=$(date +%Y%m%d_%H%M%S)
    local session_dir="$BACKUP_BASE_DIR/sessions/$session_id"
    
    mkdir -p "$session_dir"
    mkdir -p /var/log/backups
    
    # Create session manifest
    cat > "$session_dir/manifest.json" << EOF
{
  "session_id": "$session_id",
  "start_time": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "regions": $(printf '%s\n' "${REGIONS[@]}" | jq -R . | jq -s .),
  "backup_types": ["database", "redis", "filesystem"],
  "status": "in_progress"
}
EOF

    echo "$session_id"
}

# Run backup job with timeout and retry
run_backup_job() {
    local job_name="$1"
    local job_script="$2"
    local max_attempts="$3"
    local timeout="$4"
    
    log_info "Starting backup job: $job_name"
    
    for attempt in $(seq 1 $max_attempts); do
        log_info "Attempt $attempt/$max_attempts for $job_name"
        
        if timeout "$timeout" bash "$job_script"; then
            log_success "Backup job completed: $job_name"
            return 0
        else
            log_warning "Backup job failed (attempt $attempt): $job_name"
            if [[ $attempt -lt $max_attempts ]]; then
                sleep $((attempt * 30))  # Progressive backoff
            fi
        fi
    done
    
    log_error "Backup job failed after $max_attempts attempts: $job_name"
    return 1
}

# Database backup coordination
coordinate_database_backup() {
    local session_id="$1"
    local session_dir="$BACKUP_BASE_DIR/sessions/$session_id"
    
    log_info "Coordinating database backup..."
    
    # Create database backup job script
    cat > "$session_dir/database_backup.sh" << 'EOF'
#!/bin/bash
set -euo pipefail
source /scripts/backup-database.sh
main "$@"
EOF
    chmod +x "$session_dir/database_backup.sh"
    
    if run_backup_job "database" "$session_dir/database_backup.sh" "$MAX_RETRY_ATTEMPTS" "$BACKUP_TIMEOUT"; then
        echo "database: success" >> "$session_dir/job_results.txt"
        return 0
    else
        echo "database: failed" >> "$session_dir/job_results.txt"
        return 1
    fi
}

# Redis backup coordination
coordinate_redis_backup() {
    local session_id="$1"
    local session_dir="$BACKUP_BASE_DIR/sessions/$session_id"
    
    log_info "Coordinating Redis backup across all regions..."
    
    # Create Redis backup job script
    cat > "$session_dir/redis_backup.sh" << 'EOF'
#!/bin/bash
set -euo pipefail
source /scripts/backup-redis.sh
main "$@"
EOF
    chmod +x "$session_dir/redis_backup.sh"
    
    if run_backup_job "redis" "$session_dir/redis_backup.sh" "$MAX_RETRY_ATTEMPTS" "$BACKUP_TIMEOUT"; then
        echo "redis: success" >> "$session_dir/job_results.txt"
        return 0
    else
        echo "redis: failed" >> "$session_dir/job_results.txt"
        return 1
    fi
}

# Filesystem backup coordination
coordinate_filesystem_backup() {
    local session_id="$1"
    local session_dir="$BACKUP_BASE_DIR/sessions/$session_id"
    
    log_info "Coordinating filesystem backup..."
    
    # Create filesystem backup job script
    cat > "$session_dir/filesystem_backup.sh" << 'EOF'
#!/bin/bash
set -euo pipefail

BACKUP_PATHS=("/app/uploads" "/app/logs" "/app/config")
BACKUP_DIR="/backups/filesystem/$(date +%Y/%m/%d)"
S3_BUCKET="${S3_BUCKET:-ai-feedback-backups-eu-north-1}"

mkdir -p "$BACKUP_DIR"

for path in "${BACKUP_PATHS[@]}"; do
    if [[ -d "$path" ]]; then
        path_name=$(basename "$path")
        timestamp=$(date +%Y%m%d_%H%M%S)
        archive_name="$BACKUP_DIR/${path_name}-${timestamp}.tar.gz"
        
        tar -czf "$archive_name" -C "$(dirname "$path")" "$(basename "$path")"
        
        if [[ $? -eq 0 ]]; then
            echo "Successfully backed up $path to $archive_name"
        else
            echo "Failed to backup $path" >&2
            exit 1
        fi
    fi
done

# Upload to S3 if available
if command -v aws &> /dev/null; then
    aws s3 sync "$BACKUP_DIR" "s3://$S3_BUCKET/filesystem/$(date +%Y/%m/%d)/" \
        --storage-class STANDARD_IA \
        --server-side-encryption AES256
fi

echo "Filesystem backup completed"
EOF
    chmod +x "$session_dir/filesystem_backup.sh"
    
    if run_backup_job "filesystem" "$session_dir/filesystem_backup.sh" "$MAX_RETRY_ATTEMPTS" "$BACKUP_TIMEOUT"; then
        echo "filesystem: success" >> "$session_dir/job_results.txt"
        return 0
    else
        echo "filesystem: failed" >> "$session_dir/job_results.txt"
        return 1
    fi
}

# Cross-region synchronization
coordinate_cross_region_sync() {
    local session_id="$1"
    local session_dir="$BACKUP_BASE_DIR/sessions/$session_id"
    
    log_info "Coordinating cross-region backup synchronization..."
    
    # Create sync job script
    cat > "$session_dir/cross_region_sync.sh" << 'EOF'
#!/bin/bash
set -euo pipefail

REGIONS=(stockholm gothenburg malmo)
SYNC_DIR="/backups/cross-region-sync/$(date +%Y/%m/%d)"
S3_BUCKET="${S3_BUCKET:-ai-feedback-backups-eu-north-1}"

mkdir -p "$SYNC_DIR"

# Sync critical backups across regions via S3
for region in "${REGIONS[@]}"; do
    region_sync_dir="$SYNC_DIR/$region"
    mkdir -p "$region_sync_dir"
    
    # Download latest backups from S3 for this region
    if command -v aws &> /dev/null; then
        aws s3 sync "s3://$S3_BUCKET/database/full/$(date +%Y/%m/%d)/" \
            "$region_sync_dir/database/" --quiet || true
        
        aws s3 sync "s3://$S3_BUCKET/redis/$region/$(date +%Y/%m/%d)/" \
            "$region_sync_dir/redis/" --quiet || true
    fi
done

echo "Cross-region sync completed"
EOF
    chmod +x "$session_dir/cross_region_sync.sh"
    
    if run_backup_job "cross-region-sync" "$session_dir/cross_region_sync.sh" "$MAX_RETRY_ATTEMPTS" "$BACKUP_TIMEOUT"; then
        echo "cross_region_sync: success" >> "$session_dir/job_results.txt"
        return 0
    else
        echo "cross_region_sync: failed" >> "$session_dir/job_results.txt"
        return 1
    fi
}

# Health check for backup services
check_backup_services_health() {
    log_info "Checking backup services health..."
    
    local services=(
        "database-backup-service"
        "redis-backup-service"
        "filesystem-backup-service"
    )
    
    local healthy_services=0
    local total_services=${#services[@]}
    
    for service in "${services[@]}"; do
        if docker service ps "$service" --filter "desired-state=running" --format "{{.CurrentState}}" | grep -q "Running"; then
            log_info "Service $service is healthy"
            ((healthy_services++))
        else
            log_warning "Service $service is unhealthy"
        fi
    done
    
    log_info "Backup services health: $healthy_services/$total_services healthy"
    
    if [[ $healthy_services -eq $total_services ]]; then
        return 0
    else
        return 1
    fi
}

# Generate backup summary report
generate_backup_summary() {
    local session_id="$1"
    local session_dir="$BACKUP_BASE_DIR/sessions/$session_id"
    local end_time=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    local duration=$(($(date +%s) - $(date -d "$(jq -r '.start_time' "$session_dir/manifest.json")" +%s)))
    
    log_info "Generating backup summary report..."
    
    # Count successful and failed jobs
    local successful_jobs=0
    local failed_jobs=0
    local total_jobs=0
    
    if [[ -f "$session_dir/job_results.txt" ]]; then
        successful_jobs=$(grep -c "success" "$session_dir/job_results.txt" || echo "0")
        failed_jobs=$(grep -c "failed" "$session_dir/job_results.txt" || echo "0")
        total_jobs=$((successful_jobs + failed_jobs))
    fi
    
    # Calculate total backup size
    local total_size=$(du -sh "$BACKUP_BASE_DIR" 2>/dev/null | cut -f1 || echo "unknown")
    
    # Update session manifest
    jq --arg end_time "$end_time" \
       --arg duration "${duration}s" \
       --arg status "$([ $failed_jobs -eq 0 ] && echo "completed" || echo "partial")" \
       --arg successful_jobs "$successful_jobs" \
       --arg failed_jobs "$failed_jobs" \
       --arg total_size "$total_size" \
       '.end_time = $end_time | 
        .duration = $duration | 
        .status = $status | 
        .summary = {
          "successful_jobs": ($successful_jobs | tonumber),
          "failed_jobs": ($failed_jobs | tonumber),
          "total_backup_size": $total_size
        }' \
       "$session_dir/manifest.json" > "$session_dir/manifest.tmp" && \
       mv "$session_dir/manifest.tmp" "$session_dir/manifest.json"
    
    # Generate human-readable summary
    cat > "$session_dir/summary.txt" << EOF
AI Feedback Platform - Backup Summary
====================================
Session ID: $session_id
Start Time: $(jq -r '.start_time' "$session_dir/manifest.json")
End Time: $end_time
Duration: ${duration}s

Results:
- Successful Jobs: $successful_jobs
- Failed Jobs: $failed_jobs
- Total Jobs: $total_jobs
- Total Backup Size: $total_size

Job Details:
EOF

    if [[ -f "$session_dir/job_results.txt" ]]; then
        cat "$session_dir/job_results.txt" >> "$session_dir/summary.txt"
    fi
    
    cat >> "$session_dir/summary.txt" << EOF

Backup Status: $(jq -r '.status' "$session_dir/manifest.json")

EOF

    log_success "Backup summary generated: $session_dir/summary.txt"
    
    # Send Slack notification
    local slack_color="good"
    if [[ $failed_jobs -gt 0 ]]; then
        slack_color="warning"
    fi
    
    local slack_message="Backup completed - $successful_jobs/$total_jobs jobs successful (Duration: ${duration}s, Size: $total_size)"
    send_slack_notification "$slack_message" "$slack_color"
    
    return $failed_jobs
}

# Cleanup old backup sessions
cleanup_old_sessions() {
    local retention_days="${BACKUP_RETENTION_DAYS:-30}"
    
    log_info "Cleaning up backup sessions older than $retention_days days..."
    
    find "$BACKUP_BASE_DIR/sessions" -type d -mtime +$retention_days -exec rm -rf {} + 2>/dev/null || true
    
    log_success "Old backup sessions cleaned up"
}

# Main coordination function
main() {
    log_info "Starting backup coordination session..."
    
    # Check backup services health
    if ! check_backup_services_health; then
        log_error "Some backup services are unhealthy, proceeding with caution..."
    fi
    
    # Initialize backup session
    local session_id=$(initialize_backup_session)
    local session_dir="$BACKUP_BASE_DIR/sessions/$session_id"
    
    log_info "Backup session initialized: $session_id"
    send_slack_notification "Backup session started: $session_id" "good"
    
    # Run backup jobs (can be parallelized if needed)
    local jobs_pids=()
    
    # Sequential execution for reliability (can be changed to parallel if needed)
    coordinate_database_backup "$session_id" &
    jobs_pids+=($!)
    
    coordinate_redis_backup "$session_id" &
    jobs_pids+=($!)
    
    coordinate_filesystem_backup "$session_id" &
    jobs_pids+=($!)
    
    # Wait for all backup jobs to complete
    log_info "Waiting for backup jobs to complete..."
    local job_failures=0
    
    for pid in "${jobs_pids[@]}"; do
        if ! wait "$pid"; then
            ((job_failures++))
        fi
    done
    
    # Run cross-region sync after main backups
    coordinate_cross_region_sync "$session_id"
    if [[ $? -ne 0 ]]; then
        ((job_failures++))
    fi
    
    # Generate summary report
    generate_backup_summary "$session_id"
    local summary_exit_code=$?
    
    # Cleanup old sessions
    cleanup_old_sessions
    
    # Final status
    if [[ $job_failures -eq 0 && $summary_exit_code -eq 0 ]]; then
        log_success "All backup operations completed successfully!"
        return 0
    else
        log_warning "$job_failures backup job(s) failed"
        return 1
    fi
}

# Script usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Backup coordinator for AI Feedback Platform multi-region infrastructure"
    echo ""
    echo "Options:"
    echo "  -p, --parallel-jobs JOBS    Number of parallel backup jobs (default: 3)"
    echo "  -r, --retry-attempts NUM    Max retry attempts per job (default: 3)"
    echo "  -t, --timeout SECONDS       Backup job timeout in seconds (default: 3600)"
    echo "  -c, --cleanup              Cleanup old sessions only"
    echo "  -s, --status               Show backup services status"
    echo "  -h, --help                 Show this help message"
    echo ""
    echo "Environment variables:"
    echo "  BACKUP_BASE_DIR            Base backup directory"
    echo "  S3_BUCKET                  S3 bucket for remote backup"
    echo "  SLACK_WEBHOOK              Slack webhook URL for notifications"
    echo "  PARALLEL_JOBS              Number of parallel jobs"
    echo ""
    echo "Examples:"
    echo "  $0                         # Run full backup coordination"
    echo "  $0 -p 5 -t 7200           # 5 parallel jobs with 2-hour timeout"
    echo "  $0 -c                      # Cleanup old sessions only"
}

# Cleanup mode
cleanup_mode() {
    log_info "Running cleanup mode..."
    cleanup_old_sessions
    exit 0
}

# Status check mode
status_mode() {
    log_info "Checking backup services status..."
    check_backup_services_health
    exit $?
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -p|--parallel-jobs)
            PARALLEL_JOBS="$2"
            shift 2
            ;;
        -r|--retry-attempts)
            MAX_RETRY_ATTEMPTS="$2"
            shift 2
            ;;
        -t|--timeout)
            BACKUP_TIMEOUT="$2"
            shift 2
            ;;
        -c|--cleanup)
            cleanup_mode
            ;;
        -s|--status)
            status_mode
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