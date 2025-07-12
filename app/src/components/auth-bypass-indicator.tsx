'use client'

import { useEffect, useState } from 'react'
import { AlertCircle } from 'lucide-react'

export function AuthBypassIndicator() {
  const [isDev, setIsDev] = useState(false)
  
  useEffect(() => {
    // Only show in development when auth is disabled
    if (process.env.NODE_ENV === 'development') {
      setIsDev(true)
      console.warn('⚠️  Authentication is DISABLED in development mode')
      console.warn('⚠️  You can access all routes without logging in')
    }
  }, [])

  if (!isDev) return null

  return (
    <div className="fixed bottom-4 right-4 bg-yellow-500/10 border border-yellow-500/30 text-yellow-600 dark:text-yellow-400 px-3 py-2 rounded-lg flex items-center gap-2 text-sm z-50">
      <AlertCircle className="w-4 h-4" />
      <span>Auth disabled (dev mode)</span>
    </div>
  )
}