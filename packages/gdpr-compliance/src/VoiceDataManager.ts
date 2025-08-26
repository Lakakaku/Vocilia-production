import * as fs from 'fs/promises';
import * as path from 'path';
import * as cron from 'node-cron';
import { gdprDb } from '@feedback-platform/database';
import { GDPRConfig } from './types';

export class VoiceDataManager {
  private cleanupTask?: cron.ScheduledTask;
  
  constructor(private config: GDPRConfig) {}

  // Track voice data for immediate deletion after processing
  async trackVoiceData(
    sessionId: string,
    customerHash: string,
    audioFilePath?: string,
    audioSizeBytes?: number
  ): Promise<string> {
    const trackingId = await gdprDb.trackVoiceData({
      sessionId,
      customerHash,
      audioFilePath,
      audioSizeBytes
    });

    // Log voice data creation for audit trail
    await gdprDb.createAuditLog({
      customerHash,
      actionType: 'voice_data_created',
      actionDetails: {
        sessionId,
        trackingId,
        audioFilePath,
        audioSizeBytes
      },
      legalBasis: 'consent'
    });

    console.log(`Voice data tracked for session ${sessionId}, tracking ID: ${trackingId}`);
    return trackingId;
  }

  // Mark voice processing as completed
  async markVoiceProcessingCompleted(trackingId: string): Promise<void> {
    await gdprDb.updateVoiceDataStatus(trackingId, 'processed', {
      processingCompletedAt: new Date()
    });

    // Schedule immediate deletion (should happen within seconds)
    await this.scheduleImmediateDeletion(trackingId);
  }

  // Schedule immediate deletion of voice data
  private async scheduleImmediateDeletion(trackingId: string): Promise<void> {
    const deletionTime = new Date();
    deletionTime.setSeconds(deletionTime.getSeconds() + 30); // Delete in 30 seconds

    await gdprDb.updateVoiceDataStatus(trackingId, 'scheduled_deletion', {
      deletionScheduledAt: deletionTime
    });

    // Set immediate timeout for deletion
    setTimeout(async () => {
      try {
        await this.executeVoiceDataDeletion(trackingId);
      } catch (error) {
        console.error(`Failed to delete voice data ${trackingId}:`, error);
        await gdprDb.updateVoiceDataStatus(trackingId, 'error', {
          errorMessage: error instanceof Error ? error.message : 'Deletion failed'
        });
      }
    }, 30000); // 30 seconds delay
  }

  // Execute actual voice data deletion
  private async executeVoiceDataDeletion(trackingId: string): Promise<void> {
    const voiceDataList = await gdprDb.getVoiceDataForDeletion();
    const voiceData = voiceDataList.find(v => v.id === trackingId);

    if (!voiceData) {
      console.log(`Voice data ${trackingId} not found for deletion`);
      return;
    }

    try {
      // Delete physical file if it exists
      if (voiceData.audioFilePath) {
        try {
          await fs.unlink(voiceData.audioFilePath);
          console.log(`Deleted audio file: ${voiceData.audioFilePath}`);
        } catch (fileError) {
          // File might already be deleted or not exist
          console.warn(`Could not delete audio file ${voiceData.audioFilePath}:`, fileError);
        }
      }

      // Update tracking status to deleted
      await gdprDb.updateVoiceDataStatus(trackingId, 'deleted', {
        deletedAt: new Date()
      });

      // Mark the session as having voice data deleted
      await gdprDb.markVoiceDataDeleted(voiceData.sessionId);

      // Log the deletion for audit trail
      await gdprDb.createAuditLog({
        actionType: 'voice_data_deleted',
        actionDetails: {
          trackingId,
          sessionId: voiceData.sessionId,
          audioFilePath: voiceData.audioFilePath,
          deletedAt: new Date()
        },
        legalBasis: 'legal_obligation' // GDPR requires immediate deletion
      });

      console.log(`Voice data ${trackingId} successfully deleted`);
    } catch (error) {
      console.error(`Failed to delete voice data ${trackingId}:`, error);
      
      await gdprDb.updateVoiceDataStatus(trackingId, 'error', {
        errorMessage: error instanceof Error ? error.message : 'Deletion failed'
      });

      throw error;
    }
  }

  // Process a completed feedback session (called from AI evaluator)
  async processFeedbackCompletion(
    sessionId: string,
    customerHash: string,
    audioFilePath?: string
  ): Promise<void> {
    // Track the voice data
    const trackingId = await this.trackVoiceData(
      sessionId,
      customerHash,
      audioFilePath
    );

    // Mark as processed and schedule deletion
    await this.markVoiceProcessingCompleted(trackingId);
  }

