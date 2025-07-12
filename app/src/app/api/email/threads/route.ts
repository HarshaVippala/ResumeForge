import { NextRequest, NextResponse } from 'next/server'
import { threadManager } from '@/api/_lib/gmail/thread-manager'
import { conversationAnalyzer } from '@/api/_lib/gmail/conversation-analyzer'
import { getSupabase } from '@/api/_lib/db'

/**
 * GET /api/email/threads
 * List email threads with filters
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    if (action === 'analyze') {
      // Analyze a specific thread
      const threadId = searchParams.get('threadId')
      if (!threadId) {
        return NextResponse.json(
          { error: 'Thread ID required' },
          { status: 400 }
        )
      }

      const analysis = await threadManager.analyzeThread(threadId)
      return NextResponse.json({ success: true, analysis })
    }

    // List threads with filters
    const filters = {
      primaryJobId: searchParams.get('jobId') || undefined,
      company: searchParams.get('company') || undefined,
      status: searchParams.get('status') || undefined,
      requiresResponse: searchParams.get('requiresResponse') === 'true' ? true : 
                       searchParams.get('requiresResponse') === 'false' ? false : undefined,
      limit: parseInt(searchParams.get('limit') || '20'),
      offset: parseInt(searchParams.get('offset') || '0')
    }

    const result = await threadManager.listThreads(filters)
    
    return NextResponse.json({
      success: true,
      threads: result.threads,
      total: result.total,
      pagination: {
        limit: filters.limit,
        offset: filters.offset,
        hasMore: result.total > filters.offset + filters.limit
      }
    })
  } catch (error) {
    console.error('Thread API error:', error)
    return NextResponse.json(
      { error: 'Failed to process thread request' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/email/threads
 * Update thread analysis or perform thread actions
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, threadId } = body

    if (!action || !threadId) {
      return NextResponse.json(
        { error: 'Action and threadId required' },
        { status: 400 }
      )
    }

    switch (action) {
      case 'analyze': {
        // Get thread emails
        const supabase = getSupabase()
        const { data: emails } = await supabase
          .from('emails')
          .select('*')
          .eq('thread_id', threadId)
          .order('received_at', { ascending: true })

        if (!emails || emails.length === 0) {
          return NextResponse.json(
            { error: 'Thread not found' },
            { status: 404 }
          )
        }

        // Perform conversation analysis
        const analysis = await conversationAnalyzer.analyzeConversation(
          emails.map(e => ({
            sender: e.sender_name || e.sender,
            subject: e.subject,
            body: e.body_text || e.body || '',
            date: new Date(e.received_at),
            isFromUser: e.sender_email === process.env.USER_EMAIL
          }))
        )

        // Update thread with analysis
        await threadManager.updateThreadAnalysis(threadId, analysis)

        return NextResponse.json({
          success: true,
          analysis
        })
      }

      case 'markResponseSent': {
        // Mark that a response has been sent
        // Since we don't have email_threads table, update all emails in thread
        const supabase = getSupabase()
        const { error } = await supabase
          .from('emails')
          .update({
            requires_action: false,
            ai_processed: true,
            processing_version: 'v1.0'
          })
          .eq('thread_id', threadId)

        if (error) throw error

        return NextResponse.json({ success: true })
      }

      case 'linkJob': {
        // Link thread to a job
        const { jobId } = body
        if (!jobId) {
          return NextResponse.json(
            { error: 'Job ID required' },
            { status: 400 }
          )
        }

        // Update all emails in thread with job ID
        const supabase = getSupabase()
        const { error } = await supabase
          .from('emails')
          .update({
            job_id: jobId,
            is_job_related: true,
            job_confidence: 1.0 // Manual linking = 100% confidence
          })
          .eq('thread_id', threadId)

        if (error) throw error

        return NextResponse.json({ success: true })
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Thread API error:', error)
    return NextResponse.json(
      { error: 'Failed to process thread request' },
      { status: 500 }
    )
  }
}