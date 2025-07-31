-- =============================================================================
-- ResumeForge v2 Data Migration
-- Date: 2025-01-07
-- Description: Migrates existing data from old tables to the new v2 schema
-- =============================================================================

-- Start transaction
BEGIN;

-- =============================================================================
-- Migration Progress Logging
-- =============================================================================
DO $$
BEGIN
    RAISE NOTICE 'Starting ResumeForge v2 data migration at %', NOW();
END $$;

-- =============================================================================
-- Step 1: Create User Profile (Single User)
-- =============================================================================
DO $$
DECLARE
    v_user_id UUID;
    v_user_email TEXT;
BEGIN
    -- Get the first user email from oauth_tokens or user_credentials
    SELECT COALESCE(
        (SELECT email FROM public.oauth_tokens LIMIT 1),
        'user@example.com' -- Default email if none found
    ) INTO v_user_email;
    
    -- Create the single user profile
    INSERT INTO resumeforge_v2.user_profile (id, email, name, created_at)
    VALUES (
        gen_random_uuid(),
        v_user_email,
        'ResumeForge User',
        NOW()
    )
    ON CONFLICT (email) DO NOTHING
    RETURNING id INTO v_user_id;
    
    RAISE NOTICE 'Created user profile with ID: %', v_user_id;
END $$;

-- =============================================================================
-- Step 2: Migrate Companies
-- =============================================================================
DO $$
DECLARE
    v_migrated_count INTEGER := 0;
BEGIN
    -- Migrate existing companies
    INSERT INTO resumeforge_v2.companies (
        id, 
        name, 
        website,
        industry,
        size,
        location,
        created_at,
        updated_at
    )
    SELECT 
        id,
        name,
        NULL as website,
        industry,
        CASE 
            WHEN size_range = 'startup' THEN 'startup'
            WHEN size_range = 'small' THEN 'small'
            WHEN size_range = 'medium' THEN 'medium'
            WHEN size_range = 'large' THEN 'large'
            WHEN size_range = 'enterprise' THEN 'enterprise'
            ELSE NULL
        END as size,
        headquarters_location as location,
        created_at,
        updated_at
    FROM public.companies
    WHERE name IS NOT NULL
    ON CONFLICT (name) DO UPDATE SET
        industry = EXCLUDED.industry,
        size = EXCLUDED.size,
        location = EXCLUDED.location,
        updated_at = NOW();
    
    GET DIAGNOSTICS v_migrated_count = ROW_COUNT;
    RAISE NOTICE 'Migrated % companies', v_migrated_count;
    
    -- Also create companies from job_applications that don't exist yet
    INSERT INTO resumeforge_v2.companies (name, created_at)
    SELECT DISTINCT 
        company_name,
        MIN(created_at)
    FROM public.job_applications
    WHERE company_name IS NOT NULL
        AND NOT EXISTS (
            SELECT 1 FROM resumeforge_v2.companies c 
            WHERE LOWER(c.name) = LOWER(job_applications.company_name)
        )
    GROUP BY company_name
    ON CONFLICT (name) DO NOTHING;
    
    GET DIAGNOSTICS v_migrated_count = ROW_COUNT;
    RAISE NOTICE 'Created % additional companies from job applications', v_migrated_count;
END $$;

-- =============================================================================
-- Step 3: Migrate Auth Credentials (WebAuthn)
-- =============================================================================
DO $$
DECLARE
    v_user_id UUID;
    v_migrated_count INTEGER := 0;
BEGIN
    -- Get the user ID
    SELECT id INTO v_user_id FROM resumeforge_v2.user_profile LIMIT 1;
    
    -- Migrate user credentials
    INSERT INTO resumeforge_v2.auth_credentials (
        id,
        user_id,
        credential_id,
        public_key,
        sign_count,
        created_at
    )
    SELECT 
        id,
        v_user_id,
        credential_id,
        public_key::BYTEA,
        counter::INTEGER as sign_count,
        created_at
    FROM public.user_credentials
    WHERE credential_id IS NOT NULL
    ON CONFLICT (credential_id) DO UPDATE SET
        sign_count = EXCLUDED.sign_count;
    
    GET DIAGNOSTICS v_migrated_count = ROW_COUNT;
    RAISE NOTICE 'Migrated % auth credentials', v_migrated_count;
END $$;

-- =============================================================================
-- Step 4: Migrate OAuth Tokens
-- =============================================================================
DO $$
DECLARE
    v_user_id UUID;
    v_migrated_count INTEGER := 0;
