import { VercelRequest, VercelResponse } from '@vercel/node';
import { AIService } from './_lib/ai';
import { getSupabase } from './_lib/db';
import { withAuthNode } from './_lib/auth/middleware';
import { validateJobAnalysisInputs, createValidationErrorResponse } from './_lib/validation/input-limits';
import { shouldReturnFullData } from './_lib/security/response-sanitizer';

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
async function handler(
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

    // Validate input sizes to prevent AI cost overruns
    const validation = validateJobAnalysisInputs(jobDescription, company, role);
    if (!validation.isValid) {
      return createValidationErrorResponse(validation.errors);
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
      .from('sessions')
      .insert({
        company,
        role,
        job_description: jobDescription,
        analysis_data: analysis
      })
      .select('id')
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      // Continue without saving - personal use, not critical
    }

    // Check if full data is requested
    const returnFullData = shouldReturnFullData(req);
    
    // For analysis endpoint, we might want to return full analysis by default
    // since it's needed for the resume tailoring process
    // But we can still sanitize if needed
    const responseData = {
      success: true,
      session_id: session?.id || null,
      analysis: returnFullData ? analysis : {
        // Return summarized version of analysis
        technical_requirements: analysis.technical_requirements?.slice(0, 5),
        soft_skills: analysis.soft_skills?.slice(0, 3),
        core_responsibilities: analysis.core_responsibilities?.slice(0, 3),
        summary: 'Analysis complete - use full=true for complete data'
      }
    };

    return res.status(200).json(responseData);

  } catch (error) {
    console.error('Error in analyze-job:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    });
  }
}

export default withAuthNode(handler);