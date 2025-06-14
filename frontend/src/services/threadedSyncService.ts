/**
 * Threaded Email Sync Service
 * Service for fetching and managing email thread data
 */

import { getApiUrl } from '@/config/api.config'

type ThreadedEmailData = {
  email_threads: any[]
  attention_items: any[]
  quick_updates: any[]
  upcoming_events: any[]
  summary_stats: {
    total_threads: number
    total_emails: number
    total_unread: number
    by_type: Record<string, number>
    by_urgency: Record<string, number>
    by_company: Record<string, number>
    avg_emails_per_thread: number
    high_priority_count: number
  }
}

type SyncStatus = 'idle' | 'syncing' | 'error'

type ThreadSyncSubscriber = (data: {
  threadData: ThreadedEmailData | null
  status: SyncStatus
  lastUpdated: Date | null
  error?: string
}) => void

class ThreadedSyncService {
  private subscribers: Set<ThreadSyncSubscriber> = new Set()
  private threadData: ThreadedEmailData | null = null
  private status: SyncStatus = 'idle'
  private lastUpdated: Date | null = null
  private error?: string
  private syncInterval: NodeJS.Timeout | null = null
  private isInitialized = false
  
  // Configuration
  private readonly SYNC_INTERVAL_MS = 60 * 60 * 1000 // 1 hour
  private lastSyncTime = 0
  private readonly MIN_SYNC_INTERVAL = 30 * 1000 // 30 seconds minimum between syncs
  private isFirstSync = true

  /**
   * Initialize the threaded sync service
   */
  initialize() {
    if (this.isInitialized) {
      return
    }

    console.log('🧵 Initializing Threaded Sync Service')
    this.isInitialized = true

    // Set status to syncing immediately to show loading state
    this.status = 'syncing'
    this.notifySubscribers()

    // Perform initial sync immediately to prevent UI flicker
    // Note: Call performEmailSync directly to bypass the guard in performBackgroundSync
    this.performEmailSync(false)

    // Set up periodic background sync
    this.syncInterval = setInterval(() => {
      this.performBackgroundSync()
    }, this.SYNC_INTERVAL_MS)

    // Handle app visibility changes
    if (typeof document !== 'undefined') {
      let lastVisibilitySync = 0
      const VISIBILITY_SYNC_THROTTLE = 5 * 60 * 1000 // 5 minutes
      
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && this.status === 'idle') {
          const now = Date.now()
          if (now - lastVisibilitySync > VISIBILITY_SYNC_THROTTLE) {
            lastVisibilitySync = now
            console.log('🧵 Visibility change sync (throttled)')
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
    console.log('🛑 Threaded Sync Service destroyed')
  }

  /**
   * Subscribe to sync updates
   */
  subscribe(callback: ThreadSyncSubscriber) {
    this.subscribers.add(callback)
    
    // Immediately send current state to new subscriber
    callback({
      threadData: this.threadData,
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
      threadData: this.threadData,
      status: this.status,
      lastUpdated: this.lastUpdated,
      error: this.error
    }
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
   * Get emails in a specific thread
   */
  async getThreadEmails(threadId: string): Promise<any[]> {
    try {
      const response = await fetch(getApiUrl(`/api/emails/threads/${threadId}/emails`), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success && result.data) {
          return result.data
        }
      }
      
      throw new Error(`Failed to fetch thread emails: ${response.status}`)
    } catch (error) {
      console.error('💥 Thread emails fetch failed:', error)
      throw error
    }
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
   * Core threaded email sync logic
   */
  private async performEmailSync(isManual: boolean = false) {
    // Prevent too frequent syncing (except for manual syncs)
    const now = Date.now()
    if (!isManual && (now - this.lastSyncTime) < this.MIN_SYNC_INTERVAL) {
      console.log('🚫 Thread sync skipped - too frequent')
      return
    }
    
    this.lastSyncTime = now
    this.status = 'syncing'
    this.error = undefined
    this.notifySubscribers()

    try {
      // Step 1: If manual sync, trigger refresh to get fresh Gmail data
      if (isManual) {
        console.log('🧵 Manual sync: Triggering Gmail refresh first...')
        const refreshResponse = await fetch(getApiUrl(`/api/emails/refresh`), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ is_auto_refresh: false })
        })
        
        if (!refreshResponse.ok) {
          console.warn('🟨 Gmail refresh failed, proceeding with cached data')
        }
      }
      
      // Step 2: Get threaded dashboard data
      const response = await fetch(getApiUrl(`/api/emails/threads?days_back=30&limit=100`), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success && result.data) {
          // Store the threaded dashboard data
          this.threadData = result.data
          this.lastUpdated = new Date()
          
          if (isManual) {
            console.log(`🧵 Manual sync successful: ${this.threadData?.email_threads?.length || 0} threads loaded`)
          } else {
            console.log(`🧵 Background sync successful: ${this.threadData?.email_threads?.length || 0} threads loaded`)
          }
          
          this.status = 'idle'
          this.isFirstSync = false
        } else {
          throw new Error(result.error || 'Invalid response format from threads endpoint')
        }
      } else {
        // Try to parse error from response body
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `API error: ${response.status}`)
      }
    } catch (error) {
      console.error('💥 Threaded email sync failed:', error)
      this.status = 'error'
      this.error = error instanceof Error ? error.message : 'Thread sync failed'
    }

    this.notifySubscribers()
  }

  /**
   * Notify all subscribers of state changes
   */
  private notifySubscribers() {
    const data = {
      threadData: this.threadData,
      status: this.status,
      lastUpdated: this.lastUpdated,
      error: this.error
    }

    this.subscribers.forEach(callback => {
      try {
        callback(data)
      } catch (error) {
        console.error('Error in threaded sync subscriber callback:', error)
      }
    })
  }
}

// Create singleton instance
export const threadedSyncService = new ThreadedSyncService()