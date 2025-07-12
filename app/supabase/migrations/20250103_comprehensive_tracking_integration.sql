-- Comprehensive Tracking Integration Migration
-- This migration adds the missing tables and foreign key relationships
-- to create unified tracking across emails, resumes, jobs, and applications

-- Step 1: Add missing columns to existing tables for integration (with correct data types)
ALTER TABLE resume_sessions ADD COLUMN IF NOT EXISTS application_id UUID;
ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS session_id TEXT; -- resume_sessions.id is TEXT
ALTER TABLE email_communications ADD COLUMN IF NOT EXISTS application_id UUID;

-- Step 2: Create company normalization table
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    domain TEXT,
    normalized_name TEXT NOT NULL UNIQUE,
    industry TEXT,
    size_range TEXT CHECK (size_range IN ('startup', 'small', 'medium', 'large', 'enterprise')),
    headquarters_location TEXT,
    website TEXT,
    linkedin_url TEXT,
    glassdoor_rating DECIMAL(3,1),
    employee_count_estimate INTEGER,
    funding_stage TEXT,
    tech_stack TEXT[],
    culture_keywords TEXT[],
    logo_url TEXT,
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 3: Create job title normalization table
CREATE TABLE IF NOT EXISTS job_titles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    normalized_title TEXT NOT NULL,
    category TEXT CHECK (category IN ('engineering', 'product', 'design', 'data', 'marketing', 'sales', 'operations', 'other')),
    seniority_level TEXT CHECK (seniority_level IN ('entry', 'mid', 'senior', 'staff', 'principal', 'director', 'vp', 'executive')),
    common_variations TEXT[],
    skills_keywords TEXT[],
    salary_range_low INTEGER,
    salary_range_high INTEGER,
    remote_friendly BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 4: Create application contacts table
