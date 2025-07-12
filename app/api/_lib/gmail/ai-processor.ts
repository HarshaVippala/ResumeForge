import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { ProcessedEmail, ExtractedJobData, ContactInfo } from './types';
import { aiRateLimiter, ModelName } from '../ai/rate-limiter';
import { RobustJsonParser } from '../utils/json-parser';

// Initialize Gemini client
let geminiClient: GoogleGenerativeAI | null = null;

function getGeminiClient(): GoogleGenerativeAI {
  if (!geminiClient) {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_GENERATIVE_AI_API_KEY or GOOGLE_AI_API_KEY is not configured');
    }
    geminiClient = new GoogleGenerativeAI(apiKey);
  }
  return geminiClient;
}

// Classification types
export type JobRelatedCategory = 
  | 'application_confirmation'  // Legacy - maps to application_submitted
  | 'application_submitted'
  | 'application_update'
  | 'assessment'
  | 'recruiter_outreach'
  | 'interview_invitation'
  | 'interview_reminder'
  | 'offer'
  | 'rejection'
  | 'follow_up'  // Legacy - maps to followup
  | 'followup'
  | 'job_alert'
  | 'networking'
  | 'not_job_related';

export interface ClassificationResult {
  isJobRelated: boolean;
  category: JobRelatedCategory;
  confidence: number;
  reasoning: string;
}

export interface EmailSummary {
  summary: string;
  keyPoints: string[];
  actionItems: string[];
  urgency: 'low' | 'medium' | 'high' | 'critical';
}

export interface ProcessingMetrics {
  tokensUsed: number;
  processingTimeMs: number;
  modelUsed: string;
}

export interface EnhancedExtractedJobData extends ExtractedJobData {
  applicationStatus?: 'not_started' | 'applied' | 'interviewing' | 'offer_received' | 'rejected' | 'accepted';
  nextAction?: string;
  keywords?: string[];
  emailType?: JobRelatedCategory;
}

/**
 * Job Relevance Classifier using Gemini Flash models
 */
export class JobRelevanceClassifier {
  private models: Map<string, GenerativeModel>;
  private currentModel: ModelName = 'gemini-2.0-flash'; // Use best model with Tier 1

  constructor() {
    const client = getGeminiClient();
    this.models = new Map();
    
    // Initialize available models - prioritize 2.0 Flash
    const availableModels: ModelName[] = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
    availableModels.forEach(modelName => {
      try {
        this.models.set(modelName, client.getGenerativeModel({ model: modelName }));
      } catch (error) {
        console.warn(`Failed to initialize model ${modelName}:`, error);
      }
    });
  }

