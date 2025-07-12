-- =============================================================================
-- Performance Tracking Schema Migration
-- Date: 2025-01-10
-- Description: Creates tables for tracking resume optimization performance metrics
--              and application outcomes to improve the AI optimization algorithm.
-- =============================================================================

-- Use the resumeforge_v2 schema
SET search_path TO resumeforge_v2, public;

-- =============================================================================
-- Performance Tracking Tables
-- =============================================================================

-- 1. optimization_metrics
-- Tracks performance metrics for each resume optimization run
CREATE TABLE IF NOT EXISTS resumeforge_v2.optimization_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES resumeforge_v2.user_profile(id) ON DELETE CASCADE,
    job_id UUID REFERENCES resumeforge_v2.jobs(id) ON DELETE CASCADE,
    resume_id UUID REFERENCES resumeforge_v2.resumes(id) ON DELETE CASCADE,
    
    -- Optimization Scores
    initial_score DECIMAL(5,2) NOT NULL CHECK (initial_score >= 0 AND initial_score <= 100),
    final_score DECIMAL(5,2) NOT NULL CHECK (final_score >= 0 AND final_score <= 100),
    score_improvement DECIMAL(5,2) GENERATED ALWAYS AS (final_score - initial_score) STORED,
    
    -- Iteration Details
    iterations INTEGER NOT NULL CHECK (iterations > 0),
    converged BOOLEAN DEFAULT false,
    
    -- Performance Metrics
    optimization_time_ms INTEGER NOT NULL CHECK (optimization_time_ms >= 0),
    
    -- Keyword Analysis
    initial_keywords_matched INTEGER DEFAULT 0,
    final_keywords_matched INTEGER DEFAULT 0,
    keyword_improvements JSONB, -- Detailed keyword changes
    
    -- ATS Score Breakdown
    initial_ats_score JSONB, -- Full ATS score breakdown
    final_ats_score JSONB,   -- Full ATS score breakdown
    
    -- AI Model Details
    model_name TEXT,
    model_version TEXT,
    optimization_strategy TEXT, -- Which optimization approach was used
    
    -- Metadata
    feedback_history JSONB[], -- Array of feedback given at each iteration
    iteration_scores JSONB[], -- Array of scores at each iteration
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for optimization_metrics
CREATE INDEX IF NOT EXISTS idx_optimization_metrics_user ON resumeforge_v2.optimization_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_optimization_metrics_job ON resumeforge_v2.optimization_metrics(job_id);
CREATE INDEX IF NOT EXISTS idx_optimization_metrics_resume ON resumeforge_v2.optimization_metrics(resume_id);
CREATE INDEX IF NOT EXISTS idx_optimization_metrics_created ON resumeforge_v2.optimization_metrics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_optimization_metrics_improvement ON resumeforge_v2.optimization_metrics(score_improvement DESC);

COMMENT ON TABLE resumeforge_v2.optimization_metrics IS 'Tracks performance metrics for resume optimization runs';
COMMENT ON COLUMN resumeforge_v2.optimization_metrics.keyword_improvements IS 'JSON: {added: ["keyword1", ...], removed: ["keyword2", ...], density_changes: {"keyword": {before: 1, after: 3}}}';
COMMENT ON COLUMN resumeforge_v2.optimization_metrics.iteration_scores IS 'Array of {iteration: 1, score: 75.5, ats_score: 80, similarity_score: 0.71}';

