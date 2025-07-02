import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/api/_lib/db'
import { 
  sanitizeJobResponse, 
  sanitizeBulkResponse,
  shouldReturnFullData 
} from '@/api/_lib/security/response-sanitizer'
import { validateStringLength, INPUT_LIMITS } from '@/api/_lib/validation/input-limits'

/**
 * Combined Jobs API - Handles all job-related operations
 * GET /api/jobs?action=list - List jobs
 * GET /api/jobs?action=saved - Get saved jobs
 * GET /api/jobs?action=stats - Get job statistics
 * GET /api/jobs?action=filters - Get available filters
 * GET /api/jobs?action=get&id=X - Get single job
 * POST /api/jobs?action=save - Save/unsave a job
 * POST /api/jobs?action=scrape - Trigger job scraping
 * POST /api/jobs - Create new job
 */

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action') || 'list'
  const id = searchParams.get('id')

  try {
    switch (action) {
      case 'list':
        return await handleGetJobs(request)
      case 'saved':
        return await handleGetSavedJobs(request)
      case 'stats':
        return await handleGetStats(request)
      case 'filters':
        return await handleGetFilters(request)
      case 'get':
        return await handleGetJob(request, id)
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Jobs API error:', error)
    return NextResponse.json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error' 
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')

  try {
    if (action === 'save') {
      return await handleSaveJob(request)
    } else if (action === 'scrape') {
      return await handleScrapeJobs(request)
    } else {
      return await handleCreateJob(request)
    }
  } catch (error) {
    console.error('Jobs API error:', error)
    return NextResponse.json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error' 
    }, { status: 500 })
  }
}

// List jobs with filtering and pagination
async function handleGetJobs(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  
  const page = searchParams.get('page') || '1'
  const limit = searchParams.get('limit') || '20'
  const sort_by = searchParams.get('sort_by') || 'date_posted'
  const sort_order = searchParams.get('sort_order') || 'desc'
  const search = searchParams.get('search')
  const company = searchParams.get('company')
  const location = searchParams.get('location')
  const remote = searchParams.get('remote')
  const salary_min = searchParams.get('salary_min')
  const salary_max = searchParams.get('salary_max')
  const experience_level = searchParams.get('experience_level')
  const platform = searchParams.get('platform')
  const job_type = searchParams.get('job_type')
  const date_posted = searchParams.get('date_posted')

  const pageNum = parseInt(page)
  const limitNum = parseInt(limit)
  const offset = (pageNum - 1) * limitNum

  const supabase = getSupabase()
  
  let query = supabase
    .from('jobs')
    .select('*', { count: 'exact' })

  // Apply filters
  if (search) {
    query = query.or(`title.ilike.%${search}%,company.ilike.%${search}%,description.ilike.%${search}%`)
  }
  if (company) {
    query = query.ilike('company', `%${company}%`)
  }
  if (location) {
    query = query.ilike('location', `%${location}%`)
  }
  if (remote === 'true') {
    query = query.eq('remote', true)
  }
  if (salary_min) {
    query = query.gte('salary_min', parseInt(salary_min))
  }
  if (salary_max) {
    query = query.lte('salary_max', parseInt(salary_max))
  }
  if (experience_level) {
    query = query.eq('experience_level', experience_level)
  }
  if (platform) {
    query = query.eq('platform', platform)
  }
  if (job_type) {
    query = query.eq('job_type', job_type)
  }
  
  // Date filter
  if (date_posted) {
    const now = new Date()
    let dateThreshold: Date
    
    switch (date_posted) {
      case '1h':
        dateThreshold = new Date(now.getTime() - 60 * 60 * 1000)
        break
      case '24h':
        dateThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        break
      case '7d':
        dateThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case '30d':
        dateThreshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      default:
        dateThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    }
    
    query = query.gte('date_posted', dateThreshold.toISOString())
  }

  // Apply sorting
  const sortColumn = sort_by === 'date_posted' ? 'date_posted' : sort_by
  query = query.order(sortColumn, { ascending: sort_order === 'asc' })

  // Apply pagination
  query = query.range(offset, offset + limitNum - 1)

  const { data: jobs, error, count } = await query

  if (error) throw error

  const totalPages = Math.ceil((count || 0) / limitNum)

  // Check if full data is requested
  const returnFullData = shouldReturnFullData(request)
  
  // Sanitize responses unless full data is requested
  const responseJobs = returnFullData 
    ? jobs || []
    : sanitizeBulkResponse(jobs || [], sanitizeJobResponse)

  return NextResponse.json({
    success: true,
    jobs: responseJobs,
    pagination: {
      current_page: pageNum,
      total_pages: totalPages,
      total_jobs: count || 0,
      jobs_per_page: limitNum,
      has_next: pageNum < totalPages,
      has_prev: pageNum > 1
    }
  })
}

