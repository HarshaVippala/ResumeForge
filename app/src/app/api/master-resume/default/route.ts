import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/api/_lib/db';

export const runtime = 'edge';

/**
 * Default Master Resume API Route
 * Created: 2025-01-10
 * 
 * GET /api/master-resume/default - Get default master resume
 */

export async function GET(req: NextRequest) {
  try {
    const db = getSupabase();
    
    // Fetch the default master resume
    const { data: defaultResume, error } = await db
      .from('resumes')
      .select('*')
      .eq('is_master', true)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error fetching default master resume:', error);
      return NextResponse.json(
        { error: 'Failed to fetch default master resume' },
        { status: 500 }
      );
    }

    if (!defaultResume) {
      return NextResponse.json({
        success: true,
        masterResume: null,
        message: 'No master resume found. Please create one first.'
      });
    }

    return NextResponse.json({
      success: true,
      masterResume: {
        id: defaultResume.id,
        name: defaultResume.name,
        isDefault: true, // Master resume is the default
        content: defaultResume.content,
        mainSkills: defaultResume.main_skills,
        techStack: defaultResume.tech_stack,
        focusArea: defaultResume.focus_area,
        tags: defaultResume.tags,
        createdAt: defaultResume.created_at,
        updatedAt: defaultResume.updated_at
      }
    });

  } catch (error) {
    console.error('Default master resume error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}