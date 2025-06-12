-- Enhanced Email & Job Tracking Database Schema
-- Connects Email Communications → Job Opportunities → Resume Versions

-- 1. Companies Table (Master list of all companies)
CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255),
    industry VARCHAR(100),
    size VARCHAR(50),
    location VARCHAR(255),
    website VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Contacts Table (Recruiters, HRs, Hiring Managers)
CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    title VARCHAR(255),
    role_type VARCHAR(50), -- 'recruiter', 'hr', 'hiring_manager', 'employee'
    linkedin_url VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies (id)
);

-- 3. Job Opportunities Table (Central tracking)
CREATE TABLE IF NOT EXISTS job_opportunities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    job_id VARCHAR(100), -- Company's internal job ID
    application_type VARCHAR(50), -- 'direct_application', 'recruiter_outreach', 'referral'
    status VARCHAR(50), -- 'sourced', 'applied', 'phone_screen', 'interview', 'offer', 'rejected', 'accepted'
    priority VARCHAR(20) DEFAULT 'medium', -- 'high', 'medium', 'low'
    
    -- Job Details
    description TEXT,
    requirements TEXT,
    salary_range VARCHAR(100),
    location VARCHAR(255),
    remote_option BOOLEAN DEFAULT FALSE,
    
    -- Application Details
    application_date DATE,
    application_deadline DATE,
    source VARCHAR(100), -- 'linkedin', 'company_website', 'recruiter', 'referral'
    application_url VARCHAR(255),
    
    -- Tracking
    last_contact_date DATE,
    next_followup_date DATE,
    notes TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies (id)
);

-- 4. Email Communications Table (All email interactions)
CREATE TABLE IF NOT EXISTS email_communications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email_id VARCHAR(255) UNIQUE NOT NULL, -- Gmail message ID
    job_opportunity_id INTEGER, -- NULL for general outreach
    contact_id INTEGER,
    
    -- Email Metadata
    subject VARCHAR(500),
    sender VARCHAR(255),
    recipient VARCHAR(255),
    email_date TIMESTAMP,
    is_unread BOOLEAN DEFAULT TRUE,
    
    -- Classification
    email_type VARCHAR(50), -- 'interview', 'rejection', 'recruiter', 'follow_up', 'offer', 'other'
    direction VARCHAR(20), -- 'inbound', 'outbound'
    urgency VARCHAR(20) DEFAULT 'medium',
    
    -- Content
    content TEXT,
    snippet TEXT,
    
    -- Extracted Information (JSON)
    extracted_data JSON,
    
    -- AI Analysis
    sentiment VARCHAR(20), -- 'positive', 'negative', 'neutral'
    action_required TEXT,
    confidence_score FLOAT DEFAULT 0.0,
    
    -- Processing
    processed_at TIMESTAMP,
    processing_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'processed', 'failed'
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (job_opportunity_id) REFERENCES job_opportunities (id),
    FOREIGN KEY (contact_id) REFERENCES contacts (id)
);

-- 5. Resume Versions Table (Tailored resumes for specific opportunities)
CREATE TABLE IF NOT EXISTS resume_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_opportunity_id INTEGER,
    version_name VARCHAR(255) NOT NULL,
    
    -- Resume Content (JSON structure)
    content JSON, -- Full resume content
    keywords JSON, -- Targeted keywords
    modifications JSON, -- What was changed from base resume
    
    -- Files
    file_path VARCHAR(255),
    file_format VARCHAR(20) DEFAULT 'docx',
    
    -- Metadata
    ats_score INTEGER,
    keyword_match_percentage FLOAT,
    customization_level VARCHAR(50), -- 'minimal', 'moderate', 'extensive'
    
    -- Status
    status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'final', 'submitted', 'deprecated'
    is_default BOOLEAN DEFAULT FALSE,
    
    -- Usage Tracking
    times_used INTEGER DEFAULT 0,
    last_used_date DATE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (job_opportunity_id) REFERENCES job_opportunities (id)
);

-- 6. Interview Schedules Table
CREATE TABLE IF NOT EXISTS interview_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_opportunity_id INTEGER NOT NULL,
    email_communication_id INTEGER, -- Source email
    
    -- Interview Details
    interview_type VARCHAR(50), -- 'phone', 'video', 'in_person', 'technical', 'behavioral'
    interview_date DATE,
    interview_time TIME,
    duration_minutes INTEGER DEFAULT 60,
    
    -- Platform/Location
    platform VARCHAR(50), -- 'zoom', 'teams', 'googlemeet', 'phone', 'in_person'
    meeting_link VARCHAR(255),
    location VARCHAR(255),
    
    -- People
    interviewer_names TEXT,
    interview_panel JSON, -- Array of interviewer details
    
    -- Preparation
    preparation_notes TEXT,
    questions_to_ask TEXT,
    
    -- Status
    status VARCHAR(50) DEFAULT 'scheduled', -- 'scheduled', 'completed', 'cancelled', 'rescheduled'
    outcome VARCHAR(100), -- 'positive', 'negative', 'neutral', 'pending'
    feedback TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (job_opportunity_id) REFERENCES job_opportunities (id),
    FOREIGN KEY (email_communication_id) REFERENCES email_communications (id)
);

-- 7. Activity Timeline Table (Complete audit trail)
CREATE TABLE IF NOT EXISTS activity_timeline (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_opportunity_id INTEGER,
    activity_type VARCHAR(50), -- 'email_received', 'application_submitted', 'interview_scheduled', etc.
    description TEXT,
    metadata JSON, -- Additional context
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (job_opportunity_id) REFERENCES job_opportunities (id)
);

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_email_communications_job_id ON email_communications(job_opportunity_id);
CREATE INDEX IF NOT EXISTS idx_email_communications_date ON email_communications(email_date);
CREATE INDEX IF NOT EXISTS idx_job_opportunities_status ON job_opportunities(status);
CREATE INDEX IF NOT EXISTS idx_job_opportunities_company ON job_opportunities(company_id);
CREATE INDEX IF NOT EXISTS idx_resume_versions_job_id ON resume_versions(job_opportunity_id);
CREATE INDEX IF NOT EXISTS idx_interview_schedules_date ON interview_schedules(interview_date);