  async classify(email: ProcessedEmail): Promise<ClassificationResult> {
    // Pre-filter: Quick rejection of definitely non-job emails
    const preFilterResult = this.preFilterEmail(email);
    if (!preFilterResult.shouldProcess) {
      return {
        isJobRelated: false,
        category: 'not_job_related',
        confidence: 0.95,
        reasoning: preFilterResult.reason
      };
    }

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

    // Execute with rate limiting
    const executeClassification = async () => {
      const model = this.models.get(this.currentModel);
      if (!model) {
        throw new Error(`Model ${this.currentModel} not available`);
      }

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          topK: 20,
          topP: 0.9,
          maxOutputTokens: 512,
        },
      });

      const text = result.response.text();
      
      // Try robust JSON parsing first with optimized options
      const parseResult = RobustJsonParser.parseAndValidate<ClassificationResult>(
        text,
        ['isJobRelated', 'category', 'confidence', 'reasoning'],
        { logAttempts: false, enableCache: true } // Disable verbose logging, enable caching
      );
      
      if (parseResult.success && parseResult.data) {
        return parseResult.data;
      }
      
      // Fallback to old method
      const cleanedText = this.cleanJsonResponse(text);
      return JSON.parse(cleanedText) as ClassificationResult;
    };

    try {
      return await aiRateLimiter.executeWithRateLimit(
        executeClassification,
        {
          model: this.currentModel,
          priority: 8, // High priority for classification
          estimatedTokens: 500,
          fallbackModels: ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro']
        }
      );
    } catch (error) {
      console.error('Classification error:', {
        emailId: email.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        model: this.currentModel
      });
      // Fallback classification based on keywords
      return this.fallbackClassification(email);
    }
  }

  async batchClassify(emails: ProcessedEmail[]): Promise<Map<string, ClassificationResult>> {
    const results = new Map<string, ClassificationResult>();
    
    // Get optimal batch size from rate limiter
    const { batchSize } = aiRateLimiter.getOptimalBatchSize(emails.length);
    
    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      
      // Process batch items sequentially to respect rate limits
      for (const email of batch) {
        try {
          const result = await this.classify(email);
          results.set(email.id, result);
        } catch (error) {
          console.error(`Failed to classify email ${email.id}:`, error);
          // Use fallback for failed classifications
          results.set(email.id, this.fallbackClassification(email));
        }
      }
      
      // The rate limiter handles delays internally
    }

    return results;
  }

  /**
   * Pre-filter emails before AI classification
   */
  private preFilterEmail(email: ProcessedEmail): { shouldProcess: boolean; reason: string } {
    const senderEmail = email.senderEmail.toLowerCase();
    const subject = email.subject.toLowerCase();
    const senderName = email.senderName.toLowerCase();
    
    // Excluded sender patterns - be more specific to avoid filtering job emails
    const excludedSenders = [
      'security@google.com',
      'no-reply@accounts.google.com',
      'mail-noreply@google.com',
      'noreply@google.com',
      'google-accounts-noreply@google.com',
      'calendar-notification@google.com',
      'drive-shares-noreply@google.com',
      'security-noreply@',
      'mailer-daemon@',
      'postmaster@',
      'billing@',
      'invoice@',
      'receipts@',
      'notifications@github.com',
      'noreply@github.com',
      'paypal@mail.paypal.com',
      'venmo@venmo.com',
      'alerts@citibank.com',
      'notification@linkedin.com',  // LinkedIn notifications, not job-related
      'invitations@linkedin.com'  // LinkedIn invitations
    ];
    
    // Job-related sender patterns that should ALWAYS be processed
    const jobRelatedSenders = [
      'talent@',
      'recruiting@',
      'careers@',
      'jobs@',
      'hr@',
      'humanresources@',
      'bamboohr.com',
      'greenhouse.io',
      'lever.co',
      'workday.com',
      'icims.com',
      'indeed.com',
      'linkedin.com',
      'cybercoders.com',
      'oracle.com',
      'ibm.com'
    ];
    
    // NEW: Quick newsletter/digest detection to reduce false positives
    const newsletterIndicators = [
      'newsletter',
      'digest',
      'roundup',
      'daily update',
      'weekly update',
      'subscription',
      'news@',
      'updates@',
      'mailer@',
      'no-reply@substack.com',
      'substack.com'
    ];
    
    // If sender email clearly comes from a newsletter source or subject hints at a digest, skip processing
    for (const indicator of newsletterIndicators) {
      if (senderEmail.includes(indicator) || subject.includes(indicator)) {
        return {
          shouldProcess: false,
          reason: `Filtered out probable newsletter/digest (${indicator})`
        };
      }
    }
    
    // Check if it's from a job-related sender first
    for (const pattern of jobRelatedSenders) {
      if (senderEmail.includes(pattern) || senderName.includes(pattern)) {
        return { shouldProcess: true, reason: 'Job-related sender' };
      }
    }
    
    // Check excluded senders only if not job-related
    for (const pattern of excludedSenders) {
      if (senderEmail.includes(pattern) || 
          // Special handling for Google emails - exclude any @google.com that's not careers/jobs related
          (pattern.includes('google.com') && senderEmail.endsWith('@google.com') && 
           !senderEmail.includes('careers') && !senderEmail.includes('jobs'))) {
        return { 
          shouldProcess: false, 
          reason: `Excluded sender pattern: ${pattern}` 
        };
      }
    }
    
    // Excluded subject patterns - be more specific
    const excludedSubjects = [
      'security alert',
      'security notification',
      'sign-in attempt',
      'verification code',
      'verify your email',
      'password reset',
      'account security',
      'linkedin message digest',
      'weekly digest from',
      'daily digest from',
      'privacy policy update',
      'terms of service update',
      'your invoice',
      'payment receipt',
      'subscription renewal',
      'scheduled maintenance',
      'service disruption'
    ];
    
    // Job-related subject keywords that override exclusions
    const jobKeywords = [
      'position', 'opportunity', 'role', 'job', 'career',
      'interview', 'application', 'recruiter', 'hiring',
      'talent', 'opening', 'vacancy', 'employment',
      'candidate', 'resume', 'offer', 'join our team',
      'we\'re hiring', 'job alert', 'new jobs'
    ];
    
    // Check if subject contains job keywords
    const hasJobKeyword = jobKeywords.some(keyword => subject.includes(keyword));
    if (hasJobKeyword) {
      return { shouldProcess: true, reason: 'Contains job-related keywords' };
    }
    
    // Check excluded subjects
    for (const pattern of excludedSubjects) {
      if (subject.includes(pattern)) {
        return { 
          shouldProcess: false, 
          reason: `Excluded subject pattern: ${pattern}` 
        };
      }
    }
    
    // Excluded sender name patterns
    const excludedSenderNames = [
      'security team',
      'support team',
      'billing team',
      'linkedin team',
      'facebook',
      'twitter',
      'instagram',
      'microsoft account',
      'apple id',
    ];
    
    // Check excluded sender names (but allow if it's about a job at these companies)
    for (const pattern of excludedSenderNames) {
      if (senderName.includes(pattern) && 
          !subject.includes('position') && 
          !subject.includes('opportunity') && 
          !subject.includes('interview') &&
          !subject.includes('application')) {
        return { 
          shouldProcess: false, 
          reason: `System/service email from: ${pattern}` 
        };
      }
    }
    
    return { shouldProcess: true, reason: 'Passed pre-filter' };
  }

  private fallbackClassification(email: ProcessedEmail): ClassificationResult {
    // Pre-filter first
    const preFilterResult = this.preFilterEmail(email);
    if (!preFilterResult.shouldProcess) {
      return {
        isJobRelated: false,
        category: 'not_job_related',
        confidence: 0.9,
        reasoning: `Pre-filter: ${preFilterResult.reason}`
      };
    }

    // More restrictive job keywords - must have strong indicators
    const strongJobKeywords = [
      'interview scheduled',
      'phone interview',
      'video interview',
      'onsite interview',
      'application received',
      'application status',
      'we received your application',
      'thank you for applying',
      'position at',
      'role at',
      'opportunity at',
      'job offer',
      'offer letter',
      'congratulations',
      'we are pleased',
      'unfortunately',
      'not selected',
      'other candidates',
      'resume',
      'recruiter',
      'hiring manager',
      'talent acquisition'
    ];

    const text = `${email.subject} ${email.bodyText}`.toLowerCase();
    const foundKeywords = strongJobKeywords.filter(keyword => text.includes(keyword));
    
    // Require at least 2 strong keywords for fallback classification
    const isJobRelated = foundKeywords.length >= 2;
    const confidence = Math.min(foundKeywords.length * 0.3, 0.7); // Lower confidence for fallback

    return {
      isJobRelated,
      category: isJobRelated ? 'job_alert' : 'not_job_related',
      confidence,
      reasoning: `Fallback classification: found ${foundKeywords.length} strong job indicators`
    };
  }

  private cleanJsonResponse(text: string): string {
    // Use robust JSON parser for better handling of malformed responses
    const result = RobustJsonParser.parse(text, { logAttempts: false, enableCache: false });
    
    if (result.success && result.data) {
      return JSON.stringify(result.data);
    }
    
    // Minimal fallback for compatibility
    return text
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
  }
}