BEGIN
    -- Get the user ID
    SELECT id INTO v_user_id FROM resumeforge_v2.user_profile LIMIT 1;
    
    -- Migrate oauth tokens
    INSERT INTO resumeforge_v2.oauth_tokens (
        id,
        user_id,
        provider,
        encrypted_token,
        expires_at,
        scopes,
        created_at,
        updated_at
    )
    SELECT 
        id,
        v_user_id,
        'gmail' as provider,
        encrypted_access_token as encrypted_token,
        expires_at,
        scopes,
        created_at,
        updated_at
    FROM public.oauth_tokens
    WHERE encrypted_access_token IS NOT NULL
    ON CONFLICT (user_id, provider) DO UPDATE SET
        encrypted_token = EXCLUDED.encrypted_token,
        expires_at = EXCLUDED.expires_at,
        scopes = EXCLUDED.scopes,
        updated_at = NOW();
    
    GET DIAGNOSTICS v_migrated_count = ROW_COUNT;
    RAISE NOTICE 'Migrated % OAuth tokens', v_migrated_count;
END $$;

-- =============================================================================
-- Step 5: Migrate Jobs from job_applications
-- =============================================================================
DO $$
DECLARE
    v_migrated_count INTEGER := 0;
    v_company_id UUID;
BEGIN
    -- Migrate job applications to jobs table
    FOR r IN SELECT * FROM public.job_applications LOOP
        -- Find matching company
        SELECT id INTO v_company_id 
        FROM resumeforge_v2.companies 
        WHERE LOWER(name) = LOWER(r.company_name)
        LIMIT 1;
        
        INSERT INTO resumeforge_v2.jobs (
            id,
            company_id,
            company_name,
            job_title,
            description,
            location,
            source,
            source_url,
            discovered_at,
            status,
            applied_at,
            notes,
            is_active,
            created_at,
            updated_at
        )
        VALUES (
            r.id,
            v_company_id,
            r.company_name,
            r.position_title,
            r.job_description,
            r.location,
            'manual', -- Default source
            r.job_url,
            r.created_at, -- Use created_at as discovered_at
            CASE 
                WHEN r.status = 'applied' THEN 'applied'
                WHEN r.status = 'interviewing' THEN 'interviewing'
                WHEN r.status = 'offered' THEN 'accepted'
                WHEN r.status = 'rejected' THEN 'rejected'
                WHEN r.status = 'withdrawn' THEN 'withdrawn'
                ELSE 'interested'
            END,
            r.applied_date,
            r.notes,
            r.status NOT IN ('rejected', 'withdrawn'), -- Set inactive for closed applications
            r.created_at,
            r.updated_at
        )
        ON CONFLICT (id) DO UPDATE SET
            company_id = EXCLUDED.company_id,
            status = EXCLUDED.status,
            notes = EXCLUDED.notes,
            updated_at = NOW();
            
        v_migrated_count := v_migrated_count + 1;
    END LOOP;
    
    RAISE NOTICE 'Migrated % job applications to jobs', v_migrated_count;
END $$;

-- =============================================================================
-- Step 6: Migrate Emails
-- =============================================================================
DO $$
DECLARE
    v_migrated_count INTEGER := 0;
    v_job_id UUID;
BEGIN
    -- Migrate email communications to emails table
    INSERT INTO resumeforge_v2.emails (
        id,
        gmail_id,
        thread_id,
        subject,
        sender,
        recipients,
        received_at,
        body_text,
        body_html,
        has_attachments,
        attachments,
        job_id,
        is_job_related,
        job_confidence,
        email_type,
        classification_confidence,
        thread_position,
        is_thread_root,
        thread_summary,
        ai_processed,
        processing_version,
        requires_action,
        labels,
        created_at
    )
    SELECT 
        gen_random_uuid(), -- Generate new UUID since email_communications uses INTEGER id
        gmail_id,
        thread_id,
        subject,
        sender_email as sender,
        ARRAY[recipient_emails] as recipients,
        received_at,
        body_text,
        body_html,
        has_attachments,
        attachments,
        linked_job_id as job_id,
        is_job_related,
        job_relevance_confidence as job_confidence,
        CASE 
            WHEN email_type = 'application_confirmation' THEN 'application_confirmation'
            WHEN email_type = 'recruiter_outreach' THEN 'recruiter_outreach'
            WHEN email_type = 'interview_invitation' THEN 'interview_request'
            WHEN email_type = 'rejection' THEN 'rejection'
            WHEN email_type = 'offer' THEN 'offer'
            ELSE 'general'
        END as email_type,
        ai_summary_confidence as classification_confidence,
        thread_position,
        is_thread_starter as is_thread_root,
        NULL as thread_summary, -- Will be populated later
        processed_at IS NOT NULL as ai_processed,
        processing_version,
        false as requires_action, -- Default to false
        labels,
        created_at
    FROM public.email_communications
    WHERE gmail_id IS NOT NULL
    ON CONFLICT (gmail_id) DO UPDATE SET
        subject = EXCLUDED.subject,
        job_id = EXCLUDED.job_id,
        is_job_related = EXCLUDED.is_job_related,
        email_type = EXCLUDED.email_type;
    
    GET DIAGNOSTICS v_migrated_count = ROW_COUNT;
    RAISE NOTICE 'Migrated % emails', v_migrated_count;
