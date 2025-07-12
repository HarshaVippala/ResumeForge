-- =====================================================
-- CLEANUP OLD TABLES AFTER SUCCESSFUL V2 MIGRATION
-- =====================================================
-- Created: 2025-01-07
-- Purpose: Safely cleanup old tables after verifying successful migration to v2 schema
-- 
-- ⚠️ WARNING: THIS IS A DESTRUCTIVE OPERATION! ⚠️
-- Only run this after:
-- 1. All v2 migrations have been successfully applied
-- 2. Data has been verified in v2 schema
-- 3. Application is running successfully with v2 schema
-- 4. A full database backup has been taken
-- =====================================================

-- Create backup schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS backup_v1;

-- =====================================================
-- STEP 1: SAFETY CHECKS
-- =====================================================
DO $$
DECLARE
    v2_table_count INTEGER;
    v2_data_count INTEGER;
    old_table_count INTEGER;
BEGIN
    -- Check that v2 schema exists and has tables
    SELECT COUNT(*) INTO v2_table_count
    FROM information_schema.tables
    WHERE table_schema = 'v2';
    
    IF v2_table_count < 10 THEN
        RAISE EXCEPTION 'V2 schema does not have expected tables. Found % tables', v2_table_count;
    END IF;
    
    -- Check that v2 schema has data
    SELECT COUNT(*) INTO v2_data_count
    FROM v2.users;
    
    IF v2_data_count = 0 THEN
        RAISE EXCEPTION 'V2 schema users table is empty. Migration may not be complete';
    END IF;
    
    -- Check that old tables exist before trying to backup
    SELECT COUNT(*) INTO old_table_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN (
        'profiles', 'user_profile', 'oauth_tokens', 'gmail_tokens',
        'resume_sessions', 'resume_content', 'resume_versions',
        'job_applications', 'email_sync_status', 'email_communications',
        'job_discovery_sources', 'discovered_jobs', 'activity_log'
    );
    
    RAISE NOTICE 'Found % old tables to cleanup', old_table_count;
END $$;

-- =====================================================
-- STEP 2: ARCHIVE OLD TABLES TO BACKUP SCHEMA
-- =====================================================

-- Archive function to safely move tables
CREATE OR REPLACE FUNCTION archive_table_to_backup(table_name TEXT)
RETURNS VOID AS $$
BEGIN
    -- Check if table exists in public schema
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = archive_table_to_backup.table_name
    ) THEN
        -- Drop if already exists in backup
        EXECUTE format('DROP TABLE IF EXISTS backup_v1.%I CASCADE', table_name);
        
        -- Move table to backup schema
        EXECUTE format('ALTER TABLE public.%I SET SCHEMA backup_v1', table_name);
        
        RAISE NOTICE 'Archived table % to backup_v1 schema', table_name;
    ELSE
        RAISE NOTICE 'Table % not found in public schema, skipping', table_name;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Archive old tables in order (respecting foreign key dependencies)
-- Level 1: Tables with no dependencies
SELECT archive_table_to_backup('profiles');
SELECT archive_table_to_backup('user_profile');
SELECT archive_table_to_backup('oauth_tokens');
SELECT archive_table_to_backup('gmail_tokens');
SELECT archive_table_to_backup('job_discovery_sources');
SELECT archive_table_to_backup('email_sync_status');
SELECT archive_table_to_backup('activity_log');

-- Level 2: Tables that depend on level 1
SELECT archive_table_to_backup('resume_sessions');
SELECT archive_table_to_backup('discovered_jobs');

-- Level 3: Tables that depend on level 2
SELECT archive_table_to_backup('resume_content');
SELECT archive_table_to_backup('resume_versions');
SELECT archive_table_to_backup('job_applications');
SELECT archive_table_to_backup('email_communications');

-- Archive any other old tables that might exist
DO $$
DECLARE
    old_table RECORD;
BEGIN
    FOR old_table IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_name LIKE 'old_%'
        OR table_name LIKE '%_backup'
        OR table_name LIKE '%_temp'
    LOOP
        PERFORM archive_table_to_backup(old_table.table_name);
    END LOOP;
END $$;

-- =====================================================
-- STEP 3: UPDATE SEARCH PATH TO USE V2 SCHEMA
-- =====================================================

