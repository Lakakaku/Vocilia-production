import { EventEmitter } from 'events';
import { Redis } from 'ioredis';
import type {
  SessionData,
  GeographicPattern,
  TemporalPattern,
  PatternDetectionResult,
  BusinessContext,
  RealTimeAnalytics,
  StreamingConfig,
  DataQualityMetrics,
  ProcessingMetrics,
  PipelineStage,
  DataBuffer,
  BatchProcessingResult
} from '@feedback-platform/shared-types';

import { GeographicAnalyzer } from './GeographicAnalyzer';
import { TemporalAnalyzer } from './TemporalAnalyzer';
import { PatternDetection } from './PatternDetection';
import { CorrelationEngine } from './CorrelationEngine';
import { PredictiveModeling } from './PredictiveModeling';

interface PipelineConfig {
  batchSize: number;
  processingInterval: number; // milliseconds
  retentionPeriod: number; // days
  enableRealTimeProcessing: boolean;
  enablePredictiveAnalysis: boolean;
  qualityThresholds: {
    minSessionDuration: number;
    minTranscriptLength: number;
    maxProcessingLatency: number;
  };
  scaling: {
    maxConcurrentJobs: number;
    memoryThreshold: number; // MB
    cpuThreshold: number; // percentage
  };
  persistence: {
    saveRawData: boolean;
    saveProcessedResults: boolean;
    compressionEnabled: boolean;
  };
}

interface PipelineMetrics {
  totalProcessed: number;
  successRate: number;
  averageLatency: number;
  currentThroughput: number;
  errorCount: number;
  memoryUsage: number;
  cpuUsage: number;
  queueDepth: number;
  lastProcessedTimestamp: Date;
}

interface ProcessingJob {
  id: string;
  type: 'session_analysis' | 'batch_processing' | 'model_training' | 'prediction';
  data: any;
  priority: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  retryCount: number;
  maxRetries: number;
  timeout: number;
}

interface QueueStatus {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  retrying: number;
}

export class DataPipeline extends EventEmitter {
  private config: PipelineConfig;
  private redis: Redis;
  private processing: boolean = false;
  private metrics: PipelineMetrics;
  private jobQueue: ProcessingJob[] = [];
  private activeJobs: Map<string, ProcessingJob> = new Map();
  private dataBuffer: DataBuffer = { sessions: [], maxSize: 1000 };
  
  // Analytics components
  private geographicAnalyzer: GeographicAnalyzer;
  private temporalAnalyzer: TemporalAnalyzer;
  private patternDetection: PatternDetection;
  private correlationEngine: CorrelationEngine;
  private predictiveModeling: PredictiveModeling;

  // Processing stages
  private stages: Map<string, PipelineStage> = new Map();