END $$;

-- =============================================================================
-- Step 7: Migrate Resumes from resume_sessions
-- =============================================================================
DO $$
DECLARE
    v_migrated_count INTEGER := 0;
    v_job_id UUID;
    v_resume_content JSONB;
BEGIN
    -- Migrate resume sessions to resumes table
    FOR r IN SELECT * FROM public.resume_sessions WHERE resume_generated = true LOOP
        -- Build resume content from sections
        v_resume_content := jsonb_build_object(
            'contact', r.basic_info,
            'summary', (SELECT content FROM public.resume_content 
                       WHERE session_id = r.id AND section_type = 'summary' 
                       ORDER BY created_at DESC LIMIT 1),
            'experience', (SELECT jsonb_agg(content ORDER BY created_at) 
                          FROM public.resume_content 
                          WHERE session_id = r.id AND section_type = 'experience'),
            'education', (SELECT jsonb_agg(content ORDER BY created_at) 
                         FROM public.resume_content 
                         WHERE session_id = r.id AND section_type = 'education'),
            'skills', (SELECT content FROM public.resume_content 
                      WHERE session_id = r.id AND section_type = 'skills' 
                      ORDER BY created_at DESC LIMIT 1)
        );
        
        -- Find linked job if exists
        SELECT id INTO v_job_id 
        FROM resumeforge_v2.jobs 
        WHERE id = r.application_id;
        
        INSERT INTO resumeforge_v2.resumes (
            id,
            name,
            job_id,
            content,
            main_skills,
            tech_stack,
            tailoring_notes,
            ats_score,
            version,
            is_master,
            is_active,
            created_at,
            updated_at
        )
        VALUES (
            gen_random_uuid(),
            COALESCE(r.resume_name, 'Resume for ' || COALESCE(r.company_name, 'Unknown')),
            v_job_id,
            v_resume_content,
            COALESCE(r.key_skills, ARRAY[]::TEXT[]),
            ARRAY[]::TEXT[], -- Tech stack not stored in old schema
            r.tailoring_notes,
            r.ats_score,
            1, -- Default version
            false, -- Not a master resume
            true, -- Active by default
            r.created_at,
            r.updated_at
        );
        
        v_migrated_count := v_migrated_count + 1;
    END LOOP;
    
    RAISE NOTICE 'Migrated % resume sessions to resumes', v_migrated_count;
END $$;

-- =============================================================================
-- Step 8: Create Activity Log Entries
-- =============================================================================
DO $$
DECLARE
    v_migrated_count INTEGER := 0;
BEGIN
    -- Log job application events
    INSERT INTO resumeforge_v2.activity_log (
        event_type,
        entity_type,
        entity_id,
        description,
        metadata,
        source,
        created_at
    )
    SELECT 
        'job_added',
        'job',
        id,
        'Job application added: ' || company_name || ' - ' || job_title,
        jsonb_build_object(
            'company', company_name,
            'title', job_title,
            'status', status
        ),
        'migration',
        created_at
    FROM resumeforge_v2.jobs;
    
    GET DIAGNOSTICS v_migrated_count = ROW_COUNT;
    RAISE NOTICE 'Created % activity log entries for jobs', v_migrated_count;
    
    -- Log resume creation events
    INSERT INTO resumeforge_v2.activity_log (
        event_type,
        entity_type,
        entity_id,
        description,
        metadata,
        source,
        created_at
    )
    SELECT 
        'resume_created',
        'resume',
        id,
        'Resume created: ' || name,
        jsonb_build_object(
            'name', name,
            'job_id', job_id
        ),
        'migration',
        created_at
    FROM resumeforge_v2.resumes;
    
    GET DIAGNOSTICS v_migrated_count = ROW_COUNT;
    RAISE NOTICE 'Created % activity log entries for resumes', v_migrated_count;
END $$;

-- =============================================================================
-- Step 9: Create Application Events from Timeline
-- =============================================================================
DO $$
DECLARE
    v_migrated_count INTEGER := 0;
