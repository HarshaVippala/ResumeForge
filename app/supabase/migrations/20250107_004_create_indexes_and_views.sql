-- =============================================================================
-- ResumeForge v2 Performance Indexes and Analytics Views
-- Date: 2025-01-07
-- Description: Creates additional indexes and views for the v2 schema after data migration
--              This is designed to be idempotent and can be run multiple times safely
-- =============================================================================

-- Set search path for this migration
SET search_path TO resumeforge_v2, public;

-- =============================================================================
-- PERFORMANCE INDEXES
-- =============================================================================

-- Note: Basic indexes are created in the main schema file. 
-- These are additional performance indexes based on common query patterns.

-- ----------------------------------------------------------------------------
-- 1. Email Search and Performance Indexes
-- ----------------------------------------------------------------------------

-- Compound index for email filtering by job and date
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_emails_job_date 
ON resumeforge_v2.emails(job_id, received_at DESC) 
WHERE job_id IS NOT NULL;

-- Index for unprocessed emails requiring AI analysis
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_emails_unprocessed 
ON resumeforge_v2.emails(ai_processed, received_at DESC) 
WHERE ai_processed = false;

-- Index for emails requiring action
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_emails_action_required 
ON resumeforge_v2.emails(requires_action, action_deadline) 
WHERE requires_action = true;

-- Index for email type filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_emails_type 
ON resumeforge_v2.emails(email_type, received_at DESC) 
WHERE email_type IS NOT NULL;

-- Partial index for job-related emails only
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_emails_job_related 
ON resumeforge_v2.emails(is_job_related, job_confidence DESC) 
WHERE is_job_related = true;

-- ----------------------------------------------------------------------------
-- 2. Job Search and Filtering Indexes
-- ----------------------------------------------------------------------------

-- Compound index for job status and priority filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_status_priority 
ON resumeforge_v2.jobs(status, priority_score DESC, created_at DESC) 
WHERE is_active = true;

-- Index for deadline tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_deadline 
ON resumeforge_v2.jobs(deadline, status) 
WHERE deadline IS NOT NULL AND status IN ('interested', 'applied', 'interviewing');

-- Index for job source analysis
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_source 
ON resumeforge_v2.jobs(source, discovered_at DESC);

-- GIN index for keyword array searches
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_keywords_gin 
ON resumeforge_v2.jobs USING gin(keywords);

-- Index for high-priority active jobs
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_high_priority 
ON resumeforge_v2.jobs(priority_score DESC, match_score DESC) 
WHERE is_active = true AND priority_score >= 7;

-- ----------------------------------------------------------------------------
-- 3. Resume Search and Version Control Indexes
-- ----------------------------------------------------------------------------

-- Compound index for resume lookup by job and version
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_resumes_job_version 
ON resumeforge_v2.resumes(job_id, version DESC) 
WHERE job_id IS NOT NULL;

-- GIN indexes for skill arrays
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_resumes_main_skills_gin 
ON resumeforge_v2.resumes USING gin(main_skills);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_resumes_tech_stack_gin 
ON resumeforge_v2.resumes USING gin(tech_stack);

-- Index for finding resumes by focus area
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_resumes_focus_area 
ON resumeforge_v2.resumes(focus_area, created_at DESC) 
WHERE is_active = true;

-- Index for resume performance tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_resumes_submission_tracking 
ON resumeforge_v2.resumes(submission_count DESC, last_submitted_at DESC) 
WHERE submission_count > 0;

-- ----------------------------------------------------------------------------
-- 4. Contact and Company Indexes
-- ----------------------------------------------------------------------------

-- Index for warm contacts (likely to provide referrals)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_warm 
ON resumeforge_v2.contacts(relationship_strength, last_contacted DESC) 
WHERE relationship_strength IN ('warm', 'strong');

-- Compound index for contact search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_search 
ON resumeforge_v2.contacts(name, email, current_company_id);

