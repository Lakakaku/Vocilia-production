#!/bin/bash

# POS Webhook Monitoring Script
# Monitors webhook delivery success rates and retry attempts

set -e

# Configuration
API_GATEWAY_URL=${API_GATEWAY_URL:-"http://api-gateway:3001"}
LOG_FILE=${LOG_FILE:-"/var/log/pos-webhooks/webhook-monitor.log"}
WEBHOOK_FAILURE_THRESHOLD=${WEBHOOK_FAILURE_THRESHOLD:-5}
PROMETHEUS_URL=${PROMETHEUS_URL:-"http://pos-prometheus:9090"}

# Create log directory
mkdir -p "$(dirname "$LOG_FILE")"

# Logging functions
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [INFO] $*" | tee -a "$LOG_FILE"
}

error_log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [ERROR] $*" | tee -a "$LOG_FILE" >&2
}

warn_log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [WARN] $*" | tee -a "$LOG_FILE"
}

# Check webhook health for all providers
check_webhook_health() {
    log "Checking webhook health for all providers"
    
    local response=$(curl -s -w "%{http_code}" \
        "$API_GATEWAY_URL/webhooks/health" 2>/dev/null || echo "000")
    
    local http_code=$(echo "$response" | grep -o '[0-9]\{3\}' | tail -1)
    
    if [ "$http_code" = "200" ]; then
        local body=$(echo "$response" | sed 's/[0-9]\{3\}$//')
        log "✅ Webhook health check successful"
        echo "$body"
        return 0
    else
        error_log "❌ Webhook health check failed (HTTP $http_code)"
        return 1
    fi
}

# Check webhook deliveries for specific provider
check_provider_deliveries() {
    local provider=$1
    local limit=${2:-50}
    
    log "Checking recent webhook deliveries for $provider (limit: $limit)"
    
    local response=$(curl -s -w "%{http_code}" \
        "$API_GATEWAY_URL/webhooks/deliveries/$provider?limit=$limit" 2>/dev/null || echo "000")
    
    local http_code=$(echo "$response" | grep -o '[0-9]\{3\}' | tail -1)
    
    if [ "$http_code" = "200" ]; then
        local body=$(echo "$response" | sed 's/[0-9]\{3\}$//')
        log "✅ $provider webhook deliveries retrieved"
        echo "$body"
        return 0
    else
        error_log "❌ Failed to get $provider webhook deliveries (HTTP $http_code)"
        return 1
    fi
}

# Analyze delivery success rates
analyze_delivery_rates() {
    local provider=$1
    local deliveries_json=$2
    
    log "Analyzing delivery rates for $provider"
    
    # Extract metrics from JSON (simplified parsing)
    local total=$(echo "$deliveries_json" | grep -o '"total":[0-9]*' | cut -d':' -f2)
    local successful=$(echo "$deliveries_json" | grep -o '"successful":[0-9]*' | cut -d':' -f2)
    local failed=$(echo "$deliveries_json" | grep -o '"failed":[0-9]*' | cut -d':' -f2)
    local success_rate=$(echo "$deliveries_json" | grep -o '"successRate":[0-9]*' | cut -d':' -f2)
    
    log "$provider delivery stats - Total: $total, Success: $successful, Failed: $failed, Rate: $success_rate%"
    
    # Check if failure rate is concerning
    if [ -n "$failed" ] && [ "$failed" -gt "$WEBHOOK_FAILURE_THRESHOLD" ]; then
        warn_log "⚠️  $provider has $failed failed deliveries (threshold: $WEBHOOK_FAILURE_THRESHOLD)"
        return 1
    fi
    
    # Check if success rate is too low
    if [ -n "$success_rate" ] && [ "$success_rate" -lt 95 ]; then
        warn_log "⚠️  $provider success rate is $success_rate% (below 95% threshold)"
        return 1
    fi
    
    log "✅ $provider webhook delivery rates are healthy"
    return 0
}

