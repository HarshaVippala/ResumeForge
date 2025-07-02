import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { GmailService } from './_lib/gmail/service';
import { getSupabase } from './_lib/db';

export const runtime = 'edge';

/**
 * Combined Email API
 * GET /api/email?action=activities - Get email activities
 * GET /api/email?action=sync-status - Get sync status
 * POST /api/email?action=sync - Trigger email sync
 * POST /api/email?action=process - Process emails with AI
 */
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const action = searchParams.get('action') || 'activities';

  try {
    if (action === 'activities') {
      return await handleGetActivities(req);
    } else if (action === 'sync-status') {
      return await handleGetSyncStatus();
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Email API error:', error);
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
    if (action === 'sync') {
      return await handleSync(req);
    } else if (action === 'process') {
      return await handleProcessEmails(req);
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Email API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Get email activities
async function handleGetActivities(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const limit = parseInt(searchParams.get('limit') || '20');
  const offset = parseInt(searchParams.get('offset') || '0');
  const jobRelated = searchParams.get('job_related') === 'true';
  const search = searchParams.get('search') || '';

  const db = getSupabase();
  
  let query = db
    .from('email_communications')
    .select('*', { count: 'exact' })
    .order('received_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (jobRelated) {
    query = query.eq('is_job_related', true);
  }

  if (search) {
    query = query.or(`subject.ilike.%${search}%,sender_email.ilike.%${search}%`);
  }

  const { data: emails, error, count } = await query;

  if (error) {
    console.error('Error fetching emails:', error);
    return NextResponse.json(
      { error: 'Failed to fetch email activities' },
      { status: 500 }
    );
  }

  // Get job opportunities linked to these emails
  const emailIds = emails?.map(e => e.id) || [];
  const { data: opportunities } = await db
    .from('job_opportunities')
    .select('*')
    .in('email_id', emailIds);

  // Map opportunities to emails
  const emailsWithOpportunities = emails?.map(email => ({
    ...email,
    job_opportunities: opportunities?.filter(opp => opp.email_id === email.id) || []
  })) || [];

  return NextResponse.json({
    emails: emailsWithOpportunities,
    metadata: {
      totalEmails: count || 0,
    },
    pagination: {
      limit,
      offset,
      hasMore: (offset + limit) < (count || 0),
    },
  });
}

// Get sync status
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

// Sync emails
async function handleSync(req: NextRequest) {
  const body = await req.json() as { userId?: string; syncType?: string };
  const { userId = 'default_user', syncType = 'incremental' } = body;
  
  const gmailService = new GmailService();
  
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
}

// Process emails with AI
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
    .in('id', emailIds);
  
  if (error || !emails) {
    return NextResponse.json(
      { error: 'Failed to fetch emails' },
      { status: 500 }
    );
  }
  
  // TODO: Implement AI processing logic
  // For now, just mark them as processed
  const { error: updateError } = await db
    .from('email_communications')
    .update({ ai_processed: true })
    .in('id', emailIds);
  
  if (updateError) {
    return NextResponse.json(
      { error: 'Failed to update email status' },
      { status: 500 }
    );
  }
  
  return NextResponse.json({
    success: true,
    processedCount: emails.length,
    message: 'Emails processed successfully',
  });
}