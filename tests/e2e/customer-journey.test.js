/**
 * Complete Customer Journey E2E Tests
 * Tests the full customer experience from QR scan to reward payment
 */

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs').promises;

// Load test fixtures
let swedishTestData, qrCodes, authTokens;

test.beforeAll(async () => {
  // Load Swedish test data
  try {
    const testDataPath = path.join(__dirname, 'fixtures/swedish-test-data.json');
    swedishTestData = JSON.parse(await fs.readFile(testDataPath, 'utf8'));
    
    const qrCodesPath = path.join(__dirname, 'fixtures/qr-codes.json');
    qrCodes = JSON.parse(await fs.readFile(qrCodesPath, 'utf8'));
    
    const authPath = path.join(__dirname, 'fixtures/auth-tokens.json');
    authTokens = JSON.parse(await fs.readFile(authPath, 'utf8'));
    
  } catch (error) {
    console.error('Failed to load test fixtures:', error);
    throw error;
  }
});

test.describe('Customer Journey - Complete Flow', () => {
  
  test('should complete full journey from QR scan to reward on mobile device', async ({ page, browserName }) => {
    // Skip on desktop browsers for this mobile-specific test
    test.skip(browserName === 'chromium' && !page.context()._options.isMobile, 
      'This test is for mobile devices only');
    
    const cafe = swedishTestData.cafes[0]; // Café Aurora Stockholm
    const transaction = swedishTestData.transactions[0];
    const qrCode = qrCodes['aurora-stockholm'];
    
    console.log(`🧪 Testing customer journey for ${cafe.name}`);
    
    // Step 1: Scan QR Code (simulate by navigating to QR URL)
    await page.goto(qrCode.url);
    await page.waitForLoadState('networkidle');
    
    // Verify PWA loaded correctly
    await expect(page.locator('[data-testid="qr-scanner"]')).toBeVisible();
    await expect(page.locator('text=Café Aurora Stockholm')).toBeVisible();
    
    // Step 2: Transaction Verification
    await page.click('[data-testid="start-verification-btn"]');
    
    // Fill transaction details
    await page.fill('[data-testid="transaction-id"]', transaction.id);
    await page.fill('[data-testid="purchase-amount"]', transaction.amount.toString());
    
    // Select purchase time (within last 15 minutes)
    const currentTime = new Date();
    const purchaseTime = new Date(currentTime.getTime() - 5 * 60000); // 5 minutes ago
    await page.fill('[data-testid="purchase-time"]', purchaseTime.toTimeString().slice(0, 5));
    
    await page.click('[data-testid="verify-transaction-btn"]');
    await page.waitForSelector('[data-testid="verification-success"]', { timeout: 10000 });
    
    // Step 3: Voice Recording Setup
    await page.click('[data-testid="start-voice-feedback-btn"]');
    
    // Grant microphone permissions (simulated)
    await page.evaluate(() => {
      // Mock getUserMedia for testing
      navigator.mediaDevices.getUserMedia = () => Promise.resolve({
        getTracks: () => [{ stop: () => {} }],
        getVideoTracks: () => [],
        getAudioTracks: () => [{ stop: () => {} }]
      });
    });
    
    // Wait for voice interface to load
    await page.waitForSelector('[data-testid="voice-recorder"]', { timeout: 15000 });
    await expect(page.locator('[data-testid="recording-status"]')).toContainText('Redo att spela in');
    
    // Step 4: Simulate Voice Recording
    await page.click('[data-testid="start-recording-btn"]');
    
    // Wait for recording to start
    await page.waitForSelector('[data-testid="recording-active"]', { timeout: 5000 });
    
    // Simulate voice input by injecting test audio data
    await page.evaluate(() => {
      // Mock audio processing for testing
      window.mockVoiceInput = {
        transcript: 'Jag besökte caféet idag och beställde en latte och kanelbulle. Servicen var mycket bra, personalen var vänlig och maten var färsk. Lokalen var ren och atmosfären var mysig. Jag kommer definitivt tillbaka hit igen.',
        confidence: 0.95,
        language: 'sv-SE'
      };
    });
    
    // Wait for recording to process (simulate 3 seconds of recording)
    await page.waitForTimeout(3000);
    
    await page.click('[data-testid="stop-recording-btn"]');
    
    // Step 5: AI Processing and Quality Scoring
    await page.waitForSelector('[data-testid="ai-processing"]', { timeout: 10000 });
    await expect(page.locator('[data-testid="processing-status"]')).toContainText('Analyserar din feedback');
    
    // Wait for AI analysis to complete
    await page.waitForSelector('[data-testid="quality-score"]', { timeout: 20000 });
    
    // Verify quality score is displayed
    const qualityScore = await page.locator('[data-testid="quality-score-value"]').textContent();
    expect(parseInt(qualityScore)).toBeGreaterThan(60); // Should be a good score
    
    // Verify score components are shown
    await expect(page.locator('[data-testid="authenticity-score"]')).toBeVisible();
    await expect(page.locator('[data-testid="concreteness-score"]')).toBeVisible();
    await expect(page.locator('[data-testid="depth-score"]')).toBeVisible();
    
    // Step 6: Reward Calculation
    await page.waitForSelector('[data-testid="reward-calculation"]', { timeout: 5000 });
    
    const rewardAmount = await page.locator('[data-testid="reward-amount"]').textContent();
    expect(rewardAmount).toMatch(/\d+(\.\d{2})?\s*SEK/); // Should show amount in SEK
    
    // Verify reward percentage is shown
    const rewardPercentage = await page.locator('[data-testid="reward-percentage"]').textContent();
    expect(rewardPercentage).toMatch(/\d+(\.\d+)?%/);
    
    // Step 7: Payment Processing
    await page.click('[data-testid="accept-reward-btn"]');
    
    // Select payment method (Swish for Swedish testing)
    await page.click('[data-testid="payment-method-swish"]');
    await page.fill('[data-testid="swish-number"]', '0701234567');
    
    await page.click('[data-testid="process-payment-btn"]');
    
    // Wait for payment processing
    await page.waitForSelector('[data-testid="payment-processing"]', { timeout: 10000 });
    
    // Step 8: Payment Success
    await page.waitForSelector('[data-testid="payment-success"]', { timeout: 15000 });
    
    await expect(page.locator('[data-testid="payment-status"]')).toContainText('Betalning genomförd');
    await expect(page.locator('[data-testid="transaction-id"]')).toBeVisible();
    
    // Step 9: Thank You & Survey
    await expect(page.locator('[data-testid="thank-you-message"]')).toContainText('Tack för din feedback');
    
    // Verify session completion
    await page.waitForSelector('[data-testid="session-complete"]', { timeout: 5000 });
    
    console.log('✅ Complete customer journey test passed');
  });

  test('should handle transaction verification edge cases', async ({ page }) => {
    const qrCode = qrCodes['malmohuset'];
    
    await page.goto(qrCode.url);
    await page.click('[data-testid="start-verification-btn"]');
    
    // Test invalid transaction ID
    await page.fill('[data-testid="transaction-id"]', 'INVALID-TXN-ID');
    await page.fill('[data-testid="purchase-amount"]', '65.50');
    await page.fill('[data-testid="purchase-time"]', '14:30');
    
    await page.click('[data-testid="verify-transaction-btn"]');
    await page.waitForSelector('[data-testid="verification-error"]', { timeout: 10000 });
    
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Transaktionen kunde inte verifieras');
    
    // Test expired transaction (older than 15 minutes)
    await page.fill('[data-testid="transaction-id"]', 'TXN-EXPIRED-001');
    const expiredTime = new Date(Date.now() - 20 * 60000); // 20 minutes ago
    await page.fill('[data-testid="purchase-time"]', expiredTime.toTimeString().slice(0, 5));
    
    await page.click('[data-testid="verify-transaction-btn"]');
    await page.waitForSelector('[data-testid="verification-error"]', { timeout: 10000 });
    
    await expect(page.locator('[data-testid="error-message"]')).toContainText('För gammal transaktion');
  });

  test('should handle voice recording failures gracefully', async ({ page }) => {
    const qrCode = qrCodes['goteborg-kaffehus'];
    const transaction = swedishTestData.transactions[1];
    
    await page.goto(qrCode.url);
    
    // Complete verification step
    await page.click('[data-testid="start-verification-btn"]');
    await page.fill('[data-testid="transaction-id"]', transaction.id);
    await page.fill('[data-testid="purchase-amount"]', transaction.amount.toString());
    await page.fill('[data-testid="purchase-time"]', '15:45');
    await page.click('[data-testid="verify-transaction-btn"]');
    await page.waitForSelector('[data-testid="verification-success"]', { timeout: 10000 });
    
    // Start voice recording
    await page.click('[data-testid="start-voice-feedback-btn"]');
    
    // Simulate microphone permission denied
    await page.evaluate(() => {
      navigator.mediaDevices.getUserMedia = () => Promise.reject(new Error('Permission denied'));
    });
    
    await page.waitForSelector('[data-testid="microphone-error"]', { timeout: 10000 });
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Mikrofon');
    
    // Verify fallback option is provided
    await expect(page.locator('[data-testid="text-feedback-fallback"]')).toBeVisible();
  });

  test('should maintain session state across page reloads', async ({ page }) => {
    const qrCode = qrCodes['aurora-stockholm'];
    const transaction = swedishTestData.transactions[0];
    
    await page.goto(qrCode.url);
    
    // Complete verification
    await page.click('[data-testid="start-verification-btn"]');
    await page.fill('[data-testid="transaction-id"]', transaction.id);
    await page.fill('[data-testid="purchase-amount"]', transaction.amount.toString());
    await page.fill('[data-testid="purchase-time"]', '16:20');
    await page.click('[data-testid="verify-transaction-btn"]');
    await page.waitForSelector('[data-testid="verification-success"]', { timeout: 10000 });
    
    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Verify session is restored
    await expect(page.locator('[data-testid="session-restored"]')).toBeVisible();
    await expect(page.locator('[data-testid="verification-success"]')).toBeVisible();
    
    // Should be able to proceed to voice recording
    await page.click('[data-testid="start-voice-feedback-btn"]');
    await page.waitForSelector('[data-testid="voice-recorder"]', { timeout: 10000 });
  });

});

