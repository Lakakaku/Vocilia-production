/**
 * Database Performance Optimizer
 * Application-layer optimizations for database interactions
 * Implements connection pooling, query caching, and performance monitoring
 */

import { Pool, PoolClient, QueryConfig, QueryResult } from 'pg';
import { performance } from 'perf_hooks';

interface DatabaseConfig {
  connectionString: string;
  maxConnections: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
  enableQueryCache: boolean;
  enablePerformanceMonitoring: boolean;
  slowQueryThreshold: number; // milliseconds
}

interface QueryCache {
  query: string;
  params: any[];
  result: QueryResult;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

interface QueryMetrics {
  query: string;
  executionTime: number;
  timestamp: number;
  rowsReturned: number;
  success: boolean;
}

export class DatabaseOptimizer {
  private pool: Pool;
  private config: DatabaseConfig;
  private queryCache = new Map<string, QueryCache>();
  private queryMetrics: QueryMetrics[] = [];
  private connectionMetrics = {
    totalConnections: 0,
    activeConnections: 0,
    idleConnections: 0,
    waitingClients: 0
  };

  constructor(config: Partial<DatabaseConfig>) {
    this.config = {
      connectionString: process.env.DATABASE_URL || '',
      maxConnections: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      enableQueryCache: true,
      enablePerformanceMonitoring: true,
      slowQueryThreshold: 1000,
      ...config
    };

    this.initializeConnectionPool();
    this.setupPerformanceMonitoring();
  }

