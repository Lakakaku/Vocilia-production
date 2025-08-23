Project Overview
This is an AI-powered customer feedback platform that enables customers in retail stores to provide voice feedback to an AI assistant and receive cashback rewards based on feedback quality. The system provides businesses with valuable customer insights while rewarding customers economically for quality feedback.

## 📊 **Current Development Status**

**Last Updated**: August 23, 2025 - Session Update  
**Overall Progress**: 49 of 342 tasks completed (14.3%)  
**Current Phase**: AI System Implementation (Phase 3) & Business Dashboard (Phase 4)

### **🎯 Major Milestones Achieved**

#### **Phase 1: Foundation & Infrastructure (78% Complete)**
✅ **Database Foundation**
- Complete Supabase setup with PostgreSQL schema
- Row Level Security (RLS) policies implemented
- Database indexes and performance optimization
- Migration system with complete data model

✅ **Monorepo Architecture**  
- Turborepo with npm workspaces configured
- Shared packages structure with TypeScript paths
- Build caching and optimization
- Comprehensive package structure

✅ **API Gateway Infrastructure**
- Express.js server with WebSocket support
- Error handling and rate limiting middleware
- Health check endpoints and monitoring
- Request validation and security headers

#### **Phase 2: Customer Journey (89% Complete)**
✅ **QR Code System**
- Encrypted QR code generation with versioning
- Secure token validation with 15-minute expiry
- Location-specific QR code support
- Session management and validation

✅ **Progressive Web App (PWA)**
- Next.js PWA configuration with offline support
- iOS Safari optimizations and compatibility
- App manifest with proper icons and metadata
- Mobile-first responsive design

✅ **Voice Recording System**
- MediaRecorder API implementation
- iOS Safari fallback with Web Audio API
- Real-time audio level visualization
- Recording controls with countdown timer
- Audio playback testing functionality

✅ **WebSocket Communication**
- Real-time audio streaming protocol
- Connection management with reconnection logic
- Heartbeat/ping-pong for connection stability
- Audio chunk processing and queuing

#### **Phase 3: AI System (32% Complete)**
✅ **Quality Scoring Framework**
- Multi-criteria evaluation (authenticity, concreteness, depth)
- Reward calculation with tier-based system
- Scoring prompt templates with Swedish language
- Mock AI evaluation pipeline for development

✅ **Fraud Detection Foundation**
- Device fingerprinting system
- Basic duplicate content detection framework
- Risk scoring algorithm structure
- Anonymous customer identification

✅ **Ollama & AI Integration**
- Ollama installed and configured with Llama 3.2 model
- Local AI processing infrastructure ready
- AI service abstraction layer completed

✅ **iOS Safari Testing Framework (Completed This Session)**
- Comprehensive testing infrastructure for iOS Safari compatibility
- Playwright configuration with multiple iOS device profiles
- Manual testing guide with step-by-step procedures  
- Browser-based testing utilities for real device validation
- Test data attributes added to all PWA components
- NetworkStatus component for connection monitoring
- Automated test reporting and teardown systems

✅ **Business Dashboard Foundation (Completed This Session)**
- Complete authentication system with role-based access
- Dashboard layout with navigation and responsive design
- Feedback list view with search and filtering capabilities
- Category-based filtering and display systems
- Business registration and tier management

🟦 **In Progress**
- WhisperX speech-to-text integration
- AI response latency optimization (<2s target)
- Real AI model deployment to production

### **🏗️ Technical Architecture Implemented**

#### **Backend Services**
```
apps/api-gateway/
├── src/routes/
│   ├── health.ts        ✅ Health monitoring
│   ├── qr.ts           ✅ QR generation/validation  
│   ├── feedback.ts     ✅ Voice feedback processing
│   └── business.ts     ✅ Business API endpoints
├── src/websocket/
│   └── voiceHandler.ts ✅ Real-time voice streaming
└── src/middleware/
    └── errorHandler.ts ✅ Comprehensive error handling
```

