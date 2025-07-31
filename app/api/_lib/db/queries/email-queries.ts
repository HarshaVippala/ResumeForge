/**
 * Email-related database queries
 * Updated: 2025-01-07
 */

import { getSupabase, logActivity } from '../index';
import type { 
  Email, EmailInsert, EmailUpdate, EmailType
} from '../types';

/**
 * Get emails with optional filters
 */
export async function getEmails(filters?: {
  jobId?: string;
  isJobRelated?: boolean;
  emailType?: EmailType;
  requiresAction?: boolean;
  threadId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const db = getSupabase();
  
  let query = db.from('emails').select(`
    *,
    job:jobs(id, job_title, company_name)
  `, { count: 'exact' });
  
  // Apply filters
  if (filters?.jobId) {
    query = query.eq('job_id', filters.jobId);
  }
  if (filters?.isJobRelated !== undefined) {
    query = query.eq('is_job_related', filters.isJobRelated);
  }
  if (filters?.emailType) {
    query = query.eq('email_type', filters.emailType);
  }
  if (filters?.requiresAction !== undefined) {
    query = query.eq('requires_action', filters.requiresAction);
  }
  if (filters?.threadId) {
    query = query.eq('thread_id', filters.threadId);
  }
  if (filters?.search) {
    query = query.or(`subject.ilike.%${filters.search}%,sender.ilike.%${filters.search}%,body_text.ilike.%${filters.search}%`);
  }
  
  // Pagination
  if (filters?.limit) {
    query = query.limit(filters.limit);
  }
  if (filters?.offset) {
    query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
  }
  
  // Order by received date
  query = query.order('received_at', { ascending: false });
  
  const { data, error, count } = await query;
  
  return { data, error, count };
}

/**
 * Get email thread
 */
export async function getEmailThread(threadId: string) {
  const db = getSupabase();
  
  const { data, error } = await db
    .from('emails')
    .select(`
      *,
      job:jobs(id, job_title, company_name)
    `)
    .eq('thread_id', threadId)
    .order('thread_position', { ascending: true });
    
  return { data, error };
}

/**
 * Get unprocessed emails for AI processing
 */
export async function getUnprocessedEmails(limit: number = 50) {
  const db = getSupabase();
  
  const { data, error } = await db
    .from('emails')
    .select('*')
    .eq('ai_processed', false)
    .order('received_at', { ascending: false })
    .limit(limit);
    
  return { data, error };
}

/**
 * Mark email as processed
 */
export async function markEmailProcessed(
  emailId: string,
  processedData: {
    email_type?: EmailType;
    is_job_related?: boolean;
    job_confidence?: number;
    classification_confidence?: number;
    requires_action?: boolean;
    action_deadline?: string;
  }
) {
  const db = getSupabase();
  
  try {
    const { data, error } = await db
      .from('emails')
      .update({
        ...processedData,
        ai_processed: true,
        processing_version: '2.0' // Track processing version
      })
      .eq('id', emailId)
      .select()
      .single();
      
    if (error) throw error;
    
    return { data, error: null };
  } catch (error) {
    console.error('Error marking email processed:', error);
    return { data: null, error };
  }
}

/**
 * Get action-required emails
 */
export async function getActionRequiredEmails() {
  const db = getSupabase();
  
  const { data, error } = await db
    .from('emails')
    .select(`
      *,
      job:jobs(id, job_title, company_name)
    `)
    .eq('requires_action', true)
    .or('action_deadline.gte.' + new Date().toISOString() + ',action_deadline.is.null')
    .order('action_deadline', { ascending: true, nullsFirst: false });
    
  return { data, error };
}

/**
 * Get email statistics
 */
export async function getEmailStats() {
  const db = getSupabase();
  
  try {
    // Total emails
    const { count: totalEmails } = await db
      .from('emails')
      .select('*', { count: 'exact', head: true });
      
    // Job-related emails
    const { count: jobRelatedEmails } = await db
      .from('emails')
      .select('*', { count: 'exact', head: true })
      .eq('is_job_related', true);
      
    // Unprocessed emails
    const { count: unprocessedEmails } = await db
      .from('emails')
      .select('*', { count: 'exact', head: true })
      .eq('ai_processed', false);
      
    // Action required emails
    const { count: actionRequiredEmails } = await db
      .from('emails')
      .select('*', { count: 'exact', head: true })
      .eq('requires_action', true);
      
    // Email type distribution
    const { data: emailTypes } = await db
      .from('emails')
      .select('email_type')
      .not('email_type', 'is', null);
      
    const typeDistribution = emailTypes?.reduce((acc, { email_type }) => {
      acc[email_type] = (acc[email_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};
    
    return {
      total: totalEmails || 0,
      jobRelated: jobRelatedEmails || 0,
      unprocessed: unprocessedEmails || 0,
      actionRequired: actionRequiredEmails || 0,
      typeDistribution
    };
  } catch (error) {
    console.error('Error getting email stats:', error);
    return {
      total: 0,
      jobRelated: 0,
      unprocessed: 0,
      actionRequired: 0,
      typeDistribution: {}
    };
  }
}

/**
 * Batch update email job associations
 */
export async function batchLinkEmailsToJob(emailIds: string[], jobId: string) {
  const db = getSupabase();
  
  try {
    const { error } = await db
      .from('emails')
      .update({ 
        job_id: jobId,
        job_confidence: 1.0 // Manual linking = 100% confidence
      })
      .in('id', emailIds);
      
    if (error) throw error;
    
    // Log activity
    await logActivity({
      event_type: 'emails_batch_linked',
      entity_type: 'job',
      entity_id: jobId,
      description: `Linked ${emailIds.length} emails to job`,
      metadata: { email_ids: emailIds }
    });
    
    return { success: true, error: null };
  } catch (error) {
    console.error('Error batch linking emails:', error);
    return { success: false, error };
  }
}

/**
 * Get email threads summary
 */
export async function getEmailThreadsSummary(limit: number = 10) {
  const db = getSupabase();
  
  try {
    // Get unique threads with latest email
    const { data: threads } = await db
      .from('emails')
      .select('thread_id, subject, sender, received_at, is_job_related, email_type')
      .eq('is_thread_root', true)
      .order('received_at', { ascending: false })
      .limit(limit);
      
    if (!threads) return { data: [], error: null };
    
    // Get thread message counts
    const threadIds = threads.map(t => t.thread_id);
    const { data: counts } = await db
      .from('emails')
      .select('thread_id')
      .in('thread_id', threadIds);
      
    // Count messages per thread
    const threadCounts = counts?.reduce((acc, { thread_id }) => {
      acc[thread_id] = (acc[thread_id] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};
    
    // Combine data
    const summaries = threads.map(thread => ({
      ...thread,
      message_count: threadCounts[thread.thread_id] || 1
    }));
    
    return { data: summaries, error: null };
  } catch (error) {
    console.error('Error getting email threads summary:', error);
    return { data: null, error };
  }
}

/**
 * Clean up old processed emails
 */
export async function cleanupOldEmails(daysToKeep: number = 90) {
  const db = getSupabase();
  
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    // Only delete processed, non-job-related emails
    const { error, count } = await db
      .from('emails')
      .delete({ count: 'exact' })
      .eq('ai_processed', true)
      .eq('is_job_related', false)
      .eq('requires_action', false)
      .lt('received_at', cutoffDate.toISOString());
      
    if (error) throw error;
    
    // Log cleanup
    if (count && count > 0) {
      await logActivity({
        event_type: 'emails_cleaned_up',
        entity_type: 'system',
        description: `Cleaned up ${count} old emails`,
        metadata: { days_to_keep: daysToKeep, cutoff_date: cutoffDate.toISOString() }
      });
    }
    
    return { deleted: count || 0, error: null };
  } catch (error) {
    console.error('Error cleaning up emails:', error);
    return { deleted: 0, error };
  }
}