-- GIN index for contact tags
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_tags_gin 
ON resumeforge_v2.contacts USING gin(tags);

-- Index for company industry analysis
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_companies_industry 
ON resumeforge_v2.companies(industry, size);

-- ----------------------------------------------------------------------------
-- 5. Activity and Event Tracking Indexes
-- ----------------------------------------------------------------------------

-- Index for recent activity dashboard
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activity_recent 
ON resumeforge_v2.activity_log(created_at DESC, event_type);

-- Index for entity-specific activity lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activity_entity_lookup 
ON resumeforge_v2.activity_log(entity_type, entity_id, created_at DESC);

-- Index for upcoming follow-ups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_follow_ups_upcoming 
ON resumeforge_v2.follow_ups(scheduled_date, status) 
WHERE status = 'pending' AND scheduled_date >= CURRENT_DATE;

-- Index for application event timeline
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_application_events_timeline 
ON resumeforge_v2.application_events(job_id, event_date DESC);

-- ----------------------------------------------------------------------------
-- 6. Full-Text Search Indexes
-- ----------------------------------------------------------------------------

-- Combined full-text search index on companies
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_companies_search_fts 
ON resumeforge_v2.companies 
USING gin(to_tsvector('english', 
    coalesce(name, '') || ' ' || 
    coalesce(industry, '') || ' ' || 
    coalesce(culture_notes, '')
));

-- Full-text search on resume content
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_resumes_content_fts 
ON resumeforge_v2.resumes 
USING gin(to_tsvector('english', content::text));

-- Full-text search on contact notes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_notes_fts 
ON resumeforge_v2.contacts 
USING gin(to_tsvector('english', coalesce(notes, '')));

-- =============================================================================
-- ANALYTICS VIEWS
-- =============================================================================

-- ----------------------------------------------------------------------------
-- 1. Dashboard Summary View
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW resumeforge_v2.dashboard_summary AS
WITH job_stats AS (
    SELECT 
        COUNT(*) FILTER (WHERE status = 'interested') as interested_count,
        COUNT(*) FILTER (WHERE status = 'applied') as applied_count,
        COUNT(*) FILTER (WHERE status = 'interviewing') as interviewing_count,
        COUNT(*) FILTER (WHERE status IN ('accepted', 'rejected')) as completed_count,
        COUNT(*) FILTER (WHERE applied_at >= CURRENT_DATE - INTERVAL '7 days') as applied_this_week,
        COUNT(*) FILTER (WHERE deadline >= CURRENT_DATE AND deadline <= CURRENT_DATE + INTERVAL '7 days') as deadlines_this_week
    FROM resumeforge_v2.jobs
    WHERE is_active = true
),
email_stats AS (
    SELECT 
        COUNT(*) FILTER (WHERE requires_action = true) as action_required_count,
        COUNT(*) FILTER (WHERE ai_processed = false) as unprocessed_count,
        COUNT(*) FILTER (WHERE received_at >= CURRENT_DATE - INTERVAL '24 hours') as received_today
    FROM resumeforge_v2.emails
),
follow_up_stats AS (
    SELECT 
        COUNT(*) as pending_follow_ups,
        COUNT(*) FILTER (WHERE scheduled_date <= CURRENT_DATE) as overdue_follow_ups
    FROM resumeforge_v2.follow_ups
    WHERE status = 'pending'
)
SELECT 
    job_stats.*,
    email_stats.*,
    follow_up_stats.*
FROM job_stats, email_stats, follow_up_stats;

COMMENT ON VIEW resumeforge_v2.dashboard_summary IS 'Real-time dashboard statistics for the main application view';

