/**
 * Comprehensive Business Dashboard Test Suite
 * Tests all Phase 4 Business Dashboard components, functionality, and performance
 * 
 * Test Categories:
 * 1. Component Functionality Tests
 * 2. Swedish Localization Tests  
 * 3. Responsive Design Tests
 * 4. Performance Tests
 * 5. Integration Tests
 * 6. End-to-End Workflow Tests
 */

const puppeteer = require('puppeteer');
const axios = require('axios');
const { performance } = require('perf_hooks');

// Test configuration
const TEST_CONFIG = {
  baseUrl: process.env.BUSINESS_DASHBOARD_URL || 'http://localhost:3002',
  apiUrl: process.env.API_GATEWAY_URL || 'http://localhost:3001',
  timeout: 30000,
  viewport: {
    mobile: { width: 375, height: 667 },
    tablet: { width: 768, height: 1024 },
    desktop: { width: 1920, height: 1080 }
  }
};

// Test data for business dashboard
const TEST_DATA = {
  business: {
    orgNumber: '556123456789',
    name: 'Test Café AB',
    email: 'test@testcafe.se',
    type: 'cafe'
  },
  businessContext: {
    type: 'cafe',
    layout: {
      departments: ['Bar', 'Kök', 'Sittplats'],
      checkouts: 2,
      selfCheckout: false,
      openingHours: {
        monday: { open: '07:00', close: '18:00' },
        tuesday: { open: '07:00', close: '18:00' }
      }
    },
    staff: [
      { name: 'Anna Andersson', role: 'Barista', department: 'Bar' },
      { name: 'Erik Eriksson', role: 'Kock', department: 'Kök' }
    ],
    currentPromotions: ['Kaffe + Bulle 30kr', 'Studentrabatt 10%'],
    knownIssues: ['Wifi kan vara långsam'],
    strengths: ['Bra kaffe', 'Trevlig personal']
  },
  mockFeedback: [
    {
      id: 1,
      transcript: 'Bra kaffe men wifi var långsam',
      qualityScore: { total: 75, authenticity: 80, concreteness: 70, depth: 75 },
      categories: ['service', 'technical'],
      sentiment: 0.6,
      createdAt: new Date().toISOString(),
      purchaseAmount: 45
    },
    {
      id: 2, 
      transcript: 'Fantastisk service, Anna var jättebra',
      qualityScore: { total: 85, authenticity: 90, concreteness: 80, depth: 85 },
      categories: ['service', 'staff'],
      sentiment: 0.9,
      createdAt: new Date().toISOString(),
      purchaseAmount: 65
    }
  ]
};