#### **Customer PWA**
```
apps/customer-pwa/
├── src/pages/
│   └── index.tsx       ✅ Main application entry
├── src/components/
│   ├── QRScanner.tsx   ✅ Camera-based QR scanning
│   ├── VoiceRecorder.tsx ✅ iOS-compatible voice recording
│   ├── FeedbackFlow.tsx ✅ Complete user journey
│   └── FeedbackResult.tsx ✅ Reward display & analytics
└── public/
    └── manifest.json   ✅ PWA configuration
```

#### **Database Layer**
```
packages/database/
├── src/index.ts        ✅ Database service layer
├── src/types.ts        ✅ Generated Supabase types
└── supabase/
    ├── config.toml     ✅ Supabase configuration
    └── migrations/     ✅ Complete database schema
```

### **🎯 Current Sprint Focus**

#### **Immediate Priorities (P0 Critical)**
1. **Ollama Integration** - Install and configure local AI
2. **WhisperX Setup** - Real speech-to-text processing  
3. **Business Dashboard** - Core management interface
4. **iOS Safari Testing** - Comprehensive compatibility validation

#### **This Session's Achievements**
- ✅ **iOS Safari Testing Framework**: Complete testing infrastructure ready for device validation
- ✅ **Business Dashboard Core**: Authentication, navigation, feedback management implemented
- ✅ **Ollama AI Integration**: Local AI processing ready with Llama 3.2
- ✅ **Testing Infrastructure**: Comprehensive manual and automated testing setup

#### **Next Sprint Goals**
- Complete WhisperX speech-to-text integration
- Perform physical iOS device testing validation
- Optimize AI response latency to <2s target
- Configure production environment variables

### **📱 Key Features Working**

#### **Customer Experience** 
✅ **Complete Voice Feedback Flow**
- QR code scanning with camera access
- Voice recording with iOS Safari fallback
- Real-time audio processing and streaming
- Immediate feedback and reward display
- Anonymous session management

✅ **Technical Excellence**
- Sub-2 second voice processing target architecture
- Progressive Web App installable on mobile
- Offline capability and service worker
- Real-time WebSocket communication
- Comprehensive error handling and recovery

✅ **Security & Privacy**
- GDPR-compliant anonymous processing
- Encrypted QR tokens with expiration
- Device fingerprinting without PII
- Secure WebSocket communication
- Input validation and sanitization

The platform has achieved a **solid MVP foundation** with **working end-to-end customer experience**. The next critical milestone is completing real AI integration to replace the current mock processing system.

Core Value Proposition

Customers: Earn up to 1000 SEK/hour through quality voice feedback
Businesses: Actionable customer insights with categorized, searchable feedback
Platform: 20% commission on all rewards distributed to customers

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

Frontend: Next.js + React, Tailwind CSS, PWA capabilities
Backend: Node.js + Express/Fastify, PostgreSQL (Supabase)
AI: Initially Ollama + Llama 3.2 locally → Future OpenAI/Anthropic API
Voice: WhisperX (STT) + Coqui TTS locally → Future cloud APIs
Payments: Stripe Connect for customer payouts
Hosting: Vercel (frontend), Railway (backend), Supabase (database)

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
## **Comprehensive Testing Strategy**

### **Testing Philosophy & Requirements**

Our testing approach is **mobile-first** with special focus on **iOS Safari compatibility**, **real-time voice processing**, and **fraud detection accuracy**. Given the complexity of voice streaming, AI evaluation, and payment processing, we implement multiple testing layers to ensure reliability.

#### **Coverage Requirements**
- **Unit Tests**: 80% minimum for business logic
- **Integration Tests**: 100% for critical customer journey paths
- **E2E Tests**: Complete user flows on real devices
- **Performance Tests**: Voice latency < 2s, API response < 500ms
- **Security Tests**: Fraud detection accuracy > 95%

---

### **1. iOS Safari Compatibility Testing**

