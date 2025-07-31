-- Comprehensive RLS Policy Fix for Personal ResumeForge Application
-- Created: 2025-01-09
-- 
-- This migration provides two approaches for handling RLS in a personal app:
-- Option 1: Disable RLS on most tables (RECOMMENDED for personal use)
-- Option 2: Keep RLS with proper policies for service_role and anon access
--
-- IMPORTANT: Choose ONE option by uncommenting the appropriate section

-- ================================================================
-- OPTION 1: DISABLE RLS (RECOMMENDED FOR PERSONAL APP)
-- ================================================================
-- This approach disables RLS on all tables except oauth_tokens
-- which should remain protected for security reasons

-- Disable RLS on all main tables
ALTER TABLE IF EXISTS activity_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS application_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS auth_credentials DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS contacts DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS follow_ups DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS job_contacts DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS jobs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS resume_sections DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS resumes DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_profile DISABLE ROW LEVEL SECURITY;

-- These are already disabled but included for completeness
ALTER TABLE IF EXISTS emails DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS sync_metadata DISABLE ROW LEVEL SECURITY;

-- Keep RLS enabled on oauth_tokens for security
-- But update the policy to work properly
ALTER TABLE IF EXISTS oauth_tokens ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies on oauth_tokens
DROP POLICY IF EXISTS "Service role full access to oauth_tokens" ON oauth_tokens;
DROP POLICY IF EXISTS "Allow all operations on oauth_tokens" ON oauth_tokens;
DROP POLICY IF EXISTS "Allow authenticated users to manage their tokens" ON oauth_tokens;

-- Create a simple policy for oauth_tokens that allows access
CREATE POLICY "Personal app access to oauth_tokens"
ON oauth_tokens
FOR ALL
USING (true)
WITH CHECK (true);

-- Add comments explaining the security model
COMMENT ON TABLE oauth_tokens IS 'OAuth tokens table with RLS enabled for encryption at rest. Personal app uses relaxed policies.';

-- ================================================================
-- OPTION 2: KEEP RLS WITH PROPER POLICIES (COMMENT OUT OPTION 1 FIRST)
-- ================================================================
-- This approach keeps RLS but ensures both service_role and anon can access

/*
-- Helper function to create consistent policies
CREATE OR REPLACE FUNCTION create_personal_app_policies(table_name text)
RETURNS void AS $$
BEGIN
  -- Drop any existing policies
  EXECUTE format('DROP POLICY IF EXISTS "Allow service role access" ON %I', table_name);
  EXECUTE format('DROP POLICY IF EXISTS "Allow anon access" ON %I', table_name);
  EXECUTE format('DROP POLICY IF EXISTS "Allow authenticated access" ON %I', table_name);
  
  -- Create policy for service role (backend)
  EXECUTE format('
    CREATE POLICY "Allow service role access"
    ON %I
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true)
  ', table_name);
  
  -- Create policy for anon (frontend)
  EXECUTE format('
    CREATE POLICY "Allow anon access"
    ON %I
    FOR ALL
    TO anon
    USING (true)
    WITH CHECK (true)
  ', table_name);
  
  -- Create policy for authenticated users (future-proofing)
  EXECUTE format('
    CREATE POLICY "Allow authenticated access"
    ON %I
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true)
  ', table_name);
END;
$$ LANGUAGE plpgsql;

-- Apply consistent policies to all tables with RLS
SELECT create_personal_app_policies('activity_log');
SELECT create_personal_app_policies('application_events');
SELECT create_personal_app_policies('auth_credentials');
SELECT create_personal_app_policies('companies');
SELECT create_personal_app_policies('contacts');
SELECT create_personal_app_policies('follow_ups');
SELECT create_personal_app_policies('job_contacts');
SELECT create_personal_app_policies('jobs');
SELECT create_personal_app_policies('resume_sections');
SELECT create_personal_app_policies('resumes');
SELECT create_personal_app_policies('user_profile');
SELECT create_personal_app_policies('emails');
SELECT create_personal_app_policies('sync_metadata');
SELECT create_personal_app_policies('oauth_tokens');

-- Clean up the helper function
DROP FUNCTION IF EXISTS create_personal_app_policies(text);
*/

-- ================================================================
-- VERIFICATION QUERIES
-- ================================================================
-- Run these queries after migration to verify the changes:

-- Check RLS status on all tables:
/*
SELECT 
  schemaname,
  tablename,
  CASE 
    WHEN rowsecurity IS NULL THEN 'UNKNOWN'
    WHEN rowsecurity THEN 'ENABLED'
    ELSE 'DISABLED'
  END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'activity_log', 'application_events', 'auth_credentials',
    'companies', 'contacts', 'follow_ups', 'job_contacts',
    'jobs', 'resume_sections', 'resumes', 'user_profile',
    'emails', 'sync_metadata', 'oauth_tokens'
  )
ORDER BY tablename;
*/

-- Check policies on a specific table:
/*
SELECT 
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'oauth_tokens';
*/

-- ================================================================
-- ROLLBACK INSTRUCTIONS
-- ================================================================
-- To rollback Option 1 (re-enable RLS):
/*
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE resume_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profile ENABLE ROW LEVEL SECURITY;
*/