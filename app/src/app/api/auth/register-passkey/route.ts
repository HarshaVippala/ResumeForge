import { NextRequest, NextResponse } from 'next/server'
import { 
  generateRegistrationOptionsForUser, 
  verifyRegistration,
  type StoredCredential 
} from '@/api/_lib/auth/webauthn'
import { getSupabase } from '@/api/_lib/db'
import { createSessionToken, setAuthCookie } from '@/api/_lib/auth/session'
import { isRateLimited, resetRateLimit, createRateLimitResponse } from '@/api/_lib/auth/rate-limit'
import base64url from 'base64url'
import type { RegistrationResponseJSON } from '@simplewebauthn/server'

// Handle GET request for registration options
export async function GET(request: NextRequest) {
  try {
    // Check rate limiting
    const rateLimitResult = isRateLimited(request, 'passkey');
    if (rateLimitResult.isLimited) {
      return createRateLimitResponse(rateLimitResult.resetTime);
    }
    const supabase = getSupabase()
    
    // Get existing credentials from database
    const { data: credentials } = await supabase
      .from('user_credentials')
      .select('*')
      .order('created_at', { ascending: false })

    // Map database credentials to StoredCredential format
    const storedCredentials: StoredCredential[] = credentials?.map(cred => ({
      id: cred.credential_id,
      publicKey: cred.public_key,
      counter: cred.counter,
      deviceName: cred.device_name,
      createdAt: new Date(cred.created_at),
      lastUsed: cred.last_used ? new Date(cred.last_used) : undefined,
    })) || []

    // Generate registration options
    const options = await generateRegistrationOptionsForUser(storedCredentials)

    // Store challenge in session for verification
    const response = NextResponse.json(options)
    response.cookies.set('webauthn_challenge', options.challenge, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 5, // 5 minutes
      path: '/',
    })

    return response
  } catch (error) {
    console.error('Error generating registration options:', error)
    return NextResponse.json(
      { error: 'Failed to generate registration options' },
      { status: 500 }
    )
  }
}

// Handle POST request for registration verification
export async function POST(request: NextRequest) {
  try {
    // Check rate limiting
    const rateLimitResult = isRateLimited(request, 'passkey');
    if (rateLimitResult.isLimited) {
      return createRateLimitResponse(rateLimitResult.resetTime);
    }
    const body = await request.json()
    const { credential, deviceName = 'Unknown Device' } = body

    // Get challenge from cookie
    const challenge = request.cookies.get('webauthn_challenge')?.value
    if (!challenge) {
      return NextResponse.json(
        { error: 'Challenge not found. Please restart registration.' },
        { status: 400 }
      )
    }

    // Verify the registration
    const verification = await verifyRegistration(
      credential as RegistrationResponseJSON, 
      challenge
    )

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json(
        { error: 'Registration verification failed' },
        { status: 400 }
      )
    }

    const { credential: verifiedCredential } = verification.registrationInfo

    // Store credential in database
    const supabase = getSupabase()
    const { error: dbError } = await supabase
      .from('user_credentials')
      .insert({
        credential_id: verifiedCredential.id,
        public_key: base64url.encode(Buffer.from(verifiedCredential.publicKey)),
        counter: verifiedCredential.counter,
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
      credentialId: verifiedCredential.id,
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

// Add edge runtime for better performance
export const runtime = 'edge'