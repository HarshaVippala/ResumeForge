import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/api/_lib/db';
import { parseJakesResume } from '@/api/_lib/latex/parser';
import { generateJakesResume } from '@/api/_lib/latex/generator';

export const runtime = 'edge';

/**
 * LaTeX Master Resume Import/Export API
 * Created: 2025-01-10
 * 
 * POST /api/master-resume/latex - Import LaTeX resume as master resume
 * GET /api/master-resume/latex?id={resumeId} - Export resume as LaTeX
 */

export async function POST(req: NextRequest) {
  try {
    const { latexContent, name } = await req.json();
    
    if (!latexContent) {
      return NextResponse.json(
        { error: 'LaTeX content is required' },
        { status: 400 }
      );
    }

    // Parse LaTeX to JSON
    const parsedResume = await parseJakesResume(latexContent);
    
    // Validate parsed content
    if (!parsedResume.contact || !parsedResume.experience || !parsedResume.education) {
      return NextResponse.json(
        { error: 'Failed to parse required sections from LaTeX. Ensure your resume has contact info, experience, and education sections.' },
        { status: 400 }
      );
    }

    // Extract skills for database
    const mainSkills = [];
    if (parsedResume.skills?.categories) {
      parsedResume.skills.categories.forEach(cat => {
        mainSkills.push(...cat.items);
      });
    }

    const db = getSupabase();
    
    // Create master resume
    const { data: createdResume, error } = await db
      .from('resumes')
      .insert({
        name: name || `LaTeX Import - ${new Date().toLocaleDateString()}`,
        content: parsedResume,
        main_skills: mainSkills.slice(0, 20),
        tech_stack: mainSkills.filter(skill => 
          /\b(react|node|typescript|javascript|python|aws|docker)\b/i.test(skill)
        ).slice(0, 10),
        is_master: true,
        is_active: true,
        version: 1,
        tailoring_notes: 'Imported from Jake\'s Resume LaTeX template'
      })
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to save master resume' },
        { status: 500 }
      );
    }

    // Log activity
    await db
      .from('activity_log')
      .insert({
        event_type: 'master_resume_latex_import',
        entity_type: 'resume',
        entity_id: createdResume.id,
        description: 'Imported master resume from LaTeX',
        metadata: {
          template: 'jakes-resume',
          sections_parsed: Object.keys(parsedResume).filter(k => parsedResume[k])
        },
        source: 'user'
      });

    return NextResponse.json({
      success: true,
      message: 'LaTeX resume imported successfully',
      masterResume: {
        id: createdResume.id,
        name: createdResume.name,
        content: parsedResume
      }
    }, { status: 201 });

  } catch (error) {
    console.error('LaTeX import error:', error);
    return NextResponse.json(
      { error: 'Failed to parse LaTeX content' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const resumeId = searchParams.get('id');
    
    if (!resumeId) {
      return NextResponse.json(
        { error: 'Resume ID is required' },
        { status: 400 }
      );
    }

    const db = getSupabase();
    
    // Fetch resume
    const { data: resume, error } = await db
      .from('resumes')
      .select('content, name')
      .eq('id', resumeId)
      .single();

    if (error || !resume) {
      return NextResponse.json(
        { error: 'Resume not found' },
        { status: 404 }
      );
    }

    // Generate LaTeX
    const latexContent = await generateJakesResume(resume.content);
    
    // Return as plain text with LaTeX content type
    return new Response(latexContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${resume.name.replace(/[^a-zA-Z0-9]/g, '_')}.tex"`
      }
    });

  } catch (error) {
    console.error('LaTeX export error:', error);
    return NextResponse.json(
      { error: 'Failed to generate LaTeX' },
      { status: 500 }
    );
  }
}