-- =============================================================================
-- ResumeForge v2 Schema Migration
-- Date: 2025-01-07
-- Description: Creates the complete ResumeForge v2 schema in a separate schema
--              to avoid conflicts with existing tables.
-- =============================================================================

-- Create the new schema
CREATE SCHEMA IF NOT EXISTS resumeforge_v2;

-- Set search path for this migration
SET search_path TO resumeforge_v2, public;

-- =============================================================================
-- Enable Required Extensions
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" SCHEMA public;

-- =============================================================================
-- Core Tables
-- =============================================================================

-- 1. user_profile
-- Stores the single user's profile and preferences
CREATE TABLE IF NOT EXISTS resumeforge_v2.user_profile (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    name TEXT,
    default_resume_data JSONB, -- Reusable contact info, summary, etc.
    preferences JSONB,         -- Theme, notification settings, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE resumeforge_v2.user_profile IS 'Single user profile and preferences';
COMMENT ON COLUMN resumeforge_v2.user_profile.default_resume_data IS 'JSON structure: {contact: {phone, email, linkedin, github, location}, summary, skills: []}';
COMMENT ON COLUMN resumeforge_v2.user_profile.preferences IS 'User preferences for theme, notifications, etc.';

-- 2. auth_credentials
-- WebAuthn passkey storage for passwordless authentication
CREATE TABLE IF NOT EXISTS resumeforge_v2.auth_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES resumeforge_v2.user_profile(id) ON DELETE CASCADE,
    credential_id TEXT NOT NULL UNIQUE,
    public_key BYTEA NOT NULL,
    sign_count INTEGER DEFAULT 0,
    transports TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_credentials_user_id ON resumeforge_v2.auth_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_credentials_credential_id ON resumeforge_v2.auth_credentials(credential_id);

COMMENT ON TABLE resumeforge_v2.auth_credentials IS 'WebAuthn passkey storage for passwordless authentication';

-- 3. oauth_tokens
-- Encrypted OAuth tokens for Gmail integration
CREATE TABLE IF NOT EXISTS resumeforge_v2.oauth_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES resumeforge_v2.user_profile(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('gmail')),
    encrypted_token TEXT NOT NULL, -- Encrypted with GMAIL_TOKEN_ENCRYPTION_KEY
    expires_at TIMESTAMP WITH TIME ZONE,
    scopes TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_oauth_tokens_user_provider ON resumeforge_v2.oauth_tokens(user_id, provider);

COMMENT ON TABLE resumeforge_v2.oauth_tokens IS 'Encrypted OAuth tokens for Gmail integration';
COMMENT ON COLUMN resumeforge_v2.oauth_tokens.encrypted_token IS 'Encrypted with GMAIL_TOKEN_ENCRYPTION_KEY env variable';

-- =============================================================================
-- Company & Contact Management
-- =============================================================================

-- 4. companies
-- Normalized company information with enriched data
CREATE TABLE IF NOT EXISTS resumeforge_v2.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    website TEXT,
    linkedin_url TEXT,
    glassdoor_url TEXT,
    industry TEXT,
    size TEXT CHECK (size IN ('startup', 'small', 'medium', 'large', 'enterprise')),
    location TEXT,
    culture_notes TEXT,          -- Personal observations
    interview_process_notes TEXT, -- Known interview stages/style
    salary_data JSONB,           -- Known ranges by role level
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_companies_name ON resumeforge_v2.companies(name);

COMMENT ON TABLE resumeforge_v2.companies IS 'Normalized company information with enriched data';
COMMENT ON COLUMN resumeforge_v2.companies.salary_data IS 'JSON structure: {senior_engineer: {min, max, currency}, staff_engineer: {min, max, currency}}';

-- 5. contacts
-- Professional network and recruitment contacts
CREATE TABLE IF NOT EXISTS resumeforge_v2.contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    linkedin_url TEXT,
    current_company_id UUID REFERENCES resumeforge_v2.companies(id),
    current_title TEXT,
    contact_type TEXT CHECK (contact_type IN ('recruiter', 'employee', 'hiring_manager', 'referral')),
    relationship_strength TEXT CHECK (relationship_strength IN ('cold', 'warm', 'strong')),
    last_contacted TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    tags TEXT[], -- ['helpful', 'technical_interviewer', 'decision_maker']
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contacts_email ON resumeforge_v2.contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_company ON resumeforge_v2.contacts(current_company_id);

COMMENT ON TABLE resumeforge_v2.contacts IS 'Professional network and recruitment contacts';

-- =============================================================================
-- Job Tracking
-- =============================================================================

-- 6. jobs
-- Central table for all job opportunities
CREATE TABLE IF NOT EXISTS resumeforge_v2.jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Company Information
    company_id UUID REFERENCES resumeforge_v2.companies(id),
    company_name TEXT NOT NULL, -- Denormalized for convenience
    
    -- Job Details
    job_title TEXT NOT NULL,
    description TEXT,
    requirements TEXT,
    location TEXT,
    salary_range TEXT,
    job_type TEXT CHECK (job_type IN ('remote', 'hybrid', 'onsite')),
    
    -- Source & Discovery
    source TEXT CHECK (source IN ('manual', 'email', 'scraper', 'api', 'referral')),
    source_url TEXT,
    external_job_id TEXT, -- LinkedIn/Indeed job ID
    discovered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Application Status
    status TEXT CHECK (status IN ('interested', 'applied', 'interviewing', 'rejected', 'accepted', 'withdrawn')),
    applied_at TIMESTAMP WITH TIME ZONE,
    applied_resume_id UUID, -- Which resume was submitted
    
    -- Analysis & Metadata
    keywords TEXT[],        -- Extracted key skills/requirements
    match_score DECIMAL(3,2), -- 0.00 to 1.00 AI-calculated match
    priority_score INTEGER,   -- 1-10 priority ranking
    
    -- Notes & Tracking
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    deadline TIMESTAMP WITH TIME ZONE,
    last_checked TIMESTAMP WITH TIME ZONE, -- For status updates
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jobs_company ON resumeforge_v2.jobs(company_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON resumeforge_v2.jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_applied_at ON resumeforge_v2.jobs(applied_at);

COMMENT ON TABLE resumeforge_v2.jobs IS 'Central table for all job opportunities';

-- 7. job_contacts
-- Links contacts to specific job opportunities
CREATE TABLE IF NOT EXISTS resumeforge_v2.job_contacts (
    job_id UUID REFERENCES resumeforge_v2.jobs(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES resumeforge_v2.contacts(id) ON DELETE CASCADE,
    role TEXT CHECK (role IN ('recruiter', 'referral', 'interviewer', 'hiring_manager')),
    PRIMARY KEY (job_id, contact_id)
);

COMMENT ON TABLE resumeforge_v2.job_contacts IS 'Links contacts to specific job opportunities';

-- =============================================================================
-- Resume Management
-- =============================================================================

-- 8. resumes
-- Resume versions with comprehensive metadata
CREATE TABLE IF NOT EXISTS resumeforge_v2.resumes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identification
    name TEXT NOT NULL, -- "Google SWE - Backend Focus v2"
    job_id UUID REFERENCES resumeforge_v2.jobs(id),
    
    -- Content
    content JSONB NOT NULL, -- Complete resume structure
    
    -- Metadata
    main_skills TEXT[] NOT NULL,     -- Primary skills emphasized
    tech_stack TEXT[] NOT NULL,       -- Technologies featured
    focus_area TEXT CHECK (focus_area IN ('backend', 'frontend', 'fullstack', 'devops', 'data', 'mobile')),
    
    -- AI Generation Details
    tailoring_notes TEXT,      -- What was customized
    ats_score DECIMAL(3,2),    -- ATS compatibility score
    keyword_density JSONB,     -- Keyword analysis results
    
    -- Version Control
    version INTEGER DEFAULT 1,
    parent_version_id UUID REFERENCES resumeforge_v2.resumes(id), -- For tracking iterations
    is_master BOOLEAN DEFAULT false,
    
    -- File Management
    file_url TEXT,            -- Stored file location
    file_type TEXT CHECK (file_type IN ('pdf', 'docx')),
    file_hash TEXT,           -- For change detection
    
    -- Usage Tracking
    submission_count INTEGER DEFAULT 0,
    last_submitted_at TIMESTAMP WITH TIME ZONE,
    performance_metrics JSONB, -- Response rates, etc.
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    tags TEXT[],
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resumes_job ON resumeforge_v2.resumes(job_id);
CREATE INDEX IF NOT EXISTS idx_resumes_master ON resumeforge_v2.resumes(is_master) WHERE is_master = true;

COMMENT ON TABLE resumeforge_v2.resumes IS 'Resume versions with comprehensive metadata';
COMMENT ON COLUMN resumeforge_v2.resumes.content IS 'JSON structure: {contact: {...}, summary: "...", experience: [...], education: [...], skills: {...}}';

-- 9. resume_sections
-- Individual resume sections for granular version control
CREATE TABLE IF NOT EXISTS resumeforge_v2.resume_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resume_id UUID REFERENCES resumeforge_v2.resumes(id) ON DELETE CASCADE,
    
    -- Section Details
    section_type TEXT NOT NULL CHECK (section_type IN ('contact', 'summary', 'experience', 'education', 'skills', 'projects', 'custom')),
    section_name TEXT NOT NULL, -- Display name
    content JSONB NOT NULL,
    
    -- Display Control
    order_index INTEGER NOT NULL,
    is_visible BOOLEAN DEFAULT true,
    
    -- Generation Metadata
    ai_generated BOOLEAN DEFAULT false,
    generation_prompt TEXT,      -- What was used to generate
    confidence_score DECIMAL(3,2),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resume_sections_resume ON resumeforge_v2.resume_sections(resume_id);
CREATE INDEX IF NOT EXISTS idx_resume_sections_order ON resumeforge_v2.resume_sections(resume_id, order_index);

COMMENT ON TABLE resumeforge_v2.resume_sections IS 'Individual resume sections for granular version control';

-- =============================================================================
-- Email Integration
-- =============================================================================

-- 10. emails
-- Gmail integration with job-related email tracking
CREATE TABLE IF NOT EXISTS resumeforge_v2.emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Gmail Integration
    gmail_id TEXT UNIQUE NOT NULL,
    thread_id TEXT NOT NULL,
    
    -- Email Metadata
    subject TEXT,
    sender TEXT NOT NULL,
    recipients TEXT[],
    received_at TIMESTAMP WITH TIME ZONE,
    
    -- Content
    body_text TEXT,
    body_html TEXT,
    
    -- Attachments
    has_attachments BOOLEAN DEFAULT false,
    attachments JSONB, -- Detailed attachment info
    
    -- Job Relationship
    job_id UUID REFERENCES resumeforge_v2.jobs(id),
    is_job_related BOOLEAN DEFAULT false,
    job_confidence FLOAT CHECK (job_confidence >= 0 AND job_confidence <= 1),
    
    -- Classification
    email_type TEXT CHECK (email_type IN ('application_confirmation', 'recruiter_outreach', 'interview_request', 'rejection', 'offer', 'general')),
    classification_confidence FLOAT,
    
    -- Thread Management
    thread_position INTEGER,      -- Position in thread
    is_thread_root BOOLEAN DEFAULT false,
    thread_summary TEXT,          -- AI summary of full thread
    
    -- Processing Status
    ai_processed BOOLEAN DEFAULT false,
    processing_version TEXT,      -- Track AI model version
    requires_action BOOLEAN DEFAULT false,
    action_deadline TIMESTAMP WITH TIME ZONE,
    
    -- Gmail Labels
    labels TEXT[],
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emails_gmail_id ON resumeforge_v2.emails(gmail_id);
CREATE INDEX IF NOT EXISTS idx_emails_thread_id ON resumeforge_v2.emails(thread_id);
CREATE INDEX IF NOT EXISTS idx_emails_job_id ON resumeforge_v2.emails(job_id);
CREATE INDEX IF NOT EXISTS idx_emails_received_at ON resumeforge_v2.emails(received_at DESC);

COMMENT ON TABLE resumeforge_v2.emails IS 'Gmail integration with job-related email tracking';
COMMENT ON COLUMN resumeforge_v2.emails.attachments IS 'JSON structure: {attachments: [{filename, mimeType, size, gmail_attachment_id, downloaded_url, is_resume, extracted_text}]}';

-- =============================================================================
-- Activity & Event Tracking
-- =============================================================================

-- 11. activity_log
-- Generic activity tracking for all user actions
CREATE TABLE IF NOT EXISTS resumeforge_v2.activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Event Details
    event_type TEXT NOT NULL, -- 'job_added', 'resume_created', 'email_linked', 'application_submitted'
    entity_type TEXT,         -- 'job', 'resume', 'email', 'contact'
    entity_id UUID,
    
    -- Context
    description TEXT,
    metadata JSONB,           -- Event-specific data
    
    -- Source
    source TEXT DEFAULT 'user', -- 'user', 'system', 'email_sync', 'ai'
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_created ON resumeforge_v2.activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_entity ON resumeforge_v2.activity_log(entity_type, entity_id);

COMMENT ON TABLE resumeforge_v2.activity_log IS 'Generic activity tracking for all user actions';

-- 12. application_events
-- Detailed timeline for each job application
CREATE TABLE IF NOT EXISTS resumeforge_v2.application_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES resumeforge_v2.jobs(id) ON DELETE CASCADE,
    
    -- Event Information
    event_type TEXT NOT NULL CHECK (event_type IN ('applied', 'acknowledged', 'screening', 'interview_scheduled', 'interview_completed', 'assessment', 'reference_check', 'offer', 'negotiation', 'accepted', 'rejected', 'withdrawn')),
    event_date TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Event Details
    title TEXT,               -- "Technical Interview with John"
    description TEXT,
    location TEXT,            -- "Zoom" or physical address
    duration_minutes INTEGER,
    
    -- Related Contacts
    contact_name TEXT,
    contact_email TEXT,
    contact_role TEXT,
    
    -- Interview Specific
    interview_type TEXT CHECK (interview_type IN ('phone_screen', 'technical', 'behavioral', 'system_design', 'cultural_fit', 'executive')),
    interviewers TEXT[],      -- Names of all interviewers
    preparation_notes TEXT,
    feedback TEXT,           -- Post-interview notes
    
    -- Outcome
    outcome TEXT CHECK (outcome IN ('passed', 'failed', 'pending', 'cancelled')),
    next_steps TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_application_events_job ON resumeforge_v2.application_events(job_id);
CREATE INDEX IF NOT EXISTS idx_application_events_date ON resumeforge_v2.application_events(event_date);

COMMENT ON TABLE resumeforge_v2.application_events IS 'Detailed timeline for each job application';

-- 13. follow_ups
-- Scheduled and completed follow-up actions
CREATE TABLE IF NOT EXISTS resumeforge_v2.follow_ups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Relationships
    job_id UUID REFERENCES resumeforge_v2.jobs(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES resumeforge_v2.contacts(id),
    
    -- Follow-up Details
    follow_up_type TEXT CHECK (follow_up_type IN ('thank_you', 'status_check', 'networking', 'reference_request', 'offer_response')),
    scheduled_date TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_date TIMESTAMP WITH TIME ZONE,
    
    -- Status
    status TEXT CHECK (status IN ('pending', 'completed', 'cancelled', 'overdue')) DEFAULT 'pending',
    
    -- Content
    subject TEXT,
    message_template TEXT,
    actual_message TEXT,      -- What was actually sent
    
    -- Automation
    auto_send BOOLEAN DEFAULT false,
    reminder_sent BOOLEAN DEFAULT false,
    
    -- Notes
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_follow_ups_scheduled ON resumeforge_v2.follow_ups(scheduled_date) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_follow_ups_job ON resumeforge_v2.follow_ups(job_id);

COMMENT ON TABLE resumeforge_v2.follow_ups IS 'Scheduled and completed follow-up actions';

-- =============================================================================
-- Performance Indexes
-- =============================================================================

-- Full-text search on job descriptions
CREATE INDEX IF NOT EXISTS idx_jobs_description_fts ON resumeforge_v2.jobs USING gin(to_tsvector('english', description));

-- Full-text search on email content
CREATE INDEX IF NOT EXISTS idx_emails_content_fts ON resumeforge_v2.emails USING gin(to_tsvector('english', body_text));

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_jobs_active_status ON resumeforge_v2.jobs(is_active, status) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_resumes_active ON resumeforge_v2.resumes(is_active, created_at DESC) WHERE is_active = true;

-- =============================================================================
-- Views for Analytics
-- =============================================================================

-- Resume Performance View
CREATE OR REPLACE VIEW resumeforge_v2.resume_performance AS
SELECT 
    r.id,
    r.name,
    r.focus_area,
    r.main_skills,
    COUNT(DISTINCT j.id) as applications_count,
    COUNT(DISTINCT CASE WHEN j.status IN ('interviewing', 'accepted') THEN j.id END) as positive_outcomes,
    AVG(CASE WHEN j.status = 'accepted' THEN 1.0 ELSE 0.0 END) as success_rate,
    MAX(j.applied_at) as last_used
FROM resumeforge_v2.resumes r
LEFT JOIN resumeforge_v2.jobs j ON j.applied_resume_id = r.id
GROUP BY r.id;

-- Application Funnel View
CREATE OR REPLACE VIEW resumeforge_v2.application_funnel AS
SELECT 
    DATE_TRUNC('month', applied_at) as month,
    COUNT(*) as total_applications,
    COUNT(*) FILTER (WHERE status = 'interviewing') as interviews,
    COUNT(*) FILTER (WHERE status = 'accepted') as offers,
    COUNT(*) FILTER (WHERE status = 'rejected') as rejections,
    AVG(EXTRACT(DAY FROM (COALESCE(updated_at, NOW()) - applied_at))) as avg_response_days
FROM resumeforge_v2.jobs
WHERE applied_at IS NOT NULL
GROUP BY DATE_TRUNC('month', applied_at)
ORDER BY month DESC;

-- Email Response Time View
CREATE OR REPLACE VIEW resumeforge_v2.email_response_metrics AS
WITH thread_pairs AS (
    SELECT 
        thread_id,
        sender,
        received_at,
        LAG(sender) OVER (PARTITION BY thread_id ORDER BY received_at) as prev_sender,
        LAG(received_at) OVER (PARTITION BY thread_id ORDER BY received_at) as prev_received_at
    FROM resumeforge_v2.emails
)
SELECT 
    thread_id,
    AVG(EXTRACT(HOUR FROM (received_at - prev_received_at))) as avg_response_hours,
    COUNT(*) as message_count
FROM thread_pairs
WHERE prev_sender IS NOT NULL 
  AND sender != prev_sender
GROUP BY thread_id;

-- =============================================================================
-- Triggers for Automation
-- =============================================================================

-- Update timestamps function
CREATE OR REPLACE FUNCTION resumeforge_v2.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update timestamp triggers to all tables with updated_at column
CREATE TRIGGER update_user_profile_updated_at 
    BEFORE UPDATE ON resumeforge_v2.user_profile
    FOR EACH ROW EXECUTE FUNCTION resumeforge_v2.update_updated_at();
    
CREATE TRIGGER update_oauth_tokens_updated_at 
    BEFORE UPDATE ON resumeforge_v2.oauth_tokens
    FOR EACH ROW EXECUTE FUNCTION resumeforge_v2.update_updated_at();
    
CREATE TRIGGER update_companies_updated_at 
    BEFORE UPDATE ON resumeforge_v2.companies
    FOR EACH ROW EXECUTE FUNCTION resumeforge_v2.update_updated_at();
    
CREATE TRIGGER update_contacts_updated_at 
    BEFORE UPDATE ON resumeforge_v2.contacts
    FOR EACH ROW EXECUTE FUNCTION resumeforge_v2.update_updated_at();
    
CREATE TRIGGER update_jobs_updated_at 
    BEFORE UPDATE ON resumeforge_v2.jobs
    FOR EACH ROW EXECUTE FUNCTION resumeforge_v2.update_updated_at();
    
CREATE TRIGGER update_resumes_updated_at 
    BEFORE UPDATE ON resumeforge_v2.resumes
    FOR EACH ROW EXECUTE FUNCTION resumeforge_v2.update_updated_at();
    
CREATE TRIGGER update_resume_sections_updated_at 
    BEFORE UPDATE ON resumeforge_v2.resume_sections
    FOR EACH ROW EXECUTE FUNCTION resumeforge_v2.update_updated_at();

-- Auto-create activity log entries for job status changes
CREATE OR REPLACE FUNCTION resumeforge_v2.log_job_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO resumeforge_v2.activity_log (event_type, entity_type, entity_id, description, metadata)
        VALUES (
            'job_status_changed',
            'job',
            NEW.id,
            format('Job status changed from %s to %s', OLD.status, NEW.status),
            jsonb_build_object(
                'old_status', OLD.status,
                'new_status', NEW.status,
                'company', NEW.company_name,
                'title', NEW.job_title
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER log_job_status_changes 
    AFTER UPDATE ON resumeforge_v2.jobs
    FOR EACH ROW EXECUTE FUNCTION resumeforge_v2.log_job_status_change();

-- =============================================================================
-- Grant Permissions
-- =============================================================================

-- Grant usage on schema to authenticated users (for Supabase)
GRANT USAGE ON SCHEMA resumeforge_v2 TO authenticated;

-- Grant all privileges on all tables to authenticated users
GRANT ALL ON ALL TABLES IN SCHEMA resumeforge_v2 TO authenticated;

-- Grant usage on all sequences
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA resumeforge_v2 TO authenticated;

-- Reset search path
RESET search_path;

-- =============================================================================
-- Migration Complete
-- =============================================================================
-- Next steps:
-- 1. Review the schema in resumeforge_v2
-- 2. Create data migration scripts to move data from public schema
-- 3. Update application code to use new schema
-- 4. Once verified, move tables to public schema or update search_path
-- =============================================================================