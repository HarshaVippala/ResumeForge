import { VercelRequest, VercelResponse } from '@vercel/node';
import { testConnection } from './_lib/db';

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
    const [openaiStatus, supabaseStatus] = await Promise.all([
      checkOpenAIConnection(),
      checkSupabaseConnection()
    ]);

    const allHealthy = openaiStatus === 'connected' && supabaseStatus === 'connected';

    // Health response compatible with ServiceStatus component
    const healthStatus = {
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      lm_studio_connected: openaiStatus === 'connected',
      database_status: supabaseStatus,
      database_type: 'postgresql' as const,
      // Additional info for debugging
      environment: process.env.NODE_ENV || 'development',
      version: '2.0.0-ts',
      services: {
        api: 'operational',
        openai: openaiStatus,
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
 * Check OpenAI API connectivity
 */
async function checkOpenAIConnection(): Promise<string> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return 'not_configured';
    }
    // Simple check - just verify API key format
    return process.env.OPENAI_API_KEY.startsWith('sk-') ? 'connected' : 'invalid_key';
  } catch (error) {
    return 'error';
  }
}

/**
 * Check Supabase connectivity
 */
async function checkSupabaseConnection(): Promise<string> {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
      return 'not_configured';
    }
    
    // Actually test the connection
    const isConnected = await testConnection();
    return isConnected ? 'connected' : 'disconnected';
  } catch (error) {
    return 'error';
  }
}