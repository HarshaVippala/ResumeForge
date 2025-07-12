/**
 * Enhanced Email Labeling Engine
 * Uses predefined set of labels for consistent categorization
 * 
 * Last updated: 2025-07-09
 */

import { ClassificationResult, EnhancedExtractedJobData } from './ai-processor';
import { ProcessedEmail } from './types';

// Predefined set of specific labels
export const PREDEFINED_LABELS = {
  // Application Status
  'application_submitted': 'Application submitted to company',
  'application_received': 'Application received confirmation',
  'application_rejected': 'Application rejected or declined',
  'application_under_review': 'Application being reviewed',
  
  // Recruiter Communication
  'recruiter_outreach': 'Initial recruiter contact',
  'recruiter_followup': 'Follow-up from recruiter',
  'recruiter_screening': 'Recruiter screening request',
  
  // Interview Process
  'interview_invitation': 'Interview invitation received',
  'interview_scheduled': 'Interview scheduled/confirmed',
  'interview_reminder': 'Interview reminder',
  'interview_followup': 'Post-interview communication',
  'interview_cancelled': 'Interview cancelled',
  
  // Job Offers
  'offer_extended': 'Job offer received',
  'offer_negotiation': 'Offer negotiation in progress',
  'offer_accepted': 'Offer accepted',
  'offer_declined': 'Offer declined',
  'offer_withdrawn': 'Offer withdrawn by company',
  
  // General Job Search
  'job_alert': 'Job posting alert/notification',
  'networking': 'Networking or career discussion',
  'reference_request': 'Reference request',
  'background_check': 'Background check related',
  
  // Action Required
  'response_required': 'Requires response from user',
  'document_needed': 'Documents/attachments needed',
  'schedule_needed': 'Scheduling required',
  'urgent': 'Urgent attention needed',
  
  // Outcome
  'positive_news': 'Positive outcome or progress',
  'negative_news': 'Negative outcome or rejection',
  'neutral_info': 'Informational only',
  
  // Other
  'automated': 'Automated/system generated',
  'personal': 'Personal communication',
  'not_job_related': 'Not related to job search'
} as const;

export type PredefinedLabel = keyof typeof PREDEFINED_LABELS;

export interface EnhancedEmailLabels {
  labels: PredefinedLabel[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  requiresAction: boolean;
  timeSensitive: boolean;
}

export class EnhancedLabelingEngine {
  /**
   * Generate labels for an email using predefined label set
   */
  generateLabels(
    email: ProcessedEmail,
    classification: ClassificationResult,
    extracted: EnhancedExtractedJobData
  ): EnhancedEmailLabels {
    const emailText = `${email.subject} ${email.bodyText}`;
    const labels: PredefinedLabel[] = [];
    
    // Add main category label
    labels.push(this.getCategoryLabel(classification.category, emailText));
    
    // Add status-specific labels
    if (extracted.applicationStatus) {
      const statusLabel = this.getStatusLabel(extracted.applicationStatus);
      if (statusLabel) labels.push(statusLabel);
    }
    
    // Add action labels
    labels.push(...this.getActionLabels(emailText, extracted));
    
    // Add outcome labels
    labels.push(this.getOutcomeLabel(emailText, classification.category));
    
    // Add communication type
    labels.push(this.getCommunicationTypeLabel(email.senderEmail, emailText));
    
    // Remove duplicates
    const uniqueLabels = [...new Set(labels)];
    
    return {
      labels: uniqueLabels,
      priority: this.determinePriority(uniqueLabels, classification),
      requiresAction: this.determineActionRequirement(uniqueLabels, extracted),
      timeSensitive: this.determineTimeSensitivity(uniqueLabels, emailText)
    };
  }

  /**
   * Get main category label based on classification
   */
  private getCategoryLabel(category: string, emailText: string): PredefinedLabel {
    const text = emailText.toLowerCase();
    
    // Check for specific keywords to refine the classification
    switch (category) {
      case 'application_confirmation':
        if (text.includes('rejected') || text.includes('unfortunately')) {
          return 'application_rejected';
        }
        if (text.includes('received') || text.includes('thank you for applying')) {
          return 'application_received';
        }
        if (text.includes('submitted') || text.includes('application sent')) {
          return 'application_submitted';
        }
        return 'application_received';
        
      case 'recruiter_outreach':
        if (text.includes('following up') || text.includes('checking in')) {
          return 'recruiter_followup';
        }
        if (text.includes('screening') || text.includes('brief call')) {
          return 'recruiter_screening';
        }
        return 'recruiter_outreach';
        
      case 'interview_invitation':
        if (text.includes('scheduled') || text.includes('confirmed')) {
          return 'interview_scheduled';
        }
        if (text.includes('reminder') || text.includes('tomorrow')) {
          return 'interview_reminder';
        }
        if (text.includes('cancelled') || text.includes('postponed')) {
          return 'interview_cancelled';
        }
        return 'interview_invitation';
        
      case 'offer':
        if (text.includes('negotiate') || text.includes('discuss')) {
          return 'offer_negotiation';
        }
        if (text.includes('accept') || text.includes('looking forward')) {
          return 'offer_accepted';
        }
        if (text.includes('decline') || text.includes('decided not to')) {
          return 'offer_declined';
        }
        return 'offer_extended';
        
      case 'rejection':
        return 'application_rejected';
        
      case 'follow_up':
        if (text.includes('interview') && text.includes('thank you')) {
          return 'interview_followup';
        }
        return 'recruiter_followup';
        
      case 'job_alert':
        return 'job_alert';
        
      case 'networking':
        return 'networking';
        
      case 'not_job_related':
        return 'not_job_related';
        
      default:
        return 'neutral_info';
    }
  }

