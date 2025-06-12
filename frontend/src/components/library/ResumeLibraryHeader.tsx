'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { 
  RefreshCw, 
  Star,
  Sparkles,
  Zap,
  Calendar,
  Search,
  Filter,
  ChevronDown,
  X
} from 'lucide-react'
import Link from 'next/link'
import { useResumeStore } from '@/stores/useResumeStore'
import { cn } from '@/lib/utils'

type ViewMode = 'all' | 'week' | 'month' | 'starred'

interface ResumeLibraryHeaderProps {
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  isFilterExpanded: boolean
  onToggleFilters: () => void
  activeFilterCount: number
  onClearFilters: () => void
}

export function ResumeLibraryHeader({ 
  viewMode, 
  onViewModeChange, 
  isFilterExpanded, 
  onToggleFilters, 
  activeFilterCount, 
  onClearFilters 
}: ResumeLibraryHeaderProps) {
  const { resumes, filteredResumes, setLoading } = useResumeStore()

  const handleRefresh = async () => {
    setLoading(true)
    // Simulate API call
    setTimeout(() => {
      setLoading(false)
    }, 1000)
  }

  const viewTabs = [
    { id: 'all' as const, label: 'All', icon: null },
    { id: 'week' as const, label: 'This Week', icon: Calendar },
    { id: 'month' as const, label: 'This Month', icon: Calendar },
    { id: 'starred' as const, label: 'Starred', icon: Star }
  ]

  // Calculate stats for different views
  const now = new Date()
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay())
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const stats = {
    total: resumes.length,
    thisWeek: resumes.filter(r => new Date(r.created_at) >= weekStart).length,
    thisMonth: resumes.filter(r => new Date(r.created_at) >= monthStart).length,
    starred: resumes.filter(r => r.metadata.customTags.includes('starred')).length
  }

  const getDisplayCount = () => {
    switch (viewMode) {
      case 'week': return stats.thisWeek
      case 'month': return stats.thisMonth
      case 'starred': return stats.starred
      default: return stats.total
    }
  }

  return (
    <div className="space-y-6">
      {/* Title and Quick Stats */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold text-foreground">Resume Dump</h1>
            </div>
            <Badge variant="secondary" className="text-sm">
              {getDisplayCount()} resumes
            </Badge>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleRefresh} size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          
          <Button asChild className="group relative btn-gradient overflow-hidden">
            <Link href="/dashboard/generator">
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
              <div className="relative flex items-center gap-2">
                <div className="p-1 bg-white/20 rounded-full group-hover:bg-white/30 transition-colors duration-300">
                  <Zap className="h-4 w-4 group-hover:scale-110 transition-transform duration-300" />
                </div>
                <span className="group-hover:tracking-wide transition-all duration-300">Create New Resume</span>
                <div className="ml-1 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300">
                  ✨
                </div>
              </div>
            </Link>
          </Button>
        </div>
      </div>

      {/* Search and View Mode Tabs Row */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Search Bar with Filter Button */}
        <div className="flex items-center gap-2 flex-1 max-w-2xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search companies, roles, technologies..."
              className="pl-10"
            />
          </div>
          
          <Button
            variant="outline"
            onClick={onToggleFilters}
            className="flex items-center gap-2"
          >
            <Filter className="h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-1">
                {activeFilterCount}
              </Badge>
            )}
            <ChevronDown className={cn(
              "h-4 w-4 transition-transform",
              isFilterExpanded && "rotate-180"
            )} />
          </Button>
          
          {activeFilterCount > 0 && (
            <Button variant="ghost" onClick={onClearFilters} size="sm">
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>

        {/* View Mode Tabs */}
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
          {viewTabs.map((tab) => {
            const Icon = tab.icon
            const count = tab.id === 'all' ? stats.total : 
                        tab.id === 'week' ? stats.thisWeek :
                        tab.id === 'month' ? stats.thisMonth : stats.starred
            
            return (
              <button
                key={tab.id}
                onClick={() => onViewModeChange(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all',
                  viewMode === tab.id
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-white/50 dark:hover:bg-gray-700/50'
                )}
              >
                {Icon && <Icon className="h-4 w-4" />}
                <span>{tab.label}</span>
                <Badge variant={viewMode === tab.id ? 'default' : 'secondary'} className="text-xs">
                  {count}
                </Badge>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}