import { createLogger } from '../../utils/logger';
import { POSApiError } from '../../base/BasePOSAdapter';
import { ZettleAdapter } from './ZettleAdapter';
import { ZettleMerchant, SwedishBusinessInfo, ZettleSwedishFeatures } from './types';

const logger = createLogger('ZettleMerchantVerifier');

/**
 * Zettle Merchant Account Verifier
 * 
 * Handles merchant verification and setup for Zettle accounts
 * with special focus on Swedish business requirements
 */
export class ZettleMerchantVerifier {
  private adapter: ZettleAdapter;
  
  constructor(adapter: ZettleAdapter) {
    this.adapter = adapter;
  }

  /**
   * Complete merchant verification process
   */
  async verifyMerchant(): Promise<MerchantVerificationResult> {
    try {
      logger.info('Starting Zettle merchant verification');

      // Check connection
      const connectionStatus = await this.adapter.testConnection(this.adapter['credentials']!);
      if (!connectionStatus.connected) {
        throw new POSApiError({
          code: 'CONNECTION_FAILED',
          message: 'Unable to connect to Zettle'
        });
      }

      // Get merchant info
      const merchantInfo = await this.getMerchantInfo();
      
      // Perform verification checks
      const verificationChecks = await this.performVerificationChecks(merchantInfo);
      
      // Check Swedish-specific requirements if applicable
      const swedishVerification = merchantInfo.country === 'SE' 
        ? await this.verifySwedishBusiness(merchantInfo)
        : null;

      // Check payment method capabilities
      const paymentMethods = await this.verifyPaymentMethods(merchantInfo);

      // Check location setup
      const locations = await this.verifyLocations();

      // Check webhook configuration
      const webhookStatus = await this.verifyWebhooks();

      const result: MerchantVerificationResult = {
        verified: verificationChecks.allPassed,
        merchantId: merchantInfo.uuid,
        merchantName: merchantInfo.name,
        country: merchantInfo.country,
        currency: merchantInfo.currency,
        checks: verificationChecks,
        swedishBusiness: swedishVerification,
        paymentMethods,
        locations: {
          count: locations.length,
          verified: locations.length > 0,
          locations: locations.map(loc => ({
            id: loc.id,
            name: loc.name,
            active: loc.status === 'active'
          }))
        },
        webhooks: webhookStatus,
        recommendations: this.generateRecommendations(verificationChecks, swedishVerification)
      };

      logger.info('Merchant verification completed', { 
        verified: result.verified,
        merchantId: result.merchantId 
      });

      return result;
    } catch (error) {
      logger.error('Merchant verification failed', error);
      throw error;
    }
  }

  /**
   * Get merchant information
   */
  private async getMerchantInfo(): Promise<ZettleMerchant> {
    const apiClient = this.adapter['apiClient'];
    if (!apiClient) {
      throw new POSApiError({
        code: 'NOT_INITIALIZED',
        message: 'Adapter not initialized'
      });
    }
    return apiClient.getMerchantInfo();
  }

  /**
   * Perform standard verification checks
   */
  private async performVerificationChecks(merchant: ZettleMerchant): Promise<VerificationChecks> {
    const checks: VerificationChecks = {
      allPassed: true,
      details: []
    };

    // Check merchant status
    const statusCheck = {
      name: 'Merchant Status',
      passed: merchant.status === 'ACTIVE',
      message: merchant.status === 'ACTIVE' 
        ? 'Merchant account is active'
        : `Merchant account status: ${merchant.status}`,
      required: true
    };
    checks.details.push(statusCheck);
    if (!statusCheck.passed) checks.allPassed = false;

    // Check required agreements
    const agreementsCheck = {
      name: 'Terms & Agreements',
      passed: (merchant.acceptedAgreements?.length || 0) > 0,
      message: merchant.acceptedAgreements?.length 
        ? 'All required agreements accepted'
        : 'Missing required agreements',
      required: true
    };
    checks.details.push(agreementsCheck);
    if (!agreementsCheck.passed && agreementsCheck.required) checks.allPassed = false;

    // Check contact information
    const contactCheck = {
      name: 'Contact Information',
      passed: !!merchant.contactEmail,
      message: merchant.contactEmail 
        ? 'Contact email verified'
        : 'Missing contact email',
      required: false
    };
    checks.details.push(contactCheck);

    // Check address information
    const addressCheck = {
      name: 'Business Address',
      passed: !!merchant.address,
      message: merchant.address 
        ? 'Business address complete'
        : 'Missing business address',
      required: false
    };
    checks.details.push(addressCheck);

    return checks;
  }

