import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/api/_lib/db';
import { gmailService } from '@/api/_lib/gmail/service';
import { emailProcessingService } from '@/api/_lib/gmail/email-processor';

/**
 * Gmail Push Notification Webhook
 * 
 * POST /api/gmail/webhook
 * 
 * Handles Gmail push notifications from Google Pub/Sub
 * Triggers incremental sync when new emails arrive
 */
export async function POST(request: NextRequest) {
  try {
    // Parse the Pub/Sub message
    const body = await request.json();
    
    // Google Pub/Sub sends the message in a specific format
    if (!body.message) {
      return NextResponse.json({ error: 'Invalid notification format' }, { status: 400 });
    }

    // Decode the message data
    const messageData = JSON.parse(
      Buffer.from(body.message.data, 'base64').toString()
    );

    console.log('📬 Gmail webhook received:', {
      messageId: body.message.messageId,
      publishTime: body.message.publishTime,
      emailAddress: messageData.emailAddress,
      historyId: messageData.historyId
    });

    // Extract user email from the notification
    const emailAddress = messageData.emailAddress;
    if (!emailAddress) {
      return NextResponse.json({ error: 'No email address in notification' }, { status: 400 });
    }

    // Get user ID from email address
    const db = getSupabase();
    const { data: oauthToken } = await db
      .from('oauth_tokens')
      .select('user_id')
      .eq('email', emailAddress)
      .single();

    if (!oauthToken) {
      console.warn(`No user found for email: ${emailAddress}`);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userId = oauthToken.user_id;

    // Check if we've already processed this notification
    const { data: processed } = await db
      .from('activity_log')
      .select('id')
      .eq('event_type', 'gmail_webhook_processed')
      .eq('metadata->>message_id', body.message.messageId)
      .single();

    if (processed) {
      console.log('📬 Notification already processed, skipping');
      return NextResponse.json({ status: 'already_processed' });
    }

    // Mark notification as processed
    await db
      .from('activity_log')
      .insert({
        event_type: 'gmail_webhook_processed',
        entity_type: 'webhook',
        entity_id: body.message.messageId,
        description: 'Gmail webhook notification received',
        metadata: {
          message_id: body.message.messageId,
          processed_at: new Date().toISOString()
        },
        source: 'gmail_webhook'
      });

    // Check if there's already an active sync job
    const { data: activeSyncs } = await db
      .from('activity_log')
      .select('*')
      .eq('entity_type', 'sync_job')
      .in('event_type', ['gmail_sync_started', 'gmail_sync_running'])
      .not('metadata->>status', 'in', '(completed,failed)')
      .order('created_at', { ascending: false })
      .limit(1);

    if (activeSyncs && activeSyncs.length > 0) {
      const lastSync = activeSyncs[0];
      // Check if sync was started recently (within last 5 minutes)
      const syncAge = Date.now() - new Date(lastSync.created_at).getTime();
      if (syncAge < 5 * 60 * 1000) {
        console.log('📬 Sync already in progress, skipping webhook sync');
        return NextResponse.json({ status: 'sync_in_progress' });
      }
    }

    // Create async sync job for the webhook
    const syncJobId = crypto.randomUUID();
    const { error: jobError } = await db
      .from('activity_log')
      .insert({
        event_type: 'gmail_sync_started',
        entity_type: 'sync_job',
        entity_id: syncJobId,
        description: 'Started webhook-triggered Gmail sync',
        metadata: {
          job_id: syncJobId,
          sync_type: 'webhook',
          status: 'pending',
          user_id: userId,
          trigger: 'webhook',
          historyId: messageData.historyId,
          emailAddress: emailAddress
        },
        source: 'gmail_webhook'
      });

    if (jobError) {
      console.error('Failed to create webhook sync job:', jobError);
      throw new Error('Failed to create webhook sync job');
    }

    // Process the sync asynchronously
    processWebhookSync(userId, syncJobId, messageData.historyId);

    // Return immediately (webhook needs fast response)
    return NextResponse.json({
      status: 'accepted',
      jobId: syncJobId,
      message: 'Webhook sync job created'
    });

  } catch (error) {
    console.error('💥 Gmail webhook error:', error);
    
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Webhook processing failed'
    }, { status: 500 });
  }
}

/**
 * Process webhook sync asynchronously
 */
async function processWebhookSync(userId: string, jobId: string, historyId: string) {
  const db = getSupabase();
  const startTime = Date.now();

  try {
    // Log job status as running - using application_events
    await db
      .from('application_events')
      .insert({
        event_type: 'gmail_sync_running',
        job_id: jobId,
        description: 'Running webhook-triggered Gmail sync',
        event_data: {
          job_id: jobId,
          status: 'running',
          started_at: new Date().toISOString(),
          historyId: historyId,
          source: 'gmail_webhook'
        }
      });

    // Perform incremental sync
    const result = await gmailService.incrementalSync(userId);

    // Process any unprocessed emails
    const processingResult = await emailProcessingService.processUnprocessedEmails({
      batchSize: 5, // Smaller batch for webhook
      maxRetries: 2,
      priorityThreshold: 8
    });

    const duration = Date.now() - startTime;

    // Log job as completed - using application_events
    await db
      .from('application_events')
      .insert({
        event_type: 'gmail_sync_completed',
        job_id: jobId,
        description: `Webhook sync completed: ${result.emailsSynced} emails synced`,
        event_data: {
          job_id: jobId,
          status: 'completed',
          progress: 100,
          completed_at: new Date().toISOString(),
          processed_emails: result.emailsSynced,
          result: {
            emailsSynced: result.emailsSynced,
            emailsProcessed: processingResult.processed,
            trigger: 'webhook',
            historyId: historyId
          },
          sync_stats: {
            duration,
            source: 'webhook'
          }
        },
        source: 'gmail_webhook'
      });

    console.log(`✅ Webhook sync completed for job ${jobId}: ${result.emailsSynced} emails`);

  } catch (error) {
    console.error('💥 Webhook sync error:', error);
    
    // Log job as failed - using application_events
    await db
      .from('application_events')
      .insert({
        event_type: 'gmail_sync_failed',
        job_id: jobId,
        description: `Webhook sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        event_data: {
          job_id: jobId,
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: error instanceof Error ? error.message : 'Unknown error',
          error_stack: error instanceof Error ? error.stack : undefined,
          source: 'gmail_webhook'
        }
      });
  }
}

/**
 * GET /api/gmail/webhook
 * 
 * Health check endpoint for webhook
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'ok',
    endpoint: '/api/gmail/webhook',
    method: 'POST',
    description: 'Gmail push notification webhook'
  });
}