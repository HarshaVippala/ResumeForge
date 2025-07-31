-- Fix RLS policy for oauth_tokens table to allow personal use
-- This migration updates the policy to work without service role key

-- Drop existing policy
DROP POLICY IF EXISTS "Service role full access to oauth_tokens" ON public.oauth_tokens;

-- Create a more permissive policy for personal use
-- Since this is a personal app, we'll allow all operations
CREATE POLICY "Allow all operations on oauth_tokens" ON public.oauth_tokens
  FOR ALL USING (true) WITH CHECK (true);

-- Also fix the sync_metadata table RLS if needed
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON public.sync_metadata;

CREATE POLICY "Allow all operations on sync_metadata" ON public.sync_metadata
  FOR ALL USING (true) WITH CHECK (true);

-- Add a comment explaining the security model
COMMENT ON POLICY "Allow all operations on oauth_tokens" ON public.oauth_tokens IS 
  'This is a personal app, so RLS is relaxed. In production, use service role or add user-specific policies.';