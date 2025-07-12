import { NextRequest, NextResponse } from 'next/server';
import { gmailOAuthService } from '@/api/_lib/gmail/oauth';
import { verifySessionToken } from '@/api/_lib/auth/session';
import { development } from '@/api/_lib/config';

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
        `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/dashboard/settings?error=oauth_denied`
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
    
    // Get user ID from session or OAuth flow cookie
    // Last modified: 2025-01-09 - Handle development auth bypass
    let userId: string;
    
    if (development.disableAuth) {
      // In development with auth disabled, always use harsha-primary
      userId = 'f556989c-4903-47d6-8700-0afe3d4189e5';
    } else {
      const authToken = request.cookies.get('auth_token')?.value;
      const oauthUserId = request.cookies.get('oauth_user_id')?.value;
      
      if (authToken) {
        const session = verifySessionToken(authToken);
        if (session && session.userId) {
          userId = session.userId;
        } else if (oauthUserId) {
          // Fallback to OAuth user ID if session is invalid but we have the OAuth cookie
          userId = oauthUserId;
        } else {
          // If no valid session and no OAuth user ID, redirect to login
          return NextResponse.redirect(
            `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/login?error=session_expired`
          );
        }
      } else if (oauthUserId) {
        // Use OAuth user ID if no auth token but we have the OAuth cookie
        userId = oauthUserId;
      } else {
        // If no auth token and no OAuth user ID, redirect to login
        return NextResponse.redirect(
          `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/login?error=not_authenticated`
        );
      }
    }
    
    // Log for debugging
    console.log('OAuth callback processing for user:', userId);
    
    // Exchange code for tokens and store them
    const { tokens, email } = await gmailOAuthService.exchangeCodeForTokens(code);
    
    if (!tokens) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/dashboard/settings?error=token_exchange_failed`
      );
    }
    
    // Store tokens securely
    console.log('Attempting to store tokens for:', { userId, email, hasTokens: !!tokens });
    await gmailOAuthService.storeTokens(userId, tokens, email);
    console.log('Tokens stored successfully');
    
    // Redirect to settings page with success message
    const response = NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/dashboard/settings?success=gmail_connected&email=${encodeURIComponent(email)}`
    );
    
    // Clear the OAuth cookies
    response.cookies.delete('oauth_state');
    response.cookies.delete('oauth_user_id');
    
    return response;
  } catch (error) {
    console.error('OAuth callback error:', error);
    
    // Determine error type for better user feedback
    let errorParam = 'callback_failed';
    if (error.message?.includes('credentials not configured')) {
      errorParam = 'oauth_not_configured';
    } else if (error.message?.includes('sync_metadata')) {
      errorParam = 'database_error';
    }
    
    // Redirect with error
    const response = NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/dashboard/settings?error=${errorParam}`
    );
    
    response.cookies.delete('oauth_state');
    response.cookies.delete('oauth_user_id');
    
    return response;
  }
}