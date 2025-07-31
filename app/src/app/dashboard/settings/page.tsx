'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Mail, CheckCircle, XCircle, Loader2, RefreshCw, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useGmailOAuth } from '@/hooks/useGmailOAuth'

export default function SettingsPage() {
  const { isAuthenticated, isLoading, error, startOAuthFlow, disconnect, checkAuthStatus } = useGmailOAuth()
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [emailStats, setEmailStats] = useState<{ emailCount: number; lastSync: string | null }>({
    emailCount: 0,
    lastSync: null
  })

  useEffect(() => {
    fetchEmailStats()
  }, [isAuthenticated])

  const fetchEmailStats = async () => {
    try {
      const apiKey = process.env.NEXT_PUBLIC_PERSONAL_API_KEY;
      const response = await fetch('/api/email?action=sync-status', {
        headers: apiKey ? { 'x-api-key': apiKey } : {}
      })
      const data = await response.json()
      if (data) {
        setEmailStats({
          emailCount: data.emailCount || 0,
          lastSync: data.lastSync || null
        })
      }
    } catch (error) {
      console.error('Failed to fetch email stats:', error)
    }
  }

  const handleDisconnect = async () => {
    setIsDisconnecting(true)
    await disconnect()
    setIsDisconnecting(false)
    setEmailStats({ emailCount: 0, lastSync: null })
  }

  const handleSync = async () => {
    try {
      const apiKey = process.env.NEXT_PUBLIC_PERSONAL_API_KEY;
      const response = await fetch('/api/email?action=sync', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(apiKey ? { 'x-api-key': apiKey } : {})
        },
        body: JSON.stringify({ fullSync: false })
      })
      
      if (response.ok) {
        await fetchEmailStats()
        await checkAuthStatus()
      }
    } catch (error) {
      console.error('Sync failed:', error)
    }
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-background p-4 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-2"
        >
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">Manage your integrations and preferences</p>
        </motion.div>

        {/* Gmail Integration Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card rounded-xl border shadow-sm overflow-hidden"
        >
          <div className="p-6 space-y-6">
            {/* Gmail Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                  <Mail className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Gmail Integration</h2>
                  <p className="text-sm text-muted-foreground">
                    Connect your Gmail to automatically track job-related emails
                  </p>
                </div>
              </div>
              <Badge variant={isAuthenticated ? "default" : "secondary"}>
                {isLoading ? "Checking..." : isAuthenticated ? "Connected" : "Not Connected"}
              </Badge>
            </div>

            {/* Status Display */}
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-4">
                {/* Connection Status */}
                <div className="flex items-center gap-2 p-4 rounded-lg bg-secondary/50">
                  {isAuthenticated ? (
                    <>
                      <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                      <span className="text-sm font-medium">Gmail is connected and syncing</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                      <span className="text-sm font-medium">Gmail is not connected</span>
                    </>
                  )}
                </div>

                {/* Email Stats (if connected) */}
                {isAuthenticated && emailStats.emailCount > 0 && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg border bg-background">
                      <p className="text-sm text-muted-foreground">Total Emails</p>
                      <p className="text-2xl font-bold">{emailStats.emailCount}</p>
                    </div>
                    <div className="p-4 rounded-lg border bg-background">
                      <p className="text-sm text-muted-foreground">Last Sync</p>
                      <p className="text-sm font-medium">
                        {emailStats.lastSync ? new Date(emailStats.lastSync).toLocaleString() : 'Never'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Error Display */}
                {error && (
                  <div className="p-4 rounded-lg bg-destructive/10 text-destructive">
                    <p className="text-sm font-medium">{error}</p>
                    {error.includes('not configured') && (
                      <div className="mt-2 text-sm">
                        <p className="mb-2">Required environment variables:</p>
                        <ul className="list-disc list-inside space-y-1 text-xs">
                          <li>GOOGLE_CLIENT_ID</li>
                          <li>GOOGLE_CLIENT_SECRET</li>
                          <li>GMAIL_TOKEN_ENCRYPTION_KEY</li>
                        </ul>
                        <p className="mt-2">See the documentation for setup instructions.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3">
                  {isAuthenticated ? (
                    <>
                      <Button
                        onClick={handleSync}
                        variant="outline"
                        className="flex-1"
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Sync Now
                      </Button>
                      <Button
                        onClick={handleDisconnect}
                        variant="destructive"
                        disabled={isDisconnecting}
                        className="flex-1"
                      >
                        {isDisconnecting ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Disconnecting...
                          </>
                        ) : (
                          <>
                            <LogOut className="w-4 h-4 mr-2" />
                            Disconnect
                          </>
                        )}
                      </Button>
                    </>
                  ) : (
                    <Button
                      onClick={startOAuthFlow}
                      className="w-full"
                    >
                      <Mail className="w-4 h-4 mr-2" />
                      Connect Gmail
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Additional Settings Cards can go here */}
      </div>
    </div>
  )
}