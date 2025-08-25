#!/bin/bash

# POS Integration Health Checker Script
# Monitors health of Square, Shopify, and Zettle integrations

set -e

# Configuration
API_GATEWAY_URL=${API_GATEWAY_URL:-"http://api-gateway:3001"}
LOG_FILE=${LOG_FILE:-"/var/log/pos-health/health-checker.log"}
PROMETHEUS_URL=${PROMETHEUS_URL:-"http://pos-prometheus:9090"}
SLACK_WEBHOOK=${SLACK_WEBHOOK:-""}

# Create log directory if it doesn't exist
mkdir -p "$(dirname "$LOG_FILE")"

# Logging function
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [INFO] $*" | tee -a "$LOG_FILE"
}

error_log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [ERROR] $*" | tee -a "$LOG_FILE" >&2
}

# Health check function for individual provider
check_provider_health() {
    local provider=$1
    local start_time=$(date +%s.%N)
    
    log "Checking health for provider: $provider"
    
    # Make health check request
    local response=$(curl -s -w "%{http_code},%{time_total}" \
        "$API_GATEWAY_URL/pos/health/$provider" 2>/dev/null || echo "000,0")
    
    local http_code=$(echo "$response" | grep -o '[0-9]\{3\}' | tail -1)
    local response_time=$(echo "$response" | cut -d',' -f2)
    local end_time=$(date +%s.%N)
    local total_time=$(echo "$end_time - $start_time" | bc -l)
    
    # Parse response body (remove timing info)
    local body=$(echo "$response" | sed 's/,[0-9]*,[0-9.]*$//')
    
    log "Provider $provider - HTTP: $http_code, Response Time: ${response_time}s"
    
    # Send metrics to Prometheus pushgateway if available
    if command -v curl >/dev/null && [ -n "$PROMETHEUS_URL" ]; then
        # Create metric for health check result
        local healthy=0
        if [ "$http_code" = "200" ]; then
            healthy=1
        fi
        
        # Push metrics (simplified approach - in production you'd use proper pushgateway)
        curl -s -X POST "$PROMETHEUS_URL/api/v1/admin/tsdb/delete_series" \
            -d "match[]=pos_health_check_result{provider=\"$provider\"}" >/dev/null 2>&1 || true
    fi
    
    # Check response and determine health
    case "$http_code" in
        200)
            log "✅ $provider: HEALTHY"
            return 0
            ;;
        503)
            error_log "⚠️  $provider: DEGRADED (HTTP 503)"
            return 1
            ;;
        *)
            error_log "❌ $provider: UNHEALTHY (HTTP $http_code)"
            return 2
            ;;
    esac
}

# Check authentication status
check_auth_status() {
    local provider=$1
    
    log "Checking authentication status for $provider"
    
    local response=$(curl -s -w "%{http_code}" \
        "$API_GATEWAY_URL/pos/health/$provider" 2>/dev/null || echo "000")
    
    local http_code=$(echo "$response" | grep -o '[0-9]\{3\}' | tail -1)
    
    if [ "$http_code" = "200" ]; then
        # Parse JSON response to check auth details
        local auth_status=$(echo "$response" | sed 's/[0-9]\{3\}$//' | \
            grep -o '"authenticationStatus":"[^"]*"' | cut -d'"' -f4 2>/dev/null || echo "unknown")
        
        log "$provider authentication status: $auth_status"
        
        case "$auth_status" in
            "valid")
                log "✅ $provider: Authentication VALID"
                return 0
                ;;
            "expired")
                error_log "⚠️  $provider: Authentication EXPIRED"
                send_slack_alert "$provider" "authentication_expired" \
                    "Authentication tokens have expired for $provider"
                return 1
                ;;
            "invalid")
                error_log "❌ $provider: Authentication INVALID"
                send_slack_alert "$provider" "authentication_invalid" \
                    "Authentication is invalid for $provider"
                return 2
                ;;
            *)
                error_log "❓ $provider: Authentication status unknown"
                return 1
                ;;
        esac
    else
        error_log "$provider authentication check failed (HTTP $http_code)"
        return 2
    fi
}

# Check webhook health
check_webhook_health() {
    local provider=$1
    
    log "Checking webhook health for $provider"
    
    local response=$(curl -s -w "%{http_code}" \
        "$API_GATEWAY_URL/pos/health/$provider/webhooks" 2>/dev/null || echo "000")
    
    local http_code=$(echo "$response" | grep -o '[0-9]\{3\}' | tail -1)
    
    if [ "$http_code" = "200" ]; then
        # Parse webhook health from response
        local webhook_count=$(echo "$response" | sed 's/[0-9]\{3\}$//' | \
            grep -o '"webhooks":\[[^]]*\]' | grep -o '{}' | wc -l 2>/dev/null || echo "0")
        
        log "$provider has $webhook_count webhooks configured"
        return 0
    else
        error_log "$provider webhook health check failed (HTTP $http_code)"
        return 1
    fi
}

# Send Slack alert
send_slack_alert() {
    local provider=$1
    local alert_type=$2
    local message=$3
    
    if [ -n "$SLACK_WEBHOOK" ]; then
        local payload=$(cat <<EOF
{
    "text": "POS Health Alert",
    "attachments": [
        {
            "color": "warning",
            "fields": [
                {
                    "title": "Provider",
                    "value": "$provider",
                    "short": true
                },
                {
                    "title": "Alert Type",
                    "value": "$alert_type",
                    "short": true
                },
                {
                    "title": "Message",
                    "value": "$message",
                    "short": false
                },
                {
                    "title": "Time",
                    "value": "$(date -Iseconds)",
                    "short": true
                }
            ]
        }
    ]
}
EOF
)
        
        curl -s -X POST -H 'Content-type: application/json' \
            --data "$payload" "$SLACK_WEBHOOK" >/dev/null || \
            error_log "Failed to send Slack alert"
    fi
}

