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

// Concrete adapter implementations
export { SquareAdapter } from './adapters/square';
export { ShopifyAdapter } from './adapters/shopify';
export { ZettleAdapter } from './adapters/zettle';

// Webhook processors
export { SquareWebhookProcessor } from './webhooks/SquareWebhookProcessor';
export { ShopifyWebhookProcessor } from './webhooks/ShopifyWebhookProcessor';

// Retry and error handling utilities
export { RetryManager, createRetryManager, RetryError, type RetryConfiguration, type RetryOptions } from './utils/RetryManager';
export { POSErrorHandler, createPOSErrorHandler, type ErrorCategory, type ErrorSeverity, type ErrorHandlingResult } from './utils/ErrorHandler';
export { createLogger, logger, EnhancedLogger, LogLevel, type LoggerConfig, type LogContext } from './utils/logger';

// Health monitoring
export { POSHealthMonitor, createPOSHealthMonitor, type HealthMonitorConfig, type ProviderHealthStatus, type HealthSummary } from './monitoring/POSHealthMonitor';

// Testing and validation
export { POSIntegrationTestFramework, createTestFramework } from './testing/POSIntegrationTestFramework';
export { ConnectionValidator, createConnectionValidator } from './testing/ConnectionValidator';
export type { TestOptions, TestReport, TestResult, ProviderTestSuite } from './testing/POSIntegrationTestFramework';
export type { ValidationStep, ValidationResult, ConnectionConfig } from './testing/ConnectionValidator';

// UI Components
export { POSSetupWizard } from './wizard/POSSetupWizard';
export { IntegrationHealthDashboard } from './dashboard/IntegrationHealthDashboard';
export { POSIntegrationTutorials } from './tutorials/POSIntegrationTutorials';
export { TroubleshootingGuide } from './support/TroubleshootingGuide';

// Re-export relevant types from shared-types
export type { POSProvider, POSConnection, POSSyncStatus } from '@ai-feedback-platform/shared-types';