/**
 * Thread Database Queries
 * Optimized queries for thread operations working with the emails table
 * Created: 2025-01-09
 */

import { getSupabaseServiceClient } from '@/api/_lib/db'
import type { Email } from './types'

export class ThreadQueries {
  private supabase = getSupabaseServiceClient()

  /**
   * Get all emails for a specific thread, optimized with proper indexing
   */
  async getThreadEmails(threadId: string): Promise<Email[]> {
    const { data, error } = await this.supabase
      .from('emails')
      .select('*')
      .eq('thread_id', threadId)
      .order('received_at', { ascending: true })

    if (error) {
      console.error('Failed to fetch thread emails:', {
        threadId,
        error: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      })
      throw error
    }

    return data || []
  }

  /**
   * Get thread statistics without fetching full email content
   */
  async getThreadStats(threadId: string): Promise<{
    messageCount: number
    firstMessageAt: Date | null
    lastMessageAt: Date | null
    hasJobRelated: boolean
    requiresResponse: boolean
    unreadCount: number
  }> {
    const { data, error } = await this.supabase
      .from('emails')
      .select('received_at, created_at, is_job_related, requires_action, ai_processed')
      .eq('thread_id', threadId)
      .order('received_at', { ascending: true })

    if (error) {
      console.error('Failed to fetch thread stats:', {
        threadId,
        error: error.message
      })
      throw error
    }

    if (!data || data.length === 0) {
      return {
        messageCount: 0,
        firstMessageAt: null,
        lastMessageAt: null,
        hasJobRelated: false,
        requiresResponse: false,
        unreadCount: 0
      }
    }

    const sortedData = data.sort((a, b) => {
      const aDate = new Date(a.received_at || a.created_at)
      const bDate = new Date(b.received_at || b.created_at)
      return aDate.getTime() - bDate.getTime()
    })

    return {
      messageCount: data.length,
      firstMessageAt: new Date(sortedData[0].received_at || sortedData[0].created_at),
      lastMessageAt: new Date(sortedData[sortedData.length - 1].received_at || sortedData[sortedData.length - 1].created_at),
      hasJobRelated: data.some(email => email.is_job_related),
      requiresResponse: data.some(email => email.requires_action),
      unreadCount: data.filter(email => !email.ai_processed).length
    }
  }

  /**
   * Get all unique thread IDs with pagination
   */
  async getThreadIds(
    filters: {
      jobId?: string
      hasJobRelated?: boolean
      requiresResponse?: boolean
      limit?: number
      offset?: number
    } = {}
  ): Promise<{ threadIds: string[], total: number }> {
    let query = this.supabase
      .from('emails')
      .select('thread_id', { count: 'exact' })

    // Apply filters
    if (filters.jobId) {
      query = query.eq('job_id', filters.jobId)
    }
    if (filters.hasJobRelated !== undefined) {
      query = query.eq('is_job_related', filters.hasJobRelated)
    }
    if (filters.requiresResponse !== undefined) {
      query = query.eq('requires_action', filters.requiresResponse)
    }

    const { data, error, count } = await query

    if (error) {
      console.error('Failed to fetch thread IDs:', {
        filters,
        error: error.message
      })
      throw error
    }

    // Get unique thread IDs
    const uniqueThreadIds = [...new Set((data || []).map(email => email.thread_id))]

    // Apply pagination
    const offset = filters.offset || 0
    const limit = filters.limit || 50
    const paginatedIds = uniqueThreadIds.slice(offset, offset + limit)

    return {
      threadIds: paginatedIds,
      total: uniqueThreadIds.length
    }
  }

  /**
   * Get thread participants for multiple threads efficiently
   */
  async getThreadParticipants(threadIds: string[]): Promise<Map<string, { sender: string, recipients: string[] }[]>> {
    if (threadIds.length === 0) return new Map()

    const { data, error } = await this.supabase
      .from('emails')
      .select('thread_id, sender, recipients')
      .in('thread_id', threadIds)

    if (error) {
      console.error('Failed to fetch thread participants:', {
        threadIds,
        error: error.message
      })
      throw error
    }

    const participantMap = new Map<string, { sender: string, recipients: string[] }[]>()

    for (const email of data || []) {
      if (!participantMap.has(email.thread_id)) {
        participantMap.set(email.thread_id, [])
      }
      participantMap.get(email.thread_id)!.push({
        sender: email.sender,
        recipients: email.recipients || []
      })
    }

    return participantMap
  }

