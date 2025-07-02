import { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Parse LinkedIn job URL and extract job information
 * POST /api/parse-linkedin-job
 * 
 * Expected payload:
 * {
 *   "jobUrl": "https://www.linkedin.com/jobs/view/12345/"
 * }
 * 
 * Note: This is a simplified parser for personal use
 * In production, would use proper web scraping
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
    const { jobUrl } = req.body;

    // Validate input
    if (!jobUrl?.trim()) {
      return res.status(400).json({ 
        error: 'Missing required field: jobUrl' 
      });
    }

    // Validate LinkedIn URL format
    if (!isValidLinkedInUrl(jobUrl)) {
      return res.status(400).json({ 
        error: 'Invalid LinkedIn job URL format' 
      });
    }

    console.log(`Parsing LinkedIn job URL: ${jobUrl}`);

    // For personal use, return a message to manually copy/paste
    // In production, would implement actual scraping
    return res.status(200).json({
      success: true,
      company: 'Company Name',
      role: 'Job Title',
      jobDescription: 'Please copy and paste the job description from LinkedIn',
      message: 'For personal use: Please manually copy the job details from LinkedIn and paste them in the form fields.'
    });

  } catch (error) {
    console.error('Error in parse-linkedin-job:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    });
  }
}

/**
 * Validate LinkedIn job URL format
 */
function isValidLinkedInUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === 'www.linkedin.com' &&
      parsed.pathname.includes('/jobs/view/')
    );
  } catch {
    return false;
  }
}