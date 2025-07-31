'use client'

import { useState, useEffect, useMemo } from 'react'
import { ApplicationPipelineHeader } from '@/components/tracker/JobTrackerHeader'
import { ApplicationPipelineStats } from '@/components/tracker/JobTrackerStats'
import { JobKanbanBoard } from '@/components/tracker/JobKanbanBoard'
import { useJobApplications } from '@/hooks/useJobApplications'
import type { JobApplication, ApplicationStatus } from '@/types'
import type { QuickAddFormData } from '@/components/tracker/QuickAddModal'

export default function ApplicationPipelinePage() {
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban')
  const [searchQuery, setSearchQuery] = useState('')
  
  // Use the real job applications hook
  const {
    applications: jobApplications,
    stats,
    isLoading,
    error,
    lastUpdated,
    refreshApplications,
    updateApplicationStatus
  } = useJobApplications()

  // Filter applications based on search query
  const filteredApplications = useMemo(() => {
    if (!searchQuery.trim()) return jobApplications
    
    const query = searchQuery.toLowerCase()
    return jobApplications.filter(app => 
      app.company.toLowerCase().includes(query) ||
      app.role.toLowerCase().includes(query)
    )
  }, [jobApplications, searchQuery])

  // Handle adding new application
  const handleAddApplication = async (data: QuickAddFormData) => {
    try {
      // For now, we'll just show a placeholder since we need to implement the backend endpoint
      console.log('Adding application:', data)
      
      // Application creation is not yet implemented
      // This will be added when the job tracking feature is complete
      
      // Refresh applications after adding
      await refreshApplications()
    } catch (error) {
      console.error('Failed to add application:', error)
      throw error
    }
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded" />
            ))}
          </div>
          <div className="h-96 bg-gray-200 rounded" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold text-red-600 mb-2">Error Loading Applications</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={refreshApplications}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <ApplicationPipelineHeader 
        viewMode={viewMode} 
        onViewModeChange={setViewMode}
        stats={stats}
        onRefresh={refreshApplications}
        lastUpdated={lastUpdated}
        isRefreshing={isLoading}
        onAddApplication={handleAddApplication}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />
      <ApplicationPipelineStats stats={stats} />
      
      {viewMode === 'kanban' ? (
        <JobKanbanBoard applications={filteredApplications} />
      ) : (
        <div className="text-center py-12 text-gray-500">
          List view coming soon...
        </div>
      )}
    </div>
  )
}