import React, { useState, useCallback } from 'react';
import { POSProvider } from '@ai-feedback-platform/shared-types';

interface TroubleshootingIssue {
  id: string;
  title: string;
  titleSv: string;
  description: string;
  descriptionSv: string;
  symptoms: string[];
  symptomsSv: string[];
  causes: Array<{
    cause: string;
    causeSv: string;
    probability: 'high' | 'medium' | 'low';
  }>;
  solutions: Array<{
    solution: string;
    solutionSv: string;
    steps: string[];
    stepsSv: string[];
    difficulty: 'easy' | 'medium' | 'hard';
  }>;
  preventionTips?: string[];
  preventionTipsSv?: string[];
  relatedIssues?: string[];
  providers?: POSProvider[];
}

interface GuideProps {
  provider?: POSProvider;
  language?: 'en' | 'sv';
  issueId?: string;
  onIssueResolved?: (issueId: string) => void;
}

const troubleshootingDatabase: TroubleshootingIssue[] = [
  {
    id: 'auth-failed',
    title: 'Authentication Failed',
    titleSv: 'Autentisering misslyckades',
    description: 'Unable to authenticate with the POS API',
    descriptionSv: 'Kan inte autentisera med POS API',
    symptoms: [
      '401 Unauthorized error',
      'Invalid API key message',
      'Token expired error',
      'Access denied response'
    ],
    symptomsSv: [
      '401 Obehörig fel',
      'Ogiltigt API-nyckelmeddelande',
      'Token utgången fel',
      'Åtkomst nekad svar'
    ],
    causes: [
      {
        cause: 'Incorrect API credentials',
        causeSv: 'Felaktiga API-uppgifter',
        probability: 'high'
      },
      {
        cause: 'Expired access token',
        causeSv: 'Utgången åtkomsttoken',
        probability: 'high'
      },
      {
        cause: 'Wrong environment (sandbox vs production)',
        causeSv: 'Fel miljö (sandbox vs produktion)',
        probability: 'medium'
      },
      {
        cause: 'Insufficient permissions',
        causeSv: 'Otillräckliga behörigheter',
        probability: 'medium'
      }
    ],
    solutions: [
      {
        solution: 'Verify and update API credentials',
        solutionSv: 'Verifiera och uppdatera API-uppgifter',
        steps: [
          'Log in to your POS provider dashboard',
          'Navigate to API or Developer settings',
          'Generate new API keys if needed',
          'Copy the complete key without extra spaces',
          'Update the credentials in the integration settings'
        ],
        stepsSv: [
          'Logga in på din POS-leverantörs instrumentpanel',
          'Navigera till API eller Utvecklarinställningar',
          'Generera nya API-nycklar om det behövs',
          'Kopiera hela nyckeln utan extra mellanslag',
          'Uppdatera uppgifterna i integrationsinställningarna'
        ],
        difficulty: 'easy'
      },
      {
        solution: 'Refresh OAuth token',
        solutionSv: 'Uppdatera OAuth-token',
        steps: [
          'Check token expiration time',
          'Use refresh token to get new access token',
          'If refresh token is expired, re-authenticate',
          'Update stored tokens'
        ],
        stepsSv: [
          'Kontrollera tokens utgångstid',
          'Använd uppdateringstoken för att få ny åtkomsttoken',
          'Om uppdateringstoken har utgått, autentisera igen',
          'Uppdatera lagrade tokens'
        ],
        difficulty: 'medium'
      }
    ],
    preventionTips: [
      'Store credentials securely in environment variables',
      'Implement automatic token refresh',
      'Monitor token expiration proactively',
      'Use webhook for credential updates'
    ],
    preventionTipsSv: [
      'Lagra uppgifter säkert i miljövariabler',
      'Implementera automatisk tokenuppdatering',
      'Övervaka tokenutgång proaktivt',
      'Använd webhook för uppgiftsuppdateringar'
    ],
    relatedIssues: ['rate-limit', 'connection-timeout']
  },
  {
    id: 'rate-limit',
    title: 'Rate Limit Exceeded',
    titleSv: 'Hastighetsgräns överskriden',
    description: 'Too many API requests in a short period',
    descriptionSv: 'För många API-förfrågningar på kort tid',
    symptoms: [
      '429 Too Many Requests error',
      'Rate limit exceeded message',
      'Throttling warnings',
      'Slow API responses'
    ],
    symptomsSv: [
      '429 För många förfrågningar fel',
      'Hastighetsgräns överskriden meddelande',
      'Strypningsvarningar',
      'Långsamma API-svar'
    ],
    causes: [
      {
        cause: 'Excessive API calls',
        causeSv: 'Överdrivna API-anrop',
        probability: 'high'
      },
      {
        cause: 'Inefficient polling',
        causeSv: 'Ineffektiv polling',
        probability: 'medium'
      },
      {
        cause: 'Multiple parallel requests',
        causeSv: 'Flera parallella förfrågningar',
        probability: 'medium'
      }
    ],
    solutions: [
      {
        solution: 'Implement request throttling',
        solutionSv: 'Implementera förfrågningsstrypning',
        steps: [
          'Add delay between requests',
          'Implement exponential backoff',
          'Cache frequently accessed data',
          'Batch multiple operations'
        ],
        stepsSv: [
          'Lägg till fördröjning mellan förfrågningar',
          'Implementera exponentiell backoff',
          'Cacha ofta åtkomst data',
          'Batch flera operationer'
        ],
        difficulty: 'medium'
      },
      {
        solution: 'Wait for rate limit reset',
        solutionSv: 'Vänta på hastighetsgräns återställning',
        steps: [
          'Check rate limit headers for reset time',
          'Pause requests until reset',
          'Resume with reduced frequency'
        ],
        stepsSv: [
          'Kontrollera hastighetsgränshuvuden för återställningstid',
          'Pausa förfrågningar tills återställning',
          'Återuppta med minskad frekvens'
        ],
        difficulty: 'easy'
      }
    ],
    preventionTips: [
      'Use webhooks instead of polling',
      'Implement request queuing',
      'Monitor API usage metrics',
      'Cache responses when possible'
    ],
    preventionTipsSv: [
      'Använd webhooks istället för polling',
      'Implementera förfrågningsköning',
      'Övervaka API-användningsmetrik',
      'Cacha svar när det är möjligt'
    ]
  },
  {
    id: 'connection-timeout',
    title: 'Connection Timeout',
    titleSv: 'Anslutningstimeout',
    description: 'API requests are timing out',
    descriptionSv: 'API-förfrågningar timeout',
    symptoms: [
      'Request timeout errors',
      'No response from API',
      'Connection reset errors',
      'Slow loading indicators'
    ],
    symptomsSv: [
      'Förfrågningstimeout-fel',
      'Inget svar från API',
      'Anslutning återställd fel',
      'Långsamma laddningsindikatorer'
    ],
    causes: [
      {
        cause: 'Network connectivity issues',
        causeSv: 'Nätverksanslutningsproblem',
        probability: 'high'
      },
      {
        cause: 'API server overload',
        causeSv: 'API-server överbelastning',
        probability: 'medium'
      },
      {
        cause: 'Firewall blocking requests',
        causeSv: 'Brandvägg blockerar förfrågningar',
        probability: 'low'
      }
    ],
    solutions: [
      {
        solution: 'Check network connectivity',
        solutionSv: 'Kontrollera nätverksanslutning',
        steps: [
          'Test internet connection',
          'Ping API endpoint',
          'Check DNS resolution',
          'Verify firewall settings'
        ],
        stepsSv: [
          'Testa internetanslutning',
          'Pinga API-endpoint',
          'Kontrollera DNS-upplösning',
          'Verifiera brandväggsinställningar'
        ],
        difficulty: 'easy'
      },
      {
        solution: 'Increase timeout settings',
        solutionSv: 'Öka timeout-inställningar',
        steps: [
          'Locate timeout configuration',
          'Increase timeout to 30-60 seconds',
          'Test with longer timeout',
          'Adjust based on results'
        ],
        stepsSv: [
          'Hitta timeout-konfiguration',
          'Öka timeout till 30-60 sekunder',
          'Testa med längre timeout',
          'Justera baserat på resultat'
        ],
        difficulty: 'easy'
      }
    ]
  },
  {
    id: 'missing-locations',
    title: 'No Locations Found',
    titleSv: 'Inga platser hittades',
    description: 'Unable to retrieve business locations from POS',
    descriptionSv: 'Kan inte hämta affärsplatser från POS',
    symptoms: [
      'Empty location list',
      'Location not found errors',
      'Cannot select store location'
    ],
    symptomsSv: [
      'Tom platslista',
      'Plats hittades inte fel',
      'Kan inte välja butiksplats'
    ],
    causes: [
      {
        cause: 'No locations configured in POS',
        causeSv: 'Inga platser konfigurerade i POS',
        probability: 'high'
      },
      {
        cause: 'Insufficient permissions to read locations',
        causeSv: 'Otillräckliga behörigheter för att läsa platser',
        probability: 'medium'
      },
      {
        cause: 'Location API endpoint changed',
        causeSv: 'Plats API-endpoint ändrad',
        probability: 'low'
      }
    ],
    solutions: [
      {
        solution: 'Configure locations in POS system',
        solutionSv: 'Konfigurera platser i POS-system',
        steps: [
          'Log in to POS admin dashboard',
          'Navigate to Locations or Stores section',
          'Add at least one location',
          'Set location as active',
          'Save and sync changes'
        ],
        stepsSv: [
          'Logga in på POS admin-instrumentpanel',
          'Navigera till Platser eller Butiker sektion',
          'Lägg till minst en plats',
          'Ställ in plats som aktiv',
          'Spara och synka ändringar'
        ],
        difficulty: 'easy'
      },
      {
        solution: 'Check API permissions',
        solutionSv: 'Kontrollera API-behörigheter',
        steps: [
          'Review API scope settings',
          'Ensure location read permission is granted',
          'Regenerate API keys if needed',
          'Test with updated permissions'
        ],
        stepsSv: [
          'Granska API-omfattningsinställningar',
          'Säkerställ att platsläsbehörighet är beviljad',
          'Regenerera API-nycklar om det behövs',
          'Testa med uppdaterade behörigheter'
        ],
        difficulty: 'medium'
      }
    ],
    providers: ['square', 'shopify', 'zettle']
  },
  {
    id: 'webhook-not-working',
    title: 'Webhooks Not Receiving Events',
    titleSv: 'Webhooks tar inte emot händelser',
    description: 'Webhook endpoints not receiving POS events',
    descriptionSv: 'Webhook-endpoints tar inte emot POS-händelser',
    symptoms: [
      'No webhook events received',
      'Missing transaction updates',
      'Webhook validation failures',
      'Event delivery errors'
    ],
    symptomsSv: [
      'Inga webhook-händelser mottagna',
      'Saknade transaktionsuppdateringar',
      'Webhook-valideringsfel',
      'Händelseleveransfel'
    ],
    causes: [
      {
        cause: 'Incorrect webhook URL',
        causeSv: 'Felaktig webhook-URL',
        probability: 'high'
      },
      {
        cause: 'Webhook signature validation failing',
        causeSv: 'Webhook-signaturvalidering misslyckas',
        probability: 'medium'
      },
      {
        cause: 'Events not subscribed',
        causeSv: 'Händelser inte prenumererade',
        probability: 'medium'
      },
      {
        cause: 'Firewall blocking webhook requests',
        causeSv: 'Brandvägg blockerar webhook-förfrågningar',
        probability: 'low'
      }
    ],
    solutions: [
      {
        solution: 'Verify webhook configuration',
        solutionSv: 'Verifiera webhook-konfiguration',
        steps: [
          'Check webhook URL is publicly accessible',
          'Ensure HTTPS is used',
          'Verify URL matches exactly in POS settings',
          'Test webhook with manual trigger'
        ],
        stepsSv: [
          'Kontrollera att webhook-URL är offentligt tillgänglig',
          'Säkerställ att HTTPS används',
          'Verifiera att URL matchar exakt i POS-inställningar',
          'Testa webhook med manuell trigger'
        ],
        difficulty: 'easy'
      },
      {
        solution: 'Fix webhook signature validation',
        solutionSv: 'Fixa webhook-signaturvalidering',
        steps: [
          'Get webhook signing secret from POS',
          'Update secret in application config',
          'Verify signature calculation method',
          'Test with sample webhook payload'
        ],
        stepsSv: [
          'Hämta webhook-signeringshemlighet från POS',
          'Uppdatera hemlighet i applikationskonfiguration',
          'Verifiera signaturberäkningsmetod',
          'Testa med exempel webhook-payload'
        ],
        difficulty: 'medium'
      }
    ],
    preventionTips: [
      'Use webhook testing tools',
      'Log all webhook attempts',
      'Monitor webhook delivery metrics',
      'Implement webhook retry logic'
    ],
    preventionTipsSv: [
      'Använd webhook-testverktyg',
      'Logga alla webhook-försök',
      'Övervaka webhook-leveransmetrik',
      'Implementera webhook-återförsökslogik'
    ]
  },
  {
    id: 'zettle-swedish-features',
    title: 'Zettle Swedish Features Not Working',
    titleSv: 'Zettle svenska funktioner fungerar inte',
    description: 'Issues with Swish, Kassaregister, or Swedish VAT',
    descriptionSv: 'Problem med Swish, Kassaregister eller svensk moms',
    symptoms: [
      'Swish payments not available',
      'Kassaregister errors',
      'VAT reporting issues',
      'Swedish business validation failures'
    ],
    symptomsSv: [
      'Swish-betalningar inte tillgängliga',
      'Kassaregisterfel',
      'Momsrapporteringsproblem',
      'Svenska företagsvalideringsfel'
    ],
    causes: [
      {
        cause: 'Swedish business not verified',
        causeSv: 'Svenskt företag inte verifierat',
        probability: 'high'
      },
      {
        cause: 'Swish not activated',
        causeSv: 'Swish inte aktiverat',
        probability: 'medium'
      },
      {
        cause: 'Kassaregister not registered',
        causeSv: 'Kassaregister inte registrerat',
        probability: 'medium'
      }
    ],
    solutions: [
      {
        solution: 'Verify Swedish business details',
        solutionSv: 'Verifiera svenska företagsuppgifter',
        steps: [
          'Check organization number format (XXXXXX-XXXX)',
          'Verify VAT number if applicable',
          'Update business address to Sweden',
          'Contact Zettle support for verification'
        ],
        stepsSv: [
          'Kontrollera organisationsnummerformat (XXXXXX-XXXX)',
          'Verifiera momsnummer om tillämpligt',
          'Uppdatera företagsadress till Sverige',
          'Kontakta Zettle-support för verifiering'
        ],
        difficulty: 'medium'
      },
      {
        solution: 'Activate Swish payments',
        solutionSv: 'Aktivera Swish-betalningar',
        steps: [
          'Log in to Zettle dashboard',
          'Go to Payment Methods',
          'Enable Swish',
          'Complete Swish merchant agreement',
          'Test Swish transaction'
        ],
        stepsSv: [
          'Logga in på Zettle-instrumentpanel',
          'Gå till Betalningsmetoder',
          'Aktivera Swish',
          'Slutför Swish handlaravtal',
          'Testa Swish-transaktion'
        ],
        difficulty: 'easy'
      },
      {
        solution: 'Register Kassaregister',
        solutionSv: 'Registrera Kassaregister',
        steps: [
          'Visit Skatteverket website',
          'Complete Kassaregister application',
          'Get registration certificate',
          'Update Zettle with registration ID',
          'Enable Kassaregister in settings'
        ],
        stepsSv: [
          'Besök Skatteverkets webbplats',
          'Slutför Kassaregisteransökan',
          'Få registreringsbevis',
          'Uppdatera Zettle med registrerings-ID',
          'Aktivera Kassaregister i inställningar'
        ],
        difficulty: 'hard'
      }
    ],
    providers: ['zettle']
  },
  {
    id: 'data-sync-delays',
    title: 'Data Synchronization Delays',
    titleSv: 'Datasynkroniseringsfördröjningar',
    description: 'Transactions or inventory not syncing in real-time',
    descriptionSv: 'Transaktioner eller lager synkroniseras inte i realtid',
    symptoms: [
      'Delayed transaction updates',
      'Inventory counts incorrect',
      'Missing recent transactions',
      'Stale data in reports'
    ],
    symptomsSv: [
      'Försenade transaktionsuppdateringar',
      'Lagerantal felaktiga',
      'Saknade senaste transaktioner',
      'Gammal data i rapporter'
    ],
    causes: [
      {
        cause: 'API polling interval too long',
        causeSv: 'API-pollingintervall för långt',
        probability: 'high'
      },
      {
        cause: 'Webhook delays from provider',
        causeSv: 'Webhook-förseningar från leverantör',
        probability: 'medium'
      },
      {
        cause: 'Cache not invalidating properly',
        causeSv: 'Cache ogiltigförklaras inte korrekt',
        probability: 'medium'
      }
    ],
    solutions: [
      {
        solution: 'Reduce polling interval',
        solutionSv: 'Minska pollingintervall',
        steps: [
          'Check current polling frequency',
          'Reduce interval to 1-5 minutes',
          'Monitor rate limits',
          'Adjust based on provider limits'
        ],
        stepsSv: [
          'Kontrollera aktuell pollingfrekvens',
          'Minska intervall till 1-5 minuter',
          'Övervaka hastighetsgränser',
          'Justera baserat på leverantörsgränser'
        ],
        difficulty: 'easy'
      },
      {
        solution: 'Implement manual sync',
        solutionSv: 'Implementera manuell synk',
        steps: [
          'Add manual sync button',
          'Force refresh data from API',
          'Clear local cache',
          'Update UI with fresh data'
        ],
        stepsSv: [
          'Lägg till manuell synk-knapp',
          'Tvinga uppdatera data från API',
          'Rensa lokal cache',
          'Uppdatera UI med färsk data'
        ],
        difficulty: 'medium'
      }
    ]
  }
];