  /**
   * Get status label based on application status
   */
  private getStatusLabel(status: string): PredefinedLabel | null {
    const statusMap: Record<string, PredefinedLabel> = {
      'applied': 'application_submitted',
      'interviewing': 'interview_scheduled',
      'offer_received': 'offer_extended',
      'rejected': 'application_rejected',
      'accepted': 'offer_accepted'
    };
    
    return statusMap[status] || null;
  }

  /**
   * Get action-related labels
   */
  private getActionLabels(emailText: string, extracted: EnhancedExtractedJobData): PredefinedLabel[] {
    const labels: PredefinedLabel[] = [];
    const text = emailText.toLowerCase();
    
    // Check for urgent indicators
    if (text.includes('urgent') || text.includes('asap') || text.includes('immediate')) {
      labels.push('urgent');
    }
    
    // Check for response needed
    if (text.includes('please respond') || text.includes('let me know') || text.includes('get back to')) {
      labels.push('response_required');
    }
    
    // Check for document requests
    if (text.includes('resume') || text.includes('portfolio') || text.includes('references')) {
      labels.push('document_needed');
    }
    
    // Check for scheduling needs
    if (text.includes('schedule') || text.includes('availability') || text.includes('when are you free')) {
      labels.push('schedule_needed');
    }
    
    // Check extracted next action
    if (extracted.nextAction) {
      if (!labels.includes('response_required')) {
        labels.push('response_required');
      }
    }
    
    return labels;
  }

  /**
   * Get outcome label based on content
   */
  private getOutcomeLabel(emailText: string, category: string): PredefinedLabel {
    const text = emailText.toLowerCase();
    
    // Positive indicators
    if (text.includes('congratulations') || text.includes('pleased') || text.includes('excited') || 
        text.includes('next step') || category === 'offer') {
      return 'positive_news';
    }
    
    // Negative indicators
    if (text.includes('unfortunately') || text.includes('regret') || text.includes('not selected') || 
        text.includes('rejected') || category === 'rejection') {
      return 'negative_news';
    }
    
    return 'neutral_info';
  }

  /**
   * Get communication type label
   */
  private getCommunicationTypeLabel(senderEmail: string, emailText: string): PredefinedLabel {
    const email = senderEmail.toLowerCase();
    const text = emailText.toLowerCase();
    
    // Check for automated email indicators
    if (email.includes('noreply') || email.includes('no-reply') || 
        email.includes('automated') || email.includes('system') ||
        text.includes('this is an automated')) {
      return 'automated';
    }
    
    return 'personal';
  }

  /**
   * Determine priority level based on labels
   */
  private determinePriority(
    labels: PredefinedLabel[],
    classification: ClassificationResult
  ): 'low' | 'medium' | 'high' | 'critical' {
    // Critical priority labels
    if (labels.includes('offer_extended') || labels.includes('urgent')) {
      return 'critical';
    }
    
    // High priority labels
    if (labels.includes('interview_invitation') || labels.includes('interview_reminder') || 
        labels.includes('recruiter_outreach') || labels.includes('response_required')) {
      return 'high';
    }
    
    // Medium priority labels
    if (labels.includes('application_received') || labels.includes('interview_followup') || 
        labels.includes('recruiter_followup')) {
      return 'medium';
    }
    
    // Low priority labels
    if (labels.includes('application_rejected') || labels.includes('job_alert') || 
        labels.includes('not_job_related') || labels.includes('automated')) {
      return 'low';
    }
    
    return 'medium';
  }

  /**
   * Determine if email requires action
   */
  private determineActionRequirement(
    labels: PredefinedLabel[],
    extracted: EnhancedExtractedJobData
  ): boolean {
    // Check for action-required labels
    const actionLabels: PredefinedLabel[] = [
      'response_required', 'document_needed', 'schedule_needed', 'urgent',
      'interview_invitation', 'offer_extended', 'recruiter_outreach'
    ];
    
    return actionLabels.some(label => labels.includes(label)) || !!extracted.nextAction;
  }

  /**
   * Determine if email is time-sensitive
   */
  private determineTimeSensitivity(
    labels: PredefinedLabel[],
    emailText: string
  ): boolean {
    // Check for time-sensitive labels
    const timeSensitiveLabels: PredefinedLabel[] = [
      'urgent', 'interview_invitation', 'interview_reminder', 'offer_extended'
    ];
    
    if (timeSensitiveLabels.some(label => labels.includes(label))) {
      return true;
    }
    
    // Check for time-sensitive keywords
    const timeSensitiveKeywords = [
      'urgent', 'asap', 'deadline', 'today', 'tomorrow',
      'this week', 'expires', 'limited time', 'immediately'
    ];
    
    const lowercaseText = emailText.toLowerCase();
    return timeSensitiveKeywords.some(keyword => lowercaseText.includes(keyword));
  }

}

// Export singleton instance
export const enhancedLabelingEngine = new EnhancedLabelingEngine();