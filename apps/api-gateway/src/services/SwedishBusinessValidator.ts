/**
 * Swedish Business Validation Service
 * Automated approval criteria checking for Swedish businesses
 * Handles Bolagsverket validation, compliance checking, and risk assessment
 */

interface BusinessApplication {
  id: string;
  name: string;
  organizationNumber: string;
  contactEmail: string;
  contactPhone: string;
  address: {
    street: string;
    city: string;
    postalCode: string;
    region: string;
  };
  businessType: string;
  estimatedMonthlyTransactions: number;
  expectedCustomerVolume: number;
  documents?: {
    organizationCertificate?: Document;
    businessLicense?: Document;
    bankStatement?: Document;
  };
}

interface Document {
  filename: string;
  uploadedAt: string;
  size: number;
  extractedData?: any;
}

interface ValidationResult {
  isValid: boolean;
  score: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high';
  automaticApprovalEligible: boolean;
  requiresManualReview: boolean;
  flags: ValidationFlag[];
  checks: ValidationChecks;
  recommendation: ApprovalRecommendation;
  auditTrail: ValidationAuditTrail;
}

interface ValidationFlag {
  type: 'warning' | 'error' | 'info';
  category: 'organization' | 'documents' | 'risk' | 'compliance' | 'business';
  code: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  resolutionRequired: boolean;
}

interface ValidationChecks {
  organizationNumber: {
    valid: boolean;
    exists: boolean;
    active: boolean;
    registrationDate?: string;
    companyForm?: string;
    shareCapital?: number;
  };
  address: {
    verified: boolean;
    businessPremises: boolean;
    matchesBolagsverket: boolean;
    region: string;
    postalCodeValid: boolean;
  };
  documents: {
    organizationCertificate: DocumentValidation;
    businessLicense: DocumentValidation;
    bankStatement: DocumentValidation;
    completeness: number; // 0-100%
  };
  financial: {
    creditScore?: number;
    bankAccountVerified: boolean;
    sufficientActivity: boolean;
    averageBalance?: number;
    debtStatus: 'clear' | 'minor' | 'concerning' | 'blocked';
  };
  compliance: {
    vatRegistered: boolean;
    taxCompliant: boolean;
    amlCompliant: boolean;
    finansinspektionCleared: boolean;
    sanctionsCheck: boolean;
  };
  risk: {
    industryRisk: 'low' | 'medium' | 'high';
    geographicRisk: 'low' | 'medium' | 'high';
    operationalRisk: 'low' | 'medium' | 'high';
    reputationalRisk: 'low' | 'medium' | 'high';
    overallRisk: 'low' | 'medium' | 'high';
  };
}

interface DocumentValidation {
  present: boolean;
  validated: boolean;
  authentic: boolean;
  current: boolean;
  extractedCorrectly: boolean;
  flags: string[];
}

interface ApprovalRecommendation {
  action: 'auto_approve' | 'manual_review' | 'request_documents' | 'reject';
  tier: 1 | 2 | 3;
  conditions?: string[];
  reasoning: string;
  confidence: number; // 0-100%
  reviewPriority: 'low' | 'normal' | 'high' | 'urgent';
}

interface ValidationAuditTrail {
  timestamp: string;
  validatorVersion: string;
  processingTime: number; // milliseconds
  rulesApplied: string[];
  externalAPICalls: {
    bolagsverket: boolean;
    creditCheck: boolean;
    sanctionsDatabase: boolean;
    addressValidation: boolean;
  };
  decision: string;
  reviewRequired: boolean;
}

export class SwedishBusinessValidator {
  private readonly VALIDATION_VERSION = '2.1.0';
  private readonly AUTO_APPROVAL_THRESHOLD = 85;
  private readonly MANUAL_REVIEW_THRESHOLD = 60;

