import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/api/_lib/db';

export const runtime = 'edge';

/**
 * Set Primary Master Resume API Route
 * Created: 2025-01-10
 * Updated: 2025-01-10 - Removed is_default concept for personal app
 * 
 * PUT /api/master-resume/[id]/default - Move master resume to most recent (primary position)
 */

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const resumeId = params.id;

    if (!resumeId) {
      return NextResponse.json(
        { error: 'Resume ID is required' },
        { status: 400 }
      );
    }

    const db = getSupabase();

    // Verify the resume exists and is a master resume
    const { data: resume, error: fetchError } = await db
      .from('resumes')
      .select('id, name, is_master, is_active')
      .eq('id', resumeId)
      .eq('is_master', true)
      .eq('is_active', true)
      .single();

    if (fetchError || !resume) {
      return NextResponse.json(
        { error: 'Active master resume not found' },
        { status: 404 }
      );
    }

    // Update the resume's timestamp to make it "most recent" and thus primary
    const { data: updatedResume, error: updateError } = await db
      .from('resumes')
      .update({ 
        updated_at: new Date().toISOString()
      })
      .eq('id', resumeId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating master resume:', updateError);
      return NextResponse.json(
        { error: 'Failed to update master resume' },
        { status: 500 }
      );
    }

    // Log activity
    await db
      .from('activity_log')
      .insert({
        event_type: 'master_resume_primary_changed',
        entity_type: 'resume',
        entity_id: resumeId,
        description: `Set "${resume.name}" as primary master resume`,
        metadata: {
          resume_name: resume.name
        },
        source: 'user'
      });

    return NextResponse.json({
      success: true,
      message: 'Primary master resume updated successfully',
      masterResume: {
        id: updatedResume.id,
        name: updatedResume.name,
        isPrimary: true
      }
    });

  } catch (error) {
    console.error('Set default master resume error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}