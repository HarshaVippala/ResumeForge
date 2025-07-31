'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  History, 
  RotateCcw, 
  Trash2, 
  ChevronDown, 
  ChevronRight,
  Clock,
  FileText,
  Eye
} from 'lucide-react'
import type { ResumeVersion, VersionHistoryState } from '@/types'

interface VersionHistoryProps {
  versionHistory: VersionHistoryState
  onRevertToVersion: (versionId: string) => void
  onDeleteVersion: (versionId: string) => void
  onClearHistory: () => void
}

export function VersionHistory({ 
  versionHistory, 
  onRevertToVersion, 
  onDeleteVersion, 
  onClearHistory 
}: VersionHistoryProps) {
  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(new Set())

  const toggleExpanded = (versionId: string) => {
    setExpandedVersions(prev => {
      const newSet = new Set(prev)
      if (newSet.has(versionId)) {
        newSet.delete(versionId)
      } else {
        newSet.add(versionId)
      }
      return newSet
    })
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getChangeTypeColor = (type: string) => {
    switch (type) {
      case 'create': return 'bg-green-100 text-green-800'
      case 'update': return 'bg-blue-100 text-blue-800'
      case 'regenerate': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getChangeTypeIcon = (type: string) => {
    switch (type) {
      case 'create': return '✨'
      case 'update': return '✏️'
      case 'regenerate': return '🔄'
      default: return '📝'
    }
  }

  if (versionHistory.versions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <h3 className="font-medium text-gray-900 flex items-center gap-2">
            <History className="h-4 w-4" />
            Version History
          </h3>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-foreground/60">
            <History className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm">No versions saved yet</p>
            <p className="text-xs text-foreground/50 mt-1">
              Versions will be created automatically when you make changes
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-gray-900 flex items-center gap-2">
            <History className="h-4 w-4" />
            Version History ({versionHistory.versions.length})
          </h3>
          <Button
            variant="outline"
            size="sm"
            onClick={onClearHistory}
            className="text-red-600 hover:text-red-700"
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Clear All
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 max-h-96 overflow-y-auto">
        {versionHistory.versions.map((version, index) => (
          <div
            key={version.id}
            className={`border rounded-lg p-3 ${
              version.id === versionHistory.currentVersionId 
                ? 'border-blue-300 bg-blue-50' 
                : 'border-gray-200'
            }`}
          >
            {/* Version Header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleExpanded(version.id)}
                  className="text-foreground/50 hover:text-foreground/70"
                >
                  {expandedVersions.has(version.id) ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
                <div>
                  <h4 className="text-sm font-medium text-foreground">
                    {version.description}
                  </h4>
                  <div className="flex items-center gap-2 text-xs text-foreground/60">
                    <Clock className="h-3 w-3" />
                    {formatTimestamp(version.timestamp)}
                    {index === 0 && (
                      <Badge variant="secondary" className="text-xs">Latest</Badge>
                    )}
                    {version.id === versionHistory.currentVersionId && (
                      <Badge variant="default" className="text-xs">Current</Badge>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRevertToVersion(version.id)}
                  disabled={version.id === versionHistory.currentVersionId}
                  className="text-xs"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Revert
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDeleteVersion(version.id)}
                  className="text-red-600 hover:text-red-700 text-xs"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Changes Summary */}
            <div className="flex flex-wrap gap-1 mb-2">
              {version.changes.map((change, changeIndex) => (
                <Badge
                  key={changeIndex}
                  className={`text-xs ${getChangeTypeColor(change.type)}`}
                >
                  {getChangeTypeIcon(change.type)} {change.section}
                </Badge>
              ))}
            </div>

            {/* Expanded Details */}
            {expandedVersions.has(version.id) && (
              <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                {version.changes.map((change, changeIndex) => (
                  <div key={changeIndex} className="text-xs">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium capitalize">{change.section}</span>
                      <Badge className={`text-xs ${getChangeTypeColor(change.type)}`}>
                        {change.type}
                      </Badge>
                    </div>
                    {change.keywords_used.length > 0 && (
                      <div className="text-foreground/70">
                        <span className="font-medium">Keywords used:</span>{' '}
                        {change.keywords_used.slice(0, 3).join(', ')}
                        {change.keywords_used.length > 3 && ` +${change.keywords_used.length - 3} more`}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
