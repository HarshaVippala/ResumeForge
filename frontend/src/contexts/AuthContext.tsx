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
    if (apiConfig.auth.enabled) {
      checkSession()
    } else {
      setIsLoading(false)
    }
  }, [])

  const checkSession = async () => {
    try {
      const storedToken = localStorage.getItem('auth_token')
      if (storedToken) {
        // Validate token with backend
        const response = await fetch(`${apiConfig.baseUrl}/api/auth/validate`, {
          headers: {
            'Authorization': `Bearer ${storedToken}`,
          },
        })
        
        if (response.ok) {
          const userData = await response.json()
          setUser(userData.user)
          setToken(storedToken)
        } else {
          // Token is invalid, clear it
          localStorage.removeItem('auth_token')
        }
      }
    } catch (error) {
      console.error('Session check failed:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const login = async (email: string, password: string) => {
    try {
      const response = await fetch(`${apiConfig.baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Login failed')
      }

      const data = await response.json()
      
      // Store token
      localStorage.setItem('auth_token', data.token)
      setToken(data.token)
      setUser(data.user)
    } catch (error) {
      console.error('Login error:', error)
      throw error
    }
  }

  const signup = async (email: string, password: string, name?: string) => {
    try {
      const response = await fetch(`${apiConfig.baseUrl}/api/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, name }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Signup failed')
      }

      const data = await response.json()
      
      // Store token
      localStorage.setItem('auth_token', data.token)
      setToken(data.token)
      setUser(data.user)
    } catch (error) {
      console.error('Signup error:', error)
      throw error
    }
  }

  const logout = async () => {
    try {
      // Call logout endpoint if available
      if (token) {
        await fetch(`${apiConfig.baseUrl}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        })
      }
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      // Clear local state regardless of API call result
      localStorage.removeItem('auth_token')
      setToken(null)
      setUser(null)
    }
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