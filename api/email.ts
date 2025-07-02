import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { GmailService } from './_lib/gmail/service';
import { getSupabase } from './_lib/db';

export const runtime = 'edge';

/**
 * Combined Email API
 * GET /api/email?action=activities - Get email activities with analytics
 * GET /api/email?action=sync-status - Get sync status
 * POST /api/email?action=sync - Trigger email sync
 * POST /api/email?action=process - Process emails with AI
 */
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const action = searchParams.get('action') || 'activities';

  try {
    switch (action) {
      case 'activities':
        return await handleGetActivities(req);
      case 'sync-status':
        return await handleGetSyncStatus();
      default:
        return NextResponse.json(
          { error: 'Invalid action. Valid actions: activities, sync-status' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Email API GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const action = searchParams.get('action');

  try {
    switch (action) {
      case 'sync':
        return await handleSync(req);
      case 'process':
        return await handleProcessEmails(req);
      default:
        return NextResponse.json(
          { error: 'Invalid action. Valid actions: sync, process' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Email API POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Get email activities with enhanced analytics
 */
async function handleGetActivities(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');
  const search = searchParams.get('search') || '';
  const jobRelated = searchParams.get('job_related') === 'true';

  const db = getSupabase();
  
  // Build query
  let query = db
    .from('email_communications')
    .select('*', { count: 'exact' })
    .order('email_date', { ascending: false })
    .range(offset, offset + limit - 1);

  // Add filters
  if (jobRelated) {
    query = query.in('email_type', ['job_opportunity', 'recruiter_contact']);
  }

  if (search) {
    query = query.or(`subject.ilike.%${search}%,sender.ilike.%${search}%,content.ilike.%${search}%`);
  }

  const { data: emails, count, error } = await query;

  if (error) {
    console.error('Error fetching emails:', error);
    return NextResponse.json(
      { error: 'Failed to fetch email activities' },
      { status: 500 }
    );
  }

  // Get analytics data
  const { data: analyticsData } = await db
    .from('email_communications')
    .select('sender, email_type, processing_status')
    .order('email_date', { ascending: false })
    .limit(1000);

  // Calculate sender frequency
  const senderFrequency = analyticsData?.reduce((acc: any, email) => {
    acc[email.sender] = (acc[email.sender] || 0) + 1;
    return acc;
  }, {});

  // Get top senders
  const topSenders = Object.entries(senderFrequency || {})
    .sort(([, a]: any, [, b]: any) => b - a)
    .slice(0, 10)
    .map(([sender, count]) => ({ sender, count }));

  // Get job-related stats
  const jobRelatedCount = analyticsData?.filter(e => e.email_type === 'job_opportunity' || e.email_type === 'recruiter_contact').length || 0;

  // Return emails without job opportunities for now
  // The job_opportunities table doesn't have email_id column
  const emailsWithOpportunities = emails || [];

  return NextResponse.json({
    emails: emailsWithOpportunities,
    total: count || 0,
    analytics: {
      topSenders,
      jobRelatedCount,
      totalEmails: count || 0,
    },
    pagination: {
      limit,
      offset,
      hasMore: (offset + limit) < (count || 0),
    },
  });
}

/**
 * Get sync status
 */
async function handleGetSyncStatus() {
  const userId = 'default_user';
  const db = getSupabase();
  
  // Get sync metadata
  const { data: syncData } = await db
    .from('sync_metadata')
    .select('*')
    .or(`id.eq.gmail_watch_${userId},id.eq.gmail_sync_progress_${userId}`)
    .order('last_sync_time', { ascending: false });
  
  // Get email count
  const { count: emailCount } = await db
    .from('email_communications')
    .select('*', { count: 'exact', head: true });
  
  return NextResponse.json({
    connected: syncData?.some(d => d.id === `gmail_watch_${userId}`),
    lastSync: syncData?.[0]?.last_sync_time,
    emailCount: emailCount || 0,
    watchExpiration: syncData?.find(d => d.id === `gmail_watch_${userId}`)?.sync_state?.expiration,
  });
}

/**
 * Sync emails from Gmail
 */
async function handleSync(req: NextRequest) {
  const body = await req.json() as { userId?: string; syncType?: string };
  const { userId = 'default_user', syncType = 'incremental' } = body;
  
  const gmailService = new GmailService();
  
  try {
    if (syncType === 'initial') {
      // Initial sync - get all emails from last 30 days
      const afterDate = new Date();
      afterDate.setDate(afterDate.getDate() - 30);
      
      await gmailService.initialSync(userId, afterDate);
      
      return NextResponse.json({
        success: true,
        message: 'Initial sync started',
        syncType: 'initial',
      });
    } else {
      // Incremental sync
      await gmailService.incrementalSync(userId);
      
      return NextResponse.json({
        success: true,
        message: 'Incremental sync completed',
        syncType: 'incremental',
      });
    }
  } catch (error: any) {
    console.error('Email sync error:', error);
    
    if (error.message === 'Not authenticated') {
      return NextResponse.json(
        { error: 'Gmail not connected. Please authorize first.' },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to sync emails' },
      { status: 500 }
    );
  }
}

/**
 * Process emails with AI to extract job opportunities
 */
async function handleProcessEmails(req: NextRequest) {
  const body = await req.json() as { emailIds?: string[] };
  const { emailIds } = body;
  
  if (!emailIds || !Array.isArray(emailIds)) {
    return NextResponse.json(
      { error: 'Invalid request. Provide emailIds array.' },
      { status: 400 }
    );
  }
  
  const db = getSupabase();
  
  // Get emails to process
  const { data: emails, error } = await db
    .from('email_communications')
    .select('*')
    .in('id', emailIds)
    .eq('is_processed', false);
  
  if (error) {
    console.error('Error fetching emails for processing:', error);
    return NextResponse.json(
      { error: 'Failed to fetch emails' },
      { status: 500 }
    );
  }
  
  // TODO: Implement AI processing to extract job opportunities
  // For now, mark as processed
  const { error: updateError } = await db
    .from('email_communications')
    .update({ 
      is_processed: true,
      ai_processed: true 
    })
    .in('id', emailIds);
  
  if (updateError) {
    console.error('Error updating email status:', error);
    return NextResponse.json(
      { error: 'Failed to update email status' },
      { status: 500 }
    );
  }
  
  return NextResponse.json({
    success: true,
    processed: emails?.length || 0,
    message: 'Emails marked for processing',
  });
}