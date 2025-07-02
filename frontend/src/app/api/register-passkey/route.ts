import { NextRequest, NextResponse } from 'next/server'
import { generateRegistrationOptionsForUser, verifyRegistration } from '@/api/_lib/auth/webauthn'
import { createClient } from '@/api/_lib/db/client'
import { createSessionToken, setAuthCookie } from '@/api/_lib/auth/session'

export async function GET(request: NextRequest) {
  try {
    // Generate registration options
    const options = await generateRegistrationOptionsForUser([])
    
    // Store challenge
    const response = NextResponse.json(options)
    response.cookies.set('webauthn_challenge', options.challenge, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 5,
      path: '/',
    })

    return response
  } catch (error) {
    console.error('Registration options error:', error)
    return NextResponse.json({ error: 'Failed to generate options' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { credential: credentialResponse } = body

    // Get challenge
    const challenge = request.cookies.get('webauthn_challenge')?.value
    if (!challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 400 })
    }

    // Verify registration
    const verification = await verifyRegistration(credentialResponse, challenge)

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json({ error: 'Registration failed' }, { status: 400 })
    }

    const { credential } = verification.registrationInfo

    // Store credential
    const supabase = createClient()
    const { error: dbError } = await supabase
      .from('user_credentials')
      .insert({
        credential_id: credential.id,
        public_key: Buffer.from(credential.publicKey).toString('base64'),
        counter: credential.counter,
        device_name: 'Primary Device',
      })

    if (dbError) {
      console.error('Database error:', dbError)
      return NextResponse.json({ error: 'Failed to store credential' }, { status: 500 })
    }

    // Create session
    const token = createSessionToken({
      userId: 'harsha-primary',
      credentialId: credential.id,
      deviceName: 'Primary Device',
    })

    // Set auth cookie and return success
    const response = NextResponse.json({ 
      verified: true,
      message: 'Registration successful' 
    })
    
    setAuthCookie(response, token)
    response.cookies.delete('webauthn_challenge')

    return response
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 })
  }
}