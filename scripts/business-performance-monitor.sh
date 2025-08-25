#!/bin/bash

# Business Dashboard Performance Monitor
# Comprehensive performance monitoring and optimization for business dashboard

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MONITORING_DIR="/opt/ai-feedback/monitoring"
BUSINESS_DASHBOARD_URL="${BUSINESS_DASHBOARD_URL:-http://business.ai-feedback.internal:3002}"
PROMETHEUS_URL="${PROMETHEUS_URL:-http://prometheus:9090}"
GRAFANA_URL="${GRAFANA_URL:-http://grafana:3000}"
PERFORMANCE_LOG="/var/log/monitoring/business-performance.log"

# Performance thresholds
RESPONSE_TIME_WARNING=2.0
RESPONSE_TIME_CRITICAL=5.0
ERROR_RATE_WARNING=0.05
ERROR_RATE_CRITICAL=0.15
CPU_USAGE_WARNING=0.8
MEMORY_USAGE_WARNING=1073741824  # 1GB in bytes

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] [PERF-MONITOR] [INFO]${NC} $1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [PERF-MONITOR] [INFO] $1" >> "$PERFORMANCE_LOG"
}

log_success() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] [PERF-MONITOR] [SUCCESS]${NC} $1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [PERF-MONITOR] [SUCCESS] $1" >> "$PERFORMANCE_LOG"
}

log_warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] [PERF-MONITOR] [WARNING]${NC} $1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [PERF-MONITOR] [WARNING] $1" >> "$PERFORMANCE_LOG"
}

log_error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] [PERF-MONITOR] [ERROR]${NC} $1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [PERF-MONITOR] [ERROR] $1" >> "$PERFORMANCE_LOG"
}

# Initialize monitoring
initialize_monitoring() {
    log_info "Initializing business dashboard performance monitoring..."
    
    mkdir -p /var/log/monitoring
    mkdir -p "$MONITORING_DIR/reports"
    
    # Check dependencies
    local required_tools=(curl jq docker)
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_error "$tool is required but not installed"
            exit 1
        fi
    done
    
    log_success "Performance monitoring initialized"
}

# Check service health
check_service_health() {
    log_info "Checking business dashboard service health..."
    
    # Check if business dashboard is running
    local health_status
    if health_status=$(curl -s -f "$BUSINESS_DASHBOARD_URL/api/health" | jq -r '.status' 2>/dev/null); then
        if [[ "$health_status" == "healthy" ]]; then
            log_success "Business dashboard is healthy"
            return 0
        else
            log_warning "Business dashboard health check returned: $health_status"
            return 1
        fi
    else
        log_error "Business dashboard health check failed"
        return 1
    fi
}

# Query Prometheus metrics
query_prometheus() {
    local query="$1"
    local result
    
    if result=$(curl -s -G "$PROMETHEUS_URL/api/v1/query" --data-urlencode "query=$query" | jq -r '.data.result[0].value[1]' 2>/dev/null); then
        echo "$result"
    else
        echo "0"
    fi
}

