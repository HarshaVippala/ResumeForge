/**
 * Background Job Scraping Service
 * Persistent service for scraping and managing job postings
 */

import { apiConfig, getApiUrl, apiRequest } from '@/config/api.config'

export interface Job {
  id: string
  job_id: string
  title: string
  company: string
  location: string
  remote: boolean
  job_type: string
  salary_min?: number
  salary_max?: number
  salary_currency: string
  description: string
  description_preview?: string
  requirements?: string
  benefits?: string
  application_url: string
  company_logo_url?: string
  platform: string
  date_posted: string
  skills: string[]
  experience_level: string
  scraped_at: string
  // Enhanced fields
  sponsorship_status?: 'SPONSORS_H1B' | 'NO_SPONSORSHIP' | 'UNCERTAIN'
  sponsorship_confidence?: number
  sponsorship_reasoning?: string
  enhanced_tech_stack?: {
    technologies: Array<{
      name: string
      category: 'LANGUAGE' | 'FRAMEWORK_LIBRARY' | 'DATABASE' | 'CLOUD_PLATFORM' | 'DEVOPS_TOOL' | 'SOFTWARE'
      level: 'REQUIRED' | 'PREFERRED'
      experience_years?: string
    }>
    summary: {
      required_count: number
      preferred_count: number
      primary_language?: string
      primary_framework?: string
    }
  }
  processing_status?: 'new' | 'processing' | 'completed' | 'failed'
  confidence_category?: 'high' | 'medium' | 'low'
}

export interface JobFilters {
  search?: string
  company?: string
  location?: string
  remote?: boolean
  salary_min?: number
  salary_max?: number
  experience_level?: string
  platform?: string
  job_type?: string
  date_posted?: string
}

export interface JobsData {
  jobs: Job[]
  pagination: {
    current_page: number
    total_pages: number
    total_jobs: number
    jobs_per_page: number
    has_next: boolean
    has_prev: boolean
  }
}

export interface JobStats {
  total_active_jobs: number
  unique_companies: number
  platforms_used: number
  avg_salary_min: number
  avg_salary_max: number
  remote_jobs_count: number
  jobs_last_24h: number
  jobs_last_week: number
  top_companies: Array<{ company: string; job_count: number }>
  experience_distribution: Array<{ experience_level: string; count: number }>
}

type ScrapeStatus = 'idle' | 'scraping' | 'error'

type JobsSubscriber = (data: {
  jobsData: JobsData | null
  stats: JobStats | null
  status: ScrapeStatus
  lastUpdated: Date | null
  error?: string
}) => void

class BackgroundJobScrapingService {
  private subscribers: Set<JobsSubscriber> = new Set()
  private jobsData: JobsData | null = null
  private stats: JobStats | null = null
  private status: ScrapeStatus = 'idle'
  private lastUpdated: Date | null = null
  private error?: string
  private scrapeInterval: NodeJS.Timeout | null = null
  private statsInterval: NodeJS.Timeout | null = null
  private isInitialized = false
  
  // Configuration
  private readonly SCRAPE_INTERVAL_MS = 6 * 60 * 60 * 1000 // 6 hours
  private readonly STATS_INTERVAL_MS = 30 * 60 * 1000 // 30 minutes
  private readonly INITIAL_LOAD_DELAY_MS = 5000 // 5 seconds to allow backend to be ready

