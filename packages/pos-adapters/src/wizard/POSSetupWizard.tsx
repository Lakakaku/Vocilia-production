import React, { useState, useCallback, useEffect } from 'react';
import { POSProvider } from '@ai-feedback-platform/shared-types';
import { POSAdapterFactory } from '../factory/POSAdapterFactory';
import { POSIntegrationTestFramework } from '../testing/POSIntegrationTestFramework';
import { POSDetector } from '../detection/POSDetector';

/**
 * POS Setup Wizard Component
 * 
 * Guided setup wizard for business POS integration with:
 * - Swedish localization
 * - Step-by-step integration
 * - Connection testing
 * - Troubleshooting guides
 */
export const POSSetupWizard: React.FC<WizardProps> = ({
  businessId,
  businessName,
  onComplete,
  onCancel,
  swedishLocale = true,
  showRecommendations = true
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [provider, setProvider] = useState<POSProvider | null>(null);
  const [credentials, setCredentials] = useState<any>({});
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<ProviderRecommendation[]>([]);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);
  
  const factory = new POSAdapterFactory();
  const testFramework = new POSIntegrationTestFramework();
  const detector = new POSDetector();

  // Load recommendations on mount
  useEffect(() => {
    if (showRecommendations) {
      loadRecommendations();
    }
  }, [showRecommendations]);

  const loadRecommendations = async () => {
    try {
      // Get business context (would come from API)
      const businessContext = {
        type: 'retail',
        size: 'medium',
        country: 'SE',
        existingSystems: []
      };
      
      const detectionResult = await detector.detectPOSSystems(businessContext);
      
      const recs = detectionResult.detectedSystems.map(system => ({
        provider: system.provider,
        confidence: system.confidence,
        reasons: system.evidence,
        recommended: system.confidence > 0.7
      }));
      
      // Sort by confidence
      recs.sort((a, b) => b.confidence - a.confidence);
      
      setRecommendations(recs);
    } catch (error) {
      console.error('Failed to load recommendations:', error);
    }
  };

  const steps: WizardStep[] = [
    {
      id: 'welcome',
      title: t('welcomeTitle'),
      component: <WelcomeStep businessName={businessName} />
    },
    {
      id: 'provider',
      title: t('selectProvider'),
      component: (
        <ProviderSelectionStep
          recommendations={recommendations}
          selectedProvider={provider}
          onSelect={setProvider}
          swedishLocale={swedishLocale}
        />
      )
    },
    {
      id: 'credentials',
      title: t('enterCredentials'),
      component: provider ? (
        <CredentialsStep
          provider={provider}
          credentials={credentials}
          onChange={setCredentials}
          swedishLocale={swedishLocale}
        />
      ) : null
    },
    {
      id: 'connect',
      title: t('testConnection'),
      component: provider ? (
        <ConnectionTestStep
          provider={provider}
          connectionStatus={connectionStatus}
          testResults={testResults}
          swedishLocale={swedishLocale}
        />
      ) : null
    },
    {
      id: 'locations',
      title: t('mapLocations'),
      component: connectionStatus?.connected ? (
        <LocationMappingStep
          provider={provider!}
          locations={connectionStatus.locations || []}
          swedishLocale={swedishLocale}
        />
      ) : null
    },
    {
      id: 'complete',
      title: t('setupComplete'),
      component: (
        <CompletionStep
          provider={provider}
          businessName={businessName}
          swedishLocale={swedishLocale}
        />
      )
    }
  ];

  const currentStepData = steps[currentStep];

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 0: return true; // Welcome
      case 1: return provider !== null; // Provider selection
      case 2: return validateCredentials(); // Credentials
      case 3: return connectionStatus?.connected || false; // Connection test
      case 4: return true; // Location mapping (optional)
      default: return false;
    }
  };

  const validateCredentials = (): boolean => {
    if (!provider) return false;
    
    switch (provider) {
      case 'square':
        return !!credentials.accessToken || (!!credentials.clientId && !!credentials.clientSecret);
      case 'shopify':
        return !!credentials.shopDomain && !!credentials.accessToken;
      case 'zettle':
        return !!credentials.accessToken || (!!credentials.clientId && !!credentials.clientSecret);
      default:
        return false;
    }
  };

  const handleNext = async () => {
    if (!canProceed()) {
      setError(t('cannotProceed'));
      return;
    }

    // Special handling for connection test step
    if (currentStep === 2) {
      await testConnection();
    }

    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
      setError(null);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      setError(null);
      setShowTroubleshooting(false);
    }
  };

  const testConnection = async () => {
    if (!provider) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Create adapter and test connection
      const adapter = factory.createSpecificAdapter(provider, credentials);
      const status = await adapter.testConnection(credentials);
      
      setConnectionStatus({
        connected: status.connected,
        provider,
        capabilities: status.capabilities || [],
        locations: status.locations || [],
        error: status.error
      });

      // Run basic tests
      const tests = await testFramework.runTestSuite(
        {
          id: 'basic',
          name: 'Basic Connection Tests',
          description: 'Essential connection validation',
          tests: [
            {
              id: 'auth',
              name: 'Authentication',
              type: 'integration',
              run: async () => ({
                success: status.connected,
                message: status.connected ? 'Authenticated successfully' : 'Authentication failed',
                details: { provider }
              })
            },
            {
              id: 'locations',
              name: 'Location Access',
              type: 'integration',
              run: async () => ({
                success: (status.locations?.length || 0) > 0,
                message: `Found ${status.locations?.length || 0} locations`,
                details: { count: status.locations?.length || 0 }
              })
            }
          ]
        },
        adapter,
        provider
      );
      
      setTestResults(tests);
      
      if (!status.connected) {
        setError(status.error?.message || t('connectionFailed'));
        setShowTroubleshooting(true);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : t('connectionFailed'));
      setConnectionStatus({
        connected: false,
        provider,
        capabilities: [],
        locations: [],
        error: { message: error instanceof Error ? error.message : 'Unknown error' }
      });
      setShowTroubleshooting(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleComplete = () => {
    if (onComplete) {
      onComplete({
        provider: provider!,
        credentials,
        connectionStatus: connectionStatus!,
        businessId
      });
    }
  };

  function t(key: string): string {
    if (!swedishLocale) return translations.en[key] || key;
    return translations.sv[key] || key;
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={`flex items-center ${
                index < steps.length - 1 ? 'flex-1' : ''
              }`}
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                  index < currentStep
                    ? 'bg-green-500 border-green-500 text-white'
                    : index === currentStep
                    ? 'bg-blue-500 border-blue-500 text-white'
                    : 'bg-gray-100 border-gray-300 text-gray-500'
                }`}
              >
                {index < currentStep ? '✓' : index + 1}
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`flex-1 h-1 mx-2 ${
                    index < currentStep ? 'bg-green-500' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between text-sm">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={`text-center ${
                index === currentStep ? 'text-blue-600 font-semibold' : 'text-gray-500'
              }`}
              style={{ width: `${100 / steps.length}%` }}
            >
              {step.title}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-lg shadow-lg p-6 min-h-[400px]">
        <h2 className="text-2xl font-bold mb-6">{currentStepData.title}</h2>
        
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}
        
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">{t('testingConnection')}</p>
            </div>
          </div>
        ) : (
          currentStepData.component
        )}
        
        {showTroubleshooting && (
          <TroubleshootingGuide
            provider={provider}
            error={error}
            swedishLocale={swedishLocale}
          />
        )}
      </div>

      {/* Navigation */}
      <div className="mt-6 flex justify-between">
        <button
          onClick={currentStep === 0 ? onCancel : handlePrevious}
          className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          {currentStep === 0 ? t('cancel') : t('previous')}
        </button>
        
        <button
          onClick={handleNext}
          disabled={!canProceed() || isLoading}
          className={`px-6 py-2 rounded-lg text-white ${
            canProceed() && !isLoading
              ? 'bg-blue-600 hover:bg-blue-700'
              : 'bg-gray-400 cursor-not-allowed'
          }`}
        >
          {currentStep === steps.length - 1 ? t('complete') : t('next')}
        </button>
      </div>
    </div>
  );
};

// Step Components

const WelcomeStep: React.FC<{ businessName: string }> = ({ businessName }) => {
  const t = (key: string) => translations.sv[key] || key;
  
  return (
    <div className="text-center py-8">
      <h3 className="text-xl font-semibold mb-4">
        {t('welcomeMessage').replace('{businessName}', businessName)}
      </h3>
      <p className="text-gray-600 mb-6">
        {t('welcomeDescription')}
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        <FeatureCard
          icon="🔗"
          title={t('feature1Title')}
          description={t('feature1Desc')}
        />
        <FeatureCard
          icon="⚡"
          title={t('feature2Title')}
          description={t('feature2Desc')}
        />
        <FeatureCard
          icon="🛡️"
          title={t('feature3Title')}
          description={t('feature3Desc')}
        />
      </div>
    </div>
  );
};

const FeatureCard: React.FC<{ icon: string; title: string; description: string }> = ({
  icon,
  title,
  description
}) => (
  <div className="p-4 bg-gray-50 rounded-lg">
    <div className="text-3xl mb-2">{icon}</div>
    <h4 className="font-semibold mb-2">{title}</h4>
    <p className="text-sm text-gray-600">{description}</p>
  </div>
);

const ProviderSelectionStep: React.FC<{
  recommendations: ProviderRecommendation[];
  selectedProvider: POSProvider | null;
  onSelect: (provider: POSProvider) => void;
  swedishLocale: boolean;
}> = ({ recommendations, selectedProvider, onSelect, swedishLocale }) => {
  const providers: POSProvider[] = ['square', 'shopify', 'zettle'];
  
  return (
    <div>
      <p className="text-gray-600 mb-6">
        {swedishLocale 
          ? 'Välj din POS-leverantör från listan nedan.'
          : 'Select your POS provider from the list below.'}
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {providers.map(provider => {
          const recommendation = recommendations.find(r => r.provider === provider);
          const isRecommended = recommendation?.recommended;
          
          return (
            <ProviderCard
              key={provider}
              provider={provider}
              selected={selectedProvider === provider}
              recommended={isRecommended}
              confidence={recommendation?.confidence}
              onSelect={() => onSelect(provider)}
              swedishLocale={swedishLocale}
            />
          );
        })}
      </div>
    </div>
  );
};

const ProviderCard: React.FC<{
  provider: POSProvider;
  selected: boolean;
  recommended?: boolean;
  confidence?: number;
  onSelect: () => void;
  swedishLocale: boolean;
}> = ({ provider, selected, recommended, confidence, onSelect, swedishLocale }) => {
  const providerInfo = {
    square: {
      name: 'Square',
      logo: '⬛',
      description: swedishLocale 
        ? 'Populär i USA, växande i Europa'
        : 'Popular in US, growing in Europe'
    },
    shopify: {
      name: 'Shopify POS',
      logo: '🛍️',
      description: swedishLocale
        ? 'E-handel och butik integrerat'
        : 'E-commerce and retail integrated'
    },
    zettle: {
      name: 'Zettle by PayPal',
      logo: '💳',
      description: swedishLocale
        ? 'Populär i Sverige, Swish-stöd'
        : 'Popular in Sweden, Swish support'
    }
  }[provider];

  return (
    <div
      onClick={onSelect}
      className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
        selected 
          ? 'border-blue-500 bg-blue-50' 
          : 'border-gray-200 hover:border-gray-400'
      } ${recommended ? 'ring-2 ring-green-400' : ''}`}
    >
      {recommended && (
        <div className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded mb-2 inline-block">
          {swedishLocale ? 'Rekommenderad' : 'Recommended'} 
          {confidence && ` (${Math.round(confidence * 100)}%)`}
        </div>
      )}
      
      <div className="text-3xl mb-2">{providerInfo?.logo}</div>
      <h3 className="font-semibold text-lg mb-1">{providerInfo?.name}</h3>
      <p className="text-sm text-gray-600">{providerInfo?.description}</p>
    </div>
  );
};

