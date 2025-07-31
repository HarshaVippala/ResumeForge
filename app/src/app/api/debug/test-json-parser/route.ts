import { NextRequest, NextResponse } from 'next/server';
import { RobustJsonParser } from '../../../../api/_lib/utils/json-parser';

/**
 * Test endpoint for JSON parser optimizations
 * 
 * Allows testing various malformed JSON scenarios and measures performance
 */
export async function POST(request: NextRequest) {
  try {
    const { testInput, enableCache = true, logAttempts = false } = await request.json();
    
    if (!testInput) {
      return NextResponse.json(
        { error: 'testInput is required' },
        { status: 400 }
      );
    }
    
    // Test the parser
    const startTime = Date.now();
    const result = RobustJsonParser.parse(testInput, {
      enableCache,
      logAttempts,
      strict: false
    });
    const endTime = Date.now();
    
    // Get current metrics
    const metrics = RobustJsonParser.getPerformanceMetrics();
    const cacheStats = RobustJsonParser.getCacheStats();
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      testInput: testInput.substring(0, 200) + (testInput.length > 200 ? '...' : ''),
      result: {
        success: result.success,
        data: result.data,
        error: result.error,
        method: result.method,
        fromCache: result.fromCache,
        processingTimeMs: result.processingTimeMs,
        totalTimeMs: endTime - startTime
      },
      metrics: {
        totalAttempts: metrics.totalAttempts,
        successfulAttempts: metrics.successfulAttempts,
        successRate: metrics.totalAttempts > 0 
          ? (metrics.successfulAttempts / metrics.totalAttempts) * 100 
          : 0,
        cacheHitRate: metrics.cacheHitRate * 100,
        averageProcessingTime: metrics.averageProcessingTime
      },
      cache: {
        size: cacheStats.size,
        hitRate: cacheStats.hitRate * 100,
        totalHits: cacheStats.totalHits
      }
    });
    
  } catch (error) {
    console.error('Error testing JSON parser:', error);
    return NextResponse.json(
      { error: 'Failed to test JSON parser' },
      { status: 500 }
    );
  }
}

/**
 * Get predefined test cases
 */
export async function GET(request: NextRequest) {
  const testCases = [
    {
      name: 'Valid JSON',
      input: '{"isJobRelated": true, "category": "recruiter_outreach", "confidence": 0.85}',
      expectedStrategy: 'direct'
    },
    {
      name: 'Markdown formatted JSON',
      input: '```json\n{"isJobRelated": true, "category": "interview_invitation", "confidence": 0.9}\n```',
      expectedStrategy: 'markdown_cleaned'
    },
    {
      name: 'JSON with surrounding text',
      input: 'Here is the analysis: {"isJobRelated": false, "category": "not_job_related", "confidence": 0.7} Hope this helps!',
      expectedStrategy: 'extracted'
    },
    {
      name: 'JSON with single quotes',
      input: "{'isJobRelated': true, 'category': 'offer', 'confidence': 0.95}",
      expectedStrategy: 'repaired'
    },
    {
      name: 'JSON with trailing comma',
      input: '{"isJobRelated": true, "category": "rejection", "confidence": 0.8,}',
      expectedStrategy: 'repaired'
    },
    {
      name: 'Python-style booleans',
      input: '{"isJobRelated": True, "category": "follow_up", "confidence": 0.6}',
      expectedStrategy: 'repaired'
    },
    {
      name: 'Unquoted keys',
      input: '{isJobRelated: true, category: "networking", confidence: 0.7}',
      expectedStrategy: 'repaired'
    }
  ];
  
  return NextResponse.json({
    testCases,
    instructions: {
      usage: 'POST to this endpoint with { "testInput": "your json string" }',
      options: {
        enableCache: 'boolean (default: true)',
        logAttempts: 'boolean (default: false)'
      }
    }
  });
}