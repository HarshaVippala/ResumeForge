/**
 * Integration Test for Cloud Run Email Processing
 * Tests all implemented features:
 * - Thread management
 * - Job linking
 * - Enhanced labeling
 * - Manual sync endpoints
 * - Database field alignment
 * 
 * Created: 2025-01-11
 */

import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_KEY || '';
const API_URL = process.env.EMAIL_PROCESSOR_URL || 'http://localhost:8080';
const API_KEY = process.env.MANUAL_SYNC_API_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Test data
const testEmails = [
  {
    gmail_id: 'test_thread_1',
    thread_id: 'thread_001',
    subject: 'Thank you for applying to Software Engineer at Acme Corp',
    sender: 'recruiter@acme.com',
    sender_email: 'recruiter@acme.com',
    sender_name: 'Jane Smith',
    recipients: ['harsha.vippala1@gmail.com'],
    body_text: 'Dear Harsha, Thank you for applying to the Software Engineer position at Acme Corp. We have received your application and will review it shortly. Best regards, Jane Smith',
    received_at: new Date().toISOString(),
    processed: false
  },
  {
    gmail_id: 'test_thread_2',
    thread_id: 'thread_001',
    subject: 'Re: Thank you for applying to Software Engineer at Acme Corp',
    sender: 'harsha.vippala1@gmail.com',
    sender_email: 'harsha.vippala1@gmail.com',
    sender_name: 'Harsha Vippala',
    recipients: ['recruiter@acme.com'],
    body_text: 'Hi Jane, Thank you for the confirmation. I look forward to hearing from you. Best, Harsha',
    received_at: new Date(Date.now() + 3600000).toISOString(),
    processed: false
  },
  {
    gmail_id: 'test_thread_3',
    thread_id: 'thread_001',
    subject: 'Re: Thank you for applying to Software Engineer at Acme Corp',
    sender: 'recruiter@acme.com',
    sender_email: 'recruiter@acme.com',
    sender_name: 'Jane Smith',
    recipients: ['harsha.vippala1@gmail.com'],
    body_text: 'Hi Harsha, Great news! We would like to schedule an interview with you. Are you available next Tuesday at 2 PM PST? Please let me know your availability. Best, Jane',
    received_at: new Date(Date.now() + 7200000).toISOString(),
    processed: false
  },
  {
    gmail_id: 'test_job_link_1',
    thread_id: 'thread_002',
    subject: 'Interview Confirmation - Data Scientist at TechCo',
    sender: 'hr@techco.com',
    sender_email: 'hr@techco.com',
    sender_name: 'HR Team',
    recipients: ['harsha.vippala1@gmail.com'],
    body_text: 'Your interview for the Data Scientist position is scheduled for Wednesday, January 17th at 3 PM EST. Please confirm your attendance.',
    received_at: new Date().toISOString(),
    processed: false
  },
  {
    gmail_id: 'test_labels_1',
    thread_id: 'thread_003',
    subject: 'Urgent: Job Offer - Senior Developer at StartupXYZ',
    sender: 'ceo@startupxyz.com',
    sender_email: 'ceo@startupxyz.com',
    sender_name: 'John Doe',
    recipients: ['harsha.vippala1@gmail.com'],
    body_text: 'Congratulations! We are pleased to offer you the Senior Developer position. This offer expires in 48 hours. Please respond ASAP with your decision.',
    received_at: new Date().toISOString(),
    processed: false
  }
];

// Test job for linking
const testJob = {
  company: 'TechCo',
  title: 'Data Scientist',
  url: 'https://techco.com/careers/data-scientist',
  status: 'applied',
  created_at: new Date(Date.now() - 86400000).toISOString() // Yesterday
};

async function setupTestData() {
  console.log('Setting up test data...\n');
  
  // Insert test job
  const { data: job, error: jobError } = await supabase
    .from('my_jobs')
    .insert(testJob)
    .select()
    .single();
    
  if (jobError) {
    console.error('Failed to insert test job:', jobError);
    return false;
  }
  
  console.log(`✓ Created test job: ${job.company} - ${job.title} (ID: ${job.id})\n`);
  
  // Insert test emails
  for (const email of testEmails) {
    const { error } = await supabase
      .from('emails')
      .insert(email);
      
    if (error) {
      console.error(`Failed to insert email ${email.gmail_id}:`, error);
      return false;
    }
  }
  
  console.log(`✓ Created ${testEmails.length} test emails\n`);
  return true;
}

async function testFeature(name: string, testFn: () => Promise<boolean>) {
  console.log(`Testing ${name}...`);
  try {
    const success = await testFn();
    console.log(success ? `✅ ${name} test passed\n` : `❌ ${name} test failed\n`);
    return success;
  } catch (error) {
    console.error(`❌ ${name} test error:`, error);
    console.log('');
    return false;
  }
}

