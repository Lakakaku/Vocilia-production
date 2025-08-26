/**
 * iOS Safari Validation Test Suite for Swedish Pilot Program
 * Comprehensive testing of all critical features on iOS devices
 */

const { test, expect, devices } = require('@playwright/test');
const path = require('path');
const fs = require('fs').promises;

// iOS devices for pilot validation
const PILOT_IOS_DEVICES = [
  { name: 'iPhone 15 Pro', device: devices['iPhone 15 Pro'], market: 'High-end Swedish users' },
  { name: 'iPhone 14', device: devices['iPhone 14'], market: 'Most common Swedish iPhone' },
  { name: 'iPhone 13', device: devices['iPhone 13'], market: 'Popular in Swedish market' },
  { name: 'iPhone SE', device: devices['iPhone SE'], market: 'Budget-conscious Swedish users' },
  { name: 'iPad Pro', device: devices['iPad Pro'], market: 'Business users' },
  { name: 'iPad Air', device: devices['iPad Air'], market: 'General Swedish tablet users' }
];

let swedishTestData;

test.beforeAll(async () => {
  try {
    const testDataPath = path.join(__dirname, 'fixtures/swedish-test-data.json');
    swedishTestData = JSON.parse(await fs.readFile(testDataPath, 'utf8'));
  } catch (error) {
    console.error('Failed to load Swedish test data:', error);
    throw error;
  }
});

