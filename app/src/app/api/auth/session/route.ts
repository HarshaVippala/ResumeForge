import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken } from '@/api/_lib/auth/session'
import { development } from '@/api/_lib/config'

export async function GET(request: NextRequest) {
  try {
    // Check if auth is disabled in development
    // Last modified: 2025-01-09 - Use real user data
    if (development.disableAuth) {
      // Return real user session for development
      return NextResponse.json({
        user: {
          id: 'f556989c-4903-47d6-8700-0afe3d4189e5',
          email: process.env.USER_EMAIL || 'user@example.com',
          name: process.env.USER_FULL_NAME || 'Harsha Vippala'
        },
        userId: 'f556989c-4903-47d6-8700-0afe3d4189e5'
      })
    }

    const token = request.cookies.get('auth_token')?.value
    
    if (!token) {
      return NextResponse.json(
        { error: 'No session found' },
        { status: 401 }
      )
    }

    const session = verifySessionToken(token)
    
    if (!session) {
      return NextResponse.json(
        { error: 'Invalid or expired session' },
        { status: 401 }
      )
    }

    // Session is valid - return minimal user info
    return NextResponse.json({
      user: {
        id: session.userId,
        email: `user-${session.userId}@resumeforge.app`, // Simple placeholder
        name: session.deviceName || 'User'
      },
      userId: session.userId
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Session check failed' },
      { status: 500 }
    )
  }
}