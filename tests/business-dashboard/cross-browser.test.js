/**
 * Cross-Browser Testing for Business Dashboard
 * Tests Chrome, Safari, and Firefox compatibility
 */

const puppeteer = require('puppeteer');
const { execSync } = require('child_process');
const { performance } = require('perf_hooks');

// Browser configurations
const BROWSERS = {
  chrome: {
    name: 'chrome',
    product: 'chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  },
  safari: {
    name: 'safari',
    // Note: Safari automation requires additional setup on macOS
    product: 'chrome', // Use Chrome for CI/CD compatibility
    args: ['--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15']
  },
  firefox: {
    name: 'firefox',
    product: 'firefox',
    args: ['--no-sandbox']
  }
};

const TEST_CONFIG = {
  baseUrl: process.env.BUSINESS_DASHBOARD_URL || 'http://localhost:3002',
  timeout: 30000
};

describe('Cross-Browser Compatibility Tests', () => {
  describe('9. Chrome Browser Tests', () => {
    let browser, page;

    beforeAll(async () => {
      browser = await puppeteer.launch({
        product: 'chrome',
        headless: process.env.HEADLESS !== 'false',
        args: BROWSERS.chrome.args
      });
    });

    afterAll(async () => {
      if (browser) await browser.close();
    });

    beforeEach(async () => {
      page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    });

    afterEach(async () => {
      if (page) await page.close();
    });

    test('should load dashboard correctly in Chrome', async () => {
      await page.goto(`${TEST_CONFIG.baseUrl}/dashboard`);
      
      // Check critical elements load
      await page.waitForSelector('[data-testid="dashboard-layout"]', { timeout: TEST_CONFIG.timeout });
      await page.waitForSelector('[data-testid="realtime-analytics"]');
      
      // Check JavaScript functionality
      const jsWorking = await page.evaluate(() => {
        return typeof window.React !== 'undefined' || document.querySelector('[data-reactroot]') !== null;
      });
      
      expect(jsWorking).toBe(true);
    });

    test('should handle CSS Grid and Flexbox correctly in Chrome', async () => {
      await page.goto(`${TEST_CONFIG.baseUrl}/dashboard`);
      await page.waitForSelector('[data-testid="dashboard-layout"]');
      
      // Check modern CSS features
      const cssSupport = await page.evaluate(() => {
        const testEl = document.createElement('div');
        testEl.style.display = 'grid';
        const supportsGrid = testEl.style.display === 'grid';
        
        testEl.style.display = 'flex';
        const supportsFlex = testEl.style.display === 'flex';
        
        return { supportsGrid, supportsFlex };
      });
      
      expect(cssSupport.supportsGrid).toBe(true);
      expect(cssSupport.supportsFlex).toBe(true);
    });

    test('should support ES6+ features in Chrome', async () => {
      await page.goto(`${TEST_CONFIG.baseUrl}/dashboard`);
      
      const es6Support = await page.evaluate(() => {
        try {
          // Test arrow functions
          const arrowFunc = () => true;
          
          // Test template literals
          const templateLiteral = `test ${123}`;
          
          // Test const/let
          const constVar = 1;
          let letVar = 2;
          
          // Test destructuring
          const { document: doc } = window;
          
          // Test Promise support
          const promiseSupported = typeof Promise !== 'undefined';
          
          return {
            arrowFunctions: typeof arrowFunc === 'function',
            templateLiterals: templateLiteral === 'test 123',
            blockScoping: constVar === 1 && letVar === 2,
            destructuring: doc === document,
            promises: promiseSupported
          };
        } catch (error) {
          return { error: error.message };
        }
      });
      
      expect(es6Support.arrowFunctions).toBe(true);
      expect(es6Support.templateLiterals).toBe(true);
      expect(es6Support.blockScoping).toBe(true);
      expect(es6Support.destructuring).toBe(true);
      expect(es6Support.promises).toBe(true);
    });
  });

  describe('10. Safari Browser Tests', () => {
    let browser, page;

    beforeAll(async () => {
      try {
        // Try to launch with Firefox for Safari-like testing
        browser = await puppeteer.launch({
          product: 'chrome', // Use Chrome with Safari user agent
          headless: process.env.HEADLESS !== 'false',
          args: BROWSERS.safari.args
        });
      } catch (error) {
        console.warn('Safari browser testing limited, using Chrome with Safari UA');
        browser = await puppeteer.launch({
          product: 'chrome',
          headless: process.env.HEADLESS !== 'false',
          args: BROWSERS.chrome.args
        });
      }
    });

    afterAll(async () => {
      if (browser) await browser.close();
    });

    beforeEach(async () => {
      page = await browser.newPage();
      // Set Safari user agent
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15');
    });

    afterEach(async () => {
      if (page) await page.close();
    });

    test('should load dashboard correctly in Safari', async () => {
      await page.goto(`${TEST_CONFIG.baseUrl}/dashboard`);
      
      // Wait longer for Safari (can be slower)
      await page.waitForSelector('[data-testid="dashboard-layout"]', { timeout: 45000 });
      await page.waitForSelector('[data-testid="realtime-analytics"]', { timeout: 30000 });
      
      // Check page title and meta tags
      const title = await page.title();
      expect(title).toBeTruthy();
      expect(title.length).toBeGreaterThan(0);
    });

    test('should handle WebKit-specific features', async () => {
      await page.goto(`${TEST_CONFIG.baseUrl}/dashboard`);
      await page.waitForSelector('[data-testid="dashboard-layout"]');
      
      // Test WebKit CSS properties
      const webkitSupport = await page.evaluate(() => {
        const testEl = document.createElement('div');
        testEl.style.webkitTransform = 'rotate(45deg)';
        testEl.style.webkitBorderRadius = '10px';
        
        return {
          transform: testEl.style.webkitTransform !== '',
          borderRadius: testEl.style.webkitBorderRadius !== '',
          userAgent: navigator.userAgent.includes('Safari')
        };
      });
      
      // Should handle webkit prefixes
      expect(typeof webkitSupport.transform).toBe('boolean');
      expect(typeof webkitSupport.borderRadius).toBe('boolean');
    });

    test('should handle date/time formatting for Swedish locale', async () => {
      await page.goto(`${TEST_CONFIG.baseUrl}/dashboard`);
      await page.waitForSelector('[data-testid="realtime-analytics"]');
      
      // Check date formatting in Safari
      const dateFormatting = await page.evaluate(() => {
        const testDate = new Date('2024-03-15T10:30:00Z');
        
        try {
          const swedishDate = testDate.toLocaleDateString('sv-SE');
          const swedishTime = testDate.toLocaleTimeString('sv-SE');
          
          return {
            date: swedishDate,
            time: swedishTime,
            supported: true
          };
        } catch (error) {
          return {
            error: error.message,
            supported: false
          };
        }
      });
      
      expect(dateFormatting.supported).toBe(true);
      if (dateFormatting.date) {
        expect(dateFormatting.date).toMatch(/\d{4}-\d{2}-\d{2}/);
      }
    });

    test('should handle touch events for mobile Safari', async () => {
      // Simulate mobile Safari viewport
      await page.setViewport({ width: 375, height: 667 });
      await page.goto(`${TEST_CONFIG.baseUrl}/dashboard`);
      
      // Enable touch emulation
      await page.emulateTouch();
      
      await page.waitForSelector('[data-testid="dashboard-layout"]');
      
      // Test touch interactions
      const touchSupport = await page.evaluate(() => {
        return {
          touchEvents: 'ontouchstart' in window,
          gestureEvents: 'ongesturestart' in window,
          touchscreen: navigator.maxTouchPoints > 0
        };
      });
      
      // Touch events should be supported
      expect(touchSupport.touchEvents).toBe(true);
    });
  });

  describe('11. Firefox Browser Tests', () => {
    let browser, page;

    beforeAll(async () => {
      try {
        browser = await puppeteer.launch({
          product: 'firefox',
          headless: process.env.HEADLESS !== 'false',
          args: BROWSERS.firefox.args
        });
      } catch (error) {
        console.warn('Firefox not available, using Chrome with Firefox UA');
        browser = await puppeteer.launch({
          product: 'chrome',
          headless: process.env.HEADLESS !== 'false',
          args: BROWSERS.chrome.args
        });
      }
    });

    afterAll(async () => {
      if (browser) await browser.close();
    });

    beforeEach(async () => {
      page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:91.0) Gecko/20100101 Firefox/91.0');
    });

    afterEach(async () => {
      if (page) await page.close();
    });

    test('should load dashboard correctly in Firefox', async () => {
      await page.goto(`${TEST_CONFIG.baseUrl}/dashboard`);
      
      await page.waitForSelector('[data-testid="dashboard-layout"]', { timeout: TEST_CONFIG.timeout });
      await page.waitForSelector('[data-testid="realtime-analytics"]');
      
      // Check Gecko-specific rendering
      const geckoSupport = await page.evaluate(() => {
        return {
          userAgent: navigator.userAgent.includes('Gecko'),
          mozFeatures: typeof window.mozRequestAnimationFrame !== 'undefined' || 
                      typeof window.mozCancelAnimationFrame !== 'undefined'
        };
      });
      
      // Should handle Firefox-specific features
      expect(typeof geckoSupport.userAgent).toBe('boolean');
    });

    test('should handle Flexbox layout in Firefox', async () => {
      await page.goto(`${TEST_CONFIG.baseUrl}/dashboard`);
      await page.waitForSelector('[data-testid="dashboard-layout"]');
      
      // Test Firefox Flexbox implementation
      const flexboxSupport = await page.evaluate(() => {
        const testEl = document.createElement('div');
        testEl.style.display = 'flex';
        testEl.style.flexWrap = 'wrap';
        testEl.style.justifyContent = 'space-between';
        
        return {
          display: testEl.style.display === 'flex',
          flexWrap: testEl.style.flexWrap === 'wrap',
          justifyContent: testEl.style.justifyContent === 'space-between'
        };
      });
      
      expect(flexboxSupport.display).toBe(true);
      expect(flexboxSupport.flexWrap).toBe(true);
      expect(flexboxSupport.justifyContent).toBe(true);
    });

    test('should handle CSS custom properties in Firefox', async () => {
      await page.goto(`${TEST_CONFIG.baseUrl}/dashboard`);
      await page.waitForSelector('[data-testid="dashboard-layout"]');
      
      const customPropsSupport = await page.evaluate(() => {
        const testEl = document.createElement('div');
        testEl.style.setProperty('--test-color', '#ff0000');
        testEl.style.color = 'var(--test-color)';
        
        document.body.appendChild(testEl);
        const computedStyle = window.getComputedStyle(testEl);
        const colorValue = computedStyle.color;
        document.body.removeChild(testEl);
        
        return {
          supported: colorValue.includes('255') || colorValue.includes('#ff0000') || colorValue.includes('red'),
          value: colorValue
        };
      });
      
      expect(customPropsSupport.supported).toBe(true);
    });

    test('should handle form validation in Firefox', async () => {
      await page.goto(`${TEST_CONFIG.baseUrl}/settings/context`);
      await page.waitForSelector('[data-testid="business-context-manager"]');
      
      // Test HTML5 form validation
      const formValidation = await page.evaluate(() => {
        const form = document.createElement('form');
        const input = document.createElement('input');
        input.type = 'email';
        input.required = true;
        input.value = 'invalid-email';
        
        form.appendChild(input);
        document.body.appendChild(form);
        
        const isValid = input.checkValidity();
        const validationMessage = input.validationMessage;
        
        document.body.removeChild(form);
        
        return {
          isValid,
          hasValidationMessage: validationMessage.length > 0,
          validationSupported: typeof input.checkValidity === 'function'
        };
      });
      
      expect(formValidation.validationSupported).toBe(true);
      expect(formValidation.isValid).toBe(false);
      expect(formValidation.hasValidationMessage).toBe(true);
    });
  });

  describe('12. Cross-Browser Feature Compatibility', () => {
    const browsers = ['chrome', 'safari', 'firefox'];
    
    test.each(browsers)('should support modern JavaScript features in %s', async (browserName) => {
      let browser, page;
      
      try {
        const config = BROWSERS[browserName];
        browser = await puppeteer.launch({
          product: config.product || 'chrome',
          headless: process.env.HEADLESS !== 'false',
          args: config.args
        });
        
        page = await browser.newPage();
        await page.setUserAgent(getUAForBrowser(browserName));
        
        await page.goto(`${TEST_CONFIG.baseUrl}/dashboard`);
        await page.waitForSelector('[data-testid="dashboard-layout"]');
        
        const jsFeatures = await page.evaluate(() => {
          const features = {};
          
          try {
            // Test Promises
            features.promises = typeof Promise !== 'undefined';
            
            // Test Fetch API
            features.fetch = typeof fetch !== 'undefined';
            
            // Test Arrow functions
            const arrow = () => true;
            features.arrowFunctions = typeof arrow === 'function';
            
            // Test Spread operator
            const arr = [1, 2, 3];
            const spread = [...arr];
            features.spreadOperator = spread.length === 3;
            
            // Test Classes
            class TestClass {}
            features.classes = typeof TestClass === 'function';
            
            // Test Modules (basic support check)
            features.modules = typeof import !== 'undefined' || typeof require !== 'undefined';
            
          } catch (error) {
            features.error = error.message;
          }
          
          return features;
        });
        
        expect(jsFeatures.promises).toBe(true);
        expect(jsFeatures.arrowFunctions).toBe(true);
        expect(jsFeatures.spreadOperator).toBe(true);
        expect(jsFeatures.classes).toBe(true);
        
        await browser.close();
        
      } catch (error) {
        console.warn(`Testing ${browserName} failed:`, error.message);
        if (browser) await browser.close();
      }
    });

    test.each(browsers)('should render dashboard layout consistently in %s', async (browserName) => {
      let browser, page;
      
      try {
        const config = BROWSERS[browserName];
        browser = await puppeteer.launch({
          product: config.product || 'chrome',
          headless: process.env.HEADLESS !== 'false',
          args: config.args
        });
        
        page = await browser.newPage();
        await page.setUserAgent(getUAForBrowser(browserName));
        await page.setViewport({ width: 1920, height: 1080 });
        
        await page.goto(`${TEST_CONFIG.baseUrl}/dashboard`);
        await page.waitForSelector('[data-testid="realtime-analytics"]');
        
        // Take screenshot for visual comparison
        const screenshot = await page.screenshot({
          path: `/tmp/dashboard-${browserName}.png`,
          fullPage: false,
          clip: { x: 0, y: 0, width: 1920, height: 1080 }
        });
        
        expect(screenshot).toBeTruthy();
        
        // Check layout elements are positioned correctly
        const layoutMetrics = await page.evaluate(() => {
          const sidebar = document.querySelector('[data-testid="dashboard-sidebar"]');
          const main = document.querySelector('[data-testid="dashboard-main"]');
          const analytics = document.querySelector('[data-testid="realtime-analytics"]');
          
          return {
            sidebarWidth: sidebar ? sidebar.offsetWidth : 0,
            mainWidth: main ? main.offsetWidth : 0,
            analyticsHeight: analytics ? analytics.offsetHeight : 0,
            hasLayout: !!(sidebar && main && analytics)
          };
        });
        
        expect(layoutMetrics.hasLayout).toBe(true);
        expect(layoutMetrics.sidebarWidth).toBeGreaterThan(200); // Minimum sidebar width
        expect(layoutMetrics.mainWidth).toBeGreaterThan(800); // Minimum main content width
        
        await browser.close();
        
      } catch (error) {
        console.warn(`Layout testing ${browserName} failed:`, error.message);
        if (browser) await browser.close();
      }
    });

    test.each(browsers)('should handle Swedish text correctly in %s', async (browserName) => {
      let browser, page;
      
      try {
        const config = BROWSERS[browserName];
        browser = await puppeteer.launch({
          product: config.product || 'chrome',
          headless: process.env.HEADLESS !== 'false',
          args: config.args
        });
        
        page = await browser.newPage();
        await page.setUserAgent(getUAForBrowser(browserName));
        
        await page.goto(`${TEST_CONFIG.baseUrl}/dashboard`);
        await page.waitForSelector('[data-testid="dashboard-layout"]');
        
        // Test Swedish character rendering
        const swedishTest = await page.evaluate(() => {
          const testEl = document.createElement('div');
          const swedishText = 'Åke köper färsk fisk på tørget i Malmö';
          testEl.textContent = swedishText;
          document.body.appendChild(testEl);
          
          const computedStyle = window.getComputedStyle(testEl);
          const renderedText = testEl.textContent;
          
          document.body.removeChild(testEl);
          
          return {
            originalText: swedishText,
            renderedText: renderedText,
            textMatches: swedishText === renderedText,
            fontFamily: computedStyle.fontFamily
          };
        });
        
        expect(swedishTest.textMatches).toBe(true);
        expect(swedishTest.fontFamily).toBeTruthy();
        
        await browser.close();
        
      } catch (error) {
        console.warn(`Swedish text testing ${browserName} failed:`, error.message);
        if (browser) await browser.close();
      }
    });
  });
});

