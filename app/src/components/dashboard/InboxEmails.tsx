'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Mail, 
  Star, 
  Archive, 
  Clock, 
  MapPin, 
  DollarSign,
  Calendar,
  Filter,
  Search,
  RefreshCw,
  ChevronRight,
  Briefcase,
  Video,
  FileText,
  X,
  CheckCircle,
  AlertCircle,
  Users,
  Send,
  Inbox as InboxIcon,
  List
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { backgroundSyncService } from '@/services/backgroundSyncService'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmailDetailsModal as EmailThread } from './EmailDetailsModal'
import { staggerContainer, staggerItem, hoverScale, tapScale, fadeIn, fadeInUp } from '@/lib/animations'

// Type definitions
type EmailType = 'all' | 'unread' | 'interview' | 'offer' | 'recruiter' | 'rejection' | 'follow_up' | 'application'

interface EmailFilterItem {
  value: EmailType
  label: string
  icon: React.ReactNode
  count?: number
  color?: string
}

export function InboxEmails() {
  const [selectedFilter, setSelectedFilter] = useState<EmailType>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedEmail, setSelectedEmail] = useState<any | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [hoveredCard, setHoveredCard] = useState<string | null>(null)
  const [starredEmails, setStarredEmails] = useState<Set<string>>(new Set())
  const [archivedEmails, setArchivedEmails] = useState<Set<string>>(new Set())

  // Real emails fetched via background sync service
  const [emails, setEmails] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [scopeWarning, setScopeWarning] = useState<string | null>(null)
  const [syncProgress, setSyncProgress] = useState<number | null>(null)
  const [syncStatus, setSyncStatus] = useState<string>('idle')
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null)
  
  // Import content cleaner
  const { formatEmailSnippet } = require('@/lib/utils/content-cleaner')

  // Subscribe to background sync on mount
  useEffect(() => {
    // First, fetch existing emails from database
    const fetchInitialEmails = async () => {
      try {
        // Fetch all emails, not just job-related (some may be misclassified)
        const response = await fetch('/api/email?action=activities&limit=50&job_related=false')
        if (response.ok) {
          const data = await response.json()
          // Check different possible response structures and transform data
          let emailData = []
          if (data.data?.email_activities && data.data.email_activities.length > 0) {
            emailData = data.data.email_activities
          } else if (data.email_activities && data.email_activities.length > 0) {
            emailData = data.email_activities
          } else if (data.emails && data.emails.length > 0) {
            emailData = data.emails
          }
          
          // Transform email data to match component expectations
          const transformedEmails = emailData.map(email => ({
            ...email,
            // Map timestamp from received_at (keep as ISO string for consistency)
            timestamp: email.received_at,
            // Extract company from sender info
            company: email.company || extractCompanyFromEmail(email.sender_email, email.sender_name),
            // Set type based on email_type or default
            type: email.email_type || email.type || 'other',
            // Add status
            status: email.is_processed ? 'read' : 'unread'
          }))
          
          setEmails(transformedEmails)
        }
      } catch (error) {
        console.error('Failed to fetch initial emails:', error)
      } finally {
        setIsLoading(false)
      }
    }
    
    // Check Gmail scope status and last sync time
    const checkScopeStatus = async () => {
      try {
        const response = await fetch('/api/email?action=sync-status')
        if (response.ok) {
          const data = await response.json()
          if (data.connected && !data.hasFullScope) {
            setScopeWarning(data.scopeWarning || 'Limited to email metadata only. Reauthorize for full email access.')
          }
          
          // Also check for last sync time
          if (data.lastSync) {
            setLastSyncTime(data.lastSync)
          }
        }
      } catch (error) {
        console.error('Failed to check scope status:', error)
      }
    }
    
    // Fetch last sync time from metadata
    const fetchLastSyncTime = async () => {
      try {
        const userId = 'f556989c-4903-47d6-8700-0afe3d4189e5'
        const response = await fetch(`/api/sync-metadata?type=gmail_last_sync_${userId}`)
        if (response.ok) {
          const data = await response.json()
          if (data?.sync_state?.lastSyncTime) {
            setLastSyncTime(data.sync_state.lastSyncTime)
          }
        }
      } catch (error) {
        console.error('Failed to fetch last sync time:', error)
      }
    }

    fetchInitialEmails()
    checkScopeStatus()

    // Then subscribe to updates
    const unsubscribe = backgroundSyncService.subscribe(({ emailData, status, syncProgress }) => {
      if (emailData?.email_activities) {
        // Transform email data to match component expectations
        const transformedEmails = emailData.email_activities.map(email => ({
          ...email,
          timestamp: email.received_at,
          company: email.company || extractCompanyFromEmail(email.sender_email, email.sender_name),
          type: email.email_type || email.type || 'other',
          status: email.is_processed ? 'read' : 'unread'
        }))
        setEmails(transformedEmails)
      }
      
      // Update sync status
      setSyncStatus(status)
      if (syncProgress && syncProgress.status === 'running') {
        const progress = Math.round((syncProgress.processed / syncProgress.total) * 100) || 0
        setSyncProgress(progress)
      } else {
        setSyncProgress(null)
      }
      
      // Clear refreshing state when sync completes
      if (status === 'idle' || status === 'error') {
        setIsRefreshing(false)
        // Refresh last sync time when sync completes
        if (status === 'idle') {
          checkScopeStatus() // This will update lastSyncTime
        }
      }
    })
    
    // Initialize if provider hasn't yet
    const current = backgroundSyncService.getCurrentData().emailData
    if (current?.email_activities && current.email_activities.length > 0) {
      const transformedEmails = current.email_activities.map(email => ({
        ...email,
        timestamp: email.received_at,
        company: email.company || extractCompanyFromEmail(email.sender_email, email.sender_name),
        type: email.email_type || email.type || 'other',
        status: email.is_processed ? 'read' : 'unread'
      }))
      setEmails(transformedEmails)
      setIsLoading(false)
    }
    
    return unsubscribe
  }, [])

  // Calculate filter counts
  const filterCounts = useMemo(() => {
    const counts: Record<EmailType, number> = {
      all: emails.filter(e => !archivedEmails.has(e.id)).length,
      unread: emails.filter(e => !archivedEmails.has(e.id) && e.status === 'unread').length,
      interview: emails.filter(e => !archivedEmails.has(e.id) && (e.type || guessEmailType(e)) === 'interview').length,
      offer: emails.filter(e => !archivedEmails.has(e.id) && (e.type || guessEmailType(e)) === 'offer').length,
      recruiter: emails.filter(e => !archivedEmails.has(e.id) && (e.type || guessEmailType(e)) === 'recruiter').length,
      rejection: emails.filter(e => !archivedEmails.has(e.id) && (e.type || guessEmailType(e)) === 'rejection').length,
      follow_up: emails.filter(e => !archivedEmails.has(e.id) && (e.type || guessEmailType(e)) === 'follow_up').length,
      application: emails.filter(e => !archivedEmails.has(e.id) && (e.type || guessEmailType(e)) === 'application').length,
    }
    return counts
  }, [archivedEmails, emails])

  // Filter configuration - simplified with All, Recruiter and Applications
  const filters: EmailFilterItem[] = [
    { value: 'all', label: 'All', icon: <List className="w-4 h-4" />, count: filterCounts.all },
    { value: 'recruiter', label: 'Recruiter', icon: <Users className="w-4 h-4" />, count: filterCounts.recruiter },
    { value: 'application', label: 'Applications', icon: <FileText className="w-4 h-4" />, count: filterCounts.application || 0 },
  ]

  // Filter and search emails
  const filteredEmails = useMemo(() => {
    let filtered = emails.filter(email => !archivedEmails.has(email.id))

    // Apply type filter
    if (selectedFilter !== 'all') {
      if (selectedFilter === 'unread') {
        filtered = filtered.filter(email => email.status === 'unread')
      } else {
        filtered = filtered.filter(email => (email.type || guessEmailType(email)) === selectedFilter)
      }
    }

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(email => 
        email.company?.toLowerCase().includes(query) ||
        email.position?.toLowerCase().includes(query) ||
        email.subject?.toLowerCase().includes(query) ||
        email.sender_name?.toLowerCase().includes(query) ||
        email.summary?.toLowerCase().includes(query)
      )
    }

    return filtered
  }, [selectedFilter, searchQuery, archivedEmails, emails])

  // Handle refresh – trigger the background email sync service
  const handleRefresh = async () => {
    try {
      setIsRefreshing(true)
      setSyncProgress(0)

      // Use background sync service for manual sync
      const jobId = await backgroundSyncService.manualSync()
      
      if (jobId) {
        console.log(`📧 Manual sync started with job ID: ${jobId}`)
        // Progress will be updated via the subscription
      }
    } catch (error) {
      console.error('Manual email sync failed:', error)
      setIsRefreshing(false)
      setSyncProgress(null)
    }
  }

  // Toggle star
  const toggleStar = (emailId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setStarredEmails(prev => {
      const newSet = new Set(prev)
      if (newSet.has(emailId)) {
        newSet.delete(emailId)
      } else {
        newSet.add(emailId)
      }
      return newSet
    })
  }

  // Archive email
  const archiveEmail = (emailId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setArchivedEmails(prev => new Set(prev).add(emailId))
  }

  // Format time
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffHours / 24)

    if (diffHours < 1) return 'Just now'
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  // Extract company from email/sender
  const extractCompanyFromEmail = (email: string, senderName?: string) => {
    // Check sender name for company indicators
    if (senderName) {
      // Common patterns: "Oracle Talent Acquisition", "LinkedIn", etc.
      if (senderName.includes('Oracle')) return 'Oracle'
      if (senderName.includes('LinkedIn')) return 'LinkedIn'
      if (senderName.includes('Indeed')) return 'Indeed'
      if (senderName.includes('Google')) return 'Google'
      if (senderName.includes('Microsoft')) return 'Microsoft'
      if (senderName.includes('Amazon')) return 'Amazon'
      if (senderName.includes('Apple')) return 'Apple'
      if (senderName.includes('Meta') || senderName.includes('Facebook')) return 'Meta'
      if (senderName.includes('TEKsystems')) return 'TEKsystems'
      if (senderName.includes('Visa')) return 'Visa'
      if (senderName.includes('Filevine')) return 'Filevine'
      
      // Check for "X at Company" pattern
      const atMatch = senderName.match(/at\s+([A-Z][A-Za-z0-9\s&.-]+)/)
      if (atMatch) return atMatch[1].trim()
    }
    
    // Extract from email domain
    if (email) {
      const domain = email.split('@')[1]?.toLowerCase()
      if (domain) {
        // Remove common email provider domains
        if (['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com'].includes(domain)) {
          return senderName?.split(' ')[0] || 'Unknown Company'
        }
        
        // Extract company name from domain
        const companyName = domain
          .replace(/\.(com|org|net|io|co|ai|dev)$/, '')
          .replace(/^(mail|email|noreply|notifications?|careers?|jobs?|talent|recruiting|hr)\./, '')
          .replace(/-/g, ' ')
          .split('.')
          .pop() || ''
          
        return companyName.charAt(0).toUpperCase() + companyName.slice(1)
      }
    }
    
    return 'Unknown Company'
  }

  // Get company initials
  const getCompanyInitials = (company: string) => {
    return company
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  // Intelligently guess email type based on subject and sender patterns
  const guessEmailType = (email: any): string => {
    // First, use the AI-classified email_type if available
    if (email.email_type && email.email_type !== 'general') {
      return email.email_type
    }
    const subject = (email.subject || '').toLowerCase()
    const senderEmail = (email.sender_email || '').toLowerCase()
    const senderName = (email.sender_name || '').toLowerCase()
    const summary = (email.summary || '').toLowerCase()
    const body = (email.body_text || '').toLowerCase().slice(0, 500)

    // Detect job board alerts early to avoid falling through to generic label
    const jobBoardPatterns = [
      'job alert',
      'new jobs',
      'jobs for you',
      'recommended jobs',
      'positions near you',
      'matching jobs',
      'hiring now',
      'indeed',
      'linkedin jobs',
      'ziprecruiter',
      'monster',
      'workopolis',
      'glassdoor'
    ]

    for (const pattern of jobBoardPatterns) {
      if (subject.includes(pattern) || senderEmail.includes(pattern.replace(/\s/g, ''))) {
        return 'job_alert'
      }
    }
    
    // Check for assessment patterns
    if (subject.includes('assessment') || 
        subject.includes('test') || 
        subject.includes('exercise') ||
        subject.includes('challenge') ||
        subject.includes('assignment') ||
        body.includes('complete the assessment') ||
        body.includes('technical test')) {
      return 'assessment'
    }
    
    // Check for interview patterns
    if (subject.includes('interview') || 
        subject.includes('meet') || 
        subject.includes('call') ||
        subject.includes('discussion') ||
        subject.includes('chat') ||
        summary.includes('interview')) {
      return 'interview_request'
    }
    
    // Check for offer patterns
    if (subject.includes('offer') || 
        subject.includes('congratulations') ||
        subject.includes('pleased to') ||
        subject.includes('welcome to') ||
        summary.includes('offer')) {
      return 'offer'
    }
    
    // Check for rejection patterns
    if (subject.includes('unfortunately') || 
        subject.includes('not selected') ||
        subject.includes('other candidate') ||
        subject.includes('decided to') ||
        subject.includes('moving forward with') ||
        subject.includes('not a fit') ||
        summary.includes('rejection')) {
      return 'rejection'
    }
    
    // Check for application update patterns
    if (subject.includes('application status') || 
        subject.includes('update on your application') ||
        subject.includes('regarding your application') ||
        subject.includes('application update') ||
        body.includes('status of your application')) {
      return 'application_update'
    }
    
    // Check for application confirmation patterns
    if (subject.includes('thank you for applying') ||
        subject.includes('application received') ||
        subject.includes('application confirmation') ||
        subject.includes('applied for') ||
        subject.includes('we received your') ||
        subject.includes('thanks for your interest')) {
      return 'application_submitted'
    }
    
    // Check for recruiter outreach patterns
    if (senderName.includes('recruiter') ||
        senderName.includes('talent') ||
        senderName.includes('hiring') ||
        senderEmail.includes('linkedin') ||
        subject.includes('opportunity') ||
        subject.includes('role at') ||
        subject.includes('position at') ||
        subject.includes('interested in') ||
        subject.includes('profile') ||
        subject.includes('invitation to connect')) {
      return 'recruiter_outreach'
    }
    
    // Check for follow-up patterns
    if (subject.includes('follow') ||
        subject.includes('checking in') ||
        subject.includes('circling back') ||
        subject.includes('touching base') ||
        subject.includes('next steps')) {
      return 'followup'
    }
    
    // Default to 'general' for unclassified emails
    return 'general'
  }

  // Get type color classes
  const getTypeColorClasses = (type: string) => {
    switch (type) {
      case 'interview':
      case 'interview_request':
        return {
          bg: 'bg-primary/10 dark:bg-primary/20',
          text: 'text-primary dark:text-primary',
          border: 'border-primary/20 dark:border-primary/30',
          icon: 'text-primary dark:text-primary'
        }
      case 'offer':
        return {
          bg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
          text: 'text-emerald-600 dark:text-emerald-400',
          border: 'border-emerald-500/20 dark:border-emerald-500/30',
          icon: 'text-emerald-600 dark:text-emerald-400'
        }
      case 'recruiter':
      case 'recruiter_outreach':
        return {
          bg: 'bg-indigo-100 dark:bg-indigo-900/20',
          text: 'text-indigo-700 dark:text-indigo-400',
          border: 'border-indigo-200 dark:border-indigo-800',
          icon: 'text-indigo-600 dark:text-indigo-400'
        }
      case 'rejection':
        return {
          bg: 'bg-red-100 dark:bg-red-900/20',
          text: 'text-red-700 dark:text-red-400',
          border: 'border-red-200 dark:border-red-800',
          icon: 'text-red-600 dark:text-red-400'
        }
      case 'assessment':
        return {
          bg: 'bg-orange-500/10 dark:bg-orange-500/20',
          text: 'text-orange-600 dark:text-orange-400',
          border: 'border-orange-500/20 dark:border-orange-500/30',
          icon: 'text-orange-600 dark:text-orange-400'
        }
      case 'application':
      case 'application_submitted':
        return {
          bg: 'bg-blue-500/10 dark:bg-blue-500/20',
          text: 'text-blue-600 dark:text-blue-400',
          border: 'border-blue-500/20 dark:border-blue-500/30',
          icon: 'text-blue-600 dark:text-blue-400'
        }
      case 'application_update':
        return {
          bg: 'bg-yellow-500/10 dark:bg-yellow-500/20',
          text: 'text-yellow-600 dark:text-yellow-400',
          border: 'border-yellow-500/20 dark:border-yellow-500/30',
          icon: 'text-yellow-600 dark:text-yellow-400'
        }
      case 'follow_up':
      case 'followup':
        return {
          bg: 'bg-amber-100 dark:bg-amber-900/20',
          text: 'text-amber-700 dark:text-amber-400',
          border: 'border-amber-200 dark:border-amber-800',
          icon: 'text-amber-600 dark:text-amber-400'
        }
      case 'application':
        return {
          bg: 'bg-blue-100 dark:bg-blue-900/20',
          text: 'text-blue-700 dark:text-blue-400',
          border: 'border-blue-200 dark:border-blue-800',
          icon: 'text-blue-600 dark:text-blue-400'
        }
      case 'job_alert':
        return {
          bg: 'bg-amber-500/10 dark:bg-amber-500/20',
          text: 'text-amber-600 dark:text-amber-400',
          border: 'border-amber-500/20 dark:border-amber-500/30',
          icon: 'text-amber-600 dark:text-amber-400'
        }
      case 'other':
      default:
        return {
          bg: 'bg-gray-100 dark:bg-gray-800',
          text: 'text-foreground dark:text-gray-400',
          border: 'border-gray-200 dark:border-gray-700',
          icon: 'text-foreground/70 dark:text-gray-400'
        }
    }
  }

  // Get time-based gradient
  const getTimeBasedGradient = () => {
    const hour = new Date().getHours()
    if (hour >= 5 && hour < 12) return 'from-amber-500 via-orange-500 to-yellow-500'
    if (hour >= 12 && hour < 17) return 'from-blue-500 via-cyan-500 to-teal-500'
    if (hour >= 17 && hour < 22) return 'from-purple-500 via-indigo-500 to-primary'
    return 'from-indigo-500 via-purple-500 to-primary'
  }
  
  // Get clean email summary for display
  const getEmailSummary = (email: any): string => {
    // If we have a processed summary, use it
    if (email.summary || email.thread_summary) {
      return email.summary || email.thread_summary;
    }
    
    // Otherwise, generate a clean snippet from the content
    const content = email.body_text || email.body_html || email.snippet || '';
    return formatEmailSnippet(content, 120);
  }

  return (
    <div className="w-full h-full flex flex-col min-h-0">
      {/* Header with filters - responsive */}
      <div className="border-b border-foreground/10 dark:border-foreground/20 bg-card/50 dark:bg-card/30 backdrop-blur-xl shadow-sm flex-shrink-0">
        <div className="p-3 sm:p-4">
          {/* Top row with title, filters and actions - responsive */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto">
              <div className="flex-shrink-0">
                <motion.h2 
                  className="text-xl font-bold text-foreground flex items-center gap-2"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  Inbox
                  <span className="text-sm font-normal text-muted-foreground">({filterCounts.all})</span>
                </motion.h2>
                {lastSyncTime && (
                  <motion.p
                    className="text-xs text-muted-foreground italic mt-0.5"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                  >
                    Last synced: {formatTime(lastSyncTime)}
                  </motion.p>
                )}
              </div>
              
              {/* Compact filter pills with animation */}
              <motion.div 
                className="flex items-center gap-1 overflow-x-auto scrollbar-hide"
                initial="hidden"
                animate="visible"
                variants={{
                  visible: {
                    transition: {
                      staggerChildren: 0.05
                    }
                  }
                }}
              >
                {filters.map((filter) => (
                  <motion.button
                    key={filter.value}
                    onClick={() => setSelectedFilter(filter.value)}
                    variants={{
                      hidden: { opacity: 0, scale: 0.9 },
                      visible: { opacity: 1, scale: 1 }
                    }}
                    whileHover={hoverScale}
                    whileTap={tapScale}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-xs font-medium transition-all whitespace-nowrap",
                      selectedFilter === filter.value
                        ? "bg-foreground text-background shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                    )}
                  >
                    {filter.icon && (
                      <span className={cn(selectedFilter !== filter.value && filter.color)}>
                        {filter.icon}
                      </span>
                    )}
                    {filter.label && (
                      <>
                        <span className="hidden sm:inline">{filter.label}</span>
                        <span className="sm:hidden">{filter.label.split(' ')[0]}</span>
                      </>
                    )}
                    {filter.count !== undefined && filter.count > 0 && (
                      <span className={cn(
                        "ml-0.5",
                        selectedFilter === filter.value
                          ? "text-primary-foreground/80"
                          : "text-muted-foreground",
                        filter.value === 'unread' && filter.count > 0 ? "relative" : ""
                      )}>
                        {filter.count}
                      </span>
                    )}
                  </motion.button>
                ))}
              </motion.div>
            </div>
            
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Compact search with animation */}
              <motion.div 
                className="relative"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
              >
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 w-28 sm:w-40 pl-8 pr-3 text-xs bg-secondary/50 dark:bg-secondary/20 border border-foreground/10 hover:border-foreground/20 rounded-full focus:outline-none focus:ring-2 focus:ring-foreground/20 focus:border-foreground/30 focus:bg-background transition-all"
                />
              </motion.div>
              
              {/* Refresh button with animation and progress */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.25 }}
                className="relative"
              >
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="h-8 w-8 p-0 rounded-full hover:bg-secondary/50 relative"
                >
                  {syncProgress !== null && isRefreshing ? (
                    <>
                      {/* Progress ring */}
                      <svg className="w-8 h-8 absolute inset-0">
                        <circle
                          cx="16"
                          cy="16"
                          r="14"
                          stroke="currentColor"
                          strokeWidth="2"
                          fill="none"
                          className="opacity-20"
                        />
                        <circle
                          cx="16"
                          cy="16"
                          r="14"
                          stroke="currentColor"
                          strokeWidth="2"
                          fill="none"
                          strokeDasharray={`${syncProgress * 0.88} 88`}
                          strokeDashoffset="22"
                          className="text-primary transition-all duration-300"
                          style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
                        />
                      </svg>
                      <span className="text-xs font-semibold">{syncProgress}%</span>
                    </>
                  ) : (
                    <RefreshCw className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin")} />
                  )}
                </Button>
                {syncStatus === 'syncing' && syncProgress !== null && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="absolute top-full mt-1 right-0 bg-card border border-border rounded-md shadow-sm px-2 py-1 text-xs whitespace-nowrap"
                  >
                    Syncing emails...
                  </motion.div>
                )}
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      {/* Scope warning banner */}
      {scopeWarning && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="bg-amber-100 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 px-3 sm:px-4 py-2"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-1">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <p className="text-xs sm:text-sm text-amber-800 dark:text-amber-200">
                {scopeWarning}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="text-xs h-7 px-2 text-amber-700 dark:text-amber-300 hover:bg-amber-200/50 dark:hover:bg-amber-800/50"
                onClick={() => window.location.href = '/api/oauth/reauthorize'}
              >
                Reauthorize
              </Button>
              <button
                onClick={() => setScopeWarning(null)}
                className="text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Email list with better mobile spacing */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden touch-scroll">
        {isLoading ? (
          /* Loading state */
          <div className="flex flex-col items-center justify-center h-full p-8">
            <RefreshCw className="w-8 h-8 text-muted-foreground animate-spin mb-4" />
            <p className="text-sm text-muted-foreground">Loading emails...</p>
          </div>
        ) : filteredEmails.length > 0 ? (
          <motion.div 
            className="p-3 sm:p-4 space-y-3"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            <AnimatePresence mode="popLayout">
              {filteredEmails.map((email, index) => {
                // Intelligently guess email type if not AI processed
                const guessedType = email.type || guessEmailType(email)
                const typeColors = getTypeColorClasses(guessedType)
                const isStarred = starredEmails.has(email.id)
                const isHovered = hoveredCard === email.id

                return (
                  <motion.div
                    key={email.id}
                    layout
                    variants={staggerItem}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onMouseEnter={() => setHoveredCard(email.id)}
                    onMouseLeave={() => setHoveredCard(null)}
                    onClick={() => setSelectedEmail(email)}
                    className={cn(
                      "group relative bg-card/50 dark:bg-card/30 backdrop-blur-sm rounded-lg border transition-all cursor-pointer",
                      email.status === 'unread' 
                        ? "border-foreground/20 dark:border-foreground/30 shadow-sm" 
                        : "border-foreground/5 dark:border-foreground/10 hover:border-foreground/10 dark:hover:border-foreground/20",
                      "hover:translate-y-[-1px] hover:bg-card/80 dark:hover:bg-card/50 hover:shadow-sm",
                      starredEmails.has(email.id) && "border-amber-500/20 bg-amber-50/30 dark:bg-amber-950/20"
                    )}
                  >
                    {/* Enhanced unread indicator */}
                    {email.status === 'unread' && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-12 bg-amber-500 dark:bg-amber-400 rounded-r-full" />
                    )}

                    <div className="p-4">
                      {/* Mobile layout - stacked */}
                      <div className="sm:hidden">
                        <div className="flex items-start gap-3">
                          {/* Company logo/initials */}
                          <div className={cn(
                            "w-10 h-10 rounded-md flex items-center justify-center font-semibold text-sm shrink-0 transition-colors",
                            typeColors.bg,
                            typeColors.text
                          )}>
                            {getCompanyInitials(email.company || 'UN')}
                          </div>

                          {/* Main content */}
                          <div className="flex-1 min-w-0">
                            {/* Company and email */}
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h3 className="font-semibold text-foreground text-sm">
                                  {email.company || 'Unknown Company'}
                                </h3>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {email.sender_email || 'no-email@unknown.com'}
                                </p>
                              </div>
                              
                              {/* Time */}
                              <span className={cn(
                                "text-xs shrink-0",
                                email.status === 'unread' 
                                  ? "text-foreground font-semibold" 
                                  : "text-muted-foreground"
                              )}>
                                {formatTime(email.timestamp)}
                              </span>
                            </div>

                            {/* Status and HR info */}
                            <div className="flex items-center gap-2 mt-1.5">
                              <span className={cn(
                                "text-xs font-medium",
                                guessedType === 'rejection' ? "text-red-600 dark:text-red-400" :
                                guessedType === 'offer' ? "text-green-600 dark:text-green-400" :
                                guessedType === 'interview_request' ? "text-purple-600 dark:text-purple-400" :
                                guessedType === 'recruiter_outreach' ? "text-indigo-600 dark:text-indigo-400" :
                                guessedType === 'assessment' ? "text-orange-600 dark:text-orange-400" :
                                guessedType === 'application_submitted' ? "text-blue-600 dark:text-blue-400" :
                                guessedType === 'application_update' ? "text-yellow-600 dark:text-yellow-400" :
                                guessedType === 'followup' ? "text-purple-600 dark:text-purple-400" :
                                guessedType === 'job_alert' ? "text-amber-600 dark:text-amber-400" :
                                "text-muted-foreground"
                              )}>
                                {guessedType === 'rejection' ? 'Rejection' :
                                 guessedType === 'offer' ? 'Job Offer' :
                                 guessedType === 'interview_request' ? 'Interview Request' :
                                 guessedType === 'recruiter_outreach' ? 'Recruiter Outreach' :
                                 guessedType === 'assessment' ? 'Assessment' :
                                 guessedType === 'application_submitted' ? 'Application Submitted' :
                                 guessedType === 'application_update' ? 'Application Update' :
                                 guessedType === 'followup' ? 'Follow-up' :
                                 guessedType === 'follow_up' ? 'Follow-up' :
                                 guessedType === 'application' ? 'Application received' :
                                 guessedType === 'job_alert' ? 'Job Board Alert' :
                                 'Job-related email'}
                              </span>
                              {(email.extracted_details?.recruiter_name || email.sender_name) && 
                               guessedType !== 'application' && (
                                <>
                                  <span className="text-muted-foreground text-xs">•</span>
                                  <span className="text-xs text-muted-foreground">
                                    {email.extracted_details?.recruiter_name || email.sender_name}
                                  </span>
                                </>
                              )}
                            </div>

                            {/* Email Summary - Mobile */}
                            <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                              {getEmailSummary(email)}
                            </p>
                            
                            {/* Tags - stacked */}
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {/* Action required */}
                              {email.requires_action && (
                                <Badge variant="outline" className="h-5 px-2 text-[10px] border-primary/30 dark:border-primary/40 text-primary dark:text-primary font-medium">
                                  Action Required
                                </Badge>
                              )}
                              
                              {/* Interview date if present */}
                              {email.extracted_details?.interview_date && (
                                <Badge variant="outline" className="h-5 px-2 text-[10px] gap-1 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-400">
                                  <Calendar className="w-3 h-3" />
                                  {email.extracted_details.interview_date}
                                </Badge>
                              )}
                              
                              {/* Offer deadline if present */}
                              {guessedType === 'offer' && email.extracted_details?.response_deadline && (
                                <Badge variant="outline" className="h-5 px-2 text-[10px] gap-1 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400">
                                  <AlertCircle className="w-3 h-3" />
                                  By {new Date(email.extracted_details.response_deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Desktop layout - original */}
                      <div className="hidden sm:flex items-center gap-3">
                        {/* Company logo/initials */}
                        <div className={cn(
                          "w-10 h-10 rounded-md flex items-center justify-center font-semibold text-sm shrink-0 transition-colors",
                          typeColors.bg,
                          typeColors.text
                        )}>
                          {getCompanyInitials(email.company || 'UN')}
                        </div>

                        {/* Left section - Company info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 text-base">
                            {/* Company name (main title) */}
                            <span className="font-semibold text-foreground">
                              {email.company || 'Unknown Company'}
                            </span>
                            
                            {/* Separator */}
                            <span className="text-muted-foreground">•</span>
                            
                            {/* Sender email */}
                            <span className="text-muted-foreground text-sm">
                              {email.sender_email || 'no-email@unknown.com'}
                            </span>
                            
                            {/* Separator */}
                            <span className="text-muted-foreground">•</span>
                            
                            {/* Email Type / Status */}
                            <span className={cn(
                              "font-medium text-sm",
                              guessedType === 'rejection' ? "text-red-600 dark:text-red-400" :
                              guessedType === 'offer' ? "text-green-600 dark:text-green-400" :
                              guessedType === 'interview_request' ? "text-purple-600 dark:text-purple-400" :
                              guessedType === 'recruiter_outreach' ? "text-indigo-600 dark:text-indigo-400" :
                              guessedType === 'assessment' ? "text-orange-600 dark:text-orange-400" :
                              guessedType === 'application_submitted' ? "text-blue-600 dark:text-blue-400" :
                              guessedType === 'application_update' ? "text-yellow-600 dark:text-yellow-400" :
                              guessedType === 'followup' ? "text-purple-600 dark:text-purple-400" :
                              guessedType === 'job_alert' ? "text-amber-600 dark:text-amber-400" :
                              "text-muted-foreground"
                            )}>
                              {guessedType === 'rejection' ? 'Rejection' :
                               guessedType === 'offer' ? 'Job Offer' :
                               guessedType === 'interview_request' ? 'Interview Request' :
                               guessedType === 'recruiter_outreach' ? 'Recruiter Outreach' :
                               guessedType === 'assessment' ? 'Assessment' :
                               guessedType === 'application_submitted' ? 'Application Submitted' :
                               guessedType === 'application_update' ? 'Application Update' :
                               guessedType === 'followup' ? 'Follow-up' :
                               guessedType === 'job_alert' ? 'Job Board Alert' :
                               'Job-related email'}
                            </span>
                          </div>
                          
                          {/* Email Summary - Desktop */}
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-1 max-w-2xl">
                            {getEmailSummary(email)}
                          </p>
                        </div>

                        {/* Center section - Tags */}
                        <div className="flex flex-col items-center gap-1">
                          {/* Action required */}
                          {email.requires_action && (
                            <Badge variant="outline" className="h-6 px-2.5 text-xs border-primary/30 dark:border-primary/40 text-primary dark:text-primary font-medium">
                              Action Required
                            </Badge>
                          )}
                          
                          {/* Interview date if present */}
                          {email.extracted_details?.interview_date && (
                            <Badge variant="outline" className="h-6 px-2.5 text-xs gap-1 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-400">
                              <Calendar className="w-3.5 h-3.5" />
                              {email.extracted_details.interview_date}
                            </Badge>
                          )}
                          
                          {/* Offer deadline if present */}
                          {guessedType === 'offer' && email.extracted_details?.response_deadline && (
                            <div className="flex flex-col items-center gap-1">
                              <Badge variant="outline" className="h-6 px-2.5 text-xs gap-1 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400">
                                <AlertCircle className="w-3.5 h-3.5" />
                                Deadline {email.extracted_details.response_deadline}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground">
                                {new Date(email.extracted_details.response_deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Right section - Actions, Time and Chevron */}
                        <div className="flex items-center gap-2 shrink-0">
                          {/* Action buttons - always visible for starred items */}
                          <div className={cn(
                            "flex items-center gap-1.5 transition-opacity",
                            isHovered || isStarred ? "opacity-100" : "opacity-0"
                          )}>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => toggleStar(email.id, e)}
                              className="h-8 w-8 p-0"
                            >
                              <Star className={cn(
                                "w-4 h-4 transition-colors",
                                isStarred 
                                  ? "fill-amber-500 text-amber-500" 
                                  : "text-muted-foreground hover:text-amber-500"
                              )} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => archiveEmail(email.id, e)}
                              className="h-8 w-8 p-0"
                            >
                              <Archive className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                            </Button>
                          </div>
                          
                          {/* Timeago - moved to the end */}
                          <span className={cn(
                            "text-sm ml-2",
                            email.status === 'unread' 
                              ? "text-foreground font-semibold" 
                              : "text-muted-foreground"
                          )}>
                            {formatTime(email.timestamp)}
                          </span>

                          {/* Chevron indicator */}
                          <ChevronRight className={cn(
                            "w-5 h-5 text-muted-foreground transition-all ml-1",
                            isHovered && "text-foreground translate-x-1"
                          )} />
                        </div>
                      </div>
                    </div>

                    {/* Time-based gradient accent */}
                    <div className={cn(
                      "absolute inset-x-0 bottom-0 h-[2px] opacity-0 transition-opacity rounded-b-xl",
                      isHovered && "opacity-100"
                    )}>
                      <div className={cn(
                        "h-full bg-gradient-to-r rounded-b-xl",
                        getTimeBasedGradient()
                      )} />
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </motion.div>
        ) : (
          /* Empty state */
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            className="flex flex-col items-center justify-center h-full p-8"
          >
            <InboxIcon className="w-10 h-10 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {searchQuery ? 'No emails found' : 'All caught up!'}
            </h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              {searchQuery 
                ? `No emails match "${searchQuery}". Try a different search term.`
                : selectedFilter === 'all'
                  ? 'You have no new emails. Check back later.'
                  : `No ${selectedFilter.replace('_', ' ')} emails found.`
              }
            </p>
            {(searchQuery || selectedFilter !== 'all') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery('')
                  setSelectedFilter('all')
                }}
                className="mt-4"
              >
                Clear filters
              </Button>
            )}
          </motion.div>
        )}
      </div>

      {/* Email thread view */}
      {selectedEmail && (
        <EmailThread
          email={selectedEmail}
          onClose={() => setSelectedEmail(null)}
        />
      )}
    </div>
  )
}