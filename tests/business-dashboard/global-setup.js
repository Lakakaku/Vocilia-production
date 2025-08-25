/**
 * Global setup for Business Dashboard tests
 * Runs before all tests to prepare the environment
 */

const { execSync } = require('child_process');
const axios = require('axios');
const puppeteer = require('puppeteer');

module.exports = async () => {
  console.log('🚀 Setting up Business Dashboard test environment...');
  
  try {
    // Check if services are running
    await checkServices();
    
    // Pre-warm browsers
    await prewarmBrowsers();
    
    // Setup test data
    await setupTestData();
    
    console.log('✅ Test environment setup complete');
    
  } catch (error) {
    console.error('❌ Test environment setup failed:', error.message);
    throw error;
  }
};

async function checkServices() {
  console.log('📡 Checking required services...');
  
  const services = [
    {
      name: 'Business Dashboard',
      url: process.env.BUSINESS_DASHBOARD_URL || 'http://localhost:3002',
      timeout: 10000
    },
    {
      name: 'API Gateway',
      url: process.env.API_GATEWAY_URL || 'http://localhost:3001',
      timeout: 10000
    }
  ];
  
  for (const service of services) {
    try {
      console.log(`  Checking ${service.name}...`);
      
      const response = await axios.get(`${service.url}/health`, {
        timeout: service.timeout
      });
      
      if (response.status === 200) {
        console.log(`  ✅ ${service.name} is running`);
      } else {
        console.warn(`  ⚠️  ${service.name} returned status ${response.status}`);
      }
      
    } catch (error) {
      console.warn(`  ⚠️  ${service.name} not available: ${error.message}`);
      
      // Don't fail the tests if services aren't available - they may be mocked
      if (process.env.REQUIRE_SERVICES === 'true') {
        throw new Error(`Required service ${service.name} is not available`);
      }
    }
  }
}

async function prewarmBrowsers() {
  console.log('🌐 Pre-warming browsers...');
  
  const browsers = ['chrome'];
  
  // Add Firefox if available
  try {
    await puppeteer.launch({ product: 'firefox', headless: true });
    browsers.push('firefox');
  } catch (error) {
    console.log('  Firefox not available for testing');
  }
  
  for (const browser of browsers) {
    try {
      console.log(`  Pre-warming ${browser}...`);
      
      const browserInstance = await puppeteer.launch({
        product: browser === 'firefox' ? 'firefox' : 'chrome',
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      const page = await browserInstance.newPage();
      await page.goto('data:text/html,<html><body>Test</body></html>');
      await page.close();
      await browserInstance.close();
      
      console.log(`  ✅ ${browser} ready`);
      
    } catch (error) {
      console.warn(`  ⚠️  Failed to pre-warm ${browser}: ${error.message}`);
    }
  }
}

async function setupTestData() {
  console.log('📊 Setting up test data...');
  
  try {
    // Create test business data if API is available
    const apiUrl = process.env.API_GATEWAY_URL || 'http://localhost:3001';
    
    const testBusiness = {
      orgNumber: '556000000001',
      name: 'Test Suite Business',
      email: 'testsuite@example.com',
      type: 'cafe'
    };
    
    try {
      const response = await axios.post(`${apiUrl}/api/businesses/register`, testBusiness, {
        timeout: 5000
      });
      
      if (response.status === 201) {
        console.log('  ✅ Test business created');
        
        // Store test business ID for cleanup
        global.TEST_BUSINESS_ID = response.data.id;
        global.TEST_AUTH_TOKEN = response.data.token;
        
      }
    } catch (error) {
      console.log('  ⚠️  Could not create test business (API may not be available)');
    }
    
    // Setup mock data in memory
    global.MOCK_BUSINESS_DATA = {
      id: 'test-business-123',
      orgNumber: '556000000001', 
      name: 'Test Suite Business',
      email: 'testsuite@example.com',
      type: 'cafe',
      tier: 1,
      createdAt: new Date().toISOString()
    };
    
    global.MOCK_FEEDBACK_DATA = Array.from({ length: 50 }, (_, i) => ({
      id: `feedback-${i + 1}`,
      transcript: `Test feedback ${i + 1} - Detta är en test på svenska`,
      qualityScore: {
        total: Math.floor(Math.random() * 40) + 60, // 60-100
        authenticity: Math.floor(Math.random() * 40) + 60,
        concreteness: Math.floor(Math.random() * 40) + 60,
        depth: Math.floor(Math.random() * 40) + 60
      },
      categories: ['service', 'quality', 'staff'][Math.floor(Math.random() * 3)],
      sentiment: Math.random() * 2 - 1, // -1 to 1
      createdAt: new Date(Date.now() - i * 3600000).toISOString(), // Spread over hours
      purchaseAmount: Math.floor(Math.random() * 200) + 50 // 50-250 SEK
    }));
    
    console.log('  ✅ Mock test data prepared');
    
  } catch (error) {
    console.error('  ❌ Test data setup failed:', error.message);
    throw error;
  }
}

// Export cleanup function
global.TEST_CLEANUP = async () => {
  console.log('🧹 Cleaning up test data...');
  
  if (global.TEST_BUSINESS_ID && global.TEST_AUTH_TOKEN) {
    try {
      const apiUrl = process.env.API_GATEWAY_URL || 'http://localhost:3001';
      
      await axios.delete(`${apiUrl}/api/businesses/${global.TEST_BUSINESS_ID}`, {
        headers: { Authorization: `Bearer ${global.TEST_AUTH_TOKEN}` },
        timeout: 5000
      });
      
      console.log('  ✅ Test business cleaned up');
      
    } catch (error) {
      console.warn('  ⚠️  Could not cleanup test business:', error.message);
    }
  }
};