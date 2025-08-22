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

// Utility types
export type Nullable<T> = T | null;
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type TimestampedEntity = {
  createdAt: string;
  updatedAt: string;
};