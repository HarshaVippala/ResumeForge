/**
 * Unit Tests for Cloud Run Email Processing Modules
 * Tests individual modules in isolation
 * 
 * Created: 2025-01-11
 */

import { threadManager } from '../src/thread-manager';
import { jobLinker } from '../src/job-linker';
import { enhancedLabelingEngine } from '../src/enhanced-labeling';

// Mock Supabase responses for testing
jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          order: () => ({ data: mockData[table] || [], error: null }),
          single: () => ({ data: mockData[table]?.[0] || null, error: null })
        }),
        ilike: () => ({
          order: () => ({ 
            limit: () => ({ data: mockData[table] || [], error: null })
          })
        }),
        or: () => ({
          order: () => ({
            limit: () => ({ data: mockData[table] || [], error: null })
          })
        }),
        not: () => ({
          order: () => ({
            limit: () => ({ data: mockData[table] || [], error: null })
          })
        }),
        gte: () => ({
          lte: () => ({
            order: () => ({ data: mockData[table] || [], error: null })
          })
        })
      }),
      update: () => ({
        eq: () => ({ data: null, error: null })
      })
    })
  })
}));

// Mock data
const mockData: any = {
  emails: [
    {
      id: '1',
      gmail_id: 'gmail_1',
      thread_id: 'thread_1',
      subject: 'Interview Invitation',
      sender: 'recruiter@company.com',
      recipients: ['user@example.com'],
      received_at: new Date().toISOString(),
      body_text: 'We would like to schedule an interview with you.',
      is_job_related: true,
      company: 'TechCorp',
      position: 'Software Engineer'
    },
    {
      id: '2',
      gmail_id: 'gmail_2',
      thread_id: 'thread_1',
      subject: 'Re: Interview Invitation',
      sender: 'user@example.com',
      recipients: ['recruiter@company.com'],
      received_at: new Date(Date.now() + 3600000).toISOString(),
      body_text: 'Thank you. I am available next week.',
      is_job_related: true
    }
  ],
  my_jobs: [
    {
      id: 'job_1',
      company: 'TechCorp',
      title: 'Software Engineer',
      url: 'https://techcorp.com/jobs/swe',
      created_at: new Date(Date.now() - 86400000).toISOString(),
      status: 'applied'
    }
  ]
};

describe('ThreadManager', () => {
  test('should identify email as part of thread', () => {
    const email = {
      payload: {
        headers: [
          { name: 'In-Reply-To', value: '<previous@example.com>' },
          { name: 'References', value: '<original@example.com>' }
        ]
      }
    };
    
    expect(threadManager.isPartOfThread(email)).toBe(true);
  });
  
  test('should identify email as not part of thread', () => {
    const email = {
      payload: {
        headers: [
          { name: 'Subject', value: 'New email' }
        ]
      }
    };
    
    expect(threadManager.isPartOfThread(email)).toBe(false);
  });
  
  test('should analyze thread correctly', async () => {
    const summary = await threadManager.analyzeThread('thread_1', 'gmail_2');
    
    expect(summary).toMatchObject({
      thread_id: 'thread_1',
      message_count: 2,
      participants: {
        internal: expect.arrayContaining([]),
        external: expect.arrayContaining(['recruiter@company.com', 'user@example.com'])
      },
      requires_action: false,
      last_sender_external: false,
      summary: expect.stringContaining('Software Engineer')
    });
  });
});

describe('JobLinker', () => {
  test('should link email to job by exact match', async () => {
    const emailData = {
      id: '1',
      company: 'TechCorp',
      position: 'Software Engineer',
      received_at: new Date().toISOString()
    };
    
    const result = await jobLinker.linkEmailToJob(emailData);
    
    expect(result).toMatchObject({
      jobId: 'job_1',
      confidence: expect.any(Number),
      strategy: 'exactCompanyPosition'
    });
    expect(result!.confidence).toBeGreaterThanOrEqual(0.75);
  });
  
  test('should not link email without matching job', async () => {
    const emailData = {
      id: '2',
      company: 'NonExistentCorp',
      position: 'Data Analyst',
      received_at: new Date().toISOString()
    };
    
    const result = await jobLinker.linkEmailToJob(emailData);
    
    expect(result).toBeNull();
  });
  
  test('should link by domain match', async () => {
    const emailData = {
      id: '3',
      sender_email: 'hr@techcorp.com',
      position: 'Software Engineer',
      received_at: new Date().toISOString()
    };
    
    mockData.my_jobs[0].url = 'https://techcorp.com/careers';
    
    const result = await jobLinker.linkEmailToJob(emailData);
    
    expect(result).toMatchObject({
      strategy: 'domainMatch'
    });
  });
});

