import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { GmailService } from './_lib/gmail/service';

export const runtime = 'edge';

/**
 * Send email via Gmail API
 */
export async function POST(req: NextRequest) {
  try {
    const { to, subject, body, userId = 'default_user' } = await req.json();
    
    // Validate inputs
    if (!to || !subject || !body) {
      return NextResponse.json(
        { error: 'Missing required fields: to, subject, body' },
        { status: 400 }
      );
    }
    
    const gmailService = new GmailService();
    
    await gmailService.sendEmail(userId, to, subject, body);
    
    return NextResponse.json({
      success: true,
      message: 'Email sent successfully',
    });
  } catch (error: any) {
    console.error('Send email error:', error);
    
    if (error.message === 'Not authenticated') {
      return NextResponse.json(
        { error: 'Gmail not connected. Please authorize first.' },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    );
  }
}