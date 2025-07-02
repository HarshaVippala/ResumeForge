import { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase } from '../_lib/db';

/**
 * Jobs API - List jobs with filtering and pagination
 * GET /api/jobs
 * POST /api/jobs (create new job)
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method === 'GET') {
    return handleGetJobs(req, res);
  } else if (req.method === 'POST') {
    return handleCreateJob(req, res);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

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