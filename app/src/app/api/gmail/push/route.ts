/**
 * Gmail Push Notification Endpoint
 * 
 * This endpoint receives push notifications from Google Cloud Pub/Sub when Gmail changes occur.
 * It processes the notifications and triggers incremental sync for the affected users.
 * 
 * Created: 2025-01-09
 * Updated: 2025-01-09
 */

import { NextRequest, NextResponse } from 'next/server'
import { gmailPubSubHandler } from '@/api/_lib/gmail/pubsub'
import { getSupabaseServiceClient } from '@/api/_lib/db'
import type { PubSubMessage } from '@/api/_lib/gmail/types'

export const runtime = 'edge'

/**
 * Handle Gmail push notifications from Pub/Sub
 */
export async function POST(request: NextRequest) {
  try {
    const startTime = Date.now()
    
    // Parse the request body
    const body = await request.json()
    console.log('📧 Received Gmail push notification:', {
      messageId: body.message?.messageId,
      publishTime: body.message?.publishTime,
      subscriptionName: body.subscription
    })
    
    // Validate the message structure
    if (!body.message || !body.message.data) {
      console.error('Invalid push notification structure:', body)
      return NextResponse.json({ error: 'Invalid message structure' }, { status: 400 })
    }
    
    // Extract the signature for verification (if present)
    const signature = request.headers.get('x-goog-signature')
    const rawBody = JSON.stringify(body)
    
    // Verify the webhook request
    const isValid = gmailPubSubHandler.verifyWebhookRequest(rawBody, signature || undefined)
    if (!isValid) {
      console.error('Invalid webhook signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
    
    // Structure the message for processing
    const pubSubMessage: PubSubMessage = {
      message: {
        data: body.message.data,
        messageId: body.message.messageId,
        publishTime: body.message.publishTime,
        attributes: body.message.attributes || {}
      },
      subscription: body.subscription
    }
    
    // Process the notification asynchronously
    await gmailPubSubHandler.handleNotification(pubSubMessage)
    
    const processingTime = Date.now() - startTime
    console.log(`✅ Push notification processed in ${processingTime}ms`)
    
    // Log the notification for monitoring
    await logNotification(pubSubMessage, processingTime)
    
    // Return success response
    return NextResponse.json({ 
      success: true, 
      processed: true,
      processingTime 
    })
    
  } catch (error) {
    console.error('❌ Push notification processing error:', error)
    
    // Log the error for monitoring
    await logNotificationError(error as Error, await request.json().catch(() => null))
    
    return NextResponse.json({ 
      error: 'Internal server error',
      success: false 
    }, { status: 500 })
  }
}

/**
 * Handle GET requests for endpoint verification
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const challenge = searchParams.get('hub.challenge')
  
  if (challenge) {
    // Respond to webhook verification challenge
    return new Response(challenge, { 
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    })
  }
  
  return NextResponse.json({ 
    service: 'Gmail Push Notifications',
    status: 'active',
    timestamp: new Date().toISOString()
  })
}

/**
 * Log notification for monitoring and debugging
 */
async function logNotification(message: PubSubMessage, processingTime: number): Promise<void> {
  try {
    const supabase = getSupabaseServiceClient()
    
    // Decode the notification data
    const decodedData = Buffer.from(message.message.data, 'base64').toString('utf-8')
    const notificationData = JSON.parse(decodedData)
    
    await supabase
      .from('gmail_notifications_log')
      .insert({
        message_id: message.message.messageId,
        email_address: notificationData.emailAddress,
        history_id: notificationData.historyId,
        processing_time_ms: processingTime,
        subscription_name: message.subscription,
        processed_at: new Date().toISOString(),
        status: 'success'
      })
  } catch (error) {
    console.error('Failed to log notification:', error)
  }
}

/**
 * Log notification error for monitoring
 */
async function logNotificationError(error: Error, requestBody: any): Promise<void> {
  try {
    const supabase = getSupabaseServiceClient()
    
    await supabase
      .from('gmail_notifications_log')
      .insert({
        message_id: requestBody?.message?.messageId || 'unknown',
        email_address: 'unknown',
        history_id: null,
        processing_time_ms: 0,
        subscription_name: requestBody?.subscription || 'unknown',
        processed_at: new Date().toISOString(),
        status: 'error',
        error_message: error.message,
        error_stack: error.stack
      })
  } catch (logError) {
    console.error('Failed to log notification error:', logError)
  }
}