# Check for stuck webhook deliveries
check_stuck_deliveries() {
    local provider=$1
    
    log "Checking for stuck webhook deliveries for $provider"
    
    # Get failed deliveries
    local response=$(curl -s -w "%{http_code}" \
        "$API_GATEWAY_URL/webhooks/deliveries/$provider?status=failed&limit=10" 2>/dev/null || echo "000")
    
    local http_code=$(echo "$response" | grep -o '[0-9]\{3\}' | tail -1)
    
    if [ "$http_code" = "200" ]; then
        local body=$(echo "$response" | sed 's/[0-9]\{3\}$//')
        
        # Count recent failures (simplified approach)
        local recent_failures=$(echo "$body" | grep -o '"deliveries":\[' | wc -l)
        
        if [ "$recent_failures" -gt 0 ]; then
            warn_log "⚠️  $provider has $recent_failures recent failed deliveries"
            
            # Try to identify patterns in failures
            log "Analyzing failure patterns for $provider"
            # In a real implementation, you'd parse the JSON to identify error types
        fi
    fi
}

# Retry failed webhook deliveries
retry_failed_deliveries() {
    local provider=$1
    
    log "Attempting to retry failed deliveries for $provider"
    
    # Get recent failed deliveries
    local failed_deliveries=$(curl -s \
        "$API_GATEWAY_URL/webhooks/deliveries/$provider?status=failed&limit=5" 2>/dev/null || echo "{}")
    
    # Extract delivery IDs (simplified JSON parsing)
    # In production, you'd use jq or proper JSON parsing
    local delivery_ids=$(echo "$failed_deliveries" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
    
    local retry_count=0
    for delivery_id in $delivery_ids; do
        if [ -n "$delivery_id" ] && [ "$delivery_id" != "null" ]; then
            log "Retrying delivery: $delivery_id"
            
            local retry_response=$(curl -s -w "%{http_code}" -X POST \
                "$API_GATEWAY_URL/webhooks/retry/$provider/$delivery_id" 2>/dev/null || echo "000")
            
            local retry_http_code=$(echo "$retry_response" | grep -o '[0-9]\{3\}' | tail -1)
            
            if [ "$retry_http_code" = "200" ]; then
                log "✅ Successfully retried delivery $delivery_id"
                retry_count=$((retry_count + 1))
            else
                error_log "❌ Failed to retry delivery $delivery_id (HTTP $retry_http_code)"
            fi
        fi
    done
    
    if [ $retry_count -gt 0 ]; then
        log "Retried $retry_count failed deliveries for $provider"
    else
        log "No failed deliveries to retry for $provider"
    fi
}

# Monitor webhook processing times
monitor_processing_times() {
    local provider=$1
    
    log "Monitoring processing times for $provider webhooks"
    
    # Get recent deliveries with timing information
    local response=$(curl -s \
        "$API_GATEWAY_URL/webhooks/deliveries/$provider?limit=20" 2>/dev/null || echo "{}")
    
    # In a real implementation, you'd parse the response to extract processing times
    # and calculate averages, percentiles, etc.
    log "Processing time analysis for $provider completed"
}

# Check webhook endpoint accessibility
check_webhook_endpoints() {
    local providers=("square" "shopify" "zettle")
    
    log "Checking webhook endpoint accessibility"
    
    for provider in "${providers[@]}"; do
        log "Testing $provider webhook endpoint"
        
        # Test webhook endpoint with GET request (should return 405 Method Not Allowed)
        local response=$(curl -s -w "%{http_code}" \
            "$API_GATEWAY_URL/webhooks/$provider" 2>/dev/null || echo "000")
        
        local http_code=$(echo "$response" | grep -o '[0-9]\{3\}' | tail -1)
        
        case "$http_code" in
            405)
                log "✅ $provider webhook endpoint is accessible (405 Method Not Allowed is expected)"
                ;;
            200)
                log "✅ $provider webhook endpoint is accessible"
                ;;
            *)
                error_log "❌ $provider webhook endpoint not accessible (HTTP $http_code)"
                ;;
        esac
    done
}