# Test connection with retry
test_connection_with_retry() {
    local provider=$1
    local max_retries=3
    local retry_delay=10
    
    for i in $(seq 1 $max_retries); do
        log "Testing $provider connection (attempt $i/$max_retries)"
        
        local response=$(curl -s -w "%{http_code}" -X POST \
            "$API_GATEWAY_URL/pos/health/$provider/test" \
            -H "Content-Type: application/json" \
            -d '{}' 2>/dev/null || echo "000")
        
        local http_code=$(echo "$response" | grep -o '[0-9]\{3\}' | tail -1)
        
        if [ "$http_code" = "200" ]; then
            log "✅ $provider connection test successful"
            return 0
        else
            error_log "❌ $provider connection test failed (HTTP $http_code)"
            if [ $i -lt $max_retries ]; then
                log "Retrying in $retry_delay seconds..."
                sleep $retry_delay
            fi
        fi
    done
    
    error_log "$provider connection test failed after $max_retries attempts"
    send_slack_alert "$provider" "connection_test_failed" \
        "Connection test failed for $provider after $max_retries attempts"
    return 1
}

# Generate health report
generate_health_report() {
    local report_file="/var/log/pos-health/health-report-$(date +%Y%m%d-%H%M%S).json"
    local timestamp=$(date -Iseconds)
    
    log "Generating health report: $report_file"
    
    cat > "$report_file" <<EOF
{
    "timestamp": "$timestamp",
    "health_checks": {
        "square": {
            "health_status": "$(check_provider_health square >/dev/null 2>&1 && echo "healthy" || echo "unhealthy")",
            "auth_status": "$(check_auth_status square >/dev/null 2>&1 && echo "valid" || echo "invalid")",
            "webhook_status": "$(check_webhook_health square >/dev/null 2>&1 && echo "healthy" || echo "unhealthy")"
        },
        "shopify": {
            "health_status": "$(check_provider_health shopify >/dev/null 2>&1 && echo "healthy" || echo "unhealthy")",
            "auth_status": "$(check_auth_status shopify >/dev/null 2>&1 && echo "valid" || echo "invalid")",
            "webhook_status": "$(check_webhook_health shopify >/dev/null 2>&1 && echo "healthy" || echo "unhealthy")"
        },
        "zettle": {
            "health_status": "$(check_provider_health zettle >/dev/null 2>&1 && echo "healthy" || echo "unhealthy")",
            "auth_status": "$(check_auth_status zettle >/dev/null 2>&1 && echo "valid" || echo "invalid")",
            "webhook_status": "$(check_webhook_health zettle >/dev/null 2>&1 && echo "healthy" || echo "unhealthy")"
        }
    }
}
EOF
    
    log "Health report generated: $report_file"
}

# Main execution
main() {
    log "Starting POS health check cycle"
    
    local providers=("square" "shopify" "zettle")
    local failed_providers=()
    
    # Check overall API gateway health first
    local gateway_health=$(curl -s -w "%{http_code}" "$API_GATEWAY_URL/health" 2>/dev/null || echo "000")
    local gateway_http_code=$(echo "$gateway_health" | grep -o '[0-9]\{3\}' | tail -1)
    
    if [ "$gateway_http_code" != "200" ]; then
        error_log "❌ API Gateway unhealthy (HTTP $gateway_http_code)"
        send_slack_alert "api-gateway" "gateway_unhealthy" \
            "API Gateway is not responding correctly"
        exit 1
    fi
    
    log "✅ API Gateway is healthy"
    
    # Check each provider
    for provider in "${providers[@]}"; do
        log "--- Checking $provider ---"
        
        # Basic health check
        if ! check_provider_health "$provider"; then
            failed_providers+=("$provider")
            continue
        fi
        
        # Authentication check
        if ! check_auth_status "$provider"; then
            # Auth failure is serious but not necessarily a complete failure
            log "⚠️  $provider has authentication issues but may still be partially functional"
        fi
        
        # Webhook health check
        if ! check_webhook_health "$provider"; then
            log "⚠️  $provider webhook health check failed"
        fi
        
        # Connection test with retry
        test_connection_with_retry "$provider"
        
        log "--- $provider check complete ---"
    done
    
    # Generate health report
    generate_health_report
    
    # Summary
    local total_providers=${#providers[@]}
    local failed_count=${#failed_providers[@]}
    local healthy_count=$((total_providers - failed_count))
    
    log "=== HEALTH CHECK SUMMARY ==="
    log "Total providers: $total_providers"
    log "Healthy providers: $healthy_count"
    log "Failed providers: $failed_count"
    
    if [ $failed_count -gt 0 ]; then
        error_log "Failed providers: ${failed_providers[*]}"
        
        # Send summary alert if multiple providers are down
        if [ $failed_count -ge 2 ]; then
            send_slack_alert "multiple" "multiple_providers_down" \
                "$failed_count POS providers are currently unhealthy: ${failed_providers[*]}"
        fi
        
        exit 1
    else
        log "✅ All POS providers are healthy"
        exit 0
    fi
}

# Run main function
main "$@"