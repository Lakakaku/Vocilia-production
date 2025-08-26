-- Advanced Database Query Optimization for AI Feedback Platform
-- Implements comprehensive indexing, partitioning, and performance strategies
-- Designed to handle high-throughput load (1000+ RPS) and concurrent voice sessions

-- ============================================================================
-- PHASE 1: ADVANCED INDEXING STRATEGIES
-- ============================================================================

-- Composite indexes for common query patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_feedback_sessions_composite_status 
    ON feedback_sessions(business_id, status, created_at DESC)
    WHERE status IN ('processing', 'completed');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_feedback_sessions_composite_quality 
    ON feedback_sessions(business_id, quality_score DESC, created_at DESC)
    WHERE quality_score IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_feedback_sessions_composite_fraud 
    ON feedback_sessions(fraud_risk_score DESC, status, created_at DESC)
    WHERE fraud_risk_score > 0.5;

-- Partial indexes for active/frequent queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_feedback_sessions_active_processing 
    ON feedback_sessions(created_at DESC, business_id)
    WHERE status = 'processing' AND created_at > NOW() - INTERVAL '1 hour';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_feedback_sessions_recent_completed 
    ON feedback_sessions(business_id, quality_score DESC, reward_amount DESC)
    WHERE status = 'completed' AND completed_at > NOW() - INTERVAL '24 hours';

-- Covering indexes to avoid table lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_feedback_sessions_business_summary 
    ON feedback_sessions(business_id, created_at DESC)
    INCLUDE (quality_score, reward_amount, status, sentiment_score);

-- GIN indexes for JSONB fields (common for analytics)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_feedback_sessions_ai_evaluation_gin 
    ON feedback_sessions USING GIN (ai_evaluation);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_feedback_sessions_fraud_flags_gin 
    ON feedback_sessions USING GIN (fraud_flags);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_businesses_reward_settings_gin 
    ON businesses USING GIN (reward_settings);

-- Text search indexes for feedback content
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_feedback_sessions_transcript_fts 
    ON feedback_sessions USING GIN (to_tsvector('swedish', transcript))
    WHERE transcript IS NOT NULL;

-- Specialized indexes for real-time analytics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_platform_metrics_realtime 
    ON platform_metrics(metric_type, date DESC, business_id)
    WHERE date >= CURRENT_DATE - INTERVAL '7 days';

-- ============================================================================
-- PHASE 2: TABLE PARTITIONING FOR LARGE DATASETS
-- ============================================================================

-- Partition feedback_sessions by date for better performance and maintenance
-- This will significantly improve query performance for time-based queries

-- Create partitioned table structure
CREATE TABLE IF NOT EXISTS feedback_sessions_partitioned (
    LIKE feedback_sessions INCLUDING ALL
) PARTITION BY RANGE (created_at);

-- Create monthly partitions for current and future months
DO $$
DECLARE 
    start_date DATE;
    end_date DATE;
    partition_name TEXT;
BEGIN
    -- Create partitions for current month and next 6 months
    FOR i IN 0..6 LOOP
        start_date := DATE_TRUNC('month', CURRENT_DATE + (i || ' months')::INTERVAL);
        end_date := start_date + INTERVAL '1 month';
        partition_name := 'feedback_sessions_y' || EXTRACT(YEAR FROM start_date) || 
                         'm' || LPAD(EXTRACT(MONTH FROM start_date)::TEXT, 2, '0');
        
        EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF feedback_sessions_partitioned 
                       FOR VALUES FROM (%L) TO (%L)', 
                       partition_name, start_date, end_date);
    END LOOP;
END $$;

-- Create indexes on each partition (automatically inherited)
-- PostgreSQL will automatically create indexes on partitions

-- ============================================================================
-- PHASE 3: MATERIALIZED VIEWS FOR ANALYTICS
-- ============================================================================

