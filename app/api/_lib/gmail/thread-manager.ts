/**
 * Thread Management Service
 * Handles Gmail thread organization and conversation context
 * Updated: 2025-01-09 - Refactored to use emails table instead of email_threads
 */

import { getSupabaseServiceClient } from '@/api/_lib/db'
import { threadAggregator, type AggregatedThread } from './thread-aggregator'
import type {
  ThreadParticipant,
  ThreadSummary,
  ConversationStage,
  ThreadSentiment,
  Email
} from './types'

// Updated EmailThread interface to match aggregated thread structure
export interface EmailThread {
  id: string
  gmail_thread_id: string
  subject_normalized: string
  participants: {
    internal: ThreadParticipant[]
    external: ThreadParticipant[]
  }
  primary_company: string | null
  primary_job_id: string | null
  first_message_at: Date
  last_message_at: Date
  message_count: number
  thread_status: string
  job_application_status: string | null
  requires_response: boolean
  last_response_at: Date | null
  thread_summary: string | null
  thread_sentiment: ThreadSentiment | null
  conversation_stage: ConversationStage | null
  ai_confidence: number | null
  created_at: Date
  updated_at: Date
}

export class ThreadManager {
  // Use service client to bypass RLS for thread operations
  private supabase = getSupabaseServiceClient()

  /**
   * Create or update thread information
   * Now works with emails table directly
   */
  async upsertThread(
    threadId: string,
    emails: any[],
    primaryJobId?: string
  ): Promise<EmailThread> {
    try {
      // Convert Gmail API emails to our Email format for processing
      const processedEmails = this.convertGmailToEmailFormat(emails)
      
      // Update emails in database if they don't exist
      await this.ensureEmailsExist(processedEmails, primaryJobId)
      
      // Get aggregated thread data
      const aggregatedThread = await threadAggregator.aggregateThread(threadId)
      
      if (!aggregatedThread) {
        throw new Error(`Thread ${threadId} not found after processing emails`)
      }

      // Convert aggregated thread to EmailThread format
      const emailThread = this.convertAggregatedToEmailThread(aggregatedThread)
      
      return emailThread
    } catch (error) {
      console.error('Failed to upsert thread:', {
        threadId,
        error: error instanceof Error ? error.message : error
      })
      throw error
    }
  }

  /**
   * Convert Gmail API emails to our Email format
   */
  private convertGmailToEmailFormat(gmailEmails: any[]): Email[] {
    return gmailEmails.map(email => {
      // Extract headers
      const headers = email.payload?.headers || []
      const fromHeader = headers.find((h: any) => h.name === 'From')
      const toHeader = headers.find((h: any) => h.name === 'To')
      const subjectHeader = headers.find((h: any) => h.name === 'Subject')
      
      // Extract body text
      const bodyText = this.extractBodyText(email)
      
      // Extract recipients
      const recipients = toHeader ? toHeader.value.split(',').map((r: string) => r.trim()) : []
      
      return {
        id: email.id, // This will be updated when we ensure emails exist
        gmail_id: email.id,
        thread_id: email.threadId,
        subject: subjectHeader?.value || null,
        sender: fromHeader?.value || '',
        recipients,
        received_at: new Date(parseInt(email.internalDate)).toISOString(),
        body_text: bodyText,
        body_html: null, // Could be extracted if needed
        has_attachments: false,
        attachments: null,
        job_id: null,
        is_job_related: false,
        job_confidence: null,
        email_type: null,
        classification_confidence: null,
        thread_position: null,
        is_thread_root: false,
        thread_summary: null,
        ai_processed: false,
        processing_version: null,
        requires_action: false,
        action_deadline: null,
        labels: email.labelIds || [],
        created_at: new Date().toISOString()
      } as Email
    })
  }

  /**
   * Ensure emails exist in database
   */
  private async ensureEmailsExist(emails: Email[], primaryJobId?: string): Promise<void> {
    for (const email of emails) {
      // Check if email exists
      const { data: existingEmail } = await this.supabase
        .from('emails')
        .select('id')
        .eq('gmail_id', email.gmail_id)
        .single()

      if (!existingEmail) {
        // Insert new email
        const { error } = await this.supabase
          .from('emails')
          .insert({
            ...email,
            job_id: primaryJobId || null
          })

        if (error) {
          console.error('Failed to insert email:', {
            gmail_id: email.gmail_id,
            error: error.message
          })
        }
      }
    }
  }

