/**
 * Database types - to be generated from Supabase
 * Run: npx supabase gen types typescript --project-id YOUR_PROJECT_ID > api/_lib/db/types.ts
 */

export interface Database {
  public: {
    Tables: {
      sessions: {
        Row: {
          id: string;
          company: string;
          role: string;
          job_description: string;
          analysis_data: any;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company: string;
          role: string;
          job_description: string;
          analysis_data: any;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company?: string;
          role?: string;
          job_description?: string;
          analysis_data?: any;
          created_at?: string;
          updated_at?: string;
        };
      };
      // Add other tables as needed
    };
    Views: {};
    Functions: {};
    Enums: {};
  };
}