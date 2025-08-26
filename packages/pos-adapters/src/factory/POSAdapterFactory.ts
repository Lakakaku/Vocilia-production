import { POSAdapter } from '../interfaces/POSAdapter';
import { POSProvider } from '@ai-feedback-platform/shared-types';
import { POSCredentials, POSCapability } from '../types';
import { POSDetector, BusinessContext, DetectedPOSSystem } from '../detection/POSDetector';
import { OAuthManager } from '../oauth/OAuthManager';
import { POSApiError } from '../base/BasePOSAdapter';

// Import concrete adapters
import { SquareAdapter } from '../adapters/square/SquareAdapter';
import { ShopifyAdapter } from '../adapters/shopify/ShopifyAdapter';
import { ZettleAdapter } from '../adapters/zettle/ZettleAdapter';

export interface AdapterCreationOptions {
  provider?: POSProvider;
  credentials?: POSCredentials;
  requiredCapabilities?: POSCapability[];
  businessContext?: BusinessContext;
  autoDetect?: boolean;
}

export interface AdapterRecommendation {
  adapter: POSAdapter;
  confidence: number;
  reasoning: string[];
  missingCapabilities: POSCapability[];
}

/**
 * POS Adapter Factory with Intelligent Provider Selection
 * 
 * Creates POS adapters with automatic provider detection and selection
 * based on business context and required capabilities.
 */
export class POSAdapterFactory {
  private readonly detector: POSDetector;
  private readonly oauthManager: OAuthManager;
  private readonly adapterRegistry = new Map<POSProvider, new () => POSAdapter>();

  constructor() {
    this.detector = new POSDetector();
    this.oauthManager = new OAuthManager();
    this.registerDefaultAdapters();
  }

  /**
   * Create a POS adapter with automatic provider selection
   */
  async createAdapter(options: AdapterCreationOptions): Promise<POSAdapter> {
    if (options.provider && options.credentials) {
      // Direct creation with specified provider
      return this.createSpecificAdapter(options.provider, options.credentials);
    }

    if (options.autoDetect && options.businessContext) {
      // Automatic detection and selection
      const recommendation = await this.recommendAdapter(
        options.businessContext,
        options.requiredCapabilities || []
      );
      return recommendation.adapter;
    }

    throw new POSApiError({
      code: 'INSUFFICIENT_OPTIONS',
      message: 'Must provide either (provider + credentials) or (autoDetect + businessContext)'
    });
  }

  /**
   * Get adapter recommendations based on business context
   */
  async recommendAdapter(
    businessContext: BusinessContext,
    requiredCapabilities: POSCapability[] = []
  ): Promise<AdapterRecommendation> {
    const detectionResult = await this.detector.detectPOSSystems(businessContext);
    
    if (detectionResult.detectedSystems.length === 0) {
      throw new POSApiError({
        code: 'NO_SUITABLE_PROVIDER',
        message: 'No suitable POS provider found for the given business context'
      });
    }

    // Find the best provider that supports required capabilities
    for (const detected of detectionResult.detectedSystems) {
      const capabilityCheck = await this.checkCapabilitySupport(
        detected.provider,
        requiredCapabilities
      );

      if (capabilityCheck.missingCapabilities.length === 0) {
        const adapter = this.createEmptyAdapter(detected.provider);
        
        return {
          adapter,
          confidence: detected.confidence,
          reasoning: [
            ...detected.evidence,
            `Supports all required capabilities: ${requiredCapabilities.join(', ')}`
          ],
          missingCapabilities: []
        };
      }
    }

    // If no perfect match, return the best option with missing capabilities noted
    const bestDetected = detectionResult.primarySuggestion!;
    const capabilityCheck = await this.checkCapabilitySupport(
      bestDetected.provider,
      requiredCapabilities
    );
    
    const adapter = this.createEmptyAdapter(bestDetected.provider);
    
    return {
      adapter,
      confidence: bestDetected.confidence * 0.7, // Reduced due to missing capabilities
      reasoning: [
        ...bestDetected.evidence,
        `Missing capabilities: ${capabilityCheck.missingCapabilities.join(', ')}`
      ],
      missingCapabilities: capabilityCheck.missingCapabilities
    };
  }

