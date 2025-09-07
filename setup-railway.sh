#!/bin/bash

echo "🚀 Setting up Railway project for Vocilia..."
echo "⚠️  Note: Some steps require manual interaction"
echo ""

# Step 1: Create project (requires interaction)
echo "📋 Step 1: Creating Railway project..."
echo "Run this command and follow prompts:"
echo "  railway init"
echo "  - Select workspace: lakakaku's Projects"
echo "  - Project name: vocilia-production"
echo "  - Template: Empty Project"
echo ""

# Step 2: Add service from GitHub
echo "📋 Step 2: After project created, add GitHub service:"
echo "Run: railway add"
echo "  - Select: GitHub Repo"
echo "  - Repository: Lakakaku/Vocilia-production"
echo "  - Root directory: apps/api-gateway"
echo ""

# Step 3: Set environment variables
echo "📋 Step 3: Set environment variables:"
echo "Copy from .env.railway.template to Railway dashboard"
echo ""

# Step 4: Deploy
echo "📋 Step 4: Deploy:"
echo "Run: railway up"
echo ""

# What I can do automatically:
echo "✅ What's already configured:"
echo "  - GitHub repository: https://github.com/Lakakaku/Vocilia-production"
echo "  - railway.toml: ✅ Ready"
echo "  - Dockerfile: ✅ Ready"
echo "  - Environment template: ✅ .env.railway.template"
echo ""

echo "🎯 Alternative: I can help you set this up via Railway dashboard instead"
echo "   This is actually faster and more reliable!"

# Check if already linked
if [ -f ".railway/config.json" ]; then
    echo "🔗 Railway project already linked"
    railway status
else
    echo "🔗 No Railway project linked yet"
fi