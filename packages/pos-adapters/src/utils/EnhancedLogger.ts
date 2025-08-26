import { POSProvider } from '@ai-feedback-platform/shared-types';
import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';

/**
 * Enhanced Logger for POS Adapters
 * 
 * Comprehensive logging system with:
 * - Multiple log levels and outputs
 * - Structured logging with context
 * - Log rotation and archival
 * - Performance tracking
 * - Error aggregation
 * - Debug tracing
 * - Audit logging
 * - Real-time log streaming
 */

export enum LogLevel {
  TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4,
  FATAL = 5
}

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  category: string;
  message: string;
  context?: LogContext;
  metadata?: any;
  error?: ErrorInfo;
  performance?: PerformanceInfo;
  trace?: TraceInfo;
}

export interface LogContext {
  provider?: POSProvider;
  operation?: string;
  transactionId?: string;
  requestId?: string;
  userId?: string;
  sessionId?: string;
  locationId?: string;
  correlationId?: string;
}

export interface ErrorInfo {
  name: string;
  message: string;
  stack?: string;
  code?: string;
  originalError?: any;
}

export interface PerformanceInfo {
  duration: number;
  startTime: Date;
  endTime: Date;
  metrics?: Record<string, number>;
}

export interface TraceInfo {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  tags?: Record<string, any>;
}

export interface LoggerConfig {
  level: LogLevel;
  outputs: LogOutput[];
  context?: LogContext;
  maxFileSize?: number;
  maxFiles?: number;
  logDir?: string;
  enablePerformanceTracking?: boolean;
  enableErrorAggregation?: boolean;
  enableAuditLog?: boolean;
  redactSensitiveData?: boolean;
  sensitiveFields?: string[];
}

export interface LogOutput {
  type: 'console' | 'file' | 'stream' | 'remote';
  level?: LogLevel;
  format?: 'json' | 'text' | 'structured';
  destination?: string;
  options?: any;
}

export class EnhancedLogger extends EventEmitter {
  private config: LoggerConfig;
  private logBuffer: LogEntry[] = [];
  private errorAggregator = new Map<string, ErrorAggregate>();
  private performanceTracker = new Map<string, PerformanceTracker>();
  private auditLog: LogEntry[] = [];
  private currentLogFile?: string;
  private logStream?: fs.WriteStream;
  private rotationTimer?: NodeJS.Timeout;
  
  constructor(
    private category: string,
    config?: Partial<LoggerConfig>
  ) {
    super();
    this.config = this.mergeConfig(config);
    this.initialize();
  }

  /**
   * Initialize logger
   */
  private initialize(): void {
    // Setup file logging if configured
    if (this.hasFileOutput()) {
      this.setupFileLogging();
    }

    // Setup log rotation if needed
    if (this.config.maxFileSize || this.config.maxFiles) {
      this.setupLogRotation();
    }

    // Setup performance tracking
    if (this.config.enablePerformanceTracking) {
      this.setupPerformanceTracking();
    }
  }

  /**
   * Log at trace level
   */
  trace(message: string, metadata?: any): void {
    this.log(LogLevel.TRACE, message, metadata);
  }

  /**
   * Log at debug level
   */
  debug(message: string, metadata?: any): void {
    this.log(LogLevel.DEBUG, message, metadata);
  }

  /**
   * Log at info level
   */
  info(message: string, metadata?: any): void {
    this.log(LogLevel.INFO, message, metadata);
  }

  /**
   * Log at warn level
   */
  warn(message: string, metadata?: any): void {
    this.log(LogLevel.WARN, message, metadata);
  }

  /**
   * Log at error level
   */
  error(message: string, error?: any, metadata?: any): void {
    const errorInfo = this.extractErrorInfo(error);
    this.log(LogLevel.ERROR, message, { ...metadata, error: errorInfo });
    
    // Aggregate errors if enabled
    if (this.config.enableErrorAggregation) {
      this.aggregateError(errorInfo);
    }
  }

  /**
   * Log at fatal level
   */
  fatal(message: string, error?: any, metadata?: any): void {
    const errorInfo = this.extractErrorInfo(error);
    this.log(LogLevel.FATAL, message, { ...metadata, error: errorInfo });
    
    // Emit fatal event for critical error handling
    this.emit('fatal', { message, error: errorInfo, metadata });
  }

  /**
   * Log with context
   */
  withContext(context: LogContext): EnhancedLogger {
    const newConfig = {
      ...this.config,
      context: { ...this.config.context, ...context }
    };
    return new EnhancedLogger(this.category, newConfig);
  }