#### **Device Testing Matrix**
```typescript
// Device compatibility test suite
const IOS_TEST_DEVICES = [
  { model: 'iPhone 15 Pro', ios: '17.0+', safari: 'latest' },
  { model: 'iPhone 14', ios: '16.0+', safari: 'latest' },
  { model: 'iPhone 13', ios: '15.0+', safari: 'legacy' },
  { model: 'iPad Pro', ios: '17.0+', safari: 'latest' },
  { model: 'iPad Air', ios: '16.0+', safari: 'latest' }
];

describe('iOS Safari Voice Recording', () => {
  IOS_TEST_DEVICES.forEach(device => {
    it(`should record audio on ${device.model} iOS ${device.ios}`, async () => {
      await setupDevice(device);
      const recorder = new VoiceRecorder();
      
      // Test MediaRecorder availability
      const hasMediaRecorder = typeof MediaRecorder !== 'undefined';
      
      // Test microphone permissions
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      expect(stream.getAudioTracks().length).toBeGreaterThan(0);
      
      // Test audio recording quality
      const audioChunk = await recorder.recordForDuration(3000);
      expect(audioChunk.byteLength).toBeGreaterThan(1024);
      
      // Test Web Audio API fallback if needed
      if (!hasMediaRecorder) {
        expect(recorder.isUsingWebAudioFallback).toBe(true);
      }
    });
  });
});
```

#### **PWA Installation Testing**
```typescript
describe('PWA Installation on iOS', () => {
  it('should prompt for home screen installation', async () => {
    const installPrompt = await waitForInstallPrompt();
    expect(installPrompt).toBeDefined();
    
    // Test add to home screen functionality
    await installPrompt.prompt();
    const choiceResult = await installPrompt.userChoice;
    expect(choiceResult.outcome).toBe('accepted');
  });
  
  it('should work offline after installation', async () => {
    await installPWA();
    await goOffline();
    
    // Test offline QR scanning page loads
    const qrPage = await navigateTo('/scan');
    expect(qrPage.isLoaded).toBe(true);
    
    // Test service worker caching
    const cachedResources = await getServiceWorkerCache();
    expect(cachedResources.includes('/scan')).toBe(true);
  });
});
```

---

### **2. Voice Processing Test Suite**

#### **Audio Quality & Streaming Tests**
```typescript
// Voice recording and streaming validation
describe('Voice Processing Pipeline', () => {
  let voiceRecorder: VoiceRecorder;
  let mockWebSocket: MockWebSocket;
  
  beforeEach(() => {
    voiceRecorder = new VoiceRecorder();
    mockWebSocket = new MockWebSocket();
  });
  
  it('should handle real-time audio streaming', async () => {
    const audioStream = await createMockAudioStream();
    voiceRecorder.start(audioStream);
    
    // Verify chunks are sent every 500ms
    await wait(1500);
    expect(mockWebSocket.messageCount).toBeGreaterThanOrEqual(3);
    
    // Verify audio format compliance
    const lastChunk = mockWebSocket.getLastMessage();
    expect(lastChunk.sampleRate).toBe(16000);
    expect(lastChunk.channels).toBe(1);
  });
  
  it('should handle silence detection and warnings', async () => {
    voiceRecorder.start();
    
    // Simulate 10 seconds of silence
    await simulateSilence(10000);
    
    // Should trigger warning
    expect(voiceRecorder.hasWarning).toBe(true);
    expect(voiceRecorder.warningType).toBe('silence_detected');
  });
  
  it('should auto-terminate after 30s silence', async () => {
    voiceRecorder.start();
    await simulateSilence(30000);
    
    expect(voiceRecorder.isRecording).toBe(false);
    expect(voiceRecorder.terminationReason).toBe('silence_timeout');
  });
});
```

