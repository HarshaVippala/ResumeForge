-- Comprehensive Gmail Integration Database Schema
-- This migration implements all tables from the Gmail Integration Implementation Plan

-- Ensure email_communications has all required columns
ALTER TABLE public.email_communications 
ADD COLUMN IF NOT EXISTS is_job_related BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS job_relevance_confidence REAL,
ADD COLUMN IF NOT EXISTS email_type TEXT,
ADD COLUMN IF NOT EXISTS ai_summary TEXT,
ADD COLUMN IF NOT EXISTS ai_summary_confidence REAL,
ADD COLUMN IF NOT EXISTS extracted_company TEXT,
ADD COLUMN IF NOT EXISTS extracted_position TEXT,
ADD COLUMN IF NOT EXISTS extracted_status TEXT,
ADD COLUMN IF NOT EXISTS extracted_dates JSONB,
ADD COLUMN IF NOT EXISTS extracted_contacts JSONB,
ADD COLUMN IF NOT EXISTS extracted_metadata JSONB,
ADD COLUMN IF NOT EXISTS processing_version TEXT DEFAULT 'v1.0',
ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS processing_duration_ms INTEGER,
ADD COLUMN IF NOT EXISTS ai_model_used TEXT,
ADD COLUMN IF NOT EXISTS token_usage JSONB,
ADD COLUMN IF NOT EXISTS linked_job_id UUID REFERENCES my_jobs(id),
ADD COLUMN IF NOT EXISTS linked_resume_session_id UUID REFERENCES resume_sessions(id),
ADD COLUMN IF NOT EXISTS thread_position INTEGER,
ADD COLUMN IF NOT EXISTS is_thread_starter BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS reply_to_message_id TEXT,
ADD COLUMN IF NOT EXISTS search_vector tsvector,
ADD COLUMN IF NOT EXISTS tags TEXT[];

