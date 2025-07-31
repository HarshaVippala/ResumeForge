import { NextRequest, NextResponse } from 'next/server';
import { gmailOAuthService } from '@/api/_lib/gmail/oauth';
import { getSupabase } from '@/api/_lib/db';
import { google } from 'googleapis';

/**
 * Quick Gmail sync - fetches only recent emails without complex queries
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { maxEmails = 10 } = body;
    const userId = process.env.USER_ID || 'f556989c-4903-47d6-8700-0afe3d4189e5';
    
    console.log(`🚀 Quick sync requested for user: ${userId}, max emails: ${maxEmails}`);
    
    // Get authenticated client
    const authClient = await gmailOAuthService.getAuthenticatedClient(userId);
    if (!authClient) {
      return NextResponse.json({
        success: false,
        error: 'Not authenticated with Gmail'
      }, { status: 401 });
    }
    
    const gmail = google.gmail({ version: 'v1', auth: authClient });
    const db = getSupabase();
    
    // List recent messages without query to avoid scope issues
    const { data: listData } = await gmail.users.messages.list({
      userId: 'me',
      maxResults: maxEmails,
      labelIds: ['INBOX'] // Only inbox messages
    });
    
    const messages = listData.messages || [];
    console.log(`📧 Found ${messages.length} messages to sync`);
    
    let synced = 0;
    let errors = [];
    
    // Process each message
    for (const message of messages) {
      try {
        // Check if already synced
        const { data: existing } = await db
          .from('emails')
          .select('id')
          .eq('message_id', message.id)
          .single();
        
        if (existing) {
          console.log(`⏭️  Message ${message.id} already synced, skipping`);
          continue;
        }
        
        // Fetch full message
        const { data: fullMessage } = await gmail.users.messages.get({
          userId: 'me',
          id: message.id!,
          format: 'full'
        });
        
        // Extract headers
        const headers = fullMessage.payload?.headers || [];
        const getHeader = (name: string) => 
          headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';
        
        // Extract content
        let bodyText = '';
        let bodyHtml = '';
        
        const extractContent = (parts: any[]): void => {
          for (const part of parts || []) {
            if (part.mimeType === 'text/plain' && part.body?.data) {
              bodyText += Buffer.from(part.body.data, 'base64').toString('utf-8');
            } else if (part.mimeType === 'text/html' && part.body?.data) {
              bodyHtml += Buffer.from(part.body.data, 'base64').toString('utf-8');
            } else if (part.parts) {
              extractContent(part.parts);
            }
          }
        };
        
        if (fullMessage.payload?.parts) {
          extractContent(fullMessage.payload.parts);
        } else if (fullMessage.payload?.body?.data) {
          const content = Buffer.from(fullMessage.payload.body.data, 'base64').toString('utf-8');
          if (fullMessage.payload.mimeType === 'text/plain') {
            bodyText = content;
          } else if (fullMessage.payload.mimeType === 'text/html') {
            bodyHtml = content;
          }
        }
        
        // Store in database
        const { error: insertError } = await db
          .from('emails')
          .insert({
            message_id: fullMessage.id,
            thread_id: fullMessage.threadId,
            history_id: fullMessage.historyId,
            subject: getHeader('subject'),
            snippet: fullMessage.snippet,
            body_text: bodyText.substring(0, 10000), // Limit size
            body_html: bodyHtml.substring(0, 20000), // Limit size
            sender_email: getHeader('from'),
            sender_name: getHeader('from').replace(/<.*>/, '').trim(),
            recipient_emails: [getHeader('to')],
            received_at: new Date(getHeader('date') || Date.now()).toISOString(),
            gmail_labels: fullMessage.labelIds || [],
            is_job_related: false, // Will be processed later
            ai_processed: false,
            processing_version: 'quick-sync-v1',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        
        if (insertError) {
          console.error(`❌ Error storing email ${message.id}:`, insertError);
          errors.push({ messageId: message.id, error: insertError.message });
        } else {
          synced++;
          console.log(`✅ Synced message ${message.id}`);
        }
        
        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error: any) {
        console.error(`❌ Error processing message ${message.id}:`, error);
        errors.push({ messageId: message.id, error: error.message });
      }
    }
    
    // Update sync metadata
    await db
      .from('sync_metadata')
      .upsert({
        id: `gmail_quick_sync_${userId}`,
        sync_type: 'gmail_quick_sync',
        sync_state: {
          lastSync: new Date().toISOString(),
          emailsSynced: synced,
          errors: errors.length
        },
        last_sync_time: new Date().toISOString()
      });
    
    console.log(`✅ Quick sync completed: ${synced} emails synced, ${errors.length} errors`);
    
    return NextResponse.json({
      success: true,
      emailsSynced: synced,
      totalMessages: messages.length,
      errors,
      message: `Successfully synced ${synced} out of ${messages.length} emails`
    });
    
  } catch (error) {
    console.error('💥 Quick sync error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Quick sync failed'
    }, { status: 500 });
  }
}