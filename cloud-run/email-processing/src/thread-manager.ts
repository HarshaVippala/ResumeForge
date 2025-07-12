/**
 * Simplified Thread Management for Cloud Run
 * Provides thread context awareness and basic thread handling
 * 
 * Created: 2025-01-11
 */

import { createClient } from '@supabase/supabase-js';

interface ThreadEmail {
  id: string;
  gmail_id: string;
  thread_id: string;
  subject: string;
  sender: string;
  recipients: string[];
  received_at: string;
  body_text: string;
  is_job_related?: boolean;
  company?: string;
  position?: string;
}

interface ThreadSummary {
  thread_id: string;
  message_count: number;
  participants: {
    internal: string[];
    external: string[];
  };
  requires_action: boolean;
  last_sender_external: boolean;
  summary: string;
  thread_highlights: string[];
  primary_company?: string;
}

export class ThreadManager {
  private supabase;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_KEY!
    );
  }

  /**
   * Check if an email is part of a thread
   */
  isPartOfThread(email: any): boolean {
    // Check for thread indicators in headers
    const headers = email.payload?.headers || [];
    const inReplyTo = headers.find((h: any) => h.name === 'In-Reply-To');
    const references = headers.find((h: any) => h.name === 'References');
    
    // If email has these headers, it's part of a thread
    return !!(inReplyTo || references);
  }

  /**
   * Get all emails in a thread
   */
  async getThreadEmails(threadId: string): Promise<ThreadEmail[]> {
    const { data, error } = await this.supabase
      .from('emails')
      .select('*')
      .eq('thread_id', threadId)
      .order('received_at', { ascending: true });

    if (error || !data) {
      console.error('Failed to fetch thread emails:', error);
      return [];
    }

    return data;
  }

  /**
   * Generate thread summary and analysis
   */
  async analyzeThread(threadId: string, currentEmailId: string): Promise<ThreadSummary> {
    const emails = await this.getThreadEmails(threadId);
    
    if (emails.length === 0) {
      return this.createEmptyThreadSummary(threadId);
    }

    // Extract participants
    const internalEmails = ['harsha.vippala1@gmail.com']; // TODO: Make configurable
    const participants = this.extractParticipants(emails, internalEmails);

    // Check if response is needed
    const lastEmail = emails[emails.length - 1];
    const lastSenderExternal = !internalEmails.some(email => 
      lastEmail.sender.toLowerCase().includes(email.toLowerCase())
    );
    const requiresAction = this.checkRequiresAction(lastEmail, lastSenderExternal);

    // Generate summary
    const summary = this.generateThreadSummary(emails);
    
    // Extract highlights (important events)
    const highlights = this.extractThreadHighlights(emails);

    // Find primary company
    const primaryCompany = this.findPrimaryCompany(emails);

    return {
      thread_id: threadId,
      message_count: emails.length,
      participants,
      requires_action: requiresAction,
      last_sender_external: lastSenderExternal,
      summary,
      thread_highlights: highlights,
      primary_company: primaryCompany
    };
  }

  /**
   * Extract participants from thread
   */
  private extractParticipants(emails: ThreadEmail[], internalEmails: string[]) {
    const internal = new Set<string>();
    const external = new Set<string>();

    emails.forEach(email => {
      const sender = this.extractEmailAddress(email.sender);
      
      if (internalEmails.some(int => sender.toLowerCase().includes(int.toLowerCase()))) {
        internal.add(sender);
      } else {
        external.add(sender);
      }

      // Also check recipients
      email.recipients?.forEach(recipient => {
        const recipientEmail = this.extractEmailAddress(recipient);
        if (internalEmails.some(int => recipientEmail.toLowerCase().includes(int.toLowerCase()))) {
          internal.add(recipientEmail);
        } else {
          external.add(recipientEmail);
        }
      });
    });

    return {
      internal: Array.from(internal),
      external: Array.from(external)
    };
  }

  /**
   * Check if thread requires user action
   */
  private checkRequiresAction(lastEmail: ThreadEmail, lastSenderExternal: boolean): boolean {
    if (!lastSenderExternal) return false;

    const actionKeywords = [
      'please respond',
      'let me know',
      'get back to',
      'waiting for',
      'confirm',
      'your availability',
      'are you available',
      'thoughts?',
      'what do you think',
      'looking forward to hearing'
    ];

    const bodyLower = lastEmail.body_text.toLowerCase();
    return actionKeywords.some(keyword => bodyLower.includes(keyword));
  }

  /**
   * Generate human-readable thread summary
   */
  private generateThreadSummary(emails: ThreadEmail[]): string {
    const jobRelatedEmails = emails.filter(e => e.is_job_related);
    
    if (jobRelatedEmails.length === 0) {
      return `Thread with ${emails.length} emails`;
    }

    const companies = [...new Set(jobRelatedEmails.map(e => e.company).filter(Boolean))];
    const positions = [...new Set(jobRelatedEmails.map(e => e.position).filter(Boolean))];

    if (companies.length > 0 && positions.length > 0) {
      return `${positions[0]} opportunity at ${companies[0]} - ${emails.length} messages`;
    } else if (companies.length > 0) {
      return `Conversation with ${companies[0]} - ${emails.length} messages`;
    } else {
      return `Job-related thread - ${emails.length} messages`;
    }
  }

  /**
   * Extract important highlights from thread
   */
  private extractThreadHighlights(emails: ThreadEmail[]): string[] {
    const highlights: string[] = [];

    emails.forEach(email => {
      const bodyLower = email.body_text.toLowerCase();
      
      if (bodyLower.includes('interview') && bodyLower.includes('scheduled')) {
        highlights.push('Interview scheduled');
      }
      if (bodyLower.includes('offer') && (bodyLower.includes('pleased') || bodyLower.includes('excited'))) {
        highlights.push('Job offer extended');
      }
      if (bodyLower.includes('unfortunately') || bodyLower.includes('not selected')) {
        highlights.push('Application rejected');
      }
      if (bodyLower.includes('next steps') || bodyLower.includes('move forward')) {
        highlights.push('Moving to next stage');
      }
    });

    return [...new Set(highlights)]; // Remove duplicates
  }

  /**
   * Find primary company in thread
   */
  private findPrimaryCompany(emails: ThreadEmail[]): string | undefined {
    const companyCount = new Map<string, number>();
    
    emails.forEach(email => {
      if (email.company) {
        companyCount.set(email.company, (companyCount.get(email.company) || 0) + 1);
      }
      
      // Also try to extract from sender domain
      const domain = this.extractDomain(email.sender);
      if (domain && !domain.includes('gmail') && !domain.includes('outlook')) {
        const company = this.domainToCompany(domain);
        companyCount.set(company, (companyCount.get(company) || 0) + 1);
      }
    });

    // Return most frequent company
    let maxCount = 0;
    let primaryCompany: string | undefined;
    
    companyCount.forEach((count, company) => {
      if (count > maxCount) {
        maxCount = count;
        primaryCompany = company;
      }
    });

    return primaryCompany;
  }

  /**
   * Extract email address from sender string
   */
  private extractEmailAddress(sender: string): string {
    const match = sender.match(/<(.+?)>/);
    return match ? match[1] : sender;
  }

  /**
   * Extract domain from email
   */
  private extractDomain(email: string): string | null {
    const address = this.extractEmailAddress(email);
    const parts = address.split('@');
    return parts.length === 2 ? parts[1] : null;
  }

  /**
   * Convert domain to company name
   */
  private domainToCompany(domain: string): string {
    return domain.split('.')[0]
      .replace(/-/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  /**
   * Create empty thread summary
   */
  private createEmptyThreadSummary(threadId: string): ThreadSummary {
    return {
      thread_id: threadId,
      message_count: 0,
      participants: { internal: [], external: [] },
      requires_action: false,
      last_sender_external: false,
      summary: 'Empty thread',
      thread_highlights: [],
      primary_company: undefined
    };
  }

  /**
   * Check if email is job-related based on thread context
   */
  async isThreadJobRelated(threadId: string): Promise<boolean> {
    const emails = await this.getThreadEmails(threadId);
    return emails.some(email => email.is_job_related === true);
  }
}

export const threadManager = new ThreadManager();