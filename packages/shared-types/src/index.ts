// Verification method types
export type VerificationMethod = 'pos_integration' | 'simple_verification';

export interface VerificationPreferences {
  pos_integration: {
    preferred_provider: POSProvider | null;
    auto_connect: boolean;
    require_transaction_match: boolean;
  };
  simple_verification: {
    enabled: boolean;
    verification_tolerance: {
      time_minutes: number;
      amount_sek: number;
    };
    review_period_days: number;
    auto_approve_threshold: number;
    daily_limits: {
      max_per_phone: number;
      max_per_ip: number;
    };
    fraud_settings: {
      auto_reject_threshold: number;
      manual_review_threshold: number;
    };
  };
}

// Core business entities
export interface Business {
  id: string;
  name: string;
  orgNumber: string;
  email: string;
  phone?: string;
  address?: BusinessAddress;
  stripeAccountId?: string;
  stripeOnboardingComplete: boolean;
  rewardSettings: RewardSettings;
  status: BusinessStatus;
  trialFeedbacksRemaining: number;
  trialExpiresAt: string;
  verificationMethod: VerificationMethod;
  verificationPreferences: VerificationPreferences;
  verificationMethodChangedAt?: string;
  verificationMethodChangedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessAddress {
  street: string;
  city: string;
  postalCode: string;
  country: string;
}

export interface BusinessLocation {
  id: string;
  businessId: string;
  name: string;
  address?: string;
  posLocationId?: string;
  qrCodeUrl?: string;
  qrCodeExpiresAt: string;
  active: boolean;
  createdAt: string;
}

export type BusinessStatus = 'pending' | 'active' | 'suspended';

// POS Integration types
export interface POSConnection {
  id: string;
  businessId: string;
  provider: POSProvider;
  providerAccountId: string;
  credentials: Record<string, unknown>; // Encrypted
  webhookEndpointId?: string;
  webhookSecret?: string;
  lastSyncAt?: string;
  syncStatus: POSSyncStatus;
  errorMessage?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type POSProvider = 'square' | 'shopify' | 'zettle';
export type POSSyncStatus = 'connected' | 'error' | 'disconnected';

export interface Transaction {
  id: string;
  amount: number;
  currency: string;
  items: TransactionItem[];
  timestamp: string;
  locationId?: string;
  customerId?: string;
}

export interface TransactionItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  category?: string;
}

// Feedback Session types
export interface FeedbackSession {
  id: string;
  businessId: string;
  locationId?: string;
  customerHash: string;
  deviceFingerprint: DeviceFingerprint;
  qrToken: string;
  qrScannedAt: string;
  transactionId?: string;
  transactionAmount?: number;
  transactionItems?: TransactionItem[];
  transactionMatchedAt?: string;
  audioDurationSeconds?: number;
  audioUrl?: string;
  transcript?: string;
  transcriptLanguage: string;
  aiEvaluation?: AIEvaluation;
  qualityScore?: number;
  authenticityScore?: number;
  concretenessScore?: number;
  depthScore?: number;
  sentimentScore?: number;
  feedbackCategories?: string[];
  fraudRiskScore?: number;
  fraudFlags?: FraudFlag[];
  fraudReviewStatus: FraudReviewStatus;
  rewardTier?: RewardTier;
  rewardAmount?: number;
  rewardPercentage?: number;
  rewardProcessedAt?: string;
  stripeTransferId?: string;
  status: FeedbackSessionStatus;
  errorMessage?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceFingerprint {
  userAgent: string;
  screenResolution: string;
  timezone: string;
  language: string;
  platform: string;
  cookieEnabled: boolean;
  doNotTrack?: string;
  touchSupport: boolean;
  canvasFingerprint?: string;
}

export interface AIEvaluation {
  authenticity: number;
  concreteness: number;
  depth: number;
  totalScore: number;
  reasoning: string;
  categories: string[];
  sentiment: number;
  processingTimeMs: number;
  modelUsed: string;
}

export type FeedbackSessionStatus = 
  | 'qr_scanned' 
  | 'transaction_verified'
  | 'recording' 
  | 'processing' 
  | 'completed' 
  | 'failed' 
  | 'fraud_flagged';

export type FraudReviewStatus = 'auto' | 'manual' | 'cleared' | 'rejected';

export interface FraudFlag {
  type: FraudType;
  severity: 'low' | 'medium' | 'high';
  description: string;
  confidence: number;
  data?: Record<string, unknown>;
}

export type FraudType = 
  | 'voice_duplicate'
  | 'voice_synthetic'
  | 'voice_pattern'
  | 'device_abuse'
  | 'location_mismatch'
  | 'content_duplicate'
  | 'temporal_pattern'
  | 'context_mismatch';

// Reward system types
export interface RewardSettings {
  commissionRate: number; // Platform commission (0-1)
  maxDailyRewards: number; // SEK
  rewardTiers: {
    exceptional: RewardTierConfig;
    veryGood: RewardTierConfig;
    acceptable: RewardTierConfig;
    insufficient: RewardTierConfig;
  };
}

export interface RewardTierConfig {
  min: number;
  max: number;
  reward: [number, number]; // [min%, max%] as decimals
}

export type RewardTier = 'exceptional' | 'very_good' | 'acceptable' | 'insufficient';

// API Response types
export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: APIError;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    hasMore?: boolean;
  };
}

export interface APIError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// QR Code types
export interface QRPayload {
  v: number; // version
  b: string; // businessId
  l?: string; // locationId
  t: number; // timestamp
}

// Voice Recording types
export interface VoiceRecordingConfig {
  sampleRate: number;
  channelCount: number;
  echoCancellation: boolean;
  noiseSuppression: boolean;
  mimeType?: string;
}

