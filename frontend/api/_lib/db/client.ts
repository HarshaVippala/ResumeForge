import { getSupabase } from './index';

/**
 * Create Supabase client - compatibility wrapper for App Router
 * This provides the same interface as the old createClient for App Router routes
 */
export function createClient() {
  return getSupabase();
}

// Re-export everything from index for convenience
export * from './index';