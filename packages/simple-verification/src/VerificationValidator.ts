import {
  SimpleVerification,
  SimpleVerificationFormData,
  SimpleVerificationSettings,
  SimpleVerificationFraudFlag,
  SimpleVerificationFraudType,
  DeviceFingerprint,
  APIResponse
} from '@ai-feedback-platform/shared-types';

export interface VerificationRepository {
  findByPhone(phone: string, since: Date): Promise<SimpleVerification[]>;
  findByIpAddress(ipAddress: string, since: Date): Promise<SimpleVerification[]>;
  findByDeviceFingerprint(fingerprint: string, since: Date): Promise<SimpleVerification[]>;
  findSimilarVerifications(verification: Partial<SimpleVerification>): Promise<SimpleVerification[]>;
}

export interface ValidationResult {
  valid: boolean;
  fraudScore: number;
  fraudFlags: SimpleVerificationFraudFlag[];
  recommendation: 'approve' | 'review' | 'reject';
  errors?: string[];
}

export class VerificationValidator {
  constructor(
    private repository: VerificationRepository,
    private logger: Console = console
  ) {}

  async validateVerification(
    formData: SimpleVerificationFormData,
    deviceFingerprint: DeviceFingerprint,
    ipAddress: string,
    settings: SimpleVerificationSettings
  ): Promise<ValidationResult> {
    const result: ValidationResult = {
      valid: true,
      fraudScore: 0,
      fraudFlags: [],
      recommendation: 'approve',
      errors: []
    };

    // Basic format validation
    const formatErrors = this.validateFormat(formData);
    if (formatErrors.length > 0) {
      result.valid = false;
      result.errors = formatErrors;
      return result;
    }

    // Time validation
    const timeValidation = this.validateTime(formData, settings);
    if (!timeValidation.valid) {
      result.valid = false;
      result.errors?.push(timeValidation.error!);
      return result;
    }

    // Amount validation
    const amountValidation = this.validateAmount(formData);
    if (!amountValidation.valid) {
      result.valid = false;
      result.errors?.push(amountValidation.error!);
      return result;
    }

    // Fraud detection
    const fraudResults = await this.performFraudChecks(
      formData,
      deviceFingerprint,
      ipAddress,
      settings
    );

    result.fraudScore = fraudResults.totalScore;
    result.fraudFlags = fraudResults.flags;
    result.recommendation = this.getRecommendation(fraudResults.totalScore, settings);

    // Final validation based on fraud score
    if (result.fraudScore >= settings.fraudSettings.autoRejectThreshold) {
      result.valid = false;
      result.errors?.push('Verification rejected due to high fraud risk');
    }

    return result;
  }

  private validateFormat(formData: SimpleVerificationFormData): string[] {
    const errors: string[] = [];

    // Store code validation
    if (!formData.storeCodeOrQR || !/^\d{6}$/.test(formData.storeCodeOrQR)) {
      errors.push('Store code must be 6 digits');
    }

    // Phone number validation (Swedish format)
    if (!this.isValidSwedishPhone(formData.customerPhone)) {
      errors.push('Invalid Swedish phone number format');
    }

    // Amount validation
    if (!formData.purchaseAmount || formData.purchaseAmount <= 0) {
      errors.push('Purchase amount must be greater than 0');
    }

    if (formData.purchaseAmount > 50000) {
      errors.push('Purchase amount cannot exceed 50,000 SEK');
    }

    return errors;
  }

  private validateTime(
    formData: SimpleVerificationFormData,
    settings: SimpleVerificationSettings
  ): { valid: boolean; error?: string } {
    const now = new Date();
    const purchaseDateTime = new Date(`${formData.purchaseTime.date}T${formData.purchaseTime.time}`);
    
    // Check if purchase time is in the future
    if (purchaseDateTime > now) {
      return {
        valid: false,
        error: 'Purchase time cannot be in the future'
      };
    }

    // Check if purchase time is too old (more than 24 hours)
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    if (now.getTime() - purchaseDateTime.getTime() > maxAge) {
      return {
        valid: false,
        error: 'Purchase time cannot be more than 24 hours ago'
      };
    }

    // Check time tolerance (±5 minutes is reasonable for manual entry)
    const toleranceMs = settings.verificationTolerance.timeMinutes * 60 * 1000;
    const timeDiff = Math.abs(now.getTime() - purchaseDateTime.getTime());
    
    if (timeDiff > toleranceMs && timeDiff < maxAge) {
      // This is suspicious but not invalid - will be flagged in fraud detection
      return { valid: true };
    }

    return { valid: true };
  }

