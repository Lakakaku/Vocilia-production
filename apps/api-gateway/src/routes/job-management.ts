import { Router, type Request, type Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { getJobScheduler } from '../jobs/JobScheduler';
import type { APIResponse } from '@ai-feedback/shared-types';

const router = Router();

/**
 * @openapi
 * /api/job-management/status:
 *   get:
 *     summary: Get status of all scheduled jobs
 *     tags: [Job Management]
 *     security:
 *       - adminAuth: []
 *     responses:
 *       200:
 *         description: Job statuses retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                       lastRun:
 *                         type: string
 *                         format: date-time
 *                       nextRun:
 *                         type: string
 *                         format: date-time
 *                       status:
 *                         type: string
 *                         enum: [idle, running, error]
 *                       errorMessage:
 *                         type: string
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const jobScheduler = getJobScheduler();
    const jobStatuses = jobScheduler.getJobStatuses();

    res.json({
      success: true,
      data: jobStatuses
    } as APIResponse);

  } catch (error) {
    console.error('Job status check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get job statuses'
    } as APIResponse);
  }
});

/**
 * @openapi
 * /api/job-management/job/{jobName}/status:
 *   get:
 *     summary: Get status of a specific job
 *     tags: [Job Management]
 *     security:
 *       - adminAuth: []
 *     parameters:
 *       - in: path
 *         name: jobName
 *         required: true
 *         schema:
 *           type: string
 *           enum: [monthly-batch-processing, daily-overdue-checks, daily-reminder-checks]
 *     responses:
 *       200:
 *         description: Job status retrieved successfully
 *       404:
 *         description: Job not found
 */
router.get('/job/:jobName/status', [
  param('jobName').isIn(['monthly-batch-processing', 'daily-overdue-checks', 'daily-reminder-checks'])
    .withMessage('Invalid job name')
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      } as APIResponse);
    }

    const { jobName } = req.params;
    const jobScheduler = getJobScheduler();
    const jobStatus = jobScheduler.getJobStatus(jobName);

    if (!jobStatus) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      } as APIResponse);
    }

    res.json({
      success: true,
      data: jobStatus
    } as APIResponse);

  } catch (error) {
    console.error('Job status check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get job status'
    } as APIResponse);
  }
});

/**
 * @openapi
 * /api/job-management/job/{jobName}/trigger:
 *   post:
 *     summary: Manually trigger a job execution
 *     tags: [Job Management]
 *     security:
 *       - adminAuth: []
 *     parameters:
 *       - in: path
 *         name: jobName
 *         required: true
 *         schema:
 *           type: string
 *           enum: [monthly-batch-processing, daily-overdue-checks, daily-reminder-checks]
 *     responses:
 *       200:
 *         description: Job triggered successfully
 *       400:
 *         description: Invalid job name or job already running
 *       404:
 *         description: Job not found
 */
router.post('/job/:jobName/trigger', [
  param('jobName').isIn(['monthly-batch-processing', 'daily-overdue-checks', 'daily-reminder-checks'])
    .withMessage('Invalid job name')
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      } as APIResponse);
    }

    const { jobName } = req.params;
    const jobScheduler = getJobScheduler();
    
    // Check if job exists and is not currently running
    const jobStatus = jobScheduler.getJobStatus(jobName);
    if (!jobStatus) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      } as APIResponse);
    }

    if (jobStatus.status === 'running') {
      return res.status(400).json({
        success: false,
        error: 'Job is already running'
      } as APIResponse);
    }

    // Trigger the job
    console.log(`Manually triggering job: ${jobName}`);
    
    // Don't await - let it run in background and return immediately
    jobScheduler.triggerJob(jobName).catch(error => {
      console.error(`Manual job trigger failed for ${jobName}:`, error);
    });

    res.json({
      success: true,
      data: {
        message: `Job '${jobName}' has been triggered`,
        jobName,
        triggeredAt: new Date().toISOString()
      }
    } as APIResponse);

  } catch (error) {
    console.error('Job trigger error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger job'
    } as APIResponse);
  }
});

/**
 * @openapi
 * /api/job-management/monthly-batch/trigger:
 *   post:
 *     summary: Manually trigger monthly batch processing for specific month
 *     tags: [Job Management]
 *     security:
 *       - adminAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [year, month]
 *             properties:
 *               year:
 *                 type: integer
 *                 minimum: 2020
 *                 maximum: 2030
 *               month:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 12
 *     responses:
 *       200:
 *         description: Monthly batch processing triggered successfully
 *       400:
 *         description: Invalid parameters
 */
router.post('/monthly-batch/trigger', [
  body('year').isInt({ min: 2020, max: 2030 }).withMessage('Valid year required (2020-2030)'),
  body('month').isInt({ min: 1, max: 12 }).withMessage('Valid month required (1-12)')
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      } as APIResponse);
    }

    const { year, month } = req.body;
    
    console.log(`Manually triggering monthly batch processing for ${year}-${month}`);
    
    // Import MonthlyBatchProcessor directly for custom parameters
    const { MonthlyBatchProcessor } = await import('../jobs/MonthlyBatchProcessor');
    const batchProcessor = new MonthlyBatchProcessor();
    
    // Run in background
    batchProcessor.processMonthlyBatches(year, month).catch(error => {
      console.error(`Manual monthly batch processing failed for ${year}-${month}:`, error);
    });

    res.json({
      success: true,
      data: {
        message: `Monthly batch processing for ${year}-${month} has been triggered`,
        year,
        month,
        triggeredAt: new Date().toISOString()
      }
    } as APIResponse);

  } catch (error) {
    console.error('Monthly batch trigger error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger monthly batch processing'
    } as APIResponse);
  }
});

/**
 * @openapi
 * /api/job-management/system-info:
 *   get:
 *     summary: Get job management system information
 *     tags: [Job Management]
 *     security:
 *       - adminAuth: []
 *     responses:
 *       200:
 *         description: System information retrieved successfully
 */
router.get('/system-info', async (req: Request, res: Response) => {
  try {
    const jobScheduler = getJobScheduler();
    const jobStatuses = jobScheduler.getJobStatuses();

    const systemInfo = {
      schedulerStatus: 'active',
      totalJobs: jobStatuses.length,
      runningJobs: jobStatuses.filter(job => job.status === 'running').length,
      errorJobs: jobStatuses.filter(job => job.status === 'error').length,
      idleJobs: jobStatuses.filter(job => job.status === 'idle').length,
      nextJobRun: jobStatuses
        .filter(job => job.nextRun)
        .map(job => ({ name: job.name, nextRun: job.nextRun }))
        .sort((a, b) => new Date(a.nextRun!).getTime() - new Date(b.nextRun!).getTime())[0],
      serverTime: new Date().toISOString(),
      timezone: 'Europe/Stockholm'
    };

    res.json({
      success: true,
      data: systemInfo
    } as APIResponse);

  } catch (error) {
    console.error('System info error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get system information'
    } as APIResponse);
  }
});

export default router;