import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../db/types';
import { getSupabaseServiceClient } from '../db';
import { 
  AIEmailProcessor, 
  ClassificationResult, 
  EnhancedExtractedJobData,
  EmailSummary,
  ProcessingMetrics,
  JobRelatedCategory
} from './ai-processor';
import { threadManager } from './thread-manager';
import { jobLinker } from './job-linker';
import { conversationAnalyzer } from './conversation-analyzer';
import { enhancedLabelingEngine } from './enhanced-labeling';
import { ProcessedEmail } from './types';

// Types for email processing
export interface EmailProcessingResult {
  emailId: string;
  success: boolean;
  classification?: ClassificationResult;
  extracted?: EnhancedExtractedJobData;
  summary?: EmailSummary;
  confidence?: {
    classification: number;
    extraction: number;
  };
  metrics?: ProcessingMetrics;
  error?: string;
  linkedJobId?: string;
}

export interface ProcessingQueueItem {
  id: string;
  priority: number;
  createdAt: Date;
  attempts: number;
}

export interface BatchProcessingOptions {
  batchSize?: number;
  maxRetries?: number;
  priorityThreshold?: number;
  includeProcessed?: boolean;
}

/**
 * Email Processing Service
 * Integrates AI processing with database operations
 * 
 * Updated 2025-01-09: Added intelligent thread detection to only process actual
 * email threads (multiple messages) vs single emails where thread_id = gmail_id
 */
export class EmailProcessingService {
  private db: SupabaseClient<Database>;
  private aiProcessor: AIEmailProcessor;
  private processingQueue: Map<string, ProcessingQueueItem>;
  private isProcessing: boolean;

  constructor() {
    // Use service client to bypass RLS for email operations
    this.db = getSupabaseServiceClient();
    this.aiProcessor = new AIEmailProcessor();
    this.processingQueue = new Map();
    this.isProcessing = false;
  }

