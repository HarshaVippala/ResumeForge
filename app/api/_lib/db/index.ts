import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { 
  Database,
  Job, JobInsert, JobUpdate,
  Resume, ResumeInsert, ResumeUpdate,
  ResumeSection, ResumeSectionInsert, ResumeSectionUpdate,
  Email, EmailInsert, EmailUpdate,
  Contact, ContactInsert, ContactUpdate,
  Company, CompanyInsert, CompanyUpdate,
  ActivityLog, ActivityLogInsert,
  ApplicationEvent, ApplicationEventInsert, ApplicationEventUpdate,
  FollowUp, FollowUpInsert, FollowUpUpdate,
  UserProfile, UserProfileUpdate,
  OAuthTokens, OAuthTokensInsert, OAuthTokensUpdate,
  JobStatus, EmailType, EventType, FollowUpStatus
} from './types';
import { getSupabaseUrl, getSupabaseAnonKey } from '../config/validate-env';

let supabase: SupabaseClient<Database> | null = null;

/**
 * Get Supabase client instance (singleton pattern for serverless)
 * Updated: 2025-01-07 - Enhanced with v2 schema support
 * Updated: 2025-01-09 - Fix service role key usage for RLS bypass
 */
export function getSupabase(): SupabaseClient<Database> {
  if (!supabase) {
    try {
      // Use new fallback logic for URL and key
      const supabaseUrl = getSupabaseUrl();
      // For service operations, prioritize service role key, fallback to anon key
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || getSupabaseAnonKey();

      // Log which key is being used (without exposing the actual key)
      if (process.env.NODE_ENV === 'development') {
        console.log('[Supabase] Using key type:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'service_role' : 'anon');
      }

      supabase = createClient<Database>(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: false, // Disable session persistence in serverless
          autoRefreshToken: false
        },
        db: {
          schema: 'public' // Using public schema (v2 tables are in public schema)
        }
      });
    } catch (error) {
      console.error('Missing Supabase configuration. Please set up environment variables:');
      console.error('Integration-provided (preferred):');
      console.error('- SUPABASE_URL=https://your-project.supabase.co');
      console.error('- SUPABASE_ANON_KEY=your_anon_key');
      console.error('- SUPABASE_SERVICE_ROLE_KEY=your_service_role_key');
      console.error('');
      console.error('Manual fallback:');
      console.error('- NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co');
      console.error('- NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key');
      console.error('- SUPABASE_SERVICE_ROLE_KEY=your_service_role_key');
      console.error('');
      console.error('Copy .env.example to .env.local and fill in your Supabase credentials');
      throw new Error(`Missing Supabase configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return supabase;
}

/**
 * Get Supabase client with service role key (for backend operations that need to bypass RLS)
 * Updated: 2025-01-09 - Added dedicated service client function
 */
export function getSupabaseServiceClient(): SupabaseClient<Database> {
  const supabaseUrl = getSupabaseUrl();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for service operations');
  }

  // Create a new client instance specifically for service operations
  // This ensures we always use the service role key when needed
  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    },
    db: {
      schema: 'public'
    }
  });
}

/**
 * Test database connection
 */
export async function testConnection(): Promise<boolean> {
  try {
    const db = getSupabase();
    // Test with v2 table first, fallback to legacy table
    const { error: v2Error } = await db.from('user_profile').select('id').limit(1);
    if (!v2Error) return true;
    
    // Fallback to legacy table for backward compatibility
    const { error } = await db.from('resume_sessions').select('id').limit(1);
    return !error;
  } catch (error) {
    console.error('Database connection test failed:', error);
    return false;
  }
}

// ==========================================
// JOB OPERATIONS
// ==========================================

/**
 * Create a new job with optional company and contact associations
 */
export async function createJob(
  job: JobInsert,
  options?: {
    companyId?: string;
    contactIds?: Array<{ contactId: string; role?: string }>;
  }
) {
  const db = getSupabase();
  
  try {
    // Insert job
    const { data: jobData, error: jobError } = await db
      .from('jobs')
      .insert(job)
      .select()
      .single();
      
    if (jobError) throw jobError;
    
    // Create job-contact relationships if provided
    if (options?.contactIds && options.contactIds.length > 0) {
      const jobContacts = options.contactIds.map(c => ({
        job_id: jobData.id,
        contact_id: c.contactId,
        role: c.role
      }));
      
      const { error: contactError } = await db
        .from('job_contacts')
        .insert(jobContacts);
        
      if (contactError) console.error('Error linking contacts:', contactError);
    }
    
    // Log activity
    await logActivity({
      event_type: 'job_created',
      entity_type: 'job',
      entity_id: jobData.id,
      description: `Created job: ${jobData.job_title} at ${jobData.company_name}`,
      metadata: { source: job.source || 'manual' }
    });
    
    return { data: jobData, error: null };
  } catch (error) {
    console.error('Error creating job:', error);
    return { data: null, error };
  }
}

/**
 * Get job with all related data
 */
export async function getJobWithRelations(jobId: string) {
  const db = getSupabase();
  
  try {
    // Get job with company
    const { data: job, error: jobError } = await db
      .from('jobs')
      .select(`
        *,
        company:companies(*),
        job_contacts(
          *,
          contact:contacts(*)
        ),
        resumes(id, name, version, ats_score),
        emails(id, subject, email_type, received_at),
        application_events(*),
        follow_ups(*)
      `)
      .eq('id', jobId)
      .single();
      
    if (jobError) throw jobError;
    
    return { data: job, error: null };
  } catch (error) {
    console.error('Error fetching job with relations:', error);
    return { data: null, error };
  }
}

/**
 * Update job status and log the transition
 */
export async function updateJobStatus(
  jobId: string, 
  status: JobStatus,
  metadata?: Record<string, any>
) {
  const db = getSupabase();
  
  try {
    // Get current status for logging
    const { data: currentJob } = await db
      .from('jobs')
      .select('status, job_title, company_name')
      .eq('id', jobId)
      .single();
    
    // Update job
    const { data, error } = await db
      .from('jobs')
      .update({ 
        status, 
        updated_at: new Date().toISOString(),
        ...(status === 'applied' && { applied_at: new Date().toISOString() })
      })
      .eq('id', jobId)
      .select()
      .single();
      
    if (error) throw error;
    
    // Log status change
    await logActivity({
      event_type: 'job_status_changed',
      entity_type: 'job',
      entity_id: jobId,
      description: `Status changed from ${currentJob?.status || 'unknown'} to ${status}`,
      metadata: {
        old_status: currentJob?.status,
        new_status: status,
        job_title: currentJob?.job_title,
        company: currentJob?.company_name,
        ...metadata
      }
    });
    
    return { data, error: null };
  } catch (error) {
    console.error('Error updating job status:', error);
    return { data: null, error };
  }
}

// ==========================================
// RESUME OPERATIONS
// ==========================================

/**
 * Create a new resume with sections
 */
export async function createResume(
  resume: ResumeInsert,
  sections?: ResumeSectionInsert[]
) {
  const db = getSupabase();
  
  try {
    // Insert resume
    const { data: resumeData, error: resumeError } = await db
      .from('resumes')
      .insert(resume)
      .select()
      .single();
      
    if (resumeError) throw resumeError;
    
    // Insert sections if provided
    if (sections && sections.length > 0) {
      const sectionsWithResumeId = sections.map(s => ({
        ...s,
        resume_id: resumeData.id
      }));
      
      const { error: sectionsError } = await db
        .from('resume_sections')
        .insert(sectionsWithResumeId);
        
      if (sectionsError) console.error('Error creating resume sections:', sectionsError);
    }
    
    // Log activity
    await logActivity({
      event_type: 'resume_created',
      entity_type: 'resume',
      entity_id: resumeData.id,
      description: `Created resume: ${resumeData.name}`,
      metadata: { 
        job_id: resume.job_id,
        is_master: resume.is_master || false
      }
    });
    
    return { data: resumeData, error: null };
  } catch (error) {
    console.error('Error creating resume:', error);
    return { data: null, error };
  }
}

/**
 * Get resume with all sections
 */
export async function getResumeWithSections(resumeId: string) {
  const db = getSupabase();
  
  try {
    const { data, error } = await db
      .from('resumes')
      .select(`
        *,
        resume_sections(*),
        job:jobs(*)
      `)
      .eq('id', resumeId)
      .single();
      
    if (error) throw error;
    
    // Sort sections by order_index
    if (data?.resume_sections) {
      data.resume_sections.sort((a, b) => a.order_index - b.order_index);
    }
    
    return { data, error: null };
  } catch (error) {
    console.error('Error fetching resume with sections:', error);
    return { data: null, error };
  }
}

// ==========================================
// EMAIL OPERATIONS
// ==========================================

/**
 * Create or update email with job linking
 */
export async function upsertEmail(
  email: EmailInsert,
  options?: {
    linkToJob?: boolean;
    jobMatchThreshold?: number;
  }
) {
  const db = getSupabase();
  
  try {
    // Check if email already exists
    const { data: existing } = await db
      .from('emails')
      .select('id, job_id')
      .eq('gmail_id', email.gmail_id)
      .single();
    
    if (existing) {
      // Update existing email
      const { data, error } = await db
        .from('emails')
        .update({
          ...email,
          id: existing.id // Preserve ID
        })
        .eq('id', existing.id)
        .select()
        .single();
        
      return { data, error, isNew: false };
    }
    
    // Insert new email
    const { data, error } = await db
      .from('emails')
      .insert(email)
      .select()
      .single();
      
    if (error) throw error;
    
    // Auto-link to job if requested and job-related
    if (options?.linkToJob && data.is_job_related && !data.job_id) {
      await attemptJobLinking(data.id, options.jobMatchThreshold || 0.7);
    }
    
    return { data, error: null, isNew: true };
  } catch (error) {
    console.error('Error upserting email:', error);
    return { data: null, error, isNew: false };
  }
}

/**
 * Link email to job
 */
export async function linkEmailToJob(emailId: string, jobId: string) {
  const db = getSupabase();
  
  try {
    const { data, error } = await db
      .from('emails')
      .update({ 
        job_id: jobId,
        job_confidence: 1.0 // Manual linking = 100% confidence
      })
      .eq('id', emailId)
      .select()
      .single();
      
    if (error) throw error;
    
    // Log activity
    await logActivity({
      event_type: 'email_linked_to_job',
      entity_type: 'email',
      entity_id: emailId,
      description: 'Email linked to job',
      metadata: { job_id: jobId }
    });
    
    return { data, error: null };
  } catch (error) {
    console.error('Error linking email to job:', error);
    return { data: null, error };
  }
}

// ==========================================
// CONTACT OPERATIONS
// ==========================================

/**
 * Create or update contact
 */
export async function upsertContact(contact: ContactInsert) {
  const db = getSupabase();
  
  try {
    // Check if contact exists by email
    if (contact.email) {
      const { data: existing } = await db
        .from('contacts')
        .select('id')
        .eq('email', contact.email)
        .single();
        
      if (existing) {
        // Update existing contact
        const { data, error } = await db
          .from('contacts')
          .update({
            ...contact,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id)
          .select()
          .single();
          
        return { data, error, isNew: false };
      }
    }
    
    // Insert new contact
    const { data, error } = await db
      .from('contacts')
      .insert(contact)
      .select()
      .single();
      
    return { data, error: null, isNew: true };
  } catch (error) {
    console.error('Error upserting contact:', error);
    return { data: null, error, isNew: false };
  }
}

// ==========================================
// ACTIVITY LOGGING
// ==========================================

/**
 * Log activity to activity_log table
 */
export async function logActivity(activity: ActivityLogInsert) {
  const db = getSupabase();
  
  try {
    const { error } = await db
      .from('activity_log')
      .insert({
        ...activity,
        source: activity.source || 'api',
        created_at: new Date().toISOString()
      });
      
    if (error) console.error('Error logging activity:', error);
  } catch (error) {
    console.error('Error in logActivity:', error);
  }
}

// ==========================================
// MIGRATION HELPERS
// ==========================================

/**
 * Check if v2 schema is available
 */
export async function checkV2SchemaAvailable(): Promise<boolean> {
  const db = getSupabase();
  
  try {
    // Try to query a v2-specific table
    const { error } = await db
      .from('user_profile')
      .select('id')
      .limit(1);
      
    return !error;
  } catch {
    return false;
  }
}

/**
 * Migrate job from legacy schema to v2
 */
export async function migrateJobToV2(legacyJobId: string): Promise<{ success: boolean; error?: any }> {
  const db = getSupabase();
  
  try {
    // Fetch legacy job
    const { data: legacyJob, error: fetchError } = await db
      .from('jobs')
      .select('*')
      .eq('id', legacyJobId)
      .single();
      
    if (fetchError || !legacyJob) {
      return { success: false, error: fetchError || 'Job not found' };
    }
    
    // Map legacy fields to v2 schema
    const v2Job: JobUpdate = {
      company_name: legacyJob.company || legacyJob.company_name,
      job_title: legacyJob.title || legacyJob.job_title,
      description: legacyJob.description,
      requirements: legacyJob.requirements,
      location: legacyJob.location,
      job_type: legacyJob.remote ? 'remote' : 'onsite',
      source_url: legacyJob.application_url || legacyJob.source_url,
      external_job_id: legacyJob.job_id || legacyJob.external_job_id,
      discovered_at: legacyJob.date_posted || legacyJob.scraped_at || legacyJob.created_at,
      keywords: legacyJob.skills || legacyJob.keywords,
      is_active: true,
      // Map salary fields
      salary_range: (legacyJob.salary_min && legacyJob.salary_max) 
        ? `${legacyJob.salary_currency || '$'}${legacyJob.salary_min}-${legacyJob.salary_max}`
        : legacyJob.salary_range
    };
    
    // Update job with v2 fields
    const { error: updateError } = await db
      .from('jobs')
      .update(v2Job)
      .eq('id', legacyJobId);
      
    if (updateError) {
      return { success: false, error: updateError };
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error migrating job to v2:', error);
    return { success: false, error };
  }
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Attempt to automatically link email to job based on content matching
 */
async function attemptJobLinking(emailId: string, threshold: number = 0.7) {
  const db = getSupabase();
  
  try {
    // Get email details
    const { data: email } = await db
      .from('emails')
      .select('subject, body_text, sender')
      .eq('id', emailId)
      .single();
      
    if (!email) return;
    
    // Search for matching jobs
    // This is a simplified version - in production you'd use more sophisticated matching
    const searchTerms = [
      email.subject,
      email.sender.split('@')[1]?.split('.')[0] // Extract company from email domain
    ].filter(Boolean).join(' ');
    
    const { data: jobs } = await db
      .from('jobs')
      .select('id, company_name, job_title')
      .or(`company_name.ilike.%${searchTerms}%,job_title.ilike.%${searchTerms}%`)
      .limit(5);
      
    if (jobs && jobs.length === 1) {
      // Single match - auto-link with confidence score
      await db
        .from('emails')
        .update({ 
          job_id: jobs[0].id,
          job_confidence: 0.8
        })
        .eq('id', emailId);
    }
  } catch (error) {
    console.error('Error in auto job linking:', error);
  }
}

// Export all types for convenience
export * from './types';