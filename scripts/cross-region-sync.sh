#!/bin/bash

# Cross-Region Backup Synchronization Script
# Ensures backup redundancy across Swedish regions

set -euo pipefail

# Configuration
CURRENT_REGION="${REGION:-stockholm}"
REGIONS=(stockholm gothenburg malmo)
SYNC_TARGETS="${SYNC_TARGETS:-}"
BACKUP_BASE_DIR="${BACKUP_BASE_DIR:-/opt/ai-feedback/backups}"
S3_BUCKET="${S3_BUCKET:-ai-feedback-backups-eu-north-1}"
SSH_KEY_PATH="${SSH_KEY_PATH:-/root/.ssh/cross_region_key}"

# Sync configuration
RSYNC_OPTIONS=(-avz --delete --compress-level=6 --progress --stats)
SSH_OPTIONS=(-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=30)
SYNC_TIMEOUT="${SYNC_TIMEOUT:-3600}"  # 1 hour

# Region endpoints
declare -A REGION_ENDPOINTS=(
    ["stockholm"]="stockholm.ai-feedback.internal"
    ["gothenburg"]="gothenburg.ai-feedback.internal"
    ["malmo"]="malmo.ai-feedback.internal"
)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] [$CURRENT_REGION] [SYNC] [INFO]${NC} $1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$CURRENT_REGION] [SYNC] [INFO] $1" >> /var/log/backups/cross-region-sync.log
}

log_success() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] [$CURRENT_REGION] [SYNC] [SUCCESS]${NC} $1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$CURRENT_REGION] [SYNC] [SUCCESS] $1" >> /var/log/backups/cross-region-sync.log
}

log_warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] [$CURRENT_REGION] [SYNC] [WARNING]${NC} $1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$CURRENT_REGION] [SYNC] [WARNING] $1" >> /var/log/backups/cross-region-sync.log
}

log_error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] [$CURRENT_REGION] [SYNC] [ERROR]${NC} $1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$CURRENT_REGION] [SYNC] [ERROR] $1" >> /var/log/backups/cross-region-sync.log
}

# Initialize sync session
initialize_sync_session() {
    local session_id=$(date +%Y%m%d_%H%M%S)
    local session_dir="$BACKUP_BASE_DIR/cross-region-sync/$session_id"
    
    mkdir -p "$session_dir"
    mkdir -p /var/log/backups
    
    # Create sync manifest
    cat > "$session_dir/sync_manifest.json" << EOF
{
  "session_id": "$session_id",
  "source_region": "$CURRENT_REGION",
  "target_regions": $(echo "$SYNC_TARGETS" | tr ',' '\n' | jq -R . | jq -s .),
  "start_time": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "sync_types": ["database", "redis", "filesystem"],
  "status": "in_progress"
}
EOF

    echo "$session_id"
}

# Check region connectivity
check_region_connectivity() {
    local target_region="$1"
    local endpoint="${REGION_ENDPOINTS[$target_region]}"
    
    log_info "Checking connectivity to $target_region ($endpoint)..."
    
    # Check SSH connectivity
    if timeout 30 ssh "${SSH_OPTIONS[@]}" -i "$SSH_KEY_PATH" "backup@$endpoint" "echo 'Connection test successful'" &> /dev/null; then
        log_success "SSH connectivity to $target_region confirmed"
        return 0
    else
        log_error "Cannot establish SSH connection to $target_region"
        return 1
    fi
}

