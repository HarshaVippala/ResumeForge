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
      jobs: {
        Row: {
          id: string;
          job_id: string;
          title: string;
          company: string;
          location: string;
          remote: boolean;
          job_type: string;
          salary_min?: number;
          salary_max?: number;
          salary_currency: string;
          description: string;
          requirements?: string;
          benefits?: string;
          application_url: string;
          company_logo_url?: string;
          platform: string;
          date_posted: string;
          skills: string[];
          experience_level: string;
          scraped_at: string;
          is_saved?: boolean;
          saved_at?: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          job_id?: string;
          title: string;
          company: string;
          location?: string;
          remote?: boolean;
          job_type?: string;
          salary_min?: number;
          salary_max?: number;
          salary_currency?: string;
          description?: string;
          requirements?: string;
          benefits?: string;
          application_url?: string;
          company_logo_url?: string;
          platform?: string;
          date_posted?: string;
          skills?: string[];
          experience_level?: string;
          scraped_at?: string;
          is_saved?: boolean;
          saved_at?: string;
        };
        Update: {
          id?: string;
          job_id?: string;
          title?: string;
          company?: string;
          location?: string;
          remote?: boolean;
          job_type?: string;
          salary_min?: number;
          salary_max?: number;
          salary_currency?: string;
          description?: string;
          requirements?: string;
          benefits?: string;
          application_url?: string;
          company_logo_url?: string;
          platform?: string;
          date_posted?: string;
          skills?: string[];
          experience_level?: string;
          is_saved?: boolean;
          saved_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {};
    Functions: {
      get_top_companies: {
        Args: { limit_count: number };
        Returns: Array<{ company: string; job_count: number }>;
      };
      get_experience_distribution: {
        Args: {};
        Returns: Array<{ experience_level: string; count: number }>;
      };
    };
    Enums: {};
  };
}