/**
 * Email Entity Extractor using Gemini Flash models
 */
export class EmailEntityExtractor {
  private models: Map<string, GenerativeModel>;
  private currentModel: ModelName = 'gemini-2.0-flash';

  constructor() {
    const client = getGeminiClient();
    this.models = new Map();
    
    // Initialize available models - prioritize 2.0 Flash
    const availableModels: ModelName[] = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
    availableModels.forEach(modelName => {
      try {
        this.models.set(modelName, client.getGenerativeModel({ model: modelName }));
      } catch (error) {
        console.warn(`Failed to initialize model ${modelName}:`, error);
      }
    });
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

    // Execute with rate limiting
    const executeExtraction = async () => {
      const model = this.models.get(this.currentModel);
      if (!model) {
        throw new Error(`Model ${this.currentModel} not available`);
      }

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          topK: 20,
          topP: 0.9,
          maxOutputTokens: 2048,
        },
      });

      const text = result.response.text();
      
      // Try robust JSON parsing first with optimized options
      const parseResult = RobustJsonParser.parse<EnhancedExtractedJobData>(text, { logAttempts: false, enableCache: true });
      
      let extracted: any;
      if (parseResult.success && parseResult.data) {
        extracted = parseResult.data;
      } else {
        // Fallback to old method
        const cleanedText = this.cleanJsonResponse(text);
        extracted = JSON.parse(cleanedText);
      }

      // Post-process dates
      if (extracted.dates) {
        extracted.dates = this.normalizeDates(extracted.dates);
      }

      return extracted as EnhancedExtractedJobData;
    };

    try {
      return await aiRateLimiter.executeWithRateLimit(
        executeExtraction,
        {
          model: this.currentModel,
          priority: 7, // Medium-high priority for extraction
          estimatedTokens: 1500,
          fallbackModels: ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro']
        }
      );
    } catch (error) {
      console.error('Extraction error:', {
        emailId: email.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        model: this.currentModel
      });
      return this.fallbackExtraction(email);
    }
  }

  async batchExtract(emails: ProcessedEmail[]): Promise<Map<string, EnhancedExtractedJobData>> {
    const results = new Map<string, EnhancedExtractedJobData>();
    
    // Get optimal batch size from rate limiter
    const { batchSize } = aiRateLimiter.getOptimalBatchSize(emails.length);
    
    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      
      // Process batch items sequentially to respect rate limits
      for (const email of batch) {
        try {
          const result = await this.extract(email);
          results.set(email.id, result);
        } catch (error) {
          console.error(`Failed to extract from email ${email.id}:`, error);
          // Use fallback for failed extractions
          results.set(email.id, this.fallbackExtraction(email));
        }
      }
      
      // The rate limiter handles delays internally
    }

    return results;
  }

  private normalizeDates(dates: any): any {
    const normalized: any = {};
    
    for (const [key, value] of Object.entries(dates)) {
      if (value && typeof value === 'string') {
        try {
          const date = new Date(value);
          if (!isNaN(date.getTime())) {
            normalized[key] = date;
          } else {
            normalized[key] = null;
          }
        } catch {
          normalized[key] = null;
        }
      } else {
        normalized[key] = value;
      }
    }

    return normalized;
  }

  private fallbackExtraction(email: ProcessedEmail): EnhancedExtractedJobData {
    // Basic extraction based on patterns
    const companyPattern = /@([a-zA-Z0-9.-]+)\.[a-zA-Z]{2,}/;
    const phonePattern = /[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{4,6}/;
    
    const companyMatch = email.senderEmail?.match(companyPattern);
    const company = companyMatch ? companyMatch[1] : undefined;

    const phoneMatch = email.bodyText?.match(phonePattern);
    const phone = phoneMatch ? phoneMatch[0] : undefined;

    return {
      company,
      contacts: {
        recruiter: {
          name: email.senderName,
          email: email.senderEmail,
          phone,
          title: ''
        }
      }
    };
  }

  private cleanJsonResponse(text: string): string {
    // Use robust JSON parser for better handling of malformed responses
    const result = RobustJsonParser.parse(text, { logAttempts: false, enableCache: false });
    
    if (result.success && result.data) {
      return JSON.stringify(result.data);
    }
    
    // Minimal fallback for compatibility
    return text
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
  }
}

