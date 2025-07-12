import { NextRequest, NextResponse } from 'next/server'
import { gmailOAuthService } from '@/api/_lib/gmail/oauth'
import { getSupabaseServiceClient } from '@/api/_lib/db'

/**
 * Force reauthorization with full Gmail scopes
 * This endpoint revokes current access and redirects to OAuth flow
 * Last modified: 2025-01-09
 */
export async function GET(request: NextRequest) {
  try {
    // Always use harsha-primary user
    const userId = 'f556989c-4903-47d6-8700-0afe3d4189e5'
    
    // Revoke current access to force fresh consent
    try {
      await gmailOAuthService.revokeAccess(userId)
    } catch (error) {
      // Ignore revoke errors - token might already be invalid
      console.log('Token revoke attempted, proceeding with reauth')
    }
    
    // Generate new auth URL with explicit consent prompt
    const authUrl = gmailOAuthService.generateAuthUrl()
    
    // Log the reauthorization attempt
    const db = getSupabaseServiceClient()
    await db.from('sync_metadata').upsert({
      id: `gmail_reauth_${userId}`,
      sync_type: 'gmail_reauth',
      sync_state: {
        initiated: true,
        timestamp: new Date().toISOString(),
        reason: 'scope_upgrade'
      },
      last_sync_time: new Date().toISOString()
    }, {
      onConflict: 'id'
    })
    
    // Redirect to Google OAuth
    return NextResponse.redirect(authUrl)
  } catch (error) {
    console.error('Reauthorization error:', error)
    return NextResponse.json({
      error: 'Failed to initiate reauthorization'
    }, { status: 500 })
  }
}