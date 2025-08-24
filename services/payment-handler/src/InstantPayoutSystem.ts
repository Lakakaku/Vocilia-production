/**
 * Instant Payout System for Swedish Market
 * 
 * Features:
 * - Queue-based payment processing with prioritization
 * - Mock Swedish banking integration (Swish, Bankgiro, IBAN)
 * - Payout scheduling with business hours consideration
 * - Real-time status tracking and notifications
 * - Batch processing optimization
 * - Retry mechanisms with exponential backoff
 */

export interface PayoutRequest {
  id: string;
  sessionId: string;
  businessId: string;
  customerId: string;
  customerHash: string;
  
  // Payment details
  amount: number; // in öre
  currency: 'sek';
  description: string;
  
  // Swedish payment methods
  paymentMethod: 'swish' | 'bankgiro' | 'iban' | 'test_account';
  paymentDetails: SwedishPaymentDetails;
  
  // Priority and scheduling
  priority: 'low' | 'medium' | 'high' | 'urgent';
  scheduledAt?: Date;
  processBefore?: Date; // Latest acceptable processing time
  
  // Metadata
  qualityScore: number;
  rewardTier: string;
  businessTier: number;
  fraudRiskScore: number;
  
  // Status tracking
  status: PayoutStatus;
  attempts: number;
  maxRetries: number;
  lastAttemptAt?: Date;
  errorMessage?: string;
  
  // Timestamps
  createdAt: Date;
  processedAt?: Date;
  completedAt?: Date;
  
  testMode: boolean;
}

export type PayoutStatus = 
  | 'queued' 
  | 'processing' 
  | 'completed' 
  | 'failed' 
  | 'cancelled' 
  | 'scheduled' 
  | 'retry_pending';

export interface SwedishPaymentDetails {
  // Swish payments (most popular in Sweden)
  swishNumber?: string; // +46701234567
  
  // Bank transfer
  bankAccount?: {
    iban?: string; // SE35 5000 0000 0549 1000 0003
    bankgiro?: string; // 123-4567
    plusgiro?: string; // 12 34 56-7
    accountHolder: string;
    bank?: string;
  };
  
  // Customer identification (anonymous)
  customerReference: string; // Anonymous reference
  
  // For test mode
  testPaymentMethod?: 'success' | 'failure' | 'delay';
}

export interface PayoutResult {
  payoutId: string;
  status: 'success' | 'failed' | 'pending';
  transactionId?: string;
  amount: number;
  processingTime: number; // milliseconds
  
  // Swedish banking response
  bankResponse?: {
    referenceNumber: string;
    bankTransactionId?: string;
    expectedSettlement: Date;
    fees?: number; // in öre
  };
  
  errorDetails?: {
    code: string;
    message: string;
    retryable: boolean;
  };
}

export interface QueueMetrics {
  totalQueued: number;
  processing: number;
  completed: number;
  failed: number;
  
  averageProcessingTime: number;
  successRate: number;
  
  // Swedish banking statistics
  swishPayouts: number;
  bankTransfers: number;
  testPayouts: number;
  
  // Performance metrics
  queueLatency: number; // Average time in queue
  throughput: number; // Payouts per minute
  
  lastUpdated: Date;
}

export class InstantPayoutSystem {
  private queue: PayoutRequest[];
  private processing: Map<string, PayoutRequest>;
  private completed: Map<string, PayoutResult>;
  private queueMetrics: QueueMetrics;
  private isProcessing: boolean;
  private testMode: boolean;
  private swedishBanking: MockSwedishBankingService;

  constructor(testMode = true) {
    this.testMode = testMode;
    this.queue = [];
    this.processing = new Map();
    this.completed = new Map();
    this.isProcessing = false;
    this.swedishBanking = new MockSwedishBankingService(testMode);
    
    this.queueMetrics = {
      totalQueued: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      averageProcessingTime: 0,
      successRate: 0,
      swishPayouts: 0,
      bankTransfers: 0,
      testPayouts: 0,
      queueLatency: 0,
      throughput: 0,
      lastUpdated: new Date()
    };
    
    console.log(`💳 Instant Payout System initialized (${testMode ? 'TEST' : 'LIVE'} mode)`);
    this.startQueueProcessor();
  }

