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

  // Database Configuration
  {
    name: 'NEXT_PUBLIC_SUPABASE_URL',
    required: true,
    pattern: /^https:\/\/.+\.supabase\.co$/,
    category: 'database',
    description: 'Supabase project URL'
  },
  {
    name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    required: true,
    pattern: /^eyJ/,
    category: 'database',
    description: 'Supabase anonymous key (JWT format)'
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

  // User Profile (Required for resume generation)
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

  // Add security warnings
  if (process.env.NODE_ENV === 'production') {
    if (process.env.NEXTAUTH_URL?.startsWith('http://')) {
      warnings.push('[SECURITY] NEXTAUTH_URL should use HTTPS in production');
    }
    
    if (process.env.DEBUG_MODE === 'true') {
      warnings.push('[SECURITY] DEBUG_MODE is enabled in production');
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
    console.error('🔴 ERRORS:');
    errors.forEach(error => console.error(error));
    console.log('');
  }
  
  if (warnings.length > 0) {
    console.warn('🟡 WARNINGS:');
    warnings.forEach(warning => console.warn(warning));
    console.log('');
  }
  
  if (!result.valid) {
    console.error('❌ Application may not function correctly without required variables.');
    console.error('📄 See .env.local.template for configuration details.\n');
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
 */
export function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
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

// Export validation result for use in build scripts
export default validateEnv;