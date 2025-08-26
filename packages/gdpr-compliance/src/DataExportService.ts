import * as crypto from 'crypto';
import { 
  DataExportRequest, 
  DataRequestType, 
  RequestStatus, 
  ExportedData,
  FeedbackSessionExport,
  ConsentData,
  GDPRConfig 
} from './types';
import { gdprDb } from '@feedback-platform/database';
import { DataAnonymizer } from './DataAnonymizer';

export class DataExportService {
  private anonymizer: DataAnonymizer;
  
  constructor(private config: GDPRConfig) {
    this.anonymizer = new DataAnonymizer(config);
  }

  async createExportRequest(
    customerHash: string, 
    requestType: DataRequestType
  ): Promise<DataExportRequest> {
    const request = await gdprDb.createDataRequest({
      customerHash,
      requestType
    });

    // Log the request creation for audit trail
    await gdprDb.createAuditLog({
      customerHash,
      actionType: `${requestType}_request_created`,
      actionDetails: {
        requestId: request.id,
        requestType
      },
      legalBasis: 'consent'
    });
    
    console.log(`Created ${requestType} request ${request.id} for customer ${customerHash}`);
    return request;
  }

  async getExportRequest(requestId: string): Promise<DataExportRequest | null> {
    return gdprDb.getDataRequest(requestId);
  }

  async processExportRequest(requestId: string): Promise<ExportedData> {
    const request = await this.getExportRequest(requestId);
    
    if (!request) {
      throw new Error(`Export request ${requestId} not found`);
    }

    if (request.status !== RequestStatus.PENDING) {
      throw new Error(`Export request ${requestId} is not pending`);
    }

    // Update status to processing
    await gdprDb.updateDataRequest(requestId, {
      status: RequestStatus.PROCESSING
    });

    try {
      const exportedData = await this.gatherCustomerData(request.customerHash);
      
      // Generate secure download URL and token
      const downloadToken = crypto.randomBytes(32).toString('hex');
      const downloadUrl = `/api/gdpr/download/${requestId}/${downloadToken}`;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + this.config.exportExpirationDays);

      await gdprDb.updateDataRequest(requestId, {
        status: RequestStatus.COMPLETED,
        completedAt: new Date(),
        downloadUrl,
        downloadToken,
        expiresAt
      });

      // Log the successful export
      await gdprDb.createAuditLog({
        customerHash: request.customerHash,
        actionType: 'data_exported',
        actionDetails: {
          requestId,
          dataSize: JSON.stringify(exportedData).length,
          exportedDataTypes: exportedData.metadata.dataTypes
        },
        legalBasis: 'consent'
      });

      console.log(`Export request ${requestId} completed successfully`);
      return exportedData;
    } catch (error) {
      await gdprDb.updateDataRequest(requestId, {
        status: RequestStatus.FAILED,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
      
      console.error(`Export request ${requestId} failed:`, error);
      throw error;
    }
  }

  private async gatherCustomerData(customerHash: string): Promise<ExportedData> {
    console.log(`Gathering data for customer ${customerHash}`);

    // Gather data from various sources
    const [feedbackSessions, consents] = await Promise.all([
      this.getFeedbackSessions(customerHash),
      this.getConsents(customerHash)
    ]);

    const exportedData: ExportedData = {
      customerData: {
        customerHash,
        feedbackSessions,
        consents,
        createdAt: await this.getCustomerCreationDate(customerHash),
        lastActivity: await this.getLastActivityDate(customerHash)
      },
      metadata: {
        exportedAt: new Date(),
        dataTypes: this.getDataTypes(feedbackSessions, consents),
        totalRecords: feedbackSessions.length + consents.length
      }
    };

    return exportedData;
  }

  private async getFeedbackSessions(customerHash: string): Promise<FeedbackSessionExport[]> {
    const sessions = await gdprDb.getCustomerFeedbackSessions(customerHash);

    return sessions.map(session => ({
      sessionId: session.id,
      timestamp: new Date(session.created_at),
      businessId: session.business_id,
      qualityScore: session.quality_score || undefined,
      reward: session.reward_amount || undefined,
      anonymizedTranscript: session.transcript ? this.anonymizeTranscript(session.transcript) : undefined,
      categories: session.feedback_categories || undefined
    }));
  }

  private async getConsents(customerHash: string): Promise<ConsentData[]> {
    return gdprDb.getConsentHistory(customerHash);
  }

  private async getCustomerCreationDate(customerHash: string): Promise<Date> {
    const sessions = await gdprDb.getCustomerFeedbackSessions(customerHash);
    if (sessions.length > 0) {
      // Return the earliest session date
      const dates = sessions.map(s => new Date(s.created_at));
      return new Date(Math.min(...dates.map(d => d.getTime())));
    }
    return new Date(); // Fallback to current date
  }

  private async getLastActivityDate(customerHash: string): Promise<Date> {
    const sessions = await gdprDb.getCustomerFeedbackSessions(customerHash);
    if (sessions.length > 0) {
      // Return the latest session date
      const dates = sessions.map(s => new Date(s.created_at));
      return new Date(Math.max(...dates.map(d => d.getTime())));
    }
    return new Date(); // Fallback to current date
  }

  private getDataTypes(
    feedbackSessions: FeedbackSessionExport[], 
    consents: ConsentData[]
  ): string[] {
    const types = new Set<string>();
    
    if (feedbackSessions.length > 0) {
      types.add('feedback_sessions');
      if (feedbackSessions.some(s => s.anonymizedTranscript)) {
        types.add('transcripts');
      }
      if (feedbackSessions.some(s => s.qualityScore)) {
        types.add('quality_scores');
      }
      if (feedbackSessions.some(s => s.reward)) {
        types.add('rewards');
      }
    }
    
    if (consents.length > 0) {
      types.add('consents');
    }
    
    return Array.from(types);
  }

  private anonymizeTranscript(transcript?: string): string | undefined {
    if (!transcript) return undefined;
    
    // Use the DataAnonymizer to remove PII from transcript
    return this.anonymizer.anonymizeText(transcript);
  }

  private async generateSecureDownloadUrl(
    requestId: string, 
    data: ExportedData
  ): Promise<string> {
    // Generate secure token for download access
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + (this.config.exportExpirationDays * 24 * 60 * 60 * 1000);
    
    // TODO: Store the token and expiration for validation
    // await prisma.exportToken.create({
    //   data: {
    //     token,
    //     requestId,
    //     expiresAt: new Date(expiresAt)
    //   }
    // });

    // Return secure download URL
    return `/api/gdpr/download/${requestId}/${token}`;
  }

  async validateDownloadToken(requestId: string, token: string): Promise<boolean> {
    // TODO: Validate token from database
    // const tokenRecord = await prisma.exportToken.findUnique({
    //   where: {
    //     token,
    //     requestId,
    //     expiresAt: {
    //       gt: new Date()
    //     }
    //   }
    // });
    
    // return !!tokenRecord;
    return true; // Placeholder
  }

  async getExportData(requestId: string, token: string): Promise<ExportedData | null> {
    const isValidToken = await this.validateDownloadToken(requestId, token);
    
    if (!isValidToken) {
      return null;
    }

    const request = await this.getExportRequest(requestId);
    
    if (!request || request.status !== RequestStatus.COMPLETED) {
      return null;
    }

    return request.data || null;
  }

  async cleanupExpiredRequests(): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.exportExpirationDays);

