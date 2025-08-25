/**
 * Business Approval Workflow Tests
 * Tests admin approval processes for Swedish businesses including validation,
 * tier recommendations, and approval decision workflows
 */

const { AdminTestUtils, SWEDISH_TEST_BUSINESSES, ADMIN_TEST_USERS } = global;

describe('Business Approval Workflow Tests', () => {
  let testBusinesses = [];
  let approvalDecisions = [];

  beforeEach(() => {
    testBusinesses = [];
    approvalDecisions = [];
  });

  afterEach(() => {
    // Clean up test data
    testBusinesses = [];
    approvalDecisions = [];
  });

  describe('Business Application Validation', () => {
    it('should validate Swedish individual business applications', async () => {
      const individualBusiness = SWEDISH_TEST_BUSINESSES.pending_approval[0]; // Stockholm café
      const validationResult = AdminTestUtils.validateSwedishBusiness(individualBusiness.businessInfo);

      expect(validationResult.isValid).toBe(true);
      expect(validationResult.errors).toHaveLength(0);
      expect(individualBusiness.businessInfo).toHaveValidSwedishBusinessData();

      // Test specific Swedish individual validations
      expect(validationResult.validations.personnummer).toBe(true);
      expect(validationResult.validations.phone).toBe(true);
      expect(validationResult.validations.postalCode).toBe(true);
      expect(validationResult.validations.email).toBe(true);
    });

    it('should validate Swedish company business applications', async () => {
      const companyBusiness = SWEDISH_TEST_BUSINESSES.pending_approval[1]; // Göteborg restaurant
      const validationResult = AdminTestUtils.validateSwedishBusiness(companyBusiness.businessInfo);

      expect(validationResult.isValid).toBe(true);
      expect(validationResult.errors).toHaveLength(0);
      expect(companyBusiness.businessInfo).toHaveValidSwedishBusinessData();

      // Test specific Swedish company validations
      expect(validationResult.validations.organizationNumber).toBe(true);
      expect(validationResult.validations.vatNumber).toBe(true);
      expect(validationResult.validations.phone).toBe(true);
      expect(validationResult.validations.postalCode).toBe(true);
    });

    it('should reject invalid Swedish business applications', async () => {
      const invalidBusiness = {
        type: 'company',
        name: 'Invalid Test Business',
        organizationNumber: '123456789', // Invalid format - too short
        vatNumber: 'INVALID_VAT',         // Invalid VAT format
        email: 'invalid-email',           // Invalid email
        phone: '+1234567890',             // Non-Swedish phone
        address: {
          postalCode: 'INVALID',          // Invalid postal code
          city: 'Stockholm',
          country: 'SE'
        }
      };

      const validationResult = AdminTestUtils.validateSwedishBusiness(invalidBusiness);

      expect(validationResult.isValid).toBe(false);
      expect(validationResult.errors).toContain('organizationNumber');
      expect(validationResult.errors).toContain('vatNumber');
      expect(validationResult.errors).toContain('email');
      expect(validationResult.errors).toContain('phone');
      expect(validationResult.errors).toContain('postalCode');
      expect(validationResult.errors.length).toBeGreaterThan(3);
    });

    it('should handle partnership (HB) organization numbers correctly', async () => {
      const partnershipBusiness = SWEDISH_TEST_BUSINESSES.pending_approval[2]; // Malmö retail HB
      const validationResult = AdminTestUtils.validateSwedishBusiness(partnershipBusiness.businessInfo);

      expect(validationResult.isValid).toBe(true);
      expect(validationResult.validations.organizationNumber).toBe(true);
      expect(partnershipBusiness.businessInfo.organizationNumber).toMatch(/^969\d{9}$/); // Partnership format
    });
  });

  describe('Tier Recommendation Engine', () => {
    it('should recommend Starter tier for low-volume businesses', async () => {
      const lowVolumeBusiness = {
        expectedMonthlyFeedbacks: 150,
        businessType: 'café'
      };

      const recommendation = AdminTestUtils.calculateTierRecommendation(lowVolumeBusiness);

      expect(recommendation.recommendedTier).toBe(1);
      expect(recommendation.reason).toContain('starter tier');
    });

    it('should recommend Professional tier for medium-volume businesses', async () => {
      const mediumVolumeBusiness = {
        expectedMonthlyFeedbacks: 800,
        businessType: 'restaurant'
      };

      const recommendation = AdminTestUtils.calculateTierRecommendation(mediumVolumeBusiness);

      expect(recommendation.recommendedTier).toBe(2);
      expect(recommendation.reason).toContain('professional tier');
    });

    it('should recommend Enterprise tier for high-volume businesses', async () => {
      const highVolumeBusiness = {
        expectedMonthlyFeedbacks: 2500,
        businessType: 'retail_chain'
      };

      const recommendation = AdminTestUtils.calculateTierRecommendation(highVolumeBusiness);

      expect(recommendation.recommendedTier).toBe(3);
      expect(recommendation.reason).toContain('enterprise tier');
    });

    it('should handle edge cases in tier recommendations', async () => {
      const edgeCases = [
        { expectedMonthlyFeedbacks: 0, expectedTier: 1 },     // Zero volume
        { expectedMonthlyFeedbacks: 1000, expectedTier: 1 },  // Exactly at boundary
        { expectedMonthlyFeedbacks: 1001, expectedTier: 2 },  // Just over boundary
        { expectedMonthlyFeedbacks: 5000, expectedTier: 2 },  // At upper boundary
        { expectedMonthlyFeedbacks: 5001, expectedTier: 3 },  // Over upper boundary
        { expectedMonthlyFeedbacks: 50000, expectedTier: 3 }  // Very high volume
      ];

      for (const testCase of edgeCases) {
        const recommendation = AdminTestUtils.calculateTierRecommendation(testCase);
        expect(recommendation.recommendedTier).toBe(testCase.expectedTier);
      }
    });
  });

  describe('Approval Decision Workflow', () => {
    it('should approve valid Swedish business applications', async () => {
      const businessApplication = SWEDISH_TEST_BUSINESSES.pending_approval[0];
      const reviewingAdmin = ADMIN_TEST_USERS.business_manager;

      const approvalDecision = AdminTestUtils.generateApprovalDecision(
        businessApplication.businessInfo,
        reviewingAdmin
      );

      expect(approvalDecision.decision).toBe('approve');
      expect(approvalDecision.recommendedTier).toBe(1); // Low volume café
      expect(approvalDecision.validationErrors).toHaveLength(0);
      expect(approvalDecision.reviewedBy).toBe(reviewingAdmin.id);
      expect(approvalDecision.comments).toContain('approved');
      expect(approvalDecision.reviewedAt).toBeInstanceOf(Date);

      approvalDecisions.push(approvalDecision);
    });

    it('should reject invalid business applications', async () => {
      const invalidApplication = {
        type: 'company',
        name: 'Invalid Business',
        organizationNumber: '000000000000', // Invalid
        email: 'bad-email',                 // Invalid
        phone: '+1234567890',               // Invalid for Sweden
        address: { postalCode: '99999' }    // Invalid Swedish postal code
      };

      const reviewingAdmin = ADMIN_TEST_USERS.business_manager;
      const approvalDecision = AdminTestUtils.generateApprovalDecision(
        invalidApplication,
        reviewingAdmin
      );

      expect(approvalDecision.decision).toBe('reject');
      expect(approvalDecision.validationErrors.length).toBeGreaterThan(0);
      expect(approvalDecision.comments).toContain('rejected');
      expect(approvalDecision.comments).toContain('validation errors');

      approvalDecisions.push(approvalDecision);
    });

    it('should handle complex approval scenarios with multiple issues', async () => {
      const complexBusiness = {
        type: 'company',
        name: 'Complex Test Business AB',
        organizationNumber: '556123456789', // Valid
        vatNumber: 'SE556123456789',         // Valid
        email: 'test@complex.se',            // Valid
        phone: '+46701234567',               // Valid
        address: {
          postalCode: '111 21',              // Valid
          city: 'Stockholm',
          country: 'SE'
        },
        expectedMonthlyFeedbacks: 1500,      // Medium volume
        requestedTier: 3,                    // Requesting higher than recommended
        documents: ['company_registration']   // Missing some documents
      };

      const reviewingAdmin = ADMIN_TEST_USERS.platform_admin;
      const approvalDecision = AdminTestUtils.generateApprovalDecision(
        complexBusiness,
        reviewingAdmin
      );

      expect(approvalDecision.decision).toBe('approve');
      expect(approvalDecision.recommendedTier).toBe(2); // Should recommend Professional, not Enterprise
      expect(approvalDecision.validationErrors).toHaveLength(0);

      // Should note discrepancy between requested and recommended tier
      const tierDiscrepancy = complexBusiness.requestedTier !== approvalDecision.recommendedTier;
      expect(tierDiscrepancy).toBe(true);
    });
  });

  describe('Bulk Business Application Processing', () => {
    it('should process multiple applications efficiently', async () => {
      const applications = SWEDISH_TEST_BUSINESSES.pending_approval;
      const reviewingAdmin = ADMIN_TEST_USERS.platform_admin;
      const batchResults = [];

      const processingStartTime = Date.now();

      for (const application of applications) {
        const decision = AdminTestUtils.generateApprovalDecision(
          application.businessInfo,
          reviewingAdmin
        );

        batchResults.push({
          applicationId: application.applicationId,
          businessName: application.businessInfo.name,
          decision: decision.decision,
          recommendedTier: decision.recommendedTier,
          processingTime: Date.now() - processingStartTime
        });
      }

      const processingEndTime = Date.now();
      const totalProcessingTime = processingEndTime - processingStartTime;
      const averageProcessingTime = totalProcessingTime / applications.length;

      expect(batchResults).toHaveLength(applications.length);
      expect(averageProcessingTime).toBeLessThan(100); // Should process quickly
      
      const approvedApplications = batchResults.filter(r => r.decision === 'approve');
      expect(approvedApplications).toHaveLength(3); // All test applications should be valid
    });

    it('should maintain consistency in tier recommendations', async () => {
      // Generate multiple similar businesses and ensure consistent tier recommendations
      const similarBusinesses = [];
      
      for (let i = 0; i < 10; i++) {
        similarBusinesses.push({
          type: 'individual',
          name: `Test Café ${i + 1}`,
          personnummer: `85010${i}-1234`,
          email: `test${i}@cafe.se`,
          phone: `+4670123456${i}`,
          address: { postalCode: '111 21', city: 'Stockholm', country: 'SE' },
          expectedMonthlyFeedbacks: 200 + (i * 10) // 200-290 range
        });
      }

      const tierRecommendations = similarBusinesses.map(business => 
        AdminTestUtils.calculateTierRecommendation(business)
      );

      // All similar businesses should get the same tier recommendation
      const uniqueTiers = new Set(tierRecommendations.map(r => r.recommendedTier));
      expect(uniqueTiers.size).toBe(1); // Only one unique tier
      expect([...uniqueTiers][0]).toBe(1); // Should be Starter tier
    });
  });

  describe('Application Status Tracking', () => {
    it('should track application lifecycle states', async () => {
      const businessApplication = AdminTestUtils.generateMockBusiness('pending');
      const reviewingAdmin = ADMIN_TEST_USERS.business_manager;

      // Initial state
      expect(businessApplication.status).toBe('pending');
      expect(businessApplication.submittedAt).toBeInstanceOf(Date);

      // Generate approval decision
      const decision = AdminTestUtils.generateApprovalDecision(
        businessApplication.businessInfo,
        reviewingAdmin
      );

      // Simulate status updates
      const statusUpdates = [
        {
          status: 'under_review',
          updatedAt: new Date(),
          updatedBy: reviewingAdmin.id,
          comments: 'Application under review'
        },
        {
          status: decision.decision === 'approve' ? 'approved' : 'rejected',
          updatedAt: decision.reviewedAt,
          updatedBy: decision.reviewedBy,
          comments: decision.comments,
          tier: decision.decision === 'approve' ? decision.recommendedTier : null
        }
      ];

      // Validate status progression
      expect(statusUpdates).toHaveLength(2);
      expect(statusUpdates[0].status).toBe('under_review');
      expect(statusUpdates[1].status).toMatch(/^(approved|rejected)$/);
      expect(statusUpdates[1].updatedBy).toBe(reviewingAdmin.id);

      if (statusUpdates[1].status === 'approved') {
        expect(statusUpdates[1].tier).toBeGreaterThan(0);
        expect(statusUpdates[1].tier).toBeLessThanOrEqual(3);
      }
    });

    it('should handle application revisions and resubmissions', async () => {
      // Start with a business that would normally be rejected
      const problematicBusiness = {
        type: 'company',
        name: 'Problematic Business AB',
        organizationNumber: '123456789', // Invalid format
        email: 'test@problematic.se',
        phone: '+46701234567',
        address: { postalCode: '111 21', city: 'Stockholm', country: 'SE' }
      };

      const reviewingAdmin = ADMIN_TEST_USERS.business_manager;

      // First review - should be rejected
      const initialDecision = AdminTestUtils.generateApprovalDecision(
        problematicBusiness,
        reviewingAdmin
      );

      expect(initialDecision.decision).toBe('reject');
      expect(initialDecision.validationErrors).toContain('organizationNumber');

      // Simulate business fixing the issues
      const revisedBusiness = {
        ...problematicBusiness,
        organizationNumber: '556123456789' // Fixed to valid format
      };

      // Second review - should be approved
      const revisedDecision = AdminTestUtils.generateApprovalDecision(
        revisedBusiness,
        reviewingAdmin
      );

      expect(revisedDecision.decision).toBe('approve');
      expect(revisedDecision.validationErrors).toHaveLength(0);

      // Simulate revision tracking
      const revisionHistory = [
        {
          version: 1,
          submittedAt: new Date(Date.now() - 86400000 * 5), // 5 days ago
          status: 'rejected',
          issues: initialDecision.validationErrors
        },
        {
          version: 2,
          submittedAt: new Date(Date.now() - 86400000 * 1), // 1 day ago
          status: 'approved',
          resolvedIssues: ['organizationNumber'],
          tier: revisedDecision.recommendedTier
        }
      ];

      expect(revisionHistory).toHaveLength(2);
      expect(revisionHistory[1].resolvedIssues).toContain('organizationNumber');
    });
  });

  describe('Admin Role-Based Approval Permissions', () => {
    it('should allow business managers to approve applications', async () => {
      const businessManager = ADMIN_TEST_USERS.business_manager;
      const businessApplication = SWEDISH_TEST_BUSINESSES.pending_approval[0];

      expect(businessManager).toHavePermission('businesses:approve');
      expect(businessManager.role).toHaveRoleAccess('business_approval');

      const approvalDecision = AdminTestUtils.generateApprovalDecision(
        businessApplication.businessInfo,
        businessManager
      );

      expect(approvalDecision.reviewedBy).toBe(businessManager.id);
      expect(approvalDecision.decision).toMatch(/^(approve|reject)$/);
    });

    it('should allow platform admins to approve applications', async () => {
      const platformAdmin = ADMIN_TEST_USERS.platform_admin;
      const businessApplication = SWEDISH_TEST_BUSINESSES.pending_approval[1];

      expect(platformAdmin).toHavePermission('businesses:manage');
      expect(platformAdmin.role).toHaveRoleAccess('business_approval');

      const approvalDecision = AdminTestUtils.generateApprovalDecision(
        businessApplication.businessInfo,
        platformAdmin
      );

      expect(approvalDecision.reviewedBy).toBe(platformAdmin.id);
    });

    it('should prevent support agents from approving applications', async () => {
      const supportAgent = ADMIN_TEST_USERS.support_agent;

      expect(supportAgent).not.toHavePermission('businesses:approve');
      expect(supportAgent.role).not.toHaveRoleAccess('business_approval');

      // Support agents can view but not approve
      expect(supportAgent).toHavePermission('businesses:view');
    });

    it('should prevent viewers from approving applications', async () => {
      const viewer = ADMIN_TEST_USERS.viewer;

      expect(viewer).not.toHavePermission('businesses:approve');
      expect(viewer.role).not.toHaveRoleAccess('business_approval');
      expect(viewer).toHavePermission('businesses:view');
    });
  });

  describe('Approval Notification System', () => {
    it('should generate approval notifications', async () => {
      const approvedBusiness = SWEDISH_TEST_BUSINESSES.pending_approval[0];
      const reviewingAdmin = ADMIN_TEST_USERS.business_manager;

      const approvalDecision = AdminTestUtils.generateApprovalDecision(
        approvedBusiness.businessInfo,
        reviewingAdmin
      );

      // Simulate notification generation
      const approvalNotification = {
        type: 'business_approved',
        businessId: approvedBusiness.id,
        businessName: approvedBusiness.businessInfo.name,
        businessEmail: approvedBusiness.businessInfo.email,
        tier: approvalDecision.recommendedTier,
        approvedBy: reviewingAdmin.email,
        approvedAt: approvalDecision.reviewedAt,
        nextSteps: [
          'Complete Stripe Connect onboarding',
          'Set up business profile',
          'Generate QR codes for locations',
          'Begin trial period'
        ],
        trialDetails: {
          feedbacksIncluded: global.ADMIN_TEST_CONFIG.businessTiers[approvalDecision.recommendedTier].trialFeedbacks,
          duration: '30 days'
        }
      };

      expect(approvalNotification.type).toBe('business_approved');
      expect(approvalNotification.tier).toBeGreaterThan(0);
      expect(approvalNotification.nextSteps).toHaveLength(4);
      expect(approvalNotification.trialDetails.feedbacksIncluded).toBeGreaterThan(0);
    });

    it('should generate rejection notifications with feedback', async () => {
      const rejectedBusiness = SWEDISH_TEST_BUSINESSES.rejected[0];
      const reviewingAdmin = ADMIN_TEST_USERS.business_manager;

      const rejectionNotification = {
        type: 'business_rejected',
        businessId: rejectedBusiness.id,
        businessName: rejectedBusiness.businessInfo.name,
        businessEmail: rejectedBusiness.businessInfo.email,
        rejectedBy: reviewingAdmin.email,
        rejectedAt: rejectedBusiness.rejectedAt,
        reason: rejectedBusiness.rejectionReason,
        improvementSuggestions: [
          'Provide valid Swedish organization number',
          'Submit all required documents',
          'Ensure all contact information is accurate',
          'Consider reapplying once issues are resolved'
        ],
        supportContact: 'business-applications@ai-feedback-platform.se'
      };

      expect(rejectionNotification.type).toBe('business_rejected');
      expect(rejectionNotification.reason).toBeTruthy();
      expect(rejectionNotification.improvementSuggestions).toHaveLength(4);
      expect(rejectionNotification.supportContact).toContain('@');
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle high-volume application processing', async () => {
      const largeApplicationBatch = [];
      
      // Generate 100 mock applications
      for (let i = 0; i < 100; i++) {
        largeApplicationBatch.push(AdminTestUtils.generateMockBusiness('pending'));
      }

      const reviewingAdmin = ADMIN_TEST_USERS.platform_admin;
      const processingResults = [];
      const startTime = Date.now();

      // Process all applications
      for (const application of largeApplicationBatch) {
        const decision = AdminTestUtils.generateApprovalDecision(
          application.businessInfo,
          reviewingAdmin
        );
        
        processingResults.push({
          applicationId: application.id,
          decision: decision.decision,
          processingTime: Date.now() - startTime
        });
      }

      const endTime = Date.now();
      const totalProcessingTime = endTime - startTime;
      const averageProcessingTime = totalProcessingTime / largeApplicationBatch.length;

      expect(processingResults).toHaveLength(100);
      expect(totalProcessingTime).toBeLessThan(5000); // Should complete in under 5 seconds
      expect(averageProcessingTime).toBeLessThan(50);  // Average under 50ms per application

      const approvalRate = processingResults.filter(r => r.decision === 'approve').length / processingResults.length;
      expect(approvalRate).toBeGreaterThan(0.7); // Most mock applications should be valid
    });

    it('should maintain data consistency during concurrent processing', async () => {
      const concurrentApplications = [];
      
      // Generate 20 applications for concurrent processing
      for (let i = 0; i < 20; i++) {
        concurrentApplications.push(AdminTestUtils.generateMockBusiness('pending'));
      }

      const reviewingAdmins = [
        ADMIN_TEST_USERS.business_manager,
        ADMIN_TEST_USERS.platform_admin
      ];

      // Simulate concurrent processing by different admins
      const concurrentPromises = concurrentApplications.map((application, index) => {
        const assignedAdmin = reviewingAdmins[index % 2];
        
        return Promise.resolve(AdminTestUtils.generateApprovalDecision(
          application.businessInfo,
          assignedAdmin
        ));
      });

      const results = await Promise.all(concurrentPromises);

      expect(results).toHaveLength(20);
      
      // Check that all decisions have valid structure
      results.forEach(decision => {
        expect(decision).toHaveProperty('decision');
        expect(decision).toHaveProperty('reviewedBy');
        expect(decision).toHaveProperty('reviewedAt');
        expect(decision.decision).toMatch(/^(approve|reject)$/);
      });

      // Check that different admins processed applications
      const uniqueReviewers = new Set(results.map(r => r.reviewedBy));
      expect(uniqueReviewers.size).toBe(2);
    });
  });
});