const express = require('express');
const Stripe = require('stripe');
const { Pool } = require('pg');
const redis = require('redis');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const winston = require('winston');
const promClient = require('prom-client');
const Joi = require('joi');

// Initialize Express app
const app = express();
const port = process.env.PORT || 3000;
const isTestMode = process.env.NODE_ENV === 'test';

console.log(`🚀 Starting Payment Gateway in ${isTestMode ? 'TEST' : 'PRODUCTION'} mode`);

// Initialize Stripe (TEST mode)
const stripe = new Stripe(process.env.STRIPE_TEST_SECRET_KEY, {
  apiVersion: '2023-10-16',
  typescript: false
});

// Database connection
const dbPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Redis connection
const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => console.error('Redis Client Error:', err));
redisClient.connect().catch(console.error);

// Prometheus metrics
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

const paymentMetrics = {
  paymentsTotal: new promClient.Counter({
    name: 'payments_total',
    help: 'Total number of payment attempts',
    labelNames: ['status', 'method', 'test_mode'],
    registers: [register]
  }),
  paymentAmount: new promClient.Histogram({
    name: 'payment_amount_sek',
    help: 'Payment amounts in SEK',
    buckets: [1, 5, 10, 50, 100, 500, 1000, 5000],
    labelNames: ['method', 'test_mode'],
    registers: [register]
  }),
  paymentDuration: new promClient.Histogram({
    name: 'payment_processing_duration_seconds',
    help: 'Payment processing duration',
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
    labelNames: ['method', 'status'],
    registers: [register]
  }),
  complianceEvents: new promClient.Counter({
    name: 'compliance_events_total',
    help: 'Total compliance events logged',
    labelNames: ['type', 'severity'],
    registers: [register]
  })
};

// Logger configuration
const logger = winston.createLogger({
  level: isTestMode ? 'debug' : 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'payments-test-gateway',
    test_mode: isTestMode
  },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ 
      filename: '/var/log/payments/payment-gateway.log',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5
    })
  ]
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: false // Disable CSP for test environment
}));

app.use(cors({
  origin: isTestMode ? '*' : process.env.ALLOWED_ORIGINS?.split(','),
  credentials: true
}));

// Rate limiting (more permissive in test mode)
const limiter = rateLimit({
  windowMs: isTestMode ? 1 * 60 * 1000 : 15 * 60 * 1000, // 1 minute in test, 15 minutes in prod
  max: isTestMode ? 1000 : 100, // More requests allowed in test
  message: 'Too many requests from this IP'
});

