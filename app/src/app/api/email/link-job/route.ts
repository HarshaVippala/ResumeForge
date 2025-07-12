import { NextRequest, NextResponse } from 'next/server'
import { jobLinker } from '@/api/_lib/gmail/job-linker'

/**
 * GET /api/email/link-job
 * Get job suggestions for an email or linking statistics
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    if (action === 'suggestions') {
      // Get job suggestions for manual linking
      const emailId = searchParams.get('emailId')
      if (!emailId) {
        return NextResponse.json(
          { error: 'Email ID required' },
          { status: 400 }
        )
      }

      const limit = parseInt(searchParams.get('limit') || '5')
      const suggestions = await jobLinker.getJobSuggestions(emailId, limit)

      return NextResponse.json({
        success: true,
        suggestions
      })
    }

    if (action === 'stats') {
      // Get linking statistics
      const stats = await jobLinker.getLinkingStats()
      
      return NextResponse.json({
        success: true,
        stats
      })
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Job linking API error:', error)
    return NextResponse.json(
      { error: 'Failed to process job linking request' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/email/link-job
 * Manually link/unlink emails to jobs or batch process
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body

    if (!action) {
      return NextResponse.json(
        { error: 'Action required' },
        { status: 400 }
      )
    }

    switch (action) {
      case 'link': {
        // Manually link email to job
        const { emailId, jobId } = body
        if (!emailId || !jobId) {
          return NextResponse.json(
            { error: 'Email ID and Job ID required' },
            { status: 400 }
          )
        }

        await jobLinker.manuallyLinkEmail(emailId, jobId)

        return NextResponse.json({
          success: true,
          message: 'Email linked to job successfully'
        })
      }

      case 'unlink': {
        // Unlink email from job
        const { emailId } = body
        if (!emailId) {
          return NextResponse.json(
            { error: 'Email ID required' },
            { status: 400 }
          )
        }

        await jobLinker.unlinkEmail(emailId)

        return NextResponse.json({
          success: true,
          message: 'Email unlinked successfully'
        })
      }

      case 'linkBatch': {
        // Batch link unlinked emails
        const limit = body.limit || 100
        const result = await jobLinker.linkUnlinkedEmails(limit)

        return NextResponse.json({
          success: true,
          result
        })
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Job linking API error:', error)
    return NextResponse.json(
      { error: 'Failed to process job linking request' },
      { status: 500 }
    )
  }
}