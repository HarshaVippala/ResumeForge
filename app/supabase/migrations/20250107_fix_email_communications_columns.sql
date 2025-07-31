
-- Fix email_communications table to match the expected schema
-- Add missing columns that are used in the Gmail service

-- Add message_id column (Gmail message ID)
ALTER TABLE public.email_communications 
ADD COLUMN IF NOT EXISTS message_id TEXT UNIQUE;

-- Add body_text column (plain text body)
ALTER TABLE public.email_communications 
ADD COLUMN IF NOT EXISTS body_text TEXT;

-- Add body_html column (HTML body)
ALTER TABLE public.email_communications 
ADD COLUMN IF NOT EXISTS body_html TEXT;

-- Add history_id column (for Gmail sync)
ALTER TABLE public.email_communications 
ADD COLUMN IF NOT EXISTS history_id TEXT;

-- Add gmail_labels column
ALTER TABLE public.email_communications 
ADD COLUMN IF NOT EXISTS gmail_labels TEXT[] DEFAULT '{}';

-- Add raw_email column (store original Gmail message)
ALTER TABLE public.email_communications 
ADD COLUMN IF NOT EXISTS raw_email JSONB;

-- Add recipient_emails column
ALTER TABLE public.email_communications 
ADD COLUMN IF NOT EXISTS recipient_emails TEXT[] DEFAULT '{}';

-- Add processing_version column
ALTER TABLE public.email_communications 
ADD COLUMN IF NOT EXISTS processing_version TEXT DEFAULT 'v1.0';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_message_id ON public.email_communications(message_id);
CREATE INDEX IF NOT EXISTS idx_email_history_id ON public.email_communications(history_id);

-- Update any existing NULL values
UPDATE public.email_communications 
SET message_id = COALESCE(message_id, gmail_id)
WHERE message_id IS NULL AND gmail_id IS NOT NULL;
