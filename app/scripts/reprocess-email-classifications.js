#!/usr/bin/env node

/**
 * Reprocess Email Classifications
 * Re-runs AI classification on existing emails with improved logic
 * Created: 2025-01-09
 */

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { emailProcessingService } from '../api/_lib/gmail/email-processor.js'

// Load environment variables
config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function reprocessEmails() {
  console.log('🔄 Reprocessing Email Classifications')
  console.log('=====================================\n')
  
  try {
    // Get emails that were previously classified as job-related but might be false positives
    const { data: suspiciousEmails, error: fetchError } = await supabase
      .from('emails')
      .select('id, subject, sender, is_job_related, email_type')
      .eq('is_job_related', true)
      .or(`sender.ilike.%noreply@google.com%,sender.ilike.%messages-noreply@linkedin.com%,subject.ilike.%security alert%,subject.ilike.%message digest%,subject.ilike.%password reset%`)
      .order('received_at', { ascending: false })
      .limit(100)
    
    if (fetchError) {
      console.error('Error fetching emails:', fetchError)
      return
    }
    
    console.log(`Found ${suspiciousEmails?.length || 0} potentially misclassified emails\n`)
    
    if (suspiciousEmails && suspiciousEmails.length > 0) {
      console.log('Sample of emails to reprocess:')
      suspiciousEmails.slice(0, 5).forEach(email => {
        console.log(`- "${email.subject}" from ${email.sender}`)
      })
      console.log('')
      
      // Ask for confirmation
      console.log('⚠️  This will reprocess these emails with the improved classification.')
      console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n')
      
      await new Promise(resolve => setTimeout(resolve, 5000))
      
      console.log('Starting reprocessing...\n')
      
      let reprocessed = 0
      let reclassified = 0
      
      for (const email of suspiciousEmails) {
        try {
          console.log(`Processing: "${email.subject}"`)
          
          // Reprocess with new classification logic
          const result = await emailProcessingService.processEmail(email.id)
          
          if (result.success) {
            reprocessed++
            if (!result.classification?.isJobRelated && email.is_job_related) {
              reclassified++
              console.log(`  ✅ Reclassified as NOT job-related`)
            } else if (result.classification?.isJobRelated) {
              console.log(`  ℹ️  Still classified as job-related`)
            }
          } else {
            console.log(`  ❌ Failed: ${result.error}`)
          }
          
          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 100))
          
        } catch (error) {
          console.error(`  ❌ Error processing ${email.id}:`, error.message)
        }
      }
      
      console.log('\n📊 Reprocessing Complete')
      console.log('========================')
      console.log(`Total emails checked: ${suspiciousEmails.length}`)
      console.log(`Successfully reprocessed: ${reprocessed}`)
      console.log(`Reclassified as non-job: ${reclassified}`)
      
    } else {
      console.log('✅ No suspicious emails found. Classification appears to be working correctly.')
    }
    
    // Now check for any remaining non-job emails marked as job-related
    console.log('\n🔍 Checking for remaining issues...\n')
    
    const { data: remainingIssues, error: checkError } = await supabase
      .from('emails')
      .select('id, subject, sender')
      .eq('is_job_related', true)
      .or(`sender.ilike.%security%,sender.ilike.%notification%,subject.ilike.%digest%,subject.ilike.%newsletter%`)
      .limit(10)
    
    if (remainingIssues && remainingIssues.length > 0) {
      console.log('⚠️  Found potential remaining issues:')
      remainingIssues.forEach(email => {
        console.log(`- "${email.subject}" from ${email.sender}`)
      })
      console.log('\nConsider running this script again or manually reviewing these emails.')
    } else {
      console.log('✅ No remaining classification issues detected!')
    }
    
  } catch (error) {
    console.error('❌ Script error:', error)
    process.exit(1)
  }
}

// Run the reprocessing
reprocessEmails().catch(console.error)