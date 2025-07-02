import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from './types';

let supabase: SupabaseClient<Database> | null = null;

/**
 * Get Supabase client instance (singleton pattern for serverless)
 */
export function getSupabase(): SupabaseClient<Database> {
  if (!supabase) {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase configuration. Please set up environment variables:');
      console.error('- NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co');
      console.error('- SUPABASE_SERVICE_ROLE_KEY=your_service_role_key');
      console.error('');
      console.error('Copy .env.example to .env.local and fill in your Supabase credentials');
      throw new Error('Missing Supabase configuration. Check console for setup instructions.');
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