#### **Speech-to-Text Accuracy Tests**
```typescript
describe('STT Processing with WhisperX', () => {
  const TEST_AUDIO_SAMPLES = [
    { language: 'sv', text: 'Kaffe var mycket bra, personal vänlig', file: 'swedish-positive.wav' },
    { language: 'sv', text: 'Butiken var smutsig och kött såg gammalt ut', file: 'swedish-negative.wav' },
    { language: 'en', text: 'Store was clean but checkout took forever', file: 'english-mixed.wav' }
  ];
  
  TEST_AUDIO_SAMPLES.forEach(sample => {
    it(`should accurately transcribe ${sample.language} audio`, async () => {
      const audioBuffer = await loadTestAudio(sample.file);
      const transcript = await whisperX.transcribe(audioBuffer);
      
      const similarity = calculateTextSimilarity(transcript, sample.text);
      expect(similarity).toBeGreaterThan(0.8); // 80% accuracy minimum
      expect(transcript.language).toBe(sample.language);
    });
  });
  
  it('should handle poor audio quality gracefully', async () => {
    const noisyAudio = await loadTestAudio('noisy-background.wav');
    const result = await whisperX.transcribe(noisyAudio);
    
    if (result.confidence < 0.6) {
      expect(result.error).toBe('audio_quality_insufficient');
    }
  });
});
```

---

### **3. AI Quality Scoring Validation**

#### **Scoring Consistency Tests**
```typescript
describe('AI Quality Scoring Accuracy', () => {
  const BENCHMARK_FEEDBACKS = [
    {
      transcript: 'Kaffe var perfekt, personal hjälpsam, butiken ren',
      expectedScore: { authenticity: 85, concreteness: 80, depth: 70, total: 78 },
      businessType: 'cafe'
    },
    {
      transcript: 'Bra bra bra, allt var bra helt enkelt',
      expectedScore: { authenticity: 60, concreteness: 30, depth: 25, total: 42 },
      businessType: 'grocery_store'
    }
  ];
  
  BENCHMARK_FEEDBACKS.forEach(feedback => {
    it(`should score "${feedback.transcript}" accurately`, async () => {
      const businessContext = createMockBusinessContext(feedback.businessType);
      const score = await aiService.evaluateFeedback(
        feedback.transcript,
        businessContext,
        ['coffee', 'pastry']
      );
      
      // Allow 10% variance in scoring
      expect(score.total).toBeCloseTo(feedback.expectedScore.total, 10);
      expect(score.authenticity).toBeCloseTo(feedback.expectedScore.authenticity, 15);
    });
  });
  
  it('should maintain consistency across multiple evaluations', async () => {
    const transcript = 'Kaffe var mycket bra och personal var trevlig';
    const context = createMockBusinessContext('cafe');
    
    // Run same evaluation 5 times
    const scores = await Promise.all(
      Array(5).fill(null).map(() => 
        aiService.evaluateFeedback(transcript, context, ['coffee'])
      )
    );
    
    // Scores should be within 5 points of each other
    const totalScores = scores.map(s => s.total);
    const variance = Math.max(...totalScores) - Math.min(...totalScores);
    expect(variance).toBeLessThan(5);
  });
});
```

#### **Fraud Detection Testing**
```typescript
describe('Fraud Detection Accuracy', () => {
  it('should detect duplicate content fraud', async () => {
    const transcript = 'This is the best store ever with great service';
    
    // Submit same content multiple times
    await Promise.all([
      submitFeedback({ transcript, customerHash: 'user1' }),
      submitFeedback({ transcript, customerHash: 'user2' }),
      submitFeedback({ transcript, customerHash: 'user3' })
    ]);
    
    const fraudScore = await fraudDetector.analyzeContent(transcript);
    expect(fraudScore).toBeGreaterThan(0.8); // High fraud risk
  });
  
  it('should detect geographic clustering fraud', async () => {
    const suspiciousPattern = {
      location: { lat: 59.3293, lng: 18.0686 }, // Stockholm
      submissions: Array(20).fill(null).map((_, i) => ({
        customerHash: `fake_user_${i}`,
        timestamp: new Date(Date.now() + i * 60000) // 1 min apart
      }))
    };
    
    const fraudScore = await fraudDetector.analyzeGeographicPattern(
      suspiciousPattern.submissions,
      suspiciousPattern.location
    );
    
    expect(fraudScore).toBeGreaterThan(0.9);
  });
  
  it('should have <5% false positive rate', async () => {
    const legitimateFeedbacks = await loadTestData('legitimate_feedbacks_1000.json');
    
    let falsePositives = 0;
    for (const feedback of legitimateFeedbacks) {
      const fraudScore = await fraudDetector.analyzeSession(feedback);
      if (fraudScore > 0.7) { // Fraud threshold
        falsePositives++;
      }
    }
    
    const falsePositiveRate = falsePositives / legitimateFeedbacks.length;
    expect(falsePositiveRate).toBeLessThan(0.05); // < 5%
  });
});
```

