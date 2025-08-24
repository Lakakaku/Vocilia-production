#!/bin/bash

# Stripe Connect Test Environment Setup Script
# This script helps configure Stripe Connect for Swedish pilot program testing

set -e

echo "🔧 Setting up Stripe Connect Test Environment..."
echo "================================================"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if Stripe CLI is installed
if ! command -v stripe &> /dev/null; then
    echo -e "${YELLOW}⚠️  Stripe CLI not found. Installing...${NC}"
    
    # Install Stripe CLI based on OS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command -v brew &> /dev/null; then
            brew install stripe/stripe-cli/stripe
        else
            echo -e "${RED}❌ Homebrew not found. Please install Stripe CLI manually: https://stripe.com/docs/stripe-cli${NC}"
            exit 1
        fi
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        wget -O - https://packages.stripe.dev/api/security/keypair/stripe-cli-gpg/public | gpg --dearmor | sudo tee /usr/share/keyrings/stripe.gpg
        echo "deb [signed-by=/usr/share/keyrings/stripe.gpg] https://packages.stripe.dev/stripe-cli-debian-local stable main" | sudo tee -a /etc/apt/sources.list.d/stripe.list
        sudo apt update
        sudo apt install stripe
    else
        echo -e "${RED}❌ Unsupported OS. Please install Stripe CLI manually: https://stripe.com/docs/stripe-cli${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✅ Stripe CLI found${NC}"

# Login to Stripe (this will open browser for authentication)
echo -e "${BLUE}🔐 Logging into Stripe...${NC}"
echo "This will open your browser to authenticate with Stripe."
echo "Please make sure you're using your TEST account credentials."
read -p "Press Enter to continue..."

stripe login

# Verify login
echo -e "${BLUE}📋 Verifying Stripe account...${NC}"
ACCOUNT_INFO=$(stripe account get)
echo "Account info: $ACCOUNT_INFO"

# Create webhook endpoint for local development
echo -e "${BLUE}🪝 Setting up webhook endpoints for local development...${NC}"

# Get local API URL
LOCAL_API_URL="http://localhost:3001"
WEBHOOK_URL="${LOCAL_API_URL}/api/payments/webhooks/stripe"

echo "Creating webhook endpoint: $WEBHOOK_URL"

# Create webhook endpoint
WEBHOOK_ENDPOINT=$(stripe webhook_endpoints create \
    --url "$WEBHOOK_URL" \
    --enabled-events "account.updated,transfer.created,transfer.updated,payout.created,payout.updated" \
    --connect)

echo -e "${GREEN}✅ Webhook endpoint created:${NC}"
echo "$WEBHOOK_ENDPOINT"

# Extract webhook secret (this would be used in production)
echo -e "${YELLOW}📝 Note: In production, you'll need to add the webhook secret to your environment variables${NC}"

# Create test Express account for Swedish business
echo -e "${BLUE}🏢 Creating test Swedish business Express account...${NC}"

# Create a test Express account
TEST_ACCOUNT=$(stripe accounts create \
    --type="express" \
    --country="SE" \
    --email="test@cafeaurora.se" \
    --business_type="company" \
    --metadata[businessId]="test-business-id" \
    --metadata[environment]="test" \
    --metadata[market]="sweden")

echo -e "${GREEN}✅ Test Express account created:${NC}"
echo "$TEST_ACCOUNT"

# Extract account ID for environment variables
ACCOUNT_ID=$(echo "$TEST_ACCOUNT" | grep '"id"' | head -1 | sed 's/.*"id": "\([^"]*\)".*/\1/')
echo -e "${BLUE}Account ID: ${ACCOUNT_ID}${NC}"

# Create account link for onboarding
echo -e "${BLUE}🔗 Creating account onboarding link...${NC}"

ACCOUNT_LINK=$(stripe account_links create \
    --account="$ACCOUNT_ID" \
    --refresh_url="http://localhost:3000/onboarding/refresh" \
    --return_url="http://localhost:3000/onboarding/return" \
    --type="account_onboarding")

echo -e "${GREEN}✅ Onboarding link created:${NC}"
echo "$ACCOUNT_LINK"

# Extract onboarding URL
ONBOARDING_URL=$(echo "$ACCOUNT_LINK" | grep '"url"' | head -1 | sed 's/.*"url": "\([^"]*\)".*/\1/')
echo -e "${BLUE}🌐 Onboarding URL: ${ONBOARDING_URL}${NC}"

# Summary
echo ""
echo -e "${GREEN}🎉 Stripe Connect Test Setup Complete!${NC}"
echo "================================================"
echo ""
echo -e "${BLUE}📋 Summary:${NC}"
echo "• Stripe CLI installed and authenticated"
echo "• Webhook endpoint created for local development"
echo "• Test Swedish Express account created"
echo "• Account onboarding link generated"
echo ""
echo -e "${YELLOW}📝 Next Steps:${NC}"
echo "1. Update your .env file with the webhook secret"
echo "2. Start your API server: npm run dev:api"
echo "3. Start webhook forwarding: stripe listen --forward-to localhost:3001/api/payments/webhooks/stripe"
echo "4. Test the onboarding flow using the generated URL"
echo ""
echo -e "${BLUE}🧪 Test Commands:${NC}"
echo "• Test webhook: stripe trigger account.updated"
echo "• Test transfer: stripe trigger transfer.created"
echo "• View events: stripe events list"
echo ""
echo -e "${GREEN}✅ Ready for Swedish pilot program development!${NC}"

# Create a summary file
cat > stripe-test-setup.md << EOF
# Stripe Connect Test Setup Summary

## Account Details
- Test Account ID: $ACCOUNT_ID
- Onboarding URL: $ONBOARDING_URL

## Webhook Configuration
- Endpoint URL: $WEBHOOK_URL
- Events: account.updated, transfer.created, transfer.updated, payout.created, payout.updated

## Development Workflow
1. Start API: \`npm run dev:api\`
2. Start webhook forwarding: \`stripe listen --forward-to localhost:3001/api/payments/webhooks/stripe\`
3. Test endpoints using the created accounts

## Test Swedish Business Data
- Business Name: Test Café Aurora
- Email: test@cafeaurora.se  
- Org Number: 556123-4567 (TEST format)
- Address: Drottninggatan 123, Stockholm, 11151, SE

## Useful Commands
- \`stripe accounts list\` - List all test accounts
- \`stripe webhook_endpoints list\` - List webhook endpoints
- \`stripe events list\` - View recent events
- \`stripe trigger [event]\` - Trigger test events

Generated on: $(date)
EOF

echo -e "${GREEN}📄 Setup summary saved to: stripe-test-setup.md${NC}"