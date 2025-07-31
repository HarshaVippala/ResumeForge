/**
 * Gmail Service
 * Handles email fetching, syncing, and thread management
 */

import { google, gmail_v1 } from 'googleapis'
import { OAuth2Client } from 'google-auth-library'
import { getSupabaseServiceClient } from '../db'
import { gmailOAuthService } from './oauth'
import type { 
  GmailMessage, 
  ProcessedEmail, 
  SyncResult,
  GmailListMessagesResponse,
  GmailWatchResponse
} from './types'

export class GmailService {
  private gmail: gmail_v1.Gmail | null = null
  private supabase: ReturnType<typeof getSupabaseServiceClient>
  private batchSize = 20 // Emails per batch
  private rateLimitDelay = 100 // ms between API calls

  constructor() {
    // Use service client to bypass RLS for email operations
    this.supabase = getSupabaseServiceClient()
  }

  /**
   * Initialize Gmail API client
   */
  private async initializeClient(userId: string): Promise<void> {
    const authClient = await gmailOAuthService.getAuthenticatedClient(userId)
    if (!authClient) {
      throw new Error('Not authenticated')
    }

    this.gmail = google.gmail({ version: 'v1', auth: authClient })
  }

  /**
   * Parse email headers to extract metadata
   */
  private parseHeaders(
    headers: Array<{ name: string; value: string }>, 
    internalDate?: string
  ): {
    subject: string
    from: string
    to: string[]
    date: Date
  } {
    const headerMap = new Map(headers.map(h => [h.name.toLowerCase(), h.value]))
    
    // Extract date with proper fallbacks
    let date: Date
    const dateHeader = headerMap.get('date')
    
    if (dateHeader) {
      // Try to parse the date header
      date = new Date(dateHeader)
      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.warn(`Invalid date header: ${dateHeader}`)
        date = this.parseInternalDate(internalDate)
      }
    } else {
      // No date header, use internalDate as fallback
      date = this.parseInternalDate(internalDate)
    }
    
