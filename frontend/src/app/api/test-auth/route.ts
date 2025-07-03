import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  console.log('🧪 TEST ENDPOINT CALLED')
  
  return new NextResponse('✅ TEST ENDPOINT WORKS - API routes are functioning!', {
    status: 200,
    headers: { 'Content-Type': 'text/plain' }
  })
} 