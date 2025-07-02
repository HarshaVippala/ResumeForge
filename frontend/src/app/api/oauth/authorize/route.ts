import { NextRequest, NextResponse } from 'next/server';
import { GmailOAuthService } from '@/api/_lib/gmail/oauth';
import crypto from 'crypto';

export async function GET(request: NextRequest) {
  try {
    // Generate CSRF state token
    const state = crypto.randomBytes(32).toString('hex');
    
    // Initialize OAuth service
    const oauthService = new GmailOAuthService();
    
    // Get authorization URL with state parameter
    const authUrl = oauthService.getAuthorizationUrl(state);
    
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
    
    return response;
  } catch (error) {
    console.error('OAuth authorization error:', error);
    return NextResponse.json(
      { error: 'Failed to initialize OAuth flow' },
      { status: 500 }
    );
  }
}