CREATE TABLE IF NOT EXISTS application_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES job_applications(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    role TEXT,
    email TEXT,
    phone TEXT,
    linkedin_url TEXT,
    company_email_domain TEXT,
    contact_type TEXT CHECK (contact_type IN ('recruiter', 'hiring_manager', 'hr', 'team_member', 'reference', 'other')),
    last_contact_date TIMESTAMPTZ,
    response_rate DECIMAL(3,2), -- 0.00 to 1.00
    notes TEXT,
    is_primary_contact BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 5: Create application timeline table
CREATE TABLE IF NOT EXISTS application_timeline (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES job_applications(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('application', 'email_sent', 'email_received', 'interview_scheduled', 'interview_completed', 'technical_test', 'reference_check', 'offer_received', 'offer_accepted', 'offer_declined', 'rejection', 'withdrawn', 'follow_up', 'other')),
    title TEXT NOT NULL,
    description TEXT,
    event_date TIMESTAMPTZ NOT NULL,
    status TEXT CHECK (status IN ('pending', 'completed', 'cancelled', 'rescheduled')),
    contact_id UUID REFERENCES application_contacts(id),
    email_id INTEGER REFERENCES email_communications(id), -- email_communications.id is INTEGER
    location TEXT, -- For interviews
    meeting_link TEXT, -- For virtual interviews
    duration_minutes INTEGER,
    outcome TEXT,
    next_steps TEXT,
    action_required BOOLEAN DEFAULT false,
    action_due_date TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 6: Create application documents table for tracking resume versions
CREATE TABLE IF NOT EXISTS application_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES job_applications(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL CHECK (document_type IN ('resume', 'cover_letter', 'portfolio', 'transcript', 'references', 'writing_sample', 'other')),
    document_name TEXT NOT NULL,
    file_path TEXT,
    file_size_bytes INTEGER,
    mime_type TEXT,
    version_number INTEGER DEFAULT 1,
    resume_section_id UUID, -- Link to specific resume version
    tailored_for_application BOOLEAN DEFAULT true,
    upload_date TIMESTAMPTZ DEFAULT NOW(),
    last_modified TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 7: Create application analytics table for performance tracking
CREATE TABLE IF NOT EXISTS application_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES job_applications(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id),
    job_title_id UUID REFERENCES job_titles(id),
    
    -- Application metrics
    application_date TIMESTAMPTZ,
    first_response_date TIMESTAMPTZ,
    response_time_hours INTEGER,
    total_emails_sent INTEGER DEFAULT 0,
    total_emails_received INTEGER DEFAULT 0,
    interview_rounds_completed INTEGER DEFAULT 0,
    
    -- Outcome metrics
    reached_final_round BOOLEAN DEFAULT false,
    received_offer BOOLEAN DEFAULT false,
    offer_amount INTEGER,
    offer_currency TEXT DEFAULT 'USD',
    rejection_reason TEXT,
    rejection_stage TEXT,
    
    -- Performance scores
    resume_relevance_score DECIMAL(3,2), -- 0.00 to 1.00
    company_culture_fit_score DECIMAL(3,2),
    technical_skill_match_score DECIMAL(3,2),
    overall_success_score DECIMAL(3,2),
    
    -- Lessons learned
    what_worked TEXT,
    what_to_improve TEXT,
    recommendations TEXT,
    
    metadata JSONB DEFAULT '{}',
    calculated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 8: Create unified job opportunities view
CREATE OR REPLACE VIEW unified_job_opportunities AS
SELECT 
    ja.id as application_id,
    ja.company_name,
    ja.position_title,
    ja.status as application_status,
    ja.applied_date,
    ja.job_url,
    
    -- Company information
    c.id as company_id,
    c.normalized_name as company_normalized,
    c.industry as company_industry,
    c.size_range as company_size,
    
    -- Job title information
    jt.id as job_title_id,
    jt.normalized_title as title_normalized,
    jt.category as job_category,
    jt.seniority_level,
    
    -- Resume session information
    rs.id as session_id,
    rs.analysis_complete,
    rs.resume_generated,
    rs.job_description as original_jd,
    
    -- Analytics
    aa.response_time_hours,
    aa.interview_rounds_completed,
    aa.received_offer,
    aa.overall_success_score,
    
    -- Timeline summary
    (SELECT COUNT(*) FROM application_timeline WHERE application_id = ja.id) as timeline_events_count,
    (SELECT MAX(event_date) FROM application_timeline WHERE application_id = ja.id) as last_activity_date,
    
    -- Email summary
    (SELECT COUNT(*) FROM email_communications WHERE application_id = ja.id) as email_count,
    (SELECT MAX(received_at) FROM email_communications WHERE application_id = ja.id) as last_email_date,
    
    -- Contact summary
    (SELECT COUNT(*) FROM application_contacts WHERE application_id = ja.id) as contact_count,
    (SELECT name FROM application_contacts WHERE application_id = ja.id AND is_primary_contact = true LIMIT 1) as primary_contact_name

FROM job_applications ja
LEFT JOIN companies c ON LOWER(TRIM(ja.company_name)) = LOWER(c.normalized_name)
LEFT JOIN job_titles jt ON LOWER(TRIM(ja.position_title)) = LOWER(jt.normalized_title)
LEFT JOIN resume_sessions rs ON ja.session_id = rs.id
LEFT JOIN application_analytics aa ON ja.id = aa.application_id;

-- Step 9: Add foreign key constraints
ALTER TABLE resume_sessions 
ADD CONSTRAINT fk_resume_sessions_application 
FOREIGN KEY (application_id) REFERENCES job_applications(id) ON DELETE SET NULL;

ALTER TABLE job_applications 
ADD CONSTRAINT fk_job_applications_session 
FOREIGN KEY (session_id) REFERENCES resume_sessions(id) ON DELETE SET NULL;

ALTER TABLE email_communications 
ADD CONSTRAINT fk_email_communications_application 
FOREIGN KEY (application_id) REFERENCES job_applications(id) ON DELETE SET NULL;

-- Step 10: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_companies_normalized_name ON companies(normalized_name);
CREATE INDEX IF NOT EXISTS idx_job_titles_normalized_title ON job_titles(normalized_title);
CREATE INDEX IF NOT EXISTS idx_application_contacts_application_id ON application_contacts(application_id);
CREATE INDEX IF NOT EXISTS idx_application_timeline_application_id ON application_timeline(application_id);
CREATE INDEX IF NOT EXISTS idx_application_timeline_event_date ON application_timeline(event_date);
CREATE INDEX IF NOT EXISTS idx_application_documents_application_id ON application_documents(application_id);
CREATE INDEX IF NOT EXISTS idx_application_analytics_application_id ON application_analytics(application_id);
CREATE INDEX IF NOT EXISTS idx_email_communications_application_id ON email_communications(application_id);
CREATE INDEX IF NOT EXISTS idx_resume_sessions_application_id ON resume_sessions(application_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_session_id ON job_applications(session_id);

-- Step 11: Create triggers for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_job_titles_updated_at BEFORE UPDATE ON job_titles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_application_contacts_updated_at BEFORE UPDATE ON application_contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_application_timeline_updated_at BEFORE UPDATE ON application_timeline FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_application_documents_updated_at BEFORE UPDATE ON application_documents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_application_analytics_updated_at BEFORE UPDATE ON application_analytics FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Step 12: Insert some common companies and job titles for normalization
INSERT INTO companies (name, normalized_name, industry, size_range) VALUES
('Google', 'google', 'technology', 'enterprise'),
('Meta', 'meta', 'technology', 'enterprise'),
('Amazon', 'amazon', 'technology', 'enterprise'),
('Microsoft', 'microsoft', 'technology', 'enterprise'),
('Apple', 'apple', 'technology', 'enterprise'),
('Netflix', 'netflix', 'technology', 'large'),
('Spotify', 'spotify', 'technology', 'large'),
('Uber', 'uber', 'technology', 'large'),
('Airbnb', 'airbnb', 'technology', 'large'),
('Stripe', 'stripe', 'fintech', 'large')
ON CONFLICT (normalized_name) DO NOTHING;

INSERT INTO job_titles (title, normalized_title, category, seniority_level) VALUES
('Software Engineer', 'software engineer', 'engineering', 'mid'),
('Senior Software Engineer', 'senior software engineer', 'engineering', 'senior'),
('Staff Software Engineer', 'staff software engineer', 'engineering', 'staff'),
('Principal Software Engineer', 'principal software engineer', 'engineering', 'principal'),
('Frontend Developer', 'frontend developer', 'engineering', 'mid'),
('Backend Developer', 'backend developer', 'engineering', 'mid'),
('Full Stack Developer', 'full stack developer', 'engineering', 'mid'),
('DevOps Engineer', 'devops engineer', 'engineering', 'mid'),
('Data Scientist', 'data scientist', 'data', 'mid'),
('Product Manager', 'product manager', 'product', 'mid'),
('Engineering Manager', 'engineering manager', 'engineering', 'director'),
('Technical Lead', 'technical lead', 'engineering', 'senior')
ON CONFLICT (normalized_title) DO NOTHING;

-- Step 13: Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON companies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON job_titles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON application_contacts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON application_timeline TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON application_documents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON application_analytics TO authenticated;
GRANT SELECT ON unified_job_opportunities TO authenticated;

-- Row Level Security (RLS) policies
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_titles ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_analytics ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (can be enhanced later)
CREATE POLICY "Public companies can be read by anyone" ON companies FOR SELECT USING (true);
CREATE POLICY "Public job titles can be read by anyone" ON job_titles FOR SELECT USING (true);

-- Application-related tables should only be accessible by the user who owns the application
CREATE POLICY "Users can manage their application contacts" ON application_contacts 
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM job_applications ja 
        WHERE ja.id = application_contacts.application_id 
        AND ja.user_id = auth.uid()
    )
);

CREATE POLICY "Users can manage their application timeline" ON application_timeline 
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM job_applications ja 
        WHERE ja.id = application_timeline.application_id 
        AND ja.user_id = auth.uid()
    )
);

