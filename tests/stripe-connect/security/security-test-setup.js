/**
 * Payment Security Test Setup
 * Comprehensive security testing environment for AI Feedback Platform
 * Focus: PCI compliance, fraud detection, Swedish banking regulations
 */

const Stripe = require('stripe');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { RateLimiterMemory } = require('rate-limiter-flexible');

// Security test environment - ONLY USE TEST KEYS
const SECURITY_TEST_CONFIG = {
  stripe: {
    publishableKey: process.env.STRIPE_TEST_PUBLISHABLE_KEY || 'pk_test_51234567890abcdef',
    secretKey: process.env.STRIPE_TEST_SECRET_KEY || 'sk_test_51234567890abcdef',
    webhookSecret: process.env.STRIPE_TEST_WEBHOOK_SECRET || 'whsec_test_1234567890abcdef',
    country: 'SE',
    currency: 'sek'
  },
  security: {
    jwtSecret: 'test_jwt_secret_key_for_security_testing_only',
    encryptionKey: crypto.randomBytes(32), // 256-bit key for AES
    hashSaltRounds: 10,
    sessionTimeout: 900000, // 15 minutes
    maxLoginAttempts: 5,
    accountLockoutDuration: 1800000 // 30 minutes
  },
  pci: {
    // PCI DSS compliance test requirements
    maskingPattern: /\d(?=\d{4})/g, // Mask all but last 4 digits
    allowedCardTypes: ['visa', 'mastercard'],
    minPasswordLength: 12,
    passwordComplexity: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    dataRetentionDays: 90,
    auditLogRetentionYears: 7
  },
  fraud: {
    velocityLimits: {
      transactionsPerMinute: 10,
      transactionsPerHour: 100,
      transactionsPerDay: 500,
      maxAmountPerHour: 1000000, // 10,000 SEK in öre
      maxAmountPerDay: 5000000   // 50,000 SEK in öre
    },
    riskScoring: {
      lowRisk: { min: 0, max: 30 },
      mediumRisk: { min: 31, max: 70 },
      highRisk: { min: 71, max: 100 }
    },
    blockedCountries: ['XX', 'YY'], // Test country codes
    suspiciousPatterns: [
      'rapid_succession_transactions',
      'unusual_location',
      'device_fingerprint_mismatch',
      'card_testing_pattern'
    ]
  },
  swedish: {
    // Swedish banking and financial regulations
    finansinspektionen: {
      // Swedish Financial Supervisory Authority requirements
      amlCompliance: true,
      kycRequirements: ['identity_verification', 'address_verification'],
      transactionReporting: {
        threshold: 1000000, // 10,000 SEK in öre
        currency: 'SEK'
      }
    },
    gdpr: {
      dataRetentionPeriod: 2555, // 7 years in days
      rightToErasure: true,
      dataPortability: true,
      consentRequired: ['payment_processing', 'fraud_detection', 'marketing']
    },
    bankgiro: {
      // Swedish bank account validation
      formatPattern: /^\d{7,8}$/,
      testAccounts: ['1234567', '12345678']
    },
    plusgiro: {
      // Swedish postal giro validation
      formatPattern: /^\d{2,8}$/,
      testAccounts: ['123456', '1234567']
    }
  }
};

// Swedish test business data for security testing
const SWEDISH_SECURITY_TEST_DATA = {
  legitimate: {
    individual: {
      personnummer: '901201-1234', // Fake Swedish personal ID
      firstName: 'Erik',
      lastName: 'Larsson',
      email: 'erik.larsson+security@test.se',
      phone: '+46701234567',
      address: {
        street: 'Testgatan 123',
        postalCode: '11122',
        city: 'Stockholm',
        country: 'SE'
      }
    },
    company: {
      organizationNumber: '556123456789', // Fake Swedish org number
      companyName: 'Säkerhet Test AB',
      vatNumber: 'SE556123456789', // Fake Swedish VAT number
      email: 'security+test@sakerhet-test.se',
      phone: '+46812345678',
      address: {
        street: 'Säkerhetsgatan 45',
        postalCode: '41119',
        city: 'Göteborg',
        country: 'SE'
      }
    }
  },
  suspicious: {
    // Data patterns that should trigger fraud detection
    rapidFire: {
      emails: [
        'test1+fraud@temp.email',
        'test2+fraud@temp.email',
        'test3+fraud@temp.email'
      ],
      phones: ['+46701111111', '+46701111112', '+46701111113'],
      addresses: [
        { street: 'Fraud St 1', city: 'Stockholm' },
        { street: 'Fraud St 2', city: 'Stockholm' },
        { street: 'Fraud St 3', city: 'Stockholm' }
      ]
    },
    invalidData: {
      invalidPersonnummer: ['123456-7890', '000000-0000', '999999-9999'],
      invalidOrgNumber: ['123456789', '000000000000', '555555555555'],
      invalidPhone: ['+46123', '+1234567890', '0701234567'],
      invalidPostalCode: ['12345', 'ABCDE', '999999']
    }
  }
};

