// Core interfaces and types
export { POSAdapter } from './interfaces/POSAdapter';
export * from './types';

// Base adapter functionality
export { BasePOSAdapter, POSApiError } from './base/BasePOSAdapter';

// OAuth management
export { OAuthManager, type OAuthConfig } from './oauth/OAuthManager';

// POS system detection and capabilities
export { POSDetector, type BusinessContext, type DetectedPOSSystem, type POSDetectionResult } from './detection/POSDetector';

// Factory for creating adapters
export { POSAdapterFactory, posAdapterFactory, type AdapterCreationOptions, type AdapterRecommendation } from './factory/POSAdapterFactory';

// Re-export relevant types from shared-types
export type { POSProvider, POSConnection, POSSyncStatus } from '@ai-feedback-platform/shared-types';