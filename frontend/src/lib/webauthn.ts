import { 
  startAuthentication,
  type PublicKeyCredentialRequestOptionsJSON,
  type AuthenticationResponseJSON,
} from '@simplewebauthn/browser'

const API_BASE = '/api/webauthn'

export interface WebAuthnError {
  error: string
  code?: string
}


/**
 * Authenticate with a passkey
 */
export async function authenticateWithPasskey(): Promise<boolean> {
  try {
    console.log('🔐 Starting passkey authentication...')
    
    // 1. Get authentication options from server
    const optionsResponse = await fetch(`${API_BASE}/authenticate/options`)
    if (!optionsResponse.ok) {
      const error = await optionsResponse.json()
      console.error('❌ Failed to get auth options:', error)
      throw new Error(error.error || 'Failed to get authentication options')
    }
    
    const options: PublicKeyCredentialRequestOptionsJSON = await optionsResponse.json()
    console.log('✅ Got auth options:', {
      allowCredentials: options.allowCredentials?.length,
      userVerification: options.userVerification
    })

    // 2. Start WebAuthn authentication
    let attResp: AuthenticationResponseJSON
    try {
      console.log('🔑 Prompting for passkey...')
      attResp = await startAuthentication({ optionsJSON: options })
      console.log('✅ Passkey authentication successful')
    } catch (error: any) {
      console.error('❌ Passkey prompt error:', error)
      // Handle user cancellation
      if (error.name === 'NotAllowedError') {
        throw new Error('Please try again and approve the passkey prompt')
      }
      if (error.name === 'InvalidStateError') {
        throw new Error('No passkey found for this site. Please use a device with your registered passkey.')
      }
      throw new Error(`Passkey error: ${error.message || error.name}`)
    }

    // 3. Send authentication response to server for verification
    console.log('🔍 Verifying passkey with server...')
    const verificationResponse = await fetch(`${API_BASE}/authenticate/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        credential: attResp,
      }),
    })

    if (!verificationResponse.ok) {
      const error = await verificationResponse.json()
      console.error('❌ Verification failed:', error)
      throw new Error(error.error || 'Authentication verification failed')
    }

    const { verified } = await verificationResponse.json()
    console.log('✅ Authentication complete:', verified)
    return verified
  } catch (error: any) {
    console.error('🚫 Passkey authentication error:', error)
    throw error
  }
}