# Get performance metrics
get_performance_metrics() {
    log_info "Collecting business dashboard performance metrics..."
    
    # Response time metrics
    local response_time_50th=$(query_prometheus 'histogram_quantile(0.50, rate(http_request_duration_seconds_bucket{service="business-dashboard"}[5m]))')
    local response_time_95th=$(query_prometheus 'histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{service="business-dashboard"}[5m]))')
    local response_time_99th=$(query_prometheus 'histogram_quantile(0.99, rate(http_request_duration_seconds_bucket{service="business-dashboard"}[5m]))')
    
    # Error rate
    local error_rate=$(query_prometheus 'rate(http_requests_total{service="business-dashboard",status=~"5.."}[5m]) / rate(http_requests_total{service="business-dashboard"}[5m])')
    
    # Resource usage
    local cpu_usage=$(query_prometheus 'rate(process_cpu_seconds_total{service="business-dashboard"}[5m])')
    local memory_usage=$(query_prometheus 'process_resident_memory_bytes{service="business-dashboard"}')
    
    # Database performance
    local db_query_time=$(query_prometheus 'histogram_quantile(0.95, rate(database_query_duration_seconds_bucket{service="business-dashboard"}[5m]))')
    local db_connections=$(query_prometheus 'database_connections_active{service="business-dashboard"} / database_connections_max{service="business-dashboard"}')
    
    # Business-specific metrics
    local active_sessions=$(query_prometheus 'business_dashboard_active_sessions')
    local request_rate=$(query_prometheus 'rate(http_requests_total{service="business-dashboard"}[5m])')
    local cache_hit_rate=$(query_prometheus 'rate(cache_hits_total{service="business-dashboard"}[5m]) / (rate(cache_hits_total{service="business-dashboard"}[5m]) + rate(cache_misses_total{service="business-dashboard"}[5m]))')
    
    # Store metrics in associative array (simulate with variables)
    RESPONSE_TIME_50TH="$response_time_50th"
    RESPONSE_TIME_95TH="$response_time_95th"
    RESPONSE_TIME_99TH="$response_time_99th"
    ERROR_RATE="$error_rate"
    CPU_USAGE="$cpu_usage"
    MEMORY_USAGE="$memory_usage"
    DB_QUERY_TIME="$db_query_time"
    DB_CONNECTIONS="$db_connections"
    ACTIVE_SESSIONS="$active_sessions"
    REQUEST_RATE="$request_rate"
    CACHE_HIT_RATE="$cache_hit_rate"
    
    log_success "Performance metrics collected successfully"
}

# Analyze performance
analyze_performance() {
    log_info "Analyzing business dashboard performance..."
    
    local performance_issues=0
    local performance_warnings=0
    local recommendations=()
    
    # Response time analysis
    if (( $(echo "$RESPONSE_TIME_95TH > $RESPONSE_TIME_CRITICAL" | bc -l 2>/dev/null || echo "0") )); then
        log_error "Critical: 95th percentile response time is ${RESPONSE_TIME_95TH}s (threshold: ${RESPONSE_TIME_CRITICAL}s)"
        ((performance_issues++))
        recommendations+=("CRITICAL: Immediate response time optimization required - consider scaling up resources")
    elif (( $(echo "$RESPONSE_TIME_95TH > $RESPONSE_TIME_WARNING" | bc -l 2>/dev/null || echo "0") )); then
        log_warning "Warning: 95th percentile response time is ${RESPONSE_TIME_95TH}s (threshold: ${RESPONSE_TIME_WARNING}s)"
        ((performance_warnings++))
        recommendations+=("Consider optimizing slow queries and enabling caching")
    else
        log_success "Response time is within acceptable limits (${RESPONSE_TIME_95TH}s)"
    fi
    
    # Error rate analysis
    if (( $(echo "$ERROR_RATE > $ERROR_RATE_CRITICAL" | bc -l 2>/dev/null || echo "0") )); then
        log_error "Critical: Error rate is $(printf "%.2f" $(echo "$ERROR_RATE * 100" | bc -l))% (threshold: $(printf "%.0f" $(echo "$ERROR_RATE_CRITICAL * 100" | bc -l))%)"
        ((performance_issues++))
        recommendations+=("CRITICAL: High error rate detected - investigate application errors immediately")
    elif (( $(echo "$ERROR_RATE > $ERROR_RATE_WARNING" | bc -l 2>/dev/null || echo "0") )); then
        log_warning "Warning: Error rate is $(printf "%.2f" $(echo "$ERROR_RATE * 100" | bc -l))% (threshold: $(printf "%.0f" $(echo "$ERROR_RATE_WARNING * 100" | bc -l))%)"
        ((performance_warnings++))
        recommendations+=("Monitor error logs and implement better error handling")
    else
        log_success "Error rate is within acceptable limits ($(printf "%.2f" $(echo "$ERROR_RATE * 100" | bc -l))%)"
    fi
    
    # CPU usage analysis
    if (( $(echo "$CPU_USAGE > $CPU_USAGE_WARNING" | bc -l 2>/dev/null || echo "0") )); then
        log_warning "High CPU usage detected: $(printf "%.1f" $(echo "$CPU_USAGE * 100" | bc -l))%"
        ((performance_warnings++))
        recommendations+=("Consider horizontal scaling or CPU optimization")
    else
        log_success "CPU usage is normal ($(printf "%.1f" $(echo "$CPU_USAGE * 100" | bc -l))%)"
    fi
    
    # Memory usage analysis
    if (( $(echo "$MEMORY_USAGE > $MEMORY_USAGE_WARNING" | bc -l 2>/dev/null || echo "0") )); then
        log_warning "High memory usage detected: $(numfmt --to=iec "$MEMORY_USAGE")"
        ((performance_warnings++))
        recommendations+=("Monitor for memory leaks and consider increasing available memory")
    else
        log_success "Memory usage is normal ($(numfmt --to=iec "$MEMORY_USAGE"))"
    fi
    
    # Database performance analysis
    if (( $(echo "$DB_QUERY_TIME > 1.0" | bc -l 2>/dev/null || echo "0") )); then
        log_warning "Slow database queries detected: ${DB_QUERY_TIME}s average"
        ((performance_warnings++))
        recommendations+=("Optimize slow database queries and consider adding indexes")
    fi
    
    if (( $(echo "$DB_CONNECTIONS > 0.8" | bc -l 2>/dev/null || echo "0") )); then
        log_warning "High database connection pool usage: $(printf "%.1f" $(echo "$DB_CONNECTIONS * 100" | bc -l))%"
        ((performance_warnings++))
        recommendations+=("Consider increasing connection pool size or optimizing connection usage")
    fi
    
    # Cache performance analysis
    if (( $(echo "$CACHE_HIT_RATE < 0.8" | bc -l 2>/dev/null || echo "0") )); then
        log_warning "Low cache hit rate: $(printf "%.1f" $(echo "$CACHE_HIT_RATE * 100" | bc -l))%"
        ((performance_warnings++))
        recommendations+=("Review caching strategy and consider warming up cache")
    fi
    
    # Capacity analysis
    if (( $(echo "$ACTIVE_SESSIONS > 500" | bc -l 2>/dev/null || echo "0") )); then
        log_warning "High number of active sessions: $ACTIVE_SESSIONS"
        ((performance_warnings++))
        recommendations+=("Monitor capacity and prepare for potential scaling")
    fi
    
    # Store analysis results
    PERFORMANCE_ISSUES="$performance_issues"
    PERFORMANCE_WARNINGS="$performance_warnings"
    RECOMMENDATIONS=("${recommendations[@]}")
    
    log_info "Performance analysis completed: $performance_issues critical issues, $performance_warnings warnings"
}

