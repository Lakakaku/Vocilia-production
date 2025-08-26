import { gdprDb } from '@feedback-platform/database';
import { ConsentType, GDPRConfig } from './types';
import { ConsentManager } from './ConsentManager';

export interface CookieConsentPreferences {
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
}

export interface CookieConsentBanner {
  id: string;
  version: string;
  title: string;
  description: string;
  necessaryNotice: string;
  buttons: {
    acceptAll: string;
    rejectAll: string;
    customize: string;
    save: string;
  };
  categories: {
    functional: {
      title: string;
      description: string;
      required: boolean;
      cookies: string[];
    };
    analytics: {
      title: string;
      description: string;
      required: boolean;
      cookies: string[];
    };
    marketing: {
      title: string;
      description: string;
      required: boolean;
      cookies: string[];
    };
  };
}

export class CookieConsentManager {
  private consentManager: ConsentManager;
  private currentBannerVersion = '1.0';

  constructor(private config: GDPRConfig) {
    this.consentManager = new ConsentManager(config);
  }

  // Get cookie consent banner configuration
  getBannerConfiguration(): CookieConsentBanner {
    return {
      id: 'gdpr-cookie-consent',
      version: this.currentBannerVersion,
      title: 'Cookie-inställningar',
      description: 'Vi använder cookies för att förbättra din upplevelse. Välj vilka cookies du godkänner.',
      necessaryNotice: 'Funktionella cookies krävs för att plattformen ska fungera och kan inte stängas av.',
      buttons: {
        acceptAll: 'Acceptera alla',
        rejectAll: 'Avvisa alla',
        customize: 'Anpassa',
        save: 'Spara inställningar'
      },
      categories: {
        functional: {
          title: 'Funktionella cookies',
          description: 'Nödvändiga för grundläggande funktionalitet som säkerhet, autentisering och formulär.',
          required: true,
          cookies: [
            'session-token',
            'csrf-token', 
            'feedback-session',
            'qr-validation',
            'voice-processing'
          ]
        },
        analytics: {
          title: 'Analys cookies',
          description: 'Hjälper oss förstå hur plattformen används genom anonyma användningsstatistik.',
          required: false,
          cookies: [
            'analytics-session',
            'page-views',
            'feedback-completion',
            'performance-metrics'
          ]
        },
        marketing: {
          title: 'Marknadsföring cookies',
          description: 'Används för att visa relevanta meddelanden och förbättringar baserat på dina intressen.',
          required: false,
          cookies: [
            'marketing-preferences',
            'campaign-tracking',
            'user-segments',
            'promotional-content'
          ]
        }
      }
    };
  }

  // Record cookie consent preferences
  async recordCookieConsent(
    sessionId: string,
    customerHash: string,
    preferences: CookieConsentPreferences,
    metadata: {
      ipAddress: string;
      userAgent: string;
      consentMethod: 'banner' | 'settings' | 'api';
      bannerVersion: string;
    }
  ): Promise<void> {
    // Record individual consent types
    await Promise.all([
      // Functional cookies are always required
      this.consentManager.recordConsent(
        sessionId,
        customerHash,
        ConsentType.COOKIES_FUNCTIONAL,
        true, // Always true - required for functionality
        {
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          version: metadata.bannerVersion
        }
      ),
      
      // Analytics cookies based on preference
      this.consentManager.recordConsent(
        sessionId,
        customerHash,
        ConsentType.COOKIES_ANALYTICS,
        preferences.analytics,
        {
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          version: metadata.bannerVersion
        }
      ),
      
      // Marketing cookies based on preference
      this.consentManager.recordConsent(
        sessionId,
        customerHash,
        ConsentType.COOKIES_MARKETING,
        preferences.marketing,
        {
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          version: metadata.bannerVersion
        }
      )
    ]);

    // Log comprehensive cookie consent event
    await gdprDb.createAuditLog({
      customerHash,
      actionType: 'cookie_consent_updated',
      actionDetails: {
        sessionId,
        preferences,
        consentMethod: metadata.consentMethod,
        bannerVersion: metadata.bannerVersion,
        timestamp: new Date()
      },
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      legalBasis: 'consent'
    });

    console.log(`Cookie consent recorded for customer ${customerHash}:`, preferences);
  }

  // Get current cookie consent preferences
  async getCookieConsentPreferences(customerHash: string): Promise<CookieConsentPreferences | null> {
    try {
      const [functional, analytics, marketing] = await Promise.all([
        this.consentManager.hasValidConsent(customerHash, ConsentType.COOKIES_FUNCTIONAL),
        this.consentManager.hasValidConsent(customerHash, ConsentType.COOKIES_ANALYTICS),
        this.consentManager.hasValidConsent(customerHash, ConsentType.COOKIES_MARKETING)
      ]);

      return {
        functional,
        analytics,
        marketing
      };
    } catch (error) {
      console.error('Failed to get cookie consent preferences:', error);
      return null;
    }
  }

