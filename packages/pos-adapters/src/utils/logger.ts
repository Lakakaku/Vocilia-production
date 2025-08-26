/**
 * Logger utility for POS adapters
 * Re-exports the enhanced logger for backward compatibility
 */

import { 
  EnhancedLogger, 
  LogLevel, 
  LogEntry, 
  LogContext,
  LoggerConfig,
  createLogger as createEnhancedLogger 
} from './EnhancedLogger';

// Re-export enhanced logger types
export { 
  LogLevel, 
  LogEntry, 
  LogContext,
  LoggerConfig,
  EnhancedLogger
};

// Create a wrapper for backward compatibility
class SimpleLogger {
  private enhancedLogger: EnhancedLogger;

  constructor(category: string = 'default') {
    this.enhancedLogger = createEnhancedLogger(category);
  }

  debug(message: string, ...args: any[]): void {
    this.enhancedLogger.debug(message, args.length > 0 ? { data: args } : undefined);
  }

  info(message: string, ...args: any[]): void {
    this.enhancedLogger.info(message, args.length > 0 ? { data: args } : undefined);
  }

  warn(message: string, ...args: any[]): void {
    this.enhancedLogger.warn(message, args.length > 0 ? { data: args } : undefined);
  }

  error(message: string, ...args: any[]): void {
    const error = args.find(arg => arg instanceof Error);
    const metadata = args.filter(arg => !(arg instanceof Error));
    this.enhancedLogger.error(message, error, metadata.length > 0 ? { data: metadata } : undefined);
  }
}

// Export factory function with enhanced capabilities
export function createLogger(category: string, config?: Partial<LoggerConfig>): EnhancedLogger {
  return createEnhancedLogger(category, config);
}

// Export singleton for backward compatibility
export const logger = new SimpleLogger();