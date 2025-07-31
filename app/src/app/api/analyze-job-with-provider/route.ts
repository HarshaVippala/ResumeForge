import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { generateSection } from '@/api/_lib/ai'
import { getSupabaseServiceClient } from '@/api/_lib/db'
import { v4 as uuidv4 } from 'uuid'

/**
 * Analyze job description with AI provider
 * Last modified: 2025-01-09 - Created to replace Python backend dependency
 */

const analyzeJobSchema = z.object({
  company: z.string().min(1),
  role: z.string().min(1),
  jobDescription: z.string().min(50),
  provider: z.string().optional().default('gemini')
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = analyzeJobSchema.parse(body)
    
    // Create analysis prompt
    const analysisPrompt = `Analyze this job description and extract key information.

Company: ${validatedData.company}
Role: ${validatedData.role}
Job Description:
${validatedData.jobDescription}

Extract and categorize:
1. Technical skills (programming languages, frameworks, tools)
2. Soft skills
3. Experience requirements
4. Critical keywords that must appear in the resume
5. Job level (Entry-level, Mid-level, Senior, Lead, Principal)
6. Department

Return a structured JSON response with these categories.`

    // Use the AI service to analyze
    const analysisResult = await generateSection({
      prompt: analysisPrompt,
      sectionType: 'job_analysis',
      context: {
        company: validatedData.company,
        role: validatedData.role
      }
    })

    // Parse the AI response
    let analysis
    try {
      // Try to extract JSON from the response
      const jsonMatch = analysisResult.content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0])
      } else {
        // Fallback: basic keyword extraction
        analysis = extractBasicKeywords(validatedData.jobDescription)
      }
    } catch (error) {
      // Fallback to basic analysis
      analysis = extractBasicKeywords(validatedData.jobDescription)
    }

    // Create session in database
    const sessionId = uuidv4()
    const db = getSupabaseServiceClient()
    
    await db.from('resume_sessions').insert({
      id: sessionId,
      company_name: validatedData.company,
      job_title: validatedData.role,
      job_description: validatedData.jobDescription,
      analysis_result: analysis,
      provider: validatedData.provider,
      created_at: new Date().toISOString()
    })

    return NextResponse.json({
      success: true,
      session_id: sessionId,
      analysis: {
        technical_skills: analysis.technical_skills || [],
        soft_skills: analysis.soft_skills || [],
        experience_requirements: analysis.experience_requirements || [],
        programming_languages: analysis.programming_languages || [],
        frameworks_libraries_tools: analysis.frameworks_tools || [],
        methodologies_concepts: analysis.methodologies || [],
        critical_keywords: analysis.critical_keywords || [],
        job_info: {
          seniority: analysis.job_level || 'Mid-level',
          department: analysis.department || 'Engineering'
        }
      }
    })
  } catch (error) {
    console.error('Job analysis error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to analyze job'
    }, { status: 500 })
  }
}

/**
 * Basic keyword extraction fallback
 */
function extractBasicKeywords(jobDescription: string): any {
  const description = jobDescription.toLowerCase()
  
  // Common technical skills
  const techSkills = [
    'javascript', 'typescript', 'python', 'java', 'react', 'angular', 'vue',
    'node.js', 'express', 'django', 'flask', 'spring', 'aws', 'azure', 'gcp',
    'docker', 'kubernetes', 'git', 'sql', 'nosql', 'mongodb', 'postgresql'
  ]
  
  // Common soft skills
  const softSkills = [
    'communication', 'teamwork', 'leadership', 'problem-solving', 'analytical',
    'collaborative', 'innovative', 'adaptable', 'organized', 'detail-oriented'
  ]
  
  // Extract matches
  const foundTech = techSkills.filter(skill => description.includes(skill))
  const foundSoft = softSkills.filter(skill => description.includes(skill))
  
  // Experience patterns
  const experiencePatterns = [
    /(\d+)\+?\s*years?/gi,
    /bachelor'?s?\s+degree/gi,
    /master'?s?\s+degree/gi
  ]
  
  const experienceReqs = []
  experiencePatterns.forEach(pattern => {
    const matches = description.match(pattern)
    if (matches) {
      experienceReqs.push(...matches)
    }
  })
  
  return {
    technical_skills: foundTech,
    soft_skills: foundSoft,
    experience_requirements: experienceReqs,
    programming_languages: foundTech.filter(s => ['javascript', 'typescript', 'python', 'java'].includes(s)),
    frameworks_tools: foundTech.filter(s => !['javascript', 'typescript', 'python', 'java'].includes(s)),
    methodologies: ['agile', 'scrum', 'devops', 'ci/cd'].filter(m => description.includes(m)),
    critical_keywords: [...foundTech.slice(0, 5), ...foundSoft.slice(0, 3)],
    job_level: description.includes('senior') ? 'Senior' : 'Mid-level',
    department: 'Engineering'
  }
}