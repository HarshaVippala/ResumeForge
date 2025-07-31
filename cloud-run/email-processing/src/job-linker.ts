/**
 * Job Linking Service for Cloud Run
 * Matches emails to job applications using multiple strategies
 * 
 * Created: 2025-01-11
 */

import { createClient } from '@supabase/supabase-js';

interface Job {
  id: string;
  company: string;
  title: string;
  url?: string;
  created_at: string;
  status?: string;
}

interface EmailData {
  id: string;
  thread_id?: string;
  sender_email?: string;
  body_text?: string;
  company?: string;
  position?: string;
  application_status?: string;
  received_at: string;
}

interface MatchResult {
  jobId: string;
  confidence: number;
  strategy: string;
  details: any;
}

export class JobLinker {
  private supabase;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_KEY!
    );
  }

  /**
   * Attempt to link email to job using multiple strategies
   * Returns null if no suitable match found
   */
  async linkEmailToJob(email: EmailData): Promise<MatchResult | null> {
    // Try multiple matching strategies in order of confidence
    const strategies = [
      { name: 'exactCompanyPosition', fn: () => this.matchByExactCompanyPosition(email) },
      { name: 'domainMatch', fn: () => this.matchByCompanyDomain(email) },
      { name: 'threadHistory', fn: () => this.matchByThreadHistory(email) },
      { name: 'timeProximity', fn: () => this.matchByTimeProximity(email) }
    ];

    for (const strategy of strategies) {
      try {
        const result = await strategy.fn();
        
        // Only link if we have high confidence (>= 0.75)
        if (result && result.confidence >= 0.75) {
          return {
            ...result,
            strategy: strategy.name
          };
        }
      } catch (error) {
        console.error(`Job linking strategy ${strategy.name} failed:`, error);
      }
    }

    // No match found - this is OK
    return null;
  }

  /**
   * Match by exact company name and position
   */
  private async matchByExactCompanyPosition(email: EmailData): Promise<MatchResult | null> {
    if (!email.company || !email.position) return null;

    const { data: jobs } = await this.supabase
      .from('my_jobs')
      .select('*')
      .ilike('company', `%${email.company}%`)
      .ilike('title', `%${email.position}%`)
      .order('created_at', { ascending: false })
      .limit(5);

    if (!jobs || jobs.length === 0) return null;

    // Calculate similarity scores
    const matches = jobs.map(job => {
      const companyScore = this.calculateSimilarity(
        job.company.toLowerCase(),
        email.company!.toLowerCase()
      );
      const positionScore = this.calculateSimilarity(
        job.title.toLowerCase(),
        email.position!.toLowerCase()
      );
      
      return {
        job,
        score: (companyScore + positionScore) / 2
      };
    });

    const bestMatch = matches.reduce((prev, curr) => 
      curr.score > prev.score ? curr : prev
    );

    if (bestMatch.score >= 0.8) {
      return {
        jobId: bestMatch.job.id,
        confidence: bestMatch.score,
        strategy: 'exactCompanyPosition',
        details: {
          companyMatch: email.company,
          positionMatch: email.position
        }
      };
    }

    return null;
  }

  /**
   * Match by company email domain
   */
  private async matchByCompanyDomain(email: EmailData): Promise<MatchResult | null> {
    if (!email.sender_email) return null;

    // Extract sender domain
    const senderDomain = email.sender_email.split('@')[1];
    if (!senderDomain || senderDomain.includes('gmail.com')) return null;

    // Get jobs from the same company domain
    const { data: jobs } = await this.supabase
      .from('my_jobs')
      .select('*')
      .or(`company.ilike.%${senderDomain}%,url.ilike.%${senderDomain}%`)
      .order('created_at', { ascending: false })
      .limit(10);

    if (!jobs || jobs.length === 0) return null;

    // If position is mentioned, try to match it
    if (email.position) {
      const positionMatches = jobs.filter(job =>
        this.calculateSimilarity(
          job.title.toLowerCase(),
          email.position!.toLowerCase()
        ) > 0.6
      );
      
      if (positionMatches.length > 0) {
        return {
          jobId: positionMatches[0].id,
          confidence: 0.85,
          strategy: 'domainMatch',
          details: {
            domain: senderDomain,
            positionMatch: email.position
          }
        };
      }
    }

    // Return most recent job from the company
    return {
      jobId: jobs[0].id,
      confidence: 0.7,
      strategy: 'domainMatch',
      details: {
        domain: senderDomain,
        jobCount: jobs.length
      }
    };
  }

  /**
   * Match by thread history
   */
  private async matchByThreadHistory(email: EmailData): Promise<MatchResult | null> {
    if (!email.thread_id) return null;

    // Check if other emails in thread are already linked
    const { data: linkedEmails } = await this.supabase
      .from('emails')
      .select('job_id')
      .eq('thread_id', email.thread_id)
      .not('job_id', 'is', null)
      .order('received_at', { ascending: false })
      .limit(5);

    if (!linkedEmails || linkedEmails.length === 0) return null;

    // Get most common job ID
    const jobCounts = new Map<string, number>();
    linkedEmails.forEach(e => {
      if (e.job_id) {
        jobCounts.set(e.job_id, (jobCounts.get(e.job_id) || 0) + 1);
      }
    });

    let maxCount = 0;
    let mostCommonJobId: string | null = null;
    jobCounts.forEach((count, jobId) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommonJobId = jobId;
      }
    });

    if (mostCommonJobId) {
      return {
        jobId: mostCommonJobId,
        confidence: Math.min(0.9, 0.7 + (maxCount * 0.1)),
        strategy: 'threadHistory',
        details: {
          linkedEmailCount: maxCount,
          totalThreadEmails: linkedEmails.length
        }
      };
    }

    return null;
  }

  /**
   * Match by time proximity to application
   */
  private async matchByTimeProximity(email: EmailData): Promise<MatchResult | null> {
    if (!email.company) return null;

    const emailDate = new Date(email.received_at);
    const daysBefore = 3;
    const daysAfter = 30;

    // Find jobs applied around the email date
    const { data: jobs } = await this.supabase
      .from('my_jobs')
      .select('*')
      .ilike('company', `%${email.company}%`)
      .gte('created_at', new Date(emailDate.getTime() - daysBefore * 24 * 60 * 60 * 1000).toISOString())
      .lte('created_at', new Date(emailDate.getTime() + daysAfter * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });

    if (!jobs || jobs.length === 0) return null;

    // Calculate time-based confidence
    const bestMatch = jobs.map(job => {
      const jobDate = new Date(job.created_at);
      const daysDiff = Math.abs((emailDate.getTime() - jobDate.getTime()) / (24 * 60 * 60 * 1000));
      
      // Higher confidence for emails received after application
      const isAfterApplication = emailDate > jobDate;
      const baseConfidence = isAfterApplication ? 0.7 : 0.5;
      
      // Reduce confidence based on time distance
      const confidence = baseConfidence * Math.max(0.5, 1 - (daysDiff / 30));
      
      return { job, confidence, daysDiff };
    }).reduce((prev, curr) => curr.confidence > prev.confidence ? curr : prev);

    if (bestMatch.confidence >= 0.6) {
      return {
        jobId: bestMatch.job.id,
        confidence: bestMatch.confidence,
        strategy: 'timeProximity',
        details: {
          daysDifference: Math.round(bestMatch.daysDiff),
          applicationDate: bestMatch.job.created_at
        }
      };
    }

    return null;
  }

  /**
   * Calculate string similarity (simplified for Cloud Run)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    // Simple character-based similarity for performance
    const set1 = new Set(str1.split(''));
    const set2 = new Set(str2.split(''));
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  /**
   * Update job status based on email content
   */
  async updateJobStatusFromEmail(jobId: string, email: EmailData): Promise<void> {
    if (!email.application_status) return;

    // Map email status to job status
    const statusMap: Record<string, string> = {
      'interview_scheduled': 'interview',
      'offer': 'offer',
      'rejected': 'rejected',
      'applied': 'applied'
    };

    const newStatus = statusMap[email.application_status];
    if (!newStatus) return;

    // Get current job
    const { data: job } = await this.supabase
      .from('my_jobs')
      .select('status, updated_at')
      .eq('id', jobId)
      .single();

    if (!job) return;

    // Only update if email is newer than last job update
    if (new Date(email.received_at) > new Date(job.updated_at)) {
      await this.supabase
        .from('my_jobs')
        .update({
          status: newStatus,
          updated_at: new Date()
        })
        .eq('id', jobId);
    }
  }
}

export const jobLinker = new JobLinker();