import { Router } from 'express';
import { adminAuth, adminAudit, getAdminAuditRecords, requirePermission, authenticateAdmin, generateTokens, refreshToken, getAdminUsers, createAdminUser, AdminRequest } from '../middleware/adminAuth';
import { getActiveVoiceSessionStats, getVoiceAnalytics } from '../websocket/voiceHandler';
import { getAdminWebSocketStats, triggerMetricsBroadcast } from '../websocket/adminHandler';

/**
 * @openapi
 * /api/admin/login:
 *   post:
 *     summary: Admin login
 *     tags: [Admin Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 */
export const adminRoutes = Router();

// Public auth routes (no authentication required)
adminRoutes.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        code: 'MISSING_CREDENTIALS',
        message: 'Email and password required'
      });
    }

    const user = await authenticateAdmin(email, password);
    if (!user) {
      return res.status(401).json({
        code: 'INVALID_CREDENTIALS',
        message: 'Ogiltiga inloggningsuppgifter' // Swedish: Invalid credentials
      });
    }

    const tokens = generateTokens(user);
    const { passwordHash, ...userWithoutPassword } = user;
    
    res.json({
      success: true,
      message: 'Inloggning lyckades', // Swedish: Login successful
      data: {
        user: userWithoutPassword,
        ...tokens
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Inloggningsfel' // Swedish: Login error
    });
  }
});

/**
 * @openapi
 * /api/admin/refresh:
 *   post:
 *     summary: Refresh admin token
 *     tags: [Admin Auth]
 */
adminRoutes.post('/refresh', refreshToken);

/**
 * @openapi
 * /api/admin/logout:
 *   post:
 *     summary: Admin logout
 *     tags: [Admin Auth]
 */
adminRoutes.post('/logout', adminAuth, (req, res) => {
  // In production, blacklist the token or invalidate the session
  res.json({
    success: true,
    message: 'Utloggning lyckades' // Swedish: Logout successful
  });
});

// Protected admin routes (authentication required)
adminRoutes.use(adminAuth, adminAudit);

/**
 * @openapi
 * /api/admin/metrics:
 *   get:
 *     summary: Admin system metrics
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System metrics
 */
adminRoutes.get('/metrics', requirePermission('system:read'), async (req, res) => {
  try {
    const adminReq = req as AdminRequest;
    const voiceStats = getActiveVoiceSessionStats();
    
    // Enhanced metrics with admin context
    res.json({
      success: true,
      data: {
        system: {
          activeVoiceSessions: voiceStats.activeCount,
          activeSessionIds: voiceStats.activeSessionIds,
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
          timestamp: new Date().toISOString()
        },
        admin: {
          role: adminReq.admin.role,
          permissions: adminReq.admin.permissions.length,
          sessionId: adminReq.admin.sessionId
        }
      }
    });
  } catch (error) {
    console.error('Metrics error:', error);
    res.status(500).json({ 
      code: 'INTERNAL_ERROR', 
      message: 'Kunde inte ladda mätvärden' // Swedish: Failed to load metrics
    });
  }
});

// Voice WebSocket analytics (no PII). In-memory, last ~60min aggregates
/**
 * @openapi
 * /api/admin/voice/analytics:
 *   get:
 *     summary: Voice WebSocket analytics
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Analytics
 */
adminRoutes.get('/voice/analytics', requirePermission('analytics:read'), async (req, res) => {
  try {
    const analytics = getVoiceAnalytics();
    res.json({
      success: true,
      data: analytics,
      message: 'Röstanalys laddad' // Swedish: Voice analytics loaded
    });
  } catch (error) {
    console.error('Voice analytics error:', error);
    res.status(500).json({ 
      code: 'INTERNAL_ERROR', 
      message: 'Kunde inte ladda röstanalys' // Swedish: Failed to load voice analytics
    });
  }
});

// Admin user management
/**
 * @openapi
 * /api/admin/users:
 *   get:
 *     summary: Get admin users
 *     tags: [Admin Users]
 *     security:
 *       - bearerAuth: []
 */
adminRoutes.get('/users', requirePermission('admin:read'), async (req, res) => {
  try {
    const users = getAdminUsers();
    res.json({
      success: true,
      data: { users }
    });
  } catch (error) {
    res.status(500).json({ 
      code: 'INTERNAL_ERROR', 
      message: 'Kunde inte ladda administratörer' // Swedish: Failed to load administrators
    });
  }
});

/**
 * @openapi
 * /api/admin/users:
 *   post:
 *     summary: Create admin user
 *     tags: [Admin Users]
 *     security:
 *       - bearerAuth: []
 */
adminRoutes.post('/users', requirePermission('admin:write'), async (req, res) => {
  try {
    const { email, name, password, role } = req.body;
    
    if (!email || !password || !role) {
      return res.status(400).json({
        code: 'MISSING_FIELDS',
        message: 'E-post, lösenord och roll krävs' // Swedish: Email, password and role required
      });
    }

    const user = await createAdminUser({ email, name, password, role });
    res.status(201).json({
      success: true,
      message: 'Administratör skapad', // Swedish: Administrator created
      data: { user }
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ 
      code: 'INTERNAL_ERROR', 
      message: 'Kunde inte skapa administratör' // Swedish: Failed to create administrator
    });
  }
});

// Business approvals (enhanced with comprehensive Swedish validation)
/**
 * @openapi
 * /api/admin/business/approvals:
 *   get:
 *     summary: Pending business approvals with Swedish validation
 *     tags: [Admin Business]
 *     security:
 *       - bearerAuth: []
 */
adminRoutes.get('/business/approvals', requirePermission('business:read'), async (req, res) => {
  try {
    const { status = 'pending', page = 1, limit = 20 } = req.query;
    
    // Mock comprehensive Swedish business approval queue
    const pendingBusinesses = [
      {
        id: 'bus_001_stockholm_cafe',
        name: 'Café Lagom Stockholm',
        organizationNumber: '556123-4567',
        contactEmail: 'info@cafelagom.se',
        contactPhone: '+46 8 123 45 67',
        address: {
          street: 'Drottninggatan 45',
          city: 'Stockholm',
          postalCode: '11151',
          region: 'Stockholm'
        },
        businessType: 'cafe',
        estimatedMonthlyTransactions: 1200,
        expectedCustomerVolume: 300,
        submittedAt: '2024-08-20T10:30:00Z',
        status: 'pending_review',
        documents: {
          organizationCertificate: {
            filename: 'bolagsverket_556123-4567.pdf',
            uploadedAt: '2024-08-20T10:25:00Z',
            status: 'uploaded',
            verified: false
          },
          businessLicense: {
            filename: 'restaurangtillstand_stockholm.pdf',
            uploadedAt: '2024-08-20T10:26:00Z',
            status: 'uploaded',
            verified: false
          },
          bankStatement: {
            filename: 'kontoutdrag_202407.pdf',
            uploadedAt: '2024-08-20T10:28:00Z',
            status: 'uploaded',
            verified: false
          }
        },
        validation: {
          organizationNumberValid: true,
          documentsComplete: true,
          addressVerified: false,
          creditCheckPassed: null,
          complianceScore: 85,
          riskLevel: 'low',
          automaticApproval: false,
          requiresManualReview: true,
          flags: []
        },
        reviewNotes: [],
        assignedReviewer: null
      },
      {
        id: 'bus_002_goteborg_bakery',
        name: 'Göteborg Bageri & Café',
        organizationNumber: '559876-5432',
        contactEmail: 'kontakt@goteborgbageri.se',
        contactPhone: '+46 31 987 65 43',
        address: {
          street: 'Avenyn 123',
          city: 'Göteborg',
          postalCode: '41136',
          region: 'Västra Götaland'
        },
        businessType: 'bakery_cafe',
        estimatedMonthlyTransactions: 800,
        expectedCustomerVolume: 200,
        submittedAt: '2024-08-21T14:15:00Z',
        status: 'needs_documentation',
        documents: {
          organizationCertificate: {
            filename: 'bolagsverket_559876-5432.pdf',
            uploadedAt: '2024-08-21T14:10:00Z',
            status: 'uploaded',
            verified: true
          },
          businessLicense: null,
          bankStatement: null
        },
        validation: {
          organizationNumberValid: true,
          documentsComplete: false,
          addressVerified: true,
          creditCheckPassed: null,
          complianceScore: 60,
          riskLevel: 'medium',
          automaticApproval: false,
          requiresManualReview: true,
          flags: ['missing_business_license', 'missing_financial_documents']
        },
        reviewNotes: [
          {
            id: 'note_001',
            adminId: 'admin_reviewer_1',
            adminName: 'Anna Svensson',
            note: 'Organisationsnummer verifierat. Saknar restaurangtillstånd och ekonomiska handlingar.',
            timestamp: '2024-08-21T15:30:00Z',
            category: 'documentation'
          }
        ],
        assignedReviewer: 'admin_reviewer_1'
      },
      {
        id: 'bus_003_malmo_restaurant',
        name: 'Malmö Gourmet Restaurant',
        organizationNumber: '558765-4321',
        contactEmail: 'info@malmogourmet.se',
        contactPhone: '+46 40 765 43 21',
        address: {
          street: 'Södergatan 78',
          city: 'Malmö',
          postalCode: '21134',
          region: 'Skåne'
        },
        businessType: 'restaurant',
        estimatedMonthlyTransactions: 2500,
        expectedCustomerVolume: 800,
        submittedAt: '2024-08-22T09:45:00Z',
        status: 'approved_conditionally',
        documents: {
          organizationCertificate: {
            filename: 'bolagsverket_558765-4321.pdf',
            uploadedAt: '2024-08-22T09:40:00Z',
            status: 'verified',
            verified: true
          },
          businessLicense: {
            filename: 'alkoholtillstand_malmo.pdf',
            uploadedAt: '2024-08-22T09:41:00Z',
            status: 'verified',
            verified: true
          },
          bankStatement: {
            filename: 'seb_kontoutdrag_202407.pdf',
            uploadedAt: '2024-08-22T09:42:00Z',
            status: 'verified',
            verified: true
          }
        },
        validation: {
          organizationNumberValid: true,
          documentsComplete: true,
          addressVerified: true,
          creditCheckPassed: true,
          complianceScore: 95,
          riskLevel: 'low',
          automaticApproval: false,
          requiresManualReview: false,
          flags: []
        },
        reviewNotes: [
          {
            id: 'note_002',
            adminId: 'admin_reviewer_2',
            adminName: 'Erik Lindqvist',
            note: 'Alla dokument verifierade. Hög kompetenspoäng. Godkänt villkorligt pending slutgranskning.',
            timestamp: '2024-08-22T11:15:00Z',
            category: 'approval'
          }
        ],
        assignedReviewer: 'admin_reviewer_2',
        conditionalApproval: {
          conditions: ['Månatlig volymrapportering första 3 månaderna'],
          expiresAt: '2024-08-25T23:59:59Z'
        }
      }
    ].filter(b => status === 'all' || b.status.includes(status));
    
    // Pagination
    const startIndex = (parseInt(page as string) - 1) * parseInt(limit as string);
    const endIndex = startIndex + parseInt(limit as string);
    const paginatedBusinesses = pendingBusinesses.slice(startIndex, endIndex);
    
    // Summary statistics
    const stats = {
      total: pendingBusinesses.length,
      pending: pendingBusinesses.filter(b => b.status === 'pending_review').length,
      needsDocumentation: pendingBusinesses.filter(b => b.status === 'needs_documentation').length,
      conditionallyApproved: pendingBusinesses.filter(b => b.status === 'approved_conditionally').length,
      awaitingReview: pendingBusinesses.filter(b => !b.assignedReviewer).length,
      highRisk: pendingBusinesses.filter(b => b.validation.riskLevel === 'high').length,
      automaticApprovalEligible: pendingBusinesses.filter(b => b.validation.automaticApproval).length
    };
    
    res.json({
      success: true,
      data: {
        businesses: paginatedBusinesses,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total: pendingBusinesses.length,
          pages: Math.ceil(pendingBusinesses.length / parseInt(limit as string))
        },
        stats
      },
      message: `${paginatedBusinesses.length} företag i godkännandekö` // Swedish: businesses in approval queue
    });
  } catch (error) {
    console.error('Business approvals error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Kunde inte ladda godkännandekö' // Swedish: Failed to load approval queue
    });
  }
});

/**
 * @openapi
 * /api/admin/business/{id}/approve:
 *   post:
 *     summary: Approve business with comprehensive Swedish validation
 *     tags: [Admin Business]
 *     security:
 *       - bearerAuth: []
 */
adminRoutes.post('/business/:id/approve', requirePermission('business:approve'), async (req, res) => {
  const { id } = req.params;
  const { 
    approvalType = 'full', // 'full' | 'conditional' | 'trial'
    conditions = [],
    tier = 1,
    monthlyLimit,
    notes,
    requiresFollowup = false,
    followupDate
  } = req.body;
  const adminReq = req as AdminRequest;
  
  try {
    // Validate Swedish business requirements
    const validationResults = {
      organizationNumberVerified: true,
      documentsVerified: true,
      addressValidated: true,
      creditCheckPassed: true,
      complianceScore: 92,
      riskAssessment: 'low',
      eligibleForTier: tier <= 2 ? tier : 1
    };
    
    // Check if automatic approval criteria are met
    const autoApprovalEligible = (
      validationResults.complianceScore >= 90 &&
      validationResults.riskAssessment === 'low' &&
      validationResults.documentsVerified &&
      tier <= 1
    );
    
    // Create approval record with Swedish compliance
    const approvalRecord = {
      businessId: id,
      adminId: adminReq.admin.id,
      adminEmail: adminReq.admin.email,
      approvalType,
      tier: validationResults.eligibleForTier,
      conditions: conditions.length > 0 ? conditions : [],
      monthlyTransactionLimit: monthlyLimit || (tier === 1 ? 200 : tier === 2 ? 1000 : 5000),
      monthlyRewardLimit: monthlyLimit ? monthlyLimit * 0.12 : (tier === 1 ? 24 : tier === 2 ? 120 : 600),
      approvedAt: new Date().toISOString(),
      status: approvalType === 'conditional' ? 'approved_conditional' : 'approved',
      validationResults,
      reviewNotes: notes || '',
      requiresFollowup,
      followupDate: followupDate || null,
      auditTrail: {
        action: 'business_approved',
        adminRole: adminReq.admin.role,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString(),
        details: {
          approvalType,
          tier: validationResults.eligibleForTier,
          autoApprovalEligible,
          complianceScore: validationResults.complianceScore,
          conditions: conditions.length
        }
      }
    };
    
    // Generate approval notification for business
    const businessNotification = {
      businessId: id,
      type: 'business_approved',
      title: approvalType === 'conditional' ? 'Villkorligt Godkännande' : 'Företag Godkänt',
      message: approvalType === 'conditional' 
        ? `Ditt företag har godkänts villkorligt för Tier ${validationResults.eligibleForTier}. Villkor: ${conditions.join(', ')}`
        : `Grattis! Ditt företag har godkänts för Tier ${validationResults.eligibleForTier} med månadsgräns på ${approvalRecord.monthlyTransactionLimit} SEK.`,
      actionRequired: approvalType === 'conditional' ? conditions.length > 0 : false,
      validFrom: new Date().toISOString(),
      validUntil: approvalType === 'conditional' && followupDate ? followupDate : null,
      createdAt: new Date().toISOString()
    };
    
    // Swedish business compliance checks
    const complianceChecks = {
      gdprCompliant: true,
      pci_dssCompliant: true,
      finansinspektionNotified: validationResults.complianceScore >= 85,
      antimoneylaundering: {
        riskLevel: validationResults.riskAssessment,
        dueDiligenceComplete: true,
        beneficialOwnersVerified: true
      },
      taxCompliance: {
        vatRegistered: true,
        taxDebtCleared: true,
        currentWithDeclarations: true
      }
    };
    
    console.log(`Business ${id} approved by admin ${adminReq.admin.email} (${adminReq.admin.role})`);
    console.log(`Approval type: ${approvalType}, Tier: ${validationResults.eligibleForTier}, Compliance score: ${validationResults.complianceScore}`);
    
    res.json({ 
      success: true, 
      data: {
        id,
        action: 'approved',
        approvalType,
        tier: validationResults.eligibleForTier,
        limits: {
          monthlyTransactions: approvalRecord.monthlyTransactionLimit,
          monthlyRewards: approvalRecord.monthlyRewardLimit,
          commission: tier === 1 ? '20%' : tier === 2 ? '18%' : '15%'
        },
        conditions: conditions.length > 0 ? conditions : null,
        validFrom: approvalRecord.approvedAt,
        validUntil: followupDate || null,
        complianceChecks,
        notification: businessNotification,
        auditTrail: approvalRecord.auditTrail
      },
      message: approvalType === 'conditional' 
        ? `Företag godkänt villkorligt för Tier ${validationResults.eligibleForTier}` 
        : `Företag godkänt för Tier ${validationResults.eligibleForTier}` // Swedish: Business approved for Tier X
    });
  } catch (error) {
    console.error('Business approval error:', error);
    res.status(500).json({
      code: 'APPROVAL_ERROR',
      message: 'Kunde inte godkänna företag' // Swedish: Failed to approve business
    });
  }
});

/**
 * @openapi
 * /api/admin/business/{id}/reject:
 *   post:
 *     summary: Reject business with detailed Swedish compliance reasons
 *     tags: [Admin Business]
 *     security:
 *       - bearerAuth: []
 */
adminRoutes.post('/business/:id/reject', requirePermission('business:approve'), async (req, res) => {
  const { id } = req.params;
  const { 
    reason,
    category = 'compliance', // 'compliance' | 'documentation' | 'risk' | 'eligibility' | 'fraud'
    specificReasons = [],
    allowReapplication = true,
    reapplicationDate,
    internalNotes,
    customerFacing = true
  } = req.body;
  const adminReq = req as AdminRequest;
  
  try {
    if (!reason) {
      return res.status(400).json({
        code: 'MISSING_REASON',
        message: 'Anledning för avslag krävs' // Swedish: Reason for rejection required
      });
    }
    
    // Swedish compliance rejection categories
    const rejectionCategories = {
      compliance: {
        title: 'Regelefterlevnad',
        reasons: [
          'Organisationsnummer ogiltigt eller verifiering misslyckades',
          'Företaget är inte registrerat i Sverige',
          'Skatteskulder eller andra ekonomiska problem',
          'Bristfällig regelefterlevnad enligt Finansinspektionen',
          'AML/KYC-krav inte uppfyllda'
        ]
      },
      documentation: {
        title: 'Dokumentation',
        reasons: [
          'Saknar giltigt Bolagsverket-certifikat',
          'Restaurangtillstånd/näringstillstånd saknas',
          'Ekonomiska handlingar ofullständiga eller förfalskade',
          'Identitetsverifiering av företagsledning misslyckades',
          'Adressverifiering kunde inte genomföras'
        ]
      },
      risk: {
        title: 'Riskbedömning',
        reasons: [
          'Högriskbransch utan tillräckliga skyddsåtgärder',
          'Historia av bedrägeri eller finansiella problem',
          'Koppling till sanktionerade personer eller företag',
          'Otillräcklig kreditvärdighet',
          'Geografiska riskindikatorer'
        ]
      },
      eligibility: {
        title: 'Behörighet',
        reasons: [
          'Företagstyp stöds inte av plattformen',
          'Estimerad transaktionsvolym under minimikrav',
          'Inte tillräckligt etablerat företag',
          'Saknar fysisk närvaro i Sverige',
          'Konkurrerar direkt med plattformens intressen'
        ]
      },
      fraud: {
        title: 'Bedrägeri',
        reasons: [
          'Misstänkt identitetsstöld eller falsk information',
          'Koppling till kända bedragerinätverk',
          'Abnormala ansökningsmönster upptäckta',
          'Tidigare avstängning från liknande plattformar',
          'Tekniska indikatorer på bedrägliga avsikter'
        ]
      }
    };
    
    const selectedCategory = rejectionCategories[category] || rejectionCategories.compliance;
    
    // Create rejection record with comprehensive audit trail
    const rejectionRecord = {
      businessId: id,
      adminId: adminReq.admin.id,
      adminEmail: adminReq.admin.email,
      adminRole: adminReq.admin.role,
      rejectedAt: new Date().toISOString(),
      category,
      reason: customerFacing ? reason : 'Ansökan uppfyller inte våra krav',
      specificReasons: specificReasons.length > 0 ? specificReasons : [reason],
      internalNotes: internalNotes || '',
      allowReapplication,
      reapplicationDate: reapplicationDate || (allowReapplication ? 
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : null), // 30 days default
      auditTrail: {
        action: 'business_rejected',
        adminRole: adminReq.admin.role,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString(),
        details: {
          category,
          reasonsCount: specificReasons.length || 1,
          allowReapplication,
          customerFacingReason: customerFacing,
          hasInternalNotes: !!internalNotes
        }
      }
    };
    
    // Generate business notification with Swedish guidance
    const businessNotification = {
      businessId: id,
      type: 'business_rejected',
      title: 'Ansökan Avvisad',
      message: customerFacing 
        ? `Din företagsansökan har avvisats. Anledning: ${reason}.${allowReapplication ? ' Du kan ansöka igen efter ' + new Date(reapplicationDate).toLocaleDateString('sv-SE') : ''}`
        : `Din företagsansökan har avvisats då den inte uppfyller våra nuvarande krav.${allowReapplication ? ' Du välkomnas att ansöka igen när förutsättningarna förändrats.' : ''}`,
      category: selectedCategory.title,
      actionRequired: allowReapplication,
      nextSteps: allowReapplication ? [
        'Åtgärda de identifierade problemen',
        'Samla in nödvändig dokumentation',
        'Ansök igen efter ' + new Date(reapplicationDate).toLocaleDateString('sv-SE')
      ] : ['Kontakta support för mer information'],
      supportEmail: 'support@aifeedback.se',
      supportPhone: '+46 8 123 456 78',
      reapplicationAllowed: allowReapplication,
      reapplicationDate: reapplicationDate,
      createdAt: new Date().toISOString()
    };
    
    // Swedish regulatory compliance logging
    const complianceLog = {
      action: 'business_application_rejected',
      businessId: id,
      adminId: adminReq.admin.id,
      category,
      gdprCompliant: true,
      finansinspektionReported: category === 'compliance' || category === 'fraud',
      dataRetention: {
        personalDataRemovalDate: allowReapplication ? reapplicationDate : 
          new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000).toISOString(), // 7 years if no reapplication
        businessDataArchived: true,
        auditTrailPreserved: true
      }
    };
    
    console.log(`Business ${id} rejected by admin ${adminReq.admin.email} (${adminReq.admin.role})`);
    console.log(`Rejection category: ${category}, Reapplication allowed: ${allowReapplication}`);
    
    res.json({ 
      success: true, 
      data: {
        id,
        action: 'rejected',
        category: selectedCategory.title,
        reason: customerFacing ? reason : 'Ansökan uppfyller inte våra krav',
        allowReapplication,
        reapplicationDate: reapplicationDate || null,
        notification: businessNotification,
        auditTrail: rejectionRecord.auditTrail,
        complianceLog
      },
      message: `Företag avvisat - ${selectedCategory.title}` // Swedish: Business rejected - [Category]
    });
  } catch (error) {
    console.error('Business rejection error:', error);
    res.status(500).json({
      code: 'REJECTION_ERROR',
      message: 'Kunde inte avvisa företag' // Swedish: Failed to reject business
    });
  }
});

// Automated validation endpoint
/**
 * @openapi
 * /api/admin/business/{id}/validate:
 *   post:
 *     summary: Run automated Swedish business validation
 *     tags: [Admin Business]
 *     security:
 *       - bearerAuth: []
 */
adminRoutes.post('/business/:id/validate', requirePermission('business:read'), async (req, res) => {
  const { id } = req.params;
  const adminReq = req as AdminRequest;
  
  try {
    // Import the validator service
    const { SwedishBusinessValidator } = await import('../services/SwedishBusinessValidator');
    const validator = new SwedishBusinessValidator();
    
    // Mock business application data (in production, fetch from database)
    const businessApplication = {
      id,
      name: 'Test Business AB',
      organizationNumber: '556123-4567',
      contactEmail: 'test@business.se',
      contactPhone: '+46 8 123 45 67',
      address: {
        street: 'Drottninggatan 45',
        city: 'Stockholm',
        postalCode: '11151',
        region: 'Stockholm'
      },
      businessType: 'cafe',
      estimatedMonthlyTransactions: 1200,
      expectedCustomerVolume: 300,
      documents: {
        organizationCertificate: {
          filename: 'bolagsverket_556123-4567.pdf',
          uploadedAt: '2024-08-20T10:25:00Z',
          size: 245678,
          extractedData: {
            organizationNumber: '556123-4567',
            companyName: 'Test Business AB'
          }
        },
        businessLicense: {
          filename: 'restaurangtillstand_stockholm.pdf',
          uploadedAt: '2024-08-20T10:26:00Z',
          size: 189432
        },
        bankStatement: {
          filename: 'kontoutdrag_202407.pdf',
          uploadedAt: '2024-08-20T10:28:00Z',
          size: 167890
        }
      }
    };
    
    // Run automated validation
    const validationResult = await validator.validateBusinessApplication(businessApplication);
    
    // Log validation for audit
    console.log(`Automated validation completed for business ${id} by admin ${adminReq.admin.email}`);
    console.log(`Validation score: ${validationResult.score}/100, Risk: ${validationResult.riskLevel}, Recommendation: ${validationResult.recommendation.action}`);
    
    res.json({
      success: true,
      data: {
        businessId: id,
        validationResult,
        performedBy: {
          adminId: adminReq.admin.id,
          adminEmail: adminReq.admin.email,
          timestamp: new Date().toISOString()
        }
      },
      message: `Automatisk validering slutförd - Poäng: ${validationResult.score}/100`
    });
    
  } catch (error) {
    console.error('Automated validation error:', error);
    res.status(500).json({
      code: 'VALIDATION_ERROR',
      message: 'Kunde inte genomföra automatisk validering'
    });
  }
});

/**
 * @openapi
 * /api/admin/business/{id}/auto-approve:
 *   post:
 *     summary: Attempt automatic approval based on validation criteria
 *     tags: [Admin Business]
 *     security:
 *       - bearerAuth: []
 */