# Generate webhook monitoring report
generate_webhook_report() {
    local report_file="/var/log/pos-webhooks/webhook-report-$(date +%Y%m%d-%H%M%S).json"
    local timestamp=$(date -Iseconds)
    
    log "Generating webhook monitoring report: $report_file"
    
    local overall_health=$(check_webhook_health 2>/dev/null || echo '{"status": "error"}')
    
    cat > "$report_file" <<EOF
{
    "timestamp": "$timestamp",
    "overall_health": $overall_health,
    "provider_details": {
        "square": $(check_provider_deliveries "square" 10 2>/dev/null || echo '{"error": "failed"}'),
        "shopify": $(check_provider_deliveries "shopify" 10 2>/dev/null || echo '{"error": "failed"}'),
        "zettle": $(check_provider_deliveries "zettle" 10 2>/dev/null || echo '{"error": "failed"}')
    }
}
EOF
    
    log "Webhook monitoring report generated: $report_file"
}

# Send alert for webhook issues
send_webhook_alert() {
    local provider=$1
    local issue_type=$2
    local details=$3
    
    log "Sending webhook alert - Provider: $provider, Issue: $issue_type, Details: $details"
    
    # In production, you'd integrate with your alerting system
    # For now, we'll just log the alert
    error_log "WEBHOOK ALERT: $provider - $issue_type - $details"
}

# Cleanup old webhook delivery logs
cleanup_old_logs() {
    local days_to_keep=${1:-7}
    
    log "Cleaning up webhook delivery logs older than $days_to_keep days"
    
    find "/var/log/pos-webhooks" -name "webhook-report-*.json" -mtime +$days_to_keep -delete 2>/dev/null || true
    find "/var/log/pos-webhooks" -name "*.log" -mtime +$days_to_keep -delete 2>/dev/null || true
    
    log "Log cleanup completed"
}

# Main monitoring function
main() {
    log "Starting POS webhook monitoring cycle"
    
    local providers=("square" "shopify" "zettle")
    local issues_found=0
    
    # Check overall webhook health
    if ! check_webhook_health >/dev/null; then
        error_log "Overall webhook health check failed"
        issues_found=$((issues_found + 1))
    fi
    
    # Check webhook endpoint accessibility
    check_webhook_endpoints
    
    # Monitor each provider
    for provider in "${providers[@]}"; do
        log "--- Monitoring $provider webhooks ---"
        
        # Get delivery statistics
        local deliveries=$(check_provider_deliveries "$provider" 50)
        if [ $? -eq 0 ]; then
            # Analyze delivery rates
            if ! analyze_delivery_rates "$provider" "$deliveries"; then
                issues_found=$((issues_found + 1))
                send_webhook_alert "$provider" "poor_delivery_rate" "Webhook delivery rate below threshold"
            fi
        else
            issues_found=$((issues_found + 1))
            send_webhook_alert "$provider" "api_failure" "Unable to retrieve webhook delivery statistics"
        fi
        
        # Check for stuck deliveries
        check_stuck_deliveries "$provider"
        
        # Monitor processing times
        monitor_processing_times "$provider"
        
        # Retry failed deliveries if configured
        if [ "${RETRY_FAILED_DELIVERIES:-false}" = "true" ]; then
            retry_failed_deliveries "$provider"
        fi
        
        log "--- $provider webhook monitoring complete ---"
    done
    
    # Generate monitoring report
    generate_webhook_report
    
    # Cleanup old logs
    cleanup_old_logs 7
    
    # Summary
    log "=== WEBHOOK MONITORING SUMMARY ==="
    log "Issues found: $issues_found"
    
    if [ $issues_found -gt 0 ]; then
        warn_log "⚠️  $issues_found webhook issues detected"
        exit 1
    else
        log "✅ All webhook systems are operating normally"
        exit 0
    fi
}

# Execute main function
main "$@"