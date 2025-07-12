import { NextRequest, NextResponse } from 'next/server'
import { generateAuthenticationOptionsForUser } from '../../_lib/auth/webauthn'
import { getSupabase } from '../../_lib/db'

export async function GET(_request: NextRequest) {
  try {
    const supabase = getSupabase()
    
    // Get existing credentials from database
    const { data: credentials } = await supabase
      .from('user_credentials')
      .select('*')
      .order('created_at', { ascending: false })

    if (!credentials || credentials.length === 0) {
      return NextResponse.json(
        { error: 'No passkeys found. Please register a device first.' },
        { status: 404 }
      )
    }

    // Generate authentication options
    const options = await generateAuthenticationOptionsForUser(
      credentials.map(cred => ({
        id: cred.credential_id,
        publicKey: cred.public_key,
        counter: cred.counter,
        deviceName: cred.device_name,
        createdAt: new Date(cred.created_at),
        lastUsed: cred.last_used ? new Date(cred.last_used) : undefined,
      }))
    )

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
    console.error('Error generating authentication options:', error)
    return NextResponse.json(
      { error: 'Failed to generate authentication options' },
      { status: 500 }
    )
  }
}