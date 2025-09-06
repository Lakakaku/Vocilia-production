ROADMAP.md - AI Feedback Platform Development Roadmap
Project Vision
Build a voice-powered customer feedback platform that rewards quality insights with instant cashback, creating value for both customers (earn up to 1000 SEK/hour) and businesses (actionable, categorized insights).
Development Phases Overview
🎯 Phase 1: Foundation (Week 1-2)
Goal: Establish core infrastructure and development environment
🔧 Phase 2: Core Customer Journey (Week 3-4)
Goal: Implement QR scanning → verification → voice feedback flow
🤖 Phase 3: AI Integration (Week 5-6)
Goal: Local AI setup for conversation and quality scoring
📊 Phase 4: Business Dashboard (Week 7-8)
Goal: Create business interface for insights and management
🔌 Phase 5: POS Integration (Week 9-10)
Goal: Connect with Square, Shopify, and Zettle
💳 Phase 6: Payment System (Week 11)
Goal: Stripe Connect for automated rewards
🛡️ Phase 7: Admin & Security (Week 12-13)
Goal: Admin tools, fraud detection, and security hardening
✅ Phase 8: Testing & Launch Prep (Week 14-15)
Goal: Comprehensive testing and production readiness
🚀 Phase 9: Launch & Scale (Week 16+)
Goal: Pilot launch with 10 businesses, then scale

Detailed Phase Breakdown
Phase 1: Foundation & Infrastructure (Week 1-2)
Week 1: Project Setup
bash# Initialize monorepo structure
├── apps/
│   ├── web/        # Customer PWA
│   ├── business/   # Business dashboard
│   ├── admin/      # Admin dashboard
│   └── api/        # Backend API
├── packages/
│   ├── database/   # Prisma schemas
│   ├── shared/     # Shared types
│   └── ui/         # Shared components
└── services/
    ├── voice/      # Voice processing
    └── ai/         # AI evaluation
Tasks:

 Initialize Turborepo monorepo with pnpm
 Set up Git with conventional commits
 Configure ESLint, Prettier, TypeScript
 Create Docker development environment
 Set up Supabase project and authentication
 Initialize Prisma with database schemas
 Configure environment variables structure
 Set up basic CI/CD pipeline (GitHub Actions)

Week 2: Database & Security
Database Schema Implementation:
sql-- Priority tables to create
businesses, business_locations, qr_codes, 
feedback_sessions, feedbacks, payments, fraud_flags
Tasks:

 Create all database tables with proper indexes
 Implement Row Level Security (RLS) policies
 Set up authentication middleware
 Configure rate limiting (5 QR scans/min, 15 feedbacks/hour)
 Implement input validation schemas with Zod
 Set up CORS for PWA requirements
 Create base API structure with error handling
 Implement structured logging system


Phase 2: Core Customer Journey (Week 3-4)
Week 3: QR System & PWA Setup
QR Code Implementation:
javascript// QR payload structure
{
  v: 1,              // version
  b: businessId,     // business identifier
  l: locationId,     // specific location
  t: timestamp       // generation time
}
Tasks:

 QR code generation system with encryption
 QR scanning page with mobile optimization
 PWA configuration for iOS/Android
 Offline detection and handling
 Session token generation and management
 Transaction verification UI
 POS stub for testing verification flow
 15-minute feedback window enforcement

Week 4: Voice Implementation
Voice Pipeline Architecture:
Customer → MediaRecorder → WebSocket → STT → AI → TTS → Customer
Tasks:

 WebSocket server for audio streaming
 Frontend audio recording (MediaRecorder API)
 iOS Safari fallback implementation
 WhisperX integration for Speech-to-Text
 Audio queue management for concurrent users
 10-second silence detection with warning
 30-second maximum silence auto-termination
 Session state management and error recovery


Phase 3: AI System Implementation (Week 5-6)
Week 5: Local AI Setup
Ollama Configuration:
bashollama pull llama3.2
# Configure for both conversation and evaluation
Tasks:

 Install and configure Ollama locally
 Create conversation AI personality
 Implement feedback evaluation prompts
 Context injection system for authenticity
 Coqui TTS setup for voice responses
 Response generation under 2 seconds
 Conversation history management
 AI response streaming via WebSocket

Week 6: Quality Scoring & Fraud Detection
Scoring Implementation:
javascript// Quality criteria weights
authenticity: 40%
concreteness: 30%
depth: 30%
Tasks:

 Implement quality scoring algorithm
 Create reward tier calculations (60-100 scale)
 Build fraud detection layer (voice, device, content)
 Customer hash generation (privacy-compliant)
 Duplicate content detection
 Create 200+ benchmark test cases
 Implement monthly calibration system
 Admin review flagging system


