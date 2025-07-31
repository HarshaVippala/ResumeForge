import { NextResponse } from 'next/server'
import { getSupabase } from '@/api/_lib/db'

/**
 * Clear all dummy passkey entries to start fresh
 */
export async function POST() {
  try {
    // Check if we're in build phase and skip database operations
    if (process.env.NEXT_PHASE) {
      return NextResponse.json({ 
        error: 'Service unavailable during build' 
      }, { status: 503 })
    }
    
    const supabase = getSupabase()
    
    // Delete all existing credentials
    const { error: deleteError } = await supabase
      .from('user_credentials')
      .delete()
      .gt('created_at', '2000-01-01') // Delete all rows (using a date condition)
    
    if (deleteError) {
      console.error('Error clearing credentials:', deleteError)
      return NextResponse.json(
        { error: 'Failed to clear passkeys', details: deleteError.message },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ 
      success: true,
      message: 'All passkey entries cleared successfully'
    })
  } catch (error) {
    console.error('Clear passkeys error:', error)
    return NextResponse.json(
      { error: 'Failed to clear passkeys' },
      { status: 500 }
    )
  }
}