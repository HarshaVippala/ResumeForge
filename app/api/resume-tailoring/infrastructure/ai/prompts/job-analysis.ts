/**
 * Job Analysis AI Prompts
 * 
 * Sophisticated prompts for analyzing job descriptions with focus on:
 * - Deep semantic understanding of requirements
 * - ATS keyword extraction and optimization
 * - FAANG-level role decomposition
 * - Hidden requirement inference
 */

export interface JobAnalysisPromptConfig {
  jobDescription: string;
  industry?: string;
  companyContext?: string;
  roleLevel?: string;
}

export class JobAnalysisPrompts {
  /**
   * Comprehensive job analysis prompt using Chain-of-Thought reasoning
   */
  static getComprehensiveAnalysisPrompt(config: JobAnalysisPromptConfig): string {
    return `You are an expert technical recruiter with 15+ years of experience at FAANG companies and deep knowledge of ATS systems. Analyze this job description with exceptional detail and precision.

JOB DESCRIPTION:
${config.jobDescription}

${config.industry ? `INDUSTRY CONTEXT: ${config.industry}` : ''}
${config.companyContext ? `COMPANY CONTEXT: ${config.companyContext}` : ''}
${config.roleLevel ? `ROLE LEVEL: ${config.roleLevel}` : ''}

Perform a comprehensive analysis following this structured approach:

1. ROLE DECOMPOSITION
   - Extract the exact job title and all title variations
   - Identify the team/department context
   - Determine seniority level (entry/mid/senior/staff/principal)
   - Classify role type (IC/Lead/Manager/Architect)
   - Identify any specialized focus areas

2. TECHNICAL REQUIREMENTS EXTRACTION
   For each technical requirement:
   - Exact skill/technology name
   - Required proficiency level (beginner/intermediate/expert)
   - Context of usage (e.g., "Python for ML pipelines")
   - Whether it's must-have vs nice-to-have
   - Related/alternative technologies accepted

   Example format:
   - Python: Expert level, ML/Data Science context, MUST-HAVE
     Alternatives: Strong R or Julia experience may substitute
   - Kubernetes: Intermediate, Container orchestration, NICE-TO-HAVE
     Related: Docker, OpenShift, container management

3. ATS KEYWORD OPTIMIZATION
   Extract keywords in these categories:
   
   a) PRIMARY KEYWORDS (exact matches critical for ATS):
      - Technical skills mentioned explicitly
      - Tools, frameworks, and platforms
      - Certifications and credentials
      - Industry-specific terminology
   
   b) SEMANTIC VARIATIONS (for keyword density):
      - Abbreviations vs full forms (ML vs Machine Learning)
      - Alternative spellings (CI/CD vs CI-CD)
      - Synonymous terms (Software Engineer vs Developer)
   
   c) CONTEXTUAL KEYWORDS (for relevance scoring):
      - Action verbs used in responsibilities
      - Domain-specific terminology
      - Soft skills and competencies
      - Methodologies and practices

4. HIDDEN REQUIREMENTS INFERENCE
   Based on the role context, infer unstated but likely requirements:
   - Company culture indicators
   - Tech stack patterns (if using React, likely needs JavaScript expertise)
   - Scale indicators (millions of users suggests distributed systems knowledge)
   - Team collaboration requirements
   - Documentation and communication expectations

5. QUANTIFIABLE EXPECTATIONS
   Extract or infer measurable expectations:
   - Years of experience required
   - Team size managed (for leadership roles)
   - System scale (users, requests, data volume)
   - Performance metrics mentioned
   - Project complexity indicators

6. CAREER TRAJECTORY MAPPING
   - What roles typically lead to this position
   - What skills indicate readiness for this level
   - Growth opportunities mentioned or implied
   - Long-term career development potential

7. RED FLAGS AND OPPORTUNITIES
   - Unrealistic requirement combinations
   - Outdated technology mentions
   - Particularly valuable/rare skill combinations
   - Areas where transferable skills could apply

Format your response as a structured JSON object with all sections clearly delineated. Use confidence scores (0-1) for inferred requirements.

CRITICAL: Be extremely precise with technical terms. "Java" and "JavaScript" are different. "React" and "React Native" are different. AWS services should be specified exactly (EC2, S3, Lambda, etc.).`;
  }

