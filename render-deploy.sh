#!/bin/bash

# Render.com deployment script for Vocilia
echo "🚀 Deploying Vocilia to Render.com..."

echo "📝 Steps to deploy on Render.com:"
echo ""
echo "1. Go to https://render.com and sign up/login with GitHub"
echo "2. Click 'New +' → 'Web Service'"
echo "3. Connect GitHub and select: Lakakaku/Vocilia-production"
echo "4. Configure service:"
echo "   - Name: vocilia-api"
echo "   - Root Directory: apps/api-gateway"
echo "   - Environment: Docker"
echo "   - Build Command: (leave empty - uses Dockerfile)"
echo "   - Start Command: (leave empty - uses Dockerfile)"
echo ""
echo "5. Environment Variables to add:"
echo "   NODE_ENV=production"
echo "   PORT=3001"
echo "   # Add your Supabase and OpenAI keys"
echo ""
echo "6. Click 'Create Web Service'"
echo ""
echo "💰 Cost: FREE (sleeps after 15 min inactivity)"
echo "🔄 Alternative: Upgrade Railway to $5/month for always-on service"

# Check if render.yaml exists
if [ -f "render.yaml" ]; then
    echo "✅ render.yaml configuration found"
else
    echo "❌ render.yaml not found"
fi

# Check if Dockerfile exists
if [ -f "apps/api-gateway/Dockerfile" ]; then
    echo "✅ Dockerfile found in apps/api-gateway"
else
    echo "❌ Dockerfile not found in apps/api-gateway"
fi

echo ""
echo "🌐 After deployment, your API will be at:"
echo "https://vocilia-api.onrender.com"