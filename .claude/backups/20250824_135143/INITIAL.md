FEATURE
Build the AI Feedback Platform - a complete system where customers provide voice feedback in retail stores through QR code scanning and receive cashback rewards based on feedback quality. The platform includes customer PWA, business dashboard, admin system, AI evaluation, and payment processing.
EXAMPLES
Voice Implementation Pattern
javascript// examples/voice-recorder.js
// WebSocket-based audio streaming implementation
class VoiceRecorder {
  private mediaRecorder: MediaRecorder;
  private socket: WebSocket;
  
  async initialize() {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true
      }
    });
    
    // iOS Safari fallback
    if (!window.MediaRecorder) {
      return this.initializeWebAudioFallback(stream);
    }
    
    this.mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'audio/webm;codecs=opus'
    });
    
    // Stream 500ms chunks
    this.mediaRecorder.ondataavailable = (e) => {
      if (this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(e.data);
      }
    };
  }
}
QR Code Security Pattern
javascript// examples/qr-security.js
// Encrypted QR payload with version tracking
const qrPayload = {
  v: 1, // version
  b: businessId,
  l: locationId,
  t: Date.now()
};

const encryptedQR = encrypt(JSON.stringify(qrPayload));
const qrUrl = `${BASE_URL}/feedback?q=${encryptedQR}`;

// Validation with time window
async function validateQRScan(encryptedData: string) {
  const payload = decrypt(encryptedData);
  const age = Date.now() - payload.t;
  
  if (age > 15 * 60 * 1000) { // 15 minute window
    throw new Error('QR code expired');
  }
  
  return payload;
}
POS Integration Pattern
javascript// examples/pos-adapter.js
// Abstract adapter for multiple POS systems
abstract class POSAdapter {
  abstract authenticate(credentials: OAuthCredentials): Promise<void>;
  abstract getTransaction(transactionId: string): Promise<Transaction>;
  abstract subscribeToWebhook(endpoint: string): Promise<void>;
  abstract mapLocations(): Promise<LocationMapping[]>;
}

// Square implementation example
class SquareAdapter extends POSAdapter {
  async authenticate(credentials) {
    const { access_token } = await square.oauth.obtainToken({
      client_id: process.env.SQUARE_CLIENT_ID,
      client_secret: process.env.SQUARE_CLIENT_SECRET,
      code: credentials.authCode,
      grant_type: 'authorization_code'
    });
    
    await this.saveToken(access_token);
  }
}
AI Evaluation Pattern
javascript// examples/ai-evaluator.js
// Quality scoring with structured prompts
const EVALUATION_PROMPT = `
Rate this customer feedback on a scale 0-100:

Criteria (with weights):
1. Authenticity (40%): Match with business context
2. Concreteness (30%): Specific, actionable observations
3. Depth (30%): Detailed, thoughtful insights

Business Context: {businessContext}
Purchase Items: {items}
Customer Feedback: {transcript}

Return JSON: {
  authenticity: number,
  concreteness: number,
  depth: number,
  total_score: number,
  reasoning: string,
  categories: string[],
  sentiment: number
}`;

const REWARD_TIERS = {
  exceptional: { min: 90, max: 100, reward: [0.08, 0.12] },
  veryGood: { min: 75, max: 89, reward: [0.04, 0.07] },
  acceptable: { min: 60, max: 74, reward: [0.01, 0.03] },
  insufficient: { min: 0, max: 59, reward: [0, 0] }
};
Fraud Detection Pattern
javascript// examples/fraud-detector.js
// Multi-layer fraud detection system
class FraudDetector {
  async analyze(session: FeedbackSession) {
    const checks = await Promise.all([
      this.checkVoiceAuthenticity(session.audioData),
      this.checkDeviceFingerprint(session.deviceId),
      this.checkGeographicPattern(session.customerId),
      this.checkContentDuplication(session.transcript),
      this.checkTemporalPattern(session.customerId),
      this.checkContextAuthenticity(session.transcript, session.businessContext)
    ]);
    
    const riskScore = this.calculateRiskScore(checks);
    
    if (riskScore > 0.7) {
      await this.flagForReview(session, checks);
    }
    
    return riskScore;
  }
  