-- Update database search_path to prioritize v2 schema
ALTER DATABASE postgres SET search_path TO v2, public;

-- =====================================================
-- STEP 4: MOVE V2 TABLES TO PUBLIC SCHEMA (OPTIONAL)
-- =====================================================
-- Uncomment this section if you want to move v2 tables back to public schema
-- This maintains backward compatibility with existing code

/*
-- Function to safely move v2 tables to public
CREATE OR REPLACE FUNCTION move_v2_to_public(table_name TEXT)
RETURNS VOID AS $$
BEGIN
    -- Check if table exists in v2 schema
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'v2' 
        AND table_name = move_v2_to_public.table_name
    ) THEN
        -- Move table to public schema
        EXECUTE format('ALTER TABLE v2.%I SET SCHEMA public', table_name);
        
        RAISE NOTICE 'Moved table % from v2 to public schema', table_name;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Move all v2 tables to public (uncomment to execute)
SELECT move_v2_to_public('users');
SELECT move_v2_to_public('passkeys');
SELECT move_v2_to_public('oauth_connections');
SELECT move_v2_to_public('job_analysis_sessions');
SELECT move_v2_to_public('resume_sections');
SELECT move_v2_to_public('resume_snapshots');
SELECT move_v2_to_public('my_jobs');
SELECT move_v2_to_public('my_emails');
SELECT move_v2_to_public('email_threads');
SELECT move_v2_to_public('email_sync_state');
SELECT move_v2_to_public('job_sources');
SELECT move_v2_to_public('scraped_jobs');
SELECT move_v2_to_public('my_activity_log');

-- Drop v2 schema after moving tables
DROP SCHEMA v2;

-- Reset search path to default
ALTER DATABASE postgres RESET search_path;
*/

-- =====================================================
-- STEP 5: CLEANUP FUNCTIONS AND TRIGGERS
-- =====================================================

-- Drop old functions that reference old tables
DROP FUNCTION IF EXISTS archive_table_to_backup(TEXT);

-- List all functions in backup schema for reference
DO $$
DECLARE
    func RECORD;
BEGIN
    RAISE NOTICE 'Functions archived in backup_v1 schema:';
    FOR func IN 
        SELECT proname, prosrc 
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'backup_v1'
    LOOP
        RAISE NOTICE '- %', func.proname;
    END LOOP;
END $$;

-- =====================================================
-- STEP 6: VERIFICATION
-- =====================================================

-- Show what's in the backup schema
DO $$
DECLARE
    backup_tables INTEGER;
    v2_tables INTEGER;
    public_tables INTEGER;
BEGIN
    -- Count tables in each schema
    SELECT COUNT(*) INTO backup_tables
    FROM information_schema.tables
    WHERE table_schema = 'backup_v1';
    
    SELECT COUNT(*) INTO v2_tables
    FROM information_schema.tables
    WHERE table_schema = 'v2';
    
    SELECT COUNT(*) INTO public_tables
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name NOT LIKE 'pg_%';
    
    RAISE NOTICE '';
    RAISE NOTICE '=== CLEANUP COMPLETE ===';
    RAISE NOTICE 'Backup schema (backup_v1): % tables', backup_tables;
    RAISE NOTICE 'V2 schema: % tables', v2_tables;
    RAISE NOTICE 'Public schema: % tables', public_tables;
    RAISE NOTICE '';
    RAISE NOTICE 'Old tables have been archived to backup_v1 schema';
    RAISE NOTICE 'To permanently delete backup data: DROP SCHEMA backup_v1 CASCADE;';
    RAISE NOTICE 'To restore old tables: ALTER TABLE backup_v1.<table_name> SET SCHEMA public;';
END $$;

-- =====================================================
-- ROLLBACK INSTRUCTIONS
-- =====================================================
-- To rollback this cleanup:
-- 1. Move tables back from backup_v1 to public:
--    ALTER TABLE backup_v1.<table_name> SET SCHEMA public;
-- 
-- 2. If you moved v2 tables to public, move them back:
--    CREATE SCHEMA v2;
--    ALTER TABLE public.<table_name> SET SCHEMA v2;
-- 
-- 3. Reset search path:
--    ALTER DATABASE postgres SET search_path TO public;
-- =====================================================