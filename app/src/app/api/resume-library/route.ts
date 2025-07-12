import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/api/_lib/db';
import type { Resume } from '@/types';

/**
 * Resume Library API
 * GET /api/resume-library
 * 
 * Returns all resumes with real ATS scores and performance metrics
 * Updated: 2025-01-10
 */
export async function GET(req: NextRequest) {
  try {
    const db = getSupabase();
    
    // Query resumes with their real scores
    const { data: dbResumes, error } = await db
      .from('resumes')
      .select(`
        *,
        job:jobs(id, job_title, company_name, status)
      `)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching resumes:', error);
      throw error;
    }
    
    // Transform database resumes to match the Resume interface
    const resumes: Resume[] = (dbResumes || []).map(dbResume => {
      // Parse the resume name to get company and role
      const [company, role] = (dbResume.name || '').split(' - ').map(s => s.trim());
      
      // Extract real scores from database
      const atsScore = dbResume.ats_score ? Math.round(dbResume.ats_score * 100) : 0;
      const keywordMatchScore = dbResume.keyword_density?.coverage ? Math.round(dbResume.keyword_density.coverage * 100) : 
                               dbResume.keyword_density ? Object.keys(dbResume.keyword_density).length * 10 : 0;
      
      return {
        id: dbResume.id,
        title: dbResume.name || 'Untitled Resume',
        company: company || dbResume.job?.company_name || 'Unknown Company',
        role: role || dbResume.job?.job_title || 'Unknown Role',
        final_score: atsScore, // Use real ATS score
        created_at: dbResume.created_at,
        updated_at: dbResume.updated_at,
        file_paths: dbResume.file_paths || {},
        tags: dbResume.main_skills || [],
        metadata: {
          jobDetails: {
            jobPostingUrl: dbResume.job_posting_url,
            applicationDate: dbResume.applied_at,
            salaryRange: dbResume.salary_range,
            location: dbResume.location || 'Remote',
            workType: dbResume.work_type || 'remote'
          },
          classification: {
            jobType: dbResume.job_type || 'full-stack',
            experienceLevel: dbResume.experience_level || 'senior',
            industry: dbResume.industry || 'technology',
            primaryTechnologies: dbResume.tech_stack || []
          },
          performance: {
            atsScore: atsScore, // Real ATS score from Resume Matcher
            keywordMatchPercentage: keywordMatchScore, // Real keyword match score
            interviewConversionRate: dbResume.interview_rate,
            applicationStatus: dbResume.job?.status || 'not-applied'
          },
          customTags: dbResume.custom_tags || []
        }
      };
    });
    
    console.log(`📚 Fetched ${resumes.length} resumes from library`);
    
    return NextResponse.json({
      success: true,
      resumes,
      count: resumes.length
    });
    
  } catch (error) {
    console.error('❌ Resume library error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch resumes',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Create a new resume entry
 * POST /api/resume-library
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, content, jobId, atsScore, keywordMatchScore, matchedKeywords, missingKeywords } = body;
    
    const db = getSupabase();
    
    // Create new resume with real scores
    const { data: newResume, error } = await db
      .from('resumes')
      .insert({
        name,
        content,
        job_id: jobId,
        ats_score: atsScore / 100, // Store as decimal 0-1
        keyword_density: {
          coverage: keywordMatchScore / 100,
          matched: matchedKeywords,
          missing: missingKeywords
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating resume:', error);
      throw error;
    }
    
    console.log(`✅ Created new resume: ${name}`);
    
    return NextResponse.json({
      success: true,
      resume: newResume
    });
    
  } catch (error) {
    console.error('❌ Create resume error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create resume',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}