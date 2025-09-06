-- Simple Verification System Migration
-- Adds support for manual transaction verification without POS integration

-- Store codes for simple verification (alternative to QR codes)
CREATE TABLE store_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    location_id UUID REFERENCES business_locations(id) ON DELETE CASCADE,
    code CHAR(6) NOT NULL UNIQUE, -- 6-digit numeric code
    name TEXT, -- Optional description (e.g., "Main Counter", "Checkout 1")
    active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 year'),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Simple verifications table (manual transaction verification)
CREATE TABLE simple_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES feedback_sessions(id) ON DELETE CASCADE,
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    location_id UUID REFERENCES business_locations(id),
    store_code CHAR(6) REFERENCES store_codes(code),
    
    -- Customer provided verification data
    purchase_time TIMESTAMPTZ NOT NULL, -- When customer says they purchased
    purchase_amount DECIMAL(10,2) NOT NULL, -- Amount customer claims
    customer_phone TEXT NOT NULL, -- For Swish payment
    
    -- Verification metadata
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    device_fingerprint JSONB,
    ip_address INET,
    user_agent TEXT,
    
    -- Business review status
    review_status TEXT DEFAULT 'pending', -- pending, approved, rejected, auto_approved
    reviewed_at TIMESTAMPTZ,
    reviewed_by TEXT, -- Business user ID or 'system'
    rejection_reason TEXT,
    
    -- Billing and payment tracking
    billing_batch_id UUID, -- References monthly_billing_batches.id
    payment_status TEXT DEFAULT 'pending', -- pending, paid, failed
    payment_amount DECIMAL(10,2), -- Final amount to be paid to customer
    commission_amount DECIMAL(10,2), -- Platform commission (20%)
    store_cost DECIMAL(10,2), -- Total cost for the store
    payment_id TEXT, -- Swish payment ID when paid
    paid_at TIMESTAMPTZ,
    
    -- Fraud detection
    fraud_score DECIMAL(3,2) DEFAULT 0.0, -- 0-1 fraud risk score
    fraud_flags JSONB DEFAULT '[]'::jsonb,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_phone_number CHECK (customer_phone ~ '^(\+46|0)[0-9]{8,9}$'),
    CONSTRAINT valid_amount CHECK (purchase_amount > 0 AND purchase_amount <= 50000),
    CONSTRAINT valid_fraud_score CHECK (fraud_score >= 0 AND fraud_score <= 1)
);

-- Monthly billing batches for store payments
CREATE TABLE monthly_billing_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    billing_month DATE NOT NULL, -- First day of the billing month
    
    -- Batch statistics
    total_verifications INTEGER DEFAULT 0,
    approved_verifications INTEGER DEFAULT 0,
    rejected_verifications INTEGER DEFAULT 0,
    total_customer_payments DECIMAL(12,2) DEFAULT 0.00,
    total_commission DECIMAL(12,2) DEFAULT 0.00,
    total_store_cost DECIMAL(12,2) DEFAULT 0.00,
    
    -- Batch status and timeline
    status TEXT DEFAULT 'collecting', -- collecting, review_period, payment_processing, completed
    review_deadline TIMESTAMPTZ, -- When store must complete reviews
    payment_due_date TIMESTAMPTZ, -- When store payment is due
    
    -- Payment tracking
    store_invoice_generated BOOLEAN DEFAULT FALSE,
    store_payment_received BOOLEAN DEFAULT FALSE,
    customer_payments_sent BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    
    UNIQUE(business_id, billing_month)
);

-- Payment batches for Swish customer payouts
CREATE TABLE payment_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id TEXT NOT NULL UNIQUE, -- Human-readable batch identifier
    batch_month TEXT NOT NULL, -- YYYY-MM format
    
    -- Batch statistics
    total_payments INTEGER NOT NULL DEFAULT 0,
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    
    -- Processing status and timeline
    status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    
    -- Swish integration
    swish_batch_id TEXT, -- Reference to Swish batch ID
    results JSONB, -- Detailed processing results from Swish
    
    -- Constraints
    CONSTRAINT valid_status CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    CONSTRAINT valid_batch_month CHECK (batch_month ~ '^\d{4}-\d{2}$')
);

