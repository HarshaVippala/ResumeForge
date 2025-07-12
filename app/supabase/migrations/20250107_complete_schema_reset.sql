-- ResumeForge Database Schema v2.0 - Complete Reset
-- WARNING: This will DROP ALL EXISTING TABLES and create new schema from scratch
-- Date: 2025-01-07

-- Drop all existing tables in correct order (respecting foreign key constraints)
-- Including all tables found in the database
DROP TABLE IF EXISTS application_analytics CASCADE;
DROP TABLE IF EXISTS application_timeline CASCADE;
DROP TABLE IF EXISTS application_documents CASCADE;
DROP TABLE IF EXISTS application_contacts CASCADE;
DROP TABLE IF EXISTS job_applications CASCADE;
DROP TABLE IF EXISTS section_versions CASCADE;
DROP TABLE IF EXISTS resume_library CASCADE;
DROP TABLE IF EXISTS resume_sessions CASCADE;
DROP TABLE IF EXISTS resume_content CASCADE;
DROP TABLE IF EXISTS saved_jobs CASCADE;
DROP TABLE IF EXISTS jobs CASCADE;
DROP TABLE IF EXISTS job_titles CASCADE;
DROP TABLE IF EXISTS companies CASCADE;
DROP TABLE IF EXISTS email_threads CASCADE;
DROP TABLE IF EXISTS email_processing_queue CASCADE;
DROP TABLE IF EXISTS email_communications CASCADE;
DROP TABLE IF EXISTS gmail_sync_state CASCADE;
DROP TABLE IF EXISTS dashboard_insights CASCADE;
DROP TABLE IF EXISTS sync_metadata CASCADE;
DROP TABLE IF EXISTS job_alerts CASCADE;
DROP TABLE IF EXISTS oauth_tokens CASCADE;
DROP TABLE IF EXISTS user_credentials CASCADE;
DROP TABLE IF EXISTS user_profile CASCADE;
DROP TABLE IF EXISTS my_jobs CASCADE;
DROP TABLE IF EXISTS my_emails CASCADE;
DROP TABLE IF EXISTS my_activity_log CASCADE;

-- Additional tables found in database
DROP TABLE IF EXISTS email_backup CASCADE;
DROP TABLE IF EXISTS email_reminders CASCADE;
DROP TABLE IF EXISTS email_sync_state CASCADE;
DROP TABLE IF EXISTS gmail_push_subscriptions CASCADE;
DROP TABLE IF EXISTS job_analysis_sessions CASCADE;
DROP TABLE IF EXISTS job_opportunities CASCADE;
DROP TABLE IF EXISTS recruiter_companies CASCADE;
DROP TABLE IF EXISTS recruiters CASCADE;
DROP TABLE IF EXISTS schema_migrations CASCADE;
DROP TABLE IF EXISTS security_logs CASCADE;
DROP TABLE IF EXISTS user_sessions CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop any custom types
DROP TYPE IF EXISTS job_status CASCADE;
DROP TYPE IF EXISTS application_status CASCADE;
DROP TYPE IF EXISTS email_type CASCADE;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- CORE TABLES
-- ============================================

