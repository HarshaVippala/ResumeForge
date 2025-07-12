/**
 * Metric Generation AI Prompts
 * 
 * Sophisticated prompts for generating quantified achievements with focus on:
 * - Realistic metric estimation based on context
 * - Industry-standard benchmarks
 * - FAANG-level impact quantification
 * - Metric storytelling for maximum impact
 * 
 * Optimized for Gemini 2.5 Flash with structured outputs
 */

import { z } from 'zod';

// Structured output schemas
export const MetricEstimationSchema = z.object({
  description: z.string(),
  estimatedMetrics: z.array(z.object({
    metric: z.string(),
    value: z.string(),
    unit: z.string(),
    confidence: z.number().min(0).max(1),
    rationale: z.string(),
    industryBenchmark: z.string().optional()
  })),
  assumptions: z.array(z.string()),
  alternativeMetrics: z.array(z.object({
    metric: z.string(),
    description: z.string(),
    example: z.string()
  }))
});

export const ImpactStorySchema = z.object({
  originalStatement: z.string(),
  enhancedVersions: z.array(z.object({
    version: z.string(),
    metrics: z.array(z.object({
      type: z.enum(['efficiency', 'scale', 'quality', 'revenue', 'cost', 'time', 'user_satisfaction']),
      value: z.string(),
      context: z.string()
    })),
    impactLevel: z.enum(['team', 'department', 'company', 'industry']),
    verifiability: z.enum(['high', 'medium', 'low'])
  })),
  recommendedVersion: z.string(),
  storyArc: z.object({
    challenge: z.string(),
    action: z.string(),
    result: z.string(),
    significance: z.string()
  })
});

export interface MetricGenerationConfig {
  achievement: string;
  role: string;
  company?: {
    size: 'startup' | 'mid-size' | 'enterprise';
    industry: string;
    stage?: string;
  };
  timeframe?: string;
  teamSize?: number;
}

export class MetricGenerationPrompts {
  /**
   * Intelligent metric estimation based on context
   */
  static getMetricEstimationPrompt(config: MetricGenerationConfig): string {
    const companySizeContext = config.company ? `
COMPANY CONTEXT:
- Size: ${config.company.size}
- Industry: ${config.company.industry}
- Stage: ${config.company.stage || 'Not specified'}

TYPICAL METRICS BY COMPANY SIZE:
- Startup: Users (100s-10Ks), Revenue ($10K-$1M), Team (2-10)
- Mid-size: Users (10Ks-100Ks), Revenue ($1M-$100M), Team (10-50)  
- Enterprise: Users (100Ks-Ms), Revenue ($100M+), Team (50+)
` : '';

    return `You are an expert at quantifying professional achievements with 10+ years of experience across startups and Fortune 500 companies. Generate realistic, defensible metrics for this achievement.

ACHIEVEMENT TO QUANTIFY:
${config.achievement}

CONTEXT:
- Role: ${config.role}
- Timeframe: ${config.timeframe || 'Not specified'}
- Team Size: ${config.teamSize || 'Not specified'}
${companySizeContext}

METRIC GENERATION FRAMEWORK:

1. ANALYZE THE ACHIEVEMENT TYPE
   Identify what kind of work this represents:
   - Technical optimization (performance, efficiency)
   - Business impact (revenue, cost, growth)
   - Process improvement (time savings, quality)
   - Scale achievement (users, data, transactions)
   - Team/organizational impact

2. ESTIMATE REALISTIC METRICS
   Based on the context, provide metrics that are:
   - Believable for the role level and company size
   - Specific enough to be credible
   - Aligned with industry standards
   - Defensible in an interview

   For each metric provide:
   - The metric name and value
   - Confidence level (0-1)
   - Rationale for the estimate
   - Industry benchmark for comparison

3. METRIC CATEGORIES TO CONSIDER:

   EFFICIENCY METRICS:
   - Performance improvement (X% faster)
   - Resource optimization (Y% less CPU/memory)
   - Cost reduction ($Z saved)
   - Time savings (hours/days per week/month)

   SCALE METRICS:
   - Users impacted (active users, MAU, DAU)
   - Data volume (GB/TB processed)
   - Transactions/requests (per second/day)
   - System reliability (uptime %)

   QUALITY METRICS:
   - Error rate reduction (X% fewer bugs)
   - Customer satisfaction (NPS improvement)
   - Code quality (test coverage %, tech debt reduction)
   - Security improvements (vulnerabilities fixed)

   BUSINESS METRICS:
   - Revenue impact ($ or % increase)
   - Customer acquisition/retention
   - Market share/competitive advantage
   - ROI or payback period

   TEAM METRICS:
   - Productivity gains (velocity increase)
   - Onboarding time reduction
   - Knowledge sharing (documentation, training)
   - Team growth and mentorship

4. ESTIMATION TECHNIQUES:

   COMPARATIVE METHOD:
   - "If this improved efficiency by even 10%..."
   - "Assuming average transaction value of $X..."
   - "Given typical team velocity of Y story points..."

   BOTTOMS-UP CALCULATION:
   - Hours saved per person × team size × weeks
   - Requests per user × number of users × time period
   - Cost per incident × incidents prevented

   INDUSTRY BENCHMARKS:
   - Use standard SaaS metrics (CAC, LTV, churn)
   - Apply typical conversion rates
   - Reference public company data for scale

5. ALTERNATIVE METRICS:
   If hard numbers are difficult, suggest:
   - Relative improvements (3x faster than previous)
   - Percentile rankings (top 10% performance)
   - Before/after comparisons
   - Stakeholder feedback quotes

Provide response as structured JSON matching MetricEstimationSchema.

IMPORTANT: All metrics must be realistic and defensible. It's better to be conservative than to overstate. Include assumptions made in estimates.`;
  }

