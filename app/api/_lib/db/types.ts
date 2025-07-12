/**
 * Database types for Supabase integration - v2.0
 * 
 * This schema defines the complete database structure for ResumeForge.
 * Updated: 2025-01-07 - Aligned with complete schema reset migration
 * 
 * Auto-generation command: npx supabase gen types typescript --project-id YOUR_PROJECT_ID > api/_lib/db/types.ts
 */

// ==========================================
// ENUM TYPES
// ==========================================

export type CompanySize = 'startup' | 'small' | 'medium' | 'large' | 'enterprise';
export type ContactType = 'recruiter' | 'employee' | 'hiring_manager' | 'referral';
export type RelationshipStrength = 'cold' | 'warm' | 'strong';
export type JobType = 'remote' | 'hybrid' | 'onsite';
export type JobSource = 'manual' | 'email' | 'scraper' | 'api' | 'referral';
export type JobStatus = 'interested' | 'applied' | 'interviewing' | 'rejected' | 'accepted' | 'withdrawn';
export type FocusArea = 'backend' | 'frontend' | 'fullstack' | 'devops' | 'data' | 'mobile';
export type FileType = 'pdf' | 'docx';
export type EmailType = 'application_confirmation' | 'recruiter_outreach' | 'interview_request' | 'rejection' | 'offer' | 'general';
export type EventType = 'applied' | 'acknowledged' | 'screening' | 'interview_scheduled' | 'interview_completed' | 'assessment' | 'reference_check' | 'offer' | 'negotiation' | 'accepted' | 'rejected' | 'withdrawn';
export type InterviewType = 'phone_screen' | 'technical' | 'behavioral' | 'system_design' | 'cultural_fit' | 'executive';
export type EventOutcome = 'passed' | 'failed' | 'pending' | 'cancelled';
export type FollowUpType = 'thank_you' | 'status_check' | 'networking' | 'reference_request' | 'offer_response';
export type FollowUpStatus = 'pending' | 'completed' | 'cancelled' | 'overdue';
export type ResumeSectionType = 'contact' | 'summary' | 'experience' | 'education' | 'skills' | 'projects' | 'custom';

// ==========================================
// JSONB INTERFACES
// ==========================================

export interface ContactInfo {
  phone?: string;
  email?: string;
  linkedin?: string;
  github?: string;
  location?: string;
}

export interface DefaultResumeData {
  contact?: ContactInfo;
  summary?: string;
  skills?: string[];
}

export interface UserPreferences {
  theme?: 'light' | 'dark' | 'system';
  emailSyncEnabled?: boolean;
  notificationSettings?: {
    email?: boolean;
    browser?: boolean;
    applicationDeadlines?: boolean;
    interviewReminders?: boolean;
  };
}

export interface SalaryData {
  [role: string]: {
    min: number;
    max: number;
    currency: string;
  };
}

export interface AttachmentInfo {
  filename: string;
  mimeType: string;
  size: number;
  gmail_attachment_id?: string;
  downloaded_url?: string;
  is_resume?: boolean;
  extracted_text?: string;
}

export interface KeywordDensity {
  [keyword: string]: {
    count: number;
    percentage: number;
  };
}

export interface PerformanceMetrics {
  response_rate?: number;
  interview_rate?: number;
  offer_rate?: number;
  avg_response_days?: number;
}

export interface ResumeContent {
  contact: ContactInfo;
  summary: string;
  experience: Array<{
    company: string;
    title: string;
    dates: string;
    location?: string;
    bullets: string[];
  }>;
  education: Array<{
    school: string;
    degree: string;
    field?: string;
    dates: string;
    gpa?: string;
    achievements?: string[];
  }>;
  skills: {
    categories?: Array<{
      name: string;
      items: string[];
    }>;
    all?: string[];
  };
  projects?: Array<{
    name: string;
    description: string;
    technologies: string[];
    bullets: string[];
    link?: string;
  }>;
}

export interface ResumeSectionContent {
  [key: string]: any; // Flexible content structure based on section_type
}

export interface ActivityMetadata {
  [key: string]: any; // Event-specific metadata
}

// ==========================================
// DATABASE SCHEMA v2
// ==========================================

