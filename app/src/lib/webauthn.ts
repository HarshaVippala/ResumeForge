import { 
  startAuthentication,
  startRegistration,
  type PublicKeyCredentialRequestOptionsJSON,
  type AuthenticationResponseJSON,
  type PublicKeyCredentialCreationOptionsJSON,
  type RegistrationResponseJSON,
} from '@simplewebauthn/browser'

const API_BASE = '/api/webauthn'
const AUTH_API_BASE = '/api/auth'

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

/**
 * Register a new passkey
 */
export async function registerPasskey(deviceName?: string): Promise<boolean> {
  try {
    console.log('🔐 Starting passkey registration...')
    
    // 1. Get registration options from server
    const optionsResponse = await fetch(`${AUTH_API_BASE}/register-passkey`)
    if (!optionsResponse.ok) {
      const error = await optionsResponse.json()
      console.error('❌ Failed to get registration options:', error)
      throw new Error(error.error || 'Failed to get registration options')
    }
    
    const options: PublicKeyCredentialCreationOptionsJSON = await optionsResponse.json()
    console.log('✅ Got registration options:', {
      user: options.user,
      rp: options.rp
    })

    // 2. Start WebAuthn registration
    let attResp: RegistrationResponseJSON
    try {
      console.log('🔑 Prompting for passkey creation...')
      attResp = await startRegistration({ optionsJSON: options })
      console.log('✅ Passkey creation successful')
    } catch (error: any) {
      console.error('❌ Passkey creation error:', error)
      // Handle user cancellation
      if (error.name === 'NotAllowedError') {
        throw new Error('Please try again and approve the passkey creation prompt')
      }
      throw new Error(`Passkey error: ${error.message || error.name}`)
    }

    // 3. Send registration response to server for verification
    console.log('🔍 Verifying passkey with server...')
    const verificationResponse = await fetch(`${AUTH_API_BASE}/register-passkey`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        credential: attResp,
        deviceName: deviceName || getDeviceName(),
      }),
    })

    if (!verificationResponse.ok) {
      const error = await verificationResponse.json()
      console.error('❌ Verification failed:', error)
      throw new Error(error.error || 'Registration verification failed')
    }

    const { verified } = await verificationResponse.json()
    console.log('✅ Registration complete:', verified)
    return verified
  } catch (error: any) {
    console.error('🚫 Passkey registration error:', error)
    throw error
  }
}

/**
 * Get a descriptive device name based on user agent
 */
function getDeviceName(): string {
  const userAgent = navigator.userAgent.toLowerCase()
  
  if (userAgent.includes('mac')) {
    if (userAgent.includes('chrome')) return 'Mac - Chrome'
    if (userAgent.includes('safari')) return 'Mac - Safari'
    if (userAgent.includes('firefox')) return 'Mac - Firefox'
    return 'Mac'
  }
  
  if (userAgent.includes('windows')) {
    if (userAgent.includes('chrome')) return 'Windows - Chrome'
    if (userAgent.includes('edge')) return 'Windows - Edge'
    if (userAgent.includes('firefox')) return 'Windows - Firefox'
    return 'Windows'
  }
  
  if (userAgent.includes('iphone')) return 'iPhone'
  if (userAgent.includes('ipad')) return 'iPad'
  if (userAgent.includes('android')) return 'Android'
  
  return 'Unknown Device'
}
