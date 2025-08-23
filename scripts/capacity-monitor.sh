#!/bin/bash

# Capacity Monitoring and Auto-Scaling for Swedish Pilot Program
# Monitors system resources and automatically scales services based on demand

set -e

echo "📊 AI Feedback Platform - Capacity Monitor"
echo "======================================="

# Configuration
ENVIRONMENT="${1:-staging}"
ACTION="${2:-monitor}"  # monitor, scale-up, scale-down, report
SERVICE="${3:-all}"     # api-gateway, voice, database, all

# Monitoring thresholds
CPU_SCALE_UP_THRESHOLD=80
CPU_SCALE_DOWN_THRESHOLD=30
MEMORY_SCALE_UP_THRESHOLD=85
MEMORY_SCALE_DOWN_THRESHOLD=50
DB_CONNECTION_THRESHOLD=80
RESPONSE_TIME_THRESHOLD=2000  # 2 seconds in milliseconds
QUEUE_DEPTH_THRESHOLD=10

# Scaling limits
MIN_INSTANCES=1
MAX_INSTANCES=5
SCALE_UP_COOLDOWN=300    # 5 minutes
SCALE_DOWN_COOLDOWN=1800 # 30 minutes

# Files for tracking scaling actions
SCALE_STATE_FILE="/tmp/scaling_state_${ENVIRONMENT}.json"
METRICS_LOG_FILE="/var/log/capacity_metrics_${ENVIRONMENT}.log"

# Create scaling state file if it doesn't exist
if [[ ! -f "$SCALE_STATE_FILE" ]]; then
    cat > "$SCALE_STATE_FILE" << EOF
{
  "api-gateway": {
    "instances": 1,
    "last_scale_time": 0,
    "last_scale_action": "none"
  },
  "voice-processing": {
    "instances": 1,
    "last_scale_time": 0,
    "last_scale_action": "none"
  },
  "business-dashboard": {
    "instances": 1,
    "last_scale_time": 0,
    "last_scale_action": "none"
  }
}
EOF
fi

# Function to log metrics
log_metrics() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] $1" >> "$METRICS_LOG_FILE"
}

# Function to get current resource usage
get_cpu_usage() {
    local service="$1"
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}" | \
    grep "$service" | awk '{print $2}' | sed 's/%//' | head -1
}

get_memory_usage() {
    local service="$1"
    docker stats --no-stream --format "table {{.Name}}\t{{.MemPerc}}" | \
    grep "$service" | awk '{print $2}' | sed 's/%//' | head -1
}

get_memory_usage_mb() {
    local service="$1"
    docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}" | \
    grep "$service" | awk '{print $2}' | sed 's/MiB.*//' | head -1
}

# Function to get API response times
get_api_response_time() {
    if command -v curl &> /dev/null; then
        local start_time=$(date +%s%3N)
        if curl -f -s "http://localhost:3001/health" > /dev/null 2>&1; then
            local end_time=$(date +%s%3N)
            echo $((end_time - start_time))
        else
            echo "9999"  # High value for failed requests
        fi
    else
        echo "0"
    fi
}

# Function to get database connection count
get_db_connections() {
    if command -v curl &> /dev/null; then
        curl -s "http://localhost:9090/api/v1/query?query=pg_stat_activity_count" 2>/dev/null | \
        jq -r '.data.result[0].value[1] // "0"' 2>/dev/null || echo "0"
    else
        echo "0"
    fi
}

# Function to get queue depth from Redis
get_queue_depth() {
    if docker-compose -f "docker-compose.${ENVIRONMENT}.yml" exec -T redis redis-cli LLEN feedback_processing_queue 2>/dev/null; then
        return 0
    else
        echo "0"
    fi
}

# Function to get current instance count
get_current_instances() {
    local service="$1"
    docker-compose -f "docker-compose.${ENVIRONMENT}.yml" ps "$service" 2>/dev/null | grep -c "Up" || echo "1"
}

# Function to check if scaling is allowed (cooldown period)
can_scale() {
    local service="$1"
    local action="$2"  # up or down
    local current_time=$(date +%s)
    
    local last_scale_time=$(jq -r ".\"$service\".last_scale_time" "$SCALE_STATE_FILE" 2>/dev/null || echo "0")
    local last_action=$(jq -r ".\"$service\".last_scale_action" "$SCALE_STATE_FILE" 2>/dev/null || echo "none")
    
    local cooldown=$SCALE_UP_COOLDOWN
    if [[ "$action" == "down" ]]; then
        cooldown=$SCALE_DOWN_COOLDOWN
    fi
    
    local time_since_last_scale=$((current_time - last_scale_time))
    
    if [[ $time_since_last_scale -gt $cooldown ]]; then
        return 0  # Can scale
    else
        local remaining_cooldown=$((cooldown - time_since_last_scale))
        echo "⏳ Scaling cooldown active for $service. ${remaining_cooldown}s remaining."
        return 1  # Cannot scale due to cooldown
    fi
}

