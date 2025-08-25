-- TEST Payment Database Initialization
-- Swedish Pilot Demo Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create test payments table
CREATE TABLE IF NOT EXISTS payments_test (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stripe_payment_intent_id VARCHAR(255) UNIQUE,
    stripe_charge_id VARCHAR(255),
    customer_id VARCHAR(255) NOT NULL,
    business_id VARCHAR(255) NOT NULL,
    location_id VARCHAR(255) NOT NULL,
    feedback_session_id VARCHAR(255) NOT NULL,
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) DEFAULT 'SEK',
    payment_method VARCHAR(50) DEFAULT 'card',
    status VARCHAR(50) DEFAULT 'pending',
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    confirmed_at TIMESTAMP WITH TIME ZONE,
    failed_at TIMESTAMP WITH TIME ZONE,
    failure_reason TEXT,
    compliance_logged BOOLEAN DEFAULT FALSE,
    test_mode BOOLEAN DEFAULT TRUE
);

-- Create compliance events table for Swedish financial authority reporting
CREATE TABLE IF NOT EXISTS compliance_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) DEFAULT 'info',
    data JSONB NOT NULL,
    payment_id UUID REFERENCES payments_test(id),
    reported_to_fi BOOLEAN DEFAULT FALSE,
    fi_report_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reported_at TIMESTAMP WITH TIME ZONE
);

