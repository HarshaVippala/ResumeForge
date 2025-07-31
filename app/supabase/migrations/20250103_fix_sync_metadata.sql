-- Fix sync_metadata table conflict for Gmail OAuth integration
-- This migration resolves the schema conflict between OAuth token storage and email sync metadata

-- First, drop the existing sync_metadata table if it exists
DROP TABLE IF EXISTS sync_metadata CASCADE;

-- Create the sync_metadata table with the schema expected by OAuth code
CREATE TABLE sync_metadata (
    id TEXT PRIMARY KEY, -- Format: 'gmail_oauth_{userId}'
    sync_type TEXT NOT NULL, -- 'gmail_oauth', 'email_sync', etc.
    sync_state JSONB, -- Stores encrypted tokens or other sync state
    last_sync_time TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_sync_metadata_sync_type ON sync_metadata(sync_type);
CREATE INDEX idx_sync_metadata_updated_at ON sync_metadata(updated_at);

-- Enable RLS
ALTER TABLE sync_metadata ENABLE ROW LEVEL SECURITY;

-- Create a simple RLS policy for personal use
CREATE POLICY "Allow all operations for authenticated users" ON sync_metadata
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Create a separate table for email-specific sync metadata if needed
CREATE TABLE IF NOT EXISTS email_sync_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    last_history_id TEXT,
    last_sync_time TIMESTAMPTZ,
    sync_status TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_sync_metadata_updated_at 
    BEFORE UPDATE ON sync_metadata 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_sync_state_updated_at 
    BEFORE UPDATE ON email_sync_state 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add comment for documentation
COMMENT ON TABLE sync_metadata IS 'Stores encrypted OAuth tokens and sync state for various integrations';
COMMENT ON COLUMN sync_metadata.sync_state IS 'JSONB field containing encrypted_tokens for OAuth or other sync-specific state';