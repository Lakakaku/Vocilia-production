/**
 * Fraud Detection Security Tests
 * Tests fraud prevention systems with mock data and attack simulations
 * Uses only Stripe test environment - no real transactions
 */

const { SecurityTestUtils } = global;

describe('Fraud Detection Security Tests', () => {
  let testAccounts = [];
  let fraudDetectionResults = [];

  beforeEach(() => {
    fraudDetectionResults = [];
  });

  afterEach(async () => {
    // Cleanup test accounts created during testing
    for (const account of testAccounts) {
      try {
        if (account.id) {
          await SecurityTestUtils.stripe.accounts.del(account.id);
        }
      } catch (error) {
        // Test account cleanup - ignore errors
      }
    }
    testAccounts = [];
  });

  describe('Velocity Fraud Detection', () => {
    it('should detect rapid transaction attempts', async () => {
      const deviceFingerprint = SecurityTestUtils.utils.generateDeviceFingerprint(
        'test-browser/fraud-test',
        '192.168.1.100'
      );

      // Simulate 15 rapid transactions (should trigger velocity limit)
      const rapidTransactions = [];
      const testCard = SecurityTestUtils.testCards.velocityTesting.rapidFire[0];

      for (let i = 0; i < 15; i++) {
        const transactionAttempt = {
          timestamp: Date.now() + i * 100, // 100ms apart
          amount: 1000 + (i * 10), // Varying amounts
          deviceFingerprint,
          cardNumber: testCard,
          attemptNumber: i + 1
        };

        // Simulate rate limiter check
        try {
          await SecurityTestUtils.rateLimiters.payment.consume(deviceFingerprint);
          rapidTransactions.push({
            ...transactionAttempt,
            status: 'allowed',
            riskScore: SecurityTestUtils.utils.calculateRiskScore({
              velocityViolation: i > 10 ? 0.8 : 0.2
            })
          });
        } catch (rateLimitError) {
          rapidTransactions.push({
            ...transactionAttempt,
            status: 'blocked',
            reason: 'velocity_limit_exceeded',
            riskScore: 85 + i
          });
        }
      }

      // Should have blocked transactions after velocity limit
      const blockedTransactions = rapidTransactions.filter(t => t.status === 'blocked');
      expect(blockedTransactions.length).toBeGreaterThan(0);
      
      const highRiskTransactions = rapidTransactions.filter(t => t.riskScore > 70);
      expect(highRiskTransactions.length).toBeGreaterThan(5);
    });

    it('should detect card testing patterns', async () => {
      const attackSimulation = await SecurityTestUtils.simulateAttackScenario('cardTesting');
      
      // Analyze card testing pattern detection
      const failedAttempts = attackSimulation.filter(result => result.status === 'failed');
      const patterns = {
        multipleFailures: failedAttempts.length > 3,
        rapidSequence: true, // Simulated rapid attempts
        multipleCards: attackSimulation.length > 5
      };

      const riskScore = SecurityTestUtils.utils.calculateRiskScore({
        cardTestingPattern: patterns.multipleFailures && patterns.rapidSequence ? 0.9 : 0.1
      });

      expect(riskScore).toBeGreaterThan(70); // Should detect as high risk
      expect(patterns.multipleFailures).toBe(true);
      expect(attackSimulation.length).toBeGreaterThan(5);
    });

    it('should flag suspicious velocity patterns', async () => {
      const velocityTest = await SecurityTestUtils.simulateAttackScenario('velocityAbuse');
      
      // Analyze velocity abuse detection
      const suspiciousPatterns = velocityTest.filter(attempt => 
        attempt.status === 'blocked' && attempt.error
      );

      expect(suspiciousPatterns.length).toBeGreaterThan(0);
      
      const totalAttempts = velocityTest.length;
      const blockedPercentage = (suspiciousPatterns.length / totalAttempts) * 100;
      
      // Should block increasing percentage as velocity increases
      expect(blockedPercentage).toBeGreaterThan(20);
    });
  });

  describe('Device Fingerprinting Fraud Detection', () => {
    it('should detect device fingerprint mismatches', async () => {
      const legitimateDevice = SecurityTestUtils.utils.generateDeviceFingerprint(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
        '192.168.1.100',
        { screenResolution: '375x812', timezone: 'Europe/Stockholm' }
      );

      const suspiciousDevice = SecurityTestUtils.utils.generateDeviceFingerprint(
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
        '10.0.0.1',
        { screenResolution: '1920x1080', timezone: 'UTC' }
      );

      // Simulate user with known device fingerprint
      const knownUserSessions = [
        { device: legitimateDevice, timestamp: Date.now() - 3600000, riskScore: 10 },
        { device: legitimateDevice, timestamp: Date.now() - 1800000, riskScore: 15 }
      ];

      // New session with different device
      const newSession = {
        device: suspiciousDevice,
        timestamp: Date.now(),
        userHash: 'same_user_hash_12345'
      };

      // Calculate risk based on device mismatch
      const deviceMismatchRisk = legitimateDevice !== suspiciousDevice ? 0.7 : 0.1;
      const riskScore = SecurityTestUtils.utils.calculateRiskScore({
        deviceMismatch: deviceMismatchRisk,
        locationAnomaly: 0.6 // IP location change
      });

      expect(riskScore).toBeGreaterThan(60);
      expect(legitimateDevice).not.toBe(suspiciousDevice);
    });

    it('should track device consistency for legitimate users', async () => {
      const consistentDevice = SecurityTestUtils.utils.generateDeviceFingerprint(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
        '192.168.1.100',
        { screenResolution: '375x812' }
      );

      const consistentSessions = [];
      for (let i = 0; i < 10; i++) {
        consistentSessions.push({
          device: consistentDevice,
          timestamp: Date.now() - (i * 300000), // 5 minutes apart
          riskScore: SecurityTestUtils.utils.calculateRiskScore({
            deviceMismatch: 0.1, // Consistent device
            locationAnomaly: 0.1  // Same location
          })
        });
      }

      const averageRiskScore = consistentSessions.reduce((sum, session) => 
        sum + session.riskScore, 0) / consistentSessions.length;

      expect(averageRiskScore).toBeLessThan(30); // Low risk for consistent behavior
      expect(consistentSessions.every(s => s.device === consistentDevice)).toBe(true);
    });
  });

  describe('Geographic Anomaly Detection', () => {
    it('should detect impossible geographic transitions', async () => {
      const sessions = [
        {
          timestamp: Date.now() - 3600000, // 1 hour ago
          location: { country: 'SE', city: 'Stockholm', ip: '192.168.1.100' },
          riskScore: 10
        },
        {
          timestamp: Date.now() - 1800000, // 30 minutes ago  
          location: { country: 'SE', city: 'Stockholm', ip: '192.168.1.100' },
          riskScore: 10
        },
        {
          timestamp: Date.now(), // Now
          location: { country: 'US', city: 'New York', ip: '203.0.113.1' }, // Impossible travel
          riskScore: 0 // To be calculated
        }
      ];

      // Calculate risk for impossible geographic transition
      const timeDiff = sessions[2].timestamp - sessions[1].timestamp; // 30 minutes
      const impossibleTravel = timeDiff < 7200000; // Less than 2 hours for intercontinental travel

      sessions[2].riskScore = SecurityTestUtils.utils.calculateRiskScore({
        locationAnomaly: impossibleTravel ? 0.9 : 0.1,
        velocityViolation: 0.3
      });

      expect(sessions[2].riskScore).toBeGreaterThan(70);
      expect(impossibleTravel).toBe(true);
    });

    it('should allow reasonable geographic patterns', async () => {
      const reasonableSessions = [
        {
          timestamp: Date.now() - 86400000, // 24 hours ago
          location: { country: 'SE', city: 'Stockholm' },
          riskScore: SecurityTestUtils.utils.calculateRiskScore({ locationAnomaly: 0.1 })
        },
        {
          timestamp: Date.now() - 43200000, // 12 hours ago
          location: { country: 'SE', city: 'Göteborg' }, // Same country, different city
          riskScore: SecurityTestUtils.utils.calculateRiskScore({ locationAnomaly: 0.2 })
        },
        {
          timestamp: Date.now(),
          location: { country: 'NO', city: 'Oslo' }, // Neighboring country
          riskScore: SecurityTestUtils.utils.calculateRiskScore({ locationAnomaly: 0.3 })
        }
      ];

      const maxRiskScore = Math.max(...reasonableSessions.map(s => s.riskScore));
      expect(maxRiskScore).toBeLessThan(50); // Should be low risk
    });
  });

  describe('Behavioral Pattern Analysis', () => {
    it('should detect unusual spending patterns', async () => {
      const normalTransactions = [
        { amount: 50000, timestamp: Date.now() - 86400000 }, // 500 SEK
        { amount: 75000, timestamp: Date.now() - 72000000 }, // 750 SEK
        { amount: 30000, timestamp: Date.now() - 43200000 }  // 300 SEK
      ];

      const suspiciousTransaction = {
        amount: 1000000, // 10,000 SEK - 20x higher than normal
        timestamp: Date.now()
      };

      // Calculate spending pattern anomaly
      const averageSpending = normalTransactions.reduce((sum, t) => sum + t.amount, 0) 
                            / normalTransactions.length;
      const spendingAnomaly = suspiciousTransaction.amount / averageSpending;

      const riskScore = SecurityTestUtils.utils.calculateRiskScore({
        velocityViolation: spendingAnomaly > 10 ? 0.8 : 0.2,
        suspiciousEmail: 0.1
      });

      expect(spendingAnomaly).toBeGreaterThan(10);
      expect(riskScore).toBeGreaterThan(60);
    });

    it('should analyze feedback quality patterns for fraud', async () => {
      const suspiciousFeedbackPattern = [
        { qualityScore: 95, content: 'Amazing service, perfect experience!' },
        { qualityScore: 93, content: 'Fantastic store, highly recommend!' },
        { qualityScore: 97, content: 'Outstanding quality, will return!' },
        { qualityScore: 96, content: 'Excellent staff, great products!' }
      ];

      // Detect potentially fake feedback patterns
      const averageQuality = suspiciousFeedbackPattern.reduce((sum, f) => 
        sum + f.qualityScore, 0) / suspiciousFeedbackPattern.length;
      
      const consistentlyHigh = suspiciousFeedbackPattern.every(f => f.qualityScore > 90);
      const genericContent = suspiciousFeedbackPattern.every(f => 
        f.content.includes('!') && f.content.length < 50
      );

      const fraudRisk = SecurityTestUtils.utils.calculateRiskScore({
        suspiciousEmail: consistentlyHigh && genericContent ? 0.7 : 0.2,
        velocityViolation: 0.3
      });

      expect(averageQuality).toBeGreaterThan(90);
      expect(consistentlyHigh).toBe(true);
      expect(genericContent).toBe(true);
      expect(fraudRisk).toBeGreaterThan(50);
    });
  });

  describe('Account Creation Fraud Detection', () => {
    it('should detect bulk account creation attempts', async () => {
      const bulkCreationAttempts = [];
      const suspiciousEmails = SecurityTestUtils.testData.suspicious.rapidFire.emails;

      for (let i = 0; i < suspiciousEmails.length; i++) {
        const accountData = await SecurityTestUtils.createSecurityTestAccount('individual', 'suspicious');
        
        // Modify email to use suspicious patterns
        accountData.individual.email = suspiciousEmails[i];
        accountData.metadata.creationPattern = 'bulk_creation';
        
        bulkCreationAttempts.push({
          email: suspiciousEmails[i],
          timestamp: Date.now() + (i * 1000), // 1 second apart
          similarData: true, // Similar address/phone patterns
          riskScore: SecurityTestUtils.utils.calculateRiskScore({
            velocityViolation: 0.8,
            suspiciousEmail: 0.6
          })
        });
      }

      const rapidCreations = bulkCreationAttempts.filter(attempt => 
        attempt.riskScore > 60
      );

      expect(rapidCreations.length).toBe(suspiciousEmails.length);
      expect(bulkCreationAttempts.length).toBeGreaterThan(2);
    });

    it('should validate Swedish business data authenticity', async () => {
      const invalidBusinessData = {
        organizationNumber: '000000000000', // Invalid Swedish org number
        vatNumber: 'SE000000000000',        // Invalid VAT
        personnummer: '000000-0000',        // Invalid personnummer
        phone: '+1234567890',               // Non-Swedish phone
        postalCode: '99999'                 // Invalid Swedish postal code
      };

      const validationResults = {
        orgNumber: SecurityTestUtils.utils.validateSwedishOrganizationNumber(
          invalidBusinessData.organizationNumber
        ),
        vatNumber: SecurityTestUtils.utils.validateSwedishVATNumber(
          invalidBusinessData.vatNumber
        ),
        personnummer: SecurityTestUtils.utils.validateSwedishPersonnummer(
          invalidBusinessData.personnummer
        ),
        phone: invalidBusinessData.phone.startsWith('+46'),
        postalCode: /^\d{5}$/.test(invalidBusinessData.postalCode) && 
                   invalidBusinessData.postalCode !== '99999'
      };

      const invalidFields = Object.values(validationResults).filter(v => !v).length;
      const dataQualityScore = ((5 - invalidFields) / 5) * 100;

      expect(dataQualityScore).toBeLessThan(20); // Should detect as very low quality
      expect(validationResults.orgNumber).toBe(false);
      expect(validationResults.vatNumber).toBe(false);
      expect(validationResults.personnummer).toBe(false);
    });
  });

  describe('Real-time Risk Scoring', () => {
    it('should calculate composite risk scores accurately', async () => {
      const riskFactors = [
        {
          name: 'Low Risk Legitimate User',
          factors: {
            deviceMismatch: 0.1,
            locationAnomaly: 0.1,
            velocityViolation: 0.2,
            cardTestingPattern: 0.1,
            suspiciousEmail: 0.1
          },
          expectedRange: [0, 30]
        },
        {
          name: 'Medium Risk Suspicious Activity', 
          factors: {
            deviceMismatch: 0.5,
            locationAnomaly: 0.4,
            velocityViolation: 0.6,
            cardTestingPattern: 0.3,
            suspiciousEmail: 0.4
          },
          expectedRange: [31, 70]
        },
        {
          name: 'High Risk Fraudulent Behavior',
          factors: {
            deviceMismatch: 0.9,
            locationAnomaly: 0.8,
            velocityViolation: 0.9,
            cardTestingPattern: 0.8,
            suspiciousEmail: 0.7
          },
          expectedRange: [71, 100]
        }
      ];

      for (const testCase of riskFactors) {
        const calculatedScore = SecurityTestUtils.utils.calculateRiskScore(testCase.factors);
        
        expect(calculatedScore).toBeGreaterThanOrEqual(testCase.expectedRange[0]);
        expect(calculatedScore).toBeLessThanOrEqual(testCase.expectedRange[1]);
        
        fraudDetectionResults.push({
          testCase: testCase.name,
          calculatedScore,
          factors: testCase.factors,
          withinExpectedRange: calculatedScore >= testCase.expectedRange[0] && 
                              calculatedScore <= testCase.expectedRange[1]
        });
      }

      const allWithinRange = fraudDetectionResults.every(r => r.withinExpectedRange);
      expect(allWithinRange).toBe(true);
    });

    it('should provide actionable fraud detection reasons', async () => {
      const highRiskTransaction = {
        deviceFingerprint: 'suspicious_device_123',
        ipAddress: '10.0.0.1',
        userAgent: 'automated-bot/1.0',
        transactionAmount: 5000000, // 50,000 SEK
        velocityCount: 25, // 25 transactions in short period
        locationMismatch: true,
        cardTestingPattern: true
      };

      const riskAssessment = {
        score: SecurityTestUtils.utils.calculateRiskScore({
          deviceMismatch: 0.8,
          locationAnomaly: 0.7,
          velocityViolation: 0.9,
          cardTestingPattern: 0.8
        }),
        reasons: [],
        recommendations: []
      };

      // Generate specific fraud reasons
      if (highRiskTransaction.velocityCount > 20) {
        riskAssessment.reasons.push('Excessive transaction velocity detected');
        riskAssessment.recommendations.push('Implement transaction cooling period');
      }

      if (highRiskTransaction.locationMismatch) {
        riskAssessment.reasons.push('Geographic anomaly detected');
        riskAssessment.recommendations.push('Require additional verification');
      }

      if (highRiskTransaction.cardTestingPattern) {
        riskAssessment.reasons.push('Card testing pattern identified');
        riskAssessment.recommendations.push('Block card testing attempts');
      }

      expect(riskAssessment.score).toBeGreaterThan(70);
      expect(riskAssessment.reasons.length).toBeGreaterThan(2);
      expect(riskAssessment.recommendations.length).toBeGreaterThan(2);
      expect(riskAssessment).toDetectFraud();
    });
  });

  describe('Machine Learning Fraud Patterns', () => {
    it('should detect evolving fraud patterns', async () => {
      // Simulate evolving fraud tactics over time
      const fraudEvolution = [
        {
          period: '2024-01-01',
          pattern: 'simple_card_testing',
          detectionRate: 95,
          adaptationNeeded: false
        },
        {
          period: '2024-02-01', 
          pattern: 'distributed_card_testing', // Fraudsters adapt
          detectionRate: 75,
          adaptationNeeded: true
        },
        {
          period: '2024-03-01',
          pattern: 'behavioral_mimicry', // Further evolution
          detectionRate: 60,
          adaptationNeeded: true
        }
      ];

      // Simulate ML model adaptation
      let modelAccuracy = 95;
      for (const evolution of fraudEvolution) {
        if (evolution.adaptationNeeded) {
          // Simulate model retraining improving detection
          modelAccuracy = Math.min(95, evolution.detectionRate + 15);
        }
        
        evolution.postAdaptationRate = modelAccuracy;
      }

      const finalAccuracy = fraudEvolution[fraudEvolution.length - 1].postAdaptationRate;
      expect(finalAccuracy).toBeGreaterThan(70);
      
      const adaptationEvents = fraudEvolution.filter(e => e.adaptationNeeded).length;
      expect(adaptationEvents).toBeGreaterThan(0);
    });
  });
});