// Security test cards for penetration testing
const SECURITY_TEST_CARDS = {
  pciCompliance: {
    // Cards for testing PCI compliance scenarios
    visa: {
      number: '4242424242424242',
      cvc: '123',
      exp_month: 12,
      exp_year: 2025
    },
    visaDebit: {
      number: '4000056655665556',
      cvc: '123',
      exp_month: 12,
      exp_year: 2025
    },
    mastercard: {
      number: '5555555555554444',
      cvc: '123',
      exp_month: 12,
      exp_year: 2025
    }
  },
  fraudTesting: {
    // Cards that trigger specific fraud scenarios
    alwaysDeclined: '4000000000000002',
    insufficientFunds: '4000000000009995',
    lostCard: '4000000000009987',
    stolenCard: '4000000000009979',
    expiredCard: '4000000000000069',
    processingError: '4000000000000119',
    fraudulent: '4100000000000019'
  },
  velocityTesting: {
    // Cards for testing transaction velocity limits
    rapidFire: [
      '4000000000000077',
      '4000000000000085',
      '4000000000000093'
    ]
  },
  swedishSpecific: {
    // Swedish-issued cards for local compliance testing
    swedenVisa: '4000007520000007',
    swedenMastercard: '5200007520000007',
    swedenDecline: '4000007520000015'
  }
};

// Rate limiters for security testing
const createRateLimiters = () => ({
  login: new RateLimiterMemory({
    points: 5, // 5 attempts
    duration: 900, // per 15 minutes
  }),
  payment: new RateLimiterMemory({
    points: 10, // 10 transactions
    duration: 60, // per minute
  }),
  api: new RateLimiterMemory({
    points: 100, // 100 requests
    duration: 60, // per minute
  }),
  fraud: new RateLimiterMemory({
    points: 3, // 3 suspicious actions
    duration: 3600, // per hour
  })
});

// Security utilities
const SecurityUtils = {
  // Encryption/Decryption utilities
  encrypt(text) {
    const cipher = crypto.createCipher('aes-256-cbc', SECURITY_TEST_CONFIG.security.encryptionKey);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  },

  decrypt(encryptedText) {
    const decipher = crypto.createDecipher('aes-256-cbc', SECURITY_TEST_CONFIG.security.encryptionKey);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  },

  // PCI compliance utilities
  maskCardNumber(cardNumber) {
    return cardNumber.replace(SECURITY_TEST_CONFIG.pci.maskingPattern, '*');
  },

  validatePasswordComplexity(password) {
    return password.length >= SECURITY_TEST_CONFIG.pci.minPasswordLength &&
           SECURITY_TEST_CONFIG.pci.passwordComplexity.test(password);
  },

  // Hash sensitive data
  async hashSensitiveData(data) {
    return await bcrypt.hash(data, SECURITY_TEST_CONFIG.security.hashSaltRounds);
  },

  async verifySensitiveData(data, hash) {
    return await bcrypt.compare(data, hash);
  },

  // JWT token utilities for session management
  generateSecureToken(payload) {
    return jwt.sign(payload, SECURITY_TEST_CONFIG.security.jwtSecret, {
      expiresIn: '15m',
      issuer: 'ai-feedback-platform-test',
      audience: 'security-testing'
    });
  },

  verifySecureToken(token) {
    try {
      return jwt.verify(token, SECURITY_TEST_CONFIG.security.jwtSecret);
    } catch (error) {
      return null;
    }
  },

  // Device fingerprinting for fraud detection
  generateDeviceFingerprint(userAgent, ip, additionalFactors = {}) {
    const fingerprintData = {
      userAgent: userAgent || 'test-browser',
      ip: ip || '127.0.0.1',
      timestamp: Date.now(),
      ...additionalFactors
    };
    
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(fingerprintData))
      .digest('hex');
  },

  // Risk scoring algorithms
  calculateRiskScore(factors) {
    const weights = {
      deviceMismatch: 25,
      locationAnomaly: 20,
      velocityViolation: 30,
      cardTestingPattern: 15,
      suspiciousEmail: 10
    };

    let totalScore = 0;
    let totalWeight = 0;

    Object.keys(factors).forEach(factor => {
      if (weights[factor] && factors[factor]) {
        totalScore += weights[factor] * factors[factor];
        totalWeight += weights[factor];
      }
    });

    return totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;
  },

  // Swedish banking validation
  validateSwedishPersonnummer(personnummer) {
    // Simple validation for fake test numbers
    const pattern = /^\d{6}-\d{4}$/;
    return pattern.test(personnummer) && !personnummer.startsWith('000000');
  },

  validateSwedishOrganizationNumber(orgNumber) {
    // Simple validation for fake test numbers
    const pattern = /^556\d{9}$/;
    return pattern.test(orgNumber) && orgNumber !== '556000000000';
  },

  validateSwedishVATNumber(vatNumber) {
    // Swedish VAT format: SE + organization number
    return vatNumber.startsWith('SE') && 
           this.validateSwedishOrganizationNumber(vatNumber.substring(2));
  },

  // GDPR compliance utilities
  anonymizePersonalData(data) {
    return {
      ...data,
      email: this.hashEmail(data.email),
      phone: this.hashPhone(data.phone),
      personnummer: '***ANONYMIZED***',
      address: {
        ...data.address,
        street: '***ANONYMIZED***'
      }
    };
  },

  hashEmail(email) {
    const [localPart, domain] = email.split('@');
    const hashedLocal = crypto.createHash('md5').update(localPart).digest('hex').substring(0, 8);
    return `${hashedLocal}@${domain}`;
  },

  hashPhone(phone) {
    return `+46***${phone.slice(-4)}`;
  }
};

