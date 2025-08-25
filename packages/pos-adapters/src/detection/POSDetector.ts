import { POSProvider } from '@ai-feedback-platform/shared-types';
import { POSCapability, POSCredentials, POSConnectionStatus } from '../types';

export interface DetectedPOSSystem {
  provider: POSProvider;
  confidence: number;
  evidence: string[];
  capabilities: POSCapability[];
  suggestedScopes?: string[];
}

export interface POSDetectionResult {
  detectedSystems: DetectedPOSSystem[];
  primarySuggestion?: DetectedPOSSystem;
  alternativeSuggestions: DetectedPOSSystem[];
}

export interface BusinessContext {
  name?: string;
  website?: string;
  industry?: string;
  size?: 'small' | 'medium' | 'large';
  locations?: number;
  country?: string;
  existingIntegrations?: string[];
}

/**
 * POS System Detection and Capability Discovery
 * 
 * Intelligently detects which POS systems a business likely uses based on
 * various signals and provides capability information for each system.
 */
export class POSDetector {
  private readonly providerPatterns: Record<POSProvider, {
    domains: string[];
    keywords: string[];
    industries: string[];
    regions: string[];
    businessSizes: ('small' | 'medium' | 'large')[];
    capabilities: POSCapability[];
    confidence: number;
  }> = {
    square: {
      domains: ['squareup.com', 'square.com'],
      keywords: ['square', 'cash app', 'square pos', 'square register'],
      industries: ['retail', 'restaurant', 'cafe', 'small business'],
      regions: ['US', 'CA', 'AU', 'JP', 'UK', 'IE'],
      businessSizes: ['small', 'medium'],
      capabilities: ['transactions', 'webhooks', 'inventory', 'customers'],
      confidence: 0.9
    },
    shopify: {
      domains: ['shopify.com', 'myshopify.com'],
      keywords: ['shopify', 'shopify pos', 'shopify payments', 'e-commerce'],
      industries: ['retail', 'e-commerce', 'fashion', 'electronics'],
      regions: ['US', 'CA', 'UK', 'AU', 'SE', 'NO', 'DK'],
      businessSizes: ['small', 'medium', 'large'],
      capabilities: ['transactions', 'webhooks', 'inventory', 'customers', 'refunds'],
      confidence: 0.85
    },
    zettle: {
      domains: ['zettle.com', 'paypal.com'],
      keywords: ['zettle', 'paypal zettle', 'izettle', 'paypal here'],
      industries: ['retail', 'restaurant', 'service', 'mobile business'],
      regions: ['SE', 'NO', 'DK', 'FI', 'UK', 'DE', 'FR', 'NL', 'BR', 'MX'],
      businessSizes: ['small', 'medium'],
      capabilities: ['transactions', 'inventory'],
      confidence: 0.8
    }
  };

  /**
   * Detect likely POS systems based on business context
   */
  async detectPOSSystems(context: BusinessContext): Promise<POSDetectionResult> {
    const detectedSystems: DetectedPOSSystem[] = [];

    for (const [provider, patterns] of Object.entries(this.providerPatterns)) {
      const detection = this.analyzeProvider(provider as POSProvider, patterns, context);
      if (detection.confidence > 0.1) { // Only include if some confidence
        detectedSystems.push(detection);
      }
    }

    // Sort by confidence
    detectedSystems.sort((a, b) => b.confidence - a.confidence);

    const primarySuggestion = detectedSystems[0];
    const alternativeSuggestions = detectedSystems.slice(1);

    return {
      detectedSystems,
      primarySuggestion,
      alternativeSuggestions
    };
  }

  /**
   * Get capabilities for a specific POS provider
   */
  getProviderCapabilities(provider: POSProvider): POSCapability[] {
    return this.providerPatterns[provider]?.capabilities || [];
  }

  /**
   * Get all supported providers with their capabilities
   */
  getAllProviders(): Record<POSProvider, POSCapability[]> {
    const result: Record<POSProvider, POSCapability[]> = {} as any;
    
    for (const [provider, patterns] of Object.entries(this.providerPatterns)) {
      result[provider as POSProvider] = patterns.capabilities;
    }
    
    return result;
  }

  /**
   * Check if a provider supports specific capabilities
   */
  supportsCapabilities(provider: POSProvider, requiredCapabilities: POSCapability[]): boolean {
    const providerCapabilities = this.getProviderCapabilities(provider);
    return requiredCapabilities.every(cap => providerCapabilities.includes(cap));
  }

