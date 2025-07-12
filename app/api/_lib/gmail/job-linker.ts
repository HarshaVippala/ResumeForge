/**
 * Job Linking Service
 * Matches emails to job applications using multiple strategies
 */

import { getSupabaseServiceClient } from '@/api/_lib/db'
import type { Job, EmailCommunication } from '@/api/_lib/db/types'

interface MatchResult {
  jobId: string
  confidence: number
  matchStrategy: string
  matchDetails: Record<string, any>
}

export class JobLinker {
  // Use service client to bypass RLS for job linking operations
  private supabase = getSupabaseServiceClient()

  /**
   * Attempt to link email to job using multiple matching strategies
   * Returns null if no suitable match found (which is perfectly valid)
   */
  async linkEmailToJob(email: EmailCommunication): Promise<MatchResult | null> {
    if (!email.is_job_related) return null

    // Skip if email is already linked
    if (email.linked_job_id) return null

    // Try multiple matching strategies in order of confidence
    const strategies = [
      { name: 'exactCompanyPosition', fn: () => this.matchByExactCompanyPosition(email) },
      { name: 'domainMatch', fn: () => this.matchByCompanyDomain(email) },
      { name: 'threadHistory', fn: () => this.matchByThreadHistory(email) },
      { name: 'timeProximity', fn: () => this.matchByTimeProximity(email) },
      { name: 'contentSimilarity', fn: () => this.matchByContentSimilarity(email) }
    ]

    for (const strategy of strategies) {
      try {
        const result = await strategy.fn()
        // Only link if we have high confidence
        if (result && result.confidence >= 0.75) {
          // Update email with job link
          await this.updateEmailJobLink(email.id, result.jobId)
          
          // Update job status if needed
          await this.updateJobStatusFromEmail(result.jobId, email)
          
          return {
            ...result,
            matchStrategy: strategy.name
          }
        }
      } catch (error) {
        console.error(`Job linking strategy ${strategy.name} failed:`, error)
      }
    }

    // No match found - this is OK, not all emails need to be linked
    return null
  }

  /**
   * Match by exact company name and position
   */
  private async matchByExactCompanyPosition(
    email: EmailCommunication
  ): Promise<MatchResult | null> {
    if (!email.extracted_company || !email.extracted_position) return null

    const { data: jobs } = await this.supabase
      .from('my_jobs')
      .select('*')
      .ilike('company', `%${email.extracted_company}%`)
      .ilike('title', `%${email.extracted_position}%`)
      .order('created_at', { ascending: false })
      .limit(5)

    if (!jobs || jobs.length === 0) return null

    // Calculate similarity scores
    const matches = jobs.map(job => {
      const companyScore = this.calculateSimilarity(
        job.company.toLowerCase(),
        email.extracted_company.toLowerCase()
      )
      const positionScore = this.calculateSimilarity(
        job.title.toLowerCase(),
        email.extracted_position.toLowerCase()
      )
      
      return {
        job,
        score: (companyScore + positionScore) / 2
      }
    })

    const bestMatch = matches.reduce((prev, curr) => 
      curr.score > prev.score ? curr : prev
    )

    if (bestMatch.score >= 0.8) {
      return {
        jobId: bestMatch.job.id,
        confidence: bestMatch.score,
        matchStrategy: 'exactCompanyPosition',
        matchDetails: {
          companyMatch: email.extracted_company,
          positionMatch: email.extracted_position
        }
      }
    }

    return null
  }