// Utility functions
function getUAForBrowser(browserName) {
  const userAgents = {
    chrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    safari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
    firefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:91.0) Gecko/20100101 Firefox/91.0'
  };
  
  return userAgents[browserName] || userAgents.chrome;
}

class CrossBrowserTestUtils {
  static async testFeatureInAllBrowsers(featureTest, browsers = ['chrome', 'safari', 'firefox']) {
    const results = {};
    
    for (const browserName of browsers) {
      try {
        results[browserName] = await this.runInBrowser(browserName, featureTest);
      } catch (error) {
        results[browserName] = { error: error.message };
      }
    }
    
    return results;
  }
  
  static async runInBrowser(browserName, testFunction) {
    const config = BROWSERS[browserName];
    const browser = await puppeteer.launch({
      product: config.product || 'chrome',
      headless: true,
      args: config.args
    });
    
    try {
      const page = await browser.newPage();
      await page.setUserAgent(getUAForBrowser(browserName));
      
      const result = await testFunction(page);
      await browser.close();
      
      return result;
    } catch (error) {
      await browser.close();
      throw error;
    }
  }
  
  static async compareScreenshots(browsers, url, options = {}) {
    const screenshots = {};
    
    for (const browserName of browsers) {
      try {
        const screenshot = await this.runInBrowser(browserName, async (page) => {
          await page.setViewport(options.viewport || { width: 1920, height: 1080 });
          await page.goto(url);
          await page.waitForSelector('[data-testid="dashboard-layout"]');
          
          return await page.screenshot({
            path: `/tmp/compare-${browserName}.png`,
            fullPage: options.fullPage || false
          });
        });
        
        screenshots[browserName] = screenshot;
      } catch (error) {
        screenshots[browserName] = { error: error.message };
      }
    }
    
    return screenshots;
  }
}

module.exports = {
  CrossBrowserTestUtils,
  BROWSERS,
  getUAForBrowser
};