  /**
   * Impact storytelling with metrics
   */
  static getImpactStoryPrompt(
    achievement: string,
    availableMetrics: Array<{metric: string; value: string}>
  ): string {
    return `Transform this achievement into a compelling impact story using the STAR method enhanced with quantified results.

ACHIEVEMENT:
${achievement}

AVAILABLE METRICS:
${availableMetrics.map(m => `- ${m.metric}: ${m.value}`).join('\n')}

CREATE MULTIPLE VERSIONS OF THE IMPACT STORY:

1. TECHNICAL AUDIENCE VERSION
   - Emphasize technical complexity and innovation
   - Include specific technologies and methodologies
   - Focus on system performance and architecture
   - Show deep technical problem-solving

   Example structure:
   "Diagnosed [technical challenge] in [system component], implemented [specific solution] using [technologies], resulting in [performance metric] improvement and [secondary benefit]"

2. BUSINESS STAKEHOLDER VERSION
   - Lead with business impact
   - Translate technical work to business value
   - Emphasize ROI and strategic alignment
   - Show understanding of business priorities

   Example structure:
   "Delivered [business outcome] by [high-level approach], driving [financial metric] and enabling [strategic capability]"

3. LEADERSHIP/BEHAVIORAL VERSION
   - Highlight collaboration and influence
   - Show initiative and ownership
   - Emphasize team and organizational impact
   - Demonstrate growth mindset

   Example structure:
   "Identified opportunity to [improve X], rallied [stakeholders] around solution, led implementation resulting in [team/org metric]"

4. HYBRID MAXIMUM IMPACT VERSION
   - Balance technical and business elements
   - Show both depth and breadth
   - Include multiple metrics naturally
   - Tell complete story arc

   Example structure:
   "[Context/Challenge]. [Technical action with specifics]. [Primary quantified result]. [Secondary impact on team/business]."

STORYTELLING PRINCIPLES:

1. CHALLENGE FRAMING
   - What problem existed?
   - Why was it important to solve?
   - What made it difficult?

2. ACTION SPECIFICITY
   - Exactly what did you do?
   - What approach did you take?
   - What tools/methods did you use?

3. RESULT QUANTIFICATION
   - Primary metric (most impressive)
   - Secondary metric (adds credibility)
   - Comparative context (vs. previous state)

4. SIGNIFICANCE STATEMENT
   - Why this mattered
   - Lasting impact
   - Lessons learned or capabilities built

METRIC INTEGRATION RULES:
- Use 2-3 metrics maximum per bullet
- Lead with most impressive metric
- Provide context for large numbers
- Use ranges when exact numbers uncertain
- Include time frames for rates/percentages

FORMAT GUIDELINES:
- 2-3 lines per bullet point
- Strong action verb start
- Specific technical terms
- Natural metric placement
- Clear cause-effect relationship

Provide structured JSON matching ImpactStorySchema with all versions and recommendations.`;
  }