  /**
   * Process a single email with AI and update database
   */
  async processEmail(emailId: string): Promise<EmailProcessingResult> {
    try {
      // Fetch email from database
      const { data: email, error: fetchError } = await this.db
        .from('emails')
        .select('*')
        .eq('id', emailId)
        .single();

      if (fetchError || !email) {
        throw new Error(`Failed to fetch email: ${fetchError?.message || 'Email not found'}`);
      }

      // Skip if already processed (unless forced)
      if (email.ai_processed) {
        return {
          emailId,
          success: true,
          error: 'Email already processed'
        };
      }

      // Extract sender email and name from sender field
      const senderMatch = email.sender.match(/^(.+?)\s*<(.+?)>$/);
      const senderName = senderMatch ? senderMatch[1].trim() : '';
      const senderEmail = senderMatch ? senderMatch[2].trim() : email.sender;

      // Import content cleaner for processing
      const { cleanEmailForDisplay } = require('../utils/content-cleaner');
      
      // Clean email content before processing
      const cleanedContent = cleanEmailForDisplay({
        body_html: email.body_html,
        body_text: email.body_text,
        subject: email.subject
      });
      
      // Convert to ProcessedEmail format for AI processor
      const processedEmail = {
        id: email.id,
        messageId: email.gmail_id,
        threadId: email.thread_id,
        historyId: '', // Not stored in current schema
        subject: email.subject || '',
        snippet: cleanedContent.snippet || email.subject?.substring(0, 100) || '', // Use cleaned snippet
        bodyText: cleanedContent.content || email.body_text || '', // Use cleaned content
        bodyHtml: email.body_html || '', // Keep original HTML for reference
        senderEmail: senderEmail,
        senderName: senderName,
        recipientEmails: email.recipients || [],
        receivedAt: new Date(email.received_at || new Date()),
        gmailLabels: email.labels || [],
        rawEmail: {} as any // Not storing raw email in DB
      };

      // Process with AI with fallback mechanism
      const aiResult = await this.processEmailWithFallback(processedEmail);

      // Prepare update data using actual schema fields
      const updateData = {
        ai_processed: true,
        is_job_related: aiResult.classification.isJobRelated,
        email_type: this.mapCategoryToDbConstraint(aiResult.classification.category),
        job_confidence: aiResult.confidence?.classification || null,
        classification_confidence: aiResult.confidence?.classification || null,
        requires_action: this.determineRequiresAction(processedEmail, aiResult.classification, aiResult.extracted),
        thread_summary: aiResult.summary?.summary || null,
        processing_version: '2.0', // Version tracking for future processing changes
        labels: this.generateEnhancedTags(processedEmail, aiResult.classification, aiResult.extracted),
        // New metadata columns
        company: aiResult.extracted?.company || null,
        position: aiResult.extracted?.position || null,
        sender_name: senderName || null,
        sender_email: senderEmail || null
      };

      // Store extracted data in metadata for future use with null safety
      const extractedMetadata = {
        company: aiResult.extracted?.company || null,
        position: aiResult.extracted?.position || null,
        applicationStatus: aiResult.extracted?.applicationStatus || null,
        nextAction: aiResult.extracted?.nextAction || null,
        summary: aiResult.summary || null,
        confidence: aiResult.confidence || null
      };

      // Update database with processing results
      const { error: updateError } = await this.db
        .from('emails')
        .update(updateData)
        .eq('id', emailId);

      if (updateError) {
        throw new Error(`Failed to update email: ${updateError.message}`);
      }

      // Store extracted metadata in activity log for tracking
      try {
        await this.db
          .from('activity_log')
          .insert({
            event_type: 'email_processed',
            entity_type: 'email',
            entity_id: emailId,
            description: `Email processed with AI: ${aiResult.classification?.isJobRelated ? 'job-related' : 'not job-related'}`,
            metadata: extractedMetadata,
            source: 'email_processor'
          });
      } catch (logError) {
        console.error('Failed to log activity:', logError);
        // Non-critical error, continue processing
      }

      // Thread management - only process actual threads (multiple messages)
      if (email.thread_id && await this.isActualThread(email.thread_id, email.gmail_id)) {
        try {
          // Get all emails in the thread
          const { data: threadEmails } = await this.db
            .from('emails')
            .select('*')
            .eq('thread_id', email.thread_id)
            .order('received_at', { ascending: true });

          if (threadEmails && threadEmails.length > 1) {
            await threadManager.upsertThread(
              email.thread_id,
              threadEmails.map(e => {
                const emailSenderString = e.sender || '';
                const emailSenderMatch = emailSenderString.match(/^(.+?)\s*<(.+?)>$/);
                const emailSenderName = emailSenderMatch ? emailSenderMatch[1].trim() : '';
                const emailSenderEmail = emailSenderMatch ? emailSenderMatch[2].trim() : emailSenderString;
                
                return {
                  id: e.gmail_id,
                  threadId: e.thread_id,
                  internalDate: new Date(e.received_at || new Date()).getTime().toString(),
                  subject: e.subject || '',
                  payload: {
                    headers: [
                      { name: 'From', value: emailSenderName ? `${emailSenderName} <${emailSenderEmail}>` : emailSenderEmail },
                      { name: 'To', value: e.recipients?.[0] || '' },
                      { name: 'Subject', value: e.subject || '' }
                    ],
                    body: { data: Buffer.from(e.body_text || '').toString('base64') }
                  }
                };
              })
            );
          }
        } catch (threadError) {
          console.error(`Thread management failed for thread ${email.thread_id}, email ${emailId}:`, {
            error: threadError instanceof Error ? threadError.message : 'Unknown error',
            threadId: email.thread_id,
            emailId
          });
          // Non-critical error, continue processing
        }
      }

      // Job linking - attempt to link if job-related
      let jobLinkResult = null;
      if (aiResult.classification.isJobRelated) {
        try {
          jobLinkResult = await jobLinker.linkEmailToJob({
            id: emailId,
            is_job_related: true,
            thread_id: email.thread_id,
            sender_email: senderEmail, // Note: This field doesn't exist in current schema
            received_at: email.received_at,
            body_text: email.body_text || '',
            extracted_company: aiResult.extracted?.company,
            extracted_position: aiResult.extracted?.position,
            extracted_status: aiResult.extracted.applicationStatus,
            linked_job_id: null
          } as any);
        } catch (linkError) {
          console.error('Job linking failed:', linkError);
          // Non-critical error, continue processing
        }
      }

      // Analyze thread conversation if part of an actual thread and job-related
      if (email.thread_id && aiResult.classification.isJobRelated && await this.isActualThread(email.thread_id, email.gmail_id)) {
        try {
          const { data: threadEmails } = await this.db
            .from('emails')
            .select('*')
            .eq('thread_id', email.thread_id)
            .order('received_at', { ascending: true });

          if (threadEmails && threadEmails.length > 1) {
            const conversation = await conversationAnalyzer.analyzeConversation(
              threadEmails.map(e => {
                const emailSenderString = e.sender || '';
                const emailSenderMatch = emailSenderString.match(/^(.+?)\s*<(.+?)>$/);
                const emailSenderName = emailSenderMatch ? emailSenderMatch[1].trim() : '';
                const emailSenderEmail = emailSenderMatch ? emailSenderMatch[2].trim() : emailSenderString;
                
                return {
                  sender: emailSenderName || emailSenderEmail,
                  subject: e.subject || '',
                  body: e.body_text || '',
                  date: new Date(e.received_at || new Date()),
                  isFromUser: emailSenderEmail === 'harsha.vippala1@gmail.com'
                };
              })
            );

            await threadManager.updateThreadAnalysis(email.thread_id, {
              summary: conversation?.summary,
              sentiment: conversation.sentiment,
              stage: conversation.stage,
              applicationStatus: conversation.applicationStatus,
              confidence: conversation.confidence
            });
          }
        } catch (analysisError) {
          console.error(`Thread analysis failed for thread ${email.thread_id}, email ${emailId}:`, {
            error: analysisError instanceof Error ? analysisError.message : 'Unknown error',
            threadId: email.thread_id,
            emailId
          });
          // Non-critical error, continue processing
        }
      }

      return {
        emailId,
        success: true,
        classification: aiResult.classification,
        extracted: aiResult.extracted,
        summary: aiResult.summary || null,
        confidence: aiResult.confidence,
        metrics: aiResult.metrics,
        linkedJobId: jobLinkResult?.jobId
      } as EmailProcessingResult;

    } catch (error) {
      console.error(`Error processing email ${emailId}:`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        emailId
      });
      
      // Update database with error status and details
      try {
        await this.db
          .from('emails')
          .update({
            ai_processed: false
          })
          .eq('id', emailId);
          
        // Log the error for debugging
        await this.db
          .from('activity_log')
          .insert({
            event_type: 'email_processing_error',
            entity_type: 'email',
            entity_id: emailId,
            description: `Email processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            metadata: {
              error: error instanceof Error ? error.message : 'Unknown error',
              stack: error instanceof Error ? error.stack : undefined
            },
            source: 'email_processor'
          });
      } catch (logError) {
        console.error('Failed to log processing error:', logError);
      }

      return {
        emailId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Process multiple emails in batch
   */
  async processBatch(
    emailIds: string[], 
    options: BatchProcessingOptions = {}
  ): Promise<EmailProcessingResult[]> {
    const {
      batchSize = 5,
      maxRetries = 3
    } = options;

    const results: EmailProcessingResult[] = [];

    // Process in batches
    for (let i = 0; i < emailIds.length; i += batchSize) {
      const batch = emailIds.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (emailId) => {
        let attempts = 0;
        let result: EmailProcessingResult | null = null;

        while (attempts < maxRetries && (!result || !result.success)) {
          attempts++;
          
          try {
            result = await this.processEmail(emailId);
          } catch (error) {
            console.error(`Processing attempt ${attempts} failed for email ${emailId}:`, {
              error: error instanceof Error ? error.message : 'Unknown error',
              attempt: attempts,
              maxRetries
            });
            
            // If this is the last attempt, create a fallback result
            if (attempts === maxRetries) {
              result = {
                emailId,
                success: false,
                error: `Failed after ${maxRetries} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`
              };
            }
          }
          
          if (!result?.success && attempts < maxRetries) {
            // Exponential backoff for retries
            const delay = Math.pow(2, attempts) * 1000;
            console.log(`Retrying email ${emailId} in ${delay}ms (attempt ${attempts}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }

        return result || { emailId, success: false, error: 'Max retries exceeded' };
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // The AI processor now handles rate limiting internally via aiRateLimiter
    }

    return results;
  }

  /**
   * Fetch unprocessed emails from database
   */
  async fetchUnprocessedEmails(
    limit: number = 100,
    priorityOnly: boolean = false
  ): Promise<string[]> {
    let query = this.db
      .from('emails')
      .select('id, received_at')
      .eq('ai_processed', false)
      .order('received_at', { ascending: false })
      .limit(limit);

    // Add priority filter if requested
    if (priorityOnly) {
      // Recent emails (last 7 days) are high priority
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      query = query.gte('received_at', sevenDaysAgo.toISOString());
    }

    const { data, error } = await query;

    if (error || !data) {
      console.error('Failed to fetch unprocessed emails:', error);
      return [];
    }

    return data.map(email => email.id);
  }

  /**
   * Process all unprocessed emails with queue management
   */
  async processUnprocessedEmails(options: BatchProcessingOptions = {}): Promise<{
    processed: number;
    failed: number;
    skipped: number;
    results: EmailProcessingResult[];
  }> {
    if (this.isProcessing) {
      return {
        processed: 0,
        failed: 0,
        skipped: 0,
        results: []
      };
    }

    this.isProcessing = true;

    try {
      // Fetch unprocessed emails
      const emailIds = await this.fetchUnprocessedEmails(100, false); // priorityThreshold removed

      if (emailIds.length === 0) {
        return {
          processed: 0,
          failed: 0,
          skipped: 0,
          results: []
        };
      }

      // Build priority queue
      this.buildPriorityQueue(emailIds);

      // Process emails in priority order
      const sortedIds = this.getSortedQueueIds();
      const results = await this.processBatch(sortedIds, options);

      // Calculate statistics
      const processed = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      const skipped = emailIds.length - results.length;

      return {
        processed,
        failed,
        skipped,
        results
      };

    } finally {
      this.isProcessing = false;
      this.processingQueue.clear();
    }
  }

  /**
   * Build priority queue for processing
   */
  private buildPriorityQueue(emailIds: string[]): void {
    this.processingQueue.clear();

    emailIds.forEach((id, index) => {
      // Higher priority for more recent emails (lower index)
      const priority = emailIds.length - index;
      
      this.processingQueue.set(id, {
        id,
        priority,
        createdAt: new Date(),
        attempts: 0
      });
    });
  }

  /**
   * Get email IDs sorted by priority
   */
  private getSortedQueueIds(): string[] {
    return Array.from(this.processingQueue.values())
      .sort((a, b) => b.priority - a.priority) // Note: priority field doesn't exist in current schema
      .map(item => item.id);
  }

  // Note: normalizeCompanyName and normalizePosition methods removed as they were unused
  // The enhanced labeling system uses its own normalization methods

  /**
   * Map AI processor categories to database constraint values
   */
  private mapCategoryToDbConstraint(category: JobRelatedCategory): string {
    // Updated database constraint mapping with new categories
    const categoryMapping: Record<JobRelatedCategory, string> = {
      'application_confirmation': 'application_submitted',  // Updated mapping
      'recruiter_outreach': 'recruiter_outreach',
      'interview_invitation': 'interview_request',      
      'interview_reminder': 'interview_request',        
      'offer': 'offer',
      'rejection': 'rejection',
      'follow_up': 'followup',                          // Now has its own category
      'job_alert': 'general',                          
      'networking': 'general',                         
      'not_job_related': 'general'                     
    };

    return categoryMapping[category] || 'general';
  }

  /**
   * Generate enhanced labels using the new labeling system
   */
  private generateEnhancedTags(
    email: ProcessedEmail,
    classification: ClassificationResult,
    extracted: EnhancedExtractedJobData
  ): string[] {
    const labelingResult = enhancedLabelingEngine.generateLabels(email, classification, extracted);
    
    // Convert predefined labels to strings and add company/position tags
    const labels: string[] = [...labelingResult.labels];
    
    // Add company tag if available
    if (extracted?.company) {
      const normalizedCompany = this.normalizeCompanyNameForLabels(extracted.company);
      if (normalizedCompany) {
        labels.push(`company_${normalizedCompany}`);
      }
    }
    
    // Add position tag if available  
    if (extracted?.position) {
      const normalizedPosition = this.normalizePositionForLabels(extracted.position);
      if (normalizedPosition) {
        labels.push(`position_${normalizedPosition}`);
      }
    }
    
    // Add priority tag
    labels.push(`priority_${labelingResult.priority}`);
    
    // Add time-sensitive tag if applicable
    if (labelingResult.timeSensitive) {
      labels.push('time_sensitive');
    }
    
    return labels.filter(tag => tag && tag.length > 0);
  }

  /**
   * Normalize company name for labeling (creates tag-friendly format)
   */
  private normalizeCompanyNameForLabels(company: string): string {
    return company
      .toLowerCase()
      .replace(/\s+(inc|llc|ltd|corp|corporation|company|co)\.?$/i, '')
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, '_')
      .trim();
  }

  /**
   * Normalize position for labeling (creates tag-friendly format)
   */
  private normalizePositionForLabels(position: string): string {
    return position
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, '_')
      .trim();
  }

