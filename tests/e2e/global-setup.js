/**
 * Global setup for E2E testing
 * Prepares test environment, database, and Swedish test data
 */

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs').promises;

async function globalSetup() {
  console.log('🧪 Starting E2E test global setup...');
  
  try {
    // 1. Create test results directories
    await ensureTestDirectories();
    
    // 2. Setup Swedish test data
    await setupSwedishTestData();
    
    // 3. Verify services are running
    await verifyServices();
    
    // 4. Setup test authentication tokens
    await setupTestAuth();
    
    // 5. Create Swedish café QR codes for testing
    await createTestQRCodes();
    
    console.log('✅ E2E global setup completed successfully');
    
    // Store setup data for tests
    const setupData = {
      timestamp: new Date().toISOString(),
      environment: 'test',
      services: {
        web: 'http://localhost:3000',
        api: 'http://localhost:3001',
        business: 'http://localhost:3002'
      },
      swedishCafes: await getSwedishCafes()
    };
    
    await fs.writeFile(
      path.join(__dirname, 'fixtures/setup-data.json'),
      JSON.stringify(setupData, null, 2)
    );
    
  } catch (error) {
    console.error('❌ E2E global setup failed:', error);
    throw error;
  }
}

async function ensureTestDirectories() {
  const directories = [
    'test-results',
    'test-results/e2e-report',
    'test-results/e2e-artifacts',
    'test-results/screenshots',
    'test-results/videos',
    'tests/e2e/fixtures'
  ];
  
  for (const dir of directories) {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }
}

async function setupSwedishTestData() {
  console.log('🇸🇪 Setting up Swedish test data...');
  
  const swedishTestData = {
    cafes: [
      {
        id: 'aurora-stockholm',
        name: 'Café Aurora Stockholm',
        orgNumber: '5560101010',
        address: 'Sveavägen 45, Stockholm',
        postalCode: '11134',
        timezone: 'Europe/Stockholm'
      },
      {
        id: 'malmohuset',
        name: 'Malmö Huset Café',
        orgNumber: '5560202020',
        address: 'Södergatan 12, Malmö',
        postalCode: '21134',
        timezone: 'Europe/Stockholm'
      },
      {
        id: 'goteborg-kaffehus',
        name: 'Göteborg Kaffehus',
        orgNumber: '5560303030',
        address: 'Avenyn 25, Göteborg',
        postalCode: '41136',
        timezone: 'Europe/Stockholm'
      }
    ],
    customers: [
      {
        id: 'test-customer-1',
        deviceHash: 'test-device-hash-1',
        name: 'Anna Andersson'
      },
      {
        id: 'test-customer-2',
        deviceHash: 'test-device-hash-2', 
        name: 'Erik Johansson'
      }
    ],
    transactions: [
      {
        id: 'txn-001',
        amount: 65.50,
        items: ['kaffe latte', 'kanelbulle'],
        timestamp: new Date().toISOString()
      },
      {
        id: 'txn-002', 
        amount: 145.00,
        items: ['lunch sallad', 'mineralvatten', 'cookie'],
        timestamp: new Date().toISOString()
      }
    ]
  };
  
  await fs.writeFile(
    path.join(__dirname, 'fixtures/swedish-test-data.json'),
    JSON.stringify(swedishTestData, null, 2)
  );
}

async function verifyServices() {
  console.log('🔍 Verifying services are running...');
  
  const services = [
    { name: 'Customer PWA', url: 'http://localhost:3000' },
    { name: 'API Gateway', url: 'http://localhost:3001/health' },
    { name: 'Business Dashboard', url: 'http://localhost:3002' }
  ];
  
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  for (const service of services) {
    try {
      await page.goto(service.url, { timeout: 10000 });
      console.log(`✅ ${service.name} is running`);
    } catch (error) {
      console.error(`❌ ${service.name} is not accessible:`, error.message);
      throw new Error(`Service ${service.name} is not running`);
    }
  }
  
  await browser.close();
}

async function setupTestAuth() {
  console.log('🔐 Setting up test authentication...');
  
  const testTokens = {
    adminToken: 'test-admin-jwt-token',
    businessToken: 'test-business-jwt-token',
    customerSessionToken: 'test-customer-session-token'
  };
  
  await fs.writeFile(
    path.join(__dirname, 'fixtures/auth-tokens.json'),
    JSON.stringify(testTokens, null, 2)
  );
}

async function createTestQRCodes() {
  console.log('📱 Creating test QR codes...');
  
  const qrCodes = {
    'aurora-stockholm': {
      qrCodeId: 'qr-aurora-001',
      data: 'aurora.feedbackai.se?location=aurora-stockholm&session=test',
      url: 'http://localhost:3000/?qr=qr-aurora-001'
    },
    'malmohuset': {
      qrCodeId: 'qr-malmohuset-001',
      data: 'malmohuset.feedbackai.se?location=malmohuset&session=test',
      url: 'http://localhost:3000/?qr=qr-malmohuset-001'
    },
    'goteborg-kaffehus': {
      qrCodeId: 'qr-goteborg-001',
      data: 'goteborg.feedbackai.se?location=goteborg-kaffehus&session=test',
      url: 'http://localhost:3000/?qr=qr-goteborg-001'
    }
  };
  
  await fs.writeFile(
    path.join(__dirname, 'fixtures/qr-codes.json'),
    JSON.stringify(qrCodes, null, 2)
  );
}

async function getSwedishCafes() {
  try {
    const data = await fs.readFile(
      path.join(__dirname, 'fixtures/swedish-test-data.json'),
      'utf8'
    );
    return JSON.parse(data).cafes;
  } catch (error) {
    return [];
  }
}

module.exports = globalSetup;