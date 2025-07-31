import { NextRequest, NextResponse } from 'next/server';
import { gmailOAuthService } from '@/api/_lib/gmail/oauth';
import { getSupabase } from '@/api/_lib/db';
import { tokenCrypto } from '@/api/_lib/gmail/crypto';

export async function GET(request: NextRequest) {
  try {
    const userId = process.env.USER_ID || 'f556989c-4903-47d6-8700-0afe3d4189e5';
    
    // First, revoke existing access
    try {
      await gmailOAuthService.revokeAccess(userId);
      console.log('✅ Revoked existing Gmail access');
    } catch (error) {
      console.log('⚠️  No existing access to revoke or revocation failed:', error);
    }
    
    // Generate new auth URL with explicit scope request
    const state = tokenCrypto.generateSecureState();
    const authUrl = gmailOAuthService.generateAuthUrl(state);
    
    // Set state cookie for CSRF protection
    const response = NextResponse.json({
      success: true,
      message: 'Please visit the authorization URL to reconnect Gmail',
      authUrl,
      instructions: [
        '1. Click the authorization URL below',
        '2. Select your Google account',
        '3. IMPORTANT: Check ALL permission boxes',
        '4. Click "Allow" to grant access',
        '5. You will be redirected back to the callback'
      ]
    });
    
    response.cookies.set('oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10 // 10 minutes
    });
    
    return response;
  } catch (error) {
    console.error('Reconnect error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate auth URL'
    }, { status: 500 });
  }
}