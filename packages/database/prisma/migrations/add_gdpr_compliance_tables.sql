-- GDPR Compliance Tables Migration
-- This migration adds tables for GDPR compliance including consent management,
-- data export requests, and data retention tracking.

-- Consent Management Table
CREATE TABLE consent_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR(255),
    customer_hash VARCHAR(255) NOT NULL,
    consent_type VARCHAR(50) NOT NULL,
    granted BOOLEAN NOT NULL,
    ip_address INET,
    user_agent TEXT,
    consent_version VARCHAR(20) NOT NULL DEFAULT '1.0',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for consent queries
CREATE INDEX idx_consent_records_customer_hash ON consent_records(customer_hash);
CREATE INDEX idx_consent_records_consent_type ON consent_records(consent_type);
CREATE INDEX idx_consent_records_created_at ON consent_records(created_at);
CREATE INDEX idx_consent_records_customer_type ON consent_records(customer_hash, consent_type);

-- Data Export/Deletion Requests Table  
CREATE TABLE data_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_hash VARCHAR(255) NOT NULL,
    request_type VARCHAR(20) NOT NULL CHECK (request_type IN ('export', 'deletion', 'rectification')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'expired')),
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    download_url TEXT,
    download_token VARCHAR(255),
    expires_at TIMESTAMPTZ,
    data_size_bytes BIGINT,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for data request queries
CREATE INDEX idx_data_requests_customer_hash ON data_requests(customer_hash);
CREATE INDEX idx_data_requests_status ON data_requests(status);
CREATE INDEX idx_data_requests_request_type ON data_requests(request_type);
CREATE INDEX idx_data_requests_expires_at ON data_requests(expires_at);

-- Data Retention Log Table (tracks what data was cleaned up when)
CREATE TABLE data_retention_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data_category VARCHAR(50) NOT NULL,
    retention_policy VARCHAR(100) NOT NULL,
    records_processed INTEGER NOT NULL DEFAULT 0,
    records_deleted INTEGER NOT NULL DEFAULT 0,
    records_anonymized INTEGER NOT NULL DEFAULT 0,
    cutoff_date TIMESTAMPTZ NOT NULL,
    execution_started_at TIMESTAMPTZ NOT NULL,
    execution_completed_at TIMESTAMPTZ,
    execution_duration_seconds INTEGER,
    status VARCHAR(20) NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for retention log queries
CREATE INDEX idx_data_retention_log_data_category ON data_retention_log(data_category);
CREATE INDEX idx_data_retention_log_created_at ON data_retention_log(created_at);
CREATE INDEX idx_data_retention_log_status ON data_retention_log(status);

-- Voice Data Tracking Table (temporary storage tracking for immediate deletion)
CREATE TABLE voice_data_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR(255) NOT NULL,
    customer_hash VARCHAR(255) NOT NULL,
    audio_file_path TEXT,
    audio_size_bytes BIGINT,
    processing_started_at TIMESTAMPTZ DEFAULT NOW(),
    processing_completed_at TIMESTAMPTZ,
    deletion_scheduled_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'processed', 'scheduled_deletion', 'deleted', 'error')),
    error_message TEXT
);

-- Create indexes for voice data tracking
CREATE INDEX idx_voice_data_tracking_session_id ON voice_data_tracking(session_id);
CREATE INDEX idx_voice_data_tracking_customer_hash ON voice_data_tracking(customer_hash);
CREATE INDEX idx_voice_data_tracking_status ON voice_data_tracking(status);
CREATE INDEX idx_voice_data_tracking_deletion_scheduled ON voice_data_tracking(deletion_scheduled_at);

-- GDPR Audit Log Table (tracks all GDPR-related actions)
CREATE TABLE gdpr_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_hash VARCHAR(255),
    action_type VARCHAR(50) NOT NULL, -- 'consent_granted', 'consent_revoked', 'data_exported', 'data_deleted', etc.
    action_details JSONB,
    admin_id VARCHAR(255), -- If action was performed by admin
    ip_address INET,
    user_agent TEXT,
    legal_basis VARCHAR(100), -- GDPR legal basis for processing
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for audit log
CREATE INDEX idx_gdpr_audit_log_customer_hash ON gdpr_audit_log(customer_hash);
CREATE INDEX idx_gdpr_audit_log_action_type ON gdpr_audit_log(action_type);
CREATE INDEX idx_gdpr_audit_log_created_at ON gdpr_audit_log(created_at);
CREATE INDEX idx_gdpr_audit_log_admin_id ON gdpr_audit_log(admin_id);

