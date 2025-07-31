'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Building, 
  Briefcase, 
  Calendar, 
  Clock,
  ExternalLink,
  MessageSquare,
  MoreHorizontal,
  Phone,
  Users,
  DollarSign,
  MapPin,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  Plus,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import type { JobApplication, ApplicationStatus } from '@/types'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'

interface JobKanbanBoardProps {
  applications: JobApplication[]
}

interface KanbanColumnProps {
  title: string
  status: ApplicationStatus | 'interview'
  applications: (JobApplication & { status: ApplicationStatus | 'interview' })[]
  count: number
  color: string
}

const pipelineColumns = [
  {
    status: 'applied' as ApplicationStatus,
    title: 'Applied',
    color: 'bg-blue-50 border-blue-200',
    headerColor: 'text-blue-700 bg-blue-100',
    cardType: 'compact' as const
  },
  {
    status: 'screening' as ApplicationStatus,
    title: 'Screening',
    color: 'bg-yellow-50 border-yellow-200',
    headerColor: 'text-yellow-700 bg-yellow-100',
    cardType: 'standard' as const
  },
  {
    status: 'phone-interview' as ApplicationStatus,
    title: 'Phone Interview',
    color: 'bg-purple-50 border-purple-200',
    headerColor: 'text-purple-700 bg-purple-100',
    cardType: 'standard' as const
  },
  {
    status: 'interview' as 'interview', // Virtual status combining technical + onsite
    title: 'Interview',
    color: 'bg-indigo-50 border-indigo-200',
    headerColor: 'text-indigo-700 bg-indigo-100',
    cardType: 'standard' as const
  }
]

