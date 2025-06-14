'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  ChevronDown, ChevronRight, Mail, Calendar, MapPin, Briefcase, 
  Clock, Users, AlertCircle, CheckCircle, Video, Phone
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'

interface ThreadSummaryProps {
  thread: any
  isExpanded: boolean
  isLoading: boolean
  emails: any[]
  onToggle: (threadId: string) => void
  onEmailClick?: (email: any) => void
}

export function ThreadSummary({ 
  thread, 
  isExpanded, 
  isLoading, 
  emails, 
  onToggle, 
  onEmailClick 
}: ThreadSummaryProps) {
  
  const formatTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp)
      const now = new Date()
      const diffMs = now.getTime() - date.getTime()
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
      const diffDays = Math.floor(diffHours / 24)

      if (diffHours < 1) return 'Just now'
      if (diffHours < 24) return `${diffHours}h ago`
      if (diffDays < 7) return `${diffDays}d ago`
      return date.toLocaleDateString()
    } catch {
      return 'Unknown'
    }
  }

  const getEmailTypeColor = (type: string) => {
    switch (type) {
      case 'interview': return 'bg-blue-500 text-white'
      case 'offer': return 'bg-green-500 text-white'
      case 'recruiter': return 'bg-purple-500 text-white'
      case 'rejection': return 'bg-red-500 text-white'
      case 'follow_up': return 'bg-yellow-500 text-white'
      default: return 'bg-gray-500 text-white'
    }
  }

  const getEmailTypeLabel = (type: string) => {
    switch (type) {
      case 'interview': return 'Interview'
      case 'offer': return 'Job Offer'
      case 'recruiter': return 'Recruiter Outreach'
      case 'rejection': return 'Rejection'
      case 'follow_up': return 'Follow-up'
      default: return 'Other'
    }
  }

  const getEmailIcon = (type: string) => {
    switch (type) {
      case 'rejection': return <AlertCircle className="h-4 w-4 text-red-500" />
      case 'interview': return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'recruiter': return <Users className="h-4 w-4 text-blue-500" />
      default: return <Mail className="h-4 w-4 text-gray-500" />
    }
  }

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'high': return 'text-red-500'
      case 'normal': return 'text-blue-500'
      default: return 'text-gray-500'
    }
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className={cn(
        "border rounded-xl transition-all duration-300 hover:shadow-lg",
        "dark:border-gray-800 dark:hover:shadow-2xl",
        isExpanded ? "border-blue-200 dark:border-blue-800 shadow-md" : "border-gray-200 hover:border-gray-300"
      )}
    >
      {/* Thread Summary Header */}
      <div 
        className={cn(
          "p-4 cursor-pointer transition-all duration-200",
          "hover:bg-accent/30 dark:hover:bg-elevation-2",
          isExpanded ? "bg-blue-50/50 dark:bg-blue-950/20" : ""
        )}
        onClick={() => onToggle(thread.thread_id)}
      >
        <div className="flex items-center justify-between">
          {/* Left side - Thread info */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Expand/Collapse Icon */}
            <div className="flex-shrink-0">
              {isExpanded ? (
                <ChevronDown className="h-5 w-5 text-blue-500" />
              ) : (
                <ChevronRight className="h-5 w-5 text-gray-400" />
              )}
            </div>

            {/* Email Type Icon */}
            <div className="flex-shrink-0">
              {getEmailIcon(thread.email_type)}
            </div>
            
            {/* Thread Details */}
            <div className="flex-1 min-w-0">
              {/* Company and Position */}
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-foreground truncate">
                  {thread.company || 'Unknown Company'}
                </h3>
                {thread.position && (
                  <span className="text-sm text-muted-foreground truncate">
                    • {thread.position}
                  </span>
                )}
              </div>
              
              {/* Subject/Summary */}
              <p className="text-sm text-muted-foreground line-clamp-1 mb-1">
                {thread.subject}
              </p>
              
              {/* Thread metadata */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {thread.email_count > 1 && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    {thread.email_count} emails
                  </span>
                )}
                {thread.participants && (
                  <span className="flex items-center gap-1 truncate max-w-48">
                    <Users className="h-3 w-3" />
                    {thread.participants}
                  </span>
                )}
                {thread.thread_duration_days > 0 && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {thread.thread_duration_days}d span
                  </span>
                )}
              </div>
            </div>
          </div>
          
          {/* Right side - Status and badges */}
          <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-4">
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {formatTime(thread.latest_email_date)}
            </span>
            
            <div className="flex items-center gap-1">
              <Badge 
                variant="secondary"
                className={cn("text-xs px-2 py-0", getEmailTypeColor(thread.email_type))}
              >
                {getEmailTypeLabel(thread.email_type)}
              </Badge>
              
              {thread.has_unread && (
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              )}
              
              {thread.urgency === 'high' && (
                <Badge variant="destructive" className="text-xs px-1 py-0">
                  !
                </Badge>
              )}
              
              {thread.unread_count > 0 && (
                <Badge variant="outline" className="text-xs">
                  {thread.unread_count} new
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Thread Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
              {/* Loading State */}
              {isLoading && (
                <div className="p-6 text-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto mb-2"></div>
                  <p className="text-sm text-muted-foreground dark:text-gray-400">Loading emails...</p>
                </div>
              )}

              {/* Thread Emails */}
              {!isLoading && emails.length > 0 && (
                <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
                  {emails.map((email, index) => (
                    <motion.div
                      key={email.id || email.email_id || `email-${index}`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className={cn(
                        "p-3 rounded-lg border cursor-pointer transition-all duration-200",
                        "hover:shadow-md hover:bg-white dark:hover:bg-gray-800",
                        email.is_unread 
                          ? "bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800" 
                          : "bg-white border-gray-200 dark:bg-gray-900 dark:border-gray-700"
                      )}
                      onClick={() => onEmailClick?.(email)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          {/* Email sender and date */}
                          <div className="flex items-center justify-between mb-2">
                            <span className={cn(
                              "text-sm font-medium",
                              email.is_unread 
                                ? "text-blue-900 dark:text-blue-100" 
                                : "text-gray-900 dark:text-gray-100"
                            )}>
                              {email.sender || 'Unknown Sender'}
                            </span>
                            <span className="text-xs text-muted-foreground dark:text-gray-400">
                              {formatTime(email.email_date)}
                            </span>
                          </div>
                          
                          {/* Email snippet/summary */}
                          <p className="text-sm text-muted-foreground dark:text-gray-300 line-clamp-2">
                            {email.actionable_summary || email.summary || email.snippet || 'No preview available'}
                          </p>
                          
                          {/* Email metadata */}
                          {(email.extracted_details?.interview_date || email.extracted_details?.interview_time) && (
                            <div className="mt-2 flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                              <Video className="h-3 w-3" />
                              {email.extracted_details.interview_date} {email.extracted_details.interview_time}
                            </div>
                          )}
                        </div>
                        
                        {/* Email type indicator */}
                        <div className="flex-shrink-0">
                          {getEmailIcon(email.email_type)}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Empty state */}
              {!isLoading && emails.length === 0 && (
                <div className="p-6 text-center">
                  <Mail className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground dark:text-gray-400">No emails found in this thread</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}