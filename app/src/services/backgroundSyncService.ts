/**
 * Background Email Sync Service
 * Persistent service that runs email sync in the background across navigation
 */

import { getApiUrl, getDefaultHeaders } from '@/config/api.config'

type EmailData = {
  email_activities: any[]
  attention_items: any[]
  quick_updates: any[]
  upcoming_events: any[]
  emails_processed?: number
}

type SyncStatus = 'idle' | 'syncing' | 'error' | 'setup' | 'maintenance'
type SyncPhase = 'setup' | 'maintenance' | 'realtime'

interface EnhancedSyncProgress {
  phase: SyncPhase
  status: 'pending' | 'running' | 'completed' | 'failed'
  processed: number
  total: number
  emailsFound: number
  jobRelatedEmails: number
  startedAt: Date
  completedAt?: Date
  error?: string
}

type SyncSubscriber = (data: {
  emailData: EmailData | null
  status: SyncStatus
  lastUpdated: Date | null
  error?: string
  syncProgress?: EnhancedSyncProgress
  isEnhancedSync?: boolean
}) => void

class BackgroundSyncService {
  private subscribers: Set<SyncSubscriber> = new Set()
  private emailData: EmailData | null = null
  private status: SyncStatus = 'idle'
  private lastUpdated: Date | null = null
  private error?: string
  private syncInterval: NodeJS.Timeout | null = null
  private isInitialized = false
  private syncProgress: EnhancedSyncProgress | undefined = undefined
  private isEnhancedSync = false
  
  // Configuration
  private readonly SYNC_INTERVAL_MS = 60 * 60 * 1000 // 1 hour
  private readonly INITIAL_SYNC_DELAY_MS = 2000 // 2 seconds
  private lastSyncTime = 0
  private readonly MIN_SYNC_INTERVAL = 30 * 1000 // 30 seconds minimum between syncs
  private isFirstSync = true // Track if this is the first sync
  
  // Enhanced sync configuration
  private readonly ENHANCED_SYNC_ENABLED = process.env.NEXT_PUBLIC_ENHANCED_SYNC === 'true'
  // Track if enhanced sync is currently healthy. If we detect repeated failures
  // we  automatically disable it for the current session to avoid spamming the
  // backend (and the console) with 500 errors while keeping the legacy flow
  // functional.
  private enhancedSyncHealthy = true

