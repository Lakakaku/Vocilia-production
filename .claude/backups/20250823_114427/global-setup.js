/**
 * Global setup for iOS Safari testing
 */

const { chromium } = require('@playwright/test');

async function globalSetup() {
  console.log('🔧 Setting up iOS Safari testing environment...');

  // Create a browser instance to verify server connectivity
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Verify main PWA is accessible
    console.log('📱 Verifying PWA accessibility...');
    await page.goto('http://localhost:3000', { timeout: 30000 });
    await page.waitForSelector('body', { timeout: 10000 });
    console.log('✅ PWA is accessible');

    // Verify API server is running
    console.log('🔌 Verifying API server...');
    const apiResponse = await page.request.get('http://localhost:3001/health');
    if (apiResponse.ok()) {
      console.log('✅ API server is running');
    } else {
      throw new Error('API server health check failed');
    }

    // Pre-warm WebSocket connection
    console.log('🔗 Testing WebSocket connectivity...');
    const wsTest = await page.evaluate(() => {
      return new Promise((resolve) => {
        try {
          const ws = new WebSocket('ws://localhost:3001');
          ws.onopen = () => {
            ws.close();
            resolve(true);
          };
          ws.onerror = () => resolve(false);
          setTimeout(() => resolve(false), 5000);
        } catch {
          resolve(false);
        }
      });
    });

    if (wsTest) {
      console.log('✅ WebSocket connection available');
    } else {
      console.log('⚠️ WebSocket connection failed - tests will run with fallback');
    }

    // Create test data directory
    const fs = require('fs');
    const path = require('path');
    const testDataDir = path.join(__dirname, '../../test-results/ios-safari');
    if (!fs.existsSync(testDataDir)) {
      fs.mkdirSync(testDataDir, { recursive: true });
    }

    // Store environment info for tests
    const envInfo = {
      timestamp: new Date().toISOString(),
      pwaUrl: 'http://localhost:3000',
      apiUrl: 'http://localhost:3001',
      wsUrl: 'ws://localhost:3001',
      apiHealthy: apiResponse.ok(),
      wsHealthy: wsTest
    };

    fs.writeFileSync(
      path.join(testDataDir, 'test-environment.json'),
      JSON.stringify(envInfo, null, 2)
    );

    console.log('🎯 iOS Safari test environment ready!');

  } catch (error) {
    console.error('❌ Global setup failed:', error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

module.exports = globalSetup;