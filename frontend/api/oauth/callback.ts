import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { GmailOAuthService } from '../_lib/gmail/oauth';

export const runtime = 'edge';

/**
 * Handle OAuth callback from Google
 */
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  // Check for errors
  if (error) {
    return NextResponse.redirect(
      `${process.env.CORS_ALLOWED_ORIGIN}/dashboard?auth_error=${error}`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${process.env.CORS_ALLOWED_ORIGIN}/dashboard?auth_error=no_code`
    );
  }

  // Verify state for CSRF protection
  const storedState = req.cookies.get('oauth_state')?.value;
  if (!state || state !== storedState) {
    return NextResponse.redirect(
      `${process.env.CORS_ALLOWED_ORIGIN}/dashboard?auth_error=invalid_state`
    );
  }

  try {
    const oauthService = new GmailOAuthService();
    
    // Exchange code for tokens
    const tokens = await oauthService.getTokens(code);
    
    // For personal use, we'll use a fixed user ID
    // In production, this would come from your auth system
    const userId = 'default_user';
    
    // Store tokens
    await oauthService.storeTokens(userId, tokens);
    
    // Redirect to success page
    const response = NextResponse.redirect(
      `${process.env.CORS_ALLOWED_ORIGIN}/dashboard?auth_success=gmail`
    );
    
    // Clear state cookie
    response.cookies.delete('oauth_state');
    
    return response;
  } catch (error) {
    console.error('OAuth callback error:', error);
    return NextResponse.redirect(
      `${process.env.CORS_ALLOWED_ORIGIN}/dashboard?auth_error=callback_failed`
    );
  }
}