-- ----------------------------------------------------------------------------
-- 2. Job Pipeline View
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW resumeforge_v2.job_pipeline AS
SELECT 
    j.id,
    j.company_name,
    j.job_title,
    j.status,
    j.applied_at,
    j.priority_score,
    j.match_score,
    j.deadline,
    c.industry as company_industry,
    c.size as company_size,
    COUNT(DISTINCT ae.id) as event_count,
    MAX(ae.event_date) as last_event_date,
    STRING_AGG(DISTINCT ae.event_type, ', ' ORDER BY ae.event_type) as event_types,
    COUNT(DISTINCT e.id) as email_count,
    MAX(e.received_at) as last_email_received
FROM resumeforge_v2.jobs j
LEFT JOIN resumeforge_v2.companies c ON j.company_id = c.id
LEFT JOIN resumeforge_v2.application_events ae ON j.id = ae.job_id
LEFT JOIN resumeforge_v2.emails e ON j.id = e.job_id
WHERE j.is_active = true
GROUP BY j.id, j.company_name, j.job_title, j.status, j.applied_at, 
         j.priority_score, j.match_score, j.deadline, c.industry, c.size
ORDER BY j.priority_score DESC, j.created_at DESC;

COMMENT ON VIEW resumeforge_v2.job_pipeline IS 'Comprehensive job pipeline view with related events and emails';

-- ----------------------------------------------------------------------------
-- 3. Email Thread View
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW resumeforge_v2.email_threads AS
WITH thread_stats AS (
    SELECT 
        thread_id,
        COUNT(*) as message_count,
        MIN(received_at) as thread_started,
        MAX(received_at) as last_message,
        BOOL_OR(requires_action) as thread_requires_action,
        MAX(job_id) as job_id,  -- Assumes one job per thread
        STRING_AGG(DISTINCT sender, ', ' ORDER BY sender) as participants,
        BOOL_OR(has_attachments) as thread_has_attachments
    FROM resumeforge_v2.emails
    GROUP BY thread_id
)
SELECT 
    ts.*,
    e.subject as thread_subject,
    e.thread_summary,
    j.company_name,
    j.job_title,
    j.status as job_status
FROM thread_stats ts
JOIN resumeforge_v2.emails e ON e.thread_id = ts.thread_id AND e.is_thread_root = true
LEFT JOIN resumeforge_v2.jobs j ON ts.job_id = j.id
ORDER BY ts.last_message DESC;

COMMENT ON VIEW resumeforge_v2.email_threads IS 'Email thread summary with job relationships';

-- ----------------------------------------------------------------------------
-- 4. Resume Effectiveness View
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW resumeforge_v2.resume_effectiveness AS
WITH resume_usage AS (
    SELECT 
        r.id,
        r.name,
        r.focus_area,
        r.main_skills,
        r.ats_score,
        COUNT(DISTINCT j.id) as times_used,
        COUNT(DISTINCT j.company_id) as companies_applied,
        COUNT(DISTINCT CASE WHEN j.status = 'interviewing' THEN j.id END) as led_to_interviews,
        COUNT(DISTINCT CASE WHEN j.status = 'accepted' THEN j.id END) as led_to_offers,
        AVG(j.match_score) as avg_match_score
    FROM resumeforge_v2.resumes r
    LEFT JOIN resumeforge_v2.jobs j ON j.applied_resume_id = r.id
    WHERE r.is_active = true
    GROUP BY r.id, r.name, r.focus_area, r.main_skills, r.ats_score
)
SELECT 
    *,
    CASE 
        WHEN times_used = 0 THEN 0
        ELSE ROUND((led_to_interviews::numeric / times_used) * 100, 2)
    END as interview_rate,
    CASE 
        WHEN times_used = 0 THEN 0
        ELSE ROUND((led_to_offers::numeric / times_used) * 100, 2)
    END as offer_rate
FROM resume_usage
ORDER BY times_used DESC, interview_rate DESC;

COMMENT ON VIEW resumeforge_v2.resume_effectiveness IS 'Resume performance metrics and success rates';

