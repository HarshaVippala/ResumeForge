/**
 * Test script for Thread Manager functionality
 * Created: 2025-01-11
 */

import { createThreadManager } from './src/thread-manager';

// Test data
const testEmails = [
  {
    id: '1',
    threadId: 'thread123',
    subject: 'Software Engineer Position at TechCorp',
    sender: 'Jane Smith <jane.smith@techcorp.com>',
    recipients: ['harsha.vippala1@gmail.com'],
    receivedAt: new Date('2025-01-09T10:00:00Z'),
    bodyText: 'Hi Harsha, Thank you for applying to the Software Engineer position at TechCorp. We have received your application and will review it shortly.',
    snippet: 'Thank you for applying to the Software Engineer position'
  },
  {
    id: '2',
    threadId: 'thread123',
    subject: 'Re: Software Engineer Position at TechCorp',
    sender: 'harsha.vippala1@gmail.com',
    recipients: ['jane.smith@techcorp.com'],
    receivedAt: new Date('2025-01-09T14:00:00Z'),
    bodyText: 'Hi Jane, Thank you for confirming receipt of my application. I look forward to hearing from you.',
    snippet: 'Thank you for confirming receipt'
  },
  {
    id: '3',
    threadId: 'thread123',
    subject: 'Re: Software Engineer Position at TechCorp',
    sender: 'Jane Smith <jane.smith@techcorp.com>',
    recipients: ['harsha.vippala1@gmail.com'],
    receivedAt: new Date('2025-01-10T09:00:00Z'),
    bodyText: 'Hi Harsha, Great news! We would like to schedule a phone interview with you. Are you available next Tuesday at 2 PM PST? Please let me know your availability.',
    snippet: 'We would like to schedule a phone interview'
  }
];

async function testThreadManager() {
  console.log('Testing Thread Manager...\n');
  
  const threadManager = createThreadManager('harsha.vippala1@gmail.com');
  
  // Test 1: Process thread
  console.log('Test 1: Processing thread of emails');
  const threadSummary = await threadManager.processThread(testEmails);
  console.log('Thread Summary:', JSON.stringify(threadSummary, null, 2));
  
  // Test 2: Check if requires response
  console.log('\nTest 2: Checking if thread requires response');
  console.log('Requires Response:', threadSummary.requiresResponse);
  
  // Test 3: Extract thread highlights
  console.log('\nTest 3: Extracting thread highlights');
  const highlights = threadManager.extractThreadHighlights(testEmails);
  console.log('Thread Highlights:', JSON.stringify(highlights, null, 2));
  
  // Test 4: Check individual email thread context
  console.log('\nTest 4: Checking thread context for latest email');
  const gmailMessage = {
    id: '3',
    threadId: 'thread123',
    payload: {
      headers: [
        { name: 'Subject', value: 'Re: Software Engineer Position at TechCorp' },
        { name: 'In-Reply-To', value: '<message-id-2@mail.gmail.com>' },
        { name: 'References', value: '<message-id-1@mail.gmail.com> <message-id-2@mail.gmail.com>' }
      ]
    }
  };
  
  const threadContext = threadManager.extractThreadContext(gmailMessage);
  console.log('Thread Context:', JSON.stringify(threadContext, null, 2));
  
  // Test 5: Check job-related detection
  console.log('\nTest 5: Checking job-related detection');
  testEmails.forEach(email => {
    const isJobRelated = threadManager.isLikelyJobRelated(email);
    console.log(`Email ${email.id} - Job Related: ${isJobRelated}`);
  });
}

// Run tests
testThreadManager().catch(console.error);