adminRoutes.post('/business/:id/auto-approve', requirePermission('business:approve'), async (req, res) => {
  const { id } = req.params;
  const { force = false } = req.body; // Allow forcing auto-approval for testing
  const adminReq = req as AdminRequest;
  
  try {
    // Import the validator service
    const { SwedishBusinessValidator } = await import('../services/SwedishBusinessValidator');
    const validator = new SwedishBusinessValidator();
    
    // Mock business application (in production, fetch from database)
    const businessApplication = {
      id,
      name: 'Auto-Approval Test Café',
      organizationNumber: '556123-4567',
      contactEmail: 'auto@cafe.se',
      contactPhone: '+46 8 987 65 43',
      address: {
        street: 'Kungsgatan 12',
        city: 'Stockholm',
        postalCode: '11143',
        region: 'Stockholm'
      },
      businessType: 'cafe',
      estimatedMonthlyTransactions: 800,
      expectedCustomerVolume: 200,
      documents: {
        organizationCertificate: {
          filename: 'bolagsverket_556123-4567.pdf',
          uploadedAt: '2024-08-20T10:25:00Z',
          size: 245678
        },
        businessLicense: {
          filename: 'restaurangtillstand_stockholm.pdf',
          uploadedAt: '2024-08-20T10:26:00Z',
          size: 189432
        },
        bankStatement: {
          filename: 'kontoutdrag_202407.pdf',
          uploadedAt: '2024-08-20T10:28:00Z',
          size: 167890
        }
      }
    };
    
    // Run validation
    const validationResult = await validator.validateBusinessApplication(businessApplication);
    
    // Check if automatic approval is possible
    if (!validationResult.automaticApprovalEligible && !force) {
      return res.status(400).json({
        code: 'AUTO_APPROVAL_NOT_ELIGIBLE',
        message: 'Företaget uppfyller inte kriterier för automatiskt godkännande',
        data: {
          score: validationResult.score,
          riskLevel: validationResult.riskLevel,
          recommendation: validationResult.recommendation,
          flags: validationResult.flags.filter(f => f.severity === 'high' || f.severity === 'critical')
        }
      });
    }
    
    // Proceed with automatic approval
    const approvalRecord = {
      businessId: id,
      adminId: 'system_auto_approval',
      adminEmail: 'system@aifeedback.se',
      approvedBy: adminReq.admin.email, // Admin who triggered auto-approval
      approvalType: 'automatic',
      tier: validationResult.recommendation.tier,
      score: validationResult.score,
      riskLevel: validationResult.riskLevel,
      conditions: validationResult.recommendation.conditions || [],
      approvedAt: new Date().toISOString(),
      validationDetails: {
        validatorVersion: validationResult.auditTrail.validatorVersion,
        processingTime: validationResult.auditTrail.processingTime,
        confidence: validationResult.recommendation.confidence,
        rulesApplied: validationResult.auditTrail.rulesApplied
      },
      auditTrail: {
        action: 'business_auto_approved',
        triggeredBy: adminReq.admin.id,
        adminRole: adminReq.admin.role,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString(),
        automatedValidation: true,
        manualOverride: force,
        details: {
          validationScore: validationResult.score,
          riskLevel: validationResult.riskLevel,
          flagsCount: validationResult.flags.length,
          criticalIssues: validationResult.flags.filter(f => f.severity === 'critical').length
        }
      }
    };
    
    // Swedish compliance notification
    const businessNotification = {
      businessId: id,
      type: 'business_auto_approved',
      title: 'Automatiskt Godkännande',
      message: `Grattis! Ditt företag har godkänts automatiskt för Tier ${validationResult.recommendation.tier} baserat på vår svenska regelefterlevnadsvalidering. Poäng: ${validationResult.score}/100.`,
      tier: validationResult.recommendation.tier,
      limits: {
        monthly: validationResult.recommendation.tier === 1 ? '200 SEK/dag' :
                validationResult.recommendation.tier === 2 ? '1000 SEK/dag' : '5000 SEK/dag',
        commission: validationResult.recommendation.tier === 1 ? '20%' :
                   validationResult.recommendation.tier === 2 ? '18%' : '15%'
      },
      validFrom: new Date().toISOString(),
      nextReview: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days
      createdAt: new Date().toISOString()
    };
    
    console.log(`Automatic approval completed for business ${id}`);
    console.log(`Validation score: ${validationResult.score}/100, Tier: ${validationResult.recommendation.tier}, Triggered by: ${adminReq.admin.email}`);
    
    res.json({
      success: true,
      data: {
        id,
        action: 'auto_approved',
        tier: validationResult.recommendation.tier,
        score: validationResult.score,
        riskLevel: validationResult.riskLevel,
        approvalType: 'automatic',
        validationSummary: {
          score: validationResult.score,
          riskLevel: validationResult.riskLevel,
          confidence: validationResult.recommendation.confidence,
          processingTime: validationResult.auditTrail.processingTime,
          flagsResolved: validationResult.flags.length === 0
        },
        limits: {
          monthlyTransactions: validationResult.recommendation.tier === 1 ? 200 : 
                              validationResult.recommendation.tier === 2 ? 1000 : 5000,
          monthlyRewards: validationResult.recommendation.tier === 1 ? 24 : 
                         validationResult.recommendation.tier === 2 ? 120 : 600,
          commission: validationResult.recommendation.tier === 1 ? '20%' :
                     validationResult.recommendation.tier === 2 ? '18%' : '15%'
        },
        notification: businessNotification,
        auditTrail: approvalRecord.auditTrail,
        nextReview: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
      },
      message: force ? 
        `Företag automatiskt godkänt (manuellt forcerat) för Tier ${validationResult.recommendation.tier}` :
        `Företag automatiskt godkänt för Tier ${validationResult.recommendation.tier} - Poäng: ${validationResult.score}/100`
    });
    
  } catch (error) {
    console.error('Auto-approval error:', error);
    res.status(500).json({
      code: 'AUTO_APPROVAL_ERROR',
      message: 'Kunde inte genomföra automatiskt godkännande'
    });
  }
});

// Document review endpoints
/**
 * @openapi
 * /api/admin/business/{id}/documents:
 *   get:
 *     summary: Get business documents for review
 *     tags: [Admin Business]
 *     security:
 *       - bearerAuth: []
 */
adminRoutes.get('/business/:id/documents', requirePermission('business:read'), async (req, res) => {
  const { id } = req.params;
  
  try {
    // Mock document review data
    const businessDocuments = {
      businessId: id,
      documents: {
        organizationCertificate: {
          id: 'doc_org_001',
          filename: 'bolagsverket_556123-4567.pdf',
          uploadedAt: '2024-08-20T10:25:00Z',
          size: 245678,
          type: 'application/pdf',
          status: 'pending_review',
          verified: false,
          reviewedBy: null,
          reviewedAt: null,
          extractedData: {
            organizationNumber: '556123-4567',
            companyName: 'Café Lagom Stockholm AB',
            registrationDate: '2020-03-15',
            status: 'Aktiv',
            address: 'Drottninggatan 45, 11151 Stockholm',
            ceo: 'Anna Svensson',
            shareCapital: '50000 SEK'
          },
          validationChecks: {
            documentIntegrity: true,
            bolagsverketVerified: false,
            dataConsistency: true,
            expirationDate: null
          },
          flags: [],
          downloadUrl: '/api/admin/documents/doc_org_001/download',
          thumbnailUrl: '/api/admin/documents/doc_org_001/thumbnail'
        },
        businessLicense: {
          id: 'doc_lic_001',
          filename: 'restaurangtillstand_stockholm.pdf',
          uploadedAt: '2024-08-20T10:26:00Z',
          size: 189432,
          type: 'application/pdf',
          status: 'pending_review',
          verified: false,
          reviewedBy: null,
          reviewedAt: null,
          extractedData: {
            licenseType: 'Restaurangtillstånd',
            issuer: 'Stockholms Stad',
            validFrom: '2024-01-01',
            validUntil: '2024-12-31',
            licenseNumber: 'RST-2024-001234',
            address: 'Drottninggatan 45, Stockholm',
            conditions: ['Serveringstid: 07:00-01:00', 'Max 80 sittplatser']
          },
          validationChecks: {
            documentIntegrity: true,
            authorityVerified: false,
            validityPeriod: true,
            addressMatch: true
          },
          flags: [],
          downloadUrl: '/api/admin/documents/doc_lic_001/download',
          thumbnailUrl: '/api/admin/documents/doc_lic_001/thumbnail'
        },
        bankStatement: {
          id: 'doc_bank_001',
          filename: 'kontoutdrag_202407.pdf',
          uploadedAt: '2024-08-20T10:28:00Z',
          size: 167890,
          type: 'application/pdf',
          status: 'pending_review',
          verified: false,
          reviewedBy: null,
          reviewedAt: null,
          extractedData: {
            bankName: 'Swedbank',
            accountHolder: 'Café Lagom Stockholm AB',
            accountNumber: '8327-9*****123',
            period: '2024-07-01 till 2024-07-31',
            openingBalance: '245670 SEK',
            closingBalance: '289430 SEK',
            averageBalance: '267550 SEK',
            transactionCount: 1247
          },
          validationChecks: {
            documentIntegrity: true,
            bankVerified: false,
            sufficientActivity: true,
            healthyBalance: true
          },
          flags: [],
          downloadUrl: '/api/admin/documents/doc_bank_001/download',
          thumbnailUrl: '/api/admin/documents/doc_bank_001/thumbnail'
        }
      },
      summary: {
        totalDocuments: 3,
        pendingReview: 3,
        verified: 0,
        flagged: 0,
        completionPercentage: 100,
        readyForApproval: false,
        estimatedReviewTime: '15-20 minuter'
      }
    };
    
    res.json({
      success: true,
      data: businessDocuments,
      message: 'Företagsdokument laddade för granskning' // Swedish: Business documents loaded for review
    });
  } catch (error) {
    console.error('Document retrieval error:', error);
    res.status(500).json({
      code: 'DOCUMENT_ERROR',
      message: 'Kunde inte ladda dokument' // Swedish: Failed to load documents
    });
  }
});

// Fraud flags (enhanced with permissions)
/**
 * @openapi
 * /api/admin/fraud/flags:
 *   get:
 *     summary: Fraud flags
 *     tags: [Admin Fraud]
 *     security:
 *       - bearerAuth: []
 */
adminRoutes.get('/fraud/flags', requirePermission('fraud:read'), async (req, res) => {
  res.json({ 
    success: true,
    data: { items: [] },
    message: 'Inga bedrägerivarningar' // Swedish: No fraud alerts
  });
});

/**
 * @openapi
 * /api/admin/customers/{id}/ban:
 *   post:
 *     summary: Ban customer
 *     tags: [Admin Fraud]
 *     security:
 *       - bearerAuth: []
 */
adminRoutes.post('/customers/:id/ban', requirePermission('fraud:ban'), async (req, res) => {
  const { id } = req.params;
  const { reason, duration } = req.body;
  const adminReq = req as AdminRequest;
  
  console.log(`Customer ${id} banned by admin ${adminReq.admin.email}, reason: ${reason}`);
  
  res.json({ 
    success: true, 
    data: { id, action: 'banned', reason, duration },
    message: 'Kund blockerad' // Swedish: Customer banned
  });
});

/**
 * @openapi
 * /api/admin/customers/{id}/unban:
 *   post:
 *     summary: Unban customer
 *     tags: [Admin Fraud]
 *     security:
 *       - bearerAuth: []
 */
adminRoutes.post('/customers/:id/unban', requirePermission('fraud:ban'), async (req, res) => {
  const { id } = req.params;
  const adminReq = req as AdminRequest;
  
  console.log(`Customer ${id} unbanned by admin ${adminReq.admin.email}`);
  
  res.json({ 
    success: true, 
    data: { id, action: 'unbanned' },
    message: 'Kund avblockerad' // Swedish: Customer unbanned
  });
});

// Manual score override (enhanced with permissions)
/**
 * @openapi
 * /api/admin/feedback/{id}/override-score:
 *   post:
 *     summary: Override feedback score
 *     tags: [Admin Feedback]
 *     security:
 *       - bearerAuth: []
 */
adminRoutes.post('/feedback/:id/override-score', requirePermission('feedback:override'), async (req, res) => {
  const { id } = req.params;
  const { total, reason } = req.body || {};
  const adminReq = req as AdminRequest;
  
  if (!total || !reason) {
    return res.status(400).json({
      code: 'MISSING_FIELDS',
      message: 'Poäng och anledning krävs' // Swedish: Score and reason required
    });
  }
  
  console.log(`Feedback ${id} score overridden to ${total} by admin ${adminReq.admin.email}, reason: ${reason}`);
  
  res.json({ 
    success: true, 
    data: { id, total, reason },
    message: 'Poäng ändrad' // Swedish: Score changed
  });
});

// Business management (enhanced with permissions)
/**
 * @openapi
 * /api/admin/business/{id}/suspend:
 *   post:
 *     summary: Suspend business
 *     tags: [Admin Business]
 *     security:
 *       - bearerAuth: []
 */
adminRoutes.post('/business/:id/suspend', requirePermission('business:suspend'), async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const adminReq = req as AdminRequest;
  
  console.log(`Business ${id} suspended by admin ${adminReq.admin.email}, reason: ${reason}`);
  
  res.json({ 
    success: true, 
    data: { id, action: 'suspended', reason },
    message: 'Företag avstängt' // Swedish: Business suspended
  });
});

/**
 * @openapi
 * /api/admin/business/{id}/resume:
 *   post:
 *     summary: Resume business
 *     tags: [Admin Business]
 *     security:
 *       - bearerAuth: []
 */
adminRoutes.post('/business/:id/resume', requirePermission('business:suspend'), async (req, res) => {
  const { id } = req.params;
  const adminReq = req as AdminRequest;
  
  console.log(`Business ${id} resumed by admin ${adminReq.admin.email}`);
  
  res.json({ 
    success: true, 
    data: { id, action: 'resumed' },
    message: 'Företag återaktiverat' // Swedish: Business resumed
  });
});

/**
 * @openapi
 * /api/admin/business/{id}/tier:
 *   patch:
 *     summary: Change business tier
 *     tags: [Admin Business]
 *     security:
 *       - bearerAuth: []
 */
adminRoutes.patch('/business/:id/tier', requirePermission('business:write'), async (req, res) => {
  const { id } = req.params;
  const { tier, reason } = req.body || {};
  const adminReq = req as AdminRequest;
  
  if (!tier) {
    return res.status(400).json({
      code: 'MISSING_TIER',
      message: 'Nivå krävs' // Swedish: Tier required
    });
  }
  
  console.log(`Business ${id} tier changed to ${tier} by admin ${adminReq.admin.email}, reason: ${reason}`);
  
  res.json({ 
    success: true, 
    data: { id, tier, reason },
    message: 'Företagsnivå ändrad' // Swedish: Business tier changed
  });
});

// Live sessions (enhanced with permissions)
/**
 * @openapi
 * /api/admin/live/sessions:
 *   get:
 *     summary: Live voice sessions
 *     tags: [Admin Monitoring]
 *     security:
 *       - bearerAuth: []
 */
adminRoutes.get('/live/sessions', requirePermission('system:read'), async (req, res) => {
  try {
    const stats = getActiveVoiceSessionStats();
    res.json({
      success: true,
      data: stats,
      message: `${stats.activeCount} aktiva sessioner` // Swedish: active sessions
    });
  } catch (error) {
    res.status(500).json({ 
      code: 'INTERNAL_ERROR', 
      message: 'Kunde inte ladda livesessioner' // Swedish: Failed to load live sessions
    });
  }
});

// Audit logs (enhanced with permissions and filtering)
/**
 * @openapi
 * /api/admin/audit/logs:
 *   get:
 *     summary: Admin audit logs
 *     tags: [Admin Audit]
 *     security:
 *       - bearerAuth: []
 */
adminRoutes.get('/audit/logs', requirePermission('system:read'), async (req, res) => {
  try {
    const { adminId, action, startDate, endDate, limit } = req.query;
    
    const filters = {
      adminId: adminId as string,
      action: action as string,
      startDate: startDate as string,
      endDate: endDate as string,
      limit: limit ? parseInt(limit as string) : 100
    };
    
    const logs = getAdminAuditRecords(filters);
    res.json({ 
      success: true,
      data: { logs, count: logs.length },
      message: `${logs.length} granskningsloggar` // Swedish: audit logs
    });
  } catch (error) {
    res.status(500).json({ 
      code: 'INTERNAL_ERROR', 
      message: 'Kunde inte ladda granskningsloggar' // Swedish: Failed to load audit logs
    });
  }
});

// Current admin user info
/**
 * @openapi
 * /api/admin/me:
 *   get:
 *     summary: Get current admin user info
 *     tags: [Admin Auth]
 *     security:
 *       - bearerAuth: []
 */
adminRoutes.get('/me', (req, res) => {
  const adminReq = req as AdminRequest;
  
  res.json({
    success: true,
    data: {
      id: adminReq.admin.id,
      email: adminReq.admin.email,
      role: adminReq.admin.role,
      permissions: adminReq.admin.permissions,
      sessionId: adminReq.admin.sessionId
    }
  });
});

// WebSocket connection stats
/**
 * @openapi
 * /api/admin/websocket/stats:
 *   get:
 *     summary: Get WebSocket connection statistics
 *     tags: [Admin Monitoring]
 *     security:
 *       - bearerAuth: []
 */
adminRoutes.get('/websocket/stats', requirePermission('system:read'), (req, res) => {
  try {
    const adminWsStats = getAdminWebSocketStats();
    const voiceStats = getActiveVoiceSessionStats();
    
    res.json({
      success: true,
      data: {
        admin: adminWsStats,
        voice: {
          activeCount: voiceStats.activeCount,
          activeSessionIds: voiceStats.activeSessionIds
        },
        total: {
          connections: adminWsStats.totalConnections + voiceStats.activeCount
        }
      },
      message: `${adminWsStats.totalConnections} admin + ${voiceStats.activeCount} röst anslutningar` // Swedish: admin + voice connections
    });
  } catch (error) {
    console.error('WebSocket stats error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Kunde inte ladda WebSocket statistik' // Swedish: Failed to load WebSocket statistics
    });
  }
});

// Business tier management endpoints
/**
 * @openapi
 * /api/admin/business/tiers:
 *   get:
 *     summary: Get all businesses with tier information for management
 *     tags: [Admin Business]
 *     security:
 *       - bearerAuth: []
 */
adminRoutes.get('/business/tiers', requirePermission('business:read'), async (req, res) => {
  try {
    // Mock businesses with tier information - in production, fetch from database
    const mockBusinesses = [
      {
        id: 'bus_001_stockholm_cafe',
        name: 'Café Lagom Stockholm',
        organizationNumber: '556123-4567',
        currentTier: 1,
        approvedAt: '2024-08-15T09:30:00Z',
        monthlyRevenue: 75000,
        transactionVolume: 450,
        customerCount: 180,
        performanceScore: 82,
        complianceScore: 88,
        lastTierChange: {
          date: '2024-07-20T14:20:00Z',
          previousTier: 1,
          newTier: 1,
          reason: 'Initial approval',
          adminName: 'Anna Svensson'
        },
        eligibleForUpgrade: true,
        upgradeRecommendation: {
          toTier: 2,
          confidence: 0.85,
          reasons: [
            'Stabil månadsintäkt över 50,000 SEK',
            'Hög kundnöjdhet (92%)',
            'Konsekvent transaktionsvolym',
            'Utmärkt compliance-poäng'
          ]
        }
      },
      {
        id: 'bus_002_goteborg_restaurant',
        name: 'Restaurang Västkust Göteborg',
        organizationNumber: '556789-0123',
        currentTier: 2,
        approvedAt: '2024-07-10T11:15:00Z',
        monthlyRevenue: 180000,
        transactionVolume: 1200,
        customerCount: 480,
        performanceScore: 91,
        complianceScore: 94,
        lastTierChange: {
          date: '2024-08-10T16:45:00Z',
          previousTier: 1,
          newTier: 2,
          reason: 'Uppgradering baserad på stark prestanda och stabilt kassaflöde',
          adminName: 'Erik Johansson'
        },
        eligibleForUpgrade: true,
        upgradeRecommendation: {
          toTier: 3,
          confidence: 0.92,
          reasons: [
            'Exceptionell performance-poäng (91/100)',
            'Hög månadsomsättning (180,000 SEK)',
            'Överlägsen compliance',
            'Stark tillväxttrend senaste 6 månaderna'
          ]
        }
      },
      {
        id: 'bus_003_malmo_grocery',
        name: 'ICA Supermarket Malmö Centrum',
        organizationNumber: '556456-7890',
        currentTier: 3,
        approvedAt: '2024-06-01T08:00:00Z',
        monthlyRevenue: 850000,
        transactionVolume: 4200,
        customerCount: 1680,
        performanceScore: 96,
        complianceScore: 98,
        lastTierChange: {
          date: '2024-08-01T10:30:00Z',
          previousTier: 2,
          newTier: 3,
          reason: 'Enterprise-uppgradering: höga volymer, exceptionell compliance och branschledarskap',
          adminName: 'Anna Svensson'
        },
        eligibleForUpgrade: false // Already at highest tier
      },
      {
        id: 'bus_004_stockholm_boutique',
        name: 'Boutique Nordiska Stockholm',
        organizationNumber: '556321-6547',
        currentTier: 1,
        approvedAt: '2024-08-20T13:45:00Z',
        monthlyRevenue: 28000,
        transactionVolume: 85,
        customerCount: 35,
        performanceScore: 68,
        complianceScore: 71,
        eligibleForUpgrade: false // Performance too low for upgrade
      },
      {
        id: 'bus_005_uppsala_tech',
        name: 'Tech Hub Uppsala',
        organizationNumber: '556987-1234',
        currentTier: 2,
        approvedAt: '2024-07-15T15:20:00Z',
        monthlyRevenue: 120000,
        transactionVolume: 680,
        customerCount: 290,
        performanceScore: 77,
        complianceScore: 83,
        lastTierChange: {
          date: '2024-08-12T09:15:00Z',
          previousTier: 1,
          newTier: 2,
          reason: 'Uppgradering efter 30 dagars utmärkt prestanda',
          adminName: 'Erik Johansson'
        },
        eligibleForUpgrade: false // Recently upgraded, under observation
      }
    ];

    const stats = {
      totalBusinesses: mockBusinesses.length,
      tier1: mockBusinesses.filter(b => b.currentTier === 1).length,
      tier2: mockBusinesses.filter(b => b.currentTier === 2).length,
      tier3: mockBusinesses.filter(b => b.currentTier === 3).length,
      eligibleForUpgrade: mockBusinesses.filter(b => b.eligibleForUpgrade).length
    };

    res.json({
      success: true,
      data: {
        businesses: mockBusinesses,
        stats
      },
      message: 'Tier-data laddad'
    });

  } catch (error) {
    console.error('Load tier data error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Kunde inte ladda tier-data'
    });
  }
});

/**
 * @openapi
 * /api/admin/business/{id}/change-tier:
 *   post:
 *     summary: Change business tier level
 *     tags: [Admin Business]
 *     security:
 *       - bearerAuth: []
 */
adminRoutes.post('/business/:id/change-tier', requirePermission('tier:manage'), async (req, res) => {
  const { id } = req.params;
  const { 
    newTier,
    previousTier,
    reason,
    effectiveDate,
    notifyBusiness,
    changeType
  } = req.body;
  const adminReq = req as AdminRequest;

  try {
    if (!newTier || !previousTier || !reason) {
      return res.status(400).json({
        code: 'MISSING_FIELDS',
        message: 'Ny tier, tidigare tier och anledning krävs'
      });
    }

    if (newTier < 1 || newTier > 3 || previousTier < 1 || previousTier > 3) {
      return res.status(400).json({
        code: 'INVALID_TIER',
        message: 'Tier måste vara mellan 1-3'
      });
    }

    // Tier configuration for validation
    const tierConfigs = {
      1: { name: 'Starter', commission: 20, dailyLimit: '200 SEK', minScore: 60 },
      2: { name: 'Professional', commission: 18, dailyLimit: '1000 SEK', minScore: 75 },
      3: { name: 'Enterprise', commission: 15, dailyLimit: '5000 SEK', minScore: 90 }
    };

    const newTierConfig = tierConfigs[newTier];
    const previousTierConfig = tierConfigs[previousTier];

    // Create comprehensive tier change record
    const tierChangeRecord = {
      businessId: id,
      adminId: adminReq.admin.id,
      adminEmail: adminReq.admin.email,
      adminRole: adminReq.admin.role,
      changedAt: new Date().toISOString(),
      effectiveDate: effectiveDate || new Date().toISOString(),
      changeType, // 'upgrade' | 'downgrade' | 'no-change'
      previousTier,
      newTier,
      reason,
      tierConfigs: {
        previous: previousTierConfig,
        new: newTierConfig
      },
      commissionChange: {
        from: previousTierConfig.commission,
        to: newTierConfig.commission,
        difference: newTierConfig.commission - previousTierConfig.commission
      },
      limitChange: {
        from: previousTierConfig.dailyLimit,
        to: newTierConfig.dailyLimit
      },
      notifyBusiness,
      auditTrail: {
        action: 'tier_changed',
        adminRole: adminReq.admin.role,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString(),
        details: {
          changeType,
          tierIncrease: newTier - previousTier,
          commissionImprovement: newTier > previousTier ? 
            `${previousTierConfig.commission}% → ${newTierConfig.commission}%` : null,
          limitIncrease: newTier > previousTier ? 
            `${previousTierConfig.dailyLimit} → ${newTierConfig.dailyLimit}` : null
        }
      }
    };

    // Swedish business notification based on change type
    let businessNotification = null;
    if (notifyBusiness && newTier !== previousTier) {
      const isUpgrade = newTier > previousTier;
      businessNotification = {
        businessId: id,
        type: isUpgrade ? 'tier_upgraded' : 'tier_downgraded',
        title: isUpgrade ? 'Tier-uppgradering!' : 'Tier-justering',
        message: isUpgrade ? 
          `Grattis! Ditt företag har uppgraderats till Tier ${newTier} (${newTierConfig.name}). Din nya provision är ${newTierConfig.commission}% och daglig gräns är ${newTierConfig.dailyLimit}.` :
          `Ditt företag har justerats till Tier ${newTier} (${newTierConfig.name}). Din nya provision är ${newTierConfig.commission}% och daglig gräns är ${newTierConfig.dailyLimit}. Anledning: ${reason}`,
        newTier,
        newLimits: {
          daily: newTierConfig.dailyLimit,
          commission: `${newTierConfig.commission}%`
        },
        effectiveDate,
        reason,
        createdAt: new Date().toISOString()
      };
    }

    console.log(`Tier change processed for business ${id}: ${previousTier} → ${newTier} by ${adminReq.admin.email}`);

    res.json({
      success: true,
      data: {
        businessId: id,
        action: 'tier_changed',
        changeType,
        previousTier,
        newTier,
        effectiveDate,
        tierConfig: newTierConfig,
        commissionChange: tierChangeRecord.commissionChange,
        notification: businessNotification,
        processedBy: {
          adminId: adminReq.admin.id,
          adminEmail: adminReq.admin.email,
          timestamp: new Date().toISOString()
        }
      },
      message: `Tier ${changeType === 'upgrade' ? 'uppgraderad' : changeType === 'downgrade' ? 'nedgraderad' : 'uppdaterad'} framgångsrikt`
    });

  } catch (error) {
    console.error('Tier change error:', error);
    res.status(500).json({
      code: 'TIER_CHANGE_ERROR',
      message: 'Kunde inte genomföra tier-ändring'
    });
  }
});

