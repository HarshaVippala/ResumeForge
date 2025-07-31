'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Download, 
  Eye, 
  MoreHorizontal, 
  Calendar, 
  Star,
  ExternalLink,
  Copy,
  Trash2,
  Edit,
  FileText,
  Loader2,
  Plus,
  ChevronRight,
  TrendingUp
} from 'lucide-react'
import Link from 'next/link'
import type { Resume } from '@/types'
import { getATSScoreColor } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface ResumeGridProps {
  resumes: Resume[]
  isLoading: boolean
  viewMode: 'all' | 'week' | 'month' | 'starred'
}

interface CompactResumeCardProps {
  resume: Resume
}

function CompactResumeCard({ resume }: CompactResumeCardProps) {
  const [isDownloading, setIsDownloading] = useState(false)
  const [showActions, setShowActions] = useState(false)
  const [isStarred, setIsStarred] = useState(
    resume.metadata.customTags.includes('starred')
  )

  const handleDownload = async (format: 'pdf' | 'docx' = 'pdf') => {
    setIsDownloading(true)
    try {
      // Updated: 2025-01-09 - Use new API endpoint to download from database
      const response = await fetch(`/api/resume/${resume.id}/export?format=${format}`)
      
      if (!response.ok) {
        throw new Error('Download failed')
      }
      
      // Get the blob from response
      const blob = await response.blob()
      
      // Create download link
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${resume.company}_${resume.role}_Resume.${format}`.replace(/\s+/g, '_')
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      // Clean up
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Download failed:', error)
    } finally {
      setIsDownloading(false)
    }
  }

  const toggleStar = async () => {
    setIsStarred(!isStarred)
    // Star functionality is currently local-only
    // Can be enhanced later to persist to database if needed
  }

  const daysSinceCreated = Math.floor(
    (Date.now() - new Date(resume.created_at).getTime()) / (1000 * 60 * 60 * 24)
  )

  const daysSinceApplied = resume.metadata.jobDetails.applicationDate
    ? Math.floor((Date.now() - new Date(resume.metadata.jobDetails.applicationDate).getTime()) / (1000 * 60 * 60 * 24))
    : null

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'offer': return 'bg-emerald-500 text-white border border-emerald-600 shadow-sm'
      case 'technical-interview':
      case 'onsite-interview': return 'bg-blue-500 text-white border border-blue-600 shadow-sm'
      case 'phone-interview': return 'bg-purple-500 text-white border border-purple-600 shadow-sm'
      case 'rejected': return 'bg-red-500 text-white border border-red-600 shadow-sm'
      case 'applied': return 'bg-gray-500 text-white border border-gray-600 shadow-sm'
      default: return 'bg-gray-500 text-white border border-gray-600 shadow-sm'
    }
  }

  return (
    <Card className="group hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 bg-card border-border">
      <CardContent className="p-4">
        {/* Header Row */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            {/* Role as main title */}
            <h3 className="font-semibold text-card-foreground text-sm leading-tight mb-1 truncate">
              {resume.role}
            </h3>
            {/* Company below role */}
            <p className="text-muted-foreground text-sm truncate">{resume.company}</p>
          </div>
          
          <div className="flex items-center gap-1 ml-2">
            {/* Star button */}
            <button
              onClick={toggleStar}
              className={cn(
                "p-1 rounded transition-colors",
                isStarred 
                  ? "text-yellow-500 hover:text-yellow-600" 
                  : "text-muted-foreground hover:text-card-foreground"
              )}
            >
              <Star className={cn("h-4 w-4", isStarred && "fill-current")} />
            </button>
            
            {/* ATS Score */}
            {resume.final_score && (
              <div className={`px-2 py-1 rounded-full text-xs font-medium ${getATSScoreColor(resume.final_score)}`}>
                {resume.final_score}%
              </div>
            )}
          </div>
        </div>

        {/* Status Indicator */}
        {resume.metadata.performance.applicationStatus && (
          <div className="mb-3">
            <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${getStatusColor(resume.metadata.performance.applicationStatus)}`}>
              {resume.metadata.performance.applicationStatus.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </span>
          </div>
        )}

        {/* Date and Tech Stack Row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center text-xs text-muted-foreground">
            <Calendar className="h-3 w-3 mr-1" />
            {daysSinceApplied !== null ? (
              <span>Applied {daysSinceApplied}d ago</span>
            ) : (
              <span>Created {daysSinceCreated}d ago</span>
            )}
          </div>
          
          <div className="flex items-center gap-1">
            {resume.tags?.slice(0, 2).map((tag, index) => (
              <Badge key={index} variant="secondary" className="text-xs px-1.5 py-0.5">
                {tag}
              </Badge>
            ))}
            {resume.tags && resume.tags.length > 2 && (
              <Badge variant="outline" className="text-xs px-1.5 py-0.5">
                +{resume.tags.length - 2}
              </Badge>
            )}
          </div>
        </div>

        {/* Work Type and Location */}
        <div className="flex items-center justify-between mb-3 text-xs text-muted-foreground">
          <Badge variant="outline" className="text-xs capitalize">
            {resume.metadata.jobDetails.workType}
          </Badge>
          {resume.metadata.jobDetails.location && (
            <span className="truncate ml-2">{resume.metadata.jobDetails.location}</span>
          )}
        </div>

        {/* Action Row */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div className="flex items-center gap-1">
            {/* Download dropdown - Updated: 2025-01-09 */}
            <div className="relative group">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                disabled={isDownloading}
              >
                {isDownloading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <>
                    <Download className="h-3 w-3 mr-1" />
                    <span className="text-xs">Download</span>
                  </>
                )}
              </Button>
              <div className="absolute left-0 top-full mt-1 w-24 bg-background border border-border rounded-md shadow-lg z-10 hidden group-hover:block">
                <button
                  onClick={() => handleDownload('pdf')}
                  className="flex items-center w-full px-3 py-1.5 text-xs hover:bg-accent"
                >
                  <FileText className="h-3 w-3 mr-2" />
                  PDF
                </button>
                <button
                  onClick={() => handleDownload('docx')}
                  className="flex items-center w-full px-3 py-1.5 text-xs hover:bg-accent"
                >
                  <FileText className="h-3 w-3 mr-2" />
                  DOCX
                </button>
              </div>
            </div>
            
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
              <Eye className="h-3 w-3" />
            </Button>
            
            <div className="relative">
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 w-7 p-0"
                onClick={() => setShowActions(!showActions)}
              >
                <MoreHorizontal className="h-3 w-3" />
              </Button>
              
              {showActions && (
                <div className="absolute right-0 top-full mt-1 w-32 bg-background dark:bg-elevation-2 border border-border dark:border-border/20 rounded-md shadow-lg dark:shadow-black/50 z-10">
                  <div className="py-1">
                    <button className="flex items-center w-full px-3 py-1.5 text-xs text-foreground hover:bg-accent dark:hover:bg-accent/50">
                      <Edit className="h-3 w-3 mr-2" />
                      Edit
                    </button>
                    <button className="flex items-center w-full px-3 py-1.5 text-xs text-foreground hover:bg-accent dark:hover:bg-accent/50">
                      <Copy className="h-3 w-3 mr-2" />
                      Duplicate
                    </button>
                    {resume.metadata.jobDetails.jobPostingUrl && (
                      <a
                        href={resume.metadata.jobDetails.jobPostingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center w-full px-3 py-1.5 text-xs text-foreground hover:bg-accent dark:hover:bg-accent/50"
                      >
                        <ExternalLink className="h-3 w-3 mr-2" />
                        Job Post
                      </a>
                    )}
                    <div className="border-t border-border dark:border-border/20 my-1" />
                    <button className="flex items-center w-full px-3 py-1.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">
                      <Trash2 className="h-3 w-3 mr-2" />
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Quick metrics */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {resume.metadata.performance.keywordMatchPercentage && (
              <div className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                <span>{resume.metadata.performance.keywordMatchPercentage}%</span>
              </div>
            )}
            <ChevronRight className="h-3 w-3" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function LoadingSkeleton() {
  return (
    <Card className="animate-pulse">
      <CardContent className="p-4">
        <div className="space-y-3">
          <div className="flex justify-between">
            <div className="space-y-1">
              <div className="h-4 bg-gray-200 rounded w-32" />
              <div className="h-3 bg-gray-200 rounded w-24" />
            </div>
            <div className="h-6 bg-gray-200 rounded w-12" />
          </div>
          <div className="h-1 bg-gray-200 rounded w-full" />
          <div className="flex justify-between">
            <div className="h-3 bg-gray-200 rounded w-16" />
            <div className="flex gap-1">
              <div className="h-4 bg-gray-200 rounded w-8" />
              <div className="h-4 bg-gray-200 rounded w-8" />
            </div>
          </div>
          <div className="flex justify-between pt-2 border-t">
            <div className="flex gap-1">
              <div className="h-6 bg-gray-200 rounded w-6" />
              <div className="h-6 bg-gray-200 rounded w-6" />
              <div className="h-6 bg-gray-200 rounded w-6" />
            </div>
            <div className="h-3 bg-gray-200 rounded w-8" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function ResumeGrid({ resumes, isLoading, viewMode }: ResumeGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <LoadingSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (resumes.length === 0) {
    const emptyMessages = {
      all: {
        title: "No resumes in your arsenal yet",
        description: "Create your first tailored resume to get started",
        action: "Craft Your First Resume"
      },
      week: {
        title: "No resumes this week",
        description: "You haven't created any resumes this week",
        action: "Create New Resume"
      },
      month: {
        title: "No resumes this month", 
        description: "You haven't created any resumes this month",
        action: "Create New Resume"
      },
      starred: {
        title: "No starred resumes",
        description: "Star your favorite resumes to see them here",
        action: "Browse All Resumes"
      }
    }

    const message = emptyMessages[viewMode] || emptyMessages.all
    
    return (
      <div className="text-center py-16">
        <div className="max-w-md mx-auto">
          <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-card-foreground mb-2">{message.title}</h3>
          <p className="text-muted-foreground mb-8">{message.description}</p>
          <Button asChild className="bg-gradient-to-r from-blue-600 to-purple-600">
            <Link href={viewMode === 'starred' ? '/dashboard/library' : '/dashboard/generator'}>
              <Plus className="h-4 w-4 mr-2" />
              {message.action}
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {resumes.map((resume) => (
        <CompactResumeCard key={resume.id} resume={resume} />
      ))}
    </div>
  )
}