-- PII Detection Log (tracks detected and anonymized PII)
CREATE TABLE pii_detection_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_table VARCHAR(100) NOT NULL,
    source_id VARCHAR(255) NOT NULL,
    source_field VARCHAR(100) NOT NULL,
    pii_types VARCHAR(255)[], -- Array of detected PII types
    anonymization_method VARCHAR(50),
    confidence_score DECIMAL(3,2), -- 0.00 to 1.00
    detected_at TIMESTAMPTZ DEFAULT NOW(),
    anonymized_at TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL DEFAULT 'detected' CHECK (status IN ('detected', 'anonymized', 'reviewed', 'false_positive'))
);

-- Create indexes for PII detection log
CREATE INDEX idx_pii_detection_log_source ON pii_detection_log(source_table, source_id);
CREATE INDEX idx_pii_detection_log_status ON pii_detection_log(status);
CREATE INDEX idx_pii_detection_log_detected_at ON pii_detection_log(detected_at);

-- Create updated_at triggers for timestamp management
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_consent_records_updated_at BEFORE UPDATE ON consent_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_data_requests_updated_at BEFORE UPDATE ON data_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) Policies
ALTER TABLE consent_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_retention_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_data_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE gdpr_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE pii_detection_log ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (these will need to be adjusted based on your auth system)
-- Example policy for consent records - business can only see their own data
CREATE POLICY "Businesses can view their customer consents" ON consent_records
    FOR SELECT USING (
        customer_hash IN (
            SELECT DISTINCT customer_hash 
            FROM feedback_sessions 
            WHERE business_id = auth.uid()::text
        )
    );

-- System role can manage all GDPR data
CREATE POLICY "Service role can manage all GDPR data" ON consent_records
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage all data requests" ON data_requests
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage all retention logs" ON data_retention_log
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage all voice tracking" ON voice_data_tracking
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage all audit logs" ON gdpr_audit_log
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage all PII logs" ON pii_detection_log
    FOR ALL USING (auth.role() = 'service_role');

-- Add GDPR-related fields to existing feedback_sessions table
ALTER TABLE feedback_sessions ADD COLUMN IF NOT EXISTS voice_deleted_at TIMESTAMPTZ;
ALTER TABLE feedback_sessions ADD COLUMN IF NOT EXISTS transcript_anonymized_at TIMESTAMPTZ;
ALTER TABLE feedback_sessions ADD COLUMN IF NOT EXISTS gdpr_compliant BOOLEAN DEFAULT false;
ALTER TABLE feedback_sessions ADD COLUMN IF NOT EXISTS data_retention_category VARCHAR(50) DEFAULT 'feedback_data';

-- Create index for GDPR compliance queries
CREATE INDEX idx_feedback_sessions_gdpr_compliant ON feedback_sessions(gdpr_compliant);
CREATE INDEX idx_feedback_sessions_voice_deleted_at ON feedback_sessions(voice_deleted_at);
CREATE INDEX idx_feedback_sessions_data_retention_category ON feedback_sessions(data_retention_category);

-- Comments for documentation
COMMENT ON TABLE consent_records IS 'Stores customer consent records for GDPR compliance';
COMMENT ON TABLE data_requests IS 'Tracks data export, deletion, and rectification requests';
COMMENT ON TABLE data_retention_log IS 'Logs data retention policy executions and cleanup activities';
COMMENT ON TABLE voice_data_tracking IS 'Tracks voice data for immediate deletion after processing';
COMMENT ON TABLE gdpr_audit_log IS 'Comprehensive audit log for all GDPR-related actions';
COMMENT ON TABLE pii_detection_log IS 'Tracks detected and anonymized personally identifiable information';

COMMENT ON COLUMN consent_records.consent_type IS 'Type of consent: voice_processing, data_storage, analytics, marketing, cookies_functional, cookies_analytics, cookies_marketing';
COMMENT ON COLUMN data_requests.request_type IS 'Type of request: export (Right to Access), deletion (Right to Erasure), rectification (Right to Rectification)';
COMMENT ON COLUMN voice_data_tracking.status IS 'Voice processing status: processing, processed, scheduled_deletion, deleted, error';
COMMENT ON COLUMN gdpr_audit_log.legal_basis IS 'GDPR Article 6 legal basis: consent, contract, legal_obligation, vital_interests, public_task, legitimate_interests';