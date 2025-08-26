import React, { useState, useEffect } from 'react';
import { POSProvider } from '@ai-feedback-platform/shared-types';

interface TutorialStep {
  id: number;
  title: string;
  titleSv: string;
  description: string;
  descriptionSv: string;
  videoUrl?: string;
  imageUrl?: string;
  code?: string;
  warning?: string;
  warningSv?: string;
  tip?: string;
  tipSv?: string;
  checkpoint?: {
    text: string;
    textSv: string;
    action: () => Promise<boolean>;
  };
}

interface ProviderTutorial {
  provider: POSProvider;
  steps: TutorialStep[];
  estimatedTime: number; // in minutes
  difficulty: 'easy' | 'medium' | 'advanced';
  prerequisites: string[];
  prerequisitesSv: string[];
}

interface TutorialProps {
  provider?: POSProvider;
  language?: 'en' | 'sv';
  onComplete?: () => void;
  apiKey?: string;
  apiSecret?: string;
}

const squareTutorial: ProviderTutorial = {
  provider: 'square',
  estimatedTime: 15,
  difficulty: 'easy',
  prerequisites: [
    'Square account with Seller or Admin permissions',
    'Access to Square Developer Dashboard',
    'Business location configured in Square'
  ],
  prerequisitesSv: [
    'Square-konto med Säljare eller Admin-behörigheter',
    'Tillgång till Square Developer Dashboard',
    'Affärsplats konfigurerad i Square'
  ],
  steps: [
    {
      id: 1,
      title: 'Access Square Developer Dashboard',
      titleSv: 'Öppna Square Developer Dashboard',
      description: 'Navigate to https://developer.squareup.com and sign in with your Square account',
      descriptionSv: 'Navigera till https://developer.squareup.com och logga in med ditt Square-konto',
      imageUrl: '/images/tutorials/square-dashboard.png',
      tip: 'Use the same email and password as your Square POS account',
      tipSv: 'Använd samma e-post och lösenord som ditt Square POS-konto'
    },
    {
      id: 2,
      title: 'Create New Application',
      titleSv: 'Skapa ny applikation',
      description: 'Click "+ New Application" and name it "AI Feedback Platform"',
      descriptionSv: 'Klicka på "+ New Application" och namnge den "AI Feedback Platform"',
      imageUrl: '/images/tutorials/square-new-app.png',
      warning: 'Each Square account can have up to 10 applications',
      warningSv: 'Varje Square-konto kan ha upp till 10 applikationer'
    },
    {
      id: 3,
      title: 'Select Environment',
      titleSv: 'Välj miljö',
      description: 'Choose "Production" for live transactions or "Sandbox" for testing',
      descriptionSv: 'Välj "Production" för riktiga transaktioner eller "Sandbox" för testning',
      imageUrl: '/images/tutorials/square-environment.png',
      tip: 'Start with Sandbox to test the integration safely',
      tipSv: 'Börja med Sandbox för att testa integrationen säkert'
    },
    {
      id: 4,
      title: 'Copy Access Token',
      titleSv: 'Kopiera Access Token',
      description: 'In the Credentials section, click "Show" next to Access Token and copy it',
      descriptionSv: 'I Credentials-sektionen, klicka på "Show" bredvid Access Token och kopiera den',
      imageUrl: '/images/tutorials/square-token.png',
      warning: 'Keep this token secret! Never share it publicly',
      warningSv: 'Håll denna token hemlig! Dela aldrig den offentligt',
      code: 'EAAAAE...[your-token-here]'
    },
    {
      id: 5,
      title: 'Configure OAuth (Optional)',
      titleSv: 'Konfigurera OAuth (Valfritt)',
      description: 'For multi-location businesses, set up OAuth in the OAuth section',
      descriptionSv: 'För företag med flera platser, konfigurera OAuth i OAuth-sektionen',
      imageUrl: '/images/tutorials/square-oauth.png',
      code: `Redirect URL: https://your-domain.com/api/pos/square/callback
Scopes: MERCHANT_PROFILE_READ, PAYMENTS_READ, ITEMS_READ`
    },
    {
      id: 6,
      title: 'Set Up Webhooks',
      titleSv: 'Konfigurera Webhooks',
      description: 'Add webhook endpoint URL and select payment.created and payment.updated events',
      descriptionSv: 'Lägg till webhook endpoint URL och välj payment.created och payment.updated händelser',
      imageUrl: '/images/tutorials/square-webhooks.png',
      code: 'https://your-domain.com/api/webhooks/square',
      tip: 'Webhooks enable real-time transaction updates',
      tipSv: 'Webhooks möjliggör transaktionsuppdateringar i realtid'
    },
    {
      id: 7,
      title: 'Test Connection',
      titleSv: 'Testa anslutningen',
      description: 'Return to the setup wizard and test your connection with the copied credentials',
      descriptionSv: 'Återvänd till installationsguiden och testa din anslutning med de kopierade uppgifterna',
      checkpoint: {
        text: 'Connection test passed',
        textSv: 'Anslutningstest godkänt',
        action: async () => true // This would be replaced with actual test
      }
    }
  ]
};

