/**
 * iOS Safari Testing Utilities
 * Helper functions for manual and automated testing
 */

class iOSTestUtils {
  constructor() {
    this.results = [];
    this.deviceInfo = this.detectDevice();
    this.startTime = Date.now();
  }

  /**
   * Detect iOS device and browser capabilities
   */
  detectDevice() {
    const userAgent = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(userAgent);
    const isSafari = /Safari/.test(userAgent) && !/Chrome/.test(userAgent);
    
    return {
      isIOS,
      isSafari,
      userAgent,
      deviceType: this.getDeviceType(),
      iOSVersion: this.getIOSVersion(),
      capabilities: this.getBrowserCapabilities()
    };
  }

  getDeviceType() {
    const userAgent = navigator.userAgent;
    if (/iPhone/.test(userAgent)) {
      if (userAgent.includes('iPhone15')) return 'iPhone 15';
      if (userAgent.includes('iPhone14')) return 'iPhone 14';
      if (userAgent.includes('iPhone13')) return 'iPhone 13';
      return 'iPhone (Unknown)';
    }
    if (/iPad/.test(userAgent)) {
      return userAgent.includes('Pro') ? 'iPad Pro' : 'iPad';
    }
    return 'Unknown';
  }

  getIOSVersion() {
    const match = navigator.userAgent.match(/OS (\d+)_(\d+)_?(\d+)?/);
    if (match) {
      return `${match[1]}.${match[2]}${match[3] ? '.' + match[3] : ''}`;
    }
    return 'Unknown';
  }

  getBrowserCapabilities() {
    return {
      mediaRecorder: typeof MediaRecorder !== 'undefined',
      webAudio: typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined',
      webSocket: typeof WebSocket !== 'undefined',
      serviceWorker: 'serviceWorker' in navigator,
      getUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
      pushManager: 'PushManager' in window,
      notification: 'Notification' in window
    };
  }

  /**
   * Test microphone access and audio recording capabilities
   */
  async testAudioRecording() {
    const testResult = {
      test: 'Audio Recording',
      passed: false,
      details: {},
      errors: []
    };

    try {
      // Test getUserMedia
      console.log('🎤 Testing microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          sampleRate: 16000, 
          channelCount: 1 
        } 
      });
      testResult.details.microphoneAccess = true;

