/**
 * Email Processor - AI-powered email classification and extraction
 * 
 * Database Schema Mapping (emails table):
 * Core fields:
 * - gmail_id (unique), thread_id, subject, sender, recipients
 * - body_text, body_html, has_attachments, attachments
 * - received_at, created_at
 * 
 * Job-related fields:
 * - job_id (FK to jobs), is_job_related, job_confidence
 * - email_type (enum), classification_confidence
 * 
 * Extracted metadata (added via migrations):
 * - company, position, sender_name, sender_email
 * - summary, preview, extracted_details (JSON)
 * 
 * Thread fields:
 * - thread_position, is_thread_root, thread_summary
 * 
 * Processing fields:
 * - ai_processed, processing_version, requires_action, action_deadline
 * - labels (text[]), action_items (JSON), extracted_events (JSON)
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import { GenerativeModel } from '@google/generative-ai';
import { enhancedLabelingEngine, EnhancedEmailLabels } from './enhanced-labeling';
import { jobLinker } from './job-linker';
import { threadManager, type ThreadSummary } from './thread-manager';

// Export types for use in other modules
export interface ProcessedEmail {
  id: string;
  messageId: string;
  subject: string;
  senderName: string;
  senderEmail: string;
  bodyText: string;
  bodyHtml?: string;
  receivedAt?: string;
  // Add from DB: thread_id, labels, etc. if needed
}

export interface ClassificationResult {
  isJobRelated: boolean;
  category: string;
  confidence: number;
  reasoning: string;
}

// Expand interface
export interface EnhancedExtractedJobData {
  company?: string;
  position?: string;
  applicationStatus?: 'not_started' | 'applied' | 'interviewing' | 'offer_received' | 'rejected' | 'accepted';
  dates?: {
    interview?: string;
    deadline?: string;
    followup?: string;
  };
  contacts?: {
    recruiter?: ContactInfo;
  };
  metadata?: {
    salary?: string;
    location?: string;
    requirements?: string[];
  };
  nextAction?: string;
  keywords?: string[];
}

export interface ContactInfo {
  name?: string;
  email?: string;
  phone?: string;
  title?: string;
}

// Add priority type
type Priority = 'low' | 'medium' | 'high' | 'critical';

interface ActionItem {
  task: string;
  priority: 'high' | 'medium' | 'low';
  deadline?: string;  // ISO date
}

interface ExtractedEvent {
  title: string;
  date: string;  // ISO date
  time?: string;
  type: 'interview' | 'call' | 'assessment' | 'deadline';
  details: string;
}

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

class AIEmailProcessor {
  private model: GenerativeModel;

  constructor() {
    this.model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  }

  async classify(email: ProcessedEmail): Promise<ClassificationResult> {
    const prompt = `Analyze this email and classify it as job-related or not.

MARK AS JOB-RELATED - MUST meet BOTH criteria:
A) The email is SPECIFICALLY about YOUR job application or opportunity (not generic job alerts)
B) AND contains one of these:
   1. From recruiters/hiring managers about YOUR application or a specific role for YOU
   2. Application confirmation for a position YOU applied to
   3. Interview scheduling/reminders for YOUR interview
   4. Assessment/test request for YOUR application
   5. Rejection/offer for YOUR application
   6. Follow-up about YOUR specific application status
   7. PERSONAL outreach from a recruiter about a specific opportunity (not mass emails)

MARK AS NOT JOB-RELATED:
1. Generic job alerts or recommendations (even from job sites)
2. Mass recruitment emails not addressing you personally
3. Company newsletters mentioning they're hiring
4. LinkedIn social activity (profile views, post likes, connection updates)
5. Account security, billing, passwords, 2FA
6. Marketing emails (even if from recruiting companies)
7. "We're hiring" announcements not specifically inviting YOU
8. Job board digest emails
9. Career advice newsletters
10. Google account notifications (ALWAYS not job-related)
11. Generic company updates or blogs mentioning openings
12. Social media notifications (likes, comments, shares) even if job-related
13. Automated marketing from job sites
14. Unsolicited bulk recruiter emails
15. Any email not requiring personal action or response

EMAIL DATA:
Subject: ${email.subject}
From: ${email.senderName} <${email.senderEmail}>
Content Preview: ${email.bodyText.substring(0, 800)}

IMPORTANT: Be STRICT and exclusive. ONLY classify as job-related if it CLEARLY and DIRECTLY relates to the user's PERSONAL job application or a SPECIFIC opportunity addressed to them. If there's ANY doubt, or if it's generic/automated, mark as not_job_related. Err on the side of caution to avoid false positives.

RESPONSE FORMAT (JSON only, no other text):
{
  "isJobRelated": boolean,
  "category": "application_submitted|application_update|assessment|recruiter_outreach|interview_invitation|interview_reminder|offer|rejection|followup|job_alert|networking|not_job_related",
  "confidence": number (0.0-1.0),
  "reasoning": "brief explanation"
}

CATEGORIES:
- application_submitted: Application/submission confirmation from company (e.g., "Thank you for applying", "We received your application")
- application_update: Status update on existing application (e.g., "Your application is under review", "Moving to next round")
- assessment: Technical test, coding challenge, or assessment request
- recruiter_outreach: PERSONAL message from recruiter about specific opportunity
- interview_invitation: Interview request or scheduling for YOUR application
- interview_reminder: Reminder for YOUR scheduled interview
- offer: Job offer for a position YOU interviewed for
- rejection: Rejection for YOUR specific application
- followup: Follow-up messages about applications or interviews
- job_alert: ONLY use if it's a PERSONALIZED job recommendation; otherwise use not_job_related for generic alerts
- networking: PERSONAL career-related message (not bulk)
- not_job_related: Everything else

JSON:`;

    const result = await this.model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 512 },
    });
    let text = result.response.text();
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(text) as ClassificationResult;
  }

  async extract(email: ProcessedEmail): Promise<EnhancedExtractedJobData> {
    const prompt = `Extract structured job information from this email.

EMAIL DATA:
Subject: ${email.subject}
From: ${email.senderName} <${email.senderEmail}>
Content: ${email.bodyText.substring(0, 1200)}

RESPONSE FORMAT (JSON only, no other text):
{
  "company": string or null,
  "position": string or null,
  "applicationStatus": "not_started|applied|interviewing|offer_received|rejected|accepted" or null,
  "dates": {
    "interview": "YYYY-MM-DD HH:MM" or null,
    "deadline": "YYYY-MM-DD" or null,
    "followup": "YYYY-MM-DD" or null
  },
  "contacts": {
    "recruiter": {
      "name": string or null,
      "email": string or null,
      "phone": string or null,
      "title": string or null
    }
  },
  "metadata": {
    "salary": string or null,
    "location": string or null,
    "requirements": []
  },
  "nextAction": string or null,
  "keywords": []
}

EXTRACTION RULES:
- Company: 
  1. Look for company name in email signature (usually after "Best regards," or similar)
  2. Extract from phrases like "at [Company]", "from [Company]", "[Company] team"
  3. Check sender's email domain (e.g., john@fidelity.com → Fidelity)
  4. Look for company mentions in subject line
  5. Clean up common suffixes: Inc., LLC, Ltd, Corp, etc.
  6. Return the cleaned company name (e.g., "Fidelity" not "Fidelity Investments Inc.")
- Position: Look for job titles in subject/body (e.g., "Software Engineer", "Data Analyst")
- Status: Infer from email context and keywords
- Dates: Parse any date format, convert to ISO
- Use null for missing data, [] for empty arrays
JSON:`;

    const result = await this.model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
    });
    let text = result.response.text();
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    let extracted = JSON.parse(text) as EnhancedExtractedJobData;
    // Post-process dates if needed
    return extracted;
  }

  private getPriority(classification: ClassificationResult, extracted: EnhancedExtractedJobData): Priority {
    if (['interview_invitation', 'assessment', 'offer', 'recruiter_outreach'].includes(classification.category)) return 'high';
    if (extracted.dates?.interview || extracted.dates?.deadline) return 'high';
    if (['application_submitted', 'job_alert'].includes(classification.category)) return 'medium';
    return 'low';
  }

  private generateSummary(classification: ClassificationResult, extracted: EnhancedExtractedJobData): string {
    if (classification.category === 'application_submitted') {
      return `Received application submission confirmation from ${extracted.company || 'the company'}.`;
    }
    // Add more templates
    return `Job-related email: ${classification.category} for ${extracted.position || 'position'} at ${extracted.company || 'company'}.`;
  }

  private extractActionsAndEvents(extracted: EnhancedExtractedJobData): { actions: ActionItem[], events: ExtractedEvent[] } {
    const actions: ActionItem[] = [];
    const events: ExtractedEvent[] = [];
    if (extracted.nextAction) {
      actions.push({ task: extracted.nextAction, priority: 'medium' });
    }
    if (extracted.dates?.interview) {
      events.push({ title: 'Interview', date: extracted.dates.interview, type: 'interview', details: '' });
    }
    // Add more
    return { actions, events };
  }

  async processEmail(email: ProcessedEmail) {
    const classification = await this.classify(email);
    if (!classification.isJobRelated) {
      // Even for non-job-related emails, generate labels
      const labels = enhancedLabelingEngine.generateLabels(
        { subject: email.subject, bodyText: email.bodyText, senderEmail: email.senderEmail },
        classification,
        {}
      );
      return { classification, labels };
    }
    const extracted = await this.extract(email);
    
    // Generate enhanced labels
    const labels = enhancedLabelingEngine.generateLabels(
      { subject: email.subject, bodyText: email.bodyText, senderEmail: email.senderEmail },
      classification,
      extracted
    );
    
    // Use enhanced priority from labels instead of basic priority
    const priority = labels.priority;
    const summary = this.generateSummary(classification, extracted);
    const { actions, events } = this.extractActionsAndEvents(extracted);
    
    return { 
      classification, 
      extracted, 
      priority, 
      summary, 
      action_items: actions, 
      events,
      labels 
    };
  }
}
const aiProcessor = new AIEmailProcessor();

// Simplified processEmail function
// ... existing code ... (adapt from email-processor.ts)

export async function processEmail(gmailId: string, userEmail: string = 'harsha.vippala1@gmail.com'): Promise<any> {
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);
  
  // Fetch email from Supabase
  const { data: email } = await supabase.from('emails').select('*').eq('gmail_id', gmailId).single();
  if (!email) throw new Error(`Email with gmail_id ${gmailId} not found`);
  
  // Thread manager is already initialized as singleton
  
  // Convert to ProcessedEmail format
  const processedEmail: ProcessedEmail = {
    id: email.id,
    messageId: email.gmail_id,
    subject: email.subject,
    senderName: email.sender_name,
    senderEmail: email.sender_email,
    bodyText: email.body_text,
    bodyHtml: email.body_html,
    receivedAt: email.received_at,
    // ... map other fields ...
  };
  
  // Process with AI
  const aiResult = await aiProcessor.processEmail(processedEmail);
  
  // Job linker is already initialized as singleton
  
  // Initialize thread context
  let threadSummary: ThreadSummary | null = null;
  let requiresResponse = false;
  
  // Check if email is part of a thread
  if (email.thread_id) {
    try {
      // Fetch all emails in thread
      const { data: threadEmails } = await supabase
        .from('emails')
        .select('*')
        .eq('thread_id', email.thread_id)
        .order('received_at', { ascending: true });
      
      if (threadEmails && threadEmails.length > 1) {
        // Analyze thread
        threadSummary = await threadManager.analyzeThread(email.thread_id, email.id);
        requiresResponse = threadSummary.requires_action;
        
        // If job-related, check if thread context provides additional info
        if (aiResult.classification.isJobRelated) {
          // Use thread context to improve extraction if needed
          if (!aiResult.extracted?.company && threadSummary.primary_company) {
            aiResult.extracted = aiResult.extracted || {};
            aiResult.extracted.company = threadSummary.primary_company;
          }
          
          // Update application status based on thread highlights
          const highlights = threadSummary.thread_highlights;
          if (highlights.includes('Job offer extended') && (!aiResult.extracted?.applicationStatus || aiResult.extracted.applicationStatus === 'interviewing')) {
            aiResult.extracted = aiResult.extracted || {};
            aiResult.extracted.applicationStatus = 'offer_received';
          } else if (highlights.includes('Application rejected')) {
            aiResult.extracted = aiResult.extracted || {};
            aiResult.extracted.applicationStatus = 'rejected';
          } else if (highlights.includes('Interview scheduled') && aiResult.extracted?.applicationStatus === 'applied') {
            aiResult.extracted.applicationStatus = 'interviewing';
          }
        }
      }
    } catch (error) {
      console.error('Thread processing failed:', error);
      // Continue without thread context
    }
  }
  
  // Prepare the result object matching the actual database schema
  const updateData: any = {
    // Core fields that exist in the schema
    is_job_related: aiResult.classification.isJobRelated,
    email_type: aiResult.classification.category,
    job_confidence: aiResult.classification.confidence,
    classification_confidence: aiResult.classification.confidence,
    
    // Extracted metadata fields (added in migrations)
    company: aiResult.extracted?.company || null,
    position: aiResult.extracted?.position || null,
    sender_name: email.sender_name || processedEmail.senderName,
    sender_email: email.sender_email || processedEmail.senderEmail,
    
    // Summary and preview fields
    summary: aiResult.summary || threadSummary?.summary || 'Not job-related email',
    preview: email.body_text?.substring(0, 100) || email.subject?.substring(0, 100) || '',
    
    // Thread-related fields that exist in schema
    thread_summary: threadSummary?.summary || null,
    thread_position: threadSummary ? threadSummary.messageCount : 1,
    is_thread_root: threadSummary ? threadSummary.messageCount === 1 : true,
    
    // Processing status
    ai_processed: true,
    processing_version: 'v2.0',
    requires_action: requiresResponse || aiResult.labels?.requiresAction || false,
    action_deadline: aiResult.extracted?.dates?.deadline ? new Date(aiResult.extracted.dates.deadline).toISOString() : null,
    
    // Gmail labels (string array)
    labels: aiResult.labels?.labels || [],
    
    // JSON fields added by migrations
    action_items: aiResult.action_items || [],
    extracted_events: aiResult.events || [],
    
    // Store all other extracted data in extracted_details JSON field
    extracted_details: {
      // Application tracking
      applicationStatus: aiResult.extracted?.applicationStatus || null,
      
      // Important dates
      dates: {
        interview: aiResult.extracted?.dates?.interview || null,
        deadline: aiResult.extracted?.dates?.deadline || null,
        followup: aiResult.extracted?.dates?.followup || null
      },
      
      // Contact information
      contacts: {
        recruiter: aiResult.extracted?.contacts?.recruiter || null
      },
      
      // Additional metadata
      metadata: aiResult.extracted?.metadata || null,
      nextAction: aiResult.extracted?.nextAction || null,
      keywords: aiResult.extracted?.keywords || [],
      
      // Enhanced labeling data
      enhanced_labels: aiResult.labels || null,
      priority: aiResult.priority || aiResult.labels?.priority || 'low',
      timeSensitive: aiResult.labels?.timeSensitive || false,
      
      // Thread context
      thread_context: threadSummary ? {
        messageCount: threadSummary.messageCount,
        participants: threadSummary.participants,
        requiresResponse: threadSummary.requiresResponse
      } : null
    }
  };
  
  // Attempt job linking if email is job-related
  if (aiResult.classification.isJobRelated && !email.linked_job_id) {
    try {
      // Prepare email data for job linker
      const emailData = {
        id: email.id,
        thread_id: email.thread_id,
        sender_email: email.sender_email,
        body_text: email.body_text,
        company: aiResult.extracted?.company || null,
        position: aiResult.extracted?.position || null,
        application_status: aiResult.extracted?.applicationStatus || null,
        received_at: email.received_at
      };
      
      const matchResult = await jobLinker.linkEmailToJob(emailData);
      
      if (matchResult && matchResult.confidence >= 0.75) {
        // Add job link to update data - job_id field exists in schema
        updateData.job_id = matchResult.jobId;
        
        // Store job linking metadata in extracted_details
        updateData.extracted_details = {
          ...updateData.extracted_details,
          job_link_confidence: matchResult.confidence,
          job_link_strategy: matchResult.strategy
        };
        
        // Update job status if needed
        await jobLinker.updateJobStatusFromEmail(matchResult.jobId, emailData);
        
        console.log(`Linked email ${email.id} to job ${matchResult.jobId} with confidence ${matchResult.confidence}`);
      }
    } catch (error) {
      console.error('Job linking failed:', error);
      // Continue without job link - not critical
    }
  }
  
  return updateData;
} 