  generateCustomerHash(deviceFingerprint: string, phoneLastDigits: string) {
    return crypto
      .createHash('sha256')
      .update(`${deviceFingerprint}:${phoneLastDigits}`)
      .digest('hex');
  }
}
Stripe Connect Pattern
javascript// examples/stripe-connect.js
// Business onboarding and reward processing
class StripeOnboarding {
  async createConnectedAccount(business: Business) {
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'SE',
      capabilities: {
        transfers: { requested: true }
      },
      business_type: 'company',
      company: {
        name: business.name,
        tax_id: business.orgNumber
      }
    });
    
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${BASE_URL}/business/stripe-refresh`,
      return_url: `${BASE_URL}/business/stripe-success`,
      type: 'account_onboarding'
    });
    
    return accountLink.url;
  }
}
DOCUMENTATION
External APIs & Services

Supabase Documentation: https://supabase.com/docs/guides/database

PostgreSQL setup, Row Level Security, Auth configuration


Stripe Connect API: https://stripe.com/docs/connect

Connected accounts, transfers, Swedish market requirements


Square POS API: https://developer.squareup.com/reference/square

OAuth flow, transaction webhooks, location management


Shopify POS API: https://shopify.dev/docs/api/pos

Integration patterns for Nordic markets


Zettle API: https://developer.zettle.com/docs

Popular in Sweden, webhook setup


Ollama Documentation: https://github.com/ollama/ollama/blob/main/docs/api.md

Local AI model setup and API usage


WhisperX: https://github.com/m-bain/whisperX

Speech-to-text optimization


Coqui TTS: https://github.com/coqui-ai/TTS

Text-to-speech for voice responses



Internal Documentation

Project Specification: docs/project-spec.md (Document 2)
Implementation Plan: docs/implementation-plan.md (Document 1)
Database Schema: docs/database-schema.sql
API Standards: docs/api-guidelines.md
Security Requirements: docs/security-compliance.md

OTHER CONSIDERATIONS
Critical Success Factors

Voice latency under 2 seconds - Essential for user experience
iOS Safari compatibility - Primary user platform, requires fallback implementations
99.9% uptime - Business-critical reliability
Fraud detection accuracy > 95% - Protects platform economics
AI consistency score > 90% - Fair and reliable scoring
POS integration time < 30 minutes - Low friction onboarding

Swedish Market Specifics

GDPR Compliance: No voice data storage, minimal PII collection
SEK currency only initially with multi-currency architecture ready
Swedish language support in AI conversations (Llama 3.2 supports Swedish)
Business org number validation against Swedish Bolagsverket
Swish payment integration consideration for future (currently Stripe only)

Technical Gotchas

iOS MediaRecorder fallback required - Safari doesn't fully support MediaRecorder API
WebSocket connection management - Handle reconnection for mobile network switches
Session token uniqueness - Prevent multi-tab conflicts
POS sync delays - Allow 1-2 minute transaction appearance window
Stripe Connect mandatory - No service without payment setup
QR code static for 6 months - Balance security with reprint costs
Audio format optimization - 16kHz/16-bit PCM for AI vs bandwidth
Rate limiting critical - Prevent abuse while allowing legitimate burst usage

Modular Development Approach

Start with MVP: Core feedback loop, 2-3 POS integrations, basic dashboard
Local AI initially: Ollama for cost-effective development and testing
Progressive enhancement: Add features based on pilot feedback
API-ready architecture: Easy migration from local to cloud AI
Monorepo structure: Shared packages for database, types, UI components

Business Model Validation

Pilot with 10 businesses first: 3 cafés, 5 grocery stores, 2 chains
Trial system: 30 feedbacks OR 30 days free
20% platform commission on rewards (admin-adjustable per business)
Tier-based reward caps: Protect against abuse while incentivizing quality

User Experience Priorities

No app download required - PWA in mobile browser
15-minute post-purchase window - Balances freshness with convenience
One feedback per transaction - Prevents gaming
Transparent reward calculation - Users see potential before starting
Clear error messages - Guide users through verification issues