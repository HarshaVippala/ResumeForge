import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/api/_lib/db';

// Dashboard data endpoint - always uses real production data
// Last modified: 2025-01-09 - Updated to use real data instead of mock
export async function GET(request: NextRequest) {
  try {
    const db = getSupabase();
    const userId = 'f556989c-4903-47d6-8700-0afe3d4189e5'; // Single user ID
    
    // Get stats from database
    const [jobsCount, resumesCount, emailsCount, activeApplicationsCount] = await Promise.all([
      db.from('my_jobs').select('*', { count: 'exact', head: true }),
      db.from('resume_sessions').select('*', { count: 'exact', head: true }),
      db.from('my_emails').select('*', { count: 'exact', head: true }),
      db.from('my_jobs').select('*', { count: 'exact', head: true })
        .in('status', ['applied', 'interviewing', 'assessment'])
    ]);
    
    // Get recent activity
    const { data: recentActivity } = await db
      .from('my_activity_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    
    // Get upcoming events (interviews, deadlines, etc.)
    const { data: upcomingEvents } = await db
      .from('my_jobs')
      .select('*')
      .gte('next_action_date', new Date().toISOString())
      .order('next_action_date', { ascending: true })
      .limit(5);
    
    const dashboardData = {
      stats: {
        total_jobs: jobsCount.count || 0,
        total_resumes: resumesCount.count || 0,
        total_emails: emailsCount.count || 0,
        active_applications: activeApplicationsCount.count || 0
      },
      recent_activity: recentActivity || [],
      upcoming_events: upcomingEvents || []
    };

    return NextResponse.json(dashboardData);
  } catch (error) {
    console.error('Dashboard data error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}