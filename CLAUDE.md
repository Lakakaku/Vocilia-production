Project Overview
This is an AI-powered customer feedback platform that enables customers in retail stores to provide voice feedback to an AI assistant and receive cashback rewards based on feedback quality. The system provides businesses with valuable customer insights while rewarding customers economically for quality feedback.
Core Value Proposition

Customers: Earn up to 1000 SEK/hour through quality voice feedback
Businesses: Actionable customer insights with categorized, searchable feedback
Platform: 20% commission on all rewards distributed to customers

🚀 **CURRENT DEVELOPMENT STATUS** (Updated 2024-12-19)

**Phase 3 AI System Integration: 100% COMPLETE** ⭐ MAJOR MILESTONE ACHIEVED + OPTIMIZED

✅ **COMPLETED CORE AI CAPABILITIES:**
- **Ollama + qwen2:0.5b Integration**: Ultra-fast local AI processing (83% smaller, <2s response times)
- **Multi-Provider AI Service**: Robust abstraction layer with OpenAI/Anthropic fallback mechanisms
- **Advanced Quality Scoring**: 3-component algorithm (Authenticity 40%, Concreteness 30%, Depth 30%)
- **Comprehensive Reward Engine**: Multi-tier calculations (1-12%) with risk assessment and fraud protection caps
- **Swedish Voice Processing**: WhisperX STT integration + Multi-provider TTS (Piper, eSpeak, macOS say)
- **Customer Education System**: AI-generated score explanations with personalized improvement suggestions
- **Fraud Protection Framework**: Device fingerprinting, risk assessment, and comprehensive scoring algorithms

**🎯 SYSTEM NOW CAPABLE OF:**
- Processing Swedish voice feedback with high accuracy and natural conversation flow
- Evaluating feedback quality using sophisticated AI analysis across multiple dimensions  
- Calculating fair, fraud-resistant rewards with multiple safety mechanisms and business constraints
- Providing educational explanations to help customers improve future feedback quality
- Handling service failures gracefully with comprehensive fallback mechanisms

**💰 BUSINESS IMPACT ACHIEVED:**
- Core value proposition is functional: customers give voice feedback → receive cashback rewards
- Quality-based reward system ensures businesses get valuable insights (not just participation rewards)
- Platform commission model (20%) is implemented and tested
- Fraud prevention protects against abuse while encouraging genuine participation
- **CRITICAL OPTIMIZATION COMPLETE**: Voice response latency reduced from 10.4s to <2s (80%+ improvement)

**📋 NEXT PRIORITIES (AI OPTIMIZATION COMPLETE):**
1. ✅ COMPLETE: AI performance optimization (qwen2:0.5b model, caching, connection pooling)
2. ✅ COMPLETE: Real-time WebSocket voice pipeline with WhisperX STT processing  
3. ✅ COMPLETE: Conversation state management for natural dialogue flow
4. **NEW PRIORITY**: Choose next development phase - POS Integration (Phase 5) or Payment System (Phase 6)

Project Structure
ai-feedback-platform/
├── apps/
│   ├── web/                 # Next.js PWA - Customer mobile interface
│   ├── business/            # Next.js - Business dashboard
│   ├── admin/              # Next.js - Admin dashboard  
│   └── api/                # Node.js - Main backend API
├── packages/
│   ├── database/           # Prisma schemas & migrations
│   ├── shared/             # Shared TypeScript types & utilities
│   └── ui/                 # Shared React UI components
└── services/
    ├── voice/              # Voice processing service (STT/TTS)
    └── ai/                 # AI evaluation service (feedback scoring)
Architecture Context
Customer Journey Flow


QR Scan: Customer scans store QR code → Mobile web PWA (no app download)
Transaction Verification: Validate via POS integration (transaction ID, amount, time)
Voice Feedback: 30s-1min AI conversation via WebSocket audio streaming
AI Evaluation: Quality scoring (0-100) based on authenticity, concreteness, depth
Instant Reward: 1-12% of purchase amount paid via Stripe Connect

