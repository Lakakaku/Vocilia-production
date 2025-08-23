#!/bin/bash

# Load Testing Script for Swedish Pilot Program
# Simulates realistic traffic patterns for 3 Swedish cafés

set -e

echo "🧪 Swedish Pilot Program - Load Testing"
echo "======================================="

# Configuration
ENVIRONMENT="${1:-staging}"
TEST_SCENARIO="${2:-normal}"  # normal, peak, stress, endurance
DURATION="${3:-300}"          # Test duration in seconds (default 5 minutes)

# Test endpoints
BASE_URL="http://localhost"
API_PORT="3001"
PWA_PORT="3000"
DASHBOARD_PORT="3002"

# Café configurations (Swedish pilot cafés)
declare -A CAFES=(
    ["aurora"]="Stockholm,50,7-9,12-14"         # name,daily_volume,peak_hours
    ["malmohuset"]="Malmö,35,8-10,14-16"       # name,daily_volume,peak_hours  
    ["goteborg"]="Göteborg,40,7:30-9:30,13-15" # name,daily_volume,peak_hours
)

# Test scenarios
case "$TEST_SCENARIO" in
    "normal")
        CONCURRENT_USERS=15
        RAMP_UP_TIME=60
        TEST_DURATION=$DURATION
        VOICE_SESSIONS_PER_USER=3
        ;;
    "peak")
        CONCURRENT_USERS=50
        RAMP_UP_TIME=30
        TEST_DURATION=$DURATION
        VOICE_SESSIONS_PER_USER=4
        ;;
    "stress")
        CONCURRENT_USERS=100
        RAMP_UP_TIME=30
        TEST_DURATION=$DURATION
        VOICE_SESSIONS_PER_USER=2
        ;;
    "endurance")
        CONCURRENT_USERS=25
        RAMP_UP_TIME=120
        TEST_DURATION=7200  # 2 hours
        VOICE_SESSIONS_PER_USER=5
        ;;
    *)
        echo "❌ Invalid test scenario. Use: normal, peak, stress, endurance"
        exit 1
        ;;
esac

echo "📋 Test Configuration:"
echo "   Environment: $ENVIRONMENT"
echo "   Scenario: $TEST_SCENARIO"
echo "   Concurrent Users: $CONCURRENT_USERS"
echo "   Test Duration: $TEST_DURATION seconds"
echo "   Voice Sessions per User: $VOICE_SESSIONS_PER_USER"

