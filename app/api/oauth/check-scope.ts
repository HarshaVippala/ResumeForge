import { NextFunction, Request, Response } from '../_lib/types/api'
import { withAuth } from '../_lib/auth/middleware'
import { gmailOAuthService } from '../_lib/gmail/oauth'

async function handler(req: Request, res: Response) {
  const { method } = req
  const userId = req.userId!

  if (method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Check current scopes
    const currentScopes = await gmailOAuthService.getCurrentScopes(userId)
    const hasFullScope = await gmailOAuthService.hasFullScope(userId)
    const userEmail = await gmailOAuthService.getUserEmail(userId)
    
    // Define required scopes
    const requiredScopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ]
    
    // Check which scopes are missing
    const missingScopes = requiredScopes.filter(scope => !currentScopes.includes(scope))
    
    return res.status(200).json({
      email: userEmail,
      currentScopes,
      requiredScopes,
      missingScopes,
      hasFullScope,
      needsReauthorization: missingScopes.length > 0,
      recommendation: missingScopes.length > 0 
        ? 'Please disconnect and reconnect Gmail to grant all required permissions'
        : 'All required scopes are granted'
    })
    
  } catch (error: any) {
    console.error('Check scope error:', error)
    return res.status(500).json({ 
      error: 'Failed to check OAuth scopes',
      details: error.message 
    })
  }
}

export default withAuth(handler)