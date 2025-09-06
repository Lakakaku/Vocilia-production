#!/bin/bash

# Security Audit Script for AI Feedback Platform
# Version: 1.0
# Date: 2024-12-26
# Description: Comprehensive security vulnerability scanning and audit

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REPORT_DIR="security-reports"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
REPORT_FILE="$REPORT_DIR/security_audit_$TIMESTAMP.md"

# Create report directory if it doesn't exist
mkdir -p "$REPORT_DIR"

# Initialize report
echo "# Security Audit Report" > "$REPORT_FILE"
echo "**Date:** $(date)" >> "$REPORT_FILE"
echo "**Platform:** AI Feedback Platform" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    case $status in
        "info")
            echo -e "${BLUE}[INFO]${NC} $message"
            ;;
        "success")
            echo -e "${GREEN}[SUCCESS]${NC} $message"
            ;;
        "warning")
            echo -e "${YELLOW}[WARNING]${NC} $message"
            ;;
        "error")
            echo -e "${RED}[ERROR]${NC} $message"
            ;;
    esac
}

# Function to add section to report
add_to_report() {
    echo "$1" >> "$REPORT_FILE"
}

print_status "info" "Starting Security Audit..."
add_to_report "## Security Vulnerability Scan Results"
add_to_report ""

# 1. NPM Security Audit
print_status "info" "Running npm security audit..."
add_to_report "### 1. NPM Dependencies Security Audit"
add_to_report "\`\`\`"
if npm audit --audit-level=moderate 2>&1 | tee -a "$REPORT_FILE"; then
    print_status "success" "NPM audit completed"
else
    print_status "warning" "NPM audit found vulnerabilities"
fi
add_to_report "\`\`\`"
add_to_report ""

# 2. Check for outdated dependencies
print_status "info" "Checking for outdated dependencies..."
add_to_report "### 2. Outdated Dependencies"
add_to_report "\`\`\`"
if npx npm-check-updates -u --target minor 2>&1 | tee -a "$REPORT_FILE"; then
    print_status "success" "Dependency check completed"
else
    print_status "warning" "Some dependencies need updating"
fi
add_to_report "\`\`\`"
add_to_report ""

# 3. Check for security headers in API
print_status "info" "Checking security headers configuration..."
add_to_report "### 3. Security Headers Analysis"
add_to_report ""

# Check if server is running
if curl -s -I http://localhost:3001/health > /dev/null 2>&1; then
    print_status "info" "Testing security headers on API..."
    add_to_report "#### API Security Headers:"
    add_to_report "\`\`\`"
    curl -s -I http://localhost:3001/health | grep -E "(X-Frame-Options|X-Content-Type-Options|X-XSS-Protection|Strict-Transport-Security|Content-Security-Policy)" | tee -a "$REPORT_FILE" || echo "No security headers found" >> "$REPORT_FILE"
    add_to_report "\`\`\`"
else
    print_status "warning" "API server not running - skipping header check"
    add_to_report "⚠️ API server not running - security headers not tested"
fi
add_to_report ""

# 4. Check for exposed secrets in code
print_status "info" "Scanning for exposed secrets..."
add_to_report "### 4. Secret Exposure Check"

# Check for common secret patterns
SECRET_PATTERNS=(
    "password.*=.*['\"].*['\"]"
    "api[_-]?key.*=.*['\"].*['\"]"
    "secret.*=.*['\"].*['\"]"
    "token.*=.*['\"].*['\"]"
    "private[_-]?key"
    "AWS_SECRET"
    "STRIPE_.*KEY"
)

EXPOSED_SECRETS=0
for pattern in "${SECRET_PATTERNS[@]}"; do
    if grep -r -i --include="*.js" --include="*.ts" --include="*.jsx" --include="*.tsx" --exclude-dir=node_modules --exclude-dir=.git "$pattern" . 2>/dev/null | grep -v ".env.example" | grep -v "process.env" | head -5; then
        EXPOSED_SECRETS=$((EXPOSED_SECRETS + 1))
        add_to_report "⚠️ Potential exposed secret pattern found: $pattern"
    fi
done