app.use(limiter);
app.use(bodyParser.json({ limit: '1mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  const requestId = uuidv4();
  req.requestId = requestId;
  
  logger.info('Incoming request', {
    requestId,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  next();
});

// Validation schemas
const paymentSchema = Joi.object({
  amount: Joi.number().positive().max(100000).required(),
  currency: Joi.string().valid('SEK').default('SEK'),
  customer_id: Joi.string().required(),
  business_id: Joi.string().required(),
  location_id: Joi.string().required(),
  feedback_session_id: Joi.string().required(),
  payment_method: Joi.string().valid('card', 'swish', 'bankgiro').default('card'),
  description: Joi.string().max(200),
  metadata: Joi.object().default({})
});

// Swedish compliance logging
async function logComplianceEvent(type, data, severity = 'info') {
  const complianceEvent = {
    id: uuidv4(),
    timestamp: moment().toISOString(),
    type,
    severity,
    data: {
      ...data,
      test_mode: isTestMode,
      financial_authority: 'Finansinspektionen',
      regulation_reference: 'PSD2/GDPR'
    }
  };

  try {
    // Log to database
    await dbPool.query(`
      INSERT INTO compliance_events (id, type, severity, data, created_at)
      VALUES ($1, $2, $3, $4, $5)
    `, [complianceEvent.id, type, severity, complianceEvent.data, complianceEvent.timestamp]);

    // Log to file
    logger.info('Compliance event', complianceEvent);

    // Update metrics
    paymentMetrics.complianceEvents.inc({ type, severity });

    // Send to mock Finansinspektionen API if configured
    if (process.env.FINANSINSPEKTIONEN_ENDPOINT) {
      try {
        const axios = require('axios');
        await axios.post(`${process.env.FINANSINSPEKTIONEN_ENDPOINT}/compliance/events`, complianceEvent, {
          timeout: 5000,
          headers: {
            'Authorization': `Bearer ${process.env.FI_TEST_API_KEY}`,
            'Content-Type': 'application/json'
          }
        });
      } catch (apiError) {
        logger.warn('Failed to send compliance event to FI API', { error: apiError.message });
      }
    }

  } catch (error) {
    logger.error('Failed to log compliance event', { error: error.message, event: complianceEvent });
  }
}

// Health check
app.get('/health', async (req, res) => {
  try {
    // Check database
    await dbPool.query('SELECT 1');
    
    // Check Redis
    await redisClient.ping();

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      test_mode: isTestMode,
      services: {
        database: 'connected',
        redis: 'connected',
        stripe: 'test_mode'
      }
    });
  } catch (error) {
    logger.error('Health check failed', { error: error.message });
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Create payment intent
app.post('/api/payments/create-intent', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { error, value } = paymentSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { amount, currency, customer_id, business_id, location_id, feedback_session_id, payment_method, description, metadata } = value;

    logger.info('Creating payment intent', {
      requestId: req.requestId,
      amount,
      currency,
      customer_id,
      business_id,
      location_id,
      payment_method
    });

    // Log compliance event for payment initiation
    await logComplianceEvent('payment_initiated', {
      customer_id,
      business_id,
      location_id,
      amount,
      currency,
      payment_method,
      ip_address: req.ip
    });

    // Create Stripe payment intent (TEST mode)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert SEK to öre
      currency: currency.toLowerCase(),
      payment_method_types: payment_method === 'card' ? ['card'] : ['card'],
      description: `${description || 'AI Feedback Reward'} (TEST)`,
      metadata: {
        ...metadata,
        customer_id,
        business_id,
        location_id,
        feedback_session_id,
        test_mode: 'true',
        swedish_pilot: 'true'
      }
    });

    // Store payment in database
    const paymentId = uuidv4();
    await dbPool.query(`
      INSERT INTO payments_test (
        id, stripe_payment_intent_id, customer_id, business_id, location_id,
        feedback_session_id, amount, currency, payment_method, status,
        description, metadata, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `, [
      paymentId,
      paymentIntent.id,
      customer_id,
      business_id,
      location_id,
      feedback_session_id,
      amount,
      currency,
      payment_method,
      'initiated',
      description,
      JSON.stringify(metadata),
      new Date()
    ]);

    // Cache payment info in Redis
    await redisClient.setEx(`payment:${paymentId}`, 3600, JSON.stringify({
      stripe_intent_id: paymentIntent.id,
      customer_id,
      business_id,
      amount,
      status: 'initiated'
    }));

    // Update metrics
    paymentMetrics.paymentsTotal.inc({ status: 'initiated', method: payment_method, test_mode: 'true' });
    paymentMetrics.paymentAmount.observe({ method: payment_method, test_mode: 'true' }, amount);

    const duration = (Date.now() - startTime) / 1000;
    paymentMetrics.paymentDuration.observe({ method: payment_method, status: 'initiated' }, duration);

    res.json({
      payment_id: paymentId,
      client_secret: paymentIntent.client_secret,
      status: paymentIntent.status,
      amount,
      currency,
      test_mode: true,
      swedish_compliance: {
        logged: true,
        authority: 'Finansinspektionen',
        regulation: 'PSD2'
      }
    });

  } catch (error) {
    logger.error('Payment intent creation failed', {
      requestId: req.requestId,
      error: error.message,
      stack: error.stack
    });

    await logComplianceEvent('payment_error', {
      error: error.message,
      request_data: req.body
    }, 'error');

    res.status(500).json({
      error: 'Payment intent creation failed',
      message: isTestMode ? error.message : 'Internal server error',
      test_mode: isTestMode
    });
  }
});