PILOT_IOS_DEVICES.forEach(({ name, device, market }) => {
  test.describe(`iOS Pilot Validation - ${name} (${market})`, () => {
    test.use(device);

    test.beforeEach(async ({ page, context }) => {
      // Grant all necessary permissions
      await context.grantPermissions(['microphone', 'camera', 'geolocation']);
      
      // Configure iOS-specific behavior
      await page.addInitScript(() => {
        // Mock iOS-specific APIs
        window.__IOS_TEST_MODE__ = true;
        
        // Mock getUserMedia with iOS-specific constraints
        Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
          value: async (constraints) => {
            const mockStream = {
              id: 'mock-stream-id',
              active: true,
              getTracks: () => [{
                id: 'mock-audio-track',
                kind: 'audio',
                label: 'Mock Audio Track',
                enabled: true,
                stop: () => {},
                getSettings: () => ({
                  sampleRate: 48000, // iOS typically uses 48kHz
                  channelCount: 1,
                  echoCancellation: true,
                  noiseSuppression: true
                })
              }],
              getAudioTracks: function() { return this.getTracks(); },
              getVideoTracks: () => []
            };
            
            return mockStream;
          },
          writable: true
        });

        // Mock iOS MediaRecorder if not available
        if (!window.MediaRecorder) {
          window.MediaRecorder = class MockMediaRecorder {
            constructor(stream, options) {
              this.stream = stream;
              this.options = options;
              this.state = 'inactive';
              this.ondataavailable = null;
              this.onstop = null;
            }
            
            start(timeslice) {
              this.state = 'recording';
              setTimeout(() => {
                if (this.ondataavailable) {
                  this.ondataavailable({
                    data: new Blob(['mock-audio-data'], { type: 'audio/wav' })
                  });
                }
              }, timeslice || 1000);
            }
            
            stop() {
              this.state = 'inactive';
              if (this.onstop) {
                this.onstop();
              }
            }
            
            static isTypeSupported(type) {
              return type === 'audio/wav' || type === 'audio/mp4';
            }
          };
        }

        // Mock Swedish voice synthesis
        if (!window.speechSynthesis) {
          window.speechSynthesis = {
            speak: (utterance) => {
              setTimeout(() => {
                if (utterance.onend) utterance.onend();
              }, 1000);
            },
            getVoices: () => [{
              name: 'Swedish Voice',
              lang: 'sv-SE',
              default: true
            }]
          };
        }

        // Store device capabilities
        window.__DEVICE_CAPABILITIES__ = {
          name: '${name}',
          hasMediaRecorder: !!window.MediaRecorder,
          hasWebAudio: !!window.AudioContext || !!window.webkitAudioContext,
          hasWebRTC: !!window.RTCPeerConnection,
          hasServiceWorker: 'serviceWorker' in navigator,
          isStandalone: window.matchMedia('(display-mode: standalone)').matches,
          userAgent: navigator.userAgent
        };
      });
    });

    test('should complete full Swedish customer journey on iOS', async ({ page }) => {
      console.log(`🧪 Testing complete customer journey on ${name} for Swedish pilot`);
      
      // Step 1: Load PWA
      await page.goto('http://localhost:3000');
      
      // Verify PWA loads correctly on iOS
      await expect(page.locator('[data-testid="app-container"]')).toBeVisible();
      
      // Check for iOS-specific UI adaptations
      const isIOS = await page.evaluate(() => /iPad|iPhone|iPod/.test(navigator.userAgent));
      if (isIOS) {
        await expect(page.locator('[data-testid="ios-optimized-ui"]')).toBeVisible();
      }

      // Step 2: QR Code Simulation (since we can't scan in test)
      const cafe = swedishTestData.cafes[0]; // Café Aurora Stockholm
      const qrUrl = `http://localhost:3000?qr=aurora-stockholm&cafe=${encodeURIComponent(cafe.name)}`;
      
      await page.goto(qrUrl);
      await page.waitForLoadState('networkidle');
      
      // Verify Swedish café context is loaded
      await expect(page.locator('[data-testid="cafe-name"]')).toContainText('Café Aurora Stockholm');
      await expect(page.locator('[data-testid="swedish-context"]')).toBeVisible();

      // Step 3: Transaction Verification with Swedish data
      await page.click('[data-testid="start-verification-btn"]');
      
      const transaction = swedishTestData.transactions[0];
      await page.fill('[data-testid="transaction-id"]', transaction.id);
      await page.fill('[data-testid="purchase-amount"]', transaction.amount.toString());
      
      // Set time to 5 minutes ago (within Swedish business hours)
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60000);
      await page.fill('[data-testid="purchase-time"]', fiveMinutesAgo.toTimeString().slice(0, 5));
      
      await page.click('[data-testid="verify-transaction-btn"]');
      await page.waitForSelector('[data-testid="verification-success"]', { timeout: 10000 });
      
      // Verify Swedish success message
      await expect(page.locator('[data-testid="success-message"]')).toContainText('Transaktion verifierad');

      // Step 4: Voice Recording on iOS
      await page.click('[data-testid="start-voice-feedback-btn"]');
      await page.waitForSelector('[data-testid="voice-interface"]', { timeout: 15000 });
      
      // Check microphone permission status
      const micPermission = await page.evaluate(async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach(track => track.stop());
          return 'granted';
        } catch (error) {
          return 'denied';
        }
      });
      
      expect(micPermission).toBe('granted');
      
      // Start recording
      await page.click('[data-testid="start-recording-btn"]');
      await page.waitForSelector('[data-testid="recording-active"]', { timeout: 5000 });
      
      // Simulate Swedish voice input
      await page.evaluate(() => {
        // Mock Swedish feedback
        const swedishFeedback = 'Jag besökte caféet idag och beställde en latte och kanelbulle. Servicen var mycket bra, personalen var vänlig och atmosfären var mysig. Jag kommer definitivt tillbaka.';
        
        window.mockVoiceRecognition = {
          transcript: swedishFeedback,
          confidence: 0.92,
          language: 'sv-SE',
          isFinal: true
        };
        
        // Trigger voice recognition event
        if (window.onVoiceRecognitionResult) {
          window.onVoiceRecognitionResult(window.mockVoiceRecognition);
        }
      });
      
      // Wait for recording to process
      await page.waitForTimeout(3000);
      await page.click('[data-testid="stop-recording-btn"]');

      // Step 5: AI Processing and Swedish Quality Scoring
      await page.waitForSelector('[data-testid="ai-processing"]', { timeout: 10000 });
      
      // Wait for Swedish AI analysis
      await page.waitForSelector('[data-testid="quality-score-result"]', { timeout: 20000 });
      
      // Verify Swedish quality score display
      const qualityScore = await page.locator('[data-testid="quality-score-value"]').textContent();
      expect(parseInt(qualityScore)).toBeGreaterThanOrEqual(70); // Should be good score for quality Swedish feedback
      
      // Check Swedish score explanations
      await expect(page.locator('[data-testid="authenticity-explanation"]')).toContainText('Äkthet');
      await expect(page.locator('[data-testid="concreteness-explanation"]')).toContainText('Konkrethet');
      await expect(page.locator('[data-testid="depth-explanation"]')).toContainText('Djup');

      // Step 6: Swedish Reward Calculation
      await page.waitForSelector('[data-testid="reward-calculation"]', { timeout: 5000 });
      
      const rewardAmount = await page.locator('[data-testid="reward-amount"]').textContent();
      expect(rewardAmount).toMatch(/\d+[,.]?\d*\s*SEK/); // Swedish currency format
      
      const rewardPercentage = await page.locator('[data-testid="reward-percentage"]').textContent();
      expect(rewardPercentage).toMatch(/\d+[,.]?\d*\s*%/);

      // Step 7: Swedish Payment Methods
      await page.click('[data-testid="accept-reward-btn"]');
      
      // Verify Swedish payment options are available
      await expect(page.locator('[data-testid="payment-method-swish"]')).toBeVisible();
      await expect(page.locator('[data-testid="payment-method-bankgiro"]')).toBeVisible();
      await expect(page.locator('[data-testid="payment-method-iban"]')).toBeVisible();
      
      // Select Swish (most popular in Sweden)
      await page.click('[data-testid="payment-method-swish"]');
      await page.fill('[data-testid="swish-number"]', '0701234567');
      
      await page.click('[data-testid="process-payment-btn"]');
      
      // Step 8: Payment Success in Swedish
      await page.waitForSelector('[data-testid="payment-success"]', { timeout: 15000 });
      
      await expect(page.locator('[data-testid="success-title"]')).toContainText('Betalning genomförd');
      await expect(page.locator('[data-testid="thank-you-message"]')).toContainText('Tack för din feedback');
      
      // Verify transaction details
      await expect(page.locator('[data-testid="transaction-reference"]')).toBeVisible();
      
      console.log(`✅ Complete Swedish customer journey test passed on ${name}`);
    });

    test('should handle iOS-specific voice recording edge cases', async ({ page }) => {
      await page.goto('http://localhost:3000/feedback/voice');
      
      // Test iOS audio session management
      await page.evaluate(() => {
        // Simulate iOS audio interruption (phone call, notification, etc.)
        window.mockAudioInterruption = () => {
          if (window.audioContext && window.audioContext.state === 'running') {
            window.audioContext.suspend();
            setTimeout(() => {
              if (window.audioContext) {
                window.audioContext.resume();
              }
            }, 2000);
          }
        };
      });
      
      // Start recording
      await page.click('[data-testid="start-recording-btn"]');
      await page.waitForSelector('[data-testid="recording-active"]', { timeout: 5000 });
      
      // Simulate interruption
      await page.evaluate(() => window.mockAudioInterruption?.());
      
      // Verify graceful handling
      await page.waitForTimeout(3000);
      
      // Should either continue recording or show interruption handling
      const recordingStatus = await page.locator('[data-testid="recording-status"]').textContent();
      expect(['Spelar in', 'Återupptar inspelning', 'Inspelning pausad']).toContain(recordingStatus);
    });

    test('should work in iOS Safari standalone mode (PWA)', async ({ page }) => {
      // Simulate standalone mode
      await page.addInitScript(() => {
        Object.defineProperty(window, 'navigator', {
          value: {
            ...window.navigator,
            standalone: true
          },
          writable: true
        });
        
        Object.defineProperty(window, 'matchMedia', {
          value: (query) => ({
            matches: query.includes('display-mode: standalone'),
            addEventListener: () => {},
            removeEventListener: () => {}
          }),
          writable: true
        });
      });
      
      await page.goto('http://localhost:3000');
      
      // Verify PWA-specific UI
      await expect(page.locator('[data-testid="pwa-header"]')).toBeVisible();
      
      // Check that back button handling works in standalone mode
      await page.goBack();
      await page.waitForLoadState('networkidle');
      
      // Should handle navigation gracefully in standalone mode
      const currentUrl = page.url();
      expect(currentUrl).toContain('localhost:3000');
    });

    test('should handle Swedish text input with iOS keyboard', async ({ page }) => {
      await page.goto('http://localhost:3000/feedback/manual');
      
      // Test Swedish characters with iOS virtual keyboard
      const swedishText = 'Fantastisk service! Personalen var mycket vänlig och hjälpsam. Kaffet smakade utmärkt och atmosfären var mysig. Jag kan varmt rekommendera detta ställe till alla som vill ha en bra upplevelse. Åäö fungerar perfekt!';
      
      await page.fill('[data-testid="manual-feedback-input"]', swedishText);
      
      // Verify Swedish characters are preserved
      const inputValue = await page.locator('[data-testid="manual-feedback-input"]').inputValue();
      expect(inputValue).toContain('åäö');
      expect(inputValue).toContain('ställe');
      expect(inputValue).toBe(swedishText);
      
      // Submit and verify processing
      await page.click('[data-testid="submit-manual-feedback"]');
      await page.waitForSelector('[data-testid="feedback-processing"]', { timeout: 10000 });
      
      // Should process Swedish text correctly
      await page.waitForSelector('[data-testid="processing-complete"]', { timeout: 20000 });
    });

    test('should maintain performance standards on iOS device', async ({ page }) => {
      const startTime = Date.now();
      
      // Load main application
      await page.goto('http://localhost:3000');
      const loadTime = Date.now() - startTime;
      
      // iOS devices should load within 3 seconds
      expect(loadTime).toBeLessThan(3000);
      
      // Test voice interface performance
      const voiceStartTime = Date.now();
      await page.goto('http://localhost:3000/feedback/voice');
      await page.waitForSelector('[data-testid="voice-interface"]', { timeout: 10000 });
      const voiceLoadTime = Date.now() - voiceStartTime;
      
      // Voice interface should load within 2 seconds on iOS
      expect(voiceLoadTime).toBeLessThan(2000);
      
      // Test AI processing simulation performance
      await page.click('[data-testid="start-recording-btn"]');
      await page.waitForTimeout(2000);
      
      const aiProcessingStart = Date.now();
      await page.click('[data-testid="stop-recording-btn"]');
      
      // Mock AI processing
      await page.evaluate(() => {
        window.mockAIResult = {
          qualityScore: 85,
          authenticity: 90,
          concreteness: 80,
          depth: 85,
          reasoning: 'Bra feedback med konkreta exempel'
        };
      });
      
      await page.waitForSelector('[data-testid="quality-score-result"]', { timeout: 15000 });
      const aiProcessingTime = Date.now() - aiProcessingStart;
      
      // AI processing should complete within 5 seconds on iOS
      expect(aiProcessingTime).toBeLessThan(5000);
      
      console.log(`📊 ${name} Performance: Load ${loadTime}ms, Voice ${voiceLoadTime}ms, AI ${aiProcessingTime}ms`);
    });

  });
});

