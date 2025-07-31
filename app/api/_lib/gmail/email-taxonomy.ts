/**
 * Comprehensive Email Taxonomy for Job Search
 * Defines specific labels and categories for job-related emails
 * 
 * Last updated: 2025-07-09
 */

export interface EmailTaxonomyEntry {
  category: string;
  subcategory: string;
  label: string;
  description: string;
  keywords: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  requiresAction: boolean;
  timesSensitive: boolean;
}

export const EMAIL_TAXONOMY: EmailTaxonomyEntry[] = [
  // APPLICATION PHASE
  {
    category: 'application',
    subcategory: 'submitted',
    label: 'application_submitted',
    description: 'Confirmation that job application was submitted',
    keywords: ['application submitted', 'thank you for applying', 'received your application'],
    priority: 'low',
    requiresAction: false,
    timesSensitive: false
  },
  {
    category: 'application',
    subcategory: 'received',
    label: 'application_received',
    description: 'Company confirms they received the application',
    keywords: ['application received', 'we have received', 'thank you for your interest'],
    priority: 'low',
    requiresAction: false,
    timesSensitive: false
  },
  {
    category: 'application',
    subcategory: 'under_review',
    label: 'application_under_review',
    description: 'Application is being reviewed by the company',
    keywords: ['under review', 'reviewing your application', 'review process'],
    priority: 'medium',
    requiresAction: false,
    timesSensitive: false
  },
  {
    category: 'application',
    subcategory: 'rejected',
    label: 'application_rejected',
    description: 'Application was declined or rejected',
    keywords: ['not selected', 'decided to move forward', 'other candidates', 'unfortunately'],
    priority: 'low',
    requiresAction: false,
    timesSensitive: false
  },
  {
    category: 'application',
    subcategory: 'approved',
    label: 'application_approved',
    description: 'Application moved to next stage',
    keywords: ['next step', 'move forward', 'would like to speak', 'pleased to inform'],
    priority: 'high',
    requiresAction: true,
    timesSensitive: true
  },

  // RECRUITER INTERACTIONS
  {
    category: 'recruiter',
    subcategory: 'initial_outreach',
    label: 'recruiter_initial_outreach',
    description: 'First contact from recruiter about opportunity',
    keywords: ['reaching out', 'opportunity', 'might be interested', 'career opportunity'],
    priority: 'high',
    requiresAction: true,
    timesSensitive: true
  },
  {
    category: 'recruiter',
    subcategory: 'followup',
    label: 'recruiter_followup',
    description: 'Follow-up communication from recruiter',
    keywords: ['following up', 'wanted to follow up', 'checking in', 'any interest'],
    priority: 'medium',
    requiresAction: true,
    timesSensitive: true
  },
  {
    category: 'recruiter',
    subcategory: 'screening_request',
    label: 'recruiter_screening_request',
    description: 'Recruiter wants to schedule screening call',
    keywords: ['screening call', 'brief conversation', 'schedule a call', 'phone screen'],
    priority: 'high',
    requiresAction: true,
    timesSensitive: true
  },
  {
    category: 'recruiter',
    subcategory: 'information_request',
    label: 'recruiter_information_request',
    description: 'Recruiter asking for additional information',
    keywords: ['need more information', 'please provide', 'send over', 'additional details'],
    priority: 'medium',
    requiresAction: true,
    timesSensitive: true
  },

  // INTERVIEW PROCESS
  {
    category: 'interview',
    subcategory: 'invitation',
    label: 'interview_invitation',
    description: 'Invitation to interview',
    keywords: ['interview', 'would like to meet', 'schedule an interview', 'interview process'],
    priority: 'critical',
    requiresAction: true,
    timesSensitive: true
  },
  {
    category: 'interview',
    subcategory: 'scheduled',
    label: 'interview_scheduled',
    description: 'Interview time confirmed',
    keywords: ['interview scheduled', 'confirmed', 'calendar invite', 'looking forward to meeting'],
    priority: 'high',
    requiresAction: false,
    timesSensitive: true
  },
  {
    category: 'interview',
    subcategory: 'reminder',
    label: 'interview_reminder',
    description: 'Reminder about upcoming interview',
    keywords: ['reminder', 'tomorrow', 'upcoming interview', 'dont forget'],
    priority: 'high',
    requiresAction: false,
    timesSensitive: true
  },
  {
    category: 'interview',
    subcategory: 'reschedule',
    label: 'interview_reschedule',
    description: 'Interview time needs to be changed',
    keywords: ['reschedule', 'change the time', 'different time', 'postpone'],
    priority: 'high',
    requiresAction: true,
    timesSensitive: true
  },
  {
    category: 'interview',
    subcategory: 'cancelled',
    label: 'interview_cancelled',
    description: 'Interview was cancelled',
    keywords: ['cancel', 'cancelled', 'wont be able to meet', 'postponed indefinitely'],
    priority: 'medium',
    requiresAction: false,
    timesSensitive: false
  },
  {
    category: 'interview',
    subcategory: 'followup',
    label: 'interview_followup',
    description: 'Post-interview communication',
    keywords: ['thank you for your time', 'pleasure meeting', 'next steps', 'interview today'],
    priority: 'medium',
    requiresAction: false,
    timesSensitive: false
  },

  // DECISION PHASE
  {
    category: 'offer',
    subcategory: 'extended',
    label: 'offer_extended',
    description: 'Job offer received',
    keywords: ['offer', 'pleased to offer', 'offer letter', 'compensation package'],
    priority: 'critical',
    requiresAction: true,
    timesSensitive: true
  },
  {
    category: 'offer',
    subcategory: 'negotiation',
    label: 'offer_negotiation',
    description: 'Discussing offer terms',
    keywords: ['negotiate', 'discuss terms', 'counter offer', 'salary negotiation'],
    priority: 'high',
    requiresAction: true,
    timesSensitive: true
  },
  {
    category: 'offer',
    subcategory: 'accepted',
    label: 'offer_accepted',
    description: 'Offer accepted',
    keywords: ['accept', 'excited to join', 'looking forward to starting'],
    priority: 'high',
    requiresAction: false,
    timesSensitive: false
  },
  {
    category: 'offer',
    subcategory: 'declined',
    label: 'offer_declined',
    description: 'Offer declined',
    keywords: ['decline', 'decided not to accept', 'other opportunity'],
    priority: 'medium',
    requiresAction: false,
    timesSensitive: false
  },
  {
    category: 'offer',
    subcategory: 'withdrawn',
    label: 'offer_withdrawn',
    description: 'Company withdrew offer',
    keywords: ['withdraw', 'rescind', 'no longer available', 'changed our mind'],
    priority: 'medium',
    requiresAction: false,
    timesSensitive: false
  },

  // GENERAL CATEGORIES
  {
    category: 'general',
    subcategory: 'job_alert',
    label: 'job_alert',
    description: 'Automated job posting notifications',
    keywords: ['job alert', 'new jobs', 'job matches', 'recommended jobs'],
    priority: 'low',
    requiresAction: false,
    timesSensitive: false
  },
  {
    category: 'general',
    subcategory: 'networking',
    label: 'networking',
    description: 'General networking and career-related communication',
    keywords: ['networking', 'career advice', 'connect', 'professional network'],
    priority: 'medium',
    requiresAction: false,
    timesSensitive: false
  },
  {
    category: 'general',
    subcategory: 'reference_request',
    label: 'reference_request',
    description: 'Request for professional references',
    keywords: ['reference', 'reference check', 'professional reference', 'recommend'],
    priority: 'high',
    requiresAction: true,
    timesSensitive: true
  },
  {
    category: 'general',
    subcategory: 'background_check',
    label: 'background_check',
    description: 'Background check related communication',
    keywords: ['background check', 'background verification', 'screening'],
    priority: 'medium',
    requiresAction: true,
    timesSensitive: true
  },
  {
    category: 'general',
    subcategory: 'onboarding',
    label: 'onboarding',
    description: 'Post-acceptance onboarding information',
    keywords: ['onboarding', 'first day', 'welcome', 'getting started'],
    priority: 'high',
    requiresAction: true,
    timesSensitive: true
  }
];

