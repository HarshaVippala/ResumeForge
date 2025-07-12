/**
 * Content Optimization AI Prompts
 * 
 * Sophisticated prompts for optimizing resume content with focus on:
 * - ATS optimization while maintaining readability
 * - FAANG-level impact statements
 * - Keyword density optimization
 * - Achievement quantification
 * 
 * Optimized for Gemini 2.5 Flash with structured outputs
 */

import { z } from 'zod';

// Structured output schemas for Gemini
export const OptimizedContentSchema = z.object({
  original: z.string(),
  optimized: z.string(),
  improvements: z.array(z.object({
    type: z.enum(['keyword', 'impact', 'clarity', 'quantification', 'action_verb']),
    description: z.string(),
    before: z.string(),
    after: z.string()
  })),
  atsScore: z.number().min(0).max(100),
  impactScore: z.number().min(0).max(100),
  keywords: z.array(z.object({
    term: z.string(),
    frequency: z.number(),
    context: z.string()
  }))
});

export const BulletPointSchema = z.object({
  original: z.string(),
  versions: z.array(z.object({
    text: z.string(),
    focusArea: z.enum(['technical', 'leadership', 'impact', 'scale']),
    keywords: z.array(z.string()),
    metrics: z.array(z.object({
      value: z.string(),
      unit: z.string(),
      context: z.string()
    }))
  })),
  recommended: z.string(),
  rationale: z.string()
});

export interface ContentOptimizationConfig {
  content: string;
  targetKeywords: string[];
  roleLevel: string;
  industry: string;
  companyType?: 'startup' | 'enterprise' | 'faang' | 'consulting';
}

export class ContentOptimizationPrompts {
  /**
   * Comprehensive content optimization prompt using Gemini's capabilities
   */
  static getComprehensiveOptimizationPrompt(config: ContentOptimizationConfig): string {
    return `You are an expert resume writer who has helped 500+ candidates land roles at top tech companies including Google, Meta, Amazon, and Microsoft. Your expertise includes ATS optimization and crafting compelling narratives.

TASK: Optimize this resume content for maximum impact and ATS compatibility.

CURRENT CONTENT:
${config.content}

TARGET KEYWORDS (must naturally incorporate):
${config.targetKeywords.map(kw => `- ${kw}`).join('\n')}

CONTEXT:
- Role Level: ${config.roleLevel}
- Industry: ${config.industry}
- Company Type: ${config.companyType || 'not specified'}

OPTIMIZATION FRAMEWORK:

1. KEYWORD INTEGRATION
   - Naturally incorporate target keywords without keyword stuffing
   - Use semantic variations (e.g., "built" → "developed", "architected", "engineered")
   - Ensure 40-60% keyword density for primary terms
   - Place critical keywords in the first 50% of content

2. IMPACT AMPLIFICATION using STAR-I method:
   - Situation: Brief context (when possible)
   - Task: What needed to be done
   - Action: Specific actions taken (use strong verbs)
   - Result: Quantified outcomes
   - Impact: Broader implications or lasting effects

3. QUANTIFICATION STRATEGIES:
   - Performance improvements (X% faster, Y% cost reduction)
   - Scale metrics (users, requests/sec, data volume)
   - Business impact ($X revenue, Y hours saved)
   - Team/project scope (team size, budget, timeline)
   - Relative comparisons (top 10%, 3x industry average)

4. ACTION VERB OPTIMIZATION:
   For ${config.roleLevel} level:
   - Entry: Developed, Implemented, Collaborated, Contributed
   - Mid: Led, Designed, Optimized, Architected
   - Senior: Drove, Pioneered, Transformed, Revolutionized
   - Executive: Envisioned, Championed, Orchestrated, Spearheaded

5. TECHNICAL PRECISION:
   - Use exact technology names (PostgreSQL not "database")
   - Include version numbers for recent technologies
   - Specify cloud services precisely (AWS EC2, not just "cloud")
   - Mention specific methodologies (Scrum, CI/CD, TDD)

6. CLARITY AND CONCISION:
   - Bullet points: 2-3 lines maximum
   - Start with action verb, end with impact
   - Remove filler words ("responsible for" → direct action)
   - Use industry-standard acronyms appropriately

DELIVERABLE STRUCTURE:
Provide your response as a structured JSON matching this TypeScript interface:

interface OptimizedContent {
  original: string;
  optimized: string;
  improvements: Array<{
    type: 'keyword' | 'impact' | 'clarity' | 'quantification' | 'action_verb';
    description: string;
    before: string;
    after: string;
  }>;
  atsScore: number; // 0-100
  impactScore: number; // 0-100
  keywords: Array<{
    term: string;
    frequency: number;
    context: string;
  }>;
}

Ensure the optimized content maintains authenticity while maximizing impact.`;
  }

