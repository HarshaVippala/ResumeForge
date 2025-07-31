/**
 * Resume-related database queries
 * Updated: 2025-01-07
 */

import { getSupabase, logActivity } from '../index';
import type { 
  Resume, ResumeInsert, ResumeUpdate,
  ResumeSection, ResumeSectionInsert, ResumeSectionUpdate,
  ResumeSectionType
} from '../types';

/**
 * Get all resumes with optional filters
 */
export async function getResumes(filters?: {
  isActive?: boolean;
  isMaster?: boolean;
  jobId?: string;
  focusArea?: string;
  search?: string;
}) {
  const db = getSupabase();
  
  let query = db.from('resumes').select(`
    *,
    job:jobs(id, job_title, company_name),
    _sectionCount:resume_sections(count)
  `);
  
  // Apply filters
  if (filters?.isActive !== undefined) {
    query = query.eq('is_active', filters.isActive);
  }
  if (filters?.isMaster !== undefined) {
    query = query.eq('is_master', filters.isMaster);
  }
  if (filters?.jobId) {
    query = query.eq('job_id', filters.jobId);
  }
  if (filters?.focusArea) {
    query = query.eq('focus_area', filters.focusArea);
  }
  if (filters?.search) {
    query = query.or(`name.ilike.%${filters.search}%`);
  }
  
  // Order by last updated
  query = query.order('updated_at', { ascending: false });
  
  const { data, error } = await query;
  
  return { data, error };
}

/**
 * Get master resume
 */
export async function getMasterResume() {
  const db = getSupabase();
  
  const { data, error } = await db
    .from('resumes')
    .select(`
      *,
      resume_sections(*)
    `)
    .eq('is_master', true)
    .single();
    
  if (data?.resume_sections) {
    data.resume_sections.sort((a, b) => a.order_index - b.order_index);
  }
  
  return { data, error };
}

/**
 * Clone resume for new job
 */
export async function cloneResume(
  sourceResumeId: string,
  targetJobId: string,
  name: string
) {
  const db = getSupabase();
  
  try {
    // Get source resume with sections
    const { data: sourceResume, error: fetchError } = await db
      .from('resumes')
      .select(`
        *,
        resume_sections(*)
      `)
      .eq('id', sourceResumeId)
      .single();
      
    if (fetchError || !sourceResume) {
      throw new Error('Source resume not found');
    }
    
    // Create new resume
    const newResume: ResumeInsert = {
      name,
      job_id: targetJobId,
      content: sourceResume.content,
      main_skills: sourceResume.main_skills,
      tech_stack: sourceResume.tech_stack,
      focus_area: sourceResume.focus_area,
      parent_version_id: sourceResumeId,
      version: (sourceResume.version || 0) + 1,
      is_master: false,
      is_active: true
    };
    
    const { data: createdResume, error: createError } = await db
      .from('resumes')
      .insert(newResume)
      .select()
      .single();
      
    if (createError || !createdResume) {
      throw createError || new Error('Failed to create resume');
    }
    
    // Clone sections
    if (sourceResume.resume_sections && sourceResume.resume_sections.length > 0) {
      const newSections = sourceResume.resume_sections.map(section => ({
        resume_id: createdResume.id,
        section_type: section.section_type,
        section_name: section.section_name,
        content: section.content,
        order_index: section.order_index,
        is_visible: section.is_visible,
        ai_generated: false // Mark as not AI generated since it's cloned
      }));
      
      await db.from('resume_sections').insert(newSections);
    }
    
    // Log activity
    await logActivity({
      event_type: 'resume_cloned',
      entity_type: 'resume',
      entity_id: createdResume.id,
      description: `Cloned resume "${name}" from "${sourceResume.name}"`,
      metadata: { 
        source_resume_id: sourceResumeId,
        target_job_id: targetJobId
      }
    });
    
    return { data: createdResume, error: null };
  } catch (error) {
    console.error('Error cloning resume:', error);
    return { data: null, error };
  }
}

/**
 * Update resume section
 */
export async function updateResumeSection(
  sectionId: string,
  update: ResumeSectionUpdate
) {
  const db = getSupabase();
  
  try {
    const { data, error } = await db
      .from('resume_sections')
      .update({
        ...update,
        updated_at: new Date().toISOString()
      })
      .eq('id', sectionId)
      .select()
      .single();
      
    if (error) throw error;
    
    // Log activity
    await logActivity({
      event_type: 'resume_section_updated',
      entity_type: 'resume_section',
      entity_id: sectionId,
      description: `Updated ${data.section_type} section`,
      metadata: { resume_id: data.resume_id }
    });
    
    return { data, error: null };
  } catch (error) {
    console.error('Error updating resume section:', error);
    return { data: null, error };
  }
}