  /**
   * Metric validation and credibility check
   */
  static getMetricValidationPrompt(
    role: string,
    metrics: Array<{achievement: string; metric: string; value: string}>
  ): string {
    return `As a senior technical recruiter with experience at Google, Meta, and Amazon, validate these achievement metrics for credibility and interview defensibility.

ROLE: ${role}

METRICS TO VALIDATE:
${metrics.map((m, i) => `
${i + 1}. Achievement: ${m.achievement}
   Metric: ${m.metric} = ${m.value}
`).join('\n')}

FOR EACH METRIC, ASSESS:

1. CREDIBILITY SCORE (1-10)
   - 9-10: Highly credible, well-supported
   - 7-8: Believable with minor questions
   - 5-6: Possible but needs context
   - 3-4: Stretching credibility
   - 1-2: Likely to raise red flags

2. INTERVIEW DEFENSIBILITY
   - What questions will interviewers ask?
   - What evidence would support this claim?
   - How to explain methodology if challenged?
   - Alternative ways to frame if questioned

3. CONTEXT REQUIREMENTS
   - What additional context makes this credible?
   - Industry/company size considerations
   - Timeframe implications
   - Team size or resource factors

4. RED FLAGS
   - Does this seem inflated?
   - Missing important context?
   - Inconsistent with role level?
   - Too vague or too specific?

5. IMPROVEMENT SUGGESTIONS
   - How to make more credible
   - Alternative metrics to consider
   - Better ways to frame the achievement
   - Context to add for clarity

6. BENCHMARK COMPARISON
   - How does this compare to industry standards?
   - Typical ranges for this type of achievement
   - What would raise eyebrows?

VALIDATION FRAMEWORK:

For ${role} level, typical believable ranges:
- Performance improvements: 20-50% (higher needs strong justification)
- Cost savings: $10K-$1M (depending on company size)
- Scale: 10x growth over 6-12 months is aggressive but possible
- Team productivity: 15-30% improvement is strong
- User satisfaction: 5-15 point NPS increase is significant

Remember: It's better to be conservative and credible than aggressive and questionable.

Provide structured analysis with specific recommendations for each metric.`;
  }

  /**
   * Metric discovery from vague achievements
   */
  static getMetricDiscoveryPrompt(achievement: string, context: string): string {
    return `Help discover quantifiable metrics from this vague achievement description using investigative questioning and estimation techniques.

VAGUE ACHIEVEMENT:
${achievement}

CONTEXT:
${context}

METRIC DISCOVERY PROCESS:

1. IDENTIFY QUANTIFIABLE ELEMENTS
   What aspects of this achievement could have metrics:
   - Time (duration, frequency, speed)
   - Volume (users, data, transactions)
   - Quality (accuracy, reliability, satisfaction)
   - Resources (cost, people, infrastructure)
   - Impact (revenue, efficiency, reach)

2. INVESTIGATIVE QUESTIONS
   Generate questions that would uncover metrics:
   - "How many users/customers were affected?"
   - "What was the before/after state?"
   - "How long did this take to implement?"
   - "What resources were saved/required?"
   - "How often did this occur?"

3. ESTIMATION TECHNIQUES
   If exact numbers unknown, estimate using:
   
   FERMI ESTIMATION:
   - Break down into components
   - Use reasonable assumptions
   - Calculate range estimates
   
   COMPARATIVE ANALYSIS:
   - Compare to similar projects
   - Use industry benchmarks
   - Scale from known examples

   IMPACT MODELING:
   - If X improved by Y%, then...
   - Assuming typical usage patterns...
   - Given standard industry metrics...

4. METRIC OPTIONS BY IMPACT TYPE

   If about SPEED/EFFICIENCY:
   - Processing time reduction (ms to minutes)
   - Throughput increase (requests/second)
   - Latency improvement (response time)
   - Automation percentage

   If about SCALE/GROWTH:
   - User growth rate
   - Data volume handled
   - Geographic expansion
   - Feature adoption rate

   If about QUALITY/RELIABILITY:
   - Error rate reduction
   - Uptime improvement
   - Customer satisfaction score
   - Defect density decrease

   If about COST/REVENUE:
   - Cost per transaction
   - Revenue per user
   - ROI percentage
   - Payback period

5. METRIC TRANSFORMATION EXAMPLES

   Vague: "Improved system performance"
   Quantified Options:
   - "Reduced page load time by 40% (3s to 1.8s)"
   - "Increased throughput by 150% (400 to 1000 RPS)"
   - "Cut server costs by $30K/month through optimization"

   Vague: "Led successful project"
   Quantified Options:
   - "Delivered project 2 weeks ahead of schedule"
   - "Managed $250K budget with 5% under budget"
   - "Coordinated team of 8 across 3 time zones"

Provide structured recommendations for discovering and estimating metrics from the vague achievement.`;
  }

