import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken } from '@/api/_lib/auth/session'

export async function GET(request: NextRequest) {
  try {
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

    // Session is valid
    return NextResponse.json({
      valid: true,
      userId: session.userId,
      deviceName: session.deviceName,
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Session check failed' },
      { status: 500 }
    )
  }
}