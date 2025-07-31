import { NextRequest, NextResponse } from 'next/server'
import { emailProcessingService } from '@/api/_lib/gmail/email-processor'
import { getSupabase } from '@/api/_lib/db'

/**
 * Email Processing API
 * POST /api/email/process - Process emails with AI
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { emailIds, action = 'process', options = {} } = body
    
    // Validate input
    if (action === 'process' && !emailIds) {
      return NextResponse.json({
        error: 'emailIds array is required for process action'
      }, { status: 400 })
    }

    switch (action) {
      case 'process': {
        // Process specific emails
        if (!Array.isArray(emailIds)) {
          return NextResponse.json({
            error: 'emailIds must be an array'
          }, { status: 400 })
        }

        const results = await emailProcessingService.processBatch(emailIds, {
          batchSize: options.batchSize || 5,
          maxRetries: options.maxRetries || 3
        })

        return NextResponse.json({
          success: true,
          results,
          summary: {
            total: emailIds.length,
            processed: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length
          }
        })
      }

      case 'process-unprocessed': {
        // Process all unprocessed emails
        const result = await emailProcessingService.processUnprocessedEmails({
          batchSize: options.batchSize || 10,
          maxRetries: options.maxRetries || 3,
          priorityThreshold: options.priorityThreshold || 7
        })

        return NextResponse.json({
          success: true,
          ...result
        })
      }

      case 'reprocess-failed': {
        // Reprocess failed emails
        const limit = options.limit || 20
        const results = await emailProcessingService.reprocessFailedEmails(limit)

        return NextResponse.json({
          success: true,
          results,
          summary: {
            total: results.length,
            processed: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length
          }
        })
      }

      case 'stats': {
        // Get processing statistics
        const stats = await emailProcessingService.getProcessingStats()
        
        return NextResponse.json({
          success: true,
          stats
        })
      }

      default:
        return NextResponse.json({
          error: `Invalid action: ${action}`
        }, { status: 400 })
    }
  } catch (error) {
    console.error('Email processing error:', error)
    return NextResponse.json({
      error: 'Failed to process emails',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * Get processing status for specific emails
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const emailId = searchParams.get('emailId')
    const status = searchParams.get('status')
    
    const db = getSupabase()
    
    let query = db
      .from('emails')
      .select('id, subject, sender_email, received_at, is_job_related, job_relevance_confidence, extracted_company, extracted_position, extracted_status, ai_processed, processing_version, processed_at')
    
    if (emailId) {
      query = query.eq('id', emailId)
    }
    
    if (status === 'processed') {
      query = query.eq('ai_processed', true)
    } else if (status === 'unprocessed') {
      query = query.or('ai_processed.is.null,ai_processed.eq.false')
    }
    
    query = query.order('received_at', { ascending: false }).limit(100)
    
    const { data, error } = await query
    
    if (error) {
      console.error('Database query error:', error)
      return NextResponse.json({
        error: 'Failed to fetch email processing status'
      }, { status: 500 })
    }
    
    return NextResponse.json({
      success: true,
      emails: data || [],
      count: data?.length || 0
    })
  } catch (error) {
    console.error('Get processing status error:', error)
    return NextResponse.json({
      error: 'Failed to get processing status'
    }, { status: 500 })
  }
}