  /**
   * Industry-specific metric generation
   */
  static getIndustryMetricPrompt(
    achievement: string,
    industry: string,
    role: string
  ): string {
    const industryMetrics: Record<string, string> = {
      'fintech': `
- Transaction volume and value
- Fraud detection rates
- Compliance metrics (false positive rate)
- Payment processing speed
- User verification time`,
      'e-commerce': `
- Conversion rate improvements
- Cart abandonment reduction
- Page load impact on sales
- Search relevancy scores
- Inventory optimization metrics`,
      'saas': `
- MRR/ARR growth
- Churn rate reduction
- CAC/LTV improvements
- Feature adoption rates
- API response times`,
      'healthcare': `
- Patient outcome improvements
- Clinical efficiency gains
- Compliance/HIPAA metrics
- Data processing accuracy
- Interoperability achievements`,
      'adtech': `
- CPM/CPC optimizations
- Viewability improvements
- Fraud detection accuracy
- Bid response times
- Attribution accuracy`
    };

    return `Generate industry-specific metrics for this achievement in the ${industry} sector.

ACHIEVEMENT: ${achievement}
ROLE: ${role}
INDUSTRY: ${industry}

INDUSTRY-SPECIFIC METRICS TO CONSIDER:
${industryMetrics[industry.toLowerCase()] || 'Standard technical and business metrics'}

Provide metrics that:
1. Align with ${industry} KPIs
2. Use industry-standard terminology
3. Reflect typical scale for ${industry}
4. Show understanding of domain challenges

Format with specific values and context.`;
  }
}

/**
 * Advanced metric strategies
 */
export class AdvancedMetricPrompts {
  /**
   * Metric relationship mapping
   */
  static getMetricRelationshipPrompt(
    metrics: Array<{metric: string; value: string; context: string}>
  ): string {
    return `Analyze the relationships between these metrics to tell a cohesive performance story.

METRICS:
${metrics.map((m, i) => `${i + 1}. ${m.metric}: ${m.value} (Context: ${m.context})`).join('\n')}

ANALYSIS TASKS:

1. IDENTIFY RELATIONSHIPS
   - Cause-effect relationships
   - Correlated improvements
   - Trade-offs made
   - Synergistic effects

2. CREATE NARRATIVE ARC
   - Which metric is the primary driver?
   - How do others support the main story?
   - What's the logical flow?

3. OPTIMIZE PRESENTATION
   - Best order to present metrics
   - How to connect them naturally
   - Which to emphasize vs. mention

4. CREDIBILITY CHECK
   - Do these metrics align logically?
   - Any that seem contradictory?
   - Missing metrics that would complete the story?

Provide a structured analysis with recommendations for presenting these metrics cohesively.`;
  }

  /**
   * Competitive differentiation through metrics
   */
  static getCompetitiveDifferentiationPrompt(
    achievements: string[],
    targetRole: string,
    competitorLevel: string
  ): string {
    return `Transform these achievements with metrics that differentiate from typical ${competitorLevel} candidates applying for ${targetRole}.

ACHIEVEMENTS:
${achievements.map((a, i) => `${i + 1}. ${a}`).join('\n')}

DIFFERENTIATION STRATEGY:

1. ABOVE-AVERAGE METRICS
   What metrics would be in the top 10-20% for this role?

2. UNIQUE ANGLE
   What metrics do most candidates not think to include?

3. DEPTH INDICATORS
   Metrics that show exceptional depth of impact

4. STRATEGIC THINKING
   Metrics that demonstrate business acumen beyond typical ${competitorLevel}

Provide specific metric recommendations that would make each achievement stand out in a competitive pool.`;
  }
}