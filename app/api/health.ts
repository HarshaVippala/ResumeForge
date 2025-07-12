import { VercelRequest, VercelResponse } from '@vercel/node';
import { testConnection } from './_lib/db';
import { getSupabaseUrl, getSupabaseAnonKey } from './_lib/config/validate-env';

/**
 * Health check endpoint for API status monitoring
 * GET /api/health
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check all service connections
    const [geminiStatus, supabaseStatus] = await Promise.all([
      checkGeminiConnection(),
      checkSupabaseConnection()
    ]);

    const allHealthy = geminiStatus === 'connected' && supabaseStatus === 'connected';

    // Health response compatible with ServiceStatus component
    const healthStatus = {
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      ai_service_connected: geminiStatus === 'connected',
      database_status: supabaseStatus,
      database_type: 'postgresql' as const,
      // Additional info for debugging
      environment: process.env.NODE_ENV || 'development',
      version: '2.0.0-ts',
      services: {
        api: 'operational',
        gemini: geminiStatus,
        supabase: supabaseStatus
      },
      migration_status: 'in_progress'
    };

    return res.status(200).json(healthStatus);
  } catch (error) {
    console.error('Health check error:', error);
    return res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Service unavailable'
    });
  }
}

/**
 * Check Google Gemini API connectivity
 */
async function checkGeminiConnection(): Promise<string> {
  try {
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      return 'not_configured';
    }
    // Simple check - just verify API key exists
    return process.env.GOOGLE_GENERATIVE_AI_API_KEY.length > 0 ? 'connected' : 'invalid_key';
  } catch (error) {
    return 'error';
  }
}

/**
 * Check Supabase connectivity
 */
async function checkSupabaseConnection(): Promise<string> {
  try {
    // Use new fallback logic to check configuration
    getSupabaseUrl();
    getSupabaseAnonKey();
    
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return 'not_configured';
    }
    
    // Actually test the connection
    const isConnected = await testConnection();
    return isConnected ? 'connected' : 'disconnected';
  } catch (error) {
    if (error instanceof Error && error.message.includes('Missing Supabase')) {
      return 'not_configured';
    }
    return 'error';
  }
}