#!/usr/bin/env node

/**
 * Check email processing status
 * Run: node scripts/check-email-processing.js
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

async function checkEmailProcessing() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing required environment variables')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  try {
    // Get total email count
    const { count: totalEmails } = await supabase
      .from('emails')
      .select('*', { count: 'exact', head: true })
    
    // Get processed email count
    const { count: processedEmails } = await supabase
      .from('emails')
      .select('*', { count: 'exact', head: true })
      .eq('ai_processed', true)
    
    // Get unprocessed email count
    const { count: unprocessedEmails } = await supabase
      .from('emails')
      .select('*', { count: 'exact', head: true })
      .eq('ai_processed', false)
    
    // Get job-related email count
    const { count: jobRelatedEmails } = await supabase
      .from('emails')
      .select('*', { count: 'exact', head: true })
      .eq('is_job_related', true)
    
    console.log('\n📊 Email Processing Status:')
    console.log('━'.repeat(50))
    console.log(`📧 Total Emails: ${totalEmails || 0}`)
    console.log(`✅ Processed: ${processedEmails || 0}`)
    console.log(`⏳ Unprocessed: ${unprocessedEmails || 0}`)
    console.log(`💼 Job Related: ${jobRelatedEmails || 0}`)
    
    if (totalEmails && processedEmails) {
      const percentage = ((processedEmails / totalEmails) * 100).toFixed(1)
      console.log(`\n📈 Processing Progress: ${percentage}%`)
    }
    
    // Show recent unprocessed emails
    if (unprocessedEmails > 0) {
      const { data: recentUnprocessed } = await supabase
        .from('emails')
        .select('subject, sender, received_at')
        .eq('ai_processed', false)
        .order('received_at', { ascending: false })
        .limit(5)
      
      console.log('\n🆕 Recent Unprocessed Emails:')
      recentUnprocessed?.forEach((email, i) => {
        const date = new Date(email.received_at).toLocaleDateString()
        console.log(`${i + 1}. ${email.subject || 'No subject'} - ${email.sender} (${date})`)
      })
      
      console.log('\n💡 To process these emails, run:')
      console.log('   curl -X POST http://localhost:3000/api/email \\')
      console.log('     -H "Content-Type: application/json" \\')
      console.log('     -d \'{"action": "process", "processAll": true}\'')
    } else {
      console.log('\n✅ All emails have been processed!')
    }
    
    console.log('\n⚡ Using Gemini 2.5 Flash with Tier 1 limits')
    console.log('📈 Rate: 1,000 requests/minute')
    
  } catch (err) {
    console.error('❌ Error checking email processing:', err)
  }
}

checkEmailProcessing()