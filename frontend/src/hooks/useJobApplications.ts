'use client'

import { useState, useEffect, useCallback } from 'react'
import type { JobApplication } from '@/types'

interface ApplicationStats {
  total: number
  active: number
  interviews: number
  offers: number
  avgResponseTime: number
}

interface UseJobApplicationsReturn {
  applications: JobApplication[]
  stats: ApplicationStats
  isLoading: boolean
  error: string | null
  lastUpdated: Date | null
  refreshApplications: () => Promise<void>
  updateApplicationStatus: (applicationId: string, status: string) => Promise<void>
}

export function useJobApplications(): UseJobApplicationsReturn {
  const [applications, setApplications] = useState<JobApplication[]>([])
  const [stats, setStats] = useState<ApplicationStats>({
    total: 0,
    active: 0,
    interviews: 0,
    offers: 0,
    avgResponseTime: 0
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchApplications = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      // For personal use, we'll use the applications API
      const apiUrl = process.env.NODE_ENV === 'development' 
        ? 'http://localhost:5001/api/applications'
        : '/api/applications'
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          // In personal use mode, auth is disabled, so no auth headers needed
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch applications: ${response.statusText}`)
      }

      const data = await response.json()

      if (data.success) {
        setApplications(data.applications || [])
        setStats(data.stats || {
          total: 0,
          active: 0,
          interviews: 0,
          offers: 0,
          avgResponseTime: 0
        })
        setLastUpdated(new Date())
      } else {
        throw new Error(data.error || 'Failed to fetch applications')
      }
    } catch (err) {
      console.error('Error fetching job applications:', err)
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const updateApplicationStatus = useCallback(async (applicationId: string, status: string) => {
    try {
      const response = await fetch(`http://localhost:5001/api/applications/${applicationId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      })

      if (!response.ok) {
        throw new Error(`Failed to update status: ${response.statusText}`)
      }

      const data = await response.json()

      if (data.success) {
        // Refresh applications to get updated data
        await fetchApplications()
      } else {
        throw new Error(data.error || 'Failed to update application status')
      }
    } catch (err) {
      console.error('Error updating application status:', err)
      setError(err instanceof Error ? err.message : 'Failed to update status')
    }
  }, [fetchApplications])

  // Initial load
  useEffect(() => {
    fetchApplications()
  }, [fetchApplications])

  return {
    applications,
    stats,
    isLoading,
    error,
    lastUpdated,
    refreshApplications: fetchApplications,
    updateApplicationStatus,
  }
}