export interface Database {
  public: {
    Tables: {
      // 1. User Profile
      user_profile: {
        Row: {
          id: string;
          email: string;
          name: string | null;
          default_resume_data: DefaultResumeData | null;
          preferences: UserPreferences | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          name?: string | null;
          default_resume_data?: DefaultResumeData | null;
          preferences?: UserPreferences | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          email?: string;
          name?: string | null;
          default_resume_data?: DefaultResumeData | null;
          preferences?: UserPreferences | null;
          updated_at?: string;
        };
      };

      // 2. Auth Credentials
      auth_credentials: {
        Row: {
          id: string;
          user_id: string;
          credential_id: string;
          public_key: string; // BYTEA stored as base64 string
          sign_count: number;
          transports: string[] | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          credential_id: string;
          public_key: string;
          sign_count?: number;
          transports?: string[] | null;
          created_at?: string;
        };
        Update: {
          sign_count?: number;
          transports?: string[] | null;
        };
      };

      // 3. OAuth Tokens
      // Last modified: 2025-01-09 - Updated to match new JSONB schema
      oauth_tokens: {
        Row: {
          id: string;
          user_id: string;
          provider: 'gmail';
          encrypted_tokens: any; // JSONB - contains encrypted_data, iv, auth_tag, salt
          email_address: string;
          email_hash: string;
          scopes: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          provider?: 'gmail';
          encrypted_tokens: any; // JSONB
          email_address: string;
          email_hash: string;
          scopes: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          encrypted_tokens?: any; // JSONB
          email_address?: string;
          email_hash?: string;
          scopes?: string[];
          updated_at?: string;
        };
      };

      // 4. Companies
      companies: {
        Row: {
          id: string;
          name: string;
          website: string | null;
          linkedin_url: string | null;
          glassdoor_url: string | null;
          industry: string | null;
          size: CompanySize | null;
          location: string | null;
          culture_notes: string | null;
          interview_process_notes: string | null;
          salary_data: SalaryData | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          website?: string | null;
          linkedin_url?: string | null;
          glassdoor_url?: string | null;
          industry?: string | null;
          size?: CompanySize | null;
          location?: string | null;
          culture_notes?: string | null;
          interview_process_notes?: string | null;
          salary_data?: SalaryData | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          website?: string | null;
          linkedin_url?: string | null;
          glassdoor_url?: string | null;
          industry?: string | null;
          size?: CompanySize | null;
          location?: string | null;
          culture_notes?: string | null;
          interview_process_notes?: string | null;
          salary_data?: SalaryData | null;
          updated_at?: string;
        };
      };

      // 5. Contacts
      contacts: {
        Row: {
          id: string;
          name: string;
          email: string | null;
          phone: string | null;
          linkedin_url: string | null;
          current_company_id: string | null;
          current_title: string | null;
          contact_type: ContactType | null;
          relationship_strength: RelationshipStrength | null;
          last_contacted: string | null;
          notes: string | null;
          tags: string[] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          email?: string | null;
          phone?: string | null;
          linkedin_url?: string | null;
          current_company_id?: string | null;
          current_title?: string | null;
          contact_type?: ContactType | null;
          relationship_strength?: RelationshipStrength | null;
          last_contacted?: string | null;
          notes?: string | null;
          tags?: string[] | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          email?: string | null;
          phone?: string | null;
          linkedin_url?: string | null;
          current_company_id?: string | null;
          current_title?: string | null;
          contact_type?: ContactType | null;
          relationship_strength?: RelationshipStrength | null;
          last_contacted?: string | null;
          notes?: string | null;
          tags?: string[] | null;
          updated_at?: string;
        };
      };

      // 6. Jobs (enhanced version of legacy jobs table)
      jobs: {
        Row: {
          id: string;
          company_id: string | null;
          company_name: string;
          job_title: string;
          description: string | null;
          requirements: string | null;
          location: string | null;
          salary_range: string | null;
          job_type: JobType | null;
          source: JobSource | null;
          source_url: string | null;
          external_job_id: string | null;
          discovered_at: string;
          status: JobStatus | null;
          applied_at: string | null;
          applied_resume_id: string | null;
          keywords: string[] | null;
          match_score: number | null; // 0.00 to 1.00
          priority_score: number | null; // 1-10
          notes: string | null;
          is_active: boolean;
          deadline: string | null;
          last_checked: string | null;
          created_at: string;
          updated_at: string;
          // Legacy fields for compatibility
          job_id?: string;
          title?: string;
          company?: string;
          remote?: boolean;
          salary_min?: number;
          salary_max?: number;
          salary_currency?: string;
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
          search_vector?: any;
        };
        Insert: {
          id?: string;
          company_id?: string | null;
          company_name: string;
          job_title: string;
          description?: string | null;
          requirements?: string | null;
          location?: string | null;
          salary_range?: string | null;
          job_type?: JobType | null;
          source?: JobSource | null;
          source_url?: string | null;
          external_job_id?: string | null;
          discovered_at?: string;
          status?: JobStatus | null;
          applied_at?: string | null;
          applied_resume_id?: string | null;
          keywords?: string[] | null;
          match_score?: number | null;
          priority_score?: number | null;
          notes?: string | null;
          is_active?: boolean;
          deadline?: string | null;
          last_checked?: string | null;
          created_at?: string;
          updated_at?: string;
          // Legacy fields
          job_id?: string;
          title?: string;
          company?: string;
          remote?: boolean;
          salary_min?: number;
          salary_max?: number;
          salary_currency?: string;
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
          company_id?: string | null;
          company_name?: string;
          job_title?: string;
          description?: string | null;
          requirements?: string | null;
          location?: string | null;
          salary_range?: string | null;
          job_type?: JobType | null;
          source?: JobSource | null;
          source_url?: string | null;
          external_job_id?: string | null;
          status?: JobStatus | null;
          applied_at?: string | null;
          applied_resume_id?: string | null;
          keywords?: string[] | null;
          match_score?: number | null;
          priority_score?: number | null;
          notes?: string | null;
          is_active?: boolean;
          deadline?: string | null;
          last_checked?: string | null;
          updated_at?: string;
          // Legacy fields
          job_id?: string;
          title?: string;
          company?: string;
          remote?: boolean;
          salary_min?: number;
          salary_max?: number;
          salary_currency?: string;
          benefits?: string;
          application_url?: string;
          company_logo_url?: string;
          platform?: string;
          date_posted?: string;
          skills?: string[];
          experience_level?: string;
          is_saved?: boolean;
          saved_at?: string;
        };
      };

      // 7. Job Contacts (Junction Table)
      job_contacts: {
        Row: {
          job_id: string;
          contact_id: string;
          role: 'recruiter' | 'referral' | 'interviewer' | 'hiring_manager' | null;
        };
        Insert: {
          job_id: string;
          contact_id: string;
          role?: 'recruiter' | 'referral' | 'interviewer' | 'hiring_manager' | null;
        };
        Update: {
          role?: 'recruiter' | 'referral' | 'interviewer' | 'hiring_manager' | null;
        };
      };

      // 8. Resumes
      resumes: {
        Row: {
          id: string;
          name: string;
          job_id: string | null;
          content: ResumeContent;
          main_skills: string[];
          tech_stack: string[];
          focus_area: FocusArea | null;
          tailoring_notes: string | null;
          ats_score: number | null; // 0.00 to 1.00
          keyword_density: KeywordDensity | null;
          version: number;
          parent_version_id: string | null;
          is_master: boolean;
          file_url: string | null;
          file_type: FileType | null;
          file_hash: string | null;
          submission_count: number;
          last_submitted_at: string | null;
          performance_metrics: PerformanceMetrics | null;
          is_active: boolean;
          tags: string[] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          job_id?: string | null;
          content: ResumeContent;
          main_skills: string[];
          tech_stack: string[];
          focus_area?: FocusArea | null;
          tailoring_notes?: string | null;
          ats_score?: number | null;
          keyword_density?: KeywordDensity | null;
          version?: number;
          parent_version_id?: string | null;
          is_master?: boolean;
          file_url?: string | null;
          file_type?: FileType | null;
          file_hash?: string | null;
          submission_count?: number;
          last_submitted_at?: string | null;
          performance_metrics?: PerformanceMetrics | null;
          is_active?: boolean;
          tags?: string[] | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          job_id?: string | null;
          content?: ResumeContent;
          main_skills?: string[];
          tech_stack?: string[];
          focus_area?: FocusArea | null;
          tailoring_notes?: string | null;
          ats_score?: number | null;
          keyword_density?: KeywordDensity | null;
          version?: number;
          parent_version_id?: string | null;
          is_master?: boolean;
          file_url?: string | null;
          file_type?: FileType | null;
          file_hash?: string | null;
          submission_count?: number;
          last_submitted_at?: string | null;
          performance_metrics?: PerformanceMetrics | null;
          is_active?: boolean;
          tags?: string[] | null;
          updated_at?: string;
        };
      };

      // 9. Resume Sections
      resume_sections: {
        Row: {
          id: string;
          resume_id: string;
          section_type: ResumeSectionType;
          section_name: string;
          content: ResumeSectionContent;
          order_index: number;
          is_visible: boolean;
          ai_generated: boolean;
          generation_prompt: string | null;
          confidence_score: number | null; // 0.00 to 1.00
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          resume_id: string;
          section_type: ResumeSectionType;
          section_name: string;
          content: ResumeSectionContent;
          order_index: number;
          is_visible?: boolean;
          ai_generated?: boolean;
          generation_prompt?: string | null;
          confidence_score?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          section_type?: ResumeSectionType;
          section_name?: string;
          content?: ResumeSectionContent;
          order_index?: number;
          is_visible?: boolean;
          ai_generated?: boolean;
          generation_prompt?: string | null;
          confidence_score?: number | null;
          updated_at?: string;
        };
      };

      // 10. Emails (enhanced email_communications)
      emails: {
        Row: {
          id: string;
          gmail_id: string;
          thread_id: string;
          subject: string | null;
          sender: string;
          recipients: string[] | null;
          received_at: string | null;
          body_text: string | null;
          body_html: string | null;
          has_attachments: boolean;
          attachments: AttachmentInfo[] | null;
          job_id: string | null;
          is_job_related: boolean;
          job_confidence: number | null; // 0.0 to 1.0
          email_type: EmailType | null;
          classification_confidence: number | null;
          thread_position: number | null;
          is_thread_root: boolean;
          thread_summary: string | null;
          ai_processed: boolean;
          processing_version: string | null;
          requires_action: boolean;
          action_deadline: string | null;
          labels: string[] | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          gmail_id: string;
          thread_id: string;
          subject?: string | null;
          sender: string;
          recipients?: string[] | null;
          received_at?: string | null;
          body_text?: string | null;
          body_html?: string | null;
          has_attachments?: boolean;
          attachments?: AttachmentInfo[] | null;
          job_id?: string | null;
          is_job_related?: boolean;
          job_confidence?: number | null;
          email_type?: EmailType | null;
          classification_confidence?: number | null;
          thread_position?: number | null;
          is_thread_root?: boolean;
          thread_summary?: string | null;
          ai_processed?: boolean;
          processing_version?: string | null;
          requires_action?: boolean;
          action_deadline?: string | null;
          labels?: string[] | null;
          created_at?: string;
        };
        Update: {
          subject?: string | null;
          body_text?: string | null;
          body_html?: string | null;
          has_attachments?: boolean;
          attachments?: AttachmentInfo[] | null;
          job_id?: string | null;
          is_job_related?: boolean;
          job_confidence?: number | null;
          email_type?: EmailType | null;
          classification_confidence?: number | null;
          thread_position?: number | null;
          is_thread_root?: boolean;
          thread_summary?: string | null;
          ai_processed?: boolean;
          processing_version?: string | null;
          requires_action?: boolean;
          action_deadline?: string | null;
          labels?: string[] | null;
        };
      };

      // 11. Activity Log
      activity_log: {
        Row: {
          id: string;
          event_type: string;
          entity_type: string | null;
          entity_id: string | null;
          description: string | null;
          metadata: ActivityMetadata | null;
          source: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_type: string;
          entity_type?: string | null;
          entity_id?: string | null;
          description?: string | null;
          metadata?: ActivityMetadata | null;
          source?: string;
          created_at?: string;
        };
        Update: {
          // Activity log entries are immutable
        };
      };

      // 12. Application Events
      application_events: {
        Row: {
          id: string;
          job_id: string;
          event_type: EventType;
          event_date: string;
          title: string | null;
          description: string | null;
          location: string | null;
          duration_minutes: number | null;
          contact_name: string | null;
          contact_email: string | null;
          contact_role: string | null;
          interview_type: InterviewType | null;
          interviewers: string[] | null;
          preparation_notes: string | null;
          feedback: string | null;
          outcome: EventOutcome | null;
          next_steps: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          job_id: string;
          event_type: EventType;
          event_date: string;
          title?: string | null;
          description?: string | null;
          location?: string | null;
          duration_minutes?: number | null;
          contact_name?: string | null;
          contact_email?: string | null;
          contact_role?: string | null;
          interview_type?: InterviewType | null;
          interviewers?: string[] | null;
          preparation_notes?: string | null;
          feedback?: string | null;
          outcome?: EventOutcome | null;
          next_steps?: string | null;
          created_at?: string;
        };
        Update: {
          event_type?: EventType;
          event_date?: string;
          title?: string | null;
          description?: string | null;
          location?: string | null;
          duration_minutes?: number | null;
          contact_name?: string | null;
          contact_email?: string | null;
          contact_role?: string | null;
          interview_type?: InterviewType | null;
          interviewers?: string[] | null;
          preparation_notes?: string | null;
          feedback?: string | null;
          outcome?: EventOutcome | null;
          next_steps?: string | null;
        };
      };

      // 13. Follow Ups
      follow_ups: {
        Row: {
          id: string;
          job_id: string;
          contact_id: string | null;
          follow_up_type: FollowUpType | null;
          scheduled_date: string;
          completed_date: string | null;
          status: FollowUpStatus;
          subject: string | null;
          message_template: string | null;
          actual_message: string | null;
          auto_send: boolean;
          reminder_sent: boolean;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          job_id: string;
          contact_id?: string | null;
          follow_up_type?: FollowUpType | null;
          scheduled_date: string;
          completed_date?: string | null;
          status?: FollowUpStatus;
          subject?: string | null;
          message_template?: string | null;
          actual_message?: string | null;
          auto_send?: boolean;
          reminder_sent?: boolean;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          contact_id?: string | null;
          follow_up_type?: FollowUpType | null;
          scheduled_date?: string;
          completed_date?: string | null;
          status?: FollowUpStatus;
          subject?: string | null;
          message_template?: string | null;
          actual_message?: string | null;
          auto_send?: boolean;
          reminder_sent?: boolean;
          notes?: string | null;
        };
      };

      // ==========================================
      // LEGACY TABLES (REMOVED IN v2)
      // ==========================================
      /**
       * @deprecated These legacy tables have been removed in the v2 schema.
       * Types are kept temporarily for migration reference only.
       */
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
      /** @deprecated Merged into jobs table in v2 */
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
          thread_id: string;
          gmail_id: string;
          subject: string;
          sender: string;
          sender_name?: string;
          sender_email: string;
          recipient: string;
          body?: string;
          body_text?: string;
          body_html?: string;
          received_at: string;
          date?: string;
          is_unread: boolean;
          status: 'read' | 'unread';
          is_job_related: boolean;
          is_processed: boolean;
          ai_processed: boolean;
          
          // AI Analysis Results
          email_type?: 'recruiter' | 'interview' | 'offer' | 'rejection' | 'follow_up' | 'application' | 'general';
          company?: string;
          position?: string;
          summary?: string;
          action_required?: boolean;
          priority?: 'low' | 'medium' | 'high' | 'critical';
          
          // Enhanced Extracted Details (JSON)
          extracted_details?: any; // EmailExtractedDetails
          
          // Normalized Data
          normalized_company?: string;
          normalized_position?: string;
          
          // Metadata
          labels: string[];
          attachments: any[]; // Array of attachment objects
          job_opportunities: any[];
          tags?: string[];
          
          // Timestamps
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          thread_id: string;
          gmail_id: string;
          subject: string;
          sender: string;
          sender_name?: string;
          sender_email: string;
          recipient: string;
          body?: string;
          body_text?: string;
          body_html?: string;
          received_at: string;
          date?: string;
          is_unread?: boolean;
          status?: 'read' | 'unread';
          is_job_related?: boolean;
          is_processed?: boolean;
          ai_processed?: boolean;
          
          // AI Analysis Results
          email_type?: 'recruiter' | 'interview' | 'offer' | 'rejection' | 'follow_up' | 'application' | 'general';
          company?: string;
          position?: string;
          summary?: string;
          action_required?: boolean;
          priority?: 'low' | 'medium' | 'high' | 'critical';
          
          // Enhanced Extracted Details (JSON)
          extracted_details?: any;
          
          // Normalized Data
          normalized_company?: string;
          normalized_position?: string;
          
          // Metadata
          labels?: string[];
          attachments?: any[];
          job_opportunities?: any[];
          tags?: string[];
          
          // Timestamps
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          subject?: string;
          body?: string;
          body_text?: string;
          body_html?: string;
          is_unread?: boolean;
          status?: 'read' | 'unread';
          is_job_related?: boolean;
          is_processed?: boolean;
          ai_processed?: boolean;
          
          // AI Analysis Results
          email_type?: 'recruiter' | 'interview' | 'offer' | 'rejection' | 'follow_up' | 'application' | 'general';
          company?: string;
          position?: string;
          summary?: string;
          action_required?: boolean;
          priority?: 'low' | 'medium' | 'high' | 'critical';
          
          // Enhanced Extracted Details (JSON)
          extracted_details?: any;
          
          // Normalized Data
          normalized_company?: string;
          normalized_position?: string;
          
          // Metadata
          labels?: string[];
          attachments?: any[];
          job_opportunities?: any[];
          tags?: string[];
          
          // Timestamps
          updated_at?: string;
        };
      };
      user_credentials: {
        Row: {
          id: string;
          credential_id: string;
          public_key: string;
          counter: number;
          device_name: string;
          created_at: string;
          last_used?: string;
        };
        Insert: {
          id?: string;
          credential_id: string;
          public_key: string;
          counter: number;
          device_name: string;
          created_at?: string;
          last_used?: string;
        };
        Update: {
          counter?: number;
          device_name?: string;
          last_used?: string;
        };
      };
    };
    Views: {
      // Performance analytics view
      resume_performance: {
        Row: {
          id: string;
          name: string;
          focus_area: FocusArea | null;
          main_skills: string[];
          applications_count: number;
          positive_outcomes: number;
          success_rate: number;
          last_used: string | null;
        };
      };
      // Application funnel metrics
      application_funnel: {
        Row: {
          month: string;
          total_applications: number;
          interviews: number;
          offers: number;
          rejections: number;
          avg_response_days: number;
        };
      };
      // Email response time analytics
      email_response_metrics: {
        Row: {
          thread_id: string;
          avg_response_hours: number;
          message_count: number;
        };
      };
    };
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
      // Helper function to get next version for section
      get_next_section_version: {
        Args: { session_id: string; section_type: string };
        Returns: number;
      };
    };
    Enums: {
      // Legacy enums for backward compatibility
      /** @deprecated Use JobStatus type instead */
      application_status: 'applied' | 'interviewing' | 'offered' | 'rejected' | 'withdrawn';
      /** @deprecated Use specific string literals instead */
      job_type: 'full-time' | 'part-time' | 'contract' | 'internship' | 'freelance';
      /** @deprecated Use ExperienceLevel type instead */
      experience_level: 'entry' | 'mid' | 'senior' | 'lead' | 'executive';
    };
  };
}