  /**
   * Focused keyword extraction prompt for ATS optimization
   */
  static getKeywordExtractionPrompt(jobDescription: string): string {
    return `You are an ATS (Applicant Tracking System) optimization expert. Extract and categorize ALL keywords from this job description that an ATS would scan for.

JOB DESCRIPTION:
${jobDescription}

Provide a comprehensive keyword analysis:

1. TECHNICAL KEYWORDS
   List every technical term mentioned:
   - Programming languages (with versions if specified)
   - Frameworks and libraries
   - Tools and platforms
   - Databases and data stores
   - Cloud services and providers
   - Development methodologies
   - Protocols and standards

2. KEYWORD VARIATIONS
   For each primary keyword, provide:
   - Common abbreviations (JavaScript → JS)
   - Alternative names (Amazon Web Services → AWS)
   - Related terms (REST API → RESTful, REST services)
   - Contextual variations (Java developer → Java programming)

3. COMPOUND KEYWORDS
   Multi-word phrases that should appear together:
   - "machine learning engineer"
   - "full stack development"
   - "agile methodology"
   - "continuous integration"

4. ACTION KEYWORDS
   Key verbs that describe responsibilities:
   - Technical: develop, architect, optimize, debug, deploy
   - Leadership: mentor, lead, coordinate, manage
   - Analytical: analyze, evaluate, research, investigate

5. SOFT SKILL KEYWORDS
   - Communication patterns
   - Collaboration indicators
   - Problem-solving terminology
   - Leadership qualities

6. INDUSTRY-SPECIFIC TERMS
   - Domain vocabulary
   - Compliance/regulatory terms
   - Business context keywords

7. KEYWORD DENSITY RECOMMENDATIONS
   For top 20 keywords, suggest optimal frequency ranges:
   - Primary keywords: 3-5 mentions
   - Secondary keywords: 2-3 mentions
   - Supporting keywords: 1-2 mentions

Format as JSON with keyword categories, variations, and importance scores (1-10).

Remember: Modern ATS systems use semantic matching, so include conceptually related terms, not just exact matches.`;
  }

  /**
   * Requirement prioritization prompt
   */
  static getRequirementPrioritizationPrompt(
    requirements: string[],
    roleContext: string
  ): string {
    return `As a senior technical recruiter, prioritize these job requirements based on their actual importance for success in the role.

ROLE CONTEXT: ${roleContext}

REQUIREMENTS TO ANALYZE:
${requirements.map((req, i) => `${i + 1}. ${req}`).join('\n')}

For each requirement, provide:

1. CRITICALITY SCORE (1-10)
   - 9-10: Absolute must-have, rejection if missing
   - 7-8: Strongly preferred, significant disadvantage if missing
   - 5-6: Nice to have, adds value but not critical
   - 3-4: Bonus points, shows extra qualification
   - 1-2: Minimal impact, possibly outdated requirement

2. RATIONALE
   Explain why this requirement has this priority level

3. ALTERNATIVE QUALIFICATIONS
   What could compensate for lacking this specific requirement?

4. LEARNING CURVE ASSESSMENT
   How quickly could a strong candidate acquire this skill if missing?

5. MARKET REALITY CHECK
   How common is this requirement in similar roles?
   Is this a "unicorn" requirement that few candidates have?

Consider:
- Some "required" skills in job posts are actually negotiable
- Companies often list ideal candidates, not minimum requirements
- Strong fundamentals can outweigh specific tool experience
- Cultural fit and potential often matter more than checking every box

Format as structured JSON with clear prioritization.`;
  }

  /**
   * Company culture and values extraction prompt
   */
  static getCultureAnalysisPrompt(jobDescription: string, companyInfo?: string): string {
    return `Analyze the cultural indicators and values embedded in this job description to help candidates align their applications.

JOB DESCRIPTION:
${jobDescription}

${companyInfo ? `ADDITIONAL COMPANY INFO:\n${companyInfo}` : ''}

Extract and analyze:

1. CULTURAL INDICATORS
   - Work style preferences (collaborative vs independent)
   - Communication patterns expected
   - Decision-making approach
   - Innovation vs stability emphasis
   - Pace and urgency level

2. VALUE SIGNALS
   - Explicitly stated values
   - Implicit value indicators from language used
   - Priority indicators (what's mentioned first/most)
   - Team dynamics described

3. WORK ENVIRONMENT CLUES
   - Remote/hybrid/office preferences
   - Meeting and collaboration style
   - Documentation expectations
   - Work-life balance indicators
   - Growth and learning emphasis

4. PERSONALITY FIT INDICATORS
   - Ideal candidate personality traits
   - Team composition hints
   - Leadership style preferences
   - Problem-solving approach valued

5. RED FLAGS OR CONCERNS
   - Unrealistic expectations
   - Work-life balance warning signs
   - Unclear responsibilities
   - Cultural mismatches for certain personalities

6. ALIGNMENT OPPORTUNITIES
   - How to demonstrate cultural fit
   - Values to emphasize in application
   - Experiences that would resonate
   - Communication style to adopt

Provide specific phrases and keywords that indicate each cultural element, with recommendations for how candidates should position themselves.

Format as JSON with actionable insights for resume tailoring.`;
  }