async function testThreadManagement() {
  // Process thread emails
  const response = await fetch(`${API_URL}/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY
    },
    body: JSON.stringify({
      emailIds: ['test_thread_1', 'test_thread_2', 'test_thread_3']
    })
  });
  
  if (!response.ok) {
    console.error('Sync request failed:', await response.text());
    return false;
  }
  
  // Wait for processing
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Check results
  const { data: emails } = await supabase
    .from('emails')
    .select('*')
    .in('gmail_id', ['test_thread_1', 'test_thread_2', 'test_thread_3'])
    .order('received_at');
    
  if (!emails || emails.length !== 3) {
    console.error('Failed to fetch processed emails');
    return false;
  }
  
  // Verify thread fields
  const lastEmail = emails[2];
  console.log('Thread summary:', lastEmail.thread_summary);
  console.log('Thread position:', lastEmail.thread_position);
  console.log('Requires action:', lastEmail.requires_action);
  
  return !!(lastEmail.thread_summary && lastEmail.thread_position === 3 && lastEmail.requires_action);
}

async function testJobLinking() {
  // Process email that should link to job
  const response = await fetch(`${API_URL}/process-batch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY
    },
    body: JSON.stringify({
      emailIds: ['test_job_link_1']
    })
  });
  
  if (!response.ok) {
    console.error('Batch process request failed:', await response.text());
    return false;
  }
  
  // Wait for processing
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Check result
  const { data: email } = await supabase
    .from('emails')
    .select('*, my_jobs!inner(company, title)')
    .eq('gmail_id', 'test_job_link_1')
    .single();
    
  if (!email) {
    console.error('Failed to fetch processed email');
    return false;
  }
  
  console.log('Linked job:', email.my_jobs);
  console.log('Job link confidence:', email.extracted_details?.job_link_confidence);
  console.log('Job link strategy:', email.extracted_details?.job_link_strategy);
  
  return !!(email.job_id && email.my_jobs?.company === 'TechCo');
}

async function testEnhancedLabeling() {
  // Process urgent offer email
  const response = await fetch(`${API_URL}/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY
    },
    body: JSON.stringify({
      emailIds: ['test_labels_1']
    })
  });
  
  if (!response.ok) {
    console.error('Sync request failed:', await response.text());
    return false;
  }
  
  // Wait for processing
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Check result
  const { data: email } = await supabase
    .from('emails')
    .select('*')
    .eq('gmail_id', 'test_labels_1')
    .single();
    
  if (!email) {
    console.error('Failed to fetch processed email');
    return false;
  }
  
  console.log('Labels:', email.labels);
  console.log('Priority:', email.extracted_details?.priority);
  console.log('Time sensitive:', email.extracted_details?.timeSensitive);
  console.log('Requires action:', email.requires_action);
  
  return !!(
    email.labels?.includes('offer_extended') &&
    email.labels?.includes('urgent') &&
    email.extracted_details?.priority === 'critical' &&
    email.extracted_details?.timeSensitive === true
  );
}

async function testManualSyncEndpoints() {
  // Test sync all unprocessed
  const response1 = await fetch(`${API_URL}/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY
    },
    body: JSON.stringify({
      syncAll: true,
      limit: 2
    })
  });
  
  const result1 = await response1.json();
  console.log('Sync all result:', result1);
  
  // Test status check
  const response2 = await fetch(`${API_URL}/status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY
    },
    body: JSON.stringify({
      emailIds: testEmails.map(e => e.gmail_id)
    })
  });
  
  const result2 = await response2.json();
  console.log('Status check result:', result2);
  
  return response1.ok && response2.ok;
}

async function testDatabaseFields() {
  // Get a processed email and verify all fields
  const { data: email } = await supabase
    .from('emails')
    .select('*')
    .eq('gmail_id', 'test_labels_1')
    .single();
    
  if (!email) {
    console.error('Failed to fetch email for field verification');
    return false;
  }
  
  const requiredFields = [
    'is_job_related',
    'email_type',
    'job_confidence',
    'classification_confidence',
    'company',
    'position',
    'sender_name',
    'sender_email',
    'summary',
    'preview',
    'thread_summary',
    'thread_position',
    'is_thread_root',
    'ai_processed',
    'processing_version',
    'requires_action',
    'labels',
    'action_items',
    'extracted_events',
    'extracted_details'
  ];
  
  const missingFields = requiredFields.filter(field => !(field in email));
  
  if (missingFields.length > 0) {
    console.error('Missing fields:', missingFields);
    return false;
  }
  
  console.log('All required fields present ✓');
  console.log('Sample extracted_details:', JSON.stringify(email.extracted_details, null, 2));
  
  return true;
}

async function cleanup() {
  console.log('\nCleaning up test data...');
  
  // Delete test emails
  await supabase
    .from('emails')
    .delete()
    .in('gmail_id', testEmails.map(e => e.gmail_id));
    
  // Delete test job
  await supabase
    .from('my_jobs')
    .delete()
    .eq('company', 'TechCo')
    .eq('title', 'Data Scientist');
    
  console.log('✓ Cleanup complete\n');
}

async function runIntegrationTests() {
  console.log('=== Cloud Run Email Processing Integration Tests ===\n');
  
  const setupSuccess = await setupTestData();
  if (!setupSuccess) {
    console.error('Failed to setup test data');
    return;
  }
  
  const tests = [
    { name: 'Thread Management', fn: testThreadManagement },
    { name: 'Job Linking', fn: testJobLinking },
    { name: 'Enhanced Labeling', fn: testEnhancedLabeling },
    { name: 'Manual Sync Endpoints', fn: testManualSyncEndpoints },
    { name: 'Database Fields', fn: testDatabaseFields }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    const success = await testFeature(test.name, test.fn);
    if (success) passed++;
    else failed++;
  }
  
  console.log('\n=== Test Summary ===');
  console.log(`Total: ${tests.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Success Rate: ${Math.round(passed / tests.length * 100)}%`);
  
  await cleanup();
}

// Run tests
runIntegrationTests().catch(console.error);