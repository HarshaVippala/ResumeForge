import { useState, useCallback } from 'react'
import type { ResumeState, ResumeVersion, VersionHistoryState } from '@/types'

export function useVersionHistory(initialState: ResumeState) {
  const [versionHistory, setVersionHistory] = useState<VersionHistoryState>({
    versions: [],
    currentVersionId: null,
    maxVersions: 10 // Keep last 10 versions
  })

  const createVersion = useCallback((
    resumeState: ResumeState,
    description: string,
    changes: ResumeVersion['changes']
  ) => {
    const newVersion: ResumeVersion = {
      id: `version_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      description,
      changes,
      resumeState: JSON.parse(JSON.stringify(resumeState)) // Deep clone
    }

    setVersionHistory(prev => {
      const newVersions = [newVersion, ...prev.versions]
      
      // Keep only the last maxVersions
      if (newVersions.length > prev.maxVersions) {
        newVersions.splice(prev.maxVersions)
      }

      return {
        ...prev,
        versions: newVersions,
        currentVersionId: newVersion.id
      }
    })

    return newVersion.id
  }, [])

  const revertToVersion = useCallback((versionId: string): ResumeState | null => {
    const version = versionHistory.versions.find(v => v.id === versionId)
    if (!version) return null

    setVersionHistory(prev => ({
      ...prev,
      currentVersionId: versionId
    }))

    return JSON.parse(JSON.stringify(version.resumeState)) // Deep clone
  }, [versionHistory.versions])

  const getVersionDiff = useCallback((versionId: string) => {
    const version = versionHistory.versions.find(v => v.id === versionId)
    return version?.changes || []
  }, [versionHistory.versions])

  const deleteVersion = useCallback((versionId: string) => {
    setVersionHistory(prev => ({
      ...prev,
      versions: prev.versions.filter(v => v.id !== versionId),
      currentVersionId: prev.currentVersionId === versionId ? null : prev.currentVersionId
    }))
  }, [])

  const clearHistory = useCallback(() => {
    setVersionHistory({
      versions: [],
      currentVersionId: null,
      maxVersions: 10
    })
  }, [])

  return {
    versionHistory,
    createVersion,
    revertToVersion,
    getVersionDiff,
    deleteVersion,
    clearHistory
  }
}
