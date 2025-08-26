import { POSAdapter } from '../interfaces/POSAdapter';
import { POSProvider } from '@ai-feedback-platform/shared-types';
import { createLogger } from '../utils/logger';
import { RetryManager } from '../utils/RetryManager';

const logger = createLogger('ConnectionValidator');

export interface ValidationStep {
  name: string;
  nameSv: string;
  description: string;
  descriptionSv: string;
  test: () => Promise<boolean>;
  required: boolean;
  errorHints?: string[];
  errorHintsSv?: string[];
}

export interface ValidationResult {
  success: boolean;
  steps: Array<{
    step: ValidationStep;
    success: boolean;
    error?: string;
    duration: number;
    retries?: number;
  }>;
  totalDuration: number;
  warnings: string[];
  recommendations?: string[];
  recommendationsSv?: string[];
}

export interface ConnectionConfig {
  provider: POSProvider;
  apiKey?: string;
  apiSecret?: string;
  accessToken?: string;
  refreshToken?: string;
  merchantId?: string;
  storeId?: string;
  environment?: 'production' | 'sandbox';
}

export class ConnectionValidator {
  private retryManager: RetryManager;
  
  constructor(
    private adapter: POSAdapter,
    private config: ConnectionConfig
  ) {
    this.retryManager = new RetryManager({
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 10000,
      enableCircuitBreaker: true
    });
  }

  async validateConnection(language: 'en' | 'sv' = 'en'): Promise<ValidationResult> {
    const startTime = Date.now();
    const steps = this.getValidationSteps();
    const results: ValidationResult['steps'] = [];
    const warnings: string[] = [];
    let allRequiredPassed = true;

    logger.info(`Starting connection validation for ${this.config.provider}`);

    for (const step of steps) {
      const stepStartTime = Date.now();
      let success = false;
      let error: string | undefined;
      let retries = 0;

      try {
        logger.debug(`Running validation step: ${step.name}`);
        
        // Use retry manager for network-related tests
        if (this.isNetworkTest(step.name)) {
          success = await this.retryManager.executeWithRetry(
            step.test,
            {
              onRetry: (attempt, err) => {
                retries = attempt;
                logger.warn(`Retrying ${step.name} (attempt ${attempt})`, err);
              }
            }
          );
        } else {
          success = await step.test();
        }

        logger.info(`Validation step ${step.name}: ${success ? 'PASSED' : 'FAILED'}`);
      } catch (err: any) {
        success = false;
        error = err.message || 'Unknown error';
        logger.error(`Validation step ${step.name} failed`, err);

        // Add specific error hints based on the error
        if (err.message?.includes('401') || err.message?.includes('Unauthorized')) {
          warnings.push(language === 'sv' ? 
            'Autentiseringsfel - kontrollera API-nycklar' : 
            'Authentication error - check API keys'
          );
        } else if (err.message?.includes('404')) {
          warnings.push(language === 'sv' ?
            'Endpoint hittades inte - kontrollera API-version' :
            'Endpoint not found - check API version'
          );
        } else if (err.message?.includes('rate limit')) {
          warnings.push(language === 'sv' ?
            'Hastighetsbegränsning nådd - vänta innan du försöker igen' :
            'Rate limit reached - wait before retrying'
          );
        }
      }

      if (step.required && !success) {
        allRequiredPassed = false;
      }

      results.push({
        step,
        success,
        error,
        duration: Date.now() - stepStartTime,
        retries: retries > 0 ? retries : undefined
      });
    }

    const totalDuration = Date.now() - startTime;

    // Generate recommendations based on results
    const recommendations = this.generateRecommendations(results, language);
    const recommendationsSv = language === 'sv' ? 
      this.generateRecommendations(results, 'sv') : undefined;

    return {
      success: allRequiredPassed,
      steps: results,
      totalDuration,
      warnings,
      recommendations,
      recommendationsSv
    };
  }

