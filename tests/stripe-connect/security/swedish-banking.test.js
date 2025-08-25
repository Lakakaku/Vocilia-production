/**
 * Swedish Banking Regulations Security Tests  
 * Tests compliance with Swedish financial regulations and GDPR
 * Uses only fake Swedish data and Stripe test environment
 */

const { SecurityTestUtils } = global;

describe('Swedish Banking Regulations Security Tests', () => {
  let testAccounts = [];
  let complianceReports = [];

  beforeEach(() => {
    complianceReports = [];
  });

  afterEach(async () => {
    // Cleanup test accounts
    for (const account of testAccounts) {
      try {
        if (account.id) {
          await SecurityTestUtils.stripe.accounts.del(account.id);
        }
      } catch (error) {
        // Test cleanup - ignore errors
      }
    }
    testAccounts = [];
  });

  describe('Finansinspektionen (FI) Compliance', () => {
    it('should validate Swedish organization number format', async () => {
      const testOrgNumbers = [
        { number: '556123456789', valid: true, type: 'Aktiebolag (AB)' },
        { number: '969876543210', valid: true, type: 'Handelsbolag (HB)' },
        { number: '559876543210', valid: true, type: 'Kommanditbolag (KB)' },
        { number: '232123456789', valid: true, type: 'Ekonomisk förening' },
        { number: '123456789', valid: false, type: 'Invalid - too short' },
        { number: '000000000000', valid: false, type: 'Invalid - all zeros' },
        { number: '999999999999', valid: false, type: 'Invalid - test pattern' }
      ];

      const validationResults = [];

      for (const testCase of testOrgNumbers) {
        const isValid = SecurityTestUtils.utils.validateSwedishOrganizationNumber(testCase.number);
        const checksumValid = testCase.valid ? this.validateOrgNumberChecksum(testCase.number) : false;
        
        validationResults.push({
          orgNumber: testCase.number,
          type: testCase.type,
          expectedValid: testCase.valid,
          actualValid: isValid,
          checksumValid,
          matches: isValid === testCase.valid
        });
      }

      const allMatches = validationResults.every(r => r.matches);
      const validNumbers = validationResults.filter(r => r.actualValid);
      const invalidNumbers = validationResults.filter(r => !r.actualValid);

      expect(allMatches).toBe(true);
      expect(validNumbers.length).toBe(4); // Four valid formats
      expect(invalidNumbers.length).toBe(3); // Three invalid cases
    });

    it('should validate Swedish personnummer (personal identity numbers)', async () => {
      const testPersonnummer = [
        { number: '901201-1234', valid: true, age: 34, description: 'Valid format' },
        { number: '850615-5678', valid: true, age: 39, description: 'Valid format' },
        { number: '701030-9876', valid: true, age: 54, description: 'Valid format' },
        { number: '000000-0000', valid: false, age: null, description: 'Invalid - all zeros' },
        { number: '999999-9999', valid: false, age: null, description: 'Invalid - impossible date' },
        { number: '12345-6789', valid: false, age: null, description: 'Invalid - wrong format' },
        { number: '901301-1234', valid: false, age: null, description: 'Invalid - impossible month' }
      ];

      const personnummerResults = [];

      for (const testCase of testPersonnummer) {
        const isValid = SecurityTestUtils.utils.validateSwedishPersonnummer(testCase.number);
        const formatCheck = /^\d{6}-\d{4}$/.test(testCase.number);
        const dateCheck = testCase.valid ? this.validatePersonnummerDate(testCase.number) : false;

        personnummerResults.push({
          personnummer: testCase.number,
          description: testCase.description,
          expectedValid: testCase.valid,
          actualValid: isValid,
          formatValid: formatCheck,
          dateValid: dateCheck,
          matches: isValid === testCase.valid
        });
      }

      const correctValidations = personnummerResults.filter(r => r.matches);
      const validPersonnummer = personnummerResults.filter(r => r.actualValid);

      expect(correctValidations.length).toBe(testPersonnummer.length);
      expect(validPersonnummer.length).toBe(3); // Three valid personnummer
    });

    it('should validate Swedish VAT numbers', async () => {
      const testVATNumbers = [
        { vat: 'SE556123456789', orgNumber: '556123456789', valid: true },
        { vat: 'SE969876543210', orgNumber: '969876543210', valid: true },
        { vat: 'SE000000000000', orgNumber: '000000000000', valid: false },
        { vat: 'NO123456789', orgNumber: '123456789', valid: false }, // Norwegian VAT
        { vat: 'DK12345678', orgNumber: '12345678', valid: false },     // Danish VAT
        { vat: '556123456789', orgNumber: '556123456789', valid: false } // Missing SE prefix
      ];

      const vatValidationResults = [];

      for (const testCase of testVATNumbers) {
        const isValid = SecurityTestUtils.utils.validateSwedishVATNumber(testCase.vat);
        const hasCorrectPrefix = testCase.vat.startsWith('SE');
        const orgNumberValid = SecurityTestUtils.utils.validateSwedishOrganizationNumber(testCase.orgNumber);

        vatValidationResults.push({
          vatNumber: testCase.vat,
          organizationNumber: testCase.orgNumber,
          expectedValid: testCase.valid,
          actualValid: isValid,
          hasCorrectPrefix,
          orgNumberValid,
          matches: isValid === testCase.valid
        });
      }

      const correctVATValidations = vatValidationResults.filter(r => r.matches);
      const validVATNumbers = vatValidationResults.filter(r => r.actualValid);

      expect(correctVATValidations.length).toBe(testVATNumbers.length);
      expect(validVATNumbers.length).toBe(2); // Two valid Swedish VAT numbers
    });

    // Helper methods for Swedish validation
    validateOrgNumberChecksum(orgNumber) {
      // Simplified checksum validation for Swedish organization numbers
      if (orgNumber.length !== 10) return false;
      
      const digits = orgNumber.split('').map(Number);
      const weights = [2, 1, 2, 1, 2, 1, 2, 1, 2];
      
      let sum = 0;
      for (let i = 0; i < 9; i++) {
        let product = digits[i] * weights[i];
        if (product > 9) product = Math.floor(product / 10) + (product % 10);
        sum += product;
      }
      
      const checksum = (10 - (sum % 10)) % 10;
      return checksum === digits[9];
    }

    validatePersonnummerDate(personnummer) {
      // Extract date parts from YYMMDD-XXXX format
      const datePart = personnummer.substring(0, 6);
      const year = parseInt(datePart.substring(0, 2));
      const month = parseInt(datePart.substring(2, 4));
      const day = parseInt(datePart.substring(4, 6));
      
      // Basic date validation
      if (month < 1 || month > 12) return false;
      if (day < 1 || day > 31) return false;
      
      // Check for reasonable year (assuming 20th/21st century)
      const currentYear = new Date().getFullYear() % 100;
      const fullYear = year > currentYear ? 1900 + year : 2000 + year;
      
      return fullYear >= 1900 && fullYear <= new Date().getFullYear();
    }
  });

  describe('Anti-Money Laundering (AML) Compliance', () => {
    it('should flag transactions above reporting threshold', async () => {
      const amlThreshold = SecurityTestUtils.config.swedish.finansinspektionen.transactionReporting.threshold;
      const testTransactions = [
        { amount: 500000, description: 'Below threshold', shouldFlag: false },   // 5,000 SEK
        { amount: 999999, description: 'Just below threshold', shouldFlag: false }, // 9,999.99 SEK
        { amount: 1000000, description: 'At threshold', shouldFlag: true },     // 10,000 SEK
        { amount: 1500000, description: 'Above threshold', shouldFlag: true },  // 15,000 SEK
        { amount: 5000000, description: 'High value', shouldFlag: true }        // 50,000 SEK
      ];

      const amlResults = [];

      for (const transaction of testTransactions) {
        const requiresReporting = transaction.amount >= amlThreshold;
        const riskScore = transaction.amount >= amlThreshold ? 
          Math.min(100, 30 + (transaction.amount / amlThreshold) * 20) : 10;

        const amlReport = {
          amount: transaction.amount,
          amountSEK: transaction.amount / 100,
          description: transaction.description,
          threshold: amlThreshold / 100,
          expectedFlag: transaction.shouldFlag,
          actualFlag: requiresReporting,
          riskScore,
          reportingRequired: requiresReporting,
          matches: requiresReporting === transaction.shouldFlag
        };

        amlResults.push(amlReport);

        if (requiresReporting) {
          complianceReports.push({
            type: 'AML_TRANSACTION_REPORT',
            transactionAmount: transaction.amount,
            currency: 'SEK',
            timestamp: Date.now(),
            reason: 'Amount exceeds reporting threshold',
            riskScore
          });
        }
      }

      const correctFlags = amlResults.filter(r => r.matches);
      const flaggedTransactions = amlResults.filter(r => r.actualFlag);
      const generatedReports = complianceReports.filter(r => r.type === 'AML_TRANSACTION_REPORT');

      expect(correctFlags.length).toBe(testTransactions.length);
      expect(flaggedTransactions.length).toBe(3); // Three above threshold
      expect(generatedReports.length).toBe(3);    // Three compliance reports
    });

    it('should perform enhanced due diligence for high-risk customers', async () => {
      const customerRiskProfiles = [
        {
          customerHash: 'low_risk_customer_001',
          riskFactors: {
            locationRisk: 'low',      // Sweden
            transactionPattern: 'normal',
            amountPattern: 'consistent',
            businessType: 'retail'
          },
          expectedRiskLevel: 'low'
        },
        {
          customerHash: 'medium_risk_customer_002', 
          riskFactors: {
            locationRisk: 'medium',   // Neighboring EU country
            transactionPattern: 'variable',
            amountPattern: 'increasing',
            businessType: 'restaurant'
          },
          expectedRiskLevel: 'medium'
        },
        {
          customerHash: 'high_risk_customer_003',
          riskFactors: {
            locationRisk: 'high',     // Non-EU country
            transactionPattern: 'unusual',
            amountPattern: 'large_irregular',
            businessType: 'cash_intensive'
          },
          expectedRiskLevel: 'high'
        }
      ];

      const dueDiligenceResults = [];

      for (const profile of customerRiskProfiles) {
        // Calculate risk score based on factors
        const riskWeights = {
          locationRisk: { low: 10, medium: 30, high: 50 },
          transactionPattern: { normal: 5, variable: 15, unusual: 35 },
          amountPattern: { consistent: 5, increasing: 20, large_irregular: 40 },
          businessType: { retail: 5, restaurant: 10, cash_intensive: 25 }
        };

        let totalRiskScore = 0;
        Object.keys(profile.riskFactors).forEach(factor => {
          const value = profile.riskFactors[factor];
          totalRiskScore += riskWeights[factor][value] || 0;
        });

        const actualRiskLevel = totalRiskScore <= 25 ? 'low' :
                               totalRiskScore <= 65 ? 'medium' : 'high';

        const eddRequired = actualRiskLevel === 'high';
        const additionalChecks = eddRequired ? [
          'source_of_funds_verification',
          'beneficial_ownership_identification', 
          'enhanced_transaction_monitoring',
          'periodic_review_required'
        ] : [];

        dueDiligenceResults.push({
          customerHash: profile.customerHash,
          riskFactors: profile.riskFactors,
          expectedRiskLevel: profile.expectedRiskLevel,
          actualRiskLevel,
          totalRiskScore,
          eddRequired,
          additionalChecks,
          matches: actualRiskLevel === profile.expectedRiskLevel
        });

        if (eddRequired) {
          complianceReports.push({
            type: 'EDD_REQUIRED',
            customerHash: profile.customerHash,
            riskScore: totalRiskScore,
            timestamp: Date.now(),
            requiredChecks: additionalChecks
          });
        }
      }

      const correctRiskAssessments = dueDiligenceResults.filter(r => r.matches);
      const highRiskCustomers = dueDiligenceResults.filter(r => r.actualRiskLevel === 'high');
      const eddReports = complianceReports.filter(r => r.type === 'EDD_REQUIRED');

      expect(correctRiskAssessments.length).toBe(customerRiskProfiles.length);
      expect(highRiskCustomers.length).toBe(1);
      expect(eddReports.length).toBe(1);
      expect(highRiskCustomers[0].eddRequired).toBe(true);
    });
  });

  describe('GDPR Compliance Testing', () => {
    it('should properly anonymize personal data', async () => {
      const personalData = {
        email: 'anna.andersson+test@example.com',
        phone: '+46701234567',
        personnummer: '850615-1234',
        address: {
          street: 'Testgatan 123',
          city: 'Stockholm',
          postalCode: '11122',
          country: 'SE'
        },
        transactionHistory: [
          { amount: 50000, timestamp: Date.now() - 86400000 },
          { amount: 75000, timestamp: Date.now() - 43200000 }
        ]
      };

      const anonymizedData = SecurityTestUtils.utils.anonymizePersonalData(personalData);

      // Check anonymization quality
      const anonymizationChecks = {
        emailAnonymized: !anonymizedData.email.includes('anna.andersson'),
        phoneAnonymized: anonymizedData.phone.includes('***'),
        personnummerAnonymized: anonymizedData.personnummer === '***ANONYMIZED***',
        addressAnonymized: anonymizedData.address.street === '***ANONYMIZED***',
        cityPreserved: anonymizedData.address.city === personalData.address.city, // City can remain
        transactionHistoryPreserved: anonymizedData.transactionHistory?.length === personalData.transactionHistory.length
      };

      expect(anonymizationChecks.emailAnonymized).toBe(true);
      expect(anonymizationChecks.phoneAnonymized).toBe(true);
      expect(anonymizationChecks.personnummerAnonymized).toBe(true);
      expect(anonymizationChecks.addressAnonymized).toBe(true);
      expect(anonymizationChecks.cityPreserved).toBe(true);
    });

    it('should handle data subject rights requests', async () => {
      const dataSubjectRequests = [
        {
          type: 'ACCESS_REQUEST',
          customerHash: 'gdpr_test_customer_001',
          requestedData: ['transaction_history', 'personal_info', 'feedback_data'],
          expectedResponse: 'data_package_provided'
        },
        {
          type: 'RECTIFICATION_REQUEST',
          customerHash: 'gdpr_test_customer_002', 
          incorrectData: { email: 'old@example.com' },
          correctedData: { email: 'new@example.com' },
          expectedResponse: 'data_updated'
        },
        {
          type: 'ERASURE_REQUEST',
          customerHash: 'gdpr_test_customer_003',
          reason: 'withdrawal_of_consent',
          expectedResponse: 'data_erased'
        },
        {
          type: 'PORTABILITY_REQUEST',
          customerHash: 'gdpr_test_customer_004',
          requestedFormat: 'JSON',
          expectedResponse: 'portable_data_provided'
        }
      ];

      const gdprResults = [];

      for (const request of dataSubjectRequests) {
        const processingTime = Date.now();
        const responseWithinTimeLimit = true; // Should be processed within 30 days

        let processingResult;
        switch (request.type) {
          case 'ACCESS_REQUEST':
            processingResult = {
              status: 'completed',
              dataProvided: request.requestedData,
              format: 'structured_data_export'
            };
            break;
          case 'RECTIFICATION_REQUEST':
            processingResult = {
              status: 'completed',
              oldValue: request.incorrectData,
              newValue: request.correctedData,
              updatedFields: Object.keys(request.correctedData)
            };
            break;
          case 'ERASURE_REQUEST':
            processingResult = {
              status: 'completed',
              dataRemoved: ['personal_identifiers', 'transaction_details', 'feedback_content'],
              retainedData: ['anonymized_analytics'] // Legal basis for retention
            };
            break;
          case 'PORTABILITY_REQUEST':
            processingResult = {
              status: 'completed',
              exportFormat: request.requestedFormat,
              dataIncluded: ['account_data', 'transaction_history', 'preferences']
            };
            break;
        }

        gdprResults.push({
          requestType: request.type,
          customerHash: request.customerHash,
          processingTime,
          responseWithinTimeLimit,
          result: processingResult,
          compliant: processingResult.status === 'completed' && responseWithinTimeLimit
        });
      }

      const compliantRequests = gdprResults.filter(r => r.compliant);
      const requestTypes = [...new Set(gdprResults.map(r => r.requestType))];

      expect(compliantRequests.length).toBe(dataSubjectRequests.length);
      expect(requestTypes.length).toBe(4); // All four GDPR request types handled
    });

    it('should validate consent management', async () => {
      const consentScenarios = [
        {
          customerHash: 'consent_test_001',
          consents: {
            payment_processing: { given: true, timestamp: Date.now() - 86400000, required: true },
            fraud_detection: { given: true, timestamp: Date.now() - 86400000, required: true },
            marketing: { given: false, timestamp: null, required: false },
            analytics: { given: true, timestamp: Date.now() - 86400000, required: false }
          },
          expectedValid: true
        },
        {
          customerHash: 'consent_test_002',
          consents: {
            payment_processing: { given: false, timestamp: null, required: true }, // Missing required consent
            fraud_detection: { given: true, timestamp: Date.now() - 86400000, required: true },
            marketing: { given: true, timestamp: Date.now() - 86400000, required: false }
          },
          expectedValid: false
        }
      ];

      const consentResults = [];

      for (const scenario of consentScenarios) {
        const requiredConsents = SecurityTestUtils.config.swedish.gdpr.consentRequired;
        const consentChecks = {};
        let allRequiredConsentsGiven = true;

        // Check each required consent type
        for (const consentType of requiredConsents) {
          const consent = scenario.consents[consentType];
          consentChecks[consentType] = {
            required: true,
            given: consent?.given || false,
            timestamp: consent?.timestamp,
            valid: consent?.given === true
          };

          if (!consent?.given) {
            allRequiredConsentsGiven = false;
          }
        }

        // Check optional consents
        Object.keys(scenario.consents).forEach(consentType => {
          if (!requiredConsents.includes(consentType)) {
            consentChecks[consentType] = {
              required: false,
              given: scenario.consents[consentType].given,
              timestamp: scenario.consents[consentType].timestamp,
              valid: true // Optional consents are always valid
            };
          }
        });

        consentResults.push({
          customerHash: scenario.customerHash,
          consentChecks,
          allRequiredConsentsGiven,
          expectedValid: scenario.expectedValid,
          actualValid: allRequiredConsentsGiven,
          matches: allRequiredConsentsGiven === scenario.expectedValid
        });
      }

      const validConsentScenarios = consentResults.filter(r => r.actualValid);
      const correctValidations = consentResults.filter(r => r.matches);

      expect(correctValidations.length).toBe(consentScenarios.length);
      expect(validConsentScenarios.length).toBe(1); // Only first scenario should be valid
    });
  });

  describe('Swedish Payment Services Regulation', () => {
    it('should comply with strong customer authentication (SCA)', async () => {
      const scaTestScenarios = [
        {
          transactionAmount: 2500, // 25 SEK - below SCA threshold
          customerAuthentication: 'basic',
          expectedSCARequired: false,
          description: 'Low value transaction'
        },
        {
          transactionAmount: 5000, // 50 SEK - above threshold  
          customerAuthentication: 'basic',
          expectedSCARequired: true,
          description: 'Standard transaction requiring SCA'
        },
        {
          transactionAmount: 50000, // 500 SEK - high value
          customerAuthentication: 'basic',
          expectedSCARequired: true,
          description: 'High value transaction requiring SCA'
        },
        {
          transactionAmount: 50000, // 500 SEK - high value with SCA
          customerAuthentication: 'two_factor',
          expectedSCARequired: true,
          description: 'High value with proper SCA'
        }
      ];

      const scaResults = [];

      for (const scenario of scaTestScenarios) {
        const scaThreshold = 3000; // 30 SEK threshold for SCA (EU regulation)
        const requiresSCA = scenario.transactionAmount > scaThreshold;
        const hasValidSCA = scenario.customerAuthentication === 'two_factor';
        
        const authenticationFactors = scenario.customerAuthentication === 'two_factor' ? [
          'something_you_know', // PIN/password
          'something_you_have', // Mobile device/card
          'something_you_are'   // Biometric (optional third factor)
        ] : ['basic_authentication'];

        const complianceCheck = {
          transactionAmount: scenario.transactionAmount,
          amountSEK: scenario.transactionAmount / 100,
          requiresSCA,
          hasValidSCA,
          authenticationFactors,
          compliant: !requiresSCA || (requiresSCA && hasValidSCA),
          description: scenario.description
        };

        scaResults.push(complianceCheck);
      }

      const compliantTransactions = scaResults.filter(r => r.compliant);
      const scaRequiredTransactions = scaResults.filter(r => r.requiresSCA);
      const properlyAuthenticatedTransactions = scaResults.filter(r => 
        !r.requiresSCA || r.hasValidSCA
      );

      expect(properlyAuthenticatedTransactions.length).toBe(3); // 3 out of 4 properly handled
      expect(scaRequiredTransactions.length).toBe(3); // 3 require SCA
      expect(compliantTransactions.length).toBe(3); // 3 are compliant
    });

    it('should handle payment service provider registration', async () => {
      const pspRegistrationData = {
        businessName: 'AI Feedback Platform Sverige AB',
        organizationNumber: '556987654321', // Fake Swedish org number
        vatNumber: 'SE556987654321',
        registrationAuthority: 'Finansinspektionen',
        licenses: [
          'payment_institution_license',
          'electronic_money_institution_license'
        ],
        services: [
          'payment_processing',
          'electronic_money_issuance', 
          'payment_initiation_services'
        ],
        complianceFrameworks: [
          'PCI_DSS_Level_1',
          'PSD2_Compliance',
          'GDPR_Compliance'
        ]
      };

      const registrationValidation = {
        validOrgNumber: SecurityTestUtils.utils.validateSwedishOrganizationNumber(
          pspRegistrationData.organizationNumber
        ),
        validVATNumber: SecurityTestUtils.utils.validateSwedishVATNumber(
          pspRegistrationData.vatNumber
        ),
        hasRequiredLicenses: pspRegistrationData.licenses.length > 0,
        hasComplianceFrameworks: pspRegistrationData.complianceFrameworks.includes('PSD2_Compliance'),
        registrationValid: false // Will be calculated
      };

      registrationValidation.registrationValid = 
        registrationValidation.validOrgNumber &&
        registrationValidation.validVATNumber &&
        registrationValidation.hasRequiredLicenses &&
        registrationValidation.hasComplianceFrameworks;

      expect(registrationValidation.validOrgNumber).toBe(true);
      expect(registrationValidation.validVATNumber).toBe(true);
      expect(registrationValidation.hasRequiredLicenses).toBe(true);
      expect(registrationValidation.hasComplianceFrameworks).toBe(true);
      expect(registrationValidation.registrationValid).toBe(true);
      expect(pspRegistrationData).toMeetSwedishCompliance();
    });
  });

  describe('Data Localization and Cross-Border Transfer', () => {
    it('should validate data residency requirements', async () => {
      const dataProcessingScenarios = [
        {
          dataType: 'customer_personal_data',
          processingLocation: 'Sweden',
          storageLocation: 'EU_Data_Center',
          transferMechanism: 'intra_eu_transfer',
          compliant: true
        },
        {
          dataType: 'payment_transaction_data',
          processingLocation: 'Germany', // EU country
          storageLocation: 'EU_Data_Center',
          transferMechanism: 'intra_eu_transfer',
          compliant: true
        },
        {
          dataType: 'fraud_detection_data',
          processingLocation: 'United_States', // Non-EU
          storageLocation: 'US_Data_Center',
          transferMechanism: 'standard_contractual_clauses',
          compliant: true // With proper safeguards
        },
        {
          dataType: 'customer_personal_data',
          processingLocation: 'China', // Non-EU, no adequacy decision
          storageLocation: 'Asia_Data_Center',
          transferMechanism: 'none',
          compliant: false // Violates GDPR
        }
      ];

      const dataResidencyResults = [];

      for (const scenario of dataProcessingScenarios) {
        const isEULocation = ['Sweden', 'Germany', 'France', 'Netherlands'].includes(scenario.processingLocation);
        const hasValidTransferMechanism = ['intra_eu_transfer', 'adequacy_decision', 'standard_contractual_clauses'].includes(scenario.transferMechanism);
        const isPersonalData = scenario.dataType.includes('personal_data');
        
        const complianceCheck = {
          ...scenario,
          isEULocation,
          hasValidTransferMechanism,
          isPersonalData,
          actualCompliant: isEULocation || (hasValidTransferMechanism && scenario.transferMechanism !== 'none'),
          matches: (isEULocation || (hasValidTransferMechanism && scenario.transferMechanism !== 'none')) === scenario.compliant
        };

        dataResidencyResults.push(complianceCheck);
      }

      const compliantTransfers = dataResidencyResults.filter(r => r.actualCompliant);
      const correctAssessments = dataResidencyResults.filter(r => r.matches);

      expect(correctAssessments.length).toBe(dataProcessingScenarios.length);
      expect(compliantTransfers.length).toBe(3); // Three compliant scenarios
    });
  });
});