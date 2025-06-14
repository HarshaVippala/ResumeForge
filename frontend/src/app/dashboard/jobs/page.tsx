'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Search,
  MapPin,
  Calendar,
  DollarSign,
  Building2,
  ExternalLink,
  Heart,
  Filter,
  RefreshCw,
  Zap,
  Users,
  TrendingUp,
  Clock,
  Star,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Play,
  Settings
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { useJobScraper } from '@/hooks/useJobScraper'
import type { Job, JobFilters } from '@/services/backgroundJobScraper'

type ViewMode = 'all' | 'remote' | 'recent' | 'saved'

const JOBS_PER_PAGE = 10

export default function JobsPage() {
  const [currentPage, setCurrentPage] = useState(1)
  const [viewMode, setViewMode] = useState<ViewMode>('all')
  const [isFilterExpanded, setIsFilterExpanded] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [isJobDetailsOpen, setIsJobDetailsOpen] = useState(false)
  const [generatingResumes, setGeneratingResumes] = useState<Set<string>>(new Set())
  const [filters, setFilters] = useState<JobFilters>({})
  const [sortBy, setSortBy] = useState('date_posted')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [timeFilter, setTimeFilter] = useState<string | null>(null)
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false)
  const sortDropdownRef = useRef<HTMLDivElement>(null)

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
    loadJobs(1, JOBS_PER_PAGE, {}, 'date_posted', 'desc').then(() => {
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

  // Click outside handler for sort dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target as Node)) {
        setIsSortDropdownOpen(false)
      }
    }

    if (isSortDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isSortDropdownOpen])

  // Filter jobs older than 5 days
  const filteredJobs = useMemo(() => {
    let filtered = jobs || []
    
    // Filter out jobs older than 5 days
    const fiveDaysAgo = new Date()
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5)
    
    filtered = filtered.filter(job => {
      const jobDate = job.date_posted ? new Date(job.date_posted) : new Date(job.scraped_at)
      return !isNaN(jobDate.getTime()) && jobDate >= fiveDaysAgo
    })

    // Apply view mode filter
    switch (viewMode) {
      case 'remote':
        filtered = filtered.filter(job => job.remote)
        break
      case 'recent':
        const oneDayAgo = new Date()
        oneDayAgo.setDate(oneDayAgo.getDate() - 1)
        filtered = filtered.filter(job => {
          const jobDate = job.date_posted ? new Date(job.date_posted) : new Date(job.scraped_at)
          return !isNaN(jobDate.getTime()) && jobDate >= oneDayAgo
        })
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
  }, [jobs, viewMode, searchQuery])

  // Pagination calculations
  const totalPages = Math.ceil(filteredJobs.length / JOBS_PER_PAGE)
  const startIndex = (currentPage - 1) * JOBS_PER_PAGE
  const endIndex = startIndex + JOBS_PER_PAGE
  const currentJobs = filteredJobs.slice(startIndex, endIndex)

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [viewMode, searchQuery, timeFilter, sortBy, sortOrder])

  // Helper function to create effective filters
  const createEffectiveFilters = useCallback(() => {
    const baseFilters = { ...filters }
    
    // Apply time filter
    if (timeFilter) {
      const now = new Date()
      let filterDate = new Date()
      
      switch (timeFilter) {
        case 'past_hour':
          filterDate.setHours(now.getHours() - 1)
          break
        case 'past_6_hours':
          filterDate.setHours(now.getHours() - 6)
          break
        case 'past_24_hours':
          filterDate.setDate(now.getDate() - 1)
          break
        case 'past_week':
          filterDate.setDate(now.getDate() - 7)
          break
      }
      
      baseFilters.date_posted = filterDate.toISOString()
    }
    
    return baseFilters
  }, [filters, timeFilter])

  // Manual refresh handler with better error handling
  const handleManualRefresh = async () => {
    try {
      await manualScrape()
    } catch (error) {
      console.error('Manual scraping failed:', error)
      // The error will be shown in the UI via the hasError state from useJobScraper
    }
  }

  // Job details modal handler
  const handleJobClick = (job: Job, event: React.MouseEvent) => {
    if ((event.target as HTMLElement).closest('.job-actions')) {
      return
    }
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

  // Handle job search with filters
  const handleSearch = () => {
    const effectiveFilters = createEffectiveFilters()
    effectiveFilters.search = searchQuery
    
    loadJobs(1, 50, effectiveFilters, sortBy, sortOrder) // Load more for client-side filtering
    setCurrentPage(1)
  }

  // Handle sort change
  const handleSortChange = (newSortBy: string, newSortOrder: 'asc' | 'desc') => {
    setSortBy(newSortBy)
    setSortOrder(newSortOrder)
    setIsSortDropdownOpen(false)
    
    const effectiveFilters = createEffectiveFilters()
    loadJobs(1, 50, effectiveFilters, newSortBy, newSortOrder)
  }

  // Handle time filter change
  const handleTimeFilterChange = (filter: string) => {
    const newTimeFilter = timeFilter === filter ? null : filter
    setTimeFilter(newTimeFilter)
    
    const baseFilters = { ...filters }
    
    if (newTimeFilter) {
      const now = new Date()
      let filterDate = new Date()
      
      switch (newTimeFilter) {
        case 'past_hour':
          filterDate.setHours(now.getHours() - 1)
          break
        case 'past_6_hours':
          filterDate.setHours(now.getHours() - 6)
          break
        case 'past_24_hours':
          filterDate.setDate(now.getDate() - 1)
          break
        case 'past_week':
          filterDate.setDate(now.getDate() - 7)
          break
      }
      
      baseFilters.date_posted = filterDate.toISOString()
    }
    
    loadJobs(1, 50, baseFilters, sortBy, sortOrder)
  }

  // Get sort display text
  const getSortDisplayText = () => {
    if (sortBy === 'date_posted') {
      return sortOrder === 'desc' ? 'Latest → Oldest' : 'Oldest → Latest'
    }
    return 'Latest → Oldest'
  }

  // Handle saving a job
  const handleSaveJob = async (jobId: string) => {
    try {
      await saveJob(jobId, 'user@example.com', 'Saved from job search')
    } catch (error) {
      console.error('Failed to save job:', error)
    }
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

  // Format salary for display
  const formatSalary = (minSalary: number | null, maxSalary: number | null, currency: string = 'USD') => {
    if (!minSalary && !maxSalary) return null
    
    const formatNumber = (num: number) => {
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
  const getExperienceLevelColor = (level: string) => {
    switch (level) {
      case 'entry': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'mid': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'senior': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
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
      <div className="flex items-center justify-center gap-2 mt-6">
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

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-foreground">Job Discovery</h1>
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

        {/* Search and Filters */}
        <div className="flex flex-col space-y-4">
          <div className="flex gap-3 items-center">
            <div className="flex-1 max-w-md relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search jobs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10 h-10"
              />
            </div>
            <Button onClick={handleSearch} disabled={isLoading} className="h-10">
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
            
            {/* Sort Dropdown */}
            <div className="relative" ref={sortDropdownRef}>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-10 px-3"
                onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}
              >
                {getSortDisplayText()}
                <ChevronDown className={cn("h-4 w-4 ml-2 transition-transform", isSortDropdownOpen && "rotate-180")} />
              </Button>
              
              {isSortDropdownOpen && (
                <div className="absolute top-full mt-1 right-0 bg-background border rounded-md shadow-lg z-50 min-w-[180px]">
                  <div className="py-1">
                    <button
                      className={cn(
                        "w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors",
                        sortBy === 'date_posted' && sortOrder === 'desc' && "bg-muted font-medium"
                      )}
                      onClick={() => handleSortChange('date_posted', 'desc')}
                    >
                      Latest → Oldest
                    </button>
                    <button
                      className={cn(
                        "w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors",
                        sortBy === 'date_posted' && sortOrder === 'asc' && "bg-muted font-medium"
                      )}
                      onClick={() => handleSortChange('date_posted', 'asc')}
                    >
                      Oldest → Latest
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Quick Time Filters and View Modes */}
          <div className="flex gap-2 flex-wrap">
            {/* Time Filters */}
            <div className="flex gap-1 mr-4">
              {[
                { key: 'hour', label: '1h', value: 'past_hour' },
                { key: '6hour', label: '6h', value: 'past_6_hours' },
                { key: '24hour', label: '24h', value: 'past_24_hours' },
                { key: 'week', label: '1w', value: 'past_week' }
              ].map(({ key, label, value }) => (
                <Button
                  key={key}
                  variant={timeFilter === value ? 'default' : 'outline'}
                  size="sm"
                  className="h-8 px-3 text-xs"
                  onClick={() => handleTimeFilterChange(value)}
                >
                  {label}
                </Button>
              ))}
            </div>
            
            {/* View Mode Filters */}
            {[
              { mode: 'all', label: 'All Jobs', icon: Zap },
              { mode: 'remote', label: 'Remote', icon: MapPin },
              { mode: 'saved', label: 'Saved', icon: Heart }
            ].map(({ mode, label, icon: Icon }) => (
              <Button
                key={mode}
                variant={viewMode === mode ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode(mode as ViewMode)}
                className="h-8 px-3 text-xs flex items-center gap-1.5"
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Job Stats */}
      <div className="text-sm text-muted-foreground">
        Showing {startIndex + 1}-{Math.min(endIndex, filteredJobs.length)} of {filteredJobs.length} jobs
        {filteredJobs.length < (jobs?.length || 0) && ` (filtered from ${jobs?.length || 0} total)`}
      </div>

      {/* Job List */}
      <div className="space-y-4">
        {hasError ? (
          <Card className="p-6">
            <div className="text-center">
              <p className="text-muted-foreground mb-4">Error loading jobs: {error}</p>
              <Button onClick={handleManualRefresh} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </div>
          </Card>
        ) : isLoading && jobs.length === 0 ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Card key={i} className="p-6">
                <div className="animate-pulse">
                  <div className="flex justify-between items-start mb-4">
                    <div className="space-y-2">
                      <div className="h-5 bg-muted rounded w-64"></div>
                      <div className="h-4 bg-muted rounded w-48"></div>
                    </div>
                    <div className="h-8 bg-muted rounded w-20"></div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 bg-muted rounded w-full"></div>
                    <div className="h-3 bg-muted rounded w-3/4"></div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : currentJobs.length > 0 ? (
          <div className="w-full">
            <div className="space-y-3">
              <AnimatePresence mode="wait">
                {currentJobs.map((job, index) => (
                  <motion.div
                    key={`${job.id}-${currentPage}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                  >
                    <Card 
                      className="p-4 hover:shadow-md hover:border-primary/20 transition-all duration-200 cursor-pointer group"
                      onClick={(e) => handleJobClick(job, e)}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0 mr-4">
                          {/* Header Row */}
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-base font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                              {job.title}
                            </h3>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <div className={cn("w-1.5 h-1.5 rounded-full", getPlatformColor(job.platform))}></div>
                              <span className="text-xs text-muted-foreground capitalize">{job.platform}</span>
                            </div>
                          </div>
                          
                          {/* Company and Location Row */}
                          <div className="flex items-center gap-3 text-sm text-muted-foreground mb-2">
                            <div className="flex items-center gap-1.5">
                              <Building2 className="h-3.5 w-3.5" />
                              <span className="font-medium">{job.company}</span>
                            </div>
                            {job.location && (
                              <div className="flex items-center gap-1">
                                <MapPin className="h-3.5 w-3.5" />
                                <span className="text-xs">{job.location}</span>
                              </div>
                            )}
                            {job.remote && (
                              <Badge variant="secondary" className="text-xs h-5 px-2">
                                Remote
                              </Badge>
                            )}
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              <span className="text-xs">{formatJobDate(job.date_posted || job.scraped_at)}</span>
                            </div>
                          </div>

                          {/* Description */}
                          <p className="text-sm text-muted-foreground mb-3 line-clamp-3 leading-relaxed">
                            {job.description_preview || job.description?.substring(0, 300) + '...'}
                          </p>

                          {/* Skills */}
                          {job.skills && job.skills.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {job.skills.slice(0, 5).map((skill, skillIndex) => (
                                <Badge key={skillIndex} variant="outline" className="text-xs h-6 px-2 font-normal">
                                  {skill}
                                </Badge>
                              ))}
                              {job.skills.length > 5 && (
                                <Badge variant="outline" className="text-xs h-6 px-2 font-normal text-muted-foreground">
                                  +{job.skills.length - 5}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Right Side Actions */}
                        <div className="flex flex-col items-end gap-2 flex-shrink-0 job-actions">
                          {/* Experience Level */}
                          <Badge className={cn("text-xs h-6 px-2", getExperienceLevelColor(job.experience_level))}>
                            {job.experience_level}
                          </Badge>

                          {/* Salary */}
                          {(job.salary_min || job.salary_max) && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <DollarSign className="h-3.5 w-3.5" />
                              <span className="text-xs">
                                {formatSalary(job.salary_min ?? null, job.salary_max ?? null, job.salary_currency)}
                              </span>
                            </div>
                          )}

                          {/* Actions */}
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSaveJob(job.job_id)}
                              className="h-8 w-8 p-0"
                            >
                              <Heart className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(job.application_url, '_blank')}
                              className="h-8 w-8 p-0"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              onClick={(e) => handleTailorResume(job, e)}
                              disabled={generatingResumes.has(job.job_id)}
                              className="h-8 px-3 flex items-center gap-1.5"
                            >
                              {generatingResumes.has(job.job_id) ? (
                                <>
                                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                  <span className="text-xs font-medium">Generating...</span>
                                </>
                              ) : (
                                <>
                                  <Play className="h-3.5 w-3.5" />
                                  <span className="text-xs font-medium">Tailor Resume</span>
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Pagination Controls */}
            <PaginationControls />
          </div>
        ) : (
          <Card className="p-12">
            <div className="text-center">
              <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No jobs found</h3>
              <p className="text-muted-foreground mb-4">
                {filteredJobs.length === 0 && jobs.length > 0 
                  ? 'No jobs match your current filters. Try adjusting your criteria.'
                  : 'Try refreshing to get the latest jobs'}
              </p>
              <div className="flex gap-2 justify-center">
                <Button onClick={handleManualRefresh} variant="outline">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh Jobs
                </Button>
                {(searchQuery || timeFilter || viewMode !== 'all') && (
                  <Button 
                    onClick={() => {
                      setTimeFilter(null)
                      setSearchQuery('')
                      setViewMode('all')
                      setFilters({})
                    }} 
                    variant="outline"
                  >
                    Clear Filters
                  </Button>
                )}
              </div>
            </div>
          </Card>
        )}
      </div>

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