// Business limit management endpoints
/**
 * @openapi
 * /api/admin/business/limits:
 *   get:
 *     summary: Get business limits and usage data
 *     tags: [Admin Business]
 *     security:
 *       - bearerAuth: []
 */
adminRoutes.get('/business/limits', requirePermission('limits:read'), async (req, res) => {
  try {
    // Mock business limits data - in production, fetch from database and calculate real usage
    const mockBusinessLimits = [
      {
        businessId: 'bus_001_stockholm_cafe',
        businessName: 'Café Lagom Stockholm',
        organizationNumber: '556123-4567',
        currentTier: 1,
        limits: {
          daily_payout: {
            limit: 200,
            used: 145,
            remaining: 55,
            percentage: 72.5
          },
          monthly_transactions: {
            limit: 500,
            used: 287,
            remaining: 213,
            percentage: 57.4
          },
          customer_volume: {
            limit: 150,
            used: 92,
            remaining: 58,
            percentage: 61.3
          }
        },
        overrides: [
          {
            id: 'override_001',
            businessId: 'bus_001_stockholm_cafe',
            type: 'daily_payout',
            originalLimit: 200,
            newLimit: 300,
            reason: 'Tillfällig ökning för Black Friday-kampanj',
            requestedBy: 'business_owner@cafelagom.se',
            approvedBy: 'Anna Svensson',
            createdAt: '2024-08-23T09:15:00Z',
            expiresAt: '2024-08-30T23:59:00Z',
            status: 'active',
            isEmergency: false,
            adminNotes: 'Godkänd för att hantera ökad efterfrågan under kampanjperiod'
          }
        ],
        violations: [
          {
            id: 'violation_001',
            businessId: 'bus_001_stockholm_cafe',
            type: 'daily_payout',
            limit: 200,
            attemptedAmount: 235,
            exceedance: 35,
            timestamp: '2024-08-22T16:30:00Z',
            severity: 'minor',
            resolution: 'Löst genom att implementera override för kampanjperiod',
            resolvedAt: '2024-08-23T09:20:00Z'
          }
        ],
        status: 'approaching_limit',
        lastActivity: '2024-08-25T14:30:00Z'
      },
      {
        businessId: 'bus_002_goteborg_restaurant',
        businessName: 'Restaurang Västkust Göteborg',
        organizationNumber: '556789-0123',
        currentTier: 2,
        limits: {
          daily_payout: {
            limit: 1000,
            used: 1050,
            remaining: -50,
            percentage: 105.0
          },
          monthly_transactions: {
            limit: 2000,
            used: 1456,
            remaining: 544,
            percentage: 72.8
          },
          customer_volume: {
            limit: 600,
            used: 523,
            remaining: 77,
            percentage: 87.2
          }
        },
        overrides: [],
        violations: [
          {
            id: 'violation_002',
            businessId: 'bus_002_goteborg_restaurant',
            type: 'daily_payout',
            limit: 1000,
            attemptedAmount: 1050,
            exceedance: 50,
            timestamp: '2024-08-25T12:45:00Z',
            severity: 'major'
          },
          {
            id: 'violation_003',
            businessId: 'bus_002_goteborg_restaurant',
            type: 'daily_payout',
            limit: 1000,
            attemptedAmount: 1120,
            exceedance: 120,
            timestamp: '2024-08-24T18:20:00Z',
            severity: 'major'
          }
        ],
        status: 'limit_exceeded',
        lastActivity: '2024-08-25T12:45:00Z'
      },
      {
        businessId: 'bus_003_malmo_grocery',
        businessName: 'ICA Supermarket Malmö Centrum',
        organizationNumber: '556456-7890',
        currentTier: 3,
        limits: {
          daily_payout: {
            limit: 5000,
            used: 3250,
            remaining: 1750,
            percentage: 65.0
          },
          monthly_transactions: {
            limit: 10000,
            used: 6800,
            remaining: 3200,
            percentage: 68.0
          },
          customer_volume: {
            limit: 3000,
            used: 2150,
            remaining: 850,
            percentage: 71.7
          }
        },
        overrides: [
          {
            id: 'override_002',
            businessId: 'bus_003_malmo_grocery',
            type: 'customer_volume',
            originalLimit: 3000,
            newLimit: 4000,
            reason: 'Permanent ökning för att stödja tillväxtstrategi',
            requestedBy: 'manager@icamalmo.se',
            approvedBy: 'Erik Johansson',
            createdAt: '2024-08-01T10:00:00Z',
            expiresAt: null,
            status: 'active',
            isEmergency: false,
            adminNotes: 'Permanent ökning godkänd baserat på stark prestanda'
          }
        ],
        violations: [],
        status: 'normal',
        lastActivity: '2024-08-25T15:20:00Z'
      },
      {
        businessId: 'bus_004_stockholm_boutique',
        businessName: 'Boutique Nordiska Stockholm',
        organizationNumber: '556321-6547',
        currentTier: 1,
        limits: {
          daily_payout: {
            limit: 200,
            used: 185,
            remaining: 15,
            percentage: 92.5
          },
          monthly_transactions: {
            limit: 500,
            used: 445,
            remaining: 55,
            percentage: 89.0
          },
          customer_volume: {
            limit: 150,
            used: 138,
            remaining: 12,
            percentage: 92.0
          }
        },
        overrides: [],
        violations: [],
        status: 'approaching_limit',
        lastActivity: '2024-08-25T13:15:00Z'
      }
    ];

    res.json({
      success: true,
      data: {
        businessLimits: mockBusinessLimits,
        summary: {
          totalBusinesses: mockBusinessLimits.length,
          normalStatus: mockBusinessLimits.filter(b => b.status === 'normal').length,
          approachingLimit: mockBusinessLimits.filter(b => b.status === 'approaching_limit').length,
          limitExceeded: mockBusinessLimits.filter(b => b.status === 'limit_exceeded').length,
          suspended: mockBusinessLimits.filter(b => b.status === 'suspended').length,
          activeOverrides: mockBusinessLimits.reduce((sum, b) => 
            sum + b.overrides.filter(o => o.status === 'active').length, 0),
          totalViolations: mockBusinessLimits.reduce((sum, b) => sum + b.violations.length, 0)
        }
      },
      message: 'Gränsdata laddad'
    });

  } catch (error) {
    console.error('Load business limits error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Kunde inte ladda gränsdata'
    });
  }
});

/**
 * @openapi
 * /api/admin/business/{id}/override-limits:
 *   post:
 *     summary: Create limit override for business
 *     tags: [Admin Business]
 *     security:
 *       - bearerAuth: []
 */
adminRoutes.post('/business/:id/override-limits', requirePermission('limits:override'), async (req, res) => {
  const { id } = req.params;
  const { 
    type,
    newLimit,
    reason,
    duration,
    expirationDate,
    isEmergency = false
  } = req.body;
  const adminReq = req as AdminRequest;

  try {
    if (!type || !newLimit || !reason) {
      return res.status(400).json({
        code: 'MISSING_FIELDS',
        message: 'Typ, ny gräns och anledning krävs'
      });
    }

    if (!['daily_payout', 'monthly_transactions', 'customer_volume'].includes(type)) {
      return res.status(400).json({
        code: 'INVALID_LIMIT_TYPE',
        message: 'Ogiltig gränstyp'
      });
    }

    if (newLimit <= 0) {
      return res.status(400).json({
        code: 'INVALID_LIMIT_VALUE',
        message: 'Gränsvärde måste vara positivt'
      });
    }

    const limitTypeNames = {
      daily_payout: 'Daglig utbetalning',
      monthly_transactions: 'Månatliga transaktioner', 
      customer_volume: 'Kundvolym'
    };

    const limitUnits = {
      daily_payout: 'SEK',
      monthly_transactions: 'transaktioner',
      customer_volume: 'kunder'
    };

    // Generate override ID
    const overrideId = `override_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Mock current limit for validation
    const currentLimits = {
      daily_payout: 200, // This would come from database
      monthly_transactions: 500,
      customer_volume: 150
    };

    // Create comprehensive override record
    const overrideRecord = {
      id: overrideId,
      businessId: id,
      type,
      originalLimit: currentLimits[type],
      newLimit,
      reason,
      duration,
      expirationDate: duration === 'temporary' ? expirationDate : null,
      isEmergency,
      requestedBy: 'admin_request', // Could be business request in the future
      approvedBy: adminReq.admin.email,
      createdAt: new Date().toISOString(),
      status: 'active',
      adminNotes: `Override skapad av admin för ${isEmergency ? 'akut ' : ''}justering av ${limitTypeNames[type].toLowerCase()}`,
      auditTrail: {
        action: 'limit_override_created',
        adminId: adminReq.admin.id,
        adminEmail: adminReq.admin.email,
        adminRole: adminReq.admin.role,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString(),
        details: {
          limitType: type,
          oldLimit: currentLimits[type],
          newLimit,
          increaseAmount: newLimit - currentLimits[type],
          percentageIncrease: ((newLimit - currentLimits[type]) / currentLimits[type] * 100).toFixed(1),
          duration,
          isEmergency,
          reason
        }
      }
    };

    // Log the override creation
    console.log(`Limit override created for business ${id}: ${type} ${currentLimits[type]} → ${newLimit} by ${adminReq.admin.email}${isEmergency ? ' (EMERGENCY)' : ''}`);
    
    res.json({
      success: true,
      data: {
        overrideId,
        businessId: id,
        action: 'limit_override_created',
        limitType: type,
        limitName: limitTypeNames[type],
        originalLimit: currentLimits[type],
        newLimit,
        unit: limitUnits[type],
        duration,
        expirationDate: overrideRecord.expirationDate,
        isEmergency,
        increaseAmount: newLimit - currentLimits[type],
        percentageIncrease: ((newLimit - currentLimits[type]) / currentLimits[type] * 100).toFixed(1) + '%',
        processedBy: {
          adminId: adminReq.admin.id,
          adminEmail: adminReq.admin.email,
          timestamp: new Date().toISOString()
        }
      },
      message: `Gräns-override ${isEmergency ? 'akut ' : ''}skapad framgångsrikt`
    });

  } catch (error) {
    console.error('Limit override error:', error);
    res.status(500).json({
      code: 'OVERRIDE_ERROR',
      message: 'Kunde inte skapa gräns-override'
    });
  }
});

/**
 * @openapi
 * /api/admin/business/{id}/revoke-override:
 *   post:
 *     summary: Revoke active limit override
 *     tags: [Admin Business]
 *     security:
 *       - bearerAuth: []
 */
adminRoutes.post('/business/:id/revoke-override', requirePermission('limits:override'), async (req, res) => {
  const { id } = req.params;
  const { overrideId, reason } = req.body;
  const adminReq = req as AdminRequest;

  try {
    if (!overrideId || !reason) {
      return res.status(400).json({
        code: 'MISSING_FIELDS',
        message: 'Override-ID och anledning krävs'
      });
    }

    // Create revocation record
    const revocationRecord = {
      overrideId,
      businessId: id,
      revokedBy: adminReq.admin.email,
      revokedAt: new Date().toISOString(),
      reason,
      auditTrail: {
        action: 'limit_override_revoked',
        adminId: adminReq.admin.id,
        adminEmail: adminReq.admin.email,
        adminRole: adminReq.admin.role,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString(),
        details: {
          overrideId,
          reason
        }
      }
    };

    console.log(`Limit override ${overrideId} revoked for business ${id} by ${adminReq.admin.email}`);
    
    res.json({
      success: true,
      data: {
        overrideId,
        businessId: id,
        action: 'limit_override_revoked',
        revokedBy: adminReq.admin.email,
        revokedAt: revocationRecord.revokedAt,
        reason
      },
      message: 'Gräns-override återkallad framgångsrikt'
    });

  } catch (error) {
    console.error('Revoke override error:', error);
    res.status(500).json({
      code: 'REVOKE_ERROR',
      message: 'Kunde inte återkalla gräns-override'
    });
  }
});

// AI-powered performance-based recommendations endpoints
/**
 * @openapi
 * /api/admin/business/recommendations:
 *   get:
 *     summary: Get AI-powered tier recommendations based on business performance
 *     tags: [Admin Business]
 *     security:
 *       - bearerAuth: []
 */
adminRoutes.get('/business/recommendations', requirePermission('analytics:read'), async (req, res) => {
  try {
    // Mock AI-powered recommendations - in production, this would use ML models and real data
    const mockRecommendations = [
      {
        businessId: 'bus_001_stockholm_cafe',
        businessName: 'Café Lagom Stockholm',
        organizationNumber: '556123-4567',
        currentTier: 1,
        metrics: {
          performanceScore: 87,
          complianceScore: 92,
          customerSatisfaction: 8.4,
          monthlyRevenue: 125000,
          transactionVolume: 1250,
          customerRetention: 0.78,
          averageOrderValue: 89.50,
          growthRate: 0.23,
          stabilityIndex: 8.1
        },
        recommendation: {
          action: 'upgrade',
          recommendedTier: 2,
          confidence: 0.89,
          reasoning: [
            'Exceptionell performance-poäng (87/100) överstiger Tier 2 krav (75)',
            'Stark tillväxttakt på 23% under senaste kvartalet',
            'Hög kundnöjdhet (8.4/10) indikerar kvalitativ service',
            'Månadsomsättning (125k SEK) är väl över Tier 2 minimum (50k SEK)',
            'Utmärkt compliance-poäng (92/100) säkerställer regelefterlevnad'
          ],
          expectedBenefits: [
            'Öka daglig utbetalningsgräns från 200 till 1000 SEK',
            'Reducera provision från 20% till 18%',
            'Tillgång till avancerade analytics och rapporter',
            'Prioriterat kundsupport och account management',
            'Ökad synlighet i plattformens marknadsföring'
          ],
          potentialRisks: [
            'Högre förväntningar på prestanda och leverans',
            'Ökad granskning av regelefterlevnad',
            'Potentiell överbelastning vid snabb tillväxt'
          ],
          timeframe: 'immediate',
          priority: 'high',
          aiInsights: {
            model: 'GPT-4 Performance Analyzer',
            version: '2.1',
            processedAt: '2024-08-25T15:30:00Z',
            dataPoints: 1247,
            trends: ['Konsekvent tillväxt', 'Hög kundlojalitet', 'Stabil verksamhet']
          }
        },
        riskFactors: [
          {
            type: 'operational',
            severity: 'low',
            description: 'Begränsad personalstyrka kan påverka service under högtrafik',
            impact: 'Potentiell minskning i kundnöjdhet vid överbelastning',
            mitigation: 'Överväg personalökning eller förbättrade processer'
          }
        ],
        historicalData: [
          { date: '2024-08-01', tier: 1, revenue: 95000, transactions: 950, satisfaction: 7.8 },
          { date: '2024-07-01', tier: 1, revenue: 89000, transactions: 890, satisfaction: 8.0 },
          { date: '2024-06-01', tier: 1, revenue: 78000, transactions: 780, satisfaction: 7.9 }
        ],
        lastUpdated: '2024-08-25T15:30:00Z'
      },
      {
        businessId: 'bus_002_goteborg_restaurant',
        businessName: 'Restaurang Västkust Göteborg',
        organizationNumber: '556789-0123',
        currentTier: 2,
        metrics: {
          performanceScore: 94,
          complianceScore: 96,
          customerSatisfaction: 9.1,
          monthlyRevenue: 340000,
          transactionVolume: 2800,
          customerRetention: 0.85,
          averageOrderValue: 165.20,
          growthRate: 0.31,
          stabilityIndex: 9.2
        },
        recommendation: {
          action: 'upgrade',
          recommendedTier: 3,
          confidence: 0.95,
          reasoning: [
            'Exceptionell performance över alla mått - 94/100 poäng',
            'Månadsomsättning (340k SEK) överstiger Enterprise-kravet (200k SEK)',
            'Outstanding kundnöjdhet (9.1/10) indikerar branschledarskap',
            'Imponerande tillväxttakt på 31% visar stark marknadsposition',
            'Perfekt compliance-poäng (96/100) demonstrerar professionalism',
            'Hög stabilitet (9.2/10) säkerställer långsiktig framgång'
          ],
          expectedBenefits: [
            'Maximera daglig gräns till 5000 SEK för större transaktioner',
            'Bästa provision på 15% - betydande kostnadsbesparing',
            'Dedikerad account manager för personlig service',
            'Enterprise-nivå analytics och realtidsrapporter',
            'Prioritet för nya funktioner och beta-testning',
            'Premiumstatus i plattformens nätverk'
          ],
          potentialRisks: [
            'Högsta kvalitetskrav och service-level agreements',
            'Intensifierad konkurrensanalys och benchmarking',
            'Ökade förväntningar på marknadsledarskap'
          ],
          timeframe: 'immediate',
          priority: 'critical',
          aiInsights: {
            model: 'GPT-4 Performance Analyzer',
            version: '2.1',
            processedAt: '2024-08-25T15:30:00Z',
            dataPoints: 2847,
            trends: ['Accelererande tillväxt', 'Premiumpositionering', 'Marknadsledarskap']
          }
        },
        riskFactors: [],
        historicalData: [
          { date: '2024-08-01', tier: 2, revenue: 340000, transactions: 2800, satisfaction: 9.1 },
          { date: '2024-07-01', tier: 2, revenue: 298000, transactions: 2450, satisfaction: 8.9 },
          { date: '2024-06-01', tier: 2, revenue: 267000, transactions: 2200, satisfaction: 8.7 }
        ],
        lastUpdated: '2024-08-25T15:30:00Z'
      },
      {
        businessId: 'bus_003_malmo_grocery',
        businessName: 'ICA Supermarket Malmö Centrum',
        organizationNumber: '556456-7890',
        currentTier: 3,
        metrics: {
          performanceScore: 91,
          complianceScore: 94,
          customerSatisfaction: 8.7,
          monthlyRevenue: 850000,
          transactionVolume: 6800,
          customerRetention: 0.82,
          averageOrderValue: 187.30,
          growthRate: 0.12,
          stabilityIndex: 9.5
        },
        recommendation: {
          action: 'maintain',
          recommendedTier: 3,
          confidence: 0.88,
          reasoning: [
            'Presterar utmärkt på Enterprise-nivå med 91/100 poäng',
            'Stabil och etablerad verksamhet med hög kundlojalitet',
            'Måttlig men hållbar tillväxttakt på 12%',
            'Excellent stabilitet (9.5/10) visar mogen verksamhet',
            'Fortsatt stark position i konkurrensutsatt marknad'
          ],
          expectedBenefits: [
            'Behåll alla Enterprise-förmåner och premiumstatus',
            'Fortsatt 15% provision - bästa tillgängliga rate',
            'Bibehåll 5000 SEK daglig gräns för stora transaktioner',
            'Fortsatt dedikerad account management',
            'Stabil grund för framtida expansion'
          ],
          potentialRisks: [
            'Marknadsmättnad kan begränsa tillväxtmöjligheter',
            'Ökad konkurrens från nya aktörer',
            'Behov av innovation för att behålla marknadsposition'
          ],
          timeframe: 'long_term',
          priority: 'medium',
          aiInsights: {
            model: 'GPT-4 Performance Analyzer',
            version: '2.1',
            processedAt: '2024-08-25T15:30:00Z',
            dataPoints: 3421,
            trends: ['Stabil prestanda', 'Mogen marknad', 'Hållbar tillväxt']
          }
        },
        riskFactors: [
          {
            type: 'market',
            severity: 'low',
            description: 'Marknadsmättnad inom dagligvaruhandeln',
            impact: 'Potentiellt begränsad tillväxtpotential',
            mitigation: 'Fokusera på kundupplevelse och service-differentiering'
          }
        ],
        historicalData: [
          { date: '2024-08-01', tier: 3, revenue: 850000, transactions: 6800, satisfaction: 8.7 },
          { date: '2024-07-01', tier: 3, revenue: 835000, transactions: 6650, satisfaction: 8.6 },
          { date: '2024-06-01', tier: 3, revenue: 810000, transactions: 6400, satisfaction: 8.5 }
        ],
        lastUpdated: '2024-08-25T15:30:00Z'
      },
      {
        businessId: 'bus_004_stockholm_boutique',
        businessName: 'Boutique Nordiska Stockholm',
        organizationNumber: '556321-6547',
        currentTier: 1,
        metrics: {
          performanceScore: 64,
          complianceScore: 71,
          customerSatisfaction: 7.2,
          monthlyRevenue: 28000,
          transactionVolume: 180,
          customerRetention: 0.65,
          averageOrderValue: 245.80,
          growthRate: -0.08,
          stabilityIndex: 5.8
        },
        recommendation: {
          action: 'review',
          recommendedTier: 1,
          confidence: 0.72,
          reasoning: [
            'Performance-poäng (64/100) är marginellt över minimum (60)',
            'Nedgående trend med -8% tillväxt väcker oro',
            'Låg transaktionsvolym och kundretention',
            'Compliance-poäng (71/100) behöver förbättring',
            'Instabil verksamhet med varierande resultat'
          ],
          expectedBenefits: [
            'Behåll Starter-förmåner under förbättringsperiod',
            'Möjlighet till mentorskap och support',
            'Tid att implementera förbättringsåtgärder',
            'Tillgång till grundläggande analytics för optimering'
          ],
          potentialRisks: [
            'Fortsatt nedgående trend kan leda till suspension',
            'Låg kundnöjdhet kan påverka plattformens rykte',
            'Finansiell instabilitet kan påverka betalningsförmåga'
          ],
          timeframe: 'short_term',
          priority: 'high',
          aiInsights: {
            model: 'GPT-4 Performance Analyzer',
            version: '2.1',
            processedAt: '2024-08-25T15:30:00Z',
            dataPoints: 847,
            trends: ['Nedåtgående trend', 'Instabilitet', 'Behov av intervention']
          }
        },
        riskFactors: [
          {
            type: 'financial',
            severity: 'high',
            description: 'Negativ tillväxttakt och låga intäkter',
            impact: 'Risk för konkurs eller verksamhetsnedläggning',
            mitigation: 'Implementera affärsplan för återhämtning, överväg support-program'
          },
          {
            type: 'operational',
            severity: 'medium',
            description: 'Låg kundretention och transaktionsvolym',
            impact: 'Fortsatt försämring av verksamhetsmått',
            mitigation: 'Fokusera på kundupplevelse och marknadsföring'
          }
        ],
        historicalData: [
          { date: '2024-08-01', tier: 1, revenue: 28000, transactions: 180, satisfaction: 7.2 },
          { date: '2024-07-01', tier: 1, revenue: 31000, transactions: 195, satisfaction: 7.0 },
          { date: '2024-06-01', tier: 1, revenue: 34000, transactions: 210, satisfaction: 6.8 }
        ],
        lastUpdated: '2024-08-25T15:30:00Z'
      }
    ];

    // Calculate summary statistics
    const summary = {
      totalRecommendations: mockRecommendations.length,
      upgradeRecommendations: mockRecommendations.filter(r => r.recommendation.action === 'upgrade').length,
      maintainRecommendations: mockRecommendations.filter(r => r.recommendation.action === 'maintain').length,
      downgradeRecommendations: mockRecommendations.filter(r => r.recommendation.action === 'downgrade').length,
      reviewRecommendations: mockRecommendations.filter(r => r.recommendation.action === 'review').length,
      averageConfidence: mockRecommendations.reduce((sum, r) => sum + r.recommendation.confidence, 0) / mockRecommendations.length,
      criticalPriority: mockRecommendations.filter(r => r.recommendation.priority === 'critical').length,
      highPriority: mockRecommendations.filter(r => r.recommendation.priority === 'high').length
    };

    res.json({
      success: true,
      data: {
        recommendations: mockRecommendations,
        summary,
        aiModel: {
          name: 'GPT-4 Performance Analyzer',
          version: '2.1',
          lastTrainingData: '2024-08-01',
          confidence: 'High',
          dataPoints: mockRecommendations.reduce((sum, r) => sum + r.recommendation.aiInsights.dataPoints, 0)
        },
        generatedAt: new Date().toISOString()
      },
      message: 'AI-rekommendationer laddade framgångsrikt'
    });

  } catch (error) {
    console.error('Load AI recommendations error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Kunde inte ladda AI-rekommendationer'
    });
  }
});

/**
 * @openapi
 * /api/admin/business/{id}/apply-recommendation:
 *   post:
 *     summary: Apply AI-generated tier recommendation
 *     tags: [Admin Business]
 *     security:
 *       - bearerAuth: []
 */
adminRoutes.post('/business/:id/apply-recommendation', requirePermission('tier:manage'), async (req, res) => {
  const { id } = req.params;
  const { 
    recommendationAction,
    recommendedTier,
    confidence,
    reasoning
  } = req.body;
  const adminReq = req as AdminRequest;

  try {
    if (!recommendationAction || !recommendedTier || !confidence || !reasoning) {
      return res.status(400).json({
        code: 'MISSING_FIELDS',
        message: 'Rekommendationsåtgärd, tier, säkerhet och resonemang krävs'
      });
    }

    // Validate recommendation data
    if (!['upgrade', 'maintain', 'downgrade', 'review'].includes(recommendationAction)) {
      return res.status(400).json({
        code: 'INVALID_ACTION',
        message: 'Ogiltig rekommendationsåtgärd'
      });
    }

    if (recommendedTier < 1 || recommendedTier > 3) {
      return res.status(400).json({
        code: 'INVALID_TIER',
        message: 'Tier måste vara mellan 1-3'
      });
    }

    // Generate recommendation application ID
    const recommendationId = `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create comprehensive recommendation application record
    const recommendationRecord = {
      id: recommendationId,
      businessId: id,
      appliedBy: adminReq.admin.email,
      appliedAt: new Date().toISOString(),
      aiRecommendation: {
        action: recommendationAction,
        recommendedTier,
        confidence,
        reasoning: reasoning.slice(0, 3) // Limit to first 3 reasons for storage
      },
      result: {
        action: recommendationAction === 'review' ? 'flagged_for_review' : 
                recommendationAction === 'maintain' ? 'tier_maintained' : 
                `tier_${recommendationAction}d`,
        newTier: recommendedTier,
        previousTier: recommendationAction === 'upgrade' ? recommendedTier - 1 : 
                     recommendationAction === 'downgrade' ? recommendedTier + 1 : recommendedTier,
        effectiveDate: new Date().toISOString()
      },
      auditTrail: {
        action: 'ai_recommendation_applied',
        adminId: adminReq.admin.id,
        adminEmail: adminReq.admin.email,
        adminRole: adminReq.admin.role,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString(),
        aiModel: 'GPT-4 Performance Analyzer v2.1',
        details: {
          recommendationAction,
          aiConfidence: confidence,
          businessMetrics: 'analyzed',
          automatedDecision: confidence > 0.85,
          humanOverride: confidence <= 0.85
        }
      }
    };

    // Log the recommendation application
    console.log(`AI recommendation applied for business ${id}: ${recommendationAction} to Tier ${recommendedTier} (confidence: ${Math.round(confidence * 100)}%) by ${adminReq.admin.email}`);

    // Determine success message based on action
    let actionMessage = '';
    switch (recommendationAction) {
      case 'upgrade':
        actionMessage = `Företaget har uppgraderats till Tier ${recommendedTier} baserat på AI-analys`;
        break;
      case 'downgrade':
        actionMessage = `Företaget har nedgraderats till Tier ${recommendedTier} baserat på prestandaanalys`;
        break;
      case 'maintain':
        actionMessage = `Företaget bibehåller Tier ${recommendedTier} - optimal nivå bekräftad`;
        break;
      case 'review':
        actionMessage = `Företaget har flaggats för manuell granskning baserat på riskanalys`;
        break;
    }

    res.json({
      success: true,
      data: {
        recommendationId,
        businessId: id,
        action: 'ai_recommendation_applied',
        recommendationAction,
        newTier: recommendedTier,
        aiConfidence: Math.round(confidence * 100),
        appliedBy: adminReq.admin.email,
        appliedAt: recommendationRecord.appliedAt,
        aiModel: 'GPT-4 Performance Analyzer v2.1',
        result: recommendationRecord.result
      },
      message: actionMessage
    });

  } catch (error) {
    console.error('Apply AI recommendation error:', error);
    res.status(500).json({
      code: 'RECOMMENDATION_ERROR',
      message: 'Kunde inte tillämpa AI-rekommendation'
    });
  }
});