  /**
   * Main validation method - evaluates a business application
   */
  async validateBusinessApplication(application: BusinessApplication): Promise<ValidationResult> {
    const startTime = Date.now();
    
    try {
      // Step 1: Organization number validation
      const orgValidation = await this.validateOrganizationNumber(application.organizationNumber);
      
      // Step 2: Address validation
      const addressValidation = await this.validateAddress(application.address);
      
      // Step 3: Document validation
      const docValidation = await this.validateDocuments(application.documents);
      
      // Step 4: Financial assessment
      const financialValidation = await this.validateFinancialStatus(application);
      
      // Step 5: Compliance checks
      const complianceValidation = await this.validateCompliance(application);
      
      // Step 6: Risk assessment
      const riskValidation = await this.assessRisk(application);
      
      // Compile all validation results
      const checks: ValidationChecks = {
        organizationNumber: orgValidation,
        address: addressValidation,
        documents: docValidation,
        financial: financialValidation,
        compliance: complianceValidation,
        risk: riskValidation
      };
      
      // Calculate overall score
      const score = this.calculateOverallScore(checks);
      
      // Determine risk level
      const riskLevel = this.determineRiskLevel(score, checks);
      
      // Generate flags
      const flags = this.generateValidationFlags(checks, application);
      
      // Generate recommendation
      const recommendation = this.generateRecommendation(score, riskLevel, checks, flags);
      
      // Create audit trail
      const auditTrail: ValidationAuditTrail = {
        timestamp: new Date().toISOString(),
        validatorVersion: this.VALIDATION_VERSION,
        processingTime: Date.now() - startTime,
        rulesApplied: this.getAppliedRules(checks),
        externalAPICalls: {
          bolagsverket: true,
          creditCheck: financialValidation.creditScore !== undefined,
          sanctionsDatabase: complianceValidation.sanctionsCheck,
          addressValidation: addressValidation.verified
        },
        decision: recommendation.action,
        reviewRequired: recommendation.action === 'manual_review'
      };
      
      return {
        isValid: score >= this.MANUAL_REVIEW_THRESHOLD,
        score,
        riskLevel,
        automaticApprovalEligible: recommendation.action === 'auto_approve',
        requiresManualReview: recommendation.action === 'manual_review',
        flags,
        checks,
        recommendation,
        auditTrail
      };
      
    } catch (error) {
      console.error('Validation error:', error);
      
      // Return safe fallback requiring manual review
      return this.createFailsafeValidation(application, error);
    }
  }

  /**
   * Validates Swedish organization number against Bolagsverket
   */
  private async validateOrganizationNumber(orgNumber: string) {
    // Swedish organization number format: XXXXXX-XXXX
    const orgNumberPattern = /^\d{6}-?\d{4}$/;
    const cleanOrgNumber = orgNumber.replace(/\s/g, '');
    
    const isValidFormat = orgNumberPattern.test(cleanOrgNumber);
    
    if (!isValidFormat) {
      return {
        valid: false,
        exists: false,
        active: false,
        registrationDate: null,
        companyForm: null,
        shareCapital: null
      };
    }
    
    // Mock Bolagsverket API call (in production, integrate with actual API)
    const bolagsverketData = await this.mockBolagsverketLookup(cleanOrgNumber);
    
    return {
      valid: isValidFormat && bolagsverketData.exists,
      exists: bolagsverketData.exists,
      active: bolagsverketData.status === 'Aktiv',
      registrationDate: bolagsverketData.registrationDate,
      companyForm: bolagsverketData.companyForm,
      shareCapital: bolagsverketData.shareCapital
    };
  }

  /**
   * Validates Swedish business address
   */
  private async validateAddress(address: any) {
    const swedishPostalCodePattern = /^\d{3}\s?\d{2}$/;
    const swedishRegions = [
      'Stockholm', 'Göteborg', 'Malmö', 'Uppsala', 'Linköping', 'Örebro', 
      'Västerås', 'Norrköping', 'Helsingborg', 'Umeå', 'Gävle', 'Sundsvall',
      'Västra Götaland', 'Skåne', 'Östergötland', 'Södermanland', 'Dalarna',
      'Västmanland', 'Gävleborg', 'Västernorrland', 'Jämtland', 'Västerbotten',
      'Norrbotten', 'Gotland', 'Kronoberg', 'Kalmar', 'Blekinge', 'Halland'
    ];
    
    const postalCodeValid = swedishPostalCodePattern.test(address.postalCode);
    const regionRecognized = swedishRegions.some(region => 
      address.region.toLowerCase().includes(region.toLowerCase()) ||
      address.city.toLowerCase().includes(region.toLowerCase())
    );
    
    // Mock address validation service
    const addressVerified = postalCodeValid && regionRecognized && 
                           address.street && address.city;
    
    return {
      verified: addressVerified,
      businessPremises: true, // Would check if it's a valid business address
      matchesBolagsverket: true, // Would verify against Bolagsverket records
      region: address.region,
      postalCodeValid
    };
  }

