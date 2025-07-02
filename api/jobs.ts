import { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase } from './_lib/db';

/**
 * Consolidated Jobs API
 * Handles all job-related operations through action parameter pattern
 * 
 * GET /api/jobs?action=list (or no action) - list jobs with filtering
 * GET /api/jobs?action=get&id=123 - get single job details
 * GET /api/jobs?action=saved - get saved jobs
 * GET /api/jobs?action=stats - get job statistics  
 * GET /api/jobs?action=filters - get available filter options
 * POST /api/jobs?action=save - save/unsave a job
 * POST /api/jobs?action=scrape - trigger job scraping
 * POST /api/jobs (no action) - create new job
 * PUT /api/jobs?action=update&id=123 - update existing job
 * DELETE /api/jobs?action=delete&id=123 - delete job
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const { action, id } = req.query;

  // Handle GET requests
  if (req.method === 'GET') {
    switch (action) {
      case 'get':
        if (!id || typeof id !== 'string') {
          return res.status(400).json({ error: 'Invalid job ID' });
        }
        return handleGetJob(id, res);
      
      case 'saved':
        return handleGetSavedJobs(req, res);
      
      case 'stats':
        return handleGetStats(res);
      
      case 'filters':
        return handleGetFilters(res);
      
      case 'list':
      default:
        return handleGetJobs(req, res);
    }
  }

  // Handle POST requests
  if (req.method === 'POST') {
    switch (action) {
      case 'save':
        return handleSaveJob(req, res);
      
      case 'scrape':
        return handleScrapeJobs(req, res);
      
      default:
        return handleCreateJob(req, res);
    }
  }

  // Handle PUT requests
  if (req.method === 'PUT') {
    if (action === 'update' && id && typeof id === 'string') {
      return handleUpdateJob(id, req, res);
    }
    return res.status(400).json({ error: 'Invalid request' });
  }

  // Handle DELETE requests
  if (req.method === 'DELETE') {
    if (action === 'delete' && id && typeof id === 'string') {
      return handleDeleteJob(id, res);
    }
    return res.status(400).json({ error: 'Invalid request' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// List jobs with filtering and pagination
async function handleGetJobs(req: VercelRequest, res: VercelResponse) {
  try {
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
    
    // Build query
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

    if (error) {
      throw error;
    }

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

  } catch (error) {
    console.error('Error fetching jobs:', error);
    return res.status(500).json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch jobs' 
    });
  }
}

// Get single job details
async function handleGetJob(id: string, res: VercelResponse) {
  try {
    const supabase = getSupabase();
    
    const { data: job, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ 
          success: false,
          error: 'Job not found' 
        });
      }
      throw error;
    }

    return res.status(200).json({
      success: true,
      job
    });

  } catch (error) {
    console.error('Error fetching job:', error);
    return res.status(500).json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch job' 
    });
  }
}

// Get saved jobs
async function handleGetSavedJobs(req: VercelRequest, res: VercelResponse) {
  try {
    const {
      page = '1',
      limit = '20',
      sort_by = 'saved_at',
      sort_order = 'desc'
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    const supabase = getSupabase();
    
    // Get saved jobs
    let query = supabase
      .from('jobs')
      .select('*', { count: 'exact' })
      .eq('is_saved', true);

    // Apply sorting
    const sortColumn = sort_by === 'saved_at' ? 'saved_at' : sort_by as string;
    query = query.order(sortColumn, { ascending: sort_order === 'asc' });

    // Apply pagination
    query = query.range(offset, offset + limitNum - 1);

    const { data: jobs, error, count } = await query;

    if (error) {
      throw error;
    }

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

  } catch (error) {
    console.error('Error fetching saved jobs:', error);
    return res.status(500).json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch saved jobs' 
    });
  }
}

// Get job statistics
async function handleGetStats(res: VercelResponse) {
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
    // Note: These RPC functions need to be created in Supabase if they don't exist
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

// Get filter options
async function handleGetFilters(res: VercelResponse) {
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

// Create new job
async function handleCreateJob(req: VercelRequest, res: VercelResponse) {
  try {
    const jobData = req.body;

    // Validate required fields
    if (!jobData.title || !jobData.company) {
      return res.status(400).json({ 
        error: 'Missing required fields: title, company' 
      });
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

    if (error) {
      throw error;
    }

    return res.status(201).json({
      success: true,
      job
    });

  } catch (error) {
    console.error('Error creating job:', error);
    return res.status(500).json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create job' 
    });
  }
}

// Update existing job
async function handleUpdateJob(id: string, req: VercelRequest, res: VercelResponse) {
  try {
    const updates = req.body;
    const supabase = getSupabase();
    
    const { data: job, error } = await supabase
      .from('jobs')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ 
          success: false,
          error: 'Job not found' 
        });
      }
      throw error;
    }

    return res.status(200).json({
      success: true,
      job
    });

  } catch (error) {
    console.error('Error updating job:', error);
    return res.status(500).json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update job' 
    });
  }
}

// Delete job
async function handleDeleteJob(id: string, res: VercelResponse) {
  try {
    const supabase = getSupabase();
    
    const { error } = await supabase
      .from('jobs')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    return res.status(200).json({
      success: true,
      message: 'Job deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting job:', error);
    return res.status(500).json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete job' 
    });
  }
}

// Save or unsave a job
async function handleSaveJob(req: VercelRequest, res: VercelResponse) {
  try {
    const { jobId, saved = true } = req.body;

    if (!jobId) {
      return res.status(400).json({ 
        error: 'Missing required field: jobId' 
      });
    }

    const supabase = getSupabase();
    
    // For personal use, we'll use a simple approach
    // In production, you'd have a separate saved_jobs table with user_id
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
        return res.status(404).json({ 
          success: false,
          error: 'Job not found' 
        });
      }
      throw error;
    }

    return res.status(200).json({
      success: true,
      job,
      message: saved ? 'Job saved successfully' : 'Job unsaved successfully'
    });

  } catch (error) {
    console.error('Error saving job:', error);
    return res.status(500).json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save job' 
    });
  }
}

// Trigger job scraping
async function handleScrapeJobs(req: VercelRequest, res: VercelResponse) {
  try {
    // This is a placeholder for scraping functionality
    // In a real implementation, this would trigger a background job
    // to scrape job listings from various platforms
    
    const { platforms = ['linkedin', 'indeed'], keywords = [] } = req.body;

    // For now, just return a success response
    // In production, this would queue a background job
    return res.status(202).json({
      success: true,
      message: 'Job scraping initiated',
      details: {
        platforms,
        keywords,
        status: 'queued'
      }
    });

  } catch (error) {
    console.error('Error initiating job scraping:', error);
    return res.status(500).json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Failed to initiate job scraping' 
    });
  }
}