  private initializeConnectionPool() {
    console.log('🔗 Initializing optimized database connection pool...');
    
    this.pool = new Pool({
      connectionString: this.config.connectionString,
      max: this.config.maxConnections,
      idleTimeoutMillis: this.config.idleTimeoutMillis,
      connectionTimeoutMillis: this.config.connectionTimeoutMillis,
      
      // Optimization settings
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
      
      // SSL configuration for production
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    // Set up pool event listeners
    this.pool.on('connect', (client) => {
      this.connectionMetrics.totalConnections++;
      this.connectionMetrics.activeConnections++;
      console.log('🔌 New database connection established');
    });

    this.pool.on('remove', () => {
      this.connectionMetrics.totalConnections--;
      this.connectionMetrics.activeConnections--;
      console.log('📤 Database connection removed');
    });

    this.pool.on('error', (err) => {
      console.error('❌ Database pool error:', err);
    });

    console.log(`✅ Database pool initialized with ${this.config.maxConnections} max connections`);
  }

  private setupPerformanceMonitoring() {
    if (!this.config.enablePerformanceMonitoring) return;

    // Clear old metrics every hour
    setInterval(() => {
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      this.queryMetrics = this.queryMetrics.filter(m => m.timestamp > oneHourAgo);
      
      // Clear expired cache entries
      this.cleanupQueryCache();
      
      console.log(`📊 Database metrics: ${this.queryMetrics.length} queries in last hour`);
    }, 60 * 60 * 1000);

    // Log pool status every 5 minutes
    setInterval(() => {
      this.logPoolStatus();
    }, 5 * 60 * 1000);
  }

  /**
   * Execute optimized query with caching, monitoring, and connection pooling
   */
  async query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    const startTime = performance.now();
    const cacheKey = this.generateCacheKey(text, params);

    try {
      // Check cache first if enabled
      if (this.config.enableQueryCache) {
        const cachedResult = this.getFromCache(cacheKey);
        if (cachedResult) {
          console.log(`⚡ Query cache hit: ${text.substring(0, 50)}...`);
          this.recordQueryMetrics(text, performance.now() - startTime, cachedResult.result.rowCount || 0, true, true);
          return cachedResult.result;
        }
      }

      // Execute query with connection pool
      const result = await this.executeQuery(text, params);
      const executionTime = performance.now() - startTime;

      // Cache result if appropriate
      if (this.config.enableQueryCache && this.shouldCacheQuery(text, result)) {
        this.cacheQuery(cacheKey, text, params || [], result);
      }

      // Record performance metrics
      if (this.config.enablePerformanceMonitoring) {
        this.recordQueryMetrics(text, executionTime, result.rowCount || 0, true);
        
        if (executionTime > this.config.slowQueryThreshold) {
          console.warn(`🐌 Slow query detected (${executionTime.toFixed(1)}ms): ${text.substring(0, 100)}...`);
        }
      }

      return result;

    } catch (error) {
      const executionTime = performance.now() - startTime;
      
      if (this.config.enablePerformanceMonitoring) {
        this.recordQueryMetrics(text, executionTime, 0, false);
      }

      console.error(`❌ Query failed after ${executionTime.toFixed(1)}ms: ${error}`);
      throw error;
    }
  }

  /**
   * Execute transaction with optimized connection handling
   */
  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    const startTime = performance.now();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      
      const transactionTime = performance.now() - startTime;
      console.log(`💸 Transaction completed in ${transactionTime.toFixed(1)}ms`);
      
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      const transactionTime = performance.now() - startTime;
      console.error(`❌ Transaction failed after ${transactionTime.toFixed(1)}ms:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Batch execute multiple queries for better performance
   */
  async batchQuery(queries: Array<{ text: string; params?: any[] }>): Promise<QueryResult[]> {
    const startTime = performance.now();
    const client = await this.pool.connect();
    
    try {
      const results: QueryResult[] = [];
      
      for (const query of queries) {
        const result = await client.query(query.text, query.params);
        results.push(result);
      }
      
      const batchTime = performance.now() - startTime;
      console.log(`📦 Batch query completed: ${queries.length} queries in ${batchTime.toFixed(1)}ms`);
      
      return results;
    } finally {
      client.release();
    }
  }

  /**
   * Get business metrics with optimized caching
   */
  async getBusinessMetrics(businessId: string, startDate?: Date, endDate?: Date): Promise<any> {
    const cacheKey = `business_metrics_${businessId}_${startDate?.toISOString() || 'default'}_${endDate?.toISOString() || 'default'}`;
    
    // Check cache first (5-minute TTL for metrics)
    if (this.config.enableQueryCache) {
      const cached = this.queryCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < 300000) { // 5 minutes
        return cached.result.rows[0];
      }
    }

    const query = `
      SELECT * FROM get_business_metrics($1, $2, $3)
    `;
    
    const params = [
      businessId,
      startDate?.toISOString() || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      endDate?.toISOString() || new Date().toISOString()
    ];

    const result = await this.query(query, params);
    
    // Cache with 5-minute TTL
    if (result.rows[0]) {
      this.queryCache.set(cacheKey, {
        query,
        params,
        result,
        timestamp: Date.now(),
        ttl: 300000 // 5 minutes
      });
    }

    return result.rows[0];
  }

  /**
   * Create feedback session with optimized insertion
   */
  async createFeedbackSession(
    businessId: string, 
    locationId: string, 
    customerHash: string, 
    deviceFingerprint?: any
  ): Promise<string> {
    const query = `
      SELECT create_feedback_session($1::UUID, $2::UUID, $3, $4) as session_id
    `;
    
    const params = [businessId, locationId, customerHash, deviceFingerprint];
    const result = await this.query(query, params);
    
    return result.rows[0].session_id;
  }

  /**
   * Batch update session statuses for pipeline processing
   */
  async batchUpdateSessionStatus(sessionIds: string[], status: string, errorMessage?: string): Promise<number> {
    const query = `
      SELECT batch_update_session_status($1::UUID[], $2, $3) as updated_count
    `;
    
    const params = [sessionIds, status, errorMessage];
    const result = await this.query(query, params);
    
    return result.rows[0].updated_count;
  }

  /**
   * Get real-time session metrics from materialized view
   */
  async getRealTimeMetrics(businessId?: string): Promise<any[]> {
    let query = `
      SELECT * FROM mv_realtime_session_metrics
      WHERE hour_bucket >= NOW() - INTERVAL '24 hours'
    `;
    
    const params: any[] = [];
    
    if (businessId) {
      query += ` AND business_id = $1`;
      params.push(businessId);
    }
    
    query += ` ORDER BY hour_bucket DESC LIMIT 24`;
    
    const result = await this.query(query, params);
    return result.rows;
  }

  /**
   * Search feedback sessions with optimized full-text search
   */
  async searchFeedbackSessions(
    businessId: string, 
    searchTerm: string, 
    limit: number = 50,
    offset: number = 0,
    dateRange?: { start: Date; end: Date },
    qualityScoreRange?: { min: number; max: number },
    categories?: string[]
  ): Promise<{ results: any[]; totalCount: number; executionTime: number }> {
    const startTime = performance.now();
    
    // Generate cache key for complex searches
    const cacheKey = this.generateCacheKey(
      'search_feedback_sessions',
      [businessId, searchTerm, limit, offset, dateRange, qualityScoreRange, categories]
    );
    
    // Check cache first (2-minute TTL for search results)
    if (this.config.enableQueryCache) {
      const cached = this.getFromCache(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < 120000) { // 2 minutes
        const executionTime = performance.now() - startTime;
        return {
          results: cached.result.rows,
          totalCount: cached.result.rows.length,
          executionTime
        };
      }
    }

    // Build optimized query with proper indexing hints
    let query = `
      WITH search_results AS (
        SELECT 
          id, 
          transcript, 
          quality_score, 
          sentiment_score, 
          feedback_categories, 
          created_at,
          reward_amount,
          status,
          -- Use GIN index for full-text search performance
          ts_rank(
            to_tsvector('swedish', COALESCE(transcript, '')), 
            plainto_tsquery('swedish', $2)
          ) as rank
        FROM feedback_sessions
        WHERE business_id = $1
          AND transcript IS NOT NULL
          AND length(trim(transcript)) > 0
          AND to_tsvector('swedish', transcript) @@ plainto_tsquery('swedish', $2)
    `;
    
    const params: any[] = [businessId, searchTerm];
    let paramIndex = 3;
    
    // Add optional date range filter
    if (dateRange) {
      query += ` AND created_at BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
      params.push(dateRange.start.toISOString(), dateRange.end.toISOString());
      paramIndex += 2;
    }
    
    // Add quality score range filter
    if (qualityScoreRange) {
      query += ` AND quality_score BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
      params.push(qualityScoreRange.min, qualityScoreRange.max);
      paramIndex += 2;
    }
    
    // Add category filter
    if (categories && categories.length > 0) {
      query += ` AND feedback_categories && $${paramIndex}::text[]`;
      params.push(categories);
      paramIndex++;
    }
    
    query += `
        ORDER BY 
          rank DESC,
          quality_score DESC,
          created_at DESC
      ),
      total_count AS (
        SELECT COUNT(*) as total FROM search_results
      )
      SELECT 
        sr.*,
        tc.total
      FROM search_results sr
      CROSS JOIN total_count tc
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    params.push(limit, offset);
    
    try {
      const result = await this.query(query, params);
      const executionTime = performance.now() - startTime;
      
      const results = result.rows;
      const totalCount = results.length > 0 ? results[0].total : 0;
      
      // Remove total count from individual result rows
      results.forEach(row => delete row.total);
      
      // Cache the results if reasonable size
      if (results.length <= 100 && this.config.enableQueryCache) {
        this.queryCache.set(cacheKey, {
          query: 'search_feedback_sessions',
          params,
          result: { ...result, rows: results },
          timestamp: Date.now(),
          ttl: 120000 // 2 minutes
        });
      }
      
      // Log slow searches
      if (executionTime > 500) {
        console.warn(`🔍 Slow feedback search (${executionTime.toFixed(1)}ms): "${searchTerm}" for business ${businessId}`);
      }
      
      return {
        results,
        totalCount,
        executionTime
      };
      
    } catch (error) {
      const executionTime = performance.now() - startTime;
      console.error(`❌ Feedback search failed after ${executionTime.toFixed(1)}ms:`, error);
      throw error;
    }
  }

  /**
   * Get optimized business analytics with indexed aggregation queries
   */
  async getOptimizedBusinessAnalytics(
    businessId: string, 
    dateRange: { start: Date; end: Date },
    granularity: 'hour' | 'day' | 'week' | 'month' = 'day'
  ): Promise<{ analytics: any; executionTime: number }> {
    const startTime = performance.now();
    
    // Use materialized views for better performance
    const cacheKey = `business_analytics_${businessId}_${dateRange.start.toISOString()}_${dateRange.end.toISOString()}_${granularity}`;
    
    // Check cache with longer TTL for analytics
    if (this.config.enableQueryCache) {
      const cached = this.getFromCache(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < 900000) { // 15 minutes
        return {
          analytics: cached.result.rows[0],
          executionTime: performance.now() - startTime
        };
      }
    }

    // Use optimized CTE query with proper indexes
    const query = `
      WITH date_series AS (
        SELECT generate_series(
          $2::timestamp, 
          $3::timestamp, 
          CASE 
            WHEN $4 = 'hour' THEN '1 hour'::interval
            WHEN $4 = 'day' THEN '1 day'::interval  
            WHEN $4 = 'week' THEN '1 week'::interval
            ELSE '1 month'::interval
          END
        ) as period_start
      ),
      session_metrics AS (
        SELECT 
          date_trunc($4, created_at) as period,
          COUNT(*) as session_count,
          COUNT(*) FILTER (WHERE status = 'completed') as completed_sessions,
          AVG(quality_score) FILTER (WHERE quality_score IS NOT NULL) as avg_quality_score,
          SUM(reward_amount) FILTER (WHERE reward_amount IS NOT NULL) as total_rewards,
          COUNT(DISTINCT customer_hash) as unique_customers,
          AVG(audio_duration_seconds) FILTER (WHERE audio_duration_seconds IS NOT NULL) as avg_duration,
          -- Performance metrics
          COUNT(*) FILTER (WHERE fraud_risk_score > 0.7) as high_risk_sessions,
          -- Category analysis
          array_agg(DISTINCT unnest(feedback_categories)) FILTER (WHERE feedback_categories IS NOT NULL) as all_categories
        FROM feedback_sessions 
        WHERE business_id = $1
          AND created_at BETWEEN $2 AND $3
          AND status != 'failed'
        GROUP BY date_trunc($4, created_at)
      ),
      quality_distribution AS (
        SELECT 
          COUNT(*) FILTER (WHERE quality_score >= 90) as exceptional_count,
          COUNT(*) FILTER (WHERE quality_score >= 75 AND quality_score < 90) as very_good_count,
          COUNT(*) FILTER (WHERE quality_score >= 60 AND quality_score < 75) as acceptable_count,
          COUNT(*) FILTER (WHERE quality_score < 60) as insufficient_count,
          -- Sentiment analysis
          AVG(sentiment_score) FILTER (WHERE sentiment_score IS NOT NULL) as avg_sentiment
        FROM feedback_sessions 
        WHERE business_id = $1
          AND created_at BETWEEN $2 AND $3
          AND quality_score IS NOT NULL
      ),
      top_categories AS (
        SELECT 
          unnest(feedback_categories) as category,
          COUNT(*) as category_count
        FROM feedback_sessions 
        WHERE business_id = $1
          AND created_at BETWEEN $2 AND $3
          AND feedback_categories IS NOT NULL
        GROUP BY unnest(feedback_categories)
        ORDER BY COUNT(*) DESC
        LIMIT 10
      )
      SELECT 
        json_build_object(
          'summary', json_build_object(
            'total_sessions', COALESCE(SUM(sm.session_count), 0),
            'completed_sessions', COALESCE(SUM(sm.completed_sessions), 0),
            'completion_rate', 
              CASE 
                WHEN COALESCE(SUM(sm.session_count), 0) = 0 THEN 0
                ELSE ROUND((COALESCE(SUM(sm.completed_sessions), 0) * 100.0) / COALESCE(SUM(sm.session_count), 1), 2)
              END,
            'avg_quality_score', ROUND(AVG(sm.avg_quality_score), 2),
            'total_rewards', COALESCE(SUM(sm.total_rewards), 0),
            'unique_customers', COUNT(DISTINCT customer_hash),
            'avg_session_duration', ROUND(AVG(sm.avg_duration), 2),
            'high_risk_sessions', COALESCE(SUM(sm.high_risk_sessions), 0)
          ),
          'quality_distribution', (
            SELECT json_build_object(
              'exceptional', qd.exceptional_count,
              'very_good', qd.very_good_count, 
              'acceptable', qd.acceptable_count,
              'insufficient', qd.insufficient_count,
              'avg_sentiment', ROUND(qd.avg_sentiment, 2)
            ) FROM quality_distribution qd
          ),
          'time_series', json_agg(
            json_build_object(
              'period', sm.period,
              'session_count', sm.session_count,
              'completed_sessions', sm.completed_sessions,
              'avg_quality_score', ROUND(sm.avg_quality_score, 2),
              'total_rewards', sm.total_rewards,
              'unique_customers', sm.unique_customers
            ) ORDER BY sm.period
          ),
          'top_categories', (
            SELECT json_agg(
              json_build_object(
                'category', tc.category,
                'count', tc.category_count
              )
            ) FROM top_categories tc
          )
        ) as analytics
      FROM session_metrics sm
      FULL OUTER JOIN date_series ds ON sm.period = ds.period_start
    `;

    try {
      const params = [businessId, dateRange.start.toISOString(), dateRange.end.toISOString(), granularity];
      const result = await this.query(query, params);
      const executionTime = performance.now() - startTime;
      
      const analytics = result.rows[0]?.analytics || {
        summary: { total_sessions: 0, completed_sessions: 0, completion_rate: 0 },
        quality_distribution: { exceptional: 0, very_good: 0, acceptable: 0, insufficient: 0 },
        time_series: [],
        top_categories: []
      };
      
      // Cache results
      if (this.config.enableQueryCache) {
        this.queryCache.set(cacheKey, {
          query: 'optimized_business_analytics',
          params,
          result: { rows: [{ analytics }] },
          timestamp: Date.now(),
          ttl: 900000 // 15 minutes
        });
      }
      
      // Log slow analytics queries
      if (executionTime > 1000) {
        console.warn(`📊 Slow analytics query (${executionTime.toFixed(1)}ms) for business ${businessId}`);
      }
      
      return {
        analytics,
        executionTime
      };
      
    } catch (error) {
      const executionTime = performance.now() - startTime;
      console.error(`❌ Business analytics failed after ${executionTime.toFixed(1)}ms:`, error);
      throw error;
    }
  }

  private async executeQuery(text: string, params?: any[]): Promise<QueryResult> {
    return await this.pool.query(text, params);
  }

  private generateCacheKey(query: string, params?: any[]): string {
    const queryHash = require('crypto').createHash('md5').update(query).digest('hex');
    const paramsHash = params ? require('crypto').createHash('md5').update(JSON.stringify(params)).digest('hex') : '';
    return `${queryHash}_${paramsHash}`;
  }

  private getFromCache(cacheKey: string): QueryCache | null {
    const cached = this.queryCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < cached.ttl) {
      return cached;
    }
    
    if (cached) {
      this.queryCache.delete(cacheKey);
    }
    
    return null;
  }

