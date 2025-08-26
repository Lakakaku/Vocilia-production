import { createSupabaseServiceClient } from './index';
import type { Database } from './types';
import type { 
  ConsentData, 
  ConsentType, 
  DataExportRequest, 
  DataRequestType, 
  RequestStatus 
} from '@feedback-platform/gdpr-compliance';

export class GDPRDatabaseService {
  private client: ReturnType<typeof createSupabaseServiceClient>;
  
  constructor(client?: ReturnType<typeof createSupabaseServiceClient>) {
    this.client = client || createSupabaseServiceClient();
  }

  // Consent Management Operations
  async createConsentRecord(consent: {
    sessionId?: string;
    customerHash: string;
    consentType: ConsentType;
    granted: boolean;
    ipAddress?: string;
    userAgent?: string;
    version: string;
  }): Promise<ConsentData> {
    const { data, error } = await this.client
      .from('consent_records')
      .insert([{
        session_id: consent.sessionId || null,
        customer_hash: consent.customerHash,
        consent_type: consent.consentType,
        granted: consent.granted,
        ip_address: consent.ipAddress || null,
        user_agent: consent.userAgent || null,
        consent_version: consent.version
      }])
      .select()
      .single();
    
    if (error) throw error;
    
    return {
      id: data.id,
      sessionId: data.session_id,
      customerHash: data.customer_hash,
      consentType: data.consent_type as ConsentType,
      granted: data.granted,
      timestamp: new Date(data.created_at),
      ipAddress: data.ip_address || '',
      userAgent: data.user_agent || '',
      version: data.consent_version
    };
  }

  async getLatestConsent(
    customerHash: string, 
    consentType: ConsentType
  ): Promise<ConsentData | null> {
    const { data, error } = await this.client
      .from('consent_records')
      .select('*')
      .eq('customer_hash', customerHash)
      .eq('consent_type', consentType)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') return null; // No rows found
      throw error;
    }
    
