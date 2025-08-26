AI Feedback Platform

A voice-powered customer feedback system that rewards quality insights with instant cashback

🎯 Overview
The AI Feedback Platform enables retail customers to provide voice feedback through QR code scanning and receive cashback rewards based on feedback quality. Businesses gain valuable, categorized customer insights while customers earn up to 12% cashback for exceptional feedback.

Core Value Proposition
- **Customers**: Earn 1-12% cashback on purchases through quality voice feedback
- **Businesses**: Actionable, AI-categorized insights with trend analysis
- **Platform**: 20% commission on all distributed rewards

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm 8+ or yarn
- Docker & Docker Compose (optional)
- Supabase account (for database)

### Installation
```bash
# Clone the repository
git clone https://github.com/your-org/ai-feedback-platform.git
cd ai-feedback-platform

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your configuration

# Set up Supabase database
npx supabase init
npx supabase start
npx supabase db push

# Start development servers
npm run dev
🏗️ Architecture
Monorepo Structure
ai-feedback-platform/
├── apps/
│   ├── web/                 # Customer PWA (Next.js)
│   ├── business/            # Business dashboard (Next.js)
│   ├── admin/              # Admin dashboard (Next.js)
│   └── api/                # Backend API (Node.js)
├── packages/
│   ├── database/           # Prisma schemas & migrations
│   ├── shared/             # Shared TypeScript types & utilities
│   └── ui/                 # Shared React UI components
└── services/
    ├── voice/              # Voice processing service
    └── ai/                 # AI evaluation service
Tech Stack

Frontend: Next.js, React, Tailwind CSS, PWA
Backend: Node.js, Express/Fastify, PostgreSQL (Supabase)
AI: Ollama + Llama 3.2 (local) → OpenAI/Anthropic (production)
Voice: WhisperX (STT), Coqui TTS → Cloud APIs
Payments: Stripe Connect
Hosting: Vercel (frontend), Railway (backend), Supabase (database)

💡 Features
Customer Experience

📱 No app download - PWA in mobile browser
🎙️ 30-60 second voice conversations with AI
💰 Instant cashback (1-12% of purchase amount)
⏱️ 15-minute feedback window after purchase
🔒 Enterprise-grade security with PCI DSS compliance

Business Dashboard

📊 Categorized feedback with AI-powered insights
📈 Trend analysis and anomaly detection
🎯 Actionable recommendations based on patterns
💳 POS integration (Square, Shopify, Zettle)
📍 Multi-location support with location-specific insights

Admin System

🔍 Real-time monitoring of feedback sessions
🛡️ Fraud detection with multi-layer protection
📊 Process analytics and conversion funnels
🎯 AI calibration tools with performance monitoring
⚖️ Manual score override system with audit trails
🧪 A/B testing tools for AI optimization
🎮 Comprehensive manual override capabilities

🔄 Customer Journey

QR Scan → Mobile web PWA opens
Transaction Verification → Enter receipt details
Voice Feedback → 30-60 second AI conversation
Quality Evaluation → AI scores feedback (0-100)
Instant Reward → Cashback via Stripe

## 🏪 POS Integration System

### Supported Providers
- **Square**: Complete OAuth2, real-time transactions, webhooks, location mapping
- **Shopify**: Full POS integration with multi-store support and inventory sync
- **Zettle**: Swedish-optimized with Swish, Kassaregister, VAT reporting

### Key Capabilities
- 🔄 **Intelligent Retry System**: Exponential backoff with circuit breaker pattern
- 🏥 **Health Monitoring**: Real-time status tracking with automatic failover
- 🧪 **Testing Framework**: Comprehensive test suites with mock servers for CI/CD
- 🧭 **Setup Wizard**: Step-by-step guided integration (Swedish/English)
- 📚 **Interactive Tutorials**: Provider-specific guides with visual aids
- 🔧 **Troubleshooting System**: Built-in diagnostics with 7+ common issue resolutions
- 📊 **Performance Benchmarking**: Integration latency tracking and optimization

### Quick Integration
```typescript
import { posAdapterFactory, POSSetupWizard } from '@ai-feedback-platform/pos-adapters';

// Auto-detect best provider for business
const recommendation = await posAdapterFactory.getRecommendation(businessContext);

// Create adapter with automatic configuration
const adapter = await posAdapterFactory.createAdapter(recommendation.provider, {
  accessToken: process.env.POS_ACCESS_TOKEN
});

// Validate connection
const validation = await adapter.testConnection();
console.log(`POS Integration Status: ${validation.success ? '✅' : '❌'}`);
```

🎯 Quality Scoring System
Feedback is evaluated on three criteria:

Authenticity (40%): Matches business context
Concreteness (30%): Specific, actionable observations
Depth (30%): Detailed, thoughtful insights

Reward Tiers
ScoreQualityReward90-100Exceptional8-12% of purchase75-89Very Good4-7% of purchase60-74Acceptable1-3% of purchase<60InsufficientNo reward
🔧 Development
Code Standards
See CLAUDE.md for comprehensive development guidelines including:

TypeScript standards
Testing requirements (80% coverage minimum)
Voice processing patterns
Security implementations
Performance targets

Key Commands
bash# Development
pnpm dev              # Start all services in development
pnpm dev:web         # Start customer PWA only
pnpm dev:api         # Start API only

# Testing
pnpm test            # Run all tests
pnpm test:e2e        # Run E2E tests
pnpm test:coverage   # Generate coverage report

# Database
pnpm db:migrate      # Run migrations
pnpm db:seed         # Seed development data
pnpm db:studio       # Open Prisma Studio

# Production
pnpm build           # Build all apps
pnpm start           # Start production servers

### Seeding Development Data

Use the workspace script to populate baseline demo data (businesses, locations, sessions):

```bash
# Ensure environment variables are set (service role required for seeding)
export SUPABASE_URL="https://<your-project>.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="<your-service-role-key>"