-- 1. user_profile
CREATE TABLE user_profile (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    name TEXT,
    default_resume_data JSONB,
    preferences JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. auth_credentials
CREATE TABLE auth_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES user_profile(id) ON DELETE CASCADE,
    credential_id TEXT NOT NULL UNIQUE,
    public_key BYTEA NOT NULL,
    sign_count INTEGER DEFAULT 0,
    transports TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_auth_credentials_user_id ON auth_credentials(user_id);
CREATE INDEX idx_auth_credentials_credential_id ON auth_credentials(credential_id);

-- 3. oauth_tokens
CREATE TABLE oauth_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES user_profile(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('gmail')),
    encrypted_token TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE,
    scopes TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_oauth_tokens_user_provider ON oauth_tokens(user_id, provider);

-- ============================================
-- COMPANY & CONTACT MANAGEMENT
-- ============================================

-- 4. companies
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    website TEXT,
    linkedin_url TEXT,
    glassdoor_url TEXT,
    industry TEXT,
    size TEXT CHECK (size IN ('startup', 'small', 'medium', 'large', 'enterprise')),
    location TEXT,
    culture_notes TEXT,
    interview_process_notes TEXT,
    salary_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_companies_name ON companies(name);

-- 5. contacts
CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    linkedin_url TEXT,
    current_company_id UUID REFERENCES companies(id),
    current_title TEXT,
    contact_type TEXT CHECK (contact_type IN ('recruiter', 'employee', 'hiring_manager', 'referral')),
    relationship_strength TEXT CHECK (relationship_strength IN ('cold', 'warm', 'strong')),
    last_contacted TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    tags TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_company ON contacts(current_company_id);

-- ============================================
-- JOB TRACKING
-- ============================================

-- 6. jobs
CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Company Information
    company_id UUID REFERENCES companies(id),
    company_name TEXT NOT NULL,
    
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
    external_job_id TEXT,
    discovered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Application Status
    status TEXT CHECK (status IN ('interested', 'applied', 'interviewing', 'rejected', 'accepted', 'withdrawn')),
    applied_at TIMESTAMP WITH TIME ZONE,
    applied_resume_id UUID,
    
    -- Analysis & Metadata
    keywords TEXT[],
    match_score DECIMAL(3,2),
    priority_score INTEGER,
    
    -- Notes & Tracking
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    deadline TIMESTAMP WITH TIME ZONE,
    last_checked TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_jobs_company ON jobs(company_id);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_applied_at ON jobs(applied_at);

-- 7. job_contacts
CREATE TABLE job_contacts (
    job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    role TEXT CHECK (role IN ('recruiter', 'referral', 'interviewer', 'hiring_manager')),
    PRIMARY KEY (job_id, contact_id)
);

-- ============================================
-- RESUME MANAGEMENT
-- ============================================

-- 8. resumes
CREATE TABLE resumes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identification
    name TEXT NOT NULL,
    job_id UUID REFERENCES jobs(id),
    
    -- Content
    content JSONB NOT NULL,
    
    -- Metadata
    main_skills TEXT[] NOT NULL,
    tech_stack TEXT[] NOT NULL,
    focus_area TEXT CHECK (focus_area IN ('backend', 'frontend', 'fullstack', 'devops', 'data', 'mobile')),
    
    -- AI Generation Details
    tailoring_notes TEXT,
    ats_score DECIMAL(3,2),
    keyword_density JSONB,
    
    -- Version Control
    version INTEGER DEFAULT 1,
    parent_version_id UUID REFERENCES resumes(id),
    is_master BOOLEAN DEFAULT false,
    
    -- File Management
    file_url TEXT,
    file_type TEXT CHECK (file_type IN ('pdf', 'docx')),
    file_hash TEXT,
    
    -- Usage Tracking
    submission_count INTEGER DEFAULT 0,
    last_submitted_at TIMESTAMP WITH TIME ZONE,
    performance_metrics JSONB,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    tags TEXT[],
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_resumes_job ON resumes(job_id);
CREATE INDEX idx_resumes_master ON resumes(is_master) WHERE is_master = true;

-- Update jobs table to reference resumes
ALTER TABLE jobs ADD CONSTRAINT jobs_applied_resume_id_fkey 
    FOREIGN KEY (applied_resume_id) REFERENCES resumes(id);

-- 9. resume_sections
CREATE TABLE resume_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resume_id UUID REFERENCES resumes(id) ON DELETE CASCADE,
    
    -- Section Details
    section_type TEXT NOT NULL CHECK (section_type IN ('contact', 'summary', 'experience', 'education', 'skills', 'projects', 'custom')),
    section_name TEXT NOT NULL,
    content JSONB NOT NULL,
    
    -- Display Control
    order_index INTEGER NOT NULL,
    is_visible BOOLEAN DEFAULT true,
    
    -- Generation Metadata
    ai_generated BOOLEAN DEFAULT false,
    generation_prompt TEXT,
    confidence_score DECIMAL(3,2),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_resume_sections_resume ON resume_sections(resume_id);
CREATE INDEX idx_resume_sections_order ON resume_sections(resume_id, order_index);

-- ============================================
-- EMAIL INTEGRATION
-- ============================================

-- 10. emails
CREATE TABLE emails (
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
    attachments JSONB,
    
    -- Job Relationship
    job_id UUID REFERENCES jobs(id),
    is_job_related BOOLEAN DEFAULT false,
    job_confidence FLOAT CHECK (job_confidence >= 0 AND job_confidence <= 1),
    
    -- Classification
    email_type TEXT CHECK (email_type IN ('application_confirmation', 'recruiter_outreach', 'interview_request', 'rejection', 'offer', 'general')),
    classification_confidence FLOAT,
    
    -- Thread Management
    thread_position INTEGER,
    is_thread_root BOOLEAN DEFAULT false,
    thread_summary TEXT,
    
    -- Processing Status
    ai_processed BOOLEAN DEFAULT false,
    processing_version TEXT,
    requires_action BOOLEAN DEFAULT false,
    action_deadline TIMESTAMP WITH TIME ZONE,
    
    -- Gmail Labels
    labels TEXT[],
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_emails_gmail_id ON emails(gmail_id);
CREATE INDEX idx_emails_thread_id ON emails(thread_id);
CREATE INDEX idx_emails_job_id ON emails(job_id);
CREATE INDEX idx_emails_received_at ON emails(received_at DESC);

-- ============================================
-- ACTIVITY & EVENT TRACKING
-- ============================================

-- 11. activity_log
CREATE TABLE activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Event Details
    event_type TEXT NOT NULL,
    entity_type TEXT,
    entity_id UUID,
    
    -- Context
    description TEXT,
    metadata JSONB,
    
    -- Source
    source TEXT DEFAULT 'user',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_activity_log_created ON activity_log(created_at DESC);
CREATE INDEX idx_activity_log_entity ON activity_log(entity_type, entity_id);

-- 12. application_events
CREATE TABLE application_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
    
    -- Event Information
    event_type TEXT NOT NULL CHECK (event_type IN ('applied', 'acknowledged', 'screening', 'interview_scheduled', 'interview_completed', 'assessment', 'reference_check', 'offer', 'negotiation', 'accepted', 'rejected', 'withdrawn')),
    event_date TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Event Details
    title TEXT,
    description TEXT,
    location TEXT,
    duration_minutes INTEGER,
    
    -- Related Contacts
    contact_name TEXT,
    contact_email TEXT,
    contact_role TEXT,
    
    -- Interview Specific
    interview_type TEXT CHECK (interview_type IN ('phone_screen', 'technical', 'behavioral', 'system_design', 'cultural_fit', 'executive')),
    interviewers TEXT[],
    preparation_notes TEXT,
    feedback TEXT,
    
    -- Outcome
    outcome TEXT CHECK (outcome IN ('passed', 'failed', 'pending', 'cancelled')),
    next_steps TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_application_events_job ON application_events(job_id);
CREATE INDEX idx_application_events_date ON application_events(event_date);

-- 13. follow_ups
CREATE TABLE follow_ups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Relationships
    job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id),
    
    -- Follow-up Details
    follow_up_type TEXT CHECK (follow_up_type IN ('thank_you', 'status_check', 'networking', 'reference_request', 'offer_response')),
    scheduled_date TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_date TIMESTAMP WITH TIME ZONE,
    
    -- Status
    status TEXT CHECK (status IN ('pending', 'completed', 'cancelled', 'overdue')) DEFAULT 'pending',
    
    -- Content
    subject TEXT,
    message_template TEXT,
    actual_message TEXT,
    
    -- Automation
    auto_send BOOLEAN DEFAULT false,
    reminder_sent BOOLEAN DEFAULT false,
    
    -- Notes
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_follow_ups_scheduled ON follow_ups(scheduled_date) WHERE status = 'pending';
CREATE INDEX idx_follow_ups_job ON follow_ups(job_id);

-- ============================================
-- PERFORMANCE INDEXES
-- ============================================

-- Full-text search on job descriptions
CREATE INDEX idx_jobs_description_fts ON jobs USING gin(to_tsvector('english', description));

-- Full-text search on email content
CREATE INDEX idx_emails_content_fts ON emails USING gin(to_tsvector('english', body_text));

-- Composite indexes for common queries
CREATE INDEX idx_jobs_active_status ON jobs(is_active, status) WHERE is_active = true;
CREATE INDEX idx_resumes_active ON resumes(is_active, created_at DESC) WHERE is_active = true;

-- ============================================
-- VIEWS FOR ANALYTICS
-- ============================================

-- Resume Performance View
CREATE VIEW resume_performance AS
SELECT 
    r.id,
    r.name,
    r.focus_area,
    r.main_skills,
    COUNT(DISTINCT j.id) as applications_count,
    COUNT(DISTINCT CASE WHEN j.status IN ('interviewing', 'accepted') THEN j.id END) as positive_outcomes,
    AVG(CASE WHEN j.status = 'accepted' THEN 1.0 ELSE 0.0 END) as success_rate,
    MAX(j.applied_at) as last_used
FROM resumes r
LEFT JOIN jobs j ON j.applied_resume_id = r.id
GROUP BY r.id;

-- Application Funnel View
CREATE VIEW application_funnel AS
SELECT 
    DATE_TRUNC('month', applied_at) as month,
    COUNT(*) as total_applications,
    COUNT(*) FILTER (WHERE status = 'interviewing') as interviews,
    COUNT(*) FILTER (WHERE status = 'accepted') as offers,
    COUNT(*) FILTER (WHERE status = 'rejected') as rejections,
    AVG(EXTRACT(DAY FROM (COALESCE(updated_at, NOW()) - applied_at))) as avg_response_days
FROM jobs
WHERE applied_at IS NOT NULL
GROUP BY DATE_TRUNC('month', applied_at)
ORDER BY month DESC;

-- Email Response Time View
CREATE VIEW email_response_metrics AS
WITH thread_pairs AS (
    SELECT 
        thread_id,
        sender,
        received_at,
        LAG(sender) OVER (PARTITION BY thread_id ORDER BY received_at) as prev_sender,
        LAG(received_at) OVER (PARTITION BY thread_id ORDER BY received_at) as prev_received_at
    FROM emails
)
SELECT 
    thread_id,
    AVG(EXTRACT(HOUR FROM (received_at - prev_received_at))) as avg_response_hours,
    COUNT(*) as message_count
FROM thread_pairs
WHERE prev_sender IS NOT NULL 
  AND sender != prev_sender
GROUP BY thread_id;

-- ============================================
-- TRIGGERS FOR AUTOMATION
-- ============================================

-- Update timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER update_user_profile_updated_at BEFORE UPDATE ON user_profile
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    
CREATE TRIGGER update_oauth_tokens_updated_at BEFORE UPDATE ON oauth_tokens
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_resumes_updated_at BEFORE UPDATE ON resumes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_resume_sections_updated_at BEFORE UPDATE ON resume_sections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create activity log entries
CREATE OR REPLACE FUNCTION log_job_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO activity_log (event_type, entity_type, entity_id, description, metadata)
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

CREATE TRIGGER log_job_status_changes AFTER UPDATE ON jobs
    FOR EACH ROW EXECUTE FUNCTION log_job_status_change();

-- ============================================
-- RLS POLICIES (for single user, simplified)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE user_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE resume_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_ups ENABLE ROW LEVEL SECURITY;

-- Create simple policies allowing authenticated access
-- (Since this is a personal app, we allow full access to authenticated user)

-- User profile (only one row expected)
CREATE POLICY user_profile_policy ON user_profile
    FOR ALL USING (auth.uid() IS NOT NULL);

-- All other tables - full access for authenticated user
CREATE POLICY auth_credentials_policy ON auth_credentials
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY oauth_tokens_policy ON oauth_tokens
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY companies_policy ON companies
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY contacts_policy ON contacts
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY jobs_policy ON jobs
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY job_contacts_policy ON job_contacts
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY resumes_policy ON resumes
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY resume_sections_policy ON resume_sections
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY emails_policy ON emails
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY activity_log_policy ON activity_log
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY application_events_policy ON application_events
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY follow_ups_policy ON follow_ups
    FOR ALL USING (auth.uid() IS NOT NULL);

-- Grant permissions to authenticated users
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ============================================
-- INITIAL DATA (Optional)
-- ============================================

-- Insert default user profile (will be updated on first login)
INSERT INTO user_profile (email, name, preferences)
VALUES (
    'user@example.com',
    'ResumeForge User',
    '{"theme": "light", "emailNotifications": true}'::jsonb
) ON CONFLICT DO NOTHING;