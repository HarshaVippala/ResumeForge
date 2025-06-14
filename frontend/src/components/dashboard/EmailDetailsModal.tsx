'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  X, Mail, Calendar, MapPin, Briefcase, DollarSign, User, 
  Clock, ExternalLink, Phone, Video, FileText, AlertCircle,
  CheckCircle, Star, ArrowRight, Copy, MessageCircle, 
  Bookmark, Eye, Download, Share, Pin, Bell, Archive,
  MessageSquare, ChevronDown, ChevronUp, Send, Edit, Save
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'

interface EmailDetailsModalProps {
  email: any
  onClose: () => void
}

export function EmailDetailsModal({ email, onClose }: EmailDetailsModalProps) {
  const [showFullEmail, setShowFullEmail] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const [notes, setNotes] = useState('')
  const [activeTab, setActiveTab] = useState<'overview' | 'email' | 'timeline' | 'notes'>('overview')
  const [isSavingNotes, setIsSavingNotes] = useState(false)

  if (!email) return null

  // Extract data with better fallbacks
  const extractedData = email.extracted_data || {}
  const details = {
    ...(extractedData.classification || {}),
    ...(extractedData.content_analysis || {}),
    ...(extractedData.structured_data || {}),
    ...(email.extracted_details || {})
  }

  const hasValue = (value: any) => {
    if (!value || value === null || value === undefined) return false
    if (typeof value === 'string') {
      const trimmed = value.trim()
      return trimmed !== '' && 
             !['n/a', 'null', 'undefined', '[]', 'not specified', 'unknown'].includes(trimmed.toLowerCase())
    }
    return true
  }

  // Smart urgency detection
  const getUrgency = () => {
    const urgency = details.urgency || email.urgency || 'normal'
    const hasDeadline = hasValue(details.assessment_deadline) || hasValue(details.response_deadline)
    const isInterview = email.type === 'interview' || email.email_type === 'interview'
    
    if (hasDeadline || (isInterview && hasValue(details.interview_date))) return 'high'
    return urgency
  }

  const urgency = getUrgency()
  const emailType = email.type || email.email_type || 'other'
  const company = email.company || details.company || 'Unknown Company'
  const position = details.position || details.job_title || email.position
  const summary = details.actionable_summary || details.summary || email.summary || email.subject

  // Tab content components
  const OverviewTab = () => (
    <div className="space-y-6">
      {/* Status Banner */}
      <div className={cn(
        "p-4 rounded-xl border-l-4 flex items-center gap-3 shadow-sm",
        urgency === 'high' ? 'bg-red-50/50 border-red-500 dark:bg-red-950/10 dark:border-red-400' :
        urgency === 'normal' ? 'bg-blue-50/50 border-blue-500 dark:bg-blue-950/10 dark:border-blue-400' :
        'bg-accent/30 border-border dark:bg-elevation-3/50 dark:border-border'
      )}>
        <div className={cn(
          "p-2 rounded-lg backdrop-blur-sm",
          urgency === 'high' ? 'bg-red-100/80 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
          urgency === 'normal' ? 'bg-blue-100/80 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' :
          'bg-accent/50 text-muted-foreground dark:bg-elevation-3/50'
        )}>
          {emailType === 'interview' ? <Video className="h-5 w-5" /> :
           emailType === 'assessment' ? <FileText className="h-5 w-5" /> :
           emailType === 'offer' ? <Star className="h-5 w-5" /> :
           emailType === 'rejection' ? <AlertCircle className="h-5 w-5" /> :
           <Mail className="h-5 w-5" />}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {emailType === 'interview' ? 'Interview Scheduled' :
               emailType === 'assessment' ? 'Assessment Required' :
               emailType === 'offer' ? 'Job Offer Received' :
               emailType === 'rejection' ? 'Application Update' :
               emailType === 'recruiter' ? 'Recruiter Outreach' :
               'Email Communication'}
            </h3>
            <Badge variant={urgency === 'high' ? 'destructive' : 'secondary'} className="text-xs">
              {urgency === 'high' ? 'Urgent' : 'Standard'}
            </Badge>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {emailType === 'interview' && hasValue(details.interview_date) 
              ? `Scheduled for ${details.interview_date}${hasValue(details.interview_time) ? ` at ${details.interview_time}` : ''}`
              : emailType === 'assessment' && hasValue(details.assessment_deadline)
              ? `Due by ${details.assessment_deadline}`
              : summary}
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Button 
          size="sm" 
          className="flex flex-col h-16 gap-1 bg-blue-600 hover:bg-blue-700 text-white font-medium"
          onClick={handleAddToTracker}
        >
          <Briefcase className="h-4 w-4" />
          <span className="text-xs font-medium">Add to Tracker</span>
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          className="flex flex-col h-16 gap-1 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 font-medium"
          onClick={handleQuickReply}
        >
          <Send className="h-4 w-4" />
          <span className="text-xs font-medium text-gray-700 dark:text-gray-200">Quick Reply</span>
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          className="flex flex-col h-16 gap-1 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 font-medium"
          onClick={handleAddToCalendar}
        >
          <Calendar className="h-4 w-4" />
          <span className="text-xs font-medium text-gray-700 dark:text-gray-200">Add to Cal</span>
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          className="flex flex-col h-16 gap-1 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 font-medium"
          onClick={handleGenerateResume}
        >
          <FileText className="h-4 w-4" />
          <span className="text-xs font-medium text-gray-700 dark:text-gray-200">Gen Resume</span>
        </Button>
      </div>

      {/* Key Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-4">
          <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-600">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Contact Information</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">{details.recruiter_name || email.sender || 'Unknown'}</span>
              </div>
              {(details.recruiter_email || email.sender_email) && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                  <span className="text-sm text-blue-600 dark:text-blue-300">{details.recruiter_email || email.sender_email}</span>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-300">
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          {position && (
            <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-600">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Position Details</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{position}</span>
                </div>
                {hasValue(details.location) && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                    <span className="text-sm text-gray-900 dark:text-white">{details.location}</span>
                  </div>
                )}
                {hasValue(details.salary_range) && (
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                    <span className="text-sm text-gray-900 dark:text-white">{details.salary_range}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          {/* Interview/Assessment Specific */}
          {(emailType === 'interview' || emailType === 'assessment') && (
            <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-600">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                {emailType === 'interview' ? 'Interview Details' : 'Assessment Details'}
              </h4>
              <div className="space-y-2">
                {hasValue(details.interview_date || details.assessment_deadline) && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {details.interview_date || details.assessment_deadline}
                    </span>
                  </div>
                )}
                {hasValue(details.interview_time) && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                    <span className="text-sm text-gray-900 dark:text-white">{details.interview_time}</span>
                  </div>
                )}
                {hasValue(details.interview_platform) && (
                  <div className="flex items-center gap-2">
                    <Video className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                    <span className="text-sm text-gray-900 dark:text-white">{details.interview_platform}</span>
                  </div>
                )}
                {hasValue(details.assessment_type) && (
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                    <span className="text-sm text-gray-900 dark:text-white">{details.assessment_type}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Items */}
          {details.action_items && details.action_items.length > 0 && (
            <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-600">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Next Steps</h4>
              <div className="space-y-2">
                {details.action_items.slice(0, 3).map((item: any, idx: number) => (
                  <div key={idx} className="flex items-start gap-2 p-2 bg-gray-100 dark:bg-slate-700 rounded-lg">
                    <div className={cn(
                      "w-2 h-2 rounded-full mt-2 flex-shrink-0",
                      item.priority === 'high' ? 'bg-red-500' : 'bg-blue-500'
                    )} />
                    <span className="text-sm flex-1 text-gray-900 dark:text-white">{item.task}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Links */}
      {details.extracted_links && Object.keys(details.extracted_links).length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Quick Links</h4>
          <div className="flex flex-wrap gap-2">
            {details.extracted_links.calendar && (
              <Button variant="outline" size="sm" onClick={() => window.open(details.extracted_links.calendar, '_blank')} className="bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-slate-600">
                <Calendar className="h-3 w-3 mr-1" />
                Calendar
              </Button>
            )}
            {details.extracted_links.assessment && (
              <Button variant="outline" size="sm" onClick={() => window.open(details.extracted_links.assessment, '_blank')} className="bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-slate-600">
                <FileText className="h-3 w-3 mr-1" />
                Assessment
              </Button>
            )}
            {details.extracted_links.portal && (
              <Button variant="outline" size="sm" onClick={() => window.open(details.extracted_links.portal, '_blank')} className="bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-slate-600">
                <ExternalLink className="h-3 w-3 mr-1" />
                Portal
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )

  const EmailTab = () => {
    // Better email content extraction with multiple fallbacks
    const getEmailContent = () => {
      // Debug: Log email object structure
      console.log('Email object:', email)
      console.log('Email keys:', Object.keys(email))
      console.log('Extracted data:', extractedData)
      
      // Try multiple possible content fields
      const contentSources = [
        email.content,
        email.body,
        email.body_text, 
        email.body_html,
        email.snippet,
        details.full_content,
        extractedData?.raw_content,
        email.raw_content,
        // Try nested content
        email.payload?.body?.data,
        email.data?.body,
        email.message?.body
      ]
      
      for (const content of contentSources) {
        if (content && typeof content === 'string' && content.trim().length > 10) {
          console.log('Using content source:', content)
          return content.trim()
        }
      }
      
      // If no raw content found, construct a meaningful representation from available data
      const summary = email.actionable_summary || details.summary || email.summary
      const actionItems = details.action_items || []
      const interviewDetails = details.interview_date || details.interview_time || details.interview_platform
      
      if (summary || actionItems.length > 0 || interviewDetails) {
        let reconstructedContent = `Subject: ${email.subject}\n\n`
        
        if (summary) {
          reconstructedContent += `Summary:\n${summary}\n\n`
        }
        
        if (interviewDetails) {
          reconstructedContent += `Interview Details:\n`
          if (details.interview_date) reconstructedContent += `Date: ${details.interview_date}\n`
          if (details.interview_time) reconstructedContent += `Time: ${details.interview_time}\n`
          if (details.interview_platform) reconstructedContent += `Platform: ${details.interview_platform}\n`
          reconstructedContent += '\n'
        }
        
        if (actionItems.length > 0) {
          reconstructedContent += `Action Items:\n`
          actionItems.forEach((item: any, idx: number) => {
            reconstructedContent += `${idx + 1}. ${item.task || item}\n`
          })
          reconstructedContent += '\n'
        }
        
        if (details.recruiter_name || details.recruiter_email) {
          reconstructedContent += `Contact:\n`
          if (details.recruiter_name) reconstructedContent += `Name: ${details.recruiter_name}\n`
          if (details.recruiter_email) reconstructedContent += `Email: ${details.recruiter_email}\n`
        }
        
        reconstructedContent += `\n--- Original email content not available ---\nThis is a reconstructed view based on processed data.`
        
        return reconstructedContent
      }
      
      // If no content found, show debug info
      return `Email content not available. 

DEBUG INFO:
- Email ID: ${email.id || email.email_id || 'unknown'}
- Subject: ${email.subject || 'unknown'}
- Available fields: ${Object.keys(email).join(', ')}
- Snippet: ${email.snippet || 'none'}

This may be due to privacy settings, content filtering, or data structure changes.`
    }

    const emailContent = getEmailContent()

    return (
      <div className="space-y-6">
        {/* Email Headers */}
        <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-600">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300">From:</span>
              <div className="font-medium text-gray-900 dark:text-white mt-1">{email.sender || 'Unknown'}</div>
            </div>
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300">Date:</span>
              <div className="font-medium text-gray-900 dark:text-white mt-1">
                {(email.timestamp || email.email_date) ? new Date(email.timestamp || email.email_date).toLocaleString() : 'Unknown'}
              </div>
            </div>
            <div className="col-span-2">
              <span className="font-medium text-gray-700 dark:text-gray-300">Subject:</span>
              <div className="font-medium text-gray-900 dark:text-white mt-1">{email.subject}</div>
            </div>
          </div>
        </div>

        {/* Email Content */}
        <div className="border border-gray-200 dark:border-slate-600 rounded-xl overflow-hidden">
          <div className="p-3 bg-gray-100 dark:bg-slate-700 border-b border-gray-200 dark:border-slate-600">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Email Content</h3>
          </div>
          <div className="p-6 max-h-96 overflow-y-auto bg-white dark:bg-slate-800">
            <div className="prose prose-sm dark:prose-invert max-w-none text-gray-900 dark:text-white leading-relaxed">
              {emailContent.split('\n').map((line, index) => (
                <p key={index} className="mb-2 last:mb-0 text-gray-900 dark:text-white">
                  {line || '\u00A0'}
                </p>
              ))}
            </div>
          </div>
        </div>

        {/* Email Actions */}
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-slate-600 font-medium"
            disabled={true}
          >
            <Send className="h-4 w-4 mr-2" />
            <span className="text-gray-700 dark:text-gray-200">Reply</span>
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-slate-600 font-medium"
            onClick={() => navigator.clipboard.writeText(emailContent)}
          >
            <Copy className="h-4 w-4 mr-2" />
            <span className="text-gray-700 dark:text-gray-200">Copy Content</span>
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-slate-600 font-medium"
            disabled={true}
          >
            <Archive className="h-4 w-4 mr-2" />
            <span className="text-gray-700 dark:text-gray-200">Archive</span>
          </Button>
        </div>
      </div>
    )
  }

  // Handler functions for button actions
  const handleSaveNotes = async () => {
    if (!notes.trim()) {
      alert('Please enter some notes before saving.')
      return
    }
    
    setIsSavingNotes(true)
    try {
      // TODO: Implement actual save to backend
      console.log('Saving notes for email:', email.id, 'Notes:', notes)
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      alert('Notes saved successfully!')
    } catch (error) {
      console.error('Failed to save notes:', error)
      alert('Failed to save notes. Please try again.')
    } finally {
      setIsSavingNotes(false)
    }
  }

  const handleExportPDF = () => {
    // TODO: Implement PDF export functionality
    console.log('Exporting email details to PDF:', email.id)
    alert('PDF export feature coming soon!')
  }

  const handleAddToTracker = () => {
    // TODO: Implement add to job tracker functionality
    console.log('Adding to job tracker:', email)
    alert('Add to tracker feature coming soon!')
  }

  const handleQuickReply = () => {
    // TODO: Implement quick reply functionality
    console.log('Opening quick reply for:', email)
    alert('Quick reply feature coming soon!')
  }

  const handleAddToCalendar = () => {
    // TODO: Implement calendar integration
    console.log('Adding to calendar:', email)
    alert('Calendar integration coming soon!')
  }

  const handleGenerateResume = () => {
    // TODO: Implement resume generation
    console.log('Generating resume for:', email)
    alert('Resume generation feature coming soon!')
  }

  const NotesTab = () => (
    <div className="space-y-6">
      <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-600">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 block">
          Add your notes about this opportunity
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Track your thoughts, prepare interview questions, note follow-up actions..."
          className="w-full h-32 p-3 border border-gray-300 dark:border-slate-600 rounded-lg resize-none bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50"
        />
      </div>
      <div className="flex gap-2">
        <Button 
          size="sm" 
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium"
          onClick={handleSaveNotes}
          disabled={isSavingNotes}
        >
          <Save className="h-4 w-4 mr-2" />
          <span className="text-white">{isSavingNotes ? 'Saving...' : 'Save Notes'}</span>
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          className="bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-slate-600 font-medium"
          onClick={handleExportPDF}
        >
          <Download className="h-4 w-4 mr-2" />
          <span className="text-gray-700 dark:text-gray-200">Export PDF</span>
        </Button>
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl max-w-4xl w-full mx-4 max-h-[95vh] overflow-hidden shadow-2xl" 
           onClick={(e) => e.stopPropagation()}>
        
        {/* Compact Header - Match dashboard theme */}
        <div className="border-b border-gray-200 dark:border-slate-700 p-4 bg-gray-50 dark:bg-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-200 dark:border-blue-700 rounded-xl flex items-center justify-center">
                <span className="text-blue-700 dark:text-blue-300 font-bold text-sm">
                  {company.slice(0, 2).toUpperCase()}
                </span>
              </div>
              <div>
                <h2 className="font-bold text-lg text-gray-900 dark:text-white">{company}</h2>
                <p className="text-sm text-gray-600 dark:text-gray-300">{position || 'Position not specified'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
                <Bookmark className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
                <Share className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={onClose} className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Tab Navigation - Match dashboard theme */}
        <div className="border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800">
          <div className="flex">
            {[
              { id: 'overview', label: 'Overview', icon: Eye },
              { id: 'email', label: 'Full Email', icon: Mail },
              { id: 'notes', label: 'My Notes', icon: Edit }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all duration-300",
                  activeTab === tab.id
                    ? "border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30"
                    : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700"
                )}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(95vh-180px)] bg-white dark:bg-slate-900 text-gray-900 dark:text-white">
          {activeTab === 'overview' && <OverviewTab />}
          {activeTab === 'email' && <EmailTab />}
          {activeTab === 'notes' && <NotesTab />}
        </div>
      </div>
    </div>
  )
}