  /**
   * Bullet point enhancement prompt with multiple variations
   */
  static getBulletPointEnhancementPrompt(
    bulletPoint: string,
    context: {
      role: string;
      keywords: string[];
      companyValues?: string[];
    }
  ): string {
    return `Transform this resume bullet point into a high-impact achievement statement with multiple variations optimized for different focus areas.

ORIGINAL BULLET POINT:
${bulletPoint}

ROLE CONTEXT: ${context.role}

TARGET KEYWORDS TO INCORPORATE:
${context.keywords.map(kw => `- ${kw}`).join('\n')}

${context.companyValues ? `COMPANY VALUES TO ALIGN WITH:\n${context.companyValues.map(v => `- ${v}`).join('\n')}` : ''}

CREATE 4 VARIATIONS:

1. TECHNICAL DEPTH FOCUS
   - Emphasize technical complexity and innovation
   - Include specific technologies, frameworks, algorithms
   - Show deep technical expertise
   - Example transformation:
     "Built a web app" → "Architected scalable microservices using Node.js and Kubernetes, handling 10K concurrent users with 99.9% uptime"

2. LEADERSHIP & COLLABORATION FOCUS
   - Highlight team leadership and cross-functional work
   - Show influence and mentorship
   - Emphasize stakeholder management
   - Example transformation:
     "Led a project" → "Spearheaded cross-functional team of 8 engineers and designers, mentoring 3 junior developers while coordinating with C-suite stakeholders"

3. BUSINESS IMPACT FOCUS
   - Quantify business value and ROI
   - Show revenue, cost savings, efficiency gains
   - Connect technical work to business outcomes
   - Example transformation:
     "Improved system performance" → "Optimized database queries reducing infrastructure costs by $50K annually while improving customer response time by 40%"

4. SCALE & INNOVATION FOCUS
   - Emphasize large-scale systems and innovation
   - Show handling of complexity and volume
   - Highlight novel solutions
   - Example transformation:
     "Processed data" → "Engineered distributed data pipeline processing 5TB daily using Apache Spark, introducing novel compression algorithm reducing storage by 60%"

For each variation provide:
- The enhanced bullet point (2-3 lines max)
- Keywords naturally incorporated
- Specific metrics or quantifications used
- Why this variation would resonate with recruiters

CRITICAL RULES:
- Every statement must be truthful and verifiable
- Use CAR format: Context-Action-Result
- Start with a strong action verb
- End with quantified impact
- Include at least 2 target keywords naturally
- Maintain consistent verb tense (past for previous roles)

Provide response as structured JSON matching the BulletPointSchema.`;
  }

