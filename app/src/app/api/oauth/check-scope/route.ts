import { NextRequest, NextResponse } from 'next/server'
import { gmailOAuthService } from '@/api/_lib/gmail/oauth'
import { verifySessionToken } from '@/api/_lib/auth/session'

/**
 * Check Gmail OAuth scope and provide upgrade URL if needed
 * GET /api/oauth/check-scope
 */
export async function GET(request: NextRequest) {
  try {
    // Get user ID from session
    const authToken = request.cookies.get('auth_token')?.value
    if (!authToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const session = verifySessionToken(authToken)
    if (!session || !session.userId) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const userId = session.userId

    // Check current scopes
    const hasFullScope = await gmailOAuthService.hasFullScope(userId)
    const currentScopes = await gmailOAuthService.getCurrentScopes(userId)
    const isConnected = await gmailOAuthService.isAuthenticated(userId)

    // Generate upgrade URL if needed
    let upgradeUrl = null
    if (isConnected && !hasFullScope) {
      // Generate auth URL with state to indicate this is an upgrade
      upgradeUrl = gmailOAuthService.generateAuthUrl(`upgrade_${userId}`)
    }

    return NextResponse.json({
      isConnected,
      hasFullScope,
      currentScopes,
      needsUpgrade: isConnected && !hasFullScope,
      upgradeUrl,
      message: !isConnected 
        ? 'Gmail not connected'
        : !hasFullScope 
        ? 'Limited to email metadata. Upgrade for full email access.'
        : 'Full Gmail access granted'
    })
  } catch (error) {
    console.error('Check scope error:', error)
    return NextResponse.json({
      error: 'Failed to check OAuth scope'
    }, { status: 500 })
  }
}