import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import {
  OAuthState,
  OAuthTokenResponse,
  OAuthAuthorizationUrl,
  POSCredentials
} from '../types';
import { POSProvider } from '@ai-feedback-platform/shared-types';
import { POSApiError } from '../base/BasePOSAdapter';

export interface OAuthConfig {
  provider: POSProvider;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes?: string[];
  environment?: 'sandbox' | 'production';
}

export interface ProviderOAuthEndpoints {
  authorizationUrl: string;
  tokenUrl: string;
  scopes: string[];
}

/**
 * Universal OAuth Manager for POS Systems
 * 
 * Handles OAuth flows for Square, Shopify, and Zettle with provider-specific
 * configurations and a standardized interface.
 */
export class OAuthManager {
  private readonly states = new Map<string, OAuthState>();
  private readonly credentials = new Map<string, OAuthConfig>();

  // Provider-specific OAuth endpoints
  private readonly endpoints: Record<POSProvider, ProviderOAuthEndpoints> = {
    square: {
      authorizationUrl: 'https://connect.squareup.com/oauth2/authorize',
      tokenUrl: 'https://connect.squareup.com/oauth2/token',
      scopes: ['PAYMENTS_READ', 'MERCHANT_PROFILE_READ']
    },
    shopify: {
      authorizationUrl: 'https://{shop}.myshopify.com/admin/oauth/authorize',
      tokenUrl: 'https://{shop}.myshopify.com/admin/oauth/access_token',
      scopes: ['read_orders', 'read_locations']
    },
    zettle: {
      authorizationUrl: 'https://oauth.zettle.com/authorize',
      tokenUrl: 'https://oauth.zettle.com/token',
      scopes: ['READ:PURCHASE', 'READ:PRODUCT']
    }
  };

  /**
   * Register OAuth configuration for a provider
   */
  registerProvider(config: OAuthConfig): void {
    this.validateConfig(config);
    this.credentials.set(config.provider, config);
  }

