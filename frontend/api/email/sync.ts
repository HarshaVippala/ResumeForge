import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { GmailService } from '../_lib/gmail/service';

export const runtime = 'edge';

/**
 * Sync emails from Gmail
 */
export async function POST(req: NextRequest) {
  try {
    const { userId = 'default_user', syncType = 'incremental' } = await req.json();
    
    const gmailService = new GmailService();
    
    if (syncType === 'initial') {
      // Initial sync - get all emails from last 30 days
      const afterDate = new Date();
      afterDate.setDate(afterDate.getDate() - 30);
      
      await gmailService.initialSync(userId, afterDate);
      
      return NextResponse.json({
        success: true,
        message: 'Initial sync started',
        syncType: 'initial',
      });
    } else {
      // Incremental sync
      await gmailService.incrementalSync(userId);
      
      return NextResponse.json({
        success: true,
        message: 'Incremental sync completed',
        syncType: 'incremental',
      });
    }
  } catch (error: any) {
    console.error('Email sync error:', error);
    
    if (error.message === 'Not authenticated') {
      return NextResponse.json(
        { error: 'Gmail not connected. Please authorize first.' },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to sync emails' },
      { status: 500 }
    );
  }
}

/**
 * Get sync status
 */
export async function GET(req: NextRequest) {
  try {
    const userId = 'default_user';
    const { getSupabase } = await import('../_lib/db');
    const db = getSupabase();
    
    // Get sync metadata
    const { data: syncData } = await db
      .from('sync_metadata')
      .select('*')
      .or(`id.eq.gmail_watch_${userId},id.eq.gmail_sync_progress_${userId}`)
      .order('last_sync_time', { ascending: false });
    
    // Get email count
    const { count: emailCount } = await db
      .from('email_communications')
      .select('*', { count: 'exact', head: true });
    
    return NextResponse.json({
      connected: syncData?.some(d => d.id === `gmail_watch_${userId}`),
      lastSync: syncData?.[0]?.last_sync_time,
      emailCount: emailCount || 0,
      watchExpiration: syncData?.find(d => d.id === `gmail_watch_${userId}`)?.sync_state?.expiration,
    });
  } catch (error) {
    console.error('Sync status error:', error);
    return NextResponse.json(
      { error: 'Failed to get sync status' },
      { status: 500 }
    );
  }
}