import { NextRequest, NextResponse } from 'next/server'
import { createSessionToken, setAuthCookie } from '@/api/_lib/auth/session'

/**
 * Manual login bypass for development - Harsha only
 * This allows direct login without WebAuthn for debugging
 */
export async function POST(request: NextRequest) {
  try {
    // Create session token
    const token = createSessionToken({
      userId: 'harsha-primary',
      credentialId: 'manual_harsha_mac_touchid',
      deviceName: 'Harsha Mac (Manual Entry)',
    })

    // Set auth cookie and return success
    const response = NextResponse.json({ 
      success: true,
      message: 'Manual login successful' 
    })
    
    setAuthCookie(response, token)

    return response
  } catch (error) {
    console.error('Manual login error:', error)
    return NextResponse.json(
      { error: 'Manual login failed' },
      { status: 500 }
    )
  }
}