  /**
   * Start performance tracking
   */
  startPerformance(operationId: string, metadata?: any): PerformanceTracker {
    const tracker = new PerformanceTracker(operationId, metadata);
    this.performanceTracker.set(operationId, tracker);
    
    this.debug(`Performance tracking started: ${operationId}`, metadata);
    
    return tracker;
  }

  /**
   * End performance tracking
   */
  endPerformance(operationId: string, success: boolean = true): void {
    const tracker = this.performanceTracker.get(operationId);
    if (!tracker) return;
    
    tracker.end();
    const performanceInfo = tracker.getInfo();
    
    this.info(`Performance tracking ended: ${operationId}`, {
      performance: performanceInfo,
      success
    });
    
    this.performanceTracker.delete(operationId);
    
    // Emit performance event
    this.emit('performance', {
      operationId,
      performance: performanceInfo,
      success
    });
  }

  /**
   * Log audit event
   */
  audit(action: string, details: any, userId?: string): void {
    const auditEntry: LogEntry = {
      timestamp: new Date(),
      level: LogLevel.INFO,
      category: `${this.category}:audit`,
      message: `Audit: ${action}`,
      context: {
        ...this.config.context,
        userId
      },
      metadata: {
        action,
        details,
        audit: true
      }
    };
    
    this.auditLog.push(auditEntry);
    
    // Also log to regular outputs
    this.processLogEntry(auditEntry);
    
    // Emit audit event
    this.emit('audit', { action, details, userId });
  }

  /**
   * Create child logger
   */
  child(category: string, context?: LogContext): EnhancedLogger {
    return new EnhancedLogger(
      `${this.category}:${category}`,
      {
        ...this.config,
        context: { ...this.config.context, ...context }
      }
    );
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, metadata?: any): void {
    if (level < this.config.level) return;
    
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      category: this.category,
      message,
      context: this.config.context,
      metadata: this.redactSensitive(metadata)
    };
    
    // Add to buffer
    this.logBuffer.push(entry);
    if (this.logBuffer.length > 1000) {
      this.logBuffer = this.logBuffer.slice(-500);
    }
    
    // Process log entry
    this.processLogEntry(entry);
    
