#!/bin/bash

# Script to set Vercel environment variables for customer-pwa
# Run this script to configure all necessary environment variables

echo "Setting Vercel environment variables for customer-pwa..."

# Supabase Configuration
vercel env add NEXT_PUBLIC_SUPABASE_URL production <<< "https://wfbcotskyvuelhbtcgyi.supabase.co"
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production <<< "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndmYmNvdHNreXZ1ZWxoYnRjZ3lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2MjQ5MTgsImV4cCI6MjA3MTIwMDkxOH0.eYiziomWYH-xtd_wYeOxp0yNQ8QQ2-wYI0uXimIc61M"
vercel env add SUPABASE_SERVICE_ROLE_KEY production <<< "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndmYmNvdHNreXZ1ZWxoYnRjZ3lpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNjM0ODU2MiwiZXhwIjoyMDUxOTI0NTYyfQ.QXo1gKa0x_JkZKwjTDENE8nW-pfxd7vvL5WUcVgPEPE"

echo "Environment variables set successfully!"
echo "Now run: vercel --prod --cwd apps/customer-pwa"