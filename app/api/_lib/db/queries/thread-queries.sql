-- =============================================================================
-- Thread Management Queries
-- Optimized SQL queries for thread operations using emails table
-- Created: 2025-01-09
-- =============================================================================

-- Query 1: Get thread statistics efficiently
-- This query aggregates thread data without fetching full email content
CREATE OR REPLACE FUNCTION get_thread_stats(p_thread_id TEXT)
RETURNS TABLE (
  thread_id TEXT,
  message_count INTEGER,
  first_message_at TIMESTAMP WITH TIME ZONE,
  last_message_at TIMESTAMP WITH TIME ZONE,
  has_job_related BOOLEAN,
  requires_response BOOLEAN,
  unread_count INTEGER,
  primary_company TEXT,
  primary_job_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p_thread_id,
    COUNT(*)::INTEGER as message_count,
    MIN(COALESCE(e.received_at, e.created_at::TIMESTAMP WITH TIME ZONE)) as first_message_at,
    MAX(COALESCE(e.received_at, e.created_at::TIMESTAMP WITH TIME ZONE)) as last_message_at,
    bool_or(e.is_job_related) as has_job_related,
    bool_or(e.requires_action) as requires_response,
    COUNT(CASE WHEN NOT e.ai_processed THEN 1 END)::INTEGER as unread_count,
    -- Extract primary company from most frequent domain
    (
      SELECT domain
      FROM (
        SELECT 
          substring(e2.sender from '@([^>]+)') as domain,
          COUNT(*) as domain_count
        FROM emails e2
        WHERE e2.thread_id = p_thread_id
          AND e2.sender ~ '@[^>]+'
          AND substring(e2.sender from '@([^>]+)') NOT LIKE '%gmail.com%'
          AND substring(e2.sender from '@([^>]+)') NOT LIKE '%outlook.com%'
        GROUP BY substring(e2.sender from '@([^>]+)')
        ORDER BY domain_count DESC
        LIMIT 1
      ) domains
    ) as primary_company,
    -- Get most frequent job_id
    (
      SELECT e3.job_id
      FROM emails e3
      WHERE e3.thread_id = p_thread_id
        AND e3.job_id IS NOT NULL
      GROUP BY e3.job_id
      ORDER BY COUNT(*) DESC
      LIMIT 1
    ) as primary_job_id
  FROM emails e
  WHERE e.thread_id = p_thread_id
  GROUP BY p_thread_id;
END;
$$ LANGUAGE plpgsql;

-- Query 2: Get all threads with pagination and filtering
CREATE OR REPLACE FUNCTION get_threads_paginated(
  p_job_id UUID DEFAULT NULL,
  p_requires_response BOOLEAN DEFAULT NULL,
  p_has_job_related BOOLEAN DEFAULT NULL,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  thread_id TEXT,
  subject_normalized TEXT,
  message_count INTEGER,
  first_message_at TIMESTAMP WITH TIME ZONE,
  last_message_at TIMESTAMP WITH TIME ZONE,
  has_job_related BOOLEAN,
  requires_response BOOLEAN,
  unread_count INTEGER,
  primary_company TEXT,
  primary_job_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.thread_id,
    -- Normalize subject from first email
    lower(regexp_replace(
      regexp_replace(
        COALESCE(
          (SELECT e2.subject 
           FROM emails e2 
           WHERE e2.thread_id = e.thread_id 
           ORDER BY COALESCE(e2.received_at, e2.created_at::TIMESTAMP WITH TIME ZONE)
           LIMIT 1),
          'No subject'
        ),
        '^(re:|fwd:|fw:)\s*', '', 'gi'
      ),
      '\s+', ' ', 'g'
    )) as subject_normalized,
    COUNT(*)::INTEGER as message_count,
    MIN(COALESCE(e.received_at, e.created_at::TIMESTAMP WITH TIME ZONE)) as first_message_at,
    MAX(COALESCE(e.received_at, e.created_at::TIMESTAMP WITH TIME ZONE)) as last_message_at,
    bool_or(e.is_job_related) as has_job_related,
    bool_or(e.requires_action) as requires_response,
    COUNT(CASE WHEN NOT e.ai_processed THEN 1 END)::INTEGER as unread_count,
    -- Extract primary company from most frequent domain
    (
      SELECT domain
      FROM (
        SELECT 
          substring(e2.sender from '@([^>]+)') as domain,
          COUNT(*) as domain_count
        FROM emails e2
        WHERE e2.thread_id = e.thread_id
          AND e2.sender ~ '@[^>]+'
          AND substring(e2.sender from '@([^>]+)') NOT LIKE '%gmail.com%'
          AND substring(e2.sender from '@([^>]+)') NOT LIKE '%outlook.com%'
        GROUP BY substring(e2.sender from '@([^>]+)')
        ORDER BY domain_count DESC
        LIMIT 1
      ) domains
    ) as primary_company,
    -- Get most frequent job_id
    (
      SELECT e3.job_id
      FROM emails e3
      WHERE e3.thread_id = e.thread_id
        AND e3.job_id IS NOT NULL
      GROUP BY e3.job_id
      ORDER BY COUNT(*) DESC
      LIMIT 1
    ) as primary_job_id
  FROM emails e
  WHERE 
    (p_job_id IS NULL OR e.job_id = p_job_id)
    AND (p_requires_response IS NULL OR e.requires_action = p_requires_response)
    AND (p_has_job_related IS NULL OR e.is_job_related = p_has_job_related)
  GROUP BY e.thread_id
  ORDER BY MAX(COALESCE(e.received_at, e.created_at::TIMESTAMP WITH TIME ZONE)) DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- Query 3: Get thread participants efficiently
CREATE OR REPLACE FUNCTION get_thread_participants(p_thread_id TEXT)
RETURNS TABLE (
  email_address TEXT,
  display_name TEXT,
  message_count INTEGER,
  role TEXT,
  is_internal BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  WITH participant_emails AS (
    -- Extract sender emails
    SELECT 
      COALESCE(
        substring(e.sender from '<([^>]+)>'),
        substring(e.sender from '([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})')
      ) as email_address,
      COALESCE(
        substring(e.sender from '^(.*?)\s*<'),
        e.sender
      ) as display_name,
      1 as message_count,
      'sender' as participant_type
    FROM emails e
    WHERE e.thread_id = p_thread_id
    
    UNION ALL
    
    -- Extract recipient emails
    SELECT 
      COALESCE(
        substring(recipient from '<([^>]+)>'),
        substring(recipient from '([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})')
      ) as email_address,
      COALESCE(
        substring(recipient from '^(.*?)\s*<'),
        recipient
      ) as display_name,
      0 as message_count,
      'recipient' as participant_type
    FROM emails e,
         unnest(COALESCE(e.recipients, '{}')) as recipient
    WHERE e.thread_id = p_thread_id
  ),
  aggregated_participants AS (
    SELECT 
      pe.email_address,
      -- Use the most complete display name
      COALESCE(
        NULLIF(regexp_replace(pe.display_name, '"', '', 'g'), ''),
        pe.email_address
      ) as display_name,
      SUM(pe.message_count) as message_count
    FROM participant_emails pe
    WHERE pe.email_address IS NOT NULL
    GROUP BY pe.email_address, pe.display_name
  )
  SELECT 
    ap.email_address,
    ap.display_name,
    ap.message_count::INTEGER,
    -- Infer role based on email and name
    CASE 
      WHEN lower(ap.display_name) LIKE '%recruiter%' OR lower(ap.email_address) LIKE '%recruiter%' THEN 'recruiter'
      WHEN lower(ap.display_name) LIKE '%hiring%' OR lower(ap.display_name) LIKE '%hr%' THEN 'hiring_manager'
      WHEN lower(ap.display_name) LIKE '%ceo%' OR lower(ap.display_name) LIKE '%cto%' OR lower(ap.display_name) LIKE '%founder%' THEN 'executive'
      WHEN lower(ap.email_address) LIKE '%noreply%' OR lower(ap.email_address) LIKE '%no-reply%' THEN 'system'
      ELSE 'contact'
    END as role,
    -- Check if internal (user's email)
    ap.email_address LIKE '%harsha.vippala1@gmail.com%' as is_internal
  FROM aggregated_participants ap
  ORDER BY ap.message_count DESC, ap.email_address;
END;
$$ LANGUAGE plpgsql;

-- Query 4: Update thread analysis for all emails in a thread
CREATE OR REPLACE FUNCTION update_thread_analysis(
  p_thread_id TEXT,
  p_summary TEXT DEFAULT NULL,
  p_email_type TEXT DEFAULT NULL,
  p_confidence FLOAT DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE emails 
  SET 
    thread_summary = COALESCE(p_summary, thread_summary),
    email_type = COALESCE(p_email_type::TEXT, email_type),
    classification_confidence = COALESCE(p_confidence, classification_confidence),
    ai_processed = true,
    processing_version = 'v1.0'
  WHERE thread_id = p_thread_id;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Query 5: Get threads requiring response
CREATE OR REPLACE FUNCTION get_threads_requiring_response(p_limit INTEGER DEFAULT 50)
RETURNS TABLE (
  thread_id TEXT,
  subject TEXT,
  last_message_at TIMESTAMP WITH TIME ZONE,
  sender TEXT,
  primary_company TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    e.thread_id,
    e.subject,
    MAX(COALESCE(e.received_at, e.created_at::TIMESTAMP WITH TIME ZONE)) as last_message_at,
    -- Get sender of last message
    (
      SELECT e2.sender
      FROM emails e2
      WHERE e2.thread_id = e.thread_id
      ORDER BY COALESCE(e2.received_at, e2.created_at::TIMESTAMP WITH TIME ZONE) DESC
      LIMIT 1
    ) as sender,
    -- Get primary company
    (
      SELECT domain
      FROM (
        SELECT 
          substring(e2.sender from '@([^>]+)') as domain,
          COUNT(*) as domain_count
        FROM emails e2
        WHERE e2.thread_id = e.thread_id
          AND e2.sender ~ '@[^>]+'
          AND substring(e2.sender from '@([^>]+)') NOT LIKE '%gmail.com%'
          AND substring(e2.sender from '@([^>]+)') NOT LIKE '%outlook.com%'
        GROUP BY substring(e2.sender from '@([^>]+)')
        ORDER BY domain_count DESC
        LIMIT 1
      ) domains
    ) as primary_company
  FROM emails e
  WHERE e.requires_action = true
  GROUP BY e.thread_id, e.subject
  ORDER BY last_message_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Query 6: Clean up old non-job-related emails
CREATE OR REPLACE FUNCTION cleanup_old_emails(p_days_old INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
  cutoff_date TIMESTAMP WITH TIME ZONE;
BEGIN
  cutoff_date := NOW() - INTERVAL '1 day' * p_days_old;
  
  DELETE FROM emails 
  WHERE created_at < cutoff_date
    AND is_job_related = false
    AND ai_processed = true;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- Performance Indexes for Thread Operations
-- =============================================================================

-- Index for efficient thread queries
CREATE INDEX IF NOT EXISTS idx_emails_thread_id_received_at 
ON emails (thread_id, received_at DESC);

-- Index for job-related thread filtering
CREATE INDEX IF NOT EXISTS idx_emails_thread_job_related 
ON emails (thread_id, is_job_related) WHERE is_job_related = true;

-- Index for threads requiring response
CREATE INDEX IF NOT EXISTS idx_emails_thread_requires_action 
ON emails (thread_id, requires_action) WHERE requires_action = true;

-- Index for AI processing status
CREATE INDEX IF NOT EXISTS idx_emails_thread_ai_processed 
ON emails (thread_id, ai_processed);

-- Composite index for thread filtering
CREATE INDEX IF NOT EXISTS idx_emails_thread_composite 
ON emails (thread_id, received_at DESC, is_job_related, requires_action);

-- =============================================================================
-- Grant permissions to service role
-- =============================================================================

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- =============================================================================
-- Usage Examples
-- =============================================================================

/*
-- Get stats for a specific thread
SELECT * FROM get_thread_stats('thread_12345');

-- Get paginated threads with filtering
SELECT * FROM get_threads_paginated(
  p_job_id := NULL,
  p_requires_response := true,
  p_has_job_related := true,
  p_limit := 10,
  p_offset := 0
);

-- Get participants for a thread
SELECT * FROM get_thread_participants('thread_12345');

-- Update thread analysis
SELECT update_thread_analysis(
  'thread_12345',
  'This is a job application thread',
  'application_confirmation',
  0.85
);

-- Get threads requiring response
SELECT * FROM get_threads_requiring_response(20);

-- Clean up old emails
SELECT cleanup_old_emails(30); -- Delete emails older than 30 days
*/