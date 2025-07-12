/**
 * Environment Variable Validation
 * 
 * Validates that all required environment variables are set and meet security requirements.
 * This should be called during application startup to catch configuration errors early.
 */

interface EnvVar {
  name: string;
  required: boolean;
  sensitive?: boolean;
  minLength?: number;
  pattern?: RegExp;
  description: string;
  category: 'security' | 'database' | 'ai' | 'oauth' | 'user' | 'limits' | 'features';
}

const ENV_VARS: EnvVar[] = [
  // Core Security
  {
    name: 'PERSONAL_API_KEY',
    required: true,
    sensitive: true,
    minLength: 32,
    category: 'security',
    description: 'Personal API key for authenticating requests'
  },
  {
    name: 'ENCRYPTION_KEY',
    required: true,
    sensitive: true,
    minLength: 32,
    pattern: /^[A-Za-z0-9+/]+=*$/,
    category: 'security',
    description: 'Base64 encoded 32-byte encryption key'
  },
  {
    name: 'NEXTAUTH_SECRET',
    required: true,
    sensitive: true,
    minLength: 32,
    category: 'security',
    description: 'Secret for NextAuth session encryption'
  },
  {
    name: 'NEXTAUTH_URL',
    required: true,
    pattern: /^https?:\/\/.+/,
    category: 'security',
    description: 'Application URL for OAuth callbacks'
  },

  // Database Configuration (Supabase integration variables take priority)
  {
    name: 'SUPABASE_URL',
    required: false,
    pattern: /^https:\/\/.+\.supabase\.co$/,
    category: 'database',
    description: 'Supabase project URL (integration-provided, preferred)'
  },
  {
    name: 'SUPABASE_ANON_KEY',
    required: false,
    pattern: /^eyJ/,
    category: 'database',
    description: 'Supabase anonymous key (integration-provided, preferred)'
  },
  {
    name: 'NEXT_PUBLIC_SUPABASE_URL',
    required: false,
    pattern: /^https:\/\/.+\.supabase\.co$/,
    category: 'database',
    description: 'Supabase project URL (manual fallback)'
  },
  {
    name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    required: false,
    pattern: /^eyJ/,
    category: 'database',
    description: 'Supabase anonymous key (manual fallback)'
  },
  {
    name: 'SUPABASE_SERVICE_ROLE_KEY',
    required: true,
    sensitive: true,
    pattern: /^eyJ/,
    category: 'database',
    description: 'Supabase service role key (JWT format)'
  },

  // AI Service
  {
    name: 'GOOGLE_GENERATIVE_AI_API_KEY',
    required: true,
    sensitive: true,
    pattern: /^AIza/,
    category: 'ai',
    description: 'Google Gemini API key'
  },
  {
    name: 'GOOGLE_AI_API_KEY',
    required: false,
    sensitive: true,
    pattern: /^AIza/,
    category: 'ai',
    description: 'Google Gemini API key (alternative name)'
  },
  {
    name: 'AI_RATE_LIMIT_STRATEGY',
    required: false,
    pattern: /^(conservative|aggressive|development)$/,
    category: 'ai',
    description: 'AI rate limiting strategy (conservative, aggressive, development)'
  },
  {
    name: 'UPSTASH_REDIS_URL',
    required: false,
    pattern: /^redis:\/\/.+/,
    category: 'ai',
    description: 'Upstash Redis URL for distributed rate limiting (optional)'
  },

  // OAuth Configuration
  {
    name: 'GOOGLE_CLIENT_ID',
    required: true,
    pattern: /\.apps\.googleusercontent\.com$/,
    category: 'oauth',
    description: 'Google OAuth client ID'
  },
  {
    name: 'GOOGLE_CLIENT_SECRET',
    required: true,
    sensitive: true,
    category: 'oauth',
    description: 'Google OAuth client secret'
  },
  {
    name: 'GMAIL_TOKEN_ENCRYPTION_KEY',
    required: true,
    sensitive: true,
    minLength: 32,
    category: 'oauth',
    description: 'Encryption key for Gmail OAuth tokens (32+ characters)'
  },
  {
    name: 'GMAIL_TOKEN_ENCRYPTION_SALT',
    required: false,
    category: 'oauth',
    description: 'Salt for Gmail token encryption (defaults to resumeforge-salt-2025)'
  },
  {
    name: 'GOOGLE_REDIRECT_URI',
    required: false,
    pattern: /^https?:\/\/.+/,
    category: 'oauth',
    description: 'OAuth redirect URI (defaults to NEXTAUTH_URL/api/oauth/callback)'
  },

  // User Profile (Required for resume generation and authentication)
  {
    name: 'USER_ID',
    required: false,
    category: 'user',
    description: 'Unique user identifier for authentication (defaults to harsha-primary)'
  },
  {
    name: 'USER_FULL_NAME',
    required: true,
    category: 'user',
    description: 'Your full name for resume headers'
  },
  {
    name: 'USER_EMAIL',
    required: true,
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    category: 'user',
    description: 'Your email address'
  },

  // Optional but recommended
  {
    name: 'USER_PHONE',
    required: false,
    category: 'user',
    description: 'Your phone number'
  },
  {
    name: 'USER_LOCATION',
    required: false,
    category: 'user',
    description: 'Your location (City, State)'
  },

  // Input Limits (Optional with defaults)
  {
    name: 'MAX_JOB_DESCRIPTION_LENGTH',
    required: false,
    pattern: /^\d+$/,
    category: 'limits',
    description: 'Maximum job description length'
  },
  {
    name: 'MAX_RESUME_SECTION_LENGTH',
    required: false,
    pattern: /^\d+$/,
    category: 'limits',
    description: 'Maximum resume section length'
  },

  // Feature Flags
  {
    name: 'ENABLE_EMAIL_SYNC',
    required: false,
    pattern: /^(true|false)$/,
    category: 'features',
    description: 'Enable Gmail synchronization'
  },
  {
    name: 'ENABLE_JOB_SCRAPING',
    required: false,
    pattern: /^(true|false)$/,
    category: 'features',
    description: 'Enable job board scraping'
  },
  {
    name: 'ENABLE_SETUP_MODE',
    required: false,
    pattern: /^(true|false)$/,
    category: 'features',
    description: 'Enable setup mode for initial configuration'
  },
  {
    name: 'DISABLE_AUTH_IN_DEV',
    required: false,
    pattern: /^(true|false)$/,
    category: 'features',
    description: 'Completely disable authentication in development'
  }
];

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  summary: {
    total: number;
    required: number;
    optional: number;
    missing: number;
    invalid: number;
  };
}