# Sync database backups
sync_database_backups() {
    local target_region="$1"
    local endpoint="${REGION_ENDPOINTS[$target_region]}"
    local date_path=$(date +%Y/%m/%d)
    local source_path="$BACKUP_BASE_DIR/database/full/$date_path/"
    local target_path="/opt/ai-feedback/backups/cross-region/$CURRENT_REGION/database/"
    
    log_info "Syncing database backups to $target_region..."
    
    # Create remote directory
    ssh "${SSH_OPTIONS[@]}" -i "$SSH_KEY_PATH" "backup@$endpoint" \
        "mkdir -p $target_path" || return 1
    
    # Sync database backups
    if rsync "${RSYNC_OPTIONS[@]}" -e "ssh ${SSH_OPTIONS[*]} -i $SSH_KEY_PATH" \
        "$source_path" "backup@$endpoint:$target_path"; then
        log_success "Database backup sync to $target_region completed"
        return 0
    else
        log_error "Database backup sync to $target_region failed"
        return 1
    fi
}

# Sync Redis backups
sync_redis_backups() {
    local target_region="$1"
    local endpoint="${REGION_ENDPOINTS[$target_region]}"
    local date_path=$(date +%Y/%m/%d)
    local source_path="$BACKUP_BASE_DIR/redis/$CURRENT_REGION/$date_path/"
    local target_path="/opt/ai-feedback/backups/cross-region/$CURRENT_REGION/redis/"
    
    log_info "Syncing Redis backups to $target_region..."
    
    # Create remote directory
    ssh "${SSH_OPTIONS[@]}" -i "$SSH_KEY_PATH" "backup@$endpoint" \
        "mkdir -p $target_path" || return 1
    
    # Sync Redis backups
    if rsync "${RSYNC_OPTIONS[@]}" -e "ssh ${SSH_OPTIONS[*]} -i $SSH_KEY_PATH" \
        "$source_path" "backup@$endpoint:$target_path"; then
        log_success "Redis backup sync to $target_region completed"
        return 0
    else
        log_error "Redis backup sync to $target_region failed"
        return 1
    fi
}

# Sync filesystem backups
sync_filesystem_backups() {
    local target_region="$1"
    local endpoint="${REGION_ENDPOINTS[$target_region]}"
    local date_path=$(date +%Y/%m/%d)
    local source_path="$BACKUP_BASE_DIR/filesystem/$date_path/"
    local target_path="/opt/ai-feedback/backups/cross-region/$CURRENT_REGION/filesystem/"
    
    log_info "Syncing filesystem backups to $target_region..."
    
    # Create remote directory
    ssh "${SSH_OPTIONS[@]}" -i "$SSH_KEY_PATH" "backup@$endpoint" \
        "mkdir -p $target_path" || return 1
    
    # Sync filesystem backups
    if rsync "${RSYNC_OPTIONS[@]}" -e "ssh ${SSH_OPTIONS[*]} -i $SSH_KEY_PATH" \
        "$source_path" "backup@$endpoint:$target_path"; then
        log_success "Filesystem backup sync to $target_region completed"
        return 0
    else
        log_error "Filesystem backup sync to $target_region failed"
        return 1
    fi
}

# Sync via S3 (fallback method)
sync_via_s3() {
    local target_region="$1"
    local sync_type="$2"
    local date_path=$(date +%Y/%m/%d)
    
    log_info "Using S3 fallback for $sync_type sync to $target_region..."
    
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI not available for S3 fallback"
        return 1
    fi
    
    # Upload to S3 with region-specific prefix
    local s3_source_prefix="$CURRENT_REGION/$sync_type/$date_path/"
    local local_source_path="$BACKUP_BASE_DIR/$sync_type/$date_path/"
    
    if [[ "$sync_type" == "redis" ]]; then
        local_source_path="$BACKUP_BASE_DIR/redis/$CURRENT_REGION/$date_path/"
    fi
    
    # Upload to S3
    if aws s3 sync "$local_source_path" "s3://$S3_BUCKET/cross-region-sync/$s3_source_prefix" \
        --storage-class STANDARD_IA --server-side-encryption AES256; then
        
        # Notify target region about new backup via S3
        local notification_key="cross-region-sync/notifications/$target_region/$(date +%s)-$CURRENT_REGION-$sync_type.json"
        
        echo "{
            \"source_region\": \"$CURRENT_REGION\",
            \"target_region\": \"$target_region\",
            \"sync_type\": \"$sync_type\",
            \"s3_path\": \"s3://$S3_BUCKET/cross-region-sync/$s3_source_prefix\",
            \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
        }" | aws s3 cp - "s3://$S3_BUCKET/$notification_key"
        
        log_success "S3 fallback sync completed for $sync_type to $target_region"
        return 0
    else
        log_error "S3 fallback sync failed for $sync_type to $target_region"
        return 1
    fi
}