---

### **4. End-to-End Journey Testing**

#### **Complete Customer Flow**
```typescript
describe('Complete Customer Journey E2E', () => {
  let testBrowser: Browser;
  let customerPage: Page;
  
  beforeAll(async () => {
    testBrowser = await playwright.chromium.launch();
    customerPage = await testBrowser.newPage();
  });
  
  it('should complete full feedback journey with reward', async () => {
    // 1. QR Code Scanning
    await customerPage.goto('/scan');
    const qrCode = await generateTestQRCode();
    await customerPage.evaluate((code) => {
      // Simulate QR code scan
      window.handleQRScan(code);
    }, qrCode);
    
    // Verify session creation
    await customerPage.waitForSelector('[data-testid="transaction-verification"]');
    
    // 2. Transaction Verification
    await customerPage.fill('[data-testid="transaction-id"]', 'TEST-TXN-123');
    await customerPage.fill('[data-testid="amount"]', '250');
    await customerPage.click('[data-testid="verify-transaction"]');
    
    await customerPage.waitForSelector('[data-testid="voice-recording"]');
    
    // 3. Voice Feedback Recording
    // Grant microphone permissions
    await customerPage.context().grantPermissions(['microphone']);
    
    await customerPage.click('[data-testid="start-recording"]');
    
    // Simulate audio input (requires actual audio file)
    await playTestAudio(customerPage, 'quality-feedback.wav');
    
    await customerPage.click('[data-testid="stop-recording"]');
    
    // 4. AI Processing & Results
    await customerPage.waitForSelector('[data-testid="processing-complete"]', {
      timeout: 10000 // Allow time for AI processing
    });
    
    const qualityScore = await customerPage.textContent('[data-testid="quality-score"]');
    expect(parseInt(qualityScore!)).toBeGreaterThan(60);
    
    const rewardAmount = await customerPage.textContent('[data-testid="reward-amount"]');
    expect(parseFloat(rewardAmount!)).toBeGreaterThan(0);
    
    // 5. Verify Database State
    const session = await database.feedbackSessions.findUnique({
      where: { qrToken: qrCode }
    });
    
    expect(session?.status).toBe('completed');
    expect(session?.qualityScore).toBeGreaterThan(60);
    expect(session?.rewardAmount).toBeGreaterThan(0);
  });
  
  it('should handle abandoned sessions gracefully', async () => {
    await customerPage.goto('/scan');
    const qrCode = await generateTestQRCode();
    await customerPage.evaluate((code) => {
      window.handleQRScan(code);
    }, qrCode);
    
    // Start but don't complete feedback
    await customerPage.waitForSelector('[data-testid="voice-recording"]');
    
    // Close page without completing
    await customerPage.close();
    
    // Verify session is marked as abandoned after timeout
    await wait(16 * 60 * 1000); // 16 minutes
    
    const session = await database.feedbackSessions.findUnique({
      where: { qrToken: qrCode }
    });
    
    expect(session?.status).toBe('abandoned');
  });
});
```

#### **Business Dashboard E2E**
```typescript
describe('Business Dashboard E2E', () => {
  it('should display feedback analytics correctly', async () => {
    // Set up test business with sample feedbacks
    const business = await createTestBusiness();
    await createTestFeedbacks(business.id, 50);
    
    const businessPage = await testBrowser.newPage();
    await businessPage.goto(`/business/${business.id}/dashboard`);
    
    // Verify analytics display
    const totalFeedbacks = await businessPage.textContent('[data-testid="total-feedbacks"]');
    expect(totalFeedbacks).toBe('50');
    
    const avgScore = await businessPage.textContent('[data-testid="average-score"]');
    expect(parseFloat(avgScore!)).toBeGreaterThan(0);
    
    // Test feedback filtering
    await businessPage.selectOption('[data-testid="category-filter"]', 'service');
    await businessPage.waitForSelector('[data-testid="filtered-results"]');
    
    const filteredCount = await businessPage.locator('[data-testid="feedback-item"]').count();
    expect(filteredCount).toBeLessThan(50);
  });
});
```