const shopifyTutorial: ProviderTutorial = {
  provider: 'shopify',
  estimatedTime: 20,
  difficulty: 'medium',
  prerequisites: [
    'Shopify account with POS Pro subscription',
    'Admin or Staff account permissions',
    'Custom app development enabled'
  ],
  prerequisitesSv: [
    'Shopify-konto med POS Pro-prenumeration',
    'Admin eller Personal-kontobehörigheter',
    'Anpassad apputveckling aktiverad'
  ],
  steps: [
    {
      id: 1,
      title: 'Access Shopify Admin',
      titleSv: 'Öppna Shopify Admin',
      description: 'Go to your Shopify admin at yourstore.myshopify.com/admin',
      descriptionSv: 'Gå till din Shopify admin på dinbutik.myshopify.com/admin',
      imageUrl: '/images/tutorials/shopify-admin.png'
    },
    {
      id: 2,
      title: 'Navigate to Apps',
      titleSv: 'Navigera till Appar',
      description: 'Click on "Apps" in the left sidebar, then "App and sales channel settings"',
      descriptionSv: 'Klicka på "Appar" i vänstra sidofältet, sedan "App- och försäljningskanal-inställningar"',
      imageUrl: '/images/tutorials/shopify-apps.png'
    },
    {
      id: 3,
      title: 'Enable Custom App Development',
      titleSv: 'Aktivera anpassad apputveckling',
      description: 'Click "Develop apps" and enable custom app development if not already done',
      descriptionSv: 'Klicka på "Utveckla appar" och aktivera anpassad apputveckling om det inte redan är gjort',
      warning: 'This requires store owner permissions',
      warningSv: 'Detta kräver butiksägarbehörigheter'
    },
    {
      id: 4,
      title: 'Create Private App',
      titleSv: 'Skapa privat app',
      description: 'Click "Create an app" and name it "AI Feedback Integration"',
      descriptionSv: 'Klicka på "Skapa en app" och namnge den "AI Feedback Integration"',
      imageUrl: '/images/tutorials/shopify-create-app.png'
    },
    {
      id: 5,
      title: 'Configure API Scopes',
      titleSv: 'Konfigurera API-behörigheter',
      description: 'In Configuration > API access, select these scopes:',
      descriptionSv: 'I Konfiguration > API-åtkomst, välj dessa behörigheter:',
      code: `read_orders
read_products  
read_customers
read_locations
read_inventory`,
      warning: 'Only select the minimum required scopes for security',
      warningSv: 'Välj endast de minimum nödvändiga behörigheterna för säkerhet'
    },
    {
      id: 6,
      title: 'Install App',
      titleSv: 'Installera app',
      description: 'Click "Install app" and confirm the installation',
      descriptionSv: 'Klicka på "Installera app" och bekräfta installationen',
      imageUrl: '/images/tutorials/shopify-install.png'
    },
    {
      id: 7,
      title: 'Get Access Token',
      titleSv: 'Hämta Access Token',
      description: 'After installation, reveal and copy the Admin API access token',
      descriptionSv: 'Efter installation, visa och kopiera Admin API access token',
      warning: 'This token is shown only once! Save it securely',
      warningSv: 'Denna token visas bara en gång! Spara den säkert',
      code: 'shpat_...[your-token-here]'
    },
    {
      id: 8,
      title: 'Configure Webhook Notifications',
      titleSv: 'Konfigurera Webhook-notifieringar',
      description: 'Set up webhooks under Settings > Notifications',
      descriptionSv: 'Konfigurera webhooks under Inställningar > Notifieringar',
      code: `orders/create
orders/updated
checkouts/create`,
      tip: 'Webhooks ensure real-time sync with your POS',
      tipSv: 'Webhooks säkerställer realtidssynkronisering med din POS'
    },
    {
      id: 9,
      title: 'Test Integration',
      titleSv: 'Testa integrationen',
      description: 'Return to the wizard and verify the connection works',
      descriptionSv: 'Återvänd till guiden och verifiera att anslutningen fungerar',
      checkpoint: {
        text: 'Successfully connected to Shopify',
        textSv: 'Framgångsrikt ansluten till Shopify',
        action: async () => true
      }
    }
  ]
};

