import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/api/_lib/db';
import { Resume, ResumeInsert } from '@/api/_lib/db/types';

export const runtime = 'edge';

/**
 * Master Resume API Routes
 * Created: 2025-01-10
 * 
 * GET /api/master-resume - List all master resumes
 * POST /api/master-resume - Create new master resume
 */

// GET - List all master resumes
export async function GET(req: NextRequest) {
  try {
    const db = getSupabase();
    
    // Fetch all active master resumes
    const { data: masterResumes, error } = await db
      .from('resumes')
      .select('*')
      .eq('is_master', true)
      .eq('is_active', true)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching master resumes:', error);
      return NextResponse.json(
        { error: 'Failed to fetch master resumes' },
        { status: 500 }
      );
    }

    // Transform the data for frontend consumption
    const transformedResumes = masterResumes?.map((resume: Resume, index: number) => ({
      id: resume.id,
      name: resume.name,
      isPrimary: index === 0, // Most recently updated resume is considered primary
      content: resume.content,
      mainSkills: resume.main_skills,
      techStack: resume.tech_stack,
      focusArea: resume.focus_area,
      tags: resume.tags,
      createdAt: resume.created_at,
      updatedAt: resume.updated_at,
      // Include summary preview for UI
      summaryPreview: resume.content?.summary ? 
        resume.content.summary.substring(0, 150) + '...' : 
        'No summary available'
    }));

    return NextResponse.json({
      success: true,
      masterResumes: transformedResumes || [],
      count: transformedResumes?.length || 0
    });

  } catch (error) {
    console.error('Master resume list error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create new master resume
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, content, mainSkills, techStack, focusArea, tags } = body;

    // Validate required fields
    if (!name || !content) {
      return NextResponse.json(
        { error: 'Name and content are required' },
        { status: 400 }
      );
    }

    // Validate content structure
    if (!content.contact || !content.summary || !content.experience || !content.education || !content.skills) {
      return NextResponse.json(
        { error: 'Resume content must include contact, summary, experience, education, and skills sections' },
        { status: 400 }
      );
    }

    const db = getSupabase();

    // No need to unset defaults since we removed the is_default concept

    // Create the new master resume
    const newResume: ResumeInsert = {
      name,
      content,
      main_skills: mainSkills || [],
      tech_stack: techStack || [],
      focus_area: focusArea || null,
      tags: tags || [],
      is_master: true,
      is_active: true,
      version: 1,
      submission_count: 0,
      ats_score: null,
      keyword_density: null,
      tailoring_notes: 'Master resume template'
    };

    const { data: createdResume, error } = await db
      .from('resumes')
      .insert(newResume)
      .select()
      .single();

    if (error) {
      console.error('Error creating master resume:', error);
      return NextResponse.json(
        { error: 'Failed to create master resume' },
        { status: 500 }
      );
    }

    // Log activity
    await db
      .from('activity_log')
      .insert({
        event_type: 'master_resume_created',
        entity_type: 'resume',
        entity_id: createdResume.id,
        description: `Created master resume: ${name}`,
        metadata: {
          resume_name: name,
          skills_count: mainSkills?.length || 0
        },
        source: 'user'
      });

    return NextResponse.json({
      success: true,
      masterResume: {
        id: createdResume.id,
        name: createdResume.name,
        isPrimary: true, // New resumes are considered primary
        content: createdResume.content,
        mainSkills: createdResume.main_skills,
        techStack: createdResume.tech_stack,
        focusArea: createdResume.focus_area,
        tags: createdResume.tags,
        createdAt: createdResume.created_at,
        updatedAt: createdResume.updated_at
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Master resume creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}