Tech Stack

Frontend: Next.js + React, Tailwind CSS, PWA capabilities ✅ IMPLEMENTED
Backend: Node.js + Express/Fastify, PostgreSQL (Supabase) ✅ IMPLEMENTED  
AI: Ollama + Llama 3.2 locally with OpenAI/Anthropic fallback ✅ FULLY IMPLEMENTED
Voice: WhisperX (STT) + Multi-provider TTS (Piper/eSpeak/macOS) ✅ FULLY IMPLEMENTED
Payments: Stripe Connect for customer payouts 🟦 IN PROGRESS
Hosting: Vercel (frontend), Railway (backend), Supabase (database) ✅ CONFIGURED

Key Technical Constraints

Mobile-First: Optimized for iPhone Safari with PWA functionality
Real-time Voice: WebSocket audio streaming with <2s response latency
Fraud Prevention: Multi-layer detection (voice analysis, device fingerprinting, geographic patterns)
POS Integration: OAuth-based connections to Square, Shopify POS, Zettle
GDPR Compliant: No voice data storage, minimal customer PII

Development Guidelines
Code Structure Standards
Monorepo Organization

Use Turborepo for build orchestration and caching
Shared packages for common types, utilities, and UI components
Clear separation between customer, business, and admin interfaces
Service isolation for voice processing and AI evaluation

File Naming Conventions
components/     PascalCase (e.g., VoiceFeedback.tsx)
pages/         kebab-case (e.g., feedback-session.tsx)  
utils/         camelCase (e.g., audioProcessor.js)
types/         PascalCase (e.g., FeedbackSession.ts)
constants/     UPPER_SNAKE_CASE (e.g., REWARD_TIERS.ts)
Import Organization
typescript// 1. React/Next.js imports
import React, { useState, useEffect } from 'react';
import { NextPage } from 'next';

// 2. External libraries
import { z } from 'zod';
import { stripe } from 'stripe';

// 3. Internal shared packages
import { FeedbackSession, QualityScore } from '@/packages/shared/types';
import { Button } from '@/packages/ui/components';

// 4. Relative imports
import { VoiceRecorder } from '../components/VoiceRecorder';
import { validateTransaction } from '../utils/pos-validation';
TypeScript Standards
Core Type Definitions
typescript// Feedback System Types
interface FeedbackSession {
  id: string;
  sessionToken: string;
  qrCodeId: string;
  transactionId: string;
  purchaseAmount: number;
  purchaseTime: Date;
  customerHash: string;
  status: 'pending' | 'completed' | 'abandoned' | 'failed';
  startedAt: Date;
  completedAt?: Date;
}

interface QualityScore {
  authenticity: number;    // 0-100, weighted 40%
  concreteness: number;   // 0-100, weighted 30%  
  depth: number;         // 0-100, weighted 30%
  total: number;         // Overall score 0-100
  reasoning: string;     // AI explanation
}

interface RewardTier {
  min: number;
  max: number;
  rewardPercentage: [number, number]; // [min%, max%]
}
Validation Schemas
typescriptimport { z } from 'zod';

export const TransactionVerificationSchema = z.object({
  transactionId: z.string().regex(/^[A-Z0-9-]{10,50}$/),
  purchaseAmount: z.number().min(50).max(100000),
  purchaseTime: z.date(),
  locationId: z.string().uuid()
});

export const BusinessContextSchema = z.object({
  type: z.enum(['grocery_store', 'cafe', 'restaurant', 'retail']),
  layout: z.object({
    departments: z.array(z.string()),
    checkouts: z.number(),
    selfCheckout: z.boolean()
  }),
  staff: z.array(z.object({
    name: z.string(),
    role: z.string(), 
    department: z.string()
  })),
  currentPromotions: z.array(z.string()),
  knownIssues: z.array(z.string()),
  strengths: z.array(z.string())
});
Testing Requirements
Unit Testing Standards

Framework: Jest + React Testing Library for frontend, Jest for backend
Coverage Target: Minimum 80% for core business logic
Test Files: Adjacent to source files with .test.ts/.test.tsx extension

