import { google } from 'googleapis';
import { getSupabase } from '../db';
import crypto from 'crypto';

// Gmail API scopes
export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify', // For marking emails as read
];

interface TokenData {
  access_token: string;
  refresh_token?: string;
  scope: string;
  token_type: string;
  expiry_date?: number;
}

export class GmailOAuthService {
  private oauth2Client: any; // Using any type for googleapis OAuth2Client to avoid type conflicts
  private encryptionKey: Buffer;

  constructor() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${process.env.CORS_ALLOWED_ORIGIN}/api/oauth/callback`;

    if (!clientId || !clientSecret) {
      throw new Error('Google OAuth credentials not configured');
    }

    this.oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    // Initialize encryption key for token storage
    const key = process.env.GMAIL_TOKEN_ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) {
      throw new Error('No encryption key available. Set GMAIL_TOKEN_ENCRYPTION_KEY environment variable.');
    }
    this.encryptionKey = crypto.createHash('sha256').update(key).digest();
  }

  /**
   * Get authorization URL for OAuth flow
   */
  getAuthorizationUrl(state?: string): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: GMAIL_SCOPES,
      prompt: 'consent',
      state,
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  async getTokens(code: string): Promise<TokenData> {
    const { tokens } = await this.oauth2Client.getToken(code);
    return tokens as TokenData;
  }

  /**
   * Store encrypted tokens in database
   */
  async storeTokens(userId: string, tokens: TokenData): Promise<void> {
    const db = getSupabase();
    
    // Encrypt tokens
    const encryptedTokens = this.encryptData(JSON.stringify(tokens));
    
    // Store in sync_metadata table
    const { error } = await db
      .from('sync_metadata')
      .upsert({
        id: `gmail_oauth_${userId}`,
        sync_type: 'gmail_oauth',
        sync_state: { encrypted_tokens: encryptedTokens },
        last_sync_time: new Date().toISOString(),
      });

    if (error) throw error;
  }

  /**
   * Retrieve and decrypt tokens from database
   */
  async getStoredTokens(userId: string): Promise<TokenData | null> {
    const db = getSupabase();
    
    const { data, error } = await db
      .from('sync_metadata')
      .select('sync_state')
      .eq('id', `gmail_oauth_${userId}`)
      .single();

    if (error || !data) return null;

    try {
      const decryptedTokens = this.decryptData(data.sync_state.encrypted_tokens);
      return JSON.parse(decryptedTokens);
    } catch (e) {
      console.error('Failed to decrypt tokens:', e);
      return null;
    }
  }

  /**
   * Handle OAuth callback - exchange code for tokens and store them
   */
  async handleCallback(code: string, userId: string): Promise<TokenData | null> {
    try {
      // Exchange code for tokens
      const tokens = await this.getTokens(code);
      
      // Store tokens encrypted in database
      await this.storeTokens(userId, tokens);
      
      return tokens;
    } catch (error) {
      console.error('OAuth callback error:', error);
      return null;
    }
  }

  /**
   * Get authenticated OAuth client
   */
  async getAuthenticatedClient(userId: string): Promise<any> {
    const tokens = await this.getStoredTokens(userId);
    if (!tokens) return null;

    this.oauth2Client.setCredentials(tokens);

    // Check if token needs refresh
    if (tokens.expiry_date && tokens.expiry_date <= Date.now()) {
      try {
        const { credentials } = await this.oauth2Client.refreshAccessToken();
        await this.storeTokens(userId, credentials as TokenData);
        this.oauth2Client.setCredentials(credentials);
      } catch (error) {
        console.error('Failed to refresh token:', error);
        return null;
      }
    }

    return this.oauth2Client;
  }

  /**
   * Revoke authentication
   */
  async revokeAuth(userId: string): Promise<void> {
    const tokens = await this.getStoredTokens(userId);
    if (tokens?.access_token) {
      try {
        await this.oauth2Client.revokeToken(tokens.access_token);
      } catch (error) {
        console.error('Failed to revoke token:', error);
      }
    }

    // Remove from database
    const db = getSupabase();
    await db
      .from('sync_metadata')
      .delete()
      .eq('id', `gmail_oauth_${userId}`);
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(userId: string): Promise<boolean> {
    const tokens = await this.getStoredTokens(userId);
    return !!tokens;
  }

  /**
   * Encrypt data using AES-256-GCM
   */
  private encryptData(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt data using AES-256-GCM
   */
  private decryptData(encryptedData: string): string {
    const parts = encryptedData.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}