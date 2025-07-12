import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/api/_lib/db';

/**
 * Analytics API - Track Application Outcome
 * POST /api/analytics/track-outcome
 * Created: 2025-01-10
 * 
 * Records the outcome of a job application for performance tracking
 */

interface TrackOutcomeRequest {
  jobId: string;
  resumeId?: string;
  gotResponse?: boolean;
  responseTimeDays?: number;
  gotInterview?: boolean;
  interviewRounds?: number;
  gotOffer?: boolean;
  offerAmount?: number;
  acceptedOffer?: boolean;
  feedback?: string;
  feedbackSource?: 'recruiter' | 'hiring_manager' | 'automated' | 'self' | 'other';
  rejectionReason?: string;
}

export async function POST(req: NextRequest) {
  try {
    const db = getSupabase();
    const body: TrackOutcomeRequest = await req.json();
    
    // Validate required fields
    if (!body.jobId) {
      return NextResponse.json(
        { error: 'jobId is required' },
        { status: 400 }
      );
    }
    
    // Get job details to find associated resume and optimization metrics
    const { data: job, error: jobError } = await db
      .from('jobs')
      .select('applied_resume_id, company_name, job_title')
      .eq('id', body.jobId)
      .single();
    
    if (jobError || !job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }
    
    const resumeId = body.resumeId || job.applied_resume_id;
    
    // Get optimization metrics if resume exists
    let optimizationMetricId = null;
    let resumeScoreAtSubmission = null;
    let keywordsMatchedAtSubmission = null;
    
    if (resumeId) {
      const { data: metrics } = await db
        .from('optimization_metrics')
        .select('id, final_score, final_keywords_matched')
        .eq('resume_id', resumeId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (metrics) {
        optimizationMetricId = metrics.id;
        resumeScoreAtSubmission = metrics.final_score;
        keywordsMatchedAtSubmission = metrics.final_keywords_matched;
      }
    }
    
    // Check if outcome already exists
    const { data: existingOutcome } = await db
      .from('application_outcomes')
      .select('id')
      .eq('job_id', body.jobId)
      .single();
    
    let outcomeData = {
      job_id: body.jobId,
      resume_id: resumeId,
      got_response: body.gotResponse || false,
      response_time_days: body.responseTimeDays,
      got_interview: body.gotInterview || false,
      interview_rounds: body.interviewRounds || 0,
      got_offer: body.gotOffer || false,
      offer_amount: body.offerAmount,
      accepted_offer: body.acceptedOffer,
      feedback: body.feedback,
      feedback_source: body.feedbackSource,
      rejection_reason: body.rejectionReason,
      optimization_metric_id: optimizationMetricId,
      resume_score_at_submission: resumeScoreAtSubmission,
      keywords_matched_at_submission: keywordsMatchedAtSubmission
    };
    
    let result;
    if (existingOutcome) {
      // Update existing outcome
      const { data, error } = await db
        .from('application_outcomes')
        .update(outcomeData)
        .eq('id', existingOutcome.id)
        .select()
        .single();
      
      if (error) throw error;
      result = data;
    } else {
      // Create new outcome
      const { data, error } = await db
        .from('application_outcomes')
        .insert(outcomeData)
        .select()
        .single();
      
      if (error) throw error;
      result = data;
    }
    
    // Update job status based on outcome
    let newStatus = job.status;
    if (body.gotOffer) {
      newStatus = body.acceptedOffer ? 'accepted' : 'interviewing';
    } else if (body.gotInterview) {
      newStatus = 'interviewing';
    } else if (body.rejectionReason) {
      newStatus = 'rejected';
    }
    
    if (newStatus !== job.status) {
      await db
        .from('jobs')
        .update({ status: newStatus })
        .eq('id', body.jobId);
    }
    
    // Log activity
    await db
      .from('activity_log')
      .insert({
        event_type: 'outcome_tracked',
        entity_type: 'job',
        entity_id: body.jobId,
        description: `Application outcome tracked for ${job.company_name} - ${job.job_title}`,
        metadata: {
          got_response: body.gotResponse,
          got_interview: body.gotInterview,
          got_offer: body.gotOffer,
          resume_score: resumeScoreAtSubmission
        },
        source: 'user'
      });
    
    return NextResponse.json({
      success: true,
      outcomeId: result.id,
      message: 'Application outcome tracked successfully',
      summary: {
        job: `${job.company_name} - ${job.job_title}`,
        response: body.gotResponse ? 'Yes' : 'No',
        interview: body.gotInterview ? 'Yes' : 'No',
        offer: body.gotOffer ? 'Yes' : 'No',
        resumeScore: resumeScoreAtSubmission
      }
    });
    
  } catch (error) {
    console.error('Track outcome error:', error);
    return NextResponse.json(
      { error: 'Failed to track application outcome' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/analytics/track-outcome?jobId=xxx
 * 
 * Get the current outcome for a job
 */
export async function GET(req: NextRequest) {
  try {
    const db = getSupabase();
    const jobId = req.nextUrl.searchParams.get('jobId');
    
    if (!jobId) {
      return NextResponse.json(
        { error: 'jobId parameter is required' },
        { status: 400 }
      );
    }
    
    const { data: outcome, error } = await db
      .from('application_outcomes')
      .select(`
        *,
        jobs!inner (
          company_name,
          job_title
        ),
        resumes (
          name,
          ats_score
        )
      `)
      .eq('job_id', jobId)
      .single();
    
    if (error && error.code !== 'PGRST116') { // Not found error
      throw error;
    }
    
    if (!outcome) {
      return NextResponse.json({
        exists: false,
        jobId
      });
    }
    
    return NextResponse.json({
      exists: true,
      outcome: {
        id: outcome.id,
        jobId: outcome.job_id,
        jobTitle: `${outcome.jobs.company_name} - ${outcome.jobs.job_title}`,
        resumeName: outcome.resumes?.name,
        resumeScore: outcome.resume_score_at_submission,
        gotResponse: outcome.got_response,
        responseTimeDays: outcome.response_time_days,
        gotInterview: outcome.got_interview,
        interviewRounds: outcome.interview_rounds,
        gotOffer: outcome.got_offer,
        offerAmount: outcome.offer_amount,
        acceptedOffer: outcome.accepted_offer,
        feedback: outcome.feedback,
        feedbackSource: outcome.feedback_source,
        rejectionReason: outcome.rejection_reason,
        createdAt: outcome.created_at,
        updatedAt: outcome.updated_at
      }
    });
    
  } catch (error) {
    console.error('Get outcome error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch application outcome' },
      { status: 500 }
    );
  }
}