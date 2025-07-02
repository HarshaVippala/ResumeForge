import { NextRequest, NextResponse } from 'next/server'
import { GmailService } from '@/api/_lib/gmail/service'
import { getSupabase } from '@/api/_lib/db'
import { 
  sanitizeEmailResponse, 
  sanitizeBulkResponse,
  shouldReturnFullData 
} from '@/api/_lib/security/response-sanitizer'
import { validateEmailContent, INPUT_LIMITS } from '@/api/_lib/validation/input-limits'

/**
 * Combined Email API
 * GET /api/email?action=activities - Get email activities
 * GET /api/email?action=sync-status - Get sync status
 * GET /api/email?action=thread-emails&threadId=<id> - Get emails in a thread
 * POST /api/email?action=sync - Trigger email sync
 * POST /api/email?action=process - Process emails with AI
 */

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action') || 'activities'

  try {
    if (action === 'activities') {
      return await handleGetActivities(request)
    } else if (action === 'sync-status') {
      return await handleGetSyncStatus()
    } else if (action === 'thread-emails') {
      return await handleGetThreadEmails(request)
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Email API error:', error)
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')

  try {
    if (action === 'sync') {
      return await handleSync(request)
    } else if (action === 'process') {
      return await handleProcessEmails(request)
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Email API error:', error)
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })
  }
}

/**
 * Get email activities
 */
