'use client'

import { useState, useEffect, useMemo } from 'react'
import { ResumeLibraryHeader } from '@/components/library/ResumeLibraryHeader'
import { ResumeFilters } from '@/components/library/ResumeFilters'
import { ResumeGrid } from '@/components/library/ResumeGrid'
import { useResumeStore } from '@/stores/useResumeStore'
import type { Resume } from '@/types'

type ViewMode = 'all' | 'week' | 'month' | 'starred'

// Mock data for demonstration
const mockResumes: Resume[] = [
  {
    id: '1',
    title: 'Senior Software Engineer - Google',
    company: 'Google',
    role: 'Senior Software Engineer',
    final_score: 85,
    created_at: '2024-01-15T10:30:00Z',
    updated_at: '2024-01-15T10:30:00Z',
    file_paths: {
      docx: '/resumes/google-swe.docx',
      pdf: '/resumes/google-swe.pdf'
    },
    tags: ['React', 'TypeScript', 'AWS', 'Microservices'],
    metadata: {
      jobDetails: {
        applicationDate: '2024-01-16',
        location: 'Mountain View, CA',
        workType: 'hybrid',
        salaryRange: '$180K - $250K'
      },
      classification: {
        jobType: 'full-stack',
        experienceLevel: 'senior',
        industry: 'technology',
        primaryTechnologies: ['React', 'TypeScript', 'Go', 'GCP']
      },
      performance: {
        atsScore: 85,
        keywordMatchPercentage: 92,
        applicationStatus: 'applied'
      },
      customTags: ['FAANG', 'High Priority', 'starred']
    }
  },
  {
    id: '2',
    title: 'Full Stack Developer - Netflix',
    company: 'Netflix',
    role: 'Full Stack Developer',
    final_score: 78,
    created_at: '2024-01-12T14:20:00Z',
    updated_at: '2024-01-12T14:20:00Z',
    file_paths: {
      docx: '/resumes/netflix-fullstack.docx'
    },
    tags: ['React', 'Node.js', 'Python', 'Docker'],
    metadata: {
      jobDetails: {
        applicationDate: '2024-01-13',
        location: 'Los Gatos, CA',
        workType: 'remote',
        salaryRange: '$160K - $220K'
      },
      classification: {
        jobType: 'full-stack',
        experienceLevel: 'mid-level',
        industry: 'technology',
        primaryTechnologies: ['React', 'Node.js', 'Python', 'AWS']
      },
      performance: {
        atsScore: 78,
        keywordMatchPercentage: 85,
        applicationStatus: 'phone-interview'
      },
      customTags: ['Streaming', 'Entertainment']
    }
  },
  {
    id: '3',
    title: 'Backend Engineer - Stripe',
    company: 'Stripe',
    role: 'Backend Engineer',
    final_score: 92,
    created_at: '2024-01-10T09:15:00Z',
    updated_at: '2024-01-10T09:15:00Z',
    file_paths: {
      docx: '/resumes/stripe-backend.docx',
      pdf: '/resumes/stripe-backend.pdf'
    },
    tags: ['Python', 'PostgreSQL', 'Redis', 'Kafka'],
    metadata: {
      jobDetails: {
        applicationDate: '2024-01-11',
        location: 'San Francisco, CA',
        workType: 'hybrid',
        salaryRange: '$170K - $240K'
      },
      classification: {
        jobType: 'backend',
        experienceLevel: 'senior',
        industry: 'finance',
        primaryTechnologies: ['Python', 'PostgreSQL', 'Redis', 'Kubernetes']
      },
      performance: {
        atsScore: 92,
        keywordMatchPercentage: 95,
        applicationStatus: 'technical-interview'
      },
      customTags: ['FinTech', 'Payments', 'starred']
    }
  }
]

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
    // Simulate loading data
    setLoading(true)
    setTimeout(() => {
      setResumes(mockResumes)
      setLoading(false)
    }, 1000)
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