  /**
   * Determine if email requires action using enhanced labeling
   */
  private determineRequiresAction(
    email: ProcessedEmail,
    classification: ClassificationResult,
    extracted: EnhancedExtractedJobData
  ): boolean {
    const labelingResult = enhancedLabelingEngine.generateLabels(email, classification, extracted);
    return labelingResult.requiresAction;
  }

  /**
   * Get processing statistics
   */
  async getProcessingStats(): Promise<{
    total: number;
    processed: number;
    unprocessed: number;
    jobRelated: number;
    byCategory: Record<string, number>;
    byPriority: Record<string, number>;
  }> {
    const { data, error } = await this.db
      .from('emails')
      .select('ai_processed, is_job_related, email_type');

    if (error || !data) {
      console.error('Failed to fetch processing stats:', error);
      return {
        total: 0,
        processed: 0,
        unprocessed: 0,
        jobRelated: 0,
        byCategory: {},
        byPriority: {}
      };
    }

    const stats = {
      total: data.length,
      processed: data.filter(e => e.ai_processed).length,
      unprocessed: data.filter(e => !e.ai_processed).length,
      jobRelated: data.filter(e => e.is_job_related).length,
      byCategory: {} as Record<string, number>,
      byPriority: {} as Record<string, number>
    };

    // Count by category
    data.forEach(email => {
      if (email.email_type) {
        stats.byCategory[email.email_type] = (stats.byCategory[email.email_type] || 0) + 1;
      }
      // Note: priority field doesn't exist in current schema, keeping empty for compatibility
    });

    return stats;
  }

