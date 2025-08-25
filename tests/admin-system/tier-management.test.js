/**
 * Tier Management and Business Operations Tests
 * Tests admin capabilities for managing business tiers, features, pricing,
 * and business lifecycle operations in the Swedish market
 */

const { AdminTestUtils, ADMIN_TEST_CONFIG, SWEDISH_TEST_BUSINESSES, ADMIN_TEST_USERS } = global;

describe('Tier Management and Business Operations Tests', () => {
  let testBusinesses = [];
  let tierOperations = [];

  beforeEach(() => {
    testBusinesses = [];
    tierOperations = [];
  });

  afterEach(() => {
    // Cleanup test data
    testBusinesses = [];
    tierOperations = [];
  });

  describe('Business Tier Configuration Management', () => {
    it('should validate tier configuration structure', () => {
      const tiers = ADMIN_TEST_CONFIG.businessTiers;

      // Validate all three tiers exist
      expect(Object.keys(tiers)).toHaveLength(3);
      expect(tiers[1]).toBeDefined();
      expect(tiers[2]).toBeDefined();
      expect(tiers[3]).toBeDefined();

      // Validate tier 1 (Starter) configuration
      expect(tiers[1].name).toBe('Starter');
      expect(tiers[1].trialFeedbacks).toBe(30);
      expect(tiers[1].monthlyFeedbackLimit).toBe(1000);
      expect(tiers[1].commissionRate).toBe(0.20);
      expect(tiers[1].setupFee).toBe(0);
      expect(tiers[1].features).toContain('basic_analytics');

      // Validate tier 2 (Professional) configuration
      expect(tiers[2].name).toBe('Professional');
      expect(tiers[2].trialFeedbacks).toBe(50);
      expect(tiers[2].monthlyFeedbackLimit).toBe(5000);
      expect(tiers[2].commissionRate).toBe(0.18);
      expect(tiers[2].setupFee).toBe(50000); // 500 SEK
      expect(tiers[2].features).toContain('advanced_analytics');
      expect(tiers[2].features).toContain('custom_branding');

      // Validate tier 3 (Enterprise) configuration
      expect(tiers[3].name).toBe('Enterprise');
      expect(tiers[3].trialFeedbacks).toBe(100);
      expect(tiers[3].monthlyFeedbackLimit).toBe(-1); // Unlimited
      expect(tiers[3].commissionRate).toBe(0.15);
      expect(tiers[3].setupFee).toBe(150000); // 1,500 SEK
      expect(tiers[3].features).toContain('api_access');
      expect(tiers[3].features).toContain('white_labeling');
    });

    it('should validate tier progression logic', () => {
      const tiers = ADMIN_TEST_CONFIG.businessTiers;
      
      // Commission rates should decrease as tiers increase
      expect(tiers[1].commissionRate).toBeGreaterThan(tiers[2].commissionRate);
      expect(tiers[2].commissionRate).toBeGreaterThan(tiers[3].commissionRate);

      // Trial feedbacks should increase as tiers increase
      expect(tiers[1].trialFeedbacks).toBeLessThan(tiers[2].trialFeedbacks);
      expect(tiers[2].trialFeedbacks).toBeLessThan(tiers[3].trialFeedbacks);

      // Monthly limits should increase (or be unlimited)
      expect(tiers[1].monthlyFeedbackLimit).toBeLessThan(tiers[2].monthlyFeedbackLimit);
      expect(tiers[3].monthlyFeedbackLimit).toBe(-1); // Unlimited

      // Features should be cumulative (higher tiers have more features)
      expect(tiers[1].features.length).toBeLessThan(tiers[2].features.length);
      expect(tiers[2].features.length).toBeLessThan(tiers[3].features.length);
    });
  });

  describe('Business Tier Assignment Operations', () => {
    it('should assign initial tiers based on business application', async () => {
      const pendingBusinesses = SWEDISH_TEST_BUSINESSES.pending_approval;
      const businessManager = ADMIN_TEST_USERS.business_manager;

      for (const business of pendingBusinesses) {
        const tierRecommendation = AdminTestUtils.calculateTierRecommendation(business.businessInfo);
        
        const tierAssignment = {
          businessId: business.id,
          businessName: business.businessInfo.name,
          assignedTier: tierRecommendation.recommendedTier,
          assignedBy: businessManager.id,
          assignedAt: new Date(),
          reason: tierRecommendation.reason,
          monthlyFeedbackEstimate: business.businessInfo.expectedMonthlyFeedbacks
        };

        tierOperations.push(tierAssignment);

        // Validate tier assignment logic
        if (business.businessInfo.expectedMonthlyFeedbacks <= 1000) {
          expect(tierAssignment.assignedTier).toBe(1);
        } else if (business.businessInfo.expectedMonthlyFeedbacks <= 5000) {
          expect(tierAssignment.assignedTier).toBe(2);
        } else {
          expect(tierAssignment.assignedTier).toBe(3);
        }
      }

      expect(tierOperations).toHaveLength(pendingBusinesses.length);
    });

    it('should handle tier upgrades for growing businesses', async () => {
      const growingBusiness = {
        id: 'bus_growing_001',
        name: 'Growing Café Stockholm',
        currentTier: 1,
        monthlyFeedbackHistory: [
          { month: '2024-01', count: 200 },
          { month: '2024-02', count: 450 },
          { month: '2024-03', count: 850 },
          { month: '2024-04', count: 1200 },  // Exceeded tier 1 limit
          { month: '2024-05', count: 1450 }   // Consistently over tier 1
        ]
      };

      const platformAdmin = ADMIN_TEST_USERS.platform_admin;

      // Calculate tier upgrade recommendation
      const recentAverage = growingBusiness.monthlyFeedbackHistory
        .slice(-3) // Last 3 months
        .reduce((sum, month) => sum + month.count, 0) / 3;

      const upgradeRecommendation = AdminTestUtils.calculateTierRecommendation({
        expectedMonthlyFeedbacks: recentAverage
      });

      const tierUpgrade = {
        businessId: growingBusiness.id,
        businessName: growingBusiness.name,
        fromTier: growingBusiness.currentTier,
        toTier: upgradeRecommendation.recommendedTier,
        upgradedBy: platformAdmin.id,
        upgradedAt: new Date(),
        reason: `Business consistently exceeding current tier limits. Recent 3-month average: ${Math.round(recentAverage)} feedbacks/month`,
        effectiveDate: new Date(Date.now() + 86400000 * 7), // 7 days notice
        pricingChanges: {
          oldCommissionRate: ADMIN_TEST_CONFIG.businessTiers[1].commissionRate,
          newCommissionRate: ADMIN_TEST_CONFIG.businessTiers[upgradeRecommendation.recommendedTier].commissionRate,
          setupFee: ADMIN_TEST_CONFIG.businessTiers[upgradeRecommendation.recommendedTier].setupFee
        }
      };

      expect(tierUpgrade.toTier).toBeGreaterThan(tierUpgrade.fromTier);
      expect(tierUpgrade.toTier).toBe(2); // Should recommend Professional tier
      expect(tierUpgrade.pricingChanges.newCommissionRate).toBeLessThan(tierUpgrade.pricingChanges.oldCommissionRate);
      expect(tierUpgrade.effectiveDate > new Date()).toBe(true); // Future effective date

      tierOperations.push(tierUpgrade);
    });

    it('should handle tier downgrades for businesses with reduced volume', async () => {
      const decliningBusiness = {
        id: 'bus_declining_001',
        name: 'Declining Restaurant Göteborg',
        currentTier: 3,
        monthlyFeedbackHistory: [
          { month: '2024-01', count: 2000 },
          { month: '2024-02', count: 1200 },
          { month: '2024-03', count: 800 },
          { month: '2024-04', count: 600 },
          { month: '2024-05', count: 450 }   // Now suitable for tier 1
        ]
      };

      const businessManager = ADMIN_TEST_USERS.business_manager;

      const recentAverage = decliningBusiness.monthlyFeedbackHistory
        .slice(-3)
        .reduce((sum, month) => sum + month.count, 0) / 3;

      const downgradeRecommendation = AdminTestUtils.calculateTierRecommendation({
        expectedMonthlyFeedbacks: recentAverage
      });

      const tierDowngrade = {
        businessId: decliningBusiness.id,
        businessName: decliningBusiness.name,
        fromTier: decliningBusiness.currentTier,
        toTier: downgradeRecommendation.recommendedTier,
        downgradedBy: businessManager.id,
        downgradedAt: new Date(),
        reason: `Business volume has significantly decreased. Recent 3-month average: ${Math.round(recentAverage)} feedbacks/month`,
        effectiveDate: new Date(Date.now() + 86400000 * 30), // 30 days notice for downgrades
        pricingChanges: {
          oldCommissionRate: ADMIN_TEST_CONFIG.businessTiers[3].commissionRate,
          newCommissionRate: ADMIN_TEST_CONFIG.businessTiers[downgradeRecommendation.recommendedTier].commissionRate,
          featureChanges: {
            removed: ['api_access', 'white_labeling', 'dedicated_support'],
            retained: ['basic_analytics', 'email_support']
          }
        },
        customerNotification: {
          required: true,
          reason: 'Feature changes affect business operations'
        }
      };

      expect(tierDowngrade.toTier).toBeLessThan(tierDowngrade.fromTier);
      expect(tierDowngrade.toTier).toBe(1); // Should recommend Starter tier
      expect(tierDowngrade.pricingChanges.newCommissionRate).toBeGreaterThan(tierDowngrade.pricingChanges.oldCommissionRate);
      expect(tierDowngrade.pricingChanges.featureChanges.removed.length).toBeGreaterThan(0);
      expect(tierDowngrade.customerNotification.required).toBe(true);

      tierOperations.push(tierDowngrade);
    });
  });

  describe('Business Lifecycle Management', () => {
    it('should manage trial period operations', async () => {
      const newBusiness = {
        id: 'bus_trial_001',
        name: 'New Trial Business',
        tier: 1,
        status: 'trial',
        trialStartDate: new Date(Date.now() - 86400000 * 15), // 15 days ago
        trialEndDate: new Date(Date.now() + 86400000 * 15),   // 15 days remaining
        trialFeedbacksUsed: 18,
        trialFeedbacksLimit: ADMIN_TEST_CONFIG.businessTiers[1].trialFeedbacks
      };

      const supportAgent = ADMIN_TEST_USERS.support_agent;

      // Calculate trial status
      const daysRemaining = Math.ceil((newBusiness.trialEndDate - new Date()) / (1000 * 60 * 60 * 24));
      const feedbacksRemaining = newBusiness.trialFeedbacksLimit - newBusiness.trialFeedbacksUsed;
      const usagePercentage = (newBusiness.trialFeedbacksUsed / newBusiness.trialFeedbacksLimit) * 100;

      const trialStatus = {
        businessId: newBusiness.id,
        businessName: newBusiness.name,
        trialActive: daysRemaining > 0 && feedbacksRemaining > 0,
        daysRemaining,
        feedbacksRemaining,
        usagePercentage,
        statusCheckedBy: supportAgent.id,
        statusCheckedAt: new Date(),
        recommendations: []
      };

      // Generate recommendations based on usage
      if (usagePercentage > 80) {
        trialStatus.recommendations.push('Consider upgrading to paid tier soon');
      }
      if (daysRemaining <= 5) {
        trialStatus.recommendations.push('Trial expiring soon - contact business for conversion');
      }
      if (usagePercentage < 30 && daysRemaining <= 10) {
        trialStatus.recommendations.push('Low usage - provide additional support and training');
      }

      expect(trialStatus.trialActive).toBe(true);
      expect(trialStatus.daysRemaining).toBeGreaterThan(0);
      expect(trialStatus.feedbacksRemaining).toBeGreaterThan(0);
      expect(trialStatus.usagePercentage).toBeCloseTo(60, 0); // ~60% usage

      tierOperations.push(trialStatus);
    });

    it('should handle business suspension operations', async () => {
      const violatingBusiness = {
        id: 'bus_violating_001',
        name: 'Policy Violating Business',
        tier: 2,
        status: 'active',
        violations: [
          {
            type: 'payment_dispute',
            severity: 'medium',
            occurredAt: new Date(Date.now() - 86400000 * 5),
            description: 'Customer disputed multiple reward payments'
          },
          {
            type: 'fraudulent_activity',
            severity: 'high',
            occurredAt: new Date(Date.now() - 86400000 * 2),
            description: 'Suspicious feedback patterns detected'
          }
        ]
      };

      const platformAdmin = ADMIN_TEST_USERS.platform_admin;

      // Assess suspension need
      const highSeverityViolations = violatingBusiness.violations.filter(v => v.severity === 'high').length;
      const recentViolations = violatingBusiness.violations.filter(v => 
        v.occurredAt > new Date(Date.now() - 86400000 * 7) // Within last 7 days
      ).length;

      const shouldSuspend = highSeverityViolations > 0 || recentViolations > 2;

      if (shouldSuspend) {
        const suspensionAction = {
          businessId: violatingBusiness.id,
          businessName: violatingBusiness.name,
          action: 'suspend',
          suspendedBy: platformAdmin.id,
          suspendedAt: new Date(),
          reason: 'Multiple policy violations including high-severity fraudulent activity',
          suspensionDuration: 'indefinite',
          violations: violatingBusiness.violations,
          reinstatementRequirements: [
            'Complete fraud prevention training',
            'Implement additional verification measures',
            'Pay outstanding dispute amounts',
            'Provide written compliance commitment'
          ],
          businessNotification: {
            sent: true,
            sentAt: new Date(),
            method: 'email',
            contactPerson: 'business owner'
          }
        };

        expect(suspensionAction.action).toBe('suspend');
        expect(suspensionAction.violations).toHaveLength(2);
        expect(suspensionAction.reinstatementRequirements.length).toBeGreaterThan(0);

        tierOperations.push(suspensionAction);
      }
    });

    it('should handle business reactivation after suspension', async () => {
      const suspendedBusiness = {
        id: 'bus_suspended_001',
        name: 'Previously Suspended Business',
        tier: 2,
        status: 'suspended',
        suspendedAt: new Date(Date.now() - 86400000 * 30), // 30 days ago
        suspensionReason: 'Policy violations resolved',
        reinstatementRequirements: [
          { requirement: 'fraud_prevention_training', completed: true, completedAt: new Date(Date.now() - 86400000 * 10) },
          { requirement: 'verification_measures', completed: true, completedAt: new Date(Date.now() - 86400000 * 8) },
          { requirement: 'dispute_payments', completed: true, completedAt: new Date(Date.now() - 86400000 * 5) },
          { requirement: 'compliance_commitment', completed: true, completedAt: new Date(Date.now() - 86400000 * 3) }
        ]
      };

      const superAdmin = ADMIN_TEST_USERS.super_admin;

      // Check if all requirements are met
      const requirementsMet = suspendedBusiness.reinstatementRequirements.every(req => req.completed);
      const minimumSuspensionPeriod = 86400000 * 14; // 14 days minimum
      const suspensionDuration = Date.now() - suspendedBusiness.suspendedAt.getTime();
      const minimumPeriodMet = suspensionDuration >= minimumSuspensionPeriod;

      if (requirementsMet && minimumPeriodMet) {
        const reactivationAction = {
          businessId: suspendedBusiness.id,
          businessName: suspendedBusiness.name,
          action: 'reactivate',
          reactivatedBy: superAdmin.id,
          reactivatedAt: new Date(),
          previousSuspensionDuration: Math.ceil(suspensionDuration / (1000 * 60 * 60 * 24)), // Days
          reinstatementVerification: suspendedBusiness.reinstatementRequirements,
          postReactivationConditions: [
            'Enhanced monitoring for 90 days',
            'Monthly compliance check-ins',
            'Reduced violation tolerance period',
            'Mandatory quarterly training updates'
          ],
          tierMaintained: suspendedBusiness.tier,
          businessNotification: {
            sent: true,
            sentAt: new Date(),
            welcomeBackMessage: true
          }
        };

        expect(reactivationAction.action).toBe('reactivate');
        expect(reactivationAction.previousSuspensionDuration).toBeGreaterThanOrEqual(14);
        expect(reactivationAction.postReactivationConditions.length).toBeGreaterThan(0);
        expect(reactivationAction.tierMaintained).toBe(2);

        tierOperations.push(reactivationAction);
      }
    });
  });

  describe('Commission Rate Management', () => {
    it('should calculate correct commission rates by tier', () => {
      const testScenarios = [
        {
          tier: 1,
          rewardAmount: 10000, // 100 SEK
          expectedCommission: 2000, // 20 SEK (20%)
          expectedBusinessReceives: 8000 // 80 SEK
        },
        {
          tier: 2, 
          rewardAmount: 10000, // 100 SEK
          expectedCommission: 1800, // 18 SEK (18%)
          expectedBusinessReceives: 8200 // 82 SEK
        },
        {
          tier: 3,
          rewardAmount: 10000, // 100 SEK
          expectedCommission: 1500, // 15 SEK (15%)
          expectedBusinessReceives: 8500 // 85 SEK
        }
      ];

      for (const scenario of testScenarios) {
        const tierConfig = ADMIN_TEST_CONFIG.businessTiers[scenario.tier];
        const calculatedCommission = Math.round(scenario.rewardAmount * tierConfig.commissionRate);
        const businessReceives = scenario.rewardAmount - calculatedCommission;

        expect(calculatedCommission).toBe(scenario.expectedCommission);
        expect(businessReceives).toBe(scenario.expectedBusinessReceives);
      }
    });

    it('should handle commission rate changes during tier transitions', () => {
      const tierTransition = {
        businessId: 'bus_transition_001',
        businessName: 'Transitioning Business',
        oldTier: 2,
        newTier: 3,
        transitionDate: new Date(Date.now() + 86400000 * 7), // 7 days from now
        pendingRewards: [
          { amount: 5000, scheduledPayout: new Date(Date.now() + 86400000 * 3) }, // Before transition
          { amount: 7500, scheduledPayout: new Date(Date.now() + 86400000 * 10) }  // After transition
        ]
      };

      const oldCommissionRate = ADMIN_TEST_CONFIG.businessTiers[tierTransition.oldTier].commissionRate;
      const newCommissionRate = ADMIN_TEST_CONFIG.businessTiers[tierTransition.newTier].commissionRate;

      const commissionCalculations = tierTransition.pendingRewards.map(reward => {
        const applicableRate = reward.scheduledPayout < tierTransition.transitionDate ? 
          oldCommissionRate : newCommissionRate;
        
        return {
          rewardAmount: reward.amount,
          scheduledPayout: reward.scheduledPayout,
          applicableCommissionRate: applicableRate,
          commissionAmount: Math.round(reward.amount * applicableRate),
          businessReceives: reward.amount - Math.round(reward.amount * applicableRate)
        };
      });

      // First reward (before transition) should use old rate
      expect(commissionCalculations[0].applicableCommissionRate).toBe(0.18); // Tier 2 rate
      expect(commissionCalculations[0].commissionAmount).toBe(900); // 18% of 5000

      // Second reward (after transition) should use new rate  
      expect(commissionCalculations[1].applicableCommissionRate).toBe(0.15); // Tier 3 rate
      expect(commissionCalculations[1].commissionAmount).toBe(1125); // 15% of 7500
    });
  });

  describe('Feature Access Management', () => {
    it('should validate feature access by tier', () => {
      const featureAccessTests = [
        {
          tier: 1,
          expectedFeatures: ['basic_analytics', 'email_support'],
          deniedFeatures: ['advanced_analytics', 'api_access', 'white_labeling']
        },
        {
          tier: 2,
          expectedFeatures: ['basic_analytics', 'email_support', 'advanced_analytics', 'priority_support', 'custom_branding'],
          deniedFeatures: ['api_access', 'white_labeling']
        },
        {
          tier: 3,
          expectedFeatures: ['premium_analytics', 'dedicated_support', 'api_access', 'white_labeling'],
          deniedFeatures: [] // Enterprise has all features
        }
      ];

      for (const test of featureAccessTests) {
        const tierConfig = ADMIN_TEST_CONFIG.businessTiers[test.tier];
        
        // Check expected features are present
        for (const expectedFeature of test.expectedFeatures) {
          expect(tierConfig.features).toContain(expectedFeature);
        }

        // Check denied features are not present
        for (const deniedFeature of test.deniedFeatures) {
          expect(tierConfig.features).not.toContain(deniedFeature);
        }
      }
    });

    it('should handle feature activation during tier upgrades', () => {
      const tierUpgradeScenario = {
        businessId: 'bus_feature_upgrade_001',
        currentTier: 1,
        upgradeToTier: 2,
        upgradeDate: new Date(Date.now() + 86400000 * 3), // 3 days from now
        requestedBy: ADMIN_TEST_USERS.business_manager.id
      };

      const currentFeatures = ADMIN_TEST_CONFIG.businessTiers[tierUpgradeScenario.currentTier].features;
      const newFeatures = ADMIN_TEST_CONFIG.businessTiers[tierUpgradeScenario.upgradeToTier].features;

      const featureChanges = {
        businessId: tierUpgradeScenario.businessId,
        upgradeDate: tierUpgradeScenario.upgradeDate,
        currentFeatures: currentFeatures,
        newFeatures: newFeatures,
        addedFeatures: newFeatures.filter(feature => !currentFeatures.includes(feature)),
        retainedFeatures: currentFeatures.filter(feature => newFeatures.includes(feature)),
        featureActivationPlan: []
      };

      // Generate feature activation plan
      featureChanges.addedFeatures.forEach(feature => {
        featureChanges.featureActivationPlan.push({
          feature: feature,
          activationDate: tierUpgradeScenario.upgradeDate,
          requiresSetup: ['advanced_analytics', 'custom_branding'].includes(feature),
          autoActivated: !['custom_branding'].includes(feature) // Custom branding needs manual setup
        });
      });

      expect(featureChanges.addedFeatures).toContain('advanced_analytics');
      expect(featureChanges.addedFeatures).toContain('priority_support');
      expect(featureChanges.addedFeatures).toContain('custom_branding');
      expect(featureChanges.retainedFeatures).toContain('basic_analytics');
      expect(featureChanges.retainedFeatures).toContain('email_support');

      tierOperations.push(featureChanges);
    });
  });

  describe('Admin Permission Validation for Tier Operations', () => {
    it('should validate super admin can manage all tier operations', () => {
      const superAdmin = ADMIN_TEST_USERS.super_admin;
      
      expect(superAdmin).toHavePermission('tiers:manage');
      expect(superAdmin).toHavePermission('businesses:manage');
      expect(superAdmin).toHavePermission('system:manage');
      expect(superAdmin.role).toHaveRoleAccess('system_config');
    });

    it('should validate platform admin can manage business tiers', () => {
      const platformAdmin = ADMIN_TEST_USERS.platform_admin;
      
      expect(platformAdmin).toHavePermission('tiers:manage');
      expect(platformAdmin).toHavePermission('businesses:manage');
      expect(platformAdmin.role).toHaveRoleAccess('business_approval');
    });

    it('should validate business manager has limited tier operations', () => {
      const businessManager = ADMIN_TEST_USERS.business_manager;
      
      expect(businessManager).toHavePermission('tiers:modify');
      expect(businessManager).not.toHavePermission('tiers:manage'); // Cannot modify tier configs
      expect(businessManager.role).toHaveRoleAccess('business_approval');
    });

    it('should prevent support agents from managing tiers', () => {
      const supportAgent = ADMIN_TEST_USERS.support_agent;
      
      expect(supportAgent).not.toHavePermission('tiers:manage');
      expect(supportAgent).not.toHavePermission('tiers:modify');
      expect(supportAgent.role).not.toHaveRoleAccess('business_approval');
      
      // Support agents can only view
      expect(supportAgent).toHavePermission('businesses:view');
    });

    it('should prevent viewers from any tier management', () => {
      const viewer = ADMIN_TEST_USERS.viewer;
      
      expect(viewer).not.toHavePermission('tiers:manage');
      expect(viewer).not.toHavePermission('tiers:modify');
      expect(viewer).not.toHavePermission('businesses:manage');
      expect(viewer.role).not.toHaveRoleAccess('business_approval');
      
      // Viewers can only view
      expect(viewer).toHavePermission('businesses:view');
    });
  });

  describe('Business Analytics and Reporting', () => {
    it('should generate tier distribution analytics', () => {
      // Simulate current business distribution across tiers
      const businessDistribution = {
        tier1: { count: 145, percentage: 72.5, avgMonthlyFeedbacks: 324 },
        tier2: { count: 38, percentage: 19.0, avgMonthlyFeedbacks: 2100 },
        tier3: { count: 17, percentage: 8.5, avgMonthlyFeedbacks: 8500 },
        total: 200
      };

      const analyticsReport = {
        generatedAt: new Date(),
        generatedBy: ADMIN_TEST_USERS.platform_admin.id,
        reportPeriod: '2024-05',
        tierDistribution: businessDistribution,
        revenueByTier: {
          tier1: {
            totalRewards: 15000000, // 150,000 SEK
            platformCommission: 3000000, // 30,000 SEK (20%)
            avgRewardPerBusiness: Math.round(15000000 / businessDistribution.tier1.count)
          },
          tier2: {
            totalRewards: 25000000, // 250,000 SEK
            platformCommission: 4500000, // 45,000 SEK (18%)
            avgRewardPerBusiness: Math.round(25000000 / businessDistribution.tier2.count)
          },
          tier3: {
            totalRewards: 40000000, // 400,000 SEK
            platformCommission: 6000000, // 60,000 SEK (15%)
            avgRewardPerBusiness: Math.round(40000000 / businessDistribution.tier3.count)
          }
        }
      };

      // Validate analytics calculations
      expect(analyticsReport.tierDistribution.tier1.percentage).toBe(72.5);
      expect(analyticsReport.revenueByTier.tier1.platformCommission).toBe(3000000);
      expect(analyticsReport.revenueByTier.tier2.platformCommission).toBe(4500000);
      expect(analyticsReport.revenueByTier.tier3.platformCommission).toBe(6000000);

      const totalCommission = Object.values(analyticsReport.revenueByTier)
        .reduce((sum, tier) => sum + tier.platformCommission, 0);
      expect(totalCommission).toBe(13500000); // 135,000 SEK total commission

      tierOperations.push(analyticsReport);
    });

    it('should identify tier optimization opportunities', () => {
      const businessPerformanceData = [
        {
          businessId: 'bus_underperforming_001',
          currentTier: 2,
          monthlyFeedbacks: 450, // Well below tier 2 capacity
          monthlyRewards: 125000, // 1,250 SEK
          utilizationRate: 0.09 // 9% of tier capacity
        },
        {
          businessId: 'bus_overperforming_001',
          currentTier: 1,
          monthlyFeedbacks: 950, // Near tier 1 limit
          monthlyRewards: 275000, // 2,750 SEK
          utilizationRate: 0.95 // 95% of tier capacity
        },
        {
          businessId: 'bus_optimal_001',
          currentTier: 2,
          monthlyFeedbacks: 2800, // Good tier 2 utilization
          monthlyRewards: 485000, // 4,850 SEK
          utilizationRate: 0.56 // 56% of tier capacity
        }
      ];

      const optimizationRecommendations = businessPerformanceData.map(business => {
        let recommendation = 'maintain_current_tier';
        let reason = 'Current tier is appropriate';

        if (business.utilizationRate < 0.20 && business.currentTier > 1) {
          recommendation = 'consider_downgrade';
          reason = `Low utilization (${Math.round(business.utilizationRate * 100)}%) suggests lower tier would be more cost-effective`;
        } else if (business.utilizationRate > 0.80) {
          recommendation = 'recommend_upgrade';
          reason = `High utilization (${Math.round(business.utilizationRate * 100)}%) suggests need for higher tier`;
        }

        return {
          businessId: business.businessId,
          currentTier: business.currentTier,
          recommendation,
          reason,
          utilizationRate: business.utilizationRate,
          potentialSavings: recommendation === 'consider_downgrade' ? 
            Math.round((business.monthlyRewards * 0.02) * 12) : 0, // 2% annual savings
          potentialRevenue: recommendation === 'recommend_upgrade' ? 
            Math.round((business.monthlyRewards * 0.15) * 12) : 0 // 15% potential revenue increase
        };
      });

      const downgradeRecommendations = optimizationRecommendations.filter(r => r.recommendation === 'consider_downgrade');
      const upgradeRecommendations = optimizationRecommendations.filter(r => r.recommendation === 'recommend_upgrade');
      const maintainRecommendations = optimizationRecommendations.filter(r => r.recommendation === 'maintain_current_tier');

      expect(downgradeRecommendations).toHaveLength(1);
      expect(upgradeRecommendations).toHaveLength(1);
      expect(maintainRecommendations).toHaveLength(1);

      expect(downgradeRecommendations[0].potentialSavings).toBeGreaterThan(0);
      expect(upgradeRecommendations[0].potentialRevenue).toBeGreaterThan(0);

      tierOperations.push({
        type: 'optimization_analysis',
        generatedAt: new Date(),
        recommendations: optimizationRecommendations
      });
    });
  });
});