'use client'

import { useState, useEffect, useMemo } from 'react'
import { ResumeLibraryHeader } from '@/components/library/ResumeLibraryHeader'
import { ResumeFilters } from '@/components/library/ResumeFilters'
import { ResumeGrid } from '@/components/library/ResumeGrid'
import { useResumeStore } from '@/stores/useResumeStore'
import type { Resume } from '@/types'

type ViewMode = 'all' | 'week' | 'month' | 'starred'

// Last modified: 2025-01-09 - Removed mock data, fetch real data from API

export default function ResumeLibraryPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('all')
  const [isFilterExpanded, setIsFilterExpanded] = useState(false)
  
  const { 
    filteredResumes, 
    resumes,
    filters,
    isLoading, 
    error, 
    setResumes, 
    setLoading,
    setFilters
  } = useResumeStore()

  useEffect(() => {
    // Fetch real resume data from API
    // Last modified: 2025-01-09 - Use real data instead of mock
    async function fetchResumes() {
      setLoading(true)
      try {
        const response = await fetch('/api/resume-library')
        if (response.ok) {
          const data = await response.json()
          setResumes(data.resumes || [])
        } else {
          console.error('Failed to fetch resumes')
          setResumes([])
        }
      } catch (error) {
        console.error('Error fetching resumes:', error)
        setResumes([])
      } finally {
        setLoading(false)
      }
    }
    
    fetchResumes()
  }, [setResumes, setLoading])

  // Filter resumes based on view mode
  const viewFilteredResumes = useMemo(() => {
    if (!filteredResumes) return []
    
    const now = new Date()
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay())
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    switch (viewMode) {
      case 'week':
        return filteredResumes.filter(resume => 
          new Date(resume.created_at) >= weekStart
        )
      case 'month':
        return filteredResumes.filter(resume => 
          new Date(resume.created_at) >= monthStart
        )
      case 'starred':
        return filteredResumes.filter(resume => 
          resume.metadata.customTags.includes('starred')
        )
      default:
        return filteredResumes
    }
  }, [filteredResumes, viewMode])

  // Calculate active filter count
  const activeFilterCount = 
    (filters.jobTypes?.length || 0) +
    (filters.technologies?.length || 0) +
    (filters.search ? 1 : 0)

  // Clear all filters function
  const clearAllFilters = () => {
    setFilters({
      search: '',
      companies: [],
      jobTypes: [],
      experiencelevels: [],
      industries: [],
      technologies: [],
      atsScoreRange: [0, 100],
      applicationStatuses: [],
      workTypes: [],
      dateRange: [null, null]
    })
  }

  if (error) {
    return (
      <div className="min-h-screen w-full px-6 py-8 bg-background">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <h3 className="text-lg font-medium text-red-800 dark:text-red-200 mb-2">Error Loading Resume Library</h3>
          <p className="text-red-700 dark:text-red-300">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full px-6 py-8 space-y-6 bg-background">
      <ResumeLibraryHeader 
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        isFilterExpanded={isFilterExpanded}
        onToggleFilters={() => setIsFilterExpanded(!isFilterExpanded)}
        activeFilterCount={activeFilterCount}
        onClearFilters={clearAllFilters}
      />
      <ResumeFilters isExpanded={isFilterExpanded} />
      <ResumeGrid 
        resumes={viewFilteredResumes} 
        isLoading={isLoading}
        viewMode={viewMode}
      />
    </div>
  )
}