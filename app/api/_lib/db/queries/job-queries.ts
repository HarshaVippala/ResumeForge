/**
 * Job-related database queries
 * Updated: 2025-01-07
 */

import { getSupabase, logActivity } from '../index';
import type { 
  Job, JobInsert, JobUpdate, JobStatus,
  ApplicationEvent, ApplicationEventInsert,
  FollowUp, FollowUpInsert
} from '../types';

/**
 * Get all jobs with optional filters
 */
export async function getJobs(filters?: {
  status?: JobStatus;
  isActive?: boolean;
  companyId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const db = getSupabase();
  
  let query = db.from('jobs').select(`
    *,
    company:companies(*),
    _count:application_events(count)
  `, { count: 'exact' });
  
  // Apply filters
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.isActive !== undefined) {
    query = query.eq('is_active', filters.isActive);
  }
  if (filters?.companyId) {
    query = query.eq('company_id', filters.companyId);
  }
  if (filters?.search) {
    query = query.or(`job_title.ilike.%${filters.search}%,company_name.ilike.%${filters.search}%`);
  }
  
  // Pagination
  if (filters?.limit) {
    query = query.limit(filters.limit);
  }
  if (filters?.offset) {
    query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
  }
  
  // Order by priority and date
  query = query.order('priority_score', { ascending: false })
    .order('discovered_at', { ascending: false });
  
  const { data, error, count } = await query;
  
  return { data, error, count };
}

/**
 * Get job application timeline
 */
export async function getJobTimeline(jobId: string) {
  const db = getSupabase();
  
  const { data, error } = await db
    .from('application_events')
    .select('*')
    .eq('job_id', jobId)
    .order('event_date', { ascending: false });
    
  return { data, error };
}

/**
 * Create application event
 */
export async function createApplicationEvent(event: ApplicationEventInsert) {
  const db = getSupabase();
  
  try {
    const { data, error } = await db
      .from('application_events')
      .insert(event)
      .select()
      .single();
      
    if (error) throw error;
    
    // Update job status based on event type
    const statusMap: Record<string, JobStatus> = {
      'applied': 'applied',
      'interview_scheduled': 'interviewing',
      'offer': 'accepted',
      'rejected': 'rejected',
      'withdrawn': 'withdrawn'
    };
    
    if (statusMap[event.event_type]) {
      await db.from('jobs')
        .update({ 
          status: statusMap[event.event_type],
          updated_at: new Date().toISOString()
        })
        .eq('id', event.job_id);
    }
    
    // Log activity
    await logActivity({
      event_type: 'application_event_created',
      entity_type: 'application_event',
      entity_id: data.id,
      description: `${event.event_type} event for job`,
      metadata: { job_id: event.job_id, event_type: event.event_type }
    });
    
    return { data, error: null };
  } catch (error) {
    console.error('Error creating application event:', error);
    return { data: null, error };
  }
}

/**
 * Get upcoming follow-ups
 */
export async function getUpcomingFollowUps(daysAhead: number = 7) {
  const db = getSupabase();
  
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);
  
  const { data, error } = await db
    .from('follow_ups')
    .select(`
      *,
      job:jobs(id, job_title, company_name),
      contact:contacts(name, email)
    `)
    .eq('status', 'pending')
    .lte('scheduled_date', futureDate.toISOString())
    .gte('scheduled_date', new Date().toISOString())
    .order('scheduled_date', { ascending: true });
    
  return { data, error };
}

/**
 * Create follow-up reminder
 */
export async function createFollowUp(followUp: FollowUpInsert) {
  const db = getSupabase();
  
  try {
    const { data, error } = await db
      .from('follow_ups')
      .insert(followUp)
      .select()
      .single();
      
    if (error) throw error;
    
    // Log activity
    await logActivity({
      event_type: 'follow_up_created',
      entity_type: 'follow_up',
      entity_id: data.id,
      description: `Scheduled ${followUp.follow_up_type || 'follow-up'} for ${followUp.scheduled_date}`,
      metadata: { job_id: followUp.job_id }
    });
    
    return { data, error: null };
  } catch (error) {
    console.error('Error creating follow-up:', error);
    return { data: null, error };
  }
}

/**
 * Bulk update job priorities based on criteria
 */
export async function updateJobPriorities(criteria: {
  hasDeadlineSoon?: boolean;
  hasRecentActivity?: boolean;
  matchScoreThreshold?: number;
}) {
  const db = getSupabase();
  
  try {
    // Get jobs to update
    let query = db.from('jobs').select('id, deadline, match_score, updated_at');
    
    if (criteria.hasDeadlineSoon) {
      const soon = new Date();
      soon.setDate(soon.getDate() + 7);
      query = query.lte('deadline', soon.toISOString());
    }
    
    const { data: jobs } = await query;
    if (!jobs || jobs.length === 0) return { updated: 0 };
    
    // Calculate new priorities
    const updates = jobs.map(job => {
      let priority = 5; // Base priority
      
      // Deadline approaching
      if (job.deadline) {
        const daysUntilDeadline = Math.floor(
          (new Date(job.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        if (daysUntilDeadline <= 3) priority += 3;
        else if (daysUntilDeadline <= 7) priority += 2;
        else if (daysUntilDeadline <= 14) priority += 1;
      }
      
      // Match score
      if (job.match_score) {
        if (job.match_score >= 0.9) priority += 2;
        else if (job.match_score >= 0.7) priority += 1;
      }
      
      return {
        id: job.id,
        priority_score: Math.min(priority, 10) // Cap at 10
      };
    });
    
    // Batch update
    for (const update of updates) {
      await db.from('jobs')
        .update({ priority_score: update.priority_score })
        .eq('id', update.id);
    }
    
    return { updated: updates.length };
  } catch (error) {
    console.error('Error updating job priorities:', error);
    return { updated: 0, error };
  }
}

/**
 * Get job statistics
 */
export async function getJobStats() {
  const db = getSupabase();
  
  try {
    // Get counts by status
    const { data: statusCounts } = await db
      .from('jobs')
      .select('status', { count: 'exact', head: true })
      .eq('is_active', true);
      
    // Get recent applications
    const { data: recentApps } = await db
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'applied')
      .gte('applied_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
      
    // Get upcoming interviews
    const { data: upcomingInterviews } = await db
      .from('application_events')
      .select('id', { count: 'exact', head: true })
      .eq('event_type', 'interview_scheduled')
      .gte('event_date', new Date().toISOString());
      
    return {
      totalActive: statusCounts?.count || 0,
      recentApplications: recentApps?.count || 0,
      upcomingInterviews: upcomingInterviews?.count || 0
    };
  } catch (error) {
    console.error('Error getting job stats:', error);
    return {
      totalActive: 0,
      recentApplications: 0,
      upcomingInterviews: 0
    };
  }
}