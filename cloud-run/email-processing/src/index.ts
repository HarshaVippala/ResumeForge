/**
 * Email Processing Cloud Run Service
 * 
 * Fixed field mapping issues (2025-01-11):
 * - Removed non-existent fields (time_sensitive, job_link_confidence)
 * - Added missing fields (thread_summary, job_confidence, sender_name, sender_email)
 * - Store extra data in extracted_details JSON field
 * - Fixed bug where only processed: true was being updated
 */

import express from 'express';
import { processEmail } from './processor';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;

// Middleware
app.use(express.json());

// CORS configuration for dashboard access
app.use((req, res, next) => {
  const allowedOrigins = [
    'http://localhost:3000',
    'https://resumeforge.vercel.app',
    process.env.FRONTEND_URL
  ].filter(Boolean);

  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);

// Type definitions for manual sync requests
interface ManualSyncRequest {
  emailIds?: string[];  // Specific email IDs to process
  syncAll?: boolean;    // Process all unprocessed emails
  limit?: number;       // Max number of emails to process (default: 100)
  userEmail?: string;   // User email for context (default: from env)
}

// Simple in-memory rate limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

// Rate limiting middleware
const rateLimit = (maxRequests: number = 10, windowMs: number = 60000) => {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const clientId = req.headers['x-forwarded-for'] as string || req.ip || 'unknown';
    const now = Date.now();
    
    const clientData = rateLimitMap.get(clientId);
    
    if (!clientData || now > clientData.resetTime) {
      rateLimitMap.set(clientId, { count: 1, resetTime: now + windowMs });
      return next();
    }
    
    if (clientData.count >= maxRequests) {
      return res.status(429).json({
        error: 'Too many requests',
        message: `Rate limit exceeded. Try again in ${Math.ceil((clientData.resetTime - now) / 1000)} seconds`
      });
    }
    
    clientData.count++;
    next();
  };
};

// Optional API key authentication
const authenticateApiKey = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Skip auth for Pub/Sub endpoints
  if (req.path === '/pubsub' || req.path === '/') {
    return next();
  }
  
  // Optional: Check for API key if configured
  const apiKey = req.headers['x-api-key'] as string;
  const expectedKey = process.env.MANUAL_SYNC_API_KEY;
  
  // If no key is configured, allow access (for development)
  if (!expectedKey) {
    return next();
  }
  
  if (apiKey !== expectedKey) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or missing API key'
    });
  }
  
  next();
};

// Pub/Sub endpoint - this is the primary endpoint for automatic processing
app.post('/pubsub', async (req, res) => {
  const message = req.body.message;
  if (!message) return res.status(400).send('Invalid message');

  try {
    const data = JSON.parse(Buffer.from(message.data, 'base64').toString());
    // Assume data: { gmailId: string }
    const result = await processEmail(data.gmailId);
    // Update with all the processed data
    await supabase.from('emails').update(result).eq('gmail_id', data.gmailId);
    res.status(200).send('Processed');
  } catch (error) {
    console.error('Pub/Sub processing error:', error);
    res.status(500).send('Error');
  }
});

app.post('/', async (req, res) => {
  const message = req.body.message;
  if (!message) return res.status(400).send('Invalid message');

  try {
    const data = JSON.parse(Buffer.from(message.data, 'base64').toString());
    // Assume data: { gmailId: string }
    const result = await processEmail(data.gmailId);
    // Update with all the processed data, not just the processed flag
    await supabase.from('emails').update(result).eq('gmail_id', data.gmailId);
    res.status(200).send('Processed');
  } catch (error) {
    console.error('Processing error:', error);
    res.status(500).send('Error');
  }
});

app.get('/health', (req, res) => res.status(200).send('OK'));

// Apply authentication middleware globally
app.use(authenticateApiKey);

