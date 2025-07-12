/**
 * Input size validation to prevent AI cost overruns
 * These limits ensure reasonable input sizes for personal use
 */

// Maximum lengths for different input types
export const INPUT_LIMITS = {
  MAX_JOB_DESCRIPTION_LENGTH: 10000, // ~2000 words
  MAX_RESUME_CONTENT_LENGTH: 5000,   // ~1000 words
  MAX_EMAIL_CONTENT_LENGTH: 20000,   // for email processing
  MAX_COMPANY_NAME_LENGTH: 200,
  MAX_ROLE_TITLE_LENGTH: 200,
} as const;

/**
 * Validates that a string does not exceed the specified maximum length
 * @param input - The string to validate
 * @param maxLength - Maximum allowed length
 * @param fieldName - Name of the field for error messages
 * @returns Validation result with error message if invalid
 */
export function validateStringLength(
  input: string | undefined | null,
  maxLength: number,
  fieldName: string
): { isValid: boolean; error?: string } {
  if (!input) {
    return { isValid: true };
  }

  if (input.length > maxLength) {
    return {
      isValid: false,
      error: `${fieldName} exceeds maximum length of ${maxLength.toLocaleString()} characters (current: ${input.length.toLocaleString()} characters). Please reduce the content to prevent excessive AI processing costs.`
    };
  }

  return { isValid: true };
}

/**
 * Validates job analysis inputs
 */
export function validateJobAnalysisInputs(
  jobDescription: string | undefined,
  company?: string,
  role?: string
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  const jobDescResult = validateStringLength(
    jobDescription,
    INPUT_LIMITS.MAX_JOB_DESCRIPTION_LENGTH,
    'Job description'
  );
  if (!jobDescResult.isValid && jobDescResult.error) {
    errors.push(jobDescResult.error);
  }

  const companyResult = validateStringLength(
    company,
    INPUT_LIMITS.MAX_COMPANY_NAME_LENGTH,
    'Company name'
  );
  if (!companyResult.isValid && companyResult.error) {
    errors.push(companyResult.error);
  }

  const roleResult = validateStringLength(
    role,
    INPUT_LIMITS.MAX_ROLE_TITLE_LENGTH,
    'Role title'
  );
  if (!roleResult.isValid && roleResult.error) {
    errors.push(roleResult.error);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validates resume content inputs
 */
export function validateResumeContent(
  content: string | undefined
): { isValid: boolean; error?: string } {
  return validateStringLength(
    content,
    INPUT_LIMITS.MAX_RESUME_CONTENT_LENGTH,
    'Resume content'
  );
}

/**
 * Validates email content inputs
 */
export function validateEmailContent(
  content: string | undefined
): { isValid: boolean; error?: string } {
  return validateStringLength(
    content,
    INPUT_LIMITS.MAX_EMAIL_CONTENT_LENGTH,
    'Email content'
  );
}

/**
 * Truncates text to a specified length, adding ellipsis if truncated
 * @param text - Text to truncate
 * @param maxLength - Maximum length
 * @returns Truncated text with ellipsis if needed
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  
  // Try to truncate at a word boundary
  const truncated = text.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  
  if (lastSpace > maxLength * 0.8) {
    // If there's a space reasonably close to the end, truncate there
    return truncated.substring(0, lastSpace) + '...';
  }
  
  return truncated + '...';
}

/**
 * Creates a validation error response
 */
export function createValidationErrorResponse(errors: string[]): Response {
  return new Response(
    JSON.stringify({
      error: 'Validation Error',
      details: errors,
      message: errors.join(' ')
    }),
    {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}