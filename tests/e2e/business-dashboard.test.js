/**
 * Business Dashboard E2E Tests
 * Tests business owner experience and analytics functionality
 */

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs').promises;

let swedishTestData, authTokens;

test.beforeAll(async () => {
  try {
    const testDataPath = path.join(__dirname, 'fixtures/swedish-test-data.json');
    swedishTestData = JSON.parse(await fs.readFile(testDataPath, 'utf8'));
    
    const authPath = path.join(__dirname, 'fixtures/auth-tokens.json');
    authTokens = JSON.parse(await fs.readFile(authPath, 'utf8'));
  } catch (error) {
    console.error('Failed to load test fixtures:', error);
    throw error;
  }
});

test.describe('Business Dashboard - Core Functionality', () => {
  
  test('should login and display dashboard overview', async ({ page }) => {
    // Navigate to business dashboard
    await page.goto('http://localhost:3002');
    
    // Login with test credentials
    await page.fill('[data-testid="email-input"]', 'aurora@feedbackai.se');
    await page.fill('[data-testid="password-input"]', 'testpassword123');
    await page.click('[data-testid="login-btn"]');
    
    // Wait for dashboard to load
    await page.waitForSelector('[data-testid="dashboard-overview"]', { timeout: 15000 });
    
    // Verify Swedish business context is loaded
    await expect(page.locator('[data-testid="business-name"]')).toContainText('Café Aurora Stockholm');
    
    // Check KPI cards are displayed
    await expect(page.locator('[data-testid="total-feedback-count"]')).toBeVisible();
    await expect(page.locator('[data-testid="average-quality-score"]')).toBeVisible();
    await expect(page.locator('[data-testid="total-rewards-paid"]')).toBeVisible();
    await expect(page.locator('[data-testid="conversion-rate"]')).toBeVisible();
    
    // Verify Swedish currency formatting
    const rewardsText = await page.locator('[data-testid="total-rewards-paid"]').textContent();
    expect(rewardsText).toMatch(/\d+(\.\d{2})?\s*SEK/);
  });

  test('should display feedback analytics with Swedish data', async ({ page }) => {
    await loginAsBusiness(page);
    
    // Navigate to analytics section
    await page.click('[data-testid="analytics-tab"]');
    await page.waitForSelector('[data-testid="analytics-dashboard"]', { timeout: 10000 });
    
    // Check feedback trends chart
    await expect(page.locator('[data-testid="feedback-trends-chart"]')).toBeVisible();
    
    // Check category distribution
    await expect(page.locator('[data-testid="category-distribution"]')).toBeVisible();
    
    // Verify Swedish categories are present
    const categories = ['Service', 'Produkt', 'Atmosfär', 'Pris', 'Renlighet'];
    for (const category of categories) {
      await expect(page.locator(`[data-testid="category-${category.toLowerCase()}"]`)).toBeVisible();
    }
    
    // Check sentiment analysis
    await expect(page.locator('[data-testid="sentiment-analysis"]')).toBeVisible();
    
    // Verify time period filters
    await page.click('[data-testid="time-filter-dropdown"]');
    await expect(page.locator('[data-testid="filter-last-week"]')).toBeVisible();
    await expect(page.locator('[data-testid="filter-last-month"]')).toBeVisible();
    await expect(page.locator('[data-testid="filter-last-quarter"]')).toBeVisible();
  });

  test('should manage business context settings', async ({ page }) => {
    await loginAsBusiness(page);
    
    // Navigate to settings
    await page.click('[data-testid="settings-tab"]');
    await page.waitForSelector('[data-testid="business-context-editor"]', { timeout: 10000 });
    
    // Edit business context
    await page.click('[data-testid="edit-context-btn"]');
    
    // Update staff information
    await page.fill('[data-testid="staff-name-0"]', 'Anna Svensson');
    await page.select('[data-testid="staff-role-0"]', 'Barista');
    await page.select('[data-testid="staff-department-0"]', 'Kök');
    
    // Add current promotion
    await page.click('[data-testid="add-promotion-btn"]');
    await page.fill('[data-testid="promotion-text-0"]', 'Veckans lunch - 20% rabatt på alla sallader');
    
    // Update known issues
    await page.click('[data-testid="add-issue-btn"]');
    await page.fill('[data-testid="issue-text-0"]', 'Toaletten på övervåningen är ur funktion');
    
    // Save changes
    await page.click('[data-testid="save-context-btn"]');
    await page.waitForSelector('[data-testid="save-success"]', { timeout: 10000 });
    
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Kontextinformation sparad');
  });

  test('should export feedback data in multiple formats', async ({ page }) => {
    await loginAsBusiness(page);
    
    // Navigate to feedback list
    await page.click('[data-testid="feedback-tab"]');
    await page.waitForSelector('[data-testid="feedback-list"]', { timeout: 10000 });
    
    // Test CSV export
    const [csvDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.click('[data-testid="export-csv-btn"]')
    ]);
    expect(csvDownload.suggestedFilename()).toMatch(/feedback-.*\.csv$/);
    
    // Test Excel export  
    const [excelDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.click('[data-testid="export-excel-btn"]')
    ]);
    expect(excelDownload.suggestedFilename()).toMatch(/feedback-.*\.xlsx$/);
    
    // Test PDF report export
    const [pdfDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.click('[data-testid="export-pdf-btn"]')
    ]);
    expect(pdfDownload.suggestedFilename()).toMatch(/feedback-report-.*\.pdf$/);
  });

  test('should manage QR codes and locations', async ({ page }) => {
    await loginAsBusiness(page);
    
    // Navigate to locations management
    await page.click('[data-testid="locations-tab"]');
    await page.waitForSelector('[data-testid="locations-manager"]', { timeout: 10000 });
    
    // Check existing locations
    await expect(page.locator('[data-testid="location-list"]')).toBeVisible();
    
    // Add new location
    await page.click('[data-testid="add-location-btn"]');
    await page.fill('[data-testid="location-name"]', 'Café Aurora Södermalm');
    await page.fill('[data-testid="location-address"]', 'Götgatan 45');
    await page.fill('[data-testid="location-city"]', 'Stockholm');
    await page.fill('[data-testid="location-postal-code"]', '11646');
    
    await page.click('[data-testid="save-location-btn"]');
    await page.waitForSelector('[data-testid="location-created"]', { timeout: 10000 });
    
    // Generate QR code for new location
    await page.click('[data-testid="generate-qr-btn"]');
    await page.waitForSelector('[data-testid="qr-code-generated"]', { timeout: 10000 });
    
    // Download QR code
    const [qrDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.click('[data-testid="download-qr-btn"]')
    ]);
    expect(qrDownload.suggestedFilename()).toMatch(/qr-code-.*\.png$/);
  });

});

