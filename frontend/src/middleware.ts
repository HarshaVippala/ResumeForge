import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifySessionToken, createSessionToken, setAuthCookie } from '@/api/_lib/auth/session'

// Add all routes that should be accessible without authentication
const publicRoutes = ['/login', '/setup-passkey', '/register-touch-id', '/api/webauthn/register', '/api/webauthn/authenticate', '/api/auth/logout', '/api/manual-login', '/api/add-manual-passkey']

// Session refresh configuration
const REFRESH_THRESHOLD = 30 * 60 * 1000 // 30 minutes
const shouldRefreshToken = process.env.AUTO_REFRESH_SESSION === 'true'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
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
  
  // Check and refresh token if needed
  if (authToken && !isPublicRoute && shouldRefreshToken) {
    try {
      const session = verifySessionToken(authToken)
      
      if (session) {
        // Check if token should be refreshed (within 30 minutes of expiry)
        const tokenData = JSON.parse(Buffer.from(authToken.split('.')[1], 'base64').toString())
        const expiryTime = tokenData.exp * 1000
        const now = Date.now()
        
        if (expiryTime - now < REFRESH_THRESHOLD) {
          // Refresh the token
          const newToken = createSessionToken({
            userId: session.userId,
            credentialId: session.credentialId,
            deviceName: session.deviceName,
          })
          
          const response = NextResponse.next()
          setAuthCookie(response, newToken)
          return response
        }
      }
    } catch (error) {
      // Invalid token, redirect to login
      if (!isPublicRoute) {
        const loginUrl = new URL('/login', request.url)
        loginUrl.searchParams.set('reason', 'session_invalid')
        return NextResponse.redirect(loginUrl)
      }
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