// Confirm payment
app.post('/api/payments/:paymentId/confirm', async (req, res) => {
  const startTime = Date.now();
  const { paymentId } = req.params;

  try {
    // Get payment from cache/database
    let paymentData = await redisClient.get(`payment:${paymentId}`);
    if (!paymentData) {
      const dbResult = await dbPool.query('SELECT * FROM payments_test WHERE id = $1', [paymentId]);
      if (dbResult.rows.length === 0) {
        return res.status(404).json({ error: 'Payment not found' });
      }
      paymentData = JSON.stringify(dbResult.rows[0]);
    }

    const payment = JSON.parse(paymentData);

    // Simulate payment confirmation (always succeeds in test mode)
    const confirmationResult = {
      status: 'succeeded',
      amount_received: payment.amount * 100, // öre
      charges: {
        data: [{
          id: `ch_test_${uuidv4().substr(0, 8)}`,
          amount: payment.amount * 100,
          currency: 'sek',
          status: 'succeeded'
        }]
      }
    };

    // Update payment status in database
    await dbPool.query(`
      UPDATE payments_test 
      SET status = $1, confirmed_at = $2, stripe_charge_id = $3
      WHERE id = $4
    `, ['completed', new Date(), confirmationResult.charges.data[0].id, paymentId]);

    // Update Redis cache
    const updatedPayment = { ...payment, status: 'completed' };
    await redisClient.setEx(`payment:${paymentId}`, 3600, JSON.stringify(updatedPayment));

    // Log compliance event for successful payment
    await logComplianceEvent('payment_completed', {
      payment_id: paymentId,
      customer_id: payment.customer_id,
      business_id: payment.business_id,
      amount: payment.amount,
      stripe_charge_id: confirmationResult.charges.data[0].id
    });

    // Update metrics
    paymentMetrics.paymentsTotal.inc({ 
      status: 'completed', 
      method: payment.payment_method || 'card', 
      test_mode: 'true' 
    });

    const duration = (Date.now() - startTime) / 1000;
    paymentMetrics.paymentDuration.observe({ 
      method: payment.payment_method || 'card', 
      status: 'completed' 
    }, duration);

    logger.info('Payment confirmed successfully', {
      requestId: req.requestId,
      payment_id: paymentId,
      amount: payment.amount,
      customer_id: payment.customer_id
    });

    res.json({
      payment_id: paymentId,
      status: 'completed',
      amount: payment.amount,
      charge_id: confirmationResult.charges.data[0].id,
      test_mode: true,
      swedish_compliance: {
        logged: true,
        reported_to_fi: true
      }
    });

  } catch (error) {
    logger.error('Payment confirmation failed', {
      requestId: req.requestId,
      payment_id: paymentId,
      error: error.message
    });

    await logComplianceEvent('payment_failure', {
      payment_id: paymentId,
      error: error.message
    }, 'error');

    res.status(500).json({
      error: 'Payment confirmation failed',
      payment_id: paymentId,
      message: isTestMode ? error.message : 'Internal server error'
    });
  }
});

// Get payment status
app.get('/api/payments/:paymentId', async (req, res) => {
  const { paymentId } = req.params;

  try {
    // Try Redis first
    let paymentData = await redisClient.get(`payment:${paymentId}`);
    
    if (!paymentData) {
      // Fallback to database
      const dbResult = await dbPool.query('SELECT * FROM payments_test WHERE id = $1', [paymentId]);
      if (dbResult.rows.length === 0) {
        return res.status(404).json({ error: 'Payment not found' });
      }
      paymentData = JSON.stringify(dbResult.rows[0]);
    }

    const payment = JSON.parse(paymentData);

    res.json({
      payment_id: paymentId,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency || 'SEK',
      created_at: payment.created_at,
      confirmed_at: payment.confirmed_at,
      test_mode: true
    });

  } catch (error) {
    logger.error('Get payment status failed', {
      requestId: req.requestId,
      payment_id: paymentId,
      error: error.message
    });

    res.status(500).json({
      error: 'Failed to retrieve payment status',
      payment_id: paymentId
    });
  }
});