/**
 * @openapi
 * /api/admin/business/{id}/reject-recommendation:
 *   post:
 *     summary: Reject AI recommendation with human override
 *     tags: [Admin Business]
 *     security:
 *       - bearerAuth: []
 */
adminRoutes.post('/business/:id/reject-recommendation', requirePermission('tier:manage'), async (req, res) => {
  const { id } = req.params;
  const { reason, alternativeAction } = req.body;
  const adminReq = req as AdminRequest;

  try {
    if (!reason) {
      return res.status(400).json({
        code: 'MISSING_REASON',
        message: 'Anledning för att avvisa AI-rekommendation krävs'
      });
    }

    // Create rejection record for AI model learning
    const rejectionRecord = {
      businessId: id,
      rejectedBy: adminReq.admin.email,
      rejectedAt: new Date().toISOString(),
      reason,
      alternativeAction,
      aiModel: 'GPT-4 Performance Analyzer v2.1',
      auditTrail: {
        action: 'ai_recommendation_rejected',
        adminId: adminReq.admin.id,
        adminEmail: adminReq.admin.email,
        adminRole: adminReq.admin.role,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString(),
        details: {
          humanOverride: true,
          rejectionReason: reason,
          alternativeAction
        }
      }
    };

    console.log(`AI recommendation rejected for business ${id} by ${adminReq.admin.email}: ${reason}`);

    res.json({
      success: true,
      data: {
        businessId: id,
        action: 'ai_recommendation_rejected',
        rejectedBy: adminReq.admin.email,
        rejectedAt: rejectionRecord.rejectedAt,
        reason,
        alternativeAction
      },
      message: 'AI-rekommendation avvisad - human override registrerat för modellförbättring'
    });

  } catch (error) {
    console.error('Reject AI recommendation error:', error);
    res.status(500).json({
      code: 'REJECTION_ERROR',
      message: 'Kunde inte avvisa AI-rekommendation'
    });
  }
});

// Business audit history endpoint
/**
 * @openapi
 * /api/admin/business/{id}/audit-history:
 *   get:
 *     summary: Get audit history for a business application
 *     tags: [Admin Business]
 *     security:
 *       - bearerAuth: []
 */
adminRoutes.get('/business/:id/audit-history', requirePermission('business:read'), async (req, res) => {
  const { id } = req.params;
  const { limit = 50, offset = 0 } = req.query;
  
  try {
    // Mock audit history - in production, fetch from database
    const mockAuditHistory = [
      {
        id: 'audit_001',
        businessId: id,
        adminId: 'admin_123',
        adminName: 'Anna Svensson',
        adminRole: 'super_admin',
        action: 'validate',
        details: {
          validationResults: {
            complianceScore: 87,
            riskLevel: 'low',
            automaticApproval: true
          },
          previousStatus: 'pending_review',
          newStatus: 'pending_review'
        },
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0...'
      },
      {
        id: 'audit_002',
        businessId: id,
        adminId: 'admin_456',
        adminName: 'Erik Johansson',
        adminRole: 'admin',
        action: 'add_note',
        details: {
          reason: 'Organisationsnummer verifierat med Bolagsverket. Dokumentation komplett.',
          previousStatus: 'pending_review',
          newStatus: 'pending_review'
        },
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
        ipAddress: '192.168.1.101',
        userAgent: 'Mozilla/5.0...'
      },
      {
        id: 'audit_003',
        businessId: id,
        adminId: 'admin_123',
        adminName: 'Anna Svensson',
        adminRole: 'super_admin',
        action: 'assign',
        details: {
          reason: 'Tilldelad för detaljerad granskning av ekonomiska handlingar',
          previousStatus: 'pending_review',
          newStatus: 'pending_review'
        },
        timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0...'
      }
    ];
    
    // Apply pagination
    const startIndex = parseInt(offset as string);
    const limitNum = parseInt(limit as string);
    const paginatedHistory = mockAuditHistory.slice(startIndex, startIndex + limitNum);
    
    res.json({
      success: true,
      data: {
        auditLogs: paginatedHistory,
        pagination: {
          total: mockAuditHistory.length,
          offset: startIndex,
          limit: limitNum,
          hasMore: startIndex + limitNum < mockAuditHistory.length
        }
      },
      message: 'Granskningshistorik laddad' // Swedish: Audit history loaded
    });
    
  } catch (error) {
    console.error('Audit history error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Kunde inte ladda granskningshistorik' // Swedish: Failed to load audit history
    });
  }
});

// WebSocket connection endpoint info
/**
 * @openapi
 * /api/admin/websocket/info:
 *   get:
 *     summary: Get WebSocket connection information for admin dashboard
 *     tags: [Admin Monitoring]
 *     security:
 *       - bearerAuth: []
 */
adminRoutes.get('/websocket/info', requirePermission('system:read'), (req, res) => {
  const wsUrl = process.env.NODE_ENV === 'production' 
    ? `wss://${req.get('host')}/admin-ws`
    : `ws://${req.get('host')}/admin-ws`;
    
  res.json({
    success: true,
    data: {
      url: wsUrl,
      protocol: 'websocket',
      authentication: 'jwt_token',
      reconnectInterval: 5000,
      pingInterval: 30000
    },
    message: 'WebSocket anslutningsinformation' // Swedish: WebSocket connection information
  });
});

// Analytics dashboard endpoint
/**
 * @openapi
 * /api/admin/analytics:
 *   get:
 *     summary: Get comprehensive analytics dashboard data for admin interface
 *     tags: [Admin Analytics]
 *     security:
 *       - bearerAuth: []
 */
adminRoutes.get('/analytics', requirePermission('analytics:read'), async (req, res) => {
  try {
    // Mock comprehensive analytics data - in production, aggregate from database with complex queries
    const mockAnalyticsData = {
      overview: {
        totalBusinesses: 156,
        totalRevenue: 2847500, // SEK
        averagePerformanceScore: 83.2,
        monthlyGrowthRate: 15.7, // %
        customerSatisfactionAvg: 8.4,
        lastUpdated: '2024-08-25T15:45:00Z'
      },
      tierDistribution: {
        current: {
          tier1: { count: 89, percentage: 57.1, revenue: 445200 },
          tier2: { count: 45, percentage: 28.8, revenue: 1156800 },
          tier3: { count: 22, percentage: 14.1, revenue: 1245500 }
        },
        monthlyChange: {
          tier1: { change: -8, direction: 'down' },
          tier2: { change: +12, direction: 'up' },
          tier3: { change: +3, direction: 'up' }
        },
        movements: [
          {
            businessId: 'bus_001_stockholm_cafe',
            businessName: 'Café Lagom Stockholm',
            fromTier: 1,
            toTier: 2,
            date: '2024-08-23T10:30:00Z',
            reason: 'Performance-baserad uppgradering',
            impactRevenue: +85000
          },
          {
            businessId: 'bus_002_goteborg_restaurant',
            businessName: 'Restaurang Västkust Göteborg',
            fromTier: 2,
            toTier: 3,
            date: '2024-08-20T14:15:00Z',
            reason: 'Enterprise-kvalificering uppnådd',
            impactRevenue: +125000
          }
        ]
      },
      performance: {
        topPerformers: [
          {
            businessId: 'bus_003_malmo_grocery',
            businessName: 'ICA Supermarket Malmö Centrum',
            performanceScore: 96,
            tier: 3,
            monthlyRevenue: 850000,
            customerSatisfaction: 8.7,
            growthRate: 12.3,
            badge: 'Market Leader'
          },
          {
            businessId: 'bus_002_goteborg_restaurant',
            businessName: 'Restaurang Västkust Göteborg',
            performanceScore: 94,
            tier: 3,
            monthlyRevenue: 340000,
            customerSatisfaction: 9.1,
            growthRate: 31.2,
            badge: 'Rising Star'
          },
          {
            businessId: 'bus_005_uppsala_tech',
            businessName: 'Tech Hub Uppsala',
            performanceScore: 89,
            tier: 2,
            monthlyRevenue: 120000,
            customerSatisfaction: 8.8,
            growthRate: 28.4,
            badge: 'High Growth'
          }
        ],
        underPerformers: [
          {
            businessId: 'bus_004_stockholm_boutique',
            businessName: 'Boutique Nordiska Stockholm',
            performanceScore: 64,
            tier: 1,
            monthlyRevenue: 28000,
            customerSatisfaction: 7.2,
            growthRate: -8.2,
            issues: ['Låg kundretention', 'Negativ tillväxt', 'Service-kvalitet']
          },
          {
            businessId: 'bus_012_linkoping_cafe',
            businessName: 'Kafé Östgöta Linköping',
            performanceScore: 67,
            tier: 1,
            monthlyRevenue: 31500,
            customerSatisfaction: 7.1,
            growthRate: -3.1,
            issues: ['Inconsistent service', 'Låg transaktionsvolym']
          }
        ]
      },
      revenue: {
        totalPlatformRevenue: 569500, // 20% commission
        monthlyGrowth: 18.9,
        tierBreakdown: {
          tier1: {
            totalRevenue: 445200,
            commission: 89040, // 20%
            businesses: 89,
            averagePerBusiness: 5002
          },
          tier2: {
            totalRevenue: 1156800,
            commission: 208224, // 18%
            businesses: 45,
            averagePerBusiness: 25706
          },
          tier3: {
            totalRevenue: 1245500,
            commission: 186825, // 15%
            businesses: 22,
            averagePerBusiness: 56614
          }
        },
        projections: {
          nextMonth: 675000,
          nextQuarter: 2150000,
          confidence: 87.3
        }
      },
      industryBenchmarks: {
        customerSatisfaction: {
          platform: 8.4,
          industry: 7.9,
          performance: 'above_average',
          percentile: 73
        },
        retentionRate: {
          platform: 82.3,
          industry: 78.1,
          performance: 'excellent',
          percentile: 81
        },
        avgTransactionValue: {
          platform: 142.30,
          industry: 135.80,
          performance: 'above_average',
          percentile: 69
        }
      },
      forecasting: {
        businessGrowth: {
          nextMonth: {
            newBusinesses: 12,
            projectedRevenue: 3180000,
            confidenceLevel: 0.84
          },
          nextQuarter: {
            newBusinesses: 38,
            projectedRevenue: 10250000,
            confidenceLevel: 0.76
          },
          riskFactors: [
            'Säsongsvariationer under höstmånaderna',
            'Ekonomisk osäkerhet kan påverka detaljhandeln',
            'Ökad konkurrens från andra feedback-plattformar'
          ]
        },
        tierProgression: {
          predictedUpgrades: [
            {
              businessId: 'bus_001_stockholm_cafe',
              currentTier: 1,
              predictedTier: 2,
              probability: 0.89,
              expectedDate: '2024-09-15',
              revenueImpact: +85000
            },
            {
              businessId: 'bus_007_vasteras_retail',
              currentTier: 2,
              predictedTier: 3,
              probability: 0.74,
              expectedDate: '2024-10-01',
              revenueImpact: +165000
            }
          ],
          predictedDowngrades: [
            {
              businessId: 'bus_004_stockholm_boutique',
              currentTier: 1,
              riskLevel: 'high',
              probability: 0.65,
              potentialSuspension: '2024-09-30',
              revenueImpact: -15000
            }
          ]
        }
      },
      trends: {
        weeklyActive: [
          { week: '2024-W30', businesses: 134, growth: 8.2 },
          { week: '2024-W31', businesses: 142, growth: 6.0 },
          { week: '2024-W32', businesses: 148, growth: 4.2 },
          { week: '2024-W33', businesses: 151, growth: 2.0 },
          { week: '2024-W34', businesses: 156, growth: 3.3 }
        ],
        regionalDistribution: {
          stockholm: { businesses: 45, percentage: 28.8, averagePerformance: 84.2 },
          goteborg: { businesses: 32, percentage: 20.5, averagePerformance: 86.1 },
          malmo: { businesses: 28, percentage: 17.9, averagePerformance: 81.7 },
          uppsala: { businesses: 18, percentage: 11.5, averagePerformance: 82.9 },
          others: { businesses: 33, percentage: 21.2, averagePerformance: 79.4 }
        },
        seasonality: {
          currentMonth: 'august',
          expectedPeak: 'december',
          peakMultiplier: 1.85,
          lowSeason: 'february',
          lowMultiplier: 0.72
        }
      },
      alerts: [
        {
          id: 'alert_001',
          type: 'performance',
          severity: 'medium',
          title: 'Boutique Nordiska Stockholm - Performance Drop',
          description: '20% minskning av performance-poäng under senaste månaden',
          businessId: 'bus_004_stockholm_boutique',
          createdAt: '2024-08-24T16:30:00Z',
          requiresAction: true
        },
        {
          id: 'alert_002',
          type: 'revenue',
          severity: 'low',
          title: 'Q3 Revenue Target - On Track',
          description: '87% av Q3-målet uppnått med 6 veckor kvar',
          createdAt: '2024-08-25T09:00:00Z',
          requiresAction: false
        },
        {
          id: 'alert_003',
          type: 'compliance',
          severity: 'high',
          title: 'GDPR Compliance Review Due',
          description: '12 företag behöver GDPR-compliance granskning innan september',
          createdAt: '2024-08-23T11:15:00Z',
          requiresAction: true
        }
      ],
      systemHealth: {
        apiResponseTime: 247, // ms
        uptimePercentage: 99.97,
        errorRate: 0.023, // %
        activeUsers: 1247,
        systemLoad: 42.3, // %
        lastHealthCheck: '2024-08-25T15:44:30Z'
      }
    };

    res.json({
      success: true,
      data: mockAnalyticsData,
      message: 'Analytisk översikt laddad framgångsrikt',
      meta: {
        generatedAt: new Date().toISOString(),
        dataFreshness: 'real-time',
        coverage: '100%',
        confidence: 'high'
      }
    });

  } catch (error) {
    console.error('Load analytics dashboard error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Kunde inte ladda analytisk översikt'
    });
  }
});

// Live session monitoring endpoints
/**
 * @openapi
 * /api/admin/live-sessions:
 *   get:
 *     summary: Get real-time voice feedback sessions for monitoring
 *     tags: [Admin Live Sessions]
 *     security:
 *       - bearerAuth: []
 */
adminRoutes.get('/live-sessions', requirePermission('system:read'), async (req, res) => {
  try {
    // Mock live session data - in production, fetch from real-time session management system
    const mockLiveSessions = [
      {
        sessionId: 'session_live_001_stockholm',
        sessionToken: 'live_tok_abc123def456',
        businessId: 'bus_001_stockholm_cafe',
        businessName: 'Café Lagom Stockholm',
        customerHash: 'cust_hash_xyz789',
        status: 'active',
        quality: 'good',
        startTime: new Date(Date.now() - 3 * 60 * 1000).toISOString(), // 3 minutes ago
        duration: 180, // 3 minutes in seconds
        currentPhase: 'feedback_collection',
        metrics: {
          audioQuality: 87,
          responseLatency: 1420,
          conversationFlow: 82,
          aiPerformance: 91,
          customerEngagement: 78
        },
        realTimeData: {
          currentTranscript: 'Jag tycker verkligen att kaffet här har blivit mycket bättre sedan ni bytte leverantör. Servicen är också utmärkt...',
          lastAIResponse: 'Tack för den positiva feedbacken om vår nya kaffeleverantör! Kan du berätta mer om vad som specifikt förbättrats med kaffet?',
          emotionalTone: 'positive',
          speechRate: 145, // words per minute
          volumeLevel: 72,
          backgroundNoise: 15
        },
        interventions: [],
        location: {
          city: 'Stockholm',
          region: 'Stockholm County',
          coordinates: { lat: 59.3293, lng: 18.0686 }
        },
        device: {
          type: 'mobile',
          browser: 'Safari',
          connection: 'wifi',
          connectionQuality: 89
        }
      },
      {
        sessionId: 'session_live_002_goteborg',
        sessionToken: 'live_tok_def456ghi789',
        businessId: 'bus_002_goteborg_restaurant',
        businessName: 'Restaurang Västkust Göteborg',
        customerHash: 'cust_hash_abc123',
        status: 'active',
        quality: 'excellent',
        startTime: new Date(Date.now() - 7 * 60 * 1000).toISOString(), // 7 minutes ago
        duration: 420, // 7 minutes in seconds
        currentPhase: 'quality_analysis',
        metrics: {
          audioQuality: 94,
          responseLatency: 980,
          conversationFlow: 96,
          aiPerformance: 93,
          customerEngagement: 88
        },
        realTimeData: {
          currentTranscript: 'Den nya menyn är fantastisk! Särskilt fisksoppan var exceptionell. Personalen var mycket professionell och kunnig om viner...',
          lastAIResponse: 'Underbart att höra! Kan du beskriva vad som gjorde fisksoppan så speciell? Och vilken vin rekommenderade personalen?',
          emotionalTone: 'positive',
          speechRate: 158,
          volumeLevel: 68,
          backgroundNoise: 22
        },
        interventions: [],
        location: {
          city: 'Göteborg',
          region: 'Västra Götaland County',
          coordinates: { lat: 57.7089, lng: 11.9746 }
        },
        device: {
          type: 'mobile',
          browser: 'Chrome',
          connection: '4g',
          connectionQuality: 76
        }
      },
      {
        sessionId: 'session_live_003_malmo_flagged',
        sessionToken: 'live_tok_ghi789jkl012',
        businessId: 'bus_007_malmo_bakery',
        businessName: 'Bageri Skåne Malmö',
        customerHash: 'cust_hash_def456',
        status: 'flagged',
        quality: 'poor',
        startTime: new Date(Date.now() - 12 * 60 * 1000).toISOString(), // 12 minutes ago
        duration: 720, // 12 minutes in seconds
        currentPhase: 'feedback_collection',
        metrics: {
          audioQuality: 45,
          responseLatency: 3200,
          conversationFlow: 38,
          aiPerformance: 52,
          customerEngagement: 31
        },
        realTimeData: {
          currentTranscript: '... det här är helt oacceptabelt... väntar i 20 minuter... personalen bryr sig inte...',
          lastAIResponse: 'Jag förstår din frustration över väntetiden. Kan du berätta mer om vad som hände när du försökte få hjälp?',
          emotionalTone: 'frustrated',
          speechRate: 189, // speaking quickly due to frustration
          volumeLevel: 85, // speaking loudly
          backgroundNoise: 38
        },
        interventions: [
          {
            id: 'intervention_001',
            type: 'flag',
            timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
            adminId: 'admin_456',
            reason: 'Automatisk flaggning: låg AI-prestanda och hög kundfrustration'
          }
        ],
        location: {
          city: 'Malmö',
          region: 'Skåne County',
          coordinates: { lat: 55.6050, lng: 13.0038 }
        },
        device: {
          type: 'mobile',
          browser: 'Safari',
          connection: '5g',
          connectionQuality: 94
        }
      },
      {
        sessionId: 'session_live_004_uppsala_paused',
        sessionToken: 'live_tok_jkl012mno345',
        businessId: 'bus_005_uppsala_tech',
        businessName: 'Tech Hub Uppsala',
        customerHash: 'cust_hash_ghi789',
        status: 'paused',
        quality: 'fair',
        startTime: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15 minutes ago
        duration: 900, // 15 minutes in seconds
        currentPhase: 'context_gathering',
        metrics: {
          audioQuality: 68,
          responseLatency: 2100,
          conversationFlow: 64,
          aiPerformance: 71,
          customerEngagement: 55
        },
        realTimeData: {
          currentTranscript: 'System pausad för manuell granskning...',
          lastAIResponse: 'Session har pausats för kvalitetskontroll. Väntar på admin-intervention...',
          emotionalTone: 'neutral',
          speechRate: 0, // paused
          volumeLevel: 0,
          backgroundNoise: 0
        },
        interventions: [
          {
            id: 'intervention_002',
            type: 'pause',
            timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
            adminId: 'admin_123',
            reason: 'Pausad för manuell granskning av teknisk feedback'
          }
        ],
        location: {
          city: 'Uppsala',
          region: 'Uppsala County',
          coordinates: { lat: 59.8586, lng: 17.6389 }
        },
        device: {
          type: 'desktop',
          browser: 'Chrome',
          connection: 'ethernet',
          connectionQuality: 98
        }
      },
      {
        sessionId: 'session_live_005_linkoping_error',
        sessionToken: 'live_tok_mno345pqr678',
        businessId: 'bus_012_linkoping_cafe',
        businessName: 'Kafé Östgöta Linköping',
        customerHash: 'cust_hash_jkl012',
        status: 'error',
        quality: 'critical',
        startTime: new Date(Date.now() - 8 * 60 * 1000).toISOString(), // 8 minutes ago
        duration: 480, // 8 minutes in seconds
        currentPhase: 'greeting',
        metrics: {
          audioQuality: 23,
          responseLatency: 8500,
          conversationFlow: 12,
          aiPerformance: 28,
          customerEngagement: 8
        },
        realTimeData: {
          currentTranscript: '[TEKNISKT FEL: Ingen ljuddata mottagen]',
          lastAIResponse: '[FEL: AI-tjänsten svarar inte]',
          emotionalTone: 'neutral',
          speechRate: 0,
          volumeLevel: 0,
          backgroundNoise: 0
        },
        interventions: [
          {
            id: 'intervention_003',
            type: 'admin_note',
            timestamp: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
            adminId: 'admin_789',
            reason: 'Tekniskt fel identifierat: WebSocket-anslutning avbruten, AI-tjänst otillgänglig'
          }
        ],
        location: {
          city: 'Linköping',
          region: 'Östergötland County',
          coordinates: { lat: 58.4108, lng: 15.6214 }
        },
        device: {
          type: 'mobile',
          browser: 'Firefox',
          connection: '4g',
          connectionQuality: 34
        }
      }
    ];

    // System metrics for live monitoring
    const systemMetrics = {
      activeSessions: mockLiveSessions.filter(s => ['active', 'paused'].includes(s.status)).length,
      totalSessionsToday: 247,
      averageSessionDuration: 285, // seconds
      systemLoad: 34.7, // percentage
      errorRate: 2.1, // percentage
      responseLatency: 1680 // milliseconds
    };

    res.json({
      success: true,
      data: {
        sessions: mockLiveSessions,
        systemMetrics
      },
      message: `${mockLiveSessions.length} sessioner laddade för live-övervakning`,
      meta: {
        timestamp: new Date().toISOString(),
        autoRefreshRecommended: true,
        refreshInterval: 2000 // 2 seconds
      }
    });

  } catch (error) {
    console.error('Load live sessions error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Kunde inte ladda live-sessioner'
    });
  }
});

/**
 * @openapi
 * /api/admin/live-sessions/{sessionId}/intervene:
 *   post:
 *     summary: Intervene in a live voice feedback session
 *     tags: [Admin Live Sessions]
 *     security:
 *       - bearerAuth: []
 */
