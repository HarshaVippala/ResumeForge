'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Plus, 
  LayoutGrid, 
  List, 
  Calendar,
  BarChart3,
  Filter,
  Download,
  Settings
} from 'lucide-react'
import Link from 'next/link'

interface JobTrackerHeaderProps {
  viewMode: 'kanban' | 'list'
  onViewModeChange: (mode: 'kanban' | 'list') => void
  stats: {
    total: number
    active: number
    interviews: number
    offers: number
    avgResponseTime: number
  }
}

export function JobTrackerHeader({ viewMode, onViewModeChange, stats }: JobTrackerHeaderProps) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
      {/* Title and Quick Stats */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-gray-900">Job Tracker</h1>
          <Badge variant="secondary" className="text-sm">
            {stats.active} active
          </Badge>
        </div>
        
        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
          <span>{stats.total} total applications</span>
          <span className="text-gray-400">•</span>
          <span>{stats.interviews} interviews</span>
          <span className="text-gray-400">•</span>
          <span>{stats.offers} offers</span>
          {stats.avgResponseTime > 0 && (
            <>
              <span className="text-gray-400">•</span>
              <span>{stats.avgResponseTime}d avg response</span>
            </>
          )}
        </div>
      </div>

      {/* Actions and View Controls */}
      <div className="flex items-center gap-3">
        {/* View Mode Toggle */}
        <div className="flex items-center bg-gray-100 rounded-lg p-1">
          <Button
            variant={viewMode === 'kanban' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onViewModeChange('kanban')}
            className="h-8 px-3"
          >
            <LayoutGrid className="h-4 w-4 mr-2" />
            Kanban
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onViewModeChange('list')}
            className="h-8 px-3"
          >
            <List className="h-4 w-4 mr-2" />
            List
          </Button>
        </div>

        {/* Quick Actions */}
        <Button variant="outline" size="sm" className="hidden md:flex">
          <Calendar className="h-4 w-4 mr-2" />
          Calendar
        </Button>
        
        <Button variant="outline" size="sm" className="hidden md:flex">
          <BarChart3 className="h-4 w-4 mr-2" />
          Analytics
        </Button>

        <Button variant="outline" size="sm">
          <Filter className="h-4 w-4 mr-2" />
          Filter
        </Button>

        {/* Primary Action */}
        <Button asChild>
          <Link href="/dashboard/tracker/new">
            <Plus className="h-4 w-4 mr-2" />
            Add Application
          </Link>
        </Button>
      </div>
    </div>
  )
}