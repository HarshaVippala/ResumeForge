'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { 
  Search, 
  Filter, 
  X, 
  ChevronDown,
  Building,
  MapPin,
  Calendar,
  DollarSign,
  Briefcase
} from 'lucide-react'
import { cn } from '@/lib/utils'

const applicationStatuses = [
  { value: 'applied', label: 'Applied', color: 'bg-blue-100 text-blue-800' },
  { value: 'screening', label: 'Screening', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'phone-interview', label: 'Phone Interview', color: 'bg-purple-100 text-purple-800' },
  { value: 'technical-interview', label: 'Technical Interview', color: 'bg-indigo-100 text-indigo-800' },
  { value: 'onsite-interview', label: 'Onsite Interview', color: 'bg-orange-100 text-orange-800' },
  { value: 'offer', label: 'Offer', color: 'bg-green-100 text-green-800' },
  { value: 'rejected', label: 'Rejected', color: 'bg-red-100 text-red-800' },
  { value: 'withdrawn', label: 'Withdrawn', color: 'bg-gray-100 text-gray-800' }
]

const workTypes = [
  { value: 'remote', label: 'Remote' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'onsite', label: 'On-site' }
]

const salaryRanges = [
  { value: '0-100k', label: 'Under $100K' },
  { value: '100k-150k', label: '$100K - $150K' },
  { value: '150k-200k', label: '$150K - $200K' },
  { value: '200k+', label: '$200K+' }
]

const timeRanges = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'quarter', label: 'This Quarter' }
]

export function JobTrackerFilters() {
  const [isExpanded, setIsExpanded] = useState(false)
  const [filters, setFilters] = useState({
    search: '',
    statuses: [] as string[],
    workTypes: [] as string[],
    salaryRanges: [] as string[],
    timeRange: '',
    companies: [] as string[],
    locations: [] as string[]
  })

  const toggleFilter = (filterType: keyof typeof filters, value: string) => {
    if (filterType === 'timeRange') {
      setFilters(prev => ({
        ...prev,
        timeRange: prev.timeRange === value ? '' : value
      }))
    } else {
      setFilters(prev => ({
        ...prev,
        [filterType]: (prev[filterType] as string[]).includes(value)
          ? (prev[filterType] as string[]).filter(item => item !== value)
          : [...(prev[filterType] as string[]), value]
      }))
    }
  }

  const clearAllFilters = () => {
    setFilters({
      search: '',
      statuses: [],
      workTypes: [],
      salaryRanges: [],
      timeRange: '',
      companies: [],
      locations: []
    })
  }

  const activeFilterCount = 
    filters.statuses.length +
    filters.workTypes.length +
    filters.salaryRanges.length +
    filters.companies.length +
    filters.locations.length +
    (filters.timeRange ? 1 : 0) +
    (filters.search ? 1 : 0)

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        {/* Search and Quick Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search companies, roles, locations..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="pl-10"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setIsExpanded(!isExpanded)}
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
                isExpanded && "rotate-180"
              )} />
            </Button>
            
            {activeFilterCount > 0 && (
              <Button variant="ghost" onClick={clearAllFilters} size="sm">
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Active Filters Display */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap gap-2">
            {filters.search && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <Search className="h-3 w-3" />
                "{filters.search}"
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 ml-1"
                  onClick={() => setFilters(prev => ({ ...prev, search: '' }))}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            )}
            
            {filters.statuses.map(status => {
              const statusConfig = applicationStatuses.find(s => s.value === status)
              return (
                <Badge key={status} className={`flex items-center gap-1 ${statusConfig?.color}`}>
                  {statusConfig?.label}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 ml-1"
                    onClick={() => toggleFilter('statuses', status)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              )
            })}

            {filters.workTypes.map(type => (
              <Badge key={type} variant="info" className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {workTypes.find(w => w.value === type)?.label}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 ml-1"
                  onClick={() => toggleFilter('workTypes', type)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}

            {filters.timeRange && (
              <Badge variant="outline" className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {timeRanges.find(t => t.value === filters.timeRange)?.label}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 ml-1"
                  onClick={() => toggleFilter('timeRange', filters.timeRange)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            )}
          </div>
        )}

        {/* Extended Filters */}
        {isExpanded && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-4 border-t">
            {/* Application Status */}
            <div className="space-y-2">
              <h4 className="font-medium text-sm text-gray-700 flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                Status
              </h4>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {applicationStatuses.map(status => (
                  <label key={status.value} className="flex items-center space-x-2 text-sm">
                    <input
                      type="checkbox"
                      checked={filters.statuses.includes(status.value)}
                      onChange={() => toggleFilter('statuses', status.value)}
                      className="rounded border-gray-300"
                    />
                    <span className={`px-2 py-1 rounded text-xs ${status.color}`}>
                      {status.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Work Type */}
            <div className="space-y-2">
              <h4 className="font-medium text-sm text-gray-700 flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Work Type
              </h4>
              <div className="space-y-1">
                {workTypes.map(type => (
                  <label key={type.value} className="flex items-center space-x-2 text-sm">
                    <input
                      type="checkbox"
                      checked={filters.workTypes.includes(type.value)}
                      onChange={() => toggleFilter('workTypes', type.value)}
                      className="rounded border-gray-300"
                    />
                    <span>{type.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Salary Range */}
            <div className="space-y-2">
              <h4 className="font-medium text-sm text-gray-700 flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Salary Range
              </h4>
              <div className="space-y-1">
                {salaryRanges.map(range => (
                  <label key={range.value} className="flex items-center space-x-2 text-sm">
                    <input
                      type="checkbox"
                      checked={filters.salaryRanges.includes(range.value)}
                      onChange={() => toggleFilter('salaryRanges', range.value)}
                      className="rounded border-gray-300"
                    />
                    <span>{range.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Time Range */}
            <div className="space-y-2">
              <h4 className="font-medium text-sm text-gray-700 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Applied
              </h4>
              <div className="space-y-1">
                {timeRanges.map(range => (
                  <label key={range.value} className="flex items-center space-x-2 text-sm">
                    <input
                      type="radio"
                      name="timeRange"
                      checked={filters.timeRange === range.value}
                      onChange={() => toggleFilter('timeRange', range.value)}
                      className="rounded border-gray-300"
                    />
                    <span>{range.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}