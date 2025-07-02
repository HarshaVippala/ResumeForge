import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { GmailOAuthService } from './_lib/gmail/oauth';

export const runtime = 'edge';

/**
 * Combined OAuth API
 * GET /api/oauth?action=authorize - Initialize OAuth flow
 * GET /api/oauth?action=callback - Handle OAuth callback
 */
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const action = searchParams.get('action') || 'authorize';

  try {
    const oauthService = new GmailOAuthService();

    if (action === 'authorize') {
      // Initialize OAuth flow
      const state = Math.random().toString(36).substring(7);
      const authUrl = oauthService.getAuthorizationUrl(state);
      
      // Store state for verification (in production, use session/database)
      const response = NextResponse.redirect(authUrl);
      response.cookies.set('oauth_state', state, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 600 // 10 minutes
      });
      
      return response;
    } else if (action === 'callback') {
      // Handle OAuth callback
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      
      if (!code || !state) {
        return NextResponse.json(
          { error: 'Missing code or state parameter' },
          { status: 400 }
        );
      }
      
      // Verify state (in production, compare with stored state)
      const storedState = req.cookies.get('oauth_state')?.value;
      if (state !== storedState) {
        return NextResponse.json(
          { error: 'Invalid state parameter' },
          { status: 400 }
        );
      }
      
      // Exchange code for tokens
      const userId = 'default_user'; // In production, get from session
      const tokens = await oauthService.handleCallback(code, userId);
      
      if (!tokens) {
        return NextResponse.json(
          { error: 'Failed to exchange authorization code' },
          { status: 500 }
        );
      }
      
      // Clear state cookie
      const response = NextResponse.redirect('/dashboard?connected=true');
      response.cookies.delete('oauth_state');
      
      return response;
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('OAuth error:', error);
    return NextResponse.json(
      { error: 'OAuth process failed' },
      { status: 500 }
    );
  }
}