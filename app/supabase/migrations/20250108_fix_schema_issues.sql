-- =====================================================
-- FIX SCHEMA ISSUES - Move v2 tables to public schema
-- =====================================================
-- Created: 2025-01-08
-- Purpose: Fix database schema issues by moving v2 tables to public schema
-- =====================================================

-- First, check if resumeforge_v2 schema exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'resumeforge_v2') THEN
        RAISE NOTICE 'Found resumeforge_v2 schema, moving tables to public...';
        
        -- Move all tables from resumeforge_v2 to public
        -- Core tables
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'resumeforge_v2' AND table_name = 'user_profile') THEN
            ALTER TABLE resumeforge_v2.user_profile SET SCHEMA public;
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'resumeforge_v2' AND table_name = 'auth_credentials') THEN
            ALTER TABLE resumeforge_v2.auth_credentials SET SCHEMA public;
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'resumeforge_v2' AND table_name = 'oauth_tokens') THEN
            ALTER TABLE resumeforge_v2.oauth_tokens SET SCHEMA public;
        END IF;
        
        -- Company & Contact tables
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'resumeforge_v2' AND table_name = 'companies') THEN
            ALTER TABLE resumeforge_v2.companies SET SCHEMA public;
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'resumeforge_v2' AND table_name = 'contacts') THEN
            ALTER TABLE resumeforge_v2.contacts SET SCHEMA public;
        END IF;
        
        -- Job tracking tables
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'resumeforge_v2' AND table_name = 'jobs') THEN
            ALTER TABLE resumeforge_v2.jobs SET SCHEMA public;
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'resumeforge_v2' AND table_name = 'job_contacts') THEN
            ALTER TABLE resumeforge_v2.job_contacts SET SCHEMA public;
        END IF;
        
        -- Resume tables
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'resumeforge_v2' AND table_name = 'resumes') THEN
            ALTER TABLE resumeforge_v2.resumes SET SCHEMA public;
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'resumeforge_v2' AND table_name = 'resume_sections') THEN
            ALTER TABLE resumeforge_v2.resume_sections SET SCHEMA public;
        END IF;
        
        -- Email tables
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'resumeforge_v2' AND table_name = 'emails') THEN
            ALTER TABLE resumeforge_v2.emails SET SCHEMA public;
        END IF;
        
        -- Activity tables
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'resumeforge_v2' AND table_name = 'activity_log') THEN
            ALTER TABLE resumeforge_v2.activity_log SET SCHEMA public;
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'resumeforge_v2' AND table_name = 'application_events') THEN
            ALTER TABLE resumeforge_v2.application_events SET SCHEMA public;
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'resumeforge_v2' AND table_name = 'follow_ups') THEN
            ALTER TABLE resumeforge_v2.follow_ups SET SCHEMA public;
        END IF;
        
        -- Move views
        IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'resumeforge_v2' AND table_name = 'resume_performance') THEN
            ALTER VIEW resumeforge_v2.resume_performance SET SCHEMA public;
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'resumeforge_v2' AND table_name = 'application_funnel') THEN
            ALTER VIEW resumeforge_v2.application_funnel SET SCHEMA public;
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'resumeforge_v2' AND table_name = 'email_response_metrics') THEN
            ALTER VIEW resumeforge_v2.email_response_metrics SET SCHEMA public;
        END IF;
        
        -- Move functions
        IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'resumeforge_v2' AND p.proname = 'update_updated_at') THEN
            ALTER FUNCTION resumeforge_v2.update_updated_at() SET SCHEMA public;
        END IF;
        
        IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'resumeforge_v2' AND p.proname = 'log_job_status_change') THEN
            ALTER FUNCTION resumeforge_v2.log_job_status_change() SET SCHEMA public;
        END IF;
        
        -- Drop the empty resumeforge_v2 schema
        DROP SCHEMA IF EXISTS resumeforge_v2;
        
        RAISE NOTICE 'Successfully moved all tables to public schema';
    ELSE
        RAISE NOTICE 'resumeforge_v2 schema not found, checking if tables already exist in public...';
    END IF;
END $$;

-- Create compatibility aliases for legacy table names
-- These allow old code to work while we update references

-- Create my_jobs as an alias for jobs
CREATE OR REPLACE VIEW my_jobs AS SELECT * FROM jobs;

-- Create my_emails as an alias for emails  
CREATE OR REPLACE VIEW my_emails AS SELECT * FROM emails;

-- Create my_activity_log as an alias for activity_log
CREATE OR REPLACE VIEW my_activity_log AS SELECT * FROM activity_log;

-- Create job_opportunities view for backward compatibility
CREATE OR REPLACE VIEW job_opportunities AS 
SELECT 
    id,
    company_name,
    job_title,
    location,
    salary_range,
    source,
    source_url,
    discovered_at,
    created_at
FROM jobs;

-- Create sync_metadata table if it doesn't exist
CREATE TABLE IF NOT EXISTS sync_metadata (
    id TEXT PRIMARY KEY,
    last_sync_time TIMESTAMP WITH TIME ZONE,
    sync_state JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Grant permissions on new views
GRANT ALL ON my_jobs TO authenticated;
GRANT ALL ON my_emails TO authenticated;
GRANT ALL ON my_activity_log TO authenticated;
GRANT ALL ON job_opportunities TO authenticated;
GRANT ALL ON sync_metadata TO authenticated;

-- Ensure RLS is disabled on views (views inherit from base tables)
ALTER VIEW my_jobs SET (security_invoker = true);
ALTER VIEW my_emails SET (security_invoker = true);
ALTER VIEW my_activity_log SET (security_invoker = true);
ALTER VIEW job_opportunities SET (security_invoker = true);

-- Add any missing indexes that might have been lost
CREATE INDEX IF NOT EXISTS idx_sync_metadata_id ON sync_metadata(id);
CREATE INDEX IF NOT EXISTS idx_sync_metadata_last_sync ON sync_metadata(last_sync_time DESC);

-- Verify the fix
DO $$
DECLARE
    table_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN ('user_profile', 'jobs', 'emails', 'resumes', 'companies', 'contacts');
    
    RAISE NOTICE 'Found % core tables in public schema', table_count;
    
    IF table_count < 6 THEN
        RAISE WARNING 'Not all expected tables found in public schema!';
    ELSE
        RAISE NOTICE 'Schema fix completed successfully';
    END IF;
END $$;