Phase 4: Business Dashboard (Week 7-8)
Week 7: Core Business Features
Dashboard Components:

Feedback search & categorization
Trend analysis
Business context editor
Preferences configuration

Tasks:

 Business registration flow
 Dashboard layout with responsive design
 Feedback search with category filters
 Trend identification algorithms
 Business context management UI
 AI personality customization
 Location management for multi-store
 Role-based access control (HQ vs Store)

Week 8: Analytics & Insights
Analytics Features:

KPI tracking
Sentiment analysis
Seasonal trends
ROI calculations

Tasks:

 Real-time analytics dashboard
 Competitor benchmarking (anonymized)
 Actionable insights generation
 Export functionality for data
 Invoice history and billing overview
 Feedback action tracking system
 Email notification system
 API for business integrations


Phase 5: POS Integration (Week 9-10) ✅ COMPLETED WITH ALTERNATIVE SIMPLE VERIFICATION
Week 9: Core POS Adapters + Simple Verification Alternative
Priority Integrations:

✅ Square (OAuth flow)
✅ Shopify POS  
✅ Zettle
✅ **Simple Verification Model** (alternative for businesses without POS integration)

Tasks:
 ✅ Abstract POS adapter interface
 ✅ Square OAuth implementation
 ✅ Shopify POS integration
 ✅ Zettle API connection
 ✅ Transaction webhook listeners
 ✅ Location mapping UI for businesses
 ✅ Automatic POS location detection
 ✅ Transaction validation with fuzzy matching
 ✅ **Simple verification system** for businesses without POS capabilities
 ✅ **Store-local QR code generation** (no internet dependency)
 ✅ **Manual tolerance-based verification workflow**

Week 10: Integration Polish + Simple Verification Workflow
Tasks:
 ✅ POS connection testing suite
 ✅ Retry logic for failed API calls
 ✅ 2-minute sync tolerance handling
 ✅ Integration monitoring dashboard
 ✅ Manual override tools for admin
 ✅ Setup wizard for businesses (both verification methods)
 ✅ Integration documentation
 ✅ Error recovery mechanisms
 ✅ **Monthly batch processing system** for simple verification
 ✅ **CSV export/import workflow** for store verification
 ✅ **Deadline enforcement and automatic billing**
 ✅ **Store verification guides** for different POS systems


Phase 6: Payment System (Week 11) ✅ COMPLETED WITH DUAL PAYMENT MODELS
Dual Payment System Implementation
Payment Flows:
1. **POS Integration**: Feedback → Quality Score → Reward Calculation → Stripe Connect Transfer → Business Billing (20% commission)
2. **Simple Verification**: Feedback → Monthly Batch → Store Verification → Swish Aggregated Payout → Business Billing (20% commission)

✅ **Completed Tasks:**
 ✅ Stripe Connect account creation (POS integration model)
 ✅ Swish API integration for Swedish mobile payments (simple verification model)
 ✅ Business onboarding flow with verification method selection
 ✅ Dual customer payout system (instant vs. monthly aggregated)
 ✅ Tier-based reward caps (50/30/negotiated SEK)
 ✅ Commission billing system (20% default, both models)
 ✅ Payment retry logic and failed payment handling
 ✅ Financial reporting for businesses (both models)
 ✅ Monthly batch processing with CSV export/import
 ✅ Tolerance-based verification (±2 minutes, ±0.5 SEK)
 ✅ Automatic deadline enforcement and billing
 ✅ Phone number aggregation (one payment per customer per month)
 ✅ Store verification guides for multiple POS systems

**Simple Verification Features:**
 ✅ Store-local QR codes (6-digit, no internet required)
 ✅ Monthly CSV export with customer claims
 ✅ Manual verification workflow with tolerance matching
 ✅ Automated deadline enforcement (15th of month)
 ✅ Swish payment aggregation by phone number
 ✅ Commission calculation and invoice generation
 ✅ Fraud detection for manual verification process
 ✅ Comprehensive store documentation and guides


Phase 7: Admin System & Security (Week 12-13)
Week 12: Admin Dashboard
Admin Tools:

Business approval queue
Fraud management
Process monitoring
Manual overrides

Tasks:

 Admin authentication and authorization
 Business approval workflow
 Fraud detection dashboard
 Live session monitoring
 Manual score adjustment tools
 System health monitoring
 Alert system configuration
 Process analytics (funnel analysis)

