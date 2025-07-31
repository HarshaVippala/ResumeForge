import { NextRequest, NextResponse } from 'next/server';
import { RobustJsonParser } from '../../../../api/_lib/utils/json-parser';

/**
 * JSON Parser Performance Metrics Endpoint
 * 
 * Provides comprehensive metrics about JSON parsing performance,
 * cache efficiency, and strategy success rates.
 * 
 * Used for monitoring and optimizing AI response parsing.
 */
export async function GET(request: NextRequest) {
  try {
    // Get comprehensive performance metrics
    const performanceMetrics = RobustJsonParser.getPerformanceMetrics();
    const cacheStats = RobustJsonParser.getCacheStats();
    
    // Calculate overall statistics
    const overallSuccessRate = performanceMetrics.totalAttempts > 0 
      ? (performanceMetrics.successfulAttempts / performanceMetrics.totalAttempts) * 100 
      : 0;
    
    const response = {
      timestamp: new Date().toISOString(),
      summary: {
        totalAttempts: performanceMetrics.totalAttempts,
        successfulAttempts: performanceMetrics.successfulAttempts,
        overallSuccessRate: Math.round(overallSuccessRate * 100) / 100,
        averageProcessingTime: Math.round(performanceMetrics.averageProcessingTime * 100) / 100,
        cacheHitRate: Math.round(performanceMetrics.cacheHitRate * 100 * 100) / 100
      },
      strategies: {
        rankings: performanceMetrics.strategyRankings,
        details: performanceMetrics.strategySuccessRates
      },
      cache: {
        ...cacheStats,
        avgAge: Math.round(cacheStats.avgAge / 1000), // Convert to seconds
        efficiency: cacheStats.hitRate > 0.3 ? 'Good' : cacheStats.hitRate > 0.1 ? 'Fair' : 'Poor'
      },
      recommendations: generateRecommendations(performanceMetrics, cacheStats)
    };
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching JSON parser metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    );
  }
}

/**
 * Clear all metrics and cache
 */
export async function DELETE(request: NextRequest) {
  try {
    RobustJsonParser.clearMetrics();
    
    return NextResponse.json({ 
      message: 'JSON parser metrics and cache cleared successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error clearing JSON parser metrics:', error);
    return NextResponse.json(
      { error: 'Failed to clear metrics' },
      { status: 500 }
    );
  }
}

/**
 * Generate performance recommendations based on metrics
 */
function generateRecommendations(metrics: any, cacheStats: any): string[] {
  const recommendations: string[] = [];
  
  // Success rate recommendations
  const successRate = metrics.totalAttempts > 0 
    ? (metrics.successfulAttempts / metrics.totalAttempts) * 100 
    : 0;
  
  if (successRate < 70) {
    recommendations.push('Low success rate detected. Consider improving AI prompts for better JSON output.');
  }
  
  if (successRate < 50) {
    recommendations.push('Critical: Very low success rate. Review AI model temperature and prompt engineering.');
  }
  
  // Cache efficiency recommendations
  if (cacheStats.hitRate < 0.1) {
    recommendations.push('Low cache hit rate. Consider increasing cache TTL or reviewing cache key generation.');
  }
  
  if (cacheStats.hitRate > 0.5) {
    recommendations.push('Good cache performance. Consider increasing cache size for better efficiency.');
  }
  
  // Strategy recommendations
  const directStrategy = metrics.strategySuccessRates['direct'];
  if (directStrategy && directStrategy.attempts > 0) {
    const directSuccessRate = directStrategy.successes / directStrategy.attempts;
    if (directSuccessRate < 0.3) {
      recommendations.push('Direct JSON parsing failing frequently. Focus on improving AI prompt structure.');
    }
  }
  
  // Processing time recommendations
  if (metrics.averageProcessingTime > 100) {
    recommendations.push('High processing time detected. Consider optimizing fallback strategies.');
  }
  
  // Volume recommendations
  if (metrics.totalAttempts > 1000) {
    recommendations.push('High volume processing. Monitor for performance degradation and consider scaling.');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('System performing well. Continue monitoring for any changes.');
  }
  
  return recommendations;
}