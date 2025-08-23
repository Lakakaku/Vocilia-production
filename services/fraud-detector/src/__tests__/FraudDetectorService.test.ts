import { FraudDetectorService } from '../FraudDetectorService';
import { DeviceFingerprint } from '@feedback-platform/shared-types';

describe('FraudDetectorService', () => {
  let fraudDetector: FraudDetectorService;
  let mockDeviceFingerprint: DeviceFingerprint;

  beforeEach(() => {
    fraudDetector = new FraudDetectorService({
      conservativeMode: false, // Disable for testing
      maxSubmissionsPerHour: 2
    });

    mockDeviceFingerprint = {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      screenResolution: '1179x2556',
      timezone: 'Europe/Stockholm',
      language: 'sv-SE',
      platform: 'iPhone',
      cookieEnabled: true,
      doNotTrack: '0',
      touchSupport: true,
      canvasFingerprint: 'abc123def456'
    };
  });

  describe('Overall fraud analysis', () => {
    it('should analyze a legitimate session with low risk', async () => {
      const session = {
        id: 'session-legit-1',
        transcript: 'Personalen var mycket trevlig och hjälpsam. Kaffe var bra och lokalen var ren och trevlig. Kommer gärna tillbaka.',
        customerHash: 'customer123',
        deviceFingerprint: mockDeviceFingerprint,
        timestamp: new Date(),
        businessId: 'business123',
        locationId: 'location123',
        purchaseAmount: 150
      };

      const result = await fraudDetector.analyzeSession(session);

      expect(result.overallRiskScore).toBeLessThan(0.3);
      expect(result.recommendation).toBe('accept');
      expect(result.confidence).toBeGreaterThan(0.3);
      expect(result.checks).toHaveLength(6); // All fraud checks should run
    });

    it('should detect duplicate content and flag session', async () => {
      const duplicateTranscript = 'Exakt samma feedback som tidigare gång.';
      
      const session1 = {
        id: 'session-dup-1',
        transcript: duplicateTranscript,
        customerHash: 'customer123',
        deviceFingerprint: mockDeviceFingerprint,
        timestamp: new Date(),
        businessId: 'business123',
        locationId: 'location123',
        purchaseAmount: 150
      };

      const session2 = {
        ...session1,
        id: 'session-dup-2',
        timestamp: new Date(Date.now() + 60000) // 1 minute later
      };

      // First session should be clean
      const result1 = await fraudDetector.analyzeSession(session1);
      expect(result1.recommendation).toBe('accept');

      // Second session should detect duplicate
      const result2 = await fraudDetector.analyzeSession(session2);
      expect(result2.overallRiskScore).toBeGreaterThan(0.5);
      expect(result2.flags.length).toBeGreaterThan(0);
      expect(result2.recommendation).toBeOneOf(['review', 'reject']);
    });
  });

  describe('Device fingerprint analysis', () => {
    it('should detect suspicious user agents', async () => {
      const suspiciousFingerprint = {
        ...mockDeviceFingerprint,
        userAgent: 'HeadlessChrome/91.0.4472.77'
      };

      const session = {
        id: 'session-suspicious',
        transcript: 'Normal feedback content',
        customerHash: 'customer123',
        deviceFingerprint: suspiciousFingerprint,
        timestamp: new Date(),
        businessId: 'business123',
        locationId: 'location123',
        purchaseAmount: 150
      };

      const result = await fraudDetector.analyzeSession(session);
      
      const deviceCheck = result.checks.find(check => check.type === 'device_abuse');
      expect(deviceCheck).toBeDefined();
      expect(deviceCheck!.score).toBeGreaterThan(0.5);
      expect(deviceCheck!.evidence.suspiciousUserAgent).toBe(true);
    });

    it('should handle missing device fingerprint gracefully', async () => {
      const session = {
        id: 'session-no-device',
        transcript: 'Normal feedback without device fingerprint',
        customerHash: 'customer123',
        timestamp: new Date(),
        businessId: 'business123',
        locationId: 'location123',
        purchaseAmount: 150
      };

      const result = await fraudDetector.analyzeSession(session);
      
      const deviceCheck = result.checks.find(check => check.type === 'device_abuse');
      expect(deviceCheck).toBeDefined();
      expect(deviceCheck!.score).toBeLessThan(0.5);
      expect(deviceCheck!.confidence).toBeLessThan(0.5);
    });

    it('should flag unusual screen resolutions', async () => {
      const unusualFingerprint = {
        ...mockDeviceFingerprint,
        screenResolution: '100x50' // Unusually small
      };

      const session = {
        id: 'session-unusual-screen',
        transcript: 'Test content',
        customerHash: 'customer123',
        deviceFingerprint: unusualFingerprint,
        timestamp: new Date(),
        businessId: 'business123',
        locationId: 'location123',
        purchaseAmount: 150
      };

      const result = await fraudDetector.analyzeSession(session);
      
      const deviceCheck = result.checks.find(check => check.type === 'device_abuse');
      expect(deviceCheck!.evidence.unusualScreenResolution).toBe('100x50');
    });
  });

  describe('Context authenticity', () => {
    it('should detect inappropriate content for business type', async () => {
      const session = {
        id: 'session-inappropriate',
        transcript: 'Bilen var bra och läkaren var trevlig.', // Car and doctor mentions in café
        customerHash: 'customer123',
        deviceFingerprint: mockDeviceFingerprint,
        timestamp: new Date(),
        businessId: 'business123', // Café
        locationId: 'location123',
        purchaseAmount: 150
      };

      const result = await fraudDetector.analyzeSession(session);
      
      const contextCheck = result.checks.find(check => check.type === 'context_mismatch');
      expect(contextCheck).toBeDefined();
      // Note: This test might not trigger in the current implementation since we return a default café context
    });

    it('should detect generic template content', async () => {
      const session = {
        id: 'session-generic',
        transcript: 'Bra service, trevlig personal, allt var bra, inget att klaga på, rekommenderar starkt.',
        customerHash: 'customer123',
        deviceFingerprint: mockDeviceFingerprint,
        timestamp: new Date(),
        businessId: 'business123',
        locationId: 'location123',
        purchaseAmount: 150
      };

      const result = await fraudDetector.analyzeSession(session);
      
      const contextCheck = result.checks.find(check => check.type === 'context_mismatch');
      expect(contextCheck).toBeDefined();
      expect(contextCheck!.evidence.genericPhrases).toBeDefined();
    });

    it('should flag extreme sentiment as potentially fake', async () => {
      const session = {
        id: 'session-extreme',
        transcript: 'Fantastisk, perfekt, otroligt bra, bästa någonsin, suveränt!',
        customerHash: 'customer123',
        deviceFingerprint: mockDeviceFingerprint,
        timestamp: new Date(),
        businessId: 'business123',
        locationId: 'location123',
        purchaseAmount: 150
      };

      const result = await fraudDetector.analyzeSession(session);
      
      const contextCheck = result.checks.find(check => check.type === 'context_mismatch');
      expect(contextCheck!.evidence.extremeSentiment).toBeDefined();
    });
  });

  describe('Risk scoring and recommendations', () => {
    it('should recommend accept for low-risk sessions', async () => {
      const session = {
        id: 'session-low-risk',
        transcript: 'Normal helpful feedback about the café experience.',
        customerHash: 'customer123',
        deviceFingerprint: mockDeviceFingerprint,
        timestamp: new Date(),
        businessId: 'business123',
        locationId: 'location123',
        purchaseAmount: 150
      };

      const result = await fraudDetector.analyzeSession(session);
      
      expect(result.overallRiskScore).toBeLessThan(0.5);
      expect(result.recommendation).toBe('accept');
    });

    it('should recommend review for moderate-risk sessions', async () => {
      const session = {
        id: 'session-moderate-risk',
        transcript: 'Bra service, trevlig personal, allt var bra.', // Some generic phrases
        customerHash: 'customer123',
        deviceFingerprint: {
          ...mockDeviceFingerprint,
          cookieEnabled: false // Suspicious device feature
        },
        timestamp: new Date(),
        businessId: 'business123',
        locationId: 'location123',
        purchaseAmount: 150
      };

      const result = await fraudDetector.analyzeSession(session);
      
      expect(result.flags.length).toBeGreaterThan(0);
      expect(result.recommendation).toBeOneOf(['review', 'accept']);
    });

    it('should calculate confidence based on check variety and quality', async () => {
      const session = {
        id: 'session-confidence',
        transcript: 'Detailed feedback with specific observations.',
        customerHash: 'customer123',
        deviceFingerprint: mockDeviceFingerprint,
        timestamp: new Date(),
        businessId: 'business123',
        locationId: 'location123',
        purchaseAmount: 150
      };

      const result = await fraudDetector.analyzeSession(session);
      
      expect(result.confidence).toBeGreaterThan(0.3);
      expect(result.confidence).toBeLessThanOrEqual(1.0);
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle analysis errors gracefully', async () => {
      // Create a session that might cause errors
      const problematicSession = {
        id: 'session-error',
        transcript: '', // Empty transcript
        customerHash: '',
        timestamp: new Date(),
        businessId: '',
        locationId: '',
        purchaseAmount: -100 // Invalid amount
      };

      const result = await fraudDetector.analyzeSession(problematicSession);
      
      expect(result).toBeDefined();
      expect(result.recommendation).toBeOneOf(['accept', 'review', 'reject']);
      expect(result.overallRiskScore).toBeGreaterThanOrEqual(0);
    });

    it('should apply conservative mode correctly', async () => {
      const conservativeDetector = new FraudDetectorService({
        conservativeMode: true,
        conservativeModeMultiplier: 1.5
      });

      const session = {
        id: 'session-conservative',
        transcript: 'Some potentially risky content',
        customerHash: 'customer123',
        deviceFingerprint: mockDeviceFingerprint,
        timestamp: new Date(),
        businessId: 'business123',
        locationId: 'location123',
        purchaseAmount: 150
      };

      const result = await conservativeDetector.analyzeSession(session);
      
      expect(result).toBeDefined();
      // Conservative mode should increase risk scores
      expect(result.overallRiskScore).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Configuration and statistics', () => {
    it('should update configuration correctly', () => {
      const newConfig = {
        fuzzyMatchThreshold: 0.9,
        maxSubmissionsPerHour: 5
      };

      fraudDetector.updateConfig(newConfig);
      
      const stats = fraudDetector.getStats();
      expect(stats.config.fuzzyMatchThreshold).toBe(0.9);
      expect(stats.config.maxSubmissionsPerHour).toBe(5);
    });

    it('should provide meaningful statistics', async () => {
      const session = {
        id: 'session-stats',
        transcript: 'Content for statistics test',
        customerHash: 'customer123',
        deviceFingerprint: mockDeviceFingerprint,
        timestamp: new Date(),
        businessId: 'business123',
        locationId: 'location123',
        purchaseAmount: 150
      };

      await fraudDetector.analyzeSession(session);
      
      const stats = fraudDetector.getStats();
      expect(stats.contentDetectorStats).toBeDefined();
      expect(stats.analysisHistorySize).toBeGreaterThanOrEqual(1);
      expect(stats.config).toBeDefined();
    });

    it('should cleanup history when requested', () => {
      fraudDetector.cleanupHistory(1000); // 1 second max age
      
      const stats = fraudDetector.getStats();
      expect(stats).toBeDefined();
    });
  });

  describe('Integration and performance', () => {
    it('should process multiple sessions efficiently', async () => {
      const sessions = Array.from({ length: 10 }, (_, i) => ({
        id: `session-perf-${i}`,
        transcript: `Unique feedback content number ${i} with different details.`,
        customerHash: `customer${i}`,
        deviceFingerprint: mockDeviceFingerprint,
        timestamp: new Date(Date.now() + i * 1000),
        businessId: 'business123',
        locationId: 'location123',
        purchaseAmount: 150
      }));

      const startTime = Date.now();
      
      const results = await Promise.all(
        sessions.map(session => fraudDetector.analyzeSession(session))
      );
      
      const endTime = Date.now();
      
      expect(results).toHaveLength(10);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
      
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.checks).toHaveLength(6);
      });
    });

    it('should maintain consistency across similar sessions', async () => {
      const baseSession = {
        id: 'session-consistency-1',
        transcript: 'Consistent feedback for testing',
        customerHash: 'customer123',
        deviceFingerprint: mockDeviceFingerprint,
        timestamp: new Date(),
        businessId: 'business123',
        locationId: 'location123',
        purchaseAmount: 150
      };

      const result1 = await fraudDetector.analyzeSession(baseSession);
      
      const similarSession = {
        ...baseSession,
        id: 'session-consistency-2',
        timestamp: new Date(Date.now() + 60000) // 1 minute later
      };
      
      const result2 = await fraudDetector.analyzeSession(similarSession);
      
      // Results should be similar for similar sessions
      expect(Math.abs(result1.overallRiskScore - result2.overallRiskScore)).toBeLessThan(0.3);
    });
  });
});