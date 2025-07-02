import { NextResponse } from 'next/server';

export const runtime = 'edge';

/**
 * Resume Library endpoints
 * TODO: Implement resume storage functionality
 */

// GET: List all resumes
export async function GET() {
  try {
    // Return empty array for now - prevents frontend crashes
    return NextResponse.json({
      resumes: [],
      message: 'Resume library endpoints are not yet implemented'
    });
  } catch (error) {
    console.error('Resume library list error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: Create new resume
export async function POST() {
  try {
    return NextResponse.json(
      { 
        error: 'Not Implemented',
        message: 'Resume library creation is not yet implemented'
      },
      { status: 501 }
    );
  } catch (error) {
    console.error('Resume library create error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}