function CompactApplicationCard({ application }: { application: JobApplication }) {
  const daysSinceApplication = Math.floor(
    (Date.now() - new Date(application.applicationDate).getTime()) / (1000 * 60 * 60 * 24)
  )

  return (
    <Card className="group hover:shadow-md transition-all duration-200 cursor-pointer bg-white border-l-2 border-l-blue-500">
      <CardContent className="p-3">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-gray-900 truncate">
                {application.company}
              </div>
              <div className="text-xs text-foreground/70 truncate">
                {application.role}
              </div>
            </div>
            {daysSinceApplication > 14 && (
              <div className="flex-shrink-0 ml-2">
                <div className="w-2 h-2 bg-yellow-400 rounded-full" title="Application over 14 days old" />
              </div>
            )}
          </div>
          <div className="text-xs text-foreground/60">
            Applied {daysSinceApplication}d ago
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function ApplicationCard({ application }: { application: JobApplication }) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  const daysSinceApplication = Math.floor(
    (Date.now() - new Date(application.applicationDate).getTime()) / (1000 * 60 * 60 * 24)
  )

  const nextActionOverdue = application.nextActionDate && 
    new Date(application.nextActionDate) < new Date()

  const getStatusIcon = () => {
    switch (application.status) {
      case 'offer':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'rejected':
        return <AlertCircle className="h-4 w-4 text-red-600" />
      case 'technical-interview':
      case 'onsite-interview':
        return <Users className="h-4 w-4 text-indigo-600" />
      case 'phone-interview':
        return <Phone className="h-4 w-4 text-purple-600" />
      default:
        return <Clock className="h-4 w-4 text-foreground/60" />
    }
  }

  return (
    <Card className="group hover:shadow-lg transition-all duration-200 cursor-pointer bg-white">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 text-sm leading-tight mb-1">
              {application.role}
            </h3>
            <div className="flex items-center text-sm text-foreground/70 mb-1">
              <Building className="h-3 w-3 mr-1 flex-shrink-0" />
              <span className="truncate">{application.company}</span>
            </div>
            {application.department && (
              <div className="text-xs text-foreground/60">
                {application.department}
              </div>
            )}
          </div>
          
          <div className="flex flex-col items-end space-y-1">
            {getStatusIcon()}
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100">
              <MoreHorizontal className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        {/* Location and Work Type */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center text-foreground/70">
            <MapPin className="h-3 w-3 mr-1" />
            <span className="truncate">{application.location}</span>
          </div>
          <Badge variant="outline" className="text-xs capitalize">
            {application.workType}
          </Badge>
        </div>

        {/* Salary Range */}
        {application.salaryRange && (
          <div className="flex items-center text-xs text-gray-700 font-medium">
            <DollarSign className="h-3 w-3 mr-1" />
            {application.salaryRange}
          </div>
        )}

        {/* Timeline Info */}
        <div className="flex items-center justify-between text-xs text-foreground/60">
          <div className="flex items-center">
            <Calendar className="h-3 w-3 mr-1" />
            <span>Applied {daysSinceApplication}d ago</span>
          </div>
          {application.metadata.responseTime && (
            <span>{application.metadata.responseTime}d response</span>
          )}
        </div>

        {/* Next Action */}
        {application.nextAction && (
          <div className={`p-2 rounded text-xs ${
            nextActionOverdue 
              ? 'bg-red-50 text-red-700 border border-red-200' 
              : 'bg-gray-50 text-gray-700'
          }`}>
            <div className="flex items-center justify-between">
              <span className="font-medium">Next Action:</span>
              {nextActionOverdue && <AlertCircle className="h-3 w-3 text-red-500" />}
            </div>
            <div className="mt-1">{application.nextAction}</div>
            {application.nextActionDate && (
              <div className="text-foreground/60 mt-1">
                Due: {formatDate(application.nextActionDate)}
              </div>
            )}
          </div>
        )}

        {/* Contacts */}
        {application.contacts.length > 0 && (
          <div className="flex items-center text-xs text-foreground/70">
            <Users className="h-3 w-3 mr-1" />
            <span>{application.contacts.length} contact{application.contacts.length > 1 ? 's' : ''}</span>
          </div>
        )}

        {/* Quick Actions */}
        <div className="flex items-center gap-2 pt-2 border-t">
          <Button 
            size="sm" 
            variant="outline" 
            className="flex-1 h-7 text-xs" 
            disabled 
            title="Notes functionality coming soon"
          >
            <MessageSquare className="h-3 w-3 mr-1" />
            Notes
          </Button>
          
          {application.jobPostingUrl && (
            <Button size="sm" variant="outline" className="h-7 px-2" asChild>
              <a href={application.jobPostingUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          )}
          
          <Button 
            size="sm" 
            variant="outline" 
            className="h-7 px-2" 
            disabled 
            title="Move application functionality coming soon"
          >
            <ArrowRight className="h-3 w-3" />
          </Button>
        </div>

        {/* Resume Link - only show if resumeId exists */}
        {application.resumeId && (
          <div className="text-xs text-blue-600">
            <Link href={`/dashboard/library?resume=${application.resumeId}`} className="hover:underline">
              View Resume →
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function KanbanColumn({ title, status, applications, count, color, cardType }: KanbanColumnProps & { cardType: 'compact' | 'standard' }) {
  const columnApps = applications.filter(app => app.status === status as any)

  return (
    <div className="flex flex-col min-h-0">
      {/* Column Header */}
      <div className={`p-3 rounded-t-lg border-b ${color}`}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm text-gray-800">{title}</h3>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {count}
            </Badge>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Column Content */}
      <div className={`flex-1 p-3 space-y-3 min-h-96 rounded-b-lg border-l border-r border-b ${color} overflow-y-auto`}>
        {columnApps.length === 0 ? (
          <div className="text-center text-foreground/60 text-sm py-8">
            <Briefcase className="h-8 w-8 mx-auto mb-2 text-gray-300" />
            <p>No applications</p>
          </div>
        ) : (
          columnApps.map(app => (
            cardType === 'compact' ? (
              <CompactApplicationCard key={app.id} application={app} />
            ) : (
              <ApplicationCard key={app.id} application={app} />
            )
          ))
        )}
      </div>
    </div>
  )
}

export function JobKanbanBoard({ applications }: JobKanbanBoardProps) {
  // Filter applications into active pipeline and rejected applications
  const activeApplications = applications.filter(app => 
    ['applied', 'screening', 'phone-interview', 'technical-interview', 'onsite-interview'].includes(app.status)
  )
  
  const rejectedApplications = applications.filter(app => 
    ['rejected', 'withdrawn'].includes(app.status)
  )
  
  // Transform interview statuses for display
  const transformedActiveApplications = activeApplications.map(app => ({
    ...app,
    status: (['technical-interview', 'onsite-interview'].includes(app.status) ? 'interview' : app.status) as ApplicationStatus | 'interview'
  }))
  
  // Calculate counts for each column
  const statusCounts = pipelineColumns.reduce((acc, column) => {
    if (column.status === 'interview') {
      acc[column.status] = transformedActiveApplications.filter(app => app.status === 'interview' as any).length
    } else {
      acc[column.status] = transformedActiveApplications.filter(app => app.status === column.status).length
    }
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="space-y-4">
      {/* Board Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Application Pipeline</h2>
        <div className="flex items-center gap-2 text-sm text-foreground/70">
          <span>Total: {applications.length} applications</span>
          <span className="text-gray-400">•</span>
          <span>Active: {applications.filter(app => !['rejected', 'withdrawn'].includes(app.status)).length}</span>
        </div>
      </div>

      {/* Main Pipeline */}
      <div className="overflow-x-auto">
        <div className="flex gap-4 min-w-max pb-4">
          {pipelineColumns.map(column => (
            <div key={column.status} className="w-80 flex-shrink-0">
              <KanbanColumn
                title={column.title}
                status={column.status}
                applications={transformedActiveApplications as any}
                count={statusCounts[column.status] || 0}
                color={column.color}
                cardType={column.cardType}
              />
            </div>
          ))}
        </div>
      </div>
      
      {/* Rejected Applications Section */}
      {rejectedApplications.length > 0 && (
        <RejectedApplicationsSection applications={rejectedApplications} />
      )}
    </div>
  )
}

function RejectedApplicationsSection({ applications }: { applications: JobApplication[] }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const showPreview = 2 // Show 2 most recent rejections
  const recentRejected = applications.slice(0, showPreview)
  const remainingCount = Math.max(0, applications.length - showPreview)

  return (
    <div className="border-t pt-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">
          Rejected Applications ({applications.length})
        </h3>
        {remainingCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-foreground/60 hover:text-gray-700"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-4 w-4 mr-1" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-1" />
                +{remainingCount} more
              </>
            )}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {/* Always show recent rejections */}
        {recentRejected.map(app => (
          <RejectedApplicationCard key={app.id} application={app} />
        ))}
        
        {/* Show remaining when expanded */}
        {isExpanded && applications.slice(showPreview).map(app => (
          <RejectedApplicationCard key={app.id} application={app} />
        ))}
      </div>
    </div>
  )
}

function RejectedApplicationCard({ application }: { application: JobApplication }) {
  const daysSinceRejection = Math.floor(
    (Date.now() - new Date(application.applicationDate).getTime()) / (1000 * 60 * 60 * 24)
  )

  return (
    <Card className="opacity-75 hover:opacity-90 transition-opacity cursor-pointer bg-gray-50 border-l-2 border-l-red-500">
      <CardContent className="p-3">
        <div className="space-y-1">
          <div className="text-sm font-medium text-gray-700 truncate">
            {application.company}
          </div>
          <div className="text-xs text-foreground/70 truncate">
            {application.role}
          </div>
          <div className="text-xs text-foreground/60">
            Rejected {daysSinceRejection}d ago
          </div>
        </div>
      </CardContent>
    </Card>
  )
}