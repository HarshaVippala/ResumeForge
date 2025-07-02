import * as jwt from 'jsonwebtoken'
import { NextResponse } from 'next/server'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-here'
const SESSION_DURATION = '6h' // Default 6 hours

export interface SessionPayload {
  userId: string
  credentialId?: string
  deviceName?: string
}

/**
 * Create a JWT session token
 */
export function createSessionToken(payload: SessionPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: SESSION_DURATION,
  })
}

/**
 * Verify and decode a JWT session token
 */
export function verifySessionToken(token: string): SessionPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as SessionPayload
  } catch {
    return null
  }
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