/**
 * Confidence Scorer for classification and extraction results
 */
export class ConfidenceScorer {
  calculateClassificationConfidence(
    email: ProcessedEmail,
    classification: ClassificationResult
  ): number {
    let confidence = classification.confidence;

    // REDUCE confidence for bulk job platforms (often send non-personal emails)
    const bulkJobDomains = ['linkedin.com', 'indeed.com', 'glassdoor.com', 'dice.com', 'monster.com'];
    if (email.senderEmail && bulkJobDomains.some(domain => email.senderEmail.includes(domain))) {
      // Check if it's a digest or bulk email
      const subject = email.subject.toLowerCase();
      if (subject.includes('digest') || subject.includes('summary') || 
          subject.includes('alert') || subject.includes('new jobs') ||
          email.senderEmail.includes('noreply') || email.senderEmail.includes('no-reply')) {
        confidence = Math.max(confidence - 0.3, 0.1);
      } else {
        // Only slight boost for personal messages from job platforms
        confidence = Math.min(confidence + 0.05, 1.0);
      }
    }

    // Boost for PERSONAL job-related keywords in subject
    const personalJobKeywords = [
      'your application', 
      'your interview', 
      'congratulations', 
      'offer for you',
      'next steps',
      'following up on our',
      'thank you for interviewing'
    ];
    if (email.subject && personalJobKeywords.some(keyword => email.subject.toLowerCase().includes(keyword))) {
      confidence = Math.min(confidence + 0.2, 1.0);
    }

    // Strong reduction for generic/bulk subjects
    const genericSubjects = [
      're:', 'fwd:', 'newsletter', 'digest', 'update', 'summary',
      'weekly', 'daily', 'alert', 'notification', 'reminder',
      'new jobs', 'job matches', 'opportunities for you'
    ];
    if (email.subject && genericSubjects.some(generic => email.subject.toLowerCase().includes(generic))) {
      confidence = Math.max(confidence - 0.25, 0.1);
    }
    
    // Boost for company domain emails (not job platforms)
    const senderDomain = email.senderEmail.split('@')[1]?.toLowerCase();
    if (senderDomain && 
        !bulkJobDomains.some(domain => senderDomain.includes(domain)) &&
        !['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com'].includes(senderDomain)) {
      // Likely from a company directly
      confidence = Math.min(confidence + 0.1, 1.0);
    }

    return confidence;
  }

