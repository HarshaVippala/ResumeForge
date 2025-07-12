import { NextRequest, NextResponse } from 'next/server';
import { EmbeddingService } from '@/api/_lib/resume-matcher/embedding-service';
import { ATSScorer } from '@/api/_lib/resume-matcher/ats-scorer';
import { IterativeOptimizer } from '@/api/_lib/resume-matcher/iterative-optimizer';
import { getSupabase } from '@/api/_lib/db';

export const runtime = 'nodejs';

/**
 * Resume Tailoring API Route - Using Resume Matcher Approach
 * POST /api/resume-tailoring/complete
 * Updated: 2025-01-09 - Migrated to Resume Matcher algorithm
 */
export async function POST(req: NextRequest) {
  try {
    console.log('📥 Received resume tailoring request');
    const body = await req.json();
    const { company, role, jobDescription, industry, seniorityLevel, options } = body;

    console.log('📋 Request data:', { company, role, jobDescription: jobDescription?.substring(0, 100) + '...' });

    // Validate required fields
    if (!company?.trim() || !role?.trim() || !jobDescription?.trim()) {
      console.error('❌ Validation failed: Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields: company, role, jobDescription' },
        { status: 400 }
      );
    }

    console.log(`🎯 Resume Tailoring with Resume Matcher: ${company} - ${role}`);

    // Initialize Resume Matcher services
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('No Google AI API key found');
      return NextResponse.json({ error: 'AI service not configured' }, { status: 500 });
    }

    const embeddingService = new EmbeddingService(apiKey);
    const atsScorer = new ATSScorer();
    const optimizer = new IterativeOptimizer(apiKey);

    // Load master resume from database
    const db = getSupabase();
    
    // First, try to get the master resume
    const { data: masterResume, error: masterError } = await db
      .from('resumes')
      .select('*')
      .eq('is_master', true)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (masterError || !masterResume) {
      console.error('No master resume found');
      return NextResponse.json({ 
        error: 'No master resume found. Please create a master resume first.' 
      }, { status: 400 });
    }

    const baseResumeData = masterResume;

    console.log(`📋 Using master resume: ${baseResumeData.name}`);
    
    // Extract experience data from master resume content
    const harshaExperiences = baseResumeData.content?.experience || [];

    // Step 1: Extract keywords using Resume Matcher approach
    console.log('🔍 Extracting keywords from job description...');
    const keywords = embeddingService.extractKeywords(jobDescription, 25);
    console.log(`📌 Found ${keywords.length} keywords:`, keywords.slice(0, 10));

    // Step 2: Build base resume structure from master resume
    const baseResume = {
      contact: baseResumeData.content.contact || {
        name: "Your Name",
        email: "your.email@example.com",
        phone: "Your Phone",
        linkedin: "linkedin.com/in/yourprofile",
        github: "github.com/yourusername"
      },
      summary: baseResumeData.content.summary || `Software Engineer specializing in ${keywords.slice(0, 3).join(', ')}`,
      experience: harshaExperiences.map((exp: any) => ({
        title: exp.title || exp.job_title,
        company: exp.company || exp.company_name,
        location: exp.location,
        duration: exp.dates || exp.duration,
        achievements: exp.bullets || exp.achievements || exp.experience_highlights || []
      })),
      skills: baseResumeData.content.skills || baseResumeData.main_skills || [],
      education: baseResumeData.content.education || [],
      projects: baseResumeData.content.projects || []
    };

    // Step 3: Define tailoring function for iterative optimization
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash-lite';
    const model = genAI.getGenerativeModel({ model: modelName });

    const tailorResume = async (currentResume: any, feedback: string) => {
      const prompt = `You are an expert resume writer using Resume Matcher optimization approach.

TASK: Improve this resume based on specific feedback while maintaining authenticity.

TARGET ROLE: ${role}
COMPANY: ${company}

CURRENT RESUME:
${JSON.stringify(currentResume, null, 2)}

OPTIMIZATION FEEDBACK:
${feedback}

CRITICAL REQUIREMENTS:
1. Address the specific feedback points
2. Maintain authenticity - only use actual experiences
3. Integrate keywords naturally, no keyword stuffing
4. Keep the same format and structure
5. Quantify achievements where possible
6. Use strong action verbs

Return a JSON object with the exact same structure as the input resume.`;

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 4096,
        },
      });

      const text = result.response.text();
      const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      return JSON.parse(cleanedText);
    };

    // Step 4: Run iterative optimization (Resume Matcher approach)
    console.log('🔄 Starting iterative optimization...');
    const optimizationResult = await optimizer.optimizeResume(
      baseResume,
      jobDescription,
      tailorResume,
      {
        maxIterations: 3,
        targetScore: 85,
        improvementThreshold: 5,
        verbose: true
      }
    );

    // Step 5: Get final scores
    const finalIteration = optimizationResult.iterations[optimizationResult.iterations.length - 1];
    const analysis = optimizer.analyzeOptimizationResults(optimizationResult);

    // Step 6: Save to database
    let savedResumeId = null;
    let savedJobId = null;
    let optimizationMetricId = null;
    
    try {
      // First, check if job exists or create it
      const { data: existingJob } = await db
        .from('jobs')
        .select('id')
        .eq('company_name', company)
        .eq('job_title', role)
        .single();

      if (existingJob) {
        savedJobId = existingJob.id;
      } else {
        // Create a new job entry
        const { data: newJob, error: jobError } = await db
          .from('jobs')
          .insert({
            company_name: company,
            job_title: role,
            description: jobDescription,
            keywords: keywords,
            source: 'manual',
            status: 'interested',
            match_score: optimizationResult.finalScore / 100
          })
          .select()
          .single();

        if (!jobError && newJob) {
          savedJobId = newJob.id;
        }
      }

      // Save the resume with all real scores from Resume Matcher
      const { data: savedResume, error } = await db
        .from('resumes')
        .insert({
          name: `${company} - ${role}`,
          job_id: savedJobId,
          content: optimizationResult.finalResume,
          main_skills: keywords.slice(0, 10),
          tech_stack: keywords.filter(k => k.includes('js') || k.includes('aws') || k.includes('react')),
          ats_score: finalIteration.atsScore.totalScore / 100,
          keyword_density: {
            coverage: finalIteration.atsScore.keywordCoverage / 100,
            matched: finalIteration.similarityScore.matchedKeywords,
            missing: finalIteration.similarityScore.missingKeywords,
            density: finalIteration.similarityScore.keywordDensity
          },
          tailoring_notes: `Optimized for ${company} - Score: ${optimizationResult.finalScore}%`,
          is_active: true,
          version: 1
        })
        .select()
        .single();

      if (!error && savedResume) {
        savedResumeId = savedResume.id;
        console.log('✅ Resume saved to database:', savedResumeId);

        // Save optimization metrics
        const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash-lite';
        optimizationMetricId = await optimizer.saveOptimizationMetrics(
          optimizationResult,
          savedJobId || 'unknown',
          savedResumeId,
          undefined, // userId - we'll get this from session in production
          { name: modelName, version: '2.0' }
        );

        if (optimizationMetricId) {
          console.log('📊 Optimization metrics saved:', optimizationMetricId);
        }
      }
    } catch (dbError) {
      console.error('Database save error:', dbError);
      // Continue even if save fails
    }

    // Step 7: Build response
    const response = {
      success: true,
      sessionId: `session-${Date.now()}`,
      resumeId: savedResumeId,
      jobAnalysis: {
        requirements: keywords.map(k => ({
          description: k,
          type: 'keyword',
          priority: 'high',
          keywords: [k]
        })),
        keywordClusters: [
          {
            category: "Technical Skills",
            keywords: keywords.filter(k => /\b(js|react|node|aws|docker|python|java|sql)\b/i.test(k)),
            importance: 0.9
          },
          {
            category: "Soft Skills",
            keywords: keywords.filter(k => /\b(lead|manage|communicate|collaborate|team)\b/i.test(k)),
            importance: 0.7
          }
        ],
        industryInsights: [
          `Optimized through ${optimizationResult.iterations.length} iterations`,
          `Achieved ${optimizationResult.improvement.toFixed(1)}% improvement`,
          analysis.summary
        ],
        difficultyLevel: finalIteration.combinedScore >= 85 ? "Well Matched" : "Moderate Match"
      },
      optimizedResume: {
        content: optimizationResult.finalResume,
        sections: [
          {
            type: "summary",
            title: "Professional Summary",
            content: optimizationResult.finalResume.summary,
            score: Math.round(finalIteration.similarityScore.score * 100)
          },
          {
            type: "experience", 
            title: "Professional Experience",
            content: optimizationResult.finalResume.experience,
            score: finalIteration.atsScore.breakdown.keywordMatch
          },
          {
            type: "skills",
            title: "Technical Skills", 
            content: optimizationResult.finalResume.skills,
            score: finalIteration.atsScore.breakdown.sectionPresence
          }
        ],
        keywordsIntegrated: finalIteration.similarityScore.matchedKeywords,
        optimizationScore: optimizationResult.finalScore
      },
      validation: {
        atsCompatibility: finalIteration.atsScore.totalScore,
        qualityScore: finalIteration.combinedScore,
        criticalIssues: finalIteration.atsScore.recommendations.filter(r => r.includes('CRITICAL')),
        recommendations: finalIteration.atsScore.recommendations
      },
      insights: {
        keywordCoverage: finalIteration.atsScore.keywordCoverage,
        strengthAreas: analysis.strengths,
        improvementAreas: analysis.improvements,
        estimatedMatchScore: optimizationResult.finalScore,
        iterationDetails: optimizationResult.iterations.map(iter => ({
          iteration: iter.iteration,
          score: iter.combinedScore,
          improvement: iter.improvementDelta,
          feedback: iter.feedback.split('\n')[0] // First line only
        }))
      },
      nextSteps: [
        "Review the optimized resume for accuracy",
        `${finalIteration.similarityScore.missingKeywords.length > 0 ? `Consider adding: ${finalIteration.similarityScore.missingKeywords.slice(0, 3).join(', ')}` : 'All major keywords covered'}`,
        "Export to your preferred format",
        "Track application in job tracker"
      ]
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ Resume tailoring error:', error);
    
    if (error instanceof Error) {
      return NextResponse.json(
        { error: `Resume tailoring failed: ${error.message}` },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error during resume tailoring' },
      { status: 500 }
    );
  }
}