test.describe('Business Dashboard - Advanced Features', () => {
  
  test('should display ROI calculator with Swedish market data', async ({ page }) => {
    await loginAsBusiness(page);
    
    // Navigate to ROI calculator
    await page.click('[data-testid="roi-calculator-tab"]');
    await page.waitForSelector('[data-testid="roi-calculator"]', { timeout: 10000 });
    
    // Input business metrics
    await page.fill('[data-testid="monthly-customers"]', '2500');
    await page.fill('[data-testid="average-transaction"]', '125');
    await page.fill('[data-testid="participation-rate"]', '15');
    
    // Calculate ROI
    await page.click('[data-testid="calculate-roi-btn"]');
    await page.waitForSelector('[data-testid="roi-results"]', { timeout: 10000 });
    
    // Verify results show Swedish currency
    const monthlyRevenue = await page.locator('[data-testid="monthly-revenue"]').textContent();
    expect(monthlyRevenue).toMatch(/\d+\s*SEK/);
    
    const rewardCosts = await page.locator('[data-testid="reward-costs"]').textContent();
    expect(rewardCosts).toMatch(/\d+\s*SEK/);
    
    const platformFees = await page.locator('[data-testid="platform-fees"]').textContent();
    expect(platformFees).toMatch(/\d+\s*SEK/);
    
    const netProfit = await page.locator('[data-testid="net-profit"]').textContent();
    expect(netProfit).toMatch(/\d+\s*SEK/);
  });

  test('should handle tier management and upgrades', async ({ page }) => {
    await loginAsBusiness(page);
    
    // Navigate to tier management
    await page.click('[data-testid="tier-management-tab"]');
    await page.waitForSelector('[data-testid="current-tier-info"]', { timeout: 10000 });
    
    // Check current tier (should be Tier 1 for test)
    await expect(page.locator('[data-testid="current-tier"]')).toContainText('Nivå 1');
    
    // Check tier limits
    await expect(page.locator('[data-testid="daily-limit"]')).toContainText('200 SEK');
    await expect(page.locator('[data-testid="transaction-limit"]')).toContainText('50 SEK');
    
    // Check upgrade eligibility
    await page.click('[data-testid="check-upgrade-btn"]');
    await page.waitForSelector('[data-testid="upgrade-status"]', { timeout: 10000 });
    
    // Should show requirements for next tier
    await expect(page.locator('[data-testid="tier-2-requirements"]')).toBeVisible();
  });

  test('should display staff performance analytics', async ({ page }) => {
    await loginAsBusiness(page);
    
    // Navigate to staff analytics
    await page.click('[data-testid="staff-analytics-tab"]');
    await page.waitForSelector('[data-testid="staff-performance"]', { timeout: 10000 });
    
    // Check staff list with Swedish names
    const staffMembers = ['Anna Svensson', 'Erik Johansson', 'Maria Lindström'];
    for (const staff of staffMembers) {
      await expect(page.locator(`[data-testid="staff-${staff.replace(' ', '-').toLowerCase()}"]`)).toBeVisible();
    }
    
    // Check performance metrics
    await expect(page.locator('[data-testid="feedback-per-staff"]')).toBeVisible();
    await expect(page.locator('[data-testid="quality-score-by-staff"]')).toBeVisible();
    await expect(page.locator('[data-testid="mentions-by-staff"]')).toBeVisible();
    
    // Filter by department
    await page.select('[data-testid="department-filter"]', 'Kök');
    await page.waitForSelector('[data-testid="filtered-results"]', { timeout: 5000 });
  });

  test('should handle real-time notifications', async ({ page }) => {
    await loginAsBusiness(page);
    
    // Wait for WebSocket connection
    await page.waitForSelector('[data-testid="connection-status-connected"]', { timeout: 10000 });
    
    // Simulate new feedback notification
    await page.evaluate(() => {
      // Mock WebSocket message
      window.mockWebSocketMessage({
        type: 'new_feedback',
        data: {
          id: 'feedback-test-001',
          qualityScore: 85,
          categories: ['Service'],
          timestamp: new Date().toISOString()
        }
      });
    });
    
    // Check notification appears
    await page.waitForSelector('[data-testid="notification-popup"]', { timeout: 5000 });
    await expect(page.locator('[data-testid="notification-message"]')).toContainText('Ny feedback mottagen');
    
    // Click notification to view details
    await page.click('[data-testid="notification-popup"]');
    await page.waitForSelector('[data-testid="feedback-details-modal"]', { timeout: 5000 });
    
    await expect(page.locator('[data-testid="feedback-score"]')).toContainText('85');
  });

});