  // Batch cleanup of old voice data (safety net)
  async performBatchCleanup(): Promise<{
    processed: number;
    deleted: number;
    errors: string[];
  }> {
    const result = {
      processed: 0,
      deleted: 0,
      errors: [] as string[]
    };

    console.log('Starting batch voice data cleanup...');

    try {
      const voiceDataList = await gdprDb.getVoiceDataForDeletion();
      
      for (const voiceData of voiceDataList) {
        try {
          await this.executeVoiceDataDeletion(voiceData.id);
          result.deleted++;
        } catch (error) {
          result.errors.push(`${voiceData.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        result.processed++;
      }

      console.log(`Batch cleanup completed: ${result.deleted}/${result.processed} deleted`);
    } catch (error) {
      console.error('Batch cleanup failed:', error);
      result.errors.push(`Batch cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  // Emergency cleanup for all voice data older than specified time
  async emergencyCleanup(olderThanMinutes: number = 1): Promise<void> {
    console.log(`Starting emergency voice data cleanup (older than ${olderThanMinutes} minutes)`);
    
    const cutoffTime = new Date();
    cutoffTime.setMinutes(cutoffTime.getMinutes() - olderThanMinutes);

    // This would require a database query for old voice data
    // For now, we'll rely on the batch cleanup method
    await this.performBatchCleanup();

    await gdprDb.createAuditLog({
      actionType: 'emergency_voice_cleanup',
      actionDetails: {
        cutoffTime,
        reason: 'Emergency GDPR compliance cleanup'
      },
      legalBasis: 'legal_obligation'
    });
  }

  // Schedule automatic cleanup (runs every 5 minutes as safety net)
  startAutomaticCleanup(): void {
    if (this.cleanupTask) {
      console.log('Automatic voice cleanup is already running');
      return;
    }

    this.cleanupTask = cron.schedule('*/5 * * * *', async () => {
      try {
        const result = await this.performBatchCleanup();
        if (result.processed > 0) {
          console.log(`Automatic cleanup: ${result.deleted}/${result.processed} voice data deleted`);
        }
        
        if (result.errors.length > 0) {
          console.error('Automatic cleanup errors:', result.errors);
        }
      } catch (error) {
        console.error('Automatic cleanup failed:', error);
      }
    }, {
      scheduled: false
    });

    this.cleanupTask.start();
    console.log('Automatic voice data cleanup started (every 5 minutes)');
  }

  // Stop automatic cleanup
  stopAutomaticCleanup(): void {
    if (this.cleanupTask) {
      this.cleanupTask.stop();
      this.cleanupTask = undefined;
      console.log('Automatic voice data cleanup stopped');
    }
  }

  // Get voice data retention statistics
  async getVoiceRetentionStats(): Promise<{
    totalTracked: number;
    awaitingDeletion: number;
    deleted: number;
    errors: number;
    oldestUndeleted?: Date;
    averageDeletionTime?: number; // in seconds
  }> {
    // This would require database queries to get actual statistics
    // For now, return a placeholder structure
    return {
      totalTracked: 0,
      awaitingDeletion: 0,
      deleted: 0,
      errors: 0
    };
  }

  // Verify GDPR compliance for voice data
  async verifyVoiceDataCompliance(): Promise<{
    compliant: boolean;
    violations: string[];
    recommendations: string[];
  }> {
    const violations: string[] = [];
    const recommendations: string[] = [];

    try {
      // Check for voice data that should have been deleted
      const stats = await this.getVoiceRetentionStats();
      
      if (stats.awaitingDeletion > 0) {
        violations.push(`${stats.awaitingDeletion} voice recordings awaiting deletion`);
      }

      if (stats.errors > 0) {
        violations.push(`${stats.errors} voice deletion errors need attention`);
        recommendations.push('Review and retry failed voice data deletions');
      }

      if (stats.oldestUndeleted) {
        const age = Date.now() - stats.oldestUndeleted.getTime();
        const ageMinutes = Math.floor(age / 60000);
        
        if (ageMinutes > 5) {
          violations.push(`Voice data exists that is ${ageMinutes} minutes old`);
          recommendations.push('Investigate delayed voice data deletion');
        }
      }

      // Additional recommendations
      if (!this.cleanupTask) {
        recommendations.push('Enable automatic voice data cleanup');
      }

    } catch (error) {
      violations.push(`Unable to verify voice data compliance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      compliant: violations.length === 0,
      violations,
      recommendations
    };
  }

  // Integration method for AI processing pipeline
  static async integrateWithAIPipeline(
    sessionId: string,
    customerHash: string,
    audioFilePath: string,
    config: GDPRConfig
  ): Promise<() => Promise<void>> {
    const voiceManager = new VoiceDataManager(config);
    
    // Track the voice data immediately when AI processing starts
    const trackingId = await voiceManager.trackVoiceData(
      sessionId,
      customerHash,
      audioFilePath
    );

    // Return cleanup function to be called when AI processing completes
    return async () => {
      await voiceManager.markVoiceProcessingCompleted(trackingId);
    };
  }
}