export const TroubleshootingGuide: React.FC<GuideProps> = ({
  provider,
  language = 'en',
  issueId,
  onIssueResolved
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIssue, setSelectedIssue] = useState<TroubleshootingIssue | null>(null);
  const [expandedSolutions, setExpandedSolutions] = useState<Set<number>>(new Set());
  const [resolvedIssues, setResolvedIssues] = useState<Set<string>>(new Set());
  
  const isSwedish = language === 'sv';

  // Filter issues based on provider and search term
  const filteredIssues = troubleshootingDatabase.filter(issue => {
    const providerMatch = !provider || !issue.providers || issue.providers.includes(provider);
    const searchMatch = !searchTerm || 
      issue.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      issue.titleSv.toLowerCase().includes(searchTerm.toLowerCase()) ||
      issue.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      issue.symptoms.some(s => s.toLowerCase().includes(searchTerm.toLowerCase()));
    
    return providerMatch && searchMatch;
  });

  // Auto-select issue if issueId is provided
  React.useEffect(() => {
    if (issueId) {
      const issue = troubleshootingDatabase.find(i => i.id === issueId);
      if (issue) {
        setSelectedIssue(issue);
      }
    }
  }, [issueId]);

  const handleIssueSelect = (issue: TroubleshootingIssue) => {
    setSelectedIssue(issue);
    setExpandedSolutions(new Set());
  };

  const toggleSolution = (index: number) => {
    setExpandedSolutions(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const markAsResolved = (issue: TroubleshootingIssue) => {
    setResolvedIssues(prev => new Set([...prev, issue.id]));
    if (onIssueResolved) {
      onIssueResolved(issue.id);
    }
    setSelectedIssue(null);
  };

  const getProbabilityColor = (probability: string) => {
    switch (probability) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#10b981';
      default: return '#6b7280';
    }
  };

  const getDifficultyBadge = (difficulty: string) => {
    const colors = {
      easy: { bg: '#d1fae5', text: '#065f46', label: isSwedish ? 'Lätt' : 'Easy' },
      medium: { bg: '#fed7aa', text: '#9a3412', label: isSwedish ? 'Medel' : 'Medium' },
      hard: { bg: '#fecaca', text: '#991b1b', label: isSwedish ? 'Svår' : 'Hard' }
    };
    const style = colors[difficulty as keyof typeof colors] || colors.easy;
    
    return (
      <span style={{
        background: style.bg,
        color: style.text,
        padding: '2px 8px',
        borderRadius: '4px',
        fontSize: '0.875rem',
        fontWeight: '500'
      }}>
        {style.label}
      </span>
    );
  };

  if (selectedIssue) {
    return (
      <div className="troubleshooting-detail">
        <button 
          onClick={() => setSelectedIssue(null)}
          className="back-button"
        >
          ← {isSwedish ? 'Tillbaka till lista' : 'Back to list'}
        </button>

        <h2>{isSwedish ? selectedIssue.titleSv : selectedIssue.title}</h2>
        <p className="description">
          {isSwedish ? selectedIssue.descriptionSv : selectedIssue.description}
        </p>

        <div className="symptoms-section">
          <h3>{isSwedish ? 'Symtom' : 'Symptoms'}</h3>
          <ul>
            {(isSwedish ? selectedIssue.symptomsSv : selectedIssue.symptoms).map((symptom, idx) => (
              <li key={idx}>• {symptom}</li>
            ))}
          </ul>
        </div>

        <div className="causes-section">
          <h3>{isSwedish ? 'Möjliga orsaker' : 'Possible Causes'}</h3>
          <div className="causes-list">
            {selectedIssue.causes.map((cause, idx) => (
              <div key={idx} className="cause-item">
                <span className="cause-probability" style={{
                  color: getProbabilityColor(cause.probability),
                  fontWeight: '600'
                }}>
                  {cause.probability.toUpperCase()}
                </span>
                <span className="cause-text">
                  {isSwedish ? cause.causeSv : cause.cause}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="solutions-section">
          <h3>{isSwedish ? 'Lösningar' : 'Solutions'}</h3>
          {selectedIssue.solutions.map((solution, idx) => (
            <div key={idx} className="solution-card">
              <div 
                className="solution-header"
                onClick={() => toggleSolution(idx)}
                style={{ cursor: 'pointer' }}
              >
                <h4>
                  {expandedSolutions.has(idx) ? '▼' : '▶'} 
                  {' '}{isSwedish ? solution.solutionSv : solution.solution}
                </h4>
                {getDifficultyBadge(solution.difficulty)}
              </div>
              
              {expandedSolutions.has(idx) && (
                <div className="solution-steps">
                  <ol>
                    {(isSwedish ? solution.stepsSv : solution.steps).map((step, stepIdx) => (
                      <li key={stepIdx}>{step}</li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          ))}
        </div>

        {selectedIssue.preventionTips && selectedIssue.preventionTips.length > 0 && (
          <div className="prevention-section">
            <h3>{isSwedish ? 'Förebyggande tips' : 'Prevention Tips'}</h3>
            <ul>
              {(isSwedish ? selectedIssue.preventionTipsSv : selectedIssue.preventionTips)?.map((tip, idx) => (
                <li key={idx}>💡 {tip}</li>
              ))}
            </ul>
          </div>
        )}

        {selectedIssue.relatedIssues && selectedIssue.relatedIssues.length > 0 && (
          <div className="related-issues">
            <h3>{isSwedish ? 'Relaterade problem' : 'Related Issues'}</h3>
            <div className="related-links">
              {selectedIssue.relatedIssues.map(relatedId => {
                const related = troubleshootingDatabase.find(i => i.id === relatedId);
                if (!related) return null;
                return (
                  <button
                    key={relatedId}
                    onClick={() => handleIssueSelect(related)}
                    className="related-link"
                  >
                    {isSwedish ? related.titleSv : related.title}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="resolution-section">
          <button 
            onClick={() => markAsResolved(selectedIssue)}
            className="resolve-button"
          >
            ✅ {isSwedish ? 'Markera som löst' : 'Mark as Resolved'}
          </button>
        </div>

        <style jsx>{`
          .troubleshooting-detail {
            max-width: 800px;
            margin: 0 auto;
            padding: 2rem;
          }

          .back-button {
            background: none;
            border: none;
            color: #3b82f6;
            cursor: pointer;
            font-size: 0.9rem;
            margin-bottom: 1rem;
          }

          h2 {
            color: #1f2937;
            margin-bottom: 0.5rem;
          }

          .description {
            color: #6b7280;
            margin-bottom: 2rem;
          }

          .symptoms-section, .causes-section, .solutions-section, 
          .prevention-section, .related-issues, .resolution-section {
            margin-bottom: 2rem;
          }

          h3 {
            color: #374151;
            margin-bottom: 1rem;
            font-size: 1.25rem;
          }

          ul {
            list-style: none;
            padding: 0;
          }

          ul li {
            padding: 0.5rem 0;
            color: #4b5563;
          }

          .causes-list {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
          }

          .cause-item {
            display: flex;
            align-items: center;
            gap: 1rem;
            padding: 0.75rem;
            background: #f9fafb;
            border-radius: 6px;
          }

          .cause-probability {
            font-size: 0.75rem;
            font-weight: 600;
            min-width: 60px;
          }

          .cause-text {
            color: #4b5563;
          }

          .solution-card {
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            margin-bottom: 1rem;
            overflow: hidden;
          }

          .solution-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1rem;
            background: #f9fafb;
          }

          .solution-header h4 {
            margin: 0;
            color: #1f2937;
            font-size: 1.1rem;
          }

          .solution-steps {
            padding: 1.5rem;
            background: white;
          }

          .solution-steps ol {
            margin: 0;
            padding-left: 1.5rem;
          }

          .solution-steps li {
            padding: 0.5rem 0;
            color: #4b5563;
          }

          .related-links {
            display: flex;
            flex-wrap: wrap;
            gap: 0.5rem;
          }

          .related-link {
            background: #eff6ff;
            border: 1px solid #dbeafe;
            color: #1e40af;
            padding: 0.5rem 1rem;
            border-radius: 6px;
            cursor: pointer;
            transition: background-color 0.2s;
          }

          .related-link:hover {
            background: #dbeafe;
          }

          .resolve-button {
            background: #10b981;
            color: white;
            border: none;
            padding: 0.75rem 1.5rem;
            border-radius: 6px;
            font-size: 1rem;
            cursor: pointer;
            transition: background-color 0.2s;
          }

          .resolve-button:hover {
            background: #059669;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="troubleshooting-guide">
      <h2>{isSwedish ? 'Felsökningsguide' : 'Troubleshooting Guide'}</h2>
      
      <div className="search-section">
        <input
          type="text"
          placeholder={isSwedish ? 'Sök efter problem...' : 'Search for issues...'}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
      </div>

      {provider && (
        <div className="provider-filter">
          {isSwedish ? 'Visar problem för' : 'Showing issues for'}: <strong>{provider.toUpperCase()}</strong>
        </div>
      )}

      <div className="issues-list">
        {filteredIssues.length === 0 ? (
          <p className="no-results">
            {isSwedish ? 'Inga problem hittades' : 'No issues found'}
          </p>
        ) : (
          filteredIssues.map(issue => (
            <div 
              key={issue.id}
              className={`issue-card ${resolvedIssues.has(issue.id) ? 'resolved' : ''}`}
              onClick={() => handleIssueSelect(issue)}
            >
              <div className="issue-header">
                <h3>{isSwedish ? issue.titleSv : issue.title}</h3>
                {resolvedIssues.has(issue.id) && (
                  <span className="resolved-badge">✅ {isSwedish ? 'Löst' : 'Resolved'}</span>
                )}
              </div>
              <p className="issue-description">
                {isSwedish ? issue.descriptionSv : issue.description}
              </p>
              <div className="issue-meta">
                <span className="symptom-count">
                  {issue.symptoms.length} {isSwedish ? 'symtom' : 'symptoms'}
                </span>
                <span className="solution-count">
                  {issue.solutions.length} {isSwedish ? 'lösningar' : 'solutions'}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      <style jsx>{`
        .troubleshooting-guide {
          max-width: 900px;
          margin: 0 auto;
          padding: 2rem;
        }

        h2 {
          color: #1f2937;
          margin-bottom: 1.5rem;
        }

        .search-section {
          margin-bottom: 1.5rem;
        }

        .search-input {
          width: 100%;
          padding: 0.75rem;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 1rem;
        }

        .provider-filter {
          background: #eff6ff;
          padding: 0.75rem;
          border-radius: 6px;
          margin-bottom: 1.5rem;
          color: #1e40af;
        }

        .issues-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .issue-card {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 1.5rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .issue-card:hover {
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          border-color: #3b82f6;
        }

        .issue-card.resolved {
          opacity: 0.7;
          background: #f0fdf4;
        }

        .issue-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.5rem;
        }

        .issue-header h3 {
          margin: 0;
          color: #1f2937;
          font-size: 1.2rem;
        }

        .resolved-badge {
          color: #059669;
          font-size: 0.875rem;
          font-weight: 500;
        }

        .issue-description {
          color: #6b7280;
          margin-bottom: 1rem;
        }

        .issue-meta {
          display: flex;
          gap: 1.5rem;
        }

        .symptom-count, .solution-count {
          color: #9ca3af;
          font-size: 0.875rem;
        }

        .no-results {
          text-align: center;
          color: #6b7280;
          padding: 3rem;
          background: #f9fafb;
          border-radius: 8px;
        }
      `}</style>
    </div>
  );
};

export default TroubleshootingGuide;