-- Create test businesses table (Swedish pilot participants)
CREATE TABLE IF NOT EXISTS businesses_test (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_number VARCHAR(20) UNIQUE NOT NULL, -- Swedish organizational number
    name VARCHAR(255) NOT NULL,
    business_type VARCHAR(100),
    tier INTEGER DEFAULT 1 CHECK (tier IN (1, 2, 3)),
    status VARCHAR(50) DEFAULT 'pending',
    contact_email VARCHAR(255),
    contact_phone VARCHAR(20),
    address_street VARCHAR(255),
    address_city VARCHAR(100),
    address_postal_code VARCHAR(10),
    address_country VARCHAR(3) DEFAULT 'SE',
    stripe_account_id VARCHAR(255),
    bank_account_verified BOOLEAN DEFAULT FALSE,
    compliance_verified BOOLEAN DEFAULT FALSE,
    pilot_participant BOOLEAN DEFAULT TRUE,
    test_mode BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create test business locations (Swedish cities/regions)
CREATE TABLE IF NOT EXISTS business_locations_test (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses_test(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    address_street VARCHAR(255),
    address_city VARCHAR(100) NOT NULL,
    address_postal_code VARCHAR(10),
    address_county VARCHAR(100), -- Swedish län
    region VARCHAR(50), -- Stockholm, Gothenburg, Malmö, etc.
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    is_active BOOLEAN DEFAULT TRUE,
    qr_code_active BOOLEAN DEFAULT TRUE,
    test_location BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create test feedback sessions (linked to payments)
CREATE TABLE IF NOT EXISTS feedback_sessions_test (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses_test(id),
    location_id UUID NOT NULL REFERENCES business_locations_test(id),
    customer_hash VARCHAR(255) NOT NULL, -- Anonymized customer identifier
    session_token VARCHAR(255) UNIQUE NOT NULL,
    qr_code_id VARCHAR(255) NOT NULL,
    transaction_id VARCHAR(255), -- POS transaction ID
    purchase_amount DECIMAL(10,2),
    purchase_time TIMESTAMP WITH TIME ZONE,
    feedback_quality_score INTEGER CHECK (feedback_quality_score >= 0 AND feedback_quality_score <= 100),
    reward_percentage DECIMAL(5,2) CHECK (reward_percentage >= 0 AND reward_percentage <= 20),
    reward_amount DECIMAL(10,2),
    payment_id UUID REFERENCES payments_test(id),
    status VARCHAR(50) DEFAULT 'pending',
    completed_at TIMESTAMP WITH TIME ZONE,
    test_session BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Swedish financial reporting table (mock FI reporting)
CREATE TABLE IF NOT EXISTS fi_reports_test (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_type VARCHAR(100) NOT NULL, -- 'monthly_summary', 'transaction_detail', 'compliance_issue'
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    business_count INTEGER DEFAULT 0,
    transaction_count INTEGER DEFAULT 0,
    total_amount_sek DECIMAL(15,2) DEFAULT 0,
    report_data JSONB NOT NULL,
    submitted_to_fi BOOLEAN DEFAULT FALSE,
    fi_reference_number VARCHAR(255),
    compliance_status VARCHAR(50) DEFAULT 'pending',
    test_report BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    submitted_at TIMESTAMP WITH TIME ZONE
);

-- Create test data for Swedish pilot businesses
INSERT INTO businesses_test (id, org_number, name, business_type, tier, status, contact_email, contact_phone, address_city, region) VALUES
    ('550e8400-e29b-41d4-a716-446655440001', '5569123456', 'Stockholms Test Café AB', 'cafe', 2, 'active', 'test@stockholmcafe.se', '+46701234567', 'Stockholm', 'stockholm'),
    ('550e8400-e29b-41d4-a716-446655440002', '5569654321', 'Göteborgs Handels AB', 'retail', 3, 'active', 'info@gbghandel.se', '+46709876543', 'Göteborg', 'gothenburg'),
    ('550e8400-e29b-41d4-a716-446655440003', '5569111222', 'Malmö Restaurang HB', 'restaurant', 1, 'active', 'kontakt@malmorest.se', '+46705555666', 'Malmö', 'malmo'),
    ('550e8400-e29b-41d4-a716-446655440004', '5569333444', 'Uppsala Bokhandel AB', 'retail', 2, 'pending', 'order@uppsalabok.se', '+46707777888', 'Uppsala', 'stockholm'),
    ('550e8400-e29b-41d4-a716-446655440005', '5569555777', 'Linköping Tech Store AB', 'retail', 3, 'active', 'support@linktech.se', '+46709999000', 'Linköping', 'stockholm');

-- Create test business locations
INSERT INTO business_locations_test (business_id, name, address_street, address_city, address_postal_code, address_county, region, latitude, longitude) VALUES
    ('550e8400-e29b-41d4-a716-446655440001', 'Stockholms Test Café - Gamla Stan', 'Stortorget 1', 'Stockholm', '11129', 'Stockholm', 'stockholm', 59.3251172, 18.0710935),
    ('550e8400-e29b-41d4-a716-446655440002', 'Göteborgs Handels - Centrum', 'Kungsgatan 55', 'Göteborg', '41119', 'Västra Götaland', 'gothenburg', 57.7065654, 11.9615098),
    ('550e8400-e29b-41d4-a716-446655440003', 'Malmö Restaurang - Centralstation', 'Skeppsbron 1', 'Malmö', '21120', 'Skåne', 'malmo', 55.6107317, 13.0007729),
    ('550e8400-e29b-41d4-a716-446655440004', 'Uppsala Bokhandel - Universitetsområdet', 'Sankt Larsgatan 10', 'Uppsala', '75310', 'Uppsala', 'stockholm', 59.8594762, 17.6387436),
    ('550e8400-e29b-41d4-a716-446655440005', 'Linköping Tech Store - City', 'Stora Torget 3', 'Linköping', '58223', 'Östergötland', 'stockholm', 58.4108617, 15.6213729);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_payments_test_business_id ON payments_test(business_id);
CREATE INDEX IF NOT EXISTS idx_payments_test_customer_id ON payments_test(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_test_status ON payments_test(status);
CREATE INDEX IF NOT EXISTS idx_payments_test_created_at ON payments_test(created_at);
CREATE INDEX IF NOT EXISTS idx_payments_test_amount ON payments_test(amount);

CREATE INDEX IF NOT EXISTS idx_compliance_events_type ON compliance_events(type);
CREATE INDEX IF NOT EXISTS idx_compliance_events_severity ON compliance_events(severity);
CREATE INDEX IF NOT EXISTS idx_compliance_events_payment_id ON compliance_events(payment_id);
CREATE INDEX IF NOT EXISTS idx_compliance_events_created_at ON compliance_events(created_at);

CREATE INDEX IF NOT EXISTS idx_feedback_sessions_test_business_id ON feedback_sessions_test(business_id);
CREATE INDEX IF NOT EXISTS idx_feedback_sessions_test_payment_id ON feedback_sessions_test(payment_id);
CREATE INDEX IF NOT EXISTS idx_feedback_sessions_test_created_at ON feedback_sessions_test(created_at);

-- Create view for payment analytics
CREATE OR REPLACE VIEW payment_analytics_test AS
SELECT 
    DATE(p.created_at) as payment_date,
    b.name as business_name,
    b.tier as business_tier,
    bl.region,
    COUNT(*) as payment_count,
    SUM(p.amount) as total_amount_sek,
    AVG(p.amount) as avg_amount_sek,
    COUNT(CASE WHEN p.status = 'completed' THEN 1 END) as successful_payments,
    COUNT(CASE WHEN p.status = 'failed' THEN 1 END) as failed_payments,
    ROUND(AVG(fs.feedback_quality_score), 2) as avg_quality_score,
    ROUND(AVG(fs.reward_percentage), 2) as avg_reward_percentage
FROM payments_test p
LEFT JOIN businesses_test b ON p.business_id = b.id
LEFT JOIN business_locations_test bl ON p.location_id = bl.id
LEFT JOIN feedback_sessions_test fs ON p.id = fs.payment_id
GROUP BY payment_date, business_name, business_tier, bl.region
ORDER BY payment_date DESC, total_amount_sek DESC;

-- Create view for compliance reporting
CREATE OR REPLACE VIEW compliance_summary_test AS
SELECT 
    DATE_TRUNC('day', created_at) as event_date,
    type as event_type,
    severity,
    COUNT(*) as event_count,
    COUNT(CASE WHEN reported_to_fi THEN 1 END) as reported_count,
    ARRAY_AGG(DISTINCT (data->>'business_id')) FILTER (WHERE data->>'business_id' IS NOT NULL) as affected_businesses
FROM compliance_events
GROUP BY event_date, type, severity
ORDER BY event_date DESC, event_count DESC;

-- Insert some initial compliance events for testing
INSERT INTO compliance_events (type, severity, data) VALUES
    ('system_startup', 'info', '{"message": "Payment system initialized in TEST mode", "timestamp": "2024-08-24T10:00:00Z", "test_mode": true}'),
    ('compliance_check', 'info', '{"message": "Swedish PSD2 compliance modules loaded", "regulations": ["PSD2", "GDPR"], "test_mode": true}'),
    ('fi_connection_test', 'info', '{"message": "Mock Finansinspektionen API connection established", "endpoint": "test", "test_mode": true}');

-- Grant permissions (for test environment)
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO CURRENT_USER;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO CURRENT_USER;

-- Display initialization summary
DO $$
BEGIN
    RAISE NOTICE '=== Swedish Pilot Payment System - TEST Database Initialized ===';
    RAISE NOTICE 'Test businesses created: %', (SELECT COUNT(*) FROM businesses_test);
    RAISE NOTICE 'Test locations created: %', (SELECT COUNT(*) FROM business_locations_test);
    RAISE NOTICE 'Initial compliance events: %', (SELECT COUNT(*) FROM compliance_events);
    RAISE NOTICE 'Database ready for Swedish pilot demonstration';
    RAISE NOTICE '========================================================';
END $$;