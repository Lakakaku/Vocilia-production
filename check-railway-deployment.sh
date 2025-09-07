#!/bin/bash

echo "🚂 Checking Railway deployment status for Vocilia..."
echo "Commit: $(git rev-parse --short HEAD) - $(git log -1 --format='%s')"
echo ""

# Try known Railway URLs
URLS=(
  "https://ai-feedback-api-gateway-production-352e.up.railway.app"
  "https://beautiful-forgiveness-production.up.railway.app" 
  "https://vocilia-production.up.railway.app"
)

for url in "${URLS[@]}"; do
  echo "🔍 Checking: $url"
  
  # Check if the service responds
  response=$(curl -s -o /dev/null -w "%{http_code}" "$url/health" 2>/dev/null)
  
  if [ "$response" = "200" ]; then
    echo "✅ SUCCESS: $url/health responded with 200"
    echo "🌐 Your Railway deployment is live at: $url"
    
    # Get health check details
    echo "📊 Health check response:"
    curl -s "$url/health" | jq . 2>/dev/null || curl -s "$url/health"
    exit 0
  elif [ "$response" = "000" ]; then
    echo "❌ UNREACHABLE: No response from $url (still building or URL changed)"
  else
    echo "⚠️  HTTP $response: $url (may be building or have errors)"
  fi
  echo ""
done

echo "💡 Deployment may still be in progress. Railway builds can take 3-5 minutes."
echo "💡 Check your Railway dashboard: https://railway.app/dashboard"
echo "💡 Expected project: beautiful-forgiveness or vocilia-production"