-- 2. application_outcomes
-- Tracks the real-world outcomes of job applications
CREATE TABLE IF NOT EXISTS resumeforge_v2.application_outcomes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES resumeforge_v2.user_profile(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES resumeforge_v2.jobs(id) ON DELETE CASCADE,
    resume_id UUID REFERENCES resumeforge_v2.resumes(id) ON DELETE SET NULL,
    
    -- Outcome Tracking
    got_response BOOLEAN DEFAULT false,
    response_time_days INTEGER CHECK (response_time_days >= 0),
    got_interview BOOLEAN DEFAULT false,
    interview_rounds INTEGER DEFAULT 0,
    got_offer BOOLEAN DEFAULT false,
    
    -- Offer Details (if applicable)
    offer_amount DECIMAL(10,2),
    offer_currency TEXT DEFAULT 'USD',
    accepted_offer BOOLEAN,
    
    -- Feedback
    feedback TEXT,
    feedback_source TEXT CHECK (feedback_source IN ('recruiter', 'hiring_manager', 'automated', 'self', 'other')),
    rejection_reason TEXT,
    
    -- Resume Performance Correlation
    optimization_metric_id UUID REFERENCES resumeforge_v2.optimization_metrics(id),
    resume_score_at_submission DECIMAL(5,2),
    keywords_matched_at_submission INTEGER,
    
    -- Additional Metrics
    company_fit_score DECIMAL(3,2) CHECK (company_fit_score >= 0 AND company_fit_score <= 1),
    role_fit_score DECIMAL(3,2) CHECK (role_fit_score >= 0 AND role_fit_score <= 1),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for application_outcomes
CREATE INDEX IF NOT EXISTS idx_application_outcomes_user ON resumeforge_v2.application_outcomes(user_id);
CREATE INDEX IF NOT EXISTS idx_application_outcomes_job ON resumeforge_v2.application_outcomes(job_id);
CREATE INDEX IF NOT EXISTS idx_application_outcomes_resume ON resumeforge_v2.application_outcomes(resume_id);
CREATE INDEX IF NOT EXISTS idx_application_outcomes_response ON resumeforge_v2.application_outcomes(got_response, got_interview, got_offer);

COMMENT ON TABLE resumeforge_v2.application_outcomes IS 'Tracks real-world outcomes of job applications for algorithm improvement';

-- 3. keyword_performance
-- Aggregated view of keyword effectiveness
CREATE TABLE IF NOT EXISTS resumeforge_v2.keyword_performance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    keyword TEXT NOT NULL,
    industry TEXT,
    role_level TEXT,
    
    -- Usage Statistics
    total_uses INTEGER DEFAULT 0,
    successful_uses INTEGER DEFAULT 0, -- Led to interview or offer
    
    -- Performance Metrics
    response_rate DECIMAL(5,2) GENERATED ALWAYS AS (
        CASE WHEN total_uses > 0 
        THEN (successful_uses::DECIMAL / total_uses * 100) 
        ELSE 0 
        END
    ) STORED,
    
    -- Context
    common_combinations TEXT[], -- Other keywords often used together
    best_performing_roles TEXT[], -- Job titles where this keyword performs well
    
    -- Temporal Data
    trending_score DECIMAL(3,2), -- How "hot" this keyword is currently
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(keyword, industry, role_level)
);

CREATE INDEX IF NOT EXISTS idx_keyword_performance_keyword ON resumeforge_v2.keyword_performance(keyword);
CREATE INDEX IF NOT EXISTS idx_keyword_performance_response_rate ON resumeforge_v2.keyword_performance(response_rate DESC);

COMMENT ON TABLE resumeforge_v2.keyword_performance IS 'Tracks effectiveness of keywords across applications';

-- =============================================================================
-- Analytics Views
-- =============================================================================

-- Optimization Performance Summary
CREATE OR REPLACE VIEW resumeforge_v2.optimization_performance_summary AS
SELECT 
    DATE_TRUNC('week', om.created_at) as week,
    COUNT(*) as total_optimizations,
    AVG(om.initial_score) as avg_initial_score,
    AVG(om.final_score) as avg_final_score,
    AVG(om.score_improvement) as avg_improvement,
    AVG(om.iterations) as avg_iterations,
    AVG(om.optimization_time_ms) as avg_time_ms,
    SUM(CASE WHEN om.converged THEN 1 ELSE 0 END)::FLOAT / COUNT(*) * 100 as convergence_rate,
    COUNT(DISTINCT om.user_id) as unique_users
FROM resumeforge_v2.optimization_metrics om
GROUP BY DATE_TRUNC('week', om.created_at)
ORDER BY week DESC;

-- Keyword Success Analysis
CREATE OR REPLACE VIEW resumeforge_v2.keyword_success_analysis AS
WITH keyword_outcomes AS (
    SELECT 
        unnest(r.main_skills) as keyword,
        ao.got_response,
        ao.got_interview,
        ao.got_offer
    FROM resumeforge_v2.application_outcomes ao
    JOIN resumeforge_v2.resumes r ON r.id = ao.resume_id
    WHERE r.main_skills IS NOT NULL
)
SELECT 
    keyword,
    COUNT(*) as total_applications,
    SUM(CASE WHEN got_response THEN 1 ELSE 0 END) as responses,
    SUM(CASE WHEN got_interview THEN 1 ELSE 0 END) as interviews,
    SUM(CASE WHEN got_offer THEN 1 ELSE 0 END) as offers,
    ROUND(AVG(CASE WHEN got_response THEN 1.0 ELSE 0.0 END) * 100, 2) as response_rate,
    ROUND(AVG(CASE WHEN got_interview THEN 1.0 ELSE 0.0 END) * 100, 2) as interview_rate,
    ROUND(AVG(CASE WHEN got_offer THEN 1.0 ELSE 0.0 END) * 100, 2) as offer_rate
