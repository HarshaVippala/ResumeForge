/**
 * Gmail OAuth Service
 * Handles OAuth 2.0 authentication flow and token management
 */

import { google } from 'googleapis'
import { OAuth2Client } from 'google-auth-library'
import { getSupabaseServiceClient } from '../db'
import { tokenCrypto } from './crypto'
import { localTokenStorage } from './local-token-storage'
import type { OAuthTokens, StoredOAuthTokens, GmailServiceConfig } from './types'

export class GmailOAuthService {
  private oauth2Client: OAuth2Client | null = null
  private config: GmailServiceConfig
  private supabase: ReturnType<typeof getSupabaseServiceClient>
  private isConfigured = false

  constructor() {
    // Check if OAuth is configured
    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    
    if (!clientId || !clientSecret) {
      console.warn('⚠️  Google OAuth not configured - Gmail integration disabled')
      console.warn('Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable')
    }

    this.config = {
      clientId: clientId || '',
      clientSecret: clientSecret || '',
      redirectUri: process.env.GOOGLE_REDIRECT_URI || 
                   process.env.NEXTAUTH_URL ? `${process.env.NEXTAUTH_URL}/api/oauth/callback` : 
                   'http://localhost:3000/api/oauth/callback',
      scopes: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.metadata',
        'https://www.googleapis.com/auth/gmail.modify', // For marking emails as read
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile'
      ],
      pubsubTopic: process.env.GMAIL_PUBSUB_TOPIC,
      watchRenewalInterval: 24 // hours
    }

    if (clientId && clientSecret) {
      this.oauth2Client = new google.auth.OAuth2(
        this.config.clientId,
        this.config.clientSecret,
        this.config.redirectUri
      )
      this.isConfigured = true
    }

