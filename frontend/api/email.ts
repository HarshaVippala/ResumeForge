import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getSupabase } from './_lib/db';
import { GmailService } from './_lib/gmail/service';

export const runtime = 'edge';

/**
 * Combined Email API
 * GET /api/email?action=activities - Get email activities
 * GET /api/email?action=sync-status - Get sync status
 * POST /api/email?action=sync - Sync emails
 * POST /api/email?action=process - Process emails with AI
 */
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const action = searchParams.get('action') || 'activities';

  try {
    if (action === 'activities') {
      return await handleGetActivities(req);
    } else if (action === 'sync-status') {
      return await handleGetSyncStatus(req);
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
  const action = searchParams.get('action') || 'sync';

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
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');
  const search = searchParams.get('search') || '';
  
  const db = getSupabase();
  
  // Build query
  let query = db
    .from('email_communications')
    .select('*', { count: 'exact' })
    .order('date_sent', { ascending: false })
    .range(offset, offset + limit - 1);
  
  // Add search if provided
  if (search) {
    query = query.or(`subject.ilike.%${search}%,sender.ilike.%${search}%,body.ilike.%${search}%`);
  }
  
  const { data: emails, count, error } = await query;
  
  if (error) throw error;
  
  // Get analytics
  const { data: analytics } = await db
    .from('email_communications')
    .select('sender, job_id')
    .order('date_sent', { ascending: false })
    .limit(1000);
  
  // Calculate sender frequency
  const senderFrequency = analytics?.reduce((acc: any, email) => {
    acc[email.sender] = (acc[email.sender] || 0) + 1;
    return acc;
  }, {});
  
  // Get top senders
  const topSenders = Object.entries(senderFrequency || {})
    .sort(([, a]: any, [, b]: any) => b - a)
    .slice(0, 10)
    .map(([sender, count]) => ({ sender, count }));
  
  // Get job-related emails count
  const jobRelatedCount = analytics?.filter(e => e.job_id).length || 0;
  
  return NextResponse.json({
    emails: emails || [],
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
    .in('id', emailIds)
    .eq('is_processed', false);
  
  if (error) throw error;
  
  // TODO: Implement AI processing to extract job opportunities
  // For now, just mark as processed
  const { error: updateError } = await db
    .from('email_communications')
    .update({ is_processed: true })
    .in('id', emailIds);
  
  if (updateError) throw updateError;
  
  return NextResponse.json({
    success: true,
    processed: emails?.length || 0,
    message: 'Emails marked for processing',
  });
}