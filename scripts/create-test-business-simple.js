#!/usr/bin/env node

/**
 * Create Test Business Account - Ultra Simple Version
 * Uses the existing database seed approach
 */

// Load environment variables from .env file manually
const fs = require('fs');
const path = require('path');

function loadEnvFile() {
  try {
    const envPath = path.join(__dirname, '..', '.env');
    const envContent = fs.readFileSync(envPath, 'utf8');
    
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').replace(/^["']|["']$/g, ''); // Remove quotes
          process.env[key] = value;
        }
      }
    });
  } catch (error) {
    console.log('⚠️ Could not load .env file:', error.message);
  }
}

// Load environment variables
loadEnvFile();

console.log('🚀 Creating test business account using existing database seed...');
console.log('━'.repeat(60));

// Just run the existing database seeding which creates test businesses
const { exec } = require('child_process');

function runCommand(command, description) {
  return new Promise((resolve, reject) => {
    console.log(`⏳ ${description}...`);
    
    exec(command, { cwd: path.resolve(__dirname, '..') }, (error, stdout, stderr) => {
      if (error) {
        console.error(`❌ Error: ${error.message}`);
        reject(error);
        return;
      }
      
      if (stderr && !stderr.includes('warning') && !stderr.includes('notice')) {
        console.error(`❌ Error: ${stderr}`);
        reject(new Error(stderr));
        return;
      }
      
      if (stdout) {
        console.log(stdout);
      }
      
      console.log(`✅ ${description} completed!`);
      resolve(stdout);
    });
  });
}

async function createTestBusinessAccount() {
  try {
    // Check environment variables first
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.log('❌ Missing Supabase environment variables!');
      console.log('');
      console.log('Required in your .env file:');
      console.log('  SUPABASE_URL=https://your-project.supabase.co');
      console.log('  SUPABASE_SERVICE_ROLE_KEY=your-service-role-key');
      console.log('');
      console.log('Please check your .env file and try again.');
      process.exit(1);
    }
    
    console.log('📋 Environment variables found ✅');
    console.log('🔗 Supabase URL:', process.env.SUPABASE_URL);
    console.log('');
    
    // Run the existing database seed which creates test businesses
    await runCommand('npm run db:seed', 'Seeding database with test businesses');
    
    console.log('');
    console.log('🎉 SUCCESS! Test business accounts created!');
    console.log('━'.repeat(60));
    console.log('');
    console.log('📊 WHAT WAS CREATED:');
    console.log('🏪 Business 1: Cafe Aurora (Stockholm)');
    console.log('   • Email: owner@cafearora.se');
    console.log('   • Org Number: 559012-3456');
    console.log('   • Locations: City Center, Waterfront');
    console.log('');
    console.log('🏪 Business 2: NordMart Grocery (Göteborg)');
    console.log('   • Email: it@nordmart.se'); 
    console.log('   • Org Number: 556123-7890');
    console.log('   • Locations: Main Store, Express');
    console.log('');
    console.log('🎯 HOW TO ACCESS YOUR TEST BUSINESSES:');
    console.log('1. 🎬 Unified Demo: http://localhost:3010');
    console.log('2. 🏪 Business Dashboard: http://localhost:3001');
    console.log('3. 👤 Customer PWA: http://localhost:3000');
    console.log('');
    console.log('🧪 TEST BUSINESS IDS:');
    console.log('• Cafe Aurora: 11111111-1111-1111-1111-111111111111');
    console.log('• NordMart: 22222222-2222-2222-2222-222222222222');
    console.log('');
    console.log('✨ Ready for testing and demos!');
    console.log('');
    
  } catch (error) {
    console.error('❌ Failed to create test business account:', error.message);
    console.log('');
    console.log('💡 Troubleshooting:');
    console.log('1. Check your .env file has correct Supabase credentials');
    console.log('2. Ensure your Supabase project is accessible');
    console.log('3. Make sure you have service role permissions');
    console.log('4. Try running: npm run db:seed directly');
    
    process.exit(1);
  }
}

// Run the script
createTestBusinessAccount();