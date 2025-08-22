-- AI Feedback Platform Initial Schema Migration
-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Businesses table
CREATE TABLE businesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    org_number TEXT UNIQUE, -- Swedish organization number
    email TEXT NOT NULL,
    phone TEXT,
    address JSONB,
    stripe_account_id TEXT UNIQUE,
    stripe_onboarding_complete BOOLEAN DEFAULT FALSE,
    reward_settings JSONB DEFAULT '{
        "commission_rate": 0.20,
        "max_daily_rewards": 1000,
        "reward_tiers": {
            "exceptional": {"min": 90, "max": 100, "reward": [0.08, 0.12]},
            "very_good": {"min": 75, "max": 89, "reward": [0.04, 0.07]},
            "acceptable": {"min": 60, "max": 74, "reward": [0.01, 0.03]},
            "insufficient": {"min": 0, "max": 59, "reward": [0, 0]}
        }
    }',
    status TEXT DEFAULT 'pending', -- pending, active, suspended
    trial_feedbacks_remaining INTEGER DEFAULT 30,
    trial_expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Business locations/stores
CREATE TABLE business_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT,
    pos_location_id TEXT, -- External POS system location ID
    qr_code_url TEXT, -- Generated QR code for this location
    qr_code_expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '6 months'),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- POS system integrations
CREATE TABLE pos_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    provider TEXT NOT NULL, -- 'square', 'shopify', 'zettle'
    provider_account_id TEXT NOT NULL,
    credentials JSONB, -- Encrypted OAuth tokens and settings
    webhook_endpoint_id TEXT, -- External webhook ID
    webhook_secret TEXT,
    last_sync_at TIMESTAMPTZ,
    sync_status TEXT DEFAULT 'connected', -- connected, error, disconnected
    error_message TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(business_id, provider)
);

-- Customer feedback sessions (anonymous)
CREATE TABLE feedback_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    location_id UUID REFERENCES business_locations(id),
    
    -- Customer identification (anonymous)
    customer_hash TEXT NOT NULL, -- Derived from device fingerprint + phone digits
    device_fingerprint JSONB,
    
    -- Session data
    qr_token TEXT NOT NULL UNIQUE,
    qr_scanned_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Transaction matching
    transaction_id TEXT,
    transaction_amount DECIMAL(10,2),
    transaction_items JSONB,
    transaction_matched_at TIMESTAMPTZ,
    
    -- Voice and feedback data
    audio_duration_seconds INTEGER,
    audio_url TEXT, -- Temporary storage, deleted after processing
    transcript TEXT,
    transcript_language TEXT DEFAULT 'sv',
    
    -- AI evaluation results
    ai_evaluation JSONB, -- Full AI response with scores and reasoning
    quality_score INTEGER, -- 0-100 composite score
    authenticity_score INTEGER,
    concreteness_score INTEGER,
    depth_score INTEGER,
    sentiment_score DECIMAL(3,2), -- -1 to 1
    feedback_categories TEXT[],
    
    -- Fraud detection
    fraud_risk_score DECIMAL(3,2), -- 0 to 1
    fraud_flags JSONB, -- Specific fraud indicators
    fraud_review_status TEXT DEFAULT 'auto', -- auto, manual, cleared, rejected
    
    -- Rewards
    reward_tier TEXT, -- exceptional, very_good, acceptable, insufficient
    reward_amount DECIMAL(10,2),
    reward_percentage DECIMAL(5,4),
    reward_processed_at TIMESTAMPTZ,
    stripe_transfer_id TEXT,
    
    -- Status tracking
    status TEXT DEFAULT 'qr_scanned', -- qr_scanned, recording, processing, completed, failed, fraud_flagged
    error_message TEXT,
    completed_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Platform analytics and metrics
CREATE TABLE platform_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_type TEXT NOT NULL, -- daily_sessions, fraud_rate, avg_quality, etc.
    business_id UUID REFERENCES businesses(id), -- NULL for platform-wide metrics
    date DATE NOT NULL,
    value DECIMAL(15,4),
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(metric_type, business_id, date)
);

-- Audit log for important actions
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL, -- business, session, payment, etc.
    entity_id UUID,
    action TEXT NOT NULL,
    actor_type TEXT, -- admin, system, business_user
    actor_id UUID,
    changes JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_feedback_sessions_business_id ON feedback_sessions(business_id);
CREATE INDEX idx_feedback_sessions_customer_hash ON feedback_sessions(customer_hash);
CREATE INDEX idx_feedback_sessions_status ON feedback_sessions(status);
CREATE INDEX idx_feedback_sessions_created_at ON feedback_sessions(created_at);
CREATE INDEX idx_feedback_sessions_qr_token ON feedback_sessions(qr_token);

CREATE INDEX idx_pos_connections_business_id ON pos_connections(business_id);
CREATE INDEX idx_business_locations_business_id ON business_locations(business_id);
CREATE INDEX idx_platform_metrics_type_date ON platform_metrics(metric_type, date);

-- Functions for common operations
CREATE OR REPLACE FUNCTION generate_qr_token()
RETURNS TEXT AS $$
BEGIN
    RETURN encode(gen_random_bytes(32), 'base64url');
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_businesses_updated_at
    BEFORE UPDATE ON businesses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pos_connections_updated_at
    BEFORE UPDATE ON pos_connections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_feedback_sessions_updated_at
    BEFORE UPDATE ON feedback_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();