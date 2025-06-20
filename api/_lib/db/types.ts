/**
 * Database types - to be generated from Supabase
 * Run: npx supabase gen types typescript --project-id YOUR_PROJECT_ID > api/_lib/db/types.ts
 * 
 * This is a comprehensive schema matching the Python implementation
 * TODO: Replace with auto-generated types once Supabase project is set up
 */

export interface Database {
  public: {
    Tables: {
      resume_sessions: {
        Row: {
          id: string;
          company: string;
          role: string;
          job_description: string;
          analysis_data: any;
          tailored_sections: any;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company: string;
          role: string;
          job_description: string;
          analysis_data?: any;
          tailored_sections?: any;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          company?: string;
          role?: string;
          job_description?: string;
          analysis_data?: any;
          tailored_sections?: any;
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
          search_vector?: any;
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
      saved_jobs: {
        Row: {
          id: string;
          job_id: string;
          user_id?: string;
          notes?: string;
          tags?: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          job_id: string;
          user_id?: string;
          notes?: string;
          tags?: string[];
          created_at?: string;
        };
        Update: {
          notes?: string;
          tags?: string[];
        };
      };
      job_applications: {
        Row: {
          id: string;
          job_id: string;
          status: 'applied' | 'interviewing' | 'offered' | 'rejected' | 'withdrawn';
          applied_date: string;
          notes?: string;
          resume_version?: string;
          cover_letter_version?: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          job_id: string;
          status?: 'applied' | 'interviewing' | 'offered' | 'rejected' | 'withdrawn';
          applied_date?: string;
          notes?: string;
          resume_version?: string;
          cover_letter_version?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: 'applied' | 'interviewing' | 'offered' | 'rejected' | 'withdrawn';
          applied_date?: string;
          notes?: string;
          resume_version?: string;
          cover_letter_version?: string;
          updated_at?: string;
        };
      };
      job_alerts: {
        Row: {
          id: string;
          keywords?: string[];
          companies?: string[];
          locations?: string[];
          min_salary?: number;
          experience_levels?: string[];
          job_types?: string[];
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          keywords?: string[];
          companies?: string[];
          locations?: string[];
          min_salary?: number;
          experience_levels?: string[];
          job_types?: string[];
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          keywords?: string[];
          companies?: string[];
          locations?: string[];
          min_salary?: number;
          experience_levels?: string[];
          job_types?: string[];
          is_active?: boolean;
          updated_at?: string;
        };
      };
      resume_library: {
        Row: {
          id: string;
          name: string;
          content: any;
          version: string;
          is_master: boolean;
          tags?: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          content: any;
          version?: string;
          is_master?: boolean;
          tags?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          content?: any;
          version?: string;
          is_master?: boolean;
          tags?: string[];
          updated_at?: string;
        };
      };
      section_versions: {
        Row: {
          id: string;
          session_id: string;
          section_type: string;
          content: string;
          version: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          section_type: string;
          content: string;
          version?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          content?: string;
          version?: number;
          is_active?: boolean;
        };
      };
      sync_metadata: {
        Row: {
          id: string;
          sync_type: string;
          last_sync_time: string;
          sync_state: any;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          sync_type: string;
          last_sync_time?: string;
          sync_state?: any;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          last_sync_time?: string;
          sync_state?: any;
          updated_at?: string;
        };
      };
      email_communications: {
        Row: {
          id: string;
          sender: string;
          recipient: string;
          subject: string;
          body?: string;
          date_sent: string;
          is_processed: boolean;
          job_id?: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          sender: string;
          recipient: string;
          subject: string;
          body?: string;
          date_sent: string;
          is_processed?: boolean;
          job_id?: string;
          created_at?: string;
        };
        Update: {
          is_processed?: boolean;
          job_id?: string;
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
      search_jobs: {
        Args: { search_query: string };
        Returns: Array<Database['public']['Tables']['jobs']['Row']>;
      };
    };
    Enums: {
      application_status: 'applied' | 'interviewing' | 'offered' | 'rejected' | 'withdrawn';
      job_type: 'full-time' | 'part-time' | 'contract' | 'internship' | 'freelance';
      experience_level: 'entry' | 'mid' | 'senior' | 'lead' | 'executive';
    };
  };
}