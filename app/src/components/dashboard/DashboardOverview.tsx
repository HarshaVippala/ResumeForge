'use client'

import React, { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { 
  AlertCircle,
  CheckCircle,
  Clock,
  Calendar,
  Mail,
  ChevronRight,
  ChevronLeft,
  Users,
  MessageSquare,
  Video,
  Send,
  Phone,
  MapPin,
  FileText,
  Zap
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useJobApplications } from '@/hooks/useJobApplications'
import { backgroundSyncService } from '@/services/backgroundSyncService'
import { differenceInDays, format, isToday, isTomorrow, addDays, subDays, startOfDay, endOfDay } from 'date-fns'

interface ActionItem {
  id: string
  type: 'interview' | 'follow_up' | 'response' | 'deadline'
  title: string
  subtitle: string
  urgent: boolean
  time?: string
  icon: React.ReactNode
  action: () => void
}

interface RecentItem {
  id: string
  type: 'email' | 'application' | 'interview'
  title: string
  subtitle: string
  time: string
  date: Date
  icon: React.ReactNode
}

export function DashboardOverview() {
  const [hoveredCard, setHoveredCard] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const { applications: jobApplications } = useJobApplications()
  const [emails, setEmails] = useState<any[]>([])

  // Subscribe to email data
  React.useEffect(() => {
    const unsub = backgroundSyncService.subscribe(({ emailData }) => {
      if (emailData?.email_activities) {
        setEmails(emailData.email_activities)
      }
    })
    const current = backgroundSyncService.getCurrentData().emailData
    if (current?.email_activities) setEmails(current.email_activities)
    return unsub
  }, [])

  // Priority actions
  const priorityActions = useMemo(() => {
    const actions: ActionItem[] = []
    const now = new Date()
    
    // Upcoming interviews
    jobApplications.forEach(app => {
      app.timeline?.forEach(event => {
        if (event.type === 'interview' && event.date) {
          const eventDate = new Date(event.date)
          if (eventDate > now && differenceInDays(eventDate, now) <= 7) {
            actions.push({
              id: `interview_${app.id}_${event.id}`,
              type: 'interview',
              title: `Interview at ${app.company}`,
              subtitle: isToday(eventDate) ? 'Today' : isTomorrow(eventDate) ? 'Tomorrow' : format(eventDate, 'MMM d'),
              urgent: differenceInDays(eventDate, now) <= 1,
              time: format(eventDate, 'h:mm a'),
              icon: <Video className="w-4 h-4" />,
              action: () => window.location.href = `/dashboard/jobs?company=${app.company}`
            })
          }
        }
      })
    })
    
    // Follow-up needed
    jobApplications.forEach(app => {
      if (app.nextAction && app.nextActionDate) {
        const actionDate = new Date(app.nextActionDate)
        if (actionDate <= now || differenceInDays(actionDate, now) <= 3) {
          actions.push({
            id: `followup_${app.id}`,
            type: 'follow_up',
            title: `Follow up with ${app.company}`,
            subtitle: actionDate <= now ? 'Overdue' : `Due ${format(actionDate, 'MMM d')}`,
            urgent: actionDate <= now,
            icon: <Send className="w-4 h-4" />,
            action: () => window.location.href = `/dashboard/jobs?company=${app.company}`
          })
        }
      }
    })
    
    // Urgent emails
    const urgentEmails = emails.filter(email => 
      email.requires_action && 
      (email.email_type === 'interview' || email.email_type === 'offer')
    ).slice(0, 3)
    
    urgentEmails.forEach(email => {
      actions.push({
        id: `email_${email.id}`,
        type: 'response',
        title: `Response needed from ${email.company || 'Unknown'}`,
        subtitle: email.email_type === 'offer' ? 'Job Offer' : 'Interview Request',
        urgent: true,
        icon: <MessageSquare className="w-4 h-4" />,
        action: () => window.location.href = '/dashboard#inbox'
      })
    })
    
    // Add from email actions
    emails.forEach(email => {
      email.action_items?.forEach((item: ActionItem) => {
        if (item.priority === 'high') {
          actions.push({
            id: `action_${email.id}_${item.task}`,
            type: 'response',
            title: item.task,
            subtitle: `From ${email.company} - ${item.deadline ? `Due ${format(new Date(item.deadline), 'MMM d')}` : ''}`,
            urgent: true,
            icon: <AlertCircle className="w-4 h-4" />,
            action: () => window.location.href = '/dashboard#inbox'
          });
        }
      });
    });
    
    return actions.sort((a, b) => (b.urgent ? 1 : 0) - (a.urgent ? 1 : 0)).slice(0, 5)
  }, [jobApplications, emails])

  // Recent activity filtered by selected date
  const recentActivity = useMemo(() => {
    const items: RecentItem[] = []
    const dayStart = startOfDay(selectedDate)
    const dayEnd = endOfDay(selectedDate)
    
    // Recent emails for selected date
    emails.forEach(email => {
      const emailDate = new Date(email.received_at)
      if (emailDate >= dayStart && emailDate <= dayEnd) {
        items.push({
          id: `email_${email.id}`,
          type: 'email',
          title: `Email from ${email.company || 'Unknown Company'}`,
          subtitle: email.email_type === 'interview' ? 'Interview' : 
                   email.email_type === 'offer' ? 'Job Offer' : 
                   email.email_type === 'rejection' ? 'Decision' : 'Update',
          time: format(emailDate, 'h:mm a'),
          date: emailDate,
          icon: <Mail className="w-4 h-4" />
        })
      }
    })
    
    // Recent applications for selected date
    jobApplications.forEach(app => {
      if (app.appliedDate) {
        const appDate = new Date(app.appliedDate)
        if (appDate >= dayStart && appDate <= dayEnd) {
          items.push({
            id: `app_${app.id}`,
            type: 'application',
            title: `Applied to ${app.company}`,
            subtitle: app.position || 'Position',
            time: format(appDate, 'h:mm a'),
            date: appDate,
            icon: <FileText className="w-4 h-4" />
          })
        }
      }
    })
    
    // Add recent actions/events
    emails.forEach(email => {
      if (email.action_items?.length > 0 || email.extracted_events?.length > 0) {
        const emailDate = new Date(email.received_at);
        if (emailDate >= dayStart && emailDate <= dayEnd) {
          items.push({
            id: `activity_${email.id}`,
            type: 'email',
            title: `New activity from ${email.company}`,
            subtitle: `${email.action_items?.length} actions, ${email.extracted_events?.length} events`,
            time: format(emailDate, 'h:mm a'),
            date: emailDate,
            icon: <Mail className="w-4 h-4" />
          });
        }
      }
    });
    
    return items.sort((a, b) => b.date.getTime() - a.date.getTime())
  }, [emails, jobApplications, selectedDate])

  const formatDateDisplay = (date: Date) => {
    if (isToday(date)) return 'Today'
    if (isTomorrow(date)) return 'Tomorrow'
    if (differenceInDays(date, new Date()) === -1) return 'Yesterday'
    return format(date, 'MMM d, yyyy')
  }

  return (
    <div className="w-full h-full overflow-y-auto">
      <div className="p-6 space-y-8">
        {/* Priority Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-5"
        >
          <h3 className="text-xl font-bold text-foreground bg-gradient-to-r from-foreground via-foreground to-foreground/80 bg-clip-text">
            Priority Actions
          </h3>
          
          {priorityActions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-base font-semibold text-foreground mb-2">All caught up!</p>
              <p className="text-sm text-muted-foreground">No urgent actions needed right now.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {priorityActions.map((action, index) => (
                <motion.div
                  key={action.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  onMouseEnter={() => setHoveredCard(action.id)}
                  onMouseLeave={() => setHoveredCard(null)}
                  onClick={action.action}
                  className={cn(
                    "flex items-center gap-4 p-5 rounded-2xl border cursor-pointer transition-all group shadow-md hover:shadow-lg",
                    action.urgent 
                      ? "bg-card/60 border-red-200 dark:border-red-800 hover:bg-card/80 hover:border-red-300 dark:hover:border-red-700" 
                      : "bg-card/60 border-border/50 hover:bg-card/80 hover:border-border/80"
                  )}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h4 className="text-sm font-semibold text-foreground truncate">{action.title}</h4>
                      {action.urgent && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-gradient-to-r from-red-500 to-orange-500 text-white text-xs font-semibold shadow-sm">
                          Urgent
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground font-medium">{action.subtitle}</p>
                  </div>
                  {action.time && (
                    <div className="text-xs text-muted-foreground font-semibold bg-secondary/50 px-2 py-1 rounded-lg">
                      {action.time}
                    </div>
                  )}
                  <motion.div
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ 
                      opacity: hoveredCard === action.id ? 1 : 0.4, 
                      x: hoveredCard === action.id ? 0 : -5 
                    }}
                    transition={{ duration: 0.2 }}
                    className="group-hover:opacity-100"
                  >
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </motion.div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Recent Activity with Date Navigator */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="space-y-5"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-foreground">Recent Activity</h3>
            
            {/* Compact Date Navigator */}
            <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1 border border-border/30">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedDate(subDays(selectedDate, 1))}
                className="p-1.5 rounded-md hover:bg-background/50 text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </motion.button>
              
              <div className="px-3 py-1.5 text-xs font-medium text-foreground min-w-[80px] text-center">
                {formatDateDisplay(selectedDate)}
              </div>
              
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedDate(addDays(selectedDate, 1))}
                disabled={isToday(selectedDate)}
                className={cn(
                  "p-1.5 rounded-md transition-colors",
                  isToday(selectedDate) 
                    ? "text-muted-foreground/50 cursor-not-allowed"
                    : "hover:bg-background/50 text-muted-foreground hover:text-foreground"
                )}
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </motion.button>
            </div>
          </div>
          
          {recentActivity.length === 0 ? (
            <p className="text-sm font-medium text-muted-foreground text-center py-8">No activity for {formatDateDisplay(selectedDate)}</p>
          ) : (
            <div className="space-y-3">
              {recentActivity.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className="flex items-center gap-4 p-4 rounded-xl bg-card/60 hover:bg-card/80 transition-all border border-border/30 shadow-sm hover:shadow-md"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{item.title}</p>
                    <p className="text-xs text-muted-foreground font-medium">{item.subtitle}</p>
                  </div>
                  <div className="text-xs text-muted-foreground font-semibold bg-secondary/50 px-2 py-1 rounded-lg whitespace-nowrap">
                    {item.time}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}