describe('EnhancedLabelingEngine', () => {
  test('should generate labels for offer email', () => {
    const email = {
      subject: 'Job Offer - Software Engineer',
      bodyText: 'We are pleased to offer you the position. Please respond within 48 hours.',
      senderEmail: 'hr@company.com'
    };
    
    const classification = {
      category: 'offer',
      isJobRelated: true,
      confidence: 0.95,
      reasoning: 'Job offer detected'
    };
    
    const extracted = {
      company: 'TechCorp',
      position: 'Software Engineer',
      nextAction: 'Respond to offer'
    };
    
    const labels = enhancedLabelingEngine.generateLabels(email, classification, extracted);
    
    expect(labels).toMatchObject({
      labels: expect.arrayContaining(['offer_extended', 'response_required', 'urgent']),
      priority: 'critical',
      requiresAction: true,
      timeSensitive: true
    });
  });
  
  test('should generate labels for interview email', () => {
    const email = {
      subject: 'Interview Invitation',
      bodyText: 'We would like to schedule an interview. Please let us know your availability.',
      senderEmail: 'recruiter@company.com'
    };
    
    const classification = {
      category: 'interview_invitation',
      isJobRelated: true,
      confidence: 0.9,
      reasoning: 'Interview invitation'
    };
    
    const labels = enhancedLabelingEngine.generateLabels(email, classification, {});
    
    expect(labels).toMatchObject({
      labels: expect.arrayContaining(['interview_invitation', 'response_required', 'schedule_needed']),
      priority: 'high',
      requiresAction: true
    });
  });
  
  test('should generate labels for rejection email', () => {
    const email = {
      subject: 'Application Update',
      bodyText: 'Unfortunately, we have decided not to move forward with your application.',
      senderEmail: 'noreply@company.com'
    };
    
    const classification = {
      category: 'rejection',
      isJobRelated: true,
      confidence: 0.95,
      reasoning: 'Application rejected'
    };
    
    const labels = enhancedLabelingEngine.generateLabels(email, classification, {});
    
    expect(labels).toMatchObject({
      labels: expect.arrayContaining(['application_rejected', 'negative_news', 'automated']),
      priority: 'low',
      requiresAction: false,
      timeSensitive: false
    });
  });
  
  test('should handle non-job-related emails', () => {
    const email = {
      subject: 'Your Weekly Newsletter',
      bodyText: 'Check out the latest news and updates.',
      senderEmail: 'newsletter@company.com'
    };
    
    const classification = {
      category: 'not_job_related',
      isJobRelated: false,
      confidence: 0.99,
      reasoning: 'Newsletter'
    };
    
    const labels = enhancedLabelingEngine.generateLabels(email, classification, {});
    
    expect(labels).toMatchObject({
      labels: expect.arrayContaining(['not_job_related', 'automated']),
      priority: 'low',
      requiresAction: false
    });
  });
});

// Simple test runner for environments without Jest
if (typeof jest === 'undefined') {
  console.log('Running unit tests...\n');
  
  const tests = [
    // ThreadManager tests
    async () => {
      const email = {
        payload: {
          headers: [{ name: 'In-Reply-To', value: '<test@example.com>' }]
        }
      };
      const result = threadManager.isPartOfThread(email);
      console.log(`✓ ThreadManager identifies threaded email: ${result}`);
      return result === true;
    },
    
    // EnhancedLabelingEngine tests
    () => {
      const labels = enhancedLabelingEngine.generateLabels(
        { subject: 'Urgent Job Offer', bodyText: 'Congratulations!', senderEmail: 'hr@company.com' },
        { category: 'offer', isJobRelated: true, confidence: 0.95, reasoning: 'Offer' },
        {}
      );
      console.log(`✓ Generates critical priority for offers: ${labels.priority === 'critical'}`);
      return labels.priority === 'critical';
    },
    
    () => {
      const labels = enhancedLabelingEngine.generateLabels(
        { subject: 'Thanks', bodyText: 'Unfortunately...', senderEmail: 'noreply@company.com' },
        { category: 'rejection', isJobRelated: true, confidence: 0.9, reasoning: 'Rejection' },
        {}
      );
      console.log(`✓ Identifies automated emails: ${labels.labels.includes('automated')}`);
      return labels.labels.includes('automated');
    }
  ];
  
  Promise.all(tests.map(test => test()))
    .then(results => {
      const passed = results.filter(r => r).length;
      console.log(`\n${passed}/${tests.length} tests passed`);
    })
    .catch(console.error);
}