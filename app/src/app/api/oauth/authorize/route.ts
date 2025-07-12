import { NextRequest, NextResponse } from 'next/server';
import { gmailOAuthService } from '@/api/_lib/gmail/oauth';
import { verifySessionToken } from '@/api/_lib/auth/session';
import { getOptionalEnv } from '@/api/_lib/config/validate-env';
import { development } from '@/api/_lib/config';
import crypto from 'crypto';

export async function GET(request: NextRequest) {
  try {
    let userId: string | null = null;

    // Check if auth is disabled in development
    // Last modified: 2025-01-09 - Always use harsha-primary in development
    if (development.disableAuth) {
      userId = 'f556989c-4903-47d6-8700-0afe3d4189e5';
    } else {
      // First check for API key authentication
      const apiKey = request.headers.get('x-api-key');
      const personalApiKey = process.env.PERSONAL_API_KEY;
      
      if (apiKey && personalApiKey && apiKey === personalApiKey) {
        // Use configured USER_ID for API key authentication
        userId = getOptionalEnv('USER_ID', 'f556989c-4903-47d6-8700-0afe3d4189e5');
      } else {
        // Fall back to session-based authentication
        const authToken = request.cookies.get('auth_token')?.value;
        
        if (!authToken) {
          return NextResponse.redirect(
            `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/login?error=not_authenticated`
          );
        }

        const session = verifySessionToken(authToken);
        
        if (!session || !session.userId) {
          return NextResponse.redirect(
            `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/login?error=session_expired`
          );
        }
        
        userId = session.userId;
      }
    }

    if (!userId) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/login?error=no_auth`
      );
    }

    // Generate CSRF state token
    const state = crypto.randomBytes(32).toString('hex');
    
    // Get authorization URL with state parameter
    const authUrl = gmailOAuthService.generateAuthUrl(state);
    
    // Create response with redirect
    const response = NextResponse.redirect(authUrl);
    
    // Set state in httpOnly cookie with security settings
    response.cookies.set('oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10, // 10 minutes expiry
      path: '/'
    });
    
    // Also store the user ID associated with this OAuth flow
    response.cookies.set('oauth_user_id', userId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10, // 10 minutes expiry
      path: '/'
    });
    
    return response;
  } catch (error) {
    console.error('OAuth authorization error:', error);
    return NextResponse.json(
      { error: 'Failed to initialize OAuth flow' },
      { status: 500 }
    );
  }
}