  /**
   * Technical depth analysis prompt for specialized roles
   */
  static getTechnicalDepthPrompt(
    jobDescription: string,
    primaryTechnology: string
  ): string {
    return `As a principal engineer with deep expertise in ${primaryTechnology}, analyze the technical depth required for this role.

JOB DESCRIPTION:
${jobDescription}

Provide an expert analysis of:

1. TECHNICAL PROFICIENCY LEVELS
   For ${primaryTechnology} and related technologies:
   - Surface level: Basic syntax, simple applications
   - Working knowledge: Can build production features
   - Proficient: Understands internals, can optimize
   - Expert: Can architect systems, mentor others
   - Master: Thought leader, open source contributor

2. DEPTH INDICATORS
   What phrases/requirements indicate the expected depth?
   - "Experience with" vs "Expert in" vs "Deep knowledge of"
   - Specific technical challenges mentioned
   - Architecture vs implementation focus
   - Performance and scale requirements

3. ADJACENT TECHNOLOGY REQUIREMENTS
   Technologies that complement ${primaryTechnology}:
   - Essential companions (e.g., React → JavaScript, webpack)
   - Common stack combinations
   - Testing frameworks expected
   - DevOps tooling implied

4. REAL-WORLD APPLICATION SIGNALS
   - Types of problems they expect you to solve
   - Scale and complexity indicators
   - Industry-specific applications
   - Integration challenges mentioned

5. TECHNICAL ASSESSMENT PREPARATION
   Based on the depth required:
   - Likely interview topics
   - Code challenge themes
   - System design expectations
   - Technical knowledge areas to review

6. EXPERIENCE DEMONSTRATION STRATEGY
   How to show the required depth in a resume:
   - Specific project types to highlight
   - Technical achievements to emphasize
   - Metrics that demonstrate expertise
   - Keywords that signal deep knowledge

Format as JSON with specific, actionable insights for technical positioning.`;
  }
}

/**
 * Prompt chaining utilities for complex analysis
 */
export class JobAnalysisPromptChain {
  /**
   * Create a chain of prompts for comprehensive analysis
   */
  static createAnalysisChain(jobDescription: string) {
    return {
      step1_initial: JobAnalysisPrompts.getComprehensiveAnalysisPrompt({
        jobDescription
      }),
      step2_keywords: JobAnalysisPrompts.getKeywordExtractionPrompt(jobDescription),
      step3_culture: JobAnalysisPrompts.getCultureAnalysisPrompt(jobDescription),
      // Additional steps can be added based on initial analysis results
    };
  }

  /**
   * Create a refinement prompt based on initial analysis
   */
  static createRefinementPrompt(
    initialAnalysis: any,
    focusArea: 'technical' | 'cultural' | 'requirements'
  ): string {
    const refinementPrompts = {
      technical: `Based on the initial analysis, dive deeper into the technical requirements...`,
      cultural: `Expand on the cultural fit indicators identified...`,
      requirements: `Clarify and prioritize the requirements based on...`
    };

    return refinementPrompts[focusArea];
  }
}

/**
 * Prompt validation and quality checks
 */
export class JobAnalysisPromptValidator {
  static validatePromptCompleteness(prompt: string): {
    isValid: boolean;
    missingElements?: string[];
  } {
    const requiredElements = [
      'job description',
      'analysis',
      'requirements',
      'keywords',
      'JSON'
    ];

    const missingElements = requiredElements.filter(
      element => !prompt.toLowerCase().includes(element)
    );

    return {
      isValid: missingElements.length === 0,
      missingElements
    };
  }
}