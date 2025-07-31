import { NextRequest, NextResponse } from 'next/server'
import { verifyAuthentication } from '@/api/_lib/auth/webauthn'
import { getSupabase } from '@/api/_lib/db'
import { createSessionToken, setAuthCookie } from '@/api/_lib/auth/session'
import { isRateLimited, resetRateLimit, createRateLimitResponse } from '@/api/_lib/auth/rate-limit'

export async function POST(request: NextRequest) {
  try {
    // Check rate limiting
    const rateLimitResult = isRateLimited(request, 'passkey');
    if (rateLimitResult.isLimited) {
      return createRateLimitResponse(rateLimitResult.resetTime);
    }
    const body = await request.json()
    const { credential } = body

    // Get challenge from cookie
    const challenge = request.cookies.get('webauthn_challenge')?.value
    if (!challenge) {
      return NextResponse.json(
        { error: 'Challenge not found' },
        { status: 400 }
      )
    }

    // Get credential from database
    const supabase = getSupabase()
    const { data: storedCredential, error: fetchError } = await supabase
      .from('user_credentials')
      .select('*')
      .eq('credential_id', credential.id)
      .single()

    if (fetchError || !storedCredential) {
      return NextResponse.json(
        { error: 'Credential not found' },
        { status: 404 }
      )
    }

    // Verify the authentication
    const verification = await verifyAuthentication(
      credential,
      challenge,
      {
        id: storedCredential.credential_id,
        publicKey: storedCredential.public_key,
        counter: storedCredential.counter,
        deviceName: storedCredential.device_name,
        createdAt: new Date(storedCredential.created_at),
        lastUsed: storedCredential.last_used ? new Date(storedCredential.last_used) : undefined,
      }
    )

    if (!verification.verified) {
      return NextResponse.json(
        { error: 'Authentication verification failed' },
        { status: 400 }
      )
    }

    // Update counter and last used
    const { error: updateError } = await supabase
      .from('user_credentials')
      .update({
        counter: verification.authenticationInfo.newCounter,
        last_used: new Date().toISOString(),
      })
      .eq('credential_id', credential.id)

    if (updateError) {
      console.error('Error updating credential:', updateError)
    }

    // Create session
    const userId = process.env.USER_ID || 'f556989c-4903-47d6-8700-0afe3d4189e5';
    const token = createSessionToken({
      userId,
      credentialId: credential.id,
      deviceName: storedCredential.device_name,
    })

    // Set auth cookie and return success
    const response = NextResponse.json({ 
      verified: true,
      message: 'Authentication successful' 
    })
    
    setAuthCookie(response, token)
    
    // Clear challenge cookie
    response.cookies.delete('webauthn_challenge')

    // Reset rate limit on successful authentication
    resetRateLimit(request, 'passkey');

    return response
  } catch (error) {
    console.error('Error verifying authentication:', error)
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    )
  }
}