adminRoutes.post('/live-sessions/:sessionId/intervene', requirePermission('session:intervene'), async (req, res) => {
  const { sessionId } = req.params;
  const { action, reason } = req.body;
  const adminReq = req as AdminRequest;

  try {
    if (!action || !reason) {
      return res.status(400).json({
        code: 'MISSING_FIELDS',
        message: 'Åtgärd och anledning krävs'
      });
    }

    if (!['pause', 'resume', 'terminate', 'flag'].includes(action)) {
      return res.status(400).json({
        code: 'INVALID_ACTION',
        message: 'Ogiltig interventionsåtgärd'
      });
    }

    // Generate intervention ID
    const interventionId = `intervention_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create comprehensive intervention record
    const interventionRecord = {
      id: interventionId,
      sessionId,
      action,
      reason,
      adminId: adminReq.admin.id,
      adminEmail: adminReq.admin.email,
      adminRole: adminReq.admin.role,
      timestamp: new Date().toISOString(),
      effectiveImmediately: true,
      auditTrail: {
        action: `session_${action}`,
        adminId: adminReq.admin.id,
        adminEmail: adminReq.admin.email,
        adminRole: adminReq.admin.role,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString(),
        details: {
          sessionId,
          interventionType: action,
          reason,
          adminInitiated: true
        }
      }
    };

    // Action-specific processing
    let statusMessage = '';
    let newSessionStatus = '';

    switch (action) {
      case 'pause':
        statusMessage = 'Session pausad framgångsrikt - kunden informerad';
        newSessionStatus = 'paused';
        break;
      case 'resume':
        statusMessage = 'Session återupptagen framgångsrikt';
        newSessionStatus = 'active';
        break;
      case 'terminate':
        statusMessage = 'Session terminerad - kunden omdirigerad till slutsida';
        newSessionStatus = 'terminated';
        break;
      case 'flag':
        statusMessage = 'Session flaggad för kvalitetsrecension';
        newSessionStatus = 'flagged';
        break;
    }

    // Log the intervention
    console.log(`Session intervention: ${action} on ${sessionId} by ${adminReq.admin.email}: ${reason}`);
    
    res.json({
      success: true,
      data: {
        interventionId,
        sessionId,
        action,
        newStatus: newSessionStatus,
        reason,
        timestamp: interventionRecord.timestamp,
        processedBy: {
          adminId: adminReq.admin.id,
          adminEmail: adminReq.admin.email,
          adminRole: adminReq.admin.role
        },
        effectiveImmediately: true
      },
      message: statusMessage
    });

  } catch (error) {
    console.error('Session intervention error:', error);
    res.status(500).json({
      code: 'INTERVENTION_ERROR',
      message: 'Kunde inte genomföra session-intervention'
    });
  }
});

// System health monitoring endpoint
/**
 * @openapi
 * /api/admin/system-metrics:
 *   get:
 *     summary: Get comprehensive system health and performance metrics
 *     tags: [Admin System]
 *     security:
 *       - bearerAuth: []
 */
adminRoutes.get('/system-metrics', requirePermission('system:read'), async (req, res) => {
  try {
    // Mock comprehensive system metrics - in production, collect from monitoring systems
    const mockSystemMetrics = {
      systemHealth: {
        overview: {
          uptime: 2847360, // ~33 days in seconds
          uptimePercentage: 99.97,
          totalRequests: 8472650,
          requestsPerSecond: 247,
          lastHealthCheck: new Date().toISOString(),
          systemVersion: 'v2.1.3'
        },
        performance: {
          apiLatency: {
            current: 247,
            average: 285,
            p95: 450,
            p99: 890
          },
          throughput: {
            current: 247,
            average: 312,
            peak: 1850
          },
          errorRates: {
            current: 0.23,
            average: 0.18,
            critical: 0.05
          }
        },
        capacity: {
          cpu: {
            usage: 34.7,
            cores: 16,
            load: 2.8
          },
          memory: {
            used: 28847104000, // ~26.9 GB
            total: 68719476736, // 64 GB
            usage: 42.0
          },
          storage: {
            used: 245760000000, // ~229 GB
            total: 1099511627776, // 1 TB
            usage: 22.3
          },
          database: {
            connections: 47,
            maxConnections: 200,
            slowQueries: 3
          }
        },
        services: {
          aiService: {
            status: 'healthy' as const,
            responseTime: 1420,
            successRate: 98.7,
            queueSize: 12
          },
          voiceService: {
            status: 'healthy' as const,
            responseTime: 850,
            activeSessions: 23,
            processingQueue: 5
          },
          database: {
            status: 'healthy' as const,
            responseTime: 12,
            connectionPool: 47
          },
          paymentService: {
            status: 'degraded' as const,
            responseTime: 2340,
            transactionSuccess: 97.2
          }
        }
      },
      swedishMetrics: {
        regional: {
          stockholm: {
            businesses: 45,
            activeSessions: 8,
            averageScore: 84.2,
            monthlyRevenue: 1245000
          },
          goteborg: {
            businesses: 32,
            activeSessions: 6,
            averageScore: 86.1,
            monthlyRevenue: 856000
          },
          malmo: {
            businesses: 28,
            activeSessions: 4,
            averageScore: 81.7,
            monthlyRevenue: 632000
          },
          other: {
            businesses: 51,
            activeSessions: 7,
            averageScore: 79.4,
            monthlyRevenue: 714000
          }
        },
        businessTypes: {
          cafes: {
            count: 67,
            averageScore: 83.5,
            topPerformers: ['Café Lagom Stockholm', 'Espresso House Göteborg', 'Wayne\'s Coffee Malmö'],
            commonIssues: ['Långsamma beställningar', 'Begränsad wifi']
          },
          restaurants: {
            count: 34,
            averageScore: 87.2,
            topPerformers: ['Restaurang Västkust', 'Kött & Fisk Stockholm', 'Malmö Brasserie'],
            commonIssues: ['Väntetider vid rusningstid', 'Begränsade vegetariska alternativ']
          },
          retail: {
            count: 55,
            averageScore: 78.9,
            topPerformers: ['ICA Supermarket Malmö', 'Åhléns Stockholm', 'H&M Göteborg'],
            commonIssues: ['Långa köer vid kassan', 'Svårt att hitta personal']
          }
        },
        languageMetrics: {
          swedishAccuracy: 94.8,
          dialectRecognition: 87.3,
          commonMisunderstandings: [
            'Kött vs Kött (dialect variations)',
            'Sju vs Kju (pronunciation differences)',
            'Regional expressions (göteborska, stockholmska)',
            'Age-related speech patterns'
          ]
        }
      },
      scalingRecommendations: [
        {
          type: 'scale_up' as const,
          component: 'AI Processing Cluster',
          priority: 'high' as const,
          recommendation: 'Öka AI-servrar från 4 till 6 för att hantera ökad belastning under högtrafik',
          estimatedImpact: 'Reducera AI-svarstid med 35%, hantera 60% fler samtidiga sessioner',
          timeframe: 'Implementera inom 1 vecka'
        },
        {
          type: 'optimize' as const,
          component: 'Payment Service',
          priority: 'medium' as const,
          recommendation: 'Optimera Stripe API-anrop genom connection pooling och caching',
          estimatedImpact: 'Förbättra betalningsprestanda med 25%, reducera timeout-fel',
          timeframe: 'Implementera inom 2 veckor'
        },
        {
          type: 'alert' as const,
          component: 'Database Connection Pool',
          priority: 'medium' as const,
          recommendation: 'Övervaka anslutningspool närmare - närmar sig 25% av maxkapacitet',
          estimatedImpact: 'Förhindra anslutningsfel under högtrafik',
          timeframe: 'Kontinuerlig övervakning'
        },
        {
          type: 'scale_up' as const,
          component: 'Voice Processing',
          priority: 'low' as const,
          recommendation: 'Planera utökning av rösttjänster för kommande Black Friday-period',
          estimatedImpact: 'Säkerställ stabil service under 300% trafikökning',
          timeframe: 'Implementera inom 4 veckor'
        }
      ]
    };

    res.json({
      success: true,
      data: mockSystemMetrics,
      message: 'Systemstatistik laddad framgångsrikt',
      meta: {
        timestamp: new Date().toISOString(),
        autoRefreshInterval: 30000,
        dataFreshness: 'real-time'
      }
    });

  } catch (error) {
    console.error('Load system metrics error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Kunde inte ladda systemstatistik'
    });
  }
});

// Fraud detection dashboard endpoint
/**
 * @openapi
 * /api/admin/fraud/dashboard:
 *   get:
 *     summary: Get comprehensive fraud detection dashboard data with Swedish compliance focus
 *     tags: [Admin Fraud]
 *     security:
 *       - bearerAuth: []
 */
adminRoutes.get('/fraud/dashboard', requirePermission('fraud:read'), async (req, res) => {
  try {
    // Mock comprehensive fraud detection data with Swedish compliance focus
    const mockFraudDashboard = {
      alerts: [
        {
          id: 'fraud_alert_001',
          severity: 'critical' as const,
          category: 'reward_abuse' as const,
          status: 'open' as const,
          title: 'Misstänkt belöningsmissbruk - Stockholm Café',
          description: 'AI-algoritm detekterade upprepade identiska feedback-sessioner från samma enhet med olika kundprofiler.',
          riskScore: 94,
          confidence: 0.92,
          detectedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
          businessId: 'bus_001_stockholm_cafe',
          businessName: 'Café Lagom Stockholm',
          customerHash: 'cust_hash_suspicious_001',
          transactionId: 'txn_fraud_001',
          amount: 285.50,
          evidence: [
            {
              type: 'Enhetsfingeravtryck',
              value: '5 olika kund-hasher från samma enhets-ID inom 2 timmar',
              confidence: 0.96
            },
            {
              type: 'Röstanalys',
              value: 'Identisk röstprofil trots olika kundidentiteter',
              confidence: 0.89
            },
            {
              type: 'Textmönster',
              value: '87% textlikhet mellan feedback-sessioner',
              confidence: 0.91
            }
          ],
          swedishComplianceFlags: [
            'GDPR Art. 6 - Berättigad säkerhet',
            'Konsumentverket - Misstänkt vilseledning',
            'Finansinspektionen - Betalningsregler'
          ]
        },
        {
          id: 'fraud_alert_002',
          severity: 'high' as const,
          category: 'fake_business' as const,
          status: 'investigating' as const,
          title: 'Falskt företag - Göteborg Restaurant',
          description: 'Organisationsnummer verifiering misslyckas. Adress existerar inte enligt Postens adressregister.',
          riskScore: 87,
          confidence: 0.85,
          detectedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago
          businessId: 'bus_fake_002_goteborg',
          businessName: 'Restaurang Falsk Göteborg AB',
          customerHash: 'cust_hash_unknown_002',
          transactionId: 'txn_fraud_002',
          amount: 450.00,
          evidence: [
            {
              type: 'Bolagsverket-verifiering',
              value: 'Organisationsnummer 559999-9999 existerar ej',
              confidence: 1.0
            },
            {
              type: 'Adressvalidering',
              value: 'Gatuadress "Fantasi-gatan 999" finns inte i Göteborg',
              confidence: 0.98
            },
            {
              type: 'Webbplats-analys',
              value: 'Domän registrerad för 3 dagar sedan, ingen företagshistorik',
              confidence: 0.75
            }
          ],
          swedishComplianceFlags: [
            'Aktiebolagslagen - Illegitim verksamhet',
            'Skattelagen - Falsk företagsidentitet',
            'Finansinspektionen - KYC-brott'
          ],
          assignedTo: 'admin_456_erik'
        },
        {
          id: 'fraud_alert_003',
          severity: 'medium' as const,
          category: 'duplicate_feedback' as const,
          status: 'resolved' as const,
          title: 'Duplicerad feedback - Malmö ICA',
          description: 'Samma feedback-innehåll skickad från olika kund-konton inom kort tidsperiod.',
          riskScore: 72,
          confidence: 0.78,
          detectedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 24 hours ago
          businessId: 'bus_003_malmo_grocery',
          businessName: 'ICA Supermarket Malmö Centrum',
          customerHash: 'cust_hash_resolved_003',
          transactionId: 'txn_resolved_003',
          amount: 167.30,
          evidence: [
            {
              type: 'Textanalys',
              value: '95% textlikhet med tidigare feedback från annan kund',
              confidence: 0.82
            },
            {
              type: 'Tidsmönster',
              value: 'Skickad 8 minuter efter ursprunglig feedback',
              confidence: 0.74
            }
          ],
          swedishComplianceFlags: [
            'Marknadsföringslagen - Vilseledande information'
          ],
          resolvedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          resolution: 'Bekräftat som legitimt - familjemedlemmar som handlade tillsammans'
        },
        {
          id: 'fraud_alert_004',
          severity: 'high' as const,
          category: 'bot_activity' as const,
          status: 'open' as const,
          title: 'Automatiserad bot-aktivitet - Uppsala Tech',
          description: 'Onormalt snabba svarstider och repetitiva mönster tyder på automatiserad feedback-generation.',
          riskScore: 89,
          confidence: 0.91,
          detectedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 minutes ago
          businessId: 'bus_005_uppsala_tech',
          businessName: 'Tech Hub Uppsala',
          customerHash: 'cust_hash_bot_004',
          transactionId: 'txn_bot_004',
          amount: 199.99,
          evidence: [
            {
              type: 'Svarstids-analys',
              value: 'Medelsvarstid 0.3 sekunder (normalt 3-8 sekunder)',
              confidence: 0.94
            },
            {
              type: 'Språkmönster',
              value: 'Perfekt grammatik utan variation, inga talfel eller pauser',
              confidence: 0.87
            },
            {
              type: 'Enhetsdata',
              value: 'User-Agent tyder på headless browser automation',
              confidence: 0.92
            }
          ],
          swedishComplianceFlags: [
            'GDPR Art. 22 - Automatiserat beslutsfattande',
            'Konsumentverket - Konsumentskydd',
            'AI-lagen - Transparenskrav'
          ]
        },
        {
          id: 'fraud_alert_005',
          severity: 'low' as const,
          category: 'identity_fraud' as const,
          status: 'open' as const,
          title: 'Misstänkt identitetsstöld - Linköping Café',
          description: 'Inkonsekventa personuppgifter mellan transaktioner från samma användare.',
          riskScore: 65,
          confidence: 0.68,
          detectedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // 4 hours ago
          businessId: 'bus_012_linkoping_cafe',
          businessName: 'Kafé Östgöta Linköping',
          customerHash: 'cust_hash_identity_005',
          transactionId: 'txn_identity_005',
          amount: 89.50,
          evidence: [
            {
              type: 'Demografisk inkonsekvens',
              value: 'Åldersuppgifter varierar mellan 25-67 år för samma kund-hash',
              confidence: 0.71
            },
            {
              type: 'Geografisk anomali',
              value: 'Transaktioner från både Stockholm och Malmö samma dag',
              confidence: 0.65
            }
          ],
          swedishComplianceFlags: [
            'GDPR Art. 5 - Riktighet av personuppgifter',
            'Personuppgiftslagen - Identitetsverifiering'
          ]
        }
      ],
      patterns: [
        {
          id: 'pattern_001',
          name: 'Koordinerad belöningsmissbruk',
          description: 'Nätverk av relaterade konton som systematiskt missbrukar belöningssystemet genom falska transaktioner och duplicerad feedback.',
          occurrences: 47,
          trend: 'increasing' as const,
          lastDetected: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          riskLevel: 'critical' as const,
          affectedBusinesses: 12,
          estimatedLoss: 23450 // SEK
        },
        {
          id: 'pattern_002',
          name: 'Automatiserad feedback-generation',
          description: 'Bot-nätverk som genererar artificiell feedback för att manipulera företagsbetyg och belöningsutbetalningar.',
          occurrences: 89,
          trend: 'stable' as const,
          lastDetected: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          riskLevel: 'high' as const,
          affectedBusinesses: 8,
          estimatedLoss: 15680
        },
        {
          id: 'pattern_003',
          name: 'Falska företagsregistreringar',
          description: 'Systematiska försök att registrera icke-existerande företag för att få tillgång till plattformen och manipulera systemet.',
          occurrences: 23,
          trend: 'decreasing' as const,
          lastDetected: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
          riskLevel: 'high' as const,
          affectedBusinesses: 23,
          estimatedLoss: 8920
        },
        {
          id: 'pattern_004',
          name: 'Regionala anomalier',
          description: 'Onormal aktivitet från specifika geografiska områden som inte stämmer överens med lokala affärsmönster.',
          occurrences: 156,
          trend: 'stable' as const,
          lastDetected: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
          riskLevel: 'medium' as const,
          affectedBusinesses: 34,
          estimatedLoss: 5230
        },
        {
          id: 'pattern_005',
          name: 'Språkmanipulation',
          description: 'Försök att lura AI-system genom konstgjorda språkmönster eller översättningsverktyg för att få högre kvalitetspoäng.',
          occurrences: 67,
          trend: 'increasing' as const,
          lastDetected: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
          riskLevel: 'medium' as const,
          affectedBusinesses: 19,
          estimatedLoss: 3450
        }
      ],
      compliance: {
        gdprCompliance: {
          score: 94,
          issues: [
            'Förlängd datalagring för 3 företag (över 30-dagars gräns)',
            'Saknade samtycken för marknadsföringsanalyzer',
            'Inkompletta raderingsloggar för 2 användarförfrågningar'
          ],
          lastAudit: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days ago
        },
        finansinspektionen: {
          reportingStatus: 'compliant' as const,
          nextDeadline: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(), // 15 days from now
          pendingReports: 2
        },
        konsumentverket: {
          complaints: 7,
          resolved: 6,
          averageResolutionTime: 4.2 // days
        }
      }
    };

    res.json({
      success: true,
      data: mockFraudDashboard,
      message: 'Bedrägeröversikt laddad framgångsrikt',
      meta: {
        timestamp: new Date().toISOString(),
        autoRefreshInterval: 30000,
        dataFreshness: 'real-time',
        complianceFramework: 'Swedish Regulatory Standards'
      }
    });

  } catch (error) {
    console.error('Load fraud dashboard error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Kunde inte ladda bedrägeröversikt'
    });
  }
});

// Ban management endpoints
/**
 * @openapi
 * /api/admin/bans:
 *   get:
 *     summary: Get comprehensive ban management dashboard with Swedish legal compliance
 *     tags: [Admin Ban Management]
 *     security:
 *       - bearerAuth: []
 */
adminRoutes.get('/bans', requirePermission('bans:read'), async (req, res) => {
  try {
    // Mock comprehensive ban management data
    const mockBanData = {
      activeBans: [
        {
          id: 'ban_001',
          type: 'business' as const,
          targetId: 'bus_fake_002_goteborg',
          targetName: 'Restaurang Falsk Göteborg AB',
          banType: 'permanent' as const,
          severity: 'critical' as const,
          reason: 'fraud_business_identity',
          reasonLabel: 'Falskt företag - Identitetsbedrägeri',
          description: 'Företaget använder icke-existerande organisationsnummer och falsk adressinformation för att kringgå verifieringsprocesser.',
          bannedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          bannedBy: 'admin_456_erik',
          adminName: 'Erik Johansson',
          evidenceIds: ['fraud_alert_002'],
          swedishLegalBasis: [
            'Aktiebolagslagen (2005:551) Kap 1 § 3 - Illegitim verksamhet',
            'Lag om straff för marknadsmissbruk (2005:377) § 8',
            'Konsumentkreditlagen (2010:1846) § 4 - Vilseledande information'
          ],
          automaticTrigger: false,
          appealStatus: 'none' as const,
          estimatedLoss: 8920,
          affectedTransactions: 12
        },
        {
          id: 'ban_002',
          type: 'customer' as const,
          targetId: 'cust_hash_suspicious_001',
          targetName: 'Misstänkt kund (Anonymiserad)',
          banType: 'temporary' as const,
          severity: 'high' as const,
          reason: 'fraud_reward_abuse',
          reasonLabel: 'Belöningsmissbruk - Systematiskt',
          description: 'Identifierat nätverk av relaterade konton som systematiskt missbrukar belöningssystemet genom falska enhets-ID och duplicerad feedback.',
          bannedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
          bannedBy: 'admin_123_anna',
          adminName: 'Anna Svensson',
          evidenceIds: ['fraud_alert_001'],
          swedishLegalBasis: [
            'Marknadsföringslagen (2008:486) Kap 3 § 10 - Vilseledande marknadsföring',
            'GDPR Art. 6(1)(f) - Berättigade intressen för bedrägeriskydd',
            'Lag om elektronisk handel (2002:562) § 9'
          ],
          automaticTrigger: true,
          appealStatus: 'pending' as const,
          appealSubmittedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          appealReason: 'Jag delar enhet med familjemedlemmar som också använder plattformen',
          banExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
          estimatedLoss: 1250,
          affectedTransactions: 5
        },
        {
          id: 'ban_003',
          type: 'customer' as const,
          targetId: 'cust_hash_bot_004',
          targetName: 'Bot-konto (Tech Hub Uppsala)',
          banType: 'permanent' as const,
          severity: 'critical' as const,
          reason: 'fraud_automated_abuse',
          reasonLabel: 'Automatiserad bedrägeri - Bot-aktivitet',
          description: 'Bekräftad bot-aktivitet med onaturligt snabba svarstider och repetitiva mönster. Bryter mot plattformens användarvillkor för äkta mänsklig interaktion.',
          bannedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          bannedBy: 'system_auto',
          adminName: 'Automatisk upptäckt',
          evidenceIds: ['fraud_alert_004'],
          swedishLegalBasis: [
            'GDPR Art. 22 - Rättigheter för automatiserat beslutsfattande',
            'AI-lagen - Transparenskrav för automatiserade system',
            'Konsumentverket - Regler för digital marknadsföring'
          ],
          automaticTrigger: true,
          appealStatus: 'none' as const,
          estimatedLoss: 450,
          affectedTransactions: 3
        }
      ],
      banReasons: [
        // Fraud - Financial Category
        {
          id: 'fraud_financial_001',
          code: 'FRD-FIN-001',
          label: 'Systematiskt belöningsmissbruk',
          category: 'fraud_financial' as const,
          subcategory: 'reward_manipulation',
          severity: 'high' as const,
          swedishLegalBasis: [
            'Marknadsföringslagen (2008:486) Kap 3 § 10',
            'Avtalslagen (1915:218) § 30 - Ogiltighet p.g.a. bedrägeri',
            'Konsumentkreditlagen (2010:1846) § 4'
          ],
          euRegulations: [
            'GDPR Art. 6(1)(f) - Berättigade intressen',
            'Direktiv 2005/29/EG - Oskäliga affärsmetoder'
          ],
          recommendedAction: 'temporary',
          description: 'Upptäckt av systematiska mönster för att manipulera belöningssystemet genom falska konton, enhetsduplicering eller artificiell transaktionsvolym.',
          documentationRequired: [
            'Transaktionshistorik',
            'Enhets-fingerprinting data',
            'IP-adressanalys',
            'Tidsstämpelanalys av aktivitet'
          ],
          automationRules: [
            {
              id: 'auto_reward_abuse_001',
              condition: 'multiple_accounts_same_device',
              threshold: 3,
              timeWindow: '24h',
              autoExecute: true,
              requiredApproval: false,
              approverRoles: ['admin', 'fraud_specialist']
            }
          ],
          historicalUsage: {
            totalUses: 127,
            successRate: 94.5,
            appealOverrideRate: 12.3
          },
          isActive: true,
          createdAt: '2024-01-15T10:00:00Z',
          updatedAt: '2024-08-20T14:30:00Z'
        },
        {
          id: 'fraud_financial_002',
          code: 'FRD-FIN-002',
          label: 'Transaktionsmanipulation',
          category: 'fraud_financial' as const,
          subcategory: 'transaction_fraud',
          severity: 'critical' as const,
          swedishLegalBasis: [
            'Brottsbalken (1962:700) Kap 9 § 1 - Bedrägeri',
            'Lag om betalningar (2010:751) § 15',
            'Penningtvättlagen (2017:630) § 4'
          ],
          euRegulations: [
            'PSD2 Direktiv (EU) 2015/2366',
            'Förordning (EU) 2018/1672 om penningtvätt'
          ],
          recommendedAction: 'permanent',
          description: 'Manipulation av transaktionsdata, falska kvitton eller samverkan med handlare för att skapa artificiella transaktioner.',
          documentationRequired: [
            'POS-systemloggar',
            'Bankverifikation',
            'Handlarsysteminloggning',
            'Tidssynkronisering mellan system'
          ],
          automationRules: [
            {
              id: 'auto_transaction_fraud_001',
              condition: 'suspicious_transaction_pattern',
              threshold: 2,
              timeWindow: '1h',
              autoExecute: false,
              requiredApproval: true,
              approverRoles: ['senior_admin', 'fraud_specialist']
            }
          ],
          historicalUsage: {
            totalUses: 23,
            successRate: 98.7,
            appealOverrideRate: 4.3
          },
          isActive: true,
          createdAt: '2024-01-15T10:00:00Z',
          updatedAt: '2024-08-20T14:30:00Z'
        },

        // Fraud - Identity Category
        {
          id: 'fraud_identity_001',
          code: 'FRD-ID-001',
          label: 'Falskt företag - Identitetsbedrägeri',
          category: 'fraud_identity' as const,
          subcategory: 'business_impersonation',
          severity: 'critical' as const,
          swedishLegalBasis: [
            'Aktiebolagslagen (2005:551) Kap 1 § 3',
            'Brottsbalken (1962:700) Kap 9 § 3 - Grovt bedrägeri',
            'Företagsrekonstruktionslagen (2018:1201) § 4'
          ],
          euRegulations: [
            'Direktiv 2017/1132 - Bolagsrätt',
            'GDPR Art. 6 - Rättslig grund för behandling'
          ],
          recommendedAction: 'permanent',
          description: 'Användning av icke-existerande eller stulna företagsidentiteter, falska organisationsnummer eller vilseledande företagsinformation.',
          documentationRequired: [
            'Bolagsverket-verifiering',
            'Organisationsnummer-kontroll',
            'Adressverifiering',
            'Kontaktuppgifter-verifiering',
            'Juridisk ägarskapsanalys'
          ],
          automationRules: [
            {
              id: 'auto_business_identity_001',
              condition: 'invalid_org_number',
              threshold: 1,
              timeWindow: '1d',
              autoExecute: true,
              requiredApproval: false,
              approverRoles: ['admin']
            }
          ],
          historicalUsage: {
            totalUses: 8,
            successRate: 100.0,
            appealOverrideRate: 0.0
          },
          isActive: true,
          createdAt: '2024-02-01T10:00:00Z',
          updatedAt: '2024-08-20T14:30:00Z'
        },
        {
          id: 'fraud_identity_002',
          code: 'FRD-ID-002',
          label: 'Identitetsstöld - Personuppgifter',
          category: 'fraud_identity' as const,
          subcategory: 'personal_identity_theft',
          severity: 'critical' as const,
          swedishLegalBasis: [
            'Brottsbalken (1962:700) Kap 4 § 9c - Identitetsstöld',
            'Dataskyddsförordningen implementering i svensk rätt',
            'Personuppgiftslagen historiska bestämmelser'
          ],
          euRegulations: [
            'GDPR Art. 5 - Principer för behandling',
            'GDPR Art. 32 - Behandlingssäkerhet',
            'eIDAS-förordningen (EU) 910/2014'
          ],
          recommendedAction: 'permanent',
          description: 'Användning av stulna personuppgifter eller falska identiteter för att kringgå säkerhetskontroller eller begå bedrägeri.',
          documentationRequired: [
            'ID-verifieringsdokumentation',
            'GDPR-lagring av bevis',
            'Polisanmälan för identitetsstöld',
            'Kryptografiskt bevarade bevis'
          ],
          automationRules: [
            {
              id: 'auto_identity_theft_001',
              condition: 'stolen_identity_detected',
              threshold: 1,
              timeWindow: '1d',
              autoExecute: true,
              requiredApproval: false,
              approverRoles: ['senior_admin', 'legal_team']
            }
          ],
          historicalUsage: {
            totalUses: 3,
            successRate: 100.0,
            appealOverrideRate: 0.0
          },
          isActive: true,
          createdAt: '2024-02-15T10:00:00Z',
          updatedAt: '2024-08-20T14:30:00Z'
        },

        // Fraud - Technical Category
        {
          id: 'fraud_technical_001',
          code: 'FRD-TECH-001',
          label: 'Bot-aktivitet - Automatiserat missbruk',
          category: 'fraud_technical' as const,
          subcategory: 'automated_systems',
          severity: 'critical' as const,
          swedishLegalBasis: [
            'AI-lagen (kommande implementering)',
            'Dataskyddsförordningen - Automatiserat beslutsfattande',
            'Konsumentverket - Digital marknadsföring'
          ],
          euRegulations: [
            'GDPR Art. 22 - Automatiserat individuellt beslutsfattande',
            'AI Act (EU) 2024/1689',
            'DSA Digital Services Act'
          ],
          recommendedAction: 'permanent',
          description: 'Upptäckt av automatiserade system, bot-verktyg eller skript som syftar till att kringgå plattformens säkerhetskontroller.',
          documentationRequired: [
            'Teknisk analysrapport',
            'Nätverkstrafikanalys',
            'Svarstidsanalys',
            'Användarinteraktionsmönster',
            'System fingerprinting-data'
          ],
          automationRules: [
            {
              id: 'auto_bot_detection_001',
              condition: 'automated_behavior_detected',
              threshold: 5,
              timeWindow: '5m',
              autoExecute: true,
              requiredApproval: false,
              approverRoles: ['admin', 'tech_specialist']
            }
          ],
          historicalUsage: {
            totalUses: 45,
            successRate: 97.8,
            appealOverrideRate: 2.2
          },
          isActive: true,
          createdAt: '2024-03-01T10:00:00Z',
          updatedAt: '2024-08-20T14:30:00Z'
        },

        // Abuse - Platform Category
        {
          id: 'abuse_platform_001',
          code: 'ABU-PLAT-001',
          label: 'Plattformsmissbruk - Spam feedback',
          category: 'abuse_platform' as const,
          subcategory: 'spam_content',
          severity: 'medium' as const,
          swedishLegalBasis: [
            'Marknadsföringslagen (2008:486) § 20 - Otillbörlig marknadsföring',
            'Lag om elektronisk handel (2002:562) § 9',
            'Yttrandefrihetsgrundlagen - Begränsningar'
          ],
          euRegulations: [
            'DSA Art. 14 - Innehållsmoderation',
            'eCommerce Direktiv 2000/31/EG'
          ],
          recommendedAction: 'temporary',
          description: 'Systematisk spridning av spam, irrelevant eller skadligt innehåll som försämrar användarupplevelsen eller plattformens integritet.',
          documentationRequired: [
            'Innehållsloggar',
            'Rapporteringshistorik',
            'Användarrapporter',
            'Moderationsaktioner'
          ],
          automationRules: [
            {
              id: 'auto_spam_detection_001',
              condition: 'spam_content_detected',
              threshold: 10,
              timeWindow: '1h',
              autoExecute: true,
              requiredApproval: false,
              approverRoles: ['moderator', 'admin']
            }
          ],
          historicalUsage: {
            totalUses: 156,
            successRate: 89.1,
            appealOverrideRate: 18.6
          },
          isActive: true,
          createdAt: '2024-01-20T10:00:00Z',
          updatedAt: '2024-08-20T14:30:00Z'
        },

        // Legal Violation Category  
        {
          id: 'legal_violation_001',
          code: 'LEG-VIO-001',
          label: 'GDPR-överträdelse - Databehandling',
          category: 'gdpr_violation' as const,
          subcategory: 'data_processing_violation',
          severity: 'high' as const,
          swedishLegalBasis: [
            'Dataskyddslagen (2018:218)',
            'GDPR implementering i svensk rätt',
            'Integritetsskyddsmyndigheten riktlinjer'
          ],
          euRegulations: [
            'GDPR Art. 5 - Behandlingsprinciper',
            'GDPR Art. 6 - Rättslig grund',
            'GDPR Art. 83 - Administrativa sanktionsavgifter'
          ],
          recommendedAction: 'temporary',
          description: 'Brott mot GDPR-bestämmelser genom otillåten databehandling, bristande samtycke eller felaktig hantering av personuppgifter.',
          documentationRequired: [
            'GDPR-granskningsrapport',
            'Databehandlingslogg',
            'Samtyckeregistrering',
            'DPO-utvärdering',
            'Rättslig grund-dokumentation'
          ],
          automationRules: [
            {
              id: 'auto_gdpr_violation_001',
              condition: 'gdpr_compliance_failed',
              threshold: 1,
              timeWindow: '1d',
              autoExecute: false,
              requiredApproval: true,
              approverRoles: ['dpo', 'legal_team', 'senior_admin']
            }
          ],
          historicalUsage: {
            totalUses: 12,
            successRate: 91.7,
            appealOverrideRate: 25.0
          },
          isActive: true,
          createdAt: '2024-05-15T10:00:00Z',
          updatedAt: '2024-08-20T14:30:00Z'
        },

        // Contract Breach Category
        {
          id: 'contract_breach_001',
          code: 'CON-BRE-001', 
          label: 'Avtalsbrott - Användarvillkor',
          category: 'contract_breach' as const,
          subcategory: 'terms_violation',
          severity: 'medium' as const,
          swedishLegalBasis: [
            'Avtalslagen (1915:218)',
            'Konsumentkreditlagen (2010:1846)',
            'Allmänna villkor - Svensk avtalsrätt'
          ],
          euRegulations: [
            'Direktiv 93/13/EEG - Oskäliga villkor',
            'Konsumenträttighetsdirektivet 2011/83/EU'
          ],
          recommendedAction: 'temporary',
          description: 'Brott mot plattformens användarvillkor eller avtalsbestämmelser som inte utgör bedrägeri men äventyrar systemets integritet.',
          documentationRequired: [
            'Avtalshistorik',
            'Villkorsöverträdelse-bevis',
            'Användaraktivitetslogg',
            'Kommunikationshistorik'
          ],
          automationRules: [
            {
              id: 'auto_terms_violation_001',
              condition: 'terms_violation_detected',
              threshold: 3,
              timeWindow: '7d',
              autoExecute: false,
              requiredApproval: true,
              approverRoles: ['admin', 'legal_team']
            }
          ],
          historicalUsage: {
            totalUses: 89,
            successRate: 76.4,
            appealOverrideRate: 31.5
          },
          isActive: true,
          createdAt: '2024-01-30T10:00:00Z',
          updatedAt: '2024-08-20T14:30:00Z'
        },

        // Regulatory Compliance Category
        {
          id: 'regulatory_compliance_001',
          code: 'REG-COM-001',
          label: 'Finansinspektionen - Otillåten verksamhet',
          category: 'regulatory_compliance' as const,
          subcategory: 'financial_services_violation',
          severity: 'critical' as const,
          swedishLegalBasis: [
            'Lag om finansiella instrument (2007:528)',
            'Finansinspektionens föreskrifter',
            'Lag om betaltjänster (2010:751)'
          ],
          euRegulations: [
            'MiFID II Direktiv 2014/65/EU',
            'PSD2 Direktiv (EU) 2015/2366',
            'EMD Electronic Money Directive'
          ],
          recommendedAction: 'permanent',
          description: 'Verksamhet som kräver tillstånd från Finansinspektionen men bedrivs utan sådan auktorisation, eller brott mot finansiella regleringar.',
          documentationRequired: [
            'Finansinspektionen-registerkontroll',
            'Tillståndsverifiering',
            'Verksamhetsbeskrivning',
            'Regulatorisk riskbedömning'
          ],
          automationRules: [
            {
              id: 'auto_financial_reg_001',
              condition: 'unlicensed_financial_activity',
              threshold: 1,
              timeWindow: '1d',
              autoExecute: false,
              requiredApproval: true,
              approverRoles: ['senior_admin', 'compliance_officer', 'legal_team']
            }
          ],
          historicalUsage: {
            totalUses: 2,
            successRate: 100.0,
            appealOverrideRate: 0.0
          },
          isActive: true,
          createdAt: '2024-06-01T10:00:00Z',
          updatedAt: '2024-08-20T14:30:00Z'
        }
      ],
      statistics: {
        totalActiveBans: 3,
        businessBans: 1,
        customerBans: 2,
        permanentBans: 2,
        temporaryBans: 1,
        pendingAppeals: 1,
        totalEstimatedLossPrevented: 10620,
        bansThisMonth: 3,
        successfulAppeals: 0,
        rejectedAppeals: 1,
        averageAppealProcessingTime: 2.5 // days
      },
      recentActivity: [
        {
          id: 'activity_001',
          type: 'ban_created',
          timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          adminId: 'system_auto',
          adminName: 'Automatisk upptäckt',
          description: 'Bot-konto blockerat - Tech Hub Uppsala',
          targetType: 'customer',
          severity: 'critical'
        },
        {
          id: 'activity_002',
          type: 'appeal_submitted',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          adminId: null,
          adminName: 'Kund',
          description: 'Överklagande inlämnat för belöningsmissbruk',
          targetType: 'customer',
          severity: 'high'
        },
        {
          id: 'activity_003',
          type: 'ban_created',
          timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          adminId: 'admin_456_erik',
          adminName: 'Erik Johansson',
          description: 'Permanent blockering - Falskt företag Göteborg',
          targetType: 'business',
          severity: 'critical'
        }
      ]
    };

    res.json({
      success: true,
      data: mockBanData,
      message: 'Ban management-översikt laddad framgångsrikt',
      meta: {
        timestamp: new Date().toISOString(),
        legalFramework: 'Swedish Regulatory Compliance',
        dataRetention: '5 years as per Swedish law',
        complianceVersion: 'v2.1-comprehensive-categorization',
        totalBanReasonCategories: 9,
        automationRulesActive: 8,
        categorization: {
          fraudCategories: ['fraud_financial', 'fraud_identity', 'fraud_technical'],
          abuseCategories: ['abuse_platform', 'abuse_staff'],
          legalCategories: ['legal_violation', 'gdpr_violation'],
          contractCategories: ['contract_breach'],
          regulatoryCategories: ['regulatory_compliance']
        },
        documentation: {
          swedishLegalBasisCount: 47,
          euRegulationsCount: 32,
          automationRulesEnabled: true,
          historicalDataTracking: true,
          complianceDocumentationRequired: true
        }
      }
    });

  } catch (error) {
    console.error('Load ban management error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Kunde inte ladda ban management-översikt'
    });
  }
});

/**
 * @openapi
 * /api/admin/bans/{targetId}/create:
 *   post:
 *     summary: Create a new ban with Swedish legal compliance documentation
 *     tags: [Admin Ban Management]
 *     security:
 *       - bearerAuth: []
 */
adminRoutes.post('/bans/:targetId/create', requirePermission('bans:create'), async (req, res) => {
  const { targetId } = req.params;
  const { 
    targetType, 
    targetName,
    banType, 
    reason, 
    description, 
    duration,
    evidenceIds,
    swedishLegalBasis 
  } = req.body;
  const adminReq = req as AdminRequest;

  try {
    if (!targetType || !banType || !reason || !description) {
      return res.status(400).json({
        code: 'MISSING_FIELDS',
        message: 'Måltyp, typ av blockering, anledning och beskrivning krävs'
      });
    }

    // Generate ban ID
    const banId = `ban_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create comprehensive ban record
    const banRecord = {
      id: banId,
      type: targetType,
      targetId,
      targetName,
      banType,
      severity: reason.includes('critical') ? 'critical' : reason.includes('high') ? 'high' : 'medium',
      reason,
      description,
      bannedAt: new Date().toISOString(),
      bannedBy: adminReq.admin.id,
      adminName: adminReq.admin.name || adminReq.admin.email,
      evidenceIds: evidenceIds || [],
      swedishLegalBasis: swedishLegalBasis || [],
      automaticTrigger: false,
      appealStatus: 'none',
      banExpiresAt: banType === 'temporary' && duration ? 
        new Date(Date.now() + duration * 24 * 60 * 60 * 1000).toISOString() : null,
      auditTrail: {
        action: 'ban_created',
        adminId: adminReq.admin.id,
        adminEmail: adminReq.admin.email,
        adminRole: adminReq.admin.role,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString(),
        legalBasis: swedishLegalBasis,
        evidence: evidenceIds,
        details: {
          targetType,
          banType,
          reason,
          duration: banType === 'temporary' ? duration : null,
          manualOverride: true
        }
      }
    };

    console.log(`Ban created: ${banType} ban for ${targetType} ${targetId} by ${adminReq.admin.email} - Reason: ${reason}`);
    
    res.json({
      success: true,
      data: {
        banId,
        targetId,
        targetType,
        targetName,
        action: 'ban_created',
        banType,
        reason,
        bannedAt: banRecord.bannedAt,
        bannedBy: adminReq.admin.email,
        expiresAt: banRecord.banExpiresAt,
        legalBasis: swedishLegalBasis,
        appealRights: {
          canAppeal: true,
          appealDeadline: banType === 'permanent' ? 
            new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : // 30 days for permanent bans
            new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days for temporary bans
          swedishLegalRights: 'Enligt svensk rätt har du rätt att överklaga denna beslut inom angiven tid.'
        }
      },
      message: `${banType === 'permanent' ? 'Permanent' : 'Tillfällig'} blockering skapad framgångsrikt`
    });

  } catch (error) {
    console.error('Create ban error:', error);
    res.status(500).json({
      code: 'BAN_CREATION_ERROR',
      message: 'Kunde inte skapa blockering'
    });
  }
});

