import { NextResponse } from 'next/server'
import { createClient } from '@/api/_lib/db/client'
import { createSessionToken, setAuthCookie } from '@/api/_lib/auth/session'

/**
 * Manual passkey entry for Harsha - bypasses WebAuthn for initial setup
 * This creates a dummy passkey entry so you can use the login page immediately
 */
export async function POST() {
  try {
    const supabase = createClient()
    
    // Create a manual passkey entry
    const manualCredential = {
      credential_id: 'harsha_mac_touchid_manual_' + Date.now(),
      public_key: 'manual_dummy_key_' + Date.now(),
      counter: 0,
      device_name: 'Harsha Mac Touch ID (Manual Setup)'
    }
    
    // Insert the credential
    const { error: dbError } = await supabase
      .from('user_credentials')
      .insert(manualCredential)
    
    if (dbError) {
      console.error('Error storing manual credential:', dbError)
      return NextResponse.json(
        { error: 'Failed to create manual passkey', details: dbError.message },
        { status: 500 }
      )
    }
    
    // Create session token
    const token = createSessionToken({
      userId: 'harsha-primary',
      credentialId: manualCredential.credential_id,
      deviceName: manualCredential.device_name,
    })

    // Set auth cookie and return success
    const response = NextResponse.json({ 
      success: true,
      message: 'Manual passkey created successfully. You can now use Touch ID login.',
      credentialId: manualCredential.credential_id
    })
    
    setAuthCookie(response, token)

    return response
  } catch (error) {
    console.error('Manual passkey creation error:', error)
    return NextResponse.json(
      { error: 'Failed to create manual passkey' },
      { status: 500 }
    )
  }
}