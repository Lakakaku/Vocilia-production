#!/bin/bash

echo "🚂 Monitoring Railway deployment for Vocilia..."
echo "Press Ctrl+C to stop monitoring"
echo ""

# URLs to check
URLS=(
  "https://ai-feedback-api-gateway-production-352e.up.railway.app"
  "https://beautiful-forgiveness-production.up.railway.app"
  "https://vocilia-production.up.railway.app"
)

while true; do
  timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  echo "[$timestamp] Checking deployment status..."
  
  for url in "${URLS[@]}"; do
    response=$(curl -s -o /dev/null -w "%{http_code}" "$url/health" 2>/dev/null)
    
    if [ "$response" = "200" ]; then
      echo "🎉 SUCCESS! Deployment is live at: $url"
      echo "📊 Health check response:"
      curl -s "$url/health" | jq . 2>/dev/null || curl -s "$url/health"
      echo ""
      echo "🚀 Your Vocilia API is now ready for testing!"
      exit 0
    fi
  done
  
  echo "⏳ Still deploying... (will check again in 30 seconds)"
  sleep 30
done