    // Emit log event for real-time streaming
    this.emit('log', entry);
  }

  /**
   * Process log entry through outputs
   */
  private processLogEntry(entry: LogEntry): void {
    for (const output of this.config.outputs) {
      if (output.level && entry.level < output.level) continue;
      
      switch (output.type) {
        case 'console':
          this.logToConsole(entry, output);
          break;
        
        case 'file':
          this.logToFile(entry, output);
          break;
        
        case 'stream':
          this.logToStream(entry, output);
          break;
        
        case 'remote':
          this.logToRemote(entry, output);
          break;
      }
    }
  }

  /**
   * Log to console
   */
  private logToConsole(entry: LogEntry, output: LogOutput): void {
    const format = output.format || 'text';
    const message = this.formatLogEntry(entry, format);
    
    switch (entry.level) {
      case LogLevel.TRACE:
      case LogLevel.DEBUG:
        console.debug(message);
        break;
      
      case LogLevel.INFO:
        console.log(message);
        break;
      
      case LogLevel.WARN:
        console.warn(message);
        break;
      
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(message);
        break;
    }
  }

  /**
   * Log to file
   */
  private logToFile(entry: LogEntry, output: LogOutput): void {
    if (!this.logStream) return;
    
    const format = output.format || 'json';
    const message = this.formatLogEntry(entry, format);
    
    this.logStream.write(`${message}\n`);
  }

  /**
   * Log to stream
   */
  private logToStream(entry: LogEntry, output: LogOutput): void {
    const stream = output.options?.stream;
    if (!stream) return;
    
    const format = output.format || 'json';
    const message = this.formatLogEntry(entry, format);
    
    stream.write(`${message}\n`);
  }

  /**
   * Log to remote service
   */
  private async logToRemote(entry: LogEntry, output: LogOutput): Promise<void> {
    try {
      const endpoint = output.destination;
      if (!endpoint) return;
      
      // Send log to remote service (implement based on your needs)
      // await fetch(endpoint, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(entry)
      // });
    } catch (error) {
      // Silently fail to avoid recursive logging
    }
  }

  /**
   * Format log entry
   */
  private formatLogEntry(entry: LogEntry, format: 'json' | 'text' | 'structured'): string {
    switch (format) {
      case 'json':
        return JSON.stringify(entry);
      
      case 'structured':
        return this.formatStructured(entry);
      
      case 'text':
      default:
        return this.formatText(entry);
    }
  }

  /**
   * Format as text
   */
  private formatText(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString();
    const level = LogLevel[entry.level];
    const context = entry.context ? ` [${this.formatContext(entry.context)}]` : '';
    const metadata = entry.metadata ? ` ${JSON.stringify(entry.metadata)}` : '';
    
    return `${timestamp} [${level}] ${entry.category}${context}: ${entry.message}${metadata}`;
  }

  /**
   * Format as structured
   */
  private formatStructured(entry: LogEntry): string {
    const parts = [
      `timestamp="${entry.timestamp.toISOString()}"`,
      `level="${LogLevel[entry.level]}"`,
      `category="${entry.category}"`,
      `message="${entry.message}"`
    ];
    
    if (entry.context) {
      for (const [key, value] of Object.entries(entry.context)) {
        parts.push(`${key}="${value}"`);
      }
    }
    
    return parts.join(' ');
  }

  /**
   * Format context
   */
  private formatContext(context: LogContext): string {
    const parts = [];
    if (context.provider) parts.push(`provider:${context.provider}`);
    if (context.operation) parts.push(`op:${context.operation}`);
    if (context.requestId) parts.push(`req:${context.requestId}`);
    return parts.join(',');
  }

  /**
   * Extract error information
   */
  private extractErrorInfo(error: any): ErrorInfo | undefined {
    if (!error) return undefined;
    
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as any).code,
        originalError: error
      };
    }
    
    return {
      name: 'Error',
      message: String(error),
      originalError: error
    };
  }

  /**
   * Redact sensitive data
   */
  private redactSensitive(data: any): any {
    if (!this.config.redactSensitiveData) return data;
    
    const sensitiveFields = this.config.sensitiveFields || [
      'password', 'token', 'secret', 'apiKey', 'authorization',
      'creditCard', 'ssn', 'email', 'phone'
    ];
    
    return this.redactObject(data, sensitiveFields);
  }

  /**
   * Recursively redact object
   */
  private redactObject(obj: any, sensitiveFields: string[]): any {
    if (!obj || typeof obj !== 'object') return obj;
    
    const redacted = Array.isArray(obj) ? [] : {};
    
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = sensitiveFields.some(field => 
        lowerKey.includes(field.toLowerCase())
      );
      
      if (isSensitive) {
        (redacted as any)[key] = '[REDACTED]';
      } else if (typeof value === 'object') {
        (redacted as any)[key] = this.redactObject(value, sensitiveFields);
      } else {
        (redacted as any)[key] = value;
      }
    }
    
    return redacted;
  }

  /**
   * Setup file logging
   */
  private setupFileLogging(): void {
    if (!this.config.logDir) return;
    
    const logDir = path.resolve(this.config.logDir);
    
    // Create log directory if it doesn't exist
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    // Create log file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.currentLogFile = path.join(logDir, `${this.category}-${timestamp}.log`);
    
    this.logStream = fs.createWriteStream(this.currentLogFile, { flags: 'a' });
  }

  /**
   * Setup log rotation
   */
  private setupLogRotation(): void {
    // Check every hour for rotation
    this.rotationTimer = setInterval(() => {
      this.checkLogRotation();
    }, 3600000);
  }

  /**
   * Check if log rotation is needed
   */
  private checkLogRotation(): void {
    if (!this.currentLogFile || !this.config.maxFileSize) return;
    
    try {
      const stats = fs.statSync(this.currentLogFile);
      
      if (stats.size > this.config.maxFileSize) {
        this.rotateLog();
      }
    } catch (error) {
      // Ignore errors
    }
  }

  /**
   * Rotate log file
   */
  private rotateLog(): void {
    if (this.logStream) {
      this.logStream.end();
    }
    
    // Archive current log
    if (this.currentLogFile) {
      const archiveName = this.currentLogFile.replace('.log', '-archived.log');
      fs.renameSync(this.currentLogFile, archiveName);
    }
    
    // Create new log file
    this.setupFileLogging();
    
    // Clean old logs if needed
    this.cleanOldLogs();
  }

  /**
   * Clean old log files
   */
  private cleanOldLogs(): void {
    if (!this.config.logDir || !this.config.maxFiles) return;
    
    const logDir = path.resolve(this.config.logDir);
    const files = fs.readdirSync(logDir)
      .filter(f => f.includes(this.category))
      .map(f => ({
        name: f,
        path: path.join(logDir, f),
        time: fs.statSync(path.join(logDir, f)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time);
    
    // Keep only maxFiles
    if (files.length > this.config.maxFiles) {
      const toDelete = files.slice(this.config.maxFiles);
      toDelete.forEach(file => {
        fs.unlinkSync(file.path);
      });
    }
  }

  /**
   * Setup performance tracking
   */
  private setupPerformanceTracking(): void {
    // Periodically clean up old trackers
    setInterval(() => {
      const now = Date.now();
      for (const [id, tracker] of this.performanceTracker.entries()) {
        if (now - tracker.startTime.getTime() > 300000) { // 5 minutes
          this.performanceTracker.delete(id);
        }
      }
    }, 60000);
  }

  /**
   * Aggregate errors
   */
  private aggregateError(error?: ErrorInfo): void {
    if (!error) return;
    
    const key = `${error.name}:${error.code || 'unknown'}`;
    let aggregate = this.errorAggregator.get(key);
    
    if (!aggregate) {
      aggregate = {
        errorName: error.name,
        errorCode: error.code,
        count: 0,
        firstOccurrence: new Date(),
        lastOccurrence: new Date(),
        samples: []
      };
      this.errorAggregator.set(key, aggregate);
    }
    
    aggregate.count++;
    aggregate.lastOccurrence = new Date();
    
    if (aggregate.samples.length < 5) {
      aggregate.samples.push(error);
    }
  }

  /**
   * Check if file output is configured
   */
  private hasFileOutput(): boolean {
    return this.config.outputs.some(o => o.type === 'file');
  }

  /**
   * Merge configuration
   */
  private mergeConfig(config?: Partial<LoggerConfig>): LoggerConfig {
    const defaultConfig: LoggerConfig = {
      level: LogLevel.INFO,
      outputs: [{ type: 'console', format: 'text' }],
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxFiles: 10,
      enablePerformanceTracking: false,
      enableErrorAggregation: false,
      enableAuditLog: false,
      redactSensitiveData: true,
      sensitiveFields: ['password', 'token', 'secret', 'apiKey']
    };
    
    // Override from environment
    const envLevel = process.env.LOG_LEVEL?.toUpperCase();
    if (envLevel && envLevel in LogLevel) {
      defaultConfig.level = LogLevel[envLevel as keyof typeof LogLevel] as LogLevel;
    }
    
    if (process.env.LOG_DIR) {
      defaultConfig.logDir = process.env.LOG_DIR;
    }
    
    return { ...defaultConfig, ...config };
  }

  /**
   * Get log buffer
   */
  getLogBuffer(): LogEntry[] {
    return [...this.logBuffer];
  }

  /**
   * Get error aggregates
   */
  getErrorAggregates(): Map<string, ErrorAggregate> {
    return new Map(this.errorAggregator);
  }

  /**
   * Get audit log
   */
  getAuditLog(): LogEntry[] {
    return [...this.auditLog];
  }

  /**
   * Clear buffers
   */
  clearBuffers(): void {
    this.logBuffer = [];
    this.errorAggregator.clear();
    this.auditLog = [];
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer);
    }
    
    if (this.logStream) {
      this.logStream.end();
    }
    
    this.removeAllListeners();
  }
}