  calculateExtractionConfidence(
    extracted: EnhancedExtractedJobData
  ): number {
    let score = 0;
    let fields = 0;

    // Check completeness of key fields
    if (extracted.company) { score += 1; fields += 1; }
    if (extracted.position) { score += 1; fields += 1; }
    if (extracted.applicationStatus) { score += 0.8; fields += 1; }
    
    if (extracted.dates) {
      if (extracted.dates.interview) { score += 0.8; fields += 1; }
      if (extracted.dates.deadline) { score += 0.6; fields += 1; }
    }

    if (extracted.contacts?.recruiter?.name) { score += 0.7; fields += 1; }
    if (extracted.metadata?.salary) { score += 0.5; fields += 1; }
    if (extracted.metadata?.location) { score += 0.5; fields += 1; }

    return fields > 0 ? score / fields : 0;
  }

  assessUrgency(
    email: ProcessedEmail,
    classification: ClassificationResult,
    extracted: EnhancedExtractedJobData
  ): 'low' | 'medium' | 'high' | 'critical' {
    // Critical: Offers, interviews within 48 hours
    if (classification.category === 'offer') return 'critical';
    if (extracted.dates?.interview) {
      const interviewDate = new Date(extracted.dates.interview);
      const hoursUntil = (interviewDate.getTime() - Date.now()) / (1000 * 60 * 60);
      if (hoursUntil < 48) return 'critical';
    }

    // High: Interview invitations, deadlines within a week
    if (classification.category === 'interview_invitation') return 'high';
    if (extracted.dates?.deadline) {
      const deadline = new Date(extracted.dates.deadline);
      const daysUntil = (deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      if (daysUntil < 7) return 'high';
    }

    // Medium: Recruiter outreach, follow-ups
    if (['recruiter_outreach', 'follow_up'].includes(classification.category)) return 'medium';

    // Low: Everything else
    return 'low';
  }
}

/**
 * Email Summarizer for dashboard display
 */
export class EmailSummarizer {
  private models: Map<string, GenerativeModel>;
  private currentModel: ModelName = 'gemini-2.0-flash';

  constructor() {
    const client = getGeminiClient();
    this.models = new Map();
    
    // Initialize available models - prioritize 2.0 Flash
    const availableModels: ModelName[] = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
    availableModels.forEach(modelName => {
      try {
        this.models.set(modelName, client.getGenerativeModel({ model: modelName }));
      } catch (error) {
        console.warn(`Failed to initialize model ${modelName}:`, error);
      }
    });
  }

