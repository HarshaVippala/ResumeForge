#!/usr/bin/env node

/**
 * Check database schema for email_communications table
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  console.log('🔍 Checking emails table schema...\n');

  try {
    // Get table columns using a select query with limit 0
    const { data, error } = await supabase
      .from('emails')
      .select('*')
      .limit(0);

    if (error) {
      console.error('❌ Error accessing table:', error.message);
      return;
    }

    // Get column information through a test insert (dry run)
    const testData = {
      gmail_id: 'test_' + Date.now(),
      thread_id: 'test_thread',
      subject: 'Test',
      sender: 'test@example.com',
      recipients: ['recipient@example.com'],
      received_at: new Date().toISOString(),
      labels: [],
      has_attachments: false,
      attachments: []
    };

    // Try to insert and catch the error to see what columns are missing
    const { error: insertError } = await supabase
      .from('emails')
      .insert(testData);

    if (insertError && insertError.message.includes('column')) {
      console.log('❌ Schema validation failed:', insertError.message);
      console.log('\n💡 The error indicates missing or mismatched columns.');
    } else if (insertError) {
      console.log('⚠️  Other error:', insertError.message);
    } else {
      console.log('✅ Basic schema appears correct!');
      
      // Clean up test data
      await supabase
        .from('emails')
        .delete()
        .eq('gmail_id', testData.gmail_id);
    }

    // Check for specific columns that were causing issues
    console.log('\n📋 Testing specific columns that were problematic:');
    
    const columnsToCheck = [
      'body_text',
      'body_html',
      'timestamp',
      'date', // This should NOT exist
      'snippet' // This should NOT exist
    ];

    for (const column of columnsToCheck) {
      const { error: colError } = await supabase
        .from('emails')
        .select(column)
        .limit(1);
      
      if (colError && colError.message.includes('column')) {
        console.log(`   ❌ ${column}: NOT FOUND`);
      } else {
        console.log(`   ✅ ${column}: EXISTS`);
      }
    }

    // Get actual email count
    const { count } = await supabase
      .from('emails')
      .select('*', { count: 'exact', head: true });

    console.log(`\n📊 Total emails in database: ${count || 0}`);

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkSchema().catch(console.error);