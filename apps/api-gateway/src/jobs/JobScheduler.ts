/**
 * Job Scheduler
 * Handles scheduled tasks for the simple verification system:
 * - Monthly batch processing (1st of each month)
 * - Daily overdue review checks
 * - Reminder notifications
 */

import cron from 'node-cron';
import { MonthlyBatchProcessor } from './MonthlyBatchProcessor';
import { deadlineEnforcementJob } from './DeadlineEnforcementJob';

interface JobStatus {
  name: string;
  lastRun?: Date;
  nextRun?: Date;
  status: 'idle' | 'running' | 'error';
  errorMessage?: string;
}

export class JobScheduler {
  private batchProcessor: MonthlyBatchProcessor;
  private jobs: Map<string, JobStatus> = new Map();
  private scheduledTasks: Map<string, cron.ScheduledTask> = new Map();

  constructor() {
    this.batchProcessor = new MonthlyBatchProcessor();
    this.initializeJobs();
  }

  /**
   * Initialize all scheduled jobs
   */
  private initializeJobs(): void {
    // Monthly batch processing - runs on 1st of each month at 9:00 AM
    this.scheduleJob('monthly-batch-processing', '0 9 1 * *', async () => {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth(); // Previous month (since we're on 1st of new month)
      const actualMonth = month === 0 ? 12 : month;
      const actualYear = month === 0 ? year - 1 : year;
      
      console.log(`Running monthly batch processing for ${actualYear}-${actualMonth}`);
      await this.batchProcessor.processMonthlyBatches(actualYear, actualMonth);
    });

    // Daily overdue review checks - runs every day at 10:00 AM
    this.scheduleJob('daily-overdue-checks', '0 10 * * *', async () => {
      console.log('Running daily overdue review checks');
      await deadlineEnforcementJob.execute();
    });

    // Reminder checks - runs every day at 2:00 PM (to catch different time zones)
    this.scheduleJob('daily-reminder-checks', '0 14 * * *', async () => {
      console.log('Running daily reminder checks');
      await deadlineEnforcementJob.execute();
    });

    console.log('Job scheduler initialized with 3 scheduled tasks');
  }

  /**
   * Schedule a job with error handling and status tracking
   */
  private scheduleJob(name: string, cronExpression: string, taskFunction: () => Promise<void>): void {
    // Initialize job status
    this.jobs.set(name, {
      name,
      status: 'idle',
      nextRun: this.getNextRunTime(cronExpression)
    });

    // Create scheduled task with error handling
    const task = cron.schedule(cronExpression, async () => {
      await this.executeJob(name, taskFunction);
    }, {
      scheduled: true,
      timezone: 'Europe/Stockholm' // Use Swedish timezone
    });

    this.scheduledTasks.set(name, task);
    console.log(`Scheduled job '${name}' with cron expression '${cronExpression}'`);
  }

  /**
   * Execute a job with error handling and status tracking
   */
  private async executeJob(name: string, taskFunction: () => Promise<void>): Promise<void> {
    const jobStatus = this.jobs.get(name)!;
    
    try {
      // Update status to running
      jobStatus.status = 'running';
      jobStatus.lastRun = new Date();
      jobStatus.errorMessage = undefined;
      
      console.log(`Starting job: ${name}`);
      
      // Execute the task
      await taskFunction();
      
      // Update status to idle on success
      jobStatus.status = 'idle';
      jobStatus.nextRun = this.getNextRunTime(this.getCronExpression(name));
      
      console.log(`Job completed successfully: ${name}`);
      
    } catch (error) {
      // Update status to error on failure
      jobStatus.status = 'error';
      jobStatus.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      jobStatus.nextRun = this.getNextRunTime(this.getCronExpression(name));
      
      console.error(`Job failed: ${name}`, error);
      
      // In a production environment, you might want to:
      // - Send alerts to monitoring systems
      // - Retry the job with exponential backoff
      // - Store error details in database
    }
  }

