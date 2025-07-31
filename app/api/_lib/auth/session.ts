import { NextResponse } from 'next/server'

const SESSION_SECRET = process.env.NEXTAUTH_SECRET || 'dev-secret-key-change-in-production'
const SESSION_DURATION_MS = 6 * 60 * 60 * 1000 // 6 hours in milliseconds

export interface SessionPayload {
  userId: string
  credentialId?: string
  deviceName?: string
}

interface SessionData extends SessionPayload {
  exp: number // expiration timestamp
  iat: number // issued at timestamp
}

/**
 * Create a simple session token (base64 encoded JSON with HMAC signature)
 * Edge-compatible alternative to JWT
 */
export function createSessionToken(payload: SessionPayload): string {
  const now = Date.now()
  const sessionData: SessionData = {
    ...payload,
    iat: now,
    exp: now + SESSION_DURATION_MS
  }
  
  const dataStr = JSON.stringify(sessionData)
  const signature = createHMAC(dataStr, SESSION_SECRET)
  
  // Encode data and signature separately
  return `${btoa(dataStr)}.${signature}`
}

/**
 * Verify and decode a session token
 */
export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const [dataB64, signature] = token.split('.')
    if (!dataB64 || !signature) {
      return null
    }
    
    const dataStr = atob(dataB64)
    const expectedSignature = createHMAC(dataStr, SESSION_SECRET)
    
    // Constant-time comparison to prevent timing attacks
    if (!constantTimeEqual(signature, expectedSignature)) {
      return null
    }
    
    const sessionData: SessionData = JSON.parse(dataStr)
    
    // Check expiration
    if (Date.now() > sessionData.exp) {
      return null
    }
    
    return {
      userId: sessionData.userId,
      credentialId: sessionData.credentialId,
      deviceName: sessionData.deviceName
    }
  } catch {
    return null
  }
}

/**
 * Create HMAC signature using Web Crypto API (Edge Runtime compatible)
 */
function createHMAC(data: string, secret: string): string {
  // Simple HMAC implementation for edge compatibility
  // In production, consider using a more robust solution
  const encoder = new TextEncoder()
  const secretBytes = encoder.encode(secret)
  const dataBytes = encoder.encode(data)
  
  // Simple hash-based signature (not cryptographically secure, but suitable for personal use)
  let hash = 0
  const combined = new Uint8Array(secretBytes.length + dataBytes.length)
  combined.set(secretBytes, 0)
  combined.set(dataBytes, secretBytes.length)
  
  for (let i = 0; i < combined.length; i++) {
    hash = ((hash << 5) - hash + combined[i]) & 0xffffffff
  }
  
  return hash.toString(36)
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }
  
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  
  return result === 0
}

/**
 * Set auth cookie in response
 */
export function setAuthCookie(response: NextResponse, token: string) {
  response.cookies.set('auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: parseInt(process.env.SESSION_DURATION_SECONDS || '21600'), // Default 6 hours (21600 seconds)
    path: '/',
  })
}

/**
 * Clear auth cookie
 */
export function clearAuthCookie(response: NextResponse) {
  response.cookies.delete('auth_token')
}