  /**
   * Match by company email domain
   */
  private async matchByCompanyDomain(
    email: EmailCommunication
  ): Promise<MatchResult | null> {
    // Extract sender domain
    const senderDomain = email.sender_email?.split('@')[1]
    if (!senderDomain || senderDomain.includes('gmail.com')) return null

    // Get jobs from the same company domain
    const { data: jobs } = await this.supabase
      .from('my_jobs')
      .select('*')
      .or(`company.ilike.%${senderDomain}%,url.ilike.%${senderDomain}%`)
      .order('created_at', { ascending: false })
      .limit(10)

    if (!jobs || jobs.length === 0) return null

    // If position is mentioned, try to match it
    if (email.extracted_position) {
      const positionMatches = jobs.filter(job =>
        this.calculateSimilarity(
          job.title.toLowerCase(),
          email.extracted_position.toLowerCase()
        ) > 0.6
      )
      
      if (positionMatches.length > 0) {
        return {
          jobId: positionMatches[0].id,
          confidence: 0.85,
          matchStrategy: 'domainMatch',
          matchDetails: {
            domain: senderDomain,
            positionMatch: email.extracted_position
          }
        }
      }
    }

    // Return most recent job from the company
    return {
      jobId: jobs[0].id,
      confidence: 0.7,
      matchStrategy: 'domainMatch',
      matchDetails: {
        domain: senderDomain,
        jobCount: jobs.length
      }
    }
  }

  /**
   * Match by thread history
   */
  private async matchByThreadHistory(
    email: EmailCommunication
  ): Promise<MatchResult | null> {
    if (!email.thread_id) return null

    // Check if other emails in thread are already linked
    const { data: linkedEmails } = await this.supabase
      .from('emails')
      .select('linked_job_id')
      .eq('thread_id', email.thread_id)
      .not('linked_job_id', 'is', null)
      .order('received_at', { ascending: false })
      .limit(5)

    if (!linkedEmails || linkedEmails.length === 0) return null

    // Get most common job ID
    const jobCounts = new Map<string, number>()
    linkedEmails.forEach(e => {
      if (e.linked_job_id) {
        jobCounts.set(e.linked_job_id, (jobCounts.get(e.linked_job_id) || 0) + 1)
      }
    })

    let maxCount = 0
    let mostCommonJobId = null
    jobCounts.forEach((count, jobId) => {
      if (count > maxCount) {
        maxCount = count
        mostCommonJobId = jobId
      }
    })

    if (mostCommonJobId) {
      return {
        jobId: mostCommonJobId,
        confidence: Math.min(0.9, 0.7 + (maxCount * 0.1)),
        matchStrategy: 'threadHistory',
        matchDetails: {
          linkedEmailCount: maxCount,
          totalThreadEmails: linkedEmails.length
        }
      }
    }

    return null
  }

  /**
   * Match by time proximity to application
   */
  private async matchByTimeProximity(
    email: EmailCommunication
  ): Promise<MatchResult | null> {
    if (!email.extracted_company) return null

    const emailDate = new Date(email.received_at)
    const daysBefore = 3
    const daysAfter = 30

    // Find jobs applied around the email date
    const { data: jobs } = await this.supabase
      .from('my_jobs')
      .select('*')
      .ilike('company', `%${email.extracted_company}%`)
      .gte('created_at', new Date(emailDate.getTime() - daysBefore * 24 * 60 * 60 * 1000).toISOString())
      .lte('created_at', new Date(emailDate.getTime() + daysAfter * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })

    if (!jobs || jobs.length === 0) return null

    // Calculate time-based confidence
    const bestMatch = jobs.map(job => {
      const jobDate = new Date(job.created_at)
      const daysDiff = Math.abs((emailDate.getTime() - jobDate.getTime()) / (24 * 60 * 60 * 1000))
      
      // Higher confidence for emails received after application
      const isAfterApplication = emailDate > jobDate
      const baseConfidence = isAfterApplication ? 0.7 : 0.5
      
      // Reduce confidence based on time distance
      const confidence = baseConfidence * Math.max(0.5, 1 - (daysDiff / 30))
      
      return { job, confidence, daysDiff }
    }).reduce((prev, curr) => curr.confidence > prev.confidence ? curr : prev)

    if (bestMatch.confidence >= 0.6) {
      return {
        jobId: bestMatch.job.id,
        confidence: bestMatch.confidence,
        matchStrategy: 'timeProximity',
        matchDetails: {
          daysDifference: Math.round(bestMatch.daysDiff),
          applicationDate: bestMatch.job.created_at
        }
      }
    }

    return null
  }

