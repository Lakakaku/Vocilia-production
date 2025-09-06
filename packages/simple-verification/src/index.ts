// Simple Verification Package
// Provides services for manual transaction verification without POS integration

export { StoreCodeService } from './StoreCodeService';
export { VerificationValidator } from './VerificationValidator';

export type {
  StoreCodeRepository,
  VerificationRepository,
  ValidationResult
} from './VerificationValidator';

// Re-export types from shared types for convenience
export type {
  StoreCode,
  SimpleVerification,
  SimpleVerificationFormData,
  SimpleVerificationSettings,
  SimpleVerificationFraudFlag,
  SimpleVerificationFraudType,
  MonthlyBillingBatch,
  BillingBatchStatus,
  SwishBatchPayment,
  SwishPaymentItem,
  StoreCodeGenerationRequest,
  SimpleVerificationStats,
  SimpleVerificationSummary,
  VerificationReviewItem
} from '@ai-feedback-platform/shared-types';