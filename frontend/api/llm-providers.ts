import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

/**
 * List available LLM providers
 */
export async function GET() {
  try {
    // Return currently configured provider
    const providers = [
      {
        id: 'openai',
        name: 'OpenAI',
        models: ['gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'],
        status: 'active',
        default: process.env.DEFAULT_LLM_PROVIDER === 'openai'
      }
    ];

    // Add Gemini if configured
    if (process.env.GEMINI_API_KEY) {
      providers.push({
        id: 'gemini',
        name: 'Google Gemini',
        models: ['gemini-1.5-pro', 'gemini-1.5-flash'],
        status: 'active',
        default: process.env.DEFAULT_LLM_PROVIDER === 'gemini'
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