  /**
   * Create multiple adapter options for comparison
   */
  async getAllAdapterOptions(
    businessContext: BusinessContext,
    requiredCapabilities: POSCapability[] = []
  ): Promise<AdapterRecommendation[]> {
    const detectionResult = await this.detector.detectPOSSystems(businessContext);
    const recommendations: AdapterRecommendation[] = [];

    for (const detected of detectionResult.detectedSystems) {
      const capabilityCheck = await this.checkCapabilitySupport(
        detected.provider,
        requiredCapabilities
      );

      const adapter = this.createEmptyAdapter(detected.provider);
      const confidence = capabilityCheck.missingCapabilities.length > 0 
        ? detected.confidence * 0.7 
        : detected.confidence;

      recommendations.push({
        adapter,
        confidence,
        reasoning: [
          ...detected.evidence,
          capabilityCheck.missingCapabilities.length > 0
            ? `Missing capabilities: ${capabilityCheck.missingCapabilities.join(', ')}`
            : `Supports all required capabilities: ${requiredCapabilities.join(', ')}`
        ],
        missingCapabilities: capabilityCheck.missingCapabilities
      });
    }

    return recommendations.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Create a specific adapter by provider
   */
  createSpecificAdapter(provider: POSProvider, credentials?: POSCredentials): POSAdapter {
    const AdapterClass = this.adapterRegistry.get(provider);
    
    if (!AdapterClass) {
      throw new POSApiError({
        code: 'UNSUPPORTED_PROVIDER',
        message: `No adapter available for provider: ${provider}`
      });
    }

    const adapter = new AdapterClass();
    
    if (credentials) {
      // Initialize asynchronously - caller should await this
      adapter.initialize(credentials).catch(error => {
        console.error(`Failed to initialize ${provider} adapter:`, error);
      });
    }

    return adapter;
  }

  /**
   * Check if a provider is supported
   */
  isProviderSupported(provider: POSProvider): boolean {
    return this.adapterRegistry.has(provider);
  }

  /**
   * Get all supported providers
   */
  getSupportedProviders(): POSProvider[] {
    return Array.from(this.adapterRegistry.keys());
  }

  /**
   * Register a custom adapter
   */
  registerAdapter(provider: POSProvider, adapterClass: new () => POSAdapter): void {
    this.adapterRegistry.set(provider, adapterClass);
  }

  /**
   * Get OAuth manager for handling OAuth flows
   */
  getOAuthManager(): OAuthManager {
    return this.oauthManager;
  }

  /**
   * Get POS detector for capability analysis
   */
  getDetector(): POSDetector {
    return this.detector;
  }

  // Private methods
  private registerDefaultAdapters(): void {
    // Register actual adapter implementations
    this.adapterRegistry.set('square', SquareAdapter);
    this.adapterRegistry.set('shopify', ShopifyAdapter);
    this.adapterRegistry.set('zettle', ZettleAdapter);
  }

  private createEmptyAdapter(provider: POSProvider): POSAdapter {
    const AdapterClass = this.adapterRegistry.get(provider);
    
    if (!AdapterClass) {
      throw new POSApiError({
        code: 'UNSUPPORTED_PROVIDER',
        message: `No adapter available for provider: ${provider}`
      });
    }

    return new AdapterClass();
  }

  private async checkCapabilitySupport(
    provider: POSProvider,
    requiredCapabilities: POSCapability[]
  ): Promise<{ missingCapabilities: POSCapability[] }> {
    const providerCapabilities = this.detector.getProviderCapabilities(provider);
    const missingCapabilities = requiredCapabilities.filter(
      cap => !providerCapabilities.includes(cap)
    );

    return { missingCapabilities };
  }
}

// Mock adapter class for development
class MockAdapter {
  public readonly provider: POSProvider = 'square';
  public readonly capabilities: POSCapability[] = ['transactions', 'webhooks'];

  async initialize(): Promise<void> {
    // Mock implementation
  }

  isInitialized(): boolean {
    return true;
  }

  async disconnect(): Promise<void> {
    // Mock implementation
  }

  // Add other required methods as needed
}

// Export a singleton instance for convenience
export const posAdapterFactory = new POSAdapterFactory();