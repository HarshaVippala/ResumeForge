import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseUrl, getSupabaseAnonKey } from '../../../../api/_lib/config/validate-env';

/**
 * Health check endpoint for development mode
 * GET /api/health - for Next.js dev server
 * 
 * This is a development-only endpoint that mirrors the Vercel Function
 * at /api/health.ts for when running `npm run dev`
 */
export async function GET(request: NextRequest) {
  try {
    // Check service connections (simplified for dev)
    const [geminiStatus, databaseStatus] = await Promise.all([
      checkGeminiConnection(),
      checkDatabaseConnection()
    ]);

    const allHealthy = geminiStatus === 'connected' && databaseStatus === 'connected';

    // Health response compatible with ServiceStatus component
    const healthStatus = {
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      ai_service_connected: geminiStatus === 'connected',
      database_status: databaseStatus,
      database_type: 'postgresql' as const,
      // Additional info for debugging
      environment: process.env.NODE_ENV || 'development',
      version: '2.0.0-ts-dev',
      services: {
        api: 'operational',
        gemini: geminiStatus,
        supabase: databaseStatus
      },
      migration_status: 'in_progress',
      note: 'Development mode - using Next.js API routes'
    };

    return NextResponse.json(healthStatus);
  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Service unavailable'
      },
      { status: 503 }
    );
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
 * Check Database connectivity (simplified for dev)
 */
async function checkDatabaseConnection(): Promise<string> {
  try {
    // Use new fallback logic to check configuration
    getSupabaseUrl();
    getSupabaseAnonKey();
    
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return 'not_configured';
    }
    
    // For development, just check if credentials are present
    // In production, the Vercel Function will do the actual connection test
    return 'connected';
  } catch (error) {
    if (error instanceof Error && error.message.includes('Missing Supabase')) {
      return 'not_configured';
    }
    return 'error';
  }
}