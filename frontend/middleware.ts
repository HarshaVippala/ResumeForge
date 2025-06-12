import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Skip auth for local development
  if (process.env.NODE_ENV === 'development') {
    return NextResponse.next()
  }

  // Skip auth if disabled
  if (process.env.NEXT_PUBLIC_SKIP_AUTH === 'true') {
    return NextResponse.next()
  }

  const basicAuth = request.headers.get('authorization')
  const url = request.nextUrl

  if (!basicAuth) {
    url.pathname = '/api/auth'
    return NextResponse.rewrite(url)
  }

  const authValue = basicAuth.split(' ')[1]
  const [user, pwd] = atob(authValue).split(':')

  // Set your credentials in environment variables (NOT NEXT_PUBLIC_)
  const validUser = process.env.BASIC_AUTH_USER || 'admin'
  const validPassword = process.env.BASIC_AUTH_PASSWORD || 'your-password'

  if (user === validUser && pwd === validPassword) {
    return NextResponse.next()
  }

  url.pathname = '/api/auth'
  return NextResponse.rewrite(url)
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}