  /**
   * Get cron expression for a job (helper for next run calculation)
   */
  private getCronExpression(jobName: string): string {
    const cronExpressions: Record<string, string> = {
      'monthly-batch-processing': '0 9 1 * *',
      'daily-overdue-checks': '0 10 * * *',
      'daily-reminder-checks': '0 14 * * *'
    };
    
    return cronExpressions[jobName] || '0 0 * * *';
  }

  /**
   * Calculate next run time for a cron expression
   */
  private getNextRunTime(cronExpression: string): Date {
    try {
      // This is a simplified calculation - in production you'd use a proper cron parser
      const now = new Date();
      const nextRun = new Date(now);
      
      // For monthly jobs, add 1 month
      if (cronExpression.includes('1 * *')) {
        nextRun.setMonth(nextRun.getMonth() + 1);
        nextRun.setDate(1);
        nextRun.setHours(9, 0, 0, 0);
      }
      // For daily jobs, add 1 day
      else {
        nextRun.setDate(nextRun.getDate() + 1);
        if (cronExpression.includes('10 * * *')) {
          nextRun.setHours(10, 0, 0, 0);
        } else if (cronExpression.includes('14 * * *')) {
          nextRun.setHours(14, 0, 0, 0);
        }
      }
      
      return nextRun;
    } catch (error) {
      console.error('Error calculating next run time:', error);
      return new Date(Date.now() + 24 * 60 * 60 * 1000); // Default to 24 hours from now
    }
  }

  /**
   * Manually trigger a job (for testing or administrative purposes)
   */
  async triggerJob(jobName: string): Promise<void> {
    const taskFunctions: Record<string, () => Promise<void>> = {
      'monthly-batch-processing': async () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1; // Current month for manual trigger
        await this.batchProcessor.processMonthlyBatches(year, month);
      },
      'daily-overdue-checks': async () => {
        await deadlineEnforcementJob.execute();
      },
      'daily-reminder-checks': async () => {
        await deadlineEnforcementJob.execute();
      }
    };

    const taskFunction = taskFunctions[jobName];
    if (!taskFunction) {
      throw new Error(`Unknown job: ${jobName}`);
    }

    await this.executeJob(jobName, taskFunction);
  }

  /**
   * Get status of all jobs
   */
  getJobStatuses(): JobStatus[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Get status of a specific job
   */
  getJobStatus(jobName: string): JobStatus | undefined {
    return this.jobs.get(jobName);
  }

  /**
   * Start all scheduled jobs
   */
  start(): void {
    for (const [name, task] of this.scheduledTasks.entries()) {
      task.start();
      console.log(`Started job: ${name}`);
    }
    console.log('Job scheduler started - all jobs are now active');
  }

  /**
   * Stop all scheduled jobs
   */
  stop(): void {
    for (const [name, task] of this.scheduledTasks.entries()) {
      task.stop();
      console.log(`Stopped job: ${name}`);
    }
    console.log('Job scheduler stopped - all jobs are now inactive');
  }

  /**
   * Destroy the job scheduler and clean up resources
   */
  destroy(): void {
    for (const [name, task] of this.scheduledTasks.entries()) {
      task.destroy();
      console.log(`Destroyed job: ${name}`);
    }
    
    this.scheduledTasks.clear();
    this.jobs.clear();
    
    console.log('Job scheduler destroyed - all resources cleaned up');
  }
}

// Singleton instance for the application
let jobSchedulerInstance: JobScheduler | null = null;

/**
 * Get the singleton job scheduler instance
 */
export function getJobScheduler(): JobScheduler {
  if (!jobSchedulerInstance) {
    jobSchedulerInstance = new JobScheduler();
  }
  return jobSchedulerInstance;
}

/**
 * Initialize job scheduler (call this from your main application startup)
 */
export function initializeJobScheduler(): JobScheduler {
  const scheduler = getJobScheduler();
  
  if (process.env.NODE_ENV !== 'test') {
    scheduler.start();
  }
  
  // Graceful shutdown handling
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, stopping job scheduler...');
    scheduler.stop();
  });
  
  process.on('SIGINT', () => {
    console.log('SIGINT received, stopping job scheduler...');
    scheduler.stop();
  });
  
  return scheduler;
}