  /**
   * Validates uploaded documents
   */
  private async validateDocuments(documents?: any): Promise<any> {
    if (!documents) {
      return {
        organizationCertificate: { present: false, validated: false, authentic: false, current: false, extractedCorrectly: false, flags: ['missing'] },
        businessLicense: { present: false, validated: false, authentic: false, current: false, extractedCorrectly: false, flags: ['missing'] },
        bankStatement: { present: false, validated: false, authentic: false, current: false, extractedCorrectly: false, flags: ['missing'] },
        completeness: 0
      };
    }
    
    const validateDocument = (doc: any): DocumentValidation => {
      if (!doc) {
        return {
          present: false,
          validated: false,
          authentic: false,
          current: false,
          extractedCorrectly: false,
          flags: ['missing']
        };
      }
      
      const flags: string[] = [];
      
      // Check document age (should be recent)
      const uploadDate = new Date(doc.uploadedAt);
      const daysSinceUpload = (Date.now() - uploadDate.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysSinceUpload > 90) {
        flags.push('old_document');
      }
      
      // Mock validation - in production would use OCR/AI for document verification
      return {
        present: true,
        validated: true,
        authentic: Math.random() > 0.1, // 90% authentic rate for mock
        current: daysSinceUpload <= 30,
        extractedCorrectly: true,
        flags
      };
    };
    
    const orgCert = validateDocument(documents.organizationCertificate);
    const bizLicense = validateDocument(documents.businessLicense);
    const bankStmt = validateDocument(documents.bankStatement);
    
    const completeness = Math.round(
      ([orgCert, bizLicense, bankStmt].filter(d => d.present).length / 3) * 100
    );
    
    return {
      organizationCertificate: orgCert,
      businessLicense: bizLicense,
      bankStatement: bankStmt,
      completeness
    };
  }

  /**
   * Validates financial status and creditworthiness
   */
  private async validateFinancialStatus(application: BusinessApplication) {
    // Mock credit check (in production, integrate with Swedish credit agencies)
    const creditScore = Math.floor(Math.random() * 40) + 60; // 60-100 range
    
    const bankStatement = application.documents?.bankStatement;
    const hasRecentBankActivity = bankStatement && 
      ((Date.now() - new Date(bankStatement.uploadedAt).getTime()) / (1000 * 60 * 60 * 24)) <= 30;
    
    return {
      creditScore,
      bankAccountVerified: !!bankStatement,
      sufficientActivity: hasRecentBankActivity,
      averageBalance: bankStatement ? Math.floor(Math.random() * 500000) + 50000 : undefined, // 50k-550k SEK
      debtStatus: creditScore >= 80 ? 'clear' as const : 
                  creditScore >= 60 ? 'minor' as const :
                  creditScore >= 40 ? 'concerning' as const : 'blocked' as const
    };
  }

  /**
   * Validates Swedish regulatory compliance
   */
  private async validateCompliance(application: BusinessApplication) {
    // Mock compliance checks (in production, integrate with Swedish authorities)
    return {
      vatRegistered: Math.random() > 0.1, // 90% VAT registered
      taxCompliant: Math.random() > 0.05, // 95% tax compliant
      amlCompliant: Math.random() > 0.02, // 98% AML compliant
      finansinspektionCleared: Math.random() > 0.01, // 99% cleared
      sanctionsCheck: Math.random() > 0.005 // 99.5% clear of sanctions
    };
  }

  /**
   * Assesses business and operational risk
   */
  private assessRisk(application: BusinessApplication) {
    const businessTypeRisk = this.getBusinessTypeRisk(application.businessType);
    const volumeRisk = this.getVolumeRisk(application.estimatedMonthlyTransactions);
    const geographicRisk = this.getGeographicRisk(application.address.region);
    
    const risks = {
      industryRisk: businessTypeRisk,
      geographicRisk: geographicRisk,
      operationalRisk: volumeRisk,
      reputationalRisk: 'low' as const, // Default low, would check databases
      overallRisk: this.calculateOverallRisk([businessTypeRisk, volumeRisk, geographicRisk])
    };
    
    return risks;
  }

  /**
   * Calculate overall validation score
   */
  private calculateOverallScore(checks: ValidationChecks): number {
    let score = 0;
    
    // Organization (25 points)
    if (checks.organizationNumber.valid) score += 15;
    if (checks.organizationNumber.active) score += 10;
    
    // Documents (20 points)
    score += (checks.documents.completeness / 100) * 20;
    
    // Address (10 points)
    if (checks.address.verified) score += 10;
    
    // Financial (20 points)
    if (checks.financial.creditScore) {
      score += (checks.financial.creditScore / 100) * 20;
    }
    
    // Compliance (15 points)
    const complianceChecks = [
      checks.compliance.vatRegistered,
      checks.compliance.taxCompliant,
      checks.compliance.amlCompliant,
      checks.compliance.finansinspektionCleared,
      checks.compliance.sanctionsCheck
    ];
    score += (complianceChecks.filter(Boolean).length / 5) * 15;
    
    // Risk (10 points) - inverse scoring
    const riskScore = checks.risk.overallRisk === 'low' ? 10 : 
                      checks.risk.overallRisk === 'medium' ? 5 : 0;
    score += riskScore;
    
    return Math.min(100, Math.round(score));
  }

