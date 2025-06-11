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

export default function DashboardPage() {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [expandedEvent, setExpandedEvent] = useState<number | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [selectedEmail, setSelectedEmail] = useState<any | null>(null)

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Settings for background refresh
  const [refreshFrequency, setRefreshFrequency] = useState(10) // minutes
  const [isBackgroundRefresh, setIsBackgroundRefresh] = useState(false)
  
  // Fetch real email data on component mount and periodically
  useEffect(() => {
    // Load initial data
    loadEmailData()
    
    // Set up background refresh
    const emailInterval = setInterval(() => {
      setIsBackgroundRefresh(true)
      loadEmailData()
    }, refreshFrequency * 60 * 1000)
    
    return () => clearInterval(emailInterval)
  }, [refreshFrequency])

  const loadEmailData = async () => {
    // Only show loading spinner for manual refresh, not background refresh
    if (!isBackgroundRefresh) {
      setIsLoadingEmails(true)
    }
    try {
      const response = await fetch('http://localhost:5001/api/emails/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setEmailActivities(result.data.email_activities || [])
          setAttentionItems(result.data.attention_items || [])
          setQuickUpdates(result.data.quick_updates || [])
          setRecentEmails(result.data.recent_emails || [])
          setUpcomingEvents(result.data.upcoming_events || [])
          
          // Update stats based on real data
          setEmailStats({
            applicationsThisWeek: result.data.emails_processed || 0
          })
          
          
          // Update last updated time
          setLastUpdated(new Date())
        }
      }
    } catch (error) {
      console.error('Error loading email data:', error)
      // Use mock data as fallback
      const mockData = {
        email_activities: [
          {
            id: '1',
            company: 'TechCorp',
            subject: 'Re: Software Engineer Position',
            timestamp: new Date().toISOString(),
            type: 'interview',
            status: 'unread'
          },
          {
            id: '2',
            company: 'StartupXYZ',
            subject: 'Thank you for your application',
            timestamp: new Date(Date.now() - 86400000).toISOString(),
            type: 'rejection',
            status: 'read'
          }
        ],
        attention_items: [
          {
            title: 'Follow-up Required',
            description: '3 applications need follow-up emails'
          }
        ],
        quick_updates: [
          {
            title: 'Interview Scheduled',
            summary: 'TechCorp interview tomorrow at 2 PM'
          }
        ],
        upcoming_events: [
          {
            id: 1,
            company: 'TechCorp',
            time: '2:00 PM',
            date: 'Tomorrow',
            platform: 'zoom',
            link: 'https://zoom.us/example',
            duration: '60 minutes',
            details: 'Technical interview with engineering team'
          }
        ],
        emails_processed: 2,
        total_applications: 15,
        interviews_scheduled: 1,
        response_rate: 23,
        active_resumes: 3
      }
      
      // Set mock data only if no real data exists
      if (emailActivities.length === 0) {
        setEmailActivities(mockData.email_activities)
        setAttentionItems(mockData.attention_items)
        setQuickUpdates(mockData.quick_updates)
        setUpcomingEvents(mockData.upcoming_events)
        setLastUpdated(new Date())
      }
    } finally {
      setIsLoadingEmails(false)
      setIsBackgroundRefresh(false)
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


  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([])

  // Real email data state
  const [emailActivities, setEmailActivities] = useState<any[]>([])
  const [attentionItems, setAttentionItems] = useState<any[]>([])
  const [quickUpdates, setQuickUpdates] = useState<any[]>([])
  const [recentEmails, setRecentEmails] = useState<any[]>([])
  const [isLoadingEmails, setIsLoadingEmails] = useState(false)
  const [emailStats, setEmailStats] = useState({ applicationsThisWeek: 0 })



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
    // Use the backend-generated summary if available
    if (email.summary) {
      return email.summary
    }
    
    const details = email.extracted_details
    
    // Fallback logic for older emails
    if (email.type === 'interview') {
      if (details?.interview_date) {
        return `Interview scheduled for ${details.interview_date}${details.interview_time ? ` at ${details.interview_time}` : ''}`
      }
      return details?.action_required || 'Interview invitation - response required'
    } else if (email.type === 'recruiter') {
      if (details?.salary_range) {
        return `New opportunity - ${details.salary_range}${details.location ? ` in ${details.location}` : ''}`
      }
      return details?.action_required || 'New job opportunity'
    } else if (email.type === 'rejection') {
      return 'Application status update'
    } else if (email.type === 'follow_up') {
      return details?.action_required || 'Follow-up needed'
    }
    
    // Fallback to subject
    return email.subject
  }

  return (
    <div className="space-y-6 p-6 relative">
      {/* Welcome Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Welcome back!</h1>
          <p className="text-muted-foreground mt-1">
            {currentTime.toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="text-xs">
            Last updated: {lastUpdated ? formatLastUpdated(lastUpdated) : 'Never'}
          </Badge>
        </div>
      </div>


      {/* Email Activity Center - Main Focus */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-blue-500" />
            <h2 className="text-xl font-semibold text-foreground">Email Activity Center</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadEmailData()}
              disabled={isLoadingEmails}
              className="h-8"
            >
              <RefreshCw className={cn("h-4 w-4 mr-1", isLoadingEmails && "animate-spin")} />
              Refresh
            </Button>
            <Badge variant="outline" className="text-xs">
              {isLoadingEmails ? 'Syncing...' : emailActivities.length > 0 ? `${emailActivities.length} emails` : 'No emails'}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              Auto-refresh: {refreshFrequency}m
            </Badge>
          </div>
        </div>
        
        <div className="space-y-4">
          {isLoadingEmails ? (
            <div className="text-center py-12">
              <RefreshCw className="h-8 w-8 text-muted-foreground mx-auto mb-4 animate-spin" />
              <p className="text-muted-foreground">Syncing emails...</p>
              <p className="text-sm text-muted-foreground mt-1">Processing past 5 days of emails</p>
            </div>
          ) : emailActivities.length > 0 ? (
            <AnimatePresence>
              {emailActivities.slice(0, 5).map((email, index) => (
                <motion.div 
                  key={email.id}
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{ 
                    duration: 0.3, 
                    delay: isBackgroundRefresh ? 0 : index * 0.1 
                  }}
                  className="flex items-start gap-4 p-4 border border-border rounded-lg hover:bg-accent/20 transition-colors"
                >
                <div className="flex-shrink-0">
                  {getEmailIcon(email.type)}
                </div>
                <div className="flex-1 min-w-0">
                  {/* Company - Role */}
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground">
                        {email.company}
                        {email.extracted_details?.position && (
                          <span className="text-muted-foreground font-normal"> - {email.extracted_details.position}</span>
                        )}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">{formatEmailTime(email.timestamp)}</span>
                  </div>
                  
                  {/* Name of person */}
                  {email.extracted_details?.recruiter_name && (
                    <p className="text-sm text-muted-foreground mb-1">{email.extracted_details.recruiter_name}</p>
                  )}
                  
                  {/* One line summary */}
                  <p className="text-sm text-muted-foreground mb-2 line-clamp-1">{getSummaryLine(email)}</p>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant="default"
                        className={cn("text-xs", getEmailTypeColor(email.type))}
                      >
                        {getEmailTypeLabel(email.type)}
                      </Badge>
                      {email.status === 'unread' && (
                        <Badge variant="outline" className="text-xs">
                          New
                        </Badge>
                      )}
                      {email.extracted_details?.urgency === 'high' && (
                        <Badge variant="destructive" className="text-xs">
                          Urgent
                        </Badge>
                      )}
                    </div>
                    
                    {/* Details button */}
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 text-xs"
                      onClick={() => setSelectedEmail(email)}
                    >
                      Details
                    </Button>
                  </div>
                </div>
                </motion.div>
              ))}
            </AnimatePresence>
          ) : (
            <div className="text-center py-12">
              <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No recent emails</p>
              <p className="text-sm text-muted-foreground mt-1">Click refresh to sync your emails</p>
            </div>
          )}
        </div>
      </Card>


      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attention Required */}
        <div>
          {attentionItems.length > 0 && (
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-foreground">Attention Required</h2>
              </div>
              <div className="space-y-2">
                {attentionItems.map((item, index) => (
                  <div key={index} className="border border-border rounded-lg">
                    <div className="flex items-center justify-between p-2">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-orange-500" />
                        <div>
                          <p className="font-medium text-foreground text-xs">{item.title}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-48">{item.description}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Quick Updates */}
        <div>
          {quickUpdates.length > 0 && (
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-foreground">Quick Updates</h2>
              </div>
              <div className="space-y-2">
                {quickUpdates.map((update, index) => (
                  <div key={index} className="border border-border rounded-lg">
                    <div className="flex items-center justify-between p-2">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-blue-500" />
                        <div>
                          <p className="font-medium text-foreground text-xs">{update.title}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-48">{update.summary}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Upcoming Events - Always Show */}
        <div>
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground">Upcoming Events</h2>
              <Button variant="ghost" size="sm" className="h-6 text-xs" asChild>
                <Link href="/dashboard/tracker">
                  View All <ArrowRight className="h-3 w-3 ml-1" />
                </Link>
              </Button>
            </div>
            <div className="space-y-2">
              {upcomingEvents.length > 0 ? 
                upcomingEvents.map((event) => (
                  <div key={event.id} className="border border-border rounded-lg relative">
                    <div 
                      className="flex items-center justify-between p-2 cursor-pointer hover:bg-accent/50 transition-colors"
                      onClick={() => handleEventToggle(event.id)}
                    >
                      <div className="flex items-center gap-2">
                        {getPlatformIcon(event.platform)}
                        <div>
                          <p className="font-medium text-foreground text-xs">{event.company}</p>
                          <p className="text-xs text-muted-foreground">{event.date} • {event.time}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0"
                          onClick={(e) => {
                            e.stopPropagation()
                            window.open(event.link, '_blank')
                          }}
                        >
                          <ExternalLink className="h-2 w-2" />
                        </Button>
                        {expandedEvent === event.id ? 
                          <ChevronUp className="h-3 w-3 text-muted-foreground" /> : 
                          <ChevronDown className="h-3 w-3 text-muted-foreground" />
                        }
                      </div>
                    </div>
                    {expandedEvent === event.id && (
                      <div className="absolute inset-0 bg-background border border-border rounded-lg p-3 z-10 shadow-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {getPlatformIcon(event.platform)}
                            <h3 className="font-medium text-foreground text-sm">{event.company}</h3>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => handleEventToggle(event.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="space-y-2">
                          <div>
                            <p className="text-xs font-medium text-foreground">{event.date} at {event.time}</p>
                            <p className="text-xs text-muted-foreground">Duration: {event.duration}</p>
                          </div>
                          <p className="text-xs text-foreground">{event.details}</p>
                          <div className="flex gap-2 mt-3">
                            <Button
                              size="sm"
                              className="h-6 text-xs flex-1"
                              onClick={(e) => {
                                e.stopPropagation()
                                window.open(event.link, '_blank')
                              }}
                            >
                              Join Meeting
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )) : (
                <>
                  <div className="border border-dashed border-muted-foreground/30 rounded-lg p-2 flex items-center gap-2 opacity-50">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">Today</p>
                      <p className="text-xs text-muted-foreground/70">No events</p>
                    </div>
                  </div>
                  <div className="border border-dashed border-muted-foreground/30 rounded-lg p-2 flex items-center gap-2 opacity-50">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">Tomorrow</p>
                      <p className="text-xs text-muted-foreground/70">No events</p>
                    </div>
                  </div>
                  <div className="border border-dashed border-muted-foreground/30 rounded-lg p-2 flex items-center gap-2 opacity-50">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">Next Week</p>
                      <p className="text-xs text-muted-foreground/70">No events</p>
                    </div>
                  </div>
                  <div className="border border-dashed border-muted-foreground/30 rounded-lg p-2 flex items-center gap-2 opacity-50">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">Later</p>
                      <p className="text-xs text-muted-foreground/70">No events</p>
                    </div>
                  </div>
                </>
              )}
              </div>
            </Card>
        </div>
      </div>

      {/* Email Details Modal */}
      {selectedEmail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSelectedEmail(null)}>
          <div className="bg-background border border-border rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Email Details</h2>
              <Button variant="ghost" size="sm" onClick={() => setSelectedEmail(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="space-y-4">
              {/* Basic Info */}
              <div>
                <h3 className="font-medium mb-2">Basic Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Company:</span>
                    <p className="font-medium">{selectedEmail.company}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Type:</span>
                    <Badge className={cn("ml-2", getEmailTypeColor(selectedEmail.type))}>
                      {getEmailTypeLabel(selectedEmail.type)}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">From:</span>
                    <p className="font-medium">{selectedEmail.sender}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Date:</span>
                    <p className="font-medium">{new Date(selectedEmail.timestamp).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>

              {/* Extracted Details */}
              {selectedEmail.extracted_details && (
                <div>
                  <h3 className="font-medium mb-2">Extracted Details</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {selectedEmail.extracted_details.recruiter_name && 
                     selectedEmail.extracted_details.recruiter_name !== '' && 
                     !selectedEmail.extracted_details.recruiter_name.includes('[') && (
                      <div>
                        <span className="text-muted-foreground">Contact:</span>
                        <p className="font-medium">{selectedEmail.extracted_details.recruiter_name}</p>
                      </div>
                    )}
                    {selectedEmail.extracted_details.position && 
                     selectedEmail.extracted_details.position !== '' && 
                     !selectedEmail.extracted_details.position.includes('[') && (
                      <div>
                        <span className="text-muted-foreground">Position:</span>
                        <p className="font-medium">{selectedEmail.extracted_details.position}</p>
                      </div>
                    )}
                    {selectedEmail.extracted_details.client_company && 
                     selectedEmail.extracted_details.client_company !== '' && 
                     !selectedEmail.extracted_details.client_company.includes('[') && (
                      <div>
                        <span className="text-muted-foreground">Client:</span>
                        <p className="font-medium">{selectedEmail.extracted_details.client_company}</p>
                      </div>
                    )}
                    {selectedEmail.extracted_details.recruiter_email && 
                     selectedEmail.extracted_details.recruiter_email !== '' && 
                     !selectedEmail.extracted_details.recruiter_email.includes('[') && (
                      <div>
                        <span className="text-muted-foreground">Email:</span>
                        <p className="font-medium">{selectedEmail.extracted_details.recruiter_email}</p>
                      </div>
                    )}
                    {selectedEmail.extracted_details.recruiter_phone && 
                     selectedEmail.extracted_details.recruiter_phone !== '' && (
                      <div>
                        <span className="text-muted-foreground">Phone:</span>
                        <p className="font-medium">{selectedEmail.extracted_details.recruiter_phone}</p>
                      </div>
                    )}
                    {selectedEmail.extracted_details.salary_range && 
                     selectedEmail.extracted_details.salary_range !== '' && (
                      <div>
                        <span className="text-muted-foreground">Salary:</span>
                        <p className="font-medium text-green-600">{selectedEmail.extracted_details.salary_range}</p>
                      </div>
                    )}
                    {selectedEmail.extracted_details.location && 
                     selectedEmail.extracted_details.location !== '' && (
                      <div>
                        <span className="text-muted-foreground">Location:</span>
                        <p className="font-medium">{selectedEmail.extracted_details.location}</p>
                      </div>
                    )}
                    {selectedEmail.extracted_details.interview_date && 
                     selectedEmail.extracted_details.interview_date !== '' && (
                      <div>
                        <span className="text-muted-foreground">Interview Date:</span>
                        <p className="font-medium text-blue-600">{selectedEmail.extracted_details.interview_date} {selectedEmail.extracted_details.interview_time}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Subject and Content */}
              <div>
                <h3 className="font-medium mb-2">Subject</h3>
                <p className="text-sm">{selectedEmail.subject}</p>
              </div>
              
              <div>
                <h3 className="font-medium mb-2">Content Preview</h3>
                <p className="text-sm text-muted-foreground bg-muted p-3 rounded">{selectedEmail.content}</p>
              </div>

              {/* Action Required */}
              {selectedEmail.extracted_details?.action_required && (
                <div>
                  <h3 className="font-medium mb-2">Action Required</h3>
                  <p className="text-sm bg-yellow-50 text-yellow-800 p-3 rounded border border-yellow-200">
                    {selectedEmail.extracted_details.action_required}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-4">
                <Button size="sm">
                  Add to Job Tracker
                </Button>
                <Button variant="outline" size="sm">
                  Create Resume Version
                </Button>
                <Button variant="outline" size="sm">
                  Reply
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}