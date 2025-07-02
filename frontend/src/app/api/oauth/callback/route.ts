import { NextRequest, NextResponse } from 'next/server';
import { GmailOAuthService } from '@/api/_lib/gmail/oauth';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    
    // Handle OAuth errors
    if (error) {
      console.error('OAuth error:', error);
      return NextResponse.redirect(
        `${process.env.CORS_ALLOWED_ORIGIN || 'http://localhost:3000'}/settings?error=oauth_denied`
      );
    }
    
    // Validate required parameters
    if (!code || !state) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }
    
    // Get stored state from cookie
    const storedState = request.cookies.get('oauth_state')?.value;
    
    // Validate CSRF state
    if (!storedState || storedState !== state) {
      console.error('CSRF validation failed:', { storedState, receivedState: state });
      return NextResponse.json(
        { error: 'Invalid state parameter - possible CSRF attack' },
        { status: 400 }
      );
    }
    
    // For a personal app, we'll use a default user ID
    // In a production app, you would get this from your auth system
    const userId = process.env.USER_ID || 'personal-user';
    
    // You could also get it from a cookie if you have a session system
    // const userId = request.cookies.get('user_id')?.value;
    
    if (!userId) {
      return NextResponse.json(
        { error: 'User authentication required' },
        { status: 401 }
      );
    }
    
    // Initialize OAuth service
    const oauthService = new GmailOAuthService();
    
    // Exchange code for tokens and store them
    const tokens = await oauthService.handleCallback(code, userId);
    
    if (!tokens) {
      return NextResponse.json(
        { error: 'Failed to exchange authorization code' },
        { status: 500 }
      );
    }
    
    // Create response with redirect to settings page
    const response = NextResponse.redirect(
      `${process.env.CORS_ALLOWED_ORIGIN || 'http://localhost:3000'}/settings?oauth=success`
    );
    
    // Clear the state cookie
    response.cookies.delete('oauth_state');
    
    return response;
  } catch (error) {
    console.error('OAuth callback error:', error);
    
    // Clear state cookie on error
    const response = NextResponse.json(
      { error: 'OAuth callback failed' },
      { status: 500 }
    );
    response.cookies.delete('oauth_state');
    
    return response;
  }
}