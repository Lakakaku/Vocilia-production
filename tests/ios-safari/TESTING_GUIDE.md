# iOS Safari Testing Guide - AI Feedback Platform

## Overview

This comprehensive guide covers testing the AI Feedback Platform on iOS Safari, which is the primary target for the customer PWA. iOS Safari has unique behaviors and limitations that require specific testing approaches.

## Prerequisites

### Required Devices
- **Physical iPhone devices** (iOS 14.0+)
  - iPhone 12/13/14/15 (various screen sizes)
  - iPad (for tablet testing)
- **macOS with Safari** (for initial testing)
- **Xcode Simulator** (supplementary, not primary)

### Testing Environment Setup
1. **Network Configuration**
   - Local development server accessible via HTTPS
   - Test domain: `https://feedback-test.local`
   - Valid SSL certificate (required for PWA features)

2. **Test Data**
   - QR codes with test business data
   - Valid session tokens
   - Mock Stripe test accounts

## Critical iOS Safari Features to Test

### 1. PWA Installation and Behavior

#### Installation Flow
- [ ] **Add to Home Screen** prompt appears correctly
- [ ] Custom app icon displays (180x180px)
- [ ] App name truncation (max 12 characters)
- [ ] Splash screen appears during launch
- [ ] App launches in fullscreen mode (no Safari UI)

#### Testing Steps:
```
1. Open Safari on iOS
2. Navigate to https://feedback-test.local
3. Wait for install prompt or manually tap Share → Add to Home Screen
4. Verify icon appears on home screen
5. Launch app from home screen
6. Confirm fullscreen experience
```

#### Expected Results:
- App icon visible on home screen
- No Safari address bar when launched from home screen
- Native app-like experience

### 2. Audio Recording Capabilities

#### MediaRecorder API Support
- [ ] MediaRecorder available (iOS 14.3+)
- [ ] WebM audio format support
- [ ] Microphone permission handling
- [ ] Audio quality and sample rate

#### Testing Steps:
```javascript
// Test in Safari console
if (typeof MediaRecorder !== 'undefined') {
  console.log('✅ MediaRecorder supported');
  console.log('Supported types:', MediaRecorder.isTypeSupported('audio/webm'));
} else {
  console.log('❌ MediaRecorder not supported - fallback required');
}
```

#### Web Audio API Fallback
- [ ] ScriptProcessorNode implementation
- [ ] AudioContext creation
- [ ] Audio data capture and processing
- [ ] Real-time audio streaming

### 3. WebSocket Communication

#### Connection Stability
- [ ] Initial WebSocket connection
- [ ] Connection persistence during app backgrounding
- [ ] Reconnection after network interruption
- [ ] Binary data transmission (audio chunks)

#### Testing Scenarios:
1. **Normal Operation**
   - Start recording → Send audio → Receive response
2. **Background/Foreground**
   - Start recording → Background app → Foreground → Continue
3. **Network Interruption**
   - Start session → Disable WiFi → Enable WiFi → Resume

### 4. Camera and QR Code Scanning

#### Camera Access
- [ ] Rear camera selection (environment facingMode)
- [ ] Camera permission prompt
- [ ] Video stream quality
- [ ] Camera switching functionality

#### QR Code Detection
- [ ] ZXing library performance on iOS
- [ ] Detection accuracy in various lighting
- [ ] Focus and autofocus behavior
- [ ] Processing speed

#### Testing Checklist:
```
□ QR code detection in bright light
□ QR code detection in dim light
□ QR code detection with camera shake
□ Multiple QR codes in frame
□ Damaged/partially obscured QR codes
□ Very small QR codes (distance testing)
□ Large QR codes (close-up testing)
```

### 5. Touch and Gesture Handling

#### Touch Events
- [ ] Tap responsiveness
- [ ] Touch targets (minimum 44px)
- [ ] Gesture conflicts with system gestures
- [ ] Touch feedback (visual/haptic)

