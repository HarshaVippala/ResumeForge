'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Fingerprint, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'
import { registerPasskey } from '@/lib/webauthn'

export default function SetupPage() {
  const router = useRouter()
  const [isRegistering, setIsRegistering] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const handleRegisterPasskey = async () => {
    setIsRegistering(true)
    setStatus('idle')
    setMessage('')
    
    try {
      const registered = await registerPasskey('Initial Device')
      if (registered) {
        setStatus('success')
        setMessage('Passkey registered successfully! Redirecting...')
        setTimeout(() => {
          router.push('/dashboard')
        }, 2000)
      } else {
        setStatus('error')
        setMessage('Registration failed. Please try again.')
      }
    } catch (err: any) {
      console.error('Registration error:', err)
      setStatus('error')
      setMessage(err.message || 'Failed to register passkey')
    } finally {
      setIsRegistering(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full space-y-8"
      >
        <div className="text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
            className="inline-flex p-4 rounded-full bg-primary/10 mb-4"
          >
            <Fingerprint className="w-12 h-12 text-primary" />
          </motion.div>
          
          <h1 className="text-3xl font-bold tracking-tight">Welcome to ResumeForge</h1>
          <p className="mt-2 text-muted-foreground">
            Let's set up your secure passkey authentication
          </p>
        </div>

        <div className="bg-card p-6 rounded-lg border shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Register Your Device</h2>
          <p className="text-sm text-muted-foreground mb-6">
            This will enable Touch ID, Face ID, or your device's built-in authenticator 
            for secure, passwordless login.
          </p>

          <button
            onClick={handleRegisterPasskey}
            disabled={isRegistering || status === 'success'}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground 
                     hover:bg-primary/90 px-4 py-3 rounded-md font-medium transition-colors
                     disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRegistering ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Registering...
              </>
            ) : status === 'success' ? (
              <>
                <CheckCircle className="w-4 h-4" />
                Success!
              </>
            ) : (
              <>
                <Fingerprint className="w-4 h-4" />
                Register Passkey
              </>
            )}
          </button>

          {message && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`mt-4 p-3 rounded-md flex items-start gap-2 ${
                status === 'success' 
                  ? 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400' 
                  : 'bg-destructive/10 text-destructive'
              }`}
            >
              {status === 'success' ? (
                <CheckCircle className="w-4 h-4 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 mt-0.5" />
              )}
              <span className="text-sm">{message}</span>
            </motion.div>
          )}
        </div>

        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Already have a passkey?{' '}
            <button
              onClick={() => router.push('/login')}
              className="text-primary hover:underline"
            >
              Go to login
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  )
}