  /**
   * Generate authorization URL for OAuth flow
   */
  async generateAuthorizationUrl(
    provider: POSProvider,
    businessId: string,
    additionalParams: Record<string, string> = {}
  ): Promise<OAuthAuthorizationUrl> {
    const config = this.getConfig(provider);
    const endpoints = this.endpoints[provider];
    
    const state = this.generateState(businessId, config.redirectUri);
    const nonce = this.generateNonce();

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      state,
      scope: (config.scopes || endpoints.scopes).join(' '),
      ...additionalParams
    });

    let authUrl = endpoints.authorizationUrl;
    
    // Handle Shopify's shop-specific URL
    if (provider === 'shopify' && additionalParams.shop) {
      authUrl = authUrl.replace('{shop}', additionalParams.shop);
    }

    return {
      url: `${authUrl}?${params.toString()}`,
      state
    };
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(
    provider: POSProvider,
    code: string,
    state: string,
    additionalParams: Record<string, string> = {}
  ): Promise<OAuthTokenResponse> {
    const config = this.getConfig(provider);
    const endpoints = this.endpoints[provider];
    const oauthState = await this.validateState(state);

    const tokenData = await this.makeTokenRequest(provider, {
      grant_type: 'authorization_code',
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: config.redirectUri,
      ...additionalParams
    });

    // Clean up used state
    this.states.delete(state);

    return this.normalizeTokenResponse(provider, tokenData);
  }

  /**
   * Refresh access token
   */
  async refreshToken(
    provider: POSProvider,
    refreshToken: string
  ): Promise<OAuthTokenResponse> {
    const config = this.getConfig(provider);

    // Not all providers support refresh tokens
    if (provider === 'shopify') {
      throw new POSApiError({
        code: 'REFRESH_NOT_SUPPORTED',
        message: 'Shopify does not support refresh tokens'
      });
    }

    const tokenData = await this.makeTokenRequest(provider, {
      grant_type: 'refresh_token',
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken
    });

    return this.normalizeTokenResponse(provider, tokenData);
  }

  /**
   * Validate OAuth state parameter
   */
  async validateState(state: string): Promise<OAuthState> {
    const oauthState = this.states.get(state);
    
    if (!oauthState) {
      throw new POSApiError({
        code: 'INVALID_STATE',
        message: 'Invalid or expired OAuth state parameter'
      });
    }

    if (oauthState.expiresAt < new Date()) {
      this.states.delete(state);
      throw new POSApiError({
        code: 'EXPIRED_STATE',
        message: 'OAuth state parameter has expired'
      });
    }

    return oauthState;
  }

  /**
   * Create POS credentials from OAuth response
   */
  createCredentials(
    provider: POSProvider,
    tokenResponse: OAuthTokenResponse,
    additionalData: Partial<POSCredentials> = {}
  ): POSCredentials {
    const config = this.getConfig(provider);
    
    return {
      provider,
      accessToken: tokenResponse.accessToken,
      refreshToken: tokenResponse.refreshToken,
      tokenExpiresAt: tokenResponse.expiresIn 
        ? new Date(Date.now() + tokenResponse.expiresIn * 1000)
        : undefined,
      environment: config.environment || 'production',
      ...additionalData
    };
  }

  // Private methods
  private generateState(businessId: string, redirectUri: string): string {
    const state = uuidv4();
    const nonce = this.generateNonce();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    this.states.set(state, {
      businessId,
      redirectUrl: redirectUri,
      nonce,
      expiresAt
    });

    return state;
  }

  private generateNonce(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  private getConfig(provider: POSProvider): OAuthConfig {
    const config = this.credentials.get(provider);
    if (!config) {
      throw new POSApiError({
        code: 'PROVIDER_NOT_CONFIGURED',
        message: `OAuth configuration not found for provider: ${provider}`
      });
    }
    return config;
  }

  private validateConfig(config: OAuthConfig): void {
    if (!config.provider) {
      throw new POSApiError({
        code: 'INVALID_CONFIG',
        message: 'Provider is required'
      });
    }

    if (!config.clientId) {
      throw new POSApiError({
        code: 'INVALID_CONFIG',
        message: 'Client ID is required'
      });
    }

    if (!config.clientSecret) {
      throw new POSApiError({
        code: 'INVALID_CONFIG',
        message: 'Client secret is required'
      });
    }

    if (!config.redirectUri) {
      throw new POSApiError({
        code: 'INVALID_CONFIG',
        message: 'Redirect URI is required'
      });
    }
  }

  private async makeTokenRequest(
    provider: POSProvider,
    data: Record<string, string>
  ): Promise<any> {
    const endpoints = this.endpoints[provider];
    let tokenUrl = endpoints.tokenUrl;

    // Handle Shopify's shop-specific URL
    if (provider === 'shopify' && data.shop) {
      tokenUrl = tokenUrl.replace('{shop}', data.shop);
    }

    try {
      // In a real implementation, this would use axios or fetch
      // For now, we'll simulate the request
      const response = await this.simulateTokenRequest(provider, data);
      
      if (!response.access_token) {
        throw new POSApiError({
          code: 'TOKEN_EXCHANGE_FAILED',
          message: 'Failed to obtain access token'
        });
      }

      return response;
    } catch (error) {
      throw new POSApiError({
        code: 'TOKEN_REQUEST_FAILED',
        message: 'Failed to exchange code for token',
        originalError: error,
        retryable: true
      });
    }
  }

  // Simulate token request for development
  private async simulateTokenRequest(
    provider: POSProvider,
    data: Record<string, string>
  ): Promise<any> {
    // This is a mock implementation for development
    // In production, this would make real HTTP requests
    await new Promise(resolve => setTimeout(resolve, 100));

    return {
      access_token: `${provider}_access_token_${Date.now()}`,
      refresh_token: provider !== 'shopify' ? `${provider}_refresh_token_${Date.now()}` : undefined,
      expires_in: 3600,
      token_type: 'Bearer',
      scope: this.endpoints[provider].scopes.join(' ')
    };
  }

  private normalizeTokenResponse(provider: POSProvider, tokenData: any): OAuthTokenResponse {
    return {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresIn: tokenData.expires_in,
      tokenType: tokenData.token_type || 'Bearer',
      scope: tokenData.scope
    };
  }

  /**
   * Clean up expired OAuth states
   */
  cleanupExpiredStates(): void {
    const now = new Date();
    for (const [state, oauthState] of this.states.entries()) {
      if (oauthState.expiresAt < now) {
        this.states.delete(state);
      }
    }
  }

  /**
   * Get the number of active OAuth states (for monitoring)
   */
  getActiveStatesCount(): number {
    this.cleanupExpiredStates();
    return this.states.size;
  }
}