import { NextRequest, NextResponse } from 'next/server';
import { gmailService } from '@/api/_lib/gmail/service';
import { emailProcessingService } from '@/api/_lib/gmail/email-processor';
import { getSupabaseServiceClient } from '@/api/_lib/db';
import { jobLinker } from '@/api/_lib/gmail/job-linker';
import { verifySessionToken } from '@/api/_lib/auth/session';
import { development } from '@/api/_lib/config';

/**
 * Enhanced Gmail Sync API Endpoint
 * 
 * POST /api/email/enhanced-sync
 * 
 * Implements multi-phase sync strategy:
 * 1. Setup Phase: 30-day comprehensive sync
 * 2. Maintenance Phase: Daily incremental sync  
 * 3. Real-time Phase: Push notifications
 * 
 * Supports both sync and async modes:
 * - async=true: Returns immediately with job ID for tracking
 * - async=false: Waits for completion (default for backward compatibility)
 */

export async function POST(request: NextRequest) {
  try {
    // Always use harsha-primary user
    // Last modified: 2025-01-09 - Updated to use real user ID
    const userId = 'f556989c-4903-47d6-8700-0afe3d4189e5';
    const body = await request.json();
    const { syncType = 'incremental', daysBack = 10, async = false } = body;

    // Always use real data from database
    // Last modified: 2025-01-09 - Removed mock data, always sync real emails

    console.log(`🚀 Enhanced sync requested for user: ${userId}, type: ${syncType}, async: ${async}`);

    // Use service client to bypass RLS for sync operations
    const db = getSupabaseServiceClient();

    // If async mode, create activity log entry and return immediately
    if (async) {
      // Create activity log entry for sync job
      const syncJobId = crypto.randomUUID();
      const { error: activityError } = await db
        .from('activity_log')
        .insert({
          event_type: 'gmail_sync_started',
          entity_type: 'sync_job',
          entity_id: syncJobId,
          description: `Started ${syncType} Gmail sync`,
          metadata: {
            job_id: syncJobId,
            sync_type: syncType,
            days_back: daysBack,
            status: 'pending',
            user_id: userId
          },
          source: 'enhanced_sync_api'
        });

      if (activityError) {
        console.error('Failed to create sync activity log:', activityError);
        throw new Error('Failed to create sync job');
      }

      // Process the sync in the background
      processAsyncSync(userId, syncJobId, syncType, daysBack);

      // Return immediately with job info
      return NextResponse.json({
        success: true,
        async: true,
        jobId: syncJobId,
        status: 'pending',
        message: 'Sync job created and processing in background',
        trackingUrl: `/api/email/sync-status/${syncJobId}`
      });
    }

    // Synchronous mode (backward compatibility)
    let result;
    if (syncType === 'initial' || syncType === 'setup') {
      // Initial sync - fetch emails from specified window
      const afterDate = new Date();
      afterDate.setDate(afterDate.getDate() - daysBack);
      result = await gmailService.initialSync(userId, afterDate);
    } else {
      // Incremental sync
      result = await gmailService.incrementalSync(userId);
    }
    
    // Process unprocessed emails with AI
    const processingResult = await emailProcessingService.processUnprocessedEmails({
      batchSize: 10,
      maxRetries: 3,
      priorityThreshold: 7
    });
    
    // Attempt to link unlinked job-related emails
    let linkingResult = { processed: 0, linked: 0, errors: 0 };
    try {
      linkingResult = await jobLinker.linkUnlinkedEmails(50);
      console.log(`🔗 Job linking completed:`, linkingResult);
    } catch (linkError) {
      console.error('Job linking failed:', linkError);
    }

    // Get email statistics
    const { count: totalEmailCount } = await db
      .from('emails')
      .select('*', { count: 'exact', head: true });
    
    const { count: linkedEmailCount } = await db
      .from('emails')
      .select('*', { count: 'exact', head: true })
      .eq('is_job_related', true)
      .not('job_id', 'is', null);

    const { count: jobRelatedCount } = await db
      .from('emails')
      .select('*', { count: 'exact', head: true })
      .eq('is_job_related', true);
    
    console.log(`✅ Enhanced sync completed:`, {
      emailsSynced: result.emailsSynced,
      emailsProcessed: processingResult.processed,
      emailsLinked: linkingResult.linked,
      errors: result.errors.length
    });
    
    return NextResponse.json({
      success: true,
      syncResult: result,
      processingResult,
      linkingResult,
      message: `Synced ${result.emailsSynced} emails, processed ${processingResult.processed} with AI, linked ${linkingResult.linked} to jobs`,
      stats: {
        phase: syncType,
        status: 'completed',
        emailsSynced: result.emailsSynced,
        emailsProcessed: processingResult.processed,
        emailsLinked: linkingResult.linked,
        totalEmails: totalEmailCount || 0,
        linkedEmails: linkedEmailCount || 0,
        jobRelatedEmails: jobRelatedCount || 0,
        totalErrors: result.errors.length + processingResult.failed + linkingResult.errors,
        duration: result.duration
      }
    });

  } catch (error) {
    console.error('💥 Enhanced sync API error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Enhanced sync failed',
      code: 'ENHANCED_SYNC_ERROR'
    }, { status: 500 });
  }
}