async function handleGetActivities(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const limit = parseInt(searchParams.get('limit') || '20')
  const offset = parseInt(searchParams.get('offset') || '0')
  const jobRelated = searchParams.get('job_related') === 'true'
  const search = searchParams.get('search') || ''

  const db = getSupabase()
  
  try {
    let dbQuery = db
      .from('email_communications')
      .select('*', { count: 'exact' })
      .order('received_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (jobRelated) {
      dbQuery = dbQuery.eq('is_job_related', true)
    }

    if (search) {
      dbQuery = dbQuery.or(`subject.ilike.%${search}%,sender_email.ilike.%${search}%`)
    }

    const { data: emails, error, count } = await dbQuery

    if (error) {
      console.error('Error fetching emails:', error)
      // Return empty array if table doesn't exist
      if (error.code === 'PGRST116') {
        return NextResponse.json({
          emails: [],
          metadata: { totalEmails: 0 },
          pagination: { limit, offset, hasMore: false }
        })
      }
      return NextResponse.json({
        error: 'Failed to fetch email activities'
      }, { status: 500 })
    }

    // Get job opportunities linked to these emails
    const emailIds = emails?.map(e => e.id) || []
    const { data: opportunities } = emailIds.length > 0 ? await db
      .from('job_opportunities')
      .select('*')
      .in('email_id', emailIds) : { data: [] }

    // Map opportunities to emails
    const emailsWithOpportunities = emails?.map(email => ({
      ...email,
      job_opportunities: opportunities?.filter(opp => opp.email_id === email.id) || []
    })) || []

    // Check if full data is requested
    const returnFullData = shouldReturnFullData(request)
    
    // Sanitize responses unless full data is requested
    const responseEmails = returnFullData 
      ? emailsWithOpportunities
      : sanitizeBulkResponse(emailsWithOpportunities, sanitizeEmailResponse)

    return NextResponse.json({
      success: true,
      data: {
        email_activities: responseEmails,
        metadata: {
          totalEmails: count || 0,
        },
        pagination: {
          limit,
          offset,
          hasMore: (offset + limit) < (count || 0),
        },
      },
      // Legacy format for backward compatibility
      emails: responseEmails,
      metadata: {
        totalEmails: count || 0,
      },
      pagination: {
        limit,
        offset,
        hasMore: (offset + limit) < (count || 0),
      },
    })
  } catch (error) {
    console.error('Activities handler error:', error)
    return NextResponse.json({
      error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}`
    }, { status: 500 })
  }
}

/**
 * Get sync status
 */
async function handleGetSyncStatus() {
  const userId = process.env.USER_ID || 'personal-user'
  const db = getSupabase()
  
  try {
    // Get sync metadata
    const { data: syncData } = await db
      .from('sync_metadata')
      .select('*')
      .or(`id.eq.gmail_watch_${userId},id.eq.gmail_sync_progress_${userId}`)
      .order('last_sync_time', { ascending: false })
    
    // Get email count
    const { count: emailCount } = await db
      .from('email_communications')
      .select('*', { count: 'exact', head: true })
    
    return NextResponse.json({
      connected: syncData?.some(d => d.id === `gmail_watch_${userId}`),
      lastSync: syncData?.[0]?.last_sync_time,
      emailCount: emailCount || 0,
      watchExpiration: syncData?.find(d => d.id === `gmail_watch_${userId}`)?.sync_state?.expiration,
    })
  } catch (error) {
    console.error('Sync status error:', error)
    return NextResponse.json({
      error: 'Failed to get sync status'
    }, { status: 500 })
  }
}

/**
 * Sync emails from Gmail
 */
async function handleSync(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { userId = process.env.USER_ID || 'personal-user', syncType = 'incremental' } = body
    const gmailService = new GmailService()
    
    if (syncType === 'initial') {
      // Initial sync - get all emails from last 30 days
      const afterDate = new Date()
      afterDate.setDate(afterDate.getDate() - 30)
      
      await gmailService.initialSync(userId, afterDate)
      
      return NextResponse.json({
        success: true,
        message: 'Initial sync started',
        syncType: 'initial',
      })
    } else {
      // Incremental sync
      await gmailService.incrementalSync(userId)
      
      return NextResponse.json({
        success: true,
        message: 'Incremental sync completed',
        syncType: 'incremental',
      })
    }
  } catch (error: any) {
    console.error('Email sync error:', error)
    
    if (error.message === 'Not authenticated') {
      return NextResponse.json({
        error: 'Gmail not connected. Please authorize first.'
      }, { status: 401 })
    }
    
    return NextResponse.json({
      error: 'Failed to sync emails'
    }, { status: 500 })
  }
}

/**
 * Process emails with AI to extract job opportunities
 */
async function handleProcessEmails(request: NextRequest) {
  try {
    const body = await request.json()
    const { emailIds } = body
    
    if (!emailIds || !Array.isArray(emailIds)) {
      return NextResponse.json({
        error: 'Invalid request. Provide emailIds array.'
      }, { status: 400 })
    }

    const db = getSupabase()
    
    // Get emails to process
    const { data: emails, error } = await db
      .from('email_communications')
      .select('*')
      .in('id', emailIds)
      .eq('is_processed', false)
    
    if (error) {
      console.error('Error fetching emails for processing:', error)
      return NextResponse.json({
        error: 'Failed to fetch emails'
      }, { status: 500 })
    }
    
    // Validate email content sizes before AI processing
    const oversizedEmails = emails?.filter(email => {
      const contentLength = (email.subject || '').length + (email.body_text || '').length
      return contentLength > INPUT_LIMITS.MAX_EMAIL_CONTENT_LENGTH
    }) || []
    
    if (oversizedEmails.length > 0) {
      return NextResponse.json({
        error: `${oversizedEmails.length} email(s) exceed the maximum content length of ${INPUT_LIMITS.MAX_EMAIL_CONTENT_LENGTH.toLocaleString()} characters. These emails cannot be processed to prevent excessive AI costs.`,
        oversizedEmailIds: oversizedEmails.map(e => e.id)
      }, { status: 400 })
    }
    
    // TODO: Implement AI processing to extract job opportunities
    // For now, mark as processed
    const { error: updateError } = await db
      .from('email_communications')
      .update({ 
        is_processed: true,
        ai_processed: true 
      })
      .in('id', emailIds)
    
    if (updateError) {
      console.error('Error updating email status:', updateError)
      return NextResponse.json({
        error: 'Failed to update email status'
      }, { status: 500 })
    }
    
    return NextResponse.json({
      success: true,
      processed: emails?.length || 0,
      message: 'Emails marked for processing',
    })
  } catch (error) {
    console.error('Process emails error:', error)
    return NextResponse.json({
      error: 'Failed to process emails'
    }, { status: 500 })
  }
}

/**
 * Get emails in a specific thread
 */
async function handleGetThreadEmails(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const threadId = searchParams.get('threadId')

  if (!threadId) {
    return NextResponse.json({
      error: 'threadId parameter is required'
    }, { status: 400 })
  }

  const db = getSupabase()
  
  try {
    const { data: emails, error } = await db
      .from('email_communications')
      .select('*')
      .eq('thread_id', threadId)
      .order('received_at', { ascending: true })

    if (error) {
      console.error('Error fetching thread emails:', error)
      // Return empty array if table doesn't exist
      if (error.code === 'PGRST116') {
        return NextResponse.json({
          success: true,
          data: []
        })
      }
      return NextResponse.json({
        error: 'Failed to fetch thread emails'
      }, { status: 500 })
    }

    // Check if full data is requested
    const returnFullData = shouldReturnFullData(request)
    
    // Sanitize responses unless full data is requested
    const responseEmails = returnFullData 
      ? emails || []
      : sanitizeBulkResponse(emails || [], sanitizeEmailResponse)

    return NextResponse.json({
      success: true,
      data: responseEmails
    })
  } catch (error) {
    console.error('Thread emails handler error:', error)
    return NextResponse.json({
      error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}`
    }, { status: 500 })
  }
}