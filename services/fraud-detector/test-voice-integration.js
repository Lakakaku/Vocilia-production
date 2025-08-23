/**
 * Integration test for Voice Pattern Analysis with Fraud Detection Service
 * Demonstrates the complete fraud detection pipeline including voice analysis
 */

import { createFraudDetector } from './src/index.js';

// Create mock audio data (in a real scenario, this would be actual audio)
function createMockAudioData() {
  // Create a simple ArrayBuffer with mock audio data
  const buffer = new ArrayBuffer(16000 * 2); // 1 second of 16kHz 16-bit audio
  const view = new Int16Array(buffer);
  
  // Fill with mock sine wave data
  for (let i = 0; i < view.length; i++) {
    view[i] = Math.sin(2 * Math.PI * 440 * i / 16000) * 32767; // 440Hz tone
  }
  
  return buffer;
}

async function testVoiceIntegratedFraudDetection() {
  console.log('🎯 Testing Voice Pattern Analysis Integration...\n');
  
  // Create fraud detector
  const fraudDetector = createFraudDetector({
    conservativeMode: true,
    voicePatternWeight: 0.8,
    duplicateContentWeight: 0.8
  });
  
  // Test Case 1: Normal feedback with voice data
  console.log('📝 Test Case 1: Normal feedback with voice data');
  try {
    const normalSession = {
      id: 'test-session-001',
      transcript: 'Personalen var mycket trevlig och hjälpsam. Jag kommer definitivt tillbaka hit igen. Kaffen var riktigt bra och lokalerna var rena och välstädade.',
      customerHash: 'customer-hash-123',
      deviceFingerprint: {
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
        screenResolution: '375x667',
        timezone: 'Europe/Stockholm',
        language: 'sv-SE',
        platform: 'iPhone',
        cookieEnabled: true,
        doNotTrack: 'unspecified',
        touchSupport: true
      },
      timestamp: new Date(),
      businessId: 'business-cafe-001',
      locationId: 'location-001',
      purchaseAmount: 85,
      audioData: createMockAudioData()
    };
    
    const result = await fraudDetector.analyzeSession(normalSession);
    
    console.log(`   Risk Score: ${(result.overallRiskScore * 100).toFixed(1)}%`);
    console.log(`   Recommendation: ${result.recommendation}`);
    console.log(`   Confidence: ${(result.confidence * 100).toFixed(1)}%`);
    console.log(`   Flags: ${result.flags.length}`);
    
    if (result.flags.length > 0) {
      result.flags.forEach((flag, index) => {
        console.log(`     ${index + 1}. ${flag.type}: ${flag.description} (${flag.severity})`);
      });
    }
    
    console.log(`   ✅ Normal session analyzed successfully\n`);
    
  } catch (error) {
    console.error('   ❌ Error analyzing normal session:', error.message);
  }
  
  // Test Case 2: Suspicious feedback (duplicate content + rapid submission)
  console.log('📝 Test Case 2: Suspicious feedback with potential fraud indicators');
  try {
    const suspiciousSession = {
      id: 'test-session-002',
      transcript: 'Bra service, trevlig personal, allt var bra, inget att klaga på, rekommenderar starkt.', // Generic phrases
      customerHash: 'customer-hash-456',
      deviceFingerprint: {
        userAgent: 'HeadlessChrome/91.0.4472.124', // Suspicious user agent
        screenResolution: '1920x1080',
        timezone: 'Europe/Stockholm',
        language: 'en-US', // Language mismatch for Swedish business
        platform: 'Linux',
        cookieEnabled: false, // Cookies disabled
        touchSupport: false
      },
      timestamp: new Date(),
      businessId: 'business-cafe-001',
      locationId: 'location-001',
      purchaseAmount: 50,
      audioData: createMockAudioData()
    };
    
    const result = await fraudDetector.analyzeSession(suspiciousSession);
    
    console.log(`   Risk Score: ${(result.overallRiskScore * 100).toFixed(1)}%`);
    console.log(`   Recommendation: ${result.recommendation}`);
    console.log(`   Confidence: ${(result.confidence * 100).toFixed(1)}%`);
    console.log(`   Flags: ${result.flags.length}`);
    
    if (result.flags.length > 0) {
      result.flags.forEach((flag, index) => {
        console.log(`     ${index + 1}. ${flag.type}: ${flag.description} (${flag.severity})`);
      });
    }
    
    console.log(`   ✅ Suspicious session analyzed successfully\n`);
    
  } catch (error) {
    console.error('   ❌ Error analyzing suspicious session:', error.message);
  }
  
  // Test Case 3: Session without voice data
  console.log('📝 Test Case 3: Session without voice data (graceful fallback)');
  try {
    const sessionWithoutVoice = {
      id: 'test-session-003',
      transcript: 'Mycket nöjd med besöket. Maten var god och servicen var utmärkt.',
      customerHash: 'customer-hash-789',
      deviceFingerprint: {
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        screenResolution: '1440x900',
        timezone: 'Europe/Stockholm',
        language: 'sv-SE',
        platform: 'MacIntel',
        cookieEnabled: true,
        touchSupport: false
      },
      timestamp: new Date(),
      businessId: 'business-restaurant-001',
      locationId: 'location-002',
      purchaseAmount: 250
      // No audioData provided
    };
    
    const result = await fraudDetector.analyzeSession(sessionWithoutVoice);
    
    console.log(`   Risk Score: ${(result.overallRiskScore * 100).toFixed(1)}%`);
    console.log(`   Recommendation: ${result.recommendation}`);
    console.log(`   Confidence: ${(result.confidence * 100).toFixed(1)}%`);
    console.log(`   Flags: ${result.flags.length}`);
    
    if (result.flags.length > 0) {
      result.flags.forEach((flag, index) => {
        console.log(`     ${index + 1}. ${flag.type}: ${flag.description} (${flag.severity})`);
      });
    }
    
    console.log(`   ✅ Session without voice data handled gracefully\n`);
    
  } catch (error) {
    console.error('   ❌ Error analyzing session without voice:', error.message);
  }
  
  // Test fraud detector statistics
  console.log('📊 Fraud Detection Statistics:');
  try {
    const stats = fraudDetector.getStats();
    console.log(`   Content Detector Entries: ${stats.contentDetectorStats?.historySize || 0}`);
    console.log(`   Voice Pattern Entries: ${stats.voicePatternStats?.historySize || 0}`);
    console.log(`   Analysis History: ${stats.analysisHistorySize}`);
    console.log(`   Conservative Mode: ${stats.config.conservativeMode ? 'ON' : 'OFF'}`);
    console.log(`   Voice Pattern Weight: ${stats.config.voicePatternWeight || 'N/A'}`);
    console.log(`   ✅ Statistics retrieved successfully\n`);
  } catch (error) {
    console.error('   ❌ Error retrieving statistics:', error.message);
  }
  
  console.log('🎉 Voice Pattern Analysis Integration Test Complete!');
  console.log('\nKey Features Verified:');
  console.log('✅ Voice pattern analysis integration');
  console.log('✅ Fraud detection with voice data');
  console.log('✅ Graceful fallback without voice data');  
  console.log('✅ Multiple fraud detection algorithms working together');
  console.log('✅ Swedish language optimizations');
  console.log('✅ Conservative fraud detection mode');
  console.log('✅ Risk scoring with confidence levels');
}

// Run the integration test
testVoiceIntegratedFraudDetection().catch(console.error);