  /**
   * Initialize the background scraping service
   */
  initialize() {
    if (this.isInitialized) {
      return
    }

    this.isInitialized = true

    // Load existing jobs immediately
    this.loadJobsFromDatabase()
    this.loadJobStatistics()

    // Start background scraping after initial delay (but only on production or manual trigger)
    // Don't auto-scrape immediately in development to avoid API spam
    if (process.env.NODE_ENV === 'production' && apiConfig.features.jobScraper) {
      setTimeout(() => {
        this.performBackgroundScrape()
      }, this.INITIAL_LOAD_DELAY_MS)
    }

    // Set up periodic scraping (every 6 hours) - only in production
    if (process.env.NODE_ENV === 'production' && apiConfig.features.jobScraper) {
      this.scrapeInterval = setInterval(() => {
        this.performBackgroundScrape()
      }, this.SCRAPE_INTERVAL_MS)
    }

    // Set up periodic stats updates (every 30 minutes) - only in production
    if (process.env.NODE_ENV === 'production') {
      this.statsInterval = setInterval(() => {
        this.loadJobStatistics()
      }, this.STATS_INTERVAL_MS)
    }

    // Handle app visibility changes
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && this.status === 'idle') {
          // Refresh data when app becomes visible
          this.loadJobsFromDatabase()
          this.loadJobStatistics()
        }
      })
    }
  }

  /**
   * Clean up resources
   */
  destroy() {
    if (this.scrapeInterval) {
      clearInterval(this.scrapeInterval)
      this.scrapeInterval = null
    }
    if (this.statsInterval) {
      clearInterval(this.statsInterval)
      this.statsInterval = null
    }
    this.subscribers.clear()
    this.isInitialized = false
    console.log('🛑 Background Job Scraping Service destroyed')
  }

  /**
   * Subscribe to job updates
   */
  subscribe(callback: JobsSubscriber) {
    this.subscribers.add(callback)
    
    // Immediately send current state to new subscriber
    callback({
      jobsData: this.jobsData,
      stats: this.stats,
      status: this.status,
      lastUpdated: this.lastUpdated,
      error: this.error
    })

    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback)
    }
  }

  /**
   * Get current job data
   */
  getCurrentData() {
    return {
      jobsData: this.jobsData,
      stats: this.stats,
      status: this.status,
      lastUpdated: this.lastUpdated,
      error: this.error
    }
  }

  /**
   * Update scrape frequency (for settings)
   */
  updateScrapeFrequency(newIntervalMs: number) {
    console.log(`🔄 Updating job scraping frequency to ${newIntervalMs}ms`)
    
    // Clear existing interval
    if (this.scrapeInterval) {
      clearInterval(this.scrapeInterval)
    }
    
    // Set new interval (only in production)
    if (process.env.NODE_ENV === 'production' && apiConfig.features.jobScraper) {
      this.scrapeInterval = setInterval(() => {
        this.performBackgroundScrape()
      }, newIntervalMs)
    }
  }

  /**
   * Load jobs with filters and pagination
   */
  async loadJobs(
    page: number = 1, 
    limit: number = 20, 
    filters: JobFilters = {},
    sortBy: string = 'date_posted',
    sortOrder: string = 'desc'
  ): Promise<JobsData | null> {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        sort_by: sortBy,
        sort_order: sortOrder
      })

      // Add filters to params
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, value.toString())
        }
      })

      const url = `${apiConfig.endpoints.jobs}?${params}`
      console.log('Loading jobs from:', url)

      const result = await apiRequest<any>(url)
      
      console.log('Jobs API response:', {
        success: result.success,
        jobsCount: result.jobs?.length || 0,
        pagination: result.pagination
      })
      
      if (result.success) {
        this.jobsData = {
          jobs: result.jobs,
          pagination: result.pagination
        }
        this.lastUpdated = new Date()
        this.notifySubscribers()
        return this.jobsData
      }
      
      throw new Error('Failed to load jobs')
    } catch (error) {
      console.error('Failed to load jobs:', error)
      this.error = error instanceof Error ? error.message : 'Failed to load jobs'
      this.notifySubscribers()
      return null
    }
  }

  /**
   * Get job details by ID
   */
  async getJobDetails(jobId: string): Promise<Job | null> {
    try {
      const result = await apiRequest<any>(apiConfig.endpoints.jobDetails(jobId))
      
      if (result.success) {
        return result.job
      }
      
      throw new Error('Failed to fetch job details')
    } catch (error) {
      console.error('Failed to get job details:', error)
      return null
    }
  }

  /**
   * Manually trigger job scraping
   */
  async manualScrape(config?: {
    platforms?: string[]
    search_term?: string
    location?: string
    results_wanted?: number
  }): Promise<void> {
    if (this.status === 'scraping') {
      return // Already scraping
    }

    this.status = 'scraping'
    this.error = undefined
    this.notifySubscribers()

    try {
      // Job scraping can take 2-3 minutes, so we need a longer timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 180000) // 3 minutes
      
      const result = await fetch(`${apiConfig.baseUrl}${apiConfig.endpoints.jobScrape}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config || {}),
        signal: controller.signal,
      })
      
      clearTimeout(timeoutId)
      
      if (!result.ok) {
        throw new Error(`Job scraping failed: ${result.status} ${result.statusText}`)
      }
      
      const data = await result.json()

      if (data.success) {
        console.log('🔄 Manual scraping completed:', data.results)
        
        // Refresh jobs data after scraping
        await this.loadJobsFromDatabase()
        await this.loadJobStatistics()
        
        this.status = 'idle'
      } else {
        throw new Error((result as any).error || 'Scraping failed')
      }
    } catch (error) {
      console.error('Manual scraping failed:', error)
      this.status = 'error'
      this.error = error instanceof Error ? error.message : 'Scraping failed'
    }

    this.notifySubscribers()
  }

  /**
   * Save a job for user
   */
  async saveJob(jobId: string, userEmail: string, notes?: string): Promise<boolean> {
    try {
      const result = await apiRequest<any>(apiConfig.endpoints.jobSave, {
        method: 'POST',
        body: JSON.stringify({
          job_id: jobId,
          user_email: userEmail,
          notes: notes || ''
        })
      })

      return result.success || false
    } catch (error) {
      console.error('Failed to save job:', error)
      return false
    }
  }

  /**
   * Get user's saved jobs
   */
  async getSavedJobs(userEmail: string): Promise<Job[]> {
    try {
      const result = await apiRequest<any>(`${apiConfig.endpoints.jobsSaved}?user_email=${encodeURIComponent(userEmail)}`)
      
      if (result.success) {
        return result.saved_jobs
      }
      
      return []
    } catch (error) {
      console.error('Failed to get saved jobs:', error)
      return []
    }
  }

  /**
   * Get filter options for job search
   */
  async getFilterOptions(): Promise<any> {
    try {
      const result = await apiRequest<any>(apiConfig.endpoints.jobFilters)
      
      if (result.success) {
        return result.filters
      }
      
      return null
    } catch (error) {
      console.error('Failed to get filter options:', error)
      return null
    }
  }

  /**
   * Load jobs from database (for initial display)
   */
  private async loadJobsFromDatabase() {
    try {
      const response = await fetch(getApiUrl('/api/jobs?limit=20&sort_by=date_posted&sort_order=desc'))
      
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          this.jobsData = {
            jobs: result.jobs,
            pagination: result.pagination
          }
          this.lastUpdated = new Date()
          this.notifySubscribers()
        } else {
          console.warn('⚠️ Jobs API returned unsuccessful response:', result)
        }
      } else {
        console.warn('⚠️ Jobs API response not ok:', response.status, response.statusText)
      }
    } catch (error) {
      console.warn('⚠️ Failed to load jobs from database:', error)
      // Don't set error state for initial load failure - just log it
    }
  }

  /**
   * Load job statistics
   */
  private async loadJobStatistics() {
    try {
      const response = await fetch(getApiUrl('/api/jobs/stats'))
      
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          this.stats = result.statistics
          this.notifySubscribers()
        }
      }
    } catch (error) {
      console.warn('⚠️ Failed to load job statistics:', error)
    }
  }

  /**
   * Perform background scraping
   */
  private async performBackgroundScrape() {
    if (this.status === 'scraping') {
      return // Already scraping
    }

    console.log('🔄 Starting background job scraping')
    
    this.status = 'scraping'
    this.error = undefined
    this.notifySubscribers()

    try {
      // Use conservative scraping config for background operation
      const config = {
        platforms: ['indeed', 'glassdoor'], // Start conservative
        search_term: 'software engineer',
        location: 'United States',
        results_wanted: 50 // Moderate number
      }

      const response = await fetch(getApiUrl('/api/jobs/scrape'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config)
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          console.log('🔄 Background scraping completed:', result.results)
          
          // Refresh data after scraping
          await this.loadJobsFromDatabase()
          await this.loadJobStatistics()
          
          this.status = 'idle'
        } else {
          throw new Error(result.error || 'Background scraping failed')
        }
      } else {
        throw new Error(`Background scraping API error: ${response.status}`)
      }
    } catch (error) {
      console.error('Background scraping failed:', error)
      this.status = 'error'
      this.error = error instanceof Error ? error.message : 'Background scraping failed'
    }

    this.notifySubscribers()
  }

  /**
   * Notify all subscribers of state changes
   */
  private notifySubscribers() {
    const data = {
      jobsData: this.jobsData,
      stats: this.stats,
      status: this.status,
      lastUpdated: this.lastUpdated,
      error: this.error
    }
    
    this.subscribers.forEach(callback => {
      try {
        callback(data)
      } catch (error) {
        console.error('Error in job scraping subscriber callback:', error)
      }
    })
  }
}

// Create singleton instance
export const backgroundJobScraper = new BackgroundJobScrapingService()