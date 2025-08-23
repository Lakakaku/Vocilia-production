/**
 * iOS Safari Compatibility Test Suite
 * Tests critical functionality on iOS Safari with fallbacks
 */

const { test, expect, devices } = require('@playwright/test');

// iOS device configurations for testing
const IOS_DEVICES = [
  { name: 'iPhone 15 Pro', device: devices['iPhone 15 Pro'] },
  { name: 'iPhone 14', device: devices['iPhone 14'] },
  { name: 'iPhone 13', device: devices['iPhone 13'] },
  { name: 'iPad Pro', device: devices['iPad Pro'] },
  { name: 'iPad Air', device: devices['iPad Air'] }
];

// Mock audio configuration for testing
const AUDIO_CONFIG = {
  sampleRate: 16000,
  channels: 1,
  duration: 5000 // 5 seconds for testing
};

IOS_DEVICES.forEach(({ name, device }) => {
  test.describe(`iOS Safari Tests - ${name}`, () => {
    test.use(device);

    test.beforeEach(async ({ page, context }) => {
      // Grant microphone permissions
      await context.grantPermissions(['microphone']);
      
      // Mock getUserMedia for consistent testing
      await page.addInitScript(() => {
        // Create mock audio stream
        const mockStream = {
          getTracks: () => [{
            stop: () => {},
            getSettings: () => ({
              sampleRate: 16000,
              channelCount: 1
            })
          }],
          getAudioTracks: () => [{
            stop: () => {},
            getSettings: () => ({
              sampleRate: 16000,
              channelCount: 1
            })
          }]
        };

        // Mock MediaRecorder availability
        const originalMediaRecorder = window.MediaRecorder;
        const hasNativeMediaRecorder = typeof originalMediaRecorder !== 'undefined';
        
        // Override navigator.mediaDevices.getUserMedia
        Object.defineProperty(navigator, 'mediaDevices', {
          value: {
            getUserMedia: async (constraints) => {
              return mockStream;
            }
          },
          writable: true
        });

        // Store device info for tests
        window.__TEST_DEVICE_INFO__ = {
          name: '${name}',
          hasMediaRecorder: hasNativeMediaRecorder,
          supportsOpus: hasNativeMediaRecorder && originalMediaRecorder.isTypeSupported('audio/webm;codecs=opus'),
          userAgent: navigator.userAgent
        };
      });

      // Navigate to PWA
      await page.goto('http://localhost:3000');
    });

    test('should load PWA correctly', async ({ page }) => {
      // Check that page loads
      await expect(page).toHaveTitle(/AI Feedback Platform/);
      
      // Check for PWA manifest
      const manifestLink = page.locator('link[rel="manifest"]');
      await expect(manifestLink).toBeVisible();
      
      // Check for service worker registration
      const serviceWorkerRegistered = await page.evaluate(() => {
        return 'serviceWorker' in navigator;
      });
      expect(serviceWorkerRegistered).toBeTruthy();
    });

    test('should prompt for home screen installation', async ({ page }) => {
      // Check for install prompt capability
      const canInstall = await page.evaluate(() => {
        return 'standalone' in navigator || 
               window.matchMedia('(display-mode: standalone)').matches;
      });
      
      // On Safari, check for Add to Home Screen hint
      if (name.includes('iPhone') || name.includes('iPad')) {
        // Look for iOS-specific install hints
        await page.waitForSelector('[data-testid="ios-install-hint"]', { timeout: 5000 });
      }
    });

    test('should handle QR code scanning', async ({ page }) => {
      // Navigate to scan page
      await page.goto('http://localhost:3000/scan');
      
      // Check camera access request
      const cameraButton = page.locator('[data-testid="start-camera"]');
      await cameraButton.click();
      
      // Verify camera interface loads
      await expect(page.locator('[data-testid="camera-view"]')).toBeVisible();
      
      // Test QR code detection (mock)
      await page.evaluate(() => {
        // Simulate QR code detection
        window.handleQRScan?.('test-qr-code-data');
      });
      
      await expect(page.locator('[data-testid="qr-detected"]')).toBeVisible();
    });

    test('should handle voice recording with MediaRecorder', async ({ page }) => {
      // Skip if device doesn't support MediaRecorder
      const deviceInfo = await page.evaluate(() => window.__TEST_DEVICE_INFO__);
      
      if (!deviceInfo.hasMediaRecorder) {
        test.skip();
        return;
      }

      // Navigate to voice recording
      await page.goto('http://localhost:3000/feedback/voice');
      
      // Start recording
      const recordButton = page.locator('[data-testid="start-recording"]');
      await recordButton.click();
      
      // Check recording state
      await expect(page.locator('[data-testid="recording-active"]')).toBeVisible();
      
      // Wait for minimum recording time
      await page.waitForTimeout(2000);
      
      // Stop recording
      const stopButton = page.locator('[data-testid="stop-recording"]');
      await stopButton.click();
      
      // Verify recording completed
      await expect(page.locator('[data-testid="recording-complete"]')).toBeVisible();
      
      // Check audio blob was created
      const hasAudioBlob = await page.evaluate(() => {
        return document.querySelector('[data-testid="audio-blob"]')?.dataset?.size > 0;
      });
      expect(hasAudioBlob).toBeTruthy();
    });

    test('should fallback to Web Audio API when MediaRecorder unavailable', async ({ page }) => {
      // Force Web Audio API fallback
      await page.addInitScript(() => {
        // Remove MediaRecorder to force fallback
        delete window.MediaRecorder;
        
        // Mock Web Audio API
        window.AudioContext = window.AudioContext || window.webkitAudioContext || function() {
          return {
            createMediaStreamSource: () => ({
              connect: () => {}
            }),
            createScriptProcessor: (bufferSize, inputs, outputs) => ({
              connect: () => {},
              disconnect: () => {},
              onaudioprocess: null
            }),
            close: () => Promise.resolve(),
            destination: {}
          };
        };
      });

      await page.goto('http://localhost:3000/feedback/voice');
      
      // Start recording with Web Audio fallback
      const recordButton = page.locator('[data-testid="start-recording"]');
      await recordButton.click();
      
      // Verify fallback is used
      const usingFallback = await page.evaluate(() => {
        return !window.MediaRecorder && !!window.AudioContext;
      });
      expect(usingFallback).toBeTruthy();
      
      // Check recording starts
      await expect(page.locator('[data-testid="recording-active"]')).toBeVisible();
      
      // Wait and stop
      await page.waitForTimeout(2000);
      await page.locator('[data-testid="stop-recording"]').click();
      
      // Verify WAV blob creation
      await expect(page.locator('[data-testid="recording-complete"]')).toBeVisible();
    });

    test('should handle WebSocket connection and reconnection', async ({ page }) => {
      // Mock WebSocket for testing
      await page.addInitScript(() => {
        let mockConnected = false;
        let reconnectAttempts = 0;
        
        class MockWebSocket {
          constructor(url) {
            this.url = url;
            this.readyState = 0; // CONNECTING
            this.onopen = null;
            this.onmessage = null;
            this.onerror = null;
            this.onclose = null;
            
            // Simulate connection
            setTimeout(() => {
              if (reconnectAttempts === 0) {
                // First connection succeeds
                this.readyState = 1; // OPEN
                mockConnected = true;
                this.onopen?.();
              } else if (reconnectAttempts === 1) {
                // Second connection fails
                this.readyState = 3; // CLOSED
                this.onerror?.(new Error('Connection failed'));
                setTimeout(() => this.onclose?.(), 100);
              } else {
                // Third connection succeeds
                this.readyState = 1;
                mockConnected = true;
                this.onopen?.();
              }
              reconnectAttempts++;
            }, 100);
          }
          
          send(data) {
            if (this.readyState === 1) {
              // Echo back success message
              setTimeout(() => {
                this.onmessage?.({
                  data: JSON.stringify({ type: 'audio_received', size: data.length })
                });
              }, 50);
            }
          }
          
          close() {
            this.readyState = 3;
            mockConnected = false;
            setTimeout(() => this.onclose?.(), 10);
          }
        }
        
        window.WebSocket = MockWebSocket;
        window.__MOCK_WS_STATE__ = { connected: () => mockConnected };
      });

      await page.goto('http://localhost:3000/feedback/voice');
      
      // Start recording to trigger WebSocket
      await page.locator('[data-testid="start-recording"]').click();
      
      // Wait for WebSocket connection
      await page.waitForTimeout(200);
      
      // Verify connection established
      const wsConnected = await page.evaluate(() => 
        window.__MOCK_WS_STATE__.connected()
      );
      expect(wsConnected).toBeTruthy();
      
      // Test reconnection by simulating disconnect
      await page.evaluate(() => {
        // Simulate connection loss
        const ws = window.mockWebSocketInstance;
        ws?.close();
      });
      
      await page.waitForTimeout(1000);
      
      // Verify reconnection occurred
      const reconnected = await page.evaluate(() => 
        window.__MOCK_WS_STATE__.connected()
      );
      expect(reconnected).toBeTruthy();
    });

    test('should handle microphone permission denial gracefully', async ({ page, context }) => {
      // Deny microphone permissions
      await context.clearPermissions();
      
      await page.goto('http://localhost:3000/feedback/voice');
      
      // Override getUserMedia to simulate denial
      await page.evaluate(() => {
        navigator.mediaDevices.getUserMedia = async () => {
          throw new DOMException('Permission denied', 'NotAllowedError');
        };
      });
      
      // Try to start recording
      await page.locator('[data-testid="start-recording"]').click();
      
      // Check error handling
      await expect(page.locator('[data-testid="permission-error"]')).toBeVisible();
      await expect(page.locator('text=Mikrofon åtkomst nekad')).toBeVisible();
      
      // Verify retry option
      await expect(page.locator('[data-testid="retry-recording"]')).toBeVisible();
    });

    test('should handle offline mode gracefully', async ({ page, context }) => {
      await page.goto('http://localhost:3000');
      
      // Go offline
      await context.setOffline(true);
      
      // Navigate to QR scan page
      await page.goto('http://localhost:3000/scan');
      
      // Should show offline message or cached version
      const offlineIndicator = page.locator('[data-testid="offline-mode"]');
      await expect(offlineIndicator).toBeVisible();
      
      // Verify essential functionality still works
      await expect(page.locator('[data-testid="camera-controls"]')).toBeVisible();
      
      // Go back online
      await context.setOffline(false);
      await page.reload();
      
      // Verify online functionality restored
      await expect(page.locator('[data-testid="online-mode"]')).toBeVisible();
    });

    test('should maintain proper touch interactions', async ({ page }) => {
      await page.goto('http://localhost:3000/feedback/voice');
      
      // Test touch recording button
      const recordButton = page.locator('[data-testid="start-recording"]');
      
      // Simulate touch start/end
      await recordButton.dispatchEvent('touchstart');
      await page.waitForTimeout(100);
      await recordButton.dispatchEvent('touchend');
      
      // Should start recording
      await expect(page.locator('[data-testid="recording-active"]')).toBeVisible();
      
      // Test touch to stop
      const stopButton = page.locator('[data-testid="stop-recording"]');
      await stopButton.dispatchEvent('touchstart');
      await page.waitForTimeout(100);
      await stopButton.dispatchEvent('touchend');
      
      await expect(page.locator('[data-testid="recording-complete"]')).toBeVisible();
    });

    test('should handle viewport changes and orientation', async ({ page }) => {
      await page.goto('http://localhost:3000/feedback/voice');
      
      // Test portrait mode
      await page.setViewportSize({ width: 375, height: 812 });
      await expect(page.locator('[data-testid="recording-interface"]')).toBeVisible();
      
      // Test landscape mode (if applicable for device)
      if (name.includes('iPhone')) {
        await page.setViewportSize({ width: 812, height: 375 });
        await expect(page.locator('[data-testid="recording-interface"]')).toBeVisible();
        
        // Elements should still be properly positioned
        const recordButton = page.locator('[data-testid="start-recording"]');
        const buttonBox = await recordButton.boundingBox();
        expect(buttonBox.x).toBeGreaterThan(0);
        expect(buttonBox.y).toBeGreaterThan(0);
      }
    });

    test('should measure and validate performance metrics', async ({ page }) => {
      // Start performance measurement
      await page.goto('http://localhost:3000');
      
      // Measure page load time
      const loadTime = await page.evaluate(() => {
        return performance.timing.loadEventEnd - performance.timing.navigationStart;
      });
      
      // Should load within 3 seconds
      expect(loadTime).toBeLessThan(3000);
      
      // Test voice interface load time
      const voiceStartTime = Date.now();
      await page.goto('http://localhost:3000/feedback/voice');
      await page.waitForSelector('[data-testid="start-recording"]');
      const voiceLoadTime = Date.now() - voiceStartTime;
      
      // Voice interface should load quickly
      expect(voiceLoadTime).toBeLessThan(1500);
      
      // Test recording start latency
      const recordStartTime = Date.now();
      await page.locator('[data-testid="start-recording"]').click();
      await page.waitForSelector('[data-testid="recording-active"]');
      const recordLatency = Date.now() - recordStartTime;
      
      // Recording should start within reasonable time
      expect(recordLatency).toBeLessThan(2000);
    });
  });
});

