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
  Settings,
  RefreshCw,
  Search
} from 'lucide-react'
import { QuickAddModal, type QuickAddFormData } from './QuickAddModal'
import { Input } from '@/components/ui/input'
import Link from 'next/link'

interface ApplicationPipelineHeaderProps {
  viewMode: 'kanban' | 'list'
  onViewModeChange: (mode: 'kanban' | 'list') => void
  stats: {
    total: number
    active: number
    interviews: number
    offers: number
    avgResponseTime: number
  }
  onRefresh?: () => void
  lastUpdated?: Date | null
  isRefreshing?: boolean
  onAddApplication?: (data: QuickAddFormData) => Promise<void>
  searchQuery?: string
  onSearchChange?: (query: string) => void
}

export function ApplicationPipelineHeader({ 
  viewMode, 
  onViewModeChange, 
  stats, 
  onRefresh, 
  lastUpdated, 
  isRefreshing = false,
  onAddApplication,
  searchQuery = '',
  onSearchChange
}: ApplicationPipelineHeaderProps) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
      {/* Title and Quick Stats */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-gray-900">Application Pipeline</h1>
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
          {lastUpdated && (
            <>
              <span className="text-gray-400">•</span>
              <span>Last updated: {lastUpdated.toLocaleTimeString()}</span>
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
            Pipeline
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
        {onRefresh && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        )}
        
        {/* Removed Calendar and Analytics buttons as they're not implemented */}
        

        {/* Search Bar */}
        {onSearchChange && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search companies, roles..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9 w-64"
            />
          </div>
        )}

        {/* Quick Add Application */}
        {onAddApplication ? (
          <QuickAddModal onAdd={onAddApplication} isLoading={isRefreshing} />
        ) : (
          <Button disabled title="Add application functionality coming soon">
            <Plus className="h-4 w-4 mr-2" />
            Add Application
          </Button>
        )}
      </div>
    </div>
  )
}