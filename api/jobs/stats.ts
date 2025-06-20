import { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase } from '../_lib/db';

/**
 * Job Statistics API
 * GET /api/jobs/stats - Get job statistics
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
    
    // Get basic counts
    const { count: totalJobs } = await supabase
      .from('jobs')
      .select('*', { count: 'exact', head: true });

    const { count: remoteJobs } = await supabase
      .from('jobs')
      .select('*', { count: 'exact', head: true })
      .eq('remote', true);

    // Get jobs from last 24 hours
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: jobsLast24h } = await supabase
      .from('jobs')
      .select('*', { count: 'exact', head: true })
      .gte('date_posted', yesterday);

    // Get jobs from last week
    const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count: jobsLastWeek } = await supabase
      .from('jobs')
      .select('*', { count: 'exact', head: true })
      .gte('date_posted', lastWeek);

    // Get unique companies count
    const { data: companies } = await supabase
      .from('jobs')
      .select('company')
      .order('company');
    
    const uniqueCompanies = new Set(companies?.map(j => j.company)).size;

    // Get top companies
    const { data: topCompaniesData } = await supabase
      .rpc('get_top_companies', { limit_count: 10 });

    // Get experience distribution
    const { data: experienceData } = await supabase
      .rpc('get_experience_distribution');

    // Get average salaries
    const { data: salaryData } = await supabase
      .from('jobs')
      .select('salary_min, salary_max')
      .not('salary_min', 'is', null)
      .not('salary_max', 'is', null);

    let avgSalaryMin = 0;
    let avgSalaryMax = 0;
    if (salaryData && salaryData.length > 0) {
      avgSalaryMin = salaryData.reduce((sum, job) => sum + (job.salary_min || 0), 0) / salaryData.length;
      avgSalaryMax = salaryData.reduce((sum, job) => sum + (job.salary_max || 0), 0) / salaryData.length;
    }

    // Get platforms count
    const { data: platforms } = await supabase
      .from('jobs')
      .select('platform')
      .order('platform');
    
    const platformsUsed = new Set(platforms?.map(j => j.platform)).size;

    const stats = {
      total_active_jobs: totalJobs || 0,
      unique_companies: uniqueCompanies,
      platforms_used: platformsUsed,
      avg_salary_min: Math.round(avgSalaryMin),
      avg_salary_max: Math.round(avgSalaryMax),
      remote_jobs_count: remoteJobs || 0,
      jobs_last_24h: jobsLast24h || 0,
      jobs_last_week: jobsLastWeek || 0,
      top_companies: topCompaniesData || [],
      experience_distribution: experienceData || []
    };

    return res.status(200).json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('Error fetching job stats:', error);
    return res.status(500).json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch job statistics' 
    });
  }
}