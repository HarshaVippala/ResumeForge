'use client'

import { useState, useEffect } from 'react'
import { threadedSyncService } from '@/services/threadedSyncService'

/**
 * Hook to access threaded email sync state and actions
 * Provides thread-based email data instead of flat email list
 */
export function useThreadedSync() {
  const [threadData, setThreadData] = useState<any>(null)
  const [status, setStatus] = useState<'idle' | 'syncing' | 'error'>('idle')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [error, setError] = useState<string | undefined>(undefined)
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set())
  const [threadEmails, setThreadEmails] = useState<Record<string, any[]>>({})

  useEffect(() => {
    // Subscribe to threaded sync service updates
    const unsubscribe = threadedSyncService.subscribe(({ threadData, status, lastUpdated, error }) => {
      setThreadData(threadData)
      setStatus(status)
      setLastUpdated(lastUpdated)
      setError(error)
    })

    return unsubscribe
  }, [])

  // Manual sync function
  const manualSync = async () => {
    return threadedSyncService.manualSync()
  }

  // Get current data without subscribing to updates
  const getCurrentData = () => {
    return threadedSyncService.getCurrentData()
  }

  // Toggle thread expansion
  const toggleThread = async (threadId: string) => {
    const newExpandedThreads = new Set(expandedThreads)
    
    if (expandedThreads.has(threadId)) {
      // Collapse thread
      newExpandedThreads.delete(threadId)
      setExpandedThreads(newExpandedThreads)
    } else {
      // Expand thread - fetch emails if not already loaded
      newExpandedThreads.add(threadId)
      setExpandedThreads(newExpandedThreads)
      
      if (!threadEmails[threadId]) {
        try {
          const emails = await threadedSyncService.getThreadEmails(threadId)
          setThreadEmails(prev => ({
            ...prev,
            [threadId]: emails
          }))
        } catch (error) {
          console.error(`Failed to load emails for thread ${threadId}:`, error)
          // Remove from expanded set if loading failed
          newExpandedThreads.delete(threadId)
          setExpandedThreads(newExpandedThreads)
        }
      }
    }
  }

  // Check if thread is expanded
  const isThreadExpanded = (threadId: string) => {
    return expandedThreads.has(threadId)
  }

  // Get emails for a specific thread
  const getThreadEmails = (threadId: string) => {
    return threadEmails[threadId] || []
  }

  // Get loading state for a specific thread
  const isThreadLoading = (threadId: string) => {
    return expandedThreads.has(threadId) && !threadEmails[threadId]
  }

  return {
    // State
    threadData,
    status,
    lastUpdated,
    error,
    isLoading: status === 'syncing',
    hasError: status === 'error',
    
    // Actions
    manualSync,
    getCurrentData,
    toggleThread,
    
    // Thread-specific actions
    isThreadExpanded,
    getThreadEmails,
    isThreadLoading,
    
    // Computed values
    threadCount: threadData?.email_threads?.length || 0,
    totalEmailCount: threadData?.summary_stats?.total_emails || 0,
    unreadCount: threadData?.summary_stats?.total_unread || 0,
    attentionItemsCount: threadData?.attention_items?.length || 0,
    upcomingEventsCount: threadData?.upcoming_events?.length || 0,
    
    // Direct access to threaded data
    emailThreads: threadData?.email_threads || [],
    attentionItems: threadData?.attention_items || [],
    upcomingEvents: threadData?.upcoming_events || [],
    quickUpdates: threadData?.quick_updates || [],
    summaryStats: threadData?.summary_stats || {},
  }
}