'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { apiConfig } from '@/config/api.config'

interface User {
  id: string
  email: string
  name?: string
  picture?: string
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  signup: (email: string, password: string, name?: string) => Promise<void>
  getToken: () => string | null
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [token, setToken] = useState<string | null>(null)

  // Check for existing session on mount
  useEffect(() => {
    checkPersonalAccess()
  }, [])

  // Simple personal access check
  const checkPersonalAccess = () => {
    try {
      const accessGranted = localStorage.getItem('harsha_access')
      const accessTime = localStorage.getItem('access_time')
      
      if (accessGranted === 'granted' && accessTime) {
        // Check if access is still valid (24 hours)
        const accessDate = new Date(accessTime)
        const now = new Date()
        const hoursDiff = (now.getTime() - accessDate.getTime()) / (1000 * 60 * 60)
        
        if (hoursDiff < 24) {
          // Still valid
          setUser({
            id: 'harsha-personal',
            email: 'harsha@personal.dev',
            name: 'Harsha Vippala'
          })
          setToken('personal-access-granted')
        } else {
          // Expired, clear access
          localStorage.removeItem('harsha_access')
          localStorage.removeItem('access_time')
        }
      }
    } catch (error) {
      console.error('Personal access check failed:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const login = async (email: string, password: string) => {
    // Simple personal access - not used in new UI
    localStorage.setItem('harsha_access', 'granted')
    localStorage.setItem('access_time', new Date().toISOString())
    
    setUser({
      id: 'harsha-personal',
      email: 'harsha@personal.dev',
      name: 'Harsha Vippala'
    })
    setToken('personal-access-granted')
  }

  const signup = async (email: string, password: string, name?: string) => {
    // Same as login for personal use
    return login(email, password)
  }

  const logout = async () => {
    // Clear personal access
    localStorage.removeItem('harsha_access')
    localStorage.removeItem('access_time')
    setToken(null)
    setUser(null)
  }

  const getToken = () => {
    return token || localStorage.getItem('auth_token')
  }

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    signup,
    getToken,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// HOC for protected routes
export function withAuth<P extends object>(
  Component: React.ComponentType<P>
): React.ComponentType<P> {
  return function AuthenticatedComponent(props: P) {
    const { isAuthenticated, isLoading } = useAuth()
    
    if (!apiConfig.auth.enabled) {
      return <Component {...props} />
    }
    
    if (isLoading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      )
    }
    
    if (!isAuthenticated) {
      // Redirect to login or show login prompt
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Authentication Required</h2>
            <p className="text-gray-600">Please log in to access this page.</p>
          </div>
        </div>
      )
    }
    
    return <Component {...props} />
  }
}