const zettleTutorial: ProviderTutorial = {
  provider: 'zettle',
  estimatedTime: 25,
  difficulty: 'advanced',
  prerequisites: [
    'Zettle merchant account',
    'Swedish organization number',
    'Access to my.zettle.com',
    'Kassaregister compliance (if applicable)'
  ],
  prerequisitesSv: [
    'Zettle handlarkonto',
    'Svenskt organisationsnummer',
    'Tillgång till my.zettle.com',
    'Kassaregisteranmälan (om tillämpligt)'
  ],
  steps: [
    {
      id: 1,
      title: 'Sign in to Zettle',
      titleSv: 'Logga in på Zettle',
      description: 'Visit my.zettle.com and sign in with your merchant credentials',
      descriptionSv: 'Besök my.zettle.com och logga in med dina handlaruppgifter',
      imageUrl: '/images/tutorials/zettle-login.png',
      tip: 'Use your email associated with the Zettle POS app',
      tipSv: 'Använd din e-post som är kopplad till Zettle POS-appen'
    },
    {
      id: 2,
      title: 'Access Developer Portal',
      titleSv: 'Öppna utvecklarportalen',
      description: 'Navigate to developer.zettle.com and click "Get Started"',
      descriptionSv: 'Navigera till developer.zettle.com och klicka på "Kom igång"',
      imageUrl: '/images/tutorials/zettle-developer.png'
    },
    {
      id: 3,
      title: 'Create OAuth Application',
      titleSv: 'Skapa OAuth-applikation',
      description: 'Click "Create new app" and fill in the application details',
      descriptionSv: 'Klicka på "Skapa ny app" och fyll i applikationsuppgifterna',
      code: `App name: AI Feedback Platform
Redirect URI: https://your-domain.com/api/pos/zettle/callback
Scopes: READ:PURCHASE, READ:PRODUCT, READ:FINANCE`,
      warning: 'Redirect URI must match exactly in production',
      warningSv: 'Redirect URI måste matcha exakt i produktion'
    },
    {
      id: 4,
      title: 'Save Client Credentials',
      titleSv: 'Spara klientuppgifter',
      description: 'Copy and securely save your Client ID and Client Secret',
      descriptionSv: 'Kopiera och spara säkert ditt Client ID och Client Secret',
      warning: 'Client Secret is shown only once!',
      warningSv: 'Client Secret visas bara en gång!',
      code: `Client ID: abc123...
Client Secret: xyz789...`
    },
    {
      id: 5,
      title: 'Verify Swedish Business Details',
      titleSv: 'Verifiera svenska företagsuppgifter',
      description: 'Ensure your organization number and VAT details are correct',
      descriptionSv: 'Säkerställ att ditt organisationsnummer och momsuppgifter är korrekta',
      imageUrl: '/images/tutorials/zettle-business.png',
      tip: 'This is required for Kassaregister compliance',
      tipSv: 'Detta krävs för Kassaregister-efterlevnad'
    },
    {
      id: 6,
      title: 'Configure Swish Integration',
      titleSv: 'Konfigurera Swish-integration',
      description: 'Enable Swish payments in your Zettle account settings',
      descriptionSv: 'Aktivera Swish-betalningar i dina Zettle-kontoinställningar',
      imageUrl: '/images/tutorials/zettle-swish.png',
      tip: 'Swish is the most popular payment method in Sweden',
      tipSv: 'Swish är den mest populära betalningsmetoden i Sverige'
    },
    {
      id: 7,
      title: 'Set Up Kassaregister',
      titleSv: 'Konfigurera Kassaregister',
      description: 'If required, complete Kassaregister registration with Skatteverket',
      descriptionSv: 'Om det krävs, slutför Kassaregister-registrering hos Skatteverket',
      warning: 'Required for businesses handling cash in Sweden',
      warningSv: 'Krävs för företag som hanterar kontanter i Sverige',
      code: 'Kassaregister ID: KR-XXXX-XXXX'
    },
    {
      id: 8,
      title: 'Configure Webhooks',
      titleSv: 'Konfigurera Webhooks',
      description: 'Set up webhook endpoints for real-time updates',
      descriptionSv: 'Konfigurera webhook-endpoints för realtidsuppdateringar',
      code: `Endpoint: https://your-domain.com/api/webhooks/zettle
Events: purchase.created, inventory.updated`,
      tip: 'Use webhook signing secrets for security',
      tipSv: 'Använd webhook-signeringshemligheter för säkerhet'
    },
    {
      id: 9,
      title: 'Map Locations and Devices',
      titleSv: 'Mappa platser och enheter',
      description: 'Configure your store locations and POS devices',
      descriptionSv: 'Konfigurera dina butiksplatser och POS-enheter',
      imageUrl: '/images/tutorials/zettle-locations.png'
    },
    {
      id: 10,
      title: 'Test Swedish Features',
      titleSv: 'Testa svenska funktioner',
      description: 'Verify Swish, Kassaregister, and VAT reporting work correctly',
      descriptionSv: 'Verifiera att Swish, Kassaregister och momsrapportering fungerar korrekt',
      checkpoint: {
        text: 'All Swedish features verified',
        textSv: 'Alla svenska funktioner verifierade',
        action: async () => true
      }
    },
    {
      id: 11,
      title: 'Complete Integration',
      titleSv: 'Slutför integrationen',
      description: 'Finalize the connection in the setup wizard',
      descriptionSv: 'Slutför anslutningen i installationsguiden',
      checkpoint: {
        text: 'Zettle integration complete',
        textSv: 'Zettle-integration slutförd',
        action: async () => true
      }
    }
  ]
};