/**
 * @openapi
 * /api/admin/bans/{banId}/appeal/process:
 *   post:
 *     summary: Process a ban appeal with Swedish legal compliance
 *     tags: [Admin Ban Management]
 *     security:
 *       - bearerAuth: []
 */
adminRoutes.post('/bans/:banId/appeal/process', requirePermission('bans:appeal'), async (req, res) => {
  const { banId } = req.params;
  const { decision, reviewNotes, newBanType } = req.body;
  const adminReq = req as AdminRequest;

  try {
    if (!decision || !reviewNotes) {
      return res.status(400).json({
        code: 'MISSING_FIELDS',
        message: 'Beslut och granskningsanteckningar krävs'
      });
    }

    if (!['approved', 'rejected', 'modified'].includes(decision)) {
      return res.status(400).json({
        code: 'INVALID_DECISION',
        message: 'Ogiltigt överklagandebeslut'
      });
    }

    // Create appeal decision record
    const appealRecord = {
      banId,
      decision,
      reviewedBy: adminReq.admin.id,
      reviewedAt: new Date().toISOString(),
      reviewNotes,
      newBanType: decision === 'modified' ? newBanType : null,
      swedishLegalCompliance: {
        reviewedUnder: 'Förvaltningslagen (2017:900)',
        appealRights: decision === 'rejected' ? 
          'Beslut kan överklagas till Förvaltningsrätten inom 3 veckor' : null,
        decisionBasis: reviewNotes
      },
      auditTrail: {
        action: `appeal_${decision}`,
        adminId: adminReq.admin.id,
        adminEmail: adminReq.admin.email,
        adminRole: adminReq.admin.role,
        timestamp: new Date().toISOString(),
        details: {
          originalBan: banId,
          decision,
          newBanType: decision === 'modified' ? newBanType : null,
          reviewTime: 'within_legal_timeframe'
        }
      }
    };

    let statusMessage = '';
    switch (decision) {
      case 'approved':
        statusMessage = 'Överklagande godkänt - Blockering upphävd';
        break;
      case 'rejected':
        statusMessage = 'Överklagande avslaget - Blockering kvarstår';
        break;
      case 'modified':
        statusMessage = `Överklagande delvis godkänt - Blockering ändrad till ${newBanType}`;
        break;
    }

    console.log(`Appeal ${decision} for ban ${banId} by ${adminReq.admin.email}`);
    
    res.json({
      success: true,
      data: {
        banId,
        decision,
        appealId: `appeal_${Date.now()}`,
        reviewedBy: adminReq.admin.email,
        reviewedAt: appealRecord.reviewedAt,
        statusChange: decision === 'approved' ? 'ban_lifted' : 
                     decision === 'modified' ? 'ban_modified' : 'ban_upheld',
        newBanType: decision === 'modified' ? newBanType : null,
        legalNotice: decision === 'rejected' ? 
          'Enligt svensk förvaltningsrätt kan detta beslut överklagas till Förvaltningsrätten inom 3 veckor från beslutsdatum.' : null
      },
      message: statusMessage
    });

  } catch (error) {
    console.error('Process appeal error:', error);
    res.status(500).json({
      code: 'APPEAL_PROCESSING_ERROR',
      message: 'Kunde inte behandla överklagande'
    });
  }
});

/**
 * @openapi
 * /api/admin/fraud/auto-ban-trigger:
 *   post:
 *     summary: Automated ban trigger system based on fraud detection patterns
 *     tags: [Fraud Detection, Automated Bans]
 *     security:
 *       - bearerAuth: []
 */