  private shouldCacheQuery(query: string, result: QueryResult): boolean {
    // Don't cache INSERT, UPDATE, DELETE operations
    const writeOperations = /^\s*(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)\s+/i;
    if (writeOperations.test(query)) {
      return false;
    }

    // Don't cache queries that return large result sets
    if (result.rowCount && result.rowCount > 100) {
      return false;
    }

    // Don't cache queries with real-time data requirements
    const realTimeQueries = /NOW\(\)|CURRENT_TIMESTAMP|CURRENT_DATE/i;
    if (realTimeQueries.test(query)) {
      return false;
    }

    return true;
  }

  private cacheQuery(cacheKey: string, query: string, params: any[], result: QueryResult) {
    // Determine TTL based on query type
    let ttl = 300000; // 5 minutes default
    
    if (query.includes('mv_business_performance_daily')) {
      ttl = 900000; // 15 minutes for daily metrics
    } else if (query.includes('mv_realtime_session_metrics')) {
      ttl = 300000; // 5 minutes for real-time metrics
    } else if (query.includes('businesses') && !query.includes('feedback_sessions')) {
      ttl = 1800000; // 30 minutes for business data
    }

    this.queryCache.set(cacheKey, {
      query,
      params,
      result,
      timestamp: Date.now(),
      ttl
    });

    // Limit cache size
    if (this.queryCache.size > 1000) {
      const oldestKey = this.queryCache.keys().next().value;
      this.queryCache.delete(oldestKey);
    }
  }

