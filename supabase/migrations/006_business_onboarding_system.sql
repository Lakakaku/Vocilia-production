-- Business Onboarding System Migration
-- Add comprehensive onboarding fields to support new wizard

-- Add onboarding-specific fields to businesses table
ALTER TABLE businesses 
ADD COLUMN business_type TEXT,
ADD COLUMN store_count INTEGER,
ADD COLUMN geographic_coverage TEXT, -- 'single_city', 'region', 'national'
ADD COLUMN avg_transaction_value_range TEXT, -- '50-100', '100-500', '500+'
ADD COLUMN daily_customer_volume INTEGER,
ADD COLUMN pos_system TEXT, -- 'square', 'shopify', 'zettle', 'other', 'none'
ADD COLUMN tech_comfort_level TEXT, -- 'basic', 'intermediate', 'advanced'
ADD COLUMN verification_method_preference TEXT, -- 'automatic', 'simple'
ADD COLUMN primary_goals TEXT[], -- Array of selected goals
ADD COLUMN improvement_areas TEXT[], -- Array of improvement areas
ADD COLUMN expected_feedback_volume INTEGER, -- Expected feedbacks per week
ADD COLUMN staff_training_required BOOLEAN DEFAULT false,
ADD COLUMN onboarding_completed BOOLEAN DEFAULT false,
ADD COLUMN onboarding_completed_at TIMESTAMPTZ,
ADD COLUMN context_data JSONB DEFAULT '{}'; -- Comprehensive business context

-- Create business onboarding progress table for tracking step completion
CREATE TABLE business_onboarding_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    
    -- Step completion tracking
    step_1_welcome_completed BOOLEAN DEFAULT false,
    step_1_completed_at TIMESTAMPTZ,
    
    step_2_profile_completed BOOLEAN DEFAULT false,
    step_2_completed_at TIMESTAMPTZ,
    step_2_draft_data JSONB DEFAULT '{}',
    
    step_3_integration_completed BOOLEAN DEFAULT false,
    step_3_completed_at TIMESTAMPTZ,
    step_3_draft_data JSONB DEFAULT '{}',
    
    step_4_goals_completed BOOLEAN DEFAULT false,
    step_4_completed_at TIMESTAMPTZ,
    step_4_draft_data JSONB DEFAULT '{}',
    
    -- Overall progress tracking
    current_step INTEGER DEFAULT 1,
    total_steps INTEGER DEFAULT 4,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Draft data storage for incomplete sessions
    draft_data JSONB DEFAULT '{}',
    
    UNIQUE(business_id)
);

-- Create context conversations table for AI-powered context assistant
CREATE TABLE context_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    
    -- Conversation metadata
    conversation_type TEXT DEFAULT 'onboarding', -- 'onboarding', 'optimization', 'update'
    started_at TIMESTAMPTZ DEFAULT NOW(),
    last_message_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT 'active', -- 'active', 'completed', 'paused'
    
    -- Messages in conversation
    messages JSONB DEFAULT '[]', -- Array of {role: 'user'|'ai', content: string, timestamp: string}
    
    -- AI analysis and outcomes
    context_gaps_identified TEXT[],
    questions_asked INTEGER DEFAULT 0,
    information_extracted JSONB DEFAULT '{}',
    completion_score INTEGER, -- 0-100 how complete the context is
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create business custom questions table
CREATE TABLE business_custom_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    location_id UUID REFERENCES business_locations(id) ON DELETE CASCADE, -- NULL for all locations
    
    -- Question configuration
    question_text TEXT NOT NULL,
    question_type TEXT DEFAULT 'open_ended', -- 'open_ended', 'rating', 'yes_no'
    
    -- Targeting and frequency
    frequency_setting INTEGER DEFAULT 15, -- Ask every Nth customer
    priority_level TEXT DEFAULT 'medium', -- 'high', 'medium', 'low'
    
    -- Seasonal activation
    active_months INTEGER[], -- Array of months (1-12) when question is active
    active_start_date DATE,
    active_end_date DATE,
    
    -- Store targeting
    target_all_stores BOOLEAN DEFAULT true,
    target_store_ids UUID[], -- Specific store IDs if not all stores
    
    -- Status and analytics
    is_active BOOLEAN DEFAULT true,
    times_asked INTEGER DEFAULT 0,
    times_answered INTEGER DEFAULT 0,
    response_rate DECIMAL(5,2), -- Calculated response rate
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_business_onboarding_progress_business_id ON business_onboarding_progress(business_id);
CREATE INDEX idx_business_onboarding_progress_current_step ON business_onboarding_progress(current_step);
CREATE INDEX idx_context_conversations_business_id ON context_conversations(business_id);
CREATE INDEX idx_context_conversations_status ON context_conversations(status);
CREATE INDEX idx_business_custom_questions_business_id ON business_custom_questions(business_id);
CREATE INDEX idx_business_custom_questions_active ON business_custom_questions(is_active);
CREATE INDEX idx_businesses_onboarding_completed ON businesses(onboarding_completed);
CREATE INDEX idx_businesses_business_type ON businesses(business_type);

-- Create function to update last_activity_at
CREATE OR REPLACE FUNCTION update_onboarding_progress_activity()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_activity_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic activity tracking
CREATE TRIGGER update_onboarding_progress_activity_trigger
    BEFORE UPDATE ON business_onboarding_progress
    FOR EACH ROW
    EXECUTE FUNCTION update_onboarding_progress_activity();

-- Create function to automatically create onboarding progress record
CREATE OR REPLACE FUNCTION create_onboarding_progress_for_new_business()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO business_onboarding_progress (business_id)
    VALUES (NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-create onboarding progress for new businesses
CREATE TRIGGER create_onboarding_progress_trigger
    AFTER INSERT ON businesses
    FOR EACH ROW
    EXECUTE FUNCTION create_onboarding_progress_for_new_business();

-- Comments for documentation
COMMENT ON TABLE business_onboarding_progress IS 'Tracks progress through the business onboarding wizard';
COMMENT ON TABLE context_conversations IS 'Stores AI-powered context optimization conversations';
COMMENT ON TABLE business_custom_questions IS 'Business-defined custom questions for customer feedback';
COMMENT ON COLUMN businesses.context_data IS 'Comprehensive business context for AI analysis including layout, staff, products, operations';
COMMENT ON COLUMN business_onboarding_progress.draft_data IS 'Temporary storage for incomplete onboarding data';