  /**
   * Match by content similarity
   */
  private async matchByContentSimilarity(
    email: EmailCommunication
  ): Promise<MatchResult | null> {
    if (!email.body_text || !email.extracted_company) return null

    // Get recent jobs from the company
    const { data: jobs } = await this.supabase
      .from('my_jobs')
      .select('*')
      .ilike('company', `%${email.extracted_company}%`)
      .order('created_at', { ascending: false })
      .limit(10)

    if (!jobs || jobs.length === 0) return null

    // Extract key terms from email
    const emailTerms = this.extractKeyTerms(email.body_text)
    
    // Compare with job descriptions
    const matches = jobs.map(job => {
      const jobTerms = this.extractKeyTerms(
        `${job.title} ${job.description || ''} ${job.requirements || ''}`
      )
      
      const commonTerms = emailTerms.filter(term => jobTerms.includes(term))
      const similarity = commonTerms.length / Math.max(emailTerms.length, jobTerms.length)
      
      return { job, similarity, commonTerms }
    }).filter(m => m.similarity > 0.3)

    if (matches.length > 0) {
      const bestMatch = matches.reduce((prev, curr) => 
        curr.similarity > prev.similarity ? curr : prev
      )
      
      return {
        jobId: bestMatch.job.id,
        confidence: Math.min(0.8, bestMatch.similarity + 0.3),
        matchStrategy: 'contentSimilarity',
        matchDetails: {
          similarity: bestMatch.similarity,
          commonTerms: bestMatch.commonTerms
        }
      }
    }

    return null
  }

