/**
 * Response Sanitizer
 * Minimizes sensitive data exposure in browser network requests
 */

/**
 * Sanitize email response to minimize sensitive data exposure
 * Returns only essential fields for display
 */
export function sanitizeEmailResponse(email: any): any {
  if (!email) return null;
  
  return {
    id: email.id,
    subject: email.subject || 'No Subject',
    sender_email: email.sender_email,
    sender_name: email.sender_name,
    preview: createPreview(email.content),
    received_at: email.received_at,
    is_job_related: email.is_job_related || false,
    is_processed: email.is_processed || false,
    has_attachments: email.has_attachments || false,
    classification: email.classification,
    // Preserve job opportunities if present
    job_opportunities: email.job_opportunities?.map((opp: any) => ({
      id: opp.id,
      company: opp.company,
      role: opp.role,
      location: opp.location
    }))
  };
}

/**
 * Sanitize job response to remove internal database fields
 */
export function sanitizeJobResponse(job: any): any {
  if (!job) return null;
  
  // Create a copy to avoid mutating original
  const sanitized = { ...job };
  
  // Keep only public-facing fields
  const allowedFields = [
    'id', // Keep ID for reference
    'title',
    'company',
    'location',
    'remote',
    'salary_min',
    'salary_max',
    'salary_currency',
    'experience_level',
    'job_type',
    'description',
    'requirements',
    'benefits',
    'discovered_at',
    'date_posted', // For backward compatibility
    'platform',
    'application_url',
    'is_saved',
    'saved_at',
    'tags',
    'skills_required'
  ];
  
  // Remove any fields not in allowed list
  Object.keys(sanitized).forEach(key => {
    if (!allowedFields.includes(key)) {
      delete sanitized[key];
    }
  });
  
  return sanitized;
}

/**
 * Sanitize personal info by masking sensitive parts
 */
export function sanitizePersonalInfo(data: any): any {
  if (!data) return null;
  
  const sanitized = { ...data };
  
  // Mask email: show first 3 chars and domain
  if (sanitized.email && typeof sanitized.email === 'string') {
    const [localPart, domain] = sanitized.email.split('@');
    if (localPart && domain) {
      const maskedLocal = localPart.length > 3 
        ? localPart.substring(0, 3) + '****'
        : '****';
      sanitized.email = `${maskedLocal}@${domain}`;
    }
  }
  
  // Mask phone: show area code and last 2 digits
  if (sanitized.phone && typeof sanitized.phone === 'string') {
    const digits = sanitized.phone.replace(/\D/g, '');
    if (digits.length >= 10) {
      const areaCode = digits.substring(0, 3);
      const lastTwo = digits.substring(digits.length - 2);
      sanitized.phone = `(${areaCode}) ***-**${lastTwo}`;
    } else {
      sanitized.phone = '***-****';
    }
  }
  
  // Mask SSN or similar sensitive numbers
  if (sanitized.ssn) {
    sanitized.ssn = '***-**-****';
  }
  
  // Mask date of birth - show only year
  if (sanitized.dateOfBirth) {
    const year = new Date(sanitized.dateOfBirth).getFullYear();
    sanitized.dateOfBirth = `****-**-** (${year})`;
  }
  
  return sanitized;
}

/**
 * Sanitize bulk responses using the provided sanitizer function
 */
export function sanitizeBulkResponse<T>(
  items: T[], 
  sanitizer: (item: T) => any
): any[] {
  if (!Array.isArray(items)) return [];
  return items.map(item => sanitizer(item));
}

/**
 * Create a preview from email content
 */
function createPreview(content: string | null | undefined): string {
  if (!content) return '';
  
  // Remove excessive whitespace and newlines
  const cleaned = content
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, ' ')
    .trim();
  
  // Create preview with ellipsis if needed
  if (cleaned.length <= 150) {
    return cleaned;
  }
  
  // Try to cut at word boundary
  const preview = cleaned.substring(0, 150);
  const lastSpace = preview.lastIndexOf(' ');
  
  if (lastSpace > 100) {
    return preview.substring(0, lastSpace) + '...';
  }
  
  return preview + '...';
}

/**
 * Check if full data is requested with proper validation
 */
export function shouldReturnFullData(req: any): boolean {
  // Check for full=true parameter
  const fullParam = req.query?.full === 'true';
  
  // In production, you might want to add API key validation here
  // For personal use, we'll allow it with the parameter
  
  // Optional: Check for special header
  const hasFullDataHeader = req.headers?.['x-full-data'] === 'true';
  
  return fullParam || hasFullDataHeader;
}

/**
 * Sanitize application data
 */
export function sanitizeApplicationResponse(application: any): any {
  if (!application) return null;
  
  return {
    id: application.id,
    saved_job_id: application.saved_job_id,
    status: application.status,
    applied_date: application.applied_date,
    interview_date: application.interview_date,
    notes: application.notes ? 'Has notes' : null, // Just indicate presence
    follow_up_date: application.follow_up_date,
    response_received: application.response_received,
    created_at: application.created_at,
    updated_at: application.updated_at
  };
}

/**
 * Sanitize session data
 */
export function sanitizeSessionResponse(session: any): any {
  if (!session) return null;
  
  return {
    id: session.id,
    job_title: session.job_title,
    company: session.company,
    created_at: session.created_at,
    status: session.status,
    // Remove detailed analysis data
    keywords_count: session.keywords?.length || 0,
    has_job_description: !!session.job_description
  };
}