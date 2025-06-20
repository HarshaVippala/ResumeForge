import { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase } from '../_lib/db';

/**
 * Job Details API
 * GET /api/jobs/[id] - Get job details
 * PUT /api/jobs/[id] - Update job
 * DELETE /api/jobs/[id] - Delete job
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid job ID' });
  }

  switch (req.method) {
    case 'GET':
      return handleGetJob(id, res);
    case 'PUT':
      return handleUpdateJob(id, req, res);
    case 'DELETE':
      return handleDeleteJob(id, res);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

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