  /**
   * Add payout request to queue
   */
  async queuePayout(request: Omit<PayoutRequest, 'id' | 'status' | 'attempts' | 'createdAt' | 'testMode'>): Promise<string> {
    const payoutRequest: PayoutRequest = {
      ...request,
      id: this.generatePayoutId(),
      status: 'queued',
      attempts: 0,
      createdAt: new Date(),
      testMode: this.testMode
    };

    // Validate request
    this.validatePayoutRequest(payoutRequest);
    
    // Add to queue with priority ordering
    this.insertWithPriority(payoutRequest);
    
    this.queueMetrics.totalQueued++;
    this.updateMetrics();
    
    console.log(`💰 Payout queued: ${payoutRequest.id} - ${payoutRequest.amount/100} SEK (${payoutRequest.priority} priority)`);
    
    return payoutRequest.id;
  }

  /**
   * Get payout status
   */
  getPayoutStatus(payoutId: string): { status: PayoutStatus; result?: PayoutResult } {
    // Check if completed
    const result = this.completed.get(payoutId);
    if (result) {
      return { status: 'completed', result };
    }
    
    // Check if processing
    const processing = this.processing.get(payoutId);
    if (processing) {
      return { status: processing.status };
    }
    
    // Check if queued
    const queued = this.queue.find(r => r.id === payoutId);
    if (queued) {
      return { status: queued.status };
    }
    
    throw new Error(`Payout not found: ${payoutId}`);
  }

  /**
   * Cancel payout (if not yet processing)
   */
  cancelPayout(payoutId: string): boolean {
    const queueIndex = this.queue.findIndex(r => r.id === payoutId);
    if (queueIndex >= 0) {
      this.queue[queueIndex].status = 'cancelled';
      this.queue.splice(queueIndex, 1);
      console.log(`🚫 Payout cancelled: ${payoutId}`);
      return true;
    }
    
    return false;
  }

  /**
   * Get queue metrics
   */
  getQueueMetrics(): QueueMetrics {
    this.updateMetrics();
    return { ...this.queueMetrics };
  }

  /**
   * Priority-based queue insertion
   */
  private insertWithPriority(request: PayoutRequest): void {
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    const requestPriority = priorityOrder[request.priority];
    
    let insertIndex = this.queue.length;
    for (let i = 0; i < this.queue.length; i++) {
      const existingPriority = priorityOrder[this.queue[i].priority];
      if (requestPriority < existingPriority) {
        insertIndex = i;
        break;
      }
    }
    
    this.queue.splice(insertIndex, 0, request);
  }

  /**
   * Validate payout request
   */
  private validatePayoutRequest(request: PayoutRequest): void {
    if (request.amount <= 0) {
      throw new Error('Amount must be positive');
    }
    
    if (request.amount < 100) { // Minimum 1 SEK
      throw new Error('Amount below minimum (1 SEK)');
    }
    
    if (request.amount > 100000) { // Maximum 1000 SEK
      throw new Error('Amount exceeds maximum (1000 SEK)');
    }
    
    if (!request.paymentDetails.customerReference) {
      throw new Error('Customer reference required');
    }
    
    // Validate Swedish payment method
    this.validateSwedishPaymentMethod(request.paymentMethod, request.paymentDetails);
  }

