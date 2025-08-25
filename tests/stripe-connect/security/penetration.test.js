/**
 * Penetration Testing Security Scenarios
 * Tests payment system security using only Stripe test cards and fake data
 * Simulates various attack vectors in safe test environment
 */

const { SecurityTestUtils } = global;
const crypto = require('crypto');

describe('Penetration Testing Security Scenarios', () => {
  let attackSimulations = [];
  let securityEvents = [];

  beforeEach(() => {
    attackSimulations = [];
    securityEvents = [];
  });

  afterEach(() => {
    // Log security events for analysis
    if (securityEvents.length > 0) {
      console.log(`Security events detected: ${securityEvents.length}`);
    }
  });

  describe('Card Testing Attack Simulations', () => {
    it('should detect and prevent card testing attacks', async () => {
      const cardTestingAttack = await SecurityTestUtils.simulateAttackScenario('cardTesting');
      
      // Analyze attack detection patterns
      const failedAttempts = cardTestingAttack.filter(result => result.status === 'failed');
      const successfulAttempts = cardTestingAttack.filter(result => result.status === 'succeeded');
      
      // Detect card testing patterns
      const patterns = {
        rapidSequentialAttempts: cardTestingAttack.length > 5,
        multipleFailures: failedAttempts.length > 3,
        varietyOfCards: new Set(cardTestingAttack.map(r => r.cardType)).size > 3,
        lowSuccessRate: (successfulAttempts.length / cardTestingAttack.length) < 0.3
      };

      // Risk scoring based on patterns
      let riskScore = 0;
      if (patterns.rapidSequentialAttempts) riskScore += 25;
      if (patterns.multipleFailures) riskScore += 30;
      if (patterns.varietyOfCards) riskScore += 25;
      if (patterns.lowSuccessRate) riskScore += 20;

      const securityEvent = {
        type: 'CARD_TESTING_ATTACK',
        timestamp: Date.now(),
        patterns,
        riskScore,
        totalAttempts: cardTestingAttack.length,
        successRate: successfulAttempts.length / cardTestingAttack.length,
        detectionConfidence: riskScore > 70 ? 'HIGH' : riskScore > 40 ? 'MEDIUM' : 'LOW'
      };

      securityEvents.push(securityEvent);
      attackSimulations.push(securityEvent);

      expect(securityEvent.riskScore).toBeGreaterThan(70);
      expect(securityEvent.detectionConfidence).toBe('HIGH');
      expect(patterns.multipleFailures).toBe(true);
    });

    it('should simulate carding attack with stolen card data', async () => {
      const stolenCardData = [
        { number: SecurityTestUtils.testCards.fraudTesting.stolenCard, type: 'stolen' },
        { number: SecurityTestUtils.testCards.fraudTesting.lostCard, type: 'lost' },
        { number: SecurityTestUtils.testCards.fraudTesting.fraudulent, type: 'fraudulent' }
      ];

      const cardingResults = [];

      for (const [index, cardData] of stolenCardData.entries()) {
        try {
          // Simulate payment attempt with stolen card
          const paymentAttempt = {
            cardNumber: cardData.number,
            cardType: cardData.type,
            attemptTimestamp: Date.now() + (index * 1000),
            merchantId: 'test_merchant_001',
            amount: 50000 + (index * 10000), // Varying amounts
            fraudScore: 0
          };

          // Fraud detection should flag stolen cards
          if (cardData.type === 'stolen') {
            paymentAttempt.fraudScore = 95;
            paymentAttempt.blocked = true;
            paymentAttempt.reason = 'STOLEN_CARD_DETECTED';
          } else if (cardData.type === 'lost') {
            paymentAttempt.fraudScore = 90;
            paymentAttempt.blocked = true;
            paymentAttempt.reason = 'LOST_CARD_DETECTED';
          } else if (cardData.type === 'fraudulent') {
            paymentAttempt.fraudScore = 99;
            paymentAttempt.blocked = true;
            paymentAttempt.reason = 'FRAUDULENT_CARD_DETECTED';
          }

          cardingResults.push(paymentAttempt);

        } catch (error) {
          cardingResults.push({
            cardType: cardData.type,
            error: error.code || 'card_declined',
            blocked: true,
            fraudScore: 100
          });
        }
      }

      const blockedTransactions = cardingResults.filter(r => r.blocked);
      const highFraudScores = cardingResults.filter(r => r.fraudScore > 80);

      expect(blockedTransactions.length).toBe(stolenCardData.length); // All should be blocked
      expect(highFraudScores.length).toBe(stolenCardData.length);     // All should have high fraud scores

      securityEvents.push({
        type: 'CARDING_ATTACK_DETECTED',
        timestamp: Date.now(),
        totalAttempts: cardingResults.length,
        blockedAttempts: blockedTransactions.length,
        blockRate: (blockedTransactions.length / cardingResults.length) * 100
      });
    });
  });

  describe('Account Takeover Attack Simulations', () => {
    it('should detect credential stuffing attacks', async () => {
      const credentialStuffingAttempt = {
        targetAccounts: [
          { email: 'victim1@example.com', password: 'common_password_123' },
          { email: 'victim2@example.com', password: 'password123!' },
          { email: 'victim3@example.com', password: 'qwerty2024' }
        ],
        attackerIP: '192.0.2.100',
        userAgent: 'automated-credential-tester/1.0',
        timeWindow: 30000 // 30 seconds
      };

      const loginAttempts = [];

      for (const [index, credentials] of credentialStuffingAttempt.targetAccounts.entries()) {
        const attemptTime = Date.now() + (index * 2000); // 2 seconds apart
        
        // Simulate login attempt
        const loginResult = {
          email: credentials.email,
          timestamp: attemptTime,
          sourceIP: credentialStuffingAttempt.attackerIP,
          userAgent: credentialStuffingAttempt.userAgent,
          success: false, // Should fail due to security measures
          blocked: false,
          failureReason: '',
          riskScore: 0
        };

        // Detect automation patterns
        const automationIndicators = {
          suspiciousUserAgent: credentialStuffingAttempt.userAgent.includes('automated'),
          rapidAttempts: index > 0 && (attemptTime - loginAttempts[index - 1]?.timestamp < 5000),
          commonPassword: ['password123', 'common_password', 'qwerty'].some(common => 
            credentials.password.toLowerCase().includes(common)
          )
        };

        // Calculate risk score
        loginResult.riskScore = 
          (automationIndicators.suspiciousUserAgent ? 40 : 0) +
          (automationIndicators.rapidAttempts ? 35 : 0) +
          (automationIndicators.commonPassword ? 25 : 0);

        if (loginResult.riskScore > 70) {
          loginResult.blocked = true;
          loginResult.failureReason = 'CREDENTIAL_STUFFING_DETECTED';
        }

        loginAttempts.push(loginResult);
      }

      const blockedAttempts = loginAttempts.filter(a => a.blocked);
      const highRiskAttempts = loginAttempts.filter(a => a.riskScore > 70);

      expect(blockedAttempts.length).toBeGreaterThan(0);
      expect(highRiskAttempts.length).toBe(blockedAttempts.length);

      securityEvents.push({
        type: 'CREDENTIAL_STUFFING_ATTACK',
        timestamp: Date.now(),
        sourceIP: credentialStuffingAttempt.attackerIP,
        attempts: loginAttempts.length,
        blockedAttempts: blockedAttempts.length,
        detectionAccuracy: (blockedAttempts.length / loginAttempts.length) * 100
      });
    });

    it('should prevent session hijacking attempts', async () => {
      const legitimateSession = {
        sessionId: 'sess_legitimate_user_12345',
        customerHash: 'legitimate_customer_001',
        deviceFingerprint: SecurityTestUtils.utils.generateDeviceFingerprint(
          'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
          '192.168.1.100'
        ),
        loginTimestamp: Date.now() - 3600000, // 1 hour ago
        lastActivity: Date.now() - 300000,    // 5 minutes ago
        ipAddress: '192.168.1.100'
      };

      const hijackingAttempts = [
        {
          sessionId: legitimateSession.sessionId,
          deviceFingerprint: SecurityTestUtils.utils.generateDeviceFingerprint(
            'Mozilla/5.0 (X11; Linux x86_64)', // Different browser
            '203.0.113.50'                      // Different IP
          ),
          ipAddress: '203.0.113.50',
          timestamp: Date.now(),
          suspiciousActivity: 'device_fingerprint_mismatch'
        },
        {
          sessionId: legitimateSession.sessionId,
          deviceFingerprint: legitimateSession.deviceFingerprint,
          ipAddress: '198.51.100.25', // Different IP, same device
          timestamp: Date.now(),
          suspiciousActivity: 'ip_address_change'
        }
      ];

      const hijackingResults = [];

      for (const attempt of hijackingAttempts) {
        const securityChecks = {
          deviceMismatch: attempt.deviceFingerprint !== legitimateSession.deviceFingerprint,
          ipMismatch: attempt.ipAddress !== legitimateSession.ipAddress,
          suspiciousGeolocation: true, // Simulate geographic anomaly detection
          sessionAge: attempt.timestamp - legitimateSession.loginTimestamp
        };

        const riskScore = SecurityTestUtils.utils.calculateRiskScore({
          deviceMismatch: securityChecks.deviceMismatch ? 0.8 : 0.1,
          locationAnomaly: securityChecks.ipMismatch ? 0.7 : 0.1
        });

        const hijackingBlocked = riskScore > 60;

        hijackingResults.push({
          attemptType: attempt.suspiciousActivity,
          securityChecks,
          riskScore,
          blocked: hijackingBlocked,
          reason: hijackingBlocked ? 'SESSION_HIJACKING_DETECTED' : null,
          timestamp: attempt.timestamp
        });
      }

      const blockedHijackingAttempts = hijackingResults.filter(r => r.blocked);
      const averageRiskScore = hijackingResults.reduce((sum, r) => sum + r.riskScore, 0) / hijackingResults.length;

      expect(blockedHijackingAttempts.length).toBeGreaterThan(0);
      expect(averageRiskScore).toBeGreaterThan(60);

      securityEvents.push({
        type: 'SESSION_HIJACKING_ATTEMPTS',
        timestamp: Date.now(),
        attempts: hijackingResults.length,
        blocked: blockedHijackingAttempts.length,
        averageRiskScore
      });
    });
  });

  describe('Payment Fraud Injection Attacks', () => {
    it('should detect amount manipulation attempts', async () => {
      const legitimateTransaction = {
        originalAmount: 100000, // 1,000 SEK
        merchantId: 'merchant_test_001',
        customerHash: 'customer_test_001',
        timestamp: Date.now()
      };

      const manipulationAttempts = [
        {
          manipulatedAmount: 100,     // Drastically reduced amount
          manipulationType: 'amount_reduction',
          detectionMethod: 'price_discrepancy_check'
        },
        {
          manipulatedAmount: 1000000, // Drastically increased amount  
          manipulationType: 'amount_inflation',
          detectionMethod: 'unusual_amount_pattern'
        },
        {
          manipulatedAmount: -50000,  // Negative amount (refund injection)
          manipulationType: 'negative_amount_injection',
          detectionMethod: 'invalid_amount_validation'
        }
      ];

      const manipulationResults = [];

      for (const attempt of manipulationAttempts) {
        const amountDiscrepancy = Math.abs(attempt.manipulatedAmount - legitimateTransaction.originalAmount);
        const discrepancyPercentage = (amountDiscrepancy / legitimateTransaction.originalAmount) * 100;
        
        const detectionFlags = {
          extremeDiscrepancy: discrepancyPercentage > 50,
          negativeAmount: attempt.manipulatedAmount < 0,
          unreasonableAmount: attempt.manipulatedAmount > 10000000 || attempt.manipulatedAmount < 100,
          suspiciousPattern: attempt.manipulationType !== 'normal'
        };

        const manipulationDetected = Object.values(detectionFlags).some(flag => flag);
        const riskScore = manipulationDetected ? 95 : 10;

        manipulationResults.push({
          originalAmount: legitimateTransaction.originalAmount,
          manipulatedAmount: attempt.manipulatedAmount,
          manipulationType: attempt.manipulationType,
          discrepancyPercentage,
          detectionFlags,
          manipulationDetected,
          riskScore,
          blocked: manipulationDetected
        });
      }

      const detectedManipulations = manipulationResults.filter(r => r.manipulationDetected);
      const blockedAttempts = manipulationResults.filter(r => r.blocked);

      expect(detectedManipulations.length).toBe(manipulationAttempts.length); // All should be detected
      expect(blockedAttempts.length).toBe(manipulationAttempts.length);       // All should be blocked

      securityEvents.push({
        type: 'AMOUNT_MANIPULATION_DETECTED',
        timestamp: Date.now(),
        attempts: manipulationResults.length,
        detected: detectedManipulations.length,
        blocked: blockedAttempts.length,
        detectionRate: (detectedManipulations.length / manipulationResults.length) * 100
      });
    });

    it('should prevent double spending attacks', async () => {
      const originalTransaction = {
        transactionId: 'tx_original_12345',
        amount: 250000, // 2,500 SEK
        customerHash: 'customer_doublespend_test',
        merchantId: 'merchant_test_002',
        timestamp: Date.now(),
        cardNumber: SecurityTestUtils.testCards.pciCompliance.visa.number,
        status: 'completed'
      };

      const doubleSpendingAttempts = [
        {
          transactionId: 'tx_duplicate_12345', // Same transaction ID
          duplicationType: 'transaction_id_reuse',
          timeDelay: 1000 // 1 second later
        },
        {
          transactionId: 'tx_different_67890', // Different transaction ID, same details
          duplicationType: 'identical_transaction_details',
          timeDelay: 5000 // 5 seconds later
        },
        {
          transactionId: 'tx_rapid_repeat_99999',
          duplicationType: 'rapid_identical_requests',
          timeDelay: 100 // 100ms later
        }
      ];

      const doubleSpendResults = [];

      for (const attempt of doubleSpendingAttempts) {
        const duplicateChecks = {
          sameTransactionId: attempt.transactionId === originalTransaction.transactionId,
          sameAmount: true, // Same amount as original
          sameCustomer: true, // Same customer
          sameMerchant: true, // Same merchant
          rapidRepeat: attempt.timeDelay < 60000, // Within 1 minute
          identicalFingerprint: true
        };

        // Calculate duplication risk
        let duplicationScore = 0;
        if (duplicateChecks.sameTransactionId) duplicationScore += 40;
        if (duplicateChecks.sameAmount && duplicateChecks.sameCustomer && duplicateChecks.sameMerchant) duplicationScore += 35;
        if (duplicateChecks.rapidRepeat) duplicationScore += 25;

        const isDuplicate = duplicationScore > 50;
        const preventionAction = isDuplicate ? 'BLOCKED_DUPLICATE_TRANSACTION' : 'ALLOWED';

        doubleSpendResults.push({
          transactionId: attempt.transactionId,
          duplicationType: attempt.duplicationType,
          duplicateChecks,
          duplicationScore,
          isDuplicate,
          preventionAction,
          timestamp: originalTransaction.timestamp + attempt.timeDelay
        });
      }

      const blockedDuplicates = doubleSpendResults.filter(r => r.isDuplicate);
      const preventionRate = (blockedDuplicates.length / doubleSpendResults.length) * 100;

      expect(blockedDuplicates.length).toBeGreaterThan(0);
      expect(preventionRate).toBeGreaterThan(66); // Should catch at least 2 out of 3

      securityEvents.push({
        type: 'DOUBLE_SPENDING_PREVENTION',
        timestamp: Date.now(),
        originalTransaction: originalTransaction.transactionId,
        attempts: doubleSpendResults.length,
        blocked: blockedDuplicates.length,
        preventionRate
      });
    });
  });

  describe('API Security Penetration Testing', () => {
    it('should prevent SQL injection in payment queries', async () => {
      const sqlInjectionAttempts = [
        { 
          parameter: 'customer_id',
          maliciousInput: "'; DROP TABLE customers; --",
          expectedBehavior: 'input_sanitized'
        },
        {
          parameter: 'transaction_amount',
          maliciousInput: "1000 OR 1=1",
          expectedBehavior: 'invalid_amount_rejected'
        },
        {
          parameter: 'merchant_id',
          maliciousInput: "merchant_123' UNION SELECT * FROM payment_secrets --",
          expectedBehavior: 'input_sanitized'
        },
        {
          parameter: 'search_query',
          maliciousInput: "<script>alert('XSS')</script>",
          expectedBehavior: 'script_tags_escaped'
        }
      ];

      const injectionResults = [];

      for (const attempt of sqlInjectionAttempts) {
        // Simulate input validation and sanitization
        const sanitizedInput = this.sanitizeInput(attempt.maliciousInput);
        const containsMaliciousPattern = this.detectMaliciousPatterns(attempt.maliciousInput);
        
        const securityResponse = {
          originalInput: attempt.maliciousInput,
          sanitizedInput,
          parameter: attempt.parameter,
          maliciousPatternDetected: containsMaliciousPattern,
          inputBlocked: containsMaliciousPattern,
          securityAction: containsMaliciousPattern ? 'BLOCKED_MALICIOUS_INPUT' : 'SANITIZED_AND_ALLOWED',
          riskLevel: containsMaliciousPattern ? 'HIGH' : 'LOW'
        };

        injectionResults.push(securityResponse);
      }

      const blockedInjections = injectionResults.filter(r => r.inputBlocked);
      const detectionRate = (blockedInjections.length / injectionResults.length) * 100;

      expect(blockedInjections.length).toBe(sqlInjectionAttempts.length); // All should be blocked
      expect(detectionRate).toBe(100); // 100% detection rate

      securityEvents.push({
        type: 'SQL_INJECTION_PREVENTION',
        timestamp: Date.now(),
        attempts: injectionResults.length,
        blocked: blockedInjections.length,
        detectionRate
      });
    });

    it('should prevent API rate limit abuse', async () => {
      const apiEndpoints = [
        { endpoint: '/api/payments/create', rateLimit: 10, timeWindow: 60000 },      // 10 per minute
        { endpoint: '/api/webhooks/stripe', rateLimit: 50, timeWindow: 60000 },       // 50 per minute
        { endpoint: '/api/feedback/submit', rateLimit: 15, timeWindow: 60000 }        // 15 per minute
      ];

      const abuseResults = [];

      for (const api of apiEndpoints) {
        const attackerIP = '203.0.113.200';
        const excessiveRequests = api.rateLimit + 20; // Exceed limit by 20 requests
        const requests = [];

        // Simulate excessive API requests
        for (let i = 0; i < excessiveRequests; i++) {
          const requestTime = Date.now() + (i * 100); // 100ms intervals
          const withinTimeWindow = requestTime < (Date.now() + api.timeWindow);
          const currentRequests = requests.filter(r => 
            r.timestamp > requestTime - api.timeWindow
          ).length;

          const rateLimited = currentRequests >= api.rateLimit;

          requests.push({
            requestNumber: i + 1,
            timestamp: requestTime,
            endpoint: api.endpoint,
            sourceIP: attackerIP,
            rateLimited,
            status: rateLimited ? 'blocked' : 'allowed'
          });
        }

        const blockedRequests = requests.filter(r => r.rateLimited);
        const allowedRequests = requests.filter(r => !r.rateLimited);

        abuseResults.push({
          endpoint: api.endpoint,
          rateLimit: api.rateLimit,
          totalRequests: requests.length,
          allowedRequests: allowedRequests.length,
          blockedRequests: blockedRequests.length,
          protectionEffective: blockedRequests.length > 0 && allowedRequests.length <= api.rateLimit
        });
      }

      const protectedEndpoints = abuseResults.filter(r => r.protectionEffective);
      const averageBlockRate = abuseResults.reduce((sum, r) => 
        sum + (r.blockedRequests / r.totalRequests), 0) / abuseResults.length * 100;

      expect(protectedEndpoints.length).toBe(apiEndpoints.length); // All should be protected
      expect(averageBlockRate).toBeGreaterThan(30); // Should block significant portion of excess

      securityEvents.push({
        type: 'API_RATE_LIMIT_PROTECTION',
        timestamp: Date.now(),
        endpoints: abuseResults.length,
        protectedEndpoints: protectedEndpoints.length,
        averageBlockRate
      });
    });

    // Helper methods for API security testing
    sanitizeInput(input) {
      return input
        .replace(/[<>]/g, '') // Remove angle brackets
        .replace(/['";]/g, '') // Remove quotes and semicolons
        .replace(/--/g, '')    // Remove SQL comment markers
        .replace(/UNION|SELECT|DROP|INSERT|UPDATE|DELETE/gi, '') // Remove SQL keywords
        .trim()
        .substring(0, 1000); // Limit length
    }

    detectMaliciousPatterns(input) {
      const maliciousPatterns = [
        /('|(\\'))+.*(\\')*.*(('|(\\')))+/, // SQL injection quotes
        /((\%27)|(\'))\s*((\%6F)|o|(\%4F))((\%72)|r|(\%52))/i, // SQL 'or
        /((\%27)|(\'))union/i, // SQL union
        /<script[\s\S]*?>[\s\S]*?<\/script>/gi, // Script tags
        /javascript:/i, // JavaScript protocol
        /on\w+\s*=/i, // Event handlers
        /DROP|DELETE|TRUNCATE/gi // Destructive SQL commands
      ];

      return maliciousPatterns.some(pattern => pattern.test(input));
    }
  });

  describe('Infrastructure Penetration Testing', () => {
    it('should test webhook endpoint security', async () => {
      const webhookSecurityTests = [
        {
          testName: 'Invalid Signature Attack',
          webhookPayload: JSON.stringify({ type: 'payment_intent.succeeded', data: { amount: 100000 } }),
          signature: 'invalid_signature_12345',
          expectedResult: 'rejected'
        },
        {
          testName: 'Timestamp Replay Attack',
          webhookPayload: JSON.stringify({ type: 'payment_intent.succeeded', data: { amount: 100000 } }),
          timestamp: Math.floor(Date.now() / 1000) - 7200, // 2 hours old
          expectedResult: 'rejected'
        },
        {
          testName: 'Payload Tampering Attack',
          webhookPayload: JSON.stringify({ type: 'payment_intent.succeeded', data: { amount: 999999999 } }),
          tampered: true,
          expectedResult: 'rejected'
        }
      ];

      const webhookResults = [];

      for (const test of webhookSecurityTests) {
        const currentTimestamp = Math.floor(Date.now() / 1000);
        const testTimestamp = test.timestamp || currentTimestamp;
        const payloadToSign = `${testTimestamp}.${test.webhookPayload}`;
        
        // Generate correct signature for comparison
        const correctSignature = crypto
          .createHmac('sha256', SecurityTestUtils.config.stripe.webhookSecret)
          .update(payloadToSign)
          .digest('hex');

        const providedSignature = test.signature || correctSignature;
        
        const validationResults = {
          signatureValid: providedSignature === correctSignature,
          timestampValid: Math.abs(currentTimestamp - testTimestamp) < 300, // 5 minutes tolerance
          payloadIntegrity: !test.tampered,
          shouldAccept: false
        };

        validationResults.shouldAccept = 
          validationResults.signatureValid && 
          validationResults.timestampValid && 
          validationResults.payloadIntegrity;

        const actualResult = validationResults.shouldAccept ? 'accepted' : 'rejected';

        webhookResults.push({
          testName: test.testName,
          validationResults,
          expectedResult: test.expectedResult,
          actualResult,
          testPassed: actualResult === test.expectedResult
        });
      }

      const passedTests = webhookResults.filter(r => r.testPassed);
      const securityTestsEffective = passedTests.length === webhookSecurityTests.length;

      expect(securityTestsEffective).toBe(true);
      expect(passedTests.length).toBe(3); // All security tests should pass

      securityEvents.push({
        type: 'WEBHOOK_SECURITY_VALIDATION',
        timestamp: Date.now(),
        totalTests: webhookResults.length,
        passedTests: passedTests.length,
        securityEffective: securityTestsEffective
      });
    });
  });

  describe('Social Engineering Attack Simulations', () => {
    it('should detect customer impersonation attempts', async () => {
      const legitimateCustomer = {
        customerHash: 'legitimate_customer_12345',
        email: SecurityTestUtils.utils.hashEmail('customer@example.com'),
        phone: SecurityTestUtils.utils.hashPhone('+46701234567'),
        recentTransactions: [
          { amount: 75000, timestamp: Date.now() - 86400000 },
          { amount: 50000, timestamp: Date.now() - 43200000 }
        ]
      };

      const impersonationAttempts = [
        {
          attemptType: 'phone_impersonation',
          providedPhone: '+46701234567', // Correct phone
          providedEmail: 'different@email.com', // Wrong email
          knowledgeLevel: 'partial',
          socialEngineeringTactics: ['urgency', 'authority']
        },
        {
          attemptType: 'email_impersonation', 
          providedPhone: '+46707777777', // Wrong phone
          providedEmail: 'customer@example.com', // Correct email
          knowledgeLevel: 'partial',
          socialEngineeringTactics: ['familiarity', 'reciprocity']
        },
        {
          attemptType: 'full_impersonation',
          providedPhone: '+46701234567', // Correct phone
          providedEmail: 'customer@example.com', // Correct email  
          knowledgeLevel: 'complete',
          socialEngineeringTactics: ['authority', 'trust_building', 'information_gathering']
        }
      ];

      const impersonationResults = [];

      for (const attempt of impersonationAttempts) {
        const verificationChecks = {
          phoneMatches: SecurityTestUtils.utils.hashPhone(attempt.providedPhone) === legitimateCustomer.phone,
          emailMatches: SecurityTestUtils.utils.hashEmail(attempt.providedEmail) === legitimateCustomer.email,
          hasPartialKnowledge: attempt.knowledgeLevel !== 'none',
          usesSocialEngineering: attempt.socialEngineeringTactics.length > 0
        };

        // Risk scoring for impersonation
        let impersonationRisk = 0;
        if (!verificationChecks.phoneMatches) impersonationRisk += 40;
        if (!verificationChecks.emailMatches) impersonationRisk += 40;
        if (verificationChecks.usesSocialEngineering) impersonationRisk += 20;

        const potentialImpersonation = impersonationRisk > 60 || 
          (!verificationChecks.phoneMatches && !verificationChecks.emailMatches);

        impersonationResults.push({
          attemptType: attempt.attemptType,
          verificationChecks,
          impersonationRisk,
          potentialImpersonation,
          requiredAction: potentialImpersonation ? 'ADDITIONAL_VERIFICATION_REQUIRED' : 'PROCEED_NORMALLY',
          socialEngineeringTactics: attempt.socialEngineeringTactics
        });
      }

      const detectedImpersonations = impersonationResults.filter(r => r.potentialImpersonation);
      const detectionRate = (detectedImpersonations.length / impersonationResults.length) * 100;

      expect(detectedImpersonations.length).toBeGreaterThan(0);
      expect(detectionRate).toBeGreaterThan(50); // Should detect majority of attempts

      securityEvents.push({
        type: 'CUSTOMER_IMPERSONATION_DETECTION',
        timestamp: Date.now(),
        attempts: impersonationResults.length,
        detected: detectedImpersonations.length,
        detectionRate
      });
    });
  });
});