-- Create oauth_tokens table for secure token storage
CREATE TABLE IF NOT EXISTS public.oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  provider TEXT NOT NULL DEFAULT 'gmail',
  
  -- Encrypted token storage
  encrypted_tokens JSONB NOT NULL, -- Contains encrypted_data, iv, auth_tag, salt
  email_address TEXT NOT NULL,
  email_hash TEXT NOT NULL, -- SHA256 hash for privacy-preserving lookups
  
  -- OAuth metadata
  scopes TEXT[] NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(user_id, provider),
  UNIQUE(email_address, provider)
);

-- Create indexes for efficient lookups
CREATE INDEX idx_oauth_tokens_user_provider ON public.oauth_tokens(user_id, provider);
CREATE INDEX idx_oauth_tokens_email_hash ON public.oauth_tokens(email_hash);
CREATE INDEX idx_oauth_tokens_updated ON public.oauth_tokens(updated_at DESC);

-- Enable RLS
ALTER TABLE public.oauth_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Only service role can access oauth tokens for security
CREATE POLICY "Service role full access to oauth_tokens" ON public.oauth_tokens
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- Create function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_oauth_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update the updated_at column
CREATE TRIGGER update_oauth_tokens_updated_at
  BEFORE UPDATE ON public.oauth_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_oauth_tokens_updated_at();

-- Add missing columns to email_communications if they don't exist
DO $$ 
BEGIN
  -- Add history_id column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'email_communications' 
    AND column_name = 'history_id'
  ) THEN
    ALTER TABLE public.email_communications ADD COLUMN history_id BIGINT;
  END IF;

  -- Add gmail_labels column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'email_communications' 
    AND column_name = 'gmail_labels'
  ) THEN
    ALTER TABLE public.email_communications ADD COLUMN gmail_labels TEXT[];
  END IF;

  -- Add raw_email column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'email_communications' 
    AND column_name = 'raw_email'
  ) THEN
    ALTER TABLE public.email_communications ADD COLUMN raw_email JSONB;
  END IF;

  -- Add is_processed column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'email_communications' 
    AND column_name = 'is_processed'
  ) THEN
    ALTER TABLE public.email_communications ADD COLUMN is_processed BOOLEAN DEFAULT false;
  END IF;

  -- Add ai_processed column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'email_communications' 
    AND column_name = 'ai_processed'
  ) THEN
    ALTER TABLE public.email_communications ADD COLUMN ai_processed BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Create indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_email_communications_history_id ON public.email_communications(history_id);
CREATE INDEX IF NOT EXISTS idx_email_communications_is_processed ON public.email_communications(is_processed);
CREATE INDEX IF NOT EXISTS idx_email_communications_ai_processed ON public.email_communications(ai_processed);

-- Grant necessary permissions
GRANT ALL ON public.oauth_tokens TO service_role;
GRANT ALL ON public.oauth_tokens_id_seq TO service_role;