export interface VoiceChunk {
  data: Blob;
  timestamp: number;
  sequence: number;
  isLast?: boolean;
}

// Webhook types
export interface WebhookEvent {
  id: string;
  type: string;
  data: Record<string, unknown>;
  timestamp: string;
  source: string;
  signature?: string;
}

// Analytics types
export interface AnalyticsMetric {
  id: string;
  metricType: string;
  businessId?: string;
  date: string;
  value: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

// Admin types
export interface AdminUser {
  id: string;
  email: string;
  name?: string;
  role: AdminRole;
  active: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

export type AdminRole = 'admin' | 'super_admin';

// Simple Verification types
export interface StoreCode {
  id: string;
  businessId: string;
  locationId?: string;
  code: string; // 6-digit numeric code
  name?: string;
  active: boolean;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface SimpleVerification {
  id: string;
  sessionId: string;
  businessId: string;
  locationId?: string;
  storeCode?: string;
  purchaseTime: string;
  purchaseAmount: number;
  customerPhone: string;
  submittedAt: string;
  deviceFingerprint?: DeviceFingerprint;
  ipAddress?: string;
  userAgent?: string;
  reviewStatus: SimpleVerificationReviewStatus;
  reviewedAt?: string;
  reviewedBy?: string;
  rejectionReason?: string;
  billingBatchId?: string;
  paymentStatus: SimpleVerificationPaymentStatus;
  paymentAmount?: number;
  commissionAmount?: number;
  storeCost?: number;
  paymentId?: string;
  paidAt?: string;
  fraudScore: number;
  fraudFlags: SimpleVerificationFraudFlag[];
  createdAt: string;
  updatedAt: string;
}

export type SimpleVerificationReviewStatus = 
  | 'pending' 
  | 'approved' 
  | 'rejected' 
  | 'auto_approved';

export type SimpleVerificationPaymentStatus = 
  | 'pending' 
  | 'paid' 
  | 'failed';

export interface SimpleVerificationFraudFlag {
  type: SimpleVerificationFraudType;
  severity: 'low' | 'medium' | 'high';
  description: string;
  confidence: number;
  data?: Record<string, unknown>;
}

export type SimpleVerificationFraudType = 
  | 'phone_abuse'
  | 'time_pattern'
  | 'amount_pattern'
  | 'rapid_submission'
  | 'location_mismatch'
  | 'duplicate_verification';

export interface MonthlyBillingBatch {
  id: string;
  businessId: string;
  billingMonth: string; // YYYY-MM-DD format
  totalVerifications: number;
  approvedVerifications: number;
  rejectedVerifications: number;
  totalCustomerPayments: number;
  totalCommission: number;
  totalStoreCost: number;
  status: BillingBatchStatus;
  reviewDeadline?: string;
  paymentDueDate?: string;
  storeInvoiceGenerated: boolean;
  storePaymentReceived: boolean;
  customerPaymentsSent: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export type BillingBatchStatus = 
  | 'collecting' 
  | 'review_period' 
  | 'payment_processing' 
  | 'completed';

export interface SimpleVerificationSettings {
  enabled: boolean;
  verificationTolerance: {
    timeMinutes: number;
    amountSek: number;
  };
  reviewPeriodDays: number;
  autoApproveThreshold: number; // Fraud score threshold for auto-approval
  dailyLimits: {
    maxPerPhone: number;
    maxPerIp: number;
  };
  fraudSettings: {
    autoRejectThreshold: number;
    manualReviewThreshold: number;
  };
}

// Simple verification form data for customer interface
export interface SimpleVerificationFormData {
  storeCodeOrQR: string;
  purchaseTime: {
    date: string;
    time: string;
  };
  purchaseAmount: number;
  customerPhone: string;
}

// Business dashboard data types
export interface SimpleVerificationSummary {
  businessId: string;
  businessName: string;
  totalVerifications: number;
  pendingReviews: number;
  approved: number;
  rejected: number;
  totalCostApproved: number;
  avgFraudScore?: number;
  highRiskVerifications: number;
}

export interface VerificationReviewItem {
  verification: SimpleVerification;
  session: {
    id: string;
    qualityScore?: number;
    transcript?: string;
    feedbackCategories?: string[];
  };
  fraudRisk: {
    score: number;
    flags: SimpleVerificationFraudFlag[];
    recommendation: 'approve' | 'review' | 'reject';
  };
}

// Swish payment types for simple verification
export interface SwishBatchPayment {
  batchId: string;
  payments: SwishPaymentItem[];
  totalAmount: number;
  currency: 'SEK';
  reference: string;
}

export interface SwishPaymentItem {
  verificationId: string;
  phoneNumber: string;
  amount: number;
  message: string;
}

// Store management types
export interface StoreCodeGenerationRequest {
  businessId: string;
  locationId?: string;
  name?: string;
  expiresAt?: string;
}

export interface SimpleVerificationStats {
  today: {
    verifications: number;
    fraudulent: number;
    pending: number;
  };
  thisMonth: {
    verifications: number;
    totalPayout: number;
    avgFraudScore: number;
  };
  topPhones: {
    phone: string;
    count: number;
    riskScore: number;
  }[];
}

// Update existing types to support simple verification
export interface ExtendedBusiness extends Business {
  simpleVerificationSettings?: SimpleVerificationSettings;
}

export interface ExtendedFeedbackSession extends FeedbackSession {
  verificationType: 'pos_integration' | 'simple_verification';
  simpleVerificationId?: string;
}

// Analytics types
export * from './analytics';

// Utility types
export type Nullable<T> = T | null;
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type TimestampedEntity = {
  createdAt: string;
  updatedAt: string;
};