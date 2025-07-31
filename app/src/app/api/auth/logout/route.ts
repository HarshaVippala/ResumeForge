import { NextRequest, NextResponse } from 'next/server'
import { clearAuthCookie } from '@/api/_lib/auth/session'

export async function POST(request: NextRequest) {
  // Create response that redirects to login
  const response = NextResponse.redirect(new URL('/login', request.url))
  
  // Clear the auth cookie
  clearAuthCookie(response)
  
  return response
}

// Also support GET for convenience
export async function GET(request: NextRequest) {
  return POST(request)
}