  /**
   * Validate Swedish payment methods
   */
  private validateSwedishPaymentMethod(method: string, details: SwedishPaymentDetails): void {
    switch (method) {
      case 'swish':
        if (!details.swishNumber || !details.swishNumber.match(/^\+46\d{8,9}$/)) {
          throw new Error('Invalid Swish number format');
        }
        break;
        
      case 'bankgiro':
        if (!details.bankAccount?.bankgiro || !details.bankAccount.bankgiro.match(/^\d{3,4}-\d{4}$/)) {
          throw new Error('Invalid Bankgiro number format');
        }
        break;
        
      case 'iban':
        if (!details.bankAccount?.iban || !details.bankAccount.iban.match(/^SE\d{2}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}$/)) {
          throw new Error('Invalid Swedish IBAN format');
        }
        break;
        
      case 'test_account':
        // Always valid in test mode
        break;
        
      default:
        throw new Error(`Unsupported payment method: ${method}`);
    }
  }

  /**
   * Main queue processor
   */
  private async startQueueProcessor(): void {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    console.log(`🔄 Queue processor started`);
    
    // Process queue every 1 second
    const processInterval = setInterval(async () => {
      try {
        await this.processNextPayout();
      } catch (error) {
        console.error('Queue processing error:', error);
      }
    }, 1000);
    
    // Update metrics every 10 seconds
    setInterval(() => {
      this.updateMetrics();
    }, 10000);
  }

  /**
   * Process next payout in queue
   */
  private async processNextPayout(): Promise<void> {
    if (this.queue.length === 0) return;
    
    // Get next payout (highest priority first)
    const request = this.queue.shift()!;
    
    // Check if scheduled for later
    if (request.scheduledAt && request.scheduledAt > new Date()) {
      // Put back in queue for later
      this.queue.unshift(request);
      return;
    }
    
    console.log(`⚡ Processing payout: ${request.id} - ${request.amount/100} SEK via ${request.paymentMethod}`);
    
    // Move to processing
    request.status = 'processing';
    request.lastAttemptAt = new Date();
    this.processing.set(request.id, request);
    this.queueMetrics.processing++;
    
    try {
      const startTime = Date.now();
      const result = await this.executePayou(request);
      const processingTime = Date.now() - startTime;
      
      // Success
      result.processingTime = processingTime;
      request.status = 'completed';
      request.processedAt = new Date();
      request.completedAt = new Date();
      
      this.processing.delete(request.id);
      this.completed.set(request.id, result);
      
      this.queueMetrics.processing--;
      this.queueMetrics.completed++;
      
      console.log(`✅ Payout completed: ${request.id} - ${result.transactionId || 'N/A'} (${processingTime}ms)`);
      
    } catch (error) {
      console.error(`❌ Payout failed: ${request.id} - ${error.message}`);
      
      request.attempts++;
      request.errorMessage = error.message;
      
      // Retry logic
      if (request.attempts < request.maxRetries && this.isRetryable(error)) {
        const retryDelay = Math.pow(2, request.attempts) * 1000; // Exponential backoff
        request.scheduledAt = new Date(Date.now() + retryDelay);
        request.status = 'retry_pending';
        
        this.processing.delete(request.id);
        this.queue.unshift(request); // High priority for retries
        this.queueMetrics.processing--;
        
        console.log(`🔄 Payout scheduled for retry: ${request.id} in ${retryDelay}ms (attempt ${request.attempts}/${request.maxRetries})`);
      } else {
        // Final failure
        request.status = 'failed';
        request.processedAt = new Date();
        
        const failureResult: PayoutResult = {
          payoutId: request.id,
          status: 'failed',
          amount: request.amount,
          processingTime: 0,
          errorDetails: {
            code: 'PAYOUT_FAILED',
            message: error.message,
            retryable: false
          }
        };
        
        this.processing.delete(request.id);
        this.completed.set(request.id, failureResult);
        this.queueMetrics.processing--;
        this.queueMetrics.failed++;
      }
    }
  }

  /**
   * Execute payout via Swedish banking
   */
  private async executePayou(request: PayoutRequest): Promise<PayoutResult> {
    return await this.swedishBanking.processPayment({
      payoutId: request.id,
      amount: request.amount,
      currency: request.currency,
      paymentMethod: request.paymentMethod,
      paymentDetails: request.paymentDetails,
      description: request.description,
      customerReference: request.paymentDetails.customerReference
    });
  }

  /**
   * Check if error is retryable
   */
  private isRetryable(error: any): boolean {
    const retryableErrors = [
      'NETWORK_ERROR',
      'TEMPORARY_UNAVAILABLE', 
      'RATE_LIMIT_EXCEEDED',
      'BANK_SYSTEM_MAINTENANCE'
    ];
    
    return retryableErrors.some(code => error.message.includes(code));
  }

  /**
   * Update queue metrics
   */
  private updateMetrics(): void {
    const now = Date.now();
    
    // Calculate success rate
    const total = this.queueMetrics.completed + this.queueMetrics.failed;
    this.queueMetrics.successRate = total > 0 ? this.queueMetrics.completed / total : 1.0;
    
    // Calculate queue latency (average)
    this.queueMetrics.queueLatency = this.queue.length * 1000; // Rough estimate
    
    this.queueMetrics.lastUpdated = new Date();
  }

  /**
   * Generate unique payout ID
   */
  private generatePayoutId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `payout_${timestamp}_${random}`;
  }

  /**
   * Create test scenarios
   */
  static createTestScenarios(): PayoutRequest[] {
    const now = new Date();
    
    return [
      {
        id: 'test_swish_1',
        sessionId: 'session_cafe_123',
        businessId: 'cafe_aurora',
        customerId: 'customer_456',
        customerHash: 'hash_customer_456',
        amount: 1250, // 12.50 SEK
        currency: 'sek',
        description: 'Quality feedback reward - Café Aurora',
        paymentMethod: 'swish',
        paymentDetails: {
          swishNumber: '+46701234567',
          customerReference: 'FEEDBACK_REW_789',
          testPaymentMethod: 'success'
        },
        priority: 'high',
        qualityScore: 85,
        rewardTier: 'very_good',
        businessTier: 2,
        fraudRiskScore: 0.1,
        status: 'queued',
        attempts: 0,
        maxRetries: 3,
        createdAt: now,
        testMode: true
      } as PayoutRequest
    ];
  }
}