  /**
   * Summary/objective optimization prompt
   */
  static getSummaryOptimizationPrompt(
    currentSummary: string,
    targetRole: string,
    keywords: string[],
    uniqueValue: string
  ): string {
    return `Craft a powerful professional summary that immediately captures attention and passes ATS filters for a ${targetRole} position.

CURRENT SUMMARY:
${currentSummary}

TARGET ROLE: ${targetRole}

MUST-INCLUDE KEYWORDS:
${keywords.map(kw => `- ${kw}`).join('\n')}

UNIQUE VALUE PROPOSITION:
${uniqueValue}

CREATE A COMPELLING SUMMARY FOLLOWING THIS FRAMEWORK:

1. OPENING HOOK (First sentence):
   - Role title + years of experience + key specialty
   - Include 2-3 primary keywords naturally
   - Example: "Senior Full-Stack Engineer with 7+ years architecting scalable SaaS platforms using React and Node.js"

2. CORE EXPERTISE (Second sentence):
   - 3-4 areas of deep expertise
   - Include technical skills and domain knowledge
   - Use industry-recognized terms
   - Example: "Expert in microservices architecture, cloud-native development (AWS/GCP), and high-performance distributed systems"

3. SIGNATURE ACHIEVEMENT (Third sentence):
   - One standout, quantified achievement
   - Shows scope and impact
   - Relevant to target role
   - Example: "Led technical transformation reducing deployment time by 85% while scaling platform from 10K to 1M+ active users"

4. VALUE PROPOSITION (Final sentence):
   - What unique value you bring
   - Forward-looking statement
   - Alignment with company needs
   - Example: "Passionate about building elegant solutions to complex problems and mentoring teams to deliver exceptional user experiences"

SUMMARY VARIATIONS:
Provide 3 versions optimized for:

Version 1: ATS OPTIMIZATION
- Maximum keyword density (without stuffing)
- Clear role alignment
- Standard industry terminology

Version 2: HUMAN READER IMPACT
- Compelling narrative
- Unique personality
- Memorable phrasing

Version 3: EXECUTIVE APPEAL
- Strategic thinking
- Business acumen
- Leadership indicators

CONSTRAINTS:
- 3-4 sentences maximum (50-75 words)
- No clichés ("team player", "go-getter", "think outside the box")
- No personal pronouns (I, me, my)
- Present tense for current capabilities
- Specific rather than generic claims

Provide structured JSON with all three versions, keyword density analysis, and ATS compatibility score for each.`;
  }

  /**
   * Skills section optimization prompt
   */
  static getSkillsOptimizationPrompt(
    currentSkills: string[],
    jobRequirements: string[],
    roleLevel: string
  ): string {
    return `Optimize the skills section for maximum ATS match rate while maintaining credibility and relevance.

CURRENT SKILLS:
${currentSkills.map(s => `- ${s}`).join('\n')}

JOB REQUIREMENTS:
${jobRequirements.map(r => `- ${r}`).join('\n')}

ROLE LEVEL: ${roleLevel}

OPTIMIZATION STRATEGY:

1. SKILL CATEGORIZATION
   Organize skills into logical categories:
   - Programming Languages
   - Frameworks & Libraries
   - Databases & Data Stores
   - Cloud & DevOps
   - Tools & Platforms
   - Methodologies & Practices
   - Soft Skills (if relevant)

2. PRIORITIZATION FRAMEWORK
   Order skills by:
   - Direct match with job requirements (highest priority)
   - Related/transferable skills
   - Complementary skills that add value
   - Remove outdated or irrelevant skills

3. KEYWORD VARIATIONS
   Include important variations:
   - Full names and acronyms (Amazon Web Services & AWS)
   - Version numbers for recent tech (React 18, Python 3.11)
   - Certification indicators where applicable

4. PROFICIENCY INDICATORS (optional but valuable)
   For ${roleLevel} roles, consider indicating:
   - Expert: Deep knowledge, can mentor others
   - Proficient: Production-ready, solid experience
   - Familiar: Working knowledge, can contribute

5. EMERGING SKILLS
   Based on industry trends, suggest adding:
   - AI/ML tools if applicable
   - Modern frameworks gaining adoption
   - Industry-specific tools

6. SKILLS TO REMOVE
   Identify skills that:
   - Are too basic for ${roleLevel}
   - Are outdated (Flash, old jQuery)
   - Don't align with target role
   - Weaken overall positioning

DELIVERABLE:
Provide a structured JSON with:
- Optimized skills by category
- Match rate with job requirements
- Skills gap analysis
- Recommended additions
- Skills to remove with rationale
- ATS optimization tips

Ensure the skills section tells a coherent story about capabilities while maximizing keyword matches.`;
  }

