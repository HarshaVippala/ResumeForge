import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

/**
 * List available LLM providers
 */
export async function GET() {
  try {
    // Return currently configured provider
    const providers = [];

    // Gemini is the primary provider
    if (process.env.GOOGLE_AI_API_KEY) {
      providers.push({
        id: 'gemini',
        name: 'Google Gemini',
        models: ['gemini-1.5-pro', 'gemini-1.5-flash'],
        status: 'active',
        default: true
      });
    }

    return NextResponse.json({ providers });
  } catch (error) {
    console.error('LLM providers error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}