---

### **5. Performance & Load Testing**

#### **Concurrent Voice Sessions**
```typescript
describe('Performance & Scalability', () => {
  it('should handle 1000 concurrent voice sessions', async () => {
    const concurrentSessions = 1000;
    const sessionPromises: Promise<any>[] = [];
    
    for (let i = 0; i < concurrentSessions; i++) {
      const sessionPromise = createVoiceSession({
        businessId: `test-business-${i % 10}`,
        audioData: await loadTestAudio('sample-feedback.wav')
      });
      sessionPromises.push(sessionPromise);
    }
    
    const startTime = Date.now();
    const results = await Promise.allSettled(sessionPromises);
    const duration = Date.now() - startTime;
    
    // All sessions should complete within 30 seconds
    expect(duration).toBeLessThan(30000);
    
    // At least 95% should succeed
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const successRate = successful / concurrentSessions;
    expect(successRate).toBeGreaterThan(0.95);
  });
  
  it('should maintain voice latency under load', async () => {
    const concurrentVoiceSessions = 100;
    const latencyMeasurements: number[] = [];
    
    await Promise.all(
      Array(concurrentVoiceSessions).fill(null).map(async () => {
        const startTime = Date.now();
        const response = await processVoiceFeedback(testAudioChunk);
        const latency = Date.now() - startTime;
        latencyMeasurements.push(latency);
      })
    );
    
    const avgLatency = latencyMeasurements.reduce((a, b) => a + b) / latencyMeasurements.length;
    const p95Latency = latencyMeasurements.sort()[Math.floor(latencyMeasurements.length * 0.95)];
    
    expect(avgLatency).toBeLessThan(2000); // < 2s average
    expect(p95Latency).toBeLessThan(3000);  // < 3s 95th percentile
  });
});
```

#### **Memory & Resource Management**
```typescript
describe('Resource Management', () => {
  it('should not leak memory during voice processing', async () => {
    const initialMemory = process.memoryUsage().heapUsed;
    
    // Process 100 voice sessions
    for (let i = 0; i < 100; i++) {
      await processVoiceFeedback(testAudioChunk);
      
      // Force garbage collection every 10 sessions
      if (i % 10 === 0 && global.gc) {
        global.gc();
      }
    }
    
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryGrowth = finalMemory - initialMemory;
    
    // Memory growth should be minimal (< 50MB)
    expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024);
  });
  
  it('should cleanup WebSocket connections properly', async () => {
    const connections = await createMultipleWebSocketConnections(50);
    
    // Close all connections
    await Promise.all(connections.map(ws => ws.close()));
    
    // Wait for cleanup
    await wait(5000);
    
    const activeConnections = getActiveWebSocketCount();
    expect(activeConnections).toBe(0);
  });
});
```

---

### **6. Security & Compliance Testing**

#### **Input Validation & XSS Prevention**
```typescript
describe('Security Testing', () => {
  it('should prevent XSS attacks in feedback content', async () => {
    const maliciousInputs = [
      '<script>alert("xss")</script>',
      'javascript:alert(1)',
      '<img src="x" onerror="alert(1)">',
      '${alert(1)}',
      '{{constructor.constructor("alert(1)")()}}'
    ];
    
    for (const maliciousInput of maliciousInputs) {
      const feedback = await submitFeedback({
        transcript: maliciousInput,
        businessId: 'test-business'
      });
      
      // Content should be sanitized
      expect(feedback.transcript).not.toContain('<script>');
      expect(feedback.transcript).not.toContain('javascript:');
      expect(feedback.transcript).not.toContain('onerror');
    }
  });
  
  it('should enforce rate limits correctly', async () => {
    const rapidRequests = Array(10).fill(null).map(() =>
      submitFeedback({ customerHash: 'test-user', transcript: 'test' })
    );
    
    const results = await Promise.allSettled(rapidRequests);
    const rateLimitedRequests = results.filter(r => 
      r.status === 'rejected' && r.reason.message.includes('rate limit')
    );
    
    expect(rateLimitedRequests.length).toBeGreaterThan(0);
  });
});
```

