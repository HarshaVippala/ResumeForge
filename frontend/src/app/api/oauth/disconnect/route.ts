import { NextRequest, NextResponse } from 'next/server';
import { GmailOAuthService } from '@/api/_lib/gmail/oauth';

export async function POST(request: NextRequest) {
  try {
    // For a personal app, we'll use a default user ID
    const userId = process.env.USER_ID || 'personal-user';
    
    // Initialize OAuth service
    const oauthService = new GmailOAuthService();
    
    // Revoke authentication
    await oauthService.revokeAuth(userId);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('OAuth disconnect error:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect Gmail' },
      { status: 500 }
    );
  }
}