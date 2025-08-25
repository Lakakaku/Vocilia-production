/**
 * Admin System Test Setup
 * Comprehensive testing environment for admin authentication, approval workflows,
 * and business management operations with Swedish market focus
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const { addDays, subDays, format } = require('date-fns');

// Admin system test environment configuration
const ADMIN_TEST_CONFIG = {
  auth: {
    jwtSecret: 'admin_test_jwt_secret_key_for_testing_only',
    jwtExpiration: '8h', // 8 hour admin sessions
    bcryptSaltRounds: 10,
    maxLoginAttempts: 5,
    lockoutDuration: 1800000, // 30 minutes
    sessionTimeout: 28800000, // 8 hours
    refreshTokenExpiry: 604800000 // 7 days
  },
  roles: {
    hierarchy: {
      'super_admin': 100,
      'platform_admin': 80,
      'business_manager': 60,
      'support_agent': 40,
      'viewer': 20
    },
    permissions: {
      super_admin: [
        'system:manage', 'users:manage', 'businesses:manage', 'tiers:manage',
        'monitoring:view', 'audit:view', 'config:manage', 'data:export'
      ],
      platform_admin: [
        'businesses:manage', 'tiers:manage', 'monitoring:view', 
        'audit:view', 'users:view', 'config:view'
      ],
      business_manager: [
        'businesses:approve', 'businesses:view', 'tiers:modify',
        'monitoring:view', 'users:view'
      ],
      support_agent: [
        'businesses:view', 'monitoring:view', 'users:view', 'tickets:manage'
      ],
      viewer: ['businesses:view', 'monitoring:view']
    }
  },
  businessTiers: {
    1: {
      name: 'Starter',
      trialFeedbacks: 30,
      monthlyFeedbackLimit: 1000,
      features: ['basic_analytics', 'email_support'],
      commissionRate: 0.20,
      setupFee: 0
    },
    2: {
      name: 'Professional',
      trialFeedbacks: 50,
      monthlyFeedbackLimit: 5000,
      features: ['advanced_analytics', 'priority_support', 'custom_branding'],
      commissionRate: 0.18,
      setupFee: 50000 // 500 SEK in öre
    },
    3: {
      name: 'Enterprise',
      trialFeedbacks: 100,
      monthlyFeedbackLimit: -1, // Unlimited
      features: ['premium_analytics', 'dedicated_support', 'api_access', 'white_labeling'],
      commissionRate: 0.15,
      setupFee: 150000 // 1,500 SEK in öre
    }
  },
  swedish: {
    // Swedish business validation patterns
    organizationNumberPattern: /^(55|56|96|99)\d{8}$/,
    vatNumberPattern: /^SE\d{10}$/,
    personnummerPattern: /^\d{6}-\d{4}$/,
    phonePattern: /^\+46[1-9]\d{8}$/,
    postalCodePattern: /^\d{3}\s?\d{2}$/
  },
  monitoring: {
    sessionTimeoutWarning: 1800000, // 30 minutes before timeout
    maxConcurrentSessions: 3,
    auditLogRetention: 2555, // 7 years in days
    realTimeUpdateInterval: 5000, // 5 seconds
    performanceThresholds: {
      responseTime: 2000, // 2 seconds
      dbQueryTime: 500,   // 500ms
      memoryUsage: 0.8,   // 80%
      cpuUsage: 0.7       // 70%
    }
  }
};

// Swedish test business data for admin approval workflows
const SWEDISH_TEST_BUSINESSES = {
  pending_approval: [
    {
      id: 'bus_pending_001',
      applicationId: 'app_001_stockholm_cafe',
      businessInfo: {
        type: 'individual',
        name: 'Café Luna Stockholm',
        organizationNumber: null,
        personnummer: '851025-1234', // Fake
        ownerName: 'Maria Lindström',
        email: 'maria+test@cafeluna.se',
        phone: '+46701234567',
        address: {
          street: 'Drottninggatan 42',
          city: 'Stockholm',
          postalCode: '111 21',
          country: 'SE'
        },
        businessDescription: 'Cozy café in central Stockholm serving specialty coffee and pastries',
        expectedMonthlyFeedbacks: 150,
        requestedTier: 1
      },
      documents: ['business_license', 'id_verification'],
      submittedAt: new Date(Date.now() - 86400000 * 3), // 3 days ago
      status: 'pending_review'
    },
    {
      id: 'bus_pending_002',
      applicationId: 'app_002_gothenburg_restaurant',
      businessInfo: {
        type: 'company',
        name: 'Nordic Taste AB',
        organizationNumber: '556789012345', // Fake
        vatNumber: 'SE556789012345',
        contactPerson: 'Erik Johansson',
        email: 'erik+test@nordictaste.se',
        phone: '+46812345678',
        address: {
          street: 'Avenyn 15',
          city: 'Göteborg',
          postalCode: '411 36',
          country: 'SE'
        },
        businessDescription: 'Modern Nordic restaurant focusing on local ingredients',
        expectedMonthlyFeedbacks: 800,
        requestedTier: 2
      },
      documents: ['company_registration', 'vat_certificate', 'food_license'],
      submittedAt: new Date(Date.now() - 86400000 * 5), // 5 days ago
      status: 'pending_review'
    },
    {
      id: 'bus_pending_003',
      applicationId: 'app_003_malmo_retail',
      businessInfo: {
        type: 'company',
        name: 'Skåne Handel HB',
        organizationNumber: '969876543210', // Fake partnership number
        contactPerson: 'Anna Nilsson',
        email: 'anna+test@skanehandel.se',
        phone: '+46401234567',
        address: {
          street: 'Södergatan 8',
          city: 'Malmö',
          postalCode: '211 34',
          country: 'SE'
        },
        businessDescription: 'Local grocery store serving Malmö community',
        expectedMonthlyFeedbacks: 400,
        requestedTier: 2
      },
      documents: ['business_permit', 'partnership_agreement'],
      submittedAt: new Date(Date.now() - 86400000 * 1), // 1 day ago
      status: 'pending_review'
    }
  ],
  approved: [
    {
      id: 'bus_approved_001',
      applicationId: 'app_approved_stockholm_bakery',
      businessInfo: {
        type: 'individual',
        name: 'Stockholm Bakery',
        personnummer: '800315-5678', // Fake
        ownerName: 'Lars Andersson',
        email: 'lars+test@stockholmbakery.se',
        phone: '+46709876543'
      },
      approvedAt: new Date(Date.now() - 86400000 * 10), // 10 days ago
      approvedBy: 'admin_001',
      tier: 1,
      status: 'active'
    }
  ],
  rejected: [
    {
      id: 'bus_rejected_001',
      applicationId: 'app_rejected_invalid_docs',
      businessInfo: {
        type: 'company',
        name: 'Invalid Business AB',
        organizationNumber: '000000000000', // Invalid format
        email: 'invalid@test.se'
      },
      rejectedAt: new Date(Date.now() - 86400000 * 7), // 7 days ago
      rejectedBy: 'admin_002',
      rejectionReason: 'Invalid organization number format and missing required documents',
      status: 'rejected'
    }
  ]
};

// Admin user test data
const ADMIN_TEST_USERS = {
  super_admin: {
    id: 'admin_super_001',
    email: 'superadmin+test@ai-feedback-platform.se',
    passwordHash: '', // Will be generated
    role: 'super_admin',
    permissions: ADMIN_TEST_CONFIG.roles.permissions.super_admin,
    isActive: true,
    lastLogin: new Date(Date.now() - 3600000), // 1 hour ago
    createdAt: new Date(Date.now() - 86400000 * 30), // 30 days ago
    createdBy: 'system'
  },
  platform_admin: {
    id: 'admin_platform_001',
    email: 'admin+test@ai-feedback-platform.se',
    passwordHash: '',
    role: 'platform_admin',
    permissions: ADMIN_TEST_CONFIG.roles.permissions.platform_admin,
    isActive: true,
    lastLogin: new Date(Date.now() - 7200000), // 2 hours ago
    createdAt: new Date(Date.now() - 86400000 * 20),
    createdBy: 'admin_super_001'
  },
  business_manager: {
    id: 'admin_biz_001',
    email: 'bizmanager+test@ai-feedback-platform.se',
    passwordHash: '',
    role: 'business_manager',
    permissions: ADMIN_TEST_CONFIG.roles.permissions.business_manager,
    isActive: true,
    lastLogin: new Date(Date.now() - 14400000), // 4 hours ago
    createdAt: new Date(Date.now() - 86400000 * 15),
    createdBy: 'admin_platform_001'
  },
  support_agent: {
    id: 'admin_support_001',
    email: 'support+test@ai-feedback-platform.se',
    passwordHash: '',
    role: 'support_agent',
    permissions: ADMIN_TEST_CONFIG.roles.permissions.support_agent,
    isActive: true,
    lastLogin: new Date(Date.now() - 1800000), // 30 minutes ago
    createdAt: new Date(Date.now() - 86400000 * 10),
    createdBy: 'admin_platform_001'
  },
  viewer: {
    id: 'admin_viewer_001',
    email: 'viewer+test@ai-feedback-platform.se',
    passwordHash: '',
    role: 'viewer',
    permissions: ADMIN_TEST_CONFIG.roles.permissions.viewer,
    isActive: true,
    lastLogin: new Date(Date.now() - 900000), // 15 minutes ago
    createdAt: new Date(Date.now() - 86400000 * 5),
    createdBy: 'admin_support_001'
  },
  inactive_admin: {
    id: 'admin_inactive_001',
    email: 'inactive+test@ai-feedback-platform.se',
    passwordHash: '',
    role: 'business_manager',
    permissions: [],
    isActive: false,
    lastLogin: new Date(Date.now() - 86400000 * 30), // 30 days ago
    createdAt: new Date(Date.now() - 86400000 * 60),
    deactivatedAt: new Date(Date.now() - 86400000 * 10),
    deactivatedBy: 'admin_super_001',
    deactivationReason: 'Left company'
  }
};

// Live session monitoring test data
const LIVE_SESSION_DATA = {
  active_sessions: [
    {
      sessionId: 'sess_live_001',
      businessId: 'bus_approved_001',
      businessName: 'Stockholm Bakery',
      customerHash: 'cust_hash_12345',
      status: 'feedback_in_progress',
      startedAt: new Date(Date.now() - 300000), // 5 minutes ago
      location: {
        city: 'Stockholm',
        country: 'SE',
        coordinates: { lat: 59.3293, lng: 18.0686 }
      },
      deviceInfo: {
        type: 'mobile',
        browser: 'Safari',
        os: 'iOS'
      },
      qualityScore: null, // Not completed yet
      estimatedReward: null
    },
    {
      sessionId: 'sess_live_002',
      businessId: 'bus_approved_001',
      businessName: 'Stockholm Bakery',
      customerHash: 'cust_hash_67890',
      status: 'completed',
      startedAt: new Date(Date.now() - 900000), // 15 minutes ago
      completedAt: new Date(Date.now() - 600000), // 10 minutes ago
      location: {
        city: 'Stockholm',
        country: 'SE',
        coordinates: { lat: 59.3293, lng: 18.0686 }
      },
      qualityScore: 78,
      rewardAmount: 8750, // 87.50 SEK in öre
      aiEvaluation: {
        authenticity: 82,
        concreteness: 75,
        depth: 77
      }
    }
  ],
  session_metrics: {
    totalSessionsToday: 142,
    avgSessionDuration: 180000, // 3 minutes
    avgQualityScore: 73.5,
    totalRewardsToday: 1250000, // 12,500 SEK in öre
    platformCommission: 250000, // 2,500 SEK in öre (20%)
    topPerformingBusinesses: ['bus_approved_001', 'bus_approved_002'],
    conversionRate: 0.87 // 87% completion rate
  }
};

// Admin system utilities
const AdminTestUtils = {
  // Authentication utilities
  async hashPassword(password) {
    return await bcrypt.hash(password, ADMIN_TEST_CONFIG.auth.bcryptSaltRounds);
  },

  async verifyPassword(password, hash) {
    return await bcrypt.compare(password, hash);
  },

  generateJWTToken(adminUser, expiresIn = ADMIN_TEST_CONFIG.auth.jwtExpiration) {
    return jwt.sign(
      {
        id: adminUser.id,
        email: adminUser.email,
        role: adminUser.role,
        permissions: adminUser.permissions,
        iat: Math.floor(Date.now() / 1000)
      },
      ADMIN_TEST_CONFIG.auth.jwtSecret,
      { expiresIn }
    );
  },

  verifyJWTToken(token) {
    try {
      return jwt.verify(token, ADMIN_TEST_CONFIG.auth.jwtSecret);
    } catch (error) {
      return null;
    }
  },

  // Permission checking utilities
  hasPermission(adminUser, requiredPermission) {
    if (!adminUser.permissions || !Array.isArray(adminUser.permissions)) {
      return false;
    }
    return adminUser.permissions.includes(requiredPermission);
  },

  canAccessResource(adminRole, targetResource) {
    const roleLevel = ADMIN_TEST_CONFIG.roles.hierarchy[adminRole] || 0;
    const resourceRequirements = {
      'system_config': 100,  // Super admin only
      'user_management': 80, // Platform admin+
      'business_approval': 60, // Business manager+
      'monitoring': 40,      // Support agent+
      'view_only': 20        // Viewer+
    };
    
    const requiredLevel = resourceRequirements[targetResource] || 100;
    return roleLevel >= requiredLevel;
  },

  // Swedish business validation utilities
  validateSwedishBusiness(businessData) {
    const validations = {
      organizationNumber: businessData.type === 'company' ? 
        ADMIN_TEST_CONFIG.swedish.organizationNumberPattern.test(businessData.organizationNumber) : true,
      personnummer: businessData.type === 'individual' ?
        ADMIN_TEST_CONFIG.swedish.personnummerPattern.test(businessData.personnummer) : true,
      vatNumber: businessData.vatNumber ? 
        ADMIN_TEST_CONFIG.swedish.vatNumberPattern.test(businessData.vatNumber) : true,
      phone: ADMIN_TEST_CONFIG.swedish.phonePattern.test(businessData.phone),
      postalCode: ADMIN_TEST_CONFIG.swedish.postalCodePattern.test(businessData.address?.postalCode),
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(businessData.email)
    };

    return {
      isValid: Object.values(validations).every(v => v === true),
      validations,
      errors: Object.keys(validations).filter(key => !validations[key])
    };
  },

  // Business tier utilities
  calculateTierRecommendation(businessData) {
    const monthlyFeedbacks = businessData.expectedMonthlyFeedbacks || 0;
    
    if (monthlyFeedbacks <= 1000) {
      return { recommendedTier: 1, reason: 'Low volume, starter tier appropriate' };
    } else if (monthlyFeedbacks <= 5000) {
      return { recommendedTier: 2, reason: 'Medium volume, professional tier recommended' };
    } else {
      return { recommendedTier: 3, reason: 'High volume, enterprise tier recommended' };
    }
  },

  // Approval workflow utilities
  generateApprovalDecision(businessData, adminUser) {
    const validation = this.validateSwedishBusiness(businessData);
    const tierRecommendation = this.calculateTierRecommendation(businessData);
    
    return {
      decision: validation.isValid ? 'approve' : 'reject',
      recommendedTier: tierRecommendation.recommendedTier,
      validationErrors: validation.errors,
      reviewedBy: adminUser.id,
      reviewedAt: new Date(),
      comments: validation.isValid ? 
        `Business approved for tier ${tierRecommendation.recommendedTier}. ${tierRecommendation.reason}` :
        `Business rejected due to validation errors: ${validation.errors.join(', ')}`
    };
  },

  // Session monitoring utilities
  generateLiveSessionUpdate() {
    return {
      timestamp: new Date(),
      activeSessions: Math.floor(Math.random() * 50) + 10, // 10-60 active sessions
      sessionsCompletedLastHour: Math.floor(Math.random() * 100) + 20,
      avgQualityScore: Math.floor(Math.random() * 30) + 70, // 70-100 quality score
      totalRewardsLastHour: Math.floor(Math.random() * 500000) + 100000, // 1,000-6,000 SEK in öre
      systemPerformance: {
        responseTime: Math.floor(Math.random() * 1000) + 200, // 200-1200ms
        dbQueryTime: Math.floor(Math.random() * 300) + 50,     // 50-350ms
        memoryUsage: Math.random() * 0.3 + 0.4,               // 40-70%
        cpuUsage: Math.random() * 0.4 + 0.2                   // 20-60%
      }
    };
  },

  // Mock data generation utilities
  generateMockBusiness(type = 'pending') {
    const businessId = `bus_mock_${uuidv4().substr(0, 8)}`;
    const isCompany = Math.random() > 0.5;
    
    const swedishCities = ['Stockholm', 'Göteborg', 'Malmö', 'Uppsala', 'Västerås'];
    const businessTypes = ['café', 'restaurant', 'retail', 'bakery', 'bookstore'];
    
    const city = swedishCities[Math.floor(Math.random() * swedishCities.length)];
    const businessType = businessTypes[Math.floor(Math.random() * businessTypes.length)];
    
    return {
      id: businessId,
      applicationId: `app_mock_${Date.now()}`,
      businessInfo: {
        type: isCompany ? 'company' : 'individual',
        name: `${city} ${businessType.charAt(0).toUpperCase() + businessType.slice(1)}`,
        organizationNumber: isCompany ? `556${Math.floor(Math.random() * 1000000000).toString().padStart(9, '0')}` : null,
        personnummer: !isCompany ? `${Math.floor(Math.random() * 900000 + 100000)}-${Math.floor(Math.random() * 9000 + 1000)}` : null,
        email: `mock+${businessId}@${businessType}.se`,
        phone: `+4670${Math.floor(Math.random() * 10000000).toString().padStart(7, '0')}`,
        expectedMonthlyFeedbacks: Math.floor(Math.random() * 1000) + 50,
        requestedTier: Math.floor(Math.random() * 3) + 1
      },
      submittedAt: new Date(Date.now() - Math.random() * 86400000 * 7), // Within last 7 days
      status: type
    };
  }
};

// Global test setup
beforeAll(async () => {
  console.log('🏢 Admin System Test Environment Initialized');
  console.log('🇸🇪 Swedish business approval workflows ready');
  console.log('👥 Role-based access control testing enabled');
  console.log('📊 Live session monitoring simulation active');
  
  // Generate password hashes for test admin users
  for (const [role, userData] of Object.entries(ADMIN_TEST_USERS)) {
    const testPassword = `TestPassword123!_${role}`;
    userData.passwordHash = await AdminTestUtils.hashPassword(testPassword);
    userData.testPassword = testPassword; // Store for testing purposes
  }
});

// Global test utilities
global.AdminTestUtils = AdminTestUtils;
global.ADMIN_TEST_CONFIG = ADMIN_TEST_CONFIG;
global.SWEDISH_TEST_BUSINESSES = SWEDISH_TEST_BUSINESSES;
global.ADMIN_TEST_USERS = ADMIN_TEST_USERS;
global.LIVE_SESSION_DATA = LIVE_SESSION_DATA;

// Custom Jest matchers for admin system testing
expect.extend({
  toHaveValidSwedishBusinessData(received) {
    const validation = AdminTestUtils.validateSwedishBusiness(received);
    const pass = validation.isValid;
    
    return {
      message: () => pass
        ? `expected ${JSON.stringify(received)} not to have valid Swedish business data`
        : `expected ${JSON.stringify(received)} to have valid Swedish business data. Errors: ${validation.errors.join(', ')}`,
      pass
    };
  },

  toHavePermission(adminUser, permission) {
    const hasPermission = AdminTestUtils.hasPermission(adminUser, permission);
    
    return {
      message: () => hasPermission
        ? `expected admin user ${adminUser.email} not to have permission '${permission}'`
        : `expected admin user ${adminUser.email} to have permission '${permission}'. Current permissions: ${adminUser.permissions?.join(', ') || 'none'}`,
      pass: hasPermission
    };
  },

  toBeValidJWTToken(token) {
    const decoded = AdminTestUtils.verifyJWTToken(token);
    const pass = decoded !== null;
    
    return {
      message: () => pass
        ? `expected ${token} not to be a valid JWT token`
        : `expected ${token} to be a valid JWT token`,
      pass
    };
  },

  toHaveRoleAccess(adminRole, resource) {
    const hasAccess = AdminTestUtils.canAccessResource(adminRole, resource);
    
    return {
      message: () => hasAccess
        ? `expected role '${adminRole}' not to have access to resource '${resource}'`
        : `expected role '${adminRole}' to have access to resource '${resource}'`,
      pass: hasAccess
    };
  }
});

console.log('✅ Admin system test environment ready');
console.log(`👥 ${Object.keys(ADMIN_TEST_USERS).length} admin user roles configured`);
console.log(`🏢 ${SWEDISH_TEST_BUSINESSES.pending_approval.length} pending business applications loaded`);
console.log(`📊 ${LIVE_SESSION_DATA.active_sessions.length} live sessions simulated`);

module.exports = {
  ADMIN_TEST_CONFIG,
  SWEDISH_TEST_BUSINESSES,
  ADMIN_TEST_USERS,
  LIVE_SESSION_DATA,
  AdminTestUtils
};