import { NextRequest, NextResponse } from 'next/server'

/**
 * Get available LLM providers
 * Last modified: 2025-07-09
 */

export async function GET(request: NextRequest) {
  // Check which providers are configured
  const hasGeminiKey = !!(process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_AI_API_KEY)
  
  const providers = [
    {
      name: 'gemini',
      display_name: 'Google Gemini',
      available: hasGeminiKey,
      requires_api_key: !hasGeminiKey,
      model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
      description: 'Google\'s multimodal AI model for text and image understanding'
    }
  ]
  
  return NextResponse.json({
    success: true,
    providers,
    current_provider: hasGeminiKey ? 'gemini' : 'none',
    message: hasGeminiKey ? 'AI providers loaded successfully' : 'No AI providers configured. Please set GOOGLE_GENERATIVE_AI_API_KEY.',
    total_providers: providers.length,
    available_providers: providers.filter(p => p.available).length
  })
}