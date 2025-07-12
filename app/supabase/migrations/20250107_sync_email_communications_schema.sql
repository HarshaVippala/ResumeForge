-- Sync email_communications table with TypeScript types
-- This migration ensures the database matches the expected schema

-- First, let's add all the missing columns based on the TypeScript types
ALTER TABLE public.email_communications 
-- Core email fields
ADD COLUMN IF NOT EXISTS gmail_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS sender TEXT,
ADD COLUMN IF NOT EXISTS recipient TEXT,
ADD COLUMN IF NOT EXISTS body TEXT,
ADD COLUMN IF NOT EXISTS body_text TEXT,
ADD COLUMN IF NOT EXISTS body_html TEXT,
ADD COLUMN IF NOT EXISTS timestamp TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'unread' CHECK (status IN ('read', 'unread')),
ADD COLUMN IF NOT EXISTS ai_processed BOOLEAN DEFAULT false,

-- AI Analysis fields
ADD COLUMN IF NOT EXISTS email_type TEXT CHECK (email_type IN ('recruiter', 'interview', 'offer', 'rejection', 'follow_up', 'application', 'general')),
ADD COLUMN IF NOT EXISTS company TEXT,
ADD COLUMN IF NOT EXISTS position TEXT,
ADD COLUMN IF NOT EXISTS summary TEXT,
ADD COLUMN IF NOT EXISTS action_required BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'critical')),

-- Enhanced fields
ADD COLUMN IF NOT EXISTS extracted_details JSONB,
ADD COLUMN IF NOT EXISTS normalized_company TEXT,
ADD COLUMN IF NOT EXISTS normalized_position TEXT,

-- Metadata fields
ADD COLUMN IF NOT EXISTS labels TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS job_opportunities JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_email_gmail_id ON public.email_communications(gmail_id);
CREATE INDEX IF NOT EXISTS idx_email_status ON public.email_communications(status);
CREATE INDEX IF NOT EXISTS idx_email_is_job_related ON public.email_communications(is_job_related);
CREATE INDEX IF NOT EXISTS idx_email_company ON public.email_communications(company) WHERE company IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_email_type ON public.email_communications(email_type) WHERE email_type IS NOT NULL;

-- Update any existing data to ensure consistency
UPDATE public.email_communications 
SET 
  timestamp = COALESCE(timestamp, received_at),
  date = COALESCE(date, received_at),
  status = CASE WHEN is_read THEN 'read' ELSE 'unread' END
WHERE timestamp IS NULL OR date IS NULL;