// Manual sync endpoint for dashboard triggers
app.post('/sync', rateLimit(5, 60000), async (req, res) => {
  try {
    const { emailIds, syncAll, limit = 100, userEmail = 'harsha.vippala1@gmail.com' } = req.body as ManualSyncRequest;

    // Validate request
    if (!emailIds && !syncAll) {
      return res.status(400).json({
        error: 'Must provide either emailIds array or syncAll flag',
        message: 'Specify which emails to process'
      });
    }

    let emailsToProcess = [];

    if (emailIds && emailIds.length > 0) {
      // Process specific emails
      const { data, error } = await supabase
        .from('emails')
        .select('gmail_id')
        .in('gmail_id', emailIds);

      if (error) throw error;
      emailsToProcess = data || [];
    } else if (syncAll) {
      // Process all unprocessed emails
      const { data, error } = await supabase
        .from('emails')
        .select('gmail_id')
        .eq('ai_processed', false)
        .order('received_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      emailsToProcess = data || [];
    }

    // Process emails in batches
    const batchSize = 10;
    const results = {
      processed: 0,
      failed: 0,
      errors: [] as Array<{ emailId: string; error: string }>
    };

    for (let i = 0; i < emailsToProcess.length; i += batchSize) {
      const batch = emailsToProcess.slice(i, i + batchSize);
      const batchPromises = batch.map(async (email) => {
        try {
          const result = await processEmail(email.gmail_id, userEmail);
          await supabase
            .from('emails')
            .update(result)
            .eq('gmail_id', email.gmail_id);
          
          results.processed++;
          return { success: true, emailId: email.gmail_id };
        } catch (error) {
          results.failed++;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          results.errors.push({ emailId: email.gmail_id, error: errorMessage });
          console.error(`Failed to process email ${email.gmail_id}:`, error);
          return { success: false, emailId: email.gmail_id, error: errorMessage };
        }
      });

      await Promise.all(batchPromises);
    }

    res.status(200).json({
      success: true,
      message: `Processed ${results.processed} emails, ${results.failed} failed`,
      results: {
        totalRequested: emailsToProcess.length,
        processed: results.processed,
        failed: results.failed,
        errors: results.errors
      }
    });
  } catch (error) {
    console.error('Manual sync error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      message: 'Failed to process manual sync request'
    });
  }
});

// Batch processing endpoint for specific email IDs
app.post('/process-batch', rateLimit(10, 60000), async (req, res) => {
  try {
    const { emailIds, userEmail = 'harsha.vippala1@gmail.com' } = req.body;

    if (!emailIds || !Array.isArray(emailIds) || emailIds.length === 0) {
      return res.status(400).json({
        error: 'emailIds array is required',
        message: 'Provide an array of email IDs to process'
      });
    }

    // Limit batch size to prevent timeouts
    if (emailIds.length > 50) {
      return res.status(400).json({
        error: 'Batch size too large',
        message: 'Maximum batch size is 50 emails. Use multiple requests for larger batches.'
      });
    }

    const results = await Promise.all(
      emailIds.map(async (gmailId) => {
        try {
          const result = await processEmail(gmailId, userEmail);
          await supabase
            .from('emails')
            .update(result)
            .eq('gmail_id', gmailId);
          
          return { gmailId, success: true, data: result };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`Failed to process email ${gmailId}:`, error);
          return { gmailId, success: false, error: errorMessage };
        }
      })
    );

    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;

    res.status(200).json({
      success: true,
      message: `Batch processing complete: ${successCount} succeeded, ${failedCount} failed`,
      results
    });
  } catch (error) {
    console.error('Batch processing error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      message: 'Failed to process batch'
    });
  }
});

// Get processing status for specific emails
app.post('/status', rateLimit(20, 60000), async (req, res) => {
  try {
    const { emailIds } = req.body;

    if (!emailIds || !Array.isArray(emailIds)) {
      return res.status(400).json({
        error: 'emailIds array is required',
        message: 'Provide an array of email IDs to check status'
      });
    }

    const { data, error } = await supabase
      .from('emails')
      .select('gmail_id, ai_processed, processed_at, is_job_related, email_type, company, position')
      .in('gmail_id', emailIds);

    if (error) throw error;

    const statusMap = (data || []).reduce((acc, email) => {
      acc[email.gmail_id] = {
        processed: email.ai_processed,
        processedAt: email.processed_at,
        isJobRelated: email.is_job_related,
        emailType: email.email_type,
        company: email.company,
        position: email.position
      };
      return acc;
    }, {} as Record<string, any>);

    // Add missing emails to the map
    emailIds.forEach(id => {
      if (!statusMap[id]) {
        statusMap[id] = {
          processed: false,
          processedAt: null,
          isJobRelated: null,
          emailType: null,
          company: null,
          position: null
        };
      }
    });

    res.status(200).json({
      success: true,
      statuses: statusMap
    });
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      message: 'Failed to check email statuses'
    });
  }
});

app.listen(port, () => console.log(`Running on port ${port}`)); 