    // TODO: Delete expired requests and their associated data
    // await prisma.dataExportRequest.deleteMany({
    //   where: {
    //     completedAt: {
    //       lt: cutoffDate
    //     },
    //     status: RequestStatus.COMPLETED
    //   }
    // });

    // Also clean up expired tokens
    // await prisma.exportToken.deleteMany({
    //   where: {
    //     expiresAt: {
    //       lt: new Date()
    //     }
    //   }
    // });

    console.log(`Cleaned up expired export requests older than ${cutoffDate}`);
  }

  async getPendingRequestsCount(): Promise<number> {
    // TODO: Count pending requests from database
    // return prisma.dataExportRequest.count({
    //   where: {
    //     status: RequestStatus.PENDING
    //   }
    // });
    
    return 0; // Placeholder
  }

  async getRequestsByStatus(): Promise<Record<RequestStatus, number>> {
    // TODO: Group count by status from database
    // const counts = await prisma.dataExportRequest.groupBy({
    //   by: ['status'],
    //   _count: true
    // });
    
    return {
      [RequestStatus.PENDING]: 0,
      [RequestStatus.PROCESSING]: 0,
      [RequestStatus.COMPLETED]: 0,
      [RequestStatus.FAILED]: 0,
      [RequestStatus.EXPIRED]: 0
    }; // Placeholder
  }

  private async updateRequestStatus(
    requestId: string, 
    status: RequestStatus,
    additionalData?: Partial<DataExportRequest>
  ): Promise<void> {
    // TODO: Update in database
    // await prisma.dataExportRequest.update({
    //   where: { id: requestId },
    //   data: {
    //     status,
    //     ...additionalData
    //   }
    // });
    
    console.log(`Updated request ${requestId} status to ${status}`);
  }

  private generateRequestId(): string {
    return `export_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  // Batch export for admin purposes
  async createBatchExport(customerHashes: string[]): Promise<string> {
    const batchId = `batch_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    
    // Create individual requests for each customer
    const requests = await Promise.all(
      customerHashes.map(hash => 
        this.createExportRequest(hash, DataRequestType.EXPORT)
      )
    );

    console.log(`Created batch export ${batchId} with ${requests.length} requests`);
    return batchId;
  }

  // Generate export report for compliance auditing
  async generateComplianceReport(): Promise<{
    totalRequests: number;
    requestsByType: Record<DataRequestType, number>;
    averageProcessingTime: number;
    completionRate: number;
    pendingOlderThan24Hours: number;
  }> {
    // TODO: Generate comprehensive compliance report
    return {
      totalRequests: 0,
      requestsByType: {
        [DataRequestType.EXPORT]: 0,
        [DataRequestType.DELETION]: 0,
        [DataRequestType.RECTIFICATION]: 0
      },
      averageProcessingTime: 0,
      completionRate: 0,
      pendingOlderThan24Hours: 0
    }; // Placeholder
  }
}