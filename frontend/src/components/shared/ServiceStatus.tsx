'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Activity, 
  Database, 
  Brain, 
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  Mail
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useBackgroundSync } from '@/hooks/useBackgroundSync'
import { getApiUrl, apiConfig } from '@/config/api.config'

interface HealthStatus {
  status: string
  timestamp: string
  lm_studio_connected: boolean
  database_status: string
  database_type: 'postgresql' | 'sqlite'
}

interface ServiceStatusProps {
  className?: string
}

export function ServiceStatus({ className }: ServiceStatusProps) {
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [lastCheck, setLastCheck] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  // Get email sync status - only if feature is enabled
  const { status: syncStatus, lastUpdated: syncLastUpdated, unreadCount, isLoading: isSyncing } = 
    apiConfig.features.backgroundSync
      ? useBackgroundSync()
      : { status: 'disabled', lastUpdated: null, unreadCount: 0, isLoading: false }

  const fetchHealth = async (manual = false) => {
    if (manual) setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(getApiUrl('/api/health'), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`)
      }

      const data = await response.json()
      setHealth(data)
      setLastCheck(new Date())
    } catch (err) {
      console.error('Health check failed:', err)
      setError(err instanceof Error ? err.message : 'Health check failed')
      setHealth(null)
    } finally {
      if (manual) setIsLoading(false)
    }
  }

  useEffect(() => {
    // Initial health check
    fetchHealth()

    // Set up polling every 30 seconds
    const interval = setInterval(() => {
      fetchHealth()
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  const getStatusIcon = (connected: boolean, hasError: boolean) => {
    if (hasError) return <AlertCircle className="h-3 w-3 text-red-500" />
    if (connected) return <CheckCircle className="h-3 w-3 text-green-500" />
    return <AlertCircle className="h-3 w-3 text-red-500" />
  }

  const getStatusColor = (connected: boolean, hasError: boolean) => {
    if (hasError) return 'text-red-500'
    if (connected) return 'text-green-500'
    return 'text-red-500'
  }

  const formatLastCheck = () => {
    if (!lastCheck) return 'Never'
    const now = new Date()
    const diff = Math.floor((now.getTime() - lastCheck.getTime()) / 1000)
    
    if (diff < 60) return `${diff}s ago`
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    return lastCheck.toLocaleTimeString()
  }

  const formatSyncTime = () => {
    if (!syncLastUpdated) return 'Never'
    const now = new Date()
    const diff = Math.floor((now.getTime() - syncLastUpdated.getTime()) / 1000)
    
    if (diff < 60) return `${diff}s ago`
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    return syncLastUpdated.toLocaleTimeString()
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Email Sync Status - only show if feature is enabled */}
      {apiConfig.features.backgroundSync && (
        <div className="flex items-center gap-1 group relative">
        <Mail className="h-4 w-4 text-muted-foreground" />
        {isSyncing ? (
          <RefreshCw className="h-3 w-3 text-blue-500 animate-spin" />
        ) : syncStatus === 'error' ? (
          <AlertCircle className="h-3 w-3 text-red-500" />
        ) : (
          <CheckCircle className="h-3 w-3 text-green-500" />
        )}
        
        {/* Unread count indicator */}
        {unreadCount > 0 && (
          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
        )}
        
        {/* Tooltip */}
        <div className="absolute top-full right-0 mt-2 w-52 bg-popover border border-border rounded-lg shadow-lg p-3 opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none">
          <div className="text-xs space-y-1">
            <div className="font-medium">Email Sync</div>
            <div className={cn('flex items-center gap-1', isSyncing ? 'text-blue-500' : syncStatus === 'error' ? 'text-red-500' : 'text-green-500')}>
              {isSyncing ? (
                <>
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  <span>Syncing...</span>
                </>
              ) : syncStatus === 'error' ? (
                <>
                  <AlertCircle className="h-3 w-3" />
                  <span>Error</span>
                </>
              ) : (
                <>
                  <CheckCircle className="h-3 w-3" />
                  <span>Up to date</span>
                </>
              )}
            </div>
            {unreadCount > 0 && (
              <div className="text-blue-500">{unreadCount} unread emails</div>
            )}
            <div className="text-muted-foreground">Last sync: {formatSyncTime()}</div>
          </div>
        </div>
      </div>
      )}

      {/* LMStudio Status */}
      <div className="flex items-center gap-1 group relative">
        <Brain className="h-4 w-4 text-muted-foreground" />
        {getStatusIcon(health?.lm_studio_connected ?? false, !!error)}
        
        {/* Tooltip */}
        <div className="absolute top-full right-0 mt-2 w-48 bg-popover border border-border rounded-lg shadow-lg p-3 opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none">
          <div className="text-xs space-y-1">
            <div className="font-medium">LMStudio</div>
            <div className={cn('flex items-center gap-1', getStatusColor(health?.lm_studio_connected ?? false, !!error))}>
              {getStatusIcon(health?.lm_studio_connected ?? false, !!error)}
              <span>{health?.lm_studio_connected ? 'Connected' : 'Disconnected'}</span>
            </div>
            <div className="text-muted-foreground">Last check: {formatLastCheck()}</div>
          </div>
        </div>
      </div>

      {/* Database Status */}
      <div className="flex items-center gap-1 group relative">
        <Database className="h-4 w-4 text-muted-foreground" />
        {getStatusIcon(health?.database_status === 'connected', !!error)}
        
        {/* Tooltip */}
        <div className="absolute top-full right-0 mt-2 w-52 bg-popover border border-border rounded-lg shadow-lg p-3 opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none">
          <div className="text-xs space-y-1">
            <div className="font-medium">Database</div>
            <div className={cn('flex items-center gap-1', getStatusColor(health?.database_status === 'connected', !!error))}>
              {getStatusIcon(health?.database_status === 'connected', !!error)}
              <span>{health?.database_status === 'connected' ? 'Connected' : 'Disconnected'}</span>
            </div>
            <div className="text-muted-foreground">
              Type: {health?.database_type || 'Unknown'}
            </div>
            <div className="text-muted-foreground">Last check: {formatLastCheck()}</div>
          </div>
        </div>
      </div>

      {/* Manual Refresh Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => fetchHealth(true)}
        disabled={isLoading}
        className="h-8 w-8 p-0"
        title="Refresh service status"
      >
        <RefreshCw className={cn('h-3 w-3', isLoading && 'animate-spin')} />
      </Button>

      {/* Overall Status Badge */}
      {health && (
        <Badge 
          variant={health.lm_studio_connected && health.database_status === 'connected' && (syncStatus !== 'error' || !apiConfig.features.backgroundSync) ? 'default' : 'destructive'}
          className="text-xs"
        >
          {health.lm_studio_connected && health.database_status === 'connected' && (syncStatus !== 'error' || !apiConfig.features.backgroundSync) ? 'Online' : 'Issues'}
        </Badge>
      )}

      {error && (
        <div className="group relative">
          <AlertCircle className="h-4 w-4 text-red-500" />
          <div className="absolute top-full right-0 mt-2 w-64 bg-popover border border-border rounded-lg shadow-lg p-3 opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none">
            <div className="text-xs">
              <div className="font-medium text-red-500 mb-1">Error</div>
              <div className="text-muted-foreground">{error}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}