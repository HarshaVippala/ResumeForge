/**
 * Background Email Sync Service
 * Persistent service that runs email sync in the background across navigation
 */

import { getApiUrl } from '@/config/api.config'

type EmailData = {
  email_activities: any[]
  attention_items: any[]
  quick_updates: any[]
  upcoming_events: any[]
  emails_processed?: number
}

type SyncStatus = 'idle' | 'syncing' | 'error'

type SyncSubscriber = (data: {
  emailData: EmailData | null
  status: SyncStatus
  lastUpdated: Date | null
  error?: string
}) => void

class BackgroundSyncService {
  private subscribers: Set<SyncSubscriber> = new Set()
  private emailData: EmailData | null = null
  private status: SyncStatus = 'idle'
  private lastUpdated: Date | null = null
  private error?: string
  private syncInterval: NodeJS.Timeout | null = null
  private isInitialized = false
  
  // Configuration
  private readonly SYNC_INTERVAL_MS = 60 * 60 * 1000 // 1 hour
  private readonly INITIAL_SYNC_DELAY_MS = 2000 // 2 seconds
  private lastSyncTime = 0
  private readonly MIN_SYNC_INTERVAL = 30 * 1000 // 30 seconds minimum between syncs
  private isFirstSync = true // Track if this is the first sync

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
      error: this.error
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
      error: this.error
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
   */
  async manualSync(): Promise<void> {
    if (this.status === 'syncing') {
      return // Already syncing
    }

    return this.performEmailSync(true)
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
   */
  private async performEmailSync(isManual: boolean = false) {
    // Prevent too frequent syncing (except for manual syncs)
    const now = Date.now()
    if (!isManual && (now - this.lastSyncTime) < this.MIN_SYNC_INTERVAL) {
      console.log('🚫 Sync skipped - too frequent')
      return
    }
    
    this.lastSyncTime = now
    this.status = 'syncing'
    this.error = undefined
    this.notifySubscribers()

    try {
      // Use database endpoint for fast background sync
      // On first sync, get more days for initial data
      const daysBack = this.isFirstSync ? 14 : 7
      const response = await fetch(getApiUrl(`/api/email?action=activities&days_back=${daysBack}&limit=50`), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success && result.data) {
          
          // For background sync, intelligently merge new data
          if (!isManual && this.emailData) {
            const existingIds = new Set(this.emailData.email_activities?.map((e: any) => e.id) || [])
            const allEmails = result.data.email_activities || []
            const newEmails = allEmails.filter((e: any) => !existingIds.has(e.id))
            
            if (newEmails.length > 0) {
              console.log(`🔄 Background sync: Found ${newEmails.length} new emails`)
              // Merge new emails with existing ones
              this.emailData = {
                ...result.data,
                email_activities: [...newEmails, ...(this.emailData.email_activities || [])].slice(0, 50)
              }
              // Only update lastUpdated if we actually found new data
              this.lastUpdated = new Date()
            } else {
              // No new emails found, don't update lastUpdated to avoid UI flash
              console.log('🔄 Background sync: No new emails found')
            }
          } else {
            // Manual refresh or first sync - replace all data
            this.emailData = result.data
            this.lastUpdated = new Date()
            if (isManual) {
              console.log(`🔄 Manual sync: Refreshed ${result.data.email_activities?.length || 0} emails`)
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
    } catch (error) {
      console.error('💥 Email sync failed:', error)
      this.status = 'error'
      this.error = error instanceof Error ? error.message : 'Sync failed'
    }

    this.notifySubscribers()
  }

  /**
   * Notify all subscribers of state changes
   */
  private notifySubscribers() {
    const data = {
      emailData: this.emailData,
      status: this.status,
      lastUpdated: this.lastUpdated,
      error: this.error
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