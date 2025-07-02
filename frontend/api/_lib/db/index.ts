import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from './types';

let supabase: SupabaseClient<Database> | null = null;

/**
 * Get Supabase client instance (singleton pattern for serverless)
 */
export function getSupabase(): SupabaseClient<Database> {
  if (!supabase) {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }

    supabase = createClient<Database>(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false, // Disable session persistence in serverless
        autoRefreshToken: false
      }
    });
  }

  return supabase;
}

/**
 * Test database connection
 */
export async function testConnection(): Promise<boolean> {
  try {
    const db = getSupabase();
    const { error } = await db.from('resume_sessions').select('id').limit(1);
    return !error;
  } catch (error) {
    console.error('Database connection test failed:', error);
    return false;
  }
}