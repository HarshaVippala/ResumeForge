/**
 * Rate Limit Status API
 * 
 * Provides information about the current rate limiting status for email processing.
 * 
 * Last updated: 2025-07-09
 */

import { NextRequest, NextResponse } from 'next/server';
import { aiRateLimiter } from '../../../../../api/_lib/ai/rate-limiter';
import { emailProcessingService } from '../../../../../api/_lib/gmail/email-processor';

export async function GET(request: NextRequest) {
  try {
    // Get current rate limiter status
    const status = aiRateLimiter.getQueueStatus();
    
    // Get processing stats from the service
    const stats = await emailProcessingService.getProcessingStats();
    
    // Get recommendations for remaining emails
    const recommendations = aiRateLimiter.getRecommendations(stats.unprocessed);
    
    return NextResponse.json({
      success: true,
      data: {
        rateLimiter: {
          ...status,
          recommendations
        },
        processing: {
          total: stats.total,
          processed: stats.processed,
          unprocessed: stats.unprocessed,
          jobRelated: stats.jobRelated,
          byCategory: stats.byCategory,
          byPriority: stats.byPriority
        },
        models: {
          available: ['gemini-1.5-flash', 'gemini-1.5-pro'],
          limits: {
            'gemini-1.5-flash': {
              requestsPerMinute: 15,
              requestsPerDay: 1500,
              tokensPerMinute: 1000000
            },
            'gemini-1.5-pro': {
              requestsPerMinute: 2,
              requestsPerDay: 50,
              tokensPerMinute: 32000
            }
          }
        }
      }
    });
  } catch (error) {
    console.error('Error getting rate limit status:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get rate limit status'
      },
      { status: 500 }
    );
  }
}

// Force email processing with custom parameters
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { strategy = 'conservative', forceProcess = false } = body;
    
    if (forceProcess) {
      // Reset the rate limiter to clear any queued items
      aiRateLimiter.reset();
    }
    
    // Process unprocessed emails with the specified strategy
    const result = await emailProcessingService.processUnprocessedEmails({
      batchSize: strategy === 'aggressive' ? 5 : 2,
      maxRetries: strategy === 'aggressive' ? 5 : 2,
      priorityThreshold: strategy === 'conservative' ? 7 : undefined
    });
    
    return NextResponse.json({
      success: true,
      data: {
        processed: result.processed,
        failed: result.failed,
        skipped: result.skipped,
        strategy
      }
    });
  } catch (error) {
    console.error('Error processing emails:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process emails'
      },
      { status: 500 }
    );
  }
}