CREATE POLICY "Users can manage their application documents" ON application_documents 
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM job_applications ja 
        WHERE ja.id = application_documents.application_id 
        AND ja.user_id = auth.uid()
    )
);

CREATE POLICY "Users can manage their application analytics" ON application_analytics 
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM job_applications ja 
        WHERE ja.id = application_analytics.application_id 
        AND ja.user_id = auth.uid()
    )
);

-- Comments for documentation
COMMENT ON TABLE companies IS 'Normalized company directory for consistent company references across applications';
COMMENT ON TABLE job_titles IS 'Normalized job title directory for consistent role categorization';
COMMENT ON TABLE application_contacts IS 'Contact information for each job application including recruiters and hiring managers';
COMMENT ON TABLE application_timeline IS 'Timeline of events and interactions for each job application';
COMMENT ON TABLE application_documents IS 'Documents submitted for each application including resume versions';
COMMENT ON TABLE application_analytics IS 'Performance analytics and metrics for each job application';
COMMENT ON VIEW unified_job_opportunities IS 'Comprehensive view combining all application data for dashboard displays';

-- Migration complete notification
DO $$
BEGIN
    RAISE NOTICE 'Comprehensive tracking integration migration completed successfully!';
    RAISE NOTICE 'Added tables: companies, job_titles, application_contacts, application_timeline, application_documents, application_analytics';
    RAISE NOTICE 'Added view: unified_job_opportunities';
    RAISE NOTICE 'Added foreign key relationships between resume_sessions, job_applications, and email_communications';
    RAISE NOTICE 'Ready for unified tracking implementation!';
END $$;