  /**
   * Reprocess emails that failed or need updates
   */
  async reprocessFailedEmails(limit: number = 50): Promise<EmailProcessingResult[]> {
    const { data, error } = await this.db
      .from('emails')
      .select('id')
      .eq('ai_processed', false)
      .limit(limit);

    if (error || !data) {
      console.error('Failed to fetch failed emails:', error);
      return [];
    }

    const emailIds = data.map(e => e.id);
    return this.processBatch(emailIds, { maxRetries: 2 });
  }

  /**
   * Check if this is an actual thread (multiple messages) or just a single email
   * In Gmail, single emails have thread_id === message_id (gmail_id)
   */
  private async isActualThread(threadId: string, gmailId: string): Promise<boolean> {
    // Quick check: if thread_id equals gmail_id, it's a single email
    if (threadId === gmailId) {
      return false;
    }

    // Double-check by counting emails in the thread
    try {
      const { error, count } = await this.db
        .from('emails')
        .select('id', { count: 'exact' })
        .eq('thread_id', threadId);

      if (error) {
        console.error(`Failed to count emails in thread ${threadId}:`, error);
        // Fallback to single email assumption if we can't check
        return false;
      }

      // Only consider it a thread if there are multiple emails
      return (count || 0) > 1;
    } catch (error) {
      console.error(`Error checking thread ${threadId}:`, error);
      return false;
    }
  }

