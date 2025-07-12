/**
 * Thread Aggregator Service
 * Aggregates thread data from the emails table since email_threads table doesn't exist
 * Created: 2025-01-09
 */

import { getSupabaseServiceClient } from '@/api/_lib/db'
import type {
  ThreadParticipant,
  ThreadSummary,
  ConversationStage,
  ThreadSentiment,
  Email
} from './types'

export interface AggregatedThread {
  threadId: string
  subjectNormalized: string
  participants: {
    internal: ThreadParticipant[]
    external: ThreadParticipant[]
  }
  primaryCompany: string | null
  primaryJobId: string | null
  firstMessageAt: Date
  lastMessageAt: Date
  messageCount: number
  threadStatus: string
  requiresResponse: boolean
  emails: Email[]
  // Computed fields
  jobApplicationStatus?: string
  threadSummary?: string
  threadSentiment?: ThreadSentiment
  conversationStage?: ConversationStage
  aiConfidence?: number
}

export class ThreadAggregator {
  private supabase = getSupabaseServiceClient()
  
  /**
   * Aggregate thread data from emails table
   */
  async aggregateThread(threadId: string): Promise<AggregatedThread | null> {
    try {
      // Get all emails for this thread
      const { data: emails, error } = await this.supabase
        .from('emails')
        .select('*')
        .eq('thread_id', threadId)
        .order('received_at', { ascending: true })

      if (error) {
        console.error('Failed to fetch emails for thread:', {
          threadId,
          error: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        })
        throw error
      }

      if (!emails || emails.length === 0) {
        return null
      }

      // Aggregate thread data
      const aggregatedThread = this.computeThreadData(threadId, emails)
      
      return aggregatedThread
    } catch (error) {
      console.error('Error aggregating thread:', error)
      throw error
    }
  }