# Function to update scaling state
update_scaling_state() {
    local service="$1"
    local instances="$2"
    local action="$3"
    local current_time=$(date +%s)
    
    # Update the scaling state file
    jq ".\"$service\".instances = $instances | .\"$service\".last_scale_time = $current_time | .\"$service\".last_scale_action = \"$action\"" \
       "$SCALE_STATE_FILE" > "${SCALE_STATE_FILE}.tmp" && mv "${SCALE_STATE_FILE}.tmp" "$SCALE_STATE_FILE"
}

# Function to scale service
scale_service() {
    local service="$1"
    local direction="$2"  # up or down
    local current_instances=$(get_current_instances "$service")
    local new_instances=$current_instances
    
    if [[ "$direction" == "up" ]]; then
        new_instances=$((current_instances + 1))
        if [[ $new_instances -gt $MAX_INSTANCES ]]; then
            new_instances=$MAX_INSTANCES
        fi
    elif [[ "$direction" == "down" ]]; then
        new_instances=$((current_instances - 1))
        if [[ $new_instances -lt $MIN_INSTANCES ]]; then
            new_instances=$MIN_INSTANCES
        fi
    fi
    
    if [[ $new_instances -ne $current_instances ]]; then
        echo "🔄 Scaling $service from $current_instances to $new_instances instances..."
        
        if docker-compose -f "docker-compose.${ENVIRONMENT}.yml" up -d --scale "$service=$new_instances" 2>/dev/null; then
            echo "   ✅ Successfully scaled $service to $new_instances instances"
            update_scaling_state "$service" "$new_instances" "$direction"
            log_metrics "SCALE_$direction: $service scaled from $current_instances to $new_instances instances"
            
            # Send notification if webhook is configured
            if [[ -n "$SCALE_NOTIFICATION_WEBHOOK" ]]; then
                curl -X POST "$SCALE_NOTIFICATION_WEBHOOK" \
                    -H "Content-Type: application/json" \
                    -d "{\"text\":\"🔄 Scaled $service $direction: $current_instances → $new_instances instances\"}" \
                    2>/dev/null || echo "   ⚠️  Failed to send scaling notification"
            fi
        else
            echo "   ❌ Failed to scale $service"
            log_metrics "SCALE_FAILED: Failed to scale $service $direction"
        fi
    else
        echo "   ℹ️  $service already at scaling limits ($current_instances instances)"
    fi
}

# Function to analyze and make scaling decisions
analyze_and_scale() {
    local service="$1"
    
    echo "📊 Analyzing $service performance..."
    
    # Get current metrics
    local cpu_usage=$(get_cpu_usage "$service")
    local memory_usage=$(get_memory_usage "$service")
    local memory_mb=$(get_memory_usage_mb "$service")
    local current_instances=$(get_current_instances "$service")
    
    echo "   Current state: $current_instances instances"
    echo "   CPU Usage: ${cpu_usage:-N/A}%"
    echo "   Memory Usage: ${memory_usage:-N/A}% (${memory_mb:-N/A}MB)"
    
    # Log current metrics
    log_metrics "METRICS: $service - CPU:${cpu_usage:-0}% Memory:${memory_usage:-0}% Instances:$current_instances"
    
    # Make scaling decisions
    local scale_needed="none"
    local scale_reason=""
    
    # Check for scale up conditions
    if [[ -n "$cpu_usage" && $(echo "$cpu_usage > $CPU_SCALE_UP_THRESHOLD" | bc -l 2>/dev/null || echo "0") -eq 1 ]]; then
        scale_needed="up"
        scale_reason="High CPU usage: ${cpu_usage}%"
    elif [[ -n "$memory_usage" && $(echo "$memory_usage > $MEMORY_SCALE_UP_THRESHOLD" | bc -l 2>/dev/null || echo "0") -eq 1 ]]; then
        scale_needed="up"
        scale_reason="High memory usage: ${memory_usage}%"
    fi
    
    # Check for scale down conditions (only if not already scaling up)
    if [[ "$scale_needed" == "none" ]]; then
        if [[ -n "$cpu_usage" && $(echo "$cpu_usage < $CPU_SCALE_DOWN_THRESHOLD" | bc -l 2>/dev/null || echo "0") -eq 1 ]] && \
           [[ -n "$memory_usage" && $(echo "$memory_usage < $MEMORY_SCALE_DOWN_THRESHOLD" | bc -l 2>/dev/null || echo "0") -eq 1 ]]; then
            scale_needed="down"
            scale_reason="Low resource usage: CPU:${cpu_usage}% Memory:${memory_usage}%"
        fi
    fi
    
    # Execute scaling decision
    if [[ "$scale_needed" != "none" ]]; then
        echo "   🎯 Scaling trigger: $scale_reason"
        
        if can_scale "$service" "$scale_needed"; then
            scale_service "$service" "$scale_needed"
        fi
    else
        echo "   ✅ $service performance within normal range"
    fi
}

