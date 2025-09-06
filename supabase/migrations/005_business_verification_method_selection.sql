-- Business Verification Method Selection Migration
-- Adds support for businesses to choose between POS integration and simple verification

-- Add verification method and preferences to businesses table
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS verification_method TEXT DEFAULT 'pos_integration';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS verification_preferences JSONB DEFAULT '{
    "pos_integration": {
        "preferred_provider": null,
        "auto_connect": true,
        "require_transaction_match": true
    },
    "simple_verification": {
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
    }
}'::jsonb;

-- Add constraints for verification method
ALTER TABLE businesses ADD CONSTRAINT valid_verification_method 
CHECK (verification_method IN ('pos_integration', 'simple_verification'));

-- Update existing businesses to have proper verification method based on their current setup
UPDATE businesses 
SET verification_method = 'simple_verification',
    verification_preferences = jsonb_set(
        verification_preferences, 
        '{simple_verification,enabled}', 
        'true'::jsonb
    )
WHERE simple_verification_settings IS NOT NULL 
AND simple_verification_settings->>'enabled' = 'true';

-- Create index for verification method queries
CREATE INDEX idx_businesses_verification_method ON businesses(verification_method);

-- Add verification method change tracking
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS verification_method_changed_at TIMESTAMPTZ;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS verification_method_changed_by TEXT;

-- Function to track verification method changes
CREATE OR REPLACE FUNCTION track_verification_method_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.verification_method IS DISTINCT FROM NEW.verification_method THEN
        NEW.verification_method_changed_at = NOW();
        -- In a real implementation, this would be set from the application context
        NEW.verification_method_changed_by = COALESCE(
            current_setting('app.current_user', TRUE),
            'system'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for verification method changes
DROP TRIGGER IF EXISTS trigger_track_verification_method_change ON businesses;
CREATE TRIGGER trigger_track_verification_method_change
    BEFORE UPDATE ON businesses
    FOR EACH ROW
    EXECUTE FUNCTION track_verification_method_change();

-- Update simple_verification_settings to be consistent with new structure
UPDATE businesses 
SET verification_preferences = jsonb_set(
    verification_preferences,
    '{simple_verification}',
    COALESCE(simple_verification_settings, '{}'::jsonb)
)
WHERE simple_verification_settings IS NOT NULL;

-- Comment explaining the verification methods
COMMENT ON COLUMN businesses.verification_method IS 'Primary verification method: pos_integration (automatic via POS systems) or simple_verification (manual monthly review)';
COMMENT ON COLUMN businesses.verification_preferences IS 'Method-specific configuration and settings for the chosen verification approach';