typescript// Example: audioProcessor.test.ts
import { processAudioChunk, validateAudioQuality } from './audioProcessor';

describe('Audio Processing', () => {
  it('should process valid audio chunk', async () => {
    const mockAudioData = new ArrayBuffer(1024);
    const result = await processAudioChunk(mockAudioData);
    
    expect(result.transcript).toBeDefined();
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  it('should reject poor quality audio', async () => {
    const poorAudioData = new ArrayBuffer(64); // Too small
    
    await expect(validateAudioQuality(poorAudioData))
      .rejects.toThrow('Audio quality insufficient');
  });
});
Integration Testing
typescript// Example: feedback-journey.e2e.test.ts
import { scanQRCode, verifyTransaction, completeFeedback } from './test-utils';

describe('Customer Feedback Journey E2E', () => {
  it('completes full journey from QR scan to reward', async () => {
    // 1. Scan QR code
    const session = await scanQRCode(mockQRCode);
    expect(session.status).toBe('pending');
    
    // 2. Verify transaction
    await verifyTransaction({
      transactionId: 'TEST-12345',
      amount: 250,
      time: new Date()
    });
    
    // 3. Complete voice feedback
    const feedback = await completeFeedback(session.id, mockAudioFile);
    expect(feedback.qualityScore.total).toBeGreaterThan(60);
    
    // 4. Verify reward processing
    const payment = await getPayment(feedback.id);
    expect(payment.status).toBe('completed');
  });
});
Performance Testing
typescript// Load testing for concurrent voice sessions
describe('Voice Service Performance', () => {
  it('handles 100 concurrent sessions', async () => {
    const sessions = Array(100).fill(null).map(() => 
      createVoiceSession(mockSessionData)
    );
    
    const startTime = Date.now();
    await Promise.all(sessions);
    const duration = Date.now() - startTime;
    
    expect(duration).toBeLessThan(5000); // < 5 seconds
  });
});
Voice Processing Standards
Audio Configuration
typescriptconst AUDIO_CONFIG = {
  sampleRate: 16000,        // Optimal for AI processing
  channels: 1,              // Mono
  bitsPerSample: 16,        // 16-bit PCM
  chunkDuration: 500,       // 500ms chunks
  maxSilence: 10000,        // 10s before timeout warning
  hardTimeout: 30000        // 30s maximum silence
};
WebSocket Audio Pipeline
typescriptclass VoiceRecorder {
  private mediaRecorder: MediaRecorder;
  private socket: WebSocket;
  
  async initialize(): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: AUDIO_CONFIG.sampleRate,
        channelCount: AUDIO_CONFIG.channels,
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
    
    this.mediaRecorder.ondataavailable = (event) => {
      if (this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(event.data);
      }
    };
  }
}
AI Integration Standards
Feedback Evaluation Prompt Template
typescriptconst EVALUATION_PROMPT = `
Rate this customer feedback on a scale 0-100:

Criteria (with weights):
1. Authenticity (40%): Match with business context
2. Concreteness (30%): Specific, actionable observations  
3. Depth (30%): Detailed, thoughtful insights

Business Context: {businessContext}
Purchase Items: {purchaseItems}
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
AI Service Interface
typescriptinterface AIService {
  evaluateFeedback(
    transcript: string, 
    businessContext: BusinessContext, 
    purchaseItems: string[]
  ): Promise<QualityScore>;
  
  generateResponse(
    userInput: string,
    conversationHistory: string[],
    businessContext: BusinessContext
  ): Promise<string>;
}

// Implementation agnostic - works with Ollama or OpenAI
class UniversalAIService implements AIService {
  constructor(private provider: 'ollama' | 'openai') {}
  
  async evaluateFeedback(transcript: string, context: BusinessContext): Promise<QualityScore> {
    if (this.provider === 'ollama') {
      return this.evaluateWithOllama(transcript, context);
    } else {
      return this.evaluateWithOpenAI(transcript, context);
    }
  }
}
Database Standards
Prisma Schema Patterns
prismamodel Business {
  id                String   @id @default(cuid())
  orgNumber         String   @unique
  name              String
  tier              Int      @default(1) // 1-3
  stripeAccountId   String?
  commissionRate    Float    @default(0.20)
  contextData       Json?    // Business context for AI
  preferences       Json?    // AI personality, priority areas
  
  // Trial system
  trialFeedbacksRemaining Int? @default(30)
  trialExpiresAt         DateTime?
  
  // Timestamps
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  approvedAt   DateTime?
  approvedBy   String?   // Admin ID
  
  // Relations
  locations    BusinessLocation[]
  feedbacks    Feedback[]
  payments     Payment[]
  
  @@map("businesses")
}

model FeedbackSession {
  id              String            @id @default(cuid())
  sessionToken    String            @unique
  qrCodeId        String
  transactionId   String
  purchaseAmount  Float
  purchaseTime    DateTime
  customerHash    String            // Anonymous customer tracking
  deviceFingerprint String?
  status          SessionStatus     @default(PENDING)
  startedAt       DateTime          @default(now())
  completedAt     DateTime?
  
  // Relations
  qrCode          QRCode            @relation(fields: [qrCodeId], references: [id])
  feedback        Feedback?
  
  @@map("feedback_sessions")
}

enum SessionStatus {
  PENDING
  COMPLETED  
  ABANDONED
  FAILED
}
Database Query Patterns
typescript// Optimized queries with proper indexing
class FeedbackRepository {
  async getFeedbacksByBusiness(
    businessId: string, 
    filters: FeedbackFilters
  ): Promise<Feedback[]> {
    return prisma.feedback.findMany({
      where: {
        businessId,
        createdAt: {
          gte: filters.startDate,
          lte: filters.endDate
        },
        categories: {
          hasAny: filters.categories
        }
      },
      include: {
        session: {
          select: {
            purchaseAmount: true,
            purchaseTime: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }
}
Security Standards
Input Validation
typescriptimport { rateLimit } from 'express-rate-limit';

// Rate limiting configuration
const rateLimits = {
  qrScan: rateLimit({
    windowMs: 60 * 1000,    // 1 minute
    max: 5,                 // 5 scans per minute per IP
    message: 'Too many QR scans'
  }),
  
  feedbackSubmission: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour  
    max: 15,                  // 15 feedbacks per hour
    keyGenerator: (req) => req.body.customerHash,
    message: 'Feedback limit exceeded'
  })
};

// Input sanitization
const sanitizeInput = (input: string): string => {
  return input
    .trim()
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .slice(0, 10000); // Max length
};
Authentication Middleware
typescriptimport { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';

export const authenticateSession = async (
  req: NextRequest,
  res: NextResponse
) => {
  const supabase = createMiddlewareClient({ req, res });
  
  const sessionToken = req.headers.get('x-session-token');
  if (!sessionToken) {
    return new Response('Missing session token', { status: 401 });
  }
  
  const session = await supabase
    .from('feedback_sessions')
    .select('*')
    .eq('session_token', sessionToken)
    .eq('status', 'pending')
    .single();
    
  if (!session.data) {
    return new Response('Invalid session', { status: 401 });
  }
  
  // Check session expiry (15 minutes)
  const sessionAge = Date.now() - new Date(session.data.started_at).getTime();
  if (sessionAge > 15 * 60 * 1000) {
    return new Response('Session expired', { status: 401 });
  }
  
  return session.data;
};
Error Handling Standards
Structured Error Response
typescriptinterface APIError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
  requestId: string;
}

class FeedbackError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'FeedbackError';
  }
}

// Global error handler
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const requestId = req.headers['x-request-id'] || generateId();
  
  if (error instanceof FeedbackError) {
    res.status(error.statusCode).json({
      code: error.code,
      message: error.message,
      details: error.details,
      timestamp: new Date().toISOString(),
      requestId
    });
  } else {
    // Log unexpected errors
    logger.error('Unexpected error', {
      error: error.message,
      stack: error.stack,
      requestId
    });
    
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong',
      timestamp: new Date().toISOString(),
      requestId
    });
  }
};
Fraud Detection Implementation
typescriptinterface FraudCheck {
  type: string;
  score: number;      // 0-1 risk score
  evidence: any;
  confidence: number; // 0-1 confidence in detection
}

class FraudDetector {
  async analyzeSession(session: FeedbackSession): Promise<number> {
    const checks = await Promise.all([
      this.checkVoiceAuthenticity(session.audioData),
      this.checkDeviceFingerprint(session.deviceId),
      this.checkGeographicPattern(session.customerHash),
      this.checkContentDuplication(session.transcript),
      this.checkTemporalPattern(session.customerHash),
      this.checkContextAuthenticity(session.transcript, session.businessContext)
    ]);
    
    const riskScore = this.calculateRiskScore(checks);
    
    if (riskScore > 0.7) {
      await this.flagForReview(session, checks);
    }
    
    return riskScore;
  }
  
  private calculateRiskScore(checks: FraudCheck[]): number {
    const weightedScores = checks.map(check => ({
      ...check,
      weighted: check.score * check.confidence
    }));
    
    return weightedScores.reduce((sum, check) => sum + check.weighted, 0) 
      / weightedScores.length;
  }
}
Task Completion Workflow
Development Process

Feature Planning: Create GitHub issue with acceptance criteria
Branch Creation: feature/issue-number-description or bugfix/issue-number
Development: Write code following standards above
Testing: Unit tests + integration tests (min 80% coverage)
Code Review: PR with thorough description and test results
Deployment: Staging → Production pipeline

Definition of Done

 Feature works on iPhone Safari (primary target)
 Unit tests written and passing (80%+ coverage)
 Integration tests for critical paths
 Code review approved by team member
 Documentation updated (README, API docs)
 Security review completed for sensitive features
 Performance targets met (voice <2s, API <500ms)
 Error handling and logging implemented
 Fraud detection considerations addressed

Git Workflow
bash# Feature development
git checkout -b feature/123-voice-quality-scoring
git commit -m "feat: implement voice quality scoring algorithm"
git push origin feature/123-voice-quality-scoring

# Bug fixes  
git checkout -b bugfix/456-ios-audio-permission
git commit -m "fix: handle iOS audio permission edge case"

# Hotfixes
git checkout -b hotfix/production-payment-error
git commit -m "hotfix: resolve Stripe webhook validation error"
Commit Message Format
<type>(<scope>): <description>

Types: feat, fix, docs, style, refactor, test, chore, hotfix
Scopes: voice, ai, payment, pos, admin, fraud, ui

Examples:
feat(voice): add iOS Safari audio recording fallback
fix(payment): resolve Stripe Connect webhook validation  
docs(api): update POS integration documentation
test(fraud): add device fingerprinting test cases
Performance Requirements
Critical Metrics

Voice Response Time: < 2 seconds from user stops talking to AI response
Page Load Time: < 3 seconds for PWA initial load
API Response Time: < 500ms for all non-AI endpoints
System Uptime: 99.9% availability target
Concurrent Sessions: Support 1000 simultaneous voice feedbacks

Monitoring
typescript// Performance tracking
const performanceMetrics = {
  voiceLatency: new Histogram({
    name: 'voice_response_duration',
    help: 'Time from user speech end to AI response start'
  }),
  
  aiProcessingTime: new Histogram({
    name: 'ai_evaluation_duration', 
    help: 'Time to evaluate feedback quality'
  }),
  
  paymentProcessing: new Histogram({
    name: 'payment_processing_duration',
    help: 'Time to process reward payment'
  })
};

// Usage in code
const startTime = Date.now();
const qualityScore = await aiService.evaluateFeedback(transcript, context);
performanceMetrics.aiProcessingTime.observe(Date.now() - startTime);
Documentation Standards
API Documentation (OpenAPI/Swagger)
yaml# Example endpoint documentation
/api/feedback/sessions:
  post:
    summary: Create new feedback session
    tags: [Feedback]
    requestBody:
      required: true
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/SessionCreationRequest'
    responses:
      201:
        description: Session created successfully
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/FeedbackSession'
      400:
        description: Invalid request data
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/APIError'
Code Documentation
typescript/**
 * Processes customer voice feedback and returns quality score
 * 
 * @param audioData - Raw audio data from customer (16kHz, 16-bit PCM)
 * @param businessContext - Business-specific context for authenticity validation
 * @param purchaseItems - Items customer purchased for context validation
 * @returns Promise<QualityScore> - Detailed quality assessment (0-100 scale)
 * 
 * @throws {FeedbackError} When audio quality is insufficient
 * @throws {AIServiceError} When AI evaluation fails
 * 
 * @example
 * ```typescript
 * const score = await processFeedback(audioBuffer, businessContext, ['coffee', 'pastry']);
 * console.log(`Quality score: ${score.total}/100`);
 * ```
 */
export async function processFeedback(
  audioData: ArrayBuffer,
  businessContext: BusinessContext,
  purchaseItems: string[]
): Promise<QualityScore> {
  // Implementation...
}
README Structure
Each package/service should have:
markdown# Package Name

## Purpose
Brief description of what this package does

## Installation  
npm install / setup instructions

## Usage
Code examples for common use cases

## API Reference
Link to detailed API documentation

## Testing
How to run tests, test coverage info

## Configuration
Environment variables and configuration options

## Troubleshooting
Common issues and solutions
Environment Configuration
Required Environment Variables
bash# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/feedback_platform"
REDIS_URL="redis://localhost:6379"

# Authentication
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_KEY="your-service-key"

# AI Services  
OLLAMA_ENDPOINT="http://localhost:11434"
OPENAI_API_KEY="sk-..." # When migrating to OpenAI
ANTHROPIC_API_KEY="..." # Alternative AI provider

# Payments
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# POS Integrations
SQUARE_CLIENT_ID="your-square-client-id"
SQUARE_CLIENT_SECRET="your-square-client-secret"
SHOPIFY_CLIENT_ID="your-shopify-client-id" 
SHOPIFY_CLIENT_SECRET="your-shopify-client-secret"

# Voice Services
WHISPER_MODEL_PATH="/models/whisper-large-v2"
COQUI_TTS_MODEL="/models/tts_models/en/ljspeech/tacotron2-DDC"

# Monitoring & Logging
SENTRY_DSN="https://your-sentry-dsn"
LOG_LEVEL="info"
Deployment Standards
Docker Configuration
dockerfile# Dockerfile.api
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

# Install dependencies
RUN npm ci --only=production

# Set environment
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["npm", "run", "start:api"]
Health Checks
typescript// Health check endpoint
app.get('/health', async (req, res) => {
  const checks = await Promise.allSettled([
    checkDatabase(),
    checkRedis(), 
    checkAIService(),
    checkStripeConnection(),
    checkPOSIntegrations()
  ]);
  
  const healthy = checks.every(check => check.status === 'fulfilled');
  
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'healthy' : 'unhealthy',
    checks: checks.map(check => ({
      name: check.status === 'fulfilled' ? 'ok' : 'error',
      details: check.status === 'rejected' ? check.reason : null
    })),
    timestamp: new Date().toISOString()
  });
});
Common Patterns & Utilities
Retry Logic
typescriptasync function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      
      const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Usage
const transaction = await withRetry(() => 
  posAdapter.getTransaction(transactionId), 
  3, 
  2000
);
Circuit Breaker Pattern
typescriptclass CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime?: Date;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  
  constructor(
    private threshold: number = 5,
    private timeout: number = 60000 // 1 minute
  ) {}
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }
    
    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess(): void {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }
  
  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = new Date();
    
    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
    }
  }
}

This CLAUDE.md provides comprehensive guidance for developing the AI Feedback Platform with consistent code quality, security, and performance standards. All team members should reference this document when working on any part of the system.