'use client'

import { JobCard } from './JobCard'
import { JobCardSkeleton } from './JobCardSkeleton'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Search, RefreshCw } from 'lucide-react'

export function JobGrid({
  jobs = [],
  isLoading = false,
  hasError = false,
  error = null,
  onJobClick,
  onSaveJob,
  onTailorResume,
  onRefresh,
  onClearFilters,
  generatingResumes = new Set(),
  showClearFilters = false
}) {
  
  if (hasError) {
    return (
      <Card className="p-8">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-50 flex items-center justify-center">
            <Search className="h-8 w-8 text-red-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Error loading jobs
          </h3>
          <p className="text-gray-600 mb-4">
            {error || 'Something went wrong while fetching jobs.'}
          </p>
          <Button onClick={onRefresh} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </div>
      </Card>
    )
  }

  if (isLoading && jobs.length === 0) {
    return (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-4 md:gap-6">
        {Array.from({ length: 8 }, (_, i) => (
          <JobCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (jobs.length === 0) {
    return (
      <Card className="p-12">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-50 flex items-center justify-center">
            <Search className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No jobs found
          </h3>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            {showClearFilters 
              ? 'No jobs match your current filters. Try adjusting your search criteria or clearing filters.'
              : 'No jobs are available at the moment. Try refreshing to get the latest opportunities.'
            }
          </p>
          <div className="flex gap-3 justify-center">
            <Button onClick={onRefresh} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Jobs
            </Button>
            {showClearFilters && onClearFilters && (
              <Button onClick={onClearFilters} variant="outline">
                Clear Filters
              </Button>
            )}
          </div>
        </div>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-4 md:gap-6">
      {jobs.map((job) => (
        <JobCard
          key={job.id || job.job_id}
          job={job}
          onJobClick={onJobClick}
          onSaveJob={onSaveJob}
          onTailorResume={onTailorResume}
          isGeneratingResume={generatingResumes.has(job.job_id)}
        />
      ))}
    </div>
  )
}