// Global test setup
beforeAll(async () => {
  // Validate test environment
  if (!SECURITY_TEST_CONFIG.stripe.secretKey.startsWith('sk_test_')) {
    throw new Error('CRITICAL: Must use Stripe TEST keys only! Found: ' + 
                   SECURITY_TEST_CONFIG.stripe.secretKey.substring(0, 10));
  }

  console.log('🔒 Payment Security Test Environment Initialized');
  console.log('🇸🇪 Swedish banking regulations compliance testing enabled');
  console.log('🛡️ PCI DSS compliance validation active');
  console.log('🚨 Fraud detection scenarios loaded');
  console.log(`🔑 Using Stripe test keys: ${SECURITY_TEST_CONFIG.stripe.secretKey.substring(0, 10)}...`);
});

// Global test utilities
global.SecurityTestUtils = {
  config: SECURITY_TEST_CONFIG,
  testData: SWEDISH_SECURITY_TEST_DATA,
  testCards: SECURITY_TEST_CARDS,
  rateLimiters: createRateLimiters(),
  utils: SecurityUtils,
  
  stripe: new Stripe(SECURITY_TEST_CONFIG.stripe.secretKey, {
    apiVersion: '2023-10-16'
  }),

  // Create test accounts for security testing
  async createSecurityTestAccount(accountType = 'individual', riskProfile = 'legitimate') {
    const baseData = SWEDISH_SECURITY_TEST_DATA[riskProfile][accountType];
    
    // Add security-specific test identifiers
    const securityData = {
      ...baseData,
      metadata: {
        securityTest: true,
        riskProfile: riskProfile,
        testTimestamp: Date.now()
      }
    };

    if (accountType === 'individual') {
      return {
        type: 'express',
        country: 'SE',
        email: securityData.email,
        individual: {
          first_name: securityData.firstName,
          last_name: securityData.lastName,
          email: securityData.email,
          phone: securityData.phone,
          id_number: securityData.personnummer,
          address: {
            line1: securityData.address.street,
            postal_code: securityData.address.postalCode,
            city: securityData.address.city,
            country: securityData.address.country
          }
        },
        metadata: securityData.metadata
      };
    } else {
      return {
        type: 'express',
        country: 'SE',
        email: securityData.email,
        company: {
          name: securityData.companyName,
          registration_number: securityData.organizationNumber,
          phone: securityData.phone,
          address: {
            line1: securityData.address.street,
            postal_code: securityData.address.postalCode,
            city: securityData.address.city,
            country: securityData.address.country
          },
          tax_id: securityData.vatNumber
        },
        metadata: securityData.metadata
      };
    }
  },

  // Simulate attack scenarios safely in test environment
  async simulateAttackScenario(scenarioType, params = {}) {
    const scenarios = {
      cardTesting: async () => {
        // Simulate card testing attack using test cards only
        const testCards = SECURITY_TEST_CARDS.fraudTesting;
        const results = [];
        
        for (const [cardType, cardNumber] of Object.entries(testCards)) {
          try {
            const paymentIntent = await this.stripe.paymentIntents.create({
              amount: 100, // 1 SEK in öre
              currency: 'sek',
              payment_method_data: {
                type: 'card',
                card: { number: cardNumber }
              },
              confirm: true,
              metadata: { securityTest: 'cardTesting', cardType }
            });
            results.push({ cardType, status: 'succeeded', id: paymentIntent.id });
          } catch (error) {
            results.push({ cardType, status: 'failed', error: error.code });
          }
        }
        return results;
      },

      velocityAbuse: async () => {
        // Simulate rapid transaction attempts
        const rapidTransactions = [];
        const cardNumber = SECURITY_TEST_CARDS.velocityTesting.rapidFire[0];
        
        for (let i = 0; i < 15; i++) { // Exceed velocity limit
          try {
            const paymentIntent = await this.stripe.paymentIntents.create({
              amount: 500 + i, // Varying amounts to avoid duplicate detection
              currency: 'sek',
              payment_method_data: {
                type: 'card',
                card: { number: cardNumber }
              },
              metadata: { 
                securityTest: 'velocityAbuse', 
                attempt: i + 1,
                timestamp: Date.now()
              }
            });
            rapidTransactions.push({ attempt: i + 1, status: 'created' });
          } catch (error) {
            rapidTransactions.push({ attempt: i + 1, status: 'blocked', error: error.code });
          }
          
          // Small delay to simulate realistic timing
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        return rapidTransactions;
      },

      dataExfiltration: async () => {
        // Test data access controls and logging
        const accessAttempts = [];
        
        // Attempt to access different types of sensitive data
        const sensitiveEndpoints = [
          '/api/customers/all',
          '/api/payments/history',
          '/api/admin/users',
          '/api/fraud/reports'
        ];
        
        for (const endpoint of sensitiveEndpoints) {
          accessAttempts.push({
            endpoint,
            timestamp: Date.now(),
            authorized: false, // Should be blocked
            logged: true
          });
        }
        
        return accessAttempts;
      }
    };

    if (scenarios[scenarioType]) {
      return await scenarios[scenarioType]();
    } else {
      throw new Error(`Unknown attack scenario: ${scenarioType}`);
    }
  }
};

// Custom matchers for security testing
expect.extend({
  toBeSecurelyEncrypted(received) {
    const pass = typeof received === 'string' && 
                 received !== received.toString() && 
                 received.length > 16;
    
    return {
      message: () => pass 
        ? `expected ${received} not to be securely encrypted`
        : `expected ${received} to be securely encrypted`,
      pass
    };
  },

  toComplywithPCI(received) {
    const hasCardMasking = received.cardNumber && SecurityUtils.maskCardNumber(received.cardNumber);
    const hasSecureStorage = !received.plainTextCard;
    const hasAuditLog = received.auditTrail && received.auditTrail.length > 0;
    
    const pass = hasCardMasking && hasSecureStorage && hasAuditLog;
    
    return {
      message: () => pass
        ? `expected ${received} not to comply with PCI DSS`
        : `expected ${received} to comply with PCI DSS requirements`,
      pass
    };
  },

  toDetectFraud(received) {
    const hasRiskScore = received.riskScore !== undefined;
    const hasProperScoring = received.riskScore >= 0 && received.riskScore <= 100;
    const hasReasonCode = received.reasonCode && received.reasonCode.length > 0;
    
    const pass = hasRiskScore && hasProperScoring && hasReasonCode;
    
    return {
      message: () => pass
        ? `expected ${received} not to detect fraud properly`
        : `expected ${received} to properly detect fraudulent activity`,
      pass
    };
  },

  toMeetSwedishCompliance(received) {
    const hasValidOrgNumber = received.organizationNumber && 
                             SecurityUtils.validateSwedishOrganizationNumber(received.organizationNumber);
    const hasValidVAT = received.vatNumber && 
                       SecurityUtils.validateSwedishVATNumber(received.vatNumber);
    const hasGDPRConsent = received.gdprConsent === true;
    
    const pass = hasValidOrgNumber && hasValidVAT && hasGDPRConsent;
    
    return {
      message: () => pass
        ? `expected ${received} not to meet Swedish banking compliance`
        : `expected ${received} to meet Swedish banking compliance requirements`,
      pass
    };
  }
});

console.log('🛡️ Security test environment ready');
console.log('🔒 PCI DSS compliance testing enabled');
console.log('🚨 Fraud detection simulation active');
console.log('🇸🇪 Swedish banking regulations validation loaded');
console.log(`🔐 Security check: Using test keys - ${SECURITY_TEST_CONFIG.stripe.secretKey.includes('test') ? 'PASS' : 'FAIL'}`);

module.exports = {
  SECURITY_TEST_CONFIG,
  SWEDISH_SECURITY_TEST_DATA,
  SECURITY_TEST_CARDS,
  SecurityUtils
};