/**
 * GET /api/email/enhanced-sync
 * 
 * Get current sync status and progress
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Check for API key authentication first
    const apiKey = request.headers.get('x-api-key');
    let userId: string;

    if (apiKey && apiKey === process.env.PERSONAL_API_KEY) {
      // API key authentication - use configured USER_ID
      userId = process.env.USER_ID || 'f556989c-4903-47d6-8700-0afe3d4189e5';
      console.log('🔑 Using API key authentication for user:', userId);
    } else {
      // Fall back to session authentication
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

    // Get sync status from application events instead of activity log
    // Use service client to bypass RLS for sync operations
    const db = getSupabaseServiceClient();
    const { data: lastSyncActivity } = await db
      .from('application_events')
      .select('*')
      .eq('event_type', 'gmail_sync_completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    // Get email stats
    const { data: emailStats } = await db
      .from('emails')
      .select('is_job_related, ai_processed, linked_job_id', { count: 'exact' });
    
    const totalEmails = emailStats?.length || 0;
    const jobRelatedEmails = emailStats?.filter(e => e.is_job_related).length || 0;
    const processedEmails = emailStats?.filter(e => e.ai_processed).length || 0;
    const linkedEmails = emailStats?.filter(e => e.is_job_related && e.linked_job_id).length || 0;
    
    // Get job-related email stats
    const { count: jobRelatedCount } = await db
      .from('emails')
      .select('*', { count: 'exact', head: true })
      .eq('is_job_related', true);
    
    const { count: requiresActionCount } = await db
      .from('emails')
      .select('*', { count: 'exact', head: true })
      .eq('requires_action', true);
    
    // Get job linking stats
    const linkingStats = await jobLinker.getLinkingStats();
    
    console.log(`📊 Enhanced sync status for ${userId}:`, {
      lastSync: lastSyncActivity?.created_at,
      totalEmails,
      jobRelatedEmails,
      processedEmails,
      linkedEmails
    });
    
    return NextResponse.json({
      success: true,
      syncState: lastSyncActivity?.metadata || {},
      stats: {
        totalEmails,
        jobRelatedEmails,
        processedEmails,
        unprocessedEmails: totalEmails - processedEmails,
        linkedEmails,
        unlinkableEmails: linkingStats.unlinkableEmails,
        linkingRate: linkingStats.linkingRate,
        jobRelatedEmails: jobRelatedCount || 0,
        emailsRequiringAction: requiresActionCount || 0,
        lastSync: lastSyncActivity?.created_at,
        lastSyncStats: lastSyncActivity?.metadata
      }
    });

  } catch (error) {
    console.error('💥 Enhanced sync status API error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get sync status',
      code: 'SYNC_STATUS_ERROR'
    }, { status: 500 });
  }
}

/**
 * Process sync asynchronously
 * This runs in the background after returning a response to the client
 */