// ==========================================
// TYPE EXPORTS FOR CONVENIENCE
// ==========================================

// Table Row Types
export type UserProfile = Database['public']['Tables']['user_profile']['Row'];
export type AuthCredentials = Database['public']['Tables']['auth_credentials']['Row'];
export type OAuthTokens = Database['public']['Tables']['oauth_tokens']['Row'];
export type Company = Database['public']['Tables']['companies']['Row'];
export type Contact = Database['public']['Tables']['contacts']['Row'];
export type Job = Database['public']['Tables']['jobs']['Row'];
export type JobContact = Database['public']['Tables']['job_contacts']['Row'];
export type Resume = Database['public']['Tables']['resumes']['Row'];
export type ResumeSection = Database['public']['Tables']['resume_sections']['Row'];
export type Email = Database['public']['Tables']['emails']['Row'];
export type ActivityLog = Database['public']['Tables']['activity_log']['Row'];
export type ApplicationEvent = Database['public']['Tables']['application_events']['Row'];
export type FollowUp = Database['public']['Tables']['follow_ups']['Row'];

// Insert Types
export type UserProfileInsert = Database['public']['Tables']['user_profile']['Insert'];
export type AuthCredentialsInsert = Database['public']['Tables']['auth_credentials']['Insert'];
export type OAuthTokensInsert = Database['public']['Tables']['oauth_tokens']['Insert'];
export type CompanyInsert = Database['public']['Tables']['companies']['Insert'];
export type ContactInsert = Database['public']['Tables']['contacts']['Insert'];
export type JobInsert = Database['public']['Tables']['jobs']['Insert'];
export type JobContactInsert = Database['public']['Tables']['job_contacts']['Insert'];
export type ResumeInsert = Database['public']['Tables']['resumes']['Insert'];
export type ResumeSectionInsert = Database['public']['Tables']['resume_sections']['Insert'];
export type EmailInsert = Database['public']['Tables']['emails']['Insert'];
export type ActivityLogInsert = Database['public']['Tables']['activity_log']['Insert'];
export type ApplicationEventInsert = Database['public']['Tables']['application_events']['Insert'];
export type FollowUpInsert = Database['public']['Tables']['follow_ups']['Insert'];

