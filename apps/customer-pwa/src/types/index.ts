// Core types needed for customer PWA deployment
export interface QRPayload {
  v: number; // version
  b: string; // businessId
  l?: string; // locationId
  t: number; // timestamp
}

export interface TransactionItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  category?: string;
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
  rewardAmount?: number;
  rewardPercentage?: number;
  status: FeedbackSessionStatus;
  errorMessage?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type FeedbackSessionStatus = 
  | 'qr_scanned' 
  | 'transaction_verified'
  | 'recording' 
  | 'processing' 
  | 'completed' 
  | 'failed' 
  | 'fraud_flagged';

export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: APIError;
}

export interface APIError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// Simple verification types for customer interface
export interface SimpleVerificationFormData {
  storeCodeOrQR: string;
  purchaseTime: {
    date: string;
    time: string;
  };
  purchaseAmount: number;
  customerPhone: string;
}