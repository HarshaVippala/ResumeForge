import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken } from './session'
import { development } from '../config'

export interface AuthResult {
  authenticated: boolean
  userId?: string
  error?: string
  response?: NextResponse
}

/**
 * Unified auth check that respects development auth bypass
 */
export function checkAuth(request: NextRequest): AuthResult {
  // In development with auth disabled, always return authenticated
  // Last modified: 2025-01-09 - Use harsha-primary user ID
  if (development.disableAuth) {
    return {
      authenticated: true,
      userId: 'f556989c-4903-47d6-8700-0afe3d4189e5'
    }
  }

  // Check for API key authentication
  const apiKey = request.headers.get('x-api-key')
  if (apiKey && apiKey === process.env.PERSONAL_API_KEY) {
    return {
      authenticated: true,
      userId: process.env.USER_ID || 'f556989c-4903-47d6-8700-0afe3d4189e5'
    }
  }

  // Check for session authentication
  const authToken = request.cookies.get('auth_token')?.value
  if (!authToken) {
    return {
      authenticated: false,
      error: 'Not authenticated',
      response: NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
  }

  const session = verifySessionToken(authToken)
  if (!session || !session.userId) {
    return {
      authenticated: false,
      error: 'Invalid session',
      response: NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }
  }

  return {
    authenticated: true,
    userId: session.userId
  }
}