# Pull backups from other regions
pull_cross_region_backups() {
    log_info "Pulling backups from other regions to $CURRENT_REGION..."
    
    for source_region in "${REGIONS[@]}"; do
        if [[ "$source_region" != "$CURRENT_REGION" ]]; then
            local endpoint="${REGION_ENDPOINTS[$source_region]}"
            
            if check_region_connectivity "$source_region"; then
                # Pull database backups
                local remote_db_path="/opt/ai-feedback/backups/database/full/$(date +%Y/%m/%d)/"
                local local_db_path="$BACKUP_BASE_DIR/cross-region/$source_region/database/"
                
                mkdir -p "$local_db_path"
                
                if rsync "${RSYNC_OPTIONS[@]}" -e "ssh ${SSH_OPTIONS[*]} -i $SSH_KEY_PATH" \
                    "backup@$endpoint:$remote_db_path" "$local_db_path"; then
                    log_success "Pulled database backups from $source_region"
                else
                    log_warning "Failed to pull database backups from $source_region"
                fi
                
                # Pull Redis backups
                local remote_redis_path="/opt/ai-feedback/backups/redis/$source_region/$(date +%Y/%m/%d)/"
                local local_redis_path="$BACKUP_BASE_DIR/cross-region/$source_region/redis/"
                
                mkdir -p "$local_redis_path"
                
                if rsync "${RSYNC_OPTIONS[@]}" -e "ssh ${SSH_OPTIONS[*]} -i $SSH_KEY_PATH" \
                    "backup@$endpoint:$remote_redis_path" "$local_redis_path"; then
                    log_success "Pulled Redis backups from $source_region"
                else
                    log_warning "Failed to pull Redis backups from $source_region"
                fi
            else
                log_warning "Cannot connect to $source_region, trying S3 fallback..."
                
                # Try to pull from S3
                if command -v aws &> /dev/null; then
                    local s3_db_path="s3://$S3_BUCKET/database/full/$(date +%Y/%m/%d)/"
                    local local_s3_db_path="$BACKUP_BASE_DIR/cross-region/$source_region/database/"
                    
                    mkdir -p "$local_s3_db_path"
                    
                    aws s3 sync "$s3_db_path" "$local_s3_db_path" --quiet || \
                        log_warning "S3 fallback failed for $source_region database backups"
                    
                    local s3_redis_path="s3://$S3_BUCKET/redis/$source_region/$(date +%Y/%m/%d)/"
                    local local_s3_redis_path="$BACKUP_BASE_DIR/cross-region/$source_region/redis/"
                    
                    mkdir -p "$local_s3_redis_path"
                    
                    aws s3 sync "$s3_redis_path" "$local_s3_redis_path" --quiet || \
                        log_warning "S3 fallback failed for $source_region Redis backups"
                fi
            fi
        fi
    done
}

