/**
 * Admin System E2E Tests
 * Tests admin dashboard functionality and system management
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

test.describe('Admin System - Core Functions', () => {
  
  test('should login and display system overview', async ({ page }) => {
    // Navigate to admin system
    await page.goto('http://localhost:3001/admin');
    
    // Login with admin credentials
    await page.fill('[data-testid="admin-email"]', 'admin@feedbackai.se');
    await page.fill('[data-testid="admin-password"]', 'adminpassword123');
    await page.click('[data-testid="admin-login-btn"]');
    
    // Wait for admin dashboard to load
    await page.waitForSelector('[data-testid="admin-dashboard"]', { timeout: 15000 });
    
    // Verify system metrics are displayed
    await expect(page.locator('[data-testid="total-businesses"]')).toBeVisible();
    await expect(page.locator('[data-testid="active-sessions"]')).toBeVisible();
    await expect(page.locator('[data-testid="system-uptime"]')).toBeVisible();
    await expect(page.locator('[data-testid="total-revenue"]')).toBeVisible();
    
    // Check Swedish localization
    await expect(page.locator('[data-testid="system-status"]')).toContainText('Systemstatus');
  });

  test('should manage business approval queue', async ({ page }) => {
    await loginAsAdmin(page);
    
    // Navigate to business management
    await page.click('[data-testid="business-management-tab"]');
    await page.waitForSelector('[data-testid="business-approval-queue"]', { timeout: 10000 });
    
    // Check pending approvals
    await expect(page.locator('[data-testid="pending-approvals-count"]')).toBeVisible();
    
    // Review first pending business
    await page.click('[data-testid="review-business-0"]');
    await page.waitForSelector('[data-testid="business-review-modal"]', { timeout: 5000 });
    
    // Verify Swedish business data
    await expect(page.locator('[data-testid="org-number"]')).toContainText('556');
    await expect(page.locator('[data-testid="business-address"]')).toContainText('Stockholm');
    
    // Approve business
    await page.fill('[data-testid="approval-notes"]', 'Godkänd - uppfyller alla krav');
    await page.click('[data-testid="approve-business-btn"]');
    await page.waitForSelector('[data-testid="approval-success"]', { timeout: 10000 });
    
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Företag godkänt');
  });

  test('should monitor real-time fraud alerts', async ({ page }) => {
    await loginAsAdmin(page);
    
    // Navigate to fraud management
    await page.click('[data-testid="fraud-management-tab"]');
    await page.waitForSelector('[data-testid="fraud-dashboard"]', { timeout: 10000 });
    
    // Check fraud metrics
    await expect(page.locator('[data-testid="fraud-alerts-today"]')).toBeVisible();
    await expect(page.locator('[data-testid="fraud-prevention-rate"]')).toBeVisible();
    
    // Simulate real-time fraud alert
    await page.evaluate(() => {
      window.mockWebSocketMessage({
        type: 'fraud_alert',
        severity: 'high',
        data: {
          customerId: 'customer-suspicious-001',
          businessId: 'business-001',
          riskScore: 0.87,
          reasons: ['Geographic clustering', 'Device fingerprint match'],
          timestamp: new Date().toISOString()
        }
      });
    });
    
    // Check alert appears
    await page.waitForSelector('[data-testid="fraud-alert-popup"]', { timeout: 5000 });
    await expect(page.locator('[data-testid="alert-severity"]')).toContainText('Hög');
    
    // Review alert details
    await page.click('[data-testid="review-alert-btn"]');
    await page.waitForSelector('[data-testid="fraud-case-details"]', { timeout: 5000 });
    
    // Take action on fraud case
    await page.click('[data-testid="ban-customer-btn"]');
    await page.select('[data-testid="ban-reason"]', 'fraud_suspected');
    await page.fill('[data-testid="ban-notes"]', 'Misstänkt bedrägeri - geografiska mönster');
    await page.click('[data-testid="confirm-ban-btn"]');
    
    await page.waitForSelector('[data-testid="ban-success"]', { timeout: 10000 });
  });

  test('should manage AI model calibration', async ({ page }) => {
    await loginAsAdmin(page);
    
    // Navigate to AI management
    await page.click('[data-testid="ai-management-tab"]');
    await page.waitForSelector('[data-testid="ai-calibration-tools"]', { timeout: 10000 });
    
    // Check current model performance
    await expect(page.locator('[data-testid="model-accuracy"]')).toBeVisible();
    await expect(page.locator('[data-testid="average-processing-time"]')).toBeVisible();
    
    // Review scoring consistency
    await page.click('[data-testid="scoring-consistency-tab"]');
    await page.waitForSelector('[data-testid="consistency-metrics"]', { timeout: 5000 });
    
    // Check for outlier scores
    await expect(page.locator('[data-testid="outlier-scores"]')).toBeVisible();
    
    // Perform manual score override
    await page.click('[data-testid="manual-override-tab"]');
    await page.waitForSelector('[data-testid="score-override-interface"]', { timeout: 5000 });
    
    await page.fill('[data-testid="feedback-id"]', 'feedback-outlier-001');
    await page.fill('[data-testid="override-score"]', '75');
    await page.fill('[data-testid="override-reason"]', 'AI överskattade kvalitet - manuell korrigering');
    
    await page.click('[data-testid="apply-override-btn"]');
    await page.waitForSelector('[data-testid="override-success"]', { timeout: 10000 });
  });

  test('should generate system reports', async ({ page }) => {
    await loginAsAdmin(page);
    
    // Navigate to reports section
    await page.click('[data-testid="reports-tab"]');
    await page.waitForSelector('[data-testid="report-generator"]', { timeout: 10000 });
    
    // Generate Swedish pilot performance report
    await page.select('[data-testid="report-type"]', 'pilot_performance');
    await page.fill('[data-testid="report-date-from"]', '2024-01-01');
    await page.fill('[data-testid="report-date-to"]', '2024-12-31');
    
    await page.click('[data-testid="generate-report-btn"]');
    await page.waitForSelector('[data-testid="report-generating"]', { timeout: 5000 });
    
    // Wait for report generation
    await page.waitForSelector('[data-testid="report-ready"]', { timeout: 20000 });
    
    // Download report
    const [reportDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.click('[data-testid="download-report-btn"]')
    ]);
    
    expect(reportDownload.suggestedFilename()).toMatch(/pilot-performance-.*\.pdf$/);
    
    // Generate business analytics report
    await page.select('[data-testid="report-type"]', 'business_analytics');
    await page.click('[data-testid="generate-report-btn"]');
    await page.waitForSelector('[data-testid="report-ready"]', { timeout: 20000 });
    
    const [analyticsDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.click('[data-testid="download-report-btn"]')
    ]);
    
    expect(analyticsDownload.suggestedFilename()).toMatch(/business-analytics-.*\.xlsx$/);
  });

});

test.describe('Admin System - Advanced Management', () => {
  
  test('should handle tier management for businesses', async ({ page }) => {
    await loginAsAdmin(page);
    
    // Navigate to tier management
    await page.click('[data-testid="tier-management-tab"]');
    await page.waitForSelector('[data-testid="business-tiers"]', { timeout: 10000 });
    
    // Search for specific business
    await page.fill('[data-testid="business-search"]', 'Café Aurora');
    await page.press('[data-testid="business-search"]', 'Enter');
    
    await page.waitForSelector('[data-testid="search-results"]', { timeout: 5000 });
    
    // Select business for tier adjustment
    await page.click('[data-testid="business-result-0"]');
    await page.waitForSelector('[data-testid="business-tier-details"]', { timeout: 5000 });
    
    // Check current tier
    await expect(page.locator('[data-testid="current-tier"]')).toContainText('Nivå');
    
    // Upgrade tier
    await page.click('[data-testid="upgrade-tier-btn"]');
    await page.fill('[data-testid="upgrade-reason"]', 'Stark prestanda - förtjänar uppgradering');
    await page.click('[data-testid="confirm-upgrade-btn"]');
    
    await page.waitForSelector('[data-testid="tier-upgrade-success"]', { timeout: 10000 });
    
    // Verify new limits are applied
    await expect(page.locator('[data-testid="new-daily-limit"]')).toContainText('1000 SEK');
  });

  test('should monitor system performance and alerts', async ({ page }) => {
    await loginAsAdmin(page);
    
    // Navigate to system monitoring
    await page.click('[data-testid="system-monitoring-tab"]');
    await page.waitForSelector('[data-testid="performance-dashboard"]', { timeout: 10000 });
    
    // Check key performance indicators
    await expect(page.locator('[data-testid="response-time-chart"]')).toBeVisible();
    await expect(page.locator('[data-testid="concurrent-sessions"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-rate"]')).toBeVisible();
    await expect(page.locator('[data-testid="queue-length"]')).toBeVisible();
    
    // Check Swedish café specific metrics
    await page.click('[data-testid="swedish-cafes-tab"]');
    await page.waitForSelector('[data-testid="cafe-metrics"]', { timeout: 5000 });
    
    const cafes = ['Aurora Stockholm', 'Malmö Huset', 'Göteborg Kaffehus'];
    for (const cafe of cafes) {
      await expect(page.locator(`[data-testid="cafe-${cafe.replace(/\s+/g, '-').toLowerCase()}"]`)).toBeVisible();
    }
    
    // Simulate system alert
    await page.evaluate(() => {
      window.mockWebSocketMessage({
        type: 'system_alert',
        severity: 'medium',
        message: 'AI processing latency above threshold',
        metric: 'ai_response_time',
        value: 3.2,
        threshold: 2.0,
        timestamp: new Date().toISOString()
      });
    });
    
    // Check alert notification
    await page.waitForSelector('[data-testid="system-alert-notification"]', { timeout: 5000 });
    await expect(page.locator('[data-testid="alert-message"]')).toContainText('AI processing latency');
    
    // Acknowledge alert
    await page.click('[data-testid="acknowledge-alert-btn"]');
    await page.waitForSelector('[data-testid="alert-acknowledged"]', { timeout: 5000 });
  });

  test('should manage commission rates and overrides', async ({ page }) => {
    await loginAsAdmin(page);
    
    // Navigate to financial management
    await page.click('[data-testid="financial-management-tab"]');
    await page.waitForSelector('[data-testid="commission-management"]', { timeout: 10000 });
    
    // Check default commission rates
    await expect(page.locator('[data-testid="tier-1-rate"]')).toContainText('20%');
    await expect(page.locator('[data-testid="tier-2-rate"]')).toContainText('18%');
    await expect(page.locator('[data-testid="tier-3-rate"]')).toContainText('15%');
    
    // Apply special commission rate for specific business
    await page.click('[data-testid="special-rates-tab"]');
    await page.waitForSelector('[data-testid="special-commission-interface"]', { timeout: 5000 });
    
    await page.fill('[data-testid="business-search"]', 'Aurora');
    await page.click('[data-testid="search-btn"]');
    await page.waitForSelector('[data-testid="business-found"]', { timeout: 5000 });
    
    await page.fill('[data-testid="special-rate"]', '17');
    await page.fill('[data-testid="rate-reason"]', 'Pilotpartner - specialtaxa');
    await page.fill('[data-testid="rate-expiry"]', '2024-12-31');
    
    await page.click('[data-testid="apply-special-rate-btn"]');
    await page.waitForSelector('[data-testid="rate-applied"]', { timeout: 10000 });
    
    // Verify in audit log
    await page.click('[data-testid="audit-log-tab"]');
    await page.waitForSelector('[data-testid="audit-entries"]', { timeout: 5000 });
    
    await expect(page.locator('[data-testid="latest-audit-entry"]')).toContainText('Commission rate override');
  });

});

test.describe('Admin System - Emergency Procedures', () => {
  
  test('should handle system emergency shutdown', async ({ page }) => {
    await loginAsAdmin(page);
    
    // Navigate to emergency controls
    await page.click('[data-testid="emergency-controls-tab"]');
    await page.waitForSelector('[data-testid="emergency-dashboard"]', { timeout: 10000 });
    
    // Check emergency status
    await expect(page.locator('[data-testid="system-status"]')).toContainText('Normal');
    
    // Simulate emergency situation
    await page.click('[data-testid="emergency-actions-btn"]');
    await page.waitForSelector('[data-testid="emergency-actions-modal"]', { timeout: 5000 });
    
    // Test pause new sessions
    await page.click('[data-testid="pause-new-sessions-btn"]');
    await page.fill('[data-testid="emergency-reason"]', 'Systemunderhåll - planerat');
    await page.click('[data-testid="confirm-pause-btn"]');
    
    await page.waitForSelector('[data-testid="sessions-paused"]', { timeout: 10000 });
    await expect(page.locator('[data-testid="system-status"]')).toContainText('Nya sessioner pausade');
    
    // Resume normal operations
    await page.click('[data-testid="resume-sessions-btn"]');
    await page.click('[data-testid="confirm-resume-btn"]');
    
    await page.waitForSelector('[data-testid="sessions-resumed"]', { timeout: 10000 });
    await expect(page.locator('[data-testid="system-status"]')).toContainText('Normal');
  });

  test('should broadcast system maintenance messages', async ({ page }) => {
    await loginAsAdmin(page);
    
    // Navigate to system communications
    await page.click('[data-testid="system-communications-tab"]');
    await page.waitForSelector('[data-testid="broadcast-interface"]', { timeout: 10000 });
    
    // Create maintenance notification
    await page.select('[data-testid="message-type"]', 'maintenance');
    await page.fill('[data-testid="message-title"]', 'Planerat systemunderhåll');
    await page.fill('[data-testid="message-content"]', 'Systemet kommer vara otillgängligt 02:00-04:00 för underhåll.');
    
    // Schedule message
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    await page.fill('[data-testid="schedule-date"]', tomorrow.toISOString().split('T')[0]);
    await page.fill('[data-testid="schedule-time"]', '01:55');
    
    // Target Swedish businesses only
    await page.check('[data-testid="target-swedish-businesses"]');
    
    await page.click('[data-testid="schedule-broadcast-btn"]');
    await page.waitForSelector('[data-testid="broadcast-scheduled"]', { timeout: 10000 });
    
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Meddelande schemalagt');
  });

});

// Helper function for admin login
async function loginAsAdmin(page) {
  await page.goto('http://localhost:3001/admin');
  await page.fill('[data-testid="admin-email"]', 'admin@feedbackai.se');
  await page.fill('[data-testid="admin-password"]', 'adminpassword123');
  await page.click('[data-testid="admin-login-btn"]');
  await page.waitForSelector('[data-testid="admin-dashboard"]', { timeout: 15000 });
}