  // Check if cookie consent is required (new user or outdated consent)
  async isCookieConsentRequired(customerHash: string): Promise<{
    required: boolean;
    reason?: 'new_user' | 'outdated_version' | 'revoked_consent' | 'expired_consent';
    lastConsentDate?: Date;
    lastConsentVersion?: string;
  }> {
    try {
      // Check for any existing cookie consent
      const [functionalConsent, analyticsConsent, marketingConsent] = await Promise.all([
        this.consentManager.getConsent(customerHash, ConsentType.COOKIES_FUNCTIONAL),
        this.consentManager.getConsent(customerHash, ConsentType.COOKIES_ANALYTICS),
        this.consentManager.getConsent(customerHash, ConsentType.COOKIES_MARKETING)
      ]);

      // If no consent records exist, it's a new user
      if (!functionalConsent && !analyticsConsent && !marketingConsent) {
        return {
          required: true,
          reason: 'new_user'
        };
      }

      // Check if consent version is outdated
      const latestConsent = [functionalConsent, analyticsConsent, marketingConsent]
        .filter(Boolean)
        .sort((a, b) => b!.timestamp.getTime() - a!.timestamp.getTime())[0];

      if (latestConsent && latestConsent.version !== this.currentBannerVersion) {
        return {
          required: true,
          reason: 'outdated_version',
          lastConsentDate: latestConsent.timestamp,
          lastConsentVersion: latestConsent.version
        };
      }

      // Check if consent was explicitly revoked
      if (latestConsent && !latestConsent.granted) {
        return {
          required: true,
          reason: 'revoked_consent',
          lastConsentDate: latestConsent.timestamp,
          lastConsentVersion: latestConsent.version
        };
      }

      // Check if consent is expired (older than 12 months)
      if (latestConsent) {
        const consentAge = Date.now() - latestConsent.timestamp.getTime();
        const twelveMonths = 365 * 24 * 60 * 60 * 1000; // 12 months in milliseconds
        
        if (consentAge > twelveMonths) {
          return {
            required: true,
            reason: 'expired_consent',
            lastConsentDate: latestConsent.timestamp,
            lastConsentVersion: latestConsent.version
          };
        }
      }

      // Consent is valid and current
      return {
        required: false,
        lastConsentDate: latestConsent?.timestamp,
        lastConsentVersion: latestConsent?.version
      };

    } catch (error) {
      console.error('Failed to check cookie consent requirement:', error);
      // Default to requiring consent for safety
      return {
        required: true,
        reason: 'new_user'
      };
    }
  }

  // Handle "Accept All" consent
  async acceptAllCookies(
    sessionId: string,
    customerHash: string,
    metadata: {
      ipAddress: string;
      userAgent: string;
    }
  ): Promise<void> {
    await this.recordCookieConsent(
      sessionId,
      customerHash,
      {
        functional: true,
        analytics: true,
        marketing: true
      },
      {
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        consentMethod: 'banner',
        bannerVersion: this.currentBannerVersion
      }
    );
  }

  // Handle "Reject All" consent (except functional)
  async rejectAllCookies(
    sessionId: string,
    customerHash: string,
    metadata: {
      ipAddress: string;
      userAgent: string;
    }
  ): Promise<void> {
    await this.recordCookieConsent(
      sessionId,
      customerHash,
      {
        functional: true, // Always required
        analytics: false,
        marketing: false
      },
      {
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        consentMethod: 'banner',
        bannerVersion: this.currentBannerVersion
      }
    );
  }

  // Generate JavaScript code for cookie management
  generateCookieScript(customerHash: string): string {
    return `
// GDPR Cookie Consent Management
(function() {
  const CUSTOMER_HASH = '${customerHash}';
  const API_ENDPOINT = '/api/gdpr/cookie-consent';
  
  // Check current consent status
  async function checkConsentStatus() {
    try {
      const response = await fetch(API_ENDPOINT + '/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerHash: CUSTOMER_HASH })
      });
      
      return await response.json();
    } catch (error) {
      console.error('Failed to check consent status:', error);
      return { required: true };
    }
  }
  
  // Load analytics scripts only if consent given
  function loadAnalytics(enabled) {
    if (enabled && window.gtag) {
      gtag('consent', 'update', {
        analytics_storage: 'granted'
      });
    }
  }
  
  // Load marketing scripts only if consent given
  function loadMarketing(enabled) {
    if (enabled) {
      // Load marketing scripts here
    }
  }
  
  // Apply consent preferences
  function applyConsent(preferences) {
    // Set functional cookies (always allowed)
    document.cookie = 'functional_consent=granted; path=/; secure; samesite=strict';
    
    // Set analytics consent
    if (preferences.analytics) {
      document.cookie = 'analytics_consent=granted; path=/; secure; samesite=strict';
      loadAnalytics(true);
    } else {
      document.cookie = 'analytics_consent=denied; path=/; secure; samesite=strict';
    }
    
    // Set marketing consent
    if (preferences.marketing) {
      document.cookie = 'marketing_consent=granted; path=/; secure; samesite=strict';
      loadMarketing(true);
    } else {
      document.cookie = 'marketing_consent=denied; path=/; secure; samesite=strict';
    }
  }
  
  // Initialize cookie management
  window.initializeCookieConsent = async function() {
    const status = await checkConsentStatus();
    
    if (status.required) {
      // Show cookie consent banner
      window.showCookieConsentBanner();
    } else if (status.preferences) {
      // Apply existing preferences
      applyConsent(status.preferences);
    }
  };
  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.initializeCookieConsent);
  } else {
    window.initializeCookieConsent();
  }
})();
`;
  }