#### System Gesture Conflicts:
- **Swipe from edges** (system navigation)
- **Pull to refresh** (page reload)
- **Pinch to zoom** (should be disabled)
- **Long press** (context menus)

### 6. Performance and Memory Management

#### Performance Metrics
- [ ] Page load time < 3 seconds
- [ ] Audio processing latency < 2 seconds
- [ ] Memory usage (check in Safari DevTools)
- [ ] CPU usage during audio processing
- [ ] Battery usage during extended sessions

#### Memory Testing:
```javascript
// Monitor memory usage
function checkMemory() {
  if ('memory' in performance) {
    console.log('Memory:', performance.memory);
  }
  setTimeout(checkMemory, 5000);
}
checkMemory();
```

## Automated Testing Setup

### Playwright iOS Configuration

```javascript
// playwright.ios.config.js
const { devices } = require('@playwright/test');

module.exports = {
  testDir: './tests/ios-safari',
  use: {
    baseURL: 'https://feedback-test.local',
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 13'] },
    },
    {
      name: 'iPad Safari',
      use: { ...devices['iPad Pro'] },
    },
  ],
};
```

### Test Implementation Example

```typescript
// tests/ios-safari/pwa-functionality.spec.ts
import { test, expect } from '@playwright/test';

test.describe('iOS Safari PWA', () => {
  test('should install as PWA', async ({ page, context }) => {
    await page.goto('/');
    
    // Check PWA manifest
    const manifestLink = page.locator('link[rel="manifest"]');
    await expect(manifestLink).toBeAttached();
    
    // Check service worker registration
    const swRegistration = await page.evaluate(() => {
      return 'serviceWorker' in navigator;
    });
    expect(swRegistration).toBe(true);
  });
  
  test('should handle audio recording on iOS', async ({ page }) => {
    await page.goto('/feedback-session');
    
    // Grant permissions (requires manual setup on device)
    await page.evaluate(() => {
      // Mock successful getUserMedia for testing
      navigator.mediaDevices.getUserMedia = () => Promise.resolve({
        getTracks: () => [{ stop: () => {} }]
      });
    });
    
    const recordButton = page.getByRole('button', { name: /starta röst/i });
    await recordButton.click();
    
    await expect(page.getByText(/lyssnar/i)).toBeVisible();
  });
});
```

## Manual Testing Checklists

### 1. Basic Functionality Test
```
Device: iPhone 13 Pro, iOS 16.5, Safari
Date: ___________
Tester: ___________

□ App loads successfully
□ QR scanner opens and functions
□ QR code detection works
□ Transaction verification form appears
□ Voice recording starts/stops
□ Audio feedback is audible
□ Results page displays correctly
□ PWA installation works
□ Home screen icon appears correctly
□ App launches fullscreen from home screen
```

### 2. Audio System Test
```
Device: ___________
Network: WiFi / Cellular
Date: ___________

□ Microphone permission granted
□ Recording indicator appears
□ Voice detected (visual feedback)
□ Audio sent successfully
□ AI response received
□ Audio playback works
□ Conversation flow natural
□ Timeout handling works
□ Error recovery functional
□ WebSocket connection stable
```

### 3. Edge Cases Test
```
Scenario Testing:
□ Poor network connection
□ Network interruption during recording
□ App backgrounded during conversation
□ Low battery mode
□ Multiple browser tabs open
□ Safari private browsing mode
□ iOS Focus/Do Not Disturb mode
□ Phone call interruption
□ Screen rotation (if applicable)
□ External audio devices (AirPods)
```

## Common iOS Safari Issues and Solutions

### Issue 1: Audio Recording Fails
**Symptoms:** MediaRecorder undefined, permission denied
**Solutions:**
- Check iOS version (14.3+ required)
- Verify HTTPS connection
- Implement Web Audio API fallback
- Test permission timing

### Issue 2: PWA Installation Not Available
**Symptoms:** No "Add to Home Screen" option
**Solutions:**
- Verify manifest.json completeness
- Check service worker registration
- Ensure HTTPS connection
- Test different Safari versions

