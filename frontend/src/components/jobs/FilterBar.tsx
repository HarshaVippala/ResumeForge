'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, Zap, MapPin, Heart, LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ScrapingStatusIndicator } from './ScrapingStatusIndicator'

// Define the interface for the jobStats object
interface JobStats {
  startIndex: number;
  endIndex: number;
  filteredCount: number;
  totalCount: number;
}

// Define the interface for the component's props
interface FilterBarProps {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  viewMode: string;
  setViewMode: (value: string) => void;
  timeFilter: string;
  setTimeFilter: (value: string) => void;
  onSearch: () => void;
  isLoading?: boolean;
  jobStats?: JobStats | null; // This is the key fix - allows object or null
  showScrapingStatus?: boolean;
}

export function FilterBar({
  searchQuery,
  setSearchQuery,
  viewMode,
  setViewMode,
  timeFilter,
  setTimeFilter,
  onSearch,
  isLoading = false,
  jobStats = null,
  showScrapingStatus = false
}: FilterBarProps) {
  const handleSearchKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onSearch()
    }
  }

  const viewModes: { mode: 'all' | 'remote' | 'saved'; label: string; icon: LucideIcon }[] = [
    { mode: 'all', label: 'All Jobs', icon: Zap },
    { mode: 'remote', label: 'Remote', icon: MapPin },
    { mode: 'saved', label: 'Saved', icon: Heart }
  ]

  const timeFilters = [
    { value: '1h', label: '1hr' },
    { value: '6h', label: '6hr' },
    { value: '24h', label: '24hr' },
    { value: '1w', label: '1 week' }
  ]

  return (
    <div className="space-y-4 border-b border-gray-200 pb-4 mb-6">
      
      {/* Top Row: Time Filter Pills (Left) + Search (Right) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        
        {/* Time Filter Pills (Left) */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-600 mr-2 flex-shrink-0">Posted:</span>
          {timeFilters.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setTimeFilter(value)}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-lg transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 border",
                timeFilter === value
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                  : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Search Section (Right) */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <div className="relative w-80 min-w-[250px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="search"
              placeholder="Search jobs, companies, keywords..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleSearchKeyPress}
              className="pl-10 pr-4 py-2 h-10 border-gray-200 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <Button 
            onClick={onSearch} 
            disabled={isLoading} 
            className="h-10 px-4"
          >
            <Search className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Search</span>
          </Button>
        </div>
      </div>

      {/* Bottom Row: View Mode Tabs + Job Stats + Scraping Status */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div 
          role="tablist" 
          className="flex bg-gray-50 p-1 rounded-lg border border-gray-200 w-fit"
        >
          {viewModes.map(({ mode, label, icon: Icon }) => (
            <button
              key={mode}
              role="tab"
              aria-selected={viewMode === mode}
              onClick={() => setViewMode(mode)}
              className={cn(
                "px-3 sm:px-4 py-1.5 text-sm font-medium rounded-md transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 flex items-center gap-1.5",
                viewMode === mode
                  ? "bg-white shadow border border-gray-200 text-gray-900"
                  : "text-gray-600 hover:bg-gray-100"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{label.split(' ')[0]}</span>
            </button>
          ))}
        </div>

        {/* Job Stats and Scraping Status */}
        <div className="flex items-center gap-4 text-sm text-gray-600">
          {jobStats && (
            <span>
              Showing {jobStats.startIndex + 1}-{Math.min(jobStats.endIndex, jobStats.filteredCount)} of {jobStats.filteredCount} jobs
              {jobStats.filteredCount < jobStats.totalCount && ` (filtered from ${jobStats.totalCount} total)`}
            </span>
          )}
          {showScrapingStatus && <ScrapingStatusIndicator className="" />}
        </div>
      </div>
    </div>
  )
}