  /**
   * Initialize the background sync service
   * This should be called once at app startup
   */
  initialize() {
    if (process.env.NEXT_PUBLIC_ENABLE_BACKGROUND_SYNC !== 'true') {
      console.log('🚫 Background Sync Service is disabled by feature flag.')
      return
    }

    if (this.isInitialized) {
      return
    }

    console.log('🔄 Initializing Background Sync Service')
    this.isInitialized = true

    // Perform initial sync with small delay to allow UI to mount
    setTimeout(() => {
      console.log('🔄 Starting initial background sync')
      this.performBackgroundSync()
    }, 500) // Reduced from 2 seconds to 500ms

    // Set up periodic background sync
    this.syncInterval = setInterval(() => {
      this.performBackgroundSync()
    }, this.SYNC_INTERVAL_MS)

    // Handle app visibility changes to sync when returning to app (with throttling)
    if (typeof document !== 'undefined') {
      let lastVisibilitySync = 0
      const VISIBILITY_SYNC_THROTTLE = 5 * 60 * 1000 // 5 minutes
      
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && this.status === 'idle') {
          const now = Date.now()
          // Only sync if it's been more than 5 minutes since last visibility sync
          if (now - lastVisibilitySync > VISIBILITY_SYNC_THROTTLE) {
            lastVisibilitySync = now
            console.log('🔄 Visibility change sync (throttled)')
            this.performBackgroundSync()
          }
        }
      })
    }
  }

  /**
   * Clean up resources
   */
  destroy() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
    }
    this.subscribers.clear()
    this.isInitialized = false
    console.log('🛑 Background Sync Service destroyed')
  }

  /**
   * Subscribe to sync updates
   */
  subscribe(callback: SyncSubscriber) {
    this.subscribers.add(callback)
    
    // Immediately send current state to new subscriber
    callback({
      emailData: this.emailData,
      status: this.status,
      lastUpdated: this.lastUpdated,
      error: this.error,
      syncProgress: this.syncProgress,
      isEnhancedSync: this.isEnhancedSync
    })

    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback)
    }
  }

  /**
   * Get current sync data
   */
  getCurrentData() {
    return {
      emailData: this.emailData,
      status: this.status,
      lastUpdated: this.lastUpdated,
      error: this.error,
      syncProgress: this.syncProgress,
      isEnhancedSync: this.isEnhancedSync
    }
  }

  /**
   * Update sync frequency (for settings)
   */
  updateSyncFrequency(newIntervalMs: number) {
    console.log(`🔄 Updating email sync frequency to ${newIntervalMs}ms`)
    
    // Clear existing interval
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
    }
    
    // Set new interval
    this.syncInterval = setInterval(() => {
      this.performBackgroundSync()
    }, newIntervalMs)
  }

  /**
   * Manually trigger a sync (for refresh button)
   * Returns job ID if async mode is enabled
   */
  async manualSync(): Promise<string | void> {
    if (this.status === 'syncing') {
      return // Already syncing
    }

    // For manual sync, use async mode
    return this.performEmailSync(true, true)
  }


  /**
   * Perform background sync without disrupting UI
   */
  private async performBackgroundSync() {
    if (this.status === 'syncing') {
      return // Already syncing
    }

    return this.performEmailSync(false)
  }

  /**
   * Core email sync logic
   * Returns job ID if async mode is used
   */
  private async performEmailSync(isManual: boolean = false, useAsync: boolean = false): Promise<string | void> {
    // Prevent too frequent syncing (except for manual syncs)
    const now = Date.now()
    if (!isManual && (now - this.lastSyncTime) < this.MIN_SYNC_INTERVAL) {
      console.log('🚫 Sync skipped - too frequent')
      return
    }
    
    this.lastSyncTime = now
    this.status = 'syncing'
    this.error = undefined
    this.syncProgress = undefined
    this.notifySubscribers()

    try {
      // Prefer enhanced sync but gracefully fallback to the legacy strategy if
      // the feature flag is disabled **or** we have previously marked it as
      // unhealthy (e.g. missing Gmail auth results in constant 500s).
      if (this.ENHANCED_SYNC_ENABLED && this.enhancedSyncHealthy) {
        try {
          const jobId = await this.performEnhancedSync(isManual, useAsync)
          if (jobId) return jobId
        } catch (enhancedErr) {
          // Any error bubbling up here means the enhanced flow failed *hard*.
          // Record the error, mark the flow unhealthy, and immediately fall
          // back to the stable legacy behaviour so the rest of the app keeps
          // working (important for the resume generator).
          console.warn(
            '⚠️  enhanced sync failed, switching to legacy flow for this session:',
            enhancedErr
          )
          
          // If it's an authentication error, don't fall back to legacy
          if (enhancedErr instanceof Error && enhancedErr.message.includes('Gmail not connected')) {
            this.status = 'idle'
            this.error = 'Gmail not connected. Please connect Gmail in Settings.'
            this.notifySubscribers()
            throw enhancedErr
          }
          
          this.enhancedSyncHealthy = false
          this.error =
            enhancedErr instanceof Error ? enhancedErr.message : 'Enhanced sync failed'
          await this.performLegacySync(isManual)
        }
      } else {
        await this.performLegacySync(isManual)
      }
    } catch (error) {
      console.error('💥 Email sync failed:', error)
      this.status = 'error'
      this.error = error instanceof Error ? error.message : 'Sync failed'
      this.syncProgress = undefined
    }

    this.notifySubscribers()
  }

  /**
   * Check Gmail OAuth connection status
   */
  private async checkGmailConnection(): Promise<{ authenticated: boolean; email?: string }> {
    try {
      const response = await fetch(getApiUrl('/api/oauth/status'), {
        headers: getDefaultHeaders()
      })
      
      if (!response.ok) {
        return { authenticated: false }
      }
      
      return await response.json()
    } catch (error) {
      console.error('Failed to check Gmail connection:', error)
      return { authenticated: false }
    }
  }

  /**
   * Enhanced multi-phase sync strategy
   * Returns job ID if async mode is used
   */
  private async performEnhancedSync(isManual: boolean = false, useAsync: boolean = false): Promise<string | void> {
    this.isEnhancedSync = true
    
    // Skip Gmail connection check in development if auth is disabled
    const isDevelopmentWithoutAuth = process.env.NODE_ENV === 'development' && 
                                     process.env.NEXT_PUBLIC_DISABLE_AUTH_IN_DEV === 'true'
    
    if (!isDevelopmentWithoutAuth) {
      // First check if Gmail is connected
      const oauthStatus = await this.checkGmailConnection()
      if (!oauthStatus.authenticated) {
        throw new Error('Gmail not connected. Please authorize Gmail access in settings.')
      }
    }
    
    // Call enhanced sync API endpoint with proper headers
    const response = await fetch(getApiUrl('/api/email/enhanced-sync'), {
      method: 'POST',
      headers: getDefaultHeaders(),
      body: JSON.stringify({
        // allow backend to decide appropriate phase unless it's a manual sync
        syncType: isManual ? 'incremental' : undefined,
        // Enable async mode for manual syncs
        async: useAsync
        // user_id will be determined by the backend from environment
      })
    })

    if (!response.ok) {
      // Attempt to extract error message from body
      let errorMessage = `Enhanced sync API error: ${response.status}`
      try {
        const errJson = await response.json()
        if (errJson?.error) errorMessage = errJson.error
      } catch (_) {
        // Body is not JSON or could not be parsed – ignore
      }

      throw new Error(errorMessage)
    }

    const result = await response.json()
    if (!result.success) {
      throw new Error(result.error || 'Enhanced sync failed')
    }

    // Check if async mode returned a job ID
    if (result.async && result.jobId) {
      console.log(`🚀 Async sync job created: ${result.jobId}`)
      this.status = 'syncing'
      
      // Start polling for job status
      this.pollSyncJobStatus(result.jobId)
      
      return result.jobId
    }

    // Synchronous mode - handle as before
    this.syncProgress = result.progress

    switch (result.progress?.phase) {
      case 'setup':
        this.status = 'setup'
        break
      case 'maintenance':
        this.status = 'maintenance'
        break
      default:
        this.status = 'idle'
    }

    if (result.progress?.status === 'completed') {
      await this.fetchUpdatedEmailData()
      this.status = 'idle'
      this.isFirstSync = false
    }
  }

  /**
   * Legacy sync strategy (fallback)
   */
  private async performLegacySync(isManual: boolean = false) {
    this.isEnhancedSync = false
    
    // Use database endpoint for fast background sync
    // On first sync, get more days for initial data
    const daysBack = this.isFirstSync ? 14 : 7
    const response = await fetch(getApiUrl(`/api/email?action=activities&days_back=${daysBack}&limit=50`), {
      method: 'GET',
      headers: getDefaultHeaders()
    })

    if (response.ok) {
      const result = await response.json()
      // The API returns emails directly, not wrapped in success/data
      if (result.emails) {
        
        // For background sync, intelligently merge new data
        if (!isManual && this.emailData) {
          const existingIds = new Set(this.emailData.email_activities?.map((e: any) => e.id) || [])
          const allEmails = result.emails || []
          const newEmails = allEmails.filter((e: any) => !existingIds.has(e.id))
          
          if (newEmails.length > 0) {
            console.log(`🔄 Background sync: Found ${newEmails.length} new emails`)
            // Merge new emails with existing ones
            this.emailData = {
              email_activities: [...newEmails, ...(this.emailData.email_activities || [])].slice(0, 50),
              attention_items: [],
              quick_updates: [],
              upcoming_events: []
            }
            // Only update lastUpdated if we actually found new data
            this.lastUpdated = new Date()
          } else {
            // No new emails found, don't update lastUpdated to avoid UI flash
            console.log('🔄 Background sync: No new emails found')
          }
        } else {
          // Manual refresh or first sync - replace all data
          this.emailData = {
            email_activities: result.emails || [],
            attention_items: [],
            quick_updates: [],
            upcoming_events: []
          }
          this.lastUpdated = new Date()
          if (isManual) {
            console.log(`🔄 Manual sync: Refreshed ${result.emails?.length || 0} emails`)
          }
        }
        
        this.status = 'idle'
        this.isFirstSync = false // Mark first sync as complete
      } else {
        throw new Error('Invalid response format')
      }
    } else {
      throw new Error(`API error: ${response.status}`)
    }
  }

  /**
   * Fetch updated email data after enhanced sync completion
   */
  private async fetchUpdatedEmailData() {
    try {
      const response = await fetch(getApiUrl('/api/email?action=activities&limit=50'), {
        method: 'GET',
        headers: getDefaultHeaders()
      })

      if (response.ok) {
        const result = await response.json()
        if (result.emails) {
          this.emailData = {
            email_activities: result.emails || [],
            attention_items: [],
            quick_updates: [],
            upcoming_events: []
          }
          this.lastUpdated = new Date()
          console.log(`✅ Enhanced sync completed: ${result.emails?.length || 0} emails loaded`)
        }
      }
    } catch (error) {
      console.error('Failed to fetch updated email data:', error)
    }
  }

  /**
   * Poll sync job status for async operations
   */
  private async pollSyncJobStatus(jobId: string) {
    const pollInterval = 1000 // Poll every 1 second
    const maxPolls = 300 // Max 5 minutes
    let pollCount = 0

    const poll = async () => {
      try {
        const response = await fetch(getApiUrl(`/api/email/sync-status/${jobId}`), {
          headers: getDefaultHeaders()
        })

        if (!response.ok) {
          throw new Error('Failed to get sync status')
        }

        const result = await response.json()
        
        if (result.success && result.job) {
          const job = result.job
          
          // Update progress
          this.syncProgress = {
            phase: job.type === 'initial' ? 'setup' : 'maintenance',
            status: job.status === 'running' ? 'running' : job.status === 'completed' ? 'completed' : 'pending',
            processed: job.processed_emails || 0,
            total: job.total_emails || 0,
            emailsFound: job.total_emails || 0,
            jobRelatedEmails: job.stats?.linkedEmails || 0,
            startedAt: job.started_at ? new Date(job.started_at) : new Date(),
            completedAt: job.completed_at ? new Date(job.completed_at) : undefined,
            error: job.error
          } as EnhancedSyncProgress

          // Update status based on job status
          if (job.status === 'completed') {
            this.status = 'idle'
            this.lastUpdated = new Date()
            this.isFirstSync = false
            await this.fetchUpdatedEmailData()
            this.notifySubscribers()
            return // Stop polling
          } else if (job.status === 'failed') {
            this.status = 'error'
            this.error = job.error || 'Sync failed'
            this.notifySubscribers()
            return // Stop polling
          } else {
            // Still running, update UI
            this.notifySubscribers()
          }
        }

        // Continue polling if not complete and under limit
        pollCount++
        if (pollCount < maxPolls) {
          setTimeout(poll, pollInterval)
        } else {
          // Timeout - assume failed
          this.status = 'error'
          this.error = 'Sync timed out'
          this.notifySubscribers()
        }
      } catch (error) {
        console.error('Error polling sync status:', error)
        this.status = 'error'
        this.error = error instanceof Error ? error.message : 'Failed to poll sync status'
        this.notifySubscribers()
      }
    }

    // Start polling
    poll()
  }

  /**
   * Notify all subscribers of state changes
   */
  private notifySubscribers() {
    const data = {
      emailData: this.emailData,
      status: this.status,
      lastUpdated: this.lastUpdated,
      error: this.error,
      syncProgress: this.syncProgress,
      isEnhancedSync: this.isEnhancedSync
    }

    this.subscribers.forEach(callback => {
      try {
        callback(data)
      } catch (error) {
        console.error('Error in sync subscriber callback:', error)
      }
    })
  }
}

// Create singleton instance
export const backgroundSyncService = new BackgroundSyncService()