Week 13: Security & Compliance
Security Implementation:

GDPR compliance
Data encryption
Security hardening

Tasks:

 Implement GDPR data handling
 No voice storage policy
 90-day data retention automation
 Input sanitization everywhere
 SQL injection prevention (Prisma)
 XSS protection in React
 CSRF token implementation
 Security audit and penetration testing


Phase 8: Testing & Launch Prep (Week 14-15)
Week 14: Comprehensive Testing
Test Coverage Requirements:

Unit tests: 80% minimum
E2E customer journey
iOS Safari specific tests
Load testing (1000 concurrent)

Tasks:

 Unit test suite (Jest, 80% coverage)
 Integration tests for critical paths
 E2E tests for complete journey
 iOS Safari compatibility suite
 Load testing (1000 concurrent sessions)
 Performance optimization (<2s voice, <500ms API)
 Fraud detection effectiveness testing
 Payment system testing with test cards

Week 15: Production Preparation
Deployment Setup:

Vercel (frontends)
Railway (backend)
Supabase (database)

Tasks:

 Production environment setup
 Environment variable configuration
 CI/CD pipeline finalization
 Monitoring setup (Sentry, logging)
 Backup and disaster recovery plan
 Documentation completion
 Support system setup
 Launch checklist verification


Phase 9: Launch & Scale (Week 16+)
Week 16: Pilot Launch
First 10 Businesses:
Week 1-2: 3 local cafés (simple, low volume)
Week 3-4: 5 grocery stores (complex, medium volume)
Week 5-6: 2 chain stores (enterprise features)
Tasks:

 Recruit 3 pilot cafés
 Daily monitoring and support
 Manual fraud review initially
 Collect feedback and iterate
 Refine AI prompts based on usage
 Performance optimization
 Expand to grocery stores
 Test multi-location features

Post-Launch: Scaling
Growth Milestones:

10 businesses (Month 1)
50 businesses (Month 3)
200 businesses (Month 6)

Ongoing Tasks:

 API migration (Ollama → OpenAI/Anthropic)
 Premium features development
 International expansion prep
 Advanced analytics features
 Mobile app consideration
 Partnership development
 Marketing automation
 Customer success program


Success Metrics & Checkpoints
Technical KPIs
javascriptconst successMetrics = {
  voiceLatency: '<2 seconds',
  pageLoadTime: '<3 seconds',
  apiResponse: '<500ms',
  uptime: '99.9%',
  fraudDetection: '>95% accuracy',
  aiConsistency: '>90% score'
};
Business KPIs
javascriptconst businessMetrics = {
  customerParticipation: '>10%',
  feedbackCompletion: '>70%',
  businessRetention: '>60% after trial',
  averageQualityScore: '65-75',
  posIntegrationTime: '<30 minutes', // For automatic verification
  simpleVerificationAccuracy: '>95%', // Store verification accuracy
  monthlyProcessingTime: '<2 hours', // Time for store to process monthly batch
  swishPaymentSuccess: '>98%', // Successful Swish payments
  deadlineCompliance: '>80%', // Stores meeting verification deadlines
  supportResponseTime: '<4 hours'
};

Risk Mitigation Checkpoints
After Each Phase

 Security review
 Performance testing
 Code review and refactoring
 Documentation update
 Stakeholder demo
 Risk assessment
 Next phase planning

Critical Decision Points

Week 6: Validate AI quality scoring accuracy
Week 10: Confirm POS integration reliability
Week 13: Security audit results
Week 15: Go/No-go for launch
Month 2: Scale or pivot decision


Development Commands Reference
bash# Development
pnpm dev              # Start all services
pnpm dev:web         # Customer PWA only
pnpm dev:api         # API only

# Testing
pnpm test            # All tests
pnpm test:e2e        # E2E tests
pnpm test:coverage   # Coverage report

# Database
pnpm db:migrate      # Run migrations
pnpm db:seed         # Seed data
pnpm db:studio       # Prisma Studio

# Production
pnpm build           # Build all
pnpm start           # Start production

# Deployment
pnpm deploy:staging  # Deploy to staging
pnpm deploy:prod     # Deploy to production

Notes for Implementation

Start with MVP: Focus on core feedback loop first
iPhone First: Optimize everything for iOS Safari
Modular Architecture: Easy to swap AI providers later
Security from Day 1: GDPR compliance is non-negotiable
Test Early: E2E tests from Phase 2
Document Everything: Maintain CLAUDE.md throughout
Monitor Constantly: Set up monitoring before launch
Iterate Quickly: Daily deployments during pilot

