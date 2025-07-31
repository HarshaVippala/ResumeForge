/**
 * Local Token Storage Service
 * 
 * Provides persistent local storage for Gmail OAuth tokens
 * for personal use. This allows the app to maintain authentication
 * across restarts without requiring re-authentication.
 * 
 * Modified: 2025-01-09
 */

import fs from 'fs/promises'
import path from 'path'
import { OAuthTokens } from './types'
import { tokenCrypto } from './crypto'

interface StoredTokenData {
  tokens: OAuthTokens
  email: string
  scopes: string[]
  userId: string
  exportedAt: string
  expiryDate: string
  lastRefreshedAt?: string
}

export class LocalTokenStorage {
  private tokenFilePath: string
  private isEnabled: boolean

  constructor() {
    // Check if local token storage is enabled
    this.isEnabled = process.env.USE_LOCAL_TOKEN_STORAGE === 'true'
    
    // Token file location (outside of git repo)
    this.tokenFilePath = process.env.GMAIL_TOKEN_FILE_PATH || 
      path.join(process.cwd(), '.gmail-tokens.json')
    
    if (this.isEnabled) {
      console.log('🔐 Local token storage enabled at:', this.tokenFilePath)
    }
  }

  /**
   * Check if local storage is enabled
   */
  isLocalStorageEnabled(): boolean {
    return this.isEnabled
  }

  /**
   * Load tokens from local file
   */
  async loadTokens(): Promise<StoredTokenData | null> {
    if (!this.isEnabled) {
      return null
    }

    try {
      const data = await fs.readFile(this.tokenFilePath, 'utf-8')
      const tokenData: StoredTokenData = JSON.parse(data)
      
      // Validate token data
      if (!tokenData.tokens || !tokenData.email || !tokenData.userId) {
        console.error('Invalid token file format')
        return null
      }

      // Check if tokens are expired
      const now = Date.now()
      const expiryDate = tokenData.tokens.expiry_date
      
      if (now >= expiryDate) {
        console.log('🔄 Local tokens expired, will refresh...')
      }

      console.log(`✅ Loaded tokens for ${tokenData.email} from local storage`)
      return tokenData
    } catch (error) {
      // File doesn't exist or is invalid
      if ((error as any).code !== 'ENOENT') {
        console.error('Error loading local tokens:', error)
      }
      return null
    }
  }

  /**
   * Save tokens to local file
   */
  async saveTokens(
    userId: string,
    tokens: OAuthTokens,
    email: string,
    scopes: string[]
  ): Promise<void> {
    if (!this.isEnabled) {
      return
    }

    try {
      const tokenData: StoredTokenData = {
        tokens,
        email,
        scopes,
        userId,
        exportedAt: new Date().toISOString(),
        expiryDate: new Date(tokens.expiry_date).toISOString(),
        lastRefreshedAt: new Date().toISOString()
      }

      // Write with restricted permissions
      await fs.writeFile(
        this.tokenFilePath,
        JSON.stringify(tokenData, null, 2),
        { mode: 0o600 }
      )

      console.log(`💾 Saved tokens for ${email} to local storage`)
    } catch (error) {
      console.error('Error saving local tokens:', error)
      // Don't throw - local storage is optional
    }
  }

  /**
   * Update tokens after refresh
   */
  async updateTokens(tokens: OAuthTokens): Promise<void> {
    if (!this.isEnabled) {
      return
    }

    try {
      // Load existing data
      const existingData = await this.loadTokens()
      if (!existingData) {
        console.error('Cannot update tokens - no existing data found')
        return
      }

      // Update tokens and refresh timestamp
      existingData.tokens = tokens
      existingData.expiryDate = new Date(tokens.expiry_date).toISOString()
      existingData.lastRefreshedAt = new Date().toISOString()

      // Save updated data
      await fs.writeFile(
        this.tokenFilePath,
        JSON.stringify(existingData, null, 2),
        { mode: 0o600 }
      )

      console.log(`🔄 Updated local tokens (refreshed at ${existingData.lastRefreshedAt})`)
    } catch (error) {
      console.error('Error updating local tokens:', error)
    }
  }

  /**
   * Delete local token file
   */
  async deleteTokens(): Promise<void> {
    if (!this.isEnabled) {
      return
    }

    try {
      await fs.unlink(this.tokenFilePath)
      console.log('🗑️  Deleted local token file')
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        console.error('Error deleting local tokens:', error)
      }
    }
  }

  /**
   * Check if token file exists
   */
  async hasLocalTokens(): Promise<boolean> {
    if (!this.isEnabled) {
      return false
    }

    try {
      await fs.access(this.tokenFilePath)
      return true
    } catch {
      return false
    }
  }

  /**
   * Get user ID from local tokens
   */
  async getLocalUserId(): Promise<string | null> {
    const tokenData = await this.loadTokens()
    return tokenData?.userId || null
  }

  /**
   * Get email from local tokens
   */
  async getLocalEmail(): Promise<string | null> {
    const tokenData = await this.loadTokens()
    return tokenData?.email || null
  }
}

// Export singleton instance
export const localTokenStorage = new LocalTokenStorage()