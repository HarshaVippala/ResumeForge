import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/api/_lib/db';
import { AIService } from '@/api/_lib/ai';

/**
 * Process emails in small batches with rate limiting
 * POST /api/email/process-batch
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      batchSize = 5,      // Process 5 emails at a time
      delayMs = 3000,     // 3 second delay between batches
      maxBatches = 10     // Maximum 10 batches (50 emails total)
    } = body;

    const db = getSupabase();
    const aiService = new AIService();
    
    let totalProcessed = 0;
    let totalFailed = 0;
    const results: any[] = [];

    for (let batchIndex = 0; batchIndex < maxBatches; batchIndex++) {
      // Get next batch of unprocessed emails
      const { data: emails, error } = await db
        .from('emails')
        .select(`
          id, 
          subject, 
          content, 
          snippet,
          sender_email, 
          sender_name,
          email_date
        `)
        .eq('ai_processed', false)
        .order('email_date', { ascending: false })
        .limit(batchSize);

      if (error) {
        console.error('Error fetching emails:', error);
        break;
      }

      if (!emails || emails.length === 0) {
        console.log('No more unprocessed emails');
        break;
      }

      console.log(`Processing batch ${batchIndex + 1} with ${emails.length} emails`);

      // Process this batch
      for (const email of emails) {
        try {
          // Prepare email for AI processing
          const emailForProcessing = {
            id: email.id,
            subject: email.subject || '',
            body: email.content || email.snippet || '',
            senderEmail: email.sender_email || '',
            senderName: email.sender_name || ''
          };

          // Process with AI - use the correct method signature
          const analysis = await aiService.analyzeEmail(
            emailForProcessing.subject,
            emailForProcessing.body,
            emailForProcessing.senderEmail,
            emailForProcessing.senderName
          );
          
          // Map AI email types to database email types
          const mapEmailType = (aiType: string): string => {
            const typeMap: Record<string, string> = {
              'recruiter': 'recruiter_outreach',
              'interview': 'interview',
              'offer': 'offer',
              'rejection': 'rejection',
              'follow_up': 'follow_up',
              'application': 'other',
              'general': 'other'
            };
            return typeMap[aiType] || 'other';
          };

          // Map AI urgency levels to database urgency levels
          const mapUrgency = (aiPriority: string): string => {
            const urgencyMap: Record<string, string> = {
              'critical': 'high',
              'high': 'high',
              'medium': 'normal',
              'low': 'low'
            };
            return urgencyMap[aiPriority] || 'normal';
          };

          // Update database with results
          const updateData = {
            ai_processed: true,
            is_processed: true,
            is_job_related: analysis.classification.is_job_related,
            email_type: mapEmailType(analysis.classification.type),
            company: analysis.classification.company,
            position: analysis.classification.position,
            summary: analysis.classification.summary,
            requires_action: analysis.classification.action_required,
            urgency: mapUrgency(analysis.classification.priority),
            extracted_data: analysis.extracted_details || {},
            confidence_score: analysis.classification.confidence || 0.8,
            processed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          const { error: updateError } = await db
            .from('emails')
            .update(updateData)
            .eq('id', email.id);

          if (updateError) {
            console.error(`Failed to update email ${email.id}:`, updateError);
            totalFailed++;
            results.push({
              id: email.id,
              success: false,
              error: updateError.message
            });
          } else {
            totalProcessed++;
            results.push({
              id: email.id,
              success: true,
              type: analysis.classification.type,
              company: analysis.classification.company,
              isJobRelated: analysis.classification.is_job_related
            });
          }

          // Small delay between individual emails
          await new Promise(resolve => setTimeout(resolve, 200));

        } catch (error) {
          console.error(`Error processing email ${email.id}:`, error);
          totalFailed++;
          results.push({
            id: email.id,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // Delay between batches (except for the last batch)
      if (batchIndex < maxBatches - 1 && emails.length === batchSize) {
        console.log(`Waiting ${delayMs}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${totalProcessed} emails successfully, ${totalFailed} failed`,
      processed: totalProcessed,
      failed: totalFailed,
      total: totalProcessed + totalFailed,
      results: results
    });

  } catch (error) {
    console.error('Batch processing error:', error);
    return NextResponse.json({
      error: 'Failed to process email batch',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}