import { NextRequest, NextResponse } from 'next/server';
import { gmailOAuthService } from '@/api/_lib/gmail/oauth';
import { verifySessionToken } from '@/api/_lib/auth/session';
import { development } from '@/api/_lib/config';

export async function POST(request: NextRequest) {
  try {
    // Get user ID from session or use hardcoded ID in development
    // Last modified: 2025-01-09 - Handle development auth bypass
    let userId: string;
    
    if (development.disableAuth) {
      userId = 'f556989c-4903-47d6-8700-0afe3d4189e5';
    } else {
      const authToken = request.cookies.get('auth_token')?.value;
      
      if (!authToken) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
      }

      const session = verifySessionToken(authToken);
      
      if (!session || !session.userId) {
        return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
      }

      userId = session.userId;
    }
    
    // Revoke authentication
    await gmailOAuthService.revokeAccess(userId);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('OAuth disconnect error:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect Gmail' },
      { status: 500 }
    );
  }
}