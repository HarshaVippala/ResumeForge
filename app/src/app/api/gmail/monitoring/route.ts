/**
 * Gmail Sync Monitoring API
 * 
 * This endpoint provides comprehensive monitoring and performance tracking for Gmail sync:
 * - Push notification statistics
 * - Sync performance metrics
 * - Error tracking and analysis
 * - Watch subscription health
 * 
 * Created: 2025-01-09
 * Updated: 2025-01-09
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/api/_lib/db'

export const runtime = 'edge'

/**
 * Get Gmail sync monitoring dashboard
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId') || process.env.USER_ID
    const timeRange = searchParams.get('timeRange') || '24h'
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    const supabase = getSupabaseServiceClient()
    
    // Calculate time range
    const now = new Date()
    const timeRangeMs = parseTimeRange(timeRange)
    const startTime = new Date(now.getTime() - timeRangeMs)
    
    // Get monitoring data in parallel
    const [
      watchStatus,
      notificationStats,
      syncPerformance,
      errorAnalysis,
      historyIdHealth
    ] = await Promise.all([
      getWatchStatus(supabase, userId),
      getNotificationStats(supabase, startTime),
      getSyncPerformance(supabase, userId, startTime),
      getErrorAnalysis(supabase, startTime),
      getHistoryIdHealth(supabase, userId)
    ])

    return NextResponse.json({
      status: 'success',
      timestamp: now.toISOString(),
      timeRange,
      userId,
      data: {
        watchStatus,
        notificationStats,
        syncPerformance,
        errorAnalysis,
        historyIdHealth
      }
    })
  } catch (error) {
    console.error('Error getting monitoring data:', error)
    return NextResponse.json({ 
      error: 'Failed to get monitoring data' 
    }, { status: 500 })
  }
}

/**
 * Get current watch status
 */
async function getWatchStatus(supabase: any, userId: string) {
  const { data: watch } = await supabase
    .from('sync_metadata')
    .select('*')
    .eq('id', `gmail_watch_${userId}`)
    .single()

  if (!watch) {
    return { configured: false }
  }

  const now = new Date()
  const expiration = new Date(watch.sync_state.expiration)
  const hoursUntilExpiry = (expiration.getTime() - now.getTime()) / (1000 * 60 * 60)
  
  return {
    configured: true,
    active: watch.sync_state.active,
    expiration: watch.sync_state.expiration,
    hoursUntilExpiry: Math.round(hoursUntilExpiry * 100) / 100,
    needsRenewal: hoursUntilExpiry < 24,
    isExpired: expiration < now,
    renewalCount: watch.sync_state.renewalCount || 0,
    lastRenewal: watch.sync_state.lastRenewal,
    topicName: watch.sync_state.topicName,
    historyId: watch.sync_state.historyId
  }
}

/**
 * Get push notification statistics
 */
async function getNotificationStats(supabase: any, startTime: Date) {
  const { data: notifications } = await supabase
    .from('gmail_notifications_log')
    .select('*')
    .gte('processed_at', startTime.toISOString())
    .order('processed_at', { ascending: false })

  if (!notifications || notifications.length === 0) {
    return {
      totalNotifications: 0,
      successfulNotifications: 0,
      failedNotifications: 0,
      avgProcessingTime: 0,
      recentNotifications: []
    }
  }

  const successful = notifications.filter(n => n.status === 'success')
  const failed = notifications.filter(n => n.status === 'error')
  const avgProcessingTime = successful.reduce((acc, n) => acc + n.processing_time_ms, 0) / successful.length || 0

  return {
    totalNotifications: notifications.length,
    successfulNotifications: successful.length,
    failedNotifications: failed.length,
    avgProcessingTime: Math.round(avgProcessingTime),
    recentNotifications: notifications.slice(0, 10).map(n => ({
      messageId: n.message_id,
      emailAddress: n.email_address,
      historyId: n.history_id,
      processingTime: n.processing_time_ms,
      status: n.status,
      processedAt: n.processed_at,
      error: n.error_message
    }))
  }
}

