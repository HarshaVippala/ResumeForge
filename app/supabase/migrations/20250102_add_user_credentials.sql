-- Create user_credentials table for WebAuthn passkeys
CREATE TABLE IF NOT EXISTS user_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id TEXT UNIQUE NOT NULL,
  public_key TEXT NOT NULL,
  counter BIGINT DEFAULT 0,
  device_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used TIMESTAMP WITH TIME ZONE
);

-- Create index for faster lookups
CREATE INDEX idx_user_credentials_credential_id ON user_credentials(credential_id);

-- Add RLS policies (optional since this is personal use)
ALTER TABLE user_credentials ENABLE ROW LEVEL SECURITY;

-- Simple policy that allows all operations (since it's personal use)
CREATE POLICY "Allow all operations on user_credentials" ON user_credentials
  FOR ALL USING (true) WITH CHECK (true);