  /**
   * Process email with AI and fallback mechanisms
   */
  private async processEmailWithFallback(email: ProcessedEmail): Promise<{
    classification: ClassificationResult;
    extracted: EnhancedExtractedJobData;
    summary: EmailSummary;
    confidence: {
      classification: number;
      extraction: number;
    };
    metrics: ProcessingMetrics;
  }> {
    try {
      // Try AI processing first
      return await this.aiProcessor.processEmail(email);
    } catch (error) {
      console.error('AI processing failed, using fallback:', {
        emailId: email.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      // Use fallback processing
      return this.fallbackEmailProcessing(email);
    }
  }

  /**
   * Fallback email processing when AI fails
   */
  private fallbackEmailProcessing(email: ProcessedEmail): {
    classification: ClassificationResult;
    extracted: EnhancedExtractedJobData;
    summary: EmailSummary;
    confidence: {
      classification: number;
      extraction: number;
    };
    metrics: ProcessingMetrics;
  } {
    // Basic keyword-based classification
    const classification = this.basicClassification(email);
    
    // Basic extraction
    const extracted = this.basicExtraction(email);
    
    // Basic summary
    const summary = this.basicSummary(email, classification);
    
    return {
      classification,
      extracted,
      summary,
      confidence: {
        classification: 0.3, // Low confidence for fallback
        extraction: 0.3
      },
      metrics: {
        tokensUsed: 0,
        processingTimeMs: 0,
        modelUsed: 'fallback'
      }
    };
  }

  /**
   * Basic classification using keywords
   */
  private basicClassification(email: ProcessedEmail): ClassificationResult {
    const text = `${email.subject} ${email.bodyText}`.toLowerCase();
    
    // Job-related keywords
    const jobKeywords = [
      'interview', 'application', 'position', 'opportunity', 'role',
      'offer', 'reject', 'candidate', 'resume', 'recruiter', 'hiring',
      'job', 'career', 'linkedin', 'indeed', 'glassdoor'
    ];
    
    const foundKeywords = jobKeywords.filter(keyword => text.includes(keyword));
    const isJobRelated = foundKeywords.length > 0;
    
    // Determine category
    let category: JobRelatedCategory = 'not_job_related';
    if (isJobRelated) {
      if (text.includes('interview')) category = 'interview_invitation';
      else if (text.includes('offer')) category = 'offer';
      else if (text.includes('reject') || text.includes('unfortunately')) category = 'rejection';
      else if (text.includes('application') && text.includes('received')) category = 'application_confirmation';
      else if (text.includes('recruiter') || text.includes('opportunity')) category = 'recruiter_outreach';
      else category = 'job_alert';
    }
    
    return {
      isJobRelated,
      category,
      confidence: Math.min(foundKeywords.length * 0.2, 0.8),
      reasoning: `Keyword-based classification found ${foundKeywords.length} job-related terms`
    };
  }

  /**
   * Basic extraction using patterns
   */
  private basicExtraction(email: ProcessedEmail): EnhancedExtractedJobData {
    const text = email.bodyText || '';
    const subject = email.subject || '';
    
    // Extract company from email domain
    const domain = email.senderEmail.split('@')[1];
    const company = domain && !['gmail.com', 'outlook.com', 'yahoo.com'].includes(domain) 
      ? domain.split('.')[0] : undefined;
    
    // Extract position from subject
    const positionPatterns = [
      /position[:\s]+([^\n,]+)/i,
      /role[:\s]+([^\n,]+)/i,
      /opportunity[:\s]+([^\n,]+)/i,
      /job[:\s]+([^\n,]+)/i
    ];
    
    let position: string | undefined;
    for (const pattern of positionPatterns) {
      const match = subject.match(pattern);
      if (match) {
        position = match[1].trim();
        break;
      }
    }
    
    // Extract contact info
    const phonePattern = /[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{4,6}/;
    const phoneMatch = text.match(phonePattern);
    
    return {
      company,
      position,
      contacts: {
        recruiter: {
          name: email.senderName,
          email: email.senderEmail,
          phone: phoneMatch ? phoneMatch[0] : undefined,
          title: ''
        }
      }
    };
  }

  /**
   * Basic summary generation
   */
  private basicSummary(email: ProcessedEmail, classification: ClassificationResult): EmailSummary {
    const subject = email.subject || 'No subject';
    const senderName = email.senderName || 'Unknown sender';
    
    let summary = `${classification.category.replace(/_/g, ' ')} from ${senderName}`;
    if (subject !== 'No subject') {
      summary += ` regarding "${subject}"`;
    }
    
    // Determine urgency
    const urgentKeywords = ['urgent', 'asap', 'immediate', 'deadline', 'today', 'tomorrow'];
    const text = `${email.subject} ${email.bodyText}`.toLowerCase();
    const urgency = urgentKeywords.some(keyword => text.includes(keyword)) ? 'high' : 'medium';
    
    return {
      summary,
      keyPoints: [summary],
      actionItems: classification.category === 'interview_invitation' ? ['Schedule interview'] : [],
      urgency: urgency as 'low' | 'medium' | 'high' | 'critical'
    };
  }

  /**
   * Clear processing metrics
   */
  clearMetrics(): void {
    this.aiProcessor.clearMetrics();
  }

  /**
   * Get AI processing metrics
   */
  async getMetrics(): Promise<{
    totalTokens: number;
    averageTokensPerEmail: number;
    totalProcessingTimeMs: number;
  }> {
    return this.aiProcessor.getTokenUsage();
  }
}

// Export singleton instance
export const emailProcessingService = new EmailProcessingService();