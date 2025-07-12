'use client'

import { useState, useEffect, useCallback } from 'react'
import type { JobApplication } from '@/types'

interface ApplicationStats {
  total: number
  active: number
  interviews: number
  offers: number
  avgResponseTime: number
  // Enhanced stats from email integration
  totalEmails?: number
  jobRelatedEmails?: number
  pendingActions?: number
  unprocessedEmails?: number
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

      // Use the new comprehensive tracking data endpoint
      const apiUrl = process.env.NODE_ENV === 'development' 
        ? 'http://localhost:3000/api/tracking/dashboard-data'
        : '/api/tracking/dashboard-data'
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch applications: ${response.statusText}`)
      }

      const data = await response.json()

      // Transform the enriched application data to match JobApplication type
      const transformedApplications = (data.applications || []).map((app: any) => ({
        id: app.id,
        company: extractCompanyFromJobId(app.job_id) || 'Unknown Company',
        role: app.position_title || 'Unknown Role',
        status: app.status || 'applied',
        appliedAt: app.applied_at || new Date().toISOString(),
        // Add enriched data from linked components
        emailCount: app.linked_data?.summary?.email_count || 0,
        timelineEvents: app.linked_data?.summary?.timeline_events || 0,
        lastActivity: app.linked_data?.summary?.last_activity,
        hasActionItems: app.linked_data?.summary?.has_action_items || false,
        contactCount: app.linked_data?.summary?.contact_count || 0,
        resumeSession: app.linked_data?.resume_session,
        // Original fields for compatibility
        applicationMethod: app.application_method,
        notes: app.notes,
        interviewDate: app.interview_date,
        timeline: app.linked_data?.timeline || [],
        contacts: app.linked_data?.contacts || [],
        emails: app.linked_data?.emails || []
      }))

      setApplications(transformedApplications)
      
      // Calculate enhanced stats from the enriched data
      const enhancedStats = {
        total: data.statistics?.total_applications || 0,
        active: data.statistics?.active_applications || 0,
        interviews: transformedApplications.filter((app: any) => 
          app.status === 'interviewing' || app.interviewDate
        ).length,
        offers: transformedApplications.filter((app: any) => 
          app.status === 'offered'
        ).length,
        avgResponseTime: calculateAverageResponseTime(transformedApplications),
        // New stats from tracking integration
        totalEmails: data.statistics?.total_emails || 0,
        jobRelatedEmails: data.statistics?.job_related_emails || 0,
        pendingActions: data.statistics?.pending_actions || 0,
        unprocessedEmails: data.statistics?.unprocessed_emails || 0
      }
      
      setStats(enhancedStats)
      setLastUpdated(new Date())
    } catch (err) {
      console.error('Error fetching job applications:', err)
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const updateApplicationStatus = useCallback(async (applicationId: string, status: string) => {
    try {
      const apiUrl = process.env.NODE_ENV === 'development' 
        ? 'http://localhost:3000/api/applications'
        : '/api/applications'
        
      const response = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: applicationId, status }),
      })

      if (!response.ok) {
        throw new Error(`Failed to update status: ${response.statusText}`)
      }

      // After updating status, trigger auto-linking to associate any new emails
      await fetch(`${process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : ''}/api/tracking/link-application`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ application_id: applicationId })
      })
      
      // Refresh applications to get updated data
      await fetchApplications()
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

// Helper function to extract company name from job_id
function extractCompanyFromJobId(jobId: string): string | null {
  if (!jobId) return null
  
  // job_id might contain company name, try to extract it
  // This is a simple implementation, you might need to adjust based on your data
  if (jobId.includes('-')) {
    const parts = jobId.split('-')
    return parts[0]?.replace(/[^a-zA-Z\s]/g, '').trim() || null
  }
  
  return jobId.replace(/[^a-zA-Z\s]/g, '').trim() || null
}

// Helper function to calculate average response time
function calculateAverageResponseTime(applications: any[]): number {
  const applicationsWithResponse = applications.filter(app => 
    app.lastActivity && app.appliedAt
  )
  
  if (applicationsWithResponse.length === 0) return 0
  
  const totalResponseTime = applicationsWithResponse.reduce((sum, app) => {
    const appliedDate = new Date(app.appliedAt)
    const responseDate = new Date(app.lastActivity)
    const diffInHours = (responseDate.getTime() - appliedDate.getTime()) / (1000 * 60 * 60)
    return sum + Math.max(0, diffInHours) // Only positive differences
  }, 0)
  
  return Math.round(totalResponseTime / applicationsWithResponse.length)
}