-- Migration: Fix email metadata and categories
-- Date: 2025-01-10
-- Purpose: Add metadata columns for better email display and update email type categories

-- Add new columns to emails table for extracted metadata
ALTER TABLE emails 
ADD COLUMN IF NOT EXISTS company VARCHAR(255),
ADD COLUMN IF NOT EXISTS position VARCHAR(255),
ADD COLUMN IF NOT EXISTS sender_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS sender_email VARCHAR(255);

-- Update the email_type CHECK constraint to include new categories
ALTER TABLE emails DROP CONSTRAINT IF EXISTS emails_email_type_check;
ALTER TABLE emails ADD CONSTRAINT emails_email_type_check 
  CHECK (email_type IN (
    'application_submitted',
    'application_update', 
    'assessment',
    'followup',
    'interview_request',
    'offer',
    'rejection',
    'recruiter_outreach',
    'general'
  ));

-- Migrate existing email types to new categories
-- Map old 'application_confirmation' to 'application_submitted'
UPDATE emails 
SET email_type = 'application_submitted' 
WHERE email_type = 'application_confirmation';

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_emails_company ON emails(company);
CREATE INDEX IF NOT EXISTS idx_emails_email_type ON emails(email_type);
CREATE INDEX IF NOT EXISTS idx_emails_sender_email ON emails(sender_email);

-- Add comment to document the purpose of new columns
COMMENT ON COLUMN emails.company IS 'Extracted company name from email content or sender';
COMMENT ON COLUMN emails.position IS 'Extracted job position from email content';
COMMENT ON COLUMN emails.sender_name IS 'Extracted sender name from email headers';
COMMENT ON COLUMN emails.sender_email IS 'Extracted sender email address from headers';