// Additional modifier labels
export const MODIFIER_LABELS = {
  urgency: {
    'urgent_response_needed': 'Requires immediate response',
    'deadline_approaching': 'Has approaching deadline',
    'time_sensitive': 'Time-critical communication'
  },
  relationship: {
    'first_contact': 'First interaction with this contact',
    'ongoing_conversation': 'Part of existing conversation thread',
    'cold_outreach': 'Unsolicited contact'
  },
  outcome: {
    'positive_outcome': 'Good news or progress',
    'negative_outcome': 'Rejection or setback',
    'neutral_outcome': 'Informational only'
  },
  action: {
    'response_required': 'Needs user response',
    'document_required': 'Needs document submission',
    'schedule_required': 'Needs scheduling',
    'no_action_needed': 'Informational only'
  },
  communication: {
    'automated_email': 'System-generated email',
    'personal_email': 'From actual person',
    'bulk_email': 'Mass communication'
  },
  stage: {
    'early_stage': 'Initial application phase',
    'mid_stage': 'Interview/screening phase',
    'late_stage': 'Offer/decision phase',
    'post_decision': 'After acceptance/rejection'
  }
};

/**
 * Get taxonomy entry by category and subcategory
 */
export function getTaxonomyEntry(category: string, subcategory: string): EmailTaxonomyEntry | undefined {
  return EMAIL_TAXONOMY.find(entry => 
    entry.category === category && entry.subcategory === subcategory
  );
}

/**
 * Find matching taxonomy entries based on email content
 */
export function findMatchingTaxonomyEntries(text: string): EmailTaxonomyEntry[] {
  const lowercaseText = text.toLowerCase();
  const matches: EmailTaxonomyEntry[] = [];
  
  for (const entry of EMAIL_TAXONOMY) {
    const keywordMatches = entry.keywords.filter(keyword => 
      lowercaseText.includes(keyword.toLowerCase())
    );
    
    if (keywordMatches.length > 0) {
      matches.push(entry);
    }
  }
  
  // Sort by number of matching keywords (descending)
  return matches.sort((a, b) => {
    const aMatches = a.keywords.filter(k => lowercaseText.includes(k.toLowerCase())).length;
    const bMatches = b.keywords.filter(k => lowercaseText.includes(k.toLowerCase())).length;
    return bMatches - aMatches;
  });
}

/**
 * Get primary category from job-related category
 */
export function getPrimaryCategory(jobCategory: string): string {
  const categoryMap: Record<string, string> = {
    'application_confirmation': 'application',
    'recruiter_outreach': 'recruiter',
    'interview_invitation': 'interview',
    'interview_reminder': 'interview',
    'offer': 'offer',
    'rejection': 'application',
    'follow_up': 'general',
    'job_alert': 'general',
    'networking': 'general',
    'not_job_related': 'general'
  };
  
  return categoryMap[jobCategory] || 'general';
}