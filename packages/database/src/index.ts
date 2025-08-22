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
    return Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
  }
}

// Export default instance
export const db = new DatabaseService();

// Export types
export type { Database } from './types';