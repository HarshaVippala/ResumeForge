import { VercelRequest, VercelResponse } from '@vercel/node';
import { GmailService } from './_lib/gmail/service';
import { getSupabase } from './_lib/db';

/**
 * Combined Email API
 * GET /api/email?action=activities - Get email activities
 * GET /api/email?action=sync-status - Get sync status
 * GET /api/email?action=thread-emails&threadId=<id> - Get emails in a thread
 * POST /api/email?action=sync - Trigger email sync
 * POST /api/email?action=process - Process emails with AI
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { method, query } = req;
  const action = query.action as string || 'activities';

  try {
    if (method === 'GET') {
      if (action === 'activities') {
        return await handleGetActivities(req, res);
      } else if (action === 'sync-status') {
        return await handleGetSyncStatus(res);
      } else if (action === 'thread-emails') {
        return await handleGetThreadEmails(req, res);
      } else {
        return res.status(400).json({ error: 'Invalid action' });
      }
    } else if (method === 'POST') {
      if (action === 'sync') {
        return await handleSync(req, res);
      } else if (action === 'process') {
        return await handleProcessEmails(req, res);
      } else {
        return res.status(400).json({ error: 'Invalid action' });
      }
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Email API error:', error);
    return res.status(500).json({
      error: 'Internal server error'
    });
  }
}

/**
 * Get email activities
 */
async function handleGetActivities(req: VercelRequest, res: VercelResponse) {
  const { query } = req;
  const limit = parseInt(query.limit as string || '20');
  const offset = parseInt(query.offset as string || '0');
  const jobRelated = query.job_related === 'true';
  const search = query.search as string || '';

  const db = getSupabase();
  
  try {
    let dbQuery = db
      .from('email_communications')
      .select('*', { count: 'exact' })
      .order('received_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (jobRelated) {
      dbQuery = dbQuery.eq('is_job_related', true);
    }

    if (search) {
      dbQuery = dbQuery.or(`subject.ilike.%${search}%,sender_email.ilike.%${search}%`);
    }

    const { data: emails, error, count } = await dbQuery;

    if (error) {
      console.error('Error fetching emails:', error);
      // Return empty array if table doesn't exist
      if (error.code === 'PGRST116') {
        return res.status(200).json({
          emails: [],
          metadata: { totalEmails: 0 },
          pagination: { limit, offset, hasMore: false }
        });
      }
      return res.status(500).json({
        error: 'Failed to fetch email activities'
      });
    }

    // Get job opportunities linked to these emails
    const emailIds = emails?.map(e => e.id) || [];
    const { data: opportunities } = emailIds.length > 0 ? await db
      .from('job_opportunities')
      .select('*')
      .in('email_id', emailIds) : { data: [] };

    // Map opportunities to emails
    const emailsWithOpportunities = emails?.map(email => ({
      ...email,
      job_opportunities: opportunities?.filter(opp => opp.email_id === email.id) || []
    })) || [];

    return res.status(200).json({
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
  } catch (error) {
    console.error('Activities handler error:', error);
    return res.status(500).json({
      error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
}

/**
 * Get sync status
 */
async function handleGetSyncStatus(res: VercelResponse) {
  const userId = 'default_user';
  const db = getSupabase();
  
  try {
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
    
    return res.status(200).json({
      connected: syncData?.some(d => d.id === `gmail_watch_${userId}`),
      lastSync: syncData?.[0]?.last_sync_time,
      emailCount: emailCount || 0,
      watchExpiration: syncData?.find(d => d.id === `gmail_watch_${userId}`)?.sync_state?.expiration,
    });
  } catch (error) {
    console.error('Sync status error:', error);
    return res.status(500).json({
      error: 'Failed to get sync status'
    });
  }
}

/**
 * Sync emails from Gmail
 */
async function handleSync(req: VercelRequest, res: VercelResponse) {
  try {
    const { userId = 'default_user', syncType = 'incremental' } = req.body || {};
    const gmailService = new GmailService();
    
    if (syncType === 'initial') {
      // Initial sync - get all emails from last 30 days
      const afterDate = new Date();
      afterDate.setDate(afterDate.getDate() - 30);
      
      await gmailService.initialSync(userId, afterDate);
      
      return res.status(200).json({
        success: true,
        message: 'Initial sync started',
        syncType: 'initial',
      });
    } else {
      // Incremental sync
      await gmailService.incrementalSync(userId);
      
      return res.status(200).json({
        success: true,
        message: 'Incremental sync completed',
        syncType: 'incremental',
      });
    }
  } catch (error: any) {
    console.error('Email sync error:', error);
    
    if (error.message === 'Not authenticated') {
      return res.status(401).json({
        error: 'Gmail not connected. Please authorize first.'
      });
    }
    
    return res.status(500).json({
      error: 'Failed to sync emails'
    });
  }
}

/**
 * Process emails with AI to extract job opportunities
 */
async function handleProcessEmails(req: VercelRequest, res: VercelResponse) {
  try {
    const body = req.body as { emailIds?: string[] };
    const { emailIds } = body;
    
    if (!emailIds || !Array.isArray(emailIds)) {
      return res.status(400).json({
        error: 'Invalid request. Provide emailIds array.'
      });
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
      return res.status(500).json({
        error: 'Failed to fetch emails'
      });
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
      console.error('Error updating email status:', updateError);
      return res.status(500).json({
        error: 'Failed to update email status'
      });
    }
    
    return res.status(200).json({
      success: true,
      processed: emails?.length || 0,
      message: 'Emails marked for processing',
    });
  } catch (error) {
    console.error('Process emails error:', error);
    return res.status(500).json({
      error: 'Failed to process emails'
    });
  }
}

/**
 * Get emails in a specific thread
 */
async function handleGetThreadEmails(req: VercelRequest, res: VercelResponse) {
  const { query } = req;
  const threadId = query.threadId as string;

  if (!threadId) {
    return res.status(400).json({
      error: 'threadId parameter is required'
    });
  }

  const db = getSupabase();
  
  try {
    const { data: emails, error } = await db
      .from('email_communications')
      .select('*')
      .eq('thread_id', threadId)
      .order('received_at', { ascending: true });

    if (error) {
      console.error('Error fetching thread emails:', error);
      // Return empty array if table doesn't exist
      if (error.code === 'PGRST116') {
        return res.status(200).json({
          success: true,
          data: []
        });
      }
      return res.status(500).json({
        error: 'Failed to fetch thread emails'
      });
    }

    return res.status(200).json({
      success: true,
      data: emails || []
    });
  } catch (error) {
    console.error('Thread emails handler error:', error);
    return res.status(500).json({
      error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
}