/**
 * Simple API test script
 * Run with: node test-api.js
 */

const API_URL = process.env.API_URL || 'http://localhost:3000';

async function testEndpoint(name, endpoint, options = {}) {
  console.log(`\n🧪 Testing ${name}...`);
  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log(`✅ ${name}: SUCCESS`);
      console.log('Response:', JSON.stringify(data, null, 2).substring(0, 200) + '...');
    } else {
      console.log(`❌ ${name}: FAILED (${response.status})`);
      console.log('Error:', data);
    }
    
    return { success: response.ok, data };
  } catch (error) {
    console.log(`❌ ${name}: ERROR`);
    console.log('Error:', error.message);
    return { success: false, error };
  }
}

async function runTests() {
  console.log('🚀 Testing TypeScript API Endpoints');
  console.log(`📍 API URL: ${API_URL}`);
  
  // Test 1: Health Check
  await testEndpoint('Health Check', '/api/health');
  
  // Test 2: Analyze Job
  await testEndpoint('Analyze Job', '/api/analyze-job', {
    method: 'POST',
    body: JSON.stringify({
      company: 'Test Company',
      role: 'Software Engineer',
      jobDescription: 'We are looking for a software engineer with experience in React, Node.js, and TypeScript. The ideal candidate will have 3+ years of experience building web applications.'
    })
  });
  
  // Test 3: Parse LinkedIn Job
  await testEndpoint('Parse LinkedIn Job', '/api/parse-linkedin-job', {
    method: 'POST',
    body: JSON.stringify({
      jobUrl: 'https://www.linkedin.com/jobs/view/123456789'
    })
  });
  
  // Test 4: Tailor Resume Complete
  await testEndpoint('Tailor Resume Complete', '/api/tailor-resume-complete', {
    method: 'POST',
    body: JSON.stringify({
      company: 'Test Company',
      role: 'Software Engineer',
      jobDescription: 'We are looking for a software engineer with experience in React, Node.js, and TypeScript.'
    })
  });
  
  console.log('\n✨ Tests completed!');
}

// Run tests
runTests().catch(console.error);