  /**
   * Get recommended scopes for OAuth based on required capabilities
   */
  getRecommendedScopes(provider: POSProvider, capabilities: POSCapability[]): string[] {
    const scopeMapping: Record<POSProvider, Record<POSCapability, string[]>> = {
      square: {
        transactions: ['PAYMENTS_READ'],
        webhooks: ['PAYMENTS_READ'],
        inventory: ['ITEMS_READ'],
        customers: ['CUSTOMERS_READ'],
        refunds: ['PAYMENTS_READ']
      },
      shopify: {
        transactions: ['read_orders'],
        webhooks: ['read_orders'],
        inventory: ['read_products', 'read_inventory'],
        customers: ['read_customers'],
        refunds: ['read_orders']
      },
      zettle: {
        transactions: ['READ:PURCHASE'],
        webhooks: [],
        inventory: ['READ:PRODUCT'],
        customers: [],
        refunds: []
      }
    };

    const providerScopes = scopeMapping[provider];
    if (!providerScopes) return [];

    const scopes = new Set<string>();
    for (const capability of capabilities) {
      const capabilityScopes = providerScopes[capability] || [];
      capabilityScopes.forEach(scope => scopes.add(scope));
    }

    return Array.from(scopes);
  }

  /**
   * Validate if credentials work with detected capabilities
   */
  async validateCredentials(
    provider: POSProvider,
    credentials: POSCredentials,
    requiredCapabilities: POSCapability[]
  ): Promise<{
    valid: boolean;
    availableCapabilities: POSCapability[];
    missingCapabilities: POSCapability[];
    errors: string[];
  }> {
    const providerCapabilities = this.getProviderCapabilities(provider);
    const availableCapabilities: POSCapability[] = [];
    const missingCapabilities: POSCapability[] = [];
    const errors: string[] = [];

    for (const capability of requiredCapabilities) {
      if (providerCapabilities.includes(capability)) {
        // In a real implementation, this would test the actual API
        const hasCapability = await this.testCapability(provider, credentials, capability);
        if (hasCapability) {
          availableCapabilities.push(capability);
        } else {
          missingCapabilities.push(capability);
          errors.push(`Missing ${capability} capability or insufficient permissions`);
        }
      } else {
        missingCapabilities.push(capability);
        errors.push(`Provider ${provider} does not support ${capability}`);
      }
    }

    return {
      valid: missingCapabilities.length === 0 && errors.length === 0,
      availableCapabilities,
      missingCapabilities,
      errors
    };
  }

  // Private methods
  private analyzeProvider(
    provider: POSProvider,
    patterns: typeof this.providerPatterns[POSProvider],
    context: BusinessContext
  ): DetectedPOSSystem {
    let confidence = 0;
    const evidence: string[] = [];

    // Website domain analysis
    if (context.website) {
      const domain = this.extractDomain(context.website);
      if (patterns.domains.some(d => domain.includes(d))) {
        confidence += 0.4;
        evidence.push(`Website domain suggests ${provider}`);
      }
    }

    // Business name keyword analysis
    if (context.name) {
      const hasKeyword = patterns.keywords.some(keyword => 
        context.name!.toLowerCase().includes(keyword.toLowerCase())
      );
      if (hasKeyword) {
        confidence += 0.3;
        evidence.push(`Business name contains ${provider} keywords`);
      }
    }

    // Industry alignment
    if (context.industry && patterns.industries.includes(context.industry)) {
      confidence += 0.2;
      evidence.push(`Industry ${context.industry} commonly uses ${provider}`);
    }

    // Regional availability
    if (context.country && patterns.regions.includes(context.country)) {
      confidence += 0.15;
      evidence.push(`${provider} is available in ${context.country}`);
    } else if (context.country && !patterns.regions.includes(context.country)) {
      confidence = 0; // Not available in region
      evidence.push(`${provider} is not available in ${context.country}`);
      return { provider, confidence, evidence, capabilities: [] };
    }

    // Business size fit
    if (context.size && patterns.businessSizes.includes(context.size)) {
      confidence += 0.1;
      evidence.push(`${provider} is suitable for ${context.size} businesses`);
    }

    // Existing integrations
    if (context.existingIntegrations) {
      const hasIntegration = context.existingIntegrations.some(integration =>
        patterns.keywords.some(keyword => 
          integration.toLowerCase().includes(keyword.toLowerCase())
        )
      );
      if (hasIntegration) {
        confidence += 0.5;
        evidence.push(`Existing ${provider} integration detected`);
      }
    }

    // Apply base confidence
    confidence *= patterns.confidence;

    // Special boost for Swedish businesses using Zettle
    if (provider === 'zettle' && context.country === 'SE') {
      confidence += 0.2;
      evidence.push('Zettle is very popular in Sweden');
    }

    // Cap confidence at 1.0
    confidence = Math.min(confidence, 1.0);

    return {
      provider,
      confidence,
      evidence,
      capabilities: patterns.capabilities,
      suggestedScopes: this.getRecommendedScopes(provider, patterns.capabilities)
    };
  }

  private extractDomain(url: string): string {
    try {
      const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
      return parsed.hostname.toLowerCase();
    } catch {
      return url.toLowerCase();
    }
  }

  private async testCapability(
    provider: POSProvider,
    credentials: POSCredentials,
    capability: POSCapability
  ): Promise<boolean> {
    // Mock implementation for development
    // In production, this would make actual API calls to test capabilities
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Simulate some capabilities being unavailable
    if (provider === 'zettle' && capability === 'webhooks') {
      return false; // Zettle has limited webhook support
    }
    
    return true;
  }
}