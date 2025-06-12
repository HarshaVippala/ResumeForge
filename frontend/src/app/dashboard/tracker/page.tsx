'use client'

import { useState, useEffect } from 'react'
import { JobTrackerHeader } from '@/components/tracker/JobTrackerHeader'
import { JobTrackerStats } from '@/components/tracker/JobTrackerStats'
import { JobKanbanBoard } from '@/components/tracker/JobKanbanBoard'
import { JobTrackerFilters } from '@/components/tracker/JobTrackerFilters'
import { useResumeStore } from '@/stores/useResumeStore'
import type { JobApplication, ApplicationStatus } from '@/types'

// Mock data for demonstration
const mockJobApplications: JobApplication[] = [
  {
    id: '1',
    company: 'Google',
    role: 'Senior Software Engineer',
    department: 'Search',
    salaryRange: '$180K - $250K',
    location: 'Mountain View, CA',
    workType: 'hybrid',
    applicationDate: '2024-01-16',
    jobPostingUrl: 'https://careers.google.com/jobs/123',
    status: 'technical-interview',
    resumeId: '1',
    contacts: [
      {
        id: '1',
        name: 'Sarah Chen',
        role: 'Engineering Manager',
        email: 'sarah.chen@google.com',
        notes: 'First round interviewer'
      }
    ],
    applicationMethod: 'company-website',
    timeline: [
      {
        id: '1',
        date: '2024-01-16',
        type: 'application',
        title: 'Application Submitted',
        description: 'Applied through Google Careers portal'
      },
      {
        id: '2',
        date: '2024-01-18',
        type: 'email',
        title: 'Recruiter Response',
        description: 'Initial screening call scheduled'
      },
      {
        id: '3',
        date: '2024-01-20',
        type: 'interview',
        title: 'Phone Screening',
        description: 'Technical phone screen with Sarah Chen',
        status: 'technical-interview'
      }
    ],
    notes: 'Strong technical match. Focus on system design experience.',
    nextAction: 'Prepare for system design interview',
    nextActionDate: '2024-01-25',
    metadata: {
      industry: 'technology',
      companySize: '10000+',
      responseTime: 2,
      lastActivity: '2024-01-20'
    }
  },
  {
    id: '2',
    company: 'Netflix',
    role: 'Full Stack Developer',
    department: 'Platform',
    salaryRange: '$160K - $220K',
    location: 'Los Gatos, CA',
    workType: 'remote',
    applicationDate: '2024-01-13',
    status: 'phone-interview',
    resumeId: '2',
    contacts: [],
    applicationMethod: 'linkedin',
    timeline: [
      {
        id: '1',
        date: '2024-01-13',
        type: 'application',
        title: 'Application Submitted',
        description: 'Applied via LinkedIn'
      },
      {
        id: '2',
        date: '2024-01-15',
        type: 'email',
        title: 'HR Contact',
        description: 'Initial HR screening scheduled'
      }
    ],
    notes: 'Streaming platform experience highlighted.',
    nextAction: 'Follow up on interview scheduling',
    nextActionDate: '2024-01-22',
    metadata: {
      industry: 'technology',
      companySize: '5000-10000',
      responseTime: 2,
      lastActivity: '2024-01-15'
    }
  },
  {
    id: '3',
    company: 'Stripe',
    role: 'Backend Engineer',
    department: 'Payments',
    salaryRange: '$170K - $240K',
    location: 'San Francisco, CA',
    workType: 'hybrid',
    applicationDate: '2024-01-11',
    status: 'offer',
    resumeId: '3',
    contacts: [
      {
        id: '1',
        name: 'Alex Thompson',
        role: 'Senior Engineer',
        email: 'alex@stripe.com'
      }
    ],
    applicationMethod: 'recruiter-email',
    timeline: [
      {
        id: '1',
        date: '2024-01-11',
        type: 'application',
        title: 'Application Submitted'
      },
      {
        id: '2',
        date: '2024-01-12',
        type: 'interview',
        title: 'Technical Interview',
        status: 'offer'
      },
      {
        id: '3',
        date: '2024-01-19',
        type: 'offer',
        title: 'Offer Received',
        description: 'Competitive offer with equity package'
      }
    ],
    notes: 'Excellent technical fit. Strong offer received.',
    nextAction: 'Review offer details and negotiate',
    nextActionDate: '2024-01-26',
    metadata: {
      industry: 'finance',
      companySize: '1000-5000',
      responseTime: 1,
      lastActivity: '2024-01-19'
    }
  },
  {
    id: '4',
    company: 'Microsoft',
    role: 'Principal Software Engineer',
    salaryRange: '$200K - $280K',
    location: 'Seattle, WA',
    workType: 'hybrid',
    applicationDate: '2024-01-08',
    status: 'rejected',
    resumeId: '1',
    contacts: [],
    applicationMethod: 'company-website',
    timeline: [
      {
        id: '1',
        date: '2024-01-08',
        type: 'application',
        title: 'Application Submitted'
      },
      {
        id: '2',
        date: '2024-01-17',
        type: 'rejection',
        title: 'Application Declined',
        description: 'Position filled internally'
      }
    ],
    notes: 'Position filled internally. Consider reapplying in 6 months.',
    metadata: {
      industry: 'technology',
      companySize: '10000+',
      responseTime: 9,
      lastActivity: '2024-01-17'
    }
  },
  {
    id: '5',
    company: 'Airbnb',
    role: 'Senior Frontend Engineer',
    location: 'San Francisco, CA',
    workType: 'remote',
    applicationDate: '2024-01-20',
    status: 'applied',
    contacts: [],
    applicationMethod: 'company-website',
    timeline: [
      {
        id: '1',
        date: '2024-01-20',
        type: 'application',
        title: 'Application Submitted'
      }
    ],
    notes: 'Waiting for initial response.',
    nextAction: 'Follow up if no response by Jan 27',
    nextActionDate: '2024-01-27',
    metadata: {
      industry: 'technology',
      companySize: '5000-10000',
      lastActivity: '2024-01-20'
    }
  }
]

export default function JobTrackerPage() {
  const { jobApplications, setJobApplications } = useResumeStore()
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Simulate loading data
    setTimeout(() => {
      setJobApplications(mockJobApplications)
      setIsLoading(false)
    }, 1000)
  }, [setJobApplications])

  const stats = {
    total: jobApplications.length,
    active: jobApplications.filter(app => !['rejected', 'accepted', 'withdrawn'].includes(app.status)).length,
    interviews: jobApplications.filter(app => app.status.includes('interview')).length,
    offers: jobApplications.filter(app => app.status === 'offer').length,
    avgResponseTime: jobApplications.length > 0 
      ? Math.round(
          jobApplications
            .filter(app => app.metadata.responseTime)
            .reduce((acc, app) => acc + (app.metadata.responseTime || 0), 0) /
          jobApplications.filter(app => app.metadata.responseTime).length
        )
      : 0
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

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <JobTrackerHeader 
        viewMode={viewMode} 
        onViewModeChange={setViewMode}
        stats={stats}
      />
      <JobTrackerStats stats={stats} />
      <JobTrackerFilters />
      
      {viewMode === 'kanban' ? (
        <JobKanbanBoard applications={jobApplications} />
      ) : (
        <div className="text-center py-12 text-gray-500">
          List view coming soon...
        </div>
      )}
    </div>
  )
}