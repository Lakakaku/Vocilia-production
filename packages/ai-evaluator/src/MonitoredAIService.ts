/**
 * Monitored AI Service Wrapper
 * Wraps the existing AI service with comprehensive performance monitoring
 */

import { ModelPerformanceMonitor, PerformanceMetrics } from './ModelPerformanceMonitor';
import { SystemResourceMonitor } from './SystemResourceMonitor';
import { EventEmitter } from 'events';

export interface AIServiceConfig {
  model: string;
  provider: 'ollama' | 'openai' | 'anthropic';
  endpoint?: string;
  apiKey?: string;
  timeout?: number;
}

export interface FeedbackEvaluationRequest {
  transcript: string;
  businessContext: any;
  purchaseItems?: string[];
  sessionId: string;
  businessId: string;
  language?: string;
  audioLength?: number;
}

export interface FeedbackEvaluationResult {
  qualityScore: {
    total: number;
    authenticity: number;
    concreteness: number;
    depth: number;
  };
  confidence: number;
  reasoning: string;
  categories: string[];
  sentiment: number;
  recommendations?: string[];
  processingTimeMs: number;
}

export interface AIConversationRequest {
  userInput: string;
  conversationHistory: string[];
  businessContext: any;
  sessionId: string;
  businessId: string;
  language?: string;
}

export interface AIConversationResult {
  response: string;
  confidence: number;
  shouldContinue: boolean;
  suggestedFollowUp?: string;
  processingTimeMs: number;
}

/**
 * AI Service wrapper that adds comprehensive performance monitoring
 */
export class MonitoredAIService extends EventEmitter {
  private performanceMonitor: ModelPerformanceMonitor;
  private resourceMonitor: SystemResourceMonitor;
  private aiService: any; // The underlying AI service
  private config: AIServiceConfig;
  
  constructor(
    aiService: any,
    config: AIServiceConfig,
    monitorConfig?: {
      enableAlerts?: boolean;
      maxMetricsInMemory?: number;
      metricsFilePath?: string;
    }
  ) {
    super();
    
    this.aiService = aiService;
    this.config = config;
    
    // Initialize monitoring systems
    this.performanceMonitor = new ModelPerformanceMonitor({
      alertsEnabled: monitorConfig?.enableAlerts !== false,
      maxMetricsInMemory: monitorConfig?.maxMetricsInMemory,
      metricsFilePath: monitorConfig?.metricsFilePath
    });
    
    this.resourceMonitor = new SystemResourceMonitor();
    
    // Forward monitoring events
    this.performanceMonitor.on('alert', (alert) => this.emit('alert', alert));
    this.performanceMonitor.on('healthReport', (report) => this.emit('healthReport', report));
    
    // Start resource monitoring
    this.resourceMonitor.start();
    
    console.log(`MonitoredAIService initialized with ${config.provider} (${config.model})`);
  }

  /**
   * Evaluate feedback quality with performance monitoring
   */
  async evaluateFeedback(request: FeedbackEvaluationRequest): Promise<FeedbackEvaluationResult> {
    const startTime = Date.now();
    const sessionStart = process.hrtime.bigint();
    let result: FeedbackEvaluationResult;
    let error: Error | undefined;
    
    // Get initial system resources
    const initialResources = await this.resourceMonitor.getCurrentResources();
    
    try {
      // Call the underlying AI service
      result = await this.aiService.evaluateFeedback(request);
      
      // Calculate processing time
      result.processingTimeMs = Date.now() - startTime;
      
    } catch (err) {
      error = err instanceof Error ? err : new Error(String(err));
      
      // Create fallback result for error case
      result = {
        qualityScore: { total: 0, authenticity: 0, concreteness: 0, depth: 0 },
        confidence: 0,
        reasoning: 'Evaluation failed due to system error',
        categories: [],
        sentiment: 0,
        processingTimeMs: Date.now() - startTime
      };
    }
    
    // Get final system resources
    const finalResources = await this.resourceMonitor.getCurrentResources();
    
    // Calculate metrics
    const sessionEnd = process.hrtime.bigint();
    const totalTimeNs = Number(sessionEnd - sessionStart);
    const totalTimeMs = totalTimeNs / 1_000_000;
    
    // Create performance metric
    const metric: PerformanceMetrics = {
      // Timing metrics
      responseTime: result.processingTimeMs,
      processingTime: result.processingTimeMs,
      queueTime: 0, // Would need queue monitoring
      totalTime: totalTimeMs,
      
      // Quality metrics
      confidenceScore: result.confidence,
      qualityScore: result.qualityScore.total,
      authenticityScore: result.qualityScore.authenticity,
      concretenessScore: result.qualityScore.concreteness,
      depthScore: result.qualityScore.depth,
      
      // System metrics (average of initial and final)
      memoryUsage: (initialResources.memoryUsageMB + finalResources.memoryUsageMB) / 2,
      cpuUsage: (initialResources.cpuPercentage + finalResources.cpuPercentage) / 2,
      gpuUsage: initialResources.gpuPercentage && finalResources.gpuPercentage 
        ? (initialResources.gpuPercentage + finalResources.gpuPercentage) / 2 
        : undefined,
      tokenCount: this.estimateTokenCount(request.transcript + (result.reasoning || '')),
      
      // Context
      language: request.language || 'sv',
      audioLength: request.audioLength || 0,
      sessionId: request.sessionId,
      businessId: request.businessId,
      timestamp: new Date(),
      
      // Error tracking
      errorType: error?.name,
      errorMessage: error?.message,
      recoveryAttempts: 0
    };
    
    // Record the metric
    await this.performanceMonitor.recordMetric(metric);
    
    // Emit monitoring event
    this.emit('evaluation', {
      request,
      result,
      metric,
      error
    });
    
    if (error) {
      throw error;
    }
    
    return result;
  }

