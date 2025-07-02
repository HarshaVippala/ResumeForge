import { VercelRequest, VercelResponse } from '@vercel/node';
import { AIService } from './_lib/ai';
import { getSupabase } from './_lib/db';

/**
 * Analyze job description and extract categorized keywords
 * POST /api/analyze-job
 * 
 * Expected payload:
 * {
 *   "company": "Google",
 *   "role": "Senior Software Engineer",
 *   "jobDescription": "..."
 * }
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { company, role, jobDescription } = req.body;

    // Validate input
    if (!company?.trim() || !role?.trim() || !jobDescription?.trim()) {
      return res.status(400).json({ 
        error: 'Missing required fields: company, role, jobDescription' 
      });
    }

    console.log(`Analyzing job: ${company} - ${role}`);

    // Create AI service instance
    const aiService = new AIService();

    // Analyze job description
    const analysis = await aiService.analyzeJob({
      jobDescription,
      role,
      company
    });

    // Save to database
    const supabase = getSupabase();
    const { data: session, error: dbError } = await supabase
      .from('resume_sessions')
      .insert({
        company,
        role,
        job_description: jobDescription,
        analysis_data: JSON.stringify(analysis) // Convert to string for TEXT column
      })
      .select('id')
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      // Continue without saving - personal use, not critical
    }

    return res.status(200).json({
      success: true,
      session_id: session?.id || null,
      analysis
    });

  } catch (error) {
    console.error('Error in analyze-job:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    });
  }
}