// Update Types
export type UserProfileUpdate = Database['public']['Tables']['user_profile']['Update'];
export type AuthCredentialsUpdate = Database['public']['Tables']['auth_credentials']['Update'];
export type OAuthTokensUpdate = Database['public']['Tables']['oauth_tokens']['Update'];
export type CompanyUpdate = Database['public']['Tables']['companies']['Update'];
export type ContactUpdate = Database['public']['Tables']['contacts']['Update'];
export type JobUpdate = Database['public']['Tables']['jobs']['Update'];
export type JobContactUpdate = Database['public']['Tables']['job_contacts']['Update'];
export type ResumeUpdate = Database['public']['Tables']['resumes']['Update'];
export type ResumeSectionUpdate = Database['public']['Tables']['resume_sections']['Update'];
export type EmailUpdate = Database['public']['Tables']['emails']['Update'];
export type ApplicationEventUpdate = Database['public']['Tables']['application_events']['Update'];
export type FollowUpUpdate = Database['public']['Tables']['follow_ups']['Update'];

// ==========================================
// BACKWARD COMPATIBILITY
// ==========================================

// Alias for backward compatibility
export type ApplicationStatus = JobStatus;
export type ExperienceLevel = 'entry' | 'mid' | 'senior' | 'lead' | 'executive';