  /**
   * Generate AI conversation response with performance monitoring
   */
  async generateResponse(request: AIConversationRequest): Promise<AIConversationResult> {
    const startTime = Date.now();
    const sessionStart = process.hrtime.bigint();
    let result: AIConversationResult;
    let error: Error | undefined;
    
    // Get initial system resources
    const initialResources = await this.resourceMonitor.getCurrentResources();
    
    try {
      // Call the underlying AI service
      result = await this.aiService.generateResponse(request);
      
      // Calculate processing time
      result.processingTimeMs = Date.now() - startTime;
      
    } catch (err) {
      error = err instanceof Error ? err : new Error(String(err));
      
      // Create fallback result for error case
      result = {
        response: 'Jag ber om ursäkt, men jag har tekniska problem just nu. Kan du försöka igen?',
        confidence: 0,
        shouldContinue: false,
        processingTimeMs: Date.now() - startTime
      };
    }
    
    // Get final system resources
    const finalResources = await this.resourceMonitor.getCurrentResources();
    
    // Calculate metrics
    const sessionEnd = process.hrtime.bigint();
    const totalTimeNs = Number(sessionEnd - sessionStart);
    const totalTimeMs = totalTimeNs / 1_000_000;
    
    // Create performance metric (simplified for conversation)
    const metric: PerformanceMetrics = {
      // Timing metrics
      responseTime: result.processingTimeMs,
      processingTime: result.processingTimeMs,
      queueTime: 0,
      totalTime: totalTimeMs,
      
      // Quality metrics (estimated for conversation)
      confidenceScore: result.confidence,
      qualityScore: result.confidence * 100, // Convert confidence to 0-100 scale
      authenticityScore: result.confidence * 100,
      concretenessScore: result.confidence * 100,
      depthScore: result.confidence * 100,
      
      // System metrics
      memoryUsage: (initialResources.memoryUsageMB + finalResources.memoryUsageMB) / 2,
      cpuUsage: (initialResources.cpuPercentage + finalResources.cpuPercentage) / 2,
      gpuUsage: initialResources.gpuPercentage && finalResources.gpuPercentage 
        ? (initialResources.gpuPercentage + finalResources.gpuPercentage) / 2 
        : undefined,
      tokenCount: this.estimateTokenCount(request.userInput + result.response),
      
      // Context
      language: request.language || 'sv',
      audioLength: 0, // Not applicable for conversation
      sessionId: request.sessionId,
      businessId: request.businessId,
      timestamp: new Date(),
      
      // Error tracking
      errorType: error?.name,
      errorMessage: error?.message,
      recoveryAttempts: 0
    };
    
    // Record the metric
    await this.performanceMonitor.recordMetric(metric);
    
    // Emit monitoring event
    this.emit('conversation', {
      request,
      result,
      metric,
      error
    });
    
    if (error) {
      throw error;
    }
    
    return result;
  }

  /**
   * Get comprehensive system status
   */
  async getSystemStatus() {
    const [performanceStatus, resourceStatus, systemInfo] = await Promise.all([
      this.performanceMonitor.getSystemStatus(),
      this.resourceMonitor.isSystemUnderStress(),
      this.resourceMonitor.getSystemInfo()
    ]);
    
    return {
      performance: performanceStatus,
      resources: resourceStatus,
      system: systemInfo,
      aiService: {
        provider: this.config.provider,
        model: this.config.model,
        endpoint: this.config.endpoint
      },
      timestamp: new Date()
    };
  }

  /**
   * Generate performance report
   */
  async generatePerformanceReport(startDate: Date, endDate: Date) {
    return await this.performanceMonitor.generateReport(startDate, endDate);
  }

  /**
   * Update monitoring configuration
   */
  updateMonitoringConfig(config: {
    alertThresholds?: any;
    enableAlerts?: boolean;
    resourceMonitoringInterval?: number;
  }) {
    if (config.resourceMonitoringInterval) {
      this.resourceMonitor.stop();
      this.resourceMonitor = new SystemResourceMonitor(config.resourceMonitoringInterval);
      this.resourceMonitor.start();
    }
    
    // Could update other monitoring configs here
    console.log('Monitoring configuration updated');
  }

  /**
   * Check if AI service is healthy and responding
   */
  async healthCheck(): Promise<{
    isHealthy: boolean;
    responseTimeMs: number;
    error?: string;
  }> {
    const startTime = Date.now();
    
    try {
      // Try a simple test request
      const testResult = await this.aiService.evaluateFeedback({
        transcript: 'Test feedback for health check',
        businessContext: { type: 'test' },
        sessionId: 'health-check',
        businessId: 'test',
        language: 'sv'
      });
      
      const responseTime = Date.now() - startTime;
      
      return {
        isHealthy: testResult && responseTime < 10000, // 10 second timeout
        responseTimeMs: responseTime
      };
      
    } catch (error) {
      return {
        isHealthy: false,
        responseTimeMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Estimate token count for text (rough approximation)
   */
  private estimateTokenCount(text: string): number {
    // Rough estimate: ~4 characters per token for English/Swedish
    return Math.ceil(text.length / 4);
  }

  /**
   * Shutdown monitoring and persist final metrics
   */
  async shutdown(): Promise<void> {
    this.resourceMonitor.stop();
    await this.performanceMonitor.close();
    console.log('MonitoredAIService shutdown complete');
  }
}