    return {
      id: data.id,
      sessionId: data.session_id,
      customerHash: data.customer_hash,
      consentType: data.consent_type as ConsentType,
      granted: data.granted,
      timestamp: new Date(data.created_at),
      ipAddress: data.ip_address || '',
      userAgent: data.user_agent || '',
      version: data.consent_version
    };
  }

  async getConsentHistory(customerHash: string): Promise<ConsentData[]> {
    const { data, error } = await this.client
      .from('consent_records')
      .select('*')
      .eq('customer_hash', customerHash)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    return data.map(record => ({
      id: record.id,
      sessionId: record.session_id,
      customerHash: record.customer_hash,
      consentType: record.consent_type as ConsentType,
      granted: record.granted,
      timestamp: new Date(record.created_at),
      ipAddress: record.ip_address || '',
      userAgent: record.user_agent || '',
      version: record.consent_version
    }));
  }

  // Data Request Operations
  async createDataRequest(request: {
    customerHash: string;
    requestType: DataRequestType;
  }): Promise<DataExportRequest> {
    const { data, error } = await this.client
      .from('data_requests')
      .insert([{
        customer_hash: request.customerHash,
        request_type: request.requestType,
        status: 'pending'
      }])
      .select()
      .single();
    
    if (error) throw error;
    
    return {
      id: data.id,
      customerHash: data.customer_hash,
      requestType: data.request_type as DataRequestType,
      status: data.status as RequestStatus,
      requestedAt: new Date(data.requested_at)
    };
  }

  async getDataRequest(requestId: string): Promise<DataExportRequest | null> {
    const { data, error } = await this.client
      .from('data_requests')
      .select('*')
      .eq('id', requestId)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    
    return {
      id: data.id,
      customerHash: data.customer_hash,
      requestType: data.request_type as DataRequestType,
      status: data.status as RequestStatus,
      requestedAt: new Date(data.requested_at),
      completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
      downloadUrl: data.download_url || undefined,
      expiresAt: data.expires_at ? new Date(data.expires_at) : undefined
    };
  }

  async updateDataRequest(
    requestId: string, 
    updates: Partial<{
      status: RequestStatus;
      completedAt: Date;
      downloadUrl: string;
      downloadToken: string;
      expiresAt: Date;
      errorMessage: string;
    }>
  ): Promise<void> {
    const updateData: any = {};
    
    if (updates.status) updateData.status = updates.status;
    if (updates.completedAt) updateData.completed_at = updates.completedAt.toISOString();
    if (updates.downloadUrl) updateData.download_url = updates.downloadUrl;
    if (updates.downloadToken) updateData.download_token = updates.downloadToken;
    if (updates.expiresAt) updateData.expires_at = updates.expiresAt.toISOString();
    if (updates.errorMessage) updateData.error_message = updates.errorMessage;

    const { error } = await this.client
      .from('data_requests')
      .update(updateData)
      .eq('id', requestId);
    
    if (error) throw error;
  }

  async getPendingRequestsCount(): Promise<number> {
    const { count, error } = await this.client
      .from('data_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');
    
    if (error) throw error;
    return count || 0;
  }

  // Data Retention Operations
  async logRetentionExecution(log: {
    dataCategory: string;
    retentionPolicy: string;
    recordsProcessed: number;
    recordsDeleted: number;
    recordsAnonymized: number;
    cutoffDate: Date;
    executionStartedAt: Date;
  }): Promise<string> {
    const { data, error } = await this.client
      .from('data_retention_log')
      .insert([{
        data_category: log.dataCategory,
        retention_policy: log.retentionPolicy,
        records_processed: log.recordsProcessed,
        records_deleted: log.recordsDeleted,
        records_anonymized: log.recordsAnonymized,
        cutoff_date: log.cutoffDate.toISOString(),
        execution_started_at: log.executionStartedAt.toISOString(),
        status: 'running'
      }])
      .select('id')
      .single();
    
    if (error) throw error;
    return data.id;
  }

  async updateRetentionExecution(
    logId: string,
    updates: {
      executionCompletedAt?: Date;
      executionDurationSeconds?: number;
      status?: 'completed' | 'failed';
      errorMessage?: string;
    }
  ): Promise<void> {
    const updateData: any = {};
    
    if (updates.executionCompletedAt) {
      updateData.execution_completed_at = updates.executionCompletedAt.toISOString();
    }
    if (updates.executionDurationSeconds) {
      updateData.execution_duration_seconds = updates.executionDurationSeconds;
    }
    if (updates.status) updateData.status = updates.status;
    if (updates.errorMessage) updateData.error_message = updates.errorMessage;

    const { error } = await this.client
      .from('data_retention_log')
      .update(updateData)
      .eq('id', logId);
    
    if (error) throw error;
  }

  // Voice Data Tracking
  async trackVoiceData(tracking: {
    sessionId: string;
    customerHash: string;
    audioFilePath?: string;
    audioSizeBytes?: number;
  }): Promise<string> {
    const { data, error } = await this.client
      .from('voice_data_tracking')
      .insert([{
        session_id: tracking.sessionId,
        customer_hash: tracking.customerHash,
        audio_file_path: tracking.audioFilePath || null,
        audio_size_bytes: tracking.audioSizeBytes || null,
        status: 'processing'
      }])
      .select('id')
      .single();
    
    if (error) throw error;
    return data.id;
  }

  async updateVoiceDataStatus(
    trackingId: string,
    status: 'processed' | 'scheduled_deletion' | 'deleted' | 'error',
    updates?: {
      processingCompletedAt?: Date;
      deletionScheduledAt?: Date;
      deletedAt?: Date;
      errorMessage?: string;
    }
  ): Promise<void> {
    const updateData: any = { status };
    
    if (updates?.processingCompletedAt) {
      updateData.processing_completed_at = updates.processingCompletedAt.toISOString();
    }
    if (updates?.deletionScheduledAt) {
      updateData.deletion_scheduled_at = updates.deletionScheduledAt.toISOString();
    }
    if (updates?.deletedAt) {
      updateData.deleted_at = updates.deletedAt.toISOString();
    }
    if (updates?.errorMessage) {
      updateData.error_message = updates.errorMessage;
    }

    const { error } = await this.client
      .from('voice_data_tracking')
      .update(updateData)
      .eq('id', trackingId);
    
    if (error) throw error;
  }

  async getVoiceDataForDeletion(): Promise<Array<{
    id: string;
    sessionId: string;
    audioFilePath: string | null;
  }>> {
    const { data, error } = await this.client
      .from('voice_data_tracking')
      .select('id, session_id, audio_file_path')
      .eq('status', 'scheduled_deletion');
    
    if (error) throw error;
    
    return data.map(item => ({
      id: item.id,
      sessionId: item.session_id,
      audioFilePath: item.audio_file_path
    }));
  }

  // GDPR Audit Logging
  async createAuditLog(audit: {
    customerHash?: string;
    actionType: string;
    actionDetails?: any;
    adminId?: string;
    ipAddress?: string;
    userAgent?: string;
    legalBasis?: string;
  }): Promise<void> {
    const { error } = await this.client
      .from('gdpr_audit_log')
      .insert([{
        customer_hash: audit.customerHash || null,
        action_type: audit.actionType,
        action_details: audit.actionDetails || null,
        admin_id: audit.adminId || null,
        ip_address: audit.ipAddress || null,
        user_agent: audit.userAgent || null,
        legal_basis: audit.legalBasis || null
      }]);
    
    if (error) throw error;
  }

  // Feedback Session GDPR Updates
  async markVoiceDataDeleted(sessionId: string): Promise<void> {
    const { error } = await this.client
      .from('feedback_sessions')
      .update({
        voice_deleted_at: new Date().toISOString(),
        audio_url: null // Clear audio URL when deleted
      })
      .eq('id', sessionId);
    
    if (error) throw error;
  }

  async markTranscriptAnonymized(sessionId: string): Promise<void> {
    const { error } = await this.client
      .from('feedback_sessions')
      .update({
        transcript_anonymized_at: new Date().toISOString()
      })
      .eq('id', sessionId);
    
    if (error) throw error;
  }

  async markSessionGDPRCompliant(sessionId: string): Promise<void> {
    const { error } = await this.client
      .from('feedback_sessions')
      .update({
        gdpr_compliant: true
      })
      .eq('id', sessionId);
    
    if (error) throw error;
  }

  // Customer Data Retrieval for Export
  async getCustomerFeedbackSessions(customerHash: string) {
    const { data, error } = await this.client
      .from('feedback_sessions')
      .select(`
        id,
        created_at,
        business_id,
        quality_score,
        reward_amount,
        feedback_categories,
        transcript,
        voice_deleted_at,
        transcript_anonymized_at
      `)
      .eq('customer_hash', customerHash)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  }

  // Data Cleanup Operations
  async deleteCustomerFeedbackSessions(customerHash: string): Promise<number> {
    const { count, error } = await this.client
      .from('feedback_sessions')
      .delete({ count: 'exact' })
      .eq('customer_hash', customerHash);
    
    if (error) throw error;
    return count || 0;
  }

  async deleteOldVoiceData(cutoffDate: Date): Promise<number> {
    // Delete voice data tracking records for completed sessions older than cutoff
    const { count, error } = await this.client
      .from('voice_data_tracking')
      .delete({ count: 'exact' })
      .lt('processing_started_at', cutoffDate.toISOString())
      .eq('status', 'deleted');
    
    if (error) throw error;
    return count || 0;
  }

  async anonymizeOldTranscripts(cutoffDate: Date): Promise<string[]> {
    // Get sessions with transcripts older than cutoff
    const { data, error } = await this.client
      .from('feedback_sessions')
      .select('id, transcript')
      .lt('created_at', cutoffDate.toISOString())
      .not('transcript', 'is', null)
      .is('transcript_anonymized_at', null);
    
    if (error) throw error;
    
    // Return session IDs that need anonymization
    return data.map(session => session.id);
  }

  async updateAnonymizedTranscript(sessionId: string, anonymizedTranscript: string): Promise<void> {
    const { error } = await this.client
      .from('feedback_sessions')
      .update({
        transcript: anonymizedTranscript,
        transcript_anonymized_at: new Date().toISOString()
      })
      .eq('id', sessionId);
    
    if (error) throw error;
  }

  // Compliance Reporting
  async getGDPRComplianceStats(): Promise<{
    totalCustomers: number;
    customersWithConsent: number;
    pendingDataRequests: number;
    voiceDataNotDeleted: number;
    transcriptsNotAnonymized: number;
  }> {
    const [
      customersResult,
      consentedCustomersResult,
      pendingRequestsResult,
      oldVoiceDataResult,
      unanonymizedTranscriptsResult
    ] = await Promise.all([
      // Total unique customers
      this.client
        .from('feedback_sessions')
        .select('customer_hash', { count: 'exact' }),
      
      // Customers with valid consent
      this.client
        .from('consent_records')
        .select('customer_hash', { count: 'exact' })
        .eq('granted', true),
      
      // Pending data requests
      this.client
        .from('data_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending'),
      
      // Old voice data not deleted (older than 1 minute)
      this.client
        .from('voice_data_tracking')
        .select('*', { count: 'exact', head: true })
        .lt('processing_started_at', new Date(Date.now() - 60000).toISOString())
        .neq('status', 'deleted'),
      
      // Old transcripts not anonymized (older than 1 year)
      this.client
        .from('feedback_sessions')
        .select('*', { count: 'exact', head: true })
        .lt('created_at', new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString())
        .not('transcript', 'is', null)
        .is('transcript_anonymized_at', null)
    ]);

    if (customersResult.error) throw customersResult.error;
    if (consentedCustomersResult.error) throw consentedCustomersResult.error;
    if (pendingRequestsResult.error) throw pendingRequestsResult.error;
    if (oldVoiceDataResult.error) throw oldVoiceDataResult.error;
    if (unanonymizedTranscriptsResult.error) throw unanonymizedTranscriptsResult.error;

    return {
      totalCustomers: customersResult.count || 0,
      customersWithConsent: consentedCustomersResult.count || 0,
      pendingDataRequests: pendingRequestsResult.count || 0,
      voiceDataNotDeleted: oldVoiceDataResult.count || 0,
      transcriptsNotAnonymized: unanonymizedTranscriptsResult.count || 0
    };
  }
}

// Export default instance
export const gdprDb = new GDPRDatabaseService();