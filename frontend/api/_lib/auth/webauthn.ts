import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type VerifiedRegistrationResponse,
  type VerifiedAuthenticationResponse,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
  type AuthenticationResponseJSON,
} from '@simplewebauthn/server'
import base64url from 'base64url'

// Configuration
const RP_NAME = 'ResumeForge'
const RP_ID = process.env.NODE_ENV === 'production' ? 'jobs.harshavippala.com' : 'localhost'
const ORIGIN = process.env.NODE_ENV === 'production' 
  ? 'https://jobs.harshavippala.com' 
  : 'http://localhost:3000'

// User information - since it's just for you
const USER_ID = new TextEncoder().encode('harsha-primary')
const USER_NAME = 'harsha@resumeforge'
const USER_DISPLAY_NAME = 'Harsha'

export interface StoredCredential {
  id: string
  publicKey: string
  counter: number
  deviceName?: string
  createdAt: Date
  lastUsed?: Date
}

/**
 * Generate registration options for creating a new passkey
 */
export async function generateRegistrationOptionsForUser(
  existingCredentials: StoredCredential[] = []
): Promise<PublicKeyCredentialCreationOptionsJSON> {
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userID: USER_ID,
    userName: USER_NAME,
    userDisplayName: USER_DISPLAY_NAME,
    attestationType: 'none',
    excludeCredentials: existingCredentials.map(cred => ({
      id: cred.id,
      type: 'public-key',
    })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
      authenticatorAttachment: 'platform', // Prefer platform authenticators (Touch ID, Face ID)
    },
  })

  return options
}

/**
 * Verify registration response from the client
 */
export async function verifyRegistration(
  response: RegistrationResponseJSON,
  expectedChallenge: string
): Promise<VerifiedRegistrationResponse> {
  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
  })

  return verification
}

/**
 * Generate authentication options for signing in with a passkey
 */
export async function generateAuthenticationOptionsForUser(
  existingCredentials: StoredCredential[] = []
): Promise<PublicKeyCredentialRequestOptionsJSON> {
  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    allowCredentials: existingCredentials.map(cred => ({
      id: cred.id,
      type: 'public-key',
    })),
    userVerification: 'preferred',
  })

  return options
}

/**
 * Verify authentication response from the client
 */
export async function verifyAuthentication(
  response: AuthenticationResponseJSON,
  expectedChallenge: string,
  credential: StoredCredential
): Promise<VerifiedAuthenticationResponse> {
  try {
    // Handle the public key based on its current format
    let publicKeyBuffer: Buffer
    
    if (typeof credential.publicKey === 'string') {
      // If it's a string, it might be base64 or base64url encoded
      try {
        publicKeyBuffer = Buffer.from(credential.publicKey, 'base64')
      } catch {
        publicKeyBuffer = base64url.toBuffer(credential.publicKey)
      }
    } else {
      // If it's already a Buffer/Uint8Array, use it directly
      publicKeyBuffer = Buffer.from(credential.publicKey)
    }
    
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      credential: {
        id: credential.id,
        publicKey: publicKeyBuffer,
        counter: credential.counter,
      },
    })

    return verification
  } catch (error) {
    console.error('Error in verifyAuthentication:', error)
    throw error
  }
}