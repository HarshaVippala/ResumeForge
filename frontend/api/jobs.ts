import { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase } from './_lib/db';

/**
 * Combined Jobs API - Handles all job-related operations
 * GET /api/jobs?action=list - List jobs
 * GET /api/jobs?action=saved - Get saved jobs
 * GET /api/jobs?action=stats - Get job statistics
 * GET /api/jobs?action=filters - Get available filters
 * GET /api/jobs?action=get&id=X - Get single job
 * POST /api/jobs?action=save - Save/unsave a job
 * POST /api/jobs - Create new job
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const { action = 'list', id } = req.query;

  try {
    if (req.method === 'GET') {
      switch (action) {
        case 'list':
          return await handleGetJobs(req, res);
        case 'saved':
          return await handleGetSavedJobs(req, res);
        case 'stats':
          return await handleGetStats(req, res);
        case 'filters':
          return await handleGetFilters(req, res);
        case 'get':
          return await handleGetJob(req, res, id as string);
        default:
          return res.status(400).json({ error: 'Invalid action' });
      }
    } else if (req.method === 'POST') {
      if (action === 'save') {
        return await handleSaveJob(req, res);
      } else {
        return await handleCreateJob(req, res);
      }
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Jobs API error:', error);
    return res.status(500).json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error' 
    });
  }
}

// List jobs with filtering and pagination
async function handleGetJobs(req: VercelRequest, res: VercelResponse) {
  const {
    page = '1',
    limit = '20',
    sort_by = 'date_posted',
    sort_order = 'desc',
    search,
    company,
    location,
    remote,
    salary_min,
    salary_max,
    experience_level,
    platform,
    job_type,
    date_posted
  } = req.query;

  const pageNum = parseInt(page as string);
  const limitNum = parseInt(limit as string);
  const offset = (pageNum - 1) * limitNum;

  const supabase = getSupabase();
  
  let query = supabase
    .from('jobs')
    .select('*', { count: 'exact' });

  // Apply filters
  if (search) {
    query = query.or(`title.ilike.%${search}%,company.ilike.%${search}%,description.ilike.%${search}%`);
  }
  if (company) {
    query = query.ilike('company', `%${company}%`);
  }
  if (location) {
    query = query.ilike('location', `%${location}%`);
  }
  if (remote === 'true') {
    query = query.eq('remote', true);
  }
  if (salary_min) {
    query = query.gte('salary_min', parseInt(salary_min as string));
  }
  if (salary_max) {
    query = query.lte('salary_max', parseInt(salary_max as string));
  }
  if (experience_level) {
    query = query.eq('experience_level', experience_level);
  }
  if (platform) {
    query = query.eq('platform', platform);
  }
  if (job_type) {
    query = query.eq('job_type', job_type);
  }
  
  // Date filter
  if (date_posted) {
    const now = new Date();
    let dateThreshold: Date;
    
    switch (date_posted) {
      case '1h':
        dateThreshold = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '24h':
        dateThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        dateThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        dateThreshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        dateThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }
    
    query = query.gte('date_posted', dateThreshold.toISOString());
  }

  // Apply sorting
  const sortColumn = sort_by === 'date_posted' ? 'date_posted' : sort_by as string;
  query = query.order(sortColumn, { ascending: sort_order === 'asc' });

  // Apply pagination
  query = query.range(offset, offset + limitNum - 1);

  const { data: jobs, error, count } = await query;

  if (error) throw error;

  const totalPages = Math.ceil((count || 0) / limitNum);

  return res.status(200).json({
    success: true,
    jobs: jobs || [],
    pagination: {
      current_page: pageNum,
      total_pages: totalPages,
      total_jobs: count || 0,
      jobs_per_page: limitNum,
      has_next: pageNum < totalPages,
      has_prev: pageNum > 1
    }
  });
}

// Get saved jobs
async function handleGetSavedJobs(req: VercelRequest, res: VercelResponse) {
  const { page = '1', limit = '20' } = req.query;
  
  const pageNum = parseInt(page as string);
  const limitNum = parseInt(limit as string);
  const offset = (pageNum - 1) * limitNum;

  const supabase = getSupabase();
  
  const { data: jobs, error, count } = await supabase
    .from('jobs')
    .select('*', { count: 'exact' })
    .eq('is_saved', true)
    .order('saved_at', { ascending: false })
    .range(offset, offset + limitNum - 1);

  if (error) throw error;

  const totalPages = Math.ceil((count || 0) / limitNum);

  return res.status(200).json({
    success: true,
    jobs: jobs || [],
    pagination: {
      current_page: pageNum,
      total_pages: totalPages,
      total_jobs: count || 0,
      jobs_per_page: limitNum,
      has_next: pageNum < totalPages,
      has_prev: pageNum > 1
    }
  });
}

// Get job statistics
async function handleGetStats(req: VercelRequest, res: VercelResponse) {
  const supabase = getSupabase();
  
  const { count: totalJobs } = await supabase
    .from('jobs')
    .select('*', { count: 'exact', head: true });

  const { count: savedJobs } = await supabase
    .from('jobs')
    .select('*', { count: 'exact', head: true })
    .eq('is_saved', true);

  const { data: platformStats } = await supabase
    .from('jobs')
    .select('platform')
    .order('platform');

  const platformCounts = platformStats?.reduce((acc: any, job) => {
    acc[job.platform] = (acc[job.platform] || 0) + 1;
    return acc;
  }, {}) || {};

  const { data: companyStats } = await supabase
    .from('jobs')
    .select('company')
    .order('company');

  const topCompanies = Object.entries(
    companyStats?.reduce((acc: any, job) => {
      acc[job.company] = (acc[job.company] || 0) + 1;
      return acc;
    }, {}) || {}
  )
    .sort(([, a]: any, [, b]: any) => b - a)
    .slice(0, 10)
    .map(([company, count]) => ({ company, count }));

  return res.status(200).json({
    success: true,
    stats: {
      total_jobs: totalJobs || 0,
      saved_jobs: savedJobs || 0,
      platform_distribution: platformCounts,
      top_companies: topCompanies,
      last_updated: new Date().toISOString()
    }
  });
}

// Get available filters
async function handleGetFilters(req: VercelRequest, res: VercelResponse) {
  const supabase = getSupabase();
  
  const [companies, locations, platforms, experienceLevels, jobTypes] = await Promise.all([
    supabase.from('jobs').select('company').order('company'),
    supabase.from('jobs').select('location').order('location'),
    supabase.from('jobs').select('platform').order('platform'),
    supabase.from('jobs').select('experience_level').order('experience_level'),
    supabase.from('jobs').select('job_type').order('job_type')
  ]);

  const uniqueCompanies = [...new Set(companies.data?.map(j => j.company).filter(Boolean))];
  const uniqueLocations = [...new Set(locations.data?.map(j => j.location).filter(Boolean))];
  const uniquePlatforms = [...new Set(platforms.data?.map(j => j.platform).filter(Boolean))];
  const uniqueExperienceLevels = [...new Set(experienceLevels.data?.map(j => j.experience_level).filter(Boolean))];
  const uniqueJobTypes = [...new Set(jobTypes.data?.map(j => j.job_type).filter(Boolean))];

  return res.status(200).json({
    success: true,
    filters: {
      companies: uniqueCompanies,
      locations: uniqueLocations,
      platforms: uniquePlatforms,
      experience_levels: uniqueExperienceLevels,
      job_types: uniqueJobTypes
    }
  });
}

// Get single job
async function handleGetJob(req: VercelRequest, res: VercelResponse, id: string) {
  if (!id) {
    return res.status(400).json({ error: 'Job ID is required' });
  }

  const supabase = getSupabase();
  
  const { data: job, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return res.status(404).json({ error: 'Job not found' });
    }
    throw error;
  }

  return res.status(200).json({
    success: true,
    job
  });
}

// Save/unsave a job
async function handleSaveJob(req: VercelRequest, res: VercelResponse) {
  const { jobId, saved = true } = req.body;

  if (!jobId) {
    return res.status(400).json({ error: 'Missing required field: jobId' });
  }

  const supabase = getSupabase();
  
  const { data: job, error } = await supabase
    .from('jobs')
    .update({
      is_saved: saved,
      saved_at: saved ? new Date().toISOString() : null
    })
    .eq('id', jobId)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return res.status(404).json({ error: 'Job not found' });
    }
    throw error;
  }

  return res.status(200).json({
    success: true,
    job,
    message: saved ? 'Job saved successfully' : 'Job unsaved successfully'
  });
}

// Create new job
async function handleCreateJob(req: VercelRequest, res: VercelResponse) {
  const jobData = req.body;

  if (!jobData.title || !jobData.company) {
    return res.status(400).json({ error: 'Missing required fields: title, company' });
  }

  const supabase = getSupabase();
  
  const { data: job, error } = await supabase
    .from('jobs')
    .insert({
      ...jobData,
      scraped_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) throw error;

  return res.status(201).json({
    success: true,
    job
  });
}