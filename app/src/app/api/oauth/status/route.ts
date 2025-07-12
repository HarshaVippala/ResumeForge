import { NextRequest, NextResponse } from 'next/server';
import { gmailOAuthService } from '@/api/_lib/gmail/oauth';
import { checkAuth } from '@/api/_lib/auth/check-auth';
import { getOptionalEnv } from '@/api/_lib/config/validate-env';
import { development } from '@/api/_lib/config';

export async function GET(request: NextRequest) {
  try {
    // Check if we're in build phase and skip database operations
    if (process.env.NEXT_PHASE) {
      return NextResponse.json({ 
        authenticated: false,
        error: 'Service unavailable during build' 
      }, { status: 503 })
    }

    // Check if Gmail OAuth is configured
    const isOAuthConfigured = process.env.GOOGLE_CLIENT_ID && 
                             process.env.GOOGLE_CLIENT_SECRET && 
                             process.env.GMAIL_TOKEN_ENCRYPTION_KEY;
    
    if (!isOAuthConfigured) {
      return NextResponse.json({ 
        authenticated: false,
        error: 'Gmail OAuth is not configured. Please set required environment variables.',
        missingConfig: {
          hasClientId: !!process.env.GOOGLE_CLIENT_ID,
          hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
          hasEncryptionKey: !!process.env.GMAIL_TOKEN_ENCRYPTION_KEY
        }
      });
    }

    // Use unified auth check
    const authResult = checkAuth(request);
    
    if (!authResult.authenticated) {
      return NextResponse.json({ 
        authenticated: false,
        error: authResult.error || 'Not authenticated' 
      });
    }

    const userId = authResult.userId!;
    
    // In development with auth disabled, still check real OAuth status
    // Last modified: 2025-01-09 - Always check real Gmail OAuth status
    // (development.disableAuth only affects app login, not Gmail OAuth)
    
    // Check authentication status
    const isAuthenticated = await gmailOAuthService.isAuthenticated(userId);
    
    // Get email if authenticated
    const email = isAuthenticated ? await gmailOAuthService.getUserEmail(userId) : null;
    
    return NextResponse.json({ 
      authenticated: isAuthenticated,
      userId,
      email
    });
  } catch (error) {
    console.error('OAuth status error:', error);
    
    // Check if it's a configuration error
    if (error instanceof Error && error.message.includes('not configured')) {
      return NextResponse.json(
        { 
          authenticated: false,
          error: error.message,
          isConfigError: true 
        },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to check authentication status' },
      { status: 500 }
    );
  }
}