-- ----------------------------------------------------------------------------
-- 5. Contact Network View
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW resumeforge_v2.contact_network AS
SELECT 
    c.id,
    c.name,
    c.email,
    c.current_title,
    comp.name as company_name,
    comp.industry,
    c.contact_type,
    c.relationship_strength,
    c.last_contacted,
    COUNT(DISTINCT jc.job_id) as associated_jobs,
    COUNT(DISTINCT j.id) FILTER (WHERE j.status = 'interviewing') as active_opportunities,
    CASE 
        WHEN c.last_contacted IS NULL THEN 'Never contacted'
        WHEN c.last_contacted < CURRENT_DATE - INTERVAL '90 days' THEN 'Needs reconnection'
        WHEN c.last_contacted < CURRENT_DATE - INTERVAL '30 days' THEN 'Recent contact'
        ELSE 'Active relationship'
    END as engagement_status
FROM resumeforge_v2.contacts c
LEFT JOIN resumeforge_v2.companies comp ON c.current_company_id = comp.id
LEFT JOIN resumeforge_v2.job_contacts jc ON c.id = jc.contact_id
LEFT JOIN resumeforge_v2.jobs j ON jc.job_id = j.id AND j.is_active = true
GROUP BY c.id, c.name, c.email, c.current_title, comp.name, comp.industry, 
         c.contact_type, c.relationship_strength, c.last_contacted
ORDER BY c.relationship_strength DESC, associated_jobs DESC;

COMMENT ON VIEW resumeforge_v2.contact_network IS 'Contact relationship management view';

-- ----------------------------------------------------------------------------
-- 6. Application Timeline View
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW resumeforge_v2.application_timeline AS
SELECT 
    j.id as job_id,
    j.company_name,
    j.job_title,
    j.applied_at,
    ae.event_type,
    ae.event_date,
    ae.title as event_title,
    ae.outcome,
    ae.interview_type,
    EXTRACT(DAY FROM (ae.event_date - j.applied_at)) as days_since_application,
    LAG(ae.event_date) OVER (PARTITION BY j.id ORDER BY ae.event_date) as previous_event_date,
    EXTRACT(DAY FROM (ae.event_date - LAG(ae.event_date) OVER (PARTITION BY j.id ORDER BY ae.event_date))) as days_between_events
FROM resumeforge_v2.jobs j
JOIN resumeforge_v2.application_events ae ON j.id = ae.job_id
WHERE j.applied_at IS NOT NULL
ORDER BY j.applied_at DESC, ae.event_date ASC;

COMMENT ON VIEW resumeforge_v2.application_timeline IS 'Detailed application progression timeline';

-- ----------------------------------------------------------------------------
-- 7. Weekly Activity Summary View
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW resumeforge_v2.weekly_activity_summary AS
WITH weeks AS (
    SELECT generate_series(
        date_trunc('week', CURRENT_DATE - INTERVAL '12 weeks'),
        date_trunc('week', CURRENT_DATE),
        '1 week'::interval
    ) as week_start
)
SELECT 
    w.week_start,
    COUNT(DISTINCT j.id) FILTER (WHERE j.discovered_at >= w.week_start AND j.discovered_at < w.week_start + INTERVAL '1 week') as jobs_discovered,
    COUNT(DISTINCT j.id) FILTER (WHERE j.applied_at >= w.week_start AND j.applied_at < w.week_start + INTERVAL '1 week') as jobs_applied,
    COUNT(DISTINCT e.id) FILTER (WHERE e.received_at >= w.week_start AND e.received_at < w.week_start + INTERVAL '1 week') as emails_received,
    COUNT(DISTINCT r.id) FILTER (WHERE r.created_at >= w.week_start AND r.created_at < w.week_start + INTERVAL '1 week') as resumes_created,
    COUNT(DISTINCT ae.id) FILTER (WHERE ae.event_date >= w.week_start AND ae.event_date < w.week_start + INTERVAL '1 week' AND ae.event_type = 'interview_scheduled') as interviews_scheduled