test.describe('Customer Journey - Performance Tests', () => {
  
  test('should complete journey within performance thresholds', async ({ page }) => {
    const startTime = Date.now();
    const qrCode = qrCodes['aurora-stockholm'];
    const transaction = swedishTestData.transactions[0];
    
    // Complete full journey
    await page.goto(qrCode.url);
    
    // Verification step
    await page.click('[data-testid="start-verification-btn"]');
    await page.fill('[data-testid="transaction-id"]', transaction.id);
    await page.fill('[data-testid="purchase-amount"]', transaction.amount.toString());
    await page.fill('[data-testid="purchase-time"]', '17:15');
    await page.click('[data-testid="verify-transaction-btn"]');
    await page.waitForSelector('[data-testid="verification-success"]', { timeout: 10000 });
    
    // Voice feedback step
    await page.click('[data-testid="start-voice-feedback-btn"]');
    
    // Mock fast AI processing
    await page.evaluate(() => {
      window.mockFastAIProcessing = true;
    });
    
    await page.waitForSelector('[data-testid="voice-recorder"]', { timeout: 10000 });
    await page.click('[data-testid="start-recording-btn"]');
    await page.waitForTimeout(2000); // Simulate quick recording
    await page.click('[data-testid="stop-recording-btn"]');
    
    // AI processing
    const aiProcessingStart = Date.now();
    await page.waitForSelector('[data-testid="quality-score"]', { timeout: 15000 });
    const aiProcessingTime = Date.now() - aiProcessingStart;
    
    // Verify AI processing time is under 5 seconds
    expect(aiProcessingTime).toBeLessThan(5000);
    
    // Payment processing
    await page.click('[data-testid="accept-reward-btn"]');
    await page.click('[data-testid="payment-method-swish"]');
    await page.fill('[data-testid="swish-number"]', '0701234567');
    
    const paymentStart = Date.now();
    await page.click('[data-testid="process-payment-btn"]');
    await page.waitForSelector('[data-testid="payment-success"]', { timeout: 10000 });
    const paymentTime = Date.now() - paymentStart;
    
    // Verify payment processing time is under 3 seconds
    expect(paymentTime).toBeLessThan(3000);
    
    const totalTime = Date.now() - startTime;
    console.log(`⏱️ Total journey time: ${totalTime}ms`);
    console.log(`⚡ AI processing time: ${aiProcessingTime}ms`);
    console.log(`💳 Payment processing time: ${paymentTime}ms`);
    
    // Total journey should complete in under 60 seconds
    expect(totalTime).toBeLessThan(60000);
  });

});