-- Verification fraud patterns specific to simple verification
CREATE TABLE simple_verification_fraud_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pattern_type TEXT NOT NULL, -- phone_abuse, time_pattern, amount_pattern, location_mismatch
    pattern_data JSONB,
    risk_score DECIMAL(3,2) NOT NULL,
    auto_reject BOOLEAN DEFAULT FALSE,
    description TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add simple verification settings to businesses table
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS simple_verification_settings JSONB DEFAULT '{
    "enabled": false,
    "verification_tolerance": {
        "time_minutes": 5,
        "amount_sek": 0.5
    },
    "review_period_days": 14,
    "auto_approve_threshold": 0.1,
    "daily_limits": {
        "max_per_phone": 3,
        "max_per_ip": 10
    },
    "fraud_settings": {
        "auto_reject_threshold": 0.7,
        "manual_review_threshold": 0.3
    }
}'::jsonb;

-- Add simple verification tracking to feedback sessions
ALTER TABLE feedback_sessions ADD COLUMN IF NOT EXISTS verification_type TEXT DEFAULT 'pos_integration'; -- pos_integration, simple_verification
ALTER TABLE feedback_sessions ADD COLUMN IF NOT EXISTS simple_verification_id UUID REFERENCES simple_verifications(id);

-- Indexes for performance
CREATE INDEX idx_store_codes_business_id ON store_codes(business_id);
CREATE INDEX idx_store_codes_code ON store_codes(code) WHERE active = true;
CREATE INDEX idx_store_codes_location_id ON store_codes(location_id) WHERE active = true;

CREATE INDEX idx_simple_verifications_session_id ON simple_verifications(session_id);
CREATE INDEX idx_simple_verifications_business_id ON simple_verifications(business_id);
CREATE INDEX idx_simple_verifications_review_status ON simple_verifications(review_status);
CREATE INDEX idx_simple_verifications_customer_phone ON simple_verifications(customer_phone);
CREATE INDEX idx_simple_verifications_submitted_at ON simple_verifications(submitted_at);
CREATE INDEX idx_simple_verifications_billing_batch ON simple_verifications(billing_batch_id);
CREATE INDEX idx_simple_verifications_fraud_score ON simple_verifications(fraud_score) WHERE fraud_score > 0.3;

CREATE INDEX idx_monthly_billing_batches_business_month ON monthly_billing_batches(business_id, billing_month);
CREATE INDEX idx_monthly_billing_batches_status ON monthly_billing_batches(status);
CREATE INDEX idx_monthly_billing_batches_review_deadline ON monthly_billing_batches(review_deadline) WHERE status = 'review_period';

CREATE INDEX idx_payment_batches_batch_id ON payment_batches(batch_id);
CREATE INDEX idx_payment_batches_batch_month ON payment_batches(batch_month);
CREATE INDEX idx_payment_batches_status ON payment_batches(status);
CREATE INDEX idx_payment_batches_created_at ON payment_batches(created_at);
CREATE INDEX idx_payment_batches_processed_at ON payment_batches(processed_at) WHERE processed_at IS NOT NULL;

-- Row Level Security
ALTER TABLE store_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE simple_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_billing_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_batches ENABLE ROW LEVEL SECURITY;

-- RLS Policies for store_codes
CREATE POLICY store_codes_business_isolation ON store_codes
    USING (business_id IN (
        SELECT id FROM businesses WHERE org_number = current_setting('app.current_business', TRUE)
    ));

-- RLS Policies for simple_verifications  
CREATE POLICY simple_verifications_business_isolation ON simple_verifications
    USING (business_id IN (
        SELECT id FROM businesses WHERE org_number = current_setting('app.current_business', TRUE)
    ));

-- RLS Policies for monthly_billing_batches
CREATE POLICY monthly_billing_batches_business_isolation ON monthly_billing_batches
    USING (business_id IN (
        SELECT id FROM businesses WHERE org_number = current_setting('app.current_business', TRUE)
    ));

-- RLS Policies for payment_batches (admin-only table)
CREATE POLICY payment_batches_admin_only ON payment_batches
    USING (current_setting('app.current_role', TRUE) = 'admin');

-- Functions and Triggers

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_store_codes_updated_at
    BEFORE UPDATE ON store_codes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_simple_verifications_updated_at
    BEFORE UPDATE ON simple_verifications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_monthly_billing_batches_updated_at
    BEFORE UPDATE ON monthly_billing_batches
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Note: payment_batches doesn't need updated_at trigger since it doesn't have that column

