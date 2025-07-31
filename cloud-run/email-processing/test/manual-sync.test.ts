// Manual Sync Endpoint Tests
// Modified: 2025-01-11

import fetch from 'node-fetch';

const API_URL = process.env.EMAIL_PROCESSOR_URL || 'http://localhost:8080';
const API_KEY = process.env.MANUAL_SYNC_API_KEY || '';

// Helper function to make requests
async function makeRequest(endpoint: string, body: any, apiKey?: string) {
  const headers: any = {
    'Content-Type': 'application/json',
  };
  
  if (apiKey) {
    headers['x-api-key'] = apiKey;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  const data = await response.json();
  return { status: response.status, data };
}

// Test cases
async function runTests() {
  console.log('Running Email Processor Manual Sync Tests...\n');

  // Test 1: Health check
  console.log('1. Testing health endpoint...');
  try {
    const response = await fetch(`${API_URL}/health`);
    console.log(`   ✓ Health check: ${response.status} - ${await response.text()}\n`);
  } catch (error) {
    console.log(`   ✗ Health check failed: ${error}\n`);
  }

  // Test 2: Sync specific emails
  console.log('2. Testing sync with specific email IDs...');
  try {
    const result = await makeRequest('/sync', {
      emailIds: ['test_email_1', 'test_email_2'],
      userEmail: 'test@example.com'
    }, API_KEY);
    console.log(`   ✓ Status: ${result.status}`);
    console.log(`   Response: ${JSON.stringify(result.data, null, 2)}\n`);
  } catch (error) {
    console.log(`   ✗ Sync failed: ${error}\n`);
  }

  // Test 3: Sync all unprocessed emails
  console.log('3. Testing sync all unprocessed emails...');
  try {
    const result = await makeRequest('/sync', {
      syncAll: true,
      limit: 5
    }, API_KEY);
    console.log(`   ✓ Status: ${result.status}`);
    console.log(`   Response: ${JSON.stringify(result.data, null, 2)}\n`);
  } catch (error) {
    console.log(`   ✗ Sync all failed: ${error}\n`);
  }

  // Test 4: Batch processing
  console.log('4. Testing batch processing...');
  try {
    const result = await makeRequest('/process-batch', {
      emailIds: ['batch_test_1', 'batch_test_2', 'batch_test_3']
    }, API_KEY);
    console.log(`   ✓ Status: ${result.status}`);
    console.log(`   Response: ${JSON.stringify(result.data, null, 2)}\n`);
  } catch (error) {
    console.log(`   ✗ Batch processing failed: ${error}\n`);
  }

  // Test 5: Status check
  console.log('5. Testing status check...');
  try {
    const result = await makeRequest('/status', {
      emailIds: ['status_test_1', 'status_test_2']
    }, API_KEY);
    console.log(`   ✓ Status: ${result.status}`);
    console.log(`   Response: ${JSON.stringify(result.data, null, 2)}\n`);
  } catch (error) {
    console.log(`   ✗ Status check failed: ${error}\n`);
  }

  // Test 6: Rate limiting
  console.log('6. Testing rate limiting...');
  try {
    const promises = [];
    for (let i = 0; i < 7; i++) {
      promises.push(makeRequest('/sync', { syncAll: true, limit: 1 }, API_KEY));
    }
    const results = await Promise.all(promises);
    const rateLimited = results.filter(r => r.status === 429);
    console.log(`   ✓ Rate limiting active: ${rateLimited.length} requests blocked\n`);
  } catch (error) {
    console.log(`   ✗ Rate limit test failed: ${error}\n`);
  }

  // Test 7: Invalid request
  console.log('7. Testing invalid request handling...');
  try {
    const result = await makeRequest('/sync', {}, API_KEY);
    console.log(`   ✓ Status: ${result.status}`);
    console.log(`   Response: ${JSON.stringify(result.data, null, 2)}\n`);
  } catch (error) {
    console.log(`   ✗ Invalid request test failed: ${error}\n`);
  }
}

// Run tests
runTests().catch(console.error);