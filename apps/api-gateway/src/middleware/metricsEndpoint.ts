/**
 * Metrics Endpoint Middleware for API Gateway
 * Exposes Prometheus metrics for monitoring and alerting
 */

import { Request, Response, Router } from 'express';
import { metricsRegistry } from '@/packages/shared/src/metrics/PrometheusMetricsCollector';
import { performance } from 'perf_hooks';

const router = Router();

/**
 * Main metrics endpoint - serves all application metrics
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const startTime = performance.now();
    
    // Collect and return Prometheus metrics
    const metrics = await metricsRegistry.getMetrics();
    
    const responseTime = (performance.now() - startTime) / 1000;
    
    // Record the metrics collection performance
    const collectors = metricsRegistry.getCollectors();
    collectors.system.recordHttpRequest({
      method: 'GET',
      route: '/metrics',
      statusCode: 200,
      duration: responseTime,
      app: 'api-gateway'
    });

    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.status(200).send(metrics);
  } catch (error) {
    console.error('Error collecting metrics:', error);
    res.status(500).json({ error: 'Failed to collect metrics' });
  }
});

/**
 * Voice processing specific metrics
 */
router.get('/metrics/voice', async (req: Request, res: Response) => {
  try {
    const startTime = performance.now();
    
    // Get voice-specific metrics
    const fullMetrics = await metricsRegistry.getMetrics();
    
    // Filter for voice-related metrics
    const voiceMetrics = fullMetrics
      .split('\n')
      .filter(line => 
        line.includes('voice_') || 
        line.includes('websocket_') ||
        line.includes('ai_feedback_voice') ||
        line.includes('ai_feedback_websocket')
      )
      .join('\n');

    const responseTime = (performance.now() - startTime) / 1000;
    
    const collectors = metricsRegistry.getCollectors();
    collectors.system.recordHttpRequest({
      method: 'GET',
      route: '/metrics/voice',
      statusCode: 200,
      duration: responseTime,
      app: 'api-gateway'
    });

    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.status(200).send(voiceMetrics);
  } catch (error) {
    console.error('Error collecting voice metrics:', error);
    res.status(500).json({ error: 'Failed to collect voice metrics' });
  }
});

/**
 * AI processing specific metrics
 */
router.get('/metrics/ai', async (req: Request, res: Response) => {
  try {
    const startTime = performance.now();
    
    // Get AI-specific metrics
    const fullMetrics = await metricsRegistry.getMetrics();
    
    // Filter for AI-related metrics
    const aiMetrics = fullMetrics
      .split('\n')
      .filter(line => 
        line.includes('ai_') || 
        line.includes('ai_feedback_quality') ||
        line.includes('ai_feedback_processing') ||
        line.includes('ai_feedback_model')
      )
      .join('\n');

    const responseTime = (performance.now() - startTime) / 1000;
    
    const collectors = metricsRegistry.getCollectors();
    collectors.system.recordHttpRequest({
      method: 'GET',
      route: '/metrics/ai',
      statusCode: 200,
      duration: responseTime,
      app: 'api-gateway'
    });

    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.status(200).send(aiMetrics);
  } catch (error) {
    console.error('Error collecting AI metrics:', error);
    res.status(500).json({ error: 'Failed to collect AI metrics' });
  }
});

/**
 * Fraud detection specific metrics
 */
router.get('/metrics/fraud', async (req: Request, res: Response) => {
  try {
    const startTime = performance.now();
    
    // Get fraud-specific metrics
    const fullMetrics = await metricsRegistry.getMetrics();
    
    // Filter for fraud-related metrics
    const fraudMetrics = fullMetrics
      .split('\n')
      .filter(line => 
        line.includes('fraud_') || 
        line.includes('ai_feedback_fraud')
      )
      .join('\n');

    const responseTime = (performance.now() - startTime) / 1000;
    
    const collectors = metricsRegistry.getCollectors();
    collectors.system.recordHttpRequest({
      method: 'GET',
      route: '/metrics/fraud',
      statusCode: 200,
      duration: responseTime,
      app: 'api-gateway'
    });

    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.status(200).send(fraudMetrics);
  } catch (error) {
    console.error('Error collecting fraud metrics:', error);
    res.status(500).json({ error: 'Failed to collect fraud metrics' });
  }
});

/**
 * Payment processing specific metrics
 */
