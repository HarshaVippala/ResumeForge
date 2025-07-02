import { NextResponse } from 'next/server'
import { createSessionToken, setAuthCookie } from '@/api/_lib/auth/session'

/**
 * Manual login for Harsha - bypasses WebAuthn completely
 * Use this to log in immediately while we debug the Touch ID setup
 */
export async function POST() {
  try {
    // Create session token
    const token = createSessionToken({
      userId: 'harsha-primary',
      credentialId: 'manual_login_bypass',
      deviceName: 'Manual Login',
    })

    // Set auth cookie and return success
    const response = NextResponse.json({ 
      success: true,
      message: 'Manual login successful - redirecting to dashboard' 
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