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
import { errorHandler } from './middleware/errorHandler';
import { setupWebSocket } from './websocket/voiceHandler';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Basic middleware
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? [process.env.NEXT_PUBLIC_APP_URL!, process.env.NEXT_PUBLIC_BUSINESS_DASHBOARD_URL!]
    : true,
  credentials: true
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Stricter rate limiting for voice endpoints
const voiceLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // limit to 10 voice sessions per minute
  message: 'Voice rate limit exceeded, please try again later.',
});

// Routes
app.use('/health', healthRoutes);
app.use('/api/qr', qrRoutes);
app.use('/api/feedback', voiceLimiter, feedbackRoutes);
app.use('/api/business', businessRoutes);

// WebSocket setup for voice streaming
setupWebSocket(wss);

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
});

export { app, server, wss };