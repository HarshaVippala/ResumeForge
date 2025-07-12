import { NextRequest, NextResponse } from 'next/server';
import { gmailOAuthService } from '@/api/_lib/gmail/oauth';
import { google } from 'googleapis';

export async function GET(request: NextRequest) {
  try {
    const userId = process.env.USER_ID || 'f556989c-4903-47d6-8700-0afe3d4189e5';
    
    // Check if authenticated
    const isAuthenticated = await gmailOAuthService.isAuthenticated(userId);
    if (!isAuthenticated) {
      return NextResponse.json({
        success: false,
        error: 'Not authenticated with Gmail',
        userId
      }, { status: 401 });
    }
    
    // Get authenticated client
    const authClient = await gmailOAuthService.getAuthenticatedClient(userId);
    if (!authClient) {
      return NextResponse.json({
        success: false,
        error: 'Could not get authenticated client',
        userId
      }, { status: 500 });
    }
    
    // Try to get Gmail profile
    const gmail = google.gmail({ version: 'v1', auth: authClient });
    
    try {
      // Test with a simple API call - get user profile
      const { data: profile } = await gmail.users.getProfile({
        userId: 'me'
      });
      
      return NextResponse.json({
        success: true,
        message: 'Gmail connection successful!',
        userId,
        profile: {
          emailAddress: profile.emailAddress,
          messagesTotal: profile.messagesTotal,
          threadsTotal: profile.threadsTotal,
          historyId: profile.historyId
        }
      });
    } catch (apiError: any) {
      // Check if it's a scope issue
      if (apiError.message?.includes('insufficient') || apiError.message?.includes('scope')) {
        return NextResponse.json({
          success: false,
          error: 'Insufficient permissions. Please reconnect Gmail with all required scopes.',
          details: apiError.message,
          userId
        }, { status: 403 });
      }
      
      return NextResponse.json({
        success: false,
        error: 'Gmail API error',
        details: apiError.message,
        userId
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Test connection error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: process.env.USER_ID || 'f556989c-4903-47d6-8700-0afe3d4189e5'
    }, { status: 500 });
  }
}