FROM keyword_outcomes
GROUP BY keyword
HAVING COUNT(*) >= 3  -- Only show keywords used at least 3 times
ORDER BY offer_rate DESC, interview_rate DESC, response_rate DESC;

-- Resume Performance by Score Range
CREATE OR REPLACE VIEW resumeforge_v2.resume_performance_by_score AS
WITH score_ranges AS (
    SELECT 
        om.final_score,
        om.resume_id,
        CASE 
            WHEN om.final_score >= 90 THEN '90-100'
            WHEN om.final_score >= 80 THEN '80-89'
            WHEN om.final_score >= 70 THEN '70-79'
            WHEN om.final_score >= 60 THEN '60-69'
            ELSE 'Below 60'
        END as score_range
    FROM resumeforge_v2.optimization_metrics om
)
SELECT 
    sr.score_range,
    COUNT(DISTINCT ao.id) as applications,
    ROUND(AVG(CASE WHEN ao.got_response THEN 1.0 ELSE 0.0 END) * 100, 2) as response_rate,
    ROUND(AVG(CASE WHEN ao.got_interview THEN 1.0 ELSE 0.0 END) * 100, 2) as interview_rate,
    ROUND(AVG(CASE WHEN ao.got_offer THEN 1.0 ELSE 0.0 END) * 100, 2) as offer_rate,
    AVG(ao.response_time_days) as avg_response_days
FROM score_ranges sr
LEFT JOIN resumeforge_v2.application_outcomes ao ON ao.resume_id = sr.resume_id
GROUP BY sr.score_range
ORDER BY 
    CASE sr.score_range
        WHEN '90-100' THEN 1
        WHEN '80-89' THEN 2
        WHEN '70-79' THEN 3
        WHEN '60-69' THEN 4
        ELSE 5
    END;

-- =============================================================================
-- Triggers
-- =============================================================================

-- Update keyword performance on new application outcome
CREATE OR REPLACE FUNCTION resumeforge_v2.update_keyword_performance()
RETURNS TRIGGER AS $$
DECLARE
    keyword_text TEXT;
    success BOOLEAN;
BEGIN
    -- Determine if this was a successful application
    success := NEW.got_interview OR NEW.got_offer;
    
    -- Get keywords from the resume
    IF NEW.resume_id IS NOT NULL THEN
        FOR keyword_text IN 
            SELECT unnest(main_skills) 
            FROM resumeforge_v2.resumes 
            WHERE id = NEW.resume_id
        LOOP
            INSERT INTO resumeforge_v2.keyword_performance (keyword, total_uses, successful_uses)
            VALUES (keyword_text, 1, CASE WHEN success THEN 1 ELSE 0 END)
            ON CONFLICT (keyword, industry, role_level) 
            DO UPDATE SET 
                total_uses = keyword_performance.total_uses + 1,
                successful_uses = keyword_performance.successful_uses + CASE WHEN success THEN 1 ELSE 0 END,
                last_updated = NOW();
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_keyword_performance_on_outcome
    AFTER INSERT OR UPDATE ON resumeforge_v2.application_outcomes
    FOR EACH ROW EXECUTE FUNCTION resumeforge_v2.update_keyword_performance();

-- Update timestamps for application_outcomes
CREATE TRIGGER update_application_outcomes_updated_at 
    BEFORE UPDATE ON resumeforge_v2.application_outcomes
    FOR EACH ROW EXECUTE FUNCTION resumeforge_v2.update_updated_at();

-- =============================================================================
-- Permissions
-- =============================================================================

-- Grant permissions to authenticated users
GRANT ALL ON resumeforge_v2.optimization_metrics TO authenticated;
GRANT ALL ON resumeforge_v2.application_outcomes TO authenticated;
GRANT ALL ON resumeforge_v2.keyword_performance TO authenticated;
GRANT SELECT ON resumeforge_v2.optimization_performance_summary TO authenticated;
GRANT SELECT ON resumeforge_v2.keyword_success_analysis TO authenticated;
GRANT SELECT ON resumeforge_v2.resume_performance_by_score TO authenticated;

-- Reset search path
RESET search_path;

-- =============================================================================
-- Migration Complete
-- =============================================================================
-- This migration adds performance tracking tables to monitor:
-- 1. Resume optimization effectiveness over time
-- 2. Real-world application outcomes
-- 3. Keyword performance analytics
-- =============================================================================