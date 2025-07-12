/**
 * Conversation Analysis Service
 * Analyzes email threads for sentiment, stage, and status progression
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import type {
  ThreadSentiment,
  ConversationStage,
  ApplicationStatus,
  StatusProgression
} from './types'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!)
const model = genAI.getGenerativeModel({ 
  model: process.env.GEMINI_MODEL || 'gemini-2.0-flash'
})

interface ConversationAnalysis {
  summary: string
  sentiment: ThreadSentiment
  stage: ConversationStage
  applicationStatus?: ApplicationStatus
  requiresResponse: boolean
  nextSteps?: string[]
  confidence: number
}

export class ConversationAnalyzer {
  /**
   * Analyze a conversation thread
   */
  async analyzeConversation(
    emails: Array<{
      sender: string
      subject: string
      body: string
      date: Date
      isFromUser: boolean
    }>
  ): Promise<ConversationAnalysis> {
    if (emails.length === 0) {
      return {
        summary: 'No emails in thread',
        sentiment: 'neutral',
        stage: 'initial',
        requiresResponse: false,
        confidence: 0
      }
    }

    try {
      const prompt = this.buildAnalysisPrompt(emails)
      const result = await model.generateContent(prompt)
      const response = await result.response
      const text = response.text()

      return this.parseAnalysisResponse(text)
    } catch (error) {
      console.error('Conversation analysis failed:', error)
      
      // Fallback to rule-based analysis
      return this.performRuleBasedAnalysis(emails)
    }
  }

  /**
   * Build AI prompt for conversation analysis
   */
  private buildAnalysisPrompt(emails: any[]): string {
    const conversationFlow = emails
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map(email => `
[${email.date.toLocaleDateString()}] ${email.isFromUser ? 'Me' : email.sender}:
Subject: ${email.subject}
${email.body.slice(0, 500)}${email.body.length > 500 ? '...' : ''}
`).join('\n---\n')

    return `You are an expert conversation analyzer. Analyze this job-related email thread and provide structured analysis.

CONVERSATION:
${conversationFlow}

IMPORTANT INSTRUCTIONS:
1. Return ONLY valid JSON with no extra text
2. Use double quotes for all strings
3. Boolean values must be lowercase (true/false)
4. Confidence must be a number between 0.0 and 1.0
5. Use exact values specified below

EXPECTED JSON STRUCTURE:
{
  "summary": "A VERY BRIEF 1-2 sentence summary. Focus on the key action/status only (e.g., 'Interview scheduled for Tuesday', 'Application received for Software Engineer role', 'Rejected after final round'). Maximum 15 words.",
  "sentiment": "positive|neutral|negative",
  "stage": "initial|ongoing|closing",
  "applicationStatus": "inquiry|applied|screening|interview|offer|rejected|withdrawn",
  "requiresResponse": true|false,
  "nextSteps": ["List of recommended next actions"],
  "confidence": 0.0-1.0
}

FIELD DEFINITIONS:
- summary: Brief overview of the conversation's purpose and outcome
- sentiment: Overall tone (positive=good progress, neutral=factual, negative=rejection/problems)
- stage: Conversation phase (initial=first contact, ongoing=active discussion, closing=decision made)
- applicationStatus: Current hiring process status
- requiresResponse: True if the last email expects a reply from the user
- nextSteps: 1-3 specific actionable recommendations
- confidence: Your confidence in this analysis (0.0-1.0)

ANALYSIS GUIDELINES:
- Focus on the most recent messages for current status
- Consider the overall trajectory of the conversation
- Look for explicit requests for action or response
- Infer status from context clues and keywords

YOUR RESPONSE (JSON only):`
  }

  /**
   * Parse AI response
   */
  private parseAnalysisResponse(text: string): ConversationAnalysis {
    try {
      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No JSON found in response')

      const parsed = JSON.parse(jsonMatch[0])
      
      // Validate and normalize
      return {
        summary: parsed.summary || '',
        sentiment: this.validateSentiment(parsed.sentiment),
        stage: this.validateStage(parsed.stage),
        applicationStatus: parsed.applicationStatus,
        requiresResponse: Boolean(parsed.requiresResponse),
        nextSteps: Array.isArray(parsed.nextSteps) ? parsed.nextSteps : [],
        confidence: Math.min(1, Math.max(0, parsed.confidence || 0.5))
      }
    } catch (error) {
      console.error('Failed to parse analysis response:', error)
      throw error
    }
  }

  /**
   * Validate sentiment value
   */
  private validateSentiment(value: any): ThreadSentiment {
    const valid: ThreadSentiment[] = ['positive', 'neutral', 'negative']
    return valid.includes(value) ? value : 'neutral'
  }

  /**
   * Validate conversation stage
   */
  private validateStage(value: any): ConversationStage {
    const valid: ConversationStage[] = ['initial', 'ongoing', 'closing']
    return valid.includes(value) ? value : 'initial'
  }

  /**
   * Fallback rule-based analysis
   */
  private performRuleBasedAnalysis(emails: any[]): ConversationAnalysis {
    const lastEmail = emails[emails.length - 1]
    const emailCount = emails.length
    const userEmailCount = emails.filter(e => e.isFromUser).length
    
    // Determine sentiment based on keywords
    let sentiment: ThreadSentiment = 'neutral'
    const allBodies = emails.map(e => e.body.toLowerCase()).join(' ')
    
    const positiveKeywords = [
      'congratulations', 'pleased', 'excited', 'looking forward',
      'welcome', 'great fit', 'impressed', 'offer'
    ]
    const negativeKeywords = [
      'unfortunately', 'regret', 'not selected', 'decided to',
      'other candidates', 'not moving forward'
    ]
    
    const positiveCount = positiveKeywords.filter(k => allBodies.includes(k)).length
    const negativeCount = negativeKeywords.filter(k => allBodies.includes(k)).length
    
    if (positiveCount > negativeCount) sentiment = 'positive'
    else if (negativeCount > positiveCount) sentiment = 'negative'
    
    // Determine stage
    let stage: ConversationStage = 'initial'
    if (emailCount === 1) stage = 'initial'
    else if (emailCount > 1 && emailCount <= 3) stage = 'ongoing'
    else if (emailCount > 3 || allBodies.includes('final') || allBodies.includes('decision')) {
      stage = 'closing'
    }
    
    // Check if response required
    const requiresResponse = !lastEmail.isFromUser && (
      lastEmail.body.includes('?') ||
      lastEmail.body.toLowerCase().includes('please') ||
      lastEmail.body.toLowerCase().includes('let me know')
    )
    
    return {
      summary: `Conversation with ${emailCount} emails. Last message from ${lastEmail.isFromUser ? 'user' : 'company'}.`,
      sentiment,
      stage,
      requiresResponse,
      confidence: 0.5
    }
  }

  /**
   * Detect status progression in thread
   */
  async detectStatusProgression(
    emails: Array<{
      date: Date
      body: string
      subject: string
    }>
  ): Promise<StatusProgression[]> {
    const progressions: StatusProgression[] = []
    
    // Sort emails chronologically
    const sortedEmails = [...emails].sort((a, b) => 
      a.date.getTime() - b.date.getTime()
    )
    
    // Status keywords mapping
    const statusPatterns: Record<ApplicationStatus, RegExp[]> = {
      inquiry: [/interested in/, /reaching out/, /opportunity at/],
      applied: [/application received/, /thank you for applying/, /submitted your application/],
      screening: [/review your application/, /phone screen/, /initial call/],
      interview: [/schedule.*interview/, /interview.*scheduled/, /meet with/, /speaking with/],
      offer: [/offer letter/, /pleased to offer/, /compensation package/],
      rejected: [/not selected/, /other candidates/, /not moving forward/],
      withdrawn: [/withdraw.*application/, /no longer interested/]
    }
    
    // Detect status changes
    sortedEmails.forEach((email, index) => {
      const content = `${email.subject} ${email.body}`.toLowerCase()
      
      for (const [status, patterns] of Object.entries(statusPatterns)) {
        if (patterns.some(pattern => pattern.test(content))) {
          // Check if this is a new status
          const lastProgression = progressions[progressions.length - 1]
          if (!lastProgression || lastProgression.toStatus !== status) {
            progressions.push({
              fromStatus: lastProgression?.toStatus || 'inquiry',
              toStatus: status as ApplicationStatus,
              detectedAt: email.date,
              confidence: 0.8,
              evidenceText: content.slice(0, 200)
            })
          }
        }
      }
    })
    
    return progressions
  }

  /**
   * Analyze response time patterns
   */
  analyzeResponseTimes(
    emails: Array<{
      date: Date
      isFromUser: boolean
    }>
  ): {
    averageUserResponseTime: number | null
    averageCompanyResponseTime: number | null
    lastResponseTime: number | null
  } {
    const userResponseTimes: number[] = []
    const companyResponseTimes: number[] = []
    
    for (let i = 1; i < emails.length; i++) {
      const timeDiff = emails[i].date.getTime() - emails[i-1].date.getTime()
      const hoursDiff = timeDiff / (1000 * 60 * 60)
      
      if (emails[i].isFromUser && !emails[i-1].isFromUser) {
        userResponseTimes.push(hoursDiff)
      } else if (!emails[i].isFromUser && emails[i-1].isFromUser) {
        companyResponseTimes.push(hoursDiff)
      }
    }
    
    const average = (times: number[]) => 
      times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : null
    
    return {
      averageUserResponseTime: average(userResponseTimes),
      averageCompanyResponseTime: average(companyResponseTimes),
      lastResponseTime: emails.length > 1 
        ? (emails[emails.length - 1].date.getTime() - emails[emails.length - 2].date.getTime()) / (1000 * 60 * 60)
        : null
    }
  }
}

export const conversationAnalyzer = new ConversationAnalyzer()