async function processAsyncSync(
  userId: string, 
  jobId: string, 
  syncType: string, 
  daysBack: number
) {
  const db = getSupabaseServiceClient();
  const startTime = Date.now();

  try {
    // Log sync start
    await db
      .from('activity_log')
      .insert({
        event_type: 'gmail_sync_running',
        entity_type: 'sync_job',
        entity_id: jobId,
        description: `Running ${syncType} Gmail sync`,
        metadata: {
          job_id: jobId,
          status: 'running',
          started_at: new Date().toISOString()
        },
        source: 'enhanced_sync_api'
      });

    // Perform the actual sync
    let result;
    if (syncType === 'initial' || syncType === 'setup') {
      const afterDate = new Date();
      afterDate.setDate(afterDate.getDate() - daysBack);
      result = await gmailService.initialSync(userId, afterDate);
    } else {
      result = await gmailService.incrementalSync(userId);
    }

    // Log sync progress
    await db
      .from('activity_log')
      .insert({
        event_type: 'gmail_sync_progress',
        entity_type: 'sync_job',
        entity_id: jobId,
        description: `Synced ${result.emailsSynced} emails`,
        metadata: {
          job_id: jobId,
          progress: 50,
          total_emails: result.emailsSynced,
          processed_emails: result.emailsSynced
        },
        source: 'enhanced_sync_api'
      });
    
    // Process unprocessed emails with AI
    const processingResult = await emailProcessingService.processUnprocessedEmails({
      batchSize: 10,
      maxRetries: 3,
      priorityThreshold: 7
    });

    // Log AI processing progress
    await db
      .from('activity_log')
      .insert({
        event_type: 'gmail_sync_progress',
        entity_type: 'sync_job',
        entity_id: jobId,
        description: `Processed ${processingResult.processed} emails with AI`,
        metadata: {
          job_id: jobId,
          progress: 75,
          ai_processed: processingResult.processed
        },
        source: 'enhanced_sync_api'
      });
    
    // Attempt to link unlinked job-related emails
    let linkingResult = { processed: 0, linked: 0, errors: 0 };
    try {
      linkingResult = await jobLinker.linkUnlinkedEmails(50);
    } catch (linkError) {
      console.error('Job linking failed:', linkError);
    }

    // Get final statistics
    const { count: totalEmailCount } = await db
      .from('emails')
      .select('*', { count: 'exact', head: true });
    
    const { count: linkedEmailCount } = await db
      .from('emails')
      .select('*', { count: 'exact', head: true })
      .eq('is_job_related', true)
      .not('job_id', 'is', null);

    const { count: jobRelatedCount } = await db
      .from('emails')
      .select('*', { count: 'exact', head: true })
      .eq('is_job_related', true);

    const duration = Date.now() - startTime;

    // Log job completion
    await db
      .from('activity_log')
      .insert({
        event_type: 'gmail_sync_completed',
        entity_type: 'sync_job',
        entity_id: jobId,
        description: `Completed ${syncType} sync: ${result.emailsSynced} emails synced`,
        metadata: {
          job_id: jobId,
          status: 'completed',
          progress: 100,
          completed_at: new Date().toISOString(),
          processed_emails: result.emailsSynced,
          result: {
            emailsSynced: result.emailsSynced,
            emailsProcessed: processingResult.processed,
            emailsLinked: linkingResult.linked,
            errors: result.errors
          },
          sync_stats: {
            phase: syncType,
            totalEmails: totalEmailCount || 0,
            linkedEmails: linkedEmailCount || 0,
            jobRelatedEmails: jobRelatedCount || 0,
            totalErrors: result.errors.length + processingResult.failed + linkingResult.errors,
            duration
          }
        },
        source: 'enhanced_sync_api'
      });

    console.log(`✅ Async sync completed for job ${jobId}`);

  } catch (error) {
    console.error('💥 Async sync error:', error);
    
    // Log job failure
    await db
      .from('activity_log')
      .insert({
        event_type: 'gmail_sync_failed',
        entity_type: 'sync_job',
        entity_id: jobId,
        description: `Failed ${syncType} sync: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: {
          job_id: jobId,
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: error instanceof Error ? error.message : 'Unknown error',
          error_stack: error instanceof Error ? error.stack : undefined
        },
        source: 'enhanced_sync_api'
      });
  }
}

/**
 * Generate mock emails for development mode
 */
// Last modified: 2025-01-09 - Removed mock email generation function