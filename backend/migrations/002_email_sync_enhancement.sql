-- Migration: Enhanced Email Sync and Recruiter Tracking
-- Date: 2025-06-13
-- Description: Adds incremental sync support, recruiter tracking, and enhanced email data

-- 1. Sync metadata table for incremental updates
CREATE TABLE IF NOT EXISTS sync_metadata (
    id SERIAL PRIMARY KEY,
    user_email VARCHAR(255) UNIQUE NOT NULL,
    last_sync_timestamp TIMESTAMPTZ,
    last_gmail_date DATE,
    last_history_id BIGINT,
    sync_status VARCHAR(20) DEFAULT 'idle', -- idle, in_progress, completed, failed
    processed_count INTEGER DEFAULT 0,
    tokens_used INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Enhance email_communications table
ALTER TABLE email_communications 
ADD COLUMN IF NOT EXISTS thread_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS rich_summary TEXT,
ADD COLUMN IF NOT EXISTS key_info JSONB,
ADD COLUMN IF NOT EXISTS action_items JSONB,
ADD COLUMN IF NOT EXISTS extracted_links JSONB,
ADD COLUMN IF NOT EXISTS recruiter_id UUID,
ADD COLUMN IF NOT EXISTS conversation_stage VARCHAR(50);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_thread_id ON email_communications(thread_id);
CREATE INDEX IF NOT EXISTS idx_email_date_desc ON email_communications(email_date DESC);
CREATE INDEX IF NOT EXISTS idx_email_recruiter ON email_communications(recruiter_id);

-- 3. Recruiter tracking tables
CREATE TABLE IF NOT EXISTS recruiters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(50),
    linkedin_url VARCHAR(500),
    agency_name VARCHAR(255),
    recruiter_type VARCHAR(50) CHECK (recruiter_type IN ('agency', 'internal', 'freelance')),
    first_contact_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    last_interaction TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    interaction_count INTEGER DEFAULT 1,
    notes TEXT,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 4. Recruiter-Company relationships
CREATE TABLE IF NOT EXISTS recruiter_companies (
    recruiter_id UUID REFERENCES recruiters(id) ON DELETE CASCADE,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    relationship_type VARCHAR(50) DEFAULT 'represents', -- represents, works_for
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (recruiter_id, company_id)
);

-- 5. Email thread tracking
CREATE TABLE IF NOT EXISTS email_threads (
    thread_id VARCHAR(255) PRIMARY KEY,
    recruiter_id UUID REFERENCES recruiters(id) ON DELETE SET NULL,
    subject VARCHAR(500),
    first_email_date TIMESTAMPTZ,
    last_email_date TIMESTAMPTZ,
    email_count INTEGER DEFAULT 1,
    status VARCHAR(50) DEFAULT 'active', -- active, stale, closed
    next_action VARCHAR(255),
    next_action_date DATE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 6. Gmail push notification subscriptions
CREATE TABLE IF NOT EXISTS gmail_push_subscriptions (
    id SERIAL PRIMARY KEY,
    user_email VARCHAR(255) UNIQUE NOT NULL,
    watch_expiration TIMESTAMPTZ,
    topic_name VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 7. Follow-up reminders
CREATE TABLE IF NOT EXISTS email_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email_id VARCHAR(255),
    thread_id VARCHAR(255),
    recruiter_id UUID REFERENCES recruiters(id) ON DELETE CASCADE,
    reminder_type VARCHAR(50), -- followup, response, deadline
    reminder_date TIMESTAMPTZ,
    reminder_message TEXT,
    is_completed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_sync_metadata_updated_at BEFORE UPDATE ON sync_metadata
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recruiters_updated_at BEFORE UPDATE ON recruiters
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_threads_updated_at BEFORE UPDATE ON email_threads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_gmail_push_subscriptions_updated_at BEFORE UPDATE ON gmail_push_subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create view for active recruiter conversations
CREATE OR REPLACE VIEW active_recruiter_conversations AS
SELECT 
    r.id as recruiter_id,
    r.name as recruiter_name,
    r.agency_name,
    r.email as recruiter_email,
    et.thread_id,
    et.subject,
    et.last_email_date,
    et.email_count,
    et.status as thread_status,
    et.next_action,
    et.next_action_date,
    COUNT(DISTINCT rc.company_id) as companies_represented
FROM recruiters r
JOIN email_threads et ON r.id = et.recruiter_id
LEFT JOIN recruiter_companies rc ON r.id = rc.recruiter_id
WHERE et.status = 'active'
  AND r.is_active = true
GROUP BY r.id, r.name, r.agency_name, r.email, et.thread_id, et.subject, 
         et.last_email_date, et.email_count, et.status, et.next_action, et.next_action_date
ORDER BY et.last_email_date DESC;

-- Add comments for documentation
COMMENT ON TABLE sync_metadata IS 'Tracks email sync state for incremental updates';
COMMENT ON TABLE recruiters IS 'Stores recruiter information and interaction history';
COMMENT ON TABLE email_threads IS 'Tracks email conversation threads with recruiters';
COMMENT ON COLUMN email_communications.rich_summary IS 'AI-generated comprehensive summary of email content';
COMMENT ON COLUMN email_communications.key_info IS 'Structured key information extracted from email (dates, links, etc)';
COMMENT ON COLUMN email_communications.action_items IS 'Extracted action items with deadlines';