import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_AI_API_KEY
    
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not found in environment' }, { status: 500 })
    }
    
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })
    
    const result = await model.generateContent("Say hello in JSON format with a 'message' field")
    const response = result.response.text()
    
    return NextResponse.json({
      success: true,
      apiKeyLength: apiKey.length,
      geminiResponse: response
    })
  } catch (error) {
    return NextResponse.json({
      error: 'Gemini test failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}