/**
 * Performance tracker
 */
class PerformanceTracker {
  public readonly startTime: Date;
  private endTime?: Date;
  private checkpoints: Map<string, Date> = new Map();
  
  constructor(
    public readonly operationId: string,
    public readonly metadata?: any
  ) {
    this.startTime = new Date();
  }
  
  checkpoint(name: string): void {
    this.checkpoints.set(name, new Date());
  }
  
  end(): void {
    this.endTime = new Date();
  }
  
  getInfo(): PerformanceInfo {
    const endTime = this.endTime || new Date();
    const duration = endTime.getTime() - this.startTime.getTime();
    
    const metrics: Record<string, number> = {};
    for (const [name, time] of this.checkpoints.entries()) {
      metrics[name] = time.getTime() - this.startTime.getTime();
    }
    
    return {
      duration,
      startTime: this.startTime,
      endTime,
      metrics
    };
  }
}

// Type definitions for error aggregation
interface ErrorAggregate {
  errorName: string;
  errorCode?: string;
  count: number;
  firstOccurrence: Date;
  lastOccurrence: Date;
  samples: ErrorInfo[];
}

// Factory function
export function createLogger(category: string, config?: Partial<LoggerConfig>): EnhancedLogger {
  return new EnhancedLogger(category, config);
}

// Export singleton for backward compatibility
export const logger = createLogger('default');