-- Function to generate unique store codes
CREATE OR REPLACE FUNCTION generate_store_code()
RETURNS CHAR(6) AS $$
DECLARE
    new_code CHAR(6);
    attempts INTEGER := 0;
BEGIN
    LOOP
        -- Generate 6-digit numeric code
        new_code := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
        
        -- Check if code already exists
        IF NOT EXISTS (SELECT 1 FROM store_codes WHERE code = new_code) THEN
            RETURN new_code;
        END IF;
        
        attempts := attempts + 1;
        IF attempts > 100 THEN
            RAISE EXCEPTION 'Unable to generate unique store code after 100 attempts';
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to automatically calculate billing amounts
CREATE OR REPLACE FUNCTION calculate_verification_amounts()
RETURNS TRIGGER AS $$
DECLARE
    quality_score INTEGER;
    reward_percentage DECIMAL(5,4);
    base_commission DECIMAL(3,2) := 0.20; -- 20% platform commission
BEGIN
    -- Get quality score from feedback session
    SELECT fs.quality_score INTO quality_score
    FROM feedback_sessions fs
    WHERE fs.id = NEW.session_id;
    
    -- Calculate reward percentage based on quality (using existing business logic)
    -- This would integrate with existing reward calculation logic
    reward_percentage := CASE 
        WHEN quality_score >= 90 THEN 0.10  -- 10% for exceptional
        WHEN quality_score >= 75 THEN 0.055 -- 5.5% average for very good  
        WHEN quality_score >= 60 THEN 0.02  -- 2% for acceptable
        ELSE 0.0 -- No reward for insufficient
    END;
    
    -- Calculate amounts
    NEW.payment_amount := ROUND(NEW.purchase_amount * reward_percentage, 2);
    NEW.commission_amount := ROUND(NEW.payment_amount * base_commission, 2);
    NEW.store_cost := NEW.payment_amount + NEW.commission_amount;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to calculate amounts on insert/update
CREATE TRIGGER calculate_simple_verification_amounts
    BEFORE INSERT OR UPDATE ON simple_verifications
    FOR EACH ROW
    EXECUTE FUNCTION calculate_verification_amounts();

-- Insert default fraud patterns
INSERT INTO simple_verification_fraud_patterns (pattern_type, pattern_data, risk_score, description) VALUES
    ('phone_abuse', '{"max_daily_verifications": 3}', 0.8, 'Same phone number used for too many verifications'),
    ('time_pattern', '{"suspicious_intervals": ["00:00-06:00", "22:00-23:59"]}', 0.4, 'Verifications at unusual hours'),
    ('amount_pattern', '{"round_amounts": true, "exact_duplicates": true}', 0.6, 'Suspicious amount patterns'),
    ('rapid_submission', '{"min_interval_seconds": 300}', 0.5, 'Multiple verifications submitted too quickly'),
    ('location_mismatch', '{"distance_threshold_km": 50}', 0.7, 'Verification location doesn''t match store location');

-- Create view for business verification dashboard
CREATE OR REPLACE VIEW business_verification_summary AS
SELECT 
    b.id as business_id,
    b.name as business_name,
    COUNT(sv.id) as total_verifications,
    COUNT(CASE WHEN sv.review_status = 'pending' THEN 1 END) as pending_reviews,
    COUNT(CASE WHEN sv.review_status = 'approved' THEN 1 END) as approved,
    COUNT(CASE WHEN sv.review_status = 'rejected' THEN 1 END) as rejected,
    SUM(CASE WHEN sv.review_status = 'approved' THEN sv.store_cost ELSE 0 END) as total_cost_approved,
    AVG(CASE WHEN sv.fraud_score > 0 THEN sv.fraud_score END) as avg_fraud_score,
    COUNT(CASE WHEN sv.fraud_score > 0.7 THEN 1 END) as high_risk_verifications
FROM businesses b
LEFT JOIN simple_verifications sv ON b.id = sv.business_id
WHERE b.simple_verification_settings->>'enabled' = 'true'
GROUP BY b.id, b.name;

COMMENT ON TABLE store_codes IS 'Store-specific codes for simple verification (alternative to QR scanning)';
COMMENT ON TABLE simple_verifications IS 'Manual transaction verifications without POS integration';
COMMENT ON TABLE monthly_billing_batches IS 'Monthly billing cycles for processing store payments';
COMMENT ON TABLE simple_verification_fraud_patterns IS 'Fraud detection patterns specific to simple verification';