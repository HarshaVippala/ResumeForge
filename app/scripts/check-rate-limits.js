#!/usr/bin/env node

/**
 * Check current AI rate limit status
 * Run: node scripts/check-rate-limits.js
 */

async function checkRateLimits() {
  try {
    const response = await fetch('http://localhost:3000/api/email/rate-limit-status')
    const data = await response.json()
    
    console.log('\n📊 Rate Limit Status:')
    console.log('━'.repeat(50))
    
    if (data.models) {
      Object.entries(data.models).forEach(([model, info]) => {
        console.log(`\n🤖 ${model}:`)
        console.log(`   Requests: ${info.current}/${info.limit} per minute`)
        console.log(`   Daily: ${info.dailyCurrent}/${info.dailyLimit}`)
        console.log(`   Available: ${info.available ? '✅' : '❌'}`)
      })
    }
    
    if (data.queue) {
      console.log(`\n📋 Queue Status:`)
      console.log(`   Size: ${data.queue.size}`)
      console.log(`   Processing: ${data.queue.processing ? 'Yes' : 'No'}`)
    }
    
    console.log(`\n⚙️  Strategy: ${data.strategy || 'conservative'}`)
    console.log(`💡 ${data.message || ''}`)
    
  } catch (error) {
    console.error('❌ Error checking rate limits:', error.message)
    console.log('\n💡 Make sure your dev server is running on http://localhost:3000')
  }
}

checkRateLimits()