if [ $EXPOSED_SECRETS -eq 0 ]; then
    print_status "success" "No exposed secrets found"
    add_to_report "✅ No exposed secrets detected in codebase"
else
    print_status "warning" "Found $EXPOSED_SECRETS potential secret exposures"
    add_to_report "⚠️ Found $EXPOSED_SECRETS potential secret exposure patterns"
fi
add_to_report ""

# 5. Check SSL/TLS configuration
print_status "info" "Checking SSL/TLS configuration..."
add_to_report "### 5. SSL/TLS Configuration"

# Check if production domains are configured
if [ -f ".env.production" ]; then
    PROD_URL=$(grep "NEXT_PUBLIC_API_URL" .env.production | cut -d '=' -f2 | tr -d '"')
    if [ ! -z "$PROD_URL" ]; then
        print_status "info" "Testing SSL on $PROD_URL"
        add_to_report "Testing: $PROD_URL"
        add_to_report "\`\`\`"
        if command -v testssl &> /dev/null; then
            testssl --quiet --protocols --headers "$PROD_URL" 2>&1 | head -20 | tee -a "$REPORT_FILE"
        else
            echo "testssl not installed - basic SSL check:" >> "$REPORT_FILE"
            curl -s -I "$PROD_URL" | grep -E "(HTTP|SSL|TLS)" | tee -a "$REPORT_FILE" || echo "Could not reach production URL" >> "$REPORT_FILE"
        fi
        add_to_report "\`\`\`"
    else
        add_to_report "⚠️ No production URL configured"
    fi
else
    add_to_report "⚠️ Production configuration not found"
fi
add_to_report ""

# 6. Check for SQL injection vulnerabilities
print_status "info" "Checking for SQL injection patterns..."
add_to_report "### 6. SQL Injection Risk Analysis"

SQL_INJECTION_RISKS=0
# Check for raw SQL queries
if grep -r --include="*.js" --include="*.ts" --exclude-dir=node_modules "query\s*\(" . 2>/dev/null | grep -v "prisma" | grep -v ".test" | head -5; then
    SQL_INJECTION_RISKS=$((SQL_INJECTION_RISKS + 1))
    add_to_report "⚠️ Found potential raw SQL queries"
fi

# Check for string concatenation in queries
if grep -r --include="*.js" --include="*.ts" --exclude-dir=node_modules "query.*\+.*\+" . 2>/dev/null | head -5; then
    SQL_INJECTION_RISKS=$((SQL_INJECTION_RISKS + 1))
    add_to_report "⚠️ Found SQL query string concatenation"
fi

if [ $SQL_INJECTION_RISKS -eq 0 ]; then
    print_status "success" "No SQL injection risks detected"
    add_to_report "✅ No obvious SQL injection risks found (using Prisma ORM)"
else
    print_status "warning" "Found $SQL_INJECTION_RISKS potential SQL injection risks"
fi
add_to_report ""

# 7. Check XSS vulnerabilities
print_status "info" "Checking for XSS vulnerabilities..."
add_to_report "### 7. Cross-Site Scripting (XSS) Analysis"

XSS_RISKS=0
# Check for dangerouslySetInnerHTML usage
if grep -r --include="*.jsx" --include="*.tsx" "dangerouslySetInnerHTML" . 2>/dev/null | head -5; then
    XSS_RISKS=$((XSS_RISKS + 1))
    add_to_report "⚠️ Found dangerouslySetInnerHTML usage"
fi

# Check for eval() usage
if grep -r --include="*.js" --include="*.ts" "eval\s*\(" . 2>/dev/null | grep -v ".test" | head -5; then
    XSS_RISKS=$((XSS_RISKS + 1))
    add_to_report "⚠️ Found eval() usage"
fi

if [ $XSS_RISKS -eq 0 ]; then
    print_status "success" "No obvious XSS risks detected"
    add_to_report "✅ No obvious XSS vulnerabilities found"
else
    print_status "warning" "Found $XSS_RISKS potential XSS risks"
fi
add_to_report ""

# 8. Check authentication implementation
print_status "info" "Checking authentication implementation..."
add_to_report "### 8. Authentication & Authorization"