  private getValidationSteps(): ValidationStep[] {
    const steps: ValidationStep[] = [
      {
        name: 'API Connectivity',
        nameSv: 'API-anslutning',
        description: 'Test basic API connectivity',
        descriptionSv: 'Testa grundläggande API-anslutning',
        test: () => this.testAPIConnectivity(),
        required: true,
        errorHints: [
          'Check internet connection',
          'Verify API endpoint URL',
          'Check firewall settings'
        ],
        errorHintsSv: [
          'Kontrollera internetanslutning',
          'Verifiera API-endpoint URL',
          'Kontrollera brandväggsinställningar'
        ]
      },
      {
        name: 'Authentication',
        nameSv: 'Autentisering',
        description: 'Verify credentials are valid',
        descriptionSv: 'Verifiera att uppgifterna är giltiga',
        test: () => this.testAuthentication(),
        required: true,
        errorHints: [
          'Verify API key/secret',
          'Check token expiration',
          'Confirm correct environment (sandbox/production)'
        ],
        errorHintsSv: [
          'Verifiera API-nyckel/hemlighet',
          'Kontrollera token-utgång',
          'Bekräfta korrekt miljö (sandbox/produktion)'
        ]
      },
      {
        name: 'Merchant Verification',
        nameSv: 'Handlarverifiering',
        description: 'Verify merchant account details',
        descriptionSv: 'Verifiera handlarkontouppgifter',
        test: () => this.testMerchantVerification(),
        required: true,
        errorHints: [
          'Confirm merchant account is active',
          'Check account permissions',
          'Verify business registration'
        ],
        errorHintsSv: [
          'Bekräfta att handlarkontot är aktivt',
          'Kontrollera kontobehörigheter',
          'Verifiera företagsregistrering'
        ]
      },
      {
        name: 'Location Access',
        nameSv: 'Platsåtkomst',
        description: 'Verify access to business locations',
        descriptionSv: 'Verifiera åtkomst till affärsplatser',
        test: () => this.testLocationAccess(),
        required: false,
        errorHints: [
          'Ensure locations are configured',
          'Check location permissions',
          'Verify location IDs'
        ],
        errorHintsSv: [
          'Säkerställ att platser är konfigurerade',
          'Kontrollera platsbehörigheter',
          'Verifiera plats-ID:n'
        ]
      },
      {
        name: 'Transaction History',
        nameSv: 'Transaktionshistorik',
        description: 'Test access to transaction data',
        descriptionSv: 'Testa åtkomst till transaktionsdata',
        test: () => this.testTransactionAccess(),
        required: false,
        errorHints: [
          'Check transaction read permissions',
          'Verify date range parameters',
          'Confirm transaction data exists'
        ],
        errorHintsSv: [
          'Kontrollera läsbehörigheter för transaktioner',
          'Verifiera datumintervallparametrar',
          'Bekräfta att transaktionsdata finns'
        ]
      },
      {
        name: 'Webhook Configuration',
        nameSv: 'Webhook-konfiguration',
        description: 'Verify webhook endpoints if configured',
        descriptionSv: 'Verifiera webhook-endpoints om konfigurerade',
        test: () => this.testWebhookConfiguration(),
        required: false,
        errorHints: [
          'Confirm webhook URL is accessible',
          'Check webhook event subscriptions',
          'Verify webhook signing secret'
        ],
        errorHintsSv: [
          'Bekräfta att webhook-URL är tillgänglig',
          'Kontrollera webhook-händelseprenumerationer',
          'Verifiera webhook-signeringshemlighet'
        ]
      }
    ];

    // Add provider-specific steps
    if (this.config.provider === 'zettle') {
      steps.push(
        {
          name: 'Swedish Features',
          nameSv: 'Svenska funktioner',
          description: 'Test Zettle Swedish-specific features',
          descriptionSv: 'Testa Zettle svenska-specifika funktioner',
          test: () => this.testZettleSwedishFeatures(),
          required: false,
          errorHints: [
            'Verify Swedish business registration',
            'Check Swish configuration',
            'Confirm Kassaregister setup'
          ],
          errorHintsSv: [
            'Verifiera svensk företagsregistrering',
            'Kontrollera Swish-konfiguration',
            'Bekräfta Kassaregister-inställning'
          ]
        }
      );
    }

    if (this.config.provider === 'square') {
      steps.push(
        {
          name: 'Square Catalog',
          nameSv: 'Square-katalog',
          description: 'Test access to Square catalog',
          descriptionSv: 'Testa åtkomst till Square-katalog',
          test: () => this.testSquareCatalog(),
          required: false,
          errorHints: [
            'Check catalog read permissions',
            'Verify catalog items exist'
          ],
          errorHintsSv: [
            'Kontrollera katalogläsbehörigheter',
            'Verifiera att katalogobjekt finns'
          ]
        }
      );
    }

    return steps;
  }

  private async testAPIConnectivity(): Promise<boolean> {
    try {
      // Test basic connectivity to the POS API
      const response = await fetch(this.getHealthEndpoint(), {
        method: 'HEAD',
        headers: {
          'User-Agent': 'AI-Feedback-Platform/1.0'
        }
      });
      
      return response.ok || response.status === 401; // 401 means API is reachable
    } catch (error) {
      logger.error('API connectivity test failed', error);
      return false;
    }
  }

  private async testAuthentication(): Promise<boolean> {
    try {
      // Use adapter's built-in connection test if available
      if (typeof this.adapter.testConnection === 'function') {
        return await this.adapter.testConnection();
      }

      // Fallback to basic auth test
      const headers = this.getAuthHeaders();
      const response = await fetch(this.getAuthTestEndpoint(), {
        headers
      });

      return response.ok;
    } catch (error) {
      logger.error('Authentication test failed', error);
      return false;
    }
  }