test.describe('Business Dashboard - Mobile Responsiveness', () => {
  
  test('should work correctly on mobile devices', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await loginAsBusiness(page);
    
    // Check mobile navigation
    await expect(page.locator('[data-testid="mobile-menu-btn"]')).toBeVisible();
    
    // Open mobile menu
    await page.click('[data-testid="mobile-menu-btn"]');
    await page.waitForSelector('[data-testid="mobile-menu"]', { timeout: 5000 });
    
    // Navigate via mobile menu
    await page.click('[data-testid="mobile-menu-analytics"]');
    await page.waitForSelector('[data-testid="analytics-dashboard"]', { timeout: 10000 });
    
    // Check charts are responsive
    await expect(page.locator('[data-testid="feedback-trends-chart"]')).toBeVisible();
    
    // Check that charts fit in mobile viewport
    const chartElement = await page.locator('[data-testid="feedback-trends-chart"]');
    const boundingBox = await chartElement.boundingBox();
    expect(boundingBox.width).toBeLessThanOrEqual(375);
  });

});

// Helper function for business login
async function loginAsBusiness(page) {
  await page.goto('http://localhost:3002');
  await page.fill('[data-testid="email-input"]', 'aurora@feedbackai.se');
  await page.fill('[data-testid="password-input"]', 'testpassword123');
  await page.click('[data-testid="login-btn"]');
  await page.waitForSelector('[data-testid="dashboard-overview"]', { timeout: 15000 });
}