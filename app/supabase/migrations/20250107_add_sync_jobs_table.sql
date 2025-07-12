-- Add sync_jobs table for tracking async sync operations
-- Date: 2025-01-07

-- Create sync_jobs table
CREATE TABLE IF NOT EXISTS public.sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  
  -- Job metadata
  job_type TEXT NOT NULL, -- 'initial', 'incremental', 'manual'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
  progress INTEGER DEFAULT 0, -- 0-100
  
  -- Timing
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Progress tracking
  total_emails INTEGER DEFAULT 0,
  processed_emails INTEGER DEFAULT 0,
  failed_emails INTEGER DEFAULT 0,
  
  -- Results
  result JSONB,
  error_message TEXT,
  
  -- Sync details
  sync_params JSONB, -- Store sync parameters (daysBack, etc.)
  sync_stats JSONB -- Store detailed statistics
);

-- Create indexes
CREATE INDEX idx_sync_jobs_user_status ON sync_jobs(user_id, status);
CREATE INDEX idx_sync_jobs_created ON sync_jobs(created_at DESC);

-- Update gmail_sync_state to track active job
ALTER TABLE public.gmail_sync_state 
ADD COLUMN IF NOT EXISTS active_sync_job_id UUID REFERENCES sync_jobs(id),
ADD COLUMN IF NOT EXISTS last_manual_sync_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS sync_time_range_start TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS sync_time_range_end TIMESTAMPTZ;

-- RLS policies
ALTER TABLE public.sync_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to sync_jobs" ON public.sync_jobs
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- Grant permissions
GRANT ALL ON public.sync_jobs TO postgres, service_role;