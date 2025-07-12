'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Heart, 
  ExternalLink, 
  Zap, 
  RefreshCw,
  MapPin, 
  Building2, 
  Calendar,
  Clock,
  DollarSign
} from 'lucide-react'
import { cn } from '@/lib/utils'

export function JobCard({ 
  job, 
  onJobClick, 
  onSaveJob, 
  onTailorResume, 
  isGeneratingResume = false 
}) {
  const [isHovered, setIsHovered] = useState(false)

  // Format date for display with detailed time info
  const formatJobDate = (dateString) => {
    try {
      const date = new Date(dateString)
      const now = new Date()
      const diffMs = now.getTime() - date.getTime()
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

      if (diffHours < 1) return 'Just posted'
      if (diffHours < 24) return `${diffHours}h ago`
      if (diffDays === 1) return 'Yesterday'
      if (diffDays < 7) return `${diffDays}d ago`
      return date.toLocaleDateString()
    } catch {
      return 'Unknown'
    }
  }

  // Get time-based styling for freshness indicator
  const getTimeBasedStyle = (dateString) => {
    try {
      const date = new Date(dateString)
      const now = new Date()
      const diffMs = now.getTime() - date.getTime()
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
      
      if (diffHours < 6) return 'bg-green-100 text-green-800 border border-green-200'
      if (diffHours < 24) return 'bg-blue-100 text-blue-800 border border-blue-200'
      return 'bg-gray-100 text-gray-700'
    } catch {
      return 'bg-gray-100 text-gray-700'
    }
  }

  // Format salary for display
  const formatSalary = (minSalary, maxSalary, currency = 'USD') => {
    if (!minSalary && !maxSalary) return null
    
    const formatNumber = (num) => {
      if (num >= 1000) {
        return `${(num / 1000).toFixed(0)}K`
      }
      return num.toString()
    }

    if (minSalary && maxSalary && minSalary !== maxSalary) {
      return `$${formatNumber(minSalary)} - $${formatNumber(maxSalary)}`
    }
    
    return `$${formatNumber(minSalary || maxSalary || 0)}`
  }

  // Get experience level color
  const getExperienceLevelColor = (level) => {
    switch (level) {
      case 'entry': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'mid': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'senior': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    }
  }

  // Get platform color
  const getPlatformColor = (platform) => {
    switch (platform) {
      case 'indeed': return 'bg-blue-500'
      case 'glassdoor': return 'bg-green-500'
      case 'ziprecruiter': return 'bg-orange-500'
      case 'linkedin': return 'bg-blue-600'
      default: return 'bg-gray-500'
    }
  }

  const handleCardClick = (e) => {
    // Don't trigger if clicking on action buttons
    if (e.target.closest('.job-actions')) {
      return
    }
    onJobClick(job, e)
  }

  const handleSaveClick = (e) => {
    e.stopPropagation()
    onSaveJob(job.job_id)
  }

  const handleApplyClick = (e) => {
    e.stopPropagation()
    window.open(job.application_url, '_blank')
  }

  const handleTailorClick = (e) => {
    e.stopPropagation()
    onTailorResume(job, e)
  }

  return (
    <div 
      className={cn(
        "group relative flex flex-col rounded-lg border border-gray-200 bg-white p-4 transition-all duration-200 cursor-pointer",
        "hover:shadow-md hover:border-blue-300 hover:bg-gray-50/50"
      )}
      onClick={handleCardClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header with logo, title, company */}
      <div className="flex items-start gap-3 mb-3">
        {/* Company Logo Placeholder */}
        <div className="h-12 w-12 rounded-md flex-shrink-0 bg-gray-50 border border-gray-200 flex items-center justify-center">
          <Building2 className="h-6 w-6 text-foreground/50" />
        </div>
        
        <div className="flex-grow min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold text-base text-gray-900 group-hover:text-blue-600 truncate">
              {job.title}
            </h3>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <div className={cn("w-1.5 h-1.5 rounded-full", getPlatformColor(job.platform))}></div>
              <span className="text-xs text-foreground/60 capitalize">{job.platform}</span>
            </div>
          </div>
          <p className="text-sm font-medium text-foreground/70">{job.company}</p>
        </div>

        {/* Save button */}
        <button 
          onClick={handleSaveClick}
          aria-label="Save job"
          className="job-actions relative z-10 p-1.5 text-foreground/50 hover:text-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded-full transition-colors"
        >
          <Heart className="h-4 w-4" />
        </button>
      </div>

      {/* Metadata pills */}
      <div className="flex flex-wrap gap-1.5 mb-3 text-xs">
        {job.location && (
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 font-medium text-gray-700">
            <MapPin className="h-3 w-3" />
            {job.location}
          </span>
        )}
        {job.remote && (
          <Badge variant="secondary" className="text-xs h-6 px-2">
            Remote
          </Badge>
        )}
        <span className={cn(
          "inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-medium text-xs",
          getTimeBasedStyle(job.discovered_at || job.scraped_at)
        )}>
          <Clock className="h-3 w-3" />
          {formatJobDate(job.discovered_at || job.scraped_at)}
        </span>
        {job.experience_level && (
          <Badge className={cn("text-xs h-6 px-2", getExperienceLevelColor(job.experience_level))}>
            {job.experience_level}
          </Badge>
        )}
        {(job.salary_min || job.salary_max) && (
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 font-medium text-gray-700">
            <DollarSign className="h-3 w-3" />
            {formatSalary(job.salary_min, job.salary_max, job.salary_currency)}
          </span>
        )}
      </div>

      {/* Description */}
      <p className="mb-4 text-sm text-gray-700 line-clamp-3 leading-relaxed">
        {job.description_preview || job.description?.substring(0, 200) + '...'}
      </p>

      {/* Skills - Footer */}
      <div className="mt-auto border-t border-gray-100 pt-3">
        {job.skills && job.skills.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {job.skills.slice(0, 4).map((skill, index) => (
              <span 
                key={index}
                className="rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-800"
              >
                {skill}
              </span>
            ))}
            {job.skills.length > 4 && (
              <span className="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-foreground/60">
                +{job.skills.length - 4}
              </span>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="job-actions flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleApplyClick}
            className="flex-1 h-8 text-xs"
          >
            <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
            Apply
          </Button>
          <Button
            size="sm"
            onClick={handleTailorClick}
            disabled={isGeneratingResume}
            className="flex-1 h-8 text-xs"
          >
            {isGeneratingResume ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Zap className="h-3.5 w-3.5 mr-1.5" />
                Resume
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}