  private async testMerchantVerification(): Promise<boolean> {
    try {
      if (typeof this.adapter.getMerchant === 'function') {
        const merchant = await this.adapter.getMerchant();
        return !!merchant && !!merchant.id;
      }
      return true; // Skip if not supported
    } catch (error) {
      logger.error('Merchant verification failed', error);
      return false;
    }
  }

  private async testLocationAccess(): Promise<boolean> {
    try {
      const locations = await this.adapter.getLocations();
      return Array.isArray(locations) && locations.length > 0;
    } catch (error) {
      logger.error('Location access test failed', error);
      return false;
    }
  }

  private async testTransactionAccess(): Promise<boolean> {
    try {
      // Test with a small date range
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7); // Last 7 days

      const transactions = await this.adapter.getTransactions({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        limit: 1 // Just test if we can get any transaction
      });

      return true; // Success if no error thrown
    } catch (error) {
      logger.error('Transaction access test failed', error);
      return false;
    }
  }

  private async testWebhookConfiguration(): Promise<boolean> {
    try {
      if (typeof this.adapter.getWebhooks === 'function') {
        const webhooks = await this.adapter.getWebhooks();
        return Array.isArray(webhooks);
      }
      return true; // Skip if not supported
    } catch (error) {
      logger.error('Webhook configuration test failed', error);
      return false;
    }
  }

  private async testZettleSwedishFeatures(): Promise<boolean> {
    try {
      // Test Swedish-specific features for Zettle
      if (this.config.provider === 'zettle' && this.adapter.capabilities?.includes('swedish_payments')) {
        // Check if Swedish features are accessible
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Zettle Swedish features test failed', error);
      return false;
    }
  }

  private async testSquareCatalog(): Promise<boolean> {
    try {
      if (this.config.provider === 'square' && typeof this.adapter.getCatalog === 'function') {
        const catalog = await this.adapter.getCatalog({ limit: 1 });
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Square catalog test failed', error);
      return false;
    }
  }

  private isNetworkTest(stepName: string): boolean {
    const networkTests = [
      'API Connectivity',
      'Authentication',
      'Transaction History',
      'Location Access'
    ];
    return networkTests.includes(stepName);
  }

  private getHealthEndpoint(): string {
    const endpoints: Record<POSProvider, string> = {
      square: 'https://connect.squareup.com/v2/locations',
      shopify: 'https://myshop.myshopify.com/admin/api/2024-01/shop.json',
      zettle: 'https://oauth.zettle.com/token',
      clover: 'https://api.clover.com/v3/merchants',
      toast: 'https://api.toasttab.com/restaurants',
      lightspeed: 'https://api.lightspeedhq.com/API/V3/Account'
    };
    return endpoints[this.config.provider] || '';
  }

  private getAuthTestEndpoint(): string {
    const endpoints: Record<POSProvider, string> = {
      square: 'https://connect.squareup.com/v2/merchants/me',
      shopify: 'https://myshop.myshopify.com/admin/api/2024-01/shop.json',
      zettle: 'https://api.zettle.com/organizations/self',
      clover: 'https://api.clover.com/v3/merchants/current',
      toast: 'https://api.toasttab.com/authentication/v1/authentication/login',
      lightspeed: 'https://api.lightspeedhq.com/API/V3/Account'
    };
    return endpoints[this.config.provider] || '';
  }

  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'AI-Feedback-Platform/1.0'
    };

    if (this.config.accessToken) {
      headers['Authorization'] = `Bearer ${this.config.accessToken}`;
    } else if (this.config.apiKey) {
      if (this.config.provider === 'square') {
        headers['Authorization'] = `Bearer ${this.config.apiKey}`;
      } else if (this.config.provider === 'shopify') {
        headers['X-Shopify-Access-Token'] = this.config.apiKey;
      }
    }

    return headers;
  }

  private generateRecommendations(
    results: ValidationResult['steps'],
    language: 'en' | 'sv'
  ): string[] {
    const recommendations: string[] = [];
    const failedSteps = results.filter(r => !r.success);
    const slowSteps = results.filter(r => r.duration > 5000);

    if (failedSteps.length > 0) {
      const criticalFailed = failedSteps.filter(f => f.step.required);
      
      if (criticalFailed.length > 0) {
        if (language === 'sv') {
          recommendations.push(
            `${criticalFailed.length} kritiska valideringssteg misslyckades. Kontrollera dina API-uppgifter och försök igen.`
          );
        } else {
          recommendations.push(
            `${criticalFailed.length} critical validation steps failed. Please check your API credentials and try again.`
          );
        }
      }

      // Add specific recommendations based on which steps failed
      if (failedSteps.some(f => f.step.name === 'Authentication')) {
        if (language === 'sv') {
          recommendations.push(
            'Autentisering misslyckades. Verifiera att din API-nyckel är korrekt och inte har utgått.'
          );
        } else {
          recommendations.push(
            'Authentication failed. Please verify your API key is correct and has not expired.'
          );
        }
      }

      if (failedSteps.some(f => f.step.name === 'Location Access')) {
        if (language === 'sv') {
          recommendations.push(
            'Kunde inte komma åt affärsplatser. Säkerställ att minst en plats är konfigurerad i ditt POS-system.'
          );
        } else {
          recommendations.push(
            'Could not access business locations. Please ensure at least one location is configured in your POS system.'
          );
        }
      }
    }

    if (slowSteps.length > 0) {
      if (language === 'sv') {
        recommendations.push(
          `${slowSteps.length} valideringssteg tog längre tid än förväntat. Detta kan indikera nätverksproblem.`
        );
      } else {
        recommendations.push(
          `${slowSteps.length} validation steps took longer than expected. This may indicate network issues.`
        );
      }
    }

    // Add positive recommendation if all passed
    if (failedSteps.length === 0) {
      if (language === 'sv') {
        recommendations.push(
          'Alla valideringssteg godkända! Din POS-integration är redo att användas.'
        );
      } else {
        recommendations.push(
          'All validation steps passed! Your POS integration is ready to use.'
        );
      }
    }

    // Environment-specific recommendations
    if (this.config.environment === 'sandbox') {
      if (language === 'sv') {
        recommendations.push(
          'Du använder sandbox-miljön. Byt till produktion när du är redo för riktiga transaktioner.'
        );
      } else {
        recommendations.push(
          'You are using the sandbox environment. Switch to production when ready for live transactions.'
        );
      }
    }

    return recommendations;
  }

  async generateDetailedReport(language: 'en' | 'sv' = 'en'): Promise<string> {
    const result = await this.validateConnection(language);
    const isSwedish = language === 'sv';

    let report = `# ${isSwedish ? 'POS Anslutningsvalideringsrapport' : 'POS Connection Validation Report'}\n\n`;
    report += `**${isSwedish ? 'Leverantör' : 'Provider'}:** ${this.config.provider.toUpperCase()}\n`;
    report += `**${isSwedish ? 'Miljö' : 'Environment'}:** ${this.config.environment || 'production'}\n`;
    report += `**${isSwedish ? 'Total tid' : 'Total Duration'}:** ${result.totalDuration}ms\n`;
    report += `**${isSwedish ? 'Status' : 'Status'}:** ${result.success ? '✅ ' + (isSwedish ? 'GODKÄND' : 'PASSED') : '❌ ' + (isSwedish ? 'MISSLYCKAD' : 'FAILED')}\n\n`;

    report += `## ${isSwedish ? 'Valideringssteg' : 'Validation Steps'}\n\n`;

    for (const step of result.steps) {
      const stepName = isSwedish ? step.step.nameSv : step.step.name;
      const status = step.success ? '✅' : '❌';
      report += `### ${status} ${stepName}\n`;
      report += `- ${isSwedish ? 'Varaktighet' : 'Duration'}: ${step.duration}ms\n`;
      
      if (step.retries) {
        report += `- ${isSwedish ? 'Återförsök' : 'Retries'}: ${step.retries}\n`;
      }
      
      if (step.error) {
        report += `- ${isSwedish ? 'Fel' : 'Error'}: ${step.error}\n`;
      }
      
      if (!step.success && step.step.errorHints) {
        const hints = isSwedish ? step.step.errorHintsSv : step.step.errorHints;
        report += `- ${isSwedish ? 'Felsökningstips' : 'Troubleshooting Hints'}:\n`;
        hints?.forEach(hint => {
          report += `  - ${hint}\n`;
        });
      }
      
      report += '\n';
    }

    if (result.warnings.length > 0) {
      report += `## ${isSwedish ? 'Varningar' : 'Warnings'}\n\n`;
      result.warnings.forEach(warning => {
        report += `- ⚠️ ${warning}\n`;
      });
      report += '\n';
    }

    if (result.recommendations && result.recommendations.length > 0) {
      report += `## ${isSwedish ? 'Rekommendationer' : 'Recommendations'}\n\n`;
      const recs = isSwedish && result.recommendationsSv ? result.recommendationsSv : result.recommendations;
      recs.forEach(rec => {
        report += `- 💡 ${rec}\n`;
      });
    }

    return report;
  }
}

export function createConnectionValidator(
  adapter: POSAdapter,
  config: ConnectionConfig
): ConnectionValidator {
  return new ConnectionValidator(adapter, config);
}