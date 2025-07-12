/**
 * Gmail Watch Management API
 * 
 * This endpoint provides management capabilities for Gmail watch subscriptions:
 * - GET: Get current watch status
 * - POST: Setup or renew watch
 * - DELETE: Stop watch
 * 
 * Created: 2025-01-09
 * Updated: 2025-01-09
 */

import { NextRequest, NextResponse } from 'next/server'
import { gmailService } from '@/api/_lib/gmail/service'
import { getSupabaseServiceClient } from '@/api/_lib/db'

export const runtime = 'edge'

/**
 * Get current Gmail watch status
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId') || process.env.USER_ID
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    const supabase = getSupabaseServiceClient()
    
    // Get current watch information
    const { data: watch } = await supabase
      .from('sync_metadata')
      .select('*')
      .eq('id', `gmail_watch_${userId}`)
      .single()

    if (!watch) {
      return NextResponse.json({
        status: 'not_configured',
        message: 'No Gmail watch configured'
      })
    }

    const now = new Date()
    const expiration = new Date(watch.sync_state.expiration)
    const hoursUntilExpiry = (expiration.getTime() - now.getTime()) / (1000 * 60 * 60)
    const isExpired = expiration < now
    const needsRenewal = hoursUntilExpiry < 24

    return NextResponse.json({
      status: watch.sync_state.active ? (isExpired ? 'expired' : 'active') : 'inactive',
      expiration: watch.sync_state.expiration,
      hoursUntilExpiry: Math.round(hoursUntilExpiry * 100) / 100,
      needsRenewal,
      isExpired,
      renewalCount: watch.sync_state.renewalCount || 0,
      lastRenewal: watch.sync_state.lastRenewal,
      topicName: watch.sync_state.topicName,
      historyId: watch.sync_state.historyId,
      error: watch.sync_state.error
    })
  } catch (error) {
    console.error('Error getting watch status:', error)
    return NextResponse.json({ 
      error: 'Failed to get watch status' 
    }, { status: 500 })
  }
}

/**
 * Setup or renew Gmail watch
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, action } = await request.json()
    const targetUserId = userId || process.env.USER_ID
    
    if (!targetUserId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    let result
    
    if (action === 'renew') {
      console.log('🔄 Renewing Gmail watch via API')
      result = await gmailService.renewWatch(targetUserId)
    } else {
      console.log('🆕 Setting up Gmail watch via API')
      result = await gmailService.setupWatch(targetUserId)
    }

    if (!result) {
      return NextResponse.json({ 
        error: 'Failed to setup/renew watch. Check Pub/Sub configuration.' 
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      historyId: result.historyId,
      expiration: result.expiration,
      action: action || 'setup'
    })
  } catch (error) {
    console.error('Error setting up/renewing watch:', error)
    return NextResponse.json({ 
      error: 'Failed to setup/renew watch' 
    }, { status: 500 })
  }
}

/**
 * Stop Gmail watch
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId') || process.env.USER_ID
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    const supabase = getSupabaseServiceClient()
    
    // Mark watch as inactive
    await supabase
      .from('sync_metadata')
      .update({
        sync_state: {
          active: false,
          stoppedAt: new Date().toISOString(),
          stoppedBy: 'api'
        },
        last_sync_time: new Date().toISOString()
      })
      .eq('id', `gmail_watch_${userId}`)

    return NextResponse.json({
      success: true,
      message: 'Gmail watch stopped'
    })
  } catch (error) {
    console.error('Error stopping watch:', error)
    return NextResponse.json({ 
      error: 'Failed to stop watch' 
    }, { status: 500 })
  }
}