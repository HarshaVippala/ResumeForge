'use client'

interface SessionProviderProps {
  children: React.ReactNode
}

export function SessionProvider({ children }: SessionProviderProps) {
  // Simple provider that just wraps children
  // All session logic is handled by the hooks
  return <>{children}</>
}