adminRoutes.post('/fraud/auto-ban-trigger', requirePermission('fraud:auto_ban'), async (req, res) => {
  try {
    const { 
      triggerData,
      detectionType,
      evidenceData,
      riskScore,
      confidence,
      targetId,
      targetType 
    } = req.body;

    if (!triggerData || !detectionType || !targetId || !targetType) {
      return res.status(400).json({
        code: 'MISSING_TRIGGER_DATA',
        message: 'Obligatoriska fält saknas för automatisk ban-utlösning'
      });
    }

    // Mock fraud detection rules engine - evaluates against defined automation rules
    const fraudDetectionRules = {
      'multiple_accounts_same_device': {
        banReasonId: 'fraud_financial_001',
        threshold: 3,
        timeWindow: '24h',
        autoExecute: true,
        severity: 'high',
        requiredApproval: false
      },
      'suspicious_transaction_pattern': {
        banReasonId: 'fraud_financial_002', 
        threshold: 2,
        timeWindow: '1h',
        autoExecute: false,
        severity: 'critical',
        requiredApproval: true
      },
      'invalid_org_number': {
        banReasonId: 'fraud_identity_001',
        threshold: 1,
        timeWindow: '1d',
        autoExecute: true,
        severity: 'critical',
        requiredApproval: false
      },
      'stolen_identity_detected': {
        banReasonId: 'fraud_identity_002',
        threshold: 1,
        timeWindow: '1d',
        autoExecute: true,
        severity: 'critical',
        requiredApproval: false
      },
      'automated_behavior_detected': {
        banReasonId: 'fraud_technical_001',
        threshold: 5,
        timeWindow: '5m',
        autoExecute: true,
        severity: 'critical',
        requiredApproval: false
      },
      'spam_content_detected': {
        banReasonId: 'abuse_platform_001',
        threshold: 10,
        timeWindow: '1h',
        autoExecute: true,
        severity: 'medium',
        requiredApproval: false
      },
      'gdpr_compliance_failed': {
        banReasonId: 'legal_violation_001',
        threshold: 1,
        timeWindow: '1d',
        autoExecute: false,
        severity: 'high',
        requiredApproval: true
      },
      'terms_violation_detected': {
        banReasonId: 'contract_breach_001',
        threshold: 3,
        timeWindow: '7d',
        autoExecute: false,
        severity: 'medium',
        requiredApproval: true
      },
      'unlicensed_financial_activity': {
        banReasonId: 'regulatory_compliance_001',
        threshold: 1,
        timeWindow: '1d',
        autoExecute: false,
        severity: 'critical',
        requiredApproval: true
      }
    };

    const rule = fraudDetectionRules[detectionType];
    
    if (!rule) {
      return res.status(400).json({
        code: 'UNKNOWN_DETECTION_TYPE',
        message: `Okänd detekteringstyp: ${detectionType}`
      });
    }

    // Check if threshold is met
    const violationCount = triggerData.violationCount || 1;
    if (violationCount < rule.threshold) {
      return res.status(200).json({
        success: true,
        action: 'threshold_not_met',
        message: `Tröskelvärde inte uppnått (${violationCount}/${rule.threshold})`,
        data: {
          currentCount: violationCount,
          threshold: rule.threshold,
          timeWindow: rule.timeWindow,
          ruleId: detectionType
        }
      });
    }

    // Generate automated ban record
    const autoBanId = `auto_ban_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const currentTime = new Date().toISOString();

    // Determine ban type based on severity
    const banType = ['critical'].includes(rule.severity) ? 'permanent' : 'temporary';
    const banDuration = banType === 'temporary' ? 
      (rule.severity === 'high' ? '30d' : '7d') : null;

    const autoBanRecord = {
      id: autoBanId,
      type: targetType,
      targetId: targetId,
      targetName: triggerData.targetName || `Auto-detected ${targetType}`,
      banType: banType,
      severity: rule.severity,
      reason: rule.banReasonId,
      reasonLabel: getReasonLabel(rule.banReasonId),
      description: generateAutoDescription(detectionType, triggerData),
      bannedAt: currentTime,
      bannedBy: 'system_fraud_auto',
      adminName: 'Automatisk bedrägeriskydd',
      evidenceIds: evidenceData?.evidenceIds || [],
      swedishLegalBasis: getSwedishLegalBasis(rule.banReasonId),
      automaticTrigger: true,
      appealStatus: 'none',
      banExpiresAt: banType === 'temporary' ? 
        new Date(Date.now() + parseDuration(banDuration)).toISOString() : null,
      estimatedLoss: triggerData.estimatedLoss || 0,
      affectedTransactions: triggerData.affectedTransactions || 1,
      automationData: {
        ruleId: detectionType,
        triggerTime: currentTime,
        riskScore: riskScore || 0,
        confidence: confidence || 0,
        evidenceStrength: evidenceData?.strength || 'medium',
        patternData: triggerData.patternData || {}
      }
    };

    // Auto-execute or queue for approval based on rule configuration
    if (rule.autoExecute && !rule.requiredApproval) {
      // Execute automatic ban immediately
      const executionResult = {
        banExecuted: true,
        banId: autoBanId,
        action: 'automatic_ban_created',
        severity: rule.severity,
        executedAt: currentTime,
        requiresManualReview: false
      };

      // Log the automatic ban execution
      console.log(`Automatic ban executed: ${detectionType} -> ${banType} ban for ${targetType} ${targetId}`);
      console.log(`Ban details:`, JSON.stringify(autoBanRecord, null, 2));

      return res.json({
        success: true,
        action: 'automatic_ban_executed',
        message: `Automatisk blockering utförd - ${rule.severity} risk detekterad`,
        data: {
          ban: autoBanRecord,
          execution: executionResult,
          swedishCompliance: {
            legalNotification: 'Automatisk beslut enligt GDPR Art. 22',
            appealRights: 'Rätt till överklagande inom 30 dagar',
            dataProcessingBasis: 'Berättigade intressen för bedrägeriskydd'
          }
        },
        meta: {
          automationRule: {
            ruleId: detectionType,
            threshold: rule.threshold,
            timeWindow: rule.timeWindow,
            banReasonId: rule.banReasonId
          },
          executionTime: Date.now(),
          riskAssessment: {
            score: riskScore,
            confidence: confidence,
            evidenceQuality: evidenceData?.strength || 'medium'
          }
        }
      });

    } else {
      // Queue for manual approval
      const queueEntry = {
        id: `queue_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        proposedBan: autoBanRecord,
        queuedAt: currentTime,
        priority: rule.severity === 'critical' ? 'urgent' : 
                 rule.severity === 'high' ? 'high' : 'normal',
        requiresApproval: rule.requiredApproval,
        approverRoles: ['fraud_specialist', 'senior_admin'],
        estimatedReviewTime: rule.severity === 'critical' ? '2h' : '24h'
      };

      console.log(`Ban queued for approval: ${detectionType} -> requires manual review for ${targetType} ${targetId}`);

      return res.json({
        success: true,
        action: 'ban_queued_for_approval',
        message: `Blockering köad för manuell granskning - ${rule.severity} risk detekterad`,
        data: {
          queueEntry: queueEntry,
          proposedBan: autoBanRecord,
          approvalRequired: true,
          swedishCompliance: {
            reviewProcess: 'Manuell granskning enligt svensk förvaltningsrätt',
            timeframe: queueEntry.estimatedReviewTime,
            legalBasis: getSwedishLegalBasis(rule.banReasonId)[0]
          }
        },
        meta: {
          automationRule: {
            ruleId: detectionType,
            threshold: rule.threshold,
            requiresApproval: rule.requiredApproval
          },
          queuePosition: 'TBD', // Would be calculated from actual queue
          estimatedProcessingTime: queueEntry.estimatedReviewTime
        }
      });
    }

  } catch (error) {
    console.error('Auto-ban trigger error:', error);
    res.status(500).json({
      code: 'AUTO_BAN_ERROR',
      message: 'Kunde inte utföra automatisk ban-utlösning',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Helper functions for automated ban system
function getReasonLabel(banReasonId: string): string {
  const reasonLabels = {
    'fraud_financial_001': 'Systematiskt belöningsmissbruk',
    'fraud_financial_002': 'Transaktionsmanipulation', 
    'fraud_identity_001': 'Falskt företag - Identitetsbedrägeri',
    'fraud_identity_002': 'Identitetsstöld - Personuppgifter',
    'fraud_technical_001': 'Bot-aktivitet - Automatiserat missbruk',
    'abuse_platform_001': 'Plattformsmissbruk - Spam feedback',
    'legal_violation_001': 'GDPR-överträdelse - Databehandling',
    'contract_breach_001': 'Avtalsbrott - Användarvillkor',
    'regulatory_compliance_001': 'Finansinspektionen - Otillåten verksamhet'
  };
  return reasonLabels[banReasonId] || 'Okänd anledning';
}

function getSwedishLegalBasis(banReasonId: string): string[] {
  const legalBasisMap = {
    'fraud_financial_001': ['Marknadsföringslagen (2008:486) Kap 3 § 10'],
    'fraud_financial_002': ['Brottsbalken (1962:700) Kap 9 § 1 - Bedrägeri'],
    'fraud_identity_001': ['Aktiebolagslagen (2005:551) Kap 1 § 3'],
    'fraud_identity_002': ['Brottsbalken (1962:700) Kap 4 § 9c - Identitetsstöld'],
    'fraud_technical_001': ['AI-lagen (kommande implementering)'],
    'abuse_platform_001': ['Marknadsföringslagen (2008:486) § 20'],
    'legal_violation_001': ['Dataskyddslagen (2018:218)'],
    'contract_breach_001': ['Avtalslagen (1915:218)'],
    'regulatory_compliance_001': ['Lag om finansiella instrument (2007:528)']
  };
  return legalBasisMap[banReasonId] || ['Allmänna användarvillkor'];
}

function generateAutoDescription(detectionType: string, triggerData: any): string {
  const descriptions = {
    'multiple_accounts_same_device': `Automatisk upptäckt av ${triggerData.accountCount || 'flera'} konton från samma enhet inom ${triggerData.timeframe || '24h'}`,
    'suspicious_transaction_pattern': `Misstänkta transaktionsmönster upptäckta - ${triggerData.patternType || 'onormala värden'} inom kort tidsram`,
    'invalid_org_number': `Ogiltigt organisationsnummer detekterat: ${triggerData.orgNumber || 'saknas'}`,
    'stolen_identity_detected': `Potentiell identitetsstöld baserat på ${triggerData.matchType || 'dataanalys'}`,
    'automated_behavior_detected': `Bot-liknande aktivitet - ${triggerData.botSignals || 'snabba svarstider'} och repetitiva mönster`,
    'spam_content_detected': `Spam-innehåll upptäckt - ${triggerData.spamCount || 'flera'} flaggade inlägg`,
    'gdpr_compliance_failed': `GDPR-överträdelse - ${triggerData.violationType || 'databehandlingsfel'}`,
    'terms_violation_detected': `Användarvillkor brutna - ${triggerData.violationDetails || 'policy överträdelse'}`,
    'unlicensed_financial_activity': `Otillåten finansiell verksamhet utan Finansinspektionen-tillstånd`
  };
  return descriptions[detectionType] || `Automatisk upptäckt av ${detectionType}`;
}

function parseDuration(duration: string): number {
  if (!duration) return 0;
  const match = duration.match(/^(\d+)([dhwm])$/);
  if (!match) return 0;
  
  const [, num, unit] = match;
  const multipliers = {
    'm': 60 * 1000,        // minutes
    'h': 60 * 60 * 1000,   // hours  
    'd': 24 * 60 * 60 * 1000, // days
    'w': 7 * 24 * 60 * 60 * 1000 // weeks
  };
  
  return parseInt(num) * (multipliers[unit] || 0);
}

/**
 * @openapi
 * /api/admin/fraud/automation-rules:
 *   get:
 *     summary: Get all active fraud detection automation rules
 *     tags: [Fraud Detection, Automation]
 *     security:
 *       - bearerAuth: []
 */
adminRoutes.get('/fraud/automation-rules', requirePermission('fraud:read'), async (req, res) => {
  try {
    const automationRules = {
      active: [
        {
          id: 'rule_001_device_fraud',
          name: 'Multiple Accounts Same Device',
          condition: 'multiple_accounts_same_device',
          threshold: 3,
          timeWindow: '24h',
          enabled: true,
          autoExecute: true,
          severity: 'high',
          banType: 'temporary',
          banDuration: '30d',
          swedishCompliance: 'GDPR Art. 6(1)(f) - Berättigade intressen',
          successRate: 94.5,
          falsePositiveRate: 5.5,
          lastTriggered: '2024-08-24T10:30:00Z',
          totalTriggers: 127
        },
        {
          id: 'rule_002_transaction_fraud', 
          name: 'Suspicious Transaction Patterns',
          condition: 'suspicious_transaction_pattern',
          threshold: 2,
          timeWindow: '1h',
          enabled: true,
          autoExecute: false,
          severity: 'critical',
          banType: 'permanent',
          swedishCompliance: 'Brottsbalken Kap 9 § 1 - Bedrägeri',
          successRate: 98.7,
          falsePositiveRate: 1.3,
          lastTriggered: '2024-08-24T08:15:00Z',
          totalTriggers: 23
        },
        {
          id: 'rule_003_identity_fraud',
          name: 'Invalid Organization Numbers',
          condition: 'invalid_org_number',
          threshold: 1,
          timeWindow: '1d',
          enabled: true,
          autoExecute: true,
          severity: 'critical',
          banType: 'permanent',
          swedishCompliance: 'Aktiebolagslagen Kap 1 § 3',
          successRate: 100.0,
          falsePositiveRate: 0.0,
          lastTriggered: '2024-08-23T16:45:00Z',
          totalTriggers: 8
        },
        {
          id: 'rule_004_bot_detection',
          name: 'Automated Bot Activity',
          condition: 'automated_behavior_detected',
          threshold: 5,
          timeWindow: '5m',
          enabled: true,
          autoExecute: true,
          severity: 'critical',
          banType: 'permanent',
          swedishCompliance: 'GDPR Art. 22 - Automatiserat beslutsfattande',
          successRate: 97.8,
          falsePositiveRate: 2.2,
          lastTriggered: '2024-08-24T11:22:00Z',
          totalTriggers: 45
        },
        {
          id: 'rule_005_spam_detection',
          name: 'Spam Content Flooding',
          condition: 'spam_content_detected',
          threshold: 10,
          timeWindow: '1h',
          enabled: true,
          autoExecute: true,
          severity: 'medium',
          banType: 'temporary',
          banDuration: '7d',
          swedishCompliance: 'Marknadsföringslagen § 20',
          successRate: 89.1,
          falsePositiveRate: 10.9,
          lastTriggered: '2024-08-24T09:30:00Z',
          totalTriggers: 156
        }
      ],
      inactive: [
        {
          id: 'rule_006_gdpr_violation',
          name: 'GDPR Compliance Failures',
          condition: 'gdpr_compliance_failed',
          threshold: 1,
          timeWindow: '1d',
          enabled: false,
          reason: 'Requires legal team review - too sensitive for automation',
          autoExecute: false,
          severity: 'high',
          swedishCompliance: 'Dataskyddslagen (2018:218)'
        }
      ],
      summary: {
        totalRules: 6,
        activeRules: 5,
        inactiveRules: 1,
        autoExecuteRules: 4,
        manualReviewRules: 1,
        avgSuccessRate: 95.2,
        avgFalsePositiveRate: 4.8,
        totalTriggersLast30Days: 359,
        swedishComplianceStatus: 'Fully Compliant'
      }
    };

    res.json({
      success: true,
      data: automationRules,
      message: 'Automation rules hämtade framgångsrikt',
      meta: {
        timestamp: new Date().toISOString(),
        complianceFramework: 'Swedish Legal Requirements',
        lastUpdated: '2024-08-20T14:30:00Z'
      }
    });

  } catch (error) {
    console.error('Get automation rules error:', error);
    res.status(500).json({
      code: 'AUTOMATION_RULES_ERROR',
      message: 'Kunde inte hämta automation rules'
    });
  }
});

/**
 * @openapi
 * /api/admin/fraud/ban-analytics:
 *   get:
 *     summary: Comprehensive ban effectiveness analytics and tracking
 *     tags: [Analytics, Bans, Fraud Detection]
 *     security:
 *       - bearerAuth: []
 */
adminRoutes.get('/fraud/ban-analytics', requirePermission('analytics:read'), async (req, res) => {
  try {
    const { timeframe = '30d', category = 'all', includeDetails = false } = req.query;

    // Mock comprehensive ban analytics data
    const banAnalytics = {
      overview: {
        timeframe: timeframe,
        generatedAt: new Date().toISOString(),
        totalBans: {
          current: 847,
          previousPeriod: 623,
          change: '+35.9%',
          trend: 'increasing'
        },
        effectiveness: {
          estimatedLossPrevented: {
            amount: 1247800,
            currency: 'SEK',
            change: '+42.1%'
          },
          falsePositiveRate: 4.2,
          appealSuccessRate: 18.7,
          automationAccuracy: 95.8
        },
        complianceScore: {
          overall: 98.3,
          gdpr: 99.1,
          swedishLaw: 97.8,
          processingTime: 96.9
        }
      },

      banTrends: {
        daily: [
          { date: '2024-08-01', total: 12, automatic: 8, manual: 4, appeals: 2 },
          { date: '2024-08-02', total: 15, automatic: 11, manual: 4, appeals: 1 },
          { date: '2024-08-03', total: 8, automatic: 6, manual: 2, appeals: 3 },
          { date: '2024-08-04', total: 19, automatic: 15, manual: 4, appeals: 2 },
          { date: '2024-08-05', total: 22, automatic: 18, manual: 4, appeals: 4 },
          { date: '2024-08-06', total: 11, automatic: 7, manual: 4, appeals: 1 },
          { date: '2024-08-07', total: 16, automatic: 12, manual: 4, appeals: 2 },
          { date: '2024-08-08', total: 25, automatic: 20, manual: 5, appeals: 5 },
          { date: '2024-08-09', total: 18, automatic: 14, manual: 4, appeals: 3 },
          { date: '2024-08-10', total: 14, automatic: 10, manual: 4, appeals: 2 }
        ],
        weekly: [
          { week: '2024-W29', bans: 89, effectiveness: 94.2, lossPrevented: 145600 },
          { week: '2024-W30', bans: 102, effectiveness: 96.1, lossPrevented: 178300 },
          { week: '2024-W31', bans: 76, effectiveness: 93.8, lossPrevented: 98700 },
          { week: '2024-W32', bans: 134, effectiveness: 95.7, lossPrevented: 234500 }
        ]
      },

      categoryBreakdown: {
        fraud_financial: {
          count: 312,
          percentage: 36.8,
          effectiveness: 94.5,
          avgProcessingTime: '12m',
          lossPrevented: 456700,
          topReasons: [
            { id: 'fraud_financial_001', count: 189, label: 'Systematiskt belöningsmissbruk' },
            { id: 'fraud_financial_002', count: 123, label: 'Transaktionsmanipulation' }
          ]
        },
        fraud_identity: {
          count: 87,
          percentage: 10.3,
          effectiveness: 98.9,
          avgProcessingTime: '8m',
          lossPrevented: 234100,
          topReasons: [
            { id: 'fraud_identity_001', count: 52, label: 'Falskt företag - Identitetsbedrägeri' },
            { id: 'fraud_identity_002', count: 35, label: 'Identitetsstöld - Personuppgifter' }
          ]
        },
        fraud_technical: {
          count: 156,
          percentage: 18.4,
          effectiveness: 97.4,
          avgProcessingTime: '3m',
          lossPrevented: 189200,
          topReasons: [
            { id: 'fraud_technical_001', count: 156, label: 'Bot-aktivitet - Automatiserat missbruk' }
          ]
        },
        abuse_platform: {
          count: 189,
          percentage: 22.3,
          effectiveness: 89.4,
          avgProcessingTime: '15m',
          lossPrevented: 67800,
          topReasons: [
            { id: 'abuse_platform_001', count: 189, label: 'Plattformsmissbruk - Spam feedback' }
          ]
        },
        legal_violation: {
          count: 45,
          percentage: 5.3,
          effectiveness: 91.1,
          avgProcessingTime: '2h 15m',
          lossPrevented: 156700,
          topReasons: [
            { id: 'legal_violation_001', count: 45, label: 'GDPR-överträdelse - Databehandling' }
          ]
        },
        contract_breach: {
          count: 34,
          percentage: 4.0,
          effectiveness: 76.5,
          avgProcessingTime: '45m',
          lossPrevented: 23400,
          topReasons: [
            { id: 'contract_breach_001', count: 34, label: 'Avtalsbrott - Användarvillkor' }
          ]
        },
        regulatory_compliance: {
          count: 24,
          percentage: 2.8,
          effectiveness: 100.0,
          avgProcessingTime: '4h 30m',
          lossPrevented: 119900,
          topReasons: [
            { id: 'regulatory_compliance_001', count: 24, label: 'Finansinspektionen - Otillåten verksamhet' }
          ]
        }
      },

      automationPerformance: {
        ruleEffectiveness: [
          {
            ruleId: 'rule_003_identity_fraud',
            name: 'Invalid Organization Numbers',
            triggersLast30Days: 52,
            successRate: 100.0,
            falsePositiveRate: 0.0,
            avgProcessingTime: '2m',
            lossPrevented: 234100,
            swedishCompliance: 100.0,
            trend: 'stable'
          },
          {
            ruleId: 'rule_002_transaction_fraud',
            name: 'Suspicious Transaction Patterns', 
            triggersLast30Days: 123,
            successRate: 98.7,
            falsePositiveRate: 1.3,
            avgProcessingTime: '8m',
            lossPrevented: 189200,
            swedishCompliance: 100.0,
            trend: 'improving'
          },
          {
            ruleId: 'rule_004_bot_detection',
            name: 'Automated Bot Activity',
            triggersLast30Days: 156,
            successRate: 97.4,
            falsePositiveRate: 2.6,
            avgProcessingTime: '1m',
            lossPrevented: 67400,
            swedishCompliance: 98.7,
            trend: 'stable'
          },
          {
            ruleId: 'rule_001_device_fraud',
            name: 'Multiple Accounts Same Device',
            triggersLast30Days: 189,
            successRate: 94.5,
            falsePositiveRate: 5.5,
            avgProcessingTime: '12m',
            lossPrevented: 156700,
            swedishCompliance: 96.3,
            trend: 'declining'
          },
          {
            ruleId: 'rule_005_spam_detection',
            name: 'Spam Content Flooding',
            triggersLast30Days: 189,
            successRate: 89.4,
            falsePositiveRate: 10.6,
            avgProcessingTime: '15m',
            lossPrevented: 23400,
            swedishCompliance: 94.2,
            trend: 'needs_attention'
          }
        ],
        totalAutomatedBans: 623,
        automationAccuracy: 95.8,
        timesSaved: '847 hours',
        recommendedOptimizations: [
          {
            priority: 'high',
            rule: 'rule_005_spam_detection',
            issue: 'Hög false positive rate (10.6%)',
            recommendation: 'Justera tröskelvärde från 10 till 15 meddelanden per timme',
            expectedImprovement: 'Reducera false positives med ~40%'
          },
          {
            priority: 'medium', 
            rule: 'rule_001_device_fraud',
            issue: 'Långsam processesing (12m genomsnitt)',
            recommendation: 'Förbättra device fingerprinting-algoritm',
            expectedImprovement: 'Snabbare beslut och bättre noggrannhet'
          }
        ]
      },

      appealAnalytics: {
        totalAppeals: 158,
        appealRate: 18.7, // % of bans that get appealed
        resolutionTime: {
          avg: '3.2 days',
          median: '2.1 days',
          min: '4 hours',
          max: '14 days'
        },
        outcomes: {
          approved: { count: 29, percentage: 18.4 },
          rejected: { count: 94, percentage: 59.5 },
          modified: { count: 21, percentage: 13.3 },
          pending: { count: 14, percentage: 8.8 }
        },
        reasonsForSuccess: [
          { reason: 'Ny information tillhandahållen', count: 18, percentage: 62.1 },
          { reason: 'Tekniskt fel i upptäckt', count: 7, percentage: 24.1 },
          { reason: 'Proportionalitet - för hård påföljd', count: 4, percentage: 13.8 }
        ],
        complianceMetrics: {
          gdprNotificationTime: '92.3% inom 72h',
          appealRightsNotified: '100%',
          legalBasisDocumented: '98.7%',
          dataRetentionCompliance: '100%'
        }
      },

      financialImpact: {
        lossPrevention: {
          total: 1247800,
          byCategory: {
            'Transaktionsbedrägeri': 456700,
            'Identitetsbedrägeri': 234100,
            'Bot-aktivitet': 189200,
            'Belöningsmissbruk': 156700,
            'GDPR-brott': 156700,
            'Finansreglering': 119900,
            'Spam/Missbruk': 23400
          },
          trends: {
            last7Days: 89400,
            last30Days: 347800,
            projection12Months: 5200000
          }
        },
        costAnalysis: {
          automationSavings: {
            manualReviewHours: 847,
            hourlyRate: 650, // SEK
            totalSaved: 550550
          },
          falsePositiveCosts: {
            lostBusinessValue: 45600,
            supportCosts: 23400,
            appealProcessingCosts: 18700
          },
          netBenefit: 1159250
        }
      },

      predictiveInsights: {
        fraudTrends: {
          emergingPatterns: [
            {
              pattern: 'Koordinerade mobilenhetsattacker',
              riskLevel: 'high',
              detectedCases: 23,
              growth: '+156% senaste 2 veckorna',
              recommendation: 'Skapa ny automation rule för mobile device clustering'
            },
            {
              pattern: 'AI-genererad feedback för belöningar',
              riskLevel: 'medium',
              detectedCases: 12,
              growth: '+89% senaste månaden',
              recommendation: 'Förbättra text-analys för AI-upptäckt'
            }
          ],
          seasonalPatterns: [
            {
              period: 'Sommarsemester (Juli-Aug)',
              impact: 'Minskat bedrägeri (-23%)',
              reason: 'Färre aktiva användare och företag'
            },
            {
              period: 'Black Friday / Cyber Monday',
              impact: 'Ökat bedrägeri (+67%)',
              reason: 'Högre transaktionsvolymer och fler opportunister'
            }
          ]
        },
        riskForecasting: {
          next30Days: {
            expectedBans: 920,
            confidenceInterval: '847-1023',
            riskFactors: ['Ny AI-verktyg tillgängliga', 'Ekonomisk osäkerhet']
          },
          highRiskSegments: [
            {
              segment: 'Nya företag utan Bolagsverket-historik',
              riskScore: 8.7,
              actionRequired: 'Skärpt verifiering'
            },
            {
              segment: 'Kunder med VPN från högriskländer',
              riskScore: 7.3,
              actionRequired: 'Extra kontroller'
            }
          ]
        }
      },

      complianceTracking: {
        swedishLaw: {
          gdprCompliance: {
            score: 99.1,
            areas: {
              'Rättslig grund dokumenterad': 100.0,
              'Integritetsskydd': 98.9,
              'Rätt till överklagande': 99.5,
              'Databehandlingstid': 97.8
            },
            issues: [
              {
                severity: 'low',
                issue: 'Några automatiska beslut tar >72h att dokumentera',
                count: 3,
                action: 'Förbättra automatisk dokumentation'
              }
            ]
          },
          förvaltningsrätt: {
            score: 97.8,
            areas: {
              'Överklagandeprocess': 98.5,
              'Proportionalitetsprincip': 96.2,
              'Motiveringsplikt': 98.9
            }
          },
          brottsbalken: {
            score: 100.0,
            areas: {
              'Bedrägerirapportering': 100.0,
              'Identitetsstöld': 100.0
            }
          }
        },
        auditTrail: {
          completeness: 100.0,
          retention: '5 years (enligt svensk lag)',
          accessibility: 'Inom 30 sekunder',
          encryption: 'AES-256 (FIPS 140-2 Level 2)'
        }
      }
    };

    res.json({
      success: true,
      data: banAnalytics,
      message: 'Ban analytics och effektivitetsspårning laddad framgångsrikt',
      meta: {
        timestamp: new Date().toISOString(),
        datapoints: 847,
        timeframe: timeframe,
        accuracy: '99.2%',
        complianceFramework: 'Swedish Legal Standards + GDPR',
        lastCalculated: '2024-08-25T11:15:00Z'
      }
    });

  } catch (error) {
    console.error('Ban analytics error:', error);
    res.status(500).json({
      code: 'ANALYTICS_ERROR',
      message: 'Kunde inte hämta ban analytics'
    });
  }
});

/**
 * @openapi
 * /api/admin/fraud/ban-effectiveness-report:
 *   post:
 *     summary: Generate detailed effectiveness report for specific time period
 *     tags: [Analytics, Reporting]
 *     security:
 *       - bearerAuth: []
 */
adminRoutes.post('/fraud/ban-effectiveness-report', requirePermission('analytics:read'), async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      format = 'json', 
      includeCharts = false,
      categories = [],
      detailLevel = 'summary'
    } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({
        code: 'MISSING_DATES',
        message: 'Start- och slutdatum krävs för rapport'
      });
    }

    const reportId = `report_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
    const generationTime = new Date().toISOString();

    // Mock comprehensive effectiveness report
    const effectivenessReport = {
      reportId,
      metadata: {
        generatedAt: generationTime,
        timeframe: { startDate, endDate },
        format,
        detailLevel,
        categories: categories.length > 0 ? categories : 'all',
        complianceVersion: 'Swedish Law 2024 + GDPR'
      },

      executiveSummary: {
        totalBansAnalyzed: 847,
        overallEffectiveness: 95.8,
        totalLossPrevented: 1247800,
        automationAccuracy: 94.2,
        complianceScore: 98.3,
        keyFindings: [
          'Identitetsbedrägeri har 100% effektivitet men endast 10.3% av total volym',
          'Spam-detektion behöver förbättras - 10.6% false positive rate',
          'Automatisering har sparat 847 arbetstimmar värt 550,550 SEK',
          'GDPR-efterlevnad är 99.1% - överträffar branschstandard',
          'Förutsedd 35.9% ökning i bedrägeritrender nästa kvartal'
        ],
        recommendations: [
          {
            priority: 1,
            area: 'Automation Optimization',
            action: 'Justera spam-detekteringsalgoritm för att minska false positives',
            expectedImpact: 'Minska false positives med 40%, spara 156h/månad',
            timeline: '2-3 veckor',
            resources: 'AI/ML specialist + 1 utvecklare'
          },
          {
            priority: 2,
            area: 'Pattern Recognition',
            action: 'Implementera ML-modell för koordinerade mobilenhetsattacker',
            expectedImpact: 'Förhindra uppskattningsvis 450,000 SEK i förluster',
            timeline: '4-6 veckor',
            resources: 'Data scientist + säkerhetssspecialist'
          },
          {
            priority: 3,
            area: 'Compliance Enhancement',
            action: 'Automatisera GDPR-dokumentation för <72h compliance',
            expectedImpact: '100% GDPR-efterlevnad inom tidsram',
            timeline: '1-2 veckor',
            resources: 'Compliance officer + backend utvecklare'
          }
        ]
      },

      detailedAnalysis: {
        temporalPatterns: {
          peakHours: [
            { hour: '14:00-15:00', banCount: 89, effectiveness: 96.2 },
            { hour: '10:00-11:00', banCount: 76, effectiveness: 94.8 },
            { hour: '16:00-17:00', banCount: 67, effectiveness: 97.1 }
          ],
          weekdayTrends: {
            monday: { bans: 134, effectiveness: 95.2 },
            tuesday: { bans: 128, effectiveness: 96.1 },
            wednesday: { bans: 119, effectiveness: 94.8 },
            thursday: { bans: 142, effectiveness: 97.2 },
            friday: { bans: 156, effectiveness: 95.8 },
            saturday: { bans: 89, effectiveness: 93.4 },
            sunday: { bans: 79, effectiveness: 92.1 }
          }
        },
        
        geographicDistribution: {
          byRegion: [
            { region: 'Stockholm', bans: 298, effectiveness: 96.7, lossPrevented: 456700 },
            { region: 'Göteborg', bans: 167, effectiveness: 95.2, lossPrevented: 234100 },
            { region: 'Malmö', bans: 134, effectiveness: 94.1, lossPrevented: 189200 },
            { region: 'Uppsala', bans: 89, effectiveness: 97.8, lossPrevented: 123400 },
            { region: 'Övriga Sverige', bans: 159, effectiveness: 93.8, lossPrevented: 244400 }
          ],
          internationalThreats: {
            totalFromAbroad: 67,
            topOrigins: [
              { country: 'Estland', count: 23, blocked: 100 },
              { country: 'Polen', count: 18, blocked: 94.4 },
              { country: 'Tyskland', count: 12, blocked: 91.7 },
              { country: 'Danmark', count: 8, blocked: 87.5 },
              { country: 'Övriga', count: 6, blocked: 100 }
            ]
          }
        }
      },

      riskAssessmentMatrix: {
        currentThreats: [
          {
            threat: 'AI-genererad feedback',
            likelihood: 8.5,
            impact: 7.2,
            riskScore: 61.2,
            mitigation: 'Förbättrad AI-detektering + manuell granskning',
            status: 'under utveckling'
          },
          {
            threat: 'Koordinerade enhetsattacker',
            likelihood: 9.1,
            impact: 8.8,
            riskScore: 80.1,
            mitigation: 'Ny automation rule + improved fingerprinting',
            status: 'akut - implementeras'
          },
          {
            threat: 'Deepfake röstmanipulation',
            likelihood: 4.2,
            impact: 9.5,
            riskScore: 39.9,
            mitigation: 'Voice biometrics + multi-factor authentication',
            status: 'forskning pågår'
          }
        ],
        emergingRisks: [
          'Quantum computing-baserade kryptoattacker (5-10 år)',
          'Sociala ingenjörsattacker med AI-assistans (1-2 år)',
          'Cross-border regulatory compliance (pågående)'
        ]
      },

      swedishComplianceDeep: {
        detailedCompliance: {
          gdpr: {
            artikel6: { score: 100.0, details: 'All behandling har dokumenterad rättslig grund' },
            artikel22: { score: 98.7, details: 'Automatiska beslut följer rätt process, 3 fall utan transparent motivering' },
            artikel17: { score: 100.0, details: 'Alla radering-requests hanterade inom 30 dagar' },
            artikel15: { score: 99.2, details: 'Dataportabilitet implementerad, minor formatting issues' }
          },
          finansinspektionen: {
            compliance: 100.0,
            details: 'Alla finansiella bedrägerier rapporterade enligt AML-krav',
            lastAudit: '2024-06-15',
            nextReview: '2024-12-15'
          },
          konsumentverket: {
            compliance: 97.8,
            details: 'Alla konsumentskydd följs, mindre problem med kommunikation på vissa språk',
            areas: ['Transparent information', 'Fair processing', 'Appeal rights']
          }
        }
      }
    };

    // Handle different output formats
    if (format === 'pdf') {
      // In a real implementation, this would generate a PDF
      effectivenessReport.pdfGeneration = {
        status: 'queued',
        estimatedTime: '2-3 minutes',
        downloadUrl: `/api/admin/reports/download/${reportId}`,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      };
    }

    res.json({
      success: true,
      data: effectivenessReport,
      message: `Effektivitetsrapport genererad för period ${startDate} till ${endDate}`,
      meta: {
        reportId,
        generatedAt: generationTime,
        dataQuality: 'High (99.2% complete)',
        processingTime: '847ms',
        complianceValidated: true
      }
    });

  } catch (error) {
    console.error('Generate effectiveness report error:', error);
    res.status(500).json({
      code: 'REPORT_GENERATION_ERROR', 
      message: 'Kunde inte generera effektivitetsrapport'
    });
  }
});

// =============================================================================
// AI CALIBRATION & PERFORMANCE MONITORING ENDPOINTS
// =============================================================================

/**
 * @swagger
 * /api/admin/ai-calibration/models:
 *   get:
 *     summary: Get AI model performance metrics
 *     tags: [AI Calibration]
 *     security:
 *       - bearerAuth: []
 */
adminRoutes.get('/ai-calibration/models', requirePermission('ai:read'), async (req, res) => {
  try {
    // Mock comprehensive AI model performance data
    const models = [
      {
        modelId: 'qwen2-0.5b-main',
        modelName: 'Qwen2 0.5B (Primary)',
        version: '2024.12.1',
        status: 'active',
        metrics: {
          accuracy: 0.923,
          avgProcessingTime: 1.847,
          swedishAccuracy: 0.941,
          bias: 0.067,
          calibrationScore: 0.891
        },
        lastUpdated: '2024-12-19T14:30:00Z',
        totalEvaluations: 24847,
        expertAgreementRate: 0.887
      },
      {
        modelId: 'gpt4o-mini-fallback',
        modelName: 'GPT-4o Mini (Fallback)',
        version: '2024.11.15',
        status: 'testing',
        metrics: {
          accuracy: 0.945,
          avgProcessingTime: 2.341,
          swedishAccuracy: 0.928,
          bias: 0.041,
          calibrationScore: 0.934
        },
        lastUpdated: '2024-12-18T09:15:00Z',
        totalEvaluations: 1247,
        expertAgreementRate: 0.912
      },
      {
        modelId: 'claude-3-5-haiku-secondary',
        modelName: 'Claude 3.5 Haiku (Secondary)',
        version: '2024.11.20',
        status: 'testing',
        metrics: {
          accuracy: 0.938,
          avgProcessingTime: 1.923,
          swedishAccuracy: 0.951,
          bias: 0.033,
          calibrationScore: 0.948
        },
        lastUpdated: '2024-12-17T16:45:00Z',
        totalEvaluations: 892,
        expertAgreementRate: 0.924
      }
    ];

    res.json({
      success: true,
      data: { models },
      message: 'AI-modellprestanda hämtad framgångsrikt',
      meta: {
        totalModels: models.length,
        activeModels: models.filter(m => m.status === 'active').length,
        avgAccuracy: models.reduce((sum, m) => sum + m.metrics.accuracy, 0) / models.length,
        avgSwedishAccuracy: models.reduce((sum, m) => sum + m.metrics.swedishAccuracy, 0) / models.length
      }
    });

  } catch (error) {
    console.error('Get AI models error:', error);
    res.status(500).json({
      code: 'AI_MODELS_ERROR',
      message: 'Kunde inte hämta AI-modellprestanda'
    });
  }
});

/**
 * @swagger
 * /api/admin/ai-calibration/samples:
 *   get:
 *     summary: Get calibration samples for expert review
 *     tags: [AI Calibration]
 *     security:
 *       - bearerAuth: []
 */
adminRoutes.get('/ai-calibration/samples', requirePermission('ai:read'), async (req, res) => {
  try {
    const { status, category, limit = 50 } = req.query;

    // Mock calibration samples with expert review data
    let samples = [
      {
        id: 'cal_001',
        feedbackText: 'Personalen var mycket trevlig och hjälpsam. Kaffe smakar bra men priset är lite högt. Atmosfären är mysig och jag kommer säkert tillbaka snart.',
        businessContext: 'Café Lundberg - Stockholms innerstad',
        aiScore: 78.2,
        expertScore: 82.0,
        discrepancy: -3.8,
        status: 'reviewed',
        expertNotes: 'AI underskattar den emotionella kopplingen och återbesöksintentionen. Bra språkförståelse.',
        swedishLanguageComplexity: 6.2,
        createdAt: '2024-12-19T10:30:00Z',
        reviewedAt: '2024-12-19T14:15:00Z',
        category: 'authenticity'
      },
      {
        id: 'cal_002', 
        feedbackText: 'Butiken var ren och välorganiserad. Frukt och grönsaker såg fräscha ut. Kassapersonalen var snabb men inte särskilt vänlig.',
        businessContext: 'ICA Maxi - Göteborg',
        aiScore: 71.5,
        expertScore: null,
        discrepancy: 0,
        status: 'pending',
        expertNotes: null,
        swedishLanguageComplexity: 4.8,
        createdAt: '2024-12-19T11:45:00Z',
        reviewedAt: null,
        category: 'concreteness'
      },
      {
        id: 'cal_003',
        feedbackText: 'Maten var okej men inget speciellt. Servicen var långsam. Lokalen behöver renovering.',
        businessContext: 'Restaurang Viking - Malmö',
        aiScore: 45.8,
        expertScore: 52.0,
        discrepancy: -6.2,
        status: 'disputed',
        expertNotes: 'AI missar att kortfattad feedback kan vara lika värdefull. Svenska dialekt påverkar förmodligen bedömningen.',
        swedishLanguageComplexity: 3.1,
        createdAt: '2024-12-18T15:20:00Z',
        reviewedAt: '2024-12-19T09:30:00Z',
        category: 'depth'
      },
      {
        id: 'cal_004',
        feedbackText: 'Fantastiskt urval av produkter! Personalen visste verkligen vad de pratade om när jag frågade om olika vintips. Priser är rimliga för kvaliteten. Kommer definitivt handla här igen.',
        businessContext: 'Systembolaget - Uppsala',
        aiScore: 89.3,
        expertScore: null,
        discrepancy: 0,
        status: 'pending',
        expertNotes: null,
        swedishLanguageComplexity: 7.9,
        createdAt: '2024-12-19T09:15:00Z',
        reviewedAt: null,
        category: 'depth'
      },
      {
        id: 'cal_005',
        feedbackText: 'Bra sortiment men personalen verkade stressad. Köerna var långa och det fanns inte tillräckligt med kassörer. Parkering var också svår att hitta.',
        businessContext: 'Coop Forum - Linköping', 
        aiScore: 68.7,
        expertScore: 71.5,
        discrepancy: -2.8,
        status: 'reviewed',
        expertNotes: 'AI hanterar operational feedback bra. Liten diskrepans inom acceptabelt intervall.',
        swedishLanguageComplexity: 5.6,
        createdAt: '2024-12-18T16:45:00Z',
        reviewedAt: '2024-12-19T08:20:00Z',
        category: 'concreteness'
      }
    ];

    // Apply filters
    if (status && status !== 'all') {
      samples = samples.filter(s => s.status === status);
    }
    if (category && category !== 'all') {
      samples = samples.filter(s => s.category === category);
    }

    // Apply limit
    samples = samples.slice(0, parseInt(limit as string));

    res.json({
      success: true,
      data: { samples },
      message: 'Kalibreringsprover hämtade framgångsrikt',
      meta: {
        totalSamples: samples.length,
        pendingReviews: samples.filter(s => s.status === 'pending').length,
        averageDiscrepancy: samples.filter(s => s.expertScore).reduce((sum, s) => sum + Math.abs(s.discrepancy), 0) / samples.filter(s => s.expertScore).length || 0,
        statusBreakdown: {
          pending: samples.filter(s => s.status === 'pending').length,
          reviewed: samples.filter(s => s.status === 'reviewed').length,
          disputed: samples.filter(s => s.status === 'disputed').length
        }
      }
    });

  } catch (error) {
    console.error('Get calibration samples error:', error);
    res.status(500).json({
      code: 'CALIBRATION_SAMPLES_ERROR',
      message: 'Kunde inte hämta kalibreringsprover'
    });
  }
});

/**
 * @swagger
 * /api/admin/ai-calibration/samples/{sampleId}/review:
 *   post:
 *     summary: Submit expert review for calibration sample
 *     tags: [AI Calibration]
 *     security:
 *       - bearerAuth: []
 */
adminRoutes.post('/ai-calibration/samples/:sampleId/review', requirePermission('ai:calibrate'), async (req, res) => {
  try {
    const { sampleId } = req.params;
    const { expertScore, notes } = req.body;

    if (!expertScore || expertScore < 0 || expertScore > 100) {
      return res.status(400).json({
        code: 'INVALID_SCORE',
        message: 'Expertpoäng måste vara mellan 0 och 100'
      });
    }

    // Mock saving expert review
    const reviewData = {
      sampleId,
      expertScore: parseFloat(expertScore),
      notes: notes || '',
      reviewedBy: req.user?.id,
      reviewedAt: new Date().toISOString(),
      discrepancy: Math.abs(parseFloat(expertScore) - 75.0), // Mock AI score for calculation
      calibrationImpact: {
        beforeAccuracy: 0.923,
        afterAccuracy: 0.927,
        modelImprovementScore: 0.004
      }
    };

    res.json({
      success: true,
      data: reviewData,
      message: 'Expertgranskning sparad framgångsrikt',
      meta: {
        sampleId,
        willTriggerRecalibration: Math.abs(reviewData.discrepancy) > 10,
        estimatedImpact: 'Low-Medium',
        processingTime: '234ms'
      }
    });

  } catch (error) {
    console.error('Submit expert review error:', error);
    res.status(500).json({
      code: 'EXPERT_REVIEW_ERROR',
      message: 'Kunde inte spara expertgranskning'
    });
  }
});

/**
 * @swagger
 * /api/admin/ai-calibration/ab-tests:
 *   get:
 *     summary: Get A/B testing results for AI models
 *     tags: [AI Calibration]
 *     security:
 *       - bearerAuth: []
 */
adminRoutes.get('/ai-calibration/ab-tests', requirePermission('ai:read'), async (req, res) => {
  try {
    const { status } = req.query;

    // Mock A/B testing data
    let tests = [
      {
        id: 'test_qwen_vs_gpt4o',
        name: 'Qwen2 0.5B vs GPT-4o Mini Precision Test',
        status: 'running',
        modelA: 'qwen2-0.5b-main',
        modelB: 'gpt4o-mini-fallback',
        startDate: '2024-12-15T00:00:00Z',
        endDate: null,
        metrics: {
          samplesA: 1247,
          samplesB: 1198,
          accuracyA: 0.923,
          accuracyB: 0.945,
          expertPreference: 0.34 // Positive means B preferred
        },
        statisticalSignificance: 0.89,
        swedishSpecific: {
          accuracyA: 0.941,
          accuracyB: 0.928,
          complexTextHandlingA: 0.887,
          complexTextHandlingB: 0.912
        }
      },
      {
        id: 'test_claude_vs_qwen', 
        name: 'Claude 3.5 Haiku vs Qwen2 0.5B Swedish Quality',
        status: 'completed',
        modelA: 'claude-3-5-haiku-secondary',
        modelB: 'qwen2-0.5b-main',
        startDate: '2024-12-01T00:00:00Z',
        endDate: '2024-12-14T23:59:59Z',
        metrics: {
          samplesA: 2847,
          samplesB: 2793,
          accuracyA: 0.938,
          accuracyB: 0.923,
          expertPreference: 0.12 // Slight preference for A (Claude)
        },
        statisticalSignificance: 0.94,
        swedishSpecific: {
          accuracyA: 0.951,
          accuracyB: 0.941,
          complexTextHandlingA: 0.924,
          complexTextHandlingB: 0.887
        }
      },
      {
        id: 'test_speed_vs_quality',
        name: 'Speed vs Quality Trade-off Analysis',
        status: 'paused',
        modelA: 'qwen2-0.5b-speed-optimized',
        modelB: 'qwen2-0.5b-quality-optimized', 
        startDate: '2024-12-10T00:00:00Z',
        endDate: null,
        metrics: {
          samplesA: 456,
          samplesB: 423,
          accuracyA: 0.912,
          accuracyB: 0.931,
          expertPreference: -0.18 // Slight preference for A (speed)
        },
        statisticalSignificance: 0.67,
        swedishSpecific: {
          accuracyA: 0.925,
          accuracyB: 0.943,
          complexTextHandlingA: 0.853,
          complexTextHandlingB: 0.891
        }
      }
    ];

    if (status && status !== 'all') {
      tests = tests.filter(t => t.status === status);
    }

    res.json({
      success: true,
      data: { tests },
      message: 'A/B-tester hämtade framgångsrikt',
      meta: {
        totalTests: tests.length,
        runningTests: tests.filter(t => t.status === 'running').length,
        completedTests: tests.filter(t => t.status === 'completed').length,
        averageSignificance: tests.reduce((sum, t) => sum + t.statisticalSignificance, 0) / tests.length,
        totalSamples: tests.reduce((sum, t) => sum + t.metrics.samplesA + t.metrics.samplesB, 0)
      }
    });

  } catch (error) {
    console.error('Get A/B tests error:', error);
    res.status(500).json({
      code: 'AB_TESTS_ERROR',
      message: 'Kunde inte hämta A/B-tester'
    });
  }
});

/**
 * @swagger
 * /api/admin/ai-calibration/ab-tests:
 *   post:
 *     summary: Create new A/B test for AI models
 *     tags: [AI Calibration]
 *     security:
 *       - bearerAuth: []
 */
adminRoutes.post('/ai-calibration/ab-tests', requirePermission('ai:manage'), async (req, res) => {
  try {
    const { name, modelA, modelB, duration = 14 } = req.body;

    if (!name || !modelA || !modelB) {
      return res.status(400).json({
        code: 'MISSING_TEST_PARAMS',
        message: 'Testnamn och båda modeller krävs'
      });
    }

    if (modelA === modelB) {
      return res.status(400).json({
        code: 'SAME_MODELS',
        message: 'A/B-test kräver två olika modeller'
      });
    }

    const testId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
    const startDate = new Date().toISOString();
    const endDate = new Date(Date.now() + duration * 24 * 60 * 60 * 1000).toISOString();

    const newTest = {
      id: testId,
      name,
      status: 'running',
      modelA,
      modelB,
      startDate,
      endDate,
      duration,
      createdBy: req.user?.id,
      expectedSamples: Math.floor(100 * duration), // Estimate based on duration
      metrics: {
        samplesA: 0,
        samplesB: 0,
        accuracyA: 0,
        accuracyB: 0,
        expertPreference: 0
      },
      statisticalSignificance: 0,
      configuration: {
        targetSamples: Math.floor(100 * duration),
        confidenceLevel: 0.95,
        minimumEffectSize: 0.05,
        swedishFocus: true
      }
    };

    res.status(201).json({
      success: true,
      data: newTest,
      message: `A/B-test "${name}" skapad och startad`,
      meta: {
        testId,
        estimatedCompletion: endDate,
        targetSamples: newTest.configuration.targetSamples,
        processingTime: '156ms'
      }
    });

  } catch (error) {
    console.error('Create A/B test error:', error);
    res.status(500).json({
      code: 'CREATE_AB_TEST_ERROR',
      message: 'Kunde inte skapa A/B-test'
    });
  }
});

/**
 * @swagger
 * /api/admin/ai-calibration/swedish-metrics:
 *   get:
 *     summary: Get Swedish language specific AI performance metrics
 *     tags: [AI Calibration]
 *     security:
 *       - bearerAuth: []
 */
adminRoutes.get('/ai-calibration/swedish-metrics', requirePermission('ai:read'), async (req, res) => {
  try {
    const swedishMetrics = {
      overallSwedishAccuracy: 0.942,
      dialectRecognition: {
        stockholm: 0.971,
        göteborg: 0.945,
        skåne: 0.912,
        norrland: 0.889,
        småland: 0.923
      },
      complexityHandling: {
        averageComplexity: 8.7,
        highComplexity: 0.887, // >8 complexity score
        mediumComplexity: 0.934, // 5-8 complexity
        lowComplexity: 0.967 // <5 complexity
      },
      languagePatterns: {
        businessTerminology: 0.956,
        colloquialExpressions: 0.923,
        technicalLanguage: 0.891,
        emotionalLanguage: 0.934
      },
      processingTimes: {
        swedish: 2.31,
        englishFallback: 1.87,
        mixedLanguage: 2.89
      },
      commonChallenges: [
        {
          pattern: 'Implicit cultural references',
          frequency: 23.4,
          accuracyImpact: -0.067,
          example: 'Som på ICA Maxi fast bättre'
        },
        {
          pattern: 'Regional business naming',
          frequency: 18.9,
          accuracyImpact: -0.043,
          example: 'Hos Konsum var det...'
        },
        {
          pattern: 'Compound word variations',
          frequency: 31.2,
          accuracyImpact: -0.029,
          example: 'kundbetjäning vs kundservice'
        }
      ],
      improvementTrends: {
        last30Days: {
          accuracy: 0.018,
          processingSpeed: -0.234,
          dialectHandling: 0.023
        },
        last90Days: {
          accuracy: 0.047,
          processingSpeed: -0.891,
          dialectHandling: 0.056
        }
      }
    };

    res.json({
      success: true,
      data: swedishMetrics,
      message: 'Svenska språkspecifika AI-mått hämtade framgångsrikt',
      meta: {
        generatedAt: new Date().toISOString(),
        dataPoints: 24847,
        timeframe: 'last_90_days',
        confidence: 0.94
      }
    });

  } catch (error) {
    console.error('Get Swedish metrics error:', error);
    res.status(500).json({
      code: 'SWEDISH_METRICS_ERROR', 
      message: 'Kunde inte hämta svenska språkmått'
    });
  }
});

// =============================================================================
// SCORE OVERRIDE & MANUAL ADJUSTMENT ENDPOINTS
// =============================================================================

/**
 * @swagger
 * /api/admin/score-overrides:
 *   get:
 *     summary: Get score overrides with filtering and pagination
 *     tags: [Score Overrides]
 *     security:
 *       - bearerAuth: []
 */
adminRoutes.get('/score-overrides', requirePermission('feedback:override'), async (req, res) => {
  try {
    const { status, category, limit = 50, offset = 0 } = req.query;

    // Mock comprehensive score override data
    let overrides = [
      {
        id: 'override_001',
        feedbackId: 'feedback_12345',
        originalScore: 67.3,
        newScore: 82.0,
        scoreDifference: 14.7,
        reason: 'AI missade emotionell koppling',
        justification: 'Kunden uttryckte stark emotionell koppling till produkten och tydlig intention att återkomma, vilket AI:n inte värderade tillräckligt högt. Den ursprungliga poängen på 67.3 reflekterar inte den verkliga kvaliteten på feedbacken.',
        category: 'ai_error',
        overriddenBy: {
          id: 'admin_001',
          name: 'Anna Andersson',
          role: 'super_admin'
        },
        overriddenAt: '2024-12-19T14:30:00Z',
        businessContext: {
          businessName: 'Café Lundberg',
          businessId: 'business_001',
          locationName: 'Stockholms Innerstad'
        },
        feedbackData: {
          text: 'Personalen var verkligen fantastisk idag! Baristan tog sig tid att förklara de olika kaffetyperna och gav perfekta rekommendationer. Atmosfären är så mysig och jag känner mig alltid välkommen här. Detta är definitivt min favoritcafé nu och jag kommer säkert tillbaka nästa vecka.',
          originalCategories: ['service', 'atmosphere', 'product'],
          customerHash: 'customer_abc123',
          sessionId: 'session_789'
        },
        impactData: {
          rewardChange: 47.25, // Increased reward due to higher score
          commissionChange: 9.45, // 20% of reward change
          customerNotified: true,
          businessNotified: true
        },
        status: 'applied',
        reviewedBy: {
          id: 'admin_002',
          name: 'Lars Svensson',
          role: 'admin'
        },
        reviewedAt: '2024-12-19T15:45:00Z',
        reviewNotes: 'Korrekt bedömning - AI:n undervärdering av emotionell koppling.'
      }
    ];

    // Apply filters
    if (status && status !== 'all') {
      overrides = overrides.filter(o => o.status === status);
    }
    if (category && category !== 'all') {
      overrides = overrides.filter(o => o.category === category);
    }

    // Apply pagination
    const paginatedOverrides = overrides.slice(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string));

    res.json({
      success: true,
      data: {
        overrides: paginatedOverrides,
        total: overrides.length,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      },
      message: 'Poängändringar hämtade framgångsrikt'
    });

  } catch (error) {
    console.error('Get score overrides error:', error);
    res.status(500).json({
      code: 'SCORE_OVERRIDES_ERROR',
      message: 'Kunde inte hämta poängändringar'
    });
  }
});

/**
 * @swagger
 * /api/admin/score-overrides:
 *   post:
 *     summary: Create new individual score override
 *     tags: [Score Overrides]
 *     security:
 *       - bearerAuth: []
 */
adminRoutes.post('/score-overrides', requirePermission('feedback:override'), async (req, res) => {
  try {
    const { feedbackId, newScore, reason, justification, category } = req.body;

    if (!feedbackId || newScore == null || !reason || !justification) {
      return res.status(400).json({
        code: 'MISSING_REQUIRED_FIELDS',
        message: 'Feedback ID, ny poäng, anledning och motivering krävs'
      });
    }

    if (newScore < 0 || newScore > 100) {
      return res.status(400).json({
        code: 'INVALID_SCORE',
        message: 'Poäng måste vara mellan 0 och 100'
      });
    }

    const overrideId = `override_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
    
    const newOverride = {
      id: overrideId,
      feedbackId,
      originalScore: 75.5, // Mock original score
      newScore: parseFloat(newScore),
      scoreDifference: parseFloat(newScore) - 75.5,
      reason,
      justification,
      category: category || 'quality_assurance',
      status: 'pending'
    };

    res.status(201).json({
      success: true,
      data: newOverride,
      message: 'Poängändring skapad och skickad för granskning'
    });

  } catch (error) {
    console.error('Create score override error:', error);
    res.status(500).json({
      code: 'CREATE_OVERRIDE_ERROR',
      message: 'Kunde inte skapa poängändring'
    });
  }
});

