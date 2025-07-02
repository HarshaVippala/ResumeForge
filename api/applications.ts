import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getSupabase } from './_lib/db';

export const runtime = 'edge';

/**
 * Job Applications API
 * GET /api/applications - List all job applications
 * POST /api/applications - Create a new job application
 */

// GET: List all job applications
export async function GET() {
  try {
    const db = getSupabase();
    
    const { data: applications, error } = await db
      .from('job_applications')
      .select(`
        *,
        jobs (
          id,
          title,
          company,
          location,
          salary_min,
          salary_max,
          application_url
        )
      `)
      .eq('user_email', 'default_user@example.com') // Filter for personal use
      .order('applied_at', { ascending: false });

    if (error) {
      console.error('Error fetching applications:', error);
      return NextResponse.json(
        { error: 'Failed to fetch applications' },
        { status: 500 }
      );
    }

    return NextResponse.json({ applications: applications || [] });
  } catch (error) {
    console.error('Applications API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: Create new job application
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { jobId?: string; status?: string };
    const { jobId, status = 'planned' } = body;

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }

    const db = getSupabase();
    
    // Check if application already exists
    const { data: existing } = await db
      .from('job_applications')
      .select('id')
      .eq('job_id', jobId)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'Application already exists for this job' },
        { status: 409 }
      );
    }

    // Create new application
    const { data: application, error } = await db
      .from('job_applications')
      .insert({
        job_id: jobId,
        user_email: 'default_user@example.com', // For personal use
        status,
        applied_at: status === 'applied' ? new Date().toISOString() : null
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating application:', error);
      return NextResponse.json(
        { error: 'Failed to create application' },
        { status: 500 }
      );
    }

    return NextResponse.json({ application }, { status: 201 });
  } catch (error) {
    console.error('Create application error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT: Update job application
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json() as { id?: string; [key: string]: any };
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Application ID is required' },
        { status: 400 }
      );
    }

    const db = getSupabase();
    
    const { data: application, error } = await db
      .from('job_applications')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating application:', error);
      return NextResponse.json(
        { error: 'Failed to update application' },
        { status: 500 }
      );
    }

    return NextResponse.json({ application });
  } catch (error) {
    console.error('Update application error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}