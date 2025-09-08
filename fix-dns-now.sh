#!/bin/bash

echo "🔧 DNS Bypass Script for api.vocilia.com"
echo "========================================"
echo ""
echo "This script will add a temporary DNS bypass to /etc/hosts"
echo "You'll need to enter your Mac password when prompted."
echo ""

# Check if entry already exists
if grep -q "api.vocilia.com" /etc/hosts; then
    echo "⚠️  Entry already exists in /etc/hosts. Removing old entry first..."
    sudo sed -i '' '/api.vocilia.com/d' /etc/hosts
fi

# Add the new entry
echo "Adding: 66.33.22.229 api.vocilia.com"
echo "66.33.22.229 api.vocilia.com" | sudo tee -a /etc/hosts > /dev/null

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ SUCCESS! DNS bypass added."
    echo ""
    
    # Test the connection
    echo "Testing connection..."
    response=$(curl -s -o /dev/null -w "%{http_code}" https://api.vocilia.com/health)
    
    if [ "$response" = "200" ]; then
        echo "✅ API is now accessible!"
        echo ""
        echo "🎉 You can now access: https://business.vocilia.com"
        echo ""
        echo "Login credentials:"
        echo "  Email: newtest@business.com"
        echo "  Password: password123"
    else
        echo "⚠️  API returned status: $response"
    fi
    
    echo ""
    echo "📝 To remove this bypass later (when DNS updates), run:"
    echo "   sudo sed -i '' '/api.vocilia.com/d' /etc/hosts"
else
    echo "❌ Failed to add entry. Please check your password and try again."
fi