// Legacy email interface for compatibility with existing code
export interface EmailExtractedDetails {
  company?: string;
  position?: string;
  salary?: {
    min?: number;
    max?: number;
    currency?: string;
  };
  location?: string;
  workType?: 'remote' | 'hybrid' | 'onsite';
  applicationDeadline?: string;
  interviewDate?: string;
  contactInfo?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  nextSteps?: string[];
  requirements?: string[];
  benefits?: string[];
}

// Legacy type aliases for backward compatibility
/** @deprecated Use Job instead */
export type SavedJob = Job;
/** @deprecated Use Resume instead */
export type ResumeLibrary = Resume;
/** @deprecated Merged into Job table */
export type JobApplication = {
  id: string;
  job_id: string;
  status: JobStatus;
  applied_date: string;
  notes?: string;
  resume_version?: string;
  cover_letter_version?: string;
  created_at: string;
  updated_at: string;
};
/** @deprecated Use UserProfile instead */
export type UserCredentials = AuthCredentials;
/** @deprecated Use Email instead */
export type EmailCommunication = Email;

// ==========================================
// MIGRATION NOTES
// ==========================================
/**
 * This types file is fully aligned with the database schema created by:
 * - 20250107_complete_schema_reset.sql
 * 
 * All tables use the public schema (not resumeforge_v2).
 * Legacy tables have been removed from the database but types 
 * are temporarily kept for migration reference.
 * 
 * Next steps:
 * 1. Remove legacy table types after confirming no code dependencies
 * 2. Run supabase gen types to auto-generate from live database
 * 3. Update any remaining code references to use new table names
 */