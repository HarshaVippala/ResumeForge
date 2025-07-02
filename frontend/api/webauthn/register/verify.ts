import { NextRequest, NextResponse } from 'next/server'
import { verifyRegistration } from '../../_lib/auth/webauthn'
import { createClient } from '../../_lib/db/client'
import { createSessionToken, setAuthCookie } from '../../_lib/auth/session'
import base64url from 'base64url'

interface VerifyRegistrationBody {
  credential: any; // WebAuthn credential response
  deviceName?: string;
}

export async function POST(request: NextRequest) {
  try {
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
    const supabase = createClient()
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
    const token = createSessionToken({
      userId: 'harsha-primary',
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

    return response
  } catch (error) {
    console.error('Error verifying registration:', error)
    return NextResponse.json(
      { error: 'Registration failed' },
      { status: 500 }
    )
  }
}