import { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase } from '../_lib/db';

/**
 * Job Filters API
 * GET /api/jobs/filters - Get available filter options
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = getSupabase();
    
    // Get unique companies
    const { data: companies } = await supabase
      .from('jobs')
      .select('company')
      .order('company');
    
    const uniqueCompanies = [...new Set(companies?.map(j => j.company) || [])];

    // Get unique locations
    const { data: locations } = await supabase
      .from('jobs')
      .select('location')
      .order('location');
    
    const uniqueLocations = [...new Set(locations?.map(j => j.location) || [])];

    // Get unique experience levels
    const { data: experienceLevels } = await supabase
      .from('jobs')
      .select('experience_level')
      .order('experience_level');
    
    const uniqueExperienceLevels = [...new Set(experienceLevels?.map(j => j.experience_level).filter(Boolean) || [])];

    // Get unique platforms
    const { data: platforms } = await supabase
      .from('jobs')
      .select('platform')
      .order('platform');
    
    const uniquePlatforms = [...new Set(platforms?.map(j => j.platform).filter(Boolean) || [])];

    // Get unique job types
    const { data: jobTypes } = await supabase
      .from('jobs')
      .select('job_type')
      .order('job_type');
    
    const uniqueJobTypes = [...new Set(jobTypes?.map(j => j.job_type).filter(Boolean) || [])];

    // Get salary ranges
    const { data: salaryData } = await supabase
      .from('jobs')
      .select('salary_min, salary_max')
      .not('salary_min', 'is', null)
      .not('salary_max', 'is', null);

    let minSalary = 0;
    let maxSalary = 0;
    
    if (salaryData && salaryData.length > 0) {
      minSalary = Math.min(...salaryData.map(j => j.salary_min || 0));
      maxSalary = Math.max(...salaryData.map(j => j.salary_max || 0));
    }

    const filters = {
      companies: uniqueCompanies,
      locations: uniqueLocations,
      experience_levels: uniqueExperienceLevels,
      platforms: uniquePlatforms,
      job_types: uniqueJobTypes,
      salary_range: {
        min: minSalary,
        max: maxSalary
      }
    };

    return res.status(200).json({
      success: true,
      filters
    });

  } catch (error) {
    console.error('Error fetching job filters:', error);
    return res.status(500).json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch job filters' 
    });
  }
}