BEGIN
    -- Migrate application timeline events
    INSERT INTO resumeforge_v2.application_events (
        id,
        job_id,
        event_type,
        event_date,
        title,
        description,
        outcome,
        created_at
    )
    SELECT 
        at.id,
        at.application_id as job_id,
        CASE 
            WHEN at.event_type = 'application' THEN 'applied'
            WHEN at.event_type = 'interview_scheduled' THEN 'interview_scheduled'
            WHEN at.event_type = 'interview_completed' THEN 'interview_completed'
            WHEN at.event_type = 'offer_received' THEN 'offer'
            WHEN at.event_type = 'rejection' THEN 'rejected'
            ELSE at.event_type
        END as event_type,
        at.event_date,
        at.title,
        at.description,
        at.outcome,
        at.created_at
    FROM public.application_timeline at
    WHERE EXISTS (SELECT 1 FROM resumeforge_v2.jobs j WHERE j.id = at.application_id)
    ON CONFLICT (id) DO NOTHING;
    
    GET DIAGNOSTICS v_migrated_count = ROW_COUNT;
    RAISE NOTICE 'Migrated % application timeline events', v_migrated_count;
END $$;

-- =============================================================================
-- Data Validation Checks
-- =============================================================================
DO $$
DECLARE
    v_old_jobs_count INTEGER;
    v_new_jobs_count INTEGER;
    v_old_emails_count INTEGER;
    v_new_emails_count INTEGER;
    v_old_resumes_count INTEGER;
    v_new_resumes_count INTEGER;
BEGIN
    -- Count records in old tables
    SELECT COUNT(*) INTO v_old_jobs_count FROM public.job_applications;
    SELECT COUNT(*) INTO v_old_emails_count FROM public.email_communications;
    SELECT COUNT(*) INTO v_old_resumes_count FROM public.resume_sessions WHERE resume_generated = true;
    
    -- Count records in new tables
    SELECT COUNT(*) INTO v_new_jobs_count FROM resumeforge_v2.jobs;
    SELECT COUNT(*) INTO v_new_emails_count FROM resumeforge_v2.emails;
    SELECT COUNT(*) INTO v_new_resumes_count FROM resumeforge_v2.resumes;
    
    RAISE NOTICE '=== Migration Validation ===';
    RAISE NOTICE 'Jobs: % old → % new', v_old_jobs_count, v_new_jobs_count;
    RAISE NOTICE 'Emails: % old → % new', v_old_emails_count, v_new_emails_count;
    RAISE NOTICE 'Resumes: % old → % new', v_old_resumes_count, v_new_resumes_count;
    
    -- Validate critical data integrity
    IF v_new_jobs_count < v_old_jobs_count THEN
        RAISE WARNING 'Some jobs were not migrated!';
    END IF;
    
    IF v_new_emails_count < v_old_emails_count THEN
        RAISE WARNING 'Some emails were not migrated!';
    END IF;
END $$;

-- =============================================================================
-- Migration Complete
-- =============================================================================
DO $$
BEGIN
    RAISE NOTICE '=============================================================================';
    RAISE NOTICE 'ResumeForge v2 data migration completed successfully at %', NOW();
    RAISE NOTICE '=============================================================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Review the migration results above';
    RAISE NOTICE '2. Test the application with the new schema';
    RAISE NOTICE '3. Update application code to use resumeforge_v2 schema';
    RAISE NOTICE '4. Once verified, drop the old tables or keep for backup';
    RAISE NOTICE '';
    RAISE NOTICE 'To rollback this migration, restore from backup created with:';
    RAISE NOTICE 'pg_dump -h [host] -U [user] -d [database] -n public > backup_before_migration.sql';
END $$;

-- Commit the transaction
COMMIT;

-- =============================================================================
-- Rollback Instructions (Run these commands if needed)
-- =============================================================================
-- To rollback this migration:
-- 1. First, create a backup of current state:
--    pg_dump -h [host] -U [user] -d [database] -n resumeforge_v2 > v2_migration_backup.sql
--
-- 2. Then drop the v2 schema:
--    DROP SCHEMA resumeforge_v2 CASCADE;
--
-- 3. Restore from the backup created before migration:
--    psql -h [host] -U [user] -d [database] < backup_before_migration.sql
--
-- 4. Remove any foreign key constraints added to old tables:
--    ALTER TABLE resume_sessions DROP CONSTRAINT IF EXISTS fk_resume_sessions_application;
--    ALTER TABLE job_applications DROP CONSTRAINT IF EXISTS fk_job_applications_session;
--    ALTER TABLE email_communications DROP CONSTRAINT IF EXISTS fk_email_communications_application;
-- =============================================================================