# Check for JWT implementation
if grep -r --include="*.ts" --include="*.js" "jsonwebtoken\|jwt" . 2>/dev/null | grep -v "node_modules" | wc -l > /dev/null; then
    JWT_COUNT=$(grep -r --include="*.ts" --include="*.js" "jsonwebtoken\|jwt" . 2>/dev/null | grep -v "node_modules" | wc -l)
    add_to_report "✅ JWT authentication implemented ($JWT_COUNT references found)"
else
    add_to_report "⚠️ No JWT implementation found"
fi

# Check for rate limiting
if grep -r --include="*.ts" --include="*.js" "express-rate-limit\|rate.*limit" . 2>/dev/null | grep -v "node_modules" | wc -l > /dev/null; then
    add_to_report "✅ Rate limiting implemented"
else
    add_to_report "⚠️ No rate limiting found"
fi
add_to_report ""

# 9. Check CORS configuration
print_status "info" "Checking CORS configuration..."
add_to_report "### 9. CORS Configuration"

if grep -r --include="*.ts" --include="*.js" "cors\(" . 2>/dev/null | grep -v "node_modules" | head -5 > /dev/null; then
    add_to_report "✅ CORS configuration found"
    add_to_report "\`\`\`"
    grep -r --include="*.ts" --include="*.js" "cors\(" . 2>/dev/null | grep -v "node_modules" | head -3 | tee -a "$REPORT_FILE"
    add_to_report "\`\`\`"
else
    add_to_report "⚠️ No CORS configuration found"
fi
add_to_report ""

# 10. Docker security check
print_status "info" "Checking Docker security..."
add_to_report "### 10. Docker Security"

if [ -f "docker-compose.yml" ]; then
    # Check for root user in containers
    if grep -q "user:" docker-compose*.yml 2>/dev/null; then
        add_to_report "✅ Non-root users configured in Docker"
    else
        add_to_report "⚠️ Docker containers may be running as root"
    fi
    
    # Check for exposed ports
    EXPOSED_PORTS=$(grep -E "^\s+- \"[0-9]+:[0-9]+\"" docker-compose*.yml 2>/dev/null | wc -l)
    add_to_report "ℹ️ Found $EXPOSED_PORTS exposed ports in Docker configuration"
else
    add_to_report "ℹ️ No Docker configuration found"
fi
add_to_report ""

# Summary
print_status "info" "Generating summary..."
add_to_report "## Summary"
add_to_report ""
add_to_report "### Critical Issues"

CRITICAL_ISSUES=0
if [ $EXPOSED_SECRETS -gt 0 ]; then
    add_to_report "- 🔴 $EXPOSED_SECRETS potential secret exposures found"
    CRITICAL_ISSUES=$((CRITICAL_ISSUES + 1))
fi

if [ $SQL_INJECTION_RISKS -gt 0 ]; then
    add_to_report "- 🔴 $SQL_INJECTION_RISKS SQL injection risks detected"
    CRITICAL_ISSUES=$((CRITICAL_ISSUES + 1))
fi

if [ $XSS_RISKS -gt 0 ]; then
    add_to_report "- 🟡 $XSS_RISKS XSS risks detected"
fi

if [ $CRITICAL_ISSUES -eq 0 ]; then
    add_to_report "✅ No critical security issues detected"
fi

add_to_report ""
add_to_report "### Recommendations"
add_to_report "1. Run \`npm audit fix\` to fix known vulnerabilities"
add_to_report "2. Implement security headers in all API responses"
add_to_report "3. Enable rate limiting on all API endpoints"
add_to_report "4. Configure CORS properly for production"
add_to_report "5. Use non-root users in Docker containers"
add_to_report "6. Implement comprehensive logging and monitoring"
add_to_report "7. Set up regular security scanning in CI/CD pipeline"
add_to_report ""
add_to_report "---"
add_to_report "*Report generated on $(date)*"

print_status "success" "Security audit complete!"
print_status "info" "Report saved to: $REPORT_FILE"

# Display summary
echo ""
echo "========================================="
echo "         SECURITY AUDIT SUMMARY          "
echo "========================================="
echo "Critical Issues Found: $CRITICAL_ISSUES"
echo "Report Location: $REPORT_FILE"
echo "========================================="

exit $CRITICAL_ISSUES