// Stripe webhook endpoint (for test webhooks)
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  
  try {
    const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_TEST_WEBHOOK_SECRET);
    
    logger.info('Received Stripe webhook', {
      event_type: event.type,
      event_id: event.id,
      test_mode: true
    });

    // Process webhook event
    switch (event.type) {
      case 'payment_intent.succeeded':
        await logComplianceEvent('webhook_payment_succeeded', {
          stripe_event_id: event.id,
          payment_intent_id: event.data.object.id,
          amount: event.data.object.amount / 100
        });
        break;
      
      case 'payment_intent.payment_failed':
        await logComplianceEvent('webhook_payment_failed', {
          stripe_event_id: event.id,
          payment_intent_id: event.data.object.id,
          failure_reason: event.data.object.last_payment_error?.message
        }, 'warning');
        break;
    }

    res.json({ received: true, event_type: event.type });

  } catch (error) {
    logger.error('Webhook processing failed', { error: error.message });
    res.status(400).json({ error: 'Webhook signature verification failed' });
  }
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate metrics' });
  }
});

// Test endpoints for pilot demonstration
app.get('/api/test/simulate-payment', async (req, res) => {
  if (!isTestMode) {
    return res.status(403).json({ error: 'Test endpoints only available in test mode' });
  }

  const testPayment = {
    amount: Math.floor(Math.random() * 500) + 50, // 50-550 SEK
    currency: 'SEK',
    customer_id: `test_customer_${uuidv4().substr(0, 8)}`,
    business_id: `test_business_${uuidv4().substr(0, 8)}`,
    location_id: `test_location_${uuidv4().substr(0, 8)}`,
    feedback_session_id: `test_session_${uuidv4().substr(0, 8)}`,
    payment_method: 'card',
    description: 'AI Feedback Reward - Test Payment'
  };

  try {
    // Create payment intent
    const createResponse = await fetch(`http://localhost:${port}/api/payments/create-intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayment)
    });
    
    const createResult = await createResponse.json();
    
    // Automatically confirm payment after 2 seconds (simulate user action)
    setTimeout(async () => {
      try {
        await fetch(`http://localhost:${port}/api/payments/${createResult.payment_id}/confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('Auto-confirmation failed:', error);
      }
    }, 2000);

    res.json({
      message: 'Test payment simulation started',
      payment_data: testPayment,
      payment_id: createResult.payment_id,
      auto_confirm_in: '2 seconds'
    });

  } catch (error) {
    res.status(500).json({ error: 'Test payment simulation failed', details: error.message });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error('Unhandled error', {
    requestId: req.requestId,
    error: error.message,
    stack: error.stack
  });

  res.status(500).json({
    error: 'Internal server error',
    requestId: req.requestId,
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(port, () => {
  console.log(`💳 Payment Gateway running on port ${port}`);
  console.log(`📊 Metrics available at http://localhost:${port}/metrics`);
  console.log(`🏥 Health check at http://localhost:${port}/health`);
  if (isTestMode) {
    console.log(`🧪 Test simulation at http://localhost:${port}/api/test/simulate-payment`);
  }
  
  logger.info('Payment gateway started', {
    port,
    test_mode: isTestMode,
    node_env: process.env.NODE_ENV
  });
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  console.log(`\nReceived ${signal}. Starting graceful shutdown...`);
  
  try {
    await dbPool.end();
    await redisClient.quit();
    console.log('Database and Redis connections closed');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));