-- Gmail Notifications Log Table
-- Tracks all push notifications received from Gmail API
-- Created: 2025-01-09

CREATE TABLE IF NOT EXISTS gmail_notifications_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id VARCHAR(255) NOT NULL,
  email_address VARCHAR(255) NOT NULL,
  history_id BIGINT,
  processing_time_ms INTEGER NOT NULL DEFAULT 0,
  subscription_name VARCHAR(255),
  processed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  status VARCHAR(20) NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'error', 'pending')),
  error_message TEXT,
  error_stack TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_gmail_notifications_log_email_address ON gmail_notifications_log(email_address);
CREATE INDEX IF NOT EXISTS idx_gmail_notifications_log_processed_at ON gmail_notifications_log(processed_at);
CREATE INDEX IF NOT EXISTS idx_gmail_notifications_log_status ON gmail_notifications_log(status);
CREATE INDEX IF NOT EXISTS idx_gmail_notifications_log_message_id ON gmail_notifications_log(message_id);

-- Add RLS policy for personal app
ALTER TABLE gmail_notifications_log ENABLE ROW LEVEL SECURITY;

-- Allow service role to access all records
CREATE POLICY "Allow service role full access to gmail_notifications_log" ON gmail_notifications_log
  USING (true)
  WITH CHECK (true);

-- Add comments for documentation
COMMENT ON TABLE gmail_notifications_log IS 'Tracks Gmail push notifications received from Google Cloud Pub/Sub';
COMMENT ON COLUMN gmail_notifications_log.message_id IS 'Unique message ID from Pub/Sub';
COMMENT ON COLUMN gmail_notifications_log.email_address IS 'Email address from the Gmail notification';
COMMENT ON COLUMN gmail_notifications_log.history_id IS 'Gmail history ID from the notification';
COMMENT ON COLUMN gmail_notifications_log.processing_time_ms IS 'Time taken to process the notification in milliseconds';
COMMENT ON COLUMN gmail_notifications_log.subscription_name IS 'Name of the Pub/Sub subscription';
COMMENT ON COLUMN gmail_notifications_log.status IS 'Processing status: success, error, or pending';
COMMENT ON COLUMN gmail_notifications_log.error_message IS 'Error message if processing failed';
COMMENT ON COLUMN gmail_notifications_log.error_stack IS 'Full error stack trace if processing failed';