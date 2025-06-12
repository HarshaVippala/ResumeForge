'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { X, Mail, Calendar, MapPin, Briefcase, DollarSign, User, Phone } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmailDetailsModalProps {
  email: any
  onClose: () => void
}

export function EmailDetailsModal({ email, onClose }: EmailDetailsModalProps) {
  if (!email) return null

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

  // Extract clean details without redundancy
  const details = email.extracted_details || {}
  const hasValidValue = (value: any) => {
    return value && 
           value !== '' && 
           value !== 'N/A' && 
           value !== '[]' &&
           !value.includes('[') &&
           value !== 'null' &&
           value !== 'undefined'
  }

  // Create meaningful summary if not provided
  const summary = details.summary || email.summary || (() => {
    if (email.type === 'rejection') {
      return `${email.company || 'Company'} has decided not to move forward with your application`
    } else if (email.type === 'interview') {
      return `Interview invitation from ${email.company || 'company'}`
    } else if (email.type === 'recruiter') {
      return `Job opportunity from ${email.company || 'recruiter'}`
    }
    return email.subject
  })()

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-md" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[85vh] overflow-y-auto shadow-2xl ring-1 ring-black/5 dark:ring-white/10" 
           onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-blue-500" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                From: {email.sender || email.from || 'Unknown Sender'}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-300">{email.subject}</p>
            </div>
            <Badge className={cn(getEmailTypeColor(email.type))}>
              {getEmailTypeLabel(email.type)}
            </Badge>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="space-y-6">
          {/* Key Information Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Date */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <Calendar className="h-4 w-4 text-blue-500" />
              <div>
                <span className="text-gray-600 dark:text-gray-300 text-sm">Date:</span>
                <div className="font-medium text-gray-900 dark:text-gray-100">
                  {email.timestamp ? new Date(email.timestamp).toLocaleDateString('en-US', {
                    weekday: 'short',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  }) : 'Not available'}
                </div>
              </div>
            </div>

            {/* Position */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <Briefcase className="h-4 w-4 text-purple-500" />
              <div>
                <span className="text-gray-600 dark:text-gray-300 text-sm">Position:</span>
                <div className="font-medium text-gray-900 dark:text-gray-100">
                  {hasValidValue(details.job_title) ? details.job_title : 
                   hasValidValue(details.position) ? details.position :
                   email.position || 'Not specified'}
                </div>
              </div>
            </div>

            {/* Contact */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg col-span-2">
              <User className="h-4 w-4 text-green-500" />
              <div>
                <span className="text-gray-600 dark:text-gray-300 text-sm">Contact:</span>
                <div className="font-medium text-gray-900 dark:text-gray-100">
                  {hasValidValue(details.recruiter_name) ? details.recruiter_name :
                   hasValidValue(details.contact_name) ? details.contact_name :
                   email.contact || email.from || 'Not provided'}
                </div>
                {hasValidValue(details.recruiter_email) && (
                  <div className="text-sm text-blue-600 dark:text-blue-400">{details.recruiter_email}</div>
                )}
              </div>
            </div>
          </div>

          {/* Additional Information */}
          <div className="grid grid-cols-2 gap-4">
            {/* Company */}
            {(email.company || hasValidValue(details.company)) && (
              <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <Briefcase className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <div>
                  <span className="text-blue-700 dark:text-blue-300 text-sm font-medium">Company:</span>
                  <div className="font-semibold text-blue-900 dark:text-blue-100">
                    {email.company || details.company}
                  </div>
                </div>
              </div>
            )}

            {/* Location */}
            {hasValidValue(details.location) && (
              <div className="flex items-center gap-3 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                <MapPin className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                <div>
                  <span className="text-orange-700 dark:text-orange-300 text-sm font-medium">Location:</span>
                  <div className="font-semibold text-orange-900 dark:text-orange-100">{details.location}</div>
                </div>
              </div>
            )}

            {/* Salary */}
            {hasValidValue(details.salary_range) && (
              <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 col-span-2">
                <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
                <div>
                  <span className="text-green-700 dark:text-green-300 text-sm font-medium">Salary Range:</span>
                  <div className="font-semibold text-green-900 dark:text-green-100">{details.salary_range}</div>
                </div>
              </div>
            )}
          </div>

          {/* Summary */}
          {summary && (
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/10 dark:to-purple-900/10 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h3 className="font-semibold mb-3 text-blue-900 dark:text-blue-100 flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Summary
              </h3>
              <p className="text-gray-700 dark:text-gray-200 leading-relaxed">{summary}</p>
            </div>
          )}

          {/* Interview Details (if applicable) */}
          {email.type === 'interview' && (hasValidValue(details.interview_date) || hasValidValue(details.interview_time)) && (
            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h3 className="font-medium mb-2 text-sm text-blue-900 dark:text-blue-100">Interview Details</h3>
              <div className="space-y-1 text-sm">
                {hasValidValue(details.interview_date) && (
                  <p className="text-blue-800 dark:text-blue-200">Date: <span className="font-medium">{details.interview_date}</span></p>
                )}
                {hasValidValue(details.interview_time) && (
                  <p className="text-blue-800 dark:text-blue-200">Time: <span className="font-medium">{details.interview_time}</span></p>
                )}
                {hasValidValue(details.interview_platform) && (
                  <p className="text-blue-800 dark:text-blue-200">Platform: <span className="font-medium">{details.interview_platform}</span></p>
                )}
              </div>
            </div>
          )}

          {/* Action Required */}
          {hasValidValue(details.action_required) && (
            <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <h3 className="font-medium mb-1 text-sm text-yellow-900 dark:text-yellow-100">Action Required</h3>
              <p className="text-sm text-yellow-800 dark:text-yellow-200">{details.action_required}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">
            <Button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm">
              Add to Job Tracker
            </Button>
            <Button variant="outline" className="border-2 border-purple-600 text-purple-600 hover:bg-purple-600 hover:text-white px-4 py-2 rounded-lg font-medium transition-all">
              Create Resume Version
            </Button>
            {hasValidValue(details.recruiter_email) && (
              <Button variant="outline" className="border-2 border-green-600 text-green-600 hover:bg-green-600 hover:text-white px-4 py-2 rounded-lg font-medium transition-all">
                Reply
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}