import winston from 'winston';

// Create logger configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
      return JSON.stringify({
        timestamp,
        level,
        message,
        ...(stack && { stack }),
        ...meta
      });
    })
  ),
  defaultMeta: { service: 'api-gateway' },
  transports: [
    // Write all logs with importance level of `error` or less to `error.log`
    new winston.transports.File({ 
      filename: '/var/log/api-gateway/error.log', 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Write all logs with importance level of `info` or less to `combined.log`
    new winston.transports.File({ 
      filename: '/var/log/api-gateway/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 10,
    })
  ]
});

// If we're not in production, also log to the console
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple(),
      winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
        const metaString = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
        return `${timestamp} [${level}]: ${message}${stack ? `\n${stack}` : ''}${metaString}`;
      })
    )
  }));
}

// Add structured logging methods for POS operations
const posLogger = {
  apiCall: (provider: string, endpoint: string, success: boolean, responseTime: number, error?: any) => {
    logger.info('POS API Call', {
      category: 'pos-api',
      provider,
      endpoint,
      success,
      responseTime,
      ...(error && { error: error instanceof Error ? error.message : String(error) })
    });
  },

  webhookReceived: (provider: string, eventType: string, processingTime: number, success: boolean, error?: any) => {
    logger.info('Webhook Received', {
      category: 'pos-webhook',
      provider,
      eventType,
      processingTime,
      success,
      ...(error && { error: error instanceof Error ? error.message : String(error) })
    });
  },

  transactionVerification: (provider: string, result: string, verificationTime: number, transactionId?: string) => {
    logger.info('Transaction Verification', {
      category: 'pos-transaction',
      provider,
      result,
      verificationTime,
      ...(transactionId && { transactionId })
    });
  },

  connectionHealth: (provider: string, businessId: string, healthy: boolean, responseTime: number, details?: any) => {
    logger.info('POS Connection Health Check', {
      category: 'pos-health',
      provider,
      businessId,
      healthy,
      responseTime,
      ...(details && { details })
    });
  },

  authStatus: (provider: string, businessId: string, status: string, details?: any) => {
    logger.info('POS Authentication Status', {
      category: 'pos-auth',
      provider,
      businessId,
      status,
      ...(details && { details })
    });
  },

  syncOperation: (provider: string, operation: string, success: boolean, duration: number, recordsProcessed?: number) => {
    logger.info('POS Sync Operation', {
      category: 'pos-sync',
      provider,
      operation,
      success,
      duration,
      ...(recordsProcessed && { recordsProcessed })
    });
  }
};

// Export both the main logger and POS-specific logger
export { logger, posLogger };

// Export default
export default logger;