### Issue 3: WebSocket Disconnections
**Symptoms:** Connection drops, reconnection failures
**Solutions:**
- Implement heartbeat/ping mechanism
- Add reconnection logic with exponential backoff
- Handle backgrounding events
- Monitor network state changes

### Issue 4: Camera Access Issues
**Symptoms:** Black screen, permission denied
**Solutions:**
- Check camera constraints
- Verify getUserMedia parameters
- Handle iOS-specific camera switching
- Test in different lighting conditions

## Performance Benchmarks

### Target Performance Metrics
- **Page Load:** < 3 seconds (3G network)
- **QR Detection:** < 1 second
- **Audio Latency:** < 2 seconds (voice → response)
- **Memory Usage:** < 50MB total
- **Battery Impact:** Minimal drain

### Measurement Tools
1. **Safari Web Inspector** (desktop)
2. **iOS Settings → Battery** (device usage)
3. **Xcode Instruments** (detailed profiling)
4. **Lighthouse** (performance audit)

## Test Data and Environment

### Test QR Codes
Generate test QR codes with various scenarios:
```javascript
// Valid QR code
{
  "v": 1,
  "b": "test-business-001",
  "l": "stockholm-location",
  "t": Date.now()
}

// Expired QR code
{
  "v": 1,
  "b": "test-business-002", 
  "l": "gothenburg-location",
  "t": Date.now() - (25 * 60 * 60 * 1000) // 25 hours ago
}
```

### Mock Business Data
- **Café Stockholm**: Swedish café with standard setup
- **Restaurang Test**: Restaurant with complex menu
- **ICA Test**: Grocery store with departments

## Reporting and Documentation

### Test Report Template
```markdown
# iOS Safari Test Report - [Date]

## Device Information
- Model: iPhone 13 Pro
- iOS Version: 16.5
- Safari Version: 16.5
- Network: WiFi (50 Mbps)

## Test Results Summary
- Total Tests: 25
- Passed: 23
- Failed: 2
- Blocked: 0

## Failed Tests
1. **Audio recording in low light**
   - Issue: QR scanner camera affects audio quality
   - Severity: Medium
   - Workaround: Close QR scanner before recording

## Performance Results
- Page Load: 2.1s ✅
- QR Detection: 0.8s ✅
- Audio Latency: 3.2s ❌ (exceeds 2s target)

## Recommendations
1. Optimize audio processing pipeline
2. Add better error handling for camera conflicts
3. Improve offline capability
```

## Continuous Testing Integration

### GitHub Actions Workflow
```yaml
name: iOS Safari Testing
on: [push, pull_request]

jobs:
  ios-safari-tests:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - name: Install dependencies
        run: npm install
      - name: Start test server
        run: npm run dev &
      - name: Run iOS Safari tests
        run: npm run test:ios
      - name: Upload test results
        uses: actions/upload-artifact@v3
        with:
          name: ios-safari-results
          path: test-results/
```

## Resources and References

### Apple Developer Documentation
- [Safari Web Inspector Guide](https://developer.apple.com/safari/tools/)
- [iOS Safari Supported Features](https://developer.apple.com/documentation/safari-release-notes)
- [PWA Support in Safari](https://developer.apple.com/documentation/safari-release-notes/safari-16_4-release-notes)

### Testing Tools
- [Playwright for iOS](https://playwright.dev/docs/emulation)
- [WebPageTest Mobile](https://www.webpagetest.org/)
- [Safari Technology Preview](https://developer.apple.com/safari/technology-preview/)

### Swedish Market Considerations
- Test with Swedish language settings
- Verify currency formatting (SEK)
- Check time zone handling (Stockholm)
- Test with Swedish keyboard layouts

## Conclusion

iOS Safari testing is critical for the AI Feedback Platform's success in the Swedish market. This guide provides comprehensive coverage of all aspects requiring validation, from basic functionality to advanced PWA features.

Regular testing with real devices and real-world scenarios ensures the platform delivers the expected user experience for Swedish café customers.