/**
 * @swagger
 * /api/admin/score-overrides/bulk:
 *   get:
 *     summary: Get bulk score override operations
 *     tags: [Score Overrides]
 *     security:
 *       - bearerAuth: []
 */
adminRoutes.get('/score-overrides/bulk', requirePermission('feedback:bulk_override'), async (req, res) => {
  try {
    // Mock bulk operations data
    const operations = [
      {
        id: 'bulk_001',
        name: 'Q4 2024 AI Kalibrering',
        description: 'Systematisk uppjustering av emotionell feedback',
        status: 'completed',
        affectedCount: 247,
        estimatedImpact: {
          totalRewardChange: 52847.50,
          businessesAffected: 15
        }
      }
    ];

    res.json({
      success: true,
      data: { operations },
      message: 'Massoperationer hämtade framgångsrikt'
    });

  } catch (error) {
    console.error('Get bulk operations error:', error);
    res.status(500).json({
      code: 'BULK_OPERATIONS_ERROR',
      message: 'Kunde inte hämta massoperationer'
    });
  }
});

/**
 * @swagger
 * /api/admin/score-overrides/analytics:
 *   get:
 *     summary: Get score override analytics and patterns
 *     tags: [Score Overrides]
 *     security:
 *       - bearerAuth: []
 */
adminRoutes.get('/score-overrides/analytics', requirePermission('analytics:read'), async (req, res) => {
  try {
    // Mock analytics data
    const analytics = {
      summary: {
        totalOverrides: 1247,
        pendingApproval: 23,
        averageScoreChange: 11.7,
        totalRewardImpact: 284751.50
      },
      trends: {
        overridesByCategory: {
          'ai_error': 445,
          'systematic_correction': 312,
          'quality_assurance': 267,
          'customer_complaint': 156,
          'business_request': 67
        },
        overridesByReason: {
          'AI missade emotionell koppling': 234,
          'Undervärdering av kort specifik feedback': 189,
          'Svenska dialekt/regional språk': 156
        },
        monthlyOverrides: [
          { month: '2024-10', count: 203, avgChange: 13.4 },
          { month: '2024-11', count: 298, avgChange: 11.9 },
          { month: '2024-12', count: 356, avgChange: 11.2 }
        ]
      },
      patterns: {
        frequentOverriders: [
          { name: 'Anna Andersson', count: 234, avgChange: 13.5 },
          { name: 'Lars Svensson', count: 189, avgChange: 9.8 },
          { name: 'Maria Nilsson', count: 156, avgChange: 12.3 }
        ],
        businessesWithMostOverrides: [
          { name: 'Café Lundberg', count: 67, avgChange: 14.2 },
          { name: 'ICA Maxi Göteborg', count: 45, avgChange: -8.9 },
          { name: 'Restaurang Viking', count: 43, avgChange: 11.7 }
        ],
        commonJustifications: [
          { 
            text: 'AI missade emotionell koppling', 
            frequency: 89, 
            avgChange: 16.3 
          },
          { 
            text: 'Kort feedback men mycket specifik', 
            frequency: 67, 
            avgChange: 12.8 
          }
        ]
      }
    };

    res.json({
      success: true,
      data: { analytics },
      message: 'Override-analys hämtad framgångsrikt'
    });

  } catch (error) {
    console.error('Get override analytics error:', error);
    res.status(500).json({
      code: 'OVERRIDE_ANALYTICS_ERROR',
      message: 'Kunde inte hämta override-analys'
    });
  }
});

