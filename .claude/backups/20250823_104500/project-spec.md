# AI Feedback Platform - Project Specification

## Overview
A complete AI-powered customer feedback system where customers provide voice feedback in retail stores through QR code scanning and receive cashback rewards based on feedback quality.

## Core Components

### 1. Customer PWA (Progressive Web App)
- **QR Code Scanner**: Encrypted QR payload with 15-minute validity window
- **Voice Recorder**: WebSocket-based audio streaming with iOS Safari fallback
- **Reward Calculator**: Transparent reward calculation display
- **Session Management**: Unique token handling, prevent multi-tab conflicts

### 2. Business Dashboard
- **Analytics**: Feedback insights, sentiment analysis, category breakdowns
- **POS Integration**: Square, Shopify, Zettle adapters with OAuth flows
- **QR Management**: Generate static QR codes (6-month validity)
- **Reward Settings**: Configure reward tiers and commission rates

### 3. Admin System
- **Business Onboarding**: Stripe Connect integration, Swedish org number validation
- **Fraud Detection**: Multi-layer analysis with 95% accuracy target
- **Platform Analytics**: Usage metrics, revenue tracking
- **AI Configuration**: Model settings, evaluation criteria tuning

### 4. AI Evaluation Engine
- **Speech-to-Text**: WhisperX optimization for Swedish language
- **Quality Scoring**: Structured prompts with authenticity, concreteness, depth criteria
- **Fraud Analysis**: Voice authenticity, content duplication, geographic patterns
- **Response Generation**: Coqui TTS for voice responses

### 5. Payment Processing
- **Stripe Connect**: Express accounts for Swedish businesses
- **Reward Distribution**: Automated transfers based on feedback quality
- **Commission Handling**: 20% platform fee (admin-adjustable)
- **Currency Support**: SEK initially, multi-currency ready

## Technical Architecture

### Backend Services
- **API Gateway**: Rate limiting, authentication, session management
- **Feedback Service**: Voice processing, AI evaluation, scoring
- **Business Service**: POS integration, dashboard API
- **Payment Service**: Stripe integration, reward processing
- **Admin Service**: Platform management, analytics

### Database (Supabase/PostgreSQL)
- **Row Level Security**: GDPR compliance, minimal PII collection
- **Real-time Subscriptions**: Live dashboard updates
- **Audit Logging**: Fraud detection, compliance tracking

### AI Infrastructure
- **Local Development**: Ollama for cost-effective testing
- **Production Ready**: Cloud AI migration path
- **Model Support**: Llama 3.2 for Swedish language processing

## Critical Success Factors

### Performance Targets
- Voice latency: < 2 seconds
- Uptime: 99.9%
- AI consistency: > 90%
- Fraud detection accuracy: > 95%
- POS integration time: < 30 minutes

### Swedish Market Requirements
- GDPR compliance (no voice data storage)
- SEK currency support
- Swedish language AI processing
- Bolagsverket org number validation
- Future Swish payment consideration

### User Experience
- No app download required (PWA)
- 15-minute post-purchase feedback window
- One feedback per transaction
- Transparent reward calculation
- Clear error messaging

## Development Approach

### MVP Scope
- Core feedback loop functionality
- 2-3 POS integrations (Square, Shopify, Zettle)
- Basic business dashboard
- Local AI processing (Ollama)

### Pilot Strategy
- 10 businesses: 3 cafés, 5 grocery stores, 2 chains
- 30 feedbacks OR 30 days free trial
- Iterative improvement based on feedback

### Technical Implementation
- Monorepo structure with shared packages
- API-first architecture for easy scaling
- Progressive enhancement approach
- Modular POS adapter system