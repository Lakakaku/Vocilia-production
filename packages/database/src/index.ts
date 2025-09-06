import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import type { Business, FeedbackSession, POSConnection } from '@ai-feedback/shared-types';

// Supabase client configuration
export const createSupabaseClient = (
  url: string = process.env.SUPABASE_URL!,
  key: string = process.env.SUPABASE_ANON_KEY!
) => {
  return createClient<Database>(url, key);
};

// Service role client for admin operations
export const createSupabaseServiceClient = (
  url: string = process.env.SUPABASE_URL!,
  key: string = process.env.SUPABASE_SERVICE_ROLE_KEY!
) => {
  return createClient<Database>(url, key);
};

// Database operations class
export class DatabaseService {
  private client: ReturnType<typeof createSupabaseClient>;
  
  constructor(client?: ReturnType<typeof createSupabaseClient>) {
    this.client = client || createSupabaseClient();
  }

  // Business operations
  async createBusiness(business: Omit<Business, 'id' | 'createdAt' | 'updatedAt'>) {
    const { data, error } = await this.client
      .from('businesses')
      .insert([business])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  async getBusiness(id: string) {
    const { data, error } = await this.client
      .from('businesses')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  }

  async updateBusiness(id: string, updates: Partial<Business>) {
    const { data, error } = await this.client
      .from('businesses')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  // Feedback session operations
  async createFeedbackSession(session: Omit<FeedbackSession, 'id' | 'createdAt' | 'updatedAt'>) {
    const { data, error } = await this.client
      .from('feedback_sessions')
      .insert([session])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  async getFeedbackSession(id: string) {
    const { data, error } = await this.client
      .from('feedback_sessions')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  }

  async updateFeedbackSession(id: string, updates: Partial<FeedbackSession>) {
    const { data, error } = await this.client
      .from('feedback_sessions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  async getFeedbackSessionsByBusiness(businessId: string, limit = 50) {
    const { data, error } = await this.client
      .from('feedback_sessions')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return data;
  }

  // Get feedback with proper verification filtering for delayed delivery
  async getFeedbackSessionsWithVerification(businessId: string, limit = 50, includeUnverified = false) {
    let query = this.client
      .from('feedback_sessions')
      .select(`
        *,
        simple_verification:simple_verifications!left (
          id,
          review_status,
          billing_batch_id,
          monthly_billing_batch:monthly_billing_batches!billing_batch_id (
            status
          )
        )
      `)
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(limit);

    const { data, error } = await query;
    if (error) throw error;

    // Filter based on verification status
    if (!includeUnverified) {
      return data?.filter(session => {
        // Always include POS integration sessions (immediate feedback)
        if (session.verification_type !== 'simple_verification') {
          return true;
        }

        // For simple verification, only include if verified AND batch is completed
        const verification = session.simple_verification;
        if (!verification) return false;

        const isVerified = ['approved', 'auto_approved'].includes(verification.review_status);
        const isBatchCompleted = verification.monthly_billing_batch?.status === 'completed';
        
        return isVerified && isBatchCompleted;
      }) || [];
    }

    return data || [];
  }

  // Get pending feedback awaiting verification release
  async getPendingFeedbackSessions(businessId: string) {
    const { data, error } = await this.client
      .from('feedback_sessions')
      .select(`
        *,
        simple_verification:simple_verifications!left (
          id,
          review_status,
          billing_batch_id,
          monthly_billing_batch:monthly_billing_batches!billing_batch_id (
            status,
            review_deadline
          )
        )
      `)
      .eq('business_id', businessId)
      .eq('verification_type', 'simple_verification')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Filter to only sessions that are verified but batch not yet completed
    return data?.filter(session => {
      const verification = session.simple_verification;
      if (!verification) return false;

      const isVerified = ['approved', 'auto_approved'].includes(verification.review_status);
      const isBatchCompleted = verification.monthly_billing_batch?.status === 'completed';
      
      return isVerified && !isBatchCompleted;
    }) || [];
  }

  // Release feedback for completed billing batch (batch delivery)
  async releaseFeedbackForBatch(batchId: string) {
    // This is handled automatically by the batch status change
    // When monthly_billing_batches.status changes to 'completed',
    // the feedback becomes available through getFeedbackSessionsWithVerification
    const { data, error } = await this.client
      .from('monthly_billing_batches')
      .select(`
        id,
        business_id,
        status,
        simple_verifications (
          id,
          session_id,
          feedback_session:feedback_sessions (
            id,
            quality_score,
            transcript,
            feedback_categories
          )
        )
      `)
      .eq('id', batchId)
      .single();

    if (error) throw error;

    if (data?.status === 'completed') {
      console.log(`Feedback batch released for business ${data.business_id}: ${data.simple_verifications.length} feedback sessions now available`);
      return {
        batchId,
        businessId: data.business_id,
        releasedFeedbackCount: data.simple_verifications.length,
        releasedAt: new Date().toISOString()
      };
    }

    return null;
  }

  // QR token validation
  async validateQRToken(token: string) {
    const { data, error } = await this.client
      .from('feedback_sessions')
      .select('id, business_id, qr_scanned_at, status')
      .eq('qr_token', token)
      .eq('status', 'qr_scanned')
      .single();
    
    if (error) throw error;
    
    // Check if token is still valid (15 minute window)
    const scannedAt = new Date(data.qr_scanned_at);
    const now = new Date();
    const diffMinutes = (now.getTime() - scannedAt.getTime()) / (1000 * 60);
    
    if (diffMinutes > 15) {
      throw new Error('QR token expired');
    }
    
    return data;
  }

  // POS connection operations
  async createPOSConnection(connection: Omit<POSConnection, 'id' | 'createdAt' | 'updatedAt'>) {
    const { data, error } = await this.client
      .from('pos_connections')
      .insert([connection])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  async getPOSConnections(businessId: string) {
    const { data, error } = await this.client
      .from('pos_connections')
      .select('*')
      .eq('business_id', businessId)
      .eq('active', true);
    
    if (error) throw error;
    return data;
  }

  // Analytics queries
  async getBusinessAnalytics(businessId: string, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const { data, error } = await this.client
      .from('feedback_sessions')
      .select('quality_score, reward_amount, feedback_categories, created_at')
      .eq('business_id', businessId)
      .eq('status', 'completed')
      .gte('created_at', startDate.toISOString());
    
    if (error) throw error;
    
    // Process analytics data
    const totalSessions = data.length;
    const averageQuality = data.reduce((sum, session) => sum + (session.quality_score || 0), 0) / totalSessions;
    const totalRewards = data.reduce((sum, session) => sum + (session.reward_amount || 0), 0);
    
    const categories = data.flatMap(session => session.feedback_categories || []);
    const categoryCount = categories.reduce((acc, category) => {
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return {
      totalSessions,
      averageQuality: Math.round(averageQuality * 100) / 100,
      totalRewards,
      topCategories: Object.entries(categoryCount)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([category, count]) => ({ category, count }))
    };
  }

  // Helper method to generate QR tokens
  generateQRToken(): string {
    // Generate a high-entropy token with timestamp prefix to prevent collisions
    const timestamp = Date.now().toString(36); // Base36 timestamp
    const randomBytes = crypto.getRandomValues(new Uint8Array(32));
    const randomString = Buffer.from(randomBytes).toString('base64url');
    
    // Combine timestamp with random data and truncate to reasonable length
    return `${timestamp}_${randomString}`.substring(0, 48);
  }

  // Enhanced method to generate unique QR tokens with collision detection
  async generateUniqueQRToken(maxAttempts: number = 5): Promise<string> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const token = this.generateQRToken();
      
      try {
        // Check if token already exists in database
        const { data, error } = await this.client
          .from('feedback_sessions')
          .select('id')
          .eq('qr_token', token)
          .maybeSingle();
        
        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found, which is what we want
          throw error;
        }
        
        // If no existing session found, token is unique
        if (!data) {
          if (attempt > 1) {
            console.log(`✅ Generated unique QR token on attempt ${attempt}: ${token.substring(0, 12)}...`);
          }
          return token;
        }
        
        console.log(`⚠️ QR token collision detected on attempt ${attempt}, retrying...`);
        
        // Add exponential backoff delay for subsequent attempts
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt - 1) * 100));
        }
      } catch (error) {
        console.error(`❌ Error checking QR token uniqueness on attempt ${attempt}:`, error);
        
        // On database errors, still try to continue with other attempts
        if (attempt === maxAttempts) {
          throw new Error(`Failed to generate unique QR token after ${maxAttempts} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    }
    
    throw new Error(`Failed to generate unique QR token after ${maxAttempts} attempts due to persistent collisions`);
  }

  // Enhanced session creation with collision-resistant token generation
  async createFeedbackSessionWithUniqueToken(session: Omit<FeedbackSession, 'id' | 'createdAt' | 'updatedAt' | 'qrToken'>) {
    const maxRetries = 3;
    
    for (let retry = 1; retry <= maxRetries; retry++) {
      try {
        // Generate unique QR token
        const qrToken = await this.generateUniqueQRToken();
        
        // Create session with unique token
        const sessionWithToken = {
          ...session,
          qrToken
        };
        
        const { data, error } = await this.client
          .from('feedback_sessions')
          .insert([sessionWithToken])
          .select()
          .single();
        
        if (error) {
          // Check if it's a unique constraint violation on qr_token
          if (error.code === '23505' && error.message.includes('qr_token')) {
            console.log(`⚠️ QR token constraint violation on retry ${retry}, generating new token...`);
            
            if (retry < maxRetries) {
              // Wait a bit before retrying
              await new Promise(resolve => setTimeout(resolve, retry * 200));
              continue;
            }
          }
          throw error;
        }
        
        if (retry > 1) {
          console.log(`✅ Feedback session created successfully on retry ${retry}`);
        }
        
        return data;
      } catch (error) {
        if (retry === maxRetries) {
          throw new Error(`Failed to create feedback session after ${maxRetries} retries: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    }
  }
}

// Export default instance
export const db = new DatabaseService();

// Export GDPR database service
export { GDPRDatabaseService, gdprDb } from './GDPRDatabaseService';

// Export types
export type { Database } from './types';