#### **GDPR Compliance Testing**
```typescript
describe('GDPR Compliance', () => {
  it('should not store audio data beyond processing', async () => {
    const session = await createFeedbackSession();
    const audioUrl = session.audioUrl;
    
    // Complete feedback processing
    await processFeedback(session.id);
    
    // Verify audio is deleted after processing
    const updatedSession = await getFeedbackSession(session.id);
    expect(updatedSession.audioUrl).toBeNull();
    
    // Verify file is actually deleted from storage
    const audioExists = await checkFileExists(audioUrl);
    expect(audioExists).toBe(false);
  });
  
  it('should automatically delete data after 90 days', async () => {
    const oldSession = await createFeedbackSession({
      createdAt: new Date(Date.now() - 91 * 24 * 60 * 60 * 1000) // 91 days ago
    });
    
    // Run data retention cleanup
    await runDataRetentionCleanup();
    
    const sessionExists = await getFeedbackSession(oldSession.id);
    expect(sessionExists).toBeNull();
  });
});
```

---

### **7. Testing Infrastructure & Automation**

#### **Test Data Management**
```typescript
// Test data factory for consistent test setup
export class TestDataFactory {
  static createBusiness(overrides: Partial<Business> = {}): Business {
    return {
      id: generateId(),
      name: 'Test Café',
      orgNumber: '556123-4567',
      email: 'test@example.com',
      stripeAccountId: 'acct_test123',
      ...overrides
    };
  }
  
  static createFeedbackSession(overrides: Partial<FeedbackSession> = {}): FeedbackSession {
    return {
      id: generateId(),
      businessId: 'test-business',
      qrToken: generateQRToken(),
      customerHash: generateCustomerHash(),
      status: 'pending',
      ...overrides
    };
  }
  
  static async createTestAudio(type: 'positive' | 'negative' | 'neutral'): Promise<ArrayBuffer> {
    const audioFiles = {
      positive: 'test-audio/positive-feedback.wav',
      negative: 'test-audio/negative-feedback.wav', 
      neutral: 'test-audio/neutral-feedback.wav'
    };
    
    return loadAudioFile(audioFiles[type]);
  }
}
```

#### **CI/CD Testing Pipeline**
```yaml
# .github/workflows/test.yml
name: Comprehensive Testing Pipeline

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:unit
      - run: npm run test:coverage
  
  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v3
      - run: npm ci
      - run: npm run test:integration
  
  ios-safari-tests:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm ci
      - run: npm run test:ios-safari
      
  performance-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm ci
      - run: npm run test:performance
      - run: npm run test:load
```

#### **Test Reporting & Monitoring**
```typescript
// Custom test reporter for comprehensive results
export class VoicePlatformTestReporter {
  static generateReport(results: TestResults): TestReport {
    return {
      summary: {
        totalTests: results.length,
        passed: results.filter(r => r.status === 'passed').length,
        failed: results.filter(r => r.status === 'failed').length,
        voiceLatencyAvg: this.calculateAvgVoiceLatency(results),
        fraudDetectionAccuracy: this.calculateFraudAccuracy(results)
      },
      iosSafariCompatibility: this.analyzeIOSResults(results),
      performanceMetrics: this.extractPerformanceMetrics(results),
      securityTestResults: this.analyzeSecurityTests(results)
    };
  }
}
```

This comprehensive testing strategy ensures the AI Feedback Platform delivers a reliable, secure, and performant experience across all user touchpoints, with special attention to the critical iOS Safari voice recording functionality and real-time AI processing requirements.
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