import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/api/_lib/db';

/**
 * Analytics API - Optimization Statistics
 * GET /api/analytics/optimization-stats
 * Created: 2025-01-10
 * 
 * Returns overall statistics about resume optimization performance
 */
export async function GET(req: NextRequest) {
  try {
    const db = getSupabase();
    
    // Get query parameters
    const searchParams = req.nextUrl.searchParams;
    const timeRange = searchParams.get('timeRange') || '30d'; // 7d, 30d, 90d, all
    const groupBy = searchParams.get('groupBy') || 'week'; // day, week, month
    
    // Calculate date filter
    let dateFilter = new Date();
    switch (timeRange) {
      case '7d':
        dateFilter.setDate(dateFilter.getDate() - 7);
        break;
      case '30d':
        dateFilter.setDate(dateFilter.getDate() - 30);
        break;
      case '90d':
        dateFilter.setDate(dateFilter.getDate() - 90);
        break;
      case 'all':
        dateFilter = new Date('2020-01-01'); // Far past date
        break;
    }
    
    // Get overall statistics
    const { data: overallStats, error: statsError } = await db
      .from('optimization_metrics')
      .select('*')
      .gte('created_at', dateFilter.toISOString());
    
    if (statsError) {
      throw statsError;
    }
    
    // Calculate aggregated metrics
    const totalOptimizations = overallStats?.length || 0;
    const avgInitialScore = overallStats?.reduce((sum, m) => sum + m.initial_score, 0) / totalOptimizations || 0;
    const avgFinalScore = overallStats?.reduce((sum, m) => sum + m.final_score, 0) / totalOptimizations || 0;
    const avgImprovement = avgFinalScore - avgInitialScore;
    const avgIterations = overallStats?.reduce((sum, m) => sum + m.iterations, 0) / totalOptimizations || 0;
    const avgTimeMs = overallStats?.reduce((sum, m) => sum + m.optimization_time_ms, 0) / totalOptimizations || 0;
    const convergenceRate = (overallStats?.filter(m => m.converged).length / totalOptimizations) * 100 || 0;
    
    // Get performance over time using the view
    const { data: performanceOverTime, error: timeError } = await db
      .from('optimization_performance_summary')
      .select('*')
      .gte('week', dateFilter.toISOString())
      .order('week', { ascending: false });
    
    if (timeError) {
      console.error('Error fetching performance over time:', timeError);
    }
    
    // Get score distribution
    const scoreRanges = {
      '90-100': 0,
      '80-89': 0,
      '70-79': 0,
      '60-69': 0,
      'Below 60': 0
    };
    
    overallStats?.forEach(metric => {
      if (metric.final_score >= 90) scoreRanges['90-100']++;
      else if (metric.final_score >= 80) scoreRanges['80-89']++;
      else if (metric.final_score >= 70) scoreRanges['70-79']++;
      else if (metric.final_score >= 60) scoreRanges['60-69']++;
      else scoreRanges['Below 60']++;
    });
    
    // Get top performing keywords (most frequently added)
    const keywordAdditions: Record<string, number> = {};
    overallStats?.forEach(metric => {
      const improvements = metric.keyword_improvements as any;
      if (improvements?.added) {
        improvements.added.forEach((keyword: string) => {
          keywordAdditions[keyword] = (keywordAdditions[keyword] || 0) + 1;
        });
      }
    });
    
    const topAddedKeywords = Object.entries(keywordAdditions)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([keyword, count]) => ({ keyword, count }));
    
    // Build response
    const response = {
      summary: {
        totalOptimizations,
        avgInitialScore: Math.round(avgInitialScore * 100) / 100,
        avgFinalScore: Math.round(avgFinalScore * 100) / 100,
        avgImprovement: Math.round(avgImprovement * 100) / 100,
        avgIterations: Math.round(avgIterations * 10) / 10,
        avgTimeSeconds: Math.round(avgTimeMs / 1000 * 10) / 10,
        convergenceRate: Math.round(convergenceRate * 10) / 10
      },
      scoreDistribution: scoreRanges,
      performanceOverTime: performanceOverTime?.map(row => ({
        period: row.week,
        optimizations: row.total_optimizations,
        avgInitialScore: Math.round(row.avg_initial_score * 100) / 100,
        avgFinalScore: Math.round(row.avg_final_score * 100) / 100,
        avgImprovement: Math.round(row.avg_improvement * 100) / 100,
        convergenceRate: Math.round(row.convergence_rate * 10) / 10
      })) || [],
      topAddedKeywords,
      timeRange,
      lastUpdated: new Date().toISOString()
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch optimization statistics' },
      { status: 500 }
    );
  }
}