# Run seeding
npm run db:seed
```

Notes:
- Uses service role client to bypass RLS during seed.
- Idempotent upserts keyed by `org_number` and `qr_token`.
- Seeds: two businesses (Cafe Aurora, NordMart), multiple locations, and a few completed sessions.
Environment Variables
bash# Database
DATABASE_URL="postgresql://..."
REDIS_URL="redis://..."

# Authentication
SUPABASE_URL="https://..."
SUPABASE_ANON_KEY="..."

# AI Services
OLLAMA_ENDPOINT="http://localhost:11434"
OPENAI_API_KEY="sk-..."  # For production

# Payments
STRIPE_SECRET_KEY="sk_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# POS Integrations
SQUARE_CLIENT_ID="..."
SQUARE_CLIENT_SECRET="..."
SQUARE_WEBHOOK_SECRET="..."
SHOPIFY_CLIENT_ID="..."  
SHOPIFY_CLIENT_SECRET="..."
ZETTLE_CLIENT_ID="..."
ZETTLE_CLIENT_SECRET="..."
🚦 Testing
Test Coverage Requirements

Unit tests: 80% minimum coverage
Integration tests for critical paths
E2E tests for complete customer journey
iOS Safari compatibility tests

Running Tests
bash# Unit tests
pnpm test:unit

# Integration tests  
pnpm test:integration

# E2E tests
pnpm test:e2e

# iOS compatibility
pnpm test:ios
📊 Performance Targets

Voice Response: <2 seconds latency
Page Load: <3 seconds initial load
API Response: <500ms for non-AI endpoints
Security Response: <2 seconds threat containment
Uptime: 99.9% availability

🔒 Security Features

The platform implements enterprise-grade security with comprehensive protection:

## Payment Security (PCI DSS Level 1 Compliant)
- **Payment Data Tokenization**: Secure tokenization of all payment information
- **Swedish Banking Integration**: Full support for Bankgiro, Swish, and IBAN payments
- **Key Management**: Automatic encryption key rotation every 90 days
- **Audit Trail**: Complete transaction logging with real-time monitoring

## Advanced Fraud Prevention
- **Multi-Layer Detection**: 6-category fraud detection system
- **Velocity Monitoring**: Real-time payment velocity limits (10/min, 100/hr, 500/day)
- **Behavioral Analysis**: ML-powered anomaly detection with pattern recognition
- **Geographic Protection**: Impossible travel detection and location clustering
- **Suspicious Activity Alerts**: Automated alerting with <2 second response time

## Data Protection & Compliance
- **AES-256-GCM Encryption**: Enterprise-grade encryption for all sensitive data
- **GDPR Compliance**: Complete data erasure capabilities and 7-year retention
- **Swedish Compliance**: Finansinspektionen AML reporting and PSD2 SCA validation
- **Personnummer Protection**: Advanced masking for Swedish personal identification

## Security Testing
- **218 Total Security Tests**: Comprehensive validation across all security components
- **Penetration Testing**: Automated security validation with simulated attacks  
- **Vulnerability Assessment**: Regular security scanning and threat analysis
- **Test-Only Environment**: All security testing uses fake data and test APIs
Concurrent Sessions: 1000+ simultaneous feedbacks


🚀 Deployment
Production Deployment
bash# Frontend (Vercel)
vercel deploy --prod apps/web
vercel deploy --prod apps/business
vercel deploy --prod apps/admin

# Backend (Railway)
railway up -s api
railway up -s voice-processor

# Database (Supabase) - Already cloud-hosted
Health Checks
All services expose health endpoints:

API: GET /health
Voice Service: GET /health
Frontend apps: GET /api/health

📈 Monitoring
Metrics Tracked

Feedback session duration
AI processing time
Reward processing time
Conversion funnel metrics
Error rates by component

Alert Triggers

System downtime
High error rates
Payment failures
Fraud detection triggers
Performance degradation

🤝 Contributing
Please see CLAUDE.md for detailed contribution guidelines, code standards, and architectural decisions.
Development Process

Create GitHub issue with acceptance criteria
Create feature branch: feature/issue-number-description
Develop following code standards
Write tests (80% coverage minimum)
Submit PR with thorough description
Code review and approval
Deploy to staging → production

📝 License
[License Type] - See LICENSE file for details
🆘 Support

Documentation: See /docs folder
Issues: GitHub Issues
Email: support@feedback-platform.com
Business Support: business@feedback-platform.com

🎯 Success Metrics
Technical Excellence

Voice latency <2 seconds
99.9% uptime
Fraud detection accuracy >95%
AI consistency score >90%

Business Metrics

Customer participation >10%
Feedback completion >70%
Business retention after trial >60%
Average quality score 65-75


Built with ❤️ for better customer insights and fair rewards