export const POSIntegrationTutorials: React.FC<TutorialProps> = ({
  provider,
  language = 'en',
  onComplete,
  apiKey,
  apiSecret
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [selectedProvider, setSelectedProvider] = useState<POSProvider | null>(provider || null);
  const [checkpointStatus, setCheckpointStatus] = useState<'idle' | 'checking' | 'passed' | 'failed'>('idle');

  const tutorials: Record<POSProvider, ProviderTutorial> = {
    square: squareTutorial,
    shopify: shopifyTutorial,
    zettle: zettleTutorial,
    clover: squareTutorial, // Placeholder
    toast: squareTutorial,  // Placeholder
    lightspeed: squareTutorial // Placeholder
  };

  const currentTutorial = selectedProvider ? tutorials[selectedProvider] : null;
  const currentStepData = currentTutorial?.steps[currentStep];
  const isSwedish = language === 'sv';

  const handleNextStep = async () => {
    if (!currentStepData || !currentTutorial) return;

    // If there's a checkpoint, run it
    if (currentStepData.checkpoint) {
      setCheckpointStatus('checking');
      try {
        const result = await currentStepData.checkpoint.action();
        if (result) {
          setCheckpointStatus('passed');
          setCompletedSteps(prev => new Set([...prev, currentStep]));
          
          if (currentStep < currentTutorial.steps.length - 1) {
            setTimeout(() => {
              setCurrentStep(currentStep + 1);
              setCheckpointStatus('idle');
            }, 1500);
          } else if (onComplete) {
            onComplete();
          }
        } else {
          setCheckpointStatus('failed');
        }
      } catch (error) {
        setCheckpointStatus('failed');
      }
    } else {
      setCompletedSteps(prev => new Set([...prev, currentStep]));
      if (currentStep < currentTutorial.steps.length - 1) {
        setCurrentStep(currentStep + 1);
      } else if (onComplete) {
        onComplete();
      }
    }
  };

  const handlePreviousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      setCheckpointStatus('idle');
    }
  };

  const getProgressPercentage = () => {
    if (!currentTutorial) return 0;
    return Math.round((completedSteps.size / currentTutorial.steps.length) * 100);
  };

  if (!selectedProvider) {
    return (
      <div className="tutorial-provider-selection">
        <h2>{isSwedish ? 'Välj din POS-leverantör' : 'Select Your POS Provider'}</h2>
        <div className="provider-grid">
          {Object.entries(tutorials).map(([key, tutorial]) => (
            <button
              key={key}
              onClick={() => setSelectedProvider(key as POSProvider)}
              className="provider-card"
            >
              <h3>{key.toUpperCase()}</h3>
              <p className="time-estimate">
                ⏱️ {tutorial.estimatedTime} {isSwedish ? 'minuter' : 'minutes'}
              </p>
              <p className="difficulty">
                {isSwedish ? 'Svårighetsgrad: ' : 'Difficulty: '}
                <span className={`difficulty-${tutorial.difficulty}`}>
                  {isSwedish ? 
                    (tutorial.difficulty === 'easy' ? 'Lätt' : 
                     tutorial.difficulty === 'medium' ? 'Medel' : 'Avancerad') :
                    tutorial.difficulty}
                </span>
              </p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (!currentTutorial || !currentStepData) {
    return <div>Loading tutorial...</div>;
  }

  return (
    <div className="pos-integration-tutorial">
      <div className="tutorial-header">
        <button 
          onClick={() => setSelectedProvider(null)} 
          className="back-to-selection"
        >
          ← {isSwedish ? 'Tillbaka till val' : 'Back to selection'}
        </button>
        <h2>{selectedProvider.toUpperCase()} {isSwedish ? 'Integrationsguide' : 'Integration Guide'}</h2>
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ width: `${getProgressPercentage()}%` }}
          />
          <span className="progress-text">
            {completedSteps.size}/{currentTutorial.steps.length} {isSwedish ? 'steg slutförda' : 'steps completed'}
          </span>
        </div>
      </div>

      <div className="tutorial-prerequisites">
        <h3>{isSwedish ? 'Förutsättningar' : 'Prerequisites'}</h3>
        <ul>
          {(isSwedish ? currentTutorial.prerequisitesSv : currentTutorial.prerequisites).map((prereq, idx) => (
            <li key={idx}>{prereq}</li>
          ))}
        </ul>
      </div>

      <div className="tutorial-content">
        <div className="step-indicator">
          {isSwedish ? 'Steg' : 'Step'} {currentStep + 1} {isSwedish ? 'av' : 'of'} {currentTutorial.steps.length}
        </div>

        <h3 className="step-title">
          {isSwedish ? currentStepData.titleSv : currentStepData.title}
        </h3>

        <p className="step-description">
          {isSwedish ? currentStepData.descriptionSv : currentStepData.description}
        </p>

        {currentStepData.imageUrl && (
          <div className="step-image">
            <img src={currentStepData.imageUrl} alt="Tutorial step" />
          </div>
        )}

        {currentStepData.videoUrl && (
          <div className="step-video">
            <video controls src={currentStepData.videoUrl} />
          </div>
        )}

        {currentStepData.code && (
          <div className="step-code">
            <pre><code>{currentStepData.code}</code></pre>
            <button 
              onClick={() => navigator.clipboard.writeText(currentStepData.code!)}
              className="copy-button"
            >
              {isSwedish ? 'Kopiera' : 'Copy'}
            </button>
          </div>
        )}

        {currentStepData.warning && (
          <div className="step-warning">
            ⚠️ {isSwedish ? currentStepData.warningSv : currentStepData.warning}
          </div>
        )}

        {currentStepData.tip && (
          <div className="step-tip">
            💡 {isSwedish ? currentStepData.tipSv : currentStepData.tip}
          </div>
        )}

        {currentStepData.checkpoint && (
          <div className={`checkpoint checkpoint-${checkpointStatus}`}>
            {checkpointStatus === 'idle' && (
              <p>{isSwedish ? currentStepData.checkpoint.textSv : currentStepData.checkpoint.text}</p>
            )}
            {checkpointStatus === 'checking' && (
              <p>{isSwedish ? 'Kontrollerar...' : 'Checking...'}</p>
            )}
            {checkpointStatus === 'passed' && (
              <p>✅ {isSwedish ? 'Godkänd!' : 'Passed!'}</p>
            )}
            {checkpointStatus === 'failed' && (
              <p>❌ {isSwedish ? 'Misslyckades. Försök igen.' : 'Failed. Please try again.'}</p>
            )}
          </div>
        )}
      </div>

      <div className="tutorial-navigation">
        <button 
          onClick={handlePreviousStep}
          disabled={currentStep === 0}
          className="nav-button prev"
        >
          {isSwedish ? '← Föregående' : '← Previous'}
        </button>

        <div className="step-dots">
          {currentTutorial.steps.map((_, idx) => (
            <span 
              key={idx}
              className={`dot ${idx === currentStep ? 'active' : ''} ${completedSteps.has(idx) ? 'completed' : ''}`}
              onClick={() => setCurrentStep(idx)}
            />
          ))}
        </div>

        <button 
          onClick={handleNextStep}
          className="nav-button next"
          disabled={checkpointStatus === 'checking'}
        >
          {currentStep === currentTutorial.steps.length - 1 ? 
            (isSwedish ? 'Slutför ✓' : 'Complete ✓') : 
            (isSwedish ? 'Nästa →' : 'Next →')}
        </button>
      </div>

      <style jsx>{`
        .pos-integration-tutorial {
          max-width: 900px;
          margin: 0 auto;
          padding: 2rem;
        }

        .tutorial-header {
          margin-bottom: 2rem;
        }

        .back-to-selection {
          background: none;
          border: none;
          color: #3b82f6;
          cursor: pointer;
          margin-bottom: 1rem;
          font-size: 0.9rem;
        }

        .progress-bar {
          height: 8px;
          background: #e5e7eb;
          border-radius: 4px;
          position: relative;
          margin-top: 1rem;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #3b82f6 0%, #2563eb 100%);
          border-radius: 4px;
          transition: width 0.3s ease;
        }

        .progress-text {
          position: absolute;
          right: 0;
          top: -1.5rem;
          font-size: 0.875rem;
          color: #6b7280;
        }

        .tutorial-prerequisites {
          background: #f9fafb;
          padding: 1.5rem;
          border-radius: 8px;
          margin-bottom: 2rem;
        }

        .tutorial-prerequisites h3 {
          margin-top: 0;
          color: #1f2937;
        }

        .tutorial-prerequisites ul {
          margin: 0.5rem 0 0 1.5rem;
          padding: 0;
        }

        .tutorial-content {
          background: white;
          padding: 2rem;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .step-indicator {
          font-size: 0.875rem;
          color: #6b7280;
          margin-bottom: 1rem;
        }

        .step-title {
          font-size: 1.5rem;
          margin: 0 0 1rem;
          color: #1f2937;
        }

        .step-description {
          color: #4b5563;
          line-height: 1.6;
          margin-bottom: 1.5rem;
        }

        .step-image {
          margin: 1.5rem 0;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          overflow: hidden;
        }

        .step-image img {
          width: 100%;
          height: auto;
          display: block;
        }

        .step-video {
          margin: 1.5rem 0;
        }

        .step-video video {
          width: 100%;
          border-radius: 8px;
        }

        .step-code {
          position: relative;
          margin: 1.5rem 0;
        }

        .step-code pre {
          background: #1f2937;
          color: #e5e7eb;
          padding: 1rem;
          border-radius: 8px;
          overflow-x: auto;
        }

        .copy-button {
          position: absolute;
          top: 0.5rem;
          right: 0.5rem;
          background: #3b82f6;
          color: white;
          border: none;
          padding: 0.25rem 0.75rem;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.875rem;
        }

        .step-warning {
          background: #fef3c7;
          border-left: 4px solid #f59e0b;
          padding: 1rem;
          margin: 1.5rem 0;
          border-radius: 4px;
          color: #92400e;
        }

        .step-tip {
          background: #dbeafe;
          border-left: 4px solid #3b82f6;
          padding: 1rem;
          margin: 1.5rem 0;
          border-radius: 4px;
          color: #1e40af;
        }

        .checkpoint {
          background: #f3f4f6;
          padding: 1.5rem;
          border-radius: 8px;
          margin: 1.5rem 0;
          text-align: center;
        }

        .checkpoint-checking {
          background: #fef3c7;
        }

        .checkpoint-passed {
          background: #d1fae5;
          color: #065f46;
        }

        .checkpoint-failed {
          background: #fee2e2;
          color: #991b1b;
        }

        .tutorial-navigation {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 2rem;
        }

        .nav-button {
          background: #3b82f6;
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 6px;
          cursor: pointer;
          font-size: 1rem;
          transition: background-color 0.2s;
        }

        .nav-button:hover:not(:disabled) {
          background: #2563eb;
        }

        .nav-button:disabled {
          background: #e5e7eb;
          color: #9ca3af;
          cursor: not-allowed;
        }

        .step-dots {
          display: flex;
          gap: 0.5rem;
        }

        .dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #e5e7eb;
          cursor: pointer;
          transition: all 0.2s;
        }

        .dot.active {
          background: #3b82f6;
          transform: scale(1.2);
        }

        .dot.completed {
          background: #10b981;
        }

        .provider-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          margin-top: 2rem;
        }

        .provider-card {
          background: white;
          border: 2px solid #e5e7eb;
          border-radius: 8px;
          padding: 1.5rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .provider-card:hover {
          border-color: #3b82f6;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        .time-estimate {
          color: #6b7280;
          margin: 0.5rem 0;
        }

        .difficulty {
          font-size: 0.875rem;
        }

        .difficulty-easy {
          color: #10b981;
        }

        .difficulty-medium {
          color: #f59e0b;
        }

        .difficulty-advanced {
          color: #ef4444;
        }
      `}</style>
    </div>
  );
};

export default POSIntegrationTutorials;