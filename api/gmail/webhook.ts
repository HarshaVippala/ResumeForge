import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { GmailPubSubService } from '../_lib/gmail/pubsub';

interface PubSubMessage {
  message: {
    data: string;
    messageId: string;
    publishTime: string;
  };
  subscription: string;
}

export const runtime = 'edge';

/**
 * Webhook endpoint for Gmail Push Notifications via Pub/Sub
 */
export async function POST(req: NextRequest) {
  try {
    const pubsubService = new GmailPubSubService();
    
    // Verify the request is from Google Pub/Sub
    const authHeader = req.headers.get('authorization');
    const isValid = await pubsubService.verifyPubSubToken(authHeader);
    
    if (!isValid) {
      console.error('Invalid Pub/Sub token');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse the Pub/Sub message
    const body = await req.json() as PubSubMessage;
    
    // Process the message asynchronously
    // In Edge runtime, we need to complete quickly
    pubsubService.processPubSubMessage(body).catch(error => {
      console.error('Failed to process Pub/Sub message:', error);
    });

    // Acknowledge the message immediately
    return NextResponse.json({ success: true }, { status: 200 });
    
  } catch (error) {
    console.error('Webhook error:', error);
    // Return 200 to prevent Pub/Sub retries for malformed messages
    return NextResponse.json({ error: 'Bad request' }, { status: 200 });
  }
}