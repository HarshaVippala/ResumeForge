'use client'

import { useSessionManager } from '@/hooks/useSessionManager'
import { usePathname } from 'next/navigation'

interface SessionProviderProps {
  children: React.ReactNode
}

export function SessionProvider({ children }: SessionProviderProps) {
  const pathname = usePathname()
  const { SessionWarningModal } = useSessionManager()

  // Don't apply session management to public pages
  if (pathname === '/login' || pathname === '/setup-passkey') {
    return <>{children}</>
  }

  return (
    <>
      {children}
      <SessionWarningModal />
    </>
  )
}