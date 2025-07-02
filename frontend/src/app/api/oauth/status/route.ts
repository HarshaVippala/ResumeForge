import { NextRequest, NextResponse } from 'next/server';
import { GmailOAuthService } from '@/api/_lib/gmail/oauth';

export async function GET(request: NextRequest) {
  try {
    // For a personal app, we'll use a default user ID
    const userId = process.env.USER_ID || 'personal-user';
    
    // Initialize OAuth service
    const oauthService = new GmailOAuthService();
    
    // Check authentication status
    const isAuthenticated = await oauthService.isAuthenticated(userId);
    
    return NextResponse.json({ 
      authenticated: isAuthenticated,
      userId 
    });
  } catch (error) {
    console.error('OAuth status error:', error);
    return NextResponse.json(
      { error: 'Failed to check authentication status' },
      { status: 500 }
    );
  }
}