'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Lock } from 'lucide-react'

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  // Skip in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      setIsAuthenticated(true)
      return
    }

    // Check if already authenticated
    const authStatus = localStorage.getItem('app_authenticated')
    if (authStatus === 'true') {
      setIsAuthenticated(true)
    }
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Set your password here or use environment variable
    const correctPassword = process.env.NEXT_PUBLIC_APP_PASSWORD || 'mypassword123'
    
    if (password === correctPassword) {
      setIsAuthenticated(true)
      localStorage.setItem('app_authenticated', 'true')
      setError('')
    } else {
      setError('Incorrect password')
      setPassword('')
    }
  }

  if (isAuthenticated) {
    return <>{children}</>
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md p-8">
        <div className="text-center mb-6">
          <Lock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold">Resume Builder</h1>
          <p className="text-gray-600 mt-2">Enter password to continue</p>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full"
            />
            {error && (
              <p className="text-red-500 text-sm">{error}</p>
            )}
            <Button type="submit" className="w-full">
              Access App
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}