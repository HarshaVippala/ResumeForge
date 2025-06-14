'use client'

import { ThreadSummary } from './ThreadSummary'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, RefreshCw } from 'lucide-react'

interface ThreadListProps {
  threads: any[]
  isLoading: boolean
  onThreadToggle: (threadId: string) => void
  onEmailClick?: (email: any) => void
  isThreadExpanded: (threadId: string) => boolean
  getThreadEmails: (threadId: string) => any[]
  isThreadLoading: (threadId: string) => boolean
  onRefresh?: () => void
}

export function ThreadList({ 
  threads, 
  isLoading, 
  onThreadToggle, 
  onEmailClick,
  isThreadExpanded,
  getThreadEmails,
  isThreadLoading,
  onRefresh
}: ThreadListProps) {
  
  if (isLoading && threads.length === 0) {
    return (
      <div className="space-y-3">
        {/* Skeleton loading states */}
        {[...Array(5)].map((_, i) => (
          <div key={i} className="p-4 border border-border rounded-xl">
            <div className="animate-pulse">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-5 h-5 bg-muted rounded"></div>
                  <div className="w-4 h-4 bg-muted rounded-full"></div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-4 bg-muted rounded w-32"></div>
                      <div className="h-3 bg-muted rounded w-24"></div>
                    </div>
                    <div className="h-3 bg-muted rounded w-full mb-1"></div>
                    <div className="flex items-center gap-4">
                      <div className="h-3 bg-muted rounded w-16"></div>
                      <div className="h-3 bg-muted rounded w-20"></div>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="h-3 bg-muted rounded w-12"></div>
                  <div className="h-5 bg-muted rounded w-16"></div>
                </div>
              </div>
            </div>
          </div>
        ))}
        <div className="text-center py-4">
          <RefreshCw className="h-6 w-6 text-muted-foreground mx-auto mb-2 animate-spin" />
          <p className="text-sm text-muted-foreground">Loading email threads...</p>
        </div>
      </div>
    )
  }

  if (threads.length === 0) {
    return (
      <div className="text-center py-12">
        <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">No Email Threads</h3>
        <p className="text-muted-foreground mb-4">
          No email conversations found. Try refreshing or check your email sync settings.
        </p>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <AnimatePresence mode="popLayout">
        {threads.map((thread, index) => (
          <motion.div
            key={thread.thread_id}
            layout
            initial={{ opacity: 0, y: -20 }}
            animate={{ 
              opacity: 1, 
              y: 0,
              transition: { 
                duration: 0.3, 
                delay: index * 0.05 
              }
            }}
            exit={{ 
              opacity: 0, 
              y: 20,
              transition: { duration: 0.2 }
            }}
          >
            <ThreadSummary
              thread={thread}
              isExpanded={isThreadExpanded(thread.thread_id)}
              isLoading={isThreadLoading(thread.thread_id)}
              emails={getThreadEmails(thread.thread_id)}
              onToggle={onThreadToggle}
              onEmailClick={onEmailClick}
            />
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Loading indicator for background sync */}
      {isLoading && threads.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-4"
        >
          <div className="inline-flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 rounded-lg text-sm">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Checking for new emails...
          </div>
        </motion.div>
      )}
    </div>
  )
}