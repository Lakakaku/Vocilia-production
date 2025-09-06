// Fraud detection service tests

import crypto from 'crypto';
import { TestDataFactory, TestAssertions } from '../../../../tests/utils/testHelpers';

// Mock Redis for caching
const mockRedisClient = {
  get: jest.fn(),
  set: jest.fn(),
  incr: jest.fn(),
  expire: jest.fn(),
  del: jest.fn(),
  exists: jest.fn()
};

jest.mock('redis', () => ({
  createClient: jest.fn(() => mockRedisClient)
}));

// Import after mocking
import {
  analyzeSessionRisk,
  checkDeviceFingerprint,
  detectGeographicAnomalies,
  validateVoiceAuthenticity,
  calculateRiskScore,
  applyFraudPrevention
} from '../fraud-detection';

describe('Fraud Detection Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset Redis mock responses
    mockRedisClient.get.mockResolvedValue(null);
    mockRedisClient.set.mockResolvedValue('OK');
    mockRedisClient.incr.mockResolvedValue(1);
    mockRedisClient.expire.mockResolvedValue(1);
    mockRedisClient.exists.mockResolvedValue(0);
  });

  describe('Device Fingerprinting', () => {
    it('should track device usage within limits', async () => {
      // Arrange
      const deviceFingerprint = 'device_123_unique_fingerprint';
      const sessionData = TestDataFactory.generateSession();
      
      // Mock current usage: 2 sessions today
      mockRedisClient.get.mockResolvedValue('2');

      // Act
      const result = await checkDeviceFingerprint(deviceFingerprint, sessionData);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.usageCount).toBe(2);
      expect(result.riskScore).toBeLessThan(0.5); // Low risk
      
      expect(mockRedisClient.get).toHaveBeenCalledWith(`device:${deviceFingerprint}:daily`);
      expect(mockRedisClient.incr).toHaveBeenCalledWith(`device:${deviceFingerprint}:daily`);
    });

    it('should flag devices exceeding daily limits', async () => {
      // Arrange
      const deviceFingerprint = 'device_suspicious_123';
      const sessionData = TestDataFactory.generateSession();
      
      // Mock excessive usage: 8 sessions today (over 5 limit)
      mockRedisClient.get.mockResolvedValue('8');

      // Act
      const result = await checkDeviceFingerprint(deviceFingerprint, sessionData);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.usageCount).toBe(8);
      expect(result.riskScore).toBeGreaterThan(0.8); // High risk
      expect(result.flagReason).toContain('Daily limit exceeded');
    });

    it('should apply weekly and monthly caps', async () => {
      const limits = [
        { period: 'weekly', count: 25, limit: 20 },
        { period: 'monthly', count: 80, limit: 60 }
      ];

      for (const { period, count, limit } of limits) {
        // Reset mocks
        jest.clearAllMocks();
        mockRedisClient.get.mockImplementation((key) => {
          if (key.includes(period)) return Promise.resolve(count.toString());
          return Promise.resolve('1');
        });

        // Arrange
        const deviceFingerprint = `device_${period}_test`;
        const sessionData = TestDataFactory.generateSession();

        // Act
        const result = await checkDeviceFingerprint(deviceFingerprint, sessionData);

        // Assert
        expect(result.isValid).toBe(false);
        expect(result.riskScore).toBeGreaterThan(0.7);
        expect(result.flagReason).toContain(`${period.charAt(0).toUpperCase() + period.slice(1)} limit`);
      }
    });
  });

  describe('Geographic Anomaly Detection', () => {
    it('should detect impossible travel patterns', async () => {
      // Arrange
      const customerHash = 'customer_travel_test';
      
      // Previous location: Stockholm (59.3293, 18.0686)
      const previousSession = {
        location: { lat: 59.3293, lng: 18.0686, city: 'Stockholm' },
        timestamp: Date.now() - 30 * 60 * 1000 // 30 minutes ago
      };

      // Current location: Gothenburg (57.7089, 11.9746) - 470km away
      const currentSession = TestDataFactory.generateSession();
      const currentLocation = { lat: 57.7089, lng: 11.9746, city: 'Gothenburg' };

      // Mock Redis to return previous location
      mockRedisClient.get.mockResolvedValue(JSON.stringify(previousSession));

      // Act
      const result = await detectGeographicAnomalies(customerHash, currentLocation);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.distance).toBeGreaterThan(400); // km
      expect(result.timeWindow).toBe(30); // minutes
      expect(result.riskScore).toBeGreaterThan(0.8);
      expect(result.flagReason).toContain('Impossible travel');
    });

    it('should allow reasonable travel patterns', async () => {
      // Arrange
      const customerHash = 'customer_normal_travel';
      
      // Previous location: Stockholm City
      const previousSession = {
        location: { lat: 59.3293, lng: 18.0686, city: 'Stockholm' },
        timestamp: Date.now() - 2 * 60 * 60 * 1000 // 2 hours ago
      };

      // Current location: Stockholm suburb (5km away)
      const currentLocation = { lat: 59.3500, lng: 18.1000, city: 'Stockholm' };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(previousSession));

      // Act
      const result = await detectGeographicAnomalies(customerHash, currentLocation);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.distance).toBeLessThan(10);
      expect(result.riskScore).toBeLessThan(0.3);
    });

    it('should handle first-time locations', async () => {
      // Arrange
      const customerHash = 'customer_first_time';
      const location = { lat: 59.3293, lng: 18.0686, city: 'Stockholm' };

      mockRedisClient.get.mockResolvedValue(null); // No previous location

      // Act
      const result = await detectGeographicAnomalies(customerHash, location);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.riskScore).toBeLessThan(0.2);
      expect(result.flagReason).toBeNull();
    });

    it('should calculate distances correctly', () => {
      // Test the haversine distance calculation
      const locations = [
        // Stockholm to Gothenburg
        { from: { lat: 59.3293, lng: 18.0686 }, to: { lat: 57.7089, lng: 11.9746 }, expectedDistance: 470 },
        // Stockholm to Malmö
        { from: { lat: 59.3293, lng: 18.0686 }, to: { lat: 55.6050, lng: 13.0038 }, expectedDistance: 520 },
        // Same location
        { from: { lat: 59.3293, lng: 18.0686 }, to: { lat: 59.3293, lng: 18.0686 }, expectedDistance: 0 }
      ];

      const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
        const R = 6371; // Earth's radius in kilometers
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
      };

      locations.forEach(({ from, to, expectedDistance }) => {
        const calculatedDistance = calculateDistance(from.lat, from.lng, to.lat, to.lng);
        expect(Math.round(calculatedDistance)).toBeCloseTo(expectedDistance, -1); // Within 10km tolerance
      });
    });
  });

  describe('Voice Authenticity Validation', () => {
    it('should detect potential synthetic voice patterns', async () => {
      // Arrange
      const audioFeatures = {
        spectralCentroid: 3500, // Unusually high
        zeroCrossingRate: 0.15, // Irregular
        mfccCoefficients: [12, 8, 6, -2, -4, -1, 0, 1, 2, 1, 0, -1], // Synthetic pattern
        pitchVariation: 0.05, // Too consistent
        formantFrequencies: [800, 1200, 2400] // Artificial
      };

      // Act
      const result = await validateVoiceAuthenticity(audioFeatures);

      // Assert
      expect(result.isAuthentic).toBe(false);
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.riskScore).toBeGreaterThan(0.7);
      expect(result.detectionReasons).toContain('Synthetic voice patterns detected');
    });

    it('should validate authentic human voice patterns', async () => {
      // Arrange - realistic human voice features
      const audioFeatures = {
        spectralCentroid: 2200, // Normal range
        zeroCrossingRate: 0.08, // Natural variation
        mfccCoefficients: [15, -3, 8, -1, 2, -4, 1, 0, -2, 3, 1, -1], // Human pattern
        pitchVariation: 0.25, // Natural variation
        formantFrequencies: [700, 1220, 2600] // Typical human
      };

      // Act
      const result = await validateVoiceAuthenticity(audioFeatures);

      // Assert
      expect(result.isAuthentic).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.7);
      expect(result.riskScore).toBeLessThan(0.3);
    });

    it('should handle low-quality audio gracefully', async () => {
      // Arrange
      const audioFeatures = {
        spectralCentroid: null, // Missing data
        zeroCrossingRate: 0.02, // Very low
        mfccCoefficients: [], // Empty
        pitchVariation: undefined,
        formantFrequencies: [200] // Incomplete
      };

      // Act
      const result = await validateVoiceAuthenticity(audioFeatures);

      // Assert
      expect(result.isAuthentic).toBe(null); // Inconclusive
      expect(result.confidence).toBeLessThan(0.5);
      expect(result.riskScore).toBeCloseTo(0.5); // Neutral risk
      expect(result.detectionReasons).toContain('Insufficient audio quality');
    });
  });

  describe('Content Duplication Detection', () => {
    it('should detect near-duplicate feedback content', async () => {
      // Arrange
      const existingFeedback = 'Kaffet var mycket bra och personalen var trevlig';
      const newFeedback = 'Kaffet var mycket bra och personalen var väldigt trevlig';
      
      // Mock existing similar content
      mockRedisClient.get.mockResolvedValue(JSON.stringify([
        { content: existingFeedback, timestamp: Date.now() - 60000 }
      ]));

      // Act
      const similarity = calculateTextSimilarity(existingFeedback, newFeedback);
      const isDuplicate = similarity > 0.8;

      // Assert
      expect(similarity).toBeGreaterThan(0.85); // Very similar
      expect(isDuplicate).toBe(true);
    });

    it('should allow genuinely different feedback', async () => {
      // Arrange
      const existingFeedback = 'Kaffet var mycket bra och personalen var trevlig';
      const newFeedback = 'Servicen var långsam men maten var god';

      // Act
      const similarity = calculateTextSimilarity(existingFeedback, newFeedback);
      const isDuplicate = similarity > 0.8;

      // Assert
      expect(similarity).toBeLessThan(0.5);
      expect(isDuplicate).toBe(false);
    });

    function calculateTextSimilarity(text1: string, text2: string): number {
      // Simple implementation for testing - Jaccard similarity
      const words1 = new Set(text1.toLowerCase().split(' '));
      const words2 = new Set(text2.toLowerCase().split(' '));
      
      const intersection = new Set([...words1].filter(x => words2.has(x)));
      const union = new Set([...words1, ...words2]);
      
      return intersection.size / union.size;
    }
  });

  describe('Risk Score Calculation', () => {
    it('should calculate comprehensive risk scores', async () => {
      // Arrange
      const riskFactors = {
        deviceRisk: 0.3, // Medium device risk
        geographicRisk: 0.1, // Low geographic risk
        voiceRisk: 0.6, // High voice authenticity risk
        contentRisk: 0.8, // High content duplication risk
        temporalRisk: 0.2, // Low temporal pattern risk
        contextRisk: 0.4 // Medium context authenticity risk
      };

      // Act
      const overallRisk = calculateRiskScore(riskFactors);

      // Assert
      expect(overallRisk).toBeGreaterThan(0);
      expect(overallRisk).toBeLessThanOrEqual(1);
      
      // Risk should be weighted towards higher individual risks
      expect(overallRisk).toBeGreaterThan(0.4); // Elevated due to high voice and content risk
    });

    it('should apply Swedish compliance adjustments', async () => {
      // Arrange
      const riskFactors = {
        deviceRisk: 0.2,
        geographicRisk: 0.1,
        voiceRisk: 0.3,
        contentRisk: 0.2,
        temporalRisk: 0.1,
        contextRisk: 0.2
      };

      const swedishCompliance = {
        gdprCompliant: true,
        finansinspektionenRegulated: true,
        piiMinimization: true
      };

      // Act
      const overallRisk = calculateRiskScore(riskFactors, swedishCompliance);

      // Assert
      // Swedish compliance should slightly reduce calculated risk
      const baseRisk = calculateRiskScore(riskFactors);
      expect(overallRisk).toBeLessThanOrEqual(baseRisk);
    });
  });

  describe('Fraud Prevention Actions', () => {
    it('should apply appropriate prevention measures', async () => {
      // Test different risk levels and their corresponding actions
      const testCases = [
        { riskScore: 0.2, expectedAction: 'none', rewardAdjustment: 1.0 },
        { riskScore: 0.5, expectedAction: 'monitor', rewardAdjustment: 0.9 },
        { riskScore: 0.7, expectedAction: 'reduce_reward', rewardAdjustment: 0.5 },
        { riskScore: 0.9, expectedAction: 'block_session', rewardAdjustment: 0.0 }
      ];

      for (const { riskScore, expectedAction, rewardAdjustment } of testCases) {
        // Arrange
        const sessionData = TestDataFactory.generateSession();

        // Act
        const prevention = await applyFraudPrevention(sessionData, riskScore);

        // Assert
        expect(prevention.action).toBe(expectedAction);
        expect(prevention.rewardAdjustment).toBeCloseTo(rewardAdjustment, 1);
        
        if (riskScore >= 0.7) {
          expect(prevention.requiresReview).toBe(true);
        }
      }
    });

    it('should generate detailed fraud reports', async () => {
      // Arrange
      const sessionData = TestDataFactory.generateSession();
      const highRiskScore = 0.85;

      // Act
      const prevention = await applyFraudPrevention(sessionData, highRiskScore);

      // Assert
      expect(prevention.report).toBeDefined();
      expect(prevention.report.riskScore).toBe(highRiskScore);
      expect(prevention.report.timestamp).toBeDefined();
      expect(prevention.report.sessionId).toBe(sessionData.id);
      expect(prevention.report.factors).toBeDefined();
      TestAssertions.expectValidTimestamp(new Date(prevention.report.timestamp));
    });
  });

  describe('Performance Requirements', () => {
    it('should complete risk analysis within 200ms', async () => {
      // Arrange
      const sessionData = TestDataFactory.generateSession();
      mockRedisClient.get.mockResolvedValue(null); // Fast cache miss

      // Act
      const startTime = Date.now();
      const result = await analyzeSessionRisk(sessionData);
      const analysisTime = Date.now() - startTime;

      // Assert
      expect(analysisTime).toBeLessThanOrEqual(200);
      expect(result).toBeDefined();
      expect(result.riskScore).toBeGreaterThanOrEqual(0);
      expect(result.riskScore).toBeLessThanOrEqual(1);
    });

    it('should handle concurrent risk analyses efficiently', async () => {
      // Arrange
      const sessions = Array.from({ length: 10 }, () => TestDataFactory.generateSession());
      mockRedisClient.get.mockResolvedValue(null);

      // Act
      const startTime = Date.now();
      const results = await Promise.all(
        sessions.map(session => analyzeSessionRisk(session))
      );
      const totalTime = Date.now() - startTime;

      // Assert
      expect(results).toHaveLength(10);
      expect(totalTime).toBeLessThanOrEqual(1000); // 10 analyses in under 1 second
      results.forEach(result => {
        expect(result.riskScore).toBeGreaterThanOrEqual(0);
        expect(result.riskScore).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Swedish Regulatory Compliance', () => {
    it('should comply with GDPR data minimization', async () => {
      // Arrange
      const sessionData = TestDataFactory.generateSession();
      sessionData.customerPersonalData = {
        email: 'test@example.com',
        phone: '+46701234567'
      };

      // Act
      const result = await analyzeSessionRisk(sessionData);

      // Assert
      // Should not store PII in fraud analysis
      expect(result.report).not.toContain('test@example.com');
      expect(result.report).not.toContain('+46701234567');
      
      // Should use hashed references instead
      expect(result.customerHash).toBeDefined();
      expect(result.customerHash).toHaveLength(64); // SHA-256 hash
    });

    it('should respect data retention policies', async () => {
      // Arrange
      const sessionData = TestDataFactory.generateSession();
      const retentionPeriod = 90 * 24 * 60 * 60; // 90 days in seconds

      // Act
      await analyzeSessionRisk(sessionData);

      // Assert
      // Check that Redis keys are set with proper expiration
      expect(mockRedisClient.expire).toHaveBeenCalledWith(
        expect.stringMatching(/^(device|geo|content):/),
        retentionPeriod
      );
    });
  });
});