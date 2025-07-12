/**
 * AI Prompt Templates for Resume Tailoring System
 * 
 * Centralized export of all AI prompts optimized for Gemini 2.5 Flash
 * with structured outputs and advanced prompt engineering techniques.
 */

// Job Analysis Prompts
export {
  JobAnalysisPrompts,
  JobAnalysisPromptChain,
  JobAnalysisPromptValidator,
  type JobAnalysisPromptConfig
} from './job-analysis';

// Content Optimization Prompts
export {
  ContentOptimizationPrompts,
  AdvancedOptimizationPrompts,
  OptimizedContentSchema,
  BulletPointSchema,
  type ContentOptimizationConfig
} from './content-optimization';

// Metric Generation Prompts
export {
  MetricGenerationPrompts,
  AdvancedMetricPrompts,
  MetricEstimationSchema,
  ImpactStorySchema,
  type MetricGenerationConfig
} from './metric-generation';

/**
 * Gemini 2.5 Flash Configuration
 * 
 * Best practices for using these prompts with Gemini:
 * 1. Use structured output schemas for consistent responses
 * 2. Include specific examples in prompts for better understanding
 * 3. Chain prompts for complex analysis tasks
 * 4. Validate outputs against schemas before processing
 */
export const GEMINI_CONFIG = {
  model: 'gemini-2.5-flash',
  temperature: 0.7, // Balance between creativity and consistency
  maxOutputTokens: 8192,
  topP: 0.95,
  topK: 40,
  
  // Structured output settings
  responseFormat: 'json',
  structuredOutputValidation: true,
  
  // Safety settings for professional content
  safetySettings: [
    {
      category: 'HARM_CATEGORY_HARASSMENT',
      threshold: 'BLOCK_NONE'
    },
    {
      category: 'HARM_CATEGORY_HATE_SPEECH',
      threshold: 'BLOCK_NONE'
    },
    {
      category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
      threshold: 'BLOCK_MEDIUM_AND_ABOVE'
    },
    {
      category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
      threshold: 'BLOCK_NONE'
    }
  ]
};

/**
 * Prompt composition utilities
 */
export class PromptComposer {
  /**
   * Combine multiple prompts for comprehensive analysis
   */
  static composeAnalysisChain(
    jobDescription: string,
    currentResume: string,
    targetRole: string
  ) {
    return {
      // Step 1: Analyze the job
      jobAnalysis: JobAnalysisPrompts.getComprehensiveAnalysisPrompt({
        jobDescription,
        roleLevel: this.inferRoleLevel(targetRole)
      }),
      
      // Step 2: Extract keywords
      keywordExtraction: JobAnalysisPrompts.getKeywordExtractionPrompt(jobDescription),
      
      // Step 3: Optimize content based on analysis
      contentOptimization: (keywords: string[]) => 
        ContentOptimizationPrompts.getComprehensiveOptimizationPrompt({
          content: currentResume,
          targetKeywords: keywords,
          roleLevel: this.inferRoleLevel(targetRole),
          industry: this.inferIndustry(jobDescription)
        }),
      
      // Step 4: Generate metrics for achievements
      metricGeneration: (achievements: string[]) =>
        achievements.map(achievement => 
          MetricGenerationPrompts.getMetricEstimationPrompt({
            achievement,
            role: targetRole
          })
        )
    };
  }
  
  /**
   * Create a prompt for specific optimization task
   */
  static createOptimizationPrompt(
    task: 'bullet_point' | 'summary' | 'skills',
    content: string,
    context: any
  ) {
    const prompts = {
      bullet_point: () => ContentOptimizationPrompts.getBulletPointEnhancementPrompt(
        content,
        context
      ),
      summary: () => ContentOptimizationPrompts.getSummaryOptimizationPrompt(
        content,
        context.targetRole,
        context.keywords,
        context.uniqueValue
      ),
      skills: () => ContentOptimizationPrompts.getSkillsOptimizationPrompt(
        content.split(',').map(s => s.trim()),
        context.jobRequirements,
        context.roleLevel
      )
    };
    
    return prompts[task]();
  }
  
  /**
   * Helper to infer role level from title
   */
  private static inferRoleLevel(roleTitle: string): string {
    const title = roleTitle.toLowerCase();
    if (title.includes('senior') || title.includes('sr')) return 'senior';
    if (title.includes('lead') || title.includes('principal')) return 'lead';
    if (title.includes('staff') || title.includes('architect')) return 'staff';
    if (title.includes('junior') || title.includes('jr')) return 'junior';
    if (title.includes('intern')) return 'intern';
    return 'mid';
  }
  
  /**
   * Helper to infer industry from job description
   */
  private static inferIndustry(jobDescription: string): string {
    const desc = jobDescription.toLowerCase();
    if (desc.includes('fintech') || desc.includes('financial')) return 'fintech';
    if (desc.includes('healthcare') || desc.includes('medical')) return 'healthcare';
    if (desc.includes('e-commerce') || desc.includes('retail')) return 'e-commerce';
    if (desc.includes('saas') || desc.includes('software as')) return 'saas';
    if (desc.includes('ai') || desc.includes('machine learning')) return 'ai/ml';
    return 'technology';
  }
}

/**
 * Response validation utilities
 */
export class ResponseValidator {
  /**
   * Validate Gemini response against expected schema
   */
  static validateResponse<T>(
    response: any,
    schema: any
  ): { success: boolean; data?: T; errors?: string[] } {
    try {
      const parsed = schema.parse(response);
      return { success: true, data: parsed };
    } catch (error: any) {
      return {
        success: false,
        errors: error.errors?.map((e: any) => `${e.path.join('.')}: ${e.message}`) || ['Invalid response format']
      };
    }
  }
  
  /**
   * Extract structured data from Gemini response
   */
  static extractStructuredData(response: string): any {
    try {
      // Handle markdown code blocks
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }
      
      // Try direct JSON parse
      return JSON.parse(response);
    } catch (error) {
      // Fallback: try to extract JSON-like content
      const jsonStart = response.indexOf('{');
      const jsonEnd = response.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1) {
        try {
          return JSON.parse(response.substring(jsonStart, jsonEnd + 1));
        } catch {
          return null;
        }
      }
      return null;
    }
  }
}

/**
 * Prompt testing utilities for development
 */
export class PromptTester {
  /**
   * Test prompt with sample data
   */
  static async testPrompt(
    promptFn: (...args: any[]) => string,
    sampleData: any,
    expectedSchema?: any
  ) {
    const prompt = promptFn(...sampleData);
    console.log('Generated Prompt:', prompt);
    console.log('Prompt Length:', prompt.length);
    
    if (expectedSchema) {
      console.log('Expected Schema:', expectedSchema);
    }
    
    return {
      prompt,
      length: prompt.length,
      estimatedTokens: Math.ceil(prompt.length / 4) // Rough estimate
    };
  }
}