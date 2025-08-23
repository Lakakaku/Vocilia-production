# AI Feedback Platform - Tech Stack & Architecture

## Tech Stack

### Frontend
- **Next.js** + React with TypeScript
- **Tailwind CSS** for styling
- **PWA capabilities** for mobile-first experience
- **Framer Motion** for animations

### Backend
- **Node.js** with Express/Fastify
- **WebSocket** for real-time audio streaming
- **PostgreSQL** via Supabase for database
- **Prisma ORM** for database management

### AI & Voice Processing
- **Initially**: Ollama + Llama 3.2 locally
- **Future**: OpenAI/Anthropic API
- **Voice**: WhisperX (STT) + Coqui TTS locally → Future cloud APIs

### Infrastructure
- **Hosting**: Vercel (frontend), Railway (backend), Supabase (database)
- **Payments**: Stripe Connect for customer payouts
- **Monorepo**: Turborepo for build orchestration and caching
- **Package Manager**: npm (specified in package.json)

## Architecture - Monorepo Structure

```
ai-feedback-platform/
├── apps/
│   ├── customer-pwa/         # Next.js PWA - Customer mobile interface
│   ├── business-dashboard/   # Next.js - Business dashboard
│   ├── admin-panel/         # Next.js - Admin dashboard (future)
│   └── api-gateway/         # Node.js - Main backend API
├── packages/
│   ├── database/            # Prisma schemas & migrations
│   ├── shared-types/        # Shared TypeScript types & utilities
│   ├── ui-components/       # Shared React UI components
│   ├── pos-adapters/        # POS system integrations
│   └── ai-evaluator/        # AI evaluation service
└── services/
    ├── feedback-processor/  # Voice processing service
    ├── fraud-detector/      # Fraud detection service
    └── payment-handler/     # Payment processing service
```

## Key Architectural Patterns
- **Monorepo Organization**: Clear separation between customer, business, and admin interfaces
- **Service Isolation**: Voice processing and AI evaluation as separate services
- **Microservices Ready**: API-first architecture for easy scaling
- **Real-time Communication**: WebSocket for voice streaming
- **Progressive Web App**: No app store required, works on all mobile browsers