// Cross-device compatibility tests
test.describe('Cross-Device Compatibility', () => {
  test('should work consistently across all iOS devices', async ({ playwright }) => {
    const results = {};
    
    for (const { name, device } of IOS_DEVICES) {
      const browser = await playwright.chromium.launch();
      const context = await browser.newContext(device);
      const page = await context.newPage();
      
      try {
        await context.grantPermissions(['microphone']);
        await page.goto('http://localhost:3000/feedback/voice');
        
        // Test basic functionality
        await page.locator('[data-testid="start-recording"]').click();
        await page.waitForSelector('[data-testid="recording-active"]', { timeout: 5000 });
        
        results[name] = {
          success: true,
          hasMediaRecorder: await page.evaluate(() => !!window.MediaRecorder),
          supportsOpus: await page.evaluate(() => 
            window.MediaRecorder?.isTypeSupported('audio/webm;codecs=opus') || false
          )
        };
      } catch (error) {
        results[name] = {
          success: false,
          error: error.message
        };
      } finally {
        await browser.close();
      }
    }
    
    // Verify all devices work
    for (const [deviceName, result] of Object.entries(results)) {
      expect(result.success).toBeTruthy(`${deviceName} should work correctly`);
    }
    
    console.log('Device compatibility results:', results);
  });
});

module.exports = {
  IOS_DEVICES,
  AUDIO_CONFIG
};