/**
 * Validates environment variables
 */
export function validateEnv(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let missingCount = 0;
  let invalidCount = 0;

  // Group by category for better error reporting
  const categories = [...new Set(ENV_VARS.map(v => v.category))];
  
  for (const category of categories) {
    const categoryVars = ENV_VARS.filter(v => v.category === category);
    const categoryErrors: string[] = [];
    
    for (const envVar of categoryVars) {
      const value = process.env[envVar.name];
      
      // Check if required variable is missing
      if (envVar.required && !value) {
        categoryErrors.push(`  - ${envVar.name}: ${envVar.description}`);
        missingCount++;
        continue;
      }
      
      // Skip validation for optional variables that aren't set
      if (!envVar.required && !value) {
        continue;
      }
      
      // Validate minimum length
      if (envVar.minLength && value && value.length < envVar.minLength) {
        errors.push(
          `[${category.toUpperCase()}] ${envVar.name} is too short (${value.length} chars, min: ${envVar.minLength})`
        );
        invalidCount++;
      }
      
      // Validate pattern
      if (envVar.pattern && value && !envVar.pattern.test(value)) {
        errors.push(
          `[${category.toUpperCase()}] ${envVar.name} has invalid format`
        );
        invalidCount++;
      }
      
      // Warn about sensitive variables in development
      if (envVar.sensitive && process.env.NODE_ENV === 'development' && value?.includes('example')) {
        warnings.push(
          `[${category.toUpperCase()}] ${envVar.name} appears to contain an example value`
        );
      }
    }
    
    if (categoryErrors.length > 0) {
      errors.unshift(`\n[${category.toUpperCase()}] Missing required variables:`);
      errors.push(...categoryErrors);
    }
  }

  // Validate critical Supabase configuration exists
  try {
    getSupabaseUrl();
    getSupabaseAnonKey();
  } catch (error) {
    if (error instanceof Error) {
      errors.push(`[DATABASE] ${error.message}`);
      missingCount++;
    }
  }

  // Add security warnings
  if (process.env.NODE_ENV === 'production') {
    if (process.env.NEXTAUTH_URL?.startsWith('http://')) {
      warnings.push('[SECURITY] NEXTAUTH_URL should use HTTPS in production');
    }
    
    if (process.env.DEBUG_MODE === 'true') {
      warnings.push('[SECURITY] DEBUG_MODE is enabled in production');
    }
    
    // Warn if using manual Supabase variables in production
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.SUPABASE_URL) {
      warnings.push('[DATABASE] Using manual NEXT_PUBLIC_SUPABASE_URL in production. Consider using Supabase integration for automatic key rotation.');
    }
    if (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && !process.env.SUPABASE_ANON_KEY) {
      warnings.push('[DATABASE] Using manual NEXT_PUBLIC_SUPABASE_ANON_KEY in production. Consider using Supabase integration for automatic key rotation.');
    }
  }
  
  // Add development information about variable sources (only if using suboptimal config)
  if (process.env.NODE_ENV === 'development') {
    if (!process.env.SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_URL) {
      warnings.push('[DATABASE] Using manual NEXT_PUBLIC_SUPABASE_URL (consider using Supabase integration for better security)');
    }
    
    if (!process.env.SUPABASE_ANON_KEY && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      warnings.push('[DATABASE] Using manual NEXT_PUBLIC_SUPABASE_ANON_KEY (consider using Supabase integration for better security)');
    }
  }

  // Check for deprecated variables
  if (process.env.OPENAI_API_KEY) {
    warnings.push('[DEPRECATED] OPENAI_API_KEY is set but no longer used (replaced by GOOGLE_GENERATIVE_AI_API_KEY)');
  }

  const requiredCount = ENV_VARS.filter(v => v.required).length;
  const optionalCount = ENV_VARS.filter(v => !v.required).length;

  return {
    valid: missingCount === 0 && invalidCount === 0,
    errors,
    warnings,
    summary: {
      total: ENV_VARS.length,
      required: requiredCount,
      optional: optionalCount,
      missing: missingCount,
      invalid: invalidCount
    }
  };
}

