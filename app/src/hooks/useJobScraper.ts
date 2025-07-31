'use client'

import { useState, useEffect } from 'react'
import { 
  backgroundJobScraper, 
  Job, 
  JobsData, 
  JobStats, 
  JobFilters 
} from '@/services/backgroundJobScraper'

/**
 * Hook to access background job scraping state and actions
 * Can be used in any component to get job data and scraping status
 */
export function useJobScraper() {
  const [jobsData, setJobsData] = useState<JobsData | null>(null)
  const [stats, setStats] = useState<JobStats | null>(null)
  const [status, setStatus] = useState<'idle' | 'scraping' | 'error'>('idle')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [error, setError] = useState<string | undefined>(undefined)

  useEffect(() => {
    // Subscribe to job scraper updates
    const unsubscribe = backgroundJobScraper.subscribe(({ jobsData, stats, status, lastUpdated, error }) => {
      setJobsData(jobsData)
      setStats(stats)
      setStatus(status)
      setLastUpdated(lastUpdated)
      setError(error)
    })

    return unsubscribe
  }, [])

  // Load jobs with filters and pagination
  const loadJobs = async (
    page: number = 1,
    limit: number = 20,
    filters: JobFilters = {},
    sortBy: string = 'date_posted',
    sortOrder: string = 'desc'
  ) => {
    return backgroundJobScraper.loadJobs(page, limit, filters, sortBy, sortOrder)
  }

  // Get job details
  const getJobDetails = async (jobId: string) => {
    return backgroundJobScraper.getJobDetails(jobId)
  }

  // Manual scraping
  const manualScrape = async (config?: {
    platforms?: string[]
    search_term?: string
    location?: string
    results_wanted?: number
  }) => {
    return backgroundJobScraper.manualScrape(config)
  }

  // Save job for user
  const saveJob = async (jobId: string, userEmail: string, notes?: string) => {
    return backgroundJobScraper.saveJob(jobId, userEmail, notes)
  }

  // Get saved jobs
  const getSavedJobs = async (userEmail: string) => {
    return backgroundJobScraper.getSavedJobs(userEmail)
  }

  // Get filter options
  const getFilterOptions = async () => {
    return backgroundJobScraper.getFilterOptions()
  }

  // Get current data without subscribing to updates
  const getCurrentData = () => {
    return backgroundJobScraper.getCurrentData()
  }

  return {
    // State
    jobsData,
    stats,
    status,
    lastUpdated,
    error,
    isLoading: status === 'scraping',
    hasError: status === 'error',
    
    // Actions
    loadJobs,
    getJobDetails,
    manualScrape,
    saveJob,
    getSavedJobs,
    getFilterOptions,
    getCurrentData,
    
    // Computed values
    jobs: jobsData?.jobs || [],
    pagination: jobsData?.pagination || null,
    totalJobs: stats?.total_active_jobs || 0,
    remoteJobsCount: stats?.remote_jobs_count || 0,
    uniqueCompanies: stats?.unique_companies || 0,
    jobsLast24h: stats?.jobs_last_24h || 0,
    jobsLastWeek: stats?.jobs_last_week || 0,
    topCompanies: stats?.top_companies || [],
    experienceDistribution: stats?.experience_distribution || [],
  }
}