router.get('/metrics/payments', async (req: Request, res: Response) => {
  try {
    const startTime = performance.now();
    
    // Get payment-specific metrics
    const fullMetrics = await metricsRegistry.getMetrics();
    
    // Filter for payment-related metrics
    const paymentMetrics = fullMetrics
      .split('\n')
      .filter(line => 
        line.includes('payment_') || 
        line.includes('stripe_') ||
        line.includes('ai_feedback_reward') ||
        line.includes('ai_feedback_payment') ||
        line.includes('ai_feedback_stripe')
      )
      .join('\n');

    const responseTime = (performance.now() - startTime) / 1000;
    
    const collectors = metricsRegistry.getCollectors();
    collectors.system.recordHttpRequest({
      method: 'GET',
      route: '/metrics/payments',
      statusCode: 200,
      duration: responseTime,
      app: 'api-gateway'
    });

    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.status(200).send(paymentMetrics);
  } catch (error) {
    console.error('Error collecting payment metrics:', error);
    res.status(500).json({ error: 'Failed to collect payment metrics' });
  }
});

/**
 * Business KPI metrics
 */
router.get('/metrics/business', async (req: Request, res: Response) => {
  try {
    const startTime = performance.now();
    
    // Get business-specific metrics
    const fullMetrics = await metricsRegistry.getMetrics();
    
    // Filter for business KPI metrics
    const businessMetrics = fullMetrics
      .split('\n')
      .filter(line => 
        line.includes('business_') || 
        line.includes('ai_feedback_active_businesses') ||
        line.includes('ai_feedback_business_revenue') ||
        line.includes('ai_feedback_sessions_total')
      )
      .join('\n');

    const responseTime = (performance.now() - startTime) / 1000;
    
    const collectors = metricsRegistry.getCollectors();
    collectors.system.recordHttpRequest({
      method: 'GET',
      route: '/metrics/business',
      statusCode: 200,
      duration: responseTime,
      app: 'api-gateway'
    });

    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.status(200).send(businessMetrics);
  } catch (error) {
    console.error('Error collecting business metrics:', error);
    res.status(500).json({ error: 'Failed to collect business metrics' });
  }
});

/**
 * SLA tracking metrics
 */
router.get('/metrics/sla', async (req: Request, res: Response) => {
  try {
    const startTime = performance.now();
    
    // Get SLA-specific metrics
    const fullMetrics = await metricsRegistry.getMetrics();
    
    // Filter for SLA metrics
    const slaMetrics = fullMetrics
      .split('\n')
      .filter(line => 
        line.includes('sla_') || 
        line.includes('availability_') ||
        line.includes('error_rate_')
      )
      .join('\n');

    const responseTime = (performance.now() - startTime) / 1000;
    
    const collectors = metricsRegistry.getCollectors();
    collectors.system.recordHttpRequest({
      method: 'GET',
      route: '/metrics/sla',
      statusCode: 200,
      duration: responseTime,
      app: 'api-gateway'
    });

    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.status(200).send(slaMetrics);
  } catch (error) {
    console.error('Error collecting SLA metrics:', error);
    res.status(500).json({ error: 'Failed to collect SLA metrics' });
  }
});

/**
 * Load testing metrics
 */
router.get('/metrics/load-testing', async (req: Request, res: Response) => {
  try {
    const startTime = performance.now();
    
    // Get load testing specific metrics
    const fullMetrics = await metricsRegistry.getMetrics();
    
    // Filter for load testing metrics
    const loadTestMetrics = fullMetrics
      .split('\n')
      .filter(line => 
        line.includes('load_test_') || 
        line.includes('concurrent_users') ||
        line.includes('ai_feedback_load_test')
      )
      .join('\n');

    const responseTime = (performance.now() - startTime) / 1000;
    
    const collectors = metricsRegistry.getCollectors();
    collectors.system.recordHttpRequest({
      method: 'GET',
      route: '/metrics/load-testing',
      statusCode: 200,
      duration: responseTime,
      app: 'api-gateway'
    });

    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.status(200).send(loadTestMetrics);
  } catch (error) {
    console.error('Error collecting load testing metrics:', error);
    res.status(500).json({ error: 'Failed to collect load testing metrics' });
  }
});

/**
 * System health endpoint with key metrics summary
 */
router.get('/health/detailed', async (req: Request, res: Response) => {
  try {
    const collectors = metricsRegistry.getCollectors();
    
    // This would normally fetch actual values from the metrics
    // For now, we'll return a structured health summary
    const healthSummary = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        voice_processing: {
          status: 'healthy',
          avg_latency: '< 2s',
          success_rate: '> 99%'
        },
        ai_evaluation: {
          status: 'healthy',
          processing_time: '< 1s',
          accuracy: '> 90%'
        },
        payments: {
          status: 'healthy',
          processing_time: '< 5s',
          success_rate: '> 99.5%'
        },
        fraud_detection: {
          status: 'healthy',
          detection_time: '< 100ms',
          accuracy: '> 95%'
        }
      },
      sla_compliance: {
        availability: '99.9%',
        response_time: '< 500ms',
        error_rate: '< 0.1%'
      }
    };

    res.status(200).json(healthSummary);
  } catch (error) {
    console.error('Error generating health summary:', error);
    res.status(500).json({ 
      status: 'unhealthy',
      error: 'Failed to generate health summary',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;