# Verify sync integrity
verify_sync_integrity() {
    local target_region="$1"
    local endpoint="${REGION_ENDPOINTS[$target_region]}"
    
    log_info "Verifying sync integrity for $target_region..."
    
    # Check if remote backups exist and have reasonable size
    local remote_check_script="
        db_size=\$(du -sb /opt/ai-feedback/backups/cross-region/$CURRENT_REGION/database/ 2>/dev/null | cut -f1 || echo 0)
        redis_size=\$(du -sb /opt/ai-feedback/backups/cross-region/$CURRENT_REGION/redis/ 2>/dev/null | cut -f1 || echo 0)
        
        echo \"db_size:\$db_size\"
        echo \"redis_size:\$redis_size\"
        
        # Check if sizes are reasonable (> 1MB for database, > 1KB for Redis)
        if [[ \$db_size -gt 1048576 && \$redis_size -gt 1024 ]]; then
            echo \"integrity:ok\"
        else
            echo \"integrity:fail\"
        fi
    "
    
    local result=$(ssh "${SSH_OPTIONS[@]}" -i "$SSH_KEY_PATH" "backup@$endpoint" "$remote_check_script" 2>/dev/null)
    
    if echo "$result" | grep -q "integrity:ok"; then
        log_success "Sync integrity verification passed for $target_region"
        return 0
    else
        log_error "Sync integrity verification failed for $target_region"
        log_error "Remote sizes: $(echo "$result" | grep -E "(db_size|redis_size):")"
        return 1
    fi
}