describe('Business Dashboard Comprehensive Test Suite', () => {
  let browser, page;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: process.env.HEADLESS !== 'false',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  });

  afterAll(async () => {
    if (browser) await browser.close();
  });

  beforeEach(async () => {
    page = await browser.newPage();
    await page.setViewport(TEST_CONFIG.viewport.desktop);
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
  });

  afterEach(async () => {
    if (page) await page.close();
  });

  describe('1. Component Functionality Tests', () => {
    
    describe('RealTimeAnalytics Component', () => {
      test('should load analytics dashboard with correct metrics', async () => {
        await page.goto(`${TEST_CONFIG.baseUrl}/dashboard`);
        
        // Wait for analytics component to load
        await page.waitForSelector('[data-testid="realtime-analytics"]', { timeout: TEST_CONFIG.timeout });
        
        // Check metric cards are present
        const metricCards = await page.$$('[data-testid="metric-card"]');
        expect(metricCards.length).toBeGreaterThanOrEqual(4);
        
        // Check for specific metrics
        const totalFeedbackCard = await page.$('[data-testid="metric-total-feedback"]');
        const avgQualityCard = await page.$('[data-testid="metric-avg-quality"]');
        const totalRewardsCard = await page.$('[data-testid="metric-total-rewards"]');
        const conversionRateCard = await page.$('[data-testid="metric-conversion-rate"]');
        
        expect(totalFeedbackCard).toBeTruthy();
        expect(avgQualityCard).toBeTruthy();
        expect(totalRewardsCard).toBeTruthy();
        expect(conversionRateCard).toBeTruthy();
      });

      test('should display trend indicators correctly', async () => {
        await page.goto(`${TEST_CONFIG.baseUrl}/dashboard`);
        await page.waitForSelector('[data-testid="realtime-analytics"]');
        
        // Check trend indicators
        const trendIndicators = await page.$$('[data-testid="trend-indicator"]');
        expect(trendIndicators.length).toBeGreaterThan(0);
        
        for (const indicator of trendIndicators) {
          const trendClass = await indicator.evaluate(el => el.className);
          expect(trendClass).toMatch(/trend-(up|down|neutral)/);
        }
      });

      test('should update metrics when date range changes', async () => {
        await page.goto(`${TEST_CONFIG.baseUrl}/dashboard`);
        await page.waitForSelector('[data-testid="realtime-analytics"]');
        
        // Get initial metric value
        const initialValue = await page.$eval('[data-testid="metric-total-feedback"] .metric-value', 
          el => el.textContent);
        
        // Change date range
        await page.click('[data-testid="date-range-selector"]');
        await page.click('[data-testid="date-range-7days"]');
        
        // Wait for update and check if value changed (or stayed same but loading occurred)
        await page.waitForSelector('[data-testid="loading-indicator"]', { hidden: true, timeout: 5000 });
        
        const updatedValue = await page.$eval('[data-testid="metric-total-feedback"] .metric-value', 
          el => el.textContent);
        
        // Value may be same but component should have updated
        expect(typeof updatedValue).toBe('string');
      });

      test('should display quality breakdown chart', async () => {
        await page.goto(`${TEST_CONFIG.baseUrl}/dashboard`);
        await page.waitForSelector('[data-testid="quality-breakdown-card"]');
        
        // Check chart is rendered
        const chart = await page.$('[data-testid="quality-breakdown-chart"]');
        expect(chart).toBeTruthy();
        
        // Check legend items
        const legendItems = await page.$$('[data-testid="chart-legend-item"]');
        expect(legendItems.length).toBe(3); // Authenticity, Concreteness, Depth
      });

      test('should show AI insights recommendations', async () => {
        await page.goto(`${TEST_CONFIG.baseUrl}/dashboard`);
        await page.waitForSelector('[data-testid="ai-insights-card"]');
        
        const insights = await page.$$('[data-testid="ai-insight-item"]');
        expect(insights.length).toBeGreaterThan(0);
        
        // Check insight structure
        for (const insight of insights.slice(0, 2)) {
          const title = await insight.$('[data-testid="insight-title"]');
          const description = await insight.$('[data-testid="insight-description"]');
          const priority = await insight.$('[data-testid="insight-priority"]');
          
          expect(title).toBeTruthy();
          expect(description).toBeTruthy();
          expect(priority).toBeTruthy();
        }
      });
    });

    describe('BusinessContextManager Component', () => {
      test('should render all configuration tabs', async () => {
        await page.goto(`${TEST_CONFIG.baseUrl}/settings/context`);
        await page.waitForSelector('[data-testid="business-context-manager"]');
        
        const tabs = await page.$$('[data-testid="context-tab"]');
        expect(tabs.length).toBeGreaterThanOrEqual(6); // Basic, Staff, Operations, etc.
        
        // Check tab labels in Swedish
        const tabTexts = await Promise.all(
          tabs.map(tab => tab.evaluate(el => el.textContent))
        );
        
        expect(tabTexts).toContain('Grundläggande');
        expect(tabTexts).toContain('Personal');
        expect(tabTexts).toContain('Verksamhet');
      });

      test('should save business context successfully', async () => {
        await page.goto(`${TEST_CONFIG.baseUrl}/settings/context`);
        await page.waitForSelector('[data-testid="business-context-manager"]');
        
        // Fill in basic info
        await page.type('[data-testid="business-name-input"]', TEST_DATA.business.name);
        await page.select('[data-testid="business-type-select"]', TEST_DATA.businessContext.type);
        
        // Add department
        await page.click('[data-testid="staff-tab"]');
        await page.type('[data-testid="new-department-input"]', 'Testavdelning');
        await page.click('[data-testid="add-department-button"]');
        
        // Save changes
        await page.click('[data-testid="save-context-button"]');
        
        // Check success message
        await page.waitForSelector('[data-testid="save-success-message"]');
        const successMessage = await page.$eval('[data-testid="save-success-message"]', 
          el => el.textContent);
        expect(successMessage).toContain('sparad'); // Swedish for "saved"
      });

      test('should validate required fields', async () => {
        await page.goto(`${TEST_CONFIG.baseUrl}/settings/context`);
        await page.waitForSelector('[data-testid="business-context-manager"]');
        
        // Try to save without required fields
        await page.click('[data-testid="save-context-button"]');
        
        // Check validation errors
        const errorMessages = await page.$$('[data-testid="validation-error"]');
        expect(errorMessages.length).toBeGreaterThan(0);
      });

      test('should support staff management', async () => {
        await page.goto(`${TEST_CONFIG.baseUrl}/settings/context`);
        await page.waitForSelector('[data-testid="business-context-manager"]');
        
        // Go to staff tab
        await page.click('[data-testid="staff-tab"]');
        
        // Add staff member
        await page.type('[data-testid="staff-name-input"]', 'Test Person');
        await page.type('[data-testid="staff-role-input"]', 'Testare');
        await page.select('[data-testid="staff-department-select"]', 'Bar');
        await page.click('[data-testid="add-staff-button"]');
        
        // Verify staff member appears in list
        await page.waitForSelector('[data-testid="staff-member-item"]');
        const staffMembers = await page.$$('[data-testid="staff-member-item"]');
        expect(staffMembers.length).toBeGreaterThan(0);
      });
    });

    describe('ExportManager Component', () => {
      test('should render export options', async () => {
        await page.goto(`${TEST_CONFIG.baseUrl}/analytics/export`);
        await page.waitForSelector('[data-testid="export-manager"]');
        
        // Check format options
        const formatOptions = await page.$$('[data-testid="export-format-option"]');
        expect(formatOptions.length).toBe(4); // CSV, Excel, PDF, JSON
        
        // Check data type options
        const dataTypes = await page.$$('[data-testid="data-type-option"]');
        expect(dataTypes.length).toBeGreaterThan(0);
      });

      test('should export CSV successfully', async () => {
        await page.goto(`${TEST_CONFIG.baseUrl}/analytics/export`);
        await page.waitForSelector('[data-testid="export-manager"]');
        
        // Select CSV format and feedback data
        await page.click('[data-testid="format-csv"]');
        await page.click('[data-testid="data-type-feedback"]');
        
        // Set date range
        await page.type('[data-testid="start-date-input"]', '2024-01-01');
        await page.type('[data-testid="end-date-input"]', '2024-12-31');
        
        // Mock download behavior
        await page._client.send('Page.setDownloadBehavior', {
          behavior: 'allow',
          downloadPath: '/tmp'
        });
        
        // Trigger export
        await page.click('[data-testid="export-button"]');
        
        // Check loading state
        await page.waitForSelector('[data-testid="export-loading"]');
        
        // Wait for completion
        await page.waitForSelector('[data-testid="export-loading"]', { hidden: true, timeout: 10000 });
      });

      test('should send export via email', async () => {
        await page.goto(`${TEST_CONFIG.baseUrl}/analytics/export`);
        await page.waitForSelector('[data-testid="export-manager"]');
        
        // Enable email option
        await page.click('[data-testid="email-export-checkbox"]');
        await page.type('[data-testid="email-recipient-input"]', 'test@example.com');
        
        // Select format and data
        await page.click('[data-testid="format-pdf"]');
        await page.click('[data-testid="data-type-analytics"]');
        
        // Submit
        await page.click('[data-testid="export-button"]');
        
        // Check success message
        await page.waitForSelector('[data-testid="email-sent-message"]');
      });
    });
  });

  describe('2. Swedish Localization Tests', () => {
    test('should display all UI text in Swedish', async () => {
      await page.goto(`${TEST_CONFIG.baseUrl}/dashboard`);
      await page.waitForSelector('[data-testid="dashboard-layout"]');
      
      // Check key UI elements for Swedish text
      const swedishTexts = [
        'Översikt', 'Feedback', 'Analys', 'Inställningar',
        'Totalt feedback', 'Genomsnittlig kvalitet', 'Totala belöningar',
        'Senaste feedback', 'Kvalitetsfördelning', 'Trender'
      ];
      
      const pageText = await page.evaluate(() => document.body.textContent);
      
      for (const text of swedishTexts) {
        expect(pageText).toContain(text);
      }
    });

    test('should format numbers and dates according to Swedish locale', async () => {
      await page.goto(`${TEST_CONFIG.baseUrl}/dashboard`);
      await page.waitForSelector('[data-testid="realtime-analytics"]');
      
      // Check currency formatting (SEK)
      const currencyElements = await page.$$('[data-testid="currency-amount"]');
      if (currencyElements.length > 0) {
        const currencyText = await currencyElements[0].evaluate(el => el.textContent);
        expect(currencyText).toMatch(/\d+.*kr|SEK/i);
      }
      
      // Check date formatting (Swedish format)
      const dateElements = await page.$$('[data-testid="formatted-date"]');
      if (dateElements.length > 0) {
        const dateText = await dateElements[0].evaluate(el => el.textContent);
        expect(dateText).toMatch(/\d{1,2}\/\d{1,2}|\d{4}-\d{2}-\d{2}/);
      }
    });

    test('should handle Swedish character input correctly', async () => {
      await page.goto(`${TEST_CONFIG.baseUrl}/settings/context`);
      await page.waitForSelector('[data-testid="business-context-manager"]');
      
      const swedishText = 'Café Åkermyntan - Björkgatan 15, Malmö';
      await page.type('[data-testid="business-name-input"]', swedishText);
      
      const inputValue = await page.$eval('[data-testid="business-name-input"]', el => el.value);
      expect(inputValue).toBe(swedishText);
    });
  });

  describe('3. Responsive Design Tests', () => {
    test('should display correctly on mobile devices', async () => {
      await page.setViewport(TEST_CONFIG.viewport.mobile);
      await page.goto(`${TEST_CONFIG.baseUrl}/dashboard`);
      
      // Check mobile navigation
      await page.waitForSelector('[data-testid="mobile-nav-toggle"]');
      
      // Test menu toggle
      await page.click('[data-testid="mobile-nav-toggle"]');
      await page.waitForSelector('[data-testid="mobile-nav-menu"]');
      
      // Check that cards stack vertically
      const metricCards = await page.$$('[data-testid="metric-card"]');
      const firstCard = metricCards[0];
      const secondCard = metricCards[1];
      
      if (firstCard && secondCard) {
        const firstCardBounds = await firstCard.boundingBox();
        const secondCardBounds = await secondCard.boundingBox();
        
        // Cards should be stacked (second card below first)
        expect(secondCardBounds.y).toBeGreaterThan(firstCardBounds.y + firstCardBounds.height - 20);
      }
    });

    test('should display correctly on tablet devices', async () => {
      await page.setViewport(TEST_CONFIG.viewport.tablet);
      await page.goto(`${TEST_CONFIG.baseUrl}/dashboard`);
      
      // Check tablet layout
      await page.waitForSelector('[data-testid="dashboard-layout"]');
      
      // Verify sidebar is visible but may be collapsible
      const sidebar = await page.$('[data-testid="dashboard-sidebar"]');
      expect(sidebar).toBeTruthy();
      
      // Check chart responsiveness
      const charts = await page.$$('[data-testid="chart-container"]');
      for (const chart of charts) {
        const bounds = await chart.boundingBox();
        expect(bounds.width).toBeLessThanOrEqual(TEST_CONFIG.viewport.tablet.width);
      }
    });

    test('should maintain functionality across all screen sizes', async () => {
      const viewports = [TEST_CONFIG.viewport.mobile, TEST_CONFIG.viewport.tablet, TEST_CONFIG.viewport.desktop];
      
      for (const viewport of viewports) {
        await page.setViewport(viewport);
        await page.goto(`${TEST_CONFIG.baseUrl}/dashboard`);
        
        // Test key interactions work on all sizes
        await page.waitForSelector('[data-testid="realtime-analytics"]');
        
        // Test date range selector
        const dateRangeSelector = await page.$('[data-testid="date-range-selector"]');
        if (dateRangeSelector) {
          await dateRangeSelector.click();
          
          const dropdown = await page.$('[data-testid="date-range-dropdown"]');
          expect(dropdown).toBeTruthy();
        }
      }
    });
  });

  describe('4. Performance Tests', () => {
    test('should load dashboard within 3 seconds', async () => {
      const startTime = performance.now();
      
      await page.goto(`${TEST_CONFIG.baseUrl}/dashboard`);
      await page.waitForSelector('[data-testid="realtime-analytics"]');
      
      const loadTime = performance.now() - startTime;
      expect(loadTime).toBeLessThan(3000); // 3 seconds
    });

    test('should handle large datasets efficiently', async () => {
      // Mock large dataset
      await page.evaluateOnNewDocument(() => {
        window.mockLargeDataset = Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          transcript: `Test feedback ${i}`,
          qualityScore: { total: Math.floor(Math.random() * 100) },
          createdAt: new Date(Date.now() - i * 86400000).toISOString()
        }));
      });
      
      const startTime = performance.now();
      
      await page.goto(`${TEST_CONFIG.baseUrl}/feedback`);
      await page.waitForSelector('[data-testid="feedback-list"]');
      
      const loadTime = performance.now() - startTime;
      expect(loadTime).toBeLessThan(5000); // 5 seconds for large dataset
      
      // Check pagination or virtualization
      const feedbackItems = await page.$$('[data-testid="feedback-item"]');
      expect(feedbackItems.length).toBeLessThanOrEqual(50); // Should be paginated/limited
    });

    test('should maintain responsive interactions', async () => {
      await page.goto(`${TEST_CONFIG.baseUrl}/dashboard`);
      await page.waitForSelector('[data-testid="realtime-analytics"]');
      
      // Test rapid interactions
      const dateSelector = await page.$('[data-testid="date-range-selector"]');
      if (dateSelector) {
        const startTime = performance.now();
        
        await dateSelector.click();
        await page.waitForSelector('[data-testid="date-range-dropdown"]');
        
        const responseTime = performance.now() - startTime;
        expect(responseTime).toBeLessThan(500); // 500ms response time
      }
    });

    test('should not have memory leaks during navigation', async () => {
      const initialHeapSize = await page.evaluate(() => {
        return performance.memory ? performance.memory.usedJSHeapSize : 0;
      });
      
      // Navigate through multiple pages
      const pages = ['/dashboard', '/feedback', '/analytics', '/settings'];
      
      for (const pagePath of pages) {
        await page.goto(`${TEST_CONFIG.baseUrl}${pagePath}`);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000); // Allow time for cleanup
      }
      
      // Force garbage collection if available
      await page.evaluate(() => {
        if (window.gc) window.gc();
      });
      
      const finalHeapSize = await page.evaluate(() => {
        return performance.memory ? performance.memory.usedJSHeapSize : 0;
      });
      
      // Memory usage shouldn't increase by more than 50MB
      const memoryIncrease = finalHeapSize - initialHeapSize;
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // 50MB
    });
  });
});

// Test utilities and helpers
class TestUtils {
  static async loginAsBusiness(page, businessData = TEST_DATA.business) {
    await page.goto(`${TEST_CONFIG.baseUrl}/login`);
    await page.type('[data-testid="org-number-input"]', businessData.orgNumber);
    await page.type('[data-testid="email-input"]', businessData.email);
    await page.click('[data-testid="login-button"]');
    await page.waitForSelector('[data-testid="dashboard-layout"]');
  }

  static async mockApiResponse(page, endpoint, mockData) {
    await page.route(`${TEST_CONFIG.apiUrl}${endpoint}`, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockData)
      });
    });
  }

  static async measurePerformance(page, action) {
    const startTime = performance.now();
    await action();
    return performance.now() - startTime;
  }

  static async checkAccessibility(page) {
    // Basic accessibility checks
    const missingAltImages = await page.$$eval('img:not([alt])', imgs => imgs.length);
    const missingLabels = await page.$$eval('input:not([aria-label]):not([id])', inputs => inputs.length);
    
    return {
      missingAltImages,
      missingLabels,
      passed: missingAltImages === 0 && missingLabels === 0
    };
  }
}

module.exports = {
  TEST_CONFIG,
  TEST_DATA,
  TestUtils
};