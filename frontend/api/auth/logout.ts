import { NextRequest, NextResponse } from 'next/server'
import { clearAuthCookie } from '../_lib/auth/session'

export async function POST(request: NextRequest) {
  try {
    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully'
    })
    
    // Clear the auth cookie
    clearAuthCookie(response)
    
    return response
  } catch (error) {
    return NextResponse.json(
      { error: 'Logout failed' },
      { status: 500 }
    )
  }
}