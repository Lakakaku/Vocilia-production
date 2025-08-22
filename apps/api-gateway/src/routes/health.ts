import { Router } from 'express';
import { db } from '@ai-feedback/database';

const router = Router();

// Basic health check
router.get('/', async (req, res) => {
  try {
    // Test database connection
    const result = await db.client.from('businesses').select('count').limit(1);
    
    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: result.error ? 'error' : 'healthy',
        api: 'healthy'
      },
      version: process.env.npm_package_version || '1.0.0'
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'error',
        api: 'healthy'
      },
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Detailed health check for monitoring
router.get('/detailed', async (req, res) => {
  const checks = {
    database: false,
    memory: false,
    uptime: true
  };

  try {
    // Database check
    const dbResult = await db.client.from('businesses').select('count').limit(1);
    checks.database = !dbResult.error;

    // Memory check (warn if using > 80% of available memory)
    const memUsage = process.memoryUsage();
    const memPercentage = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    checks.memory = memPercentage < 80;

    const allHealthy = Object.values(checks).every(Boolean);

    res.status(allHealthy ? 200 : 503).json({
      success: allHealthy,
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      checks,
      metrics: {
        uptime: process.uptime(),
        memory: {
          used: Math.round(memUsage.heapUsed / 1024 / 1024),
          total: Math.round(memUsage.heapTotal / 1024 / 1024),
          percentage: Math.round(memPercentage)
        }
      }
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      checks,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as healthRoutes };