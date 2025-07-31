/**
 * Test Resume Matcher Implementation
 * Run: node scripts/test-resume-matcher.js
 */

require('dotenv').config({ path: '.env.local' });

async function testResumeMatcher() {
  const apiUrl = 'http://localhost:3000/api/resume-tailoring/complete';
  
  const testData = {
    company: "Google",
    role: "Senior Software Engineer",
    jobDescription: `
      We are looking for a Senior Software Engineer to join our team.
      
      Requirements:
      - 5+ years of experience in software development
      - Strong experience with React, Node.js, and TypeScript
      - Experience with cloud platforms (AWS, GCP)
      - Knowledge of microservices architecture
      - Experience with Docker and Kubernetes
      - Strong problem-solving skills
      - Excellent communication and leadership abilities
      
      Nice to have:
      - Experience with machine learning
      - Knowledge of Python
      - Experience with data pipelines
      - Open source contributions
    `
  };

  try {
    console.log('🚀 Testing Resume Matcher implementation...\n');
    console.log('Company:', testData.company);
    console.log('Role:', testData.role);
    console.log('Job Description:', testData.jobDescription.substring(0, 100) + '...\n');

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    const result = await response.json();
    
    console.log('✅ Resume tailoring successful!\n');
    
    // Display results
    console.log('📊 Scores:');
    console.log(`  - ATS Score: ${result.validation?.atsCompatibility || 'N/A'}%`);
    console.log(`  - Quality Score: ${result.validation?.qualityScore || 'N/A'}%`);
    console.log(`  - Keyword Coverage: ${result.insights?.keywordCoverage || 'N/A'}%`);
    console.log(`  - Match Score: ${result.insights?.estimatedMatchScore || 'N/A'}%`);
    
    console.log('\n🔄 Optimization Progress:');
    if (result.insights?.iterationDetails) {
      result.insights.iterationDetails.forEach(iter => {
        console.log(`  Iteration ${iter.iteration}: ${iter.score}% ${iter.improvement > 0 ? `(+${iter.improvement}%)` : ''}`);
        console.log(`    Focus: ${iter.feedback}`);
      });
    }
    
    console.log('\n🔑 Keywords:');
    console.log(`  - Integrated: ${result.optimizedResume?.keywordsIntegrated?.join(', ') || 'N/A'}`);
    
    console.log('\n💡 Recommendations:');
    if (result.validation?.recommendations) {
      result.validation.recommendations.forEach(rec => {
        console.log(`  - ${rec}`);
      });
    }
    
    console.log('\n📄 Resume ID:', result.resumeId || 'Not saved');
    
    // Save test result
    const fs = require('fs');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `test-results/resume-matcher-test-${timestamp}.json`;
    
    // Create directory if it doesn't exist
    if (!fs.existsSync('test-results')) {
      fs.mkdirSync('test-results');
    }
    
    fs.writeFileSync(filename, JSON.stringify(result, null, 2));
    console.log(`\n📁 Full results saved to: ${filename}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
  }
}

// Run the test
testResumeMatcher();