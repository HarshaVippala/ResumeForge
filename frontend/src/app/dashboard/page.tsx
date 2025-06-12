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

export default function DashboardPage() {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [expandedEvent, setExpandedEvent] = useState<number | null>(null)
  const [selectedEmail, setSelectedEmail] = useState<any | null>(null)
  const [hasInitialLoad, setHasInitialLoad] = useState(false)

  // Use background sync hook for email data
  const { 
    emailData, 
    isLoading: isLoadingEmails, 
    lastUpdated, 
    manualSync,
    emailCount,
    unreadCount 
  } = useBackgroundSync()

  // Extract email data with fallbacks
  const emailActivities = emailData?.email_activities || []
  const attentionItems = emailData?.attention_items || []
  const quickUpdates = emailData?.quick_updates || []
  const upcomingEvents = emailData?.upcoming_events || []
  const emailStats = { applicationsThisWeek: emailData?.emails_processed || 0 }

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Set initial load flag after mount to prevent loading flash
  useEffect(() => {
    const timer = setTimeout(() => setHasInitialLoad(true), 100)
    return () => clearTimeout(timer)
  }, [])

  // Manual refresh handler
  const handleManualRefresh = async () => {
    try {
      await manualSync()
    } catch (error) {
      console.error('Manual sync failed:', error)
    }
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
          <Card className="overflow-hidden shadow-xl dark:bg-elevation-2 dark:border-border/20 dark:shadow-2xl">
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
                      {isLoadingEmails ? 'Syncing...' : (
                        <>
                          {emailCount > 0 ? emailCount : '0'} emails
                          {unreadCount > 0 && (
                            <span className="text-blue-600 font-medium">
                              • {unreadCount} unread
                            </span>
                          )}
                        </>
                      )}
                      <Mail className="h-3 w-3" />
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    Last updated: {lastUpdated ? formatLastUpdated(lastUpdated) : 'Never'}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleManualRefresh}
                    disabled={isLoadingEmails}
                    className="h-6 px-2"
                  >
                    <RefreshCw className={cn("h-3 w-3", isLoadingEmails && "animate-spin")} />
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
              {isLoadingEmails && hasInitialLoad ? (
                // Enhanced skeleton loading state
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="p-4 border border-border rounded-lg">
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
                    <div key={i} className="p-4 border border-border rounded-lg opacity-50">
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
              ) : emailActivities.length > 0 ? (
                <div className="h-[calc(100vh-260px)] min-h-[500px] overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                  <AnimatePresence>
                    {emailActivities.map((email: any, index: number) => (
                    <motion.div 
                      key={email.id}
                      initial={{ opacity: 0, y: -20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 20 }}
                      transition={{ 
                        duration: 0.3, 
                        delay: index * 0.1 
                      }}
                      onClick={() => setSelectedEmail(email)}
                      className="group cursor-pointer p-4 border border-gray-100 rounded-xl hover:bg-accent/30 hover:border-accent-foreground/20 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:scale-[1.01] dark:hover:bg-elevation-2 dark:border-gray-800 dark:hover:shadow-2xl"
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
            </div>
            </div>
          </Card>
        </div>

        {/* Right Sidebar - Upcoming Events and Quick Updates */}
        <div className="space-y-6">
          {/* Compact Upcoming Events with Modern Styling */}
          <Card className="p-4 bg-gradient-to-br from-card via-card to-accent/5 border-border/50 shadow-xl hover:shadow-2xl transition-all duration-300 dark:bg-elevation-2 dark:border-border/20 dark:shadow-2xl dark:hover:bg-elevation-3">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground">Upcoming</h2>
              <Button variant="ghost" size="sm" className="h-6 text-xs" asChild>
                <Link href="/dashboard/tracker">
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </Button>
            </div>
            <div className="space-y-2">
              {upcomingEvents.length > 0 ? 
                upcomingEvents.slice(0, 3).map((event: any) => (
                  <div key={event.id} className="border border-border rounded-lg p-2 hover:bg-accent/30 transition-colors dark:border-border/30 dark:hover:bg-elevation-3">
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
          {attentionItems.length > 0 && (
            <Card className="p-4 bg-gradient-to-br from-orange-50/50 via-card to-yellow-50/50 dark:from-orange-950/20 dark:via-card dark:to-yellow-950/20 border-orange-200/50 dark:border-orange-800/50 hover:shadow-lg transition-all duration-300">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-foreground">Action Required</h2>
              </div>
              <div className="space-y-2">
                {attentionItems.slice(0, 3).map((item: any, index: number) => (
                  <div key={index} className="border border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950 rounded-lg p-2">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-orange-500 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground text-xs">{item.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
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