    // Use service client to bypass RLS for oauth token operations
    this.supabase = getSupabaseServiceClient()
  }

  /**
   * Generate OAuth authorization URL
   */
  generateAuthUrl(state?: string): string {
    if (!this.isConfigured || !this.oauth2Client) {
      throw new Error('Google OAuth is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.')
    }
    
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: this.config.scopes,
      state: state || tokenCrypto.generateSecureState(),
      prompt: 'consent' // Force consent to ensure refresh token
    })
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string): Promise<{ tokens: OAuthTokens; email: string }> {
    if (!this.isConfigured || !this.oauth2Client) {
      throw new Error('Google OAuth is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.')
    }
    
    try {
      const { tokens } = await this.oauth2Client.getToken(code)
      
      if (!tokens.refresh_token) {
        throw new Error('No refresh token received. User may need to reauthorize.')
      }

      // Set credentials to fetch user info
      this.oauth2Client.setCredentials(tokens)
      
      // Get user email
      const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client })
      const { data: userInfo } = await oauth2.userinfo.get()
      
      if (!userInfo.email) {
        throw new Error('Could not retrieve user email')
      }

      return {
        tokens: tokens as OAuthTokens,
        email: userInfo.email
      }
    } catch (error: any) {
      console.error('Token exchange error:', error)
      throw new Error(`Failed to exchange code for tokens: ${error.message}`)
    }
  }

  /**
   * Store OAuth tokens securely
   */
  async storeTokens(userId: string, tokens: OAuthTokens, email: string): Promise<void> {
    try {
      // Check if encryption is configured
      if (!tokenCrypto.isEncryptionConfigured()) {
        throw new Error('Token encryption is not configured. Please set GMAIL_TOKEN_ENCRYPTION_KEY environment variable.')
      }
      
      // Encrypt tokens
      const encryptedTokens = tokenCrypto.encryptTokens(tokens)
      
      // Store in database
      // Parse actual granted scopes from tokens (space-separated string)
      const grantedScopes = tokens.scope ? tokens.scope.split(' ') : this.config.scopes
      
      const { error } = await this.supabase
        .from('oauth_tokens')
        .upsert({
          user_id: userId,
          provider: 'gmail',
          encrypted_tokens: encryptedTokens,
          email_address: email,
          email_hash: tokenCrypto.hashEmail(email),
          scopes: grantedScopes, // Store actual granted scopes
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, { 
          onConflict: 'user_id,provider',
          ignoreDuplicates: false 
        })
      
      if (error) {
        console.error('Token storage error details:', {
          error,
          userId,
          email,
          hasEncryptedTokens: !!encryptedTokens,
          errorCode: error.code,
          errorDetails: error.details,
          errorHint: error.hint
        })
        throw new Error(`Failed to store OAuth tokens: ${error.message}`)
      }

      // Also update sync metadata
      await this.supabase
        .from('sync_metadata')
        .upsert({
          id: `gmail_oauth_${userId}`,
          sync_type: 'gmail_oauth',
          sync_state: {
            connected: true,
            email: email,
            connectedAt: new Date().toISOString()
          },
          last_sync_time: new Date().toISOString()
        }, {
          onConflict: 'id'
        })
      
      // Save to local storage if enabled
      await localTokenStorage.saveTokens(userId, tokens, email, grantedScopes)
    } catch (error) {
      console.error('Store tokens error:', error)
      throw error
    }
  }

  /**
   * Retrieve and decrypt OAuth tokens
   */
  async getTokens(userId: string): Promise<OAuthTokens | null> {
    try {
      // Try to load from local storage first if enabled
      if (localTokenStorage.isLocalStorageEnabled()) {
        const localData = await localTokenStorage.loadTokens()
        if (localData && localData.userId === userId) {
          console.log('📁 Using tokens from local storage')
          
          // Check if tokens need refresh
          if (this.isTokenExpired(localData.tokens)) {
            return await this.refreshTokens(userId, localData.tokens)
          }
          
          return localData.tokens
        }
      }
      
      // Fall back to database
      const { data, error } = await this.supabase
        .from('oauth_tokens')
        .select('*')
        .eq('user_id', userId)
        .eq('provider', 'gmail')
        .single()
      
      if (error || !data) {
        return null
      }

      // Decrypt tokens
      const tokens = tokenCrypto.decryptTokens(data.encrypted_tokens)
      
      // Save to local storage if enabled
      if (localTokenStorage.isLocalStorageEnabled()) {
        await localTokenStorage.saveTokens(userId, tokens, data.email_address, data.scopes)
      }
      
      // Check if tokens need refresh
      if (this.isTokenExpired(tokens)) {
        return await this.refreshTokens(userId, tokens)
      }

      return tokens
    } catch (error) {
      console.error('Get tokens error:', error)
      return null
    }
  }

  /**
   * Check if token is expired or about to expire
   */
  private isTokenExpired(tokens: OAuthTokens): boolean {
    const now = Date.now()
    const expiryWithBuffer = tokens.expiry_date - (5 * 60 * 1000) // 5 minutes buffer
    return now >= expiryWithBuffer
  }

  /**
   * Refresh OAuth tokens
   */
  private async refreshTokens(userId: string, oldTokens: OAuthTokens): Promise<OAuthTokens | null> {
    try {
      this.oauth2Client.setCredentials({
        refresh_token: oldTokens.refresh_token
      })

      const { credentials } = await this.oauth2Client.refreshAccessToken()
      
      if (!credentials.access_token) {
        throw new Error('Failed to refresh access token')
      }

      const newTokens: OAuthTokens = {
        access_token: credentials.access_token,
        refresh_token: credentials.refresh_token || oldTokens.refresh_token,
        scope: credentials.scope || oldTokens.scope,
        token_type: credentials.token_type || 'Bearer',
        expiry_date: credentials.expiry_date || Date.now() + 3600000
      }

      // Get email from database
      const { data: tokenData } = await this.supabase
        .from('oauth_tokens')
        .select('email_address')
        .eq('user_id', userId)
        .eq('provider', 'gmail')
        .single()

      if (tokenData?.email_address) {
        await this.storeTokens(userId, newTokens, tokenData.email_address)
      }
      
      // Update local storage if enabled
      if (localTokenStorage.isLocalStorageEnabled()) {
        await localTokenStorage.updateTokens(newTokens)
      }

      return newTokens
    } catch (error) {
      console.error('Token refresh error:', error)
      
      // Mark as disconnected
      await this.supabase
        .from('sync_metadata')
        .upsert({
          id: `gmail_oauth_${userId}`,
          sync_type: 'gmail_oauth',
          sync_state: {
            connected: false,
            error: 'Token refresh failed',
            disconnectedAt: new Date().toISOString()
          },
          last_sync_time: new Date().toISOString()
        }, {
          onConflict: 'id'
        })
      
      return null
    }
  }

  /**
   * Get authenticated OAuth client
   */
  async getAuthenticatedClient(userId: string): Promise<OAuth2Client | null> {
    const tokens = await this.getTokens(userId)
    if (!tokens) {
      return null
    }

    const client = new google.auth.OAuth2(
      this.config.clientId,
      this.config.clientSecret,
      this.config.redirectUri
    )

    client.setCredentials({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      scope: tokens.scope || this.config.scopes.join(' '),
      token_type: tokens.token_type,
      expiry_date: tokens.expiry_date
    })

    return client
  }

  /**
   * Revoke OAuth access
   */
  async revokeAccess(userId: string): Promise<void> {
    try {
      const tokens = await this.getTokens(userId)
      if (!tokens) {
        return
      }

      // Revoke tokens with Google
      await this.oauth2Client.revokeToken(tokens.access_token)

      // Remove from database
      await this.supabase
        .from('oauth_tokens')
        .delete()
        .eq('user_id', userId)
        .eq('provider', 'gmail')
      
      // Remove from local storage
      await localTokenStorage.deleteTokens()

      // Update sync metadata
      await this.supabase
        .from('sync_metadata')
        .upsert({
          id: `gmail_oauth_${userId}`,
          sync_type: 'gmail_oauth',
          sync_state: {
            connected: false,
            disconnectedAt: new Date().toISOString()
          },
          last_sync_time: new Date().toISOString()
        }, {
          onConflict: 'id'
        })
    } catch (error) {
      console.error('Revoke access error:', error)
      throw new Error('Failed to revoke Gmail access')
    }
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(userId: string): Promise<boolean> {
    const tokens = await this.getTokens(userId)
    return tokens !== null
  }

  /**
   * Get user's Gmail address
   */
  async getUserEmail(userId: string): Promise<string | null> {
    try {
      const { data, error } = await this.supabase
        .from('oauth_tokens')
        .select('email_address')
        .eq('user_id', userId)
        .eq('provider', 'gmail')
        .single()
      
      return data?.email_address || null
    } catch (error) {
      console.error('Get user email error:', error)
      return null
    }
  }

  /**
   * Check if user has full Gmail scope
   */
  async hasFullScope(userId: string): Promise<boolean> {
    try {
      const { data } = await this.supabase
        .from('oauth_tokens')
        .select('scopes')
        .eq('user_id', userId)
        .eq('provider', 'gmail')
        .single()
      
      if (!data?.scopes || !Array.isArray(data.scopes)) {
        return false
      }
      
      return data.scopes.includes('https://www.googleapis.com/auth/gmail.readonly')
    } catch (error) {
      console.error('Check scope error:', error)
      return false
    }
  }

  /**
   * Get current OAuth scopes
   */
  async getCurrentScopes(userId: string): Promise<string[]> {
    try {
      const { data } = await this.supabase
        .from('oauth_tokens')
        .select('scopes')
        .eq('user_id', userId)
        .eq('provider', 'gmail')
        .single()
      
      return data?.scopes || []
    } catch (error) {
      console.error('Get scopes error:', error)
      return []
    }
  }
  
  /**
   * Get hardcoded user ID for personal use
   */
  async getPersonalUserId(): Promise<string | null> {
    // Try local storage first
    if (localTokenStorage.isLocalStorageEnabled()) {
      const localUserId = await localTokenStorage.getLocalUserId()
      if (localUserId) {
        return localUserId
      }
    }
    
    // Default personal user ID
    return process.env.PERSONAL_USER_ID || '00000000-0000-0000-0000-000000000000'
  }
  
  /**
   * Check if personal user is authenticated
   */
  async isPersonalUserAuthenticated(): Promise<boolean> {
    const userId = await this.getPersonalUserId()
    if (!userId) return false
    
    return this.isAuthenticated(userId)
  }
}

// Export singleton instance
export const gmailOAuthService = new GmailOAuthService()