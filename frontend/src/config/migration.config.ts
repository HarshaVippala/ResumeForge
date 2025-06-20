/**
 * Migration Configuration
 * Allows switching between Flask (Python) and TypeScript APIs during migration
 */

export const migrationConfig = {
  // Set to true to use TypeScript/Vercel API, false for Flask
  useTypescriptApi: process.env.NEXT_PUBLIC_USE_TYPESCRIPT_API === 'true' || false,
  
  // API URLs
  flaskApiUrl: process.env.NEXT_PUBLIC_FLASK_API_URL || 'http://localhost:5001',
  typescriptApiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
  
  // Migrated endpoints (set to true when ready)
  migratedEndpoints: {
    health: true,
    analyzeJob: true,
    tailorResumeComplete: true,
    exportSimpleResume: true,
    parseLinkedInJob: true,
    // Add more as they are migrated
    generateSection: false,
    exportResume: false,
    resumeLibrary: false,
    jobs: false,
    serviceStatus: false,
    sendEmail: false,
  }
}

/**
 * Get the appropriate API URL for an endpoint
 */
export function getApiEndpointUrl(endpoint: keyof typeof migrationConfig.migratedEndpoints): string {
  const baseUrl = (migrationConfig.useTypescriptApi && migrationConfig.migratedEndpoints[endpoint])
    ? migrationConfig.typescriptApiUrl
    : migrationConfig.flaskApiUrl;
    
  return baseUrl;
}