  async summarize(
    email: ProcessedEmail,
    classification: ClassificationResult,
    extracted: EnhancedExtractedJobData
  ): Promise<EmailSummary> {
    const prompt = `Create a concise email summary for dashboard display.

EMAIL DATA:
Subject: ${email.subject}
From: ${email.senderName} (${email.senderEmail})
Category: ${classification.category}
Company: ${extracted.company || 'Unknown'}
Position: ${extracted.position || 'Not specified'}
Content: ${email.bodyText.substring(0, 400)}

RESPONSE FORMAT (JSON only, no other text):
{
  "summary": "One sentence summary of email purpose",
  "keyPoints": ["2-3 most important points"],
  "actionItems": ["Required actions from recipient"],
  "urgency": "low|medium|high|critical"
}

URGENCY LEVELS:
- critical: Job offers, interviews within 24 hours
- high: Interview invitations, deadlines within 3 days
- medium: Recruiter outreach, follow-ups
- low: Job alerts, newsletters, generic emails

Focus on deadlines, next steps, and actionable information.

JSON:`;

    // Execute with rate limiting
    const executeSummarization = async () => {
      const model = this.models.get(this.currentModel);
      if (!model) {
        throw new Error(`Model ${this.currentModel} not available`);
      }

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          topK: 20,
          topP: 0.9,
          maxOutputTokens: 512,
        },
      });

      const text = result.response.text();
      
      // Try robust JSON parsing first with optimized options
      const parseResult = RobustJsonParser.parseAndValidate<EmailSummary>(
        text,
        ['summary', 'keyPoints', 'actionItems', 'urgency'],
        { logAttempts: false, enableCache: true } // Disable verbose logging, enable caching
      );
      
      if (parseResult.success && parseResult.data) {
        return parseResult.data;
      }
      
      // Fallback to old method
      const cleanedText = this.cleanJsonResponse(text);
      return JSON.parse(cleanedText) as EmailSummary;
    };

    try {
      return await aiRateLimiter.executeWithRateLimit(
        executeSummarization,
        {
          model: this.currentModel,
          priority: 6, // Medium priority for summarization
          estimatedTokens: 800,
          fallbackModels: ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro']
        }
      );
    } catch (error) {
      console.error('Summarization error:', {
        emailId: email.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        model: this.currentModel
      });
      return this.fallbackSummary(email, classification, extracted);
    }
  }

  private fallbackSummary(
    email: ProcessedEmail,
    classification: ClassificationResult,
    extracted: EnhancedExtractedJobData
  ): EmailSummary {
    const scorer = new ConfidenceScorer();
    const urgency = scorer.assessUrgency(email, classification, extracted);

    return {
      summary: `${classification.category.replace(/_/g, ' ')} from ${extracted.company || email.senderName}`,
      keyPoints: [
        extracted.position ? `Position: ${extracted.position}` : 'Position not specified',
        extracted.nextAction || 'No specific action mentioned'
      ].filter(Boolean),
      actionItems: extracted.nextAction ? [extracted.nextAction] : [],
      urgency
    };
  }

  private cleanJsonResponse(text: string): string {
    // Use robust JSON parser for better handling of malformed responses
    const result = RobustJsonParser.parse(text, { logAttempts: false, enableCache: false });
    
    if (result.success && result.data) {
      return JSON.stringify(result.data);
    }
    
    // Minimal fallback for compatibility
    return text
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
  }
}

/**
 * Main AI Email Processor orchestrating all components
 */
export class AIEmailProcessor {
  private classifier: JobRelevanceClassifier;
  private extractor: EmailEntityExtractor;
  private scorer: ConfidenceScorer;
  private summarizer: EmailSummarizer;
  private metrics: Map<string, ProcessingMetrics>;

  constructor() {
    this.classifier = new JobRelevanceClassifier();
    this.extractor = new EmailEntityExtractor();
    this.scorer = new ConfidenceScorer();
    this.summarizer = new EmailSummarizer();
    this.metrics = new Map();
  }

  /**
   * Get rate limiter status for monitoring
   */
  getRateLimiterStatus() {
    return aiRateLimiter.getQueueStatus();
  }

  /**
   * Get processing recommendations based on email count
   */
  getProcessingRecommendations(emailCount: number) {
    return aiRateLimiter.getRecommendations(emailCount);
  }

