import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifySessionToken } from '@/api/_lib/auth/session'

// Add all routes that should be accessible without authentication
const publicRoutes = [
  '/login',
  '/setup',
  '/api/auth/logout',
  '/api/auth/register-passkey',
  '/api/webauthn/authenticate/options',
  '/api/webauthn/authenticate/verify',
  '/api/oauth/authorize',
  '/api/oauth/callback',
  '/api/oauth/status',
  '/api/oauth/disconnect',
  '/api/resume-tailoring/complete',
  '/api/generate-section',
  '/api/export-simple-resume',
  '/api/health'
]

// Development auth bypass and setup mode
const isDevelopment = process.env.NODE_ENV === 'development'
// In development, always disable auth unless explicitly enabled
const isAuthDisabled = isDevelopment
const isSetupMode = process.env.ENABLE_SETUP_MODE === 'true'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // DEVELOPMENT ONLY: Skip all auth checks if disabled
  if (isAuthDisabled) {
    // Log warning on first request
    if (pathname === '/' || pathname === '/dashboard') {
      console.warn('⚠️  WARNING: Authentication is DISABLED in development mode!')
      console.warn('⚠️  Set DISABLE_AUTH_IN_DEV=false to enable authentication')
    }
    
    // Redirect login page to dashboard when auth is disabled
    if (pathname === '/login') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    
    return NextResponse.next()
  }

  // SETUP MODE: Skip all auth checks if setup mode is enabled
  if (isSetupMode) {
    // Log warning on first request
    if (pathname === '/' || pathname === '/dashboard') {
      console.warn('⚠️  WARNING: Authentication is DISABLED - Setup mode is enabled!')
      console.warn('⚠️  Set ENABLE_SETUP_MODE=false after initial setup')
    }
    return NextResponse.next()
  }
  
  // Check if the route is public
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))
  
  // Get the auth token from cookies
  const authToken = request.cookies.get('auth_token')?.value
  
  // If trying to access protected route without auth, redirect to login
  if (!isPublicRoute && !authToken) {
    const loginUrl = new URL('/login', request.url)
    // Add redirect param to return user to requested page after login
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }
  
  // If authenticated and trying to access login, redirect to dashboard
  if (isPublicRoute && authToken && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }
  
  // Simple JWT validation
  if (authToken && !isPublicRoute) {
    try {
      const session = verifySessionToken(authToken)
      
      if (!session) {
        // Invalid token, redirect to login
        const loginUrl = new URL('/login', request.url)
        loginUrl.searchParams.set('reason', 'session_invalid')
        return NextResponse.redirect(loginUrl)
      }
    } catch (error) {
      // Invalid token, redirect to login
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('reason', 'session_invalid')
      return NextResponse.redirect(loginUrl)
    }
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files
     * - api routes (except protected ones)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}