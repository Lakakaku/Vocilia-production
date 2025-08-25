#!/bin/bash

# Deploy Grafana Dashboards Script
# Deploys all monitoring dashboards to Grafana instance

set -euo pipefail

# Configuration
GRAFANA_URL="${GRAFANA_URL:-http://localhost:3000}"
GRAFANA_USER="${GRAFANA_USER:-admin}"
GRAFANA_PASSWORD="${GRAFANA_PASSWORD:-admin}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Grafana is accessible
check_grafana_connection() {
    log_info "Checking Grafana connection..."
    
    if curl -s -f -u "$GRAFANA_USER:$GRAFANA_PASSWORD" "$GRAFANA_URL/api/health" > /dev/null; then
        log_success "Grafana is accessible"
    else
        log_error "Cannot connect to Grafana at $GRAFANA_URL"
        exit 1
    fi
}

# Deploy a single dashboard
deploy_dashboard() {
    local dashboard_file="$1"
    local dashboard_name=$(basename "$dashboard_file" .json)
    
    log_info "Deploying dashboard: $dashboard_name"
    
    if [[ ! -f "$dashboard_file" ]]; then
        log_error "Dashboard file not found: $dashboard_file"
        return 1
    fi
    
    # Validate JSON
    if ! jq empty "$dashboard_file" 2>/dev/null; then
        log_error "Invalid JSON in dashboard file: $dashboard_file"
        return 1
    fi
    
    # Prepare dashboard for import
    local temp_file="/tmp/${dashboard_name}-import.json"
    jq '{dashboard: .dashboard, overwrite: true, inputs: []}' "$dashboard_file" > "$temp_file"
    
    # Import dashboard
    local response=$(curl -s -w "%{http_code}" -o /tmp/grafana-response.json \
        -u "$GRAFANA_USER:$GRAFANA_PASSWORD" \
        -H "Content-Type: application/json" \
        -X POST \
        "$GRAFANA_URL/api/dashboards/db" \
        -d @"$temp_file")
    
    local http_code="${response: -3}"
    
    if [[ "$http_code" == "200" ]]; then
        local dashboard_url=$(jq -r '.url' /tmp/grafana-response.json 2>/dev/null || echo "")
        log_success "Dashboard '$dashboard_name' deployed successfully"
        if [[ -n "$dashboard_url" ]]; then
            log_info "Dashboard URL: $GRAFANA_URL$dashboard_url"
        fi
    else
        log_error "Failed to deploy dashboard '$dashboard_name' (HTTP $http_code)"
        log_error "Response: $(cat /tmp/grafana-response.json)"
        return 1
    fi
    
    # Cleanup
    rm -f "$temp_file" /tmp/grafana-response.json
}

# Create datasources if they don't exist
setup_datasources() {
    log_info "Setting up datasources..."
    
    # Prometheus datasource
    local prometheus_config='{
        "name": "Prometheus",
        "type": "prometheus",
        "url": "http://prometheus:9090",
        "access": "proxy",
        "isDefault": true,
        "basicAuth": false,
        "jsonData": {
            "httpMethod": "GET",
            "timeInterval": "30s"
        }
    }'
    
    # Check if Prometheus datasource exists
    local existing_ds=$(curl -s -u "$GRAFANA_USER:$GRAFANA_PASSWORD" \
        "$GRAFANA_URL/api/datasources/name/Prometheus" 2>/dev/null || echo "")
    
    if [[ -z "$existing_ds" ]]; then
        log_info "Creating Prometheus datasource..."
        
        local response=$(curl -s -w "%{http_code}" -o /tmp/datasource-response.json \
            -u "$GRAFANA_USER:$GRAFANA_PASSWORD" \
            -H "Content-Type: application/json" \
            -X POST \
            "$GRAFANA_URL/api/datasources" \
            -d "$prometheus_config")
        
        local http_code="${response: -3}"
        
        if [[ "$http_code" == "200" ]]; then
            log_success "Prometheus datasource created"
        else
            log_warning "Failed to create Prometheus datasource (HTTP $http_code)"
        fi
    else
        log_info "Prometheus datasource already exists"
    fi
    
    rm -f /tmp/datasource-response.json
}

# Setup dashboard folders
setup_folders() {
    log_info "Setting up dashboard folders..."
    
    local folders=(
        "Business Analytics"
        "Infrastructure"
        "Location Services"
        "Security"
    )
    
    for folder in "${folders[@]}"; do
        local folder_config="{\"title\": \"$folder\"}"
        
        # Check if folder exists
        local existing_folder=$(curl -s -u "$GRAFANA_USER:$GRAFANA_PASSWORD" \
            "$GRAFANA_URL/api/folders" | jq -r ".[] | select(.title == \"$folder\") | .title" 2>/dev/null || echo "")
        
        if [[ -z "$existing_folder" ]]; then
            log_info "Creating folder: $folder"
            
            curl -s -u "$GRAFANA_USER:$GRAFANA_PASSWORD" \
                -H "Content-Type: application/json" \
                -X POST \
                "$GRAFANA_URL/api/folders" \
                -d "$folder_config" > /dev/null
                
            log_success "Folder '$folder' created"
        else
            log_info "Folder '$folder' already exists"
        fi
    done
}

# Main deployment function
main() {
    log_info "Starting Grafana dashboard deployment..."
    
    # Check dependencies
    for cmd in curl jq; do
        if ! command -v "$cmd" &> /dev/null; then
            log_error "$cmd is required but not installed"
            exit 1
        fi
    done
    
    # Check Grafana connection
    check_grafana_connection
    
    # Setup datasources and folders
    setup_datasources
    setup_folders
    
    # Deploy dashboards
    local dashboards=(
        "$SCRIPT_DIR/grafana-location-dashboard.json"
        "$SCRIPT_DIR/grafana-business-metrics-dashboard.json"
        "$SCRIPT_DIR/grafana-infrastructure-dashboard.json"
    )
    
    local success_count=0
    local total_count=${#dashboards[@]}
    
    for dashboard in "${dashboards[@]}"; do
        if deploy_dashboard "$dashboard"; then
            ((success_count++))
        fi
    done
    
    log_info "Deployment Summary:"
    log_info "Successfully deployed: $success_count/$total_count dashboards"
    
    if [[ $success_count -eq $total_count ]]; then
        log_success "All dashboards deployed successfully!"
        log_info "Grafana URL: $GRAFANA_URL"
        return 0
    else
        log_warning "Some dashboards failed to deploy"
        return 1
    fi
}

# Script usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Deploy Grafana dashboards for AI Feedback Platform"
    echo ""
    echo "Options:"
    echo "  -u, --url URL         Grafana URL (default: http://localhost:3000)"
    echo "  -U, --user USER       Grafana username (default: admin)"
    echo "  -P, --password PASS   Grafana password (default: admin)"
    echo "  -h, --help           Show this help message"
    echo ""
    echo "Environment variables:"
    echo "  GRAFANA_URL          Grafana URL"
    echo "  GRAFANA_USER         Grafana username"
    echo "  GRAFANA_PASSWORD     Grafana password"
    echo ""
    echo "Examples:"
    echo "  $0"
    echo "  $0 -u https://grafana.example.com -U admin -P secret"
    echo "  GRAFANA_URL=https://grafana.example.com $0"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -u|--url)
            GRAFANA_URL="$2"
            shift 2
            ;;
        -U|--user)
            GRAFANA_USER="$2"
            shift 2
            ;;
        -P|--password)
            GRAFANA_PASSWORD="$2"
            shift 2
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