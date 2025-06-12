'use client'

import { useState, useEffect } from 'react'
import { backgroundSyncService } from '@/services/backgroundSyncService'

/**
 * Hook to access background sync state and actions
 * Can be used in any component to get sync status and data
 */
export function useBackgroundSync() {
  const [emailData, setEmailData] = useState<any>(null)
  const [status, setStatus] = useState<'idle' | 'syncing' | 'error'>('idle')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [error, setError] = useState<string | undefined>(undefined)

  useEffect(() => {
    // Subscribe to sync service updates
    const unsubscribe = backgroundSyncService.subscribe(({ emailData, status, lastUpdated, error }) => {
      setEmailData(emailData)
      setStatus(status)
      setLastUpdated(lastUpdated)
      setError(error)
    })

    return unsubscribe
  }, [])

  // Manual sync function
  const manualSync = async () => {
    return backgroundSyncService.manualSync()
  }

  // Get current data without subscribing to updates
  const getCurrentData = () => {
    return backgroundSyncService.getCurrentData()
  }

  return {
    // State
    emailData,
    status,
    lastUpdated,
    error,
    isLoading: status === 'syncing',
    hasError: status === 'error',
    
    // Actions
    manualSync,
    getCurrentData,
    
    // Computed values
    emailCount: emailData?.email_activities?.length || 0,
    unreadCount: emailData?.email_activities?.filter((email: any) => email.status === 'unread').length || 0,
    attentionItemsCount: emailData?.attention_items?.length || 0,
  }
}