const CredentialsStep: React.FC<{
  provider: POSProvider;
  credentials: any;
  onChange: (credentials: any) => void;
  swedishLocale: boolean;
}> = ({ provider, credentials, onChange, swedishLocale }) => {
  const handleFieldChange = (field: string, value: string) => {
    onChange({ ...credentials, [field]: value, provider });
  };

  const getFields = () => {
    switch (provider) {
      case 'square':
        return [
          { 
            id: 'accessToken', 
            label: 'Access Token', 
            type: 'password',
            help: swedishLocale 
              ? 'Finns i Square Dashboard > Apps'
              : 'Found in Square Dashboard > Apps'
          },
          { 
            id: 'environment', 
            label: swedishLocale ? 'Miljö' : 'Environment', 
            type: 'select',
            options: ['sandbox', 'production'],
            help: swedishLocale
              ? 'Använd sandbox för test'
              : 'Use sandbox for testing'
          }
        ];
      
      case 'shopify':
        return [
          { 
            id: 'shopDomain', 
            label: swedishLocale ? 'Butiks-domän' : 'Shop Domain',
            type: 'text',
            placeholder: 'myshop.myshopify.com',
            help: swedishLocale
              ? 'Din Shopify-butiks URL'
              : 'Your Shopify store URL'
          },
          { 
            id: 'accessToken', 
            label: 'Access Token',
            type: 'password',
            help: swedishLocale
              ? 'Private app access token'
              : 'Private app access token'
          }
        ];
      
      case 'zettle':
        return [
          { 
            id: 'clientId', 
            label: 'Client ID',
            type: 'text',
            help: swedishLocale
              ? 'Från Zettle Developer Portal'
              : 'From Zettle Developer Portal'
          },
          { 
            id: 'clientSecret', 
            label: 'Client Secret',
            type: 'password',
            help: swedishLocale
              ? 'Hemlig nyckel från Developer Portal'
              : 'Secret key from Developer Portal'
          }
        ];
      
      default:
        return [];
    }
  };

  return (
    <div>
      <p className="text-gray-600 mb-6">
        {swedishLocale
          ? 'Ange dina API-uppgifter för att ansluta till ' + provider
          : 'Enter your API credentials to connect to ' + provider}
      </p>

      <div className="space-y-4">
        {getFields().map(field => (
          <div key={field.id}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {field.label}
            </label>
            {field.type === 'select' ? (
              <select
                value={credentials[field.id] || field.options?.[0]}
                onChange={(e) => handleFieldChange(field.id, e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {field.options?.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            ) : (
              <input
                type={field.type}
                value={credentials[field.id] || ''}
                onChange={(e) => handleFieldChange(field.id, e.target.value)}
                placeholder={field.placeholder}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
            {field.help && (
              <p className="text-xs text-gray-500 mt-1">{field.help}</p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h4 className="font-semibold text-sm mb-2">
          {swedishLocale ? '💡 Tips' : '💡 Tip'}
        </h4>
        <p className="text-sm text-gray-700">
          {swedishLocale
            ? 'Se till att du har rätt behörigheter aktiverade i din POS-leverantörs dashboard.'
            : 'Make sure you have the correct permissions enabled in your POS provider dashboard.'}
        </p>
      </div>
    </div>
  );
};

const ConnectionTestStep: React.FC<{
  provider: POSProvider;
  connectionStatus: ConnectionStatus | null;
  testResults: TestResult[];
  swedishLocale: boolean;
}> = ({ provider, connectionStatus, testResults, swedishLocale }) => {
  if (!connectionStatus) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600">
          {swedishLocale 
            ? 'Klicka på "Nästa" för att testa anslutningen.'
            : 'Click "Next" to test the connection.'}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className={`p-6 rounded-lg mb-6 ${
        connectionStatus.connected ? 'bg-green-50' : 'bg-red-50'
      }`}>
        <div className="flex items-center">
          <div className={`text-3xl mr-4 ${
            connectionStatus.connected ? 'text-green-600' : 'text-red-600'
          }`}>
            {connectionStatus.connected ? '✅' : '❌'}
          </div>
          <div>
            <h3 className="font-semibold text-lg">
              {connectionStatus.connected
                ? (swedishLocale ? 'Anslutning lyckades!' : 'Connection successful!')
                : (swedishLocale ? 'Anslutning misslyckades' : 'Connection failed')}
            </h3>
            {connectionStatus.error && (
              <p className="text-sm text-gray-600 mt-1">{connectionStatus.error.message}</p>
            )}
          </div>
        </div>
      </div>

      {testResults.length > 0 && (
        <div>
          <h4 className="font-semibold mb-3">
            {swedishLocale ? 'Testresultat' : 'Test Results'}
          </h4>
          <div className="space-y-2">
            {testResults.map((result, index) => (
              <TestResultItem key={index} result={result} swedishLocale={swedishLocale} />
            ))}
          </div>
        </div>
      )}

      {connectionStatus.connected && connectionStatus.capabilities && (
        <div className="mt-6">
          <h4 className="font-semibold mb-3">
            {swedishLocale ? 'Tillgängliga funktioner' : 'Available capabilities'}
          </h4>
          <div className="flex flex-wrap gap-2">
            {connectionStatus.capabilities.map(capability => (
              <span
                key={capability}
                className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
              >
                {capability}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const TestResultItem: React.FC<{
  result: TestResult;
  swedishLocale: boolean;
}> = ({ result, swedishLocale }) => {
  const getStatusIcon = () => {
    switch (result.status) {
      case 'passed': return '✅';
      case 'failed': return '❌';
      case 'error': return '⚠️';
      default: return '⏭️';
    }
  };

  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
      <div className="flex items-center">
        <span className="mr-3">{getStatusIcon()}</span>
        <span className="font-medium">{result.testName}</span>
      </div>
      <span className="text-sm text-gray-600">
        {result.duration}ms
      </span>
    </div>
  );
};

const LocationMappingStep: React.FC<{
  provider: POSProvider;
  locations: any[];
  swedishLocale: boolean;
}> = ({ provider, locations, swedishLocale }) => {
  const [mappedLocations, setMappedLocations] = useState<any[]>([]);

  return (
    <div>
      <p className="text-gray-600 mb-6">
        {swedishLocale
          ? `Vi hittade ${locations.length} plats(er) i ditt ${provider}-konto.`
          : `We found ${locations.length} location(s) in your ${provider} account.`}
      </p>

      {locations.length > 0 ? (
        <div className="space-y-4">
          {locations.map((location, index) => (
            <div key={index} className="p-4 border rounded-lg">
              <h4 className="font-semibold">{location.name}</h4>
              {location.address && (
                <p className="text-sm text-gray-600 mt-1">
                  {location.address.line1}, {location.address.city}
                </p>
              )}
              <div className="mt-3">
                <label className="text-sm font-medium">
                  {swedishLocale ? 'Koppla till affärsplats' : 'Map to business location'}
                </label>
                <select className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg">
                  <option value="">
                    {swedishLocale ? 'Välj plats...' : 'Select location...'}
                  </option>
                  <option value="main">
                    {swedishLocale ? 'Huvudkontor' : 'Main Office'}
                  </option>
                  <option value="store1">
                    {swedishLocale ? 'Butik 1' : 'Store 1'}
                  </option>
                </select>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <p className="text-gray-600">
            {swedishLocale
              ? 'Inga platser hittades. Du kan lägga till dem senare.'
              : 'No locations found. You can add them later.'}
          </p>
        </div>
      )}
    </div>
  );
};

const CompletionStep: React.FC<{
  provider: POSProvider | null;
  businessName: string;
  swedishLocale: boolean;
}> = ({ provider, businessName, swedishLocale }) => {
  return (
    <div className="text-center py-8">
      <div className="text-6xl mb-4">🎉</div>
      <h3 className="text-2xl font-bold mb-4">
        {swedishLocale ? 'Installation klar!' : 'Setup Complete!'}
      </h3>
      <p className="text-gray-600 mb-6">
        {swedishLocale
          ? `${businessName} är nu anslutet till ${provider}. Dina kunder kan börja ge feedback och tjäna belöningar!`
          : `${businessName} is now connected to ${provider}. Your customers can start giving feedback and earning rewards!`}
      </p>
      
      <div className="bg-blue-50 p-6 rounded-lg text-left max-w-md mx-auto">
        <h4 className="font-semibold mb-3">
          {swedishLocale ? 'Nästa steg:' : 'Next steps:'}
        </h4>
        <ul className="space-y-2 text-sm">
          <li className="flex items-start">
            <span className="mr-2">📱</span>
            <span>
              {swedishLocale
                ? 'Skriv ut och placera QR-koder i din butik'
                : 'Print and place QR codes in your store'}
            </span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">👥</span>
            <span>
              {swedishLocale
                ? 'Träna din personal om systemet'
                : 'Train your staff about the system'}
            </span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">📊</span>
            <span>
              {swedishLocale
                ? 'Konfigurera dina affärsinsikter'
                : 'Configure your business insights'}
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
};

const TroubleshootingGuide: React.FC<{
  provider: POSProvider | null;
  error: string | null;
  swedishLocale: boolean;
}> = ({ provider, error, swedishLocale }) => {
  const getCommonIssues = () => {
    const issues = {
      square: [
        {
          problem: swedishLocale ? 'Ogiltig access token' : 'Invalid access token',
          solution: swedishLocale 
            ? 'Kontrollera att token är korrekt kopierad från Square Dashboard'
            : 'Check that token is correctly copied from Square Dashboard'
        },
        {
          problem: swedishLocale ? 'Fel miljö' : 'Wrong environment',
          solution: swedishLocale
            ? 'Säkerställ att du använder rätt miljö (sandbox/production)'
            : 'Ensure you are using the correct environment (sandbox/production)'
        }
      ],
      shopify: [
        {
          problem: swedishLocale ? 'Fel domän' : 'Invalid domain',
          solution: swedishLocale
            ? 'Använd formatet: myshop.myshopify.com'
            : 'Use format: myshop.myshopify.com'
        },
        {
          problem: swedishLocale ? 'Otillräckliga behörigheter' : 'Insufficient permissions',
          solution: swedishLocale
            ? 'Kontrollera att appen har läs-behörighet för orders'
            : 'Check that app has read permission for orders'
        }
      ],
      zettle: [
        {
          problem: swedishLocale ? 'OAuth-fel' : 'OAuth error',
          solution: swedishLocale
            ? 'Verifiera Client ID och Client Secret från Developer Portal'
            : 'Verify Client ID and Client Secret from Developer Portal'
        },
        {
          problem: swedishLocale ? 'Merchant ej godkänd' : 'Merchant not approved',
          solution: swedishLocale
            ? 'Säkerställ att ditt Zettle-konto är helt verifierat'
            : 'Ensure your Zettle account is fully verified'
        }
      ]
    };

    return issues[provider as keyof typeof issues] || [];
  };

  return (
    <div className="mt-6 p-4 bg-yellow-50 rounded-lg">
      <h4 className="font-semibold mb-3 text-yellow-800">
        {swedishLocale ? '🔧 Felsökning' : '🔧 Troubleshooting'}
      </h4>
      
      <div className="space-y-3">
        {getCommonIssues().map((issue, index) => (
          <div key={index} className="text-sm">
            <p className="font-medium text-yellow-900">{issue.problem}</p>
            <p className="text-yellow-700 mt-1">→ {issue.solution}</p>
          </div>
        ))}
      </div>
      
      <div className="mt-4 pt-4 border-t border-yellow-200">
        <p className="text-sm text-yellow-800">
          {swedishLocale
            ? 'Om problemet kvarstår, kontakta support@feedback-platform.se'
            : 'If the problem persists, contact support@feedback-platform.com'}
        </p>
      </div>
    </div>
  );
};

// Type definitions
interface WizardProps {
  businessId: string;
  businessName: string;
  onComplete?: (result: SetupResult) => void;
  onCancel?: () => void;
  swedishLocale?: boolean;
  showRecommendations?: boolean;
}

interface WizardStep {
  id: string;
  title: string;
  component: React.ReactNode;
}

interface ConnectionStatus {
  connected: boolean;
  provider: POSProvider;
  capabilities: string[];
  locations: any[];
  error?: { message: string };
}

interface TestResult {
  testName: string;
  status: 'passed' | 'failed' | 'error' | 'skipped';
  duration: number;
}

interface ProviderRecommendation {
  provider: POSProvider;
  confidence: number;
  reasons: string[];
  recommended: boolean;
}

interface SetupResult {
  provider: POSProvider;
  credentials: any;
  connectionStatus: ConnectionStatus;
  businessId: string;
}

// Translations
const translations = {
  en: {
    welcomeTitle: 'Welcome to POS Integration Setup',
    selectProvider: 'Select Provider',
    enterCredentials: 'Enter Credentials',
    testConnection: 'Test Connection',
    mapLocations: 'Map Locations',
    setupComplete: 'Setup Complete',
    cancel: 'Cancel',
    previous: 'Previous',
    next: 'Next',
    complete: 'Complete',
    cannotProceed: 'Please complete the current step before proceeding',
    connectionFailed: 'Connection failed. Please check your credentials.',
    testingConnection: 'Testing connection...',
    welcomeMessage: 'Welcome {businessName}!',
    welcomeDescription: 'Let\'s connect your POS system to start collecting valuable customer feedback.',
    feature1Title: 'Easy Integration',
    feature1Desc: 'Connect in minutes',
    feature2Title: 'Real-time Sync',
    feature2Desc: 'Instant transaction verification',
    feature3Title: 'Secure & Compliant',
    feature3Desc: 'Bank-level security'
  },
  sv: {
    welcomeTitle: 'Välkommen till POS-integrationsinstallation',
    selectProvider: 'Välj leverantör',
    enterCredentials: 'Ange uppgifter',
    testConnection: 'Testa anslutning',
    mapLocations: 'Koppla platser',
    setupComplete: 'Installation klar',
    cancel: 'Avbryt',
    previous: 'Föregående',
    next: 'Nästa',
    complete: 'Slutför',
    cannotProceed: 'Vänligen slutför nuvarande steg innan du fortsätter',
    connectionFailed: 'Anslutning misslyckades. Kontrollera dina uppgifter.',
    testingConnection: 'Testar anslutning...',
    welcomeMessage: 'Välkommen {businessName}!',
    welcomeDescription: 'Låt oss ansluta ditt POS-system för att börja samla värdefull kundfeedback.',
    feature1Title: 'Enkel integration',
    feature1Desc: 'Anslut på minuter',
    feature2Title: 'Realtidssynk',
    feature2Desc: 'Omedelbar transaktionsverifiering',
    feature3Title: 'Säker & kompatibel',
    feature3Desc: 'Banknivå säkerhet'
  }
};

export default POSSetupWizard;