// Get saved jobs
async function handleGetSavedJobs(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const page = searchParams.get('page') || '1'
  const limit = searchParams.get('limit') || '20'
  
  const pageNum = parseInt(page)
  const limitNum = parseInt(limit)
  const offset = (pageNum - 1) * limitNum

  const supabase = getSupabase()
  
  const { data: jobs, error, count } = await supabase
    .from('jobs')
    .select('*', { count: 'exact' })
    .eq('is_saved', true)
    .order('saved_at', { ascending: false })
    .range(offset, offset + limitNum - 1)

  if (error) throw error

  const totalPages = Math.ceil((count || 0) / limitNum)

  // Check if full data is requested
  const returnFullData = shouldReturnFullData(request)
  
  // Sanitize responses unless full data is requested
  const responseJobs = returnFullData 
    ? jobs || []
    : sanitizeBulkResponse(jobs || [], sanitizeJobResponse)

  return NextResponse.json({
    success: true,
    jobs: responseJobs,
    pagination: {
      current_page: pageNum,
      total_pages: totalPages,
      total_jobs: count || 0,
      jobs_per_page: limitNum,
      has_next: pageNum < totalPages,
      has_prev: pageNum > 1
    }
  })
}

// Get job statistics
async function handleGetStats(_request: NextRequest) {
  const supabase = getSupabase()
  
  const { count: totalJobs } = await supabase
    .from('jobs')
    .select('*', { count: 'exact', head: true })

  const { count: savedJobs } = await supabase
    .from('jobs')
    .select('*', { count: 'exact', head: true })
    .eq('is_saved', true)

  const { data: platformStats } = await supabase
    .from('jobs')
    .select('platform')
    .order('platform')

  const platformCounts = platformStats?.reduce((acc: any, job) => {
    acc[job.platform] = (acc[job.platform] || 0) + 1
    return acc
  }, {}) || {}

  const { data: companyStats } = await supabase
    .from('jobs')
    .select('company')
    .order('company')

  const topCompanies = Object.entries(
    companyStats?.reduce((acc: any, job) => {
      acc[job.company] = (acc[job.company] || 0) + 1
      return acc
    }, {}) || {}
  )
    .sort(([, a]: any, [, b]: any) => b - a)
    .slice(0, 10)
    .map(([company, count]) => ({ company, count }))

  return NextResponse.json({
    success: true,
    stats: {
      total_jobs: totalJobs || 0,
      saved_jobs: savedJobs || 0,
      platform_distribution: platformCounts,
      top_companies: topCompanies,
      last_updated: new Date().toISOString()
    }
  })
}

// Get available filters
async function handleGetFilters(_request: NextRequest) {
  const supabase = getSupabase()
  
  const [companies, locations, platforms, experienceLevels, jobTypes] = await Promise.all([
    supabase.from('jobs').select('company').order('company'),
    supabase.from('jobs').select('location').order('location'),
    supabase.from('jobs').select('platform').order('platform'),
    supabase.from('jobs').select('experience_level').order('experience_level'),
    supabase.from('jobs').select('job_type').order('job_type')
  ])

  const uniqueCompanies = [...new Set(companies.data?.map(j => j.company).filter(Boolean))]
  const uniqueLocations = [...new Set(locations.data?.map(j => j.location).filter(Boolean))]
  const uniquePlatforms = [...new Set(platforms.data?.map(j => j.platform).filter(Boolean))]
  const uniqueExperienceLevels = [...new Set(experienceLevels.data?.map(j => j.experience_level).filter(Boolean))]
  const uniqueJobTypes = [...new Set(jobTypes.data?.map(j => j.job_type).filter(Boolean))]

  return NextResponse.json({
    success: true,
    filters: {
      companies: uniqueCompanies,
      locations: uniqueLocations,
      platforms: uniquePlatforms,
      experience_levels: uniqueExperienceLevels,
      job_types: uniqueJobTypes
    }
  })
}

