'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
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
  Play,
  Settings
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { useJobScraper } from '@/hooks/useJobScraper'
import type { Job, JobFilters } from '@/services/backgroundJobScraper'

type ViewMode = 'all' | 'remote' | 'recent' | 'saved'

export default function JobsPage() {
  const [currentPage, setCurrentPage] = useState(1)
  const [viewMode, setViewMode] = useState<ViewMode>('all')
  const [isFilterExpanded, setIsFilterExpanded] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [filters, setFilters] = useState<JobFilters>({})
  const [sortBy, setSortBy] = useState('date_posted')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [timeFilter, setTimeFilter] = useState<string | null>(null)
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false)
  const [loadedJobs, setLoadedJobs] = useState<Job[]>([])
  const sortDropdownRef = useRef<HTMLDivElement>(null)
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const [isInfiniteScrollEnabled, setIsInfiniteScrollEnabled] = useState(true)

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
    loadJobs(1, 20, {}, sortBy, sortOrder)
  }, [])

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

  // Update loaded jobs when jobs change
  useEffect(() => {
    if (currentPage === 1) {
      setLoadedJobs(jobs)
    } else {
      // Append new jobs for pagination
      setLoadedJobs(prev => {
        const existingIds = new Set(prev.map(job => job.id))
        const newJobs = jobs.filter(job => !existingIds.has(job.id))
        return [...prev, ...newJobs]
      })
    }
  }, [jobs, currentPage])

  // Infinite scroll observer
  useEffect(() => {
    if (!isInfiniteScrollEnabled || !loadMoreRef.current || isLoading || !pagination?.has_next) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          const nextPage = currentPage + 1
          setCurrentPage(nextPage)
          
          const searchFilters = { ...filters }
          if (searchQuery.trim()) {
            searchFilters.search = searchQuery
          }
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
            
            searchFilters.date_posted = filterDate.toISOString()
          }
          
          loadJobs(nextPage, 20, searchFilters, sortBy, sortOrder)
        }
      },
      {
        rootMargin: '100px',
        threshold: 0.1
      }
    )

    observer.observe(loadMoreRef.current)
    return () => observer.disconnect()
  }, [currentPage, isLoading, pagination?.has_next, filters, searchQuery, timeFilter, sortBy, sortOrder, isInfiniteScrollEnabled])

  // Reload jobs when sort or time filter changes
  useEffect(() => {
    const effectiveFilters = { ...filters }
    
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
      
      effectiveFilters.date_posted = filterDate.toISOString()
    }
    
    loadJobs(1, 20, effectiveFilters, sortBy, sortOrder)
    setCurrentPage(1)
    setLoadedJobs([]) // Clear loaded jobs when filters change
  }, [sortBy, sortOrder, timeFilter])

  // Filter jobs based on view mode and search
  const filteredJobs = useMemo(() => {
    let filtered = loadedJobs

    // Apply view mode filter
    switch (viewMode) {
      case 'remote':
        filtered = filtered.filter(job => job.remote)
        break
      case 'recent':
        const oneDayAgo = new Date()
        oneDayAgo.setDate(oneDayAgo.getDate() - 1)
        filtered = filtered.filter(job => new Date(job.date_posted) >= oneDayAgo)
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
  }, [loadedJobs, viewMode, searchQuery])

  // Manual refresh handler
  const handleManualRefresh = async () => {
    try {
      await manualScrape()
    } catch (error) {
      console.error('Manual scraping failed:', error)
    }
  }

  // Smooth scroll to top utility
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    })
  }

  // Handle job search with filters
  const handleSearch = async () => {
    const searchFilters = {
      ...filters,
      search: searchQuery
    }
    
    // Apply time filter if active
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
      
      searchFilters.date_posted = filterDate.toISOString()
    }
    
    await loadJobs(1, 20, searchFilters, sortBy, sortOrder)
    setCurrentPage(1)
    scrollToTop()
  }

  // Handle sort change
  const handleSortChange = (newSortBy: string, newSortOrder: 'asc' | 'desc') => {
    setSortBy(newSortBy)
    setSortOrder(newSortOrder)
    setIsSortDropdownOpen(false)
    scrollToTop()
  }

  // Handle time filter change
  const handleTimeFilterChange = (filter: string) => {
    setTimeFilter(timeFilter === filter ? null : filter)
    scrollToTop()
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
      // You might want to get user email from a user context/store
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
              onClick={() => setIsInfiniteScrollEnabled(!isInfiniteScrollEnabled)}
              className={cn("h-9", isInfiniteScrollEnabled ? "bg-primary/10 border-primary/20" : "")}
              title={isInfiniteScrollEnabled ? "Disable infinite scroll" : "Enable infinite scroll"}
            >
              <Settings className="h-4 w-4 mr-2" />
              Auto-load
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualRefresh}
              disabled={isLoading}
              className="h-9"
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
              {isLoading ? 'Scraping...' : 'Refresh Jobs'}
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
        ) : isLoading ? (
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
        ) : filteredJobs.length > 0 ? (
          <div className="max-w-4xl">
            <div className="space-y-3" style={{ minHeight: '200px' }}>
              <AnimatePresence>
                {filteredJobs.map((job, index) => (
                  <motion.div
                    key={job.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                  >
                    <Card className="p-4 hover:shadow-md hover:border-primary/20 transition-all duration-200 cursor-pointer group">
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
                              <span className="text-xs">{formatJobDate(job.date_posted)}</span>
                            </div>
                          </div>

                          {/* Description */}
                          <p className="text-sm text-muted-foreground mb-3 line-clamp-2 leading-relaxed">
                            {job.description_preview || job.description?.substring(0, 150) + '...'}
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
                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                          {/* Experience Level */}
                          <Badge className={cn("text-xs h-6 px-2", getExperienceLevelColor(job.experience_level))}>
                            {job.experience_level}
                          </Badge>

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
                              asChild
                              className="h-8 px-3 flex items-center gap-1.5"
                            >
                              <Link href={`/dashboard/generator?jobId=${job.job_id}&company=${encodeURIComponent(job.company)}&title=${encodeURIComponent(job.title)}`} className="flex items-center gap-1.5">
                                <Play className="h-3.5 w-3.5" />
                                <span className="text-xs font-medium">Tailor Resume</span>
                              </Link>
                            </Button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Load More Button - Hidden when infinite scroll is enabled */}
            {pagination && pagination.has_next && !isInfiniteScrollEnabled && (
              <div className="flex justify-center mt-8">
                <Button
                  variant="outline"
                  onClick={async () => {
                    const nextPage = currentPage + 1
                    setCurrentPage(nextPage)
                    
                    const searchFilters = { ...filters }
                    if (searchQuery.trim()) {
                      searchFilters.search = searchQuery
                    }
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
                      
                      searchFilters.date_posted = filterDate.toISOString()
                    }
                    
                    await loadJobs(nextPage, 20, searchFilters, sortBy, sortOrder)
                  }}
                  disabled={isLoading}
                  className="px-8"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      Load More Jobs
                      <ChevronDown className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            )}
            
            {/* Infinite Scroll Trigger */}
            <div ref={loadMoreRef} className="h-20 flex items-center justify-center">
              {isLoading && isInfiniteScrollEnabled && pagination?.has_next && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Loading more jobs...
                </div>
              )}
              {pagination && !pagination.has_next && filteredJobs.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  You've reached the end of the job listings
                </p>
              )}
            </div>

            {/* Pagination Info */}
            {pagination && (
              <div className="text-center mt-4">
                <p className="text-sm text-muted-foreground">
                  Showing {filteredJobs.length} of {pagination.total_jobs} jobs
                  {pagination.total_pages > 1 && (
                    <span> • Page {pagination.current_page} of {pagination.total_pages}</span>
                  )}
                  {isInfiniteScrollEnabled && pagination.has_next && (
                    <span> • Scroll for more</span>
                  )}
                </p>
              </div>
            )}
          </div>
        ) : (
          <Card className="p-12">
            <div className="text-center">
              <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No jobs found</h3>
              <p className="text-muted-foreground mb-4">
                Try adjusting your search criteria or refresh to get the latest jobs
              </p>
              <div className="flex gap-2 justify-center">
                <Button onClick={handleManualRefresh} variant="outline">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh Jobs
                </Button>
                <Button 
                  onClick={() => {
                    setTimeFilter(null)
                    setSearchQuery('')
                    setFilters({})
                    loadJobs(1, 20, {}, sortBy, sortOrder)
                  }} 
                  variant="outline"
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}