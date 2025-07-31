-- Gmail Optimization Tables Migration
-- Adds tables for thread-based sync, real-time notifications, and performance optimization

-- 1. Email threads table for efficient thread management
CREATE TABLE IF NOT EXISTS email_threads (
  id TEXT PRIMARY KEY, -- Gmail thread ID
  subject TEXT NOT NULL,
  participants TEXT[], -- Array of email addresses
  message_count INTEGER DEFAULT 1,
  first_message_date TIMESTAMP WITH TIME ZONE,
  latest_message_date TIMESTAMP WITH TIME ZONE,
  snippet TEXT,
  is_job_related BOOLEAN DEFAULT false,
  company TEXT,
  position TEXT,
  thread_labels TEXT[],
  history_id TEXT,
  last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for email_threads
CREATE INDEX idx_email_threads_latest_message ON email_threads(latest_message_date DESC);
CREATE INDEX idx_email_threads_job_related ON email_threads(is_job_related) WHERE is_job_related = true;
CREATE INDEX idx_email_threads_company ON email_threads(company) WHERE company IS NOT NULL;

-- 2. Processed notifications table to prevent duplicates
CREATE TABLE IF NOT EXISTS processed_notifications (
  id SERIAL PRIMARY KEY,
  message_id TEXT UNIQUE NOT NULL, -- Pub/Sub message ID
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for cleanup
CREATE INDEX idx_processed_notifications_date ON processed_notifications(processed_at);

-- 3. AI processing queue for job-related emails
CREATE TABLE IF NOT EXISTS ai_processing_queue (
  id SERIAL PRIMARY KEY,
  message_id TEXT UNIQUE NOT NULL,
  thread_id TEXT,
  priority INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
  queued_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0
);

-- Indexes for processing queue
CREATE INDEX idx_ai_queue_status_priority ON ai_processing_queue(status, priority DESC) 
  WHERE status IN ('pending', 'failed');
CREATE INDEX idx_ai_queue_thread ON ai_processing_queue(thread_id);

-- 4. Email metadata cache for performance
CREATE TABLE IF NOT EXISTS email_metadata_cache (
  message_id TEXT PRIMARY KEY,
  thread_id TEXT,
  metadata JSONB NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for cache expiration
CREATE INDEX idx_email_cache_expires ON email_metadata_cache(expires_at);
CREATE INDEX idx_email_cache_thread ON email_metadata_cache(thread_id);

-- 5. Sync performance metrics
CREATE TABLE IF NOT EXISTS sync_performance_metrics (
  id SERIAL PRIMARY KEY,
  sync_type TEXT NOT NULL, -- initial, incremental, realtime
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  messages_processed INTEGER DEFAULT 0,
  threads_processed INTEGER DEFAULT 0,
  cache_hits INTEGER DEFAULT 0,
  cache_misses INTEGER DEFAULT 0,
  api_calls_made INTEGER DEFAULT 0,
  quota_units_used INTEGER DEFAULT 0,
  errors_count INTEGER DEFAULT 0,
  duration_ms INTEGER,
  metadata JSONB
);

-- Index for performance analysis
CREATE INDEX idx_sync_metrics_date ON sync_performance_metrics(started_at DESC);
CREATE INDEX idx_sync_metrics_type ON sync_performance_metrics(sync_type);

-- 6. Add missing columns to email_communications if they don't exist
ALTER TABLE email_communications 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS thread_position INTEGER, -- Position within thread
ADD COLUMN IF NOT EXISTS labels TEXT[],
ADD COLUMN IF NOT EXISTS has_attachments BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS attachment_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_sent BOOLEAN DEFAULT false; -- Emails sent by user

-- Additional indexes for email_communications
CREATE INDEX IF NOT EXISTS idx_email_deleted ON email_communications(deleted_at) 
  WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_labels ON email_communications USING GIN(labels);
CREATE INDEX IF NOT EXISTS idx_email_attachments ON email_communications(has_attachments) 
  WHERE has_attachments = true;

-- 7. Function to update thread statistics
CREATE OR REPLACE FUNCTION update_thread_statistics()
RETURNS TRIGGER AS $$
BEGIN
  -- Update thread message count and dates
  UPDATE email_threads
  SET 
    message_count = (
      SELECT COUNT(*) 
      FROM email_communications 
      WHERE thread_id = NEW.thread_id AND deleted_at IS NULL
    ),
    latest_message_date = (
      SELECT MAX(received_at) 
      FROM email_communications 
      WHERE thread_id = NEW.thread_id AND deleted_at IS NULL
    ),
    updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.thread_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update thread statistics
CREATE TRIGGER update_thread_stats_on_email_change
AFTER INSERT OR UPDATE OR DELETE ON email_communications
FOR EACH ROW
EXECUTE FUNCTION update_thread_statistics();

-- 8. Function to clean up expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM email_metadata_cache WHERE expires_at < CURRENT_TIMESTAMP;
  DELETE FROM processed_notifications WHERE processed_at < CURRENT_TIMESTAMP - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- 9. Add RLS policies (disabled for personal use)
ALTER TABLE email_threads DISABLE ROW LEVEL SECURITY;
ALTER TABLE processed_notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE ai_processing_queue DISABLE ROW LEVEL SECURITY;
ALTER TABLE email_metadata_cache DISABLE ROW LEVEL SECURITY;
ALTER TABLE sync_performance_metrics DISABLE ROW LEVEL SECURITY;

-- 10. Create a view for job application emails
CREATE OR REPLACE VIEW job_application_emails AS
SELECT 
  ec.id,
  ec.email_id,
  ec.thread_id,
  et.subject as thread_subject,
  ec.sender_email,
  ec.sender_name,
  ec.received_at,
  ec.company,
  ec.position,
  ec.email_type,
  ec.application_status,
  ec.urgency,
  ec.deadline,
  ec.requires_action,
  et.message_count as thread_message_count,
  et.participants as thread_participants,
  ec.is_processed,
  ec.confidence_score
FROM email_communications ec
JOIN email_threads et ON ec.thread_id = et.id
WHERE ec.is_job_related = true
  AND ec.deleted_at IS NULL
ORDER BY ec.received_at DESC;

-- Grant permissions (adjust based on your Supabase setup)
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres, service_role;