  /**
   * Aggregate multiple threads from emails
   */
  async aggregateThreads(
    filters: {
      primaryJobId?: string
      company?: string
      requiresResponse?: boolean
      limit?: number
      offset?: number
    }
  ): Promise<{ threads: AggregatedThread[], total: number }> {
    try {
      // Build query for emails
      let query = this.supabase
        .from('emails')
        .select('*')

      // Apply filters
      if (filters.primaryJobId) {
        query = query.eq('job_id', filters.primaryJobId)
      }

      if (filters.requiresResponse) {
        query = query.eq('requires_action', filters.requiresResponse)
      }

      // Get emails ordered by thread and date
      const { data: emails, error } = await query
        .order('thread_id')
        .order('received_at', { ascending: true })

      if (error) {
        console.error('Failed to fetch emails for threads:', {
          filters,
          error: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        })
        throw error
      }

      if (!emails || emails.length === 0) {
        return { threads: [], total: 0 }
      }

      // Group emails by thread_id
      const threadGroups = new Map<string, Email[]>()
      for (const email of emails) {
        if (!threadGroups.has(email.thread_id)) {
          threadGroups.set(email.thread_id, [])
        }
        threadGroups.get(email.thread_id)!.push(email)
      }

      // Aggregate each thread
      const threads: AggregatedThread[] = []
      for (const [threadId, threadEmails] of threadGroups) {
        const aggregatedThread = this.computeThreadData(threadId, threadEmails)
        
        // Apply additional filters
        if (filters.company && aggregatedThread.primaryCompany !== filters.company) {
          continue
        }
        
        threads.push(aggregatedThread)
      }

      // Sort by last message date
      threads.sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime())

      // Apply pagination
      const offset = filters.offset || 0
      const limit = filters.limit || 20
      const paginatedThreads = threads.slice(offset, offset + limit)

      return {
        threads: paginatedThreads,
        total: threads.length
      }
    } catch (error) {
      console.error('Error aggregating threads:', error)
      throw error
    }
  }

  /**
   * Compute thread data from emails
   */
  private computeThreadData(threadId: string, emails: Email[]): AggregatedThread {
    if (emails.length === 0) {
      throw new Error('Cannot compute thread data from empty emails array')
    }

    // Sort emails by received_at
    const sortedEmails = [...emails].sort((a, b) => {
      const aDate = new Date(a.received_at || a.created_at)
      const bDate = new Date(b.received_at || b.created_at)
      return aDate.getTime() - bDate.getTime()
    })

    const firstEmail = sortedEmails[0]
    const lastEmail = sortedEmails[sortedEmails.length - 1]

    // Extract participants
    const participants = this.extractParticipants(sortedEmails)
    
    // Identify primary company
    const primaryCompany = this.identifyPrimaryCompany(sortedEmails)
    
    // Find primary job ID
    const primaryJobId = this.identifyPrimaryJobId(sortedEmails)
    
    // Normalize subject
    const subjectNormalized = this.normalizeSubject(firstEmail.subject || '')
    
    // Check if requires response
    const requiresResponse = this.checkRequiresResponse(sortedEmails)

    // Get dates
    const firstMessageAt = new Date(firstEmail.received_at || firstEmail.created_at)
    const lastMessageAt = new Date(lastEmail.received_at || lastEmail.created_at)

    // Determine thread status and other computed fields
    const threadStatus = this.determineThreadStatus(sortedEmails)
    const jobApplicationStatus = this.determineJobApplicationStatus(sortedEmails)
    const threadSummary = this.generateThreadSummary(sortedEmails)
    const threadSentiment = this.inferThreadSentiment(sortedEmails)
    const conversationStage = this.inferConversationStage(sortedEmails)

    return {
      threadId,
      subjectNormalized,
      participants,
      primaryCompany,
      primaryJobId,
      firstMessageAt,
      lastMessageAt,
      messageCount: sortedEmails.length,
      threadStatus,
      requiresResponse,
      emails: sortedEmails,
      jobApplicationStatus,
      threadSummary,
      threadSentiment,
      conversationStage,
      aiConfidence: this.computeAIConfidence(sortedEmails)
    }
  }

  /**
   * Extract participants from thread emails
   */
  private extractParticipants(emails: Email[]): { internal: ThreadParticipant[], external: ThreadParticipant[] } {
    const internalDomains = ['harsha.vippala1@gmail.com'] // User's email
    const participantMap = new Map<string, ThreadParticipant>()

    emails.forEach(email => {
      // Process sender
      const senderEmail = this.extractEmailFromSender(email.sender)
      if (senderEmail) {
        const senderName = this.extractNameFromSender(email.sender)
        if (!participantMap.has(senderEmail)) {
          participantMap.set(senderEmail, {
            email: senderEmail,
            name: senderName,
            role: this.inferRole(senderName, senderEmail),
            messageCount: 1
          })
        } else {
          participantMap.get(senderEmail)!.messageCount++
        }
      }

      // Process recipients
      if (email.recipients) {
        email.recipients.forEach(recipient => {
          const recipientEmail = this.extractEmailFromSender(recipient)
          if (recipientEmail && !participantMap.has(recipientEmail)) {
            const recipientName = this.extractNameFromSender(recipient)
            participantMap.set(recipientEmail, {
              email: recipientEmail,
              name: recipientName,
              role: this.inferRole(recipientName, recipientEmail),
              messageCount: 0 // Recipients don't count as message senders
            })
          }
        })
      }
    })

    // Separate internal and external
    const internal: ThreadParticipant[] = []
    const external: ThreadParticipant[] = []

    participantMap.forEach(participant => {
      if (internalDomains.some(domain => participant.email.includes(domain))) {
        internal.push(participant)
      } else {
        external.push(participant)
      }
    })

    return { internal, external }
  }

  /**
   * Extract email address from sender string
   */
  private extractEmailFromSender(sender: string): string | null {
    const match = sender.match(/<(.+?)>/) || sender.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/)
    return match ? match[1] : null
  }

  /**
   * Extract name from sender string
   */
  private extractNameFromSender(sender: string): string | null {
    const match = sender.match(/^(.*?)\s*</)
    return match ? match[1].replace(/"/g, '').trim() : null
  }

  /**
   * Identify primary company from thread
   */
  private identifyPrimaryCompany(emails: Email[]): string | null {
    const companyDomains = new Map<string, number>()

    emails.forEach(email => {
      const senderEmail = this.extractEmailFromSender(email.sender)
      if (senderEmail) {
        const domain = senderEmail.split('@')[1]
        if (domain && !domain.includes('gmail.com') && !domain.includes('outlook.com')) {
          companyDomains.set(domain, (companyDomains.get(domain) || 0) + 1)
        }
      }
    })

    // Return most frequent domain
    let maxCount = 0
    let primaryDomain = null
    companyDomains.forEach((count, domain) => {
      if (count > maxCount) {
        maxCount = count
        primaryDomain = domain
      }
    })

    return primaryDomain
  }

  /**
   * Identify primary job ID from thread
   */
  private identifyPrimaryJobId(emails: Email[]): string | null {
    const jobIds = new Map<string, number>()

    emails.forEach(email => {
      if (email.job_id) {
        jobIds.set(email.job_id, (jobIds.get(email.job_id) || 0) + 1)
      }
    })

    // Return most frequent job ID
    let maxCount = 0
    let primaryJobId = null
    jobIds.forEach((count, jobId) => {
      if (count > maxCount) {
        maxCount = count
        primaryJobId = jobId
      }
    })

    return primaryJobId
  }

  /**
   * Normalize email subject for grouping
   */
  private normalizeSubject(subject: string): string {
    return subject
      .toLowerCase()
      .replace(/^(re:|fwd:|fw:)\s*/gi, '')
      .replace(/\s+/g, ' ')
      .trim()
  }

  /**
   * Check if thread requires user response
   */
  private checkRequiresResponse(emails: Email[]): boolean {
    if (emails.length === 0) return false

    // Get the most recent email
    const lastEmail = emails[emails.length - 1]

    // Check if last email is from external sender
    const lastSenderEmail = this.extractEmailFromSender(lastEmail.sender)
    
    if (lastSenderEmail && !lastSenderEmail.includes('harsha.vippala1@gmail.com')) {
      // Check for action-requesting keywords or if requires_action is set
      if (lastEmail.requires_action) {
        return true
      }

      const body = lastEmail.body_text || ''
      const actionKeywords = [
        'please confirm',
        'let me know',
        'please advise',
        'waiting for',
        'response required',
        'action required',
        'urgent',
        'deadline',
        'by [date]',
        'asap'
      ]
      
      return actionKeywords.some(keyword => 
        body.toLowerCase().includes(keyword)
      )
    }

    return false
  }

  /**
   * Determine thread status
   */
  private determineThreadStatus(emails: Email[]): string {
    const hasUnread = emails.some(email => !email.ai_processed)
    const hasJobRelated = emails.some(email => email.is_job_related)
    const requiresResponse = this.checkRequiresResponse(emails)

    if (requiresResponse) return 'requires_response'
    if (hasUnread) return 'unread'
    if (hasJobRelated) return 'job_related'
    return 'active'
  }

  /**
   * Determine job application status from emails
   */
  private determineJobApplicationStatus(emails: Email[]): string | null {
    const statusKeywords = {
      'applied': ['application received', 'thank you for applying'],
      'screening': ['phone screen', 'initial interview', 'screening call'],
      'interviewing': ['interview', 'technical interview', 'final interview'],
      'offer': ['offer', 'congratulations', 'we are pleased to offer'],
      'rejected': ['unfortunately', 'not moving forward', 'position has been filled']
    }

    // Check emails in reverse order (most recent first)
    for (let i = emails.length - 1; i >= 0; i--) {
      const email = emails[i]
      const content = (email.body_text || '').toLowerCase()
      
      for (const [status, keywords] of Object.entries(statusKeywords)) {
        if (keywords.some(keyword => content.includes(keyword))) {
          return status
        }
      }
    }

    return null
  }

  /**
   * Generate thread summary
   */
  private generateThreadSummary(emails: Email[]): string | null {
    if (emails.length === 0) return null
    
    const firstEmail = emails[0]
    const lastEmail = emails[emails.length - 1]
    
    const summary = `Thread with ${emails.length} messages starting "${firstEmail.subject || 'No subject'}" from ${this.extractEmailFromSender(firstEmail.sender) || 'unknown'}`
    
    return summary.substring(0, 500) // Limit summary length
  }

  /**
   * Infer thread sentiment
   */
  private inferThreadSentiment(emails: Email[]): ThreadSentiment {
    const positiveKeywords = ['congratulations', 'pleased', 'excited', 'great', 'excellent']
    const negativeKeywords = ['unfortunately', 'regret', 'sorry', 'declined', 'rejected']

    let positiveCount = 0
    let negativeCount = 0

    emails.forEach(email => {
      const content = (email.body_text || '').toLowerCase()
      positiveKeywords.forEach(keyword => {
        if (content.includes(keyword)) positiveCount++
      })
      negativeKeywords.forEach(keyword => {
        if (content.includes(keyword)) negativeCount++
      })
    })

    if (positiveCount > negativeCount) return 'positive'
    if (negativeCount > positiveCount) return 'negative'
    return 'neutral'
  }

  /**
   * Infer conversation stage
   */
  private inferConversationStage(emails: Email[]): ConversationStage {
    if (emails.length === 1) return 'initial'
    if (emails.length > 5) return 'closing'
    return 'ongoing'
  }

  /**
   * Compute AI confidence score
   */
  private computeAIConfidence(emails: Email[]): number {
    const processedEmails = emails.filter(email => email.ai_processed)
    return processedEmails.length / emails.length
  }

  /**
   * Infer participant role from name/email
   */
  private inferRole(name: string | null, email: string): string {
    const lowerName = (name || '').toLowerCase()
    const lowerEmail = email.toLowerCase()

    if (lowerName.includes('recruiter') || lowerEmail.includes('recruiter')) {
      return 'recruiter'
    }
    if (lowerName.includes('hiring') || lowerName.includes('hr')) {
      return 'hiring_manager'
    }
    if (lowerName.includes('ceo') || lowerName.includes('cto') || lowerName.includes('founder')) {
      return 'executive'
    }
    if (lowerEmail.includes('noreply') || lowerEmail.includes('no-reply')) {
      return 'system'
    }
    
    return 'contact'
  }
}

export const threadAggregator = new ThreadAggregator()