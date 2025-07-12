import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getSupabase } from './_lib/db';
import { withAuthEdge } from './_lib/auth/middleware';
import { 
  sanitizeApplicationResponse, 
  sanitizeBulkResponse,
  shouldReturnFullData 
} from './_lib/security/response-sanitizer';

export const runtime = 'edge';

/**
 * Job Applications API
 * GET /api/applications - List all job applications
 * POST /api/applications - Create a new job application
 */

// GET: List all job applications
async function handleGET(req: NextRequest) {
  try {
    const db = getSupabase();
    
    // First try to get applications without join to isolate the issue
    const { data: applications, error } = await db
      .from('job_applications')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching applications:', error);
      // Return empty array for now if table doesn't exist
      if (error.code === 'PGRST116') {
        return NextResponse.json({ applications: [] });
      }
      return NextResponse.json(
        { error: `Database error: ${error.message}` },
        { status: 500 }
      );
    }

    // Check if full data is requested
    const returnFullData = shouldReturnFullData(req);
    
    // Sanitize responses unless full data is requested
    const responseApplications = returnFullData 
      ? applications || []
      : sanitizeBulkResponse(applications || [], sanitizeApplicationResponse);

    return NextResponse.json({ applications: responseApplications });
  } catch (error) {
    console.error('Applications API error:', error);
    return NextResponse.json(
      { error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

// POST: Create new job application
async function handlePOST(req: NextRequest) {
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
      .eq('saved_job_id', jobId)
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
        saved_job_id: jobId,
        status,
        applied_date: status === 'applied' ? new Date().toISOString() : null
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

    // Check if full data is requested
    const returnFullData = shouldReturnFullData(req);
    
    // Sanitize response unless full data is requested
    const responseApplication = returnFullData 
      ? application
      : sanitizeApplicationResponse(application);

    return NextResponse.json({ application: responseApplication }, { status: 201 });
  } catch (error) {
    console.error('Create application error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT: Update job application
async function handlePUT(req: NextRequest) {
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

    // Check if full data is requested
    const returnFullData = shouldReturnFullData(req);
    
    // Sanitize response unless full data is requested
    const responseApplication = returnFullData 
      ? application
      : sanitizeApplicationResponse(application);

    return NextResponse.json({ application: responseApplication });
  } catch (error) {
    console.error('Update application error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Export with authentication
export const GET = withAuthEdge(handleGET);
export const POST = withAuthEdge(handlePOST);
export const PUT = withAuthEdge(handlePUT);