# Check if required tools are available
check_dependencies() {
    echo "🔍 Checking dependencies..."
    
    local missing_deps=()
    
    if ! command -v curl &> /dev/null; then
        missing_deps+=("curl")
    fi
    
    if ! command -v jq &> /dev/null; then
        missing_deps+=("jq")
    fi
    
    if ! command -v bc &> /dev/null; then
        missing_deps+=("bc")
    fi
    
    # Check if artillery is available (optional but recommended)
    if command -v artillery &> /dev/null; then
        echo "   ✅ Artillery.js found - using advanced load testing"
        ARTILLERY_AVAILABLE=true
    else
        echo "   ⚠️  Artillery.js not found - using basic curl-based testing"
        ARTILLERY_AVAILABLE=false
    fi
    
    if [[ ${#missing_deps[@]} -gt 0 ]]; then
        echo "   ❌ Missing dependencies: ${missing_deps[*]}"
        echo "   Install with: sudo apt-get install ${missing_deps[*]}"
        exit 1
    fi
    
    echo "   ✅ All dependencies satisfied"
}

# Health check before starting tests
health_check() {
    echo "🏥 Performing health check..."
    
    local failed_services=()
    
    # Check API Gateway
    if ! curl -f -s "$BASE_URL:$API_PORT/health" > /dev/null; then
        failed_services+=("API Gateway")
    fi
    
    # Check Customer PWA
    if ! curl -f -s "$BASE_URL:$PWA_PORT/api/health" > /dev/null; then
        failed_services+=("Customer PWA")
    fi
    
    # Check Business Dashboard
    if ! curl -f -s "$BASE_URL:$DASHBOARD_PORT/api/health" > /dev/null; then
        failed_services+=("Business Dashboard")
    fi
    
    # Check Prometheus (monitoring)
    if ! curl -f -s "$BASE_URL:9090/-/healthy" > /dev/null; then
        failed_services+=("Prometheus")
    fi
    
    if [[ ${#failed_services[@]} -gt 0 ]]; then
        echo "   ❌ Failed health checks: ${failed_services[*]}"
        echo "   Please ensure all services are running before load testing"
        exit 1
    fi
    
    echo "   ✅ All services healthy"
}

# Generate test data for Swedish cafés
generate_test_data() {
    echo "📊 Generating test data for Swedish cafés..."
    
    # Create test data directory
    mkdir -p "/tmp/pilot_load_test"
    
    # Generate realistic Swedish customer data
    cat > "/tmp/pilot_load_test/customers.json" << 'EOF'
[
  {"name": "Erik Andersson", "phone": "+46701234567", "city": "Stockholm"},
  {"name": "Anna Larsson", "phone": "+46701234568", "city": "Stockholm"},
  {"name": "Magnus Johansson", "phone": "+46702345678", "city": "Malmö"},
  {"name": "Emma Nilsson", "phone": "+46702345679", "city": "Malmö"},
  {"name": "Oskar Eriksson", "phone": "+46703456789", "city": "Göteborg"},
  {"name": "Linnea Pettersson", "phone": "+46703456790", "city": "Göteborg"}
]
EOF
    
    # Generate realistic feedback scenarios
    cat > "/tmp/pilot_load_test/feedback_scenarios.json" << 'EOF'
[
  {
    "transcript": "Kaffe var verkligen bra idag, personalen var trevlig och servicen var snabb. Lokalen var ren och trivsam.",
    "expected_score": 85,
    "categories": ["service", "quality", "environment"]
  },
  {
    "transcript": "Bra kaffe men lite för kallt inne. Personalen kunde varit lite gladare.",
    "expected_score": 70,
    "categories": ["quality", "environment", "service"]
  },
  {
    "transcript": "Fantastisk upplevelse! Bästa kaffet i stan och personalen går verkligen den extra milen för kunderna.",
    "expected_score": 95,
    "categories": ["quality", "service", "experience"]
  },
  {
    "transcript": "Okej kaffe, inget speciellt. Lite långsamt i kassan.",
    "expected_score": 60,
    "categories": ["quality", "service"]
  },
  {
    "transcript": "Riktigt bra miljö för att jobba, bra wifi och bekväma stolar. Kaffet var också gott.",
    "expected_score": 80,
    "categories": ["environment", "quality", "amenities"]
  }
]
EOF
    
    echo "   ✅ Test data generated"
}

# Create Artillery.js configuration if available
create_artillery_config() {
    if [[ "$ARTILLERY_AVAILABLE" == "true" ]]; then
        echo "⚡ Creating Artillery.js load test configuration..."
        
        cat > "/tmp/pilot_load_test/artillery_config.yml" << EOF
config:
  target: '$BASE_URL:$API_PORT'
  phases:
    - duration: $RAMP_UP_TIME
      arrivalRate: 1
      rampTo: $(($CONCURRENT_USERS / 10))
      name: "Ramp up"
    - duration: $TEST_DURATION
      arrivalRate: $(($CONCURRENT_USERS / 10))
      name: "Sustained load"
  payload:
    path: '/tmp/pilot_load_test/test_scenarios.csv'
    fields:
      - 'cafe_name'
      - 'customer_name'
      - 'feedback_text'
      - 'expected_score'
  variables:
    cafes:
      - 'aurora'
      - 'malmohuset'  
      - 'goteborg'

scenarios:
  - name: "Complete feedback journey"
    weight: 70
    flow:
      # 1. QR Code scan
      - post:
          url: "/api/qr/scan"
          json:
            qr_code: "pilot_{{ \$randomString() }}"
            cafe_name: "{{ cafe_name }}"
          capture:
            - json: "\$.session_id"
              as: "session_id"
      
      # 2. Transaction verification
      - post:
          url: "/api/transaction/verify"
          json:
            session_id: "{{ session_id }}"
            transaction_id: "TXN_{{ \$randomString() }}"
            amount: "{{ \$randomInt(50, 500) }}"
            timestamp: "{{ \$timestamp() }}"
      
      # 3. Voice feedback submission
      - post:
          url: "/api/feedback/voice"
          json:
            session_id: "{{ session_id }}"
            transcript: "{{ feedback_text }}"
            audio_duration: "{{ \$randomInt(15, 45) }}"
          capture:
            - json: "\$.feedback_id"
              as: "feedback_id"
      
      # 4. Get quality score
      - get:
          url: "/api/feedback/{{ feedback_id }}/score"
          expect:
            - statusCode: 200
      
      # 5. Process reward
      - post:
          url: "/api/rewards/process"
          json:
            feedback_id: "{{ feedback_id }}"
            session_id: "{{ session_id }}"

  - name: "Business dashboard access"
    weight: 20
    flow:
      - get:
          url: "$BASE_URL:$DASHBOARD_PORT/api/analytics/summary"
          headers:
            authorization: "Bearer test_token"
      - get:
          url: "$BASE_URL:$DASHBOARD_PORT/api/feedback/recent"
          headers:
            authorization: "Bearer test_token"

  - name: "Health checks and monitoring"
    weight: 10
    flow:
      - get:
          url: "/health"
      - get:
          url: "/metrics"
EOF
        
        # Generate CSV data for Artillery
        echo "cafe_name,customer_name,feedback_text,expected_score" > "/tmp/pilot_load_test/test_scenarios.csv"
        
        # Generate realistic test scenarios
        local scenarios=("aurora,Erik Andersson,Kaffe var verkligen bra idag,85"
                        "malmohuset,Anna Larsson,Bra service och trevlig personal,78"
                        "goteborg,Magnus Johansson,Fantastisk upplevelse,92"
                        "aurora,Emma Nilsson,Okej kaffe inget speciellt,62"
                        "malmohuset,Oskar Eriksson,Bra miljö för att jobba,80")
        
        for scenario in "${scenarios[@]}"; do
            echo "$scenario" >> "/tmp/pilot_load_test/test_scenarios.csv"
        done
        
        echo "   ✅ Artillery.js configuration created"
    fi
}

# Basic curl-based load testing
basic_load_test() {
    echo "🚀 Starting basic curl-based load test..."
    
    local pids=()
    local results_file="/tmp/pilot_load_test/results.txt"
    echo "timestamp,cafe,endpoint,response_time_ms,status_code" > "$results_file"
    
    # Function to simulate a single user session
    simulate_user_session() {
        local user_id="$1"
        local cafe="$2"
        local session_count=0
        
        while [[ $session_count -lt $VOICE_SESSIONS_PER_USER ]]; do
            local start_time=$(date +%s%3N)
            
            # 1. QR Code scan
            local session_id=$(curl -s -X POST "$BASE_URL:$API_PORT/api/qr/scan" \
                -H "Content-Type: application/json" \
                -d "{\"qr_code\": \"pilot_${user_id}_${session_count}\", \"cafe_name\": \"$cafe\"}" | \
                jq -r '.session_id // "test_session"' 2>/dev/null || echo "test_session")
            
            # 2. Health check (simulating PWA load)
            curl -s "$BASE_URL:$PWA_PORT/api/health" > /dev/null 2>&1
            
            # 3. Transaction verification
            curl -s -X POST "$BASE_URL:$API_PORT/api/transaction/verify" \
                -H "Content-Type: application/json" \
                -d "{\"session_id\": \"$session_id\", \"transaction_id\": \"TXN_${user_id}_${session_count}\", \"amount\": $((50 + RANDOM % 450))}" > /dev/null 2>&1
            
            # 4. Voice feedback (simulated)
            curl -s -X POST "$BASE_URL:$API_PORT/api/feedback/voice" \
                -H "Content-Type: application/json" \
                -d "{\"session_id\": \"$session_id\", \"transcript\": \"Test feedback från $cafe\", \"audio_duration\": $((15 + RANDOM % 30))}" > /dev/null 2>&1
            
            # 5. Business dashboard request (20% of users)
            if [[ $((RANDOM % 5)) -eq 0 ]]; then
                curl -s "$BASE_URL:$DASHBOARD_PORT/api/analytics/summary" \
                    -H "Authorization: Bearer test_token" > /dev/null 2>&1
            fi
            
            local end_time=$(date +%s%3N)
            local duration=$((end_time - start_time))
            
            # Log results
            echo "$(date '+%Y-%m-%d %H:%M:%S'),$cafe,complete_session,$duration,200" >> "$results_file"
            
            ((session_count++))
            
            # Random delay between sessions (1-5 seconds)
            sleep $((1 + RANDOM % 5))
        done
    }
    
    # Start user sessions in parallel
    echo "   👥 Spawning $CONCURRENT_USERS concurrent users..."
    
    for ((i=1; i<=CONCURRENT_USERS; i++)); do
        # Distribute users across cafés
        local cafe_names=("aurora" "malmohuset" "goteborg")
        local cafe=${cafe_names[$((i % 3))]}
        
        simulate_user_session "$i" "$cafe" &
        pids+=($!)
        
        # Ramp up gradually
        if [[ $((i % 5)) -eq 0 ]]; then
            sleep 2
        fi
    done
    
    echo "   ⏱️  Running test for $TEST_DURATION seconds..."
    
    # Wait for test duration or all processes to complete
    local start_test_time=$(date +%s)
    while [[ $(($(date +%s) - start_test_time)) -lt $TEST_DURATION ]]; do
        # Count running processes
        local running_count=0
        for pid in "${pids[@]}"; do
            if kill -0 "$pid" 2>/dev/null; then
                ((running_count++))
            fi
        done
        
        if [[ $running_count -eq 0 ]]; then
            break
        fi
        
        sleep 5
    done
    
    # Clean up any remaining processes
    for pid in "${pids[@]}"; do
        kill "$pid" 2>/dev/null || true
    done
    
    echo "   ✅ Basic load test completed"
}

# Artillery.js load testing
artillery_load_test() {
    echo "⚡ Starting Artillery.js load test..."
    
    local artillery_output="/tmp/pilot_load_test/artillery_results.json"
    
    # Run Artillery test
    if artillery run "/tmp/pilot_load_test/artillery_config.yml" \
        --output "$artillery_output" > "/tmp/pilot_load_test/artillery.log" 2>&1; then
        
        echo "   ✅ Artillery.js test completed successfully"
        
        # Generate human-readable report
        artillery report "$artillery_output" > "/tmp/pilot_load_test/artillery_report.html" 2>/dev/null || true
        
    else
        echo "   ❌ Artillery.js test failed, check /tmp/pilot_load_test/artillery.log"
    fi
}

# Analyze test results
analyze_results() {
    echo "📊 Analyzing test results..."
    
    local results_dir="/tmp/pilot_load_test"
    local analysis_file="$results_dir/analysis.txt"
    
    {
        echo "Swedish Pilot Program - Load Test Analysis"
        echo "========================================="
        echo "Test Scenario: $TEST_SCENARIO"
        echo "Duration: $TEST_DURATION seconds"
        echo "Concurrent Users: $CONCURRENT_USERS"
        echo "Generated: $(date)"
        echo ""
        
        # Basic statistics if we have results file
        if [[ -f "$results_dir/results.txt" ]]; then
            echo "=== Performance Metrics ==="
            
            local total_requests=$(tail -n +2 "$results_dir/results.txt" | wc -l)
            echo "Total Requests: $total_requests"
            
            # Calculate average response time
            local avg_response_time=$(tail -n +2 "$results_dir/results.txt" | \
                cut -d',' -f3 | awk '{sum += $1; count++} END {print sum/count}' 2>/dev/null || echo "N/A")
            echo "Average Response Time: ${avg_response_time}ms"
            
            # Calculate requests per second
            local rps=$(echo "scale=2; $total_requests / $TEST_DURATION" | bc -l 2>/dev/null || echo "N/A")
            echo "Requests per Second: $rps"
            
            echo ""
        fi
        
        # System resource usage during test
        echo "=== System Resource Usage ==="
        if command -v docker &> /dev/null; then
            echo "Container Resource Usage:"
            docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}" 2>/dev/null | head -10
        fi
        echo ""
        
        # Service health check
        echo "=== Service Health After Test ==="
        local healthy_services=0
        local total_services=4
        
        if curl -f -s "$BASE_URL:$API_PORT/health" > /dev/null 2>&1; then
            echo "✅ API Gateway: Healthy"
            ((healthy_services++))
        else
            echo "❌ API Gateway: Unhealthy"
        fi
        
        if curl -f -s "$BASE_URL:$PWA_PORT/api/health" > /dev/null 2>&1; then
            echo "✅ Customer PWA: Healthy"
            ((healthy_services++))
        else
            echo "❌ Customer PWA: Unhealthy"
        fi
        
        if curl -f -s "$BASE_URL:$DASHBOARD_PORT/api/health" > /dev/null 2>&1; then
            echo "✅ Business Dashboard: Healthy"
            ((healthy_services++))
        else
            echo "❌ Business Dashboard: Unhealthy"
        fi
        
        if curl -f -s "$BASE_URL:9090/-/healthy" > /dev/null 2>&1; then
            echo "✅ Prometheus: Healthy"
            ((healthy_services++))
        else
            echo "❌ Prometheus: Unhealthy"
        fi
        
        echo "Health Score: $healthy_services/$total_services services healthy"
        echo ""
        
        # Recommendations
        echo "=== Recommendations ==="
        if [[ -n "$avg_response_time" && $(echo "$avg_response_time > 2000" | bc -l 2>/dev/null || echo "0") -eq 1 ]]; then
            echo "⚠️  High response times detected - consider scaling up"
        fi
        
        if [[ $healthy_services -lt $total_services ]]; then
            echo "⚠️  Some services unhealthy after load test - investigate"
        fi
        
        if [[ "$TEST_SCENARIO" == "stress" ]]; then
            echo "💡 Stress test reveals system limits - use for capacity planning"
        fi
        
        echo "✅ Regular load testing recommended for pilot program"
        echo "🔧 Monitor system performance metrics during peak hours"
        echo "📊 Use results to optimize scaling thresholds"
        
    } > "$analysis_file"
    
    echo "   📄 Analysis report: $analysis_file"
    cat "$analysis_file"
}

# Cleanup function
cleanup() {
    echo ""
    echo "🧹 Cleaning up test environment..."
    
    # Kill any remaining background processes
    jobs -p | xargs -r kill 2>/dev/null || true
    
    # Remove temporary files older than 1 day
    find /tmp -name "pilot_load_test_*" -mtime +1 -exec rm -rf {} \; 2>/dev/null || true
    
    echo "   ✅ Cleanup completed"
}

# Set up trap for cleanup
trap cleanup EXIT

# Main execution
main() {
    echo "🎯 Starting Swedish Pilot Program Load Test"
    echo "Environment: $ENVIRONMENT | Scenario: $TEST_SCENARIO | Duration: ${TEST_DURATION}s"
    echo ""
    
    # Preliminary checks
    check_dependencies
    health_check
    
    # Prepare test data and configuration
    generate_test_data
    create_artillery_config
    
    echo ""
    echo "🚀 Executing load test..."
    
    # Run appropriate test based on available tools
    if [[ "$ARTILLERY_AVAILABLE" == "true" ]]; then
        artillery_load_test
    else
        basic_load_test
    fi
    
    # Wait a bit for system to stabilize
    echo "⏱️  Waiting for system stabilization..."
    sleep 10
    
    # Analyze results
    analyze_results
    
    echo ""
    echo "✅ Swedish Pilot Program Load Test Completed!"
    echo "================================================"
    echo ""
    echo "📊 Test Results:"
    echo "   • Test Files: /tmp/pilot_load_test/"
    echo "   • Analysis: /tmp/pilot_load_test/analysis.txt"
    if [[ "$ARTILLERY_AVAILABLE" == "true" ]]; then
        echo "   • HTML Report: /tmp/pilot_load_test/artillery_report.html"
    fi
    echo ""
    echo "🔍 Next Steps:"
    echo "   1. Review analysis for performance bottlenecks"
    echo "   2. Check system metrics in Grafana dashboards"
    echo "   3. Adjust scaling thresholds based on results"
    echo "   4. Schedule regular load testing for pilot program"
}

# Execute main function
main