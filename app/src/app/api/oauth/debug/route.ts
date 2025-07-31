import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const config = {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ? '***hidden***' : 'NOT SET',
    redirectUri: process.env.GOOGLE_REDIRECT_URI,
    corsOrigin: process.env.CORS_ALLOWED_ORIGIN,
    userId: process.env.USER_ID,
    encryptionKey: process.env.GMAIL_TOKEN_ENCRYPTION_KEY ? '✅ Set' : '❌ Not set',
  };

  return NextResponse.json({
    message: 'OAuth Debug Information',
    config,
    expectedRedirectUri: process.env.GOOGLE_REDIRECT_URI || `${process.env.CORS_ALLOWED_ORIGIN}/api/oauth/callback`,
    instructions: {
      step1: 'Clear browser cookies for localhost',
      step2: 'Visit /api/oauth/authorize to start OAuth flow',
      step3: 'Complete Google authorization',
      step4: 'Check /api/oauth/status for connection status'
    },
    troubleshooting: {
      stateMismatch: 'Clear cookies and try again',
      redirectUriMismatch: 'Ensure redirect URI matches in Google Console',
      tokenExchangeFailed: 'Check client secret and redirect URI'
    }
  });
}