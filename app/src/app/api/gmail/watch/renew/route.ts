/**
 * Gmail Watch Renewal Scheduled Task
 * 
 * This endpoint handles automatic renewal of Gmail watch subscriptions.
 * It's designed to be called by a cron job or scheduling service.
 * 
 * Created: 2025-01-09
 * Updated: 2025-01-09
 */

import { NextRequest, NextResponse } from 'next/server'
import { gmailService } from '../../../../../api/_lib/gmail/service'

export const runtime = 'edge'

/**
 * Check and renew expired Gmail watches
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const expectedAuth = `Bearer ${process.env.PERSONAL_API_KEY}`
    
    // Verify authorization for scheduled tasks
    if (authHeader !== expectedAuth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('⏰ Starting scheduled Gmail watch renewal check')
    
    const startTime = Date.now()
    await gmailService.checkAndRenewWatches()
    const processingTime = Date.now() - startTime
    
    console.log(`✅ Gmail watch renewal check completed in ${processingTime}ms`)
    
    return NextResponse.json({
      success: true,
      processingTime,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('❌ Scheduled watch renewal failed:', error)
    return NextResponse.json({ 
      error: 'Failed to renew watches',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * Health check for the renewal service
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    service: 'Gmail Watch Renewal',
    status: 'active',
    timestamp: new Date().toISOString()
  })
}