  /**
   * Update thread analysis for all emails in a thread
   */
  async updateThreadAnalysis(
    threadId: string,
    analysis: {
      summary?: string
      sentiment?: string
      stage?: string
      applicationStatus?: string
      confidence?: number
    }
  ): Promise<void> {
    const updates: any = {}

    if (analysis.summary) {
      updates.thread_summary = analysis.summary
    }
    if (analysis.applicationStatus) {
      updates.email_type = this.mapApplicationStatusToEmailType(analysis.applicationStatus)
    }
    if (analysis.confidence !== undefined) {
      updates.classification_confidence = analysis.confidence
    }

    // Mark as AI processed
    updates.ai_processed = true
    updates.processing_version = 'v1.0'

    const { error } = await this.supabase
      .from('emails')
      .update(updates)
      .eq('thread_id', threadId)

    if (error) {
      console.error('Failed to update thread analysis:', {
        threadId,
        analysis,
        error: error.message
      })
      throw error
    }
  }

  /**
   * Get threads that require response
   */
  async getThreadsRequiringResponse(limit: number = 50): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('emails')
      .select('thread_id')
      .eq('requires_action', true)
      .limit(limit)

    if (error) {
      console.error('Failed to fetch threads requiring response:', {
        error: error.message
      })
      throw error
    }

    return [...new Set((data || []).map(email => email.thread_id))]
  }

  /**
   * Get thread subject and primary company efficiently
   */
  async getThreadMetadata(threadId: string): Promise<{
    subject: string | null
    primaryCompany: string | null
    primaryJobId: string | null
  }> {
    const { data, error } = await this.supabase
      .from('emails')
      .select('subject, sender, job_id')
      .eq('thread_id', threadId)
      .order('received_at', { ascending: true })
      .limit(10) // Only need a few emails to determine metadata

    if (error) {
      console.error('Failed to fetch thread metadata:', {
        threadId,
        error: error.message
      })
      throw error
    }

    if (!data || data.length === 0) {
      return {
        subject: null,
        primaryCompany: null,
        primaryJobId: null
      }
    }

    // Get subject from first email
    const subject = data[0].subject

    // Determine primary company from sender domains
    const domainCounts = new Map<string, number>()
    for (const email of data) {
      const match = email.sender.match(/@([^>]+)/)
      if (match) {
        const domain = match[1]
        if (!domain.includes('gmail.com') && !domain.includes('outlook.com')) {
          domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1)
        }
      }
    }

    let primaryCompany = null
    let maxCount = 0
    for (const [domain, count] of domainCounts) {
      if (count > maxCount) {
        maxCount = count
        primaryCompany = domain
      }
    }

    // Determine primary job ID
    const jobIds = data.filter(email => email.job_id).map(email => email.job_id)
    const primaryJobId = jobIds.length > 0 ? jobIds[0] : null

    return {
      subject,
      primaryCompany,
      primaryJobId
    }
  }

  /**
   * Map application status to email type
   */
  private mapApplicationStatusToEmailType(status: string): string {
    const mapping: { [key: string]: string } = {
      'applied': 'application_confirmation',
      'screening': 'recruiter_outreach',
      'interviewing': 'interview_request',
      'offer': 'offer',
      'rejected': 'rejection'
    }
    return mapping[status] || 'general'
  }

  /**
   * Clean up old email processing data
   */
  async cleanupOldEmails(daysOld: number = 90): Promise<number> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysOld)

    const { data, error } = await this.supabase
      .from('emails')
      .delete()
      .lt('created_at', cutoffDate.toISOString())
      .eq('is_job_related', false)
      .eq('ai_processed', true)

    if (error) {
      console.error('Failed to cleanup old emails:', {
        error: error.message
      })
      throw error
    }

    return data?.length || 0
  }
}

export const threadQueries = new ThreadQueries()