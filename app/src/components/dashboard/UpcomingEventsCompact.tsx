'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Calendar, Clock, MapPin, Video, Users, AlertCircle, ChevronDown, ChevronUp, Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { staggerContainer, staggerItem, hoverScale, tapScale, fadeInUp } from '@/lib/animations'
import { useJobApplications } from '@/hooks/useJobApplications'

interface Event {
  id: string
  title: string
  company: string
  type: 'interview' | 'phone_screen' | 'technical' | 'onsite' | 'final'
  date: Date
  time: string
  duration: string
  location?: string
  isVirtual: boolean
  meetingLink?: string
  interviewers?: string[]
  notes?: string
}

interface ExtractedEvent {
  title: string;
  date: string;
  time?: string;
  type: string;
  details?: string;
}

export function UpcomingEventsCompact() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [isExpanded, setIsExpanded] = useState(false)
  const [showAddEventModal, setShowAddEventModal] = useState(false)
  const [newEvent, setNewEvent] = useState({
    title: '',
    company: '',
    type: 'interview' as Event['type'],
    date: '',
    time: '',
    duration: '30 min',
    location: '',
    isVirtual: true,
    meetingLink: '',
    notes: ''
  })

  const { applications: jobApplications, emails } = useJobApplications()

  useEffect(() => {
    // Derive events from jobApplications timeline
    const upcoming: Event[] = []
    const now = new Date()
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    jobApplications.forEach(app => {
      (app.timeline || []).forEach((item: any) => {
        if (item.type === 'interview' && item.date) {
          const d = new Date(item.date)
          if (d >= now && d <= thirtyDays) {
            upcoming.push({
              id: `${app.id}_${item.id || d.getTime()}`,
              title: item.title || 'Interview',
              company: app.company,
              type: 'interview',
              date: d,
              time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              duration: item.duration || '30 min',
              isVirtual: !!item.is_virtual,
              meetingLink: item.meeting_link,
              interviewers: item.interviewers,
              location: item.location
            })
          }
        }
      })
    })

    // Add events from emails
    emails?.forEach(email => {
      email.extracted_events?.forEach((evt: ExtractedEvent) => {
        const d = new Date(evt.date);
        if (d >= now && d <= thirtyDays) {
          upcoming.push({
            id: `email_event_${email.id}_${evt.title}`,
            title: evt.title,
            company: email.company,
            type: evt.type as Event['type'],
            date: d,
            time: evt.time || '',
            duration: 'TBD',
            isVirtual: evt.type === 'interview',  // Assume
            location: evt.details
          });
        }
      });
    });

    // sort by date
    upcoming.sort((a,b) => a.date.getTime() - b.date.getTime())

    setEvents(upcoming)
    setLoading(false)
  }, [jobApplications, emails])

  const getEventTypeColor = (type: Event['type']) => {
    switch (type) {
      case 'interview': return 'bg-gradient-to-r from-blue-500/15 to-indigo-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30'
      case 'phone_screen': return 'bg-gradient-to-r from-emerald-500/15 to-teal-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
      case 'technical': return 'bg-gradient-to-r from-purple-500/15 to-violet-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30'
      case 'onsite': return 'bg-gradient-to-r from-amber-500/15 to-orange-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
      case 'final': return 'bg-gradient-to-r from-pink-500/15 to-rose-500/15 text-pink-600 dark:text-pink-400 border-pink-500/30'
    }
  }

  const formatDate = (date: Date) => {
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today'
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow'
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
  }

  const getUpcomingEventsCount = () => {
    const oneWeekFromNow = new Date()
    oneWeekFromNow.setDate(oneWeekFromNow.getDate() + 7)
    return events.filter(event => event.date <= oneWeekFromNow).length
  }

  const handleAddEvent = () => {
    setShowAddEventModal(true)
  }

  const handleSaveEvent = () => {
    if (!newEvent.title || !newEvent.company || !newEvent.date || !newEvent.time) {
      return
    }

    const dateTime = new Date(`${newEvent.date}T${newEvent.time}`)
    const event: Event = {
      id: `manual_${Date.now()}`,
      title: newEvent.title,
      company: newEvent.company,
      type: newEvent.type,
      date: dateTime,
      time: newEvent.time,
      duration: newEvent.duration,
      location: newEvent.location,
      isVirtual: newEvent.isVirtual,
      meetingLink: newEvent.meetingLink,
      notes: newEvent.notes
    }

    setEvents(prev => [...prev, event].sort((a, b) => a.date.getTime() - b.date.getTime()))
    setShowAddEventModal(false)
    
    // Reset form
    setNewEvent({
      title: '',
      company: '',
      type: 'interview',
      date: '',
      time: '',
      duration: '30 min',
      location: '',
      isVirtual: true,
      meetingLink: '',
      notes: ''
    })
  }

  if (loading) {
    return (
      <div className="px-4 py-4">
        <div className="animate-pulse space-y-2">
          <div className="h-3 bg-muted rounded w-1/3" />
          <div className="h-8 bg-muted rounded" />
        </div>
      </div>
    )
  }

  const upcomingCount = getUpcomingEventsCount()

  return (
    <div className="px-4 py-4">
      {/* Compact Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xl font-bold text-foreground">
          Upcoming Events
        </h3>
        
        <div className="flex items-center gap-2">
          {events.length > 0 ? (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground text-xs">
              {upcomingCount}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">No upcoming events</span>
          )}
          
          <div className="flex items-center gap-1">
            <button
              onClick={handleAddEvent}
              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Add event"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title={isExpanded ? "Collapse" : "Expand"}
            >
              <motion.div
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </motion.div>
            </button>
          </div>
        </div>
      </div>
      
      {/* Collapsed preview - only show if there are events */}
      {!isExpanded && events.length > 0 && events[0] && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="text-xs text-muted-foreground"
        >
          <div className="flex items-center gap-1.5 truncate">
            <span className="font-medium">{events[0].company}</span>
            <span>•</span>
            <span className="truncate">{events[0].title}</span>
            <span>•</span>
            <span className="text-xs">{formatDate(events[0].date)}</span>
          </div>
        </motion.div>
      )}
      
      {/* Collapsible expanded content */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            {events.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="w-12 h-12 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">No upcoming events</p>
                <button
                  onClick={handleAddEvent}
                  className="mt-3 text-xs text-foreground font-medium hover:text-foreground/80 transition-colors"
                >
                  Add your first event
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {events.map((event, index) => (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="p-3 rounded-lg border border-foreground/5 hover:border-foreground/10 bg-card/50 hover:bg-card/80 transition-all cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-sm font-semibold truncate">{event.title}</h4>
                          <Badge variant="secondary" className={cn("text-xs", getEventTypeColor(event.type))}>
                            {event.type.replace('_', ' ')}
                          </Badge>
                        </div>
                        
                        <p className="text-xs text-muted-foreground mb-2">{event.company}</p>
                        
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(event.date)} • {event.time}
                          </span>
                          
                          {event.isVirtual ? (
                            <span className="flex items-center gap-1">
                              <Video className="w-3 h-3" />
                              Virtual
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              Onsite
                            </span>
                          )}
                        </div>
                        
                        {event.interviewers && event.interviewers.length > 0 && (
                          <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                            <Users className="w-3 h-3" />
                            <span>{event.interviewers.join(', ')}</span>
                          </div>
                        )}
                      </div>
                      
                      {event.date.getTime() - Date.now() < 48 * 60 * 60 * 1000 && (
                        <AlertCircle className="w-4 h-4 text-primary flex-shrink-0" />
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Event Modal */}
      <Dialog open={showAddEventModal} onOpenChange={setShowAddEventModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Add New Event</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Event Title</Label>
                <Input
                  id="title"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g., Technical Interview"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="company">Company</Label>
                <Input
                  id="company"
                  value={newEvent.company}
                  onChange={(e) => setNewEvent(prev => ({ ...prev, company: e.target.value }))}
                  placeholder="e.g., Google"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={newEvent.date}
                  onChange={(e) => setNewEvent(prev => ({ ...prev, date: e.target.value }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="time">Time</Label>
                <Input
                  id="time"
                  type="time"
                  value={newEvent.time}
                  onChange={(e) => setNewEvent(prev => ({ ...prev, time: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">Event Type</Label>
                <select
                  id="type"
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  value={newEvent.type}
                  onChange={(e) => setNewEvent(prev => ({ ...prev, type: e.target.value as Event['type'] }))}
                >
                  <option value="interview">Interview</option>
                  <option value="phone_screen">Phone Screen</option>
                  <option value="technical">Technical</option>
                  <option value="onsite">Onsite</option>
                  <option value="final">Final Round</option>
                </select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="duration">Duration</Label>
                <Input
                  id="duration"
                  value={newEvent.duration}
                  onChange={(e) => setNewEvent(prev => ({ ...prev, duration: e.target.value }))}
                  placeholder="e.g., 30 min"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Format</Label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={newEvent.isVirtual}
                    onChange={() => setNewEvent(prev => ({ ...prev, isVirtual: true }))}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Virtual</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={!newEvent.isVirtual}
                    onChange={() => setNewEvent(prev => ({ ...prev, isVirtual: false }))}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">In-person</span>
                </label>
              </div>
            </div>

            {newEvent.isVirtual ? (
              <div className="space-y-2">
                <Label htmlFor="meetingLink">Meeting Link</Label>
                <Input
                  id="meetingLink"
                  value={newEvent.meetingLink}
                  onChange={(e) => setNewEvent(prev => ({ ...prev, meetingLink: e.target.value }))}
                  placeholder="e.g., https://zoom.us/..."
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={newEvent.location}
                  onChange={(e) => setNewEvent(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="e.g., 123 Main St, San Francisco"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowAddEventModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveEvent}
              disabled={!newEvent.title || !newEvent.company || !newEvent.date || !newEvent.time}
            >
              Add Event
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}