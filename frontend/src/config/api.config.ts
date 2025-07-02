/**
 * API Configuration
 * Centralized configuration for all API endpoints and settings
 */

export const apiConfig = {
  baseUrl: process.env.NEXT_PUBLIC_API_URL || '',
  timeout: parseInt(process.env.NEXT_PUBLIC_API_TIMEOUT || '30000'),
  
  // Authentication disabled for personal use
  auth: {
    enabled: false,
    domain: '',
    clientId: '',
  },
  
  // Feature flags
  features: {
    jobScraper: process.env.NEXT_PUBLIC_ENABLE_JOB_SCRAPER === 'true',
    backgroundSync: process.env.NEXT_PUBLIC_ENABLE_BACKGROUND_SYNC === 'true',
  },
  
  // Debug settings
  debug: process.env.NEXT_PUBLIC_DEBUG_MODE === 'true',
  
  // API endpoints
  endpoints: {
    // Job Analysis
    analyzeJob: '/api/analyze-job',
    parseLinkedInJob: '/api/parse-linkedin-job',
    llmProviders: '/api/llm-providers',
    
    // Resume Generation
    generateSection: '/api/generate-section',
    exportResume: '/api/export-resume',
    tailorResumeComplete: '/api/tailor-resume-complete',
    exportSimpleResume: '/api/export-simple-resume',
    
    // Resume Library
    resumeLibrary: '/api/resume-library',
    resumeDetails: (id: string) => `/api/resume-library/${id}`,
    downloadResume: (id: string) => `/api/resume-library/${id}/download`,
    
    // Job Scraping
    jobs: '/api/jobs',
    jobDetails: (id: string) => `/api/jobs/${id}`,
    jobScrape: '/api/jobs/scrape',
    jobStats: '/api/jobs/stats',
    jobFilters: '/api/jobs/filters',
    jobSave: '/api/jobs/save',
    jobsSaved: '/api/jobs/saved',
    
    // Service Status
    serviceStatus: '/api/service-status',
    
    // Email Service
    sendEmail: '/api/send-email',
    
    // Authentication endpoints removed
  }
}

/**
 * Get full API URL
 */
export function getApiUrl(endpoint: string): string {
  return `${apiConfig.baseUrl}${endpoint}`
}

/**
 * Default headers for API requests
 */
export function getDefaultHeaders(includeAuth: boolean = true): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  }
  
  // Add API key for simple authentication (personal use)
  const apiKey = process.env.NEXT_PUBLIC_API_KEY
  if (apiKey && process.env.NEXT_PUBLIC_ENVIRONMENT === 'production') {
    headers['X-API-Key'] = apiKey
  }
  
  // Add authentication headers if enabled and available
  if (includeAuth && apiConfig.auth.enabled) {
    const token = getAuthToken()
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
  }
  
  return headers
}

/**
 * Get authentication token (placeholder - implement based on your auth solution)
 */
function getAuthToken(): string | null {
  // Skip authentication in development or if auth is disabled
  if (!apiConfig.auth.enabled) {
    return null
  }
  
  // This is a placeholder. Implement based on your authentication solution
  // For example, you might:
  // - Get token from localStorage
  // - Get token from a cookie
  // - Get token from an auth context/store
  // - Get token from Supabase session
  
  if (typeof window !== 'undefined') {
    // Check for Supabase session first
    const supabaseToken = localStorage.getItem('supabase.auth.token')
    if (supabaseToken) {
      try {
        const tokenData = JSON.parse(supabaseToken)
        return tokenData?.currentSession?.access_token || null
      } catch {
        // Fall back to simple token
      }
    }
    
    // Fall back to simple auth token
    return localStorage.getItem('auth_token')
  }
  
  return null
}

/**
 * API request wrapper with error handling and authentication
 */
export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = getApiUrl(endpoint)
  
  const defaultOptions: RequestInit = {
    ...options,
    headers: {
      ...getDefaultHeaders(),
      ...(options.headers || {}),
    },
  }
  
  // Add timeout
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), apiConfig.timeout)
  
  try {
    const response = await fetch(url, {
      ...defaultOptions,
      signal: controller.signal,
    })
    
    clearTimeout(timeoutId)
    
    if (!response.ok) {
      // Handle authentication errors
      if (response.status === 401 && apiConfig.auth.enabled) {
        // Redirect to login or refresh token
        handleAuthError()
      }
      
      const errorData = await response.json().catch(() => ({}))
      throw new ApiError(
        errorData.message || `API Error: ${response.status} ${response.statusText}`,
        response.status,
        errorData
      )
    }
    
    return await response.json()
  } catch (error) {
    clearTimeout(timeoutId)
    
    if (error instanceof ApiError) {
      throw error
    }
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new ApiError('Request timeout', 408)
      }
      
      throw new ApiError(
        error.message || 'Network error',
        0
      )
    }
    
    throw new ApiError('Unknown error', 0)
  }
}

/**
 * Custom API Error class
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public data?: any
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * Handle authentication errors (placeholder)
 */
function handleAuthError() {
  // Skip in development or if auth is disabled
  if (!apiConfig.auth.enabled) {
    return
  }
  
  // This is a placeholder. Implement based on your authentication solution
  // For example, you might:
  // - Redirect to login page
  // - Show a login modal
  // - Attempt to refresh the token
  
  if (typeof window !== 'undefined') {
    // Clear any stored auth data
    localStorage.removeItem('auth_token')
    localStorage.removeItem('supabase.auth.token')
    
    // In production, redirect to login
    if (process.env.NEXT_PUBLIC_ENVIRONMENT === 'production') {
      window.location.href = '/login'
    }
  }
}

/**
 * Check if API is available
 */
export async function checkApiHealth(): Promise<boolean> {
  try {
    const response = await fetch(getApiUrl('/health'), {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    })
    return response.ok
  } catch {
    return false
  }
}