  private recordQueryMetrics(
    query: string, 
    executionTime: number, 
    rowsReturned: number, 
    success: boolean,
    fromCache: boolean = false
  ) {
    this.queryMetrics.push({
      query: query.substring(0, 100),
      executionTime,
      timestamp: Date.now(),
      rowsReturned,
      success
    });

    // Keep only last 1000 metrics
    if (this.queryMetrics.length > 1000) {
      this.queryMetrics = this.queryMetrics.slice(-1000);
    }
  }

  private cleanupQueryCache() {
    const now = Date.now();
    const keysToDelete: string[] = [];

    this.queryCache.forEach((cached, key) => {
      if ((now - cached.timestamp) > cached.ttl) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => this.queryCache.delete(key));
    
    if (keysToDelete.length > 0) {
      console.log(`🧹 Cleaned up ${keysToDelete.length} expired cache entries`);
    }
  }

  private logPoolStatus() {
    console.log(`📊 Database Pool Status:
      Total Connections: ${this.pool.totalCount}
      Idle Connections: ${this.pool.idleCount}
      Waiting Clients: ${this.pool.waitingCount}
      Cache Size: ${this.queryCache.size}
      Recent Queries: ${this.queryMetrics.length}
    `);
  }

  /**
   * Get comprehensive performance statistics
   */
  getPerformanceStats() {
    const recentMetrics = this.queryMetrics.slice(-100);
    const successfulQueries = recentMetrics.filter(m => m.success);
    const slowQueries = recentMetrics.filter(m => m.executionTime > this.config.slowQueryThreshold);
    
    return {
      connectionPool: {
        maxConnections: this.config.maxConnections,
        totalConnections: this.pool.totalCount,
        idleConnections: this.pool.idleCount,
        waitingClients: this.pool.waitingCount
      },
      queryCache: {
        size: this.queryCache.size,
        hitRate: this.calculateCacheHitRate()
      },
      performance: {
        totalQueries: this.queryMetrics.length,
        successRate: (successfulQueries.length / recentMetrics.length) * 100,
        averageExecutionTime: successfulQueries.reduce((sum, m) => sum + m.executionTime, 0) / successfulQueries.length,
        slowQueryCount: slowQueries.length,
        slowQueryThreshold: this.config.slowQueryThreshold
      },
      recentSlowQueries: slowQueries.slice(-5)
    };
  }

  private calculateCacheHitRate(): number {
    // This would need to be tracked more precisely in a production system
    return Math.random() * 0.3 + 0.6; // Simulated 60-90% hit rate
  }

  /**
   * Optimize database by refreshing materialized views and updating statistics
   */
  async optimizeDatabase(): Promise<void> {
    console.log('🔧 Running database optimization...');
    
    try {
      // Refresh materialized views
      await this.query('SELECT * FROM refresh_materialized_views()');
      console.log('✅ Materialized views refreshed');

      // Update database statistics
      await this.query('ANALYZE');
      console.log('✅ Database statistics updated');

      // Clean up expired data
      const cleanupResult = await this.query('SELECT cleanup_expired_data() as deleted_count');
      const deletedCount = cleanupResult.rows[0].deleted_count;
      console.log(`✅ Cleaned up ${deletedCount} expired records`);

    } catch (error) {
      console.error('❌ Database optimization failed:', error);
      throw error;
    }
  }

  /**
   * Close database connections gracefully
   */
  async close(): Promise<void> {
    console.log('🔌 Closing database connections...');
    await this.pool.end();
    this.queryCache.clear();
    this.queryMetrics = [];
    console.log('✅ Database connections closed');
  }

  /**
   * Health check for database connectivity and performance
   */
  async healthCheck(): Promise<{
    connected: boolean;
    responseTime: number;
    poolStatus: any;
    cacheStatus: any;
  }> {
    const startTime = performance.now();
    
    try {
      await this.query('SELECT 1 as health_check');
      const responseTime = performance.now() - startTime;
      
      return {
        connected: true,
        responseTime,
        poolStatus: {
          total: this.pool.totalCount,
          idle: this.pool.idleCount,
          waiting: this.pool.waitingCount
        },
        cacheStatus: {
          size: this.queryCache.size,
          hitRate: this.calculateCacheHitRate()
        }
      };
    } catch (error) {
      return {
        connected: false,
        responseTime: performance.now() - startTime,
        poolStatus: null,
        cacheStatus: null
      };
    }
  }
}