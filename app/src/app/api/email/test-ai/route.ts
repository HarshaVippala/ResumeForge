import { NextRequest, NextResponse } from 'next/server'
import { aiEmailProcessor } from '@/api/_lib/gmail/ai-processor'
import type { ProcessedEmail } from '@/api/_lib/gmail/types'

/**
 * Test AI Email Processing
 * POST /api/email/test-ai - Test the AI processor with sample emails
 */

// Sample test emails
const testEmails: Partial<ProcessedEmail>[] = [
  {
    id: 'test-1',
    subject: 'Interview Invitation - Senior Software Engineer at Google',
    bodyText: `Dear Harsha,

Thank you for your interest in the Senior Software Engineer position at Google. We were impressed with your background and would like to invite you for a technical interview.

The interview is scheduled for:
Date: January 15, 2025
Time: 2:00 PM PST
Duration: 60 minutes
Format: Virtual (Google Meet link will be sent separately)

The interview will consist of:
- Technical discussion (30 minutes)
- Coding exercise (25 minutes)
- Q&A session (5 minutes)

Please confirm your availability by replying to this email. If this time doesn't work, please suggest alternative times.

Best regards,
Sarah Johnson
Technical Recruiter
Google Recruitment Team
sarah.johnson@google.com
(650) 555-1234`,
    senderEmail: 'sarah.johnson@google.com',
    senderName: 'Sarah Johnson',
    receivedAt: new Date('2025-01-07T10:30:00'),
  },
  {
    id: 'test-2',
    subject: 'Application Received - Product Manager Role',
    bodyText: `Dear Applicant,

Thank you for applying to the Product Manager position at Meta. We have received your application and our recruitment team is currently reviewing it.

Application ID: META-PM-2025-00847
Position: Product Manager - AI/ML Products
Location: Menlo Park, CA

You can track your application status at: careers.meta.com/status

We will contact you within 2-3 weeks if your profile matches our requirements.

Best regards,
Meta Careers Team`,
    senderEmail: 'careers@metacareers.com',
    senderName: 'Meta Careers',
    receivedAt: new Date('2025-01-06T14:20:00'),
  },
  {
    id: 'test-3',
    subject: 'Congratulations! Job Offer from Amazon',
    bodyText: `Dear Harsha,

We are pleased to extend an offer for the position of Senior Software Development Engineer at Amazon Web Services.

Offer Details:
- Position: Senior SDE (L6)
- Team: AWS Lambda
- Location: Seattle, WA
- Base Salary: $250,000
- Signing Bonus: $100,000
- Stock Grant: $400,000 over 4 years
- Start Date: February 1, 2025

This offer is contingent upon successful completion of background checks. Please review the attached offer letter and respond by January 15, 2025.

We're excited about the possibility of you joining our team!

Best regards,
Michael Chen
Hiring Manager, AWS
michael.chen@amazon.com`,
    senderEmail: 'michael.chen@amazon.com',
    senderName: 'Michael Chen',
    receivedAt: new Date('2025-01-07T16:45:00'),
  },
  {
    id: 'test-4',
    subject: 'Re: Following up on our conversation',
    bodyText: `Hi there,

Just wanted to follow up on our chat at the tech conference last week. As mentioned, we're looking for talented engineers to join our startup.

Let me know if you'd be interested in grabbing coffee sometime to discuss potential opportunities.

Cheers,
Alex`,
    senderEmail: 'alex@randomstartup.com',
    senderName: 'Alex',
    receivedAt: new Date('2025-01-05T09:15:00'),
  }
]

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { testSingle = false, emailIndex = 0 } = body
    
    if (testSingle) {
      // Test single email processing
      const email = testEmails[emailIndex] || testEmails[0]
      const result = await aiEmailProcessor.processEmail(email as ProcessedEmail)
      
      return NextResponse.json({
        success: true,
        email: {
          subject: email.subject,
          from: email.senderEmail
        },
        result,
        tokenUsage: await aiEmailProcessor.getTokenUsage()
      })
    } else {
      // Test batch processing
      const results = await aiEmailProcessor.processBatch(testEmails as ProcessedEmail[])
      
      // Summarize results
      const summary = {
        total: results.length,
        jobRelated: results.filter(r => r.classification.isJobRelated).length,
        categories: results.reduce((acc, r) => {
          const category = r.classification.category
          acc[category] = (acc[category] || 0) + 1
          return acc
        }, {} as Record<string, number>),
        companies: results
          .map(r => r.extraction?.company)
          .filter(Boolean)
          .filter((v, i, a) => a.indexOf(v) === i),
        urgentEmails: results.filter(r => r.urgency === 'critical' || r.urgency === 'high')
      }
      
      return NextResponse.json({
        success: true,
        summary,
        results,
        tokenUsage: await aiEmailProcessor.getTokenUsage()
      })
    }
  } catch (error) {
    console.error('Test AI processing error:', error)
    return NextResponse.json({
      error: 'Failed to test AI processing',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'AI Email Processing Test Endpoint',
    usage: {
      method: 'POST',
      body: {
        testSingle: 'boolean - Test single email (default: false)',
        emailIndex: 'number - Index of test email to use (0-3, default: 0)'
      },
      examples: [
        {
          description: 'Test batch processing',
          body: {}
        },
        {
          description: 'Test single email (interview invitation)',
          body: { testSingle: true, emailIndex: 0 }
        },
        {
          description: 'Test single email (job offer)',
          body: { testSingle: true, emailIndex: 2 }
        }
      ]
    },
    testEmails: testEmails.map((e, i) => ({
      index: i,
      subject: e.subject,
      from: e.senderEmail
    }))
  })
}