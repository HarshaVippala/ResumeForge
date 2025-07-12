/**
 * Gmail Pub/Sub Handler
 * Processes real-time push notifications from Gmail
 */

import { getSupabaseServiceClient } from '../db'
import { gmailService } from './service'
import { tokenCrypto } from './crypto'
import type { PubSubMessage, GmailHistoryEvent } from './types'

export class GmailPubSubHandler {
  private supabase: ReturnType<typeof getSupabaseServiceClient>
  private processingQueue = new Map<string, Promise<void>>()

  constructor() {
    // Use service client to bypass RLS for pubsub operations
    this.supabase = getSupabaseServiceClient()
  }

  /**
   * Handle incoming Pub/Sub message
   */
  async handleNotification(message: PubSubMessage): Promise<void> {
    try {
      // Decode the message
      const decodedData = Buffer.from(message.message.data, 'base64').toString('utf-8')
      const historyEvent: GmailHistoryEvent = JSON.parse(decodedData)

      console.log('Received Gmail notification:', {
        email: historyEvent.emailAddress,
        historyId: historyEvent.historyId,
        messageId: message.message.messageId
      })

      // Deduplicate notifications
      const notificationKey = `${historyEvent.emailAddress}-${historyEvent.historyId}`
      if (this.processingQueue.has(notificationKey)) {
        console.log('Notification already being processed:', notificationKey)
        return
      }

      // Process the notification
      const processingPromise = this.processHistoryUpdate(historyEvent)
      this.processingQueue.set(notificationKey, processingPromise)

      try {
        await processingPromise
      } finally {
        this.processingQueue.delete(notificationKey)
      }
    } catch (error) {
      console.error('Pub/Sub handler error:', error)
      throw error
    }
  }

  /**
   * Process history update for a user
   */
  private async processHistoryUpdate(event: GmailHistoryEvent): Promise<void> {
    try {
      // Find user by email
      const userId = await this.getUserIdByEmail(event.emailAddress)
      if (!userId) {
        console.error('No user found for email:', event.emailAddress)
        return
      }

      // Queue sync job
      await this.queueSyncJob(userId, event.historyId)

      // Trigger incremental sync
      await gmailService.incrementalSync(userId)

      // Update last notification time
      await this.updateNotificationMetadata(userId, event)
    } catch (error) {
      console.error('Process history update error:', error)
      
      // Queue for retry
      await this.queueRetry(event)
    }
  }

  /**
   * Find user ID by email address
   */
  private async getUserIdByEmail(email: string): Promise<string | null> {
    try {
      const emailHash = tokenCrypto.hashEmail(email)
      
      const { data, error } = await this.supabase
        .from('oauth_tokens')
        .select('user_id')
        .eq('provider', 'gmail')
        .eq('email_hash', emailHash)
        .single()

      if (error || !data) {
        // Try direct email match as fallback
        const { data: directMatch } = await this.supabase
          .from('oauth_tokens')
          .select('user_id')
          .eq('provider', 'gmail')
          .eq('email_address', email)
          .single()

        return directMatch?.user_id || null
      }

      return data.user_id
    } catch (error) {
      console.error('Get user by email error:', error)
      return null
    }
  }

  /**
   * Queue a sync job
   */
  private async queueSyncJob(userId: string, historyId: number): Promise<void> {
    try {
      await this.supabase
        .from('email_processing_queue')
        .insert({
          job_type: 'sync_batch',
          priority: 10, // High priority for real-time updates
          payload: {
            userId,
            historyId,
            source: 'pubsub'
          },
          status: 'pending',
          scheduled_at: new Date().toISOString(),
          max_attempts: 3
        })
    } catch (error) {
      console.error('Queue sync job error:', error)
    }
  }

  /**
   * Update notification metadata
   */
  private async updateNotificationMetadata(userId: string, event: GmailHistoryEvent): Promise<void> {
    try {
      await this.supabase
        .from('sync_metadata')
        .upsert({
          id: `gmail_notification_${userId}`,
          sync_type: 'gmail_notification',
          sync_state: {
            lastHistoryId: event.historyId,
            lastNotificationTime: new Date().toISOString(),
            emailAddress: event.emailAddress
          },
          last_sync_time: new Date().toISOString()
        })
    } catch (error) {
      console.error('Update notification metadata error:', error)
    }
  }

  /**
   * Queue notification for retry
   */
  private async queueRetry(event: GmailHistoryEvent): Promise<void> {
    try {
      await this.supabase
        .from('email_processing_queue')
        .insert({
          job_type: 'process_notification',
          priority: 5,
          payload: event,
          status: 'pending',
          scheduled_at: new Date(Date.now() + 60000).toISOString(), // Retry in 1 minute
          max_attempts: 5
        })
    } catch (error) {
      console.error('Queue retry error:', error)
    }
  }

  /**
   * Verify webhook request
   */
  verifyWebhookRequest(payload: string, signature?: string): boolean {
    if (!signature) {
      console.warn('No signature provided for webhook verification')
      return true // Allow in development
    }

    return tokenCrypto.verifyWebhookSignature(payload, signature)
  }

  /**
   * Check and renew watch subscriptions
   */
  async renewWatchSubscriptions(): Promise<void> {
    try {
      // Get all active watches
      const { data: watches } = await this.supabase
        .from('sync_metadata')
        .select('*')
        .eq('sync_type', 'gmail_watch')
        .filter('sync_state->active', 'eq', true)

      if (!watches || watches.length === 0) {
        console.log('No active watches to renew')
        return
      }

      for (const watch of watches) {
        const expiration = new Date(watch.sync_state.expiration)
        const now = new Date()
        const hoursUntilExpiry = (expiration.getTime() - now.getTime()) / (1000 * 60 * 60)

        // Renew if less than 24 hours until expiry
        if (hoursUntilExpiry < 24) {
          const userId = watch.id.replace('gmail_watch_', '')
          console.log(`Renewing watch for user ${userId}, expires in ${hoursUntilExpiry.toFixed(1)} hours`)
          
          try {
            await gmailService.setupWatch(userId)
          } catch (error) {
            console.error(`Failed to renew watch for user ${userId}:`, error)
          }
        }
      }
    } catch (error) {
      console.error('Renew watch subscriptions error:', error)
    }
  }
}

// Export singleton instance
export const gmailPubSubHandler = new GmailPubSubHandler()