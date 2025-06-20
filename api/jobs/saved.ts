import { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase } from '../_lib/db';

/**
 * Saved Jobs API
 * GET /api/jobs/saved - Get all saved jobs
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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