// Get single job
async function handleGetJob(_request: NextRequest, id: string | null) {
  if (!id) {
    return NextResponse.json({ error: 'Job ID is required' }, { status: 400 })
  }

  const supabase = getSupabase()
  
  const { data: job, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }
    throw error
  }

  // Check if full data is requested
  const returnFullData = shouldReturnFullData(_request)
  
  // Sanitize response unless full data is requested
  const responseJob = returnFullData 
    ? job
    : sanitizeJobResponse(job)

  return NextResponse.json({
    success: true,
    job: responseJob
  })
}

// Save/unsave a job
async function handleSaveJob(request: NextRequest) {
  const body = await request.json()
  const { jobId, saved = true } = body

  if (!jobId) {
    return NextResponse.json({ error: 'Missing required field: jobId' }, { status: 400 })
  }

  const supabase = getSupabase()
  
  const { data: job, error } = await supabase
    .from('jobs')
    .update({
      is_saved: saved,
      saved_at: saved ? new Date().toISOString() : null
    })
    .eq('id', jobId)
    .select()
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }
    throw error
  }

  // Check if full data is requested
  const returnFullData = shouldReturnFullData(request)
  
  // Sanitize response unless full data is requested
  const responseJob = returnFullData 
    ? job
    : sanitizeJobResponse(job)

  return NextResponse.json({
    success: true,
    job: responseJob,
    message: saved ? 'Job saved successfully' : 'Job unsaved successfully'
  })
}

// Create new job
async function handleCreateJob(request: NextRequest) {
  const jobData = await request.json()

  if (!jobData.title || !jobData.company) {
    return NextResponse.json({ error: 'Missing required fields: title, company' }, { status: 400 })
  }

  // Validate input sizes to prevent AI cost overruns
  const validationErrors: string[] = []
  
  // Validate job description if provided
  if (jobData.description) {
    const descValidation = validateStringLength(
      jobData.description,
      INPUT_LIMITS.MAX_JOB_DESCRIPTION_LENGTH,
      'Job description'
    )
    if (!descValidation.isValid && descValidation.error) {
      validationErrors.push(descValidation.error)
    }
  }
  
  // Validate company name
  const companyValidation = validateStringLength(
    jobData.company,
    INPUT_LIMITS.MAX_COMPANY_NAME_LENGTH,
    'Company name'
  )
  if (!companyValidation.isValid && companyValidation.error) {
    validationErrors.push(companyValidation.error)
  }
  
  // Validate job title
  const titleValidation = validateStringLength(
    jobData.title,
    INPUT_LIMITS.MAX_ROLE_TITLE_LENGTH,
    'Job title'
  )
  if (!titleValidation.isValid && titleValidation.error) {
    validationErrors.push(titleValidation.error)
  }
  
  if (validationErrors.length > 0) {
    return NextResponse.json({ 
      error: 'Validation Error',
      details: validationErrors 
    }, { status: 400 })
  }

  const supabase = getSupabase()
  
  const { data: job, error } = await supabase
    .from('jobs')
    .insert({
      ...jobData,
      scraped_at: new Date().toISOString()
    })
    .select()
    .single()

  if (error) throw error

  // Check if full data is requested
  const returnFullData = shouldReturnFullData(request)
  
  // Sanitize response unless full data is requested
  const responseJob = returnFullData 
    ? job
    : sanitizeJobResponse(job)

  return NextResponse.json({
    success: true,
    job: responseJob
  }, { status: 201 })
}

// Trigger job scraping
async function handleScrapeJobs(_request: NextRequest) {
  try {
    // For now, return a mock response since scraping functionality
    // requires backend integration with Python scraper
    return NextResponse.json({
      message: 'Job scraping initiated',
      status: 'in_progress',
      estimatedTime: '2-3 minutes',
      note: 'Scraping functionality requires backend service integration'
    })
  } catch (error) {
    console.error('Scraping error:', error)
    return NextResponse.json({ 
      error: 'Failed to initiate job scraping' 
    }, { status: 500 })
  }
}