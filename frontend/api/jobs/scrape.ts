import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

/**
 * Job Scraping API
 * POST /api/jobs/scrape - Trigger job scraping
 */
export async function POST() {
  try {
    // For now, return a mock response since scraping functionality
    // requires backend integration with Python scraper
    return NextResponse.json({
      message: 'Job scraping initiated',
      status: 'in_progress',
      estimatedTime: '2-3 minutes',
      note: 'Scraping functionality requires backend service integration'
    });
  } catch (error) {
    console.error('Scraping error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate job scraping' },
      { status: 500 }
    );
  }
}

// Only allow POST method
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST to trigger scraping.' },
    { status: 405 }
  );
}