-- Business performance summary (refreshed every 15 minutes)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_business_performance_daily AS
SELECT 
    b.id as business_id,
    b.name as business_name,
    DATE(fs.created_at) as date,
    COUNT(*) as total_sessions,
    COUNT(*) FILTER (WHERE fs.status = 'completed') as completed_sessions,
    ROUND(AVG(fs.quality_score), 2) as avg_quality_score,
    ROUND(SUM(fs.reward_amount), 2) as total_rewards_paid,
    ROUND(AVG(fs.sentiment_score), 3) as avg_sentiment,
    COUNT(*) FILTER (WHERE fs.fraud_risk_score > 0.7) as high_risk_sessions,
    ARRAY_AGG(DISTINCT unnest(fs.feedback_categories)) FILTER (WHERE fs.feedback_categories IS NOT NULL) as common_categories
FROM businesses b
LEFT JOIN feedback_sessions fs ON b.id = fs.business_id
WHERE fs.created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY b.id, b.name, DATE(fs.created_at)
ORDER BY date DESC, total_sessions DESC;

-- Create unique index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_business_performance_daily_pk 
    ON mv_business_performance_daily(business_id, date);

-- Real-time session metrics (refreshed every 5 minutes)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_realtime_session_metrics AS
SELECT 
    DATE_TRUNC('hour', created_at) as hour_bucket,
    business_id,
    COUNT(*) as sessions_per_hour,
    COUNT(*) FILTER (WHERE status = 'processing') as currently_processing,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_this_hour,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_this_hour,
    ROUND(AVG(quality_score) FILTER (WHERE quality_score IS NOT NULL), 1) as avg_quality,
    ROUND(SUM(reward_amount) FILTER (WHERE reward_amount IS NOT NULL), 2) as rewards_this_hour,
    COUNT(*) FILTER (WHERE fraud_risk_score > 0.5) as potential_fraud_sessions
FROM feedback_sessions
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', created_at), business_id
ORDER BY hour_bucket DESC;

-- Create indexes on real-time metrics
CREATE INDEX IF NOT EXISTS idx_mv_realtime_session_metrics_hour 
    ON mv_realtime_session_metrics(hour_bucket DESC, business_id);

-- Platform-wide performance metrics
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_platform_performance_hourly AS
SELECT 
    DATE_TRUNC('hour', created_at) as hour_bucket,
    COUNT(*) as total_sessions,
    COUNT(DISTINCT business_id) as active_businesses,
    COUNT(DISTINCT customer_hash) as unique_customers,
    ROUND(AVG(EXTRACT(EPOCH FROM (completed_at - created_at))) FILTER (WHERE completed_at IS NOT NULL), 1) as avg_session_duration_seconds,
    ROUND(AVG(quality_score) FILTER (WHERE quality_score IS NOT NULL), 2) as platform_avg_quality,
    COUNT(*) FILTER (WHERE fraud_risk_score > 0.7) as high_risk_sessions,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_sessions,
    ROUND(SUM(reward_amount) FILTER (WHERE reward_amount IS NOT NULL), 2) as total_platform_rewards
FROM feedback_sessions
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE_TRUNC('hour', created_at)
ORDER BY hour_bucket DESC;

-- ============================================================================
-- PHASE 4: STORED PROCEDURES FOR COMMON OPERATIONS
-- ============================================================================

