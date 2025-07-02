-- Fix email_communications schema issues
-- Add missing columns that might be referenced in the codebase

-- Add received_at column as alias for date_sent for backward compatibility
ALTER TABLE email_communications 
ADD COLUMN IF NOT EXISTS received_at TIMESTAMP WITH TIME ZONE;

-- Set received_at to same as date_sent for existing records
UPDATE email_communications 
SET received_at = date_sent 
WHERE received_at IS NULL;

-- Add other potentially missing columns
ALTER TABLE email_communications 
ADD COLUMN IF NOT EXISTS is_job_related BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ai_processed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS email_date TIMESTAMP WITH TIME ZONE;

-- Set email_date as alias for date_sent
UPDATE email_communications 
SET email_date = date_sent 
WHERE email_date IS NULL;

-- Create trigger to keep received_at and email_date in sync with date_sent
CREATE OR REPLACE FUNCTION sync_email_dates()
RETURNS TRIGGER AS $$
BEGIN
    NEW.received_at = NEW.date_sent;
    NEW.email_date = NEW.date_sent;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger
DROP TRIGGER IF EXISTS sync_email_dates_trigger ON email_communications;
CREATE TRIGGER sync_email_dates_trigger
BEFORE INSERT OR UPDATE ON email_communications
FOR EACH ROW
EXECUTE FUNCTION sync_email_dates();

-- Add indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_email_communications_received_at ON email_communications(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_communications_job_related ON email_communications(is_job_related);
CREATE INDEX IF NOT EXISTS idx_email_communications_ai_processed ON email_communications(ai_processed);