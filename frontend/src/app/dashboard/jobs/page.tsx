'use client'

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Search,
  MapPin,
  Calendar,
  DollarSign,
  Building2,
  ExternalLink,
  Heart,
  RefreshCw,
  Play,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { useJobScraper } from '@/hooks/useJobScraper'
import { useQueryParamState } from '@/hooks/useQueryParamState'
import { FilterBar } from '@/components/jobs/FilterBar'
import { JobGrid } from '@/components/jobs/JobGrid'
import { ScrapingStatusIndicator } from '@/components/jobs/ScrapingStatusIndicator'
import type { Job, JobFilters } from '@/services/backgroundJobScraper'

type ViewMode = 'all' | 'remote' | 'saved'

const JOBS_PER_PAGE = 20

function JobsPageContent() {
  // URL-synced state
  const [searchQuery, setSearchQuery] = useQueryParamState('q', '')
  const [viewMode, setViewMode] = useQueryParamState('view', 'all')
  const [timeFilter, setTimeFilter] = useQueryParamState('time', '5d')
  
  // Local component state
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [isJobDetailsOpen, setIsJobDetailsOpen] = useState(false)
  const [generatingResumes, setGeneratingResumes] = useState<Set<string>>(new Set())
  const [filters, setFilters] = useState<JobFilters>({})

  // Use job scraper hook
  const {
    jobs,
    stats,
    status,
    lastUpdated,
    error,
    isLoading,
    hasError,
    loadJobs,
    manualScrape,
    saveJob,
    getSavedJobs,
    getFilterOptions,
    totalJobs,
    remoteJobsCount,
    uniqueCompanies,
    jobsLast24h,
    jobsLastWeek,
    topCompanies,
    experienceDistribution,
    pagination
  } = useJobScraper()

  // Load initial jobs on component mount
  useEffect(() => {
    console.log('JobsPage mounted, loading initial jobs...')
    loadJobs(1, JOBS_PER_PAGE * 2, {}, 'date_posted', 'desc').then(() => {
      console.log('Initial jobs loaded:', jobs?.length || 0, 'jobs')
    })
  }, []) // Empty dependency array - only run once on mount

  // Debug: Log when jobs change
  useEffect(() => {
    console.log('Jobs data updated:', {
      jobsCount: jobs?.length || 0,
      firstJob: jobs?.[0],
      status,
      error,
      isLoading
    })
  }, [jobs, status, error, isLoading])

  // Filter jobs based on current filters
  const filteredJobs = useMemo(() => {
    let filtered = jobs || []
    
    // Filter out jobs older than 5 days by default, or apply time filter
    const filterDate = new Date()
    switch (timeFilter) {
      case '1h':
        filterDate.setHours(filterDate.getHours() - 1)
        break
      case '6h':
        filterDate.setHours(filterDate.getHours() - 6)
        break
      case '24h':
        filterDate.setDate(filterDate.getDate() - 1)
        break
      case '1w':
        filterDate.setDate(filterDate.getDate() - 7)
        break
      case '5d':
      default:
        filterDate.setDate(filterDate.getDate() - 5)
        break
    }
    
    filtered = filtered.filter(job => {
      const jobDate = job.date_posted ? new Date(job.date_posted) : new Date(job.scraped_at)
      return !isNaN(jobDate.getTime()) && jobDate >= filterDate
    })

    // Apply view mode filter
    switch (viewMode) {
      case 'remote':
        filtered = filtered.filter(job => job.remote)
        break
      case 'saved':
        // This would need implementation in the backend
        break
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(job => 
        job.title.toLowerCase().includes(query) ||
        job.company.toLowerCase().includes(query) ||
        job.location.toLowerCase().includes(query) ||
        job.skills.some(skill => skill.toLowerCase().includes(query))
      )
    }

    return filtered
  }, [jobs, viewMode, searchQuery, timeFilter])

  // Pagination calculations
  const totalPages = Math.ceil(filteredJobs.length / JOBS_PER_PAGE)
  const startIndex = (currentPage - 1) * JOBS_PER_PAGE
  const endIndex = startIndex + JOBS_PER_PAGE
  const currentJobs = filteredJobs.slice(startIndex, endIndex)

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [viewMode, searchQuery, timeFilter])

  // Helper function to create effective filters
  const createEffectiveFilters = useCallback(() => {
    const baseFilters = { ...filters }
    
    // Apply time filter
    if (timeFilter && timeFilter !== '5d') {
      const now = new Date()
      let filterDate = new Date()
      
      switch (timeFilter) {
        case '1h':
          filterDate.setHours(now.getHours() - 1)
          break
        case '6h':
          filterDate.setHours(now.getHours() - 6)
          break
        case '24h':
          filterDate.setDate(now.getDate() - 1)
          break
        case '1w':
          filterDate.setDate(now.getDate() - 7)
          break
      }
      
      baseFilters.date_posted = filterDate.toISOString()
    }
    
    return baseFilters
  }, [filters, timeFilter])

  // Manual refresh handler
  const handleManualRefresh = async () => {
    try {
      await manualScrape()
    } catch (error) {
      console.error('Manual scraping failed:', error)
    }
  }

  // Job details modal handler
  const handleJobClick = (job: Job, event: React.MouseEvent) => {
    setSelectedJob(job)
    setIsJobDetailsOpen(true)
  }

  // Background resume generation handler
  const handleTailorResume = async (job: Job, event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    
    const jobId = job.job_id
    setGeneratingResumes(prev => new Set([...prev, jobId]))
    
    try {
      const response = await fetch('http://localhost:5001/api/analyze-job', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          company: job.company,
          role: job.title,
          jobDescription: job.description,
          jobUrl: job.application_url
        })
      })

      if (response.ok) {
        const result = await response.json()
        console.log('Resume generation started for:', job.title, 'at', job.company)
        
        if (result.session_id) {
          window.open(`/dashboard/generator?sessionId=${result.session_id}`, '_blank')
        }
      } else {
        throw new Error('Failed to start resume generation')
      }
    } catch (error) {
      console.error('Resume generation failed:', error)
    } finally {
      setGeneratingResumes(prev => {
        const newSet = new Set(prev)
        newSet.delete(jobId)
        return newSet
      })
    }
  }

  // Handle job search
  const handleSearch = () => {
    const effectiveFilters = createEffectiveFilters()
    effectiveFilters.search = searchQuery
    
    loadJobs(1, JOBS_PER_PAGE * 2, effectiveFilters, 'date_posted', 'desc')
    setCurrentPage(1)
  }

  // Handle saving a job
  const handleSaveJob = async (jobId: string) => {
    try {
      await saveJob(jobId, 'user@example.com', 'Saved from job search')
    } catch (error) {
      console.error('Failed to save job:', error)
    }
  }

  // Handle clearing filters
  const handleClearFilters = () => {
    setSearchQuery('')
    setViewMode('all')
    setTimeFilter('5d')
    setFilters({})
  }

  // Format date for display
  const formatJobDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      const now = new Date()
      const diffMs = now.getTime() - date.getTime()
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

      if (diffDays === 0) return 'Today'
      if (diffDays === 1) return 'Yesterday'
      if (diffDays < 7) return `${diffDays} days ago`
      return date.toLocaleDateString()
    } catch {
      return 'Unknown'
    }
  }

  // Get platform color
  const getPlatformColor = (platform: string) => {
    switch (platform) {
      case 'indeed': return 'bg-blue-500'
      case 'glassdoor': return 'bg-green-500'
      case 'ziprecruiter': return 'bg-orange-500'
      case 'linkedin': return 'bg-blue-600'
      default: return 'bg-gray-500'
    }
  }

  // Pagination component
  const PaginationControls = () => {
    if (totalPages <= 1) return null

    const pageNumbers = []
    const maxVisiblePages = 5
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2))
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1)

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1)
    }

    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i)
    }

    return (
      <div className="flex items-center justify-center gap-2 mt-8">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
          disabled={currentPage === 1}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {startPage > 1 && (
          <>
            <Button
              variant={currentPage === 1 ? "default" : "outline"}
              size="sm"
              onClick={() => setCurrentPage(1)}
            >
              1
            </Button>
            {startPage > 2 && <span className="px-2">...</span>}
          </>
        )}

        {pageNumbers.map(num => (
          <Button
            key={num}
            variant={currentPage === num ? "default" : "outline"}
            size="sm"
            onClick={() => setCurrentPage(num)}
          >
            {num}
          </Button>
        ))}

        {endPage < totalPages && (
          <>
            {endPage < totalPages - 1 && <span className="px-2">...</span>}
            <Button
              variant={currentPage === totalPages ? "default" : "outline"}
              size="sm"
              onClick={() => setCurrentPage(totalPages)}
            >
              {totalPages}
            </Button>
          </>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
          disabled={currentPage === totalPages}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  const hasActiveFilters = Boolean(searchQuery) || viewMode !== 'all' || timeFilter !== '5d'

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Job Discovery</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Find your next opportunity from the latest job postings
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-xs text-muted-foreground">
            Last updated: {lastUpdated ? formatJobDate(lastUpdated.toISOString()) : 'Never'}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
            disabled={isLoading}
            className="h-9"
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
            {isLoading ? (
              status === 'scraping' ? 'Scraping jobs...' : 'Loading...'
            ) : 'Refresh Jobs'}
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <FilterBar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        viewMode={viewMode as any}
        setViewMode={setViewMode}
        timeFilter={timeFilter}
        setTimeFilter={setTimeFilter}
        onSearch={handleSearch}
        isLoading={isLoading}
        jobStats={{
          startIndex,
          endIndex,
          filteredCount: filteredJobs.length,
          totalCount: jobs?.length || 0
        }}
        showScrapingStatus={true}
      />

      {/* Job Grid */}
      <JobGrid
        jobs={currentJobs}
        isLoading={isLoading}
        hasError={hasError}
        error={error}
        onJobClick={handleJobClick}
        onSaveJob={handleSaveJob}
        onTailorResume={handleTailorResume}
        onRefresh={handleManualRefresh}
        onClearFilters={handleClearFilters}
        generatingResumes={generatingResumes}
        showClearFilters={hasActiveFilters}
      />

      {/* Pagination Controls */}
      <PaginationControls />

      {/* Job Details Modal */}
      <Dialog open={isJobDetailsOpen} onOpenChange={setIsJobDetailsOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{selectedJob?.title}</span>
              <div className="flex items-center gap-2">
                <div className={cn("w-2 h-2 rounded-full", selectedJob ? getPlatformColor(selectedJob.platform) : '')}></div>
                <span className="text-sm text-muted-foreground capitalize">{selectedJob?.platform}</span>
              </div>
            </DialogTitle>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Building2 className="h-4 w-4" />
                <span className="font-medium">{selectedJob?.company}</span>
              </div>
              {selectedJob?.location && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  <span>{selectedJob.location}</span>
                </div>
              )}
              {selectedJob?.remote && (
                <Badge variant="secondary" className="text-xs">Remote</Badge>
              )}
            </div>
          </DialogHeader>
          
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-6">
              {/* Job Description */}
              <div>
                <h4 className="font-semibold mb-2">Job Description</h4>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {selectedJob?.description}
                </p>
              </div>

              {/* Requirements */}
              {selectedJob?.requirements && (
                <div>
                  <h4 className="font-semibold mb-2">Requirements</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {selectedJob.requirements}
                  </p>
                </div>
              )}

              {/* Benefits */}
              {selectedJob?.benefits && (
                <div>
                  <h4 className="font-semibold mb-2">Benefits</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {selectedJob.benefits}
                  </p>
                </div>
              )}

              {/* Skills */}
              {selectedJob?.skills && selectedJob.skills.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Required Skills</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedJob.skills.map((skill, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Salary */}
              {(selectedJob?.salary_min || selectedJob?.salary_max) && (
                <div>
                  <h4 className="font-semibold mb-2">Salary Range</h4>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <DollarSign className="h-4 w-4" />
                    <span>
                      {selectedJob.salary_min && selectedJob.salary_max 
                        ? `$${selectedJob.salary_min.toLocaleString()} - $${selectedJob.salary_max.toLocaleString()}`
                        : selectedJob.salary_min 
                        ? `$${selectedJob.salary_min.toLocaleString()}+`
                        : `Up to $${selectedJob.salary_max?.toLocaleString()}`
                      }
                    </span>
                  </div>
                </div>
              )}

              {/* Modal Actions */}
              <div className="flex gap-3 pt-4 border-t">
                <Button
                  onClick={(e) => selectedJob && handleTailorResume(selectedJob, e)}
                  disabled={selectedJob ? generatingResumes.has(selectedJob.job_id) : false}
                  className="flex-1"
                >
                  {selectedJob && generatingResumes.has(selectedJob.job_id) ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Generating Resume...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Tailor Resume
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => selectedJob && window.open(selectedJob.application_url, '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Apply on {selectedJob?.platform}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => selectedJob && handleSaveJob(selectedJob.job_id)}
                >
                  <Heart className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function JobsPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <JobsPageContent />
    </Suspense>
  )
}