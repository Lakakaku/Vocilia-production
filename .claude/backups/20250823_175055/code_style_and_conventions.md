# AI Feedback Platform - Code Style & Conventions

## File Naming Conventions
- **components/**: PascalCase (e.g., `VoiceFeedback.tsx`)
- **pages/**: kebab-case (e.g., `feedback-session.tsx`)
- **utils/**: camelCase (e.g., `audioProcessor.js`)
- **types/**: PascalCase (e.g., `FeedbackSession.ts`)
- **constants/**: UPPER_SNAKE_CASE (e.g., `REWARD_TIERS.ts`)

## Import Organization (Strict Order)
```typescript
// 1. React/Next.js imports
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
```

## TypeScript Standards

### Core Type Definitions
```typescript
// Use interfaces for objects
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

// Use types for unions and complex types
type RecordingState = 'idle' | 'requesting' | 'recording' | 'completed' | 'error';
```

### Validation with Zod
```typescript
import { z } from 'zod';

export const TransactionVerificationSchema = z.object({
  transactionId: z.string().regex(/^[A-Z0-9-]{10,50}$/),
  purchaseAmount: z.number().min(50).max(100000),
  purchaseTime: z.date(),
  locationId: z.string().uuid()
});
```

## Code Documentation Standards

### Function Documentation
```typescript
/**
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
```

## Component Standards

### React Components
```typescript
// Use function components with TypeScript
interface VoiceRecorderProps {
  sessionId: string;
  onComplete: (audioBlob: Blob, duration: number) => void;
  onBack: () => void;
}

export function VoiceRecorder({ sessionId, onComplete, onBack }: VoiceRecorderProps) {
  // Component implementation
}
```

### Styling with Tailwind
```tsx
// Use semantic class ordering: layout → spacing → sizing → colors → effects
<div className="flex flex-col items-center justify-center p-6 min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
```

## Error Handling Standards
```typescript
// Use custom error classes
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

// Structured error responses
interface APIError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
  requestId: string;
}
```

## Testing Standards
```typescript
// Test file naming: adjacent to source with .test.ts/.test.tsx
// Example: audioProcessor.test.ts
describe('Audio Processing', () => {
  it('should process valid audio chunk', async () => {
    const mockAudioData = new ArrayBuffer(1024);
    const result = await processAudioChunk(mockAudioData);
    
    expect(result.transcript).toBeDefined();
    expect(result.confidence).toBeGreaterThan(0.8);
  });
});
```

## Important Rules
- **NO COMMENTS in code** unless explicitly requested
- **GDPR Compliant**: No voice data storage, minimal PII
- **iPhone Safari First**: Always consider iOS Safari limitations
- **Performance Critical**: Voice latency <2s, API <500ms
- **Consistent Error Handling**: Use structured error responses
- **Type Safety**: Strict TypeScript, no `any` types