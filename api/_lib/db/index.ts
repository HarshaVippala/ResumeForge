import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from './types';

let supabase: SupabaseClient<Database> | null = null;

/**
 * Get Supabase client instance (singleton pattern for serverless)
 */
export function getSupabase(): SupabaseClient<Database> {
  if (!supabase) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

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
    const { error } = await db.from('sessions').select('id').limit(1);
    return !error;
  } catch (error) {
    console.error('Database connection test failed:', error);
    return false;
  }
}