  private validateAmount(formData: SimpleVerificationFormData): { valid: boolean; error?: string } {
    // Check for obviously suspicious amounts
    const amount = formData.purchaseAmount;

    // Round amounts might be suspicious (e.g., exactly 100, 500, 1000)
    if (amount % 100 === 0 && amount >= 100) {
      // This is suspicious but not invalid - will be flagged in fraud detection
      return { valid: true };
    }

    // Amounts ending in .00 for small purchases might be suspicious
    if (amount < 50 && amount % 1 === 0) {
      // This is suspicious but not invalid - will be flagged in fraud detection
      return { valid: true };
    }

    return { valid: true };
  }

  private async performFraudChecks(
    formData: SimpleVerificationFormData,
    deviceFingerprint: DeviceFingerprint,
    ipAddress: string,
    settings: SimpleVerificationSettings
  ): Promise<{ totalScore: number; flags: SimpleVerificationFraudFlag[] }> {
    const flags: SimpleVerificationFraudFlag[] = [];
    let totalScore = 0;

    // Check phone abuse
    const phoneCheck = await this.checkPhoneAbuse(formData.customerPhone, settings);
    if (phoneCheck.flag) {
      flags.push(phoneCheck.flag);
      totalScore = Math.max(totalScore, phoneCheck.flag.confidence);
    }

    // Check IP abuse
    const ipCheck = await this.checkIpAbuse(ipAddress, settings);
    if (ipCheck.flag) {
      flags.push(ipCheck.flag);
      totalScore = Math.max(totalScore, ipCheck.flag.confidence);
    }

    // Check time patterns
    const timeCheck = this.checkTimePatterns(formData);
    if (timeCheck.flag) {
      flags.push(timeCheck.flag);
      totalScore = Math.max(totalScore, timeCheck.flag.confidence);
    }

    // Check amount patterns
    const amountCheck = await this.checkAmountPatterns(formData);
    if (amountCheck.flag) {
      flags.push(amountCheck.flag);
      totalScore = Math.max(totalScore, amountCheck.flag.confidence);
    }

    // Check rapid submissions
    const rapidCheck = await this.checkRapidSubmissions(deviceFingerprint);
    if (rapidCheck.flag) {
      flags.push(rapidCheck.flag);
      totalScore = Math.max(totalScore, rapidCheck.flag.confidence);
    }

    // Check duplicate verifications
    const duplicateCheck = await this.checkDuplicateVerifications(formData, deviceFingerprint);
    if (duplicateCheck.flag) {
      flags.push(duplicateCheck.flag);
      totalScore = Math.max(totalScore, duplicateCheck.flag.confidence);
    }

    return { totalScore, flags };
  }

  private async checkPhoneAbuse(
    phone: string,
    settings: SimpleVerificationSettings
  ): Promise<{ flag?: SimpleVerificationFraudFlag }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const recentVerifications = await this.repository.findByPhone(phone, today);
    
    if (recentVerifications.length >= settings.dailyLimits.maxPerPhone) {
      return {
        flag: {
          type: 'phone_abuse',
          severity: 'high',
          description: `Phone number ${phone} exceeded daily limit`,
          confidence: 0.9,
          data: {
            count: recentVerifications.length,
            limit: settings.dailyLimits.maxPerPhone
          }
        }
      };
    }

