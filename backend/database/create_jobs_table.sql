-- Jobs table for storing scraped job postings
CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id VARCHAR(255) UNIQUE NOT NULL, -- Platform-specific job ID for deduplication
    title VARCHAR(500) NOT NULL,
    company VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    remote BOOLEAN DEFAULT false,
    job_type VARCHAR(50), -- full-time, part-time, contract, internship
    salary_min INTEGER,
    salary_max INTEGER,
    salary_currency VARCHAR(10) DEFAULT 'USD',
    description TEXT,
    requirements TEXT,
    benefits TEXT,
    application_url VARCHAR(1000),
    company_logo_url VARCHAR(1000),
    platform VARCHAR(50) NOT NULL, -- indeed, linkedin, glassdoor, ziprecruiter, google
    date_posted TIMESTAMP,
    scraped_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    skills TEXT[], -- Extracted skills array
    experience_level VARCHAR(50), -- entry, mid, senior, executive
    
    -- Additional metadata
    company_size VARCHAR(50),
    industry VARCHAR(100),
    employment_type VARCHAR(50),
    seniority_level VARCHAR(50),
    
    -- Search optimization
    search_vector tsvector,
    
    -- Constraints
    CONSTRAINT valid_platform CHECK (platform IN ('indeed', 'linkedin', 'glassdoor', 'ziprecruiter', 'google', 'bayt', 'naukri')),
    CONSTRAINT valid_job_type CHECK (job_type IN ('full-time', 'part-time', 'contract', 'internship', 'temporary')),
    CONSTRAINT valid_experience_level CHECK (experience_level IN ('entry', 'mid', 'senior', 'executive', 'intern'))
);

-- Indexes for performance
CREATE INDEX idx_jobs_location ON jobs(location);
CREATE INDEX idx_jobs_company ON jobs(company);
CREATE INDEX idx_jobs_date_posted ON jobs(date_posted DESC);
CREATE INDEX idx_jobs_platform ON jobs(platform);
CREATE INDEX idx_jobs_active ON jobs(is_active) WHERE is_active = true;
CREATE INDEX idx_jobs_remote ON jobs(remote) WHERE remote = true;
CREATE INDEX idx_jobs_salary ON jobs(salary_min, salary_max);
CREATE INDEX idx_jobs_experience ON jobs(experience_level);
CREATE INDEX idx_jobs_scraped_at ON jobs(scraped_at DESC);

-- Full-text search index
CREATE INDEX idx_jobs_search ON jobs USING GIN(search_vector);

-- Function to update search vector
CREATE OR REPLACE FUNCTION update_jobs_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := 
        setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.company, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'C') ||
        setweight(to_tsvector('english', COALESCE(array_to_string(NEW.skills, ' '), '')), 'B');
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update search vector
CREATE TRIGGER jobs_search_vector_update
    BEFORE INSERT OR UPDATE ON jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_jobs_search_vector();

-- Saved jobs table for user preferences
CREATE TABLE saved_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email VARCHAR(255) NOT NULL, -- Using email as user identifier for now
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    saved_at TIMESTAMP DEFAULT NOW(),
    notes TEXT,
    status VARCHAR(50) DEFAULT 'saved', -- saved, applied, interviewed, rejected, offer
    
    UNIQUE(user_email, job_id)
);

CREATE INDEX idx_saved_jobs_user ON saved_jobs(user_email);
CREATE INDEX idx_saved_jobs_status ON saved_jobs(status);

-- Job alerts table for user notifications
CREATE TABLE job_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email VARCHAR(255) NOT NULL,
    search_query VARCHAR(500) NOT NULL,
    location_filter VARCHAR(255),
    salary_min INTEGER,
    salary_max INTEGER,
    remote_only BOOLEAN DEFAULT false,
    platforms TEXT[], -- Array of platforms to search
    experience_levels TEXT[], -- Array of experience levels
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    last_triggered TIMESTAMP,
    
    -- Notification preferences
    email_notifications BOOLEAN DEFAULT true,
    frequency VARCHAR(20) DEFAULT 'daily' -- daily, weekly, immediate
);

CREATE INDEX idx_job_alerts_user ON job_alerts(user_email);
CREATE INDEX idx_job_alerts_active ON job_alerts(is_active) WHERE is_active = true;

-- Job application tracking
CREATE TABLE job_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email VARCHAR(255) NOT NULL,
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    applied_at TIMESTAMP DEFAULT NOW(),
    application_method VARCHAR(100), -- direct, linkedin, indeed, etc.
    cover_letter_used TEXT,
    resume_version_used VARCHAR(255),
    status VARCHAR(50) DEFAULT 'applied', -- applied, reviewed, interview, rejected, offer
    notes TEXT,
    
    -- Interview tracking
    interview_date TIMESTAMP,
    interview_type VARCHAR(50), -- phone, video, onsite
    interview_notes TEXT,
    
    UNIQUE(user_email, job_id)
);

CREATE INDEX idx_job_applications_user ON job_applications(user_email);
CREATE INDEX idx_job_applications_status ON job_applications(status);
CREATE INDEX idx_job_applications_applied_at ON job_applications(applied_at DESC);

-- View for job statistics
CREATE VIEW job_stats AS
SELECT 
    COUNT(*) as total_jobs,
    COUNT(*) FILTER (WHERE is_active = true) as active_jobs,
    COUNT(*) FILTER (WHERE date_posted >= NOW() - INTERVAL '24 hours') as jobs_last_24h,
    COUNT(*) FILTER (WHERE date_posted >= NOW() - INTERVAL '7 days') as jobs_last_week,
    COUNT(*) FILTER (WHERE remote = true) as remote_jobs,
    platform,
    COUNT(*) as jobs_per_platform
FROM jobs 
WHERE is_active = true
GROUP BY platform;

-- Comments for documentation
COMMENT ON TABLE jobs IS 'Scraped job postings from multiple platforms';
COMMENT ON TABLE saved_jobs IS 'User-saved job postings for later reference';
COMMENT ON TABLE job_alerts IS 'User-defined job search alerts and notifications';
COMMENT ON TABLE job_applications IS 'Tracking of job applications submitted by users';