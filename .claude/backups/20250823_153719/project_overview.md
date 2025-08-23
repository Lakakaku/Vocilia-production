# AI Feedback Platform - Project Overview

## Purpose
This is an AI-powered customer feedback platform that enables customers in retail stores to provide voice feedback to an AI assistant and receive cashback rewards based on feedback quality. The system provides businesses with valuable customer insights while rewarding customers economically for quality feedback.

## Core Value Proposition
- **Customers**: Earn up to 1000 SEK/hour through quality voice feedback (1-12% of purchase amount)
- **Businesses**: Actionable customer insights with categorized, searchable feedback
- **Platform**: 20% commission on all rewards distributed to customers

## Customer Journey Flow
1. **QR Scan**: Customer scans store QR code → Mobile web PWA (no app download)
2. **Transaction Verification**: Validate via POS integration (transaction ID, amount, time)
3. **Voice Feedback**: 30s-1min AI conversation via WebSocket audio streaming
4. **AI Evaluation**: Quality scoring (0-100) based on authenticity, concreteness, depth
5. **Instant Reward**: 1-12% of purchase amount paid via Stripe Connect

## Key Technical Constraints
- **Mobile-First**: Optimized for iPhone Safari with PWA functionality
- **Real-time Voice**: WebSocket audio streaming with <2s response latency
- **Fraud Prevention**: Multi-layer detection (voice analysis, device fingerprinting, geographic patterns)
- **POS Integration**: OAuth-based connections to Square, Shopify POS, Zettle
- **GDPR Compliant**: No voice data storage, minimal customer PII

## Development Status
- Phase 1: Foundation & Infrastructure (78% complete)
- Phase 2: Core Customer Journey (89% complete)  
- Phase 3: AI Integration (44% complete) - **CURRENT FOCUS**
- Remaining phases: Business Dashboard, POS Integration, Admin System, Security, Testing, Deployment