/**
 * Reorder resume sections
 */
export async function reorderResumeSections(
  resumeId: string,
  sectionOrder: Array<{ id: string; order_index: number }>
) {
  const db = getSupabase();
  
  try {
    // Update each section's order
    const updates = sectionOrder.map(({ id, order_index }) =>
      db.from('resume_sections')
        .update({ order_index })
        .eq('id', id)
        .eq('resume_id', resumeId)
    );
    
    await Promise.all(updates);
    
    return { success: true, error: null };
  } catch (error) {
    console.error('Error reordering sections:', error);
    return { success: false, error };
  }
}

/**
 * Calculate ATS score for resume
 */
export async function calculateATSScore(resumeId: string, jobId: string) {
  const db = getSupabase();
  
  try {
    // Get resume and job details
    const [resumeResult, jobResult] = await Promise.all([
      db.from('resumes').select('content, main_skills, tech_stack').eq('id', resumeId).single(),
      db.from('jobs').select('description, requirements, keywords').eq('id', jobId).single()
    ]);
    
    if (resumeResult.error || jobResult.error) {
      throw new Error('Failed to fetch resume or job data');
    }
    
    const resume = resumeResult.data;
    const job = jobResult.data;
    
    // Simple ATS scoring algorithm
    let score = 0;
    let maxScore = 0;
    const keywordDensity: Record<string, { count: number; percentage: number }> = {};
    
    // Check keywords
    const jobKeywords = [
      ...(job.keywords || []),
      ...(job.requirements?.toLowerCase().match(/\b\w+\b/g) || [])
    ];
    
    const resumeText = JSON.stringify(resume.content).toLowerCase();
    const resumeWords = resumeText.match(/\b\w+\b/g) || [];
    const totalWords = resumeWords.length;
    
    jobKeywords.forEach(keyword => {
      const keywordLower = keyword.toLowerCase();
      const count = (resumeText.match(new RegExp(`\\b${keywordLower}\\b`, 'g')) || []).length;
      
      if (count > 0) {
        score += Math.min(count * 10, 30); // Cap contribution per keyword
        keywordDensity[keyword] = {
          count,
          percentage: (count / totalWords) * 100
        };
      }
      maxScore += 30;
    });
    
    // Normalize score to 0-1 range
    const atsScore = maxScore > 0 ? Math.min(score / maxScore, 1) : 0;
    
    // Update resume with ATS score
    await db.from('resumes')
      .update({ 
        ats_score: atsScore,
        keyword_density: keywordDensity
      })
      .eq('id', resumeId);
      
    return { 
      score: atsScore, 
      keywordDensity,
      matchedKeywords: Object.keys(keywordDensity).length,
      totalKeywords: jobKeywords.length
    };
  } catch (error) {
    console.error('Error calculating ATS score:', error);
    return { score: 0, error };
  }
}

/**
 * Get resume performance metrics
 */
export async function getResumePerformance(resumeId: string) {
  const db = getSupabase();
  
  try {
    // Get jobs where this resume was used
    const { data: jobs } = await db
      .from('jobs')
      .select('status, applied_at')
      .eq('applied_resume_id', resumeId);
      
    if (!jobs || jobs.length === 0) {
      return {
        submission_count: 0,
        response_rate: 0,
        interview_rate: 0,
        offer_rate: 0,
        avg_response_days: 0
      };
    }
    
    const metrics = {
      submission_count: jobs.length,
      response_rate: 0,
      interview_rate: 0,
      offer_rate: 0,
      avg_response_days: 0
    };
    
    // Calculate rates
    const responded = jobs.filter(j => j.status !== 'applied').length;
    const interviews = jobs.filter(j => ['interviewing', 'accepted', 'rejected'].includes(j.status || '')).length;
    const offers = jobs.filter(j => j.status === 'accepted').length;
    
    metrics.response_rate = responded / jobs.length;
    metrics.interview_rate = interviews / jobs.length;
    metrics.offer_rate = offers / jobs.length;
    
    // Update resume with metrics
    await db.from('resumes')
      .update({ 
        submission_count: metrics.submission_count,
        performance_metrics: metrics
      })
      .eq('id', resumeId);
      
    return metrics;
  } catch (error) {
    console.error('Error getting resume performance:', error);
    return null;
  }
}