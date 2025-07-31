import { NextRequest, NextResponse } from 'next/server'
import { gmailService } from '@/api/_lib/gmail/service'
import { getSupabaseServiceClient } from '@/api/_lib/db'
import { verifySessionToken } from '@/api/_lib/auth/session'
import { 
  sanitizeEmailResponse, 
  sanitizeBulkResponse,
  shouldReturnFullData 
} from '@/api/_lib/security/response-sanitizer'
import { INPUT_LIMITS } from '@/api/_lib/validation/input-limits'
import { development } from '@/api/_lib/config'

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
      return await handleGetSyncStatus(request)
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
  // Default to showing all emails (some may be misclassified as not job-related)
  const jobRelated = searchParams.get('job_related') === 'true'
  const search = searchParams.get('search') || ''

  // Always use real data from database
  // Last modified: 2025-01-09 - Updated to filter job-related emails by default

  // Use service client to bypass RLS for email operations
  const db = getSupabaseServiceClient()
  
  try {
    let dbQuery = db
      .from('emails')
      .select('*', { count: 'exact' })
      .order('received_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Filter for job-related emails by default
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

    // Get job opportunities linked to these emails through job_id
    const jobIds = emails?.map(e => e.job_id).filter(Boolean) || []
    const { data: opportunities } = jobIds.length > 0 ? await db
      .from('job_opportunities')
      .select('*')
      .in('id', jobIds) : { data: [] }

    // Map opportunities to emails and enhance data for dashboard
    const emailsWithOpportunities = emails?.map(email => {
      // Extract company from sender if not available
      const extractCompanyFromSender = (sender: string) => {
        if (!sender) return null
        
        const emailDomain = sender.includes('@') ? sender.split('@')[1]?.toLowerCase() : ''
        if (!emailDomain) return null
        
        // Skip generic email providers
        const genericDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'icloud.com']
        if (genericDomains.includes(emailDomain)) {
          return null
        }
        
        // Extract company from domain (remove .com, .org, etc.)
        const domainParts = emailDomain.split('.')
        if (domainParts.length > 0) {
          const companyName = domainParts[0]
          // Capitalize first letter of each word
          return companyName.split('-').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
          ).join(' ')
        }
        
        return null
      }
      
      // Guess email type from subject
      const guessEmailType = (subject: string) => {
        if (!subject) return 'general'
        
        const subjectLower = subject.toLowerCase()
        
        if (subjectLower.includes('interview') || subjectLower.includes('meet') || subjectLower.includes('call')) {
          return 'interview'
        }
        if (subjectLower.includes('offer') || subjectLower.includes('congratulations')) {
          return 'offer'
        }
        if (subjectLower.includes('application') || subjectLower.includes('applied') || subjectLower.includes('thank you')) {
          return 'application'
        }
        if (subjectLower.includes('opportunity') || subjectLower.includes('position') || subjectLower.includes('role')) {
          return 'recruiter'
        }
        if (subjectLower.includes('unfortunately') || subjectLower.includes('not selected')) {
          return 'rejection'
        }
        
        return 'other'
      }
      
      // Map AI-generated email types to frontend types
      const mapEmailType = (aiType: string) => {
        if (!aiType) return 'other'
        
        switch (aiType) {
          case 'application_confirmation':
            return 'application'
          case 'recruiter_outreach':
            return 'recruiter'
          case 'interview_invitation':
            return 'interview'
          case 'job_offer':
            return 'offer'
          case 'rejection':
            return 'rejection'
          case 'follow_up':
            return 'follow_up'
          default:
            return 'other'
        }
      }
      
      // Import content cleaner
      const { formatEmailSnippet } = require('@/api/_lib/utils/content-cleaner');
      
      // Generate a clean summary if not available
      let summary = email.thread_summary || email.summary || email.preview;
      if (!summary && (email.body_text || email.body_html)) {
        summary = formatEmailSnippet(email.body_text || email.body_html || '', 120);
      }
      
      // Enhanced email data
      const enhancedEmail = {
        ...email,
        job_opportunities: email.job_id ? opportunities?.filter(opp => opp.id === email.job_id) || [] : [],
        // Add missing fields expected by frontend
        sender_name: email.sender_name || (email.sender?.includes('<') ? email.sender.split('<')[0].trim() : '') || 'Unknown',
        sender_email: email.sender_email || (email.sender?.match(/<(.+?)>$/)?.[1] || email.sender) || '',
        company: email.company || extractCompanyFromSender(email.sender_email || email.sender || '') || 'Unknown Company',
        position: email.position || null,
        email_type: mapEmailType(email.email_type) || guessEmailType(email.subject || ''),
        type: mapEmailType(email.type || email.email_type) || guessEmailType(email.subject || ''),
        extracted_details: email.extracted_details || {},
        summary: summary || email.subject || 'No summary available',
        requires_action: email.requires_action || false,
        timestamp: email.received_at, // Alias for compatibility
        status: email.ai_processed ? 'read' : 'unread'
      }
      
      return enhancedEmail
    }) || []

    // Always return full data in development, or when explicitly requested
    const isDevelopment = process.env.NODE_ENV === 'development'
    const returnFullData = isDevelopment || shouldReturnFullData(request)
    
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
async function handleGetSyncStatus(request: NextRequest) {
  // Use hardcoded user ID for the single user
  // Last modified: 2025-01-09 - Always use harsha-primary user
  const userId = 'f556989c-4903-47d6-8700-0afe3d4189e5'
  
  // Use service client to bypass RLS for email operations
  const db = getSupabaseServiceClient()
  
  try {
    // Get sync metadata including last sync time
    const { data: syncData } = await db
      .from('sync_metadata')
      .select('*')
      .or(`id.eq.gmail_watch_${userId},id.eq.gmail_sync_progress_${userId},id.eq.gmail_last_sync_${userId}`)
      .order('last_sync_time', { ascending: false })
    
    // Get email count
    const { count: emailCount } = await db
      .from('emails')
      .select('*', { count: 'exact', head: true })
    
    // Import Gmail OAuth service to check scopes
    const { gmailOAuthService } = await import('@/api/_lib/gmail/oauth')
    const hasFullScope = await gmailOAuthService.hasFullScope(userId)
    const currentScopes = await gmailOAuthService.getCurrentScopes(userId)
    
    // Find the most recent sync time from either the dedicated last sync record or other sync records
    const lastSyncRecord = syncData?.find(d => d.id === `gmail_last_sync_${userId}`)
    const lastSyncTime = lastSyncRecord?.sync_state?.lastSyncTime || syncData?.[0]?.last_sync_time
    
    return NextResponse.json({
      connected: syncData?.some(d => d.id === `gmail_watch_${userId}`),
      lastSync: lastSyncTime,
      emailCount: emailCount || 0,
      watchExpiration: syncData?.find(d => d.id === `gmail_watch_${userId}`)?.sync_state?.expiration,
      hasFullScope,
      currentScopes,
      scopeWarning: !hasFullScope ? 'Limited to email metadata only. Reauthorize for full email access.' : null
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
    // Always use harsha-primary user
    // Last modified: 2025-01-09 - Updated to use real user ID
    const sessionUserId = 'f556989c-4903-47d6-8700-0afe3d4189e5'

    const body = await request.json().catch(() => ({}))
    const { userId = sessionUserId, syncType = 'incremental', daysBack } = body
    
    // Check if user has full scope
    const { gmailOAuthService } = await import('@/api/_lib/gmail/oauth')
    const hasFullScope = await gmailOAuthService.hasFullScope(userId)
    
    if (syncType === 'initial') {
      // Initial sync - get all emails from a configurable window (default 30 days)
      const windowBack = typeof daysBack === 'number' && daysBack > 0 ? daysBack : 30
      const afterDate = new Date()
      afterDate.setDate(afterDate.getDate() - windowBack)
      
      const result = await gmailService.initialSync(userId, afterDate)
      
      // Update sync metadata with completion time
      if (result.emailsSynced > 0 || result.errors.length === 0) {
        // Use service client to bypass RLS for email operations
  const db = getSupabaseServiceClient()
        await db
          .from('sync_metadata')
          .upsert({
            id: `gmail_last_sync_${userId}`,
            sync_type: 'gmail_last_sync',
            sync_state: {
              lastSyncTime: new Date().toISOString(),
              emailsSynced: result.emailsSynced,
              syncType: 'initial'
            },
            last_sync_time: new Date().toISOString()
          }, {
            onConflict: 'id'
          })
      }
      
      return NextResponse.json({
        success: true,
        message: 'Initial sync completed',
        syncType: 'initial',
        result,
        hasFullScope,
        warning: !hasFullScope ? 'Syncing with limited scope - only email metadata available. Email content will be empty.' : null
      })
    } else {
      // Incremental sync
      const result = await gmailService.incrementalSync(userId)
      
      // Update sync metadata with completion time
      if (result.emailsSynced > 0 || result.errors.length === 0) {
        // Use service client to bypass RLS for email operations
  const db = getSupabaseServiceClient()
        await db
          .from('sync_metadata')
          .upsert({
            id: `gmail_last_sync_${userId}`,
            sync_type: 'gmail_last_sync',
            sync_state: {
              lastSyncTime: new Date().toISOString(),
              emailsSynced: result.emailsSynced,
              syncType: 'incremental'
            },
            last_sync_time: new Date().toISOString()
          }, {
            onConflict: 'id'
          })
      }
      
      return NextResponse.json({
        success: true,
        message: 'Incremental sync completed',
        syncType: 'incremental',
        result,
        hasFullScope,
        warning: !hasFullScope ? 'Syncing with limited scope - only email metadata available. Email content will be empty.' : null
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
    const { emailIds, processAll = false } = body
    
    // Import the email processing service
    const { emailProcessingService } = await import('@/api/_lib/gmail/email-processor')
    
    if (processAll) {
      // Process all unprocessed emails
      const result = await emailProcessingService.processUnprocessedEmails({
        batchSize: 10,
        maxRetries: 3,
        priorityThreshold: 30 // Process emails from last 30 days
      })
      
      return NextResponse.json({
        success: true,
        ...result,
        message: `Processed ${result.processed} emails`
      })
    } else if (emailIds && Array.isArray(emailIds)) {
      // Process specific emails
      const results = await emailProcessingService.processBatch(emailIds, {
        batchSize: 5,
        maxRetries: 3
      })
      
      const processed = results.filter(r => r.success).length
      const failed = results.filter(r => !r.success).length
      
      return NextResponse.json({
        success: true,
        processed,
        failed,
        results,
        message: `Processed ${processed} emails successfully${failed > 0 ? `, ${failed} failed` : ''}`
      })
    } else {
      return NextResponse.json({
        error: 'Invalid request. Provide emailIds array or set processAll to true.'
      }, { status: 400 })
    }
  } catch (error) {
    console.error('Process emails error:', error)
    return NextResponse.json({
      error: 'Failed to process emails',
      message: error instanceof Error ? error.message : 'Unknown error'
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

  // Use service client to bypass RLS for email operations
  const db = getSupabaseServiceClient()
  
  try {
    const { data: emails, error } = await db
      .from('emails')
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

// Last modified: 2025-01-09 - Removed mock data generation function