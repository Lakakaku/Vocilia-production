-- Create businesses table if it doesn't exist
CREATE TABLE IF NOT EXISTS businesses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  org_number TEXT,
  tier INTEGER DEFAULT 1,
  stripe_account_id TEXT,
  commission_rate NUMERIC DEFAULT 0.20,
  context_data JSONB DEFAULT '{}',
  preferences JSONB,
  trial_feedbacks_remaining INTEGER DEFAULT 30,
  trial_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  approved_by TEXT
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_businesses_org_number ON businesses(org_number);
CREATE INDEX IF NOT EXISTS idx_businesses_created_at ON businesses(created_at);
CREATE INDEX IF NOT EXISTS idx_businesses_updated_at ON businesses(updated_at);

-- Create or replace function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_businesses_updated_at ON businesses;
CREATE TRIGGER update_businesses_updated_at BEFORE UPDATE ON businesses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert test business if it doesn't exist
INSERT INTO businesses (id, name, context_data) 
VALUES (
  'bus_1757623745176_hv6t2vn9x', 
  'Test Business',
  '{
    "layout": {
      "departments": [],
      "checkouts": 1,
      "selfCheckout": false,
      "specialAreas": []
    },
    "staff": {
      "employees": []
    },
    "products": {
      "categories": [],
      "seasonal": [],
      "notOffered": [],
      "popularItems": []
    },
    "operations": {
      "hours": {
        "monday": {"open": "09:00", "close": "17:00", "closed": false},
        "tuesday": {"open": "09:00", "close": "17:00", "closed": false},
        "wednesday": {"open": "09:00", "close": "17:00", "closed": false},
        "thursday": {"open": "09:00", "close": "17:00", "closed": false},
        "friday": {"open": "09:00", "close": "17:00", "closed": false},
        "saturday": {"open": "10:00", "close": "16:00", "closed": false},
        "sunday": {"open": "", "close": "", "closed": true}
      },
      "peakTimes": [],
      "challenges": [],
      "improvements": [],
      "commonProcedures": []
    },
    "customerPatterns": {
      "commonQuestions": [],
      "frequentComplaints": [],
      "seasonalPatterns": [],
      "positivePatterns": [],
      "customerDemographics": []
    },
    "version": 1,
    "lastUpdated": "2025-01-12T00:00:00Z"
  }'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- Grant necessary permissions (adjust based on your RLS policies)
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows all operations for now (adjust as needed)
CREATE POLICY "Allow all operations on businesses" ON businesses
    FOR ALL USING (true);

-- Verify the table was created and data inserted
SELECT id, name, created_at FROM businesses WHERE id = 'bus_1757623745176_hv6t2vn9x';