  /**
   * Calculate string similarity (Levenshtein-based)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2
    const shorter = str1.length > str2.length ? str2 : str1
    
    if (longer.length === 0) return 1.0
    
    const editDistance = this.levenshteinDistance(longer, shorter)
    return (longer.length - editDistance) / longer.length
  }

  /**
   * Levenshtein distance implementation
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = []
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i]
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          )
        }
      }
    }
    
    return matrix[str2.length][str1.length]
  }

  /**
   * Extract key terms from text
   */
  private extractKeyTerms(text: string): string[] {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'been', 'be'
    ])
    
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.has(word))
      .filter((word, index, self) => self.indexOf(word) === index) // unique
  }

  /**
   * Update email with job link
   */
  private async updateEmailJobLink(emailId: string, jobId: string): Promise<void> {
    const { error } = await this.supabase
      .from('emails')
      .update({
        linked_job_id: jobId,
        updated_at: new Date()
      })
      .eq('id', emailId)

    if (error) throw error
  }

  /**
   * Update job status based on email content
   */
  private async updateJobStatusFromEmail(
    jobId: string,
    email: EmailCommunication
  ): Promise<void> {
    if (!email.extracted_status) return

    // Map email status to job status
    const statusMap: Record<string, string> = {
      'interview_scheduled': 'interview',
      'interview_request': 'interview',
      'offer': 'offer',
      'rejection': 'rejected',
      'application_received': 'applied'
    }

    const newStatus = statusMap[email.extracted_status]
    if (!newStatus) return

    // Get current job
    const { data: job } = await this.supabase
      .from('my_jobs')
      .select('status, updated_at')
      .eq('id', jobId)
      .single()

    if (!job) return

    // Only update if email is newer than last job update
    if (new Date(email.received_at) > new Date(job.updated_at)) {
      const { error } = await this.supabase
        .from('my_jobs')
        .update({
          status: newStatus,
          updated_at: new Date()
        })
        .eq('id', jobId)

      if (error) console.error('Failed to update job status:', error)
    }
  }

  /**
   * Link all unlinked emails
   */
  async linkUnlinkedEmails(limit: number = 100): Promise<{
    processed: number
    linked: number
    errors: number
  }> {
    const { data: emails } = await this.supabase
      .from('emails')
      .select('*')
      .eq('is_job_related', true)
      .is('linked_job_id', null)
      .order('received_at', { ascending: false })
      .limit(limit)

    if (!emails) return { processed: 0, linked: 0, errors: 0 }

    let linked = 0
    let errors = 0

    for (const email of emails) {
      try {
        const result = await this.linkEmailToJob(email)
        if (result) linked++
      } catch (error) {
        console.error(`Failed to link email ${email.id}:`, error)
        errors++
      }
    }

    return {
      processed: emails.length,
      linked,
      errors
    }
  }

  /**
   * Get job suggestions for manual linking
   */
  async getJobSuggestions(
    emailId: string,
    limit: number = 5
  ): Promise<Array<{
    job: Job
    confidence: number
    reason: string
  }>> {
    const { data: email } = await this.supabase
      .from('emails')
      .select('*')
      .eq('id', emailId)
      .single()

    if (!email || !email.is_job_related) return []

    const suggestions: Array<{
      job: Job
      confidence: number
      reason: string
    }> = []

    // Try to find jobs by company
    if (email.extracted_company) {
      const { data: companyJobs } = await this.supabase
        .from('my_jobs')
        .select('*')
        .ilike('company', `%${email.extracted_company}%`)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (companyJobs) {
        companyJobs.forEach(job => {
          suggestions.push({
            job,
            confidence: 0.6,
            reason: `Company name matches: ${email.extracted_company}`
          })
        })
      }
    }

    // Try by domain
    const senderDomain = email.sender_email?.split('@')[1]
    if (senderDomain && !senderDomain.includes('gmail.com')) {
      const { data: domainJobs } = await this.supabase
        .from('my_jobs')
        .select('*')
        .or(`company.ilike.%${senderDomain}%,url.ilike.%${senderDomain}%`)
        .order('created_at', { ascending: false })
        .limit(3)

      if (domainJobs) {
        domainJobs.forEach(job => {
          if (!suggestions.find(s => s.job.id === job.id)) {
            suggestions.push({
              job,
              confidence: 0.5,
              reason: `Email domain matches company`
            })
          }
        })
      }
    }

    // Sort by confidence and limit
    return suggestions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, limit)
  }

  /**
   * Manually link email to job
   */
  async manuallyLinkEmail(emailId: string, jobId: string): Promise<void> {
    await this.updateEmailJobLink(emailId, jobId)
    
    // Also check if we should update job status
    const { data: email } = await this.supabase
      .from('emails')
      .select('*')
      .eq('id', emailId)
      .single()

    if (email) {
      await this.updateJobStatusFromEmail(jobId, email)
    }
  }

  /**
   * Unlink email from job
   */
  async unlinkEmail(emailId: string): Promise<void> {
    const { error } = await this.supabase
      .from('emails')
      .update({
        linked_job_id: null,
        updated_at: new Date()
      })
      .eq('id', emailId)

    if (error) throw error
  }

  /**
   * Get linking statistics
   */
  async getLinkingStats(): Promise<{
    totalJobEmails: number
    linkedEmails: number
    unlinkableEmails: number
    linkingRate: number
  }> {
    const { data: stats } = await this.supabase
      .from('emails')
      .select('linked_job_id', { count: 'exact' })
      .eq('is_job_related', true)

    const total = stats?.length || 0
    const linked = stats?.filter(e => e.linked_job_id !== null).length || 0

    // Count potentially unlinkable emails (e.g., cold outreach, job alerts)
    const { count: unlinkable } = await this.supabase
      .from('emails')
      .select('*', { count: 'exact', head: true })
      .eq('is_job_related', true)
      .is('linked_job_id', null)
      .or('email_type.eq.cold_outreach,email_type.eq.job_alert,email_type.eq.networking')

    return {
      totalJobEmails: total,
      linkedEmails: linked,
      unlinkableEmails: unlinkable || 0,
      linkingRate: total > 0 ? linked / total : 0
    }
  }
}

export const jobLinker = new JobLinker()