import crypto from 'crypto';
import { Redis } from 'ioredis';

interface FraudCheck {
  type: string;
  score: number; // 0-1 risk score
  evidence: any;
  confidence: number; // 0-1 confidence in detection
}

interface VelocityLimit {
  customerId: string;
  limit: 'hourly' | 'daily' | 'weekly' | 'monthly';
  maxAmount: number;
  maxTransactions: number;
}

interface ATOIndicator {
  type: string;
  value: any;
  riskWeight: number;
}

interface TransactionFeatures {
  feedbackId: string;
  customerId: string;
  features: {
    purchaseAmount: number;
    qualityScore: number;
    feedbackLength: number;
    wordCount: number;
    sentimentScore: number;
    timeOfDay: string;
    dayOfWeek: string;
    deviceType: string;
    osVersion: string;
    locationAccuracy: number;
    previousFeedbacks: number;
    averageQualityScore: number;
    accountAge: number;
    businessCategory: string;
    distanceFromUsualLocation: number;
  };
}

export class PaymentSecurityService {
  private redis: Redis;
  private encryptionKey: Buffer;
  private readonly WEBHOOK_TOLERANCE = 300; // 5 minutes in seconds

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD
    });

    this.encryptionKey = Buffer.from(
      process.env.PAYMENT_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex'),
      'hex'
    );
  }

  // PCI Compliance Methods
  tokenizePaymentMethod(paymentMethod: any): string {
    // Never store sensitive payment data directly
    const token = `pm_${crypto.randomBytes(16).toString('hex')}`;
    
    // Store only non-sensitive metadata
    const metadata = {
      type: paymentMethod.type,
      last4: this.extractLast4(paymentMethod),
      created: new Date().toISOString()
    };

    // Store encrypted reference
    const encrypted = this.encrypt(JSON.stringify(metadata));
    this.redis.setex(`token:${token}`, 3600, encrypted); // Expire in 1 hour

    return token;
  }

  private extractLast4(paymentMethod: any): string {
    if (paymentMethod.account_number) {
      return paymentMethod.account_number.slice(-4);
    }
    if (paymentMethod.cardNumber) {
      return paymentMethod.cardNumber.slice(-4);
    }
    return '****';
  }

  private encrypt(data: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', this.encryptionKey, iv);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  private decrypt(encryptedData: string): string {
    const [ivHex, encrypted] = encryptedData.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', this.encryptionKey, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  sanitizeLogData(data: any): any {
    const sensitive = [
      'cardNumber', 'cvv', 'expiryMonth', 'expiryYear',
      'account_number', 'clearing_number', 'ssn', 'personalNumber'
    ];

    const sanitized = { ...data };
    
    for (const key of sensitive) {
      if (sanitized[key]) {
        sanitized[key] = '***REDACTED***';
      }
    }

    // Recursively sanitize nested objects
    for (const key in sanitized) {
      if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = this.sanitizeLogData(sanitized[key]);
      }
    }

    return sanitized;
  }

  enforceHTTPS(protocol: string): void {
    if (protocol !== 'https' && process.env.NODE_ENV === 'production') {
      throw new Error('HTTPS required for payment operations');
    }
  }

  generateSecureHeaders(): Record<string, string> {
    return {
      'Content-Security-Policy': "default-src 'self'; script-src 'self' https://js.stripe.com",
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    };
  }

  // Webhook Security
  validateStripeWebhook(payload: string, signature: string, secret: string): boolean {
    const elements = signature.split(',');
    let timestamp: string | undefined;
    let signatures: string[] = [];

    for (const element of elements) {
      const [key, value] = element.split('=');
      if (key === 't') {
        timestamp = value;
      } else if (key === 'v1') {
        signatures.push(value);
      }
    }

    if (!timestamp) {
      throw new Error('Invalid webhook signature: missing timestamp');
    }

    // Check timestamp tolerance
    const currentTime = Math.floor(Date.now() / 1000);
    const webhookTime = parseInt(timestamp);
    
    if (currentTime - webhookTime > this.WEBHOOK_TOLERANCE) {
      throw new Error('Webhook timestamp too old');
    }

    // Verify signature
    const signedPayload = `${timestamp}.${payload}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');

    return signatures.includes(expectedSignature);
  }

  async preventWebhookReplay(eventId: string): Promise<boolean> {
    const key = `webhook:processed:${eventId}`;
    const exists = await this.redis.get(key);
    
    if (exists) {
      return false; // Already processed
    }

    // Mark as processed with 24-hour expiry
    await this.redis.setex(key, 86400, '1');
    return true;
  }

  // Fraud Detection
  async detectFraudPattern(pattern: string, data: any): Promise<FraudCheck> {
    switch (pattern) {
      case 'rapid_successive_payouts':
        return this.detectRapidPayouts(data.requests);
      case 'unusual_amount_spike':
        return this.detectAmountSpike(data.requests);
      case 'multiple_accounts_same_device':
        return this.detectMultipleAccounts(data.requests);
      default:
        return {
          type: 'unknown',
          score: 0,
          evidence: {},
          confidence: 0
        };
    }
  }

  private async detectRapidPayouts(requests: any[]): Promise<FraudCheck> {
    const timestamps = requests.map(r => r.timestamp || Date.now());
    const intervals = [];
    
    for (let i = 1; i < timestamps.length; i++) {
      intervals.push(timestamps[i] - timestamps[i - 1]);
    }

    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    
    // If average interval is less than 5 seconds, high risk
    const riskScore = Math.min(1, 5000 / avgInterval);
    
    return {
      type: 'rapid_successive_payouts',
      score: riskScore,
      evidence: {
        requestCount: requests.length,
        averageInterval: avgInterval,
        minInterval: Math.min(...intervals)
      },
      confidence: 0.9
    };
  }

  private detectAmountSpike(requests: any[]): Promise<FraudCheck> {
    const amounts = requests.map(r => r.amount);
    const avg = amounts.slice(0, -1).reduce((a, b) => a + b, 0) / (amounts.length - 1);
    const lastAmount = amounts[amounts.length - 1];
    
    const spikeRatio = lastAmount / avg;
    const riskScore = Math.min(1, (spikeRatio - 1) / 10);
    
    return Promise.resolve({
      type: 'unusual_amount_spike',
      score: riskScore,
      evidence: {
        averageAmount: avg,
        spikeAmount: lastAmount,
        spikeRatio
      },
      confidence: 0.85
    });
  }

  private detectMultipleAccounts(requests: any[]): Promise<FraudCheck> {
    const deviceMap = new Map<string, Set<string>>();
    
    for (const request of requests) {
      const device = request.deviceFingerprint;
      const customer = request.customerId;
      
      if (!deviceMap.has(device)) {
        deviceMap.set(device, new Set());
      }
      deviceMap.get(device)!.add(customer);
    }

    let maxAccounts = 0;
    let suspiciousDevice = '';
    
    for (const [device, customers] of deviceMap.entries()) {
      if (customers.size > maxAccounts) {
        maxAccounts = customers.size;
        suspiciousDevice = device;
      }
    }

    const riskScore = Math.min(1, (maxAccounts - 1) / 5);
    
    return Promise.resolve({
      type: 'multiple_accounts_same_device',
      score: riskScore,
      evidence: {
        deviceFingerprint: suspiciousDevice,
        accountCount: maxAccounts,
        affectedCustomers: deviceMap.get(suspiciousDevice)
      },
      confidence: 0.95
    });
  }

  // Velocity Checks
  async checkVelocity(velocity: VelocityLimit): Promise<any> {
    const now = Date.now();
    const windowMs = this.getWindowMs(velocity.limit);
    const windowStart = now - windowMs;
    
    const key = `velocity:${velocity.customerId}:${velocity.limit}`;
    const transactions = await this.redis.zrangebyscore(
      key,
      windowStart,
      now,
      'WITHSCORES'
    );

    let currentAmount = 0;
    let currentTransactions = 0;
    
    for (let i = 0; i < transactions.length; i += 2) {
      const amount = parseFloat(transactions[i]);
      currentAmount += amount;
      currentTransactions++;
    }

    const limitExceeded = 
      currentAmount >= velocity.maxAmount || 
      currentTransactions >= velocity.maxTransactions;

    return {
      currentAmount,
      currentTransactions,
      limitExceeded,
      remainingAmount: Math.max(0, velocity.maxAmount - currentAmount),
      remainingTransactions: Math.max(0, velocity.maxTransactions - currentTransactions),
      resetTime: new Date(now + windowMs).toISOString()
    };
  }

  private getWindowMs(limit: string): number {
    switch (limit) {
      case 'hourly': return 60 * 60 * 1000;
      case 'daily': return 24 * 60 * 60 * 1000;
      case 'weekly': return 7 * 24 * 60 * 60 * 1000;
      case 'monthly': return 30 * 24 * 60 * 60 * 1000;
      default: return 60 * 60 * 1000;
    }
  }

  async recordTransaction(customerId: string, amount: number): Promise<void> {
    const now = Date.now();
    const limits = ['hourly', 'daily', 'weekly', 'monthly'];
    
    for (const limit of limits) {
      const key = `velocity:${customerId}:${limit}`;
      await this.redis.zadd(key, now, amount.toString());
      
      // Set expiry based on limit
      const ttl = this.getWindowMs(limit) / 1000;
      await this.redis.expire(key, ttl);
    }
  }

  // Account Takeover Detection
  async detectAccountTakeover(customerId: string, indicators: ATOIndicator[]): Promise<any> {
    let totalRisk = 0;
    let maxRisk = 0;
    const riskFactors = [];

    for (const indicator of indicators) {
      const risk = this.calculateIndicatorRisk(indicator);
      totalRisk += risk * indicator.riskWeight;
      maxRisk += indicator.riskWeight;
      
      if (risk > 0.5) {
        riskFactors.push({
          type: indicator.type,
          risk,
          value: indicator.value
        });
      }
    }

    const normalizedRisk = totalRisk / maxRisk;
    const riskLevel = this.getRiskLevel(normalizedRisk);
    
    return {
      customerId,
      riskLevel,
      riskScore: normalizedRisk,
      requiresAdditionalVerification: normalizedRisk > 0.6,
      suggestedActions: this.getSuggestedActions(normalizedRisk, riskFactors),
      riskFactors
    };
  }

  private calculateIndicatorRisk(indicator: ATOIndicator): number {
    switch (indicator.type) {
      case 'new_device':
        return 0.7;
      case 'new_location':
        return this.calculateLocationRisk(indicator.value);
      case 'unusual_time':
        return this.calculateTimeRisk(indicator.value);
      case 'changed_bank_account':
        return 0.9;
      case 'multiple_failed_verifications':
        return Math.min(1, indicator.value / 3);
      default:
        return 0;
    }
  }

  private calculateLocationRisk(location: any): number {
    // Calculate distance from Stockholm (default business location)
    const stockholmLat = 59.3293;
    const stockholmLon = 18.0686;
    
    const distance = this.calculateDistance(
      stockholmLat, 
      stockholmLon,
      location.lat,
      location.lon
    );

    // Risk increases with distance
    return Math.min(1, distance / 1000); // Max risk at 1000km
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private calculateTimeRisk(time: string): number {
    const hour = parseInt(time.split(':')[0]);
    
    // High risk between 2 AM and 5 AM
    if (hour >= 2 && hour <= 5) {
      return 0.8;
    }
    // Medium risk between 11 PM and 2 AM
    if (hour >= 23 || hour < 2) {
      return 0.5;
    }
    // Low risk during business hours
    return 0.1;
  }

  private getRiskLevel(score: number): string {
    if (score < 0.3) return 'low';
    if (score < 0.6) return 'medium';
    if (score < 0.8) return 'high';
    return 'critical';
  }

  private getSuggestedActions(riskScore: number, riskFactors: any[]): string[] {
    const actions = [];
    
    if (riskScore > 0.8) {
      actions.push('block_transaction');
      actions.push('manual_review');
    }
    
    if (riskScore > 0.6) {
      actions.push('require_2fa');
      actions.push('send_notification');
    }
    
    if (riskFactors.some(f => f.type === 'changed_bank_account')) {
      actions.push('verify_bank_account');
    }
    
    if (riskFactors.some(f => f.type === 'new_device')) {
      actions.push('device_verification');
    }
    
    return actions;
  }

  // ML Fraud Scoring
  async calculateMLFraudScore(features: TransactionFeatures): Promise<any> {
    // Simplified ML model - in production, this would use a trained model
    const weights = {
      purchaseAmount: 0.1,
      qualityScore: -0.2, // Higher quality = lower fraud
      feedbackLength: -0.1,
      wordCount: -0.1,
      sentimentScore: -0.05,
      timeRisk: 0.3,
      deviceRisk: 0.2,
      locationRisk: 0.15,
      accountAge: -0.2,
      previousFeedbacks: -0.15
    };

    let score = 0;
    const topFactors = [];

    // Calculate time risk
    const timeRisk = this.calculateTimeRisk(features.features.timeOfDay);
    score += timeRisk * weights.timeRisk;
    if (timeRisk > 0.5) {
      topFactors.push({ factor: 'unusual_time', impact: timeRisk * weights.timeRisk });
    }

    // Calculate device risk
    const deviceRisk = features.features.deviceType === 'Unknown' ? 0.8 : 0.2;
    score += deviceRisk * weights.deviceRisk;
    if (deviceRisk > 0.5) {
      topFactors.push({ factor: 'suspicious_device', impact: deviceRisk * weights.deviceRisk });
    }

    // Location risk
    const locationRisk = Math.min(1, features.features.distanceFromUsualLocation / 50);
    score += locationRisk * weights.locationRisk;
    if (locationRisk > 0.5) {
      topFactors.push({ factor: 'unusual_location', impact: locationRisk * weights.locationRisk });
    }

    // Account age benefit
    const ageBonus = Math.min(1, features.features.accountAge / 90);
    score += (1 - ageBonus) * weights.accountAge;

    // Previous feedback benefit
    const feedbackBonus = Math.min(1, features.features.previousFeedbacks / 10);
    score += (1 - feedbackBonus) * weights.previousFeedbacks;

    // Quality score benefit
    const qualityBonus = features.features.qualityScore / 100;
    score += (1 - qualityBonus) * Math.abs(weights.qualityScore);

    // Normalize score to 0-1
    const fraudProbability = Math.max(0, Math.min(1, score));
    
    // Calculate confidence based on data completeness
    const dataPoints = Object.keys(features.features).length;
    const confidence = Math.min(1, dataPoints / 15);

    // Determine recommendation
    let recommendation: string;
    if (fraudProbability < 0.3) {
      recommendation = 'approve';
    } else if (fraudProbability < 0.7) {
      recommendation = 'review';
    } else {
      recommendation = 'decline';
    }

    return {
      fraudProbability,
      confidence,
      topRiskFactors: topFactors.sort((a, b) => b.impact - a.impact).slice(0, 3),
      recommendation,
      features: features.features
    };
  }

  // Retry Mechanism
  async scheduleRetry(paymentId: string, attempt: number = 1): Promise<any> {
    const maxRetries = 5;
    const baseDelay = 1000; // 1 second
    
    if (attempt > maxRetries) {
      return {
        status: 'failed',
        message: 'Max retries exceeded'
      };
    }

    // Exponential backoff
    const delay = baseDelay * Math.pow(2, attempt - 1);
    
    const retrySchedule = [];
    for (let i = attempt; i <= maxRetries; i++) {
      const attemptDelay = baseDelay * Math.pow(2, i - 1);
      retrySchedule.push({
        attempt: i,
        delay: attemptDelay,
        scheduledAt: new Date(Date.now() + attemptDelay).toISOString()
      });
    }

    // Store retry info in Redis
    await this.redis.setex(
      `retry:${paymentId}`,
      86400, // 24 hours
      JSON.stringify({
        attempt,
        nextRetry: Date.now() + delay,
        maxRetries,
        retrySchedule
      })
    );

    return {
      status: 'pending_retry',
      currentAttempt: attempt,
      nextRetryIn: delay,
      retrySchedule
    };
  }

  // Circuit Breaker
  private circuitState: Map<string, any> = new Map();

  async checkCircuitBreaker(service: string): Promise<boolean> {
    const state = this.circuitState.get(service) || {
      failures: 0,
      lastFailure: 0,
      state: 'closed'
    };

    if (state.state === 'open') {
      const resetTime = state.lastFailure + 60000; // 1 minute reset
      if (Date.now() > resetTime) {
        state.state = 'half-open';
        state.failures = 0;
      } else {
        return false; // Circuit is open
      }
    }

    this.circuitState.set(service, state);
    return true; // Circuit is closed or half-open
  }

  async recordCircuitFailure(service: string): Promise<void> {
    const state = this.circuitState.get(service) || {
      failures: 0,
      lastFailure: 0,
      state: 'closed'
    };

    state.failures++;
    state.lastFailure = Date.now();

    if (state.failures >= 5) {
      state.state = 'open';
    }

    this.circuitState.set(service, state);
  }

  async recordCircuitSuccess(service: string): Promise<void> {
    const state = this.circuitState.get(service);
    if (state) {
      state.failures = 0;
      state.state = 'closed';
      this.circuitState.set(service, state);
    }
  }

  getCircuitBreakerStatus(service: string): any {
    const state = this.circuitState.get(service) || {
      failures: 0,
      lastFailure: 0,
      state: 'closed'
    };

    const resetTime = state.state === 'open' 
      ? new Date(state.lastFailure + 60000).toISOString()
      : null;

    return {
      service,
      state: state.state,
      failures: state.failures,
      resetTime
    };
  }
}

export const paymentSecurityService = new PaymentSecurityService();