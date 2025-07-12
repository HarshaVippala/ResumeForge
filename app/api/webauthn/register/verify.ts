import { NextRequest, NextResponse } from 'next/server'
import { verifyRegistration } from '../../_lib/auth/webauthn'
import { getSupabase } from '../../_lib/db'
import { createSessionToken, setAuthCookie } from '../../_lib/auth/session'
import { isRateLimited, resetRateLimit, createRateLimitResponse } from '../../_lib/auth/rate-limit'
import base64url from 'base64url'

interface VerifyRegistrationBody {
  credential: any; // WebAuthn credential response
  deviceName?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Check rate limiting
    const rateLimitResult = isRateLimited(request, 'passkey');
    if (rateLimitResult.isLimited) {
      return createRateLimitResponse(rateLimitResult.resetTime);
    }
    const body = await request.json() as VerifyRegistrationBody
    const { credential: credentialResponse, deviceName = 'Unknown Device' } = body

    // Get challenge from cookie
    const challenge = request.cookies.get('webauthn_challenge')?.value
    if (!challenge) {
      return NextResponse.json(
        { error: 'Challenge not found' },
        { status: 400 }
      )
    }

    // Verify the registration
    const verification = await verifyRegistration(credentialResponse, challenge)

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json(
        { error: 'Registration verification failed' },
        { status: 400 }
      )
    }

    const { credential } = verification.registrationInfo

    // Store credential in database
    const supabase = getSupabase()
    const { error: dbError } = await supabase
      .from('user_credentials')
      .insert({
        credential_id: credential.id,
        public_key: base64url.encode(Buffer.from(credential.publicKey)),
        counter: credential.counter,
        device_name: deviceName,
      })

    if (dbError) {
      console.error('Error storing credential:', dbError)
      return NextResponse.json(
        { error: 'Failed to store credential' },
        { status: 500 }
      )
    }

    // Create session
    const userId = process.env.USER_ID || 'f556989c-4903-47d6-8700-0afe3d4189e5';
    const token = createSessionToken({
      userId,
      credentialId: credential.id,
      deviceName,
    })

    // Set auth cookie and return success
    const response = NextResponse.json({ 
      verified: true,
      message: 'Passkey registered successfully' 
    })
    
    setAuthCookie(response, token)
    
    // Clear challenge cookie
    response.cookies.delete('webauthn_challenge')

    // Reset rate limit on successful registration
    resetRateLimit(request, 'passkey');

    return response
  } catch (error) {
    console.error('Error verifying registration:', error)
    return NextResponse.json(
      { error: 'Registration failed' },
      { status: 500 }
    )
  }
}