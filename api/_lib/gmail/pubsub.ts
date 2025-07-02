import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { getSupabase } from '../db';

interface PubSubMessage {
  message: {
    data: string;
    messageId: string;
    publishTime: string;
  };
  subscription: string;
}

interface GmailNotification {
  emailAddress: string;
  historyId: number;
}

export class GmailPubSubService {
  private jwksClient: jwksClient.JwksClient;

  constructor() {
    // Google's public key endpoint for verifying JWT
    this.jwksClient = jwksClient({
      jwksUri: 'https://www.googleapis.com/oauth2/v3/certs',
      cache: true,
      rateLimit: true,
    });
  }

  /**
   * Verify the Pub/Sub push token
   */
  async verifyPubSubToken(authHeader: string | null): Promise<boolean> {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return false;
    }

    const token = authHeader.substring(7);
    
    try {
      // Decode without verification to get the key ID
      const decoded = jwt.decode(token, { complete: true });
      if (!decoded || typeof decoded === 'string') {
        return false;
      }

      const kid = decoded.header.kid;
      if (!kid) {
        return false;
      }

      // Get the public key
      const key = await this.jwksClient.getSigningKey(kid);
      const publicKey = key.getPublicKey();

      // Verify the JWT
      const verified = jwt.verify(token, publicKey, {
        algorithms: ['RS256'],
        issuer: 'https://accounts.google.com',
        audience: process.env.PUBSUB_PUSH_ENDPOINT || `${process.env.CORS_ALLOWED_ORIGIN}/api/gmail/webhook`,
      });

      return !!verified;
    } catch (error) {
      console.error('JWT verification failed:', error);
      return false;
    }
  }

  /**
   * Process incoming Pub/Sub message
   */
  async processPubSubMessage(message: PubSubMessage): Promise<void> {
    const db = getSupabase();
    
    // Check for duplicate processing
    const messageId = message.message.messageId;
    const { data: existing } = await db
      .from('sync_metadata')
      .select('id')
      .eq('id', `pubsub_msg_${messageId}`)
      .single();

    if (existing) {
      console.log(`Duplicate message ${messageId}, skipping`);
      return;
    }

    // Decode the message data
    const decodedData = Buffer.from(message.message.data, 'base64').toString();
    const notification: GmailNotification = JSON.parse(decodedData);

    // Store the message ID with TTL (using updated_at for cleanup)
    await db
      .from('sync_metadata')
      .insert({
        id: `pubsub_msg_${messageId}`,
        sync_type: 'pubsub_message',
        sync_state: { processed: true },
        last_sync_time: new Date().toISOString(),
      });

    // Queue the notification for processing
    await this.queueEmailSync(notification);
  }

  /**
   * Queue email sync job
   */
  private async queueEmailSync(notification: GmailNotification): Promise<void> {
    const db = getSupabase();
    
    // Store in a job queue table (could be a new table or use sync_metadata)
    await db
      .from('sync_metadata')
      .insert({
        id: `gmail_sync_job_${Date.now()}_${notification.emailAddress}`,
        sync_type: 'gmail_sync_job',
        sync_state: {
          email: notification.emailAddress,
          historyId: notification.historyId,
          status: 'pending',
        },
        last_sync_time: new Date().toISOString(),
      });
  }

  /**
   * Setup Gmail watch for push notifications
   */
  async setupWatch(gmail: any, userEmail: string): Promise<void> {
    const db = getSupabase();
    
    // Configure watch request
    const watchRequest = {
      userId: 'me',
      requestBody: {
        topicName: process.env.PUBSUB_TOPIC_NAME || 'projects/your-project-id/topics/gmail-push',
        labelIds: ['INBOX'], // Watch only inbox for now
      },
    };

    try {
      const response = await gmail.users.watch(watchRequest);
      
      // Store watch expiration
      await db
        .from('sync_metadata')
        .upsert({
          id: `gmail_watch_${userEmail}`,
          sync_type: 'gmail_watch',
          sync_state: {
            historyId: response.data.historyId,
            expiration: response.data.expiration,
          },
          last_sync_time: new Date().toISOString(),
        });

      console.log(`Gmail watch set up for ${userEmail}, expires at ${new Date(parseInt(response.data.expiration))}`);
    } catch (error) {
      console.error('Failed to setup Gmail watch:', error);
      throw error;
    }
  }

  /**
   * Renew watch before expiration
   */
  async renewWatch(gmail: any, userEmail: string): Promise<void> {
    const db = getSupabase();
    
    // Check current watch status
    const { data: watchData } = await db
      .from('sync_metadata')
      .select('sync_state')
      .eq('id', `gmail_watch_${userEmail}`)
      .single();

    if (!watchData) {
      // No existing watch, set up new one
      await this.setupWatch(gmail, userEmail);
      return;
    }

    const expiration = parseInt(watchData.sync_state.expiration);
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;

    // Renew if expiring within an hour
    if (expiration - now < oneHour) {
      await this.setupWatch(gmail, userEmail);
    }
  }

  /**
   * Clean up old processed messages (run periodically)
   */
  async cleanupOldMessages(): Promise<void> {
    const db = getSupabase();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    await db
      .from('sync_metadata')
      .delete()
      .eq('sync_type', 'pubsub_message')
      .lt('last_sync_time', oneDayAgo);
  }
}