    return {};
  }

  private async checkIpAbuse(
    ipAddress: string,
    settings: SimpleVerificationSettings
  ): Promise<{ flag?: SimpleVerificationFraudFlag }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const recentVerifications = await this.repository.findByIpAddress(ipAddress, today);
    
    if (recentVerifications.length >= settings.dailyLimits.maxPerIp) {
      return {
        flag: {
          type: 'location_mismatch', // Using existing type
          severity: 'medium',
          description: `IP address exceeded daily limit`,
          confidence: 0.7,
          data: {
            count: recentVerifications.length,
            limit: settings.dailyLimits.maxPerIp
          }
        }
      };
    }

    return {};
  }

  private checkTimePatterns(
    formData: SimpleVerificationFormData
  ): { flag?: SimpleVerificationFraudFlag } {
    const purchaseDateTime = new Date(`${formData.purchaseTime.date}T${formData.purchaseTime.time}`);
    const hour = purchaseDateTime.getHours();

    // Flag unusual hours (very early morning or very late)
    if (hour >= 0 && hour <= 6 || hour >= 22) {
      return {
        flag: {
          type: 'time_pattern',
          severity: 'medium',
          description: 'Purchase at unusual hours',
          confidence: 0.4,
          data: {
            hour,
            timestamp: purchaseDateTime.toISOString()
          }
        }
      };
    }

    return {};
  }

  private async checkAmountPatterns(
    formData: SimpleVerificationFormData
  ): Promise<{ flag?: SimpleVerificationFraudFlag }> {
    const amount = formData.purchaseAmount;
    let suspiciousScore = 0;
    const reasons: string[] = [];

    // Check for round amounts
    if (amount % 100 === 0 && amount >= 100) {
      suspiciousScore += 0.3;
      reasons.push('Round amount');
    }

    // Check for exact duplicates in recent history
    const similarVerifications = await this.repository.findSimilarVerifications({
      purchaseAmount: amount,
      customerPhone: formData.customerPhone
    });

    if (similarVerifications.length > 0) {
      suspiciousScore += 0.4;
      reasons.push('Duplicate amount from same phone');
    }

    // Check for common fraud amounts
    const fraudAmounts = [100, 200, 500, 1000, 2000, 5000];
    if (fraudAmounts.includes(amount)) {
      suspiciousScore += 0.2;
      reasons.push('Common fraud amount');
    }

    if (suspiciousScore >= 0.4) {
      return {
        flag: {
          type: 'amount_pattern',
          severity: suspiciousScore >= 0.7 ? 'high' : 'medium',
          description: `Suspicious amount pattern: ${reasons.join(', ')}`,
          confidence: suspiciousScore,
          data: {
            amount,
            reasons,
            similarCount: similarVerifications.length
          }
        }
      };
    }

    return {};
  }

  private async checkRapidSubmissions(
    deviceFingerprint: DeviceFingerprint
  ): Promise<{ flag?: SimpleVerificationFraudFlag }> {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const fingerprintString = JSON.stringify(deviceFingerprint);
    
    const recentVerifications = await this.repository.findByDeviceFingerprint(
      fingerprintString,
      fiveMinutesAgo
    );

    if (recentVerifications.length > 1) {
      return {
        flag: {
          type: 'rapid_submission',
          severity: 'high',
          description: 'Multiple verifications from same device within 5 minutes',
          confidence: 0.8,
          data: {
            count: recentVerifications.length,
            timeWindow: '5 minutes'
          }
        }
      };
    }

    return {};
  }

  private async checkDuplicateVerifications(
    formData: SimpleVerificationFormData,
    deviceFingerprint: DeviceFingerprint
  ): Promise<{ flag?: SimpleVerificationFraudFlag }> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const duplicates = await this.repository.findSimilarVerifications({
      storeCode: formData.storeCodeOrQR,
      purchaseAmount: formData.purchaseAmount,
      customerPhone: formData.customerPhone
    });

    const recentDuplicates = duplicates.filter(v => 
      new Date(v.submittedAt) > oneHourAgo
    );

    if (recentDuplicates.length > 0) {
      return {
        flag: {
          type: 'duplicate_verification',
          severity: 'high',
          description: 'Duplicate verification detected',
          confidence: 0.9,
          data: {
            duplicateCount: recentDuplicates.length,
            timeWindow: '1 hour'
          }
        }
      };
    }

    return {};
  }

  private getRecommendation(
    fraudScore: number,
    settings: SimpleVerificationSettings
  ): 'approve' | 'review' | 'reject' {
    if (fraudScore >= settings.fraudSettings.autoRejectThreshold) {
      return 'reject';
    }
    
    if (fraudScore >= settings.fraudSettings.manualReviewThreshold) {
      return 'review';
    }
    
    if (fraudScore <= settings.autoApproveThreshold) {
      return 'approve';
    }

    return 'review';
  }

  private isValidSwedishPhone(phone: string): boolean {
    // Swedish phone number validation
    // Accepts: +46XXXXXXXXX, 07XXXXXXXX, 08XXXXXXX, etc.
    const patterns = [
      /^\+46[1-9]\d{8}$/, // +46 followed by area code and number
      /^0[1-9]\d{7,8}$/, // 0 followed by area code and number
      /^[1-9]\d{8}$/ // Without leading 0 or +46
    ];

    return patterns.some(pattern => pattern.test(phone.replace(/\s/g, '')));
  }

  formatPhoneForSwish(phone: string): string {
    // Remove all spaces and normalize to Swedish format
    const clean = phone.replace(/\s/g, '');
    
    // Convert to +46 format for Swish
    if (clean.startsWith('+46')) {
      return clean;
    }
    
    if (clean.startsWith('0')) {
      return '+46' + clean.substring(1);
    }
    
    // Assume it's already without country code
    return '+46' + clean;
  }

  generateVerificationSummary(
    formData: SimpleVerificationFormData,
    validationResult: ValidationResult
  ): string {
    return `
Verification Summary:
- Store Code: ${formData.storeCodeOrQR}
- Purchase Time: ${formData.purchaseTime.date} ${formData.purchaseTime.time}
- Amount: ${formData.purchaseAmount} SEK
- Phone: ${formData.customerPhone}
- Fraud Score: ${(validationResult.fraudScore * 100).toFixed(1)}%
- Recommendation: ${validationResult.recommendation.toUpperCase()}
- Flags: ${validationResult.fraudFlags.length} detected
${validationResult.fraudFlags.map(flag => `  - ${flag.type}: ${flag.description}`).join('\n')}
`;
  }
}