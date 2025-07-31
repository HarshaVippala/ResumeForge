import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/api/_lib/db';

/**
 * Analytics API - Resume Performance
 * GET /api/analytics/resume-performance
 * Created: 2025-01-10
 * 
 * Tracks which resumes perform best and provides insights
 */
export async function GET(req: NextRequest) {
  try {
    const db = getSupabase();
    
    // Get query parameters
    const searchParams = req.nextUrl.searchParams;
    const focusArea = searchParams.get('focusArea'); // backend, frontend, fullstack, etc.
    const timeRange = searchParams.get('timeRange') || '30d';
    
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
        dateFilter = new Date('2020-01-01');
        break;
    }
    
    // Get resume performance by score range
    const { data: scoreRangePerformance, error: scoreError } = await db
      .from('resume_performance_by_score')
      .select('*')
      .order('score_range');
    
    if (scoreError) {
      console.error('Error fetching score range performance:', scoreError);
    }
    
    // Get individual resume performance
    let resumeQuery = db
      .from('resumes')
      .select(`
        id,
        name,
        focus_area,
        main_skills,
        ats_score,
        submission_count,
        created_at,
        application_outcomes!left (
          got_response,
          got_interview,
          got_offer,
          response_time_days
        )
      `)
      .gte('created_at', dateFilter.toISOString())
      .order('created_at', { ascending: false });
    
    if (focusArea) {
      resumeQuery = resumeQuery.eq('focus_area', focusArea);
    }
    
    const { data: resumes, error: resumeError } = await resumeQuery;
    
    if (resumeError) {
      throw resumeError;
    }
    
    // Calculate performance metrics for each resume
    const resumePerformance = resumes?.map(resume => {
      const outcomes = resume.application_outcomes || [];
      const totalApplications = outcomes.length;
      const responses = outcomes.filter((o: any) => o.got_response).length;
      const interviews = outcomes.filter((o: any) => o.got_interview).length;
      const offers = outcomes.filter((o: any) => o.got_offer).length;
      const avgResponseTime = outcomes
        .filter((o: any) => o.response_time_days !== null)
        .reduce((sum: number, o: any) => sum + o.response_time_days, 0) / 
        (outcomes.filter((o: any) => o.response_time_days !== null).length || 1);
      
      return {
        id: resume.id,
        name: resume.name,
        focusArea: resume.focus_area,
        mainSkills: resume.main_skills,
        atsScore: Math.round((resume.ats_score || 0) * 100),
        metrics: {
          applications: totalApplications,
          responses,
          interviews,
          offers,
          responseRate: totalApplications > 0 ? Math.round((responses / totalApplications) * 100) : 0,
          interviewRate: totalApplications > 0 ? Math.round((interviews / totalApplications) * 100) : 0,
          offerRate: totalApplications > 0 ? Math.round((offers / totalApplications) * 100) : 0,
          avgResponseDays: Math.round(avgResponseTime * 10) / 10
        },
        createdAt: resume.created_at
      };
    }) || [];
    
    // Sort by performance
    const topPerformers = [...resumePerformance]
      .sort((a, b) => {
        // Sort by offer rate, then interview rate, then response rate
        if (b.metrics.offerRate !== a.metrics.offerRate) {
          return b.metrics.offerRate - a.metrics.offerRate;
        }
        if (b.metrics.interviewRate !== a.metrics.interviewRate) {
          return b.metrics.interviewRate - a.metrics.interviewRate;
        }
        return b.metrics.responseRate - a.metrics.responseRate;
      })
      .slice(0, 10);
    
    // Get optimization metrics for resumes
    const resumeIds = resumes?.map(r => r.id) || [];
    const { data: optimizationMetrics, error: optError } = await db
      .from('optimization_metrics')
      .select('resume_id, final_score, iterations, optimization_time_ms, converged')
      .in('resume_id', resumeIds);
    
    // Create a map for quick lookup
    const optimizationMap = new Map(
      optimizationMetrics?.map(m => [m.resume_id, m]) || []
    );
    
    // Enhance resume performance with optimization data
    const enhancedPerformance = resumePerformance.map(resume => ({
      ...resume,
      optimization: optimizationMap.has(resume.id) ? {
        finalScore: optimizationMap.get(resume.id)!.final_score,
        iterations: optimizationMap.get(resume.id)!.iterations,
        timeSeconds: Math.round(optimizationMap.get(resume.id)!.optimization_time_ms / 1000 * 10) / 10,
        converged: optimizationMap.get(resume.id)!.converged
      } : null
    }));
    
    // Calculate insights
    const avgMetrics = {
      avgResponseRate: Math.round(
        resumePerformance.reduce((sum, r) => sum + r.metrics.responseRate, 0) / 
        (resumePerformance.length || 1)
      ),
      avgInterviewRate: Math.round(
        resumePerformance.reduce((sum, r) => sum + r.metrics.interviewRate, 0) / 
        (resumePerformance.length || 1)
      ),
      avgOfferRate: Math.round(
        resumePerformance.reduce((sum, r) => sum + r.metrics.offerRate, 0) / 
        (resumePerformance.length || 1)
      )
    };
    
    // Find most successful skills
    const skillSuccess: Record<string, { applications: number; successes: number }> = {};
    resumePerformance.forEach(resume => {
      if (resume.metrics.applications > 0) {
        resume.mainSkills?.forEach(skill => {
          if (!skillSuccess[skill]) {
            skillSuccess[skill] = { applications: 0, successes: 0 };
          }
          skillSuccess[skill].applications += resume.metrics.applications;
          skillSuccess[skill].successes += resume.metrics.interviews + resume.metrics.offers;
        });
      }
    });
    
    const topSkills = Object.entries(skillSuccess)
      .map(([skill, data]) => ({
        skill,
        successRate: Math.round((data.successes / data.applications) * 100)
      }))
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, 10);
    
    // Build response
    const response = {
      summary: {
        totalResumes: resumePerformance.length,
        ...avgMetrics
      },
      performanceByScore: scoreRangePerformance?.map(range => ({
        scoreRange: range.score_range,
        applications: range.applications,
        responseRate: range.response_rate,
        interviewRate: range.interview_rate,
        offerRate: range.offer_rate,
        avgResponseDays: range.avg_response_days
      })) || [],
      topPerformingResumes: topPerformers.slice(0, 5),
      allResumes: enhancedPerformance,
      topSkills,
      insights: {
        bestScoreRange: scoreRangePerformance?.reduce((best, current) => 
          (current.offer_rate > best.offer_rate) ? current : best
        , scoreRangePerformance[0])?.score_range || 'Unknown',
        optimalATSScore: Math.round(
          topPerformers
            .filter(r => r.atsScore > 0)
            .reduce((sum, r) => sum + r.atsScore, 0) / 
          (topPerformers.filter(r => r.atsScore > 0).length || 1)
        )
      },
      filters: {
        focusArea,
        timeRange
      },
      lastUpdated: new Date().toISOString()
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Resume performance error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch resume performance data' },
      { status: 500 }
    );
  }
}