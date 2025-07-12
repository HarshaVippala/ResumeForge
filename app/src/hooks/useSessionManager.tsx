'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export function useSessionManager() {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)

  const checkSession = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/session')
      if (response.ok) {
        setIsAuthenticated(true)
      } else {
        setIsAuthenticated(false)
      }
    } catch (error) {
      setIsAuthenticated(false)
    }
  }, [])

  // Check session on mount
  useEffect(() => {
    checkSession()
  }, [checkSession])

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/login')
    } catch (error) {
      // Still redirect even if logout fails
      router.push('/login')
    }
  }, [router])

  return {
    isAuthenticated,
    checkSession,
    logout
  }
}