-- High-performance session creation with conflict handling
CREATE OR REPLACE FUNCTION create_feedback_session(
    p_business_id UUID,
    p_location_id UUID,
    p_customer_hash TEXT,
    p_device_fingerprint JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_session_id UUID;
    v_qr_token TEXT;
BEGIN
    -- Generate unique QR token
    v_qr_token := generate_qr_token();
    
    -- Insert new session with optimized locking
    INSERT INTO feedback_sessions (
        id, business_id, location_id, customer_hash, 
        device_fingerprint, qr_token, status
    ) VALUES (
        gen_random_uuid(), p_business_id, p_location_id, 
        p_customer_hash, p_device_fingerprint, v_qr_token, 'qr_scanned'
    ) RETURNING id INTO v_session_id;
    
    RETURN v_session_id;
END;
$$ LANGUAGE plpgsql;

-- Batch update session status for processing pipeline
CREATE OR REPLACE FUNCTION batch_update_session_status(
    p_session_ids UUID[],
    p_new_status TEXT,
    p_error_message TEXT DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
    v_updated_count INTEGER;
BEGIN
    UPDATE feedback_sessions 
    SET 
        status = p_new_status,
        error_message = COALESCE(p_error_message, error_message),
        updated_at = NOW()
    WHERE id = ANY(p_session_ids)
    AND status != p_new_status; -- Only update if status actually changed
    
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    RETURN v_updated_count;
END;
$$ LANGUAGE plpgsql;

-- Optimized business metrics calculation
CREATE OR REPLACE FUNCTION get_business_metrics(
    p_business_id UUID,
    p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
    p_end_date TIMESTAMPTZ DEFAULT NOW()
) RETURNS TABLE (
    total_sessions BIGINT,
    completed_sessions BIGINT,
    avg_quality_score NUMERIC,
    total_rewards NUMERIC,
    avg_processing_time NUMERIC,
    fraud_rate NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT,
        COUNT(*) FILTER (WHERE fs.status = 'completed')::BIGINT,
        ROUND(AVG(fs.quality_score), 2),
        ROUND(SUM(fs.reward_amount), 2),
        ROUND(AVG(EXTRACT(EPOCH FROM (fs.completed_at - fs.created_at))) FILTER (WHERE fs.completed_at IS NOT NULL), 1),
        ROUND((COUNT(*) FILTER (WHERE fs.fraud_risk_score > 0.7)::NUMERIC / NULLIF(COUNT(*), 0)) * 100, 2)
    FROM feedback_sessions fs
    WHERE fs.business_id = p_business_id
    AND fs.created_at BETWEEN p_start_date AND p_end_date;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PHASE 5: CONNECTION POOLING AND CACHING OPTIMIZATION
-- ============================================================================

-- Configure optimized database settings for high throughput
-- These would typically be set in postgresql.conf, but included here for reference

-- Connection and memory settings
/*
max_connections = 200
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
*/

-- Performance-oriented settings for feedback platform
/*
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 4MB
min_wal_size = 1GB
max_wal_size = 4GB
*/

-- ============================================================================
-- PHASE 6: AUTOMATIC MAINTENANCE PROCEDURES
-- ============================================================================

-- Automatic cleanup of old QR tokens and temporary data
CREATE OR REPLACE FUNCTION cleanup_expired_data()
RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER := 0;
    v_batch_size INTEGER := 1000;
    v_current_batch INTEGER;
BEGIN
    -- Clean up expired QR codes (older than 1 hour, not completed)
    LOOP
        DELETE FROM feedback_sessions 
        WHERE id IN (
            SELECT id FROM feedback_sessions 
            WHERE status = 'qr_scanned' 
            AND created_at < NOW() - INTERVAL '1 hour'
            LIMIT v_batch_size
        );
        
        GET DIAGNOSTICS v_current_batch = ROW_COUNT;
        v_deleted_count := v_deleted_count + v_current_batch;
        
        EXIT WHEN v_current_batch = 0;
    END LOOP;
    
    -- Clean up old audio URLs (privacy compliance)
    UPDATE feedback_sessions 
    SET audio_url = NULL
    WHERE audio_url IS NOT NULL 
    AND completed_at < NOW() - INTERVAL '24 hours';
    
    -- Archive old platform metrics (keep only 90 days)
    DELETE FROM platform_metrics 
    WHERE date < CURRENT_DATE - INTERVAL '90 days';
    
    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PHASE 7: PERFORMANCE MONITORING VIEWS
-- ============================================================================

-- Query performance monitoring
CREATE OR REPLACE VIEW v_slow_queries AS
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    stddev_time,
    min_time,
    max_time
FROM pg_stat_statements 
WHERE mean_time > 100 -- Queries taking more than 100ms on average
ORDER BY mean_time DESC
LIMIT 20;

-- Index usage monitoring
CREATE OR REPLACE VIEW v_unused_indexes AS
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_tup_read,
    idx_tup_fetch,
    pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes 
WHERE idx_tup_read = 0 
AND idx_tup_fetch = 0
ORDER BY pg_relation_size(indexrelid) DESC;

-- Table bloat monitoring  
CREATE OR REPLACE VIEW v_table_bloat AS
SELECT 
    tablename,
    pg_size_pretty(pg_total_relation_size(tablename::regclass)) as total_size,
    pg_size_pretty(pg_relation_size(tablename::regclass)) as table_size,
    round(100 * (pg_total_relation_size(tablename::regclass) - pg_relation_size(tablename::regclass))::numeric / 
          NULLIF(pg_total_relation_size(tablename::regclass), 0), 2) as bloat_percentage
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(tablename::regclass) DESC;

-- ============================================================================
-- PHASE 8: REFRESH PROCEDURES FOR MATERIALIZED VIEWS
-- ============================================================================

-- Procedure to refresh all materialized views
CREATE OR REPLACE FUNCTION refresh_materialized_views()
RETURNS TABLE (view_name TEXT, refresh_time INTERVAL) AS $$
DECLARE
    v_start_time TIMESTAMPTZ;
    v_end_time TIMESTAMPTZ;
BEGIN
    -- Refresh business performance daily
    v_start_time := NOW();
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_business_performance_daily;
    v_end_time := NOW();
    view_name := 'mv_business_performance_daily';
    refresh_time := v_end_time - v_start_time;
    RETURN NEXT;
    
    -- Refresh real-time metrics
    v_start_time := NOW();
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_realtime_session_metrics;
    v_end_time := NOW();
    view_name := 'mv_realtime_session_metrics';
    refresh_time := v_end_time - v_start_time;
    RETURN NEXT;
    
    -- Refresh platform performance
    v_start_time := NOW();
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_platform_performance_hourly;
    v_end_time := NOW();
    view_name := 'mv_platform_performance_hourly';
    refresh_time := v_end_time - v_start_time;
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PHASE 9: SCHEDULING AUTOMATIC MAINTENANCE
-- ============================================================================

-- Note: These would typically be set up as cron jobs or using pg_cron extension
-- Example pg_cron setup (requires pg_cron extension):

/*
-- Schedule materialized view refresh every 15 minutes
SELECT cron.schedule('refresh-business-views', '*/15 * * * *', 'SELECT refresh_materialized_views();');

-- Schedule cleanup every hour
SELECT cron.schedule('cleanup-expired-data', '0 * * * *', 'SELECT cleanup_expired_data();');

-- Schedule statistics update every 6 hours
SELECT cron.schedule('update-statistics', '0 */6 * * *', 'ANALYZE;');
*/

-- ============================================================================
-- PHASE 10: QUERY OPTIMIZATION HINTS AND BEST PRACTICES
-- ============================================================================

-- Create helper function for query plan analysis
CREATE OR REPLACE FUNCTION explain_query_performance(p_query TEXT)
RETURNS TABLE (plan_line TEXT) AS $$
BEGIN
    RETURN QUERY EXECUTE 'EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) ' || p_query;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VALIDATION AND VERIFICATION
-- ============================================================================

-- Verify all indexes were created successfully
DO $$
DECLARE
    r RECORD;
    missing_indexes INTEGER := 0;
BEGIN
    FOR r IN 
        SELECT indexname 
        FROM (
            VALUES 
                ('idx_feedback_sessions_composite_status'),
                ('idx_feedback_sessions_composite_quality'),
                ('idx_feedback_sessions_composite_fraud'),
                ('idx_feedback_sessions_active_processing'),
                ('idx_feedback_sessions_recent_completed'),
                ('idx_feedback_sessions_business_summary'),
                ('idx_feedback_sessions_ai_evaluation_gin'),
                ('idx_feedback_sessions_fraud_flags_gin'),
                ('idx_businesses_reward_settings_gin'),
                ('idx_feedback_sessions_transcript_fts'),
                ('idx_platform_metrics_realtime')
        ) AS expected_indexes(indexname)
        WHERE NOT EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE indexname = expected_indexes.indexname
        )
    LOOP
        RAISE WARNING 'Missing index: %', r.indexname;
        missing_indexes := missing_indexes + 1;
    END LOOP;
    
    IF missing_indexes = 0 THEN
        RAISE NOTICE 'All database optimization indexes created successfully!';
    ELSE
        RAISE WARNING 'Missing % indexes - check for errors above', missing_indexes;
    END IF;
END $$;

-- Performance validation query
SELECT 
    'Database Optimization Complete' as status,
    COUNT(*) as total_indexes_created,
    pg_size_pretty(SUM(pg_relation_size(indexrelid))) as total_index_size
FROM pg_stat_user_indexes 
WHERE schemaname = 'public';

COMMENT ON SCHEMA public IS 'AI Feedback Platform - Database optimized for high-throughput performance (1000+ RPS)';