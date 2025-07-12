-- Fix RLS policy for sync_metadata table
-- This allows the service role key to insert OAuth tokens

-- First, ensure RLS is enabled on the table
ALTER TABLE sync_metadata ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies
DROP POLICY IF EXISTS "Allow all operations for service role" ON sync_metadata;
DROP POLICY IF EXISTS "Allow authenticated users to manage their own sync metadata" ON sync_metadata;

-- Create a policy that allows all operations when using the service role key
CREATE POLICY "Allow all operations for service role"
ON sync_metadata
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Create a policy for authenticated users (optional, for future use)
CREATE POLICY "Allow authenticated users to manage their own sync metadata"
ON sync_metadata
FOR ALL
TO authenticated
USING (auth.uid()::text = split_part(id, '_', 3))
WITH CHECK (auth.uid()::text = split_part(id, '_', 3));

-- For personal use app, also create a simple bypass policy
CREATE POLICY "Allow all operations for anon key"
ON sync_metadata
FOR ALL
TO anon
USING (true)
WITH CHECK (true);

-- Apply same policies to email_sync_state table
ALTER TABLE email_sync_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations for service role" ON email_sync_state;
DROP POLICY IF EXISTS "Allow all operations for anon key" ON email_sync_state;

CREATE POLICY "Allow all operations for service role"
ON email_sync_state
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow all operations for anon key"
ON email_sync_state
FOR ALL
TO anon
USING (true)
WITH CHECK (true);