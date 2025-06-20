import { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase } from '../_lib/db';

/**
 * Save Job API
 * POST /api/jobs/save - Save or unsave a job
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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