test.describe('iOS Safari Cross-Device Compatibility', () => {
  
  test('should maintain session across iOS device orientations', async ({ page, browser }) => {
    // Test on iPhone in portrait and landscape
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone portrait
    
    await page.goto('http://localhost:3000');
    await page.click('[data-testid="start-session-btn"]');
    
    const sessionId = await page.evaluate(() => localStorage.getItem('sessionId'));
    expect(sessionId).toBeTruthy();
    
    // Rotate to landscape
    await page.setViewportSize({ width: 667, height: 375 }); // iPhone landscape
    await page.reload();
    
    // Session should persist
    const restoredSessionId = await page.evaluate(() => localStorage.getItem('sessionId'));
    expect(restoredSessionId).toBe(sessionId);
    
    // UI should adapt to landscape
    await expect(page.locator('[data-testid="landscape-layout"]')).toBeVisible();
  });
  
  test('should work across different iOS Safari versions', async ({ page }) => {
    // Test compatibility with different iOS Safari features
    const safariFeatures = await page.evaluate(() => ({
      hasWebAudio: !!(window.AudioContext || window.webkitAudioContext),
      hasWebRTC: !!window.RTCPeerConnection,
      hasMediaRecorder: !!window.MediaRecorder,
      hasServiceWorker: 'serviceWorker' in navigator,
      hasNotifications: 'Notification' in window,
      hasVibration: 'vibrate' in navigator,
      hasGeolocation: 'geolocation' in navigator
    }));
    
    console.log(`Safari features available: ${JSON.stringify(safariFeatures, null, 2)}`);
    
    // App should work with minimal feature set (core iOS Safari capabilities)
    await page.goto('http://localhost:3000');
    await expect(page.locator('[data-testid="app-container"]')).toBeVisible();
    
    // Should provide fallbacks for missing features
    if (!safariFeatures.hasMediaRecorder) {
      await expect(page.locator('[data-testid="recording-fallback"]')).toBeVisible();
    }
    
    if (!safariFeatures.hasNotifications) {
      await expect(page.locator('[data-testid="notification-alternative"]')).toBeVisible();
    }
  });

});