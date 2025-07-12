'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()

  useEffect(() => {
    // Log the error to console
    console.error('Error boundary caught:', error)
    
    // In development, if there's a WebAuthn error, redirect to dashboard
    if (process.env.NODE_ENV === 'development' && 
        (error.message.includes('webauthn') || 
         error.message.includes('passkey') ||
         error.message.includes('404'))) {
      console.log('WebAuthn error in development, redirecting to dashboard...')
      router.push('/dashboard')
    }
  }, [error, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md w-full space-y-8 p-8 bg-card rounded-lg shadow-lg">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground">Something went wrong!</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {error.message || 'An unexpected error occurred'}
          </p>
        </div>
        
        <div className="space-y-4">
          <Button
            onClick={() => reset()}
            className="w-full"
          >
            Try again
          </Button>
          
          <Button
            onClick={() => router.push('/dashboard')}
            variant="outline"
            className="w-full"
          >
            Go to Dashboard
          </Button>
        </div>
        
        {process.env.NODE_ENV === 'development' && (
          <details className="mt-4 p-4 bg-secondary rounded-lg">
            <summary className="cursor-pointer text-sm font-medium">Error Details</summary>
            <pre className="mt-2 text-xs overflow-auto">
              {error.stack}
            </pre>
          </details>
        )}
      </div>
    </div>
  )
}