/**
 * Get sync performance metrics
 */
async function getSyncPerformance(supabase: any, userId: string, startTime: Date) {
  // Get sync metadata
  const { data: syncMetadata } = await supabase
    .from('sync_metadata')
    .select('*')
    .eq('id', `gmail_sync_${userId}`)
    .single()

  // Get recent sync jobs from processing queue
  const { data: syncJobs } = await supabase
    .from('email_processing_queue')
    .select('*')
    .eq('job_type', 'sync_batch')
    .gte('created_at', startTime.toISOString())
    .order('created_at', { ascending: false })
    .limit(50)

  // Get email count by time period
  const { data: emailCounts } = await supabase
    .from('emails')
    .select('created_at')
    .gte('created_at', startTime.toISOString())

  return {
    lastSyncTime: syncMetadata?.last_sync_time,
    lastHistoryId: syncMetadata?.sync_state?.lastHistoryId,
    recentSyncJobs: syncJobs?.length || 0,
    emailsSynced: emailCounts?.length || 0,
    avgEmailsPerHour: emailCounts ? Math.round(emailCounts.length / 24) : 0
  }
}

/**
 * Get error analysis
 */
async function getErrorAnalysis(supabase: any, startTime: Date) {
  const { data: errors } = await supabase
    .from('gmail_notifications_log')
    .select('error_message, processed_at')
    .eq('status', 'error')
    .gte('processed_at', startTime.toISOString())

  if (!errors || errors.length === 0) {
    return {
      totalErrors: 0,
      errorTypes: [],
      recentErrors: []
    }
  }

  // Group errors by type
  const errorTypes = errors.reduce((acc: any, error: any) => {
    const errorType = error.error_message?.split(':')[0] || 'Unknown'
    acc[errorType] = (acc[errorType] || 0) + 1
    return acc
  }, {})

  return {
    totalErrors: errors.length,
    errorTypes: Object.entries(errorTypes).map(([type, count]) => ({ type, count })),
    recentErrors: errors.slice(0, 5).map(e => ({
      message: e.error_message,
      timestamp: e.processed_at
    }))
  }
}

/**
 * Get history ID health check
 */
async function getHistoryIdHealth(supabase: any, userId: string) {
  const { data: syncData } = await supabase
    .from('sync_metadata')
    .select('sync_state, last_sync_time')
    .eq('id', `gmail_sync_${userId}`)
    .single()

  const { data: watchData } = await supabase
    .from('sync_metadata')
    .select('sync_state, last_sync_time')
    .eq('id', `gmail_watch_${userId}`)
    .single()

  const now = new Date()
  const syncLastUpdate = syncData?.last_sync_time ? new Date(syncData.last_sync_time) : null
  const watchLastUpdate = watchData?.last_sync_time ? new Date(watchData.last_sync_time) : null

  return {
    syncHistoryId: syncData?.sync_state?.lastHistoryId,
    watchHistoryId: watchData?.sync_state?.historyId,
    syncLastUpdate: syncLastUpdate?.toISOString(),
    watchLastUpdate: watchLastUpdate?.toISOString(),
    syncStaleness: syncLastUpdate ? Math.round((now.getTime() - syncLastUpdate.getTime()) / (1000 * 60)) : null,
    watchStaleness: watchLastUpdate ? Math.round((now.getTime() - watchLastUpdate.getTime()) / (1000 * 60)) : null,
    historyIdSynced: syncData?.sync_state?.lastHistoryId === watchData?.sync_state?.historyId
  }
}

/**
 * Parse time range string to milliseconds
 */
function parseTimeRange(timeRange: string): number {
  const ranges: { [key: string]: number } = {
    '1h': 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000
  }
  
  return ranges[timeRange] || ranges['24h']
}