-- Create missing indexes for email_communications
CREATE INDEX IF NOT EXISTS idx_emails_job_related ON email_communications(is_job_related, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_emails_thread ON email_communications(thread_id, thread_position);
CREATE INDEX IF NOT EXISTS idx_emails_company ON email_communications(extracted_company) WHERE is_job_related = true;
CREATE INDEX IF NOT EXISTS idx_emails_status ON email_communications(extracted_status) WHERE is_job_related = true;
CREATE INDEX IF NOT EXISTS idx_emails_search ON email_communications USING gin(search_vector);

-- Enhanced email_threads table with all fields from plan
ALTER TABLE public.email_threads 
ADD COLUMN IF NOT EXISTS gmail_thread_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS subject_normalized TEXT,
ADD COLUMN IF NOT EXISTS participants JSONB NOT NULL DEFAULT '{"internal": [], "external": []}'::jsonb,
ADD COLUMN IF NOT EXISTS primary_company TEXT,
ADD COLUMN IF NOT EXISTS primary_job_id UUID REFERENCES my_jobs(id),
ADD COLUMN IF NOT EXISTS first_message_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS message_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS thread_status TEXT DEFAULT 'active',
ADD COLUMN IF NOT EXISTS job_application_status TEXT,
ADD COLUMN IF NOT EXISTS requires_response BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS last_response_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS thread_summary TEXT,
ADD COLUMN IF NOT EXISTS thread_sentiment TEXT,
ADD COLUMN IF NOT EXISTS conversation_stage TEXT,
ADD COLUMN IF NOT EXISTS ai_confidence REAL;

-- Create indexes for email_threads
CREATE INDEX IF NOT EXISTS idx_threads_status ON email_threads(job_application_status, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_threads_gmail_id ON email_threads(gmail_thread_id);
CREATE INDEX IF NOT EXISTS idx_threads_company ON email_threads(primary_company);

-- Enhanced gmail_sync_state table
CREATE TABLE IF NOT EXISTS public.gmail_sync_state (
  user_id UUID PRIMARY KEY,
  
  -- Sync tracking
  last_history_id BIGINT,
  last_full_sync_at TIMESTAMPTZ,
  last_incremental_sync_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'idle', -- idle, syncing, error
  
  -- Watch management
  watch_active BOOLEAN DEFAULT false,
  watch_expires_at TIMESTAMPTZ,
  watch_topic_name TEXT,
  watch_last_renewed_at TIMESTAMPTZ,
  
  -- Performance tracking
  average_sync_duration_ms INTEGER,
  last_sync_email_count INTEGER,
  total_emails_synced INTEGER DEFAULT 0,
  
  -- Error tracking
  consecutive_failures INTEGER DEFAULT 0,
  last_error_at TIMESTAMPTZ,
  last_error_message TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dashboard insights cache table
CREATE TABLE IF NOT EXISTS public.dashboard_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  
  -- Insight data
  focus_areas JSONB NOT NULL,
  overview_insights JSONB NOT NULL,
  upcoming_events JSONB NOT NULL,
  strategic_recommendations JSONB NOT NULL,
  quick_wins JSONB NOT NULL,
  
  -- Metadata
  generated_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  emails_analyzed INTEGER,
  ai_confidence REAL,
  generation_duration_ms INTEGER,
  
  -- Versioning
  insight_version TEXT DEFAULT 'v1.0',
  invalidated_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for dashboard insights
CREATE INDEX IF NOT EXISTS idx_insights_user_expires ON dashboard_insights(user_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_insights_generated ON dashboard_insights(generated_at DESC);

-- Enhanced processing queue (if not exists from previous migration)
ALTER TABLE public.email_processing_queue 
ADD COLUMN IF NOT EXISTS job_type TEXT,
ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS payload JSONB,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_attempts INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS result JSONB,
ADD COLUMN IF NOT EXISTS error_message TEXT,
ADD COLUMN IF NOT EXISTS processing_duration_ms INTEGER;

-- Create index for processing queue
CREATE INDEX IF NOT EXISTS idx_queue_priority ON email_processing_queue(status, priority DESC, scheduled_at);

-- Search configuration
DO $$ 
BEGIN
  -- Create search configuration if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_ts_config WHERE cfgname = 'email_search'
  ) THEN
    CREATE TEXT SEARCH CONFIGURATION email_search (COPY = english);
    ALTER TEXT SEARCH CONFIGURATION email_search 
      ALTER MAPPING FOR word, asciiword WITH simple;
  END IF;
END $$;

-- Function to update email search vector
CREATE OR REPLACE FUNCTION update_email_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('email_search',
    COALESCE(NEW.subject, '') || ' ' ||
    COALESCE(NEW.sender_name, '') || ' ' ||
    COALESCE(NEW.extracted_company, '') || ' ' ||
    COALESCE(NEW.extracted_position, '') || ' ' ||
    COALESCE(NEW.ai_summary, '') || ' ' ||
    COALESCE(NEW.body_text, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for search vector updates
DROP TRIGGER IF EXISTS email_search_vector_update ON email_communications;
CREATE TRIGGER email_search_vector_update
  BEFORE INSERT OR UPDATE ON email_communications
  FOR EACH ROW EXECUTE FUNCTION update_email_search_vector();

-- RLS Policies for new tables
ALTER TABLE public.gmail_sync_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_insights ENABLE ROW LEVEL SECURITY;

-- Service role access policies
CREATE POLICY "Service role full access to gmail_sync_state" ON public.gmail_sync_state
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role full access to dashboard_insights" ON public.dashboard_insights
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- Update functions for timestamps
CREATE OR REPLACE FUNCTION update_gmail_sync_state_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_gmail_sync_state_updated_at
  BEFORE UPDATE ON public.gmail_sync_state
  FOR EACH ROW
  EXECUTE FUNCTION update_gmail_sync_state_updated_at();

-- Grant permissions
GRANT ALL ON public.gmail_sync_state TO service_role;
GRANT ALL ON public.dashboard_insights TO service_role;