  // Get cookie consent statistics
  async getCookieConsentStats(): Promise<{
    totalUsers: number;
    acceptedAll: number;
    rejectedAll: number;
    customized: number;
    analyticsOptIn: number;
    marketingOptIn: number;
    consentByVersion: Record<string, number>;
    averageConsentAge: number; // in days
  }> {
    // This would require database queries for actual statistics
    return {
      totalUsers: 0,
      acceptedAll: 0,
      rejectedAll: 0,
      customized: 0,
      analyticsOptIn: 0,
      marketingOptIn: 0,
      consentByVersion: {},
      averageConsentAge: 0
    };
  }

  // Update banner version (forces re-consent)
  updateBannerVersion(newVersion: string, changes: string[]): void {
    const oldVersion = this.currentBannerVersion;
    this.currentBannerVersion = newVersion;
    
    console.log(`Cookie consent banner updated from ${oldVersion} to ${newVersion}`);
    console.log('Changes:', changes);
    
    // Log version update for compliance
    gdprDb.createAuditLog({
      actionType: 'cookie_banner_version_updated',
      actionDetails: {
        oldVersion,
        newVersion,
        changes,
        updatedAt: new Date()
      },
      legalBasis: 'legal_obligation'
    });
  }

  // Validate cookie compliance
  async validateCookieCompliance(): Promise<{
    compliant: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    try {
      const stats = await this.getCookieConsentStats();
      
      // Check for users without consent
      if (stats.totalUsers === 0) {
        issues.push('No cookie consent records found');
        recommendations.push('Ensure cookie consent banner is deployed');
      }

      // Check for outdated consents
      if (stats.averageConsentAge > 365) {
        issues.push('Average consent age exceeds 12 months');
        recommendations.push('Consider refreshing cookie consent for old users');
      }

      // Check consent distribution
      const acceptanceRate = stats.totalUsers > 0 ? 
        (stats.acceptedAll + stats.customized) / stats.totalUsers : 0;
      
      if (acceptanceRate < 0.1) {
        recommendations.push('Low consent acceptance rate - review banner UX');
      }

      return {
        compliant: issues.length === 0,
        issues,
        recommendations
      };

    } catch (error) {
      issues.push(`Cookie compliance validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      return {
        compliant: false,
        issues,
        recommendations: ['Fix validation errors and retry']
      };
    }
  }

  // Emergency revoke all consents (for privacy incidents)
  async emergencyRevokeAllConsents(reason: string): Promise<{
    usersProcessed: number;
    errors: string[];
  }> {
    const result = {
      usersProcessed: 0,
      errors: [] as string[]
    };

    try {
      // This would require querying all users with cookie consents
      // and revoking them systematically
      
      // Log emergency revocation
      await gdprDb.createAuditLog({
        actionType: 'emergency_cookie_consent_revocation',
        actionDetails: {
          reason,
          initiatedAt: new Date(),
          scope: 'all_users'
        },
        legalBasis: 'legal_obligation'
      });

    } catch (error) {
      result.errors.push(`Emergency revocation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  // Generate cookie policy documentation
  generateCookiePolicy(): {
    title: string;
    content: string;
    lastUpdated: Date;
  } {
    return {
      title: 'Cookie Policy - AI Feedback Platform',
      content: `
# Cookie Policy

Denna cookiepolicy förklarar hur AI Feedback Platform använder cookies och liknande teknologier.

## Vad är cookies?
Cookies är små textfiler som lagras på din enhet när du besöker vår webbplats. De hjälper oss att tillhandahålla och förbättra våra tjänster.

## Cookies vi använder

### Funktionella cookies (Nödvändiga)
Dessa cookies krävs för att plattformen ska fungera korrekt:
- **session-token**: Säker sessionshantering
- **feedback-session**: Hantering av feedbacksessioner  
- **qr-validation**: QR-kodvalidering

### Analyscookies (Valfria)
Med ditt samtycke använder vi analyscookies för att:
- Förstå hur plattformen används
- Förbättra användarupplevelsen
- Mäta prestanda

### Marknadsföringscookies (Valfria)
Med ditt samtycke använder vi marknadsföringscookies för att:
- Visa relevanta meddelanden
- Personalisera innehåll
- Förbättra våra tjänster

## Dina rättigheter
Du har rätt att:
- Ge eller återkalla samtycke när som helst
- Se vilka cookies vi använder
- Begära radering av dina uppgifter

## Kontakt
För frågor om cookies, kontakta oss på privacy@ai-feedback-platform.se

Senast uppdaterad: ${new Date().toLocaleDateString('sv-SE')}
      `,
      lastUpdated: new Date()
    };
  }
}