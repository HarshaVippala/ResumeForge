import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getSupabase } from '../_lib/db';

export const runtime = 'edge';

/**
 * Get email activities and analytics
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const search = searchParams.get('search') || '';
    
    const db = getSupabase();
    
    // Build query
    let query = db
      .from('email_communications')
      .select('*', { count: 'exact' })
      .order('date_sent', { ascending: false })
      .range(offset, offset + limit - 1);
    
    // Add search if provided
    if (search) {
      query = query.or(`subject.ilike.%${search}%,sender.ilike.%${search}%,body.ilike.%${search}%`);
    }
    
    const { data: emails, count, error } = await query;
    
    if (error) throw error;
    
    // Get analytics
    const { data: analytics } = await db
      .from('email_communications')
      .select('sender, job_id')
      .order('date_sent', { ascending: false })
      .limit(1000);
    
    // Calculate sender frequency
    const senderFrequency = analytics?.reduce((acc: any, email) => {
      acc[email.sender] = (acc[email.sender] || 0) + 1;
      return acc;
    }, {});
    
    // Get top senders
    const topSenders = Object.entries(senderFrequency || {})
      .sort(([, a]: any, [, b]: any) => b - a)
      .slice(0, 10)
      .map(([sender, count]) => ({ sender, count }));
    
    // Get job-related emails count
    const jobRelatedCount = analytics?.filter(e => e.job_id).length || 0;
    
    return NextResponse.json({
      emails: emails || [],
      total: count || 0,
      analytics: {
        topSenders,
        jobRelatedCount,
        totalEmails: count || 0,
      },
      pagination: {
        limit,
        offset,
        hasMore: (offset + limit) < (count || 0),
      },
    });
  } catch (error) {
    console.error('Email activities error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch email activities' },
      { status: 500 }
    );
  }
}

/**
 * Process emails with AI to extract job opportunities
 */
export async function POST(req: NextRequest) {
  try {
    const { emailIds } = await req.json();
    
    if (!emailIds || !Array.isArray(emailIds)) {
      return NextResponse.json(
        { error: 'Invalid request. Provide emailIds array.' },
        { status: 400 }
      );
    }
    
    const db = getSupabase();
    
    // Get emails to process
    const { data: emails, error } = await db
      .from('email_communications')
      .select('*')
      .in('id', emailIds)
      .eq('is_processed', false);
    
    if (error) throw error;
    
    // TODO: Implement AI processing to extract job opportunities
    // For now, just mark as processed
    const { error: updateError } = await db
      .from('email_communications')
      .update({ is_processed: true })
      .in('id', emailIds);
    
    if (updateError) throw updateError;
    
    return NextResponse.json({
      success: true,
      processed: emails?.length || 0,
      message: 'Emails marked for processing',
    });
  } catch (error) {
    console.error('Email processing error:', error);
    return NextResponse.json(
      { error: 'Failed to process emails' },
      { status: 500 }
    );
  }
}