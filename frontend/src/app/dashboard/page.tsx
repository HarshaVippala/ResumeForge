'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Calendar,
  Mail,
  Clock,
  Target,
  CheckCircle,
  AlertCircle,
  Users,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Video,
  Phone,
  ExternalLink,
  Brain,
  Zap,
  TrendingUp,
  X,
  RefreshCw
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { EmailDetailsModal } from '@/components/dashboard/EmailDetailsModal'
import { useBackgroundSync } from '@/hooks/useBackgroundSync'
import { useThreadedSync } from '@/hooks/useThreadedSync'
import { ThreadList } from '@/components/dashboard/ThreadList'

export default function DashboardPage() {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [expandedEvent, setExpandedEvent] = useState<number | null>(null)
  const [selectedEmail, setSelectedEmail] = useState<any | null>(null)
  const [hasInitialLoad, setHasInitialLoad] = useState(false)
  const [useThreadedView, setUseThreadedView] = useState(true) // Default to threaded view

  // Use background sync hook for email data (legacy/fallback)
  const { 
    emailData, 
    isLoading: isLoadingEmails, 
    lastUpdated, 
    manualSync,
    emailCount,
    unreadCount 
  } = useBackgroundSync()

  // Use threaded sync hook for threaded email data
  const {
    threadData,
    isLoading: isLoadingThreads,
    lastUpdated: lastThreadUpdate,
    manualSync: manualThreadSync,
    toggleThread,
    isThreadExpanded,
    getThreadEmails,
    isThreadLoading,
    threadCount,
    totalEmailCount,
    unreadCount: threadUnreadCount,
    emailThreads,
    attentionItems: threadAttentionItems,
    upcomingEvents: threadUpcomingEvents,
    summaryStats
  } = useThreadedSync()

  // Extract data based on view mode
  const currentData = useThreadedView 
    ? {
        activities: emailThreads,
        attentionItems: threadAttentionItems,
        upcomingEvents: threadUpcomingEvents,
        quickUpdates: threadData?.quick_updates || [],
        isLoading: isLoadingThreads,
        lastUpdated: lastThreadUpdate,
        emailCount: totalEmailCount,
        unreadCount: threadUnreadCount,
        manualSync: manualThreadSync
      }
    : {
        activities: emailData?.email_activities || [],
        attentionItems: emailData?.attention_items || [],
        upcomingEvents: emailData?.upcoming_events || [],
        quickUpdates: emailData?.quick_updates || [],
        isLoading: isLoadingEmails,
        lastUpdated: lastUpdated,
        emailCount: emailCount,
        unreadCount: unreadCount,
        manualSync: manualSync
      }

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Set initial load flag after mount to prevent loading flash
  useEffect(() => {
    const timer = setTimeout(() => setHasInitialLoad(true), 50) // Reduced from 100ms to 50ms
    return () => clearTimeout(timer)
  }, [])

  // Initialize threaded sync service on mount
  useEffect(() => {
    const { threadedSyncService } = require('@/services/threadedSyncService')
    threadedSyncService.initialize()
    
    return () => {
      // Cleanup on unmount
      threadedSyncService.destroy()
    }
  }, [])

  // Manual refresh handler
  const handleManualRefresh = async () => {
    try {
      await currentData.manualSync()
    } catch (error) {
      console.error('Manual sync failed:', error)
    }
  }

  // Thread view toggle handler
  const handleViewToggle = () => {
    setUseThreadedView(!useThreadedView)
  }

  const formatEmailTime = (timestamp: string) => {
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
      case 'interview': return 'bg-info text-info-foreground'
      case 'offer': return 'bg-success text-success-foreground'
      case 'recruiter': return 'bg-primary text-primary-foreground'
      case 'rejection': return 'bg-destructive text-destructive-foreground'
      case 'follow_up': return 'bg-warning text-warning-foreground'
      default: return 'bg-secondary text-secondary-foreground'
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
      case 'rejection': return <AlertCircle className="h-4 w-4 text-destructive" />
      case 'interview': return <CheckCircle className="h-4 w-4 text-info" />
      case 'recruiter': return <Users className="h-4 w-4 text-primary" />
      case 'offer': return <CheckCircle className="h-4 w-4 text-success" />
      case 'follow_up': return <Clock className="h-4 w-4 text-warning" />
      default: return <Mail className="h-4 w-4 text-muted-foreground" />
    }
  }

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'teams': return <Video className="h-4 w-4 text-blue-600" />
      case 'googlemeet': return <Video className="h-4 w-4 text-green-600" />
      case 'zoom': return <Video className="h-4 w-4 text-blue-500" />
      case 'webex': return <Video className="h-4 w-4 text-orange-500" />
      case 'chime': return <Video className="h-4 w-4 text-purple-500" />
      case 'phone': return <Phone className="h-4 w-4 text-gray-600" />
      default: return <Calendar className="h-4 w-4 text-gray-500" />
    }
  }

  const handleEventToggle = (eventId: number) => {
    setExpandedEvent(expandedEvent === eventId ? null : eventId)
  }

  const formatLastUpdated = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMinutes = Math.floor(diffMs / 60000)
    
    if (diffMinutes < 1) return 'Just now'
    if (diffMinutes < 60) return `${diffMinutes} min ago`
    
    const diffHours = Math.floor(diffMinutes / 60)
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    
    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  }

  const getSummaryLine = (email: any) => {
    if (email.summary) {
      return email.summary
    }
    
    const details = email.extracted_details
    
    if (email.type === 'interview') {
      if (details?.interview_date) {
        const timeText = details.interview_time ? ' at ' + details.interview_time : ''
        return `Interview scheduled for ${details.interview_date}${timeText}`
      }
      return details?.action_required || 'Interview invitation - response required'
    } else if (email.type === 'recruiter') {
      if (details?.salary_range) {
        const locationText = details.location ? ' in ' + details.location : ''
        return `New opportunity - ${details.salary_range}${locationText}`
      }
      return details?.action_required || 'New job opportunity'
    } else if (email.type === 'rejection') {
      return 'Application status update'
    } else if (email.type === 'follow_up') {
      return details?.action_required || 'Follow-up needed'
    }
    
    return email.subject
  }

  return (
    <div className="space-y-6 p-6 relative">
      {/* Compact Welcome Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Welcome back, Harsha!</h1>
          <p className="text-muted-foreground mt-1">
            {currentTime.toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
        </div>
      </div>


      {/* Main Content Area - Two Column Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Email Activity Center - Takes 3/4 width on large screens */}
        <div className="xl:col-span-3">
          <Card className="overflow-hidden shadow-lg border-border/50 bg-card/95 dark:bg-elevation-2 dark:border-border/30 dark:shadow-2xl">
            {/* Sticky Header with Enhanced Glass Effect */}
            <div className="sticky top-0 z-10 bg-card/95 dark:bg-elevation-3/95 backdrop-blur-md border-b border-border/50 dark:border-border/20 p-6 pb-4 transition-all duration-300">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Mail className="h-5 w-5 text-blue-500" />
                    <h2 className="text-xl font-semibold text-foreground bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Email Activity Center</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs flex items-center gap-1">
                      {currentData.isLoading ? 'Syncing...' : (
                        <>
                          {useThreadedView ? (
                            <>
                              {threadCount > 0 ? threadCount : '0'} threads
                              <span className="text-gray-400">•</span>
                              {currentData.emailCount > 0 ? currentData.emailCount : '0'} emails
                            </>
                          ) : (
                            <>{currentData.emailCount > 0 ? currentData.emailCount : '0'} emails</>
                          )}
                          {currentData.unreadCount > 0 && (
                            <span className="text-blue-600 font-medium">
                              • {currentData.unreadCount} unread
                            </span>
                          )}
                        </>
                      )}
                      <Mail className="h-3 w-3" />
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* View Toggle Button */}
                  <Button
                    variant={useThreadedView ? "default" : "outline"}
                    size="sm"
                    onClick={handleViewToggle}
                    className="h-6 px-3 text-xs"
                  >
                    {useThreadedView ? '🧵 Threads' : '📧 List'}
                  </Button>
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    Last updated: {currentData.lastUpdated ? formatLastUpdated(currentData.lastUpdated) : 'Never'}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleManualRefresh}
                    disabled={currentData.isLoading}
                    className="h-6 px-2"
                  >
                    <RefreshCw className={cn("h-3 w-3", currentData.isLoading && "animate-spin")} />
                  </Button>
                  <Badge variant="secondary" className="text-xs">
                    Auto-refresh: {process.env.NEXT_PUBLIC_EMAIL_SYNC_INTERVAL || '1h'}
                  </Badge>
                </div>
              </div>
            </div>
            
            {/* Email List with Scrolling */}
            <div className="px-6 pb-6">
            <div className="space-y-4">
              {/* Conditional rendering based on view mode */}
              {useThreadedView ? (
                /* Threaded View */
                <div className="h-[calc(100vh-260px)] min-h-[500px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                  <ThreadList
                    threads={currentData.activities}
                    isLoading={currentData.isLoading}
                    onThreadToggle={toggleThread}
                    onEmailClick={setSelectedEmail}
                    isThreadExpanded={isThreadExpanded}
                    getThreadEmails={getThreadEmails}
                    isThreadLoading={isThreadLoading}
                    onRefresh={handleManualRefresh}
                  />
                </div>
              ) : (
                /* Flat Email List View (Legacy) */
                <>
                  {currentData.isLoading && hasInitialLoad ? (
                    // Enhanced skeleton loading state
                    <div className="space-y-3">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="p-4 border border-border/30 rounded-xl bg-muted/30">
                          <div className="animate-pulse">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3 flex-1">
                                <div className="w-4 h-4 bg-muted rounded-full"></div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <div className="h-4 bg-muted rounded w-24"></div>
                                    <div className="h-3 bg-muted rounded w-32"></div>
                                  </div>
                                  <div className="h-3 bg-muted rounded w-full mb-1"></div>
                                  <div className="h-3 bg-muted rounded w-2/3"></div>
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
                        <p className="text-sm text-muted-foreground">Syncing emails...</p>
                      </div>
                    </div>
                  ) : !hasInitialLoad ? (
                    // Initial load state - show minimal skeleton to prevent flash
                    <div className="space-y-3">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="p-4 border border-border/30 rounded-xl bg-muted/30 opacity-50">
                          <div className="animate-pulse">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3 flex-1">
                                <div className="w-4 h-4 bg-muted rounded-full"></div>
                                <div className="flex-1">
                                  <div className="h-4 bg-muted rounded w-32 mb-2"></div>
                                  <div className="h-3 bg-muted rounded w-full mb-1"></div>
                                </div>
                              </div>
                              <div className="h-5 bg-muted rounded w-16"></div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : currentData.activities.length > 0 ? (
                    <div className="h-[calc(100vh-260px)] min-h-[500px] overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                      <AnimatePresence>
                        {currentData.activities.map((email: any, index: number) => (
                        <motion.div 
                          key={email.id || email.thread_id || `activity-${index}`}
                          initial={{ opacity: 0, y: -20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 20 }}
                          transition={{ 
                            duration: 0.3, 
                            delay: index * 0.1 
                          }}
                          onClick={() => setSelectedEmail(email)}
                          className="group cursor-pointer p-4 elevated-card hover:bg-accent/30 hover:shadow-primary/10 transition-all duration-300"
                        >
                          {/* Redesigned compact card layout */}
                          <div className="flex items-center justify-between w-full">
                            {/* Left side - Main info */}
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="flex-shrink-0">
                                {getEmailIcon(email.type)}
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                {/* Company and Position */}
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="font-semibold text-foreground truncate">
                                    {email.company || (email.sender && email.sender.includes('@') 
                                      ? email.sender.split('@')[0].replace(/[._-]/g, ' ').split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
                                      : 'Unknown Company')}
                                  </h3>
                                  {email.extracted_details?.position && (
                                    <span className="text-sm text-muted-foreground truncate">
                                      • {email.extracted_details.position}
                                    </span>
                                  )}
                                </div>
                                
                                {/* Summary */}
                                <p className="text-sm text-muted-foreground line-clamp-1 mb-1">
                                  {email.summary || getSummaryLine(email)}
                                </p>
                                
                                {/* Sender email or recruiter info */}
                                <p className="text-xs text-muted-foreground/80">
                                  {email.extracted_details?.recruiter_name 
                                    ? `From: ${email.extracted_details.recruiter_name}${email.sender ? ` <${email.sender}>` : ''}`
                                    : email.sender || 'No sender information'}
                                </p>
                              </div>
                            </div>
                            
                            {/* Right side - Metadata */}
                            <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-4">
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {formatEmailTime(email.timestamp)}
                              </span>
                              
                              <div className="flex items-center gap-1">
                                <Badge 
                                  variant="secondary"
                                  className={cn("text-xs px-2 py-0", getEmailTypeColor(email.type))}
                                >
                                  {getEmailTypeLabel(email.type)}
                                </Badge>
                                
                                {email.status === 'unread' && (
                                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                )}
                                
                                {email.extracted_details?.urgency === 'high' && (
                                  <Badge variant="destructive" className="text-xs px-1 py-0">
                                    !
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No recent emails</p>
                      <p className="text-sm text-muted-foreground mt-1">Click refresh to sync your emails</p>
                    </div>
                  )}
                </>
              )}
            </div>
            </div>
          </Card>
        </div>

        {/* Right Sidebar - Upcoming Events and Quick Updates */}
        <div className="space-y-6">
          {/* Compact Upcoming Events with Modern Styling */}
          <Card className="p-4 bg-gradient-to-br from-card via-card to-accent/5 border-border/40 shadow-lg hover:shadow-xl transition-all duration-300 dark:bg-elevation-2 dark:border-border/30 dark:shadow-2xl dark:hover:bg-elevation-3">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground">Upcoming</h2>
              <Button variant="ghost" size="sm" className="h-6 text-xs" asChild>
                <Link href="/dashboard/tracker">
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </Button>
            </div>
            <div className="space-y-2">
              {currentData.upcomingEvents.length > 0 ? 
                currentData.upcomingEvents.slice(0, 3).map((event: any, index: number) => (
                  <div key={event.id || `event-${index}`} className="border border-border/40 rounded-lg p-2 hover:bg-accent/30 transition-colors dark:border-border/25 dark:hover:bg-elevation-3">
                    <div className="flex items-center gap-2">
                      {getPlatformIcon(event.platform)}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground text-xs truncate">{event.company}</p>
                        <p className="text-xs text-muted-foreground">{event.date}</p>
                      </div>
                      {event.link && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => window.open(event.link, '_blank')}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                )) : (
                <>
                  <div className="border border-dashed border-muted-foreground/30 rounded-lg p-2 opacity-50">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground font-medium">Today</p>
                        <p className="text-xs text-muted-foreground/70">No events</p>
                      </div>
                    </div>
                  </div>
                  <div className="border border-dashed border-muted-foreground/30 rounded-lg p-2 opacity-50">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground font-medium">Tomorrow</p>
                        <p className="text-xs text-muted-foreground/70">No events</p>
                      </div>
                    </div>
                  </div>
                  <div className="border border-dashed border-muted-foreground/30 rounded-lg p-2 opacity-50">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground font-medium">This Week</p>
                        <p className="text-xs text-muted-foreground/70">No events</p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </Card>

          {/* Actionable Quick Updates */}
          {currentData.attentionItems.length > 0 && (
            <Card className="p-4 bg-warning/10 border-warning/30 hover:shadow-lg transition-all duration-300">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-foreground">Action Required</h2>
              </div>
              <div className="space-y-2">
                {currentData.attentionItems.slice(0, 3).map((item: any, index: number) => (
                  <div key={item.id || `attention-${index}`} className="border border-warning/40 bg-warning/20 rounded-lg p-2">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-warning-foreground text-xs">{item.title}</p>
                        <p className="text-xs text-warning-foreground/80 line-clamp-2">{item.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Email Details Modal */}
      {selectedEmail && (
        <EmailDetailsModal 
          email={selectedEmail} 
          onClose={() => setSelectedEmail(null)}
        />
      )}

    </div>
  )
}