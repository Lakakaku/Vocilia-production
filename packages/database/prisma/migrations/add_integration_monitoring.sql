-- Add integration monitoring tables

-- Transaction sync tracking
CREATE TABLE IF NOT EXISTS transaction_sync (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id VARCHAR(255) NOT NULL UNIQUE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  attempts INT DEFAULT 0,
  last_attempt_at TIMESTAMP WITH TIME ZONE,
  last_error TEXT,
  sync_metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_transaction_sync_business ON transaction_sync(business_id);
CREATE INDEX idx_transaction_sync_status ON transaction_sync(status);
CREATE INDEX idx_transaction_sync_created ON transaction_sync(created_at);

-- POS Integration configuration
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS pos_integration JSONB;

CREATE TABLE IF NOT EXISTS pos_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL UNIQUE REFERENCES businesses(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  api_key TEXT,
  webhook_secret TEXT,
  merchant_id VARCHAR(255),
  store_id VARCHAR(255),
  environment VARCHAR(20) DEFAULT 'production',
  auto_sync BOOLEAN DEFAULT true,
  sync_interval INT DEFAULT 300,
  max_retries INT DEFAULT 3,
  custom_settings JSONB,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_pos_integrations_provider ON pos_integrations(provider);

-- Transaction overrides
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS overridden BOOLEAN DEFAULT false;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS override_reason TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS overridden_by UUID;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS pos_reference VARCHAR(255);

-- Audit logs for admin actions
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(255) NOT NULL,
  user_id UUID,
  metadata JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);

-- Integration health metrics
CREATE TABLE IF NOT EXISTS integration_health_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  metric_type VARCHAR(50) NOT NULL,
  value DECIMAL(10, 2),
  metadata JSONB,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_integration_health_business ON integration_health_metrics(business_id);
CREATE INDEX idx_integration_health_type ON integration_health_metrics(metric_type);
CREATE INDEX idx_integration_health_recorded ON integration_health_metrics(recorded_at);