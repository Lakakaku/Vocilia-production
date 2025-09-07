#!/bin/bash

echo "🚂 Setting up Railway environment variables for Vocilia..."

# Core application settings
echo "Setting NODE_ENV=production..."
railway variables set NODE_ENV=production

echo "Setting PORT=3001..."  
railway variables set PORT=3001

# Basic app URLs (can be dummy values for now)
echo "Setting NEXT_PUBLIC_APP_URL..."
railway variables set NEXT_PUBLIC_APP_URL=https://vocilia.com

echo "Setting NEXT_PUBLIC_BUSINESS_DASHBOARD_URL..."
railway variables set NEXT_PUBLIC_BUSINESS_DASHBOARD_URL=https://vocilia.com/business

echo "Setting NEXT_PUBLIC_ADMIN_DASHBOARD_URL..." 
railway variables set NEXT_PUBLIC_ADMIN_DASHBOARD_URL=https://vocilia.com/admin

# Dummy database URL (service should handle gracefully)
echo "Setting DATABASE_URL (dummy for health check)..."
railway variables set DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy

# Supabase dummy values
echo "Setting SUPABASE_URL (dummy)..."
railway variables set SUPABASE_URL=https://dummy.supabase.co

echo "Setting SUPABASE_ANON_KEY (dummy)..."
railway variables set SUPABASE_ANON_KEY=dummy_key

echo "Setting SUPABASE_SERVICE_KEY (dummy)..."  
railway variables set SUPABASE_SERVICE_KEY=dummy_key

# JWT secret for auth
echo "Setting JWT_SECRET..."
railway variables set JWT_SECRET=railway_jwt_secret_key_for_development

echo ""
echo "✅ Railway environment variables configured!"
echo "🚀 Use 'railway redeploy' to apply changes"