      // Test MediaRecorder if available
      if (typeof MediaRecorder !== 'undefined') {
        console.log('🎵 Testing MediaRecorder...');
        const mediaRecorder = new MediaRecorder(stream);
        const chunks = [];
        
        mediaRecorder.ondataavailable = (event) => {
          chunks.push(event.data);
        };

        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'audio/webm' });
          testResult.details.mediaRecorderBlob = blob.size;
        };

        mediaRecorder.start();
        await new Promise(resolve => setTimeout(resolve, 1000));
        mediaRecorder.stop();
        
        testResult.details.mediaRecorderSupport = true;
      } else {
        console.log('⚠️ MediaRecorder not supported, testing Web Audio API...');
        testResult.details.mediaRecorderSupport = false;
        
        // Test Web Audio API fallback
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioContext.createMediaStreamSource(stream);
        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        
        const audioChunks = [];
        processor.onaudioprocess = (event) => {
          const inputData = event.inputBuffer.getChannelData(0);
          audioChunks.push(new Float32Array(inputData));
        };

        source.connect(processor);
        processor.connect(audioContext.destination);

        await new Promise(resolve => setTimeout(resolve, 1000));
        
        processor.disconnect();
        audioContext.close();
        
        testResult.details.webAudioFallback = true;
        testResult.details.webAudioChunks = audioChunks.length;
      }

      // Stop all tracks
      stream.getTracks().forEach(track => track.stop());
      testResult.passed = true;

    } catch (error) {
      console.error('❌ Audio recording test failed:', error);
      testResult.errors.push(error.message);
      
      if (error.name === 'NotAllowedError') {
        testResult.details.permissionDenied = true;
      }
    }

    this.results.push(testResult);
    return testResult;
  }

  /**
   * Test WebSocket connectivity and stability
   */
  async testWebSocketConnection(url = 'ws://localhost:3001') {
    const testResult = {
      test: 'WebSocket Connection',
      passed: false,
      details: {},
      errors: []
    };

    try {
      console.log(`🔌 Testing WebSocket connection to ${url}...`);
      
      const connectPromise = new Promise((resolve, reject) => {
        const ws = new WebSocket(url);
        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error('Connection timeout'));
        }, 10000);

        ws.onopen = () => {
          clearTimeout(timeout);
          testResult.details.connectionTime = Date.now() - this.startTime;
          
          // Test message sending
          ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            testResult.details.messageReceived = message;
            ws.close();
            resolve(true);
          } catch (e) {
            testResult.details.rawMessage = event.data;
            ws.close();
            resolve(true);
          }
        };

        ws.onerror = (error) => {
          clearTimeout(timeout);
          reject(error);
        };

        ws.onclose = (event) => {
          if (!testResult.details.messageReceived) {
            testResult.details.closeCode = event.code;
            testResult.details.closeReason = event.reason;
            resolve(false);
          }
        };
      });

      const connected = await connectPromise;
      testResult.passed = connected;
      testResult.details.connected = connected;

    } catch (error) {
      console.error('❌ WebSocket test failed:', error);
      testResult.errors.push(error.message);
    }

    this.results.push(testResult);
    return testResult;
  }

  /**
   * Test PWA installation capabilities
   */
  testPWACapabilities() {
    const testResult = {
      test: 'PWA Capabilities',
      passed: false,
      details: {},
      errors: []
    };

    try {
      console.log('📱 Testing PWA capabilities...');
      
      // Check if running as PWA
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isFullscreen = window.matchMedia('(display-mode: fullscreen)').matches;
      testResult.details.isStandalone = isStandalone;
      testResult.details.isFullscreen = isFullscreen;

      // Check for PWA installation prompt
      const hasInstallPrompt = 'beforeinstallprompt' in window;
      testResult.details.hasInstallPrompt = hasInstallPrompt;

      // Check service worker
      const hasServiceWorker = 'serviceWorker' in navigator;
      testResult.details.hasServiceWorker = hasServiceWorker;

      if (hasServiceWorker) {
        navigator.serviceWorker.getRegistration().then(registration => {
          testResult.details.serviceWorkerActive = !!registration;
        });
      }

      // Check manifest
      const manifestLink = document.querySelector('link[rel="manifest"]');
      testResult.details.hasManifest = !!manifestLink;

      // For iOS, check for specific indicators
      if (this.deviceInfo.isIOS) {
        testResult.details.iOSInstallable = isStandalone || this.deviceInfo.isSafari;
        testResult.details.addToHomeScreen = !isStandalone; // Can be added if not already standalone
      }

      testResult.passed = hasServiceWorker && !!manifestLink;

    } catch (error) {
      console.error('❌ PWA capabilities test failed:', error);
      testResult.errors.push(error.message);
    }

    this.results.push(testResult);
    return testResult;
  }

  /**
   * Test performance metrics
   */
  testPerformance() {
    const testResult = {
      test: 'Performance Metrics',
      passed: false,
      details: {},
      errors: []
    };

    try {
      console.log('⚡ Testing performance metrics...');

      // Page load performance
      if (window.performance && window.performance.timing) {
        const timing = window.performance.timing;
        testResult.details.pageLoadTime = timing.loadEventEnd - timing.navigationStart;
        testResult.details.domReadyTime = timing.domContentLoadedEventEnd - timing.navigationStart;
        testResult.details.firstPaint = timing.responseStart - timing.navigationStart;
      }

      // Memory usage (if available)
      if (window.performance && window.performance.memory) {
        testResult.details.memoryUsed = window.performance.memory.usedJSHeapSize;
        testResult.details.memoryLimit = window.performance.memory.jsHeapSizeLimit;
      }

      // Connection info
      if (navigator.connection) {
        testResult.details.connectionType = navigator.connection.effectiveType;
        testResult.details.downlink = navigator.connection.downlink;
      }

      // Check if performance is acceptable
      const loadTime = testResult.details.pageLoadTime || 0;
      testResult.passed = loadTime < 5000; // Less than 5 seconds

    } catch (error) {
      console.error('❌ Performance test failed:', error);
      testResult.errors.push(error.message);
    }

    this.results.push(testResult);
    return testResult;
  }

  /**
   * Run all compatibility tests
   */
  async runAllTests() {
    console.log('🧪 Starting iOS Safari compatibility tests...');
    console.log('Device Info:', this.deviceInfo);

    // Run all tests
    await this.testAudioRecording();
    await this.testWebSocketConnection();
    this.testPWACapabilities();
    this.testPerformance();

    return this.generateReport();
  }

  /**
   * Generate comprehensive test report
   */
  generateReport() {
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;

    const report = {
      device: this.deviceInfo,
      timestamp: new Date().toISOString(),
      summary: {
        total: totalTests,
        passed: passedTests,
        failed: failedTests,
        passRate: Math.round((passedTests / totalTests) * 100)
      },
      results: this.results,
      recommendations: this.generateRecommendations()
    };

    console.log('📋 Test Report:', report);
    return report;
  }

  generateRecommendations() {
    const recommendations = [];
    
    this.results.forEach(result => {
      if (!result.passed) {
        switch (result.test) {
          case 'Audio Recording':
            if (result.details.permissionDenied) {
              recommendations.push('Guide users to grant microphone permissions in Safari settings');
            }
            if (!result.details.mediaRecorderSupport) {
              recommendations.push('Implement Web Audio API fallback for iOS Safari');
            }
            break;
            
          case 'WebSocket Connection':
            recommendations.push('Implement HTTP polling fallback for WebSocket failures');
            recommendations.push('Add connection retry logic with exponential backoff');
            break;
            
          case 'PWA Capabilities':
            if (!result.details.hasServiceWorker) {
              recommendations.push('Ensure service worker registration for offline functionality');
            }
            if (!result.details.hasManifest) {
              recommendations.push('Add web app manifest for PWA installation');
            }
            break;
            
          case 'Performance Metrics':
            if (result.details.pageLoadTime > 3000) {
              recommendations.push('Optimize page load time with code splitting and lazy loading');
            }
            break;
        }
      }
    });

    return recommendations;
  }
}

// Export for use in browser console or test environment
if (typeof window !== 'undefined') {
  window.iOSTestUtils = iOSTestUtils;
}

// Export for Node.js if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = iOSTestUtils;
}

/**
 * Usage Instructions:
 * 
 * 1. Load this script on your PWA pages
 * 2. Open browser dev tools on iOS device
 * 3. Run: const tester = new iOSTestUtils()
 * 4. Run: await tester.runAllTests()
 * 5. Review the generated report
 * 
 * Individual tests:
 * - await tester.testAudioRecording()
 * - await tester.testWebSocketConnection()
 * - tester.testPWACapabilities()
 * - tester.testPerformance()
 */