  /**
   * Convert aggregated thread to EmailThread format
   */
  private convertAggregatedToEmailThread(aggregated: AggregatedThread): EmailThread {
    const lastEmail = aggregated.emails[aggregated.emails.length - 1]
    
    return {
      id: aggregated.threadId, // Using threadId as ID since we don't have a separate table
      gmail_thread_id: aggregated.threadId,
      subject_normalized: aggregated.subjectNormalized,
      participants: aggregated.participants,
      primary_company: aggregated.primaryCompany,
      primary_job_id: aggregated.primaryJobId,
      first_message_at: aggregated.firstMessageAt,
      last_message_at: aggregated.lastMessageAt,
      message_count: aggregated.messageCount,
      thread_status: aggregated.threadStatus,
      job_application_status: aggregated.jobApplicationStatus || null,
      requires_response: aggregated.requiresResponse,
      last_response_at: lastEmail ? new Date(lastEmail.received_at || lastEmail.created_at) : null,
      thread_summary: aggregated.threadSummary,
      thread_sentiment: aggregated.threadSentiment || null,
      conversation_stage: aggregated.conversationStage || null,
      ai_confidence: aggregated.aiConfidence || null,
      created_at: aggregated.firstMessageAt,
      updated_at: aggregated.lastMessageAt
    }
  }

  /**
   * Analyze thread conversation context
   */
  async analyzeThread(threadId: string): Promise<ThreadSummary> {
    try {
      const aggregatedThread = await threadAggregator.aggregateThread(threadId)
      
      if (!aggregatedThread) {
        throw new Error(`Thread ${threadId} not found`)
      }

      return {
        threadId: aggregatedThread.threadId,
        summary: aggregatedThread.threadSummary || '',
        sentiment: aggregatedThread.threadSentiment || 'neutral',
        stage: aggregatedThread.conversationStage || 'initial',
        requiresResponse: aggregatedThread.requiresResponse,
        lastResponseAt: aggregatedThread.lastMessageAt
      }
    } catch (error) {
      console.error('Failed to analyze thread:', {
        threadId,
        error: error instanceof Error ? error.message : error
      })
      throw error
    }
  }

  /**
   * Update thread with AI analysis results
   */
  async updateThreadAnalysis(
    threadId: string,
    analysis: {
      summary?: string
      sentiment?: ThreadSentiment
      stage?: ConversationStage
      applicationStatus?: string
      confidence?: number
    }
  ): Promise<void> {
    try {
      // Update all emails in the thread with analysis results
      const { error } = await this.supabase
        .from('emails')
        .update({
          thread_summary: analysis.summary,
          email_type: analysis.applicationStatus ? 
            this.mapApplicationStatusToEmailType(analysis.applicationStatus) : undefined,
          classification_confidence: analysis.confidence,
          ai_processed: true,
          processing_version: 'v1.0'
        })
        .eq('thread_id', threadId)

      if (error) {
        console.error('Failed to update thread analysis:', {
          threadId,
          analysis,
          error: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        })
        throw error
      }
    } catch (error) {
      console.error('Error updating thread analysis:', error)
      throw error
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
   * Extract body text from email
   */
  private extractBodyText(email: any): string {
    const parts = email.payload?.parts || []
    let text = ''

    const extractText = (part: any): void => {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        text += Buffer.from(part.body.data, 'base64').toString('utf-8')
      } else if (part.parts) {
        part.parts.forEach(extractText)
      }
    }

    if (email.payload?.body?.data) {
      text = Buffer.from(email.payload.body.data, 'base64').toString('utf-8')
    } else {
      extractText(email.payload)
    }

    return text
  }

  /**
   * Get thread by ID
   */
  async getThread(threadId: string): Promise<EmailThread | null> {
    try {
      const aggregatedThread = await threadAggregator.aggregateThread(threadId)
      
      if (!aggregatedThread) {
        return null
      }

      return this.convertAggregatedToEmailThread(aggregatedThread)
    } catch (error) {
      console.error('Failed to get thread:', {
        threadId,
        error: error instanceof Error ? error.message : error
      })
      throw error
    }
  }

  /**
   * List threads with filters
   */
  async listThreads(filters: {
    primaryJobId?: string
    company?: string
    status?: string
    requiresResponse?: boolean
    limit?: number
    offset?: number
  }): Promise<{ threads: EmailThread[], total: number }> {
    try {
      const { threads, total } = await threadAggregator.aggregateThreads({
        primaryJobId: filters.primaryJobId,
        company: filters.company,
        requiresResponse: filters.requiresResponse,
        limit: filters.limit,
        offset: filters.offset
      })

      // Convert aggregated threads to EmailThread format
      const emailThreads = threads.map(thread => this.convertAggregatedToEmailThread(thread))

      // Apply status filter if provided
      const filteredThreads = filters.status ? 
        emailThreads.filter(thread => thread.job_application_status === filters.status) :
        emailThreads

      return {
        threads: filteredThreads,
        total: filters.status ? filteredThreads.length : total
      }
    } catch (error) {
      console.error('Failed to list threads:', {
        filters,
        error: error instanceof Error ? error.message : error
      })
      throw error
    }
  }
}

export const threadManager = new ThreadManager()