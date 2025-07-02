import { NextRequest, NextResponse } from 'next/server'
import { verifyAuthentication } from '../../_lib/auth/webauthn'
import { createClient } from '../../_lib/db/client'
import { createSessionToken, setAuthCookie } from '../../_lib/auth/session'

interface VerifyAuthenticationBody {
  credential: any; // WebAuthn credential response
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as VerifyAuthenticationBody
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
    const supabase = createClient()
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
    const token = createSessionToken({
      userId: 'harsha-primary',
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

    return response
  } catch (error) {
    console.error('Error verifying authentication:', error)
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    )
  }
}