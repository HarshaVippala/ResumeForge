import { google, gmail_v1 } from 'googleapis';
import { GmailOAuthService } from './oauth';
import { GmailPubSubService } from './pubsub';
import { getSupabase } from '../db';

export interface EmailData {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  date: Date;
  snippet: string;
  body: string;
  labels: string[];
  attachments: Array<{
    filename: string;
    mimeType: string;
    size: number;
  }>;
}

export class GmailService {
  private oauthService: GmailOAuthService;
  private pubsubService: GmailPubSubService;

  constructor() {
    this.oauthService = new GmailOAuthService();
    this.pubsubService = new GmailPubSubService();
  }

  /**
   * Get Gmail API client for a user
   */
  private async getGmailClient(userId: string): Promise<gmail_v1.Gmail | null> {
    const authClient = await this.oauthService.getAuthenticatedClient(userId);
    if (!authClient) return null;

    return google.gmail({ version: 'v1', auth: authClient });
  }

  /**
   * Initial sync - get all emails from a specific date
   */
  async initialSync(userId: string, afterDate?: Date): Promise<void> {
    const gmail = await this.getGmailClient(userId);
    if (!gmail) throw new Error('Not authenticated');

    const db = getSupabase();
    const query = afterDate ? `after:${afterDate.toISOString().split('T')[0]}` : 'in:inbox';

    try {
      let pageToken: string | undefined;
      let totalProcessed = 0;

      do {
        const response = await gmail.users.messages.list({
          userId: 'me',
          q: query,
          maxResults: 100,
          pageToken,
        });

        const messages = response.data.messages || [];
        
        // Process messages in batches
        for (const message of messages) {
          if (message.id) {
            await this.processMessage(gmail, message.id);
            totalProcessed++;
          }
        }

        pageToken = response.data.nextPageToken || undefined;
        
        // Store sync progress
        await db
          .from('sync_metadata')
          .upsert({
            id: `gmail_sync_progress_${userId}`,
            sync_type: 'gmail_initial_sync',
            sync_state: {
              processed: totalProcessed,
              completed: !pageToken,
            },
            last_sync_time: new Date().toISOString(),
          });

      } while (pageToken);

      // Setup watch for future updates
      await this.pubsubService.setupWatch(gmail, userId);

    } catch (error) {
      console.error('Initial sync failed:', error);
      throw error;
    }
  }

  /**
   * Incremental sync using history API
   */
  async incrementalSync(userId: string, startHistoryId?: string): Promise<void> {
    const gmail = await this.getGmailClient(userId);
    if (!gmail) throw new Error('Not authenticated');

    const db = getSupabase();

    try {
      // Get last history ID if not provided
      if (!startHistoryId) {
        const { data } = await db
          .from('sync_metadata')
          .select('sync_state')
          .eq('id', `gmail_watch_${userId}`)
          .single();
        
        startHistoryId = data?.sync_state?.historyId;
      }

      if (!startHistoryId) {
        // No history ID, do initial sync
        await this.initialSync(userId);
        return;
      }

      let pageToken: string | undefined;
      let latestHistoryId = startHistoryId;

      do {
        const response = await gmail.users.history.list({
          userId: 'me',
          startHistoryId,
          pageToken,
        });

        const history = response.data.history || [];
        
        for (const historyItem of history) {
          // Process added messages
          if (historyItem.messagesAdded) {
            for (const added of historyItem.messagesAdded) {
              if (added.message?.id) {
                await this.processMessage(gmail, added.message.id);
              }
            }
          }

          // Track latest history ID
          if (historyItem.id && BigInt(historyItem.id) > BigInt(latestHistoryId)) {
            latestHistoryId = historyItem.id;
          }
        }

        pageToken = response.data.nextPageToken || undefined;

      } while (pageToken);

      // Update stored history ID
      await db
        .from('sync_metadata')
        .upsert({
          id: `gmail_watch_${userId}`,
          sync_type: 'gmail_watch',
          sync_state: {
            historyId: latestHistoryId,
          },
          last_sync_time: new Date().toISOString(),
        });

    } catch (error) {
      console.error('Incremental sync failed:', error);
      throw error;
    }
  }

  /**
   * Process a single email message
   */
  private async processMessage(gmail: gmail_v1.Gmail, messageId: string): Promise<void> {
    const db = getSupabase();

    try {
      const response = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full',
      });

      const message = response.data;
      const emailData = this.parseEmailMessage(message);

      // Store in database
      await db
        .from('email_communications')
        .upsert({
          id: emailData.id,
          sender: emailData.from,
          recipient: emailData.to,
          subject: emailData.subject,
          body: emailData.body,
          date_sent: emailData.date.toISOString(),
          is_processed: false,
        });

    } catch (error) {
      console.error(`Failed to process message ${messageId}:`, error);
    }
  }

  /**
   * Parse Gmail message into structured data
   */
  private parseEmailMessage(message: gmail_v1.Schema$Message): EmailData {
    const headers = message.payload?.headers || [];
    const getHeader = (name: string) => headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

    // Extract body
    let body = '';
    const extractBody = (part: gmail_v1.Schema$MessagePart): void => {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        body = Buffer.from(part.body.data, 'base64').toString();
      } else if (part.parts) {
        part.parts.forEach(extractBody);
      }
    };

    if (message.payload) {
      extractBody(message.payload);
    }

    // Extract attachments
    const attachments: any[] = [];
    const extractAttachments = (part: gmail_v1.Schema$MessagePart): void => {
      if (part.filename && part.body?.attachmentId) {
        attachments.push({
          filename: part.filename,
          mimeType: part.mimeType || 'application/octet-stream',
          size: part.body.size || 0,
        });
      }
      if (part.parts) {
        part.parts.forEach(extractAttachments);
      }
    };

    if (message.payload) {
      extractAttachments(message.payload);
    }

    return {
      id: message.id || '',
      threadId: message.threadId || '',
      subject: getHeader('subject'),
      from: getHeader('from'),
      to: getHeader('to'),
      date: new Date(parseInt(message.internalDate || '0')),
      snippet: message.snippet || '',
      body,
      labels: message.labelIds || [],
      attachments,
    };
  }

  /**
   * Send an email
   */
  async sendEmail(userId: string, to: string, subject: string, body: string): Promise<void> {
    const gmail = await this.getGmailClient(userId);
    if (!gmail) throw new Error('Not authenticated');

    // Create email in RFC 2822 format
    const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
    const messageParts = [
      `To: ${to}`,
      `Subject: ${utf8Subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
      '',
      body,
    ];
    const message = messageParts.join('\n');

    // Encode in base64
    const encodedMessage = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
      },
    });
  }
}