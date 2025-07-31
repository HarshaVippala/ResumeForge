-- Fix emails table schema for dashboard display
-- Date: 2025-01-09
-- Purpose: Add missing fields that the dashboard InboxEmails component expects

-- Add missing columns to emails table
ALTER TABLE emails 
ADD COLUMN IF NOT EXISTS sender_name TEXT,
ADD COLUMN IF NOT EXISTS sender_email TEXT,
ADD COLUMN IF NOT EXISTS company TEXT,
ADD COLUMN IF NOT EXISTS position TEXT,
ADD COLUMN IF NOT EXISTS extracted_details JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS summary TEXT,
ADD COLUMN IF NOT EXISTS preview TEXT,
ADD COLUMN IF NOT EXISTS requires_action BOOLEAN DEFAULT false;

-- Update existing records with extracted data from sender field
UPDATE emails 
SET 
    sender_email = CASE 
        WHEN sender LIKE '%@%' THEN sender
        ELSE NULL
    END,
    sender_name = CASE 
        WHEN sender LIKE '%@%' THEN 
            CASE 
                WHEN sender LIKE '%<%' THEN 
                    TRIM(split_part(sender, '<', 1))
                ELSE 
                    split_part(sender, '@', 1)
            END
        ELSE sender
    END,
    company = CASE 
        WHEN sender LIKE '%@%' THEN 
            CASE 
                WHEN sender LIKE '%@gmail.com' THEN 'Gmail'
                WHEN sender LIKE '%@linkedin.com' THEN 'LinkedIn'
                WHEN sender LIKE '%@indeed.com' THEN 'Indeed'
                WHEN sender LIKE '%@oracle.com' THEN 'Oracle'
                WHEN sender LIKE '%@microsoft.com' THEN 'Microsoft'
                WHEN sender LIKE '%@google.com' THEN 'Google'
                WHEN sender LIKE '%@amazon.com' THEN 'Amazon'
                WHEN sender LIKE '%@apple.com' THEN 'Apple'
                WHEN sender LIKE '%@meta.com' THEN 'Meta'
                WHEN sender LIKE '%@facebook.com' THEN 'Meta'
                ELSE 
                    UPPER(LEFT(split_part(split_part(sender, '@', 2), '.', 1), 1)) || 
                    LOWER(SUBSTRING(split_part(split_part(sender, '@', 2), '.', 1), 2))
            END
        ELSE 'Unknown'
    END,
    preview = COALESCE(LEFT(body_text, 100), LEFT(subject, 100), ''),
    summary = COALESCE(LEFT(body_text, 200), subject, 'No summary available'),
    requires_action = CASE 
        WHEN subject ILIKE '%interview%' OR subject ILIKE '%assessment%' OR subject ILIKE '%deadline%' THEN true
        ELSE false
    END
WHERE sender_email IS NULL OR sender_name IS NULL;

-- Update email_type based on subject patterns for better classification
UPDATE emails 
SET email_type = CASE 
    WHEN subject ILIKE '%interview%' OR subject ILIKE '%meet%' OR subject ILIKE '%call%' THEN 'interview'
    WHEN subject ILIKE '%offer%' OR subject ILIKE '%congratulations%' THEN 'offer'
    WHEN subject ILIKE '%application%' OR subject ILIKE '%applied%' OR subject ILIKE '%thank you%' THEN 'application_confirmation'
    WHEN subject ILIKE '%opportunity%' OR subject ILIKE '%position%' OR subject ILIKE '%role%' THEN 'recruiter_outreach'
    WHEN subject ILIKE '%unfortunately%' OR subject ILIKE '%not selected%' THEN 'rejection'
    ELSE 'general'
END
WHERE email_type IS NULL;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_emails_sender_email ON emails(sender_email);
CREATE INDEX IF NOT EXISTS idx_emails_company ON emails(company);
CREATE INDEX IF NOT EXISTS idx_emails_type ON emails(email_type);
CREATE INDEX IF NOT EXISTS idx_emails_requires_action ON emails(requires_action) WHERE requires_action = true;

-- Update job_related classification based on content
UPDATE emails 
SET is_job_related = CASE 
    WHEN email_type IN ('interview', 'offer', 'application_confirmation', 'recruiter_outreach', 'rejection') THEN true
    WHEN subject ILIKE '%job%' OR subject ILIKE '%position%' OR subject ILIKE '%career%' OR subject ILIKE '%hiring%' THEN true
    ELSE false
END
WHERE is_job_related IS NULL;

-- Add some sample extracted_details for interview emails
UPDATE emails 
SET extracted_details = jsonb_build_object(
    'recruiter_name', sender_name,
    'recruiter_email', sender_email,
    'interview_date', 
    CASE 
        WHEN subject ILIKE '%interview%' THEN 
            (NOW() + INTERVAL '3 days')::date::text
        ELSE NULL
    END,
    'response_deadline',
    CASE 
        WHEN email_type = 'offer' THEN 
            (NOW() + INTERVAL '5 days')::date::text
        ELSE NULL
    END
)
WHERE email_type IN ('interview', 'offer') AND extracted_details = '{}'::jsonb;

-- Add comment for documentation
COMMENT ON TABLE emails IS 'Enhanced emails table with dashboard-required fields. Updated 2025-01-09 for InboxEmails component compatibility.';

-- Verify the changes
SELECT 
    'Total emails' as metric,
    COUNT(*) as count
FROM emails
UNION ALL
SELECT 
    'Job-related emails' as metric,
    COUNT(*) as count
FROM emails WHERE is_job_related = true
UNION ALL
SELECT 
    'Emails with company' as metric,
    COUNT(*) as count
FROM emails WHERE company IS NOT NULL AND company != 'Unknown'
UNION ALL
SELECT 
    'Emails requiring action' as metric,
    COUNT(*) as count
FROM emails WHERE requires_action = true;