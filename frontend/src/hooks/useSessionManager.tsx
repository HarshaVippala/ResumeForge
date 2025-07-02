'use client'

import { useEffect, useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'

interface SessionConfig {
  maxInactivityMinutes?: number
  warningBeforeMinutes?: number
  checkIntervalSeconds?: number
}

const DEFAULT_CONFIG: Required<SessionConfig> = {
  maxInactivityMinutes: parseInt(process.env.NEXT_PUBLIC_INACTIVITY_TIMEOUT || '30'),
  warningBeforeMinutes: 5,
  checkIntervalSeconds: 60, // Check every minute
}

export function useSessionManager(config: SessionConfig = {}) {
  const router = useRouter()
  const [showWarning, setShowWarning] = useState(false)
  const [minutesRemaining, setMinutesRemaining] = useState(0)
  const [lastActivity, setLastActivity] = useState(Date.now())
  
  const finalConfig = { ...DEFAULT_CONFIG, ...config }

  // Update last activity timestamp
  const updateActivity = useCallback(() => {
    setLastActivity(Date.now())
    setShowWarning(false)
  }, [])

  // Check session status
  const checkSession = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/session', {
        method: 'GET',
        credentials: 'include',
      })
      
      if (!response.ok) {
        // Session expired, redirect to login
        router.push('/login?reason=session_expired')
        return false
      }
      
      return true
    } catch (error) {
      console.error('Session check failed:', error)
      return false
    }
  }, [router])

  // Handle logout
  const handleLogout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      })
    } catch (error) {
      console.error('Logout failed:', error)
    }
    
    router.push('/login?reason=inactivity')
  }, [router])

  // Extend session
  const extendSession = useCallback(async () => {
    updateActivity()
    // Optionally refresh the token here
    await checkSession()
  }, [updateActivity, checkSession])

  // Check inactivity
  useEffect(() => {
    const checkInactivity = () => {
      const now = Date.now()
      const inactiveMinutes = (now - lastActivity) / 1000 / 60
      
      if (inactiveMinutes >= finalConfig.maxInactivityMinutes) {
        // Auto logout due to inactivity
        handleLogout()
      } else if (inactiveMinutes >= finalConfig.maxInactivityMinutes - finalConfig.warningBeforeMinutes) {
        // Show warning
        const remaining = Math.ceil(finalConfig.maxInactivityMinutes - inactiveMinutes)
        setMinutesRemaining(remaining)
        setShowWarning(true)
      }
    }

    const interval = setInterval(checkInactivity, finalConfig.checkIntervalSeconds * 1000)
    return () => clearInterval(interval)
  }, [lastActivity, finalConfig, handleLogout])

  // Activity listeners
  useEffect(() => {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click']
    
    const handleActivity = () => {
      updateActivity()
    }

    // Add event listeners
    events.forEach(event => {
      document.addEventListener(event, handleActivity)
    })

    // Initial session check
    checkSession()

    // Cleanup
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity)
      })
    }
  }, [updateActivity, checkSession])

  // Session warning modal component
  const SessionWarningModal = () => (
    <AnimatePresence>
      {showWarning && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-background border border-border rounded-lg p-6 max-w-md w-full shadow-xl"
          >
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Session Expiring Soon
            </h3>
            <p className="text-muted-foreground mb-4">
              Your session will expire in {minutesRemaining} minute{minutesRemaining !== 1 ? 's' : ''} due to inactivity.
            </p>
            <div className="flex gap-3">
              <button
                onClick={extendSession}
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Stay Logged In
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 bg-secondary hover:bg-secondary/80 text-secondary-foreground px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Log Out
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )

  return {
    SessionWarningModal,
    isActive: Date.now() - lastActivity < finalConfig.maxInactivityMinutes * 60 * 1000,
    updateActivity,
    extendSession,
    logout: handleLogout,
  }
}