/**
 * Logs validation results with color coding
 */
export function logValidationResult(result: ValidationResult): void {
  const { errors, warnings, summary } = result;
  
  console.log('\n🔍 Environment Variable Validation Report\n');
  console.log(`Total Variables: ${summary.total} (${summary.required} required, ${summary.optional} optional)`);
  
  if (result.valid) {
    console.log('✅ All required environment variables are properly configured!\n');
  } else {
    console.log(`❌ Found ${summary.missing} missing and ${summary.invalid} invalid variables\n`);
  }
  
  if (errors.length > 0) {
    console.error('🔴 CONFIGURATION ERRORS:');
    errors.forEach(error => console.error('  ' + error));
    console.log('');
  }
  
  if (warnings.length > 0) {
    console.warn('🟡 CONFIGURATION WARNINGS:');
    warnings.forEach(warning => console.warn('  ' + warning));
    console.log('');
  }
  
  if (!result.valid) {
    console.error('❌ Application may not function correctly without required variables.');
    console.error('📄 Create a .env.local file with required configuration.\n');
  }
}

/**
 * Validates environment and throws error if critical variables are missing
 */
export function validateEnvOrThrow(): void {
  const result = validateEnv();
  
  if (!result.valid) {
    logValidationResult(result);
    throw new Error(
      `Missing ${result.summary.missing} required environment variables. ` +
      'Please check your .env.local file.'
    );
  }
  
  // Log warnings but don't throw
  if (result.warnings.length > 0) {
    logValidationResult(result);
  }
}

/**
 * Gets a required environment variable or throws an error
 * Provides fallback values during build process
 */
export function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    // During build process, provide fallback values to prevent build failures
    if (process.env.NEXT_PHASE || process.env.NODE_ENV === 'test') {
      const fallbacks: Record<string, string> = {
        PERSONAL_API_KEY: 'build-fallback-32-chars-min-value-here',
        ENCRYPTION_KEY: 'build-fallback-encryption-key-32-chars',
        NEXTAUTH_SECRET: 'build-fallback-nextauth-secret-32-chars',
        NEXTAUTH_URL: 'http://localhost:3000',
        SUPABASE_SERVICE_ROLE_KEY: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.build-fallback',
        GOOGLE_GENERATIVE_AI_API_KEY: 'AIza-build-fallback-api-key',
        GOOGLE_CLIENT_ID: 'build-fallback.apps.googleusercontent.com',
        GOOGLE_CLIENT_SECRET: 'build-fallback-secret',
        USER_FULL_NAME: 'Build User',
        USER_EMAIL: 'build@example.com',
      };
      
      return fallbacks[name] || 'build-fallback-value';
    }
    
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * Gets an optional environment variable with a default value
 */
export function getOptionalEnv(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}

/**
 * Checks if a feature flag is enabled
 */
export function isFeatureEnabled(featureName: string): boolean {
  const value = process.env[`ENABLE_${featureName.toUpperCase()}`];
  return value === 'true';
}

/**
 * Gets Supabase URL with fallback logic
 * Prioritizes integration-provided SUPABASE_URL, falls back to manual NEXT_PUBLIC_SUPABASE_URL
 */
export function getSupabaseUrl(): string {
  const integrationUrl = process.env.SUPABASE_URL;
  const manualUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  
  const url = integrationUrl || manualUrl;
  if (!url) {
    // During build process, provide fallback
    if (process.env.NEXT_PHASE || process.env.NODE_ENV === 'test') {
      return 'https://build-fallback.supabase.co';
    }
    
    throw new Error(
      'Missing Supabase URL. Please set either SUPABASE_URL (integration-provided) or NEXT_PUBLIC_SUPABASE_URL (manual)'
    );
  }
  
  return url;
}

/**
 * Gets Supabase anonymous key with fallback logic
 * Prioritizes integration-provided SUPABASE_ANON_KEY, falls back to manual NEXT_PUBLIC_SUPABASE_ANON_KEY
 */
export function getSupabaseAnonKey(): string {
  const integrationKey = process.env.SUPABASE_ANON_KEY;
  const manualKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  const key = integrationKey || manualKey;
  if (!key) {
    // During build process, provide fallback
    if (process.env.NEXT_PHASE || process.env.NODE_ENV === 'test') {
      return 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.build-fallback-anon-key';
    }
    
    throw new Error(
      'Missing Supabase anonymous key. Please set either SUPABASE_ANON_KEY (integration-provided) or NEXT_PUBLIC_SUPABASE_ANON_KEY (manual)'
    );
  }
  
  return key;
}

// Export validation result for use in build scripts
export default validateEnv;