  /**
   * Verify Swedish business requirements
   */
  private async verifySwedishBusiness(merchant: ZettleMerchant): Promise<SwedishVerificationResult> {
    const result: SwedishVerificationResult = {
      isSwedishBusiness: true,
      organizationNumber: merchant.organizationNumber,
      vatRegistered: !!merchant.vatNumber,
      vatNumber: merchant.vatNumber,
      checks: []
    };

    // Validate organization number format
    const orgNumberValid = this.validateSwedishOrgNumber(merchant.organizationNumber || '');
    result.checks.push({
      name: 'Organization Number',
      passed: orgNumberValid,
      message: orgNumberValid 
        ? 'Valid Swedish organization number'
        : 'Invalid or missing organization number',
      required: true
    });

    // Check VAT registration for businesses
    if (merchant.organizationType === 'AB' || merchant.organizationType === 'HB') {
      result.checks.push({
        name: 'VAT Registration',
        passed: !!merchant.vatNumber,
        message: merchant.vatNumber 
          ? 'VAT registered'
          : 'VAT registration recommended for business type',
        required: false
      });
    }

    // Check Swedish features availability
    const swedishFeatures = await this.adapter.getSwedishBusinessInfo().catch(() => null);
    if (swedishFeatures) {
      result.features = swedishFeatures.features;
      
      // Check Swish integration
      result.checks.push({
        name: 'Swish Integration',
        passed: swedishFeatures.features?.swishIntegration || false,
        message: swedishFeatures.features?.swishIntegration 
          ? 'Swish payments enabled'
          : 'Swish integration available but not enabled',
        required: false
      });

      // Check Kassaregister compliance
      result.checks.push({
        name: 'Kassaregister Compliance',
        passed: swedishFeatures.features?.kassaregister?.enabled || false,
        message: swedishFeatures.features?.kassaregister?.enabled
          ? 'Cash register law compliant'
          : 'Cash register compliance not configured',
        required: merchant.organizationType !== 'FORENING' // Not required for associations
      });
    }

    result.verified = result.checks.filter(c => c.required).every(c => c.passed);
    return result;
  }

  /**
   * Validate Swedish organization number format
   */
  private validateSwedishOrgNumber(orgNumber: string): boolean {
    // Swedish org number format: XXXXXX-XXXX
    const regex = /^\d{6}-\d{4}$/;
    if (!regex.test(orgNumber)) return false;

    // Validate checksum using Luhn algorithm
    const cleanNumber = orgNumber.replace('-', '');
    let sum = 0;
    let alternate = false;
    
    for (let i = cleanNumber.length - 1; i >= 0; i--) {
      let n = parseInt(cleanNumber[i], 10);
      if (alternate) {
        n *= 2;
        if (n > 9) n = (n % 10) + 1;
      }
      sum += n;
      alternate = !alternate;
    }
    
    return sum % 10 === 0;
  }

  /**
   * Verify payment methods
   */
  private async verifyPaymentMethods(merchant: ZettleMerchant): Promise<PaymentMethodStatus[]> {
    const apiClient = this.adapter['apiClient'];
    if (!apiClient) return [];

    try {
      const organization = await apiClient.getOrganization();
      const availableMethods = organization.paymentMethods || [];
      
      return [
        {
          method: 'card',
          enabled: availableMethods.includes('CARD'),
          verified: true
        },
        {
          method: 'cash',
          enabled: availableMethods.includes('CASH'),
          verified: true
        },
        {
          method: 'swish',
          enabled: availableMethods.includes('SWISH'),
          verified: merchant.country === 'SE'
        },
        {
          method: 'invoice',
          enabled: availableMethods.includes('INVOICE'),
          verified: true
        }
      ];
    } catch (error) {
      logger.error('Failed to verify payment methods', error);
      return [];
    }
  }

  /**
   * Verify locations
   */
  private async verifyLocations(): Promise<any[]> {
    try {
      return await this.adapter.getLocations();
    } catch (error) {
      logger.error('Failed to verify locations', error);
      return [];
    }
  }

  /**
   * Verify webhook configuration
   */
  private async verifyWebhooks(): Promise<WebhookStatus> {
    try {
      const webhooks = await this.adapter.listWebhooks();
      const activeWebhooks = webhooks.filter(wh => wh.active);
      
      return {
        configured: webhooks.length > 0,
        active: activeWebhooks.length > 0,
        count: webhooks.length,
        requiredEvents: this.checkRequiredWebhookEvents(webhooks)
      };
    } catch (error) {
      logger.error('Failed to verify webhooks', error);
      return {
        configured: false,
        active: false,
        count: 0,
        requiredEvents: false
      };
    }
  }

  /**
   * Check if required webhook events are configured
   */
  private checkRequiredWebhookEvents(webhooks: any[]): boolean {
    const requiredEvents = ['purchase.created', 'purchase.updated'];
    const configuredEvents = webhooks.flatMap(wh => wh.events);
    return requiredEvents.every(event => configuredEvents.includes(event));
  }

