#!/bin/bash

# DNS Cache Tracker for api.vocilia.com
# This script monitors DNS resolution and shows when your cache updates

echo "🔍 DNS Cache Tracker for api.vocilia.com"
echo "========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Expected IP for Railway
EXPECTED_IP="66.33.22.229"
OLD_VERCEL_IP1="64.29.17.65"
OLD_VERCEL_IP2="64.29.17.1"

# Function to check DNS
check_dns() {
    local dns_server=$1
    local dns_name=$2
    local result=$(dig @$dns_server api.vocilia.com +short 2>/dev/null | tail -1)
    
    if [[ "$result" == "$EXPECTED_IP" ]]; then
        echo -e "${GREEN}✅ $dns_name: $result (CORRECT)${NC}"
        return 0
    elif [[ "$result" == "$OLD_VERCEL_IP1" ]] || [[ "$result" == "$OLD_VERCEL_IP2" ]]; then
        echo -e "${RED}❌ $dns_name: $result (OLD CACHE - Vercel)${NC}"
        return 1
    elif [[ -z "$result" ]]; then
        echo -e "${YELLOW}⚠️  $dns_name: No response${NC}"
        return 2
    else
        echo -e "${YELLOW}🔄 $dns_name: $result (Resolving...)${NC}"
        return 3
    fi
}

# Function to test API
test_api() {
    local response=$(curl -s -o /dev/null -w "%{http_code}" https://api.vocilia.com/health 2>/dev/null)
    if [[ "$response" == "200" ]]; then
        echo -e "${GREEN}✅ API Test: Working (HTTP $response)${NC}"
        return 0
    else
        echo -e "${RED}❌ API Test: Not working (HTTP $response)${NC}"
        return 1
    fi
}

# Main tracking loop
echo "Starting DNS cache tracking..."
echo "Press Ctrl+C to stop"
echo ""

iteration=0
while true; do
    clear
    echo "🔍 DNS Cache Tracker - $(date '+%H:%M:%S')"
    echo "========================================="
    echo ""
    
    # Check various DNS servers
    echo "DNS Resolution Status:"
    echo "----------------------"
    
    # Local system DNS
    check_dns "" "Local DNS Cache"
    local_status=$?
    
    # Router/ISP DNS (using system resolver)
    check_dns "192.168.50.1" "Router DNS"
    
    # Public DNS servers
    check_dns "8.8.8.8" "Google DNS"
    check_dns "1.1.1.1" "Cloudflare DNS"
    
    echo ""
    echo "API Connectivity:"
    echo "-----------------"
    test_api
    api_status=$?
    
    echo ""
    echo "Expected: api.vocilia.com → $EXPECTED_IP (Railway)"
    echo ""
    
    # Check if local DNS is updated
    if [[ $local_status -eq 0 ]]; then
        echo "========================================="
        echo -e "${GREEN}🎉 SUCCESS! Your local DNS cache is updated!${NC}"
        echo -e "${GREEN}You can now access https://business.vocilia.com${NC}"
        echo "========================================="
        
        # Show celebration and exit
        sleep 2
        echo ""
        echo "Testing login page..."
        curl -I https://business.vocilia.com/login 2>/dev/null | head -3
        echo ""
        echo "✅ DNS tracking complete. Everything is working!"
        exit 0
    else
        echo "⏳ Waiting for local DNS cache to expire..."
        echo "   This usually takes 5-30 minutes"
        echo "   Check #$((++iteration)) - Next check in 10 seconds..."
    fi
    
    sleep 10
done