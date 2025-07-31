import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/api/_lib/db';
import { verifySessionToken } from '@/api/_lib/auth/session';

/**
 * Sync Job Status API Endpoint
 * 
 * GET /api/email/sync-status/[jobId]
 * 
 * Returns the current status and progress of a sync job
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    // Check for API key authentication first
    const apiKey = request.headers.get('x-api-key');
    let userId: string;

    if (apiKey && apiKey === process.env.PERSONAL_API_KEY) {
      // API key authentication - use configured USER_ID
      userId = process.env.USER_ID || 'f556989c-4903-47d6-8700-0afe3d4189e5';
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

    const { jobId } = params;
    const db = getSupabase();

    // Get sync job details from application_events
    const { data: syncActivities, error } = await db
      .from('application_events')
      .select('*')
      .eq('job_id', jobId)
      .in('event_type', ['gmail_sync_started', 'gmail_sync_running', 'gmail_sync_progress', 'gmail_sync_completed', 'gmail_sync_failed'])
      .order('created_at', { ascending: false });

    if (error || !syncActivities || syncActivities.length === 0) {
      return NextResponse.json({ error: 'Sync job not found' }, { status: 404 });
    }

    // Get the latest status
    const latestActivity = syncActivities[0];
    const startActivity = syncActivities.find(a => a.event_type === 'gmail_sync_started');
    const completedActivity = syncActivities.find(a => a.event_type === 'gmail_sync_completed');
    const failedActivity = syncActivities.find(a => a.event_type === 'gmail_sync_failed');
    
    // Determine current status
    let status = 'pending';
    if (failedActivity) {
      status = 'failed';
    } else if (completedActivity) {
      status = 'completed';
    } else if (latestActivity.event_type === 'gmail_sync_running' || latestActivity.event_type === 'gmail_sync_progress') {
      status = 'running';
    }
    
    // Get progress from latest activity (event_data instead of metadata)
    const progress = latestActivity.event_data?.progress || 0;

    // Calculate estimated completion
    let estimatedCompletion = null;
    if (status === 'running' && startActivity) {
      const elapsedMs = Date.now() - new Date(startActivity.created_at).getTime();
      const progressRate = progress / elapsedMs; // progress per ms
      if (progressRate > 0) {
        const remainingProgress = 100 - progress;
        const remainingMs = remainingProgress / progressRate;
        estimatedCompletion = new Date(Date.now() + remainingMs);
      }
    }

    // Get last successful sync for context
    const { data: lastSuccessfulSync } = await db
      .from('application_events')
      .select('*')
      .eq('event_type', 'gmail_sync_completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    return NextResponse.json({
      success: true,
      job: {
        id: jobId,
        type: startActivity?.event_data?.sync_type || 'unknown',
        status: status,
        progress: progress,
        created_at: startActivity?.created_at,
        started_at: startActivity?.event_data?.started_at,
        completed_at: completedActivity?.event_data?.completed_at || failedActivity?.event_data?.completed_at,
        
        // Progress details
        total_emails: latestActivity.event_data?.total_emails || 0,
        processed_emails: latestActivity.event_data?.processed_emails || 0,
        failed_emails: latestActivity.event_data?.failed_emails || 0,
        
        // Results (only if completed)
        ...(status === 'completed' && completedActivity && {
          result: completedActivity.event_data?.result,
          stats: completedActivity.event_data?.sync_stats
        }),
        
        // Error (only if failed)
        ...(status === 'failed' && failedActivity && {
          error: failedActivity.event_data?.error_message
        }),
        
        // Estimated completion
        ...(status === 'running' && {
          estimated_completion: estimatedCompletion
        })
      },
      syncState: {
        lastSync: lastSuccessfulSync?.created_at,
        lastSyncStats: lastSuccessfulSync?.event_data?.sync_stats
      }
    });

  } catch (error) {
    console.error('💥 Sync status API error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get sync status',
      code: 'SYNC_STATUS_ERROR'
    }, { status: 500 });
  }
}