    return {
      subject: headerMap.get('subject') || '',
      from: headerMap.get('from') || '',
      to: (headerMap.get('to') || '').split(',').map(e => e.trim()),
      date
    }
  }

  /**
   * Parse Gmail's internalDate (milliseconds since epoch as string)
   */
  private parseInternalDate(internalDate?: string): Date {
    if (internalDate) {
      // internalDate is milliseconds since epoch as a string
      const timestamp = parseInt(internalDate, 10)
      if (!isNaN(timestamp)) {
        return new Date(timestamp)
      }
    }
    // Last resort: use current date
    console.warn('No valid date found, using current date')
    return new Date()
  }

  /**
   * Extract email content from message parts
   */
  private extractContent(payload: any): { text: string; html: string } {
    let text = ''
    let html = ''

    const extractFromParts = (parts: any[]): void => {
      for (const part of parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          text += Buffer.from(part.body.data, 'base64').toString('utf-8')
        } else if (part.mimeType === 'text/html' && part.body?.data) {
          html += Buffer.from(part.body.data, 'base64').toString('utf-8')
        } else if (part.parts) {
          extractFromParts(part.parts)
        }
      }
    }

    if (payload.parts) {
      extractFromParts(payload.parts)
    } else if (payload.body?.data) {
      const content = Buffer.from(payload.body.data, 'base64').toString('utf-8')
      if (payload.mimeType === 'text/plain') {
        text = content
      } else if (payload.mimeType === 'text/html') {
        html = content
      }
    }

    return { text, html }
  }

  /**
   * Extract sender information
   */
  private extractSenderInfo(from: string): { email: string; name: string } {
    const match = from.match(/^(.*?)\s*<(.+?)>$/)
    if (match) {
      return { name: match[1].replace(/"/g, '').trim(), email: match[2] }
    }
    return { email: from, name: '' }
  }

  /**
   * Process a Gmail message into our format
   */
  private async processMessage(message: GmailMessage): Promise<ProcessedEmail> {
    const headers = this.parseHeaders(message.payload.headers, message.internalDate)
    const content = this.extractContent(message.payload)
    const sender = this.extractSenderInfo(headers.from)

    // Check if we have limited scope (no body content)
    const hasLimitedScope = !content.text && !content.html && message.snippet

    return {
      id: message.id,
      messageId: message.id,
      threadId: message.threadId,
      historyId: message.historyId,
      
      subject: headers.subject,
      snippet: message.snippet,
      bodyText: content.text || (hasLimitedScope ? '[Email content unavailable - limited Gmail scope]' : ''),
      bodyHtml: content.html || (hasLimitedScope ? '<p>[Email content unavailable - limited Gmail scope]</p>' : ''),
      
      senderEmail: sender.email,
      senderName: sender.name,
      recipientEmails: headers.to,
      receivedAt: headers.date,
      gmailLabels: message.labelIds || [],
      
      rawEmail: message
    }
  }

  /**
   * Fetch a single email by ID
   */
  async fetchEmail(userId: string, emailId: string): Promise<ProcessedEmail | null> {
    try {
      await this.initializeClient(userId)
      if (!this.gmail) throw new Error('Gmail client not initialized')

      let data: any
      
      try {
        // Try to fetch with full format first
        const response = await this.gmail.users.messages.get({
          userId: 'me',
          id: emailId,
          format: 'full'
        })
        data = response.data
      } catch (error: any) {
        // Log the actual error to debug
        console.error(`Error fetching email ${emailId} with full format:`, {
          message: error.message,
          code: error.code,
          statusCode: error.response?.status,
          statusText: error.response?.statusText,
          errors: error.errors
        })
        
        // Only fall back for actual scope/permission errors
        const isPermissionError = 
          error.code === 403 || 
          error.response?.status === 403 ||
          error.message?.includes('Insufficient Permission') ||
          error.message?.includes('Request had insufficient authentication scopes')
          
        if (isPermissionError) {
          console.warn(`Falling back to metadata format for email ${emailId} due to scope limitations`)
          const response = await this.gmail.users.messages.get({
            userId: 'me',
            id: emailId,
            format: 'metadata',
            metadataHeaders: ['Subject', 'From', 'To', 'Date']
          })
          
          // Convert metadata format to a minimal GmailMessage format
          const metadata = response.data
          data = {
            id: metadata.id,
            threadId: metadata.threadId,
            historyId: metadata.historyId,
            internalDate: metadata.internalDate,
            labelIds: metadata.labelIds,
            snippet: metadata.snippet,
            sizeEstimate: metadata.sizeEstimate || 0,
            payload: {
              partId: '',
              filename: '',
              headers: metadata.payload?.headers || [],
              mimeType: 'text/plain',
              body: { 
                size: 0,
                data: '' // No body available with metadata scope
              },
              parts: []
            }
          }
        } else {
          throw error
        }
      }

      return await this.processMessage(data as GmailMessage)
    } catch (error) {
      console.error('Fetch email error:', error)
      return null
    }
  }

  /**
   * List emails with optional query
   * Note: Query parameter requires gmail.readonly scope, not just metadata
   */
  async listEmails(
    userId: string, 
    query?: string, 
    pageToken?: string,
    maxResults: number = 50
  ): Promise<GmailListMessagesResponse> {
    await this.initializeClient(userId)
    if (!this.gmail) throw new Error('Gmail client not initialized')

    try {
      const { data } = await this.gmail.users.messages.list({
        userId: 'me',
        q: query,
        pageToken,
        maxResults
      })

      return data as GmailListMessagesResponse
    } catch (error: any) {
      // If query fails with metadata scope error, retry without query
      if (error.message?.includes('Metadata scope') && query) {
        console.warn('Query not supported with current scope, fetching without query filter')
        const { data } = await this.gmail.users.messages.list({
          userId: 'me',
          pageToken,
          maxResults
        })
        return data as GmailListMessagesResponse
      }
      throw error
    }
  }

  /**
   * Initial sync - fetch emails from a specific date
   */
  async initialSync(userId: string, afterDate: Date): Promise<SyncResult> {
    const startTime = Date.now()
    const result: SyncResult = {
      emailsSynced: 0,
      threadsUpdated: 0,
      errors: [],
      duration: 0
    }

    try {
      await this.initializeClient(userId)
      
      // Build query for emails after the specified date
      // Try with simple date query first, fallback to no query if scope issues
      const dateQuery = `after:${Math.floor(afterDate.getTime() / 1000)}`
      
      let pageToken: string | undefined
      let processedEmails = 0

      do {
        // Try listing with date query, will fallback to no query if needed
        const listResponse = await this.listEmails(userId, dateQuery, pageToken, this.batchSize)
        const messages = listResponse.messages || []
        
        // Process batch
        for (const message of messages) {
          try {
            const email = await this.fetchEmail(userId, message.id)
            if (email) {
              // Filter by date since we can't use query with metadata scope
              if (email.receivedAt >= afterDate) {
                await this.storeEmail(email, userId)
                processedEmails++
                result.emailsSynced++
              }
            }
            
            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay))
          } catch (error: any) {
            console.error(`Error processing email ${message.id}:`, error)
            result.errors.push({ emailId: message.id, error: error.message })
          }
        }

        pageToken = listResponse.nextPageToken
        
        // Update sync progress
        await this.updateSyncProgress(userId, processedEmails, pageToken)
        
      } while (pageToken && processedEmails < 500) // Limit initial sync

      // Setup watch for future emails
      await this.setupWatch(userId)
      
      result.duration = Date.now() - startTime
      return result
    } catch (error) {
      console.error('Initial sync error:', error)
      throw error
    }
  }

  /**
   * Incremental sync using History API
   */
  async incrementalSync(userId: string): Promise<SyncResult> {
    const startTime = Date.now()
    const result: SyncResult = {
      emailsSynced: 0,
      threadsUpdated: 0,
      errors: [],
      duration: 0
    }

    try {
      await this.initializeClient(userId)
      if (!this.gmail) throw new Error('Gmail client not initialized')

      // Get last history ID
      const lastHistoryId = await this.getLastHistoryId(userId)
      if (!lastHistoryId) {
        // No previous sync, do initial sync with 10 days
        const tenDaysAgo = new Date()
        tenDaysAgo.setDate(tenDaysAgo.getDate() - 10)
        console.log('📧 No history ID found, performing initial sync for last 10 days')
        return await this.initialSync(userId, tenDaysAgo)
      }

      // Get history changes
      const { data } = await this.gmail.users.history.list({
        userId: 'me',
        startHistoryId: lastHistoryId,
        historyTypes: ['messageAdded', 'messageDeleted', 'labelAdded', 'labelRemoved']
      })

      const history = data.history || []
      
      // Process history changes
      for (const historyItem of history) {
        if (historyItem.messagesAdded) {
          for (const item of historyItem.messagesAdded) {
            try {
              const email = await this.fetchEmail(userId, item.message!.id!)
              if (email) {
                await this.storeEmail(email, userId)
                result.emailsSynced++
              }
            } catch (error: any) {
              result.errors.push({ emailId: item.message!.id!, error: error.message })
            }
          }
        }
      }

      // Update last history ID
      if (data.historyId) {
        await this.updateLastHistoryId(userId, data.historyId)
      }

      result.duration = Date.now() - startTime
      return result
    } catch (error) {
      console.error('Incremental sync error:', error)
      throw error
    }
  }

  /**
   * Store email in database with retry logic
   */
  private async storeEmail(email: ProcessedEmail, userId: string): Promise<void> {
    const maxRetries = 3
    const baseDelay = 1000 // 1 second
    
    // Retry wrapper function
    const retryWithBackoff = async (fn: () => Promise<any>, attempt = 1): Promise<any> => {
      try {
        return await fn()
      } catch (error: any) {
        const isRetryableError = 
          error.code === 'PGRST301' || // Network error
          error.code === '40001' || // Serialization failure
          error.code === 'ECONNRESET' ||
          error.code === 'ETIMEDOUT' ||
          error.message?.includes('network') ||
          error.message?.includes('timeout')
        
        if (isRetryableError && attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt - 1) // Exponential backoff
          console.warn(`Retrying email storage (attempt ${attempt + 1}/${maxRetries}) after ${delay}ms...`)
          await new Promise(resolve => setTimeout(resolve, delay))
          return retryWithBackoff(fn, attempt + 1)
        }
        
        throw error
      }
    }
    
    try {
      // Import content cleaner
      const { cleanEmailForDisplay } = require('../utils/content-cleaner');
      
      // Clean email content before storing
      const cleanedContent = cleanEmailForDisplay({
        body_html: email.bodyHtml,
        body_text: email.bodyText,
        subject: email.subject
      });
      
      // Map fields to match the database schema from types.ts
      const emailData = {
        // Required fields
        gmail_id: email.messageId,
        thread_id: email.threadId,
        subject: email.subject,
        sender: `${email.senderName || ''} <${email.senderEmail}>`.trim(),
        recipients: email.recipientEmails,
        received_at: email.receivedAt.toISOString(),
        
        // Content fields - store both original and cleaned
        body_text: email.bodyText, // Keep original for AI processing
        body_html: email.bodyHtml, // Keep original HTML
        
        // Gmail metadata
        labels: email.gmailLabels,
        has_attachments: false,
        attachments: [],
        
        // Status fields
        is_job_related: false,
        ai_processed: false,
        requires_action: false,
        
        // Thread management
        is_thread_root: false,
        thread_position: null,
        
        // Timestamps
        created_at: new Date().toISOString()
      }

      const { error } = await retryWithBackoff(async () => {
        return await this.supabase
          .from('emails')
          .upsert(emailData, {
            onConflict: 'gmail_id'
          })
      })

      if (error) {
        console.error('Store email error after retries:', error)
        throw error
      }
    } catch (error) {
      console.error('Store email error:', error)
      throw error
    }
  }

  /**
   * Setup Gmail push notifications with automatic renewal
   */
  async setupWatch(userId: string): Promise<GmailWatchResponse | null> {
    try {
      await this.initializeClient(userId)
      if (!this.gmail) throw new Error('Gmail client not initialized')

      const topicName = process.env.GMAIL_PUBSUB_TOPIC
      if (!topicName) {
        console.warn('No Pub/Sub topic configured, skipping watch setup')
        return null
      }

      console.log(`📧 Setting up Gmail watch for user ${userId}`)
      console.log(`📧 Topic: ${topicName}`)

      const { data } = await this.gmail.users.watch({
        userId: 'me',
        requestBody: {
          topicName,
          labelIds: ['INBOX', 'SENT'],
          labelFilterAction: 'include'
        }
      })

      const now = new Date().toISOString()
      const expirationTime = new Date(parseInt(data.expiration || '0')).toISOString()

      // Store watch information with enhanced metadata
      const { error } = await this.supabase
        .from('sync_metadata')
        .upsert({
          id: `gmail_watch_${userId}`,
          sync_type: 'gmail_watch',
          sync_state: {
            historyId: data.historyId,
            expiration: expirationTime,
            active: true,
            topicName,
            lastRenewal: now,
            renewalCount: 0
          },
          last_sync_time: now
        })

      if (error) {
        console.error('Error storing watch metadata:', error)
        throw error
      }

      console.log(`✅ Gmail watch setup completed. Expires at: ${expirationTime}`)
      
      // Schedule automatic renewal
      await this.scheduleWatchRenewal(userId, expirationTime)

      return data as GmailWatchResponse
    } catch (error) {
      console.error('Setup watch error:', error)
      
      // Mark watch as failed
      await this.supabase
        .from('sync_metadata')
        .upsert({
          id: `gmail_watch_${userId}`,
          sync_type: 'gmail_watch',
          sync_state: {
            active: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            lastFailure: new Date().toISOString()
          },
          last_sync_time: new Date().toISOString()
        })
      
      return null
    }
  }

  /**
   * Schedule automatic watch renewal
   */
  private async scheduleWatchRenewal(userId: string, expirationTime: string): Promise<void> {
    try {
      const expiration = new Date(expirationTime)
      const now = new Date()
      const renewalTime = new Date(expiration.getTime() - (24 * 60 * 60 * 1000)) // 24 hours before expiration

      // Only schedule if renewal time is in the future
      if (renewalTime > now) {
        await this.supabase
          .from('email_processing_queue')
          .insert({
            job_type: 'renew_watch',
            priority: 5,
            payload: {
              userId,
              originalExpiration: expirationTime
            },
            status: 'pending',
            scheduled_at: renewalTime.toISOString(),
            max_attempts: 3
          })
        
        console.log(`📅 Watch renewal scheduled for ${renewalTime.toISOString()}`)
      }
    } catch (error) {
      console.error('Error scheduling watch renewal:', error)
    }
  }

  /**
   * Renew Gmail watch subscription
   */
  async renewWatch(userId: string): Promise<GmailWatchResponse | null> {
    try {
      console.log(`🔄 Renewing Gmail watch for user ${userId}`)
      
      // Get current watch info
      const { data: currentWatch } = await this.supabase
        .from('sync_metadata')
        .select('sync_state')
        .eq('id', `gmail_watch_${userId}`)
        .single()

      if (!currentWatch) {
        console.warn('No existing watch found for renewal')
        return await this.setupWatch(userId)
      }

      // Increment renewal count
      const renewalCount = (currentWatch.sync_state.renewalCount || 0) + 1
      
      // Setup new watch
      const watchResponse = await this.setupWatch(userId)
      
      if (watchResponse) {
        // Update renewal count
        await this.supabase
          .from('sync_metadata')
          .update({
            sync_state: {
              ...currentWatch.sync_state,
              renewalCount,
              lastRenewal: new Date().toISOString()
            }
          })
          .eq('id', `gmail_watch_${userId}`)
          
        console.log(`✅ Gmail watch renewed successfully (renewal #${renewalCount})`)
      }

      return watchResponse
    } catch (error) {
      console.error('Error renewing watch:', error)
      return null
    }
  }

  /**
   * Check and renew expired watches
   */
  async checkAndRenewWatches(): Promise<void> {
    try {
      const now = new Date()
      const checkTime = new Date(now.getTime() + (2 * 60 * 60 * 1000)) // 2 hours from now

      // Get watches that expire within 2 hours
      const { data: watches } = await this.supabase
        .from('sync_metadata')
        .select('*')
        .eq('sync_type', 'gmail_watch')
        .filter('sync_state->active', 'eq', true)
        .filter('sync_state->expiration', 'lt', checkTime.toISOString())

      if (!watches || watches.length === 0) {
        console.log('No watches need renewal')
        return
      }

      console.log(`🔄 Found ${watches.length} watches that need renewal`)

      for (const watch of watches) {
        const userId = watch.id.replace('gmail_watch_', '')
        const expiration = new Date(watch.sync_state.expiration)
        const hoursUntilExpiry = (expiration.getTime() - now.getTime()) / (1000 * 60 * 60)

        console.log(`Renewing watch for user ${userId} (expires in ${hoursUntilExpiry.toFixed(1)} hours)`)
        
        try {
          await this.renewWatch(userId)
        } catch (error) {
          console.error(`Failed to renew watch for user ${userId}:`, error)
        }
      }
    } catch (error) {
      console.error('Error checking and renewing watches:', error)
    }
  }

  /**
   * Get last history ID from database with caching
   */
  private async getLastHistoryId(userId: string): Promise<string | null> {
    try {
      // First check watch metadata for most recent history ID
      const { data: watchData } = await this.supabase
        .from('sync_metadata')
        .select('sync_state')
        .eq('id', `gmail_watch_${userId}`)
        .single()

      if (watchData?.sync_state?.historyId) {
        return watchData.sync_state.historyId
      }

      // Fallback to sync metadata
      const { data: syncData } = await this.supabase
        .from('sync_metadata')
        .select('sync_state')
        .eq('id', `gmail_sync_${userId}`)
        .single()

      return syncData?.sync_state?.lastHistoryId || null
    } catch (error) {
      console.error('Error getting last history ID:', error)
      return null
    }
  }

  /**
   * Update last history ID with optimistic locking
   */
  private async updateLastHistoryId(userId: string, historyId: string): Promise<void> {
    try {
      const now = new Date().toISOString()
      
      // Update with upsert to handle concurrent updates
      const { error } = await this.supabase
        .from('sync_metadata')
        .upsert({
          id: `gmail_sync_${userId}`,
          sync_type: 'gmail_sync',
          sync_state: {
            lastHistoryId: historyId,
            lastSyncTime: now,
            updatedAt: now
          },
          last_sync_time: now
        }, {
          onConflict: 'id'
        })

      if (error) {
        console.error('Error updating history ID:', error)
        throw error
      }

      // Also update watch metadata if it exists
      await this.supabase
        .from('sync_metadata')
        .update({
          sync_state: {
            historyId: historyId,
            lastUpdate: now,
            active: true
          },
          last_sync_time: now
        })
        .eq('id', `gmail_watch_${userId}`)
        .eq('sync_type', 'gmail_watch')
    } catch (error) {
      console.error('Error updating history ID:', error)
      throw error
    }
  }

  /**
   * Update sync progress
   */
  private async updateSyncProgress(
    userId: string, 
    processedCount: number, 
    pageToken?: string
  ): Promise<void> {
    await this.supabase
      .from('sync_metadata')
      .upsert({
        id: `gmail_sync_progress_${userId}`,
        sync_type: 'gmail_sync_progress',
        sync_state: {
          processedCount,
          pageToken,
          inProgress: !!pageToken,
          lastUpdate: new Date().toISOString()
        },
        last_sync_time: new Date().toISOString()
      })
  }
}

// Export singleton instance
export const gmailService = new GmailService()