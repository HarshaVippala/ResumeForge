import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/api/_lib/db';

/**
 * Admin endpoint to clear email data
 * DELETE /api/admin/clear-emails
 * 
 * Requires X-Admin-Action header for safety
 */
export async function DELETE(request: NextRequest) {
  // Safety check - require special header
  if (request.headers.get('x-admin-action') !== 'clear-all-emails') {
    return NextResponse.json({ error: 'Forbidden: Missing admin action header' }, { status: 403 });
  }

  try {
    const db = getSupabase();
    
    // Delete all emails
    const { data: emails, error: emailError } = await db
      .from('emails')
      .delete()
      .neq('id', 0) // Delete all rows
      .select('id');
    
    // Delete all job opportunities
    const { data: opportunities, error: oppError } = await db
      .from('job_opportunities')
      .delete()
      .neq('id', 0) // Delete all rows
      .select('id');
    
    // Clear sync state
    const { error: syncError } = await db
      .from('email_sync_state')
      .delete()
      .neq('id', 0);
    
    // Clear sync metadata
    const { error: metaError } = await db
      .from('sync_metadata')
      .delete()
      .like('id', 'gmail%');

    if (emailError || oppError || syncError || metaError) {
      console.error('Errors during deletion:', { emailError, oppError, syncError, metaError });
      return NextResponse.json({ 
        error: 'Failed to clear some data',
        details: { emailError, oppError, syncError, metaError }
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'All email data cleared successfully',
      deletedEmails: emails?.length || 0,
      deletedOpportunities: opportunities?.length || 0
    });

  } catch (error) {
    console.error('Clear emails error:', error);
    return NextResponse.json({
      error: 'Failed to clear email data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}