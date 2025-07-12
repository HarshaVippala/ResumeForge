/**
 * Cryptographic utilities for secure token storage
 */

import crypto from 'crypto'
import { EncryptedTokens, OAuthTokens } from './types'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const SALT_LENGTH = 32
const TAG_LENGTH = 16
const KEY_LENGTH = 32
const ITERATIONS = 100000

export class TokenCrypto {
  private encryptionKey: string
  private salt: string
  private isConfigured: boolean

  constructor() {
    this.encryptionKey = process.env.GMAIL_TOKEN_ENCRYPTION_KEY || ''
    this.salt = process.env.GMAIL_TOKEN_ENCRYPTION_SALT || 'resumeforge-salt-2025'
    this.isConfigured = false

    // Check if encryption is properly configured
    if (!this.encryptionKey) {
      console.warn('⚠️  GMAIL_TOKEN_ENCRYPTION_KEY not configured - Gmail OAuth will not work')
      console.warn('Generate a key with: openssl rand -hex 32')
    } else if (this.encryptionKey.length < 32) {
      console.warn('⚠️  GMAIL_TOKEN_ENCRYPTION_KEY is too short (min 32 chars) - Gmail OAuth may fail')
    } else {
      this.isConfigured = true
    }
  }

  /**
   * Check if token encryption is properly configured
   */
  isEncryptionConfigured(): boolean {
    return this.isConfigured
  }

  /**
   * Derive a key from the master key and salt
   */
  private deriveKey(salt: Buffer): Buffer {
    return crypto.pbkdf2Sync(
      this.encryptionKey,
      salt,
      ITERATIONS,
      KEY_LENGTH,
      'sha256'
    )
  }

  /**
   * Encrypt OAuth tokens
   */
  encryptTokens(tokens: OAuthTokens): EncryptedTokens {
    if (!this.isConfigured) {
      throw new Error('Gmail token encryption is not configured. Please set GMAIL_TOKEN_ENCRYPTION_KEY environment variable.')
    }
    
    try {
      // Generate random salt and IV for this encryption
      const salt = crypto.randomBytes(SALT_LENGTH)
      const iv = crypto.randomBytes(IV_LENGTH)
      
      // Derive key from master key and salt
      const key = this.deriveKey(salt)
      
      // Create cipher
      const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
      
      // Encrypt the tokens
      const tokenString = JSON.stringify(tokens)
      const encrypted = Buffer.concat([
        cipher.update(tokenString, 'utf8'),
        cipher.final()
      ])
      
      // Get the authentication tag
      const authTag = cipher.getAuthTag()
      
      // Calculate expiry (1 hour from token expiry)
      const expiresAt = new Date(tokens.expiry_date)
      
      return {
        encrypted_data: encrypted.toString('base64'),
        iv: iv.toString('base64'),
        auth_tag: authTag.toString('base64'),
        salt: salt.toString('base64'),
        created_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString()
      }
    } catch (error) {
      console.error('Token encryption error:', error)
      throw new Error('Failed to encrypt tokens')
    }
  }

  /**
   * Decrypt OAuth tokens
   */
  decryptTokens(encryptedTokens: EncryptedTokens): OAuthTokens {
    if (!this.isConfigured) {
      throw new Error('Gmail token encryption is not configured. Please set GMAIL_TOKEN_ENCRYPTION_KEY environment variable.')
    }
    
    try {
      // Convert from base64
      const salt = Buffer.from(encryptedTokens.salt, 'base64')
      const iv = Buffer.from(encryptedTokens.iv, 'base64')
      const authTag = Buffer.from(encryptedTokens.auth_tag, 'base64')
      const encryptedData = Buffer.from(encryptedTokens.encrypted_data, 'base64')
      
      // Derive key from master key and stored salt
      const key = this.deriveKey(salt)
      
      // Create decipher
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
      decipher.setAuthTag(authTag)
      
      // Decrypt the data
      const decrypted = Buffer.concat([
        decipher.update(encryptedData),
        decipher.final()
      ])
      
      // Parse and return tokens
      return JSON.parse(decrypted.toString('utf8'))
    } catch (error) {
      console.error('Token decryption error:', error)
      throw new Error('Failed to decrypt tokens')
    }
  }

  /**
   * Generate a secure random string for state parameters
   */
  generateSecureState(): string {
    return crypto.randomBytes(32).toString('base64url')
  }

  /**
   * Hash an email address for privacy-preserving lookups
   */
  hashEmail(email: string): string {
    return crypto
      .createHash('sha256')
      .update(email.toLowerCase())
      .digest('hex')
  }

  /**
   * Verify webhook payload signature (for Pub/Sub)
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    const verificationToken = process.env.GMAIL_WEBHOOK_VERIFICATION_TOKEN
    if (!verificationToken) {
      console.warn('No webhook verification token configured')
      return true // Allow in development
    }

    const expectedSignature = crypto
      .createHmac('sha256', verificationToken)
      .update(payload)
      .digest('base64')

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )
  }
}

// Export singleton instance
export const tokenCrypto = new TokenCrypto()