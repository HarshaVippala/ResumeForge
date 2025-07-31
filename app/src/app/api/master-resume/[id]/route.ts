import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/api/_lib/db';
import { ResumeUpdate } from '@/api/_lib/db/types';

export const runtime = 'edge';

/**
 * Master Resume Detail API Routes
 * Created: 2025-01-10
 * 
 * PUT /api/master-resume/[id] - Update master resume
 * DELETE /api/master-resume/[id] - Delete master resume
 */

// PUT - Update master resume
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const resumeId = params.id;
    const body = await req.json();
    const { name, content, mainSkills, techStack, focusArea, tags } = body;

    if (!resumeId) {
      return NextResponse.json(
        { error: 'Resume ID is required' },
        { status: 400 }
      );
    }

    const db = getSupabase();

    // Verify the resume exists and is a master resume
    const { data: existingResume, error: fetchError } = await db
      .from('resumes')
      .select('id, name, is_master')
      .eq('id', resumeId)
      .eq('is_master', true)
      .single();

    if (fetchError || !existingResume) {
      return NextResponse.json(
        { error: 'Master resume not found' },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: ResumeUpdate = {
      updated_at: new Date().toISOString()
    };

    if (name !== undefined) updateData.name = name;
    if (content !== undefined) updateData.content = content;
    if (mainSkills !== undefined) updateData.main_skills = mainSkills;
    if (techStack !== undefined) updateData.tech_stack = techStack;
    if (focusArea !== undefined) updateData.focus_area = focusArea;
    if (tags !== undefined) updateData.tags = tags;

    // Update the resume
    const { data: updatedResume, error: updateError } = await db
      .from('resumes')
      .update(updateData)
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
        event_type: 'master_resume_updated',
        entity_type: 'resume',
        entity_id: resumeId,
        description: `Updated master resume: ${updatedResume.name}`,
        metadata: {
          old_name: existingResume.name,
          new_name: updatedResume.name,
          fields_updated: Object.keys(updateData).filter(k => k !== 'updated_at')
        },
        source: 'user'
      });

    return NextResponse.json({
      success: true,
      masterResume: {
        id: updatedResume.id,
        name: updatedResume.name,
        isMaster: updatedResume.is_master,
        content: updatedResume.content,
        mainSkills: updatedResume.main_skills,
        techStack: updatedResume.tech_stack,
        focusArea: updatedResume.focus_area,
        tags: updatedResume.tags,
        createdAt: updatedResume.created_at,
        updatedAt: updatedResume.updated_at
      }
    });

  } catch (error) {
    console.error('Master resume update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Delete master resume
export async function DELETE(
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

    // Check if this is a master resume
    const { data: resumeToDelete, error: fetchError } = await db
      .from('resumes')
      .select('id, name, is_master')
      .eq('id', resumeId)
      .eq('is_master', true)
      .single();

    if (fetchError || !resumeToDelete) {
      return NextResponse.json(
        { error: 'Master resume not found' },
        { status: 404 }
      );
    }

    // Don't delete if it's the only master resume
    const { count } = await db
      .from('resumes')
      .select('id', { count: 'exact', head: true })
      .eq('is_master', true)
      .eq('is_active', true);

    if (count === 1) {
      return NextResponse.json(
        { error: 'Cannot delete the only master resume. Create another one first.' },
        { status: 400 }
      );
    }

    // Soft delete by setting is_active to false
    const { error: deleteError } = await db
      .from('resumes')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', resumeId);

    if (deleteError) {
      console.error('Error deleting master resume:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete master resume' },
        { status: 500 }
      );
    }

    // No need to update any other resumes since we removed the is_default concept

    // Log activity
    await db
      .from('activity_log')
      .insert({
        event_type: 'master_resume_deleted',
        entity_type: 'resume',
        entity_id: resumeId,
        description: `Deleted master resume: ${resumeToDelete.name}`,
        metadata: {
          resume_name: resumeToDelete.name
        },
        source: 'user'
      });

    return NextResponse.json({
      success: true,
      message: 'Master resume deleted successfully'
    });

  } catch (error) {
    console.error('Master resume deletion error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}