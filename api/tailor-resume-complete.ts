import { VercelRequest, VercelResponse } from '@vercel/node';
import { AIService } from './_lib/ai';

/**
 * Complete resume tailoring for personal use
 * POST /api/tailor-resume-complete
 * 
 * Expected payload:
 * {
 *   "company": "Google",
 *   "role": "Senior Software Engineer",
 *   "jobDescription": "..."
 * }
 * 
 * Returns complete tailored resume with insights
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

    console.log(`Tailoring complete resume for: ${company} - ${role}`);

    // Create AI service instance
    const aiService = new AIService();

    // Generate tailored resume
    const tailoredResume = await aiService.tailorResume({
      jobDescription,
      company,
      role
    });

    // Generate simple insights
    const insights = {
      keywords_matched: countKeywords(jobDescription, tailoredResume),
      focus_areas: extractFocusAreas(tailoredResume),
      optimization_tips: [
        'Review the tailored content for accuracy',
        'Ensure all achievements are quantifiable',
        'Double-check company name and role throughout'
      ]
    };

    return res.status(200).json({
      success: true,
      tailored_resume: tailoredResume,
      insights,
      company,
      role
    });

  } catch (error) {
    console.error('Error in tailor-resume-complete:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    });
  }
}

/**
 * Count keywords from job description found in tailored resume
 */
function countKeywords(jobDescription: string, resume: any): number {
  const jobWords = jobDescription.toLowerCase().split(/\W+/);
  const resumeText = JSON.stringify(resume).toLowerCase();
  
  const keywords = jobWords.filter(word => 
    word.length > 4 && resumeText.includes(word)
  );
  
  return [...new Set(keywords)].length;
}

/**
 * Extract focus areas from tailored resume
 */
function extractFocusAreas(resume: any): string[] {
  const areas = [];
  
  // Analyze skills distribution
  if (resume.skills) {
    const totalSkills = Object.values(resume.skills)
      .flat()
      .filter(Boolean).length;
    
    if (totalSkills > 0) {
      areas.push(`${totalSkills} relevant skills highlighted`);
    }
  }
  
  // Analyze experience
  if (resume.experience && resume.experience.length > 0) {
    const totalBullets = resume.experience
      .reduce((sum: number, exp: any) => sum + (exp.achievements?.length || 0), 0);
    areas.push(`${totalBullets} achievement bullets tailored`);
  }
  
  // Summary customization
  if (resume.summary) {
    areas.push('Professional summary customized for role');
  }
  
  return areas;
}