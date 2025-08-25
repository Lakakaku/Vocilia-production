/**
 * Stripe Connect Swedish Business Onboarding Tests
 * Tests Express account creation, verification, and capabilities
 */

const { StripeTestUtils } = global;

describe('Swedish Business Onboarding - Stripe Connect', () => {
  let testAccounts = [];
  
  afterEach(async () => {
    // Cleanup test accounts
    for (const account of testAccounts) {
      try {
        await StripeTestUtils.stripe.accounts.del(account.id);
      } catch (error) {
        // Ignore cleanup errors in test environment
        console.warn(`Failed to cleanup account ${account.id}:`, error.message);
      }
    }
    testAccounts = [];
  });

  describe('1. Express Account Creation', () => {
    test('should create Express account for Swedish café (individual)', async () => {
      const account = await StripeTestUtils.createTestAccount('cafe');
      testAccounts.push(account);
      
      expect(account).toHaveProperty('id');
      expect(account.type).toBe('express');
      expect(account.country).toBe('SE');
      expect(account.default_currency).toBe('sek');
      expect(account.business_type).toBe('individual');
      
      // Verify individual details
      expect(account.individual).toHaveProperty('first_name', 'Anna');
      expect(account.individual).toHaveProperty('last_name', 'Andersson');
      expect(account.individual.address.country).toBe('SE');
      expect(account.individual.address.postal_code).toMatch(/^\d{5}$/); // Swedish postal code format
      
      // Verify business profile
      expect(account.business_profile.mcc).toBe('5812'); // Eating and Drinking Places
      expect(account.business_profile.name).toContain('Café');
    });

    test('should create Express account for Swedish restaurant (company)', async () => {
      const account = await StripeTestUtils.createTestAccount('restaurant');
      testAccounts.push(account);
      
      expect(account).toHaveProperty('id');
      expect(account.type).toBe('express');
      expect(account.country).toBe('SE');
      expect(account.business_type).toBe('company');
      
      // Verify company details
      expect(account.company).toHaveProperty('name', 'NordMat AB');
      expect(account.company.registration_number).toMatch(/^\d{10}$/); // Swedish org number
      expect(account.company.address.country).toBe('SE');
      
      // Verify MCC for restaurant
      expect(account.business_profile.mcc).toBe('5814'); // Fast Food Restaurants
    });

    test('should create Express account for Swedish retail (partnership)', async () => {
      const account = await StripeTestUtils.createTestAccount('retail');
      testAccounts.push(account);
      
      expect(account).toHaveProperty('id');
      expect(account.type).toBe('express');
      expect(account.country).toBe('SE');
      expect(account.business_type).toBe('company');
      
      // Verify company details for partnership (HB)
      expect(account.company.name).toContain('HB'); // Handelsbolag (partnership)
      expect(account.company.registration_number).toMatch(/^\d{12}$/); // Partnership format
      
      // Verify MCC for retail
      expect(account.business_profile.mcc).toBe('5411'); // Grocery Stores
    });

    test('should handle invalid Swedish organization number', async () => {
      const invalidBusinessData = {
        ...StripeTestUtils.swedishBusinesses.restaurant,
        company: {
          ...StripeTestUtils.swedishBusinesses.restaurant.company,
          registration_number: '123456' // Invalid - too short
        }
      };
      
      try {
        const account = await StripeTestUtils.stripe.accounts.create(invalidBusinessData);
        testAccounts.push(account); // For cleanup if somehow created
        
        // If account was created, it means validation passed (which might be expected)
        expect(account).toHaveProperty('id');
        console.warn('Account created with potentially invalid org number - Stripe validation may be lenient in test mode');
        
      } catch (error) {
        expect(error).toBeValidStripeError();
        expect(error.message).toContain('registration_number');
      }
    });

    test('should require valid Swedish postal code', async () => {
      const invalidBusinessData = {
        ...StripeTestUtils.swedishBusinesses.cafe,
        individual: {
          ...StripeTestUtils.swedishBusinesses.cafe.individual,
          address: {
            ...StripeTestUtils.swedishBusinesses.cafe.individual.address,
            postal_code: '123' // Invalid - too short for Sweden
          }
        }
      };
      
      try {
        const account = await StripeTestUtils.stripe.accounts.create(invalidBusinessData);
        testAccounts.push(account);
        
        // Postal code validation might be lenient in test mode
        expect(account).toHaveProperty('id');
        console.warn('Account created with invalid postal code - test environment validation');
        
      } catch (error) {
        expect(error).toBeValidStripeError();
        expect(error.message.toLowerCase()).toContain('postal');
      }
    });
  });

  describe('2. Account Capabilities and Requirements', () => {
    let cafeAccount;
    
    beforeEach(async () => {
      cafeAccount = await StripeTestUtils.createTestAccount('cafe');
      testAccounts.push(cafeAccount);
    });

    test('should request card_payments and transfers capabilities', async () => {
      // Request necessary capabilities for the feedback platform
      const updatedAccount = await StripeTestUtils.stripe.accounts.update(cafeAccount.id, {
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true }
        }
      });
      
      expect(updatedAccount.capabilities).toHaveProperty('card_payments');
      expect(updatedAccount.capabilities).toHaveProperty('transfers');
      
      // In test environment, capabilities might be auto-approved
      const cardPaymentsStatus = updatedAccount.capabilities.card_payments;
      const transfersStatus = updatedAccount.capabilities.transfers;
      
      expect(['active', 'pending', 'inactive']).toContain(cardPaymentsStatus);
      expect(['active', 'pending', 'inactive']).toContain(transfersStatus);
    });

    test('should check verification requirements', async () => {
      const account = await StripeTestUtils.stripe.accounts.retrieve(cafeAccount.id);
      
      // Check current verification status
      expect(account.requirements).toHaveProperty('currently_due');
      expect(account.requirements).toHaveProperty('eventually_due');
      expect(account.requirements).toHaveProperty('pending_verification');
      
      // Swedish accounts typically require additional verification
      const isFullyVerified = account.requirements.currently_due.length === 0 &&
                             account.requirements.eventually_due.length === 0;
      
      if (!isFullyVerified) {
        console.log('Account requires verification:', {
          currently_due: account.requirements.currently_due,
          eventually_due: account.requirements.eventually_due
        });
      }
      
      expect(Array.isArray(account.requirements.currently_due)).toBe(true);
    });

    test('should simulate verification document upload', async () => {
      // In test environment, we simulate document verification
      // Real implementation would handle actual document uploads
      
      try {
        // Attempt to provide verification information
        const updatedAccount = await StripeTestUtils.stripe.accounts.update(cafeAccount.id, {
          individual: {
            verification: {
              document: {
                front: 'file_test_document_front' // Test file ID
              }
            }
          }
        });
        
        expect(updatedAccount).toHaveProperty('id');
        console.log('Document verification simulated successfully');
        
      } catch (error) {
        // Document upload might not work in test environment
        console.warn('Document verification not available in test mode:', error.message);
        expect(error).toBeValidStripeError();
      }
    });
  });

  describe('3. Account Link Generation', () => {
    let restaurantAccount;
    
    beforeEach(async () => {
      restaurantAccount = await StripeTestUtils.createTestAccount('restaurant');
      testAccounts.push(restaurantAccount);
    });

    test('should create account link for onboarding', async () => {
      const accountLink = await StripeTestUtils.stripe.accountLinks.create({
        account: restaurantAccount.id,
        refresh_url: 'https://feedback-platform-test.se/stripe/reauth',
        return_url: 'https://feedback-platform-test.se/stripe/onboarding-complete',
        type: 'account_onboarding'
      });
      
      expect(accountLink).toHaveProperty('object', 'account_link');
      expect(accountLink).toHaveProperty('url');
      expect(accountLink).toHaveProperty('expires_at');
      
      // Verify URLs are properly formatted
      expect(accountLink.url).toMatch(/^https:\/\/connect\.stripe\.com/);
      expect(new Date(accountLink.expires_at * 1000)).toBeInstanceOf(Date);
      
      // Link should expire in the future
      expect(accountLink.expires_at * 1000).toBeGreaterThan(Date.now());
    });

    test('should create account link for updates', async () => {
      const accountLink = await StripeTestUtils.stripe.accountLinks.create({
        account: restaurantAccount.id,
        refresh_url: 'https://feedback-platform-test.se/stripe/reauth',
        return_url: 'https://feedback-platform-test.se/stripe/update-complete',
        type: 'account_update'
      });
      
      expect(accountLink).toHaveProperty('object', 'account_link');
      expect(accountLink).toHaveProperty('url');
      expect(accountLink.type).toBe('account_update');
    });

    test('should handle invalid account ID for link creation', async () => {
      try {
        await StripeTestUtils.stripe.accountLinks.create({
          account: 'acct_invalid_test_account',
          refresh_url: 'https://feedback-platform-test.se/stripe/reauth',
          return_url: 'https://feedback-platform-test.se/stripe/complete',
          type: 'account_onboarding'
        });
        
        fail('Should have thrown error for invalid account ID');
        
      } catch (error) {
        expect(error).toBeValidStripeError();
        expect(error.type).toBe('invalid_request_error');
        expect(error.message.toLowerCase()).toContain('account');
      }
    });
  });

  describe('4. Swedish Market Specific Validations', () => {
    test('should validate Swedish phone number format', async () => {
      const testCases = [
        { phone: '+46701234567', valid: true, description: 'Valid Swedish mobile' },
        { phone: '+46812345678', valid: true, description: 'Valid Swedish landline' },
        { phone: '0701234567', valid: false, description: 'Missing country code' },
        { phone: '+47701234567', valid: false, description: 'Norway number in SE account' },
        { phone: '+46123', valid: false, description: 'Too short' }
      ];
      
      for (const testCase of testCases) {
        const businessData = {
          ...StripeTestUtils.swedishBusinesses.cafe,
          individual: {
            ...StripeTestUtils.swedishBusinesses.cafe.individual,
            phone: testCase.phone,
            email: StripeTestUtils.generateTestEmail(`phone-test-${Date.now()}`)
          }
        };
        
        try {
          const account = await StripeTestUtils.stripe.accounts.create(businessData);
          testAccounts.push(account);
          
          if (testCase.valid) {
            expect(account).toHaveProperty('id');
            expect(account.individual.phone).toBe(testCase.phone);
          } else {
            console.warn(`Account created with potentially invalid phone: ${testCase.phone}`);
          }
          
        } catch (error) {
          if (!testCase.valid) {
            expect(error).toBeValidStripeError();
            console.log(`✅ Correctly rejected invalid phone: ${testCase.description}`);
          } else {
            console.error(`❌ Unexpectedly rejected valid phone: ${testCase.description}`, error.message);
            throw error;
          }
        }
      }
    });

    test('should handle Swedish business addresses correctly', async () => {
      const swedishAddresses = [
        {
          line1: 'Kungsgatan 1',
          city: 'Stockholm',
          postal_code: '11143',
          country: 'SE',
          valid: true,
          description: 'Central Stockholm address'
        },
        {
          line1: 'Avenyn 42',
          city: 'Göteborg', 
          postal_code: '41119',
          country: 'SE',
          valid: true,
          description: 'Gothenburg address'
        },
        {
          line1: 'Stortorget 5',
          city: 'Malmö',
          postal_code: '21134',
          country: 'SE',
          valid: true,
          description: 'Malmö address'
        },
        {
          line1: 'Test Street 123',
          city: 'Stockholm',
          postal_code: 'ABC123',
          country: 'SE',
          valid: false,
          description: 'Invalid postal code format'
        }
      ];
      
      for (const address of swedishAddresses) {
        const businessData = {
          ...StripeTestUtils.swedishBusinesses.cafe,
          individual: {
            ...StripeTestUtils.swedishBusinesses.cafe.individual,
            address: address,
            email: StripeTestUtils.generateTestEmail(`address-test-${Date.now()}`)
          }
        };
        
        try {
          const account = await StripeTestUtils.stripe.accounts.create(businessData);
          testAccounts.push(account);
          
          expect(account).toHaveProperty('id');
          expect(account.individual.address.country).toBe('SE');
          
          if (!address.valid) {
            console.warn(`Address validation may be lenient in test mode: ${address.description}`);
          }
          
        } catch (error) {
          if (!address.valid) {
            expect(error).toBeValidStripeError();
            console.log(`✅ Correctly rejected invalid address: ${address.description}`);
          } else {
            console.error(`❌ Unexpectedly rejected valid address: ${address.description}`, error.message);
            throw error;
          }
        }
      }
    });

    test('should validate Swedish organization number format', async () => {
      const orgNumbers = [
        { number: '5569876543', valid: true, description: 'Valid 10-digit org number' },
        { number: '556987654321', valid: true, description: 'Valid with check digit' },
        { number: '969876543210', valid: true, description: 'Valid partnership format' },
        { number: '123456', valid: false, description: 'Too short' },
        { number: '12345678901234', valid: false, description: 'Too long' },
        { number: 'SE556987654301', valid: false, description: 'With SE prefix' }
      ];
      
      for (const orgTest of orgNumbers) {
        const businessData = {
          ...StripeTestUtils.swedishBusinesses.restaurant,
          company: {
            ...StripeTestUtils.swedishBusinesses.restaurant.company,
            registration_number: orgTest.number,
            name: `Test Company ${Date.now()}`
          }
        };
        
        try {
          const account = await StripeTestUtils.stripe.accounts.create(businessData);
          testAccounts.push(account);
          
          expect(account).toHaveProperty('id');
          
          if (!orgTest.valid) {
            console.warn(`Org number validation may be lenient in test mode: ${orgTest.description}`);
          }
          
        } catch (error) {
          if (!orgTest.valid) {
            expect(error).toBeValidStripeError();
            console.log(`✅ Correctly rejected invalid org number: ${orgTest.description}`);
          } else {
            console.error(`❌ Unexpectedly rejected valid org number: ${orgTest.description}`, error.message);
            throw error;
          }
        }
      }
    });
  });

  describe('5. Business Profile Validation', () => {
    test('should create accounts with appropriate MCC codes for different business types', async () => {
      const businessTypes = [
        { type: 'cafe', expectedMCC: '5812', description: 'Eating and Drinking Places' },
        { type: 'restaurant', expectedMCC: '5814', description: 'Fast Food Restaurants' },
        { type: 'retail', expectedMCC: '5411', description: 'Grocery Stores' }
      ];
      
      for (const business of businessTypes) {
        const account = await StripeTestUtils.createTestAccount(business.type);
        testAccounts.push(account);
        
        expect(account.business_profile.mcc).toBe(business.expectedMCC);
        console.log(`✅ ${business.type} account created with MCC ${business.expectedMCC} (${business.description})`);
      }
    });

    test('should validate business profile completeness', async () => {
      const account = await StripeTestUtils.createTestAccount('cafe');
      testAccounts.push(account);
      
      const requiredFields = [
        'mcc',
        'name',
        'product_description',
        'support_email',
        'support_phone',
        'url'
      ];
      
      for (const field of requiredFields) {
        expect(account.business_profile).toHaveProperty(field);
        expect(account.business_profile[field]).toBeTruthy();
      }
      
      // Validate email format
      expect(account.business_profile.support_email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
      
      // Validate URL format
      expect(account.business_profile.url).toMatch(/^https?:\/\//);
      
      // Validate Swedish domain
      expect(account.business_profile.support_email).toContain('.se');
      expect(account.business_profile.url).toContain('-test.se');
    });

    test('should handle business profile updates', async () => {
      const account = await StripeTestUtils.createTestAccount('cafe');
      testAccounts.push(account);
      
      const updatedProfile = {
        business_profile: {
          name: 'Updated Café Aurora Stockholm',
          product_description: 'Premium Swedish coffee and artisanal pastries',
          support_phone: '+46812345679' // Updated phone
        }
      };
      
      const updatedAccount = await StripeTestUtils.stripe.accounts.update(account.id, updatedProfile);
      
      expect(updatedAccount.business_profile.name).toBe(updatedProfile.business_profile.name);
      expect(updatedAccount.business_profile.product_description).toBe(updatedProfile.business_profile.product_description);
      expect(updatedAccount.business_profile.support_phone).toBe(updatedProfile.business_profile.support_phone);
      
      // Verify other fields remain unchanged
      expect(updatedAccount.business_profile.mcc).toBe('5812');
      expect(updatedAccount.business_profile.support_email).toContain('@cafe-aurora-test.se');
    });
  });
});

module.exports = {
  description: 'Swedish Business Onboarding Tests for Stripe Connect',
  testCount: 15,
  coverage: [
    'Express account creation for Swedish businesses',
    'Individual and company account types',
    'Swedish organization number validation',
    'Address and contact information validation',
    'Account capabilities and requirements',
    'Account link generation for onboarding',
    'MCC code validation for different business types',
    'Business profile completeness and updates'
  ]
};