import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';

import { feedbackRoutes } from './routes/feedback';
import { businessRoutes } from './routes/business';
import { qrRoutes } from './routes/qr';
import { healthRoutes } from './routes/health';
import { adminRoutes } from './routes/admin';
import { paymentsRoutes } from './routes/payments';
import { posHealthRoutes } from './routes/pos-health';
import { posWebhookRoutes } from './routes/pos-webhooks';
import { swedishOperationsRoutes } from './routes/swedish-operations';
import simpleVerificationRoutes from './routes/simple-verification';
import storeVerificationRoutes from './routes/store-verification';
import paymentProcessingRoutes from './routes/payment-processing';
import jobManagementRoutes from './routes/job-management';
import locationMappingRoutes from './routes/location-mapping';
import integrationMonitoringRoutes from './routes/integration-monitoring';
import manualOverrideRoutes from './routes/manual-overrides';
import billingAdminRoutes from './routes/billing-admin';
import { errorHandler } from './middleware/errorHandler';
import { optionalAuth, createUserRateLimit } from './middleware/auth';
import { setupWebSocket } from './websocket/voiceHandler';
import { setupAdminWebSocket, cleanupAdminWebSocket } from './websocket/adminHandler';
import { initializeJobScheduler } from './jobs/JobScheduler';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './docs/openapi';
import metricsEndpoints from './middleware/metricsEndpoint';
import { createMetricsMiddleware } from '@/packages/shared/src/metrics/PrometheusMetricsCollector';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Basic middleware
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    const allowlist = [
      process.env.NEXT_PUBLIC_APP_URL,
      process.env.NEXT_PUBLIC_BUSINESS_DASHBOARD_URL,
      process.env.NEXT_PUBLIC_ADMIN_DASHBOARD_URL
    ].filter(Boolean);
    if (!origin || allowlist.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Metrics collection middleware (before rate limiting to capture all requests)
app.use(createMetricsMiddleware('api-gateway'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Optional authentication middleware - sets user context if available
app.use(optionalAuth);

// User-based rate limiting (more sophisticated than IP-based)
const userRateLimit = createUserRateLimit(15 * 60 * 1000, 500); // 500 requests per 15 minutes per user
app.use(userRateLimit);

// Stricter rate limiting for voice endpoints
const voiceLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // limit to 10 voice sessions per minute
  message: 'Voice rate limit exceeded, please try again later.',
});

// Voice-specific user rate limiting
const voiceUserLimit = createUserRateLimit(60 * 1000, 5); // 5 voice requests per minute per user

// Metrics endpoints (before other routes to avoid rate limiting on metrics collection)
app.use(metricsEndpoints);

// Routes
app.use('/health', healthRoutes);
app.use('/api/qr', qrRoutes);
app.use('/api/feedback', voiceLimiter, voiceUserLimit, feedbackRoutes);
app.use('/api/business', businessRoutes);
app.use('/api/simple-verification', simpleVerificationRoutes);
app.use('/api/store-verification', storeVerificationRoutes);
app.use('/api/payment-processing', paymentProcessingRoutes);
app.use('/api/job-management', jobManagementRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/pos', posHealthRoutes);
app.use('/webhooks', posWebhookRoutes);
app.use('/swedish-ops', swedishOperationsRoutes);
app.use('/location-mapping', locationMappingRoutes);
app.get('/openapi.json', (req, res) => res.json(swaggerSpec));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use('/api/admin', adminRoutes);
app.use('/api/admin', integrationMonitoringRoutes);
app.use('/api/admin', manualOverrideRoutes);
app.use('/api/billing-admin', billingAdminRoutes);

// WebSocket setup for voice streaming and admin dashboard
setupWebSocket(wss);
setupAdminWebSocket(wss);

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found'
    }
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`🚀 API Gateway running on port ${PORT}`);
  console.log(`📱 Health check: http://localhost:${PORT}/health`);
  console.log(`🎤 WebSocket server ready for voice connections`);
  console.log(`📊 WebSocket server ready for admin dashboard connections`);
  
  // Initialize job scheduler
  try {
    initializeJobScheduler();
    console.log(`⏰ Job scheduler initialized and running`);
  } catch (error) {
    console.error(`❌ Failed to initialize job scheduler:`, error);
  }
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  cleanupAdminWebSocket();
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  cleanupAdminWebSocket();
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

export { app, server, wss };