# Generate performance report
generate_performance_report() {
    local timestamp=$(date '+%Y%m%d_%H%M%S')
    local report_file="$MONITORING_DIR/reports/business-performance-${timestamp}.txt"
    
    log_info "Generating performance report..."
    
    cat > "$report_file" << EOF
Business Dashboard Performance Report
===================================
Generated: $(date)
Dashboard URL: $BUSINESS_DASHBOARD_URL

Performance Metrics Summary:
---------------------------
Response Times:
  50th percentile: ${RESPONSE_TIME_50TH}s
  95th percentile: ${RESPONSE_TIME_95TH}s
  99th percentile: ${RESPONSE_TIME_99TH}s

Error Rate: $(printf "%.2f" $(echo "$ERROR_RATE * 100" | bc -l))%

Resource Usage:
  CPU Usage: $(printf "%.1f" $(echo "$CPU_USAGE * 100" | bc -l))%
  Memory Usage: $(numfmt --to=iec "$MEMORY_USAGE")

Database Performance:
  Query Time (95th): ${DB_QUERY_TIME}s
  Connection Pool Usage: $(printf "%.1f" $(echo "$DB_CONNECTIONS * 100" | bc -l))%

Business Metrics:
  Active Sessions: $ACTIVE_SESSIONS
  Request Rate: ${REQUEST_RATE} req/s
  Cache Hit Rate: $(printf "%.1f" $(echo "$CACHE_HIT_RATE * 100" | bc -l))%

Performance Analysis:
-------------------
Critical Issues: $PERFORMANCE_ISSUES
Warnings: $PERFORMANCE_WARNINGS

Recommendations:
EOF

    # Add recommendations to report
    if [[ ${#RECOMMENDATIONS[@]} -gt 0 ]]; then
        for recommendation in "${RECOMMENDATIONS[@]}"; do
            echo "- $recommendation" >> "$report_file"
        done
    else
        echo "- No performance issues detected - system is performing optimally" >> "$report_file"
    fi
    
    cat >> "$report_file" << EOF

Performance Thresholds:
---------------------
Response Time Warning: ${RESPONSE_TIME_WARNING}s
Response Time Critical: ${RESPONSE_TIME_CRITICAL}s
Error Rate Warning: $(printf "%.0f" $(echo "$ERROR_RATE_WARNING * 100" | bc -l))%
Error Rate Critical: $(printf "%.0f" $(echo "$ERROR_RATE_CRITICAL * 100" | bc -l))%
CPU Usage Warning: $(printf "%.0f" $(echo "$CPU_USAGE_WARNING * 100" | bc -l))%
Memory Usage Warning: $(numfmt --to=iec "$MEMORY_USAGE_WARNING")

Next Actions:
------------
1. Monitor trending metrics for the next 24 hours
2. Review application logs for any error patterns
3. Consider implementing recommended optimizations
4. Schedule next performance review

EOF

    log_success "Performance report generated: $report_file"
    echo "$report_file"
}

# Performance optimization suggestions
suggest_optimizations() {
    log_info "Generating performance optimization suggestions..."
    
    local optimization_script="$MONITORING_DIR/business-dashboard-optimizations.sh"
    
    cat > "$optimization_script" << 'EOF'
#!/bin/bash

# Business Dashboard Performance Optimizations
# Auto-generated optimization suggestions

set -euo pipefail

log_info() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [OPTIMIZE] $1"
}

# Database optimizations
optimize_database() {
    log_info "Applying database optimizations..."
    
    # Update connection pool settings
    docker service update business-dashboard \
        --env-add DB_POOL_SIZE=20 \
        --env-add DB_MAX_CONNECTIONS=50 \
        --env-add DB_CONNECTION_TIMEOUT=30000
    
    log_info "Database optimizations applied"
}

# Cache optimizations
optimize_caching() {
    log_info "Applying cache optimizations..."
    
    # Update cache settings
    docker service update business-dashboard \
        --env-add REDIS_TTL=3600 \
        --env-add CACHE_ENABLED=true \
        --env-add CACHE_SIZE=128MB
    
    log_info "Cache optimizations applied"
}

# Resource optimizations
optimize_resources() {
    log_info "Applying resource optimizations..."
    
    # Scale up if needed
    docker service scale business-dashboard=3
    
    # Update resource limits
    docker service update business-dashboard \
        --limit-cpu=1.5 \
        --limit-memory=2GB \
        --reserve-cpu=0.5 \
        --reserve-memory=1GB
    
    log_info "Resource optimizations applied"
}

# Run optimizations based on detected issues
main() {
    echo "Business Dashboard Performance Optimization Script"
    echo "================================================"
    echo "WARNING: This script will apply optimizations to the business dashboard."
    echo "Please review the changes before proceeding."
    echo ""
    read -p "Continue with optimizations? (y/N): " -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        optimize_database
        optimize_caching
        optimize_resources
        
        echo ""
        echo "Optimizations applied successfully!"
        echo "Monitor the system for 10-15 minutes to see performance improvements."
    else
        echo "Optimizations cancelled."
    fi
}

main "$@"
EOF

    chmod +x "$optimization_script"
    
    log_success "Optimization script generated: $optimization_script"
}

# Send alerts if needed
send_performance_alerts() {
    local webhook_url="${SLACK_WEBHOOK:-}"
    
    if [[ $PERFORMANCE_ISSUES -gt 0 || $PERFORMANCE_WARNINGS -gt 3 ]]; then
        local alert_color="danger"
        local alert_title="🚨 Business Dashboard Performance Alert"
        local alert_message="Critical: $PERFORMANCE_ISSUES issues, Warnings: $PERFORMANCE_WARNINGS"
        
        if [[ $PERFORMANCE_ISSUES -eq 0 ]]; then
            alert_color="warning"
            alert_title="⚠️ Business Dashboard Performance Warning"
            alert_message="$PERFORMANCE_WARNINGS performance warnings detected"
        fi
        
        if [[ -n "$webhook_url" ]]; then
            curl -X POST -H 'Content-type: application/json' \
                --data "{
                    \"attachments\": [{
                        \"color\": \"$alert_color\",
                        \"title\": \"$alert_title\",
                        \"text\": \"$alert_message\",
                        \"fields\": [
                            {
                                \"title\": \"95th Percentile Response Time\",
                                \"value\": \"${RESPONSE_TIME_95TH}s\",
                                \"short\": true
                            },
                            {
                                \"title\": \"Error Rate\",
                                \"value\": \"$(printf '%.2f' $(echo '$ERROR_RATE * 100' | bc -l))%\",
                                \"short\": true
                            },
                            {
                                \"title\": \"Active Sessions\",
                                \"value\": \"$ACTIVE_SESSIONS\",
                                \"short\": true
                            },
                            {
                                \"title\": \"CPU Usage\",
                                \"value\": \"$(printf '%.1f' $(echo '$CPU_USAGE * 100' | bc -l))%\",
                                \"short\": true
                            }
                        ],
                        \"ts\": $(date +%s)
                    }]
                }" \
                "$webhook_url" &> /dev/null || true
        fi
    fi
}

# Continuous monitoring loop
continuous_monitoring() {
    local interval="${1:-300}"  # Default 5 minutes
    
    log_info "Starting continuous performance monitoring (interval: ${interval}s)..."
    
    while true; do
        if check_service_health; then
            get_performance_metrics
            analyze_performance
            
            if [[ $PERFORMANCE_ISSUES -gt 0 || $PERFORMANCE_WARNINGS -gt 2 ]]; then
                local report_file=$(generate_performance_report)
                send_performance_alerts
                
                if [[ $PERFORMANCE_ISSUES -gt 0 ]]; then
                    suggest_optimizations
                fi
            fi
        else
            log_error "Service health check failed, skipping performance analysis"
        fi
        
        sleep "$interval"
    done
}

# Main function
main() {
    log_info "Starting business dashboard performance monitoring..."
    
    initialize_monitoring
    
    if ! check_service_health; then
        log_error "Business dashboard is not healthy, cannot proceed with monitoring"
        exit 1
    fi
    
    get_performance_metrics
    analyze_performance
    
    local report_file=$(generate_performance_report)
    
    if [[ $PERFORMANCE_ISSUES -gt 0 || $PERFORMANCE_WARNINGS -gt 0 ]]; then
        suggest_optimizations
        send_performance_alerts
    fi
    
    log_success "Performance monitoring completed successfully"
    log_info "Report generated: $report_file"
    
    return $(( PERFORMANCE_ISSUES > 0 ? 1 : 0 ))
}

# Script usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Business dashboard performance monitoring and optimization"
    echo ""
    echo "Options:"
    echo "  -c, --continuous INTERVAL   Run continuous monitoring (seconds, default: 300)"
    echo "  -r, --report-only           Generate report without optimizations"
    echo "  -o, --optimize              Generate optimization script only"
    echo "  -h, --help                  Show this help message"
    echo ""
    echo "Environment variables:"
    echo "  BUSINESS_DASHBOARD_URL      Business dashboard URL"
    echo "  PROMETHEUS_URL              Prometheus server URL"
    echo "  SLACK_WEBHOOK               Slack webhook for alerts"
    echo ""
    echo "Examples:"
    echo "  $0                          # One-time performance check"
    echo "  $0 -c 60                    # Continuous monitoring every minute"
    echo "  $0 -r                       # Report only, no optimizations"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -c|--continuous)
            continuous_monitoring "$2"
            exit $?
            ;;
        -r|--report-only)
            main
            exit $?
            ;;
        -o|--optimize)
            suggest_optimizations
            exit 0
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