import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { GmailOAuthService } from '../_lib/gmail/oauth';
import crypto from 'crypto';

export const runtime = 'edge';

/**
 * Initiate OAuth flow for Gmail
 */
export async function GET(req: NextRequest) {
  try {
    const oauthService = new GmailOAuthService();
    
    // Generate state for CSRF protection
    const state = crypto.randomBytes(32).toString('hex');
    
    // Store state in a cookie (httpOnly for security)
    const authUrl = oauthService.getAuthorizationUrl(state);
    
    const response = NextResponse.json({
      authorizationUrl: authUrl,
      message: 'Visit this URL to authorize Gmail access',
    });

    // Set state cookie
    response.cookies.set('oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
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