FROM weeks w
LEFT JOIN resumeforge_v2.jobs j ON true
LEFT JOIN resumeforge_v2.emails e ON true
LEFT JOIN resumeforge_v2.resumes r ON true
LEFT JOIN resumeforge_v2.application_events ae ON true
GROUP BY w.week_start
ORDER BY w.week_start DESC;

COMMENT ON VIEW resumeforge_v2.weekly_activity_summary IS 'Weekly activity metrics for trend analysis';

-- ----------------------------------------------------------------------------
-- 8. Skill Demand Analysis View
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW resumeforge_v2.skill_demand_analysis AS
WITH skill_occurrences AS (
    SELECT 
        unnest(keywords) as skill,
        status,
        match_score,
        priority_score
    FROM resumeforge_v2.jobs
    WHERE is_active = true AND keywords IS NOT NULL
)
SELECT 
    skill,
    COUNT(*) as total_occurrences,
    COUNT(*) FILTER (WHERE status = 'interested') as in_interested_jobs,
    COUNT(*) FILTER (WHERE status = 'applied') as in_applied_jobs,
    COUNT(*) FILTER (WHERE status = 'interviewing') as in_interview_jobs,
    AVG(match_score) as avg_match_score,
    AVG(priority_score) as avg_priority_score
FROM skill_occurrences
GROUP BY skill
HAVING COUNT(*) >= 2  -- Only show skills that appear in multiple jobs
ORDER BY total_occurrences DESC, avg_priority_score DESC
LIMIT 50;

COMMENT ON VIEW resumeforge_v2.skill_demand_analysis IS 'Most in-demand skills based on job postings';

-- ----------------------------------------------------------------------------
-- 9. Email Classification Accuracy View
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW resumeforge_v2.email_classification_metrics AS
SELECT 
    email_type,
    COUNT(*) as total_emails,
    AVG(classification_confidence) as avg_confidence,
    COUNT(*) FILTER (WHERE job_id IS NOT NULL) as linked_to_job,
    COUNT(*) FILTER (WHERE requires_action = true) as requiring_action,
    MIN(classification_confidence) as min_confidence,
    MAX(classification_confidence) as max_confidence
FROM resumeforge_v2.emails
WHERE email_type IS NOT NULL
GROUP BY email_type
ORDER BY total_emails DESC;

COMMENT ON VIEW resumeforge_v2.email_classification_metrics IS 'Email AI classification performance metrics';

-- ----------------------------------------------------------------------------
-- 10. Company Engagement View
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW resumeforge_v2.company_engagement AS
SELECT 
    c.id,
    c.name,
    c.industry,
    c.size,
    COUNT(DISTINCT j.id) as total_applications,
    COUNT(DISTINCT j.id) FILTER (WHERE j.status = 'interviewing') as active_interviews,
    COUNT(DISTINCT j.id) FILTER (WHERE j.status = 'accepted') as offers_received,
    COUNT(DISTINCT j.id) FILTER (WHERE j.status = 'rejected') as rejections,
    COUNT(DISTINCT con.id) as known_contacts,
    COUNT(DISTINCT e.id) as email_exchanges,
    MAX(j.applied_at) as last_application_date,
    AVG(j.match_score) as avg_match_score,
    STRING_AGG(DISTINCT j.job_title, ', ' ORDER BY j.job_title) as positions_applied
FROM resumeforge_v2.companies c
LEFT JOIN resumeforge_v2.jobs j ON c.id = j.company_id
LEFT JOIN resumeforge_v2.contacts con ON c.id = con.current_company_id
LEFT JOIN resumeforge_v2.emails e ON j.id = e.job_id
GROUP BY c.id, c.name, c.industry, c.size
ORDER BY total_applications DESC, active_interviews DESC;

COMMENT ON VIEW resumeforge_v2.company_engagement IS 'Company relationship and application history';

