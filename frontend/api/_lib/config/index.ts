/**
 * Central configuration module
 * 
 * Provides typed access to environment variables and configuration settings.
 * Validates environment on first access.
 */

import { validateEnvOrThrow, getRequiredEnv, getOptionalEnv, isFeatureEnabled } from './validate-env';

// Validate environment on module load (only in server context)
if (typeof window === 'undefined') {
  try {
    validateEnvOrThrow();
  } catch (error) {
    console.error('❌ Environment validation failed:', error);
    // In development, log but don't crash
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️  Continuing in development mode despite validation errors');
    } else {
      throw error;
    }
  }
}

/**
 * Core Security Configuration
 */
export const security = {
  personalApiKey: getRequiredEnv('PERSONAL_API_KEY'),
  encryptionKey: getRequiredEnv('ENCRYPTION_KEY'),
  nextAuthSecret: getRequiredEnv('NEXTAUTH_SECRET'),
  nextAuthUrl: getRequiredEnv('NEXTAUTH_URL'),
} as const;

/**
 * Database Configuration
 */
export const database = {
  supabaseUrl: getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
  supabaseAnonKey: getRequiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  supabaseServiceRoleKey: getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
  databaseUrl: getOptionalEnv('DATABASE_URL', ''),
} as const;

/**
 * AI Service Configuration
 */
export const ai = {
  geminiApiKey: getRequiredEnv('GOOGLE_GENERATIVE_AI_API_KEY'),
  model: getOptionalEnv('AI_MODEL', 'gemini-1.5-flash'),
  temperatureResume: parseFloat(getOptionalEnv('AI_TEMPERATURE_RESUME', '0.7')),
  temperatureJobAnalysis: parseFloat(getOptionalEnv('AI_TEMPERATURE_JOB_ANALYSIS', '0.3')),
} as const;

/**
 * OAuth Configuration
 */
export const oauth = {
  googleClientId: getRequiredEnv('GOOGLE_CLIENT_ID'),
  googleClientSecret: getRequiredEnv('GOOGLE_CLIENT_SECRET'),
  googleRedirectUri: getOptionalEnv(
    'GOOGLE_REDIRECT_URI',
    `${getRequiredEnv('NEXTAUTH_URL')}/api/auth/callback/google`
  ),
} as const;

/**
 * User Profile Configuration
 */
export const userProfile = {
  fullName: getRequiredEnv('USER_FULL_NAME'),
  email: getRequiredEnv('USER_EMAIL'),
  phone: getOptionalEnv('USER_PHONE', ''),
  location: getOptionalEnv('USER_LOCATION', ''),
  linkedinUrl: getOptionalEnv('USER_LINKEDIN_URL', ''),
  githubUrl: getOptionalEnv('USER_GITHUB_URL', ''),
  portfolioUrl: getOptionalEnv('USER_PORTFOLIO_URL', ''),
  resumeFilenamePattern: getOptionalEnv(
    'RESUME_FILENAME_PATTERN',
    '{name}_Resume_{company}_{position}_{date}'
  ),
} as const;

/**
 * Input Limits Configuration
 */
export const limits = {
  maxJobDescriptionLength: parseInt(
    getOptionalEnv('MAX_JOB_DESCRIPTION_LENGTH', '10000')
  ),
  maxResumeSectionLength: parseInt(
    getOptionalEnv('MAX_RESUME_SECTION_LENGTH', '5000')
  ),
  maxCompanyNameLength: parseInt(
    getOptionalEnv('MAX_COMPANY_NAME_LENGTH', '100')
  ),
  maxPositionTitleLength: parseInt(
    getOptionalEnv('MAX_POSITION_TITLE_LENGTH', '100')
  ),
  maxSkillLength: parseInt(getOptionalEnv('MAX_SKILL_LENGTH', '50')),
  maxExperienceEntryLength: parseInt(
    getOptionalEnv('MAX_EXPERIENCE_ENTRY_LENGTH', '2000')
  ),
  maxProjectDescriptionLength: parseInt(
    getOptionalEnv('MAX_PROJECT_DESCRIPTION_LENGTH', '1000')
  ),
  maxResumeFileSize: parseInt(
    getOptionalEnv('MAX_RESUME_FILE_SIZE', '5242880') // 5MB
  ),
  maxAttachmentSize: parseInt(
    getOptionalEnv('MAX_ATTACHMENT_SIZE', '10485760') // 10MB
  ),
} as const;

/**
 * Feature Flags
 */
export const features = {
  emailSync: isFeatureEnabled('EMAIL_SYNC'),
  jobScraping: isFeatureEnabled('JOB_SCRAPING'),
  autoSave: isFeatureEnabled('AUTO_SAVE'),
  versionHistory: isFeatureEnabled('VERSION_HISTORY'),
  pdfExport: isFeatureEnabled('PDF_EXPORT'),
  docxExport: isFeatureEnabled('DOCX_EXPORT'),
  analytics: isFeatureEnabled('ANALYTICS'),
} as const;

/**
 * Background Service Configuration
 */
export const backgroundServices = {
  emailSyncInterval: parseInt(getOptionalEnv('EMAIL_SYNC_INTERVAL', '30')) * 60 * 1000, // Convert to ms
  jobCheckInterval: parseInt(getOptionalEnv('JOB_CHECK_INTERVAL', '60')) * 60 * 1000, // Convert to ms
} as const;

/**
 * Development Configuration
 */
export const development = {
  nodeEnv: getOptionalEnv('NODE_ENV', 'development'),
  debugMode: getOptionalEnv('DEBUG_MODE', 'false') === 'true',
  logLevel: getOptionalEnv('LOG_LEVEL', 'info') as 'debug' | 'info' | 'warn' | 'error',
  apiRateLimit: parseInt(getOptionalEnv('API_RATE_LIMIT', '60')),
} as const;

/**
 * Third-party Services (Optional)
 */
export const thirdPartyServices = {
  sentry: {
    dsn: getOptionalEnv('SENTRY_DSN', ''),
    environment: getOptionalEnv('SENTRY_ENVIRONMENT', 'development'),
  },
  posthog: {
    apiKey: getOptionalEnv('POSTHOG_API_KEY', ''),
    host: getOptionalEnv('POSTHOG_HOST', 'https://app.posthog.com'),
  },
} as const;

/**
 * Helper function to generate resume filename
 */
export function generateResumeFilename(params: {
  name?: string;
  company?: string;
  position?: string;
  date?: string;
}): string {
  const pattern = userProfile.resumeFilenamePattern;
  const date = params.date || new Date().toISOString().split('T')[0];
  
  return pattern
    .replace('{name}', params.name || userProfile.fullName.replace(/\s+/g, '_'))
    .replace('{company}', params.company || 'Company')
    .replace('{position}', params.position || 'Position')
    .replace('{date}', date)
    .replace(/[^a-zA-Z0-9_\-]/g, '_'); // Sanitize filename
}

/**
 * Check if running in production
 */
export const isProduction = development.nodeEnv === 'production';

/**
 * Check if running in development
 */
export const isDevelopment = development.nodeEnv === 'development';

/**
 * Export all configuration as a single object for convenience
 */
export const config = {
  security,
  database,
  ai,
  oauth,
  userProfile,
  limits,
  features,
  backgroundServices,
  development,
  thirdPartyServices,
  isProduction,
  isDevelopment,
  generateResumeFilename,
} as const;

export default config;