  async processEmail(email: ProcessedEmail): Promise<{
    classification: ClassificationResult;
    extracted: EnhancedExtractedJobData;
    summary: EmailSummary;
    confidence: {
      classification: number;
      extraction: number;
    };
    metrics: ProcessingMetrics;
  }> {
    const startTime = Date.now();

    // Step 1: Classify the email
    const classification = await this.classifier.classify(email);
    
    // Step 2: Extract entities if job-related
    let extracted: EnhancedExtractedJobData = {};
    if (classification.isJobRelated) {
      extracted = await this.extractor.extract(email);
      extracted.emailType = classification.category;
    }

    // Step 3: Calculate confidence scores
    const classificationConfidence = this.scorer.calculateClassificationConfidence(email, classification);
    const extractionConfidence = this.scorer.calculateExtractionConfidence(extracted);

    // Step 4: Generate summary
    const summary = await this.summarizer.summarize(email, classification, extracted);

    // Step 5: Track metrics
    const metrics: ProcessingMetrics = {
      tokensUsed: 0, // Would need to track actual token usage from Gemini API
      processingTimeMs: Date.now() - startTime,
      modelUsed: 'gemini-2.0-flash'
    };

    this.metrics.set(email.id, metrics);

    return {
      classification,
      extracted,
      summary,
      confidence: {
        classification: classificationConfidence,
        extraction: extractionConfidence
      },
      metrics
    };
  }

  async processBatch(emails: ProcessedEmail[]): Promise<Map<string, {
    classification: ClassificationResult;
    extracted: EnhancedExtractedJobData;
    summary: EmailSummary;
    confidence: {
      classification: number;
      extraction: number;
    };
    metrics: ProcessingMetrics;
  }>> {
    const results = new Map();

    // Get processing recommendations
    const recommendations = this.getProcessingRecommendations(emails.length);
    if (recommendations.warnings.length > 0) {
      console.warn('Processing warnings:', recommendations.warnings);
    }

    // Get optimal batch size from rate limiter
    const { batchSize, estimatedTime } = aiRateLimiter.getOptimalBatchSize(emails.length);
    console.log(`Processing ${emails.length} emails in batches of ${batchSize}. Estimated time: ${Math.round(estimatedTime / 1000)}s`);

    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      
      // Process batch items sequentially to better manage rate limits
      for (const email of batch) {
        try {
          const result = await this.processEmail(email);
          results.set(email.id, result);
          
          // Log progress
          if ((results.size % 10) === 0) {
            const status = this.getRateLimiterStatus();
            console.log(`Processed ${results.size}/${emails.length} emails. Queue: ${status.queueLength}`);
          }
        } catch (error) {
          console.error(`Failed to process email ${email.id}:`, error);
          // Add error result
          results.set(email.id, {
            classification: {
              isJobRelated: false,
              category: 'not_job_related',
              confidence: 0,
              reasoning: 'Processing failed'
            },
            extracted: {},
            summary: {
              summary: 'Failed to process email',
              keyPoints: [],
              actionItems: [],
              urgency: 'low'
            },
            confidence: {
              classification: 0,
              extraction: 0
            },
            metrics: {
              tokensUsed: 0,
              processingTimeMs: 0,
              modelUsed: 'gemini-2.0-flash'
            }
          });
        }
      }
    }

    // Log final status
    const finalStatus = this.getRateLimiterStatus();
    console.log(`Email processing complete. Processed: ${results.size}, Queue remaining: ${finalStatus.queueLength}`);

    return results;
  }

  getProcessingMetrics(): Map<string, ProcessingMetrics> {
    return new Map(this.metrics);
  }

  clearMetrics(): void {
    this.metrics.clear();
  }

  async getTokenUsage(): Promise<{
    totalTokens: number;
    averageTokensPerEmail: number;
    totalProcessingTimeMs: number;
  }> {
    let totalTokens = 0;
    let totalTime = 0;
    
    for (const metric of this.metrics.values()) {
      totalTokens += metric.tokensUsed;
      totalTime += metric.processingTimeMs;
    }

    return {
      totalTokens,
      averageTokensPerEmail: this.metrics.size > 0 ? totalTokens / this.metrics.size : 0,
      totalProcessingTimeMs: totalTime
    };
  }
}

// Export singleton instance
export const aiEmailProcessor = new AIEmailProcessor();