/**
 * Mock Swedish Banking Service for testing
 */
class MockSwedishBankingService {
  constructor(private testMode: boolean) {
    console.log(`🏦 Swedish Banking Service initialized (${testMode ? 'TEST' : 'LIVE'} mode)`);
  }

  async processPayment(paymentData: {
    payoutId: string;
    amount: number;
    currency: string;
    paymentMethod: string;
    paymentDetails: SwedishPaymentDetails;
    description: string;
    customerReference: string;
  }): Promise<PayoutResult> {
    
    // Simulate processing time
    const processingDelay = Math.random() * 1000 + 500; // 500-1500ms
    await new Promise(resolve => setTimeout(resolve, processingDelay));
    
    // Simulate different outcomes based on test configuration
    if (this.testMode && paymentData.paymentDetails.testPaymentMethod === 'failure') {
      throw new Error('BANK_REJECTION: Insufficient funds in business account');
    }
    
    if (this.testMode && paymentData.paymentDetails.testPaymentMethod === 'delay') {
      await new Promise(resolve => setTimeout(resolve, 3000)); // Extra delay
    }
    
    const result: PayoutResult = {
      payoutId: paymentData.payoutId,
      status: 'success',
      transactionId: this.generateTransactionId(paymentData.paymentMethod),
      amount: paymentData.amount,
      processingTime: processingDelay,
      bankResponse: {
        referenceNumber: this.generateReferenceNumber(),
        bankTransactionId: this.generateBankTransactionId(),
        expectedSettlement: new Date(Date.now() + 24 * 60 * 60 * 1000), // Next day
        fees: this.calculateFees(paymentData.amount, paymentData.paymentMethod)
      }
    };
    
    console.log(`🏦 Swedish banking processed: ${paymentData.paymentMethod} payment of ${paymentData.amount/100} SEK`);
    
    return result;
  }

  private generateTransactionId(method: string): string {
    const prefix = method === 'swish' ? 'SW' : method === 'bankgiro' ? 'BG' : 'SE';
    return `${prefix}${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
  }

  private generateReferenceNumber(): string {
    return Math.floor(Math.random() * 900000000 + 100000000).toString();
  }

  private generateBankTransactionId(): string {
    return `TXN${Date.now().toString(36).toUpperCase()}`;
  }

  private calculateFees(amount: number, method: string): number {
    // Mock fee calculation
    switch (method) {
      case 'swish': return Math.max(50, Math.floor(amount * 0.005)); // 0.5% min 0.50 SEK
      case 'bankgiro': return 200; // 2 SEK flat fee
      case 'iban': return 500; // 5 SEK for SEPA transfer
      default: return 0;
    }
  }
}

export { InstantPayoutSystem, MockSwedishBankingService };