-- =============================================================================
-- MATERIALIZED VIEWS FOR EXPENSIVE CALCULATIONS
-- =============================================================================

-- ----------------------------------------------------------------------------
-- 1. Application Success Factors (Materialized)
-- ----------------------------------------------------------------------------
CREATE MATERIALIZED VIEW IF NOT EXISTS resumeforge_v2.application_success_factors AS
WITH job_outcomes AS (
    SELECT 
        j.focus_area,
        j.job_type,
        j.source,
        r.main_skills,
        r.ats_score,
        CASE 
            WHEN j.status IN ('interviewing', 'accepted') THEN 'positive'
            WHEN j.status = 'rejected' THEN 'negative'
            ELSE 'pending'
        END as outcome
    FROM resumeforge_v2.jobs j
    LEFT JOIN resumeforge_v2.resumes r ON j.applied_resume_id = r.id
    WHERE j.applied_at IS NOT NULL
)
SELECT 
    focus_area,
    job_type,
    source,
    COUNT(*) as total_applications,
    COUNT(*) FILTER (WHERE outcome = 'positive') as positive_outcomes,
    COUNT(*) FILTER (WHERE outcome = 'negative') as negative_outcomes,
    ROUND(AVG(ats_score), 2) as avg_ats_score,
    CASE 
        WHEN COUNT(*) > 0 THEN 
            ROUND((COUNT(*) FILTER (WHERE outcome = 'positive')::numeric / COUNT(*)) * 100, 2)
        ELSE 0 
    END as success_rate
FROM job_outcomes
GROUP BY GROUPING SETS (
    (focus_area),
    (job_type),
    (source),
    (focus_area, job_type),
    ()
)
ORDER BY total_applications DESC;

CREATE UNIQUE INDEX ON resumeforge_v2.application_success_factors (focus_area, job_type, source);

COMMENT ON MATERIALIZED VIEW resumeforge_v2.application_success_factors IS 'Factors correlating with application success (refresh periodically)';

-- ----------------------------------------------------------------------------
-- 2. Email Response Patterns (Materialized)
-- ----------------------------------------------------------------------------
CREATE MATERIALIZED VIEW IF NOT EXISTS resumeforge_v2.email_response_patterns AS
WITH email_threads_enriched AS (
    SELECT 
        e.thread_id,
        e.job_id,
        j.company_name,
        j.status as job_status,
        COUNT(*) as message_count,
        MIN(e.received_at) as thread_start,
        MAX(e.received_at) as thread_end,
        EXTRACT(EPOCH FROM (MAX(e.received_at) - MIN(e.received_at)))/3600 as thread_duration_hours,
        COUNT(DISTINCT e.sender) as participant_count,
        BOOL_OR(e.has_attachments) as has_attachments
    FROM resumeforge_v2.emails e
    LEFT JOIN resumeforge_v2.jobs j ON e.job_id = j.id
    WHERE e.job_id IS NOT NULL
    GROUP BY e.thread_id, e.job_id, j.company_name, j.status
)
SELECT 
    company_name,
    job_status,
    AVG(message_count) as avg_messages_per_thread,
    AVG(thread_duration_hours) as avg_thread_duration_hours,
    AVG(participant_count) as avg_participants,
    COUNT(*) as total_threads,
    SUM(CASE WHEN has_attachments THEN 1 ELSE 0 END) as threads_with_attachments
FROM email_threads_enriched
GROUP BY company_name, job_status
ORDER BY total_threads DESC;

CREATE UNIQUE INDEX ON resumeforge_v2.email_response_patterns (company_name, job_status);

COMMENT ON MATERIALIZED VIEW resumeforge_v2.email_response_patterns IS 'Email communication patterns by company and job status';

-- =============================================================================
-- REFRESH FUNCTIONS FOR MATERIALIZED VIEWS
-- =============================================================================