# Generate sync report
generate_sync_report() {
    local session_id="$1"
    local session_dir="$BACKUP_BASE_DIR/cross-region-sync/$session_id"
    local end_time=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    
    log_info "Generating cross-region sync report..."
    
    # Parse sync targets
    IFS=',' read -ra targets <<< "$SYNC_TARGETS"
    local total_targets=${#targets[@]}
    local successful_syncs=0
    
    # Count successful syncs (basic check - could be enhanced with result tracking)
    for target in "${targets[@]}"; do
        if [[ -n "$target" ]] && check_region_connectivity "$target"; then
            if verify_sync_integrity "$target"; then
                ((successful_syncs++))
            fi
        fi
    done
    
    # Update session manifest
    jq --arg end_time "$end_time" \
       --arg status "$([ $successful_syncs -eq $total_targets ] && echo "completed" || echo "partial")" \
       --arg successful_syncs "$successful_syncs" \
       --arg total_targets "$total_targets" \
       '.end_time = $end_time | 
        .status = $status | 
        .summary = {
          "successful_syncs": ($successful_syncs | tonumber),
          "total_targets": ($total_targets | tonumber),
          "success_rate": (($successful_syncs / $total_targets * 100) | round)
        }' \
       "$session_dir/sync_manifest.json" > "$session_dir/sync_manifest.tmp" && \
       mv "$session_dir/sync_manifest.tmp" "$session_dir/sync_manifest.json"
    
    # Generate human-readable report
    cat > "$session_dir/sync_report.txt" << EOF
Cross-Region Backup Sync Report
==============================
Session ID: $session_id
Source Region: $CURRENT_REGION
Target Regions: $SYNC_TARGETS
Start Time: $(jq -r '.start_time' "$session_dir/sync_manifest.json")
End Time: $end_time

Results:
- Successful Syncs: $successful_syncs
- Total Targets: $total_targets
- Success Rate: $(( successful_syncs * 100 / total_targets ))%

Sync Status: $(jq -r '.status' "$session_dir/sync_manifest.json")

EOF

    log_success "Cross-region sync report generated: $session_dir/sync_report.txt"
    
    return $((total_targets - successful_syncs))
}

# Main sync function
main() {
    log_info "Starting cross-region backup synchronization from $CURRENT_REGION..."
    
    # Parse sync targets
    if [[ -z "$SYNC_TARGETS" ]]; then
        # Default to all other regions
        SYNC_TARGETS=$(printf '%s,' "${REGIONS[@]}" | sed "s/$CURRENT_REGION,//g" | sed 's/,$//')
    fi
    
    log_info "Sync targets: $SYNC_TARGETS"
    
    # Initialize sync session
    local session_id=$(initialize_sync_session)
    local session_dir="$BACKUP_BASE_DIR/cross-region-sync/$session_id"
    
    log_info "Cross-region sync session initialized: $session_id"
    
    # Parse targets array
    IFS=',' read -ra targets <<< "$SYNC_TARGETS"
    local sync_failures=0
    
    # Sync to each target region
    for target_region in "${targets[@]}"; do
        if [[ -n "$target_region" && "$target_region" != "$CURRENT_REGION" ]]; then
            log_info "Starting sync to $target_region..."
            
            if check_region_connectivity "$target_region"; then
                # Direct sync via SSH/rsync
                local target_failures=0
                
                if ! sync_database_backups "$target_region"; then
                    ((target_failures++))
                fi
                
                if ! sync_redis_backups "$target_region"; then
                    ((target_failures++))
                fi
                
                if ! sync_filesystem_backups "$target_region"; then
                    ((target_failures++))
                fi
                
                if [[ $target_failures -eq 0 ]]; then
                    log_success "All syncs to $target_region completed successfully"
                else
                    log_warning "$target_failures sync(s) failed for $target_region"
                    ((sync_failures++))
                fi
            else
                # Fallback to S3
                log_warning "Using S3 fallback for $target_region..."
                local s3_failures=0
                
                if ! sync_via_s3 "$target_region" "database"; then
                    ((s3_failures++))
                fi
                
                if ! sync_via_s3 "$target_region" "redis"; then
                    ((s3_failures++))
                fi
                
                if ! sync_via_s3 "$target_region" "filesystem"; then
                    ((s3_failures++))
                fi
                
                if [[ $s3_failures -gt 0 ]]; then
                    ((sync_failures++))
                fi
            fi
        fi
    done
    
    # Pull backups from other regions
    pull_cross_region_backups
    
    # Generate sync report
    generate_sync_report "$session_id"
    local report_failures=$?
    
    # Final status
    local total_failures=$((sync_failures + report_failures))
    
    if [[ $total_failures -eq 0 ]]; then
        log_success "All cross-region sync operations completed successfully!"
        return 0
    else
        log_warning "$total_failures sync operation(s) had issues"
        return 1
    fi
}

# Script usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Cross-region backup synchronization for AI Feedback Platform"
    echo ""
    echo "Options:"
    echo "  -r, --region REGION         Current region (default: stockholm)"
    echo "  -t, --targets TARGETS       Comma-separated target regions"
    echo "  -s, --ssh-key PATH          SSH private key path (default: /root/.ssh/cross_region_key)"
    echo "  -p, --pull-only             Only pull backups from other regions"
    echo "  -v, --verify REGION         Verify sync integrity for specific region"
    echo "  -h, --help                  Show this help message"
    echo ""
    echo "Environment variables:"
    echo "  REGION                      Current region"
    echo "  SYNC_TARGETS                Comma-separated target regions"
    echo "  BACKUP_BASE_DIR             Base backup directory"
    echo "  S3_BUCKET                   S3 bucket for fallback sync"
    echo "  SSH_KEY_PATH                SSH private key path"
    echo ""
    echo "Examples:"
    echo "  $0                          # Sync from current region to all others"
    echo "  $0 -t gothenburg,malmo      # Sync only to specific regions"
    echo "  $0 -p                       # Pull backups from other regions only"
    echo "  $0 -v gothenburg            # Verify sync integrity for gothenburg"
}

# Pull-only mode
pull_only_mode() {
    log_info "Running pull-only mode..."
    pull_cross_region_backups
    exit $?
}

# Verify mode
verify_mode() {
    local target_region="$1"
    log_info "Verifying sync integrity for $target_region..."
    verify_sync_integrity "$target_region"
    exit $?
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -r|--region)
            CURRENT_REGION="$2"
            shift 2
            ;;
        -t|--targets)
            SYNC_TARGETS="$2"
            shift 2
            ;;
        -s|--ssh-key)
            SSH_KEY_PATH="$2"
            shift 2
            ;;
        -p|--pull-only)
            pull_only_mode
            ;;
        -v|--verify)
            verify_mode "$2"
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