  /**
   * Determine risk level based on score and checks
   */
  private determineRiskLevel(score: number, checks: ValidationChecks): 'low' | 'medium' | 'high' {
    if (score >= 85 && checks.risk.overallRisk === 'low') return 'low';
    if (score >= 60 && checks.risk.overallRisk !== 'high') return 'medium';
    return 'high';
  }

  /**
   * Generate validation flags based on checks
   */
  private generateValidationFlags(checks: ValidationChecks, application: BusinessApplication): ValidationFlag[] {
    const flags: ValidationFlag[] = [];
    
    // Organization flags
    if (!checks.organizationNumber.valid) {
      flags.push({
        type: 'error',
        category: 'organization',
        code: 'INVALID_ORG_NUMBER',
        message: 'Organisationsnummer är ogiltigt',
        severity: 'critical',
        resolutionRequired: true
      });
    }
    
    // Document flags
    if (checks.documents.completeness < 100) {
      flags.push({
        type: 'warning',
        category: 'documents',
        code: 'INCOMPLETE_DOCUMENTS',
        message: `Dokumentation ${checks.documents.completeness}% komplett`,
        severity: 'medium',
        resolutionRequired: true
      });
    }
    
    // Financial flags
    if (checks.financial.debtStatus === 'concerning' || checks.financial.debtStatus === 'blocked') {
      flags.push({
        type: 'error',
        category: 'risk',
        code: 'FINANCIAL_CONCERNS',
        message: 'Ekonomiska problem identifierade',
        severity: 'high',
        resolutionRequired: true
      });
    }
    
    // Risk flags
    if (checks.risk.overallRisk === 'high') {
      flags.push({
        type: 'warning',
        category: 'risk',
        code: 'HIGH_RISK_BUSINESS',
        message: 'Högriskverksamhet identifierad',
        severity: 'high',
        resolutionRequired: true
      });
    }
    
    // Compliance flags
    if (!checks.compliance.sanctionsCheck) {
      flags.push({
        type: 'error',
        category: 'compliance',
        code: 'SANCTIONS_HIT',
        message: 'Träff i sanktionsdatabas',
        severity: 'critical',
        resolutionRequired: true
      });
    }
    
    return flags;
  }

  /**
   * Generate approval recommendation
   */
  private generateRecommendation(
    score: number, 
    riskLevel: 'low' | 'medium' | 'high', 
    checks: ValidationChecks, 
    flags: ValidationFlag[]
  ): ApprovalRecommendation {
    
    const criticalFlags = flags.filter(f => f.severity === 'critical');
    const highSeverityFlags = flags.filter(f => f.severity === 'high');
    
    // Automatic rejection criteria
    if (criticalFlags.length > 0 || score < 40) {
      return {
        action: 'reject',
        tier: 1,
        reasoning: `Kritiska problem identifierade: ${criticalFlags.map(f => f.message).join(', ')}`,
        confidence: 95,
        reviewPriority: 'high'
      };
    }
    
    // Document request
    if (checks.documents.completeness < 80) {
      return {
        action: 'request_documents',
        tier: 1,
        reasoning: 'Ofullständig dokumentation - begär komplettering',
        confidence: 90,
        reviewPriority: 'normal'
      };
    }
    
    // Automatic approval criteria
    if (score >= this.AUTO_APPROVAL_THRESHOLD && 
        riskLevel === 'low' && 
        highSeverityFlags.length === 0 &&
        checks.documents.completeness === 100) {
      
      const tier = this.determineTier(score, checks);
      
      return {
        action: 'auto_approve',
        tier,
        reasoning: `Hög kvalitetspoäng (${score}/100) och låg risk - automatiskt godkännande`,
        confidence: 95,
        reviewPriority: 'low'
      };
    }
    
    // Manual review required
    return {
      action: 'manual_review',
      tier: this.determineTier(score, checks),
      conditions: highSeverityFlags.length > 0 ? ['Åtgärda högriskflaggor'] : [],
      reasoning: score >= 60 ? 
        'Kvalificerar för godkännande men kräver manuell granskning' :
        'Under kvalitetströskeln - detaljerad granskning krävs',
      confidence: 85,
      reviewPriority: score >= 60 ? 'normal' : 'high'
    };
  }

