import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/api/_lib/db'

/**
 * Dashboard tracking data API
 * GET /api/tracking/dashboard-data - Get comprehensive dashboard data including applications, emails, and stats
 * Updated: 2025-01-08 - Fixed table references for new schema
 */

export async function GET(request: NextRequest) {
  try {
    const db = getSupabase()
    
    // Get job applications (without joins for now to avoid errors)
    const { data: jobs, error: jobsError } = await db
      .from('jobs')
      .select('*')
      .in('status', ['applied', 'interviewing', 'offered'])
      .order('applied_at', { ascending: false })
    
    if (jobsError) {
      console.error('Error fetching jobs:', jobsError)
      throw jobsError
    }

    // Get email statistics - using 'emails' table (not email_communications)
    const { count: totalEmails } = await db
      .from('emails')
      .select('*', { count: 'exact', head: true })
    
    const { count: jobRelatedEmails } = await db
      .from('emails')
      .select('*', { count: 'exact', head: true })
      .eq('is_job_related', true)
    
    const { count: unprocessedEmails } = await db
      .from('emails')
      .select('*', { count: 'exact', head: true })
      .eq('ai_processed', false)
    
    // Get application timeline events - using application_events instead of activity_log
    const { data: events } = await db
      .from('application_events')
      .select('*')
      .in('event_type', ['interview_scheduled', 'application_submitted', 'status_changed'])
      .order('created_at', { ascending: false })
      .limit(50)
    
    // Transform jobs data to application format
    const applications = jobs?.map(job => ({
      id: job.id,
      job_id: job.id,
      position_title: job.job_title,
      company_name: job.company_name,
      status: job.status,
      applied_at: job.applied_at,
      application_method: job.source,
      notes: job.notes,
      interview_date: events?.find(e => e.job_id === job.id && e.event_type === 'interview_scheduled')?.event_data?.interview_date || null,
      linked_data: {
        summary: {
          email_count: 0, // Will need to fetch separately with a join
          timeline_events: events?.filter(e => e.job_id === job.id).length || 0,
          last_activity: events?.find(e => e.job_id === job.id)?.created_at,
          has_action_items: job.status === 'interviewing',
          contact_count: 0 // Contacts feature not yet implemented
        },
        resume_session: job.resumes?.[0] || null,
        timeline: events?.filter(e => e.job_id === job.id) || [],
        contacts: [],
        emails: []
      }
    })) || []

    // Calculate statistics
    const statistics = {
      total_applications: jobs?.length || 0,
      active_applications: jobs?.filter(j => ['applied', 'interviewing'].includes(j.status || '')).length || 0,
      total_emails: totalEmails || 0,
      job_related_emails: jobRelatedEmails || 0,
      unprocessed_emails: unprocessedEmails || 0,
      pending_actions: jobs?.filter(j => j.status === 'interviewing').length || 0
    }

    return NextResponse.json({
      success: true,
      applications,
      statistics,
      last_updated: new Date().toISOString()
    })
  } catch (error) {
    console.error('Dashboard data error:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    
    // More detailed error response for debugging
    const errorDetails = {
      error: 'Failed to fetch dashboard data',
      message: error instanceof Error ? error.message : 'Unknown error',
      type: error?.constructor?.name || 'Unknown',
      details: process.env.NODE_ENV === 'development' ? {
        stack: error instanceof Error ? error.stack : undefined,
        raw: String(error)
      } : undefined
    }
    
    return NextResponse.json(errorDetails, { status: 500 })
  }
}