-- Function to refresh all materialized views
CREATE OR REPLACE FUNCTION resumeforge_v2.refresh_materialized_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY resumeforge_v2.application_success_factors;
    REFRESH MATERIALIZED VIEW CONCURRENTLY resumeforge_v2.email_response_patterns;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION resumeforge_v2.refresh_materialized_views() IS 'Refreshes all materialized views in the resumeforge_v2 schema';

-- =============================================================================
-- UTILITY FUNCTIONS
-- =============================================================================

-- Function to analyze index usage
CREATE OR REPLACE FUNCTION resumeforge_v2.analyze_index_usage()
RETURNS TABLE (
    schemaname text,
    tablename text,
    indexname text,
    index_size text,
    idx_scan bigint,
    idx_tup_read bigint,
    idx_tup_fetch bigint,
    is_unique boolean,
    is_primary boolean
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.schemaname::text,
        s.tablename::text,
        s.indexname::text,
        pg_size_pretty(pg_relation_size(s.indexrelid))::text as index_size,
        s.idx_scan,
        s.idx_tup_read,
        s.idx_tup_fetch,
        i.indisunique as is_unique,
        i.indisprimary as is_primary
    FROM pg_stat_user_indexes s
    JOIN pg_index i ON i.indexrelid = s.indexrelid
    WHERE s.schemaname = 'resumeforge_v2'
    ORDER BY s.idx_scan DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION resumeforge_v2.analyze_index_usage() IS 'Shows index usage statistics for performance tuning';

-- Function to get table sizes
CREATE OR REPLACE FUNCTION resumeforge_v2.get_table_sizes()
RETURNS TABLE (
    table_name text,
    total_size text,
    table_size text,
    indexes_size text,
    row_estimate bigint
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.relname::text as table_name,
        pg_size_pretty(pg_total_relation_size(c.oid))::text as total_size,
        pg_size_pretty(pg_relation_size(c.oid))::text as table_size,
        pg_size_pretty(pg_indexes_size(c.oid))::text as indexes_size,
        c.reltuples::bigint as row_estimate
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'resumeforge_v2'
    AND c.relkind = 'r'
    ORDER BY pg_total_relation_size(c.oid) DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION resumeforge_v2.get_table_sizes() IS 'Shows table and index sizes for capacity planning';

-- =============================================================================
-- PERFORMANCE OPTIMIZATION SETTINGS
-- =============================================================================

-- Analyze all tables to update statistics after index creation
ANALYZE resumeforge_v2.user_profile;
ANALYZE resumeforge_v2.auth_credentials;
ANALYZE resumeforge_v2.oauth_tokens;
ANALYZE resumeforge_v2.companies;
ANALYZE resumeforge_v2.contacts;
ANALYZE resumeforge_v2.jobs;
ANALYZE resumeforge_v2.job_contacts;
ANALYZE resumeforge_v2.resumes;
ANALYZE resumeforge_v2.resume_sections;
ANALYZE resumeforge_v2.emails;
ANALYZE resumeforge_v2.activity_log;
ANALYZE resumeforge_v2.application_events;
ANALYZE resumeforge_v2.follow_ups;

-- Reset search path
RESET search_path;

-- =============================================================================
-- Migration Complete
-- =============================================================================
-- This migration adds comprehensive indexes and views for the v2 schema.
-- 
-- Key features added:
-- 1. Performance indexes for common query patterns
-- 2. Full-text search indexes for content discovery
-- 3. Analytics views for dashboard and reporting
-- 4. Materialized views for expensive calculations
-- 5. Utility functions for monitoring and maintenance
--
-- To refresh materialized views periodically:
-- SELECT resumeforge_v2.refresh_materialized_views();
--
-- To check index usage:
-- SELECT * FROM resumeforge_v2.analyze_index_usage();
--
-- To monitor table sizes:
-- SELECT * FROM resumeforge_v2.get_table_sizes();
-- =============================================================================