  // Helper methods
  private getBusinessTypeRisk(businessType: string): 'low' | 'medium' | 'high' {
    const lowRiskTypes = ['cafe', 'restaurant', 'bakery', 'grocery_store'];
    const mediumRiskTypes = ['bar', 'fast_food', 'takeaway'];
    const highRiskTypes = ['nightclub', 'gambling', 'adult_entertainment'];
    
    if (lowRiskTypes.includes(businessType)) return 'low';
    if (mediumRiskTypes.includes(businessType)) return 'medium';
    if (highRiskTypes.includes(businessType)) return 'high';
    return 'medium'; // Default for unknown types
  }

  private getVolumeRisk(monthlyTransactions: number): 'low' | 'medium' | 'high' {
    if (monthlyTransactions <= 500) return 'low';
    if (monthlyTransactions <= 2000) return 'medium';
    return 'high';
  }

  private getGeographicRisk(region: string): 'low' | 'medium' | 'high' {
    const lowRiskRegions = ['Stockholm', 'Göteborg', 'Malmö', 'Uppsala'];
    const highRiskRegions: string[] = []; // No high-risk regions in Sweden for this use case
    
    if (lowRiskRegions.some(r => region.toLowerCase().includes(r.toLowerCase()))) return 'low';
    if (highRiskRegions.some(r => region.toLowerCase().includes(r.toLowerCase()))) return 'high';
    return 'medium';
  }

  private calculateOverallRisk(risks: ('low' | 'medium' | 'high')[]): 'low' | 'medium' | 'high' {
    const highCount = risks.filter(r => r === 'high').length;
    const mediumCount = risks.filter(r => r === 'medium').length;
    
    if (highCount > 0) return 'high';
    if (mediumCount >= 2) return 'medium';
    if (mediumCount >= 1) return 'medium';
    return 'low';
  }

  private determineTier(score: number, checks: ValidationChecks): 1 | 2 | 3 {
    if (score >= 90 && checks.risk.overallRisk === 'low') return 3;
    if (score >= 75 && checks.risk.overallRisk !== 'high') return 2;
    return 1;
  }

  private getAppliedRules(checks: ValidationChecks): string[] {
    return [
      'swedish_org_number_validation',
      'document_completeness_check',
      'address_verification',
      'financial_assessment',
      'compliance_validation',
      'risk_assessment',
      'auto_approval_criteria',
      'tier_determination'
    ];
  }

  private async mockBolagsverketLookup(orgNumber: string) {
    // Mock response - in production, integrate with Bolagsverket API
    const mockCompanies: Record<string, any> = {
      '556123-4567': {
        exists: true,
        status: 'Aktiv',
        registrationDate: '2020-03-15',
        companyForm: 'Aktiebolag',
        shareCapital: 50000
      },
      '559876-5432': {
        exists: true,
        status: 'Aktiv',
        registrationDate: '2018-06-22',
        companyForm: 'Aktiebolag',
        shareCapital: 100000
      }
    };
    
    return mockCompanies[orgNumber] || { exists: false };
  }

  private createFailsafeValidation(application: BusinessApplication, error: any): ValidationResult {
    return {
      isValid: false,
      score: 0,
      riskLevel: 'high',
      automaticApprovalEligible: false,
      requiresManualReview: true,
      flags: [{
        type: 'error',
        category: 'business',
        code: 'VALIDATION_ERROR',
        message: 'Systemfel under validering - manuell granskning krävs',
        severity: 'critical',
        resolutionRequired: true
      }],
      checks: {} as ValidationChecks, // Empty checks due to error
      recommendation: {
        action: 'manual_review',
        tier: 1,
        reasoning: 'Systemfel under automatisk validering - kräver manuell granskning',
        confidence: 0,
        reviewPriority: 'urgent'
      },
      auditTrail: {
        timestamp: new Date().toISOString(),
        validatorVersion: this.VALIDATION_VERSION,
        processingTime: 0,
        rulesApplied: [],
        externalAPICalls: {
          bolagsverket: false,
          creditCheck: false,
          sanctionsDatabase: false,
          addressValidation: false
        },
        decision: 'manual_review_due_to_error',
        reviewRequired: true
      }
    };
  }
}