  constructor(config: Partial<PipelineConfig> = {}, redisConnection?: Redis) {
    super();

    this.config = {
      batchSize: 50,
      processingInterval: 5000, // 5 seconds
      retentionPeriod: 90, // 90 days
      enableRealTimeProcessing: true,
      enablePredictiveAnalysis: true,
      qualityThresholds: {
        minSessionDuration: 5, // 5 seconds
        minTranscriptLength: 10, // 10 characters
        maxProcessingLatency: 30000 // 30 seconds
      },
      scaling: {
        maxConcurrentJobs: 10,
        memoryThreshold: 512, // 512 MB
        cpuThreshold: 80 // 80%
      },
      persistence: {
        saveRawData: true,
        saveProcessedResults: true,
        compressionEnabled: true
      },
      ...config
    };

    // Initialize Redis connection
    this.redis = redisConnection || new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3
    });

    // Initialize metrics
    this.metrics = {
      totalProcessed: 0,
      successRate: 1.0,
      averageLatency: 0,
      currentThroughput: 0,
      errorCount: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      queueDepth: 0,
      lastProcessedTimestamp: new Date()
    };

    // Initialize analytics components
    this.geographicAnalyzer = new GeographicAnalyzer();
    this.temporalAnalyzer = new TemporalAnalyzer();
    this.patternDetection = new PatternDetection();
    this.correlationEngine = new CorrelationEngine();
    this.predictiveModeling = new PredictiveModeling();

    this.initializePipelineStages();
    this.setupEventHandlers();
  }

  /**
   * Initialize the data processing pipeline
   */
  async initialize(): Promise<void> {
    console.log('🚀 Initializing analytics data pipeline...');

    try {
      // Test Redis connection
      await this.redis.ping();
      console.log('✅ Redis connection established');

      // Initialize processing stages
      await this.initializeStages();

      // Start background processing
      if (this.config.enableRealTimeProcessing) {
        this.startRealTimeProcessing();
      }

      // Start metrics collection
      this.startMetricsCollection();

      console.log('✅ Analytics pipeline initialized successfully');
      this.emit('pipeline:initialized');

    } catch (error) {
      console.error('❌ Failed to initialize pipeline:', error);
      this.emit('pipeline:error', error);
      throw error;
    }
  }

  /**
   * Process a single session in real-time
   */
  async processSession(session: SessionData, businessContext?: BusinessContext): Promise<RealTimeAnalytics> {
    const startTime = Date.now();
    const jobId = `session_${session.id}_${Date.now()}`;

    try {
      // Validate session data quality
      const qualityCheck = this.validateSessionQuality(session);
      if (!qualityCheck.isValid) {
        throw new Error(`Session quality validation failed: ${qualityCheck.reason}`);
      }

      // Add to buffer for batch processing
      this.addToBuffer(session);

      // Real-time analysis
      const results = await Promise.allSettled([
        this.geographicAnalyzer.analyzeSession({
          sessionId: session.id,
          location: session.location,
          timestamp: new Date(session.timestamp),
          businessId: session.businessId,
          customerHash: session.customerHash
        }),
        this.temporalAnalyzer.analyzeSession({
          sessionId: session.id,
          timestamp: new Date(session.timestamp),
          businessId: session.businessId,
          customerHash: session.customerHash,
          duration: session.audioDurationSeconds || 0,
          qualityScore: session.qualityScore || 0
        }),
        this.patternDetection.analyzeSession(session, await this.getReferenceSessions(session.businessId, 100))
      ]);

      const processingTime = Date.now() - startTime;
      
      // Compile real-time analytics results
      const analytics: RealTimeAnalytics = {
        sessionId: session.id,
        businessId: session.businessId,
        timestamp: new Date(),
        geographic: results[0].status === 'fulfilled' ? results[0].value : null,
        temporal: results[1].status === 'fulfilled' ? results[1].value : null,
        patterns: results[2].status === 'fulfilled' ? results[2].value : null,
        correlations: null, // Would be calculated in batch processing
        anomalyScore: this.calculateOverallAnomalyScore(results),
        riskLevel: this.determineRiskLevel(results),
        processingMetrics: {
          latency: processingTime,
          stagesCompleted: results.filter(r => r.status === 'fulfilled').length,
          errorCount: results.filter(r => r.status === 'rejected').length
        },
        qualityMetrics: qualityCheck.metrics
      };

      // Update pipeline metrics
      this.updateMetrics(processingTime, true);

      // Emit events for downstream processing
      this.emit('session:processed', analytics);

      // Store results if configured
      if (this.config.persistence.saveProcessedResults) {
        await this.storeResults(jobId, analytics);
      }

      return analytics;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updateMetrics(processingTime, false);
      
      console.error(`Session processing failed for ${session.id}:`, error);
      this.emit('session:error', { sessionId: session.id, error });
      
      throw error;
    }
  }

  /**
   * Process batch of sessions for deeper analysis
   */
  async processBatch(sessions: SessionData[], businessContext?: BusinessContext): Promise<BatchProcessingResult> {
    if (sessions.length === 0) {
      return { processed: 0, insights: [], errors: [] };
    }

    const startTime = Date.now();
    const jobId = `batch_${Date.now()}`;

    try {
      console.log(`🔄 Processing batch of ${sessions.length} sessions...`);

      // Filter valid sessions
      const validSessions = sessions.filter(s => this.validateSessionQuality(s).isValid);
      
      // Parallel processing of different analysis types
      const [
        geographicPatterns,
        temporalPatterns,
        correlationInsights,
        predictiveAnalysis
      ] = await Promise.allSettled([
        this.geographicAnalyzer.identifyPatterns(validSessions),
        this.temporalAnalyzer.identifyTemporalPatterns(validSessions),
        this.correlationEngine.analyzeMultiDimensionalCorrelations(validSessions, businessContext),
        this.config.enablePredictiveAnalysis ? 
          this.predictiveModeling.generateBusinessForecast(
            businessContext?.businessId || 'unknown',
            30, // 30-day forecast
            businessContext
          ) : null
      ]);

      const processingTime = Date.now() - startTime;

      const result: BatchProcessingResult = {
        processed: validSessions.length,
        processingTimeMs: processingTime,
        insights: [],
        patterns: {
          geographic: geographicPatterns.status === 'fulfilled' ? geographicPatterns.value : [],
          temporal: temporalPatterns.status === 'fulfilled' ? temporalPatterns.value : [],
          correlations: correlationInsights.status === 'fulfilled' ? correlationInsights.value : null
        },
        predictions: predictiveAnalysis && predictiveAnalysis.status === 'fulfilled' ? 
          predictiveAnalysis.value : null,
        errors: [],
        metadata: {
          batchId: jobId,
          processedAt: new Date(),
          validSessionCount: validSessions.length,
          totalSessionCount: sessions.length,
          qualityRate: validSessions.length / sessions.length
        }
      };

      // Generate actionable insights
      result.insights = this.generateBatchInsights(result);

      // Store batch results
      if (this.config.persistence.saveProcessedResults) {
        await this.storeBatchResults(jobId, result);
      }

      console.log(`✅ Batch processing completed: ${validSessions.length} sessions in ${processingTime}ms`);
      this.emit('batch:processed', result);

      return result;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error('Batch processing failed:', error);
      this.emit('batch:error', { jobId, error });
      
      return {
        processed: 0,
        processingTimeMs: processingTime,
        insights: [],
        errors: [{ message: error instanceof Error ? error.message : 'Unknown error', timestamp: new Date() }],
        metadata: {
          batchId: jobId,
          processedAt: new Date(),
          validSessionCount: 0,
          totalSessionCount: sessions.length,
          qualityRate: 0
        }
      };
    }
  }

  /**
   * Get real-time pipeline status and metrics
   */
  getStatus(): {
    isProcessing: boolean;
    metrics: PipelineMetrics;
    queueStatus: QueueStatus;
    bufferStatus: { size: number; maxSize: number };
    stageStatus: Array<{ name: string; status: string; lastProcessed: Date }>;
  } {
    const queueStatus: QueueStatus = {
      pending: this.jobQueue.filter(j => !this.activeJobs.has(j.id)).length,
      processing: this.activeJobs.size,
      completed: this.metrics.totalProcessed,
      failed: this.metrics.errorCount,
      retrying: this.jobQueue.filter(j => j.retryCount > 0).length
    };

    const stageStatus = Array.from(this.stages.entries()).map(([name, stage]) => ({
      name,
      status: stage.status,
      lastProcessed: stage.lastProcessed
    }));

    return {
      isProcessing: this.processing,
      metrics: { ...this.metrics },
      queueStatus,
      bufferStatus: {
        size: this.dataBuffer.sessions.length,
        maxSize: this.dataBuffer.maxSize
      },
      stageStatus
    };
  }

  /**
   * Trigger manual batch processing of buffered data
   */
  async processPendingData(): Promise<BatchProcessingResult> {
    if (this.dataBuffer.sessions.length === 0) {
      return { processed: 0, insights: [], errors: [] } as BatchProcessingResult;
    }

    const sessionsToProcess = [...this.dataBuffer.sessions];
    this.dataBuffer.sessions = []; // Clear buffer

    return await this.processBatch(sessionsToProcess);
  }

  /**
   * Shutdown pipeline gracefully
   */
  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down analytics pipeline...');
    
    this.processing = false;
    
    // Wait for active jobs to complete (with timeout)
    const timeout = 30000; // 30 seconds
    const startTime = Date.now();
    
    while (this.activeJobs.size > 0 && (Date.now() - startTime) < timeout) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Close Redis connection
    if (this.redis) {
      await this.redis.disconnect();
    }

    console.log('✅ Pipeline shutdown completed');
    this.emit('pipeline:shutdown');
  }

  /**
   * Private helper methods
   */
  private initializePipelineStages(): void {
    const stageDefinitions = [
      { name: 'validation', description: 'Data quality validation' },
      { name: 'geographic', description: 'Geographic pattern analysis' },
      { name: 'temporal', description: 'Temporal pattern analysis' },
      { name: 'patterns', description: 'Anomaly pattern detection' },
      { name: 'correlations', description: 'Multi-dimensional correlation analysis' },
      { name: 'predictions', description: 'Predictive modeling' },
      { name: 'persistence', description: 'Results storage' }
    ];

    stageDefinitions.forEach(stage => {
      this.stages.set(stage.name, {
        name: stage.name,
        description: stage.description,
        status: 'idle',
        lastProcessed: new Date(),
        processedCount: 0,
        errorCount: 0,
        averageLatency: 0
      });
    });
  }

  private async initializeStages(): Promise<void> {
    // Initialize each analytics component
    await Promise.all([
      this.geographicAnalyzer.initialize?.(),
      this.temporalAnalyzer.initialize?.(),
      this.patternDetection.initialize?.()
    ].filter(Boolean));
  }

  private setupEventHandlers(): void {
    // Handle Redis connection events
    this.redis.on('error', (error) => {
      console.error('Redis connection error:', error);
      this.emit('pipeline:error', error);
    });

    this.redis.on('connect', () => {
      console.log('Redis connection established');
    });

    // Handle memory pressure
    process.on('warning', (warning) => {
      if (warning.name === 'MaxListenersExceededWarning') {
        console.warn('Memory warning:', warning.message);
        this.emit('pipeline:memory_warning', warning);
      }
    });
  }

  private startRealTimeProcessing(): void {
    this.processing = true;
    
    const processInterval = setInterval(async () => {
      if (!this.processing) {
        clearInterval(processInterval);
        return;
      }

      try {
        // Process buffered data when batch size is reached
        if (this.dataBuffer.sessions.length >= this.config.batchSize) {
          await this.processPendingData();
        }

        // Process queued jobs
        await this.processJobQueue();

        // Update system metrics
        await this.updateSystemMetrics();

      } catch (error) {
        console.error('Real-time processing error:', error);
        this.emit('pipeline:processing_error', error);
      }
    }, this.config.processingInterval);
  }

  private startMetricsCollection(): void {
    setInterval(() => {
      this.metrics.queueDepth = this.jobQueue.length + this.activeJobs.size;
      this.emit('pipeline:metrics_updated', this.metrics);
    }, 10000); // Update metrics every 10 seconds
  }

  private validateSessionQuality(session: SessionData): { isValid: boolean; reason?: string; metrics: DataQualityMetrics } {
    const metrics: DataQualityMetrics = {
      completeness: 0,
      accuracy: 0,
      consistency: 0,
      timeliness: 0
    };

    // Check minimum duration
    if ((session.audioDurationSeconds || 0) < this.config.qualityThresholds.minSessionDuration) {
      return { 
        isValid: false, 
        reason: 'Session duration too short', 
        metrics 
      };
    }

    // Check transcript length
    if ((session.transcript?.length || 0) < this.config.qualityThresholds.minTranscriptLength) {
      return { 
        isValid: false, 
        reason: 'Transcript too short', 
        metrics 
      };
    }

    // Check required fields
    if (!session.id || !session.businessId || !session.timestamp) {
      return { 
        isValid: false, 
        reason: 'Missing required fields', 
        metrics 
      };
    }

    // Calculate quality metrics
    metrics.completeness = this.calculateCompleteness(session);
    metrics.accuracy = this.calculateAccuracy(session);
    metrics.consistency = this.calculateConsistency(session);
    metrics.timeliness = this.calculateTimeliness(session);

    return { isValid: true, metrics };
  }

  private addToBuffer(session: SessionData): void {
    this.dataBuffer.sessions.push(session);
    
    // Remove oldest sessions if buffer is full
    if (this.dataBuffer.sessions.length > this.dataBuffer.maxSize) {
      this.dataBuffer.sessions = this.dataBuffer.sessions.slice(-this.dataBuffer.maxSize);
    }
  }

  private async getReferenceSessions(businessId: string, count: number): Promise<SessionData[]> {
    // This would typically query a database
    // For now, return from buffer or Redis cache
    const cacheKey = `reference_sessions:${businessId}`;
    
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      console.warn('Failed to get cached reference sessions:', error);
    }

    // Return from current buffer as fallback
    return this.dataBuffer.sessions
      .filter(s => s.businessId === businessId)
      .slice(-count);
  }

  private calculateOverallAnomalyScore(results: PromiseSettledResult<any>[]): number {
    const scores: number[] = [];
    
    results.forEach(result => {
      if (result.status === 'fulfilled' && result.value?.anomalyScore) {
        scores.push(result.value.anomalyScore);
      }
    });

    return scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;
  }

  private determineRiskLevel(results: PromiseSettledResult<any>[]): 'low' | 'medium' | 'high' {
    const anomalyScore = this.calculateOverallAnomalyScore(results);
    
    if (anomalyScore > 0.7) return 'high';
    if (anomalyScore > 0.4) return 'medium';
    return 'low';
  }

  private updateMetrics(processingTime: number, success: boolean): void {
    this.metrics.totalProcessed++;
    this.metrics.averageLatency = (this.metrics.averageLatency * (this.metrics.totalProcessed - 1) + processingTime) / this.metrics.totalProcessed;
    
    if (!success) {
      this.metrics.errorCount++;
    }
    
    this.metrics.successRate = (this.metrics.totalProcessed - this.metrics.errorCount) / this.metrics.totalProcessed;
    this.metrics.lastProcessedTimestamp = new Date();
  }

  private async storeResults(jobId: string, analytics: RealTimeAnalytics): Promise<void> {
    try {
      const key = `analytics:session:${analytics.sessionId}`;
      const data = JSON.stringify(analytics);
      
      if (this.config.persistence.compressionEnabled) {
        // In production, you'd use compression library like zlib
        await this.redis.setex(key, 86400, data); // 24 hour TTL
      } else {
        await this.redis.setex(key, 86400, data);
      }
    } catch (error) {
      console.error('Failed to store results:', error);
    }
  }

  private async storeBatchResults(jobId: string, result: BatchProcessingResult): Promise<void> {
    try {
      const key = `analytics:batch:${jobId}`;
      const data = JSON.stringify(result);
      await this.redis.setex(key, 7 * 86400, data); // 7 day TTL
    } catch (error) {
      console.error('Failed to store batch results:', error);
    }
  }

  private generateBatchInsights(result: BatchProcessingResult): Array<{ title: string; description: string; impact: 'high' | 'medium' | 'low' }> {
    const insights = [];

    // Geographic insights
    if (result.patterns?.geographic && result.patterns.geographic.length > 0) {
      const highRiskPatterns = result.patterns.geographic.filter(p => p.riskLevel === 'high');
      if (highRiskPatterns.length > 0) {
        insights.push({
          title: 'High-Risk Geographic Patterns Detected',
          description: `Found ${highRiskPatterns.length} high-risk location patterns requiring attention`,
          impact: 'high' as const
        });
      }
    }

    // Temporal insights
    if (result.patterns?.temporal && result.patterns.temporal.length > 0) {
      const unusualPatterns = result.patterns.temporal.filter(p => p.type === 'unusual_hours' || p.type === 'burst_activity');
      if (unusualPatterns.length > 0) {
        insights.push({
          title: 'Unusual Timing Patterns',
          description: `Detected ${unusualPatterns.length} unusual temporal patterns that may indicate fraud or system issues`,
          impact: 'medium' as const
        });
      }
    }

    // Quality insights
    if (result.metadata && result.metadata.qualityRate < 0.8) {
      insights.push({
        title: 'Data Quality Issues',
        description: `Only ${(result.metadata.qualityRate * 100).toFixed(1)}% of sessions passed quality checks`,
        impact: 'medium' as const
      });
    }

    return insights;
  }

  private async processJobQueue(): Promise<void> {
    // Process jobs from queue up to max concurrent limit
    while (this.activeJobs.size < this.config.scaling.maxConcurrentJobs && this.jobQueue.length > 0) {
      const job = this.jobQueue.shift();
      if (job) {
        this.activeJobs.set(job.id, job);
        this.processJob(job).finally(() => {
          this.activeJobs.delete(job.id);
        });
      }
    }
  }

  private async processJob(job: ProcessingJob): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Process job based on type
      switch (job.type) {
        case 'session_analysis':
          await this.processSession(job.data.session, job.data.context);
          break;
        case 'batch_processing':
          await this.processBatch(job.data.sessions, job.data.context);
          break;
        default:
          console.warn(`Unknown job type: ${job.type}`);
      }
      
      const processingTime = Date.now() - startTime;
      this.emit('job:completed', { jobId: job.id, processingTime });
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      if (job.retryCount < job.maxRetries) {
        job.retryCount++;
        job.timestamp = new Date(Date.now() + 5000); // Retry in 5 seconds
        this.jobQueue.push(job);
        console.log(`Job ${job.id} failed, retrying (${job.retryCount}/${job.maxRetries})`);
      } else {
        console.error(`Job ${job.id} failed permanently:`, error);
        this.emit('job:failed', { jobId: job.id, error, processingTime });
      }
    }
  }

  private async updateSystemMetrics(): Promise<void> {
    // Update system resource usage
    const memoryUsage = process.memoryUsage();
    this.metrics.memoryUsage = memoryUsage.heapUsed / 1024 / 1024; // MB
    
    // Calculate throughput (sessions per second)
    const now = Date.now();
    const timeSinceLastUpdate = now - this.metrics.lastProcessedTimestamp.getTime();
    if (timeSinceLastUpdate > 0) {
      this.metrics.currentThroughput = (this.metrics.totalProcessed * 1000) / timeSinceLastUpdate;
    }
  }

  // Quality metric calculation helpers
  private calculateCompleteness(session: SessionData): number {
    const requiredFields = ['id', 'businessId', 'timestamp', 'transcript', 'audioDurationSeconds'];
    const presentFields = requiredFields.filter(field => session[field as keyof SessionData] != null);
    return presentFields.length / requiredFields.length;
  }

  private calculateAccuracy(session: SessionData): number {
    // Simple accuracy check based on AI evaluation confidence
    return (session.aiEvaluation?.transcriptionConfidence || 0.8);
  }

  private calculateConsistency(session: SessionData): number {
    // Check consistency between related fields
    let consistencyScore = 1.0;
    
    // Check if quality scores are within reasonable ranges
    if (session.qualityScore && (session.qualityScore < 0 || session.qualityScore > 100)) {
      consistencyScore -= 0.2;
    }
    
    // Check if duration matches transcript length approximation
    if (session.transcript && session.audioDurationSeconds) {
      const estimatedDuration = session.transcript.split(' ').length / 3; // ~3 words per second
      const durationDiff = Math.abs(session.audioDurationSeconds - estimatedDuration) / session.audioDurationSeconds;
      if (durationDiff > 0.5) { // More than 50% difference
        consistencyScore -= 0.3;
      }
    }
    
    return Math.max(0, consistencyScore);
  }

  private calculateTimeliness(session: SessionData): number {
    const sessionTime = new Date(session.timestamp);
    const now = new Date();
    const hoursDiff = (now.getTime() - sessionTime.getTime()) / (1000 * 60 * 60);
    
    // Newer sessions get higher timeliness scores
    if (hoursDiff < 1) return 1.0;
    if (hoursDiff < 24) return 0.8;
    if (hoursDiff < 168) return 0.6; // Within a week
    return 0.4;
  }
}