  /**
   * Experience section transformation prompt
   */
  static getExperienceTransformationPrompt(
    experience: {
      company: string;
      role: string;
      duration: string;
      bullets: string[];
    },
    targetRole: string,
    keywords: string[]
  ): string {
    return `Transform this work experience entry into a compelling narrative that demonstrates readiness for ${targetRole}.

CURRENT EXPERIENCE:
Company: ${experience.company}
Role: ${experience.role}
Duration: ${experience.duration}
Current Bullets:
${experience.bullets.map((b, i) => `${i + 1}. ${b}`).join('\n')}

TARGET ROLE: ${targetRole}
KEY KEYWORDS TO INCORPORATE: ${keywords.join(', ')}

TRANSFORMATION FRAMEWORK:

1. ROLE TITLE OPTIMIZATION
   - Align with industry standards
   - Include relevant keywords if authentic
   - Consider title variations that better reflect actual work

2. BULLET POINT TRANSFORMATION
   For each bullet, apply:
   
   STRUCTURE: [Action Verb] + [What/How] + [Result/Impact]
   
   FORMULA: 
   - Context (if needed): "In response to [business need]..."
   - Action: Strong verb + specific technical approach
   - Result: Quantified outcome + broader impact

3. PROGRESSIVE RESPONSIBILITY
   Show growth through bullet order:
   - Start with biggest impact/most relevant
   - Show increasing complexity/scope
   - End with forward-looking achievement

4. KEYWORD INTEGRATION STRATEGY
   - Bullet 1: Include 2-3 primary keywords
   - Bullet 2-3: Include secondary keywords
   - All bullets: Use semantic variations
   - Natural placement > forced inclusion

5. QUANTIFICATION TECHNIQUES
   Find numbers for:
   - Team size led or collaborated with
   - Budget managed or saved
   - Performance improvements (%, time, efficiency)
   - User/customer impact
   - Project timelines and delivery
   - Compared to baseline or competitors

6. TECHNICAL DEPTH INDICATORS
   - Specific technologies used
   - Architecture decisions made
   - Problems solved and approaches
   - Innovations introduced

EXAMPLE TRANSFORMATION:
Before: "Worked on improving website performance"
After: "Architected lazy-loading solution using React.lazy and Webpack code-splitting, reducing initial page load by 62% (3.2s → 1.2s) and improving Core Web Vitals score by 40%, directly contributing to 15% increase in conversion rate"

Provide optimized experience entry with:
- Enhanced role title (if applicable)
- 3-5 transformed bullet points
- Keyword density analysis
- Impact score for each bullet
- Overall alignment with target role

Format as structured JSON for easy parsing.`;
  }
}

/**
 * Advanced optimization strategies
 */
export class AdvancedOptimizationPrompts {
  /**
   * Cross-section keyword optimization
   */
  static getCrossSectionOptimizationPrompt(
    sections: {
      summary: string;
      experience: string;
      skills: string;
    },
    targetKeywords: string[]
  ): string {
    return `Analyze keyword distribution across resume sections and optimize for natural flow while maintaining ATS compatibility.

RESUME SECTIONS:
Summary: ${sections.summary}
Experience: ${sections.experience}
Skills: ${sections.skills}

TARGET KEYWORDS: ${targetKeywords.join(', ')}

ANALYSIS TASKS:

1. KEYWORD DISTRIBUTION ANALYSIS
   - Current frequency per section
   - Identify over/under-representation
   - Check for keyword stuffing
   - Find missing critical keywords

2. OPTIMIZATION RECOMMENDATIONS
   - Where to add missing keywords naturally
   - Which sections need keyword reduction
   - Synonym substitutions to reduce repetition
   - Contextual placement improvements

3. FLOW AND READABILITY
   - Ensure keywords don't disrupt narrative
   - Maintain professional tone
   - Check for natural language patterns
   - Verify logical skill progression

Provide structured recommendations for each section with specific edits.`;
  }

  /**
   * Industry-specific optimization prompt
   */
  static getIndustrySpecificOptimizationPrompt(
    content: string,
    industry: string,
    companyType: string
  ): string {
    return `Optimize this resume content for ${industry} industry standards and ${companyType} company culture.

Apply industry-specific optimizations:
- Terminology and jargon
- Emphasized skills and achievements
- Cultural alignment indicators
- Industry-specific metrics

Provide before/after comparisons with rationale.`;
  }
}