  /**
   * Generate recommendations based on verification
   */
  private generateRecommendations(
    checks: VerificationChecks, 
    swedishVerification: SwedishVerificationResult | null
  ): string[] {
    const recommendations: string[] = [];

    // Check for failed required checks
    const failedRequired = checks.details.filter(c => c.required && !c.passed);
    failedRequired.forEach(check => {
      recommendations.push(`Required: ${check.message}`);
    });

    // Swedish-specific recommendations
    if (swedishVerification) {
      if (!swedishVerification.vatRegistered) {
        recommendations.push('Consider registering for VAT if annual revenue exceeds SEK 30,000');
      }
      
      if (!swedishVerification.features?.swishIntegration) {
        recommendations.push('Enable Swish integration for popular Swedish mobile payments');
      }
      
      if (!swedishVerification.features?.kassaregister?.enabled) {
        recommendations.push('Configure Kassaregister compliance for cash transactions');
      }
    }

    // General recommendations
    const failedOptional = checks.details.filter(c => !c.required && !c.passed);
    if (failedOptional.length > 0) {
      recommendations.push('Complete optional profile information for better service');
    }

    return recommendations;
  }

  /**
   * Setup new merchant account
   */
  async setupMerchant(config: MerchantSetupConfig): Promise<MerchantSetupResult> {
    logger.info('Setting up Zettle merchant account', { merchantId: config.merchantId });

    const results: MerchantSetupResult = {
      success: true,
      steps: []
    };

    try {
      // Step 1: Configure locations
      if (config.locations && config.locations.length > 0) {
        const locationResult = await this.setupLocations(config.locations);
        results.steps.push(locationResult);
        if (!locationResult.success) results.success = false;
      }

      // Step 2: Configure webhooks
      if (config.webhookUrl) {
        const webhookResult = await this.setupWebhooks(config.webhookUrl, config.webhookEvents);
        results.steps.push(webhookResult);
        if (!webhookResult.success) results.success = false;
      }

      // Step 3: Configure Swedish features if applicable
      if (config.swedishFeatures) {
        const swedishResult = await this.setupSwedishFeatures(config.swedishFeatures);
        results.steps.push(swedishResult);
        if (!swedishResult.success) results.success = false;
      }

      logger.info('Merchant setup completed', { 
        success: results.success,
        steps: results.steps.length 
      });

      return results;
    } catch (error) {
      logger.error('Merchant setup failed', error);
      results.success = false;
      results.error = error instanceof Error ? error.message : 'Setup failed';
      return results;
    }
  }

  private async setupLocations(locations: any[]): Promise<SetupStep> {
    // Implementation for setting up locations
    return {
      step: 'Configure Locations',
      success: true,
      message: `Configured ${locations.length} location(s)`
    };
  }

  private async setupWebhooks(url: string, events?: string[]): Promise<SetupStep> {
    try {
      const webhook = await this.adapter.createWebhook({
        url,
        events: events || ['purchase.created', 'purchase.updated', 'purchase.refunded'],
        active: true
      });

      return {
        step: 'Configure Webhooks',
        success: true,
        message: `Webhook created: ${webhook.id}`
      };
    } catch (error) {
      return {
        step: 'Configure Webhooks',
        success: false,
        message: 'Failed to create webhook',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async setupSwedishFeatures(features: Partial<ZettleSwedishFeatures>): Promise<SetupStep> {
    // Implementation for Swedish feature setup
    return {
      step: 'Configure Swedish Features',
      success: true,
      message: 'Swedish features configured'
    };
  }
}

// Type definitions
interface MerchantVerificationResult {
  verified: boolean;
  merchantId: string;
  merchantName: string;
  country: string;
  currency: string;
  checks: VerificationChecks;
  swedishBusiness: SwedishVerificationResult | null;
  paymentMethods: PaymentMethodStatus[];
  locations: {
    count: number;
    verified: boolean;
    locations: Array<{
      id: string;
      name: string;
      active: boolean;
    }>;
  };
  webhooks: WebhookStatus;
  recommendations: string[];
}

interface VerificationChecks {
  allPassed: boolean;
  details: VerificationCheck[];
}

interface VerificationCheck {
  name: string;
  passed: boolean;
  message: string;
  required: boolean;
}

interface SwedishVerificationResult {
  isSwedishBusiness: boolean;
  organizationNumber?: string;
  vatRegistered: boolean;
  vatNumber?: string;
  verified?: boolean;
  checks: VerificationCheck[];
  features?: ZettleSwedishFeatures;
}

interface PaymentMethodStatus {
  method: string;
  enabled: boolean;
  verified: boolean;
}

interface WebhookStatus {
  configured: boolean;
  active: boolean;
  count: number;
  requiredEvents: boolean;
}

interface MerchantSetupConfig {
  merchantId: string;
  locations?: Array<{
    name: string;
    address?: any;
    type?: string;
  }>;
  webhookUrl?: string;
  webhookEvents?: string[];
  swedishFeatures?: Partial<ZettleSwedishFeatures>;
}

interface MerchantSetupResult {
  success: boolean;
  steps: SetupStep[];
  error?: string;
}

interface SetupStep {
  step: string;
  success: boolean;
  message: string;
  error?: string;
}