# Function to check system-wide metrics
check_system_metrics() {
    echo "🔍 Checking system-wide metrics..."
    
    # API response time
    local api_response_time=$(get_api_response_time)
    echo "   API Response Time: ${api_response_time}ms"
    
    if [[ $api_response_time -gt $RESPONSE_TIME_THRESHOLD ]]; then
        echo "   ⚠️  API response time high (${api_response_time}ms > ${RESPONSE_TIME_THRESHOLD}ms)"
        log_metrics "ALERT: High API response time: ${api_response_time}ms"
        
        if can_scale "api-gateway" "up"; then
            scale_service "api-gateway" "up"
        fi
    fi
    
    # Database connections
    local db_connections=$(get_db_connections)
    echo "   Database Connections: $db_connections"
    
    if [[ $db_connections -gt $DB_CONNECTION_THRESHOLD ]]; then
        echo "   ⚠️  High database connection count: $db_connections"
        log_metrics "ALERT: High database connections: $db_connections"
    fi
    
    # Queue depth
    local queue_depth=$(get_queue_depth)
    echo "   Queue Depth: $queue_depth"
    
    if [[ $queue_depth -gt $QUEUE_DEPTH_THRESHOLD ]]; then
        echo "   ⚠️  High queue depth: $queue_depth"
        log_metrics "ALERT: High queue depth: $queue_depth"
        
        # Scale processing services
        if can_scale "api-gateway" "up"; then
            scale_service "api-gateway" "up"
        fi
    fi
}

# Function to generate capacity report
generate_capacity_report() {
    echo "📊 Generating Capacity Report for $ENVIRONMENT"
    echo "=============================================="
    
    local report_file="/tmp/capacity_report_${ENVIRONMENT}_$(date +%Y%m%d_%H%M%S).txt"
    
    {
        echo "AI Feedback Platform - Capacity Report"
        echo "Environment: $ENVIRONMENT"
        echo "Generated: $(date)"
        echo ""
        
        echo "=== Current Resource Usage ==="
        for service in api-gateway business-dashboard; do
            echo "Service: $service"
            echo "  Instances: $(get_current_instances "$service")"
            echo "  CPU: $(get_cpu_usage "$service")%"
            echo "  Memory: $(get_memory_usage "$service")% ($(get_memory_usage_mb "$service")MB)"
            echo ""
        done
        
        echo "=== System Metrics ==="
        echo "API Response Time: $(get_api_response_time)ms"
        echo "Database Connections: $(get_db_connections)"
        echo "Queue Depth: $(get_queue_depth)"
        echo ""
        
        echo "=== Scaling History (Last 24h) ==="
        if [[ -f "$METRICS_LOG_FILE" ]]; then
            grep "SCALE_" "$METRICS_LOG_FILE" | tail -20
        else
            echo "No scaling history available"
        fi
        
        echo ""
        echo "=== Scaling State ==="
        cat "$SCALE_STATE_FILE" 2>/dev/null || echo "No scaling state available"
        
        echo ""
        echo "=== Recommendations ==="
        
        # Analyze trends and provide recommendations
        local avg_cpu=$(get_cpu_usage "api-gateway")
        if [[ -n "$avg_cpu" && $(echo "$avg_cpu > 70" | bc -l 2>/dev/null || echo "0") -eq 1 ]]; then
            echo "- Consider increasing baseline capacity (current CPU: ${avg_cpu}%)"
        fi
        
        local db_conn=$(get_db_connections)
        if [[ $db_conn -gt 60 ]]; then
            echo "- Monitor database connection pool usage (current: $db_conn)"
        fi
        
        echo "- Review capacity trends weekly"
        echo "- Consider predictive scaling for peak hours"
        echo "- Monitor cost impact of scaling decisions"
        
    } > "$report_file"
    
    echo "📄 Capacity report generated: $report_file"
    
    # If email is configured, send the report
    if [[ -n "$CAPACITY_REPORT_EMAIL" ]]; then
        mail -s "Capacity Report - $ENVIRONMENT" "$CAPACITY_REPORT_EMAIL" < "$report_file" 2>/dev/null || \
        echo "   ⚠️  Failed to email capacity report"
    fi
    
    # Keep only last 7 days of reports
    find /tmp -name "capacity_report_${ENVIRONMENT}_*.txt" -mtime +7 -delete 2>/dev/null || true
}

# Function for predictive scaling based on time
predictive_scale() {
    local hour=$(date +%H)
    local day=$(date +%u)  # 1=Monday, 7=Sunday
    
    echo "🔮 Checking predictive scaling rules..."
    echo "   Current time: $(date '+%H:%M %A')"
    
    # Business hours scaling (Monday-Friday, 7 AM - 8 PM CET)
    if [[ $day -le 5 ]]; then  # Weekdays
        if [[ $hour -ge 7 && $hour -lt 20 ]]; then
            echo "   📈 Business hours detected - ensuring adequate capacity"
            
            # Ensure minimum 2 instances during business hours
            for service in api-gateway business-dashboard; do
                local current=$(get_current_instances "$service")
                if [[ $current -lt 2 ]]; then
                    echo "   🔄 Pre-scaling $service for business hours"
                    scale_service "$service" "up"
                fi
            done
        else
            echo "   📉 Off hours detected - optimizing for cost"
            # Scale down to minimum during off hours
            for service in api-gateway business-dashboard; do
                local current=$(get_current_instances "$service")
                if [[ $current -gt 1 ]] && can_scale "$service" "down"; then
                    echo "   🔄 Scaling down $service for off hours"
                    scale_service "$service" "down"
                fi
            done
        fi
    else
        echo "   📅 Weekend detected - reduced capacity mode"
        # Weekend scaling (minimal capacity)
        for service in api-gateway business-dashboard; do
            local current=$(get_current_instances "$service")
            if [[ $current -gt 1 ]] && can_scale "$service" "down"; then
                echo "   🔄 Weekend scale down for $service"
                scale_service "$service" "down"
            fi
        done
    fi
}

# Main execution based on action
case "$ACTION" in
    "monitor")
        echo "🔍 Starting capacity monitoring for $ENVIRONMENT environment..."
        
        # Check system-wide metrics first
        check_system_metrics
        
        echo ""
        
        # Analyze individual services
        if [[ "$SERVICE" == "all" ]]; then
            for svc in api-gateway business-dashboard; do
                analyze_and_scale "$svc"
                echo ""
            done
        else
            analyze_and_scale "$SERVICE"
        fi
        
        # Apply predictive scaling
        echo ""
        predictive_scale
        ;;
        
    "scale-up")
        echo "🔼 Manual scale up requested for $SERVICE..."
        if [[ "$SERVICE" == "all" ]]; then
            for svc in api-gateway business-dashboard; do
                if can_scale "$svc" "up"; then
                    scale_service "$svc" "up"
                fi
            done
        else
            if can_scale "$SERVICE" "up"; then
                scale_service "$SERVICE" "up"
            fi
        fi
        ;;
        
    "scale-down")
        echo "🔽 Manual scale down requested for $SERVICE..."
        if [[ "$SERVICE" == "all" ]]; then
            for svc in api-gateway business-dashboard; do
                if can_scale "$svc" "down"; then
                    scale_service "$svc" "down"
                fi
            done
        else
            if can_scale "$SERVICE" "down"; then
                scale_service "$SERVICE" "down"
            fi
        fi
        ;;
        
    "report")
        generate_capacity_report
        ;;
        
    *)
        echo "Usage: $0 {staging|production} {monitor|scale-up|scale-down|report} [service]"
        echo ""
        echo "Actions:"
        echo "  monitor    - Monitor resources and auto-scale based on thresholds"
        echo "  scale-up   - Manually scale up services"
        echo "  scale-down - Manually scale down services"
        echo "  report     - Generate detailed capacity report"
        echo ""
        echo "Services:"
        echo "  all                 - All services (default)"
        echo "  api-gateway         - API Gateway service"
        echo "  business-dashboard  - Business Dashboard service"
        echo ""
        echo "Environment variables:"
        echo "  SCALE_NOTIFICATION_WEBHOOK - Webhook for scaling notifications"
        echo "  CAPACITY_REPORT_EMAIL      - Email for capacity reports"
        exit 1
        ;;
esac

echo ""
echo "✅ Capacity monitoring completed for $ENVIRONMENT environment"
echo "📊 Metrics logged to: $METRICS_LOG_FILE"
echo "🔄 Scaling state: $SCALE_STATE_FILE"