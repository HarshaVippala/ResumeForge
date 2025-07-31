/**
 * Iterative Resume Optimizer
 * Implements Resume Matcher's iterative improvement approach
 * Created: 2025-01-09
 * Updated: 2025-01-10 - Added performance tracking metrics
 */

import { ATSScorer, ATSScore } from './ats-scorer';
import { EmbeddingService, SimilarityScore } from './embedding-service';
import { getSupabase } from '@/api/_lib/db';

export interface OptimizationResult {
  finalResume: any;
  iterations: IterationResult[];
  finalScore: number;
  improvement: number;
  converged: boolean;
  startTime?: number;
  endTime?: number;
  optimizationTimeMs?: number;
}

export interface IterationResult {
  iteration: number;
  resume: any;
  atsScore: ATSScore;
  similarityScore: SimilarityScore;
  combinedScore: number;
  feedback: string;
  improvementDelta: number;
}

export interface OptimizationOptions {
  maxIterations?: number;
  targetScore?: number;
  improvementThreshold?: number;
  verbose?: boolean;
}

export class IterativeOptimizer {
  private atsScorer: ATSScorer;
  private embeddingService: EmbeddingService;

  constructor(apiKey: string) {
    this.atsScorer = new ATSScorer();
    this.embeddingService = new EmbeddingService(apiKey);
  }

  /**
   * Iteratively optimize resume based on Resume Matcher's approach
   */
  async optimizeResume(
    baseResume: any,
    jobDescription: string,
    tailorFunction: (resume: any, feedback: string) => Promise<any>,
    options: OptimizationOptions = {}
  ): Promise<OptimizationResult> {
    const {
      maxIterations = 3,
      targetScore = 85,
      improvementThreshold = 5,
      verbose = false
    } = options;

    const startTime = Date.now();
    const iterations: IterationResult[] = [];
    let currentResume = baseResume;
    let previousScore = 0;
    let converged = false;

    // Extract keywords once for consistency
    const keywords = this.embeddingService.extractKeywords(jobDescription, 30);
    
    if (verbose) {
      console.log(`Extracted ${keywords.length} keywords:`, keywords);
    }

    for (let i = 0; i < maxIterations; i++) {
      // Calculate scores
      const atsScore = this.atsScorer.calculateATSScore(currentResume, keywords, jobDescription);
      const similarityScore = await this.embeddingService.calculateResumeSimilarity(
        JSON.stringify(currentResume),
        jobDescription,
        keywords
      );

      // Combined score (60% ATS, 40% similarity - Resume Matcher approach)
      const combinedScore = (atsScore.totalScore * 0.6) + (similarityScore.score * 100 * 0.4);
      const improvementDelta = combinedScore - previousScore;

      // Generate feedback for next iteration
      const feedback = this.generateFeedback(atsScore, similarityScore, i + 1);

      // Store iteration result
      iterations.push({
        iteration: i + 1,
        resume: currentResume,
        atsScore,
        similarityScore,
        combinedScore: Math.round(combinedScore),
        feedback,
        improvementDelta: Math.round(improvementDelta * 10) / 10
      });

      if (verbose) {
        console.log(`Iteration ${i + 1}: Score ${Math.round(combinedScore)}% (Δ ${improvementDelta > 0 ? '+' : ''}${improvementDelta.toFixed(1)}%)`);
      }

      // Check convergence conditions
      if (combinedScore >= targetScore) {
        converged = true;
        if (verbose) console.log(`Target score ${targetScore}% reached!`);
        break;
      }

      if (i > 0 && improvementDelta < improvementThreshold) {
        converged = true;
        if (verbose) console.log(`Improvement below threshold (${improvementDelta.toFixed(1)}% < ${improvementThreshold}%)`);
        break;
      }

      // Don't optimize on last iteration
      if (i < maxIterations - 1) {
        try {
          currentResume = await tailorFunction(currentResume, feedback);
          previousScore = combinedScore;
        } catch (error) {
          console.error(`Optimization failed at iteration ${i + 1}:`, error);
          break;
        }
      }
    }

    const finalIteration = iterations[iterations.length - 1];
    const initialScore = iterations[0].combinedScore;
    const finalScore = finalIteration.combinedScore;
    const endTime = Date.now();

    return {
      finalResume: finalIteration.resume,
      iterations,
      finalScore,
      improvement: finalScore - initialScore,
      converged,
      startTime,
      endTime,
      optimizationTimeMs: endTime - startTime
    };
  }

  /**
   * Generate specific feedback for the AI to improve the resume
   */
  private generateFeedback(atsScore: ATSScore, similarityScore: SimilarityScore, iteration: number): string {
    const feedback: string[] = [];

    // Priority 1: Add missing critical keywords
    if (similarityScore.missingKeywords.length > 0 && iteration <= 2) {
      const topMissing = similarityScore.missingKeywords.slice(0, 5);
      feedback.push(`CRITICAL: Add these missing keywords naturally: ${topMissing.join(', ')}`);
    }

    // Priority 2: Fix ATS formatting issues
    if (atsScore.breakdown.formatting < 80) {
      feedback.push('FORMATTING: Use standard section headers and remove special characters');
    }

    // Priority 3: Improve keyword density
    if (atsScore.breakdown.keywordMatch < 70) {
      const lowDensityKeywords = Object.entries(similarityScore.keywordDensity)
        .filter(([_, count]) => count < 2)
        .map(([keyword]) => keyword);
      
      if (lowDensityKeywords.length > 0) {
        feedback.push(`KEYWORDS: Increase presence of: ${lowDensityKeywords.slice(0, 3).join(', ')}`);
      }
    }

    // Priority 4: Content optimization
    if (atsScore.breakdown.readability < 80) {
      feedback.push('CONTENT: Use more action verbs and quantify achievements');
    }

    // Priority 5: Section improvements
    const missingKeywords = atsScore.missingKeywords;
    if (missingKeywords.length > 0) {
      feedback.push(`SECTIONS: Ensure these topics are covered: ${missingKeywords.slice(0, 3).join(', ')}`);
    }

    // Iteration-specific guidance
    if (iteration === 1) {
      feedback.unshift('FOCUS: Maximize keyword coverage while maintaining natural flow');
    } else if (iteration === 2) {
      feedback.unshift('FOCUS: Fine-tune keyword placement and strengthen achievements');
    } else {
      feedback.unshift('FOCUS: Polish and optimize without over-stuffing keywords');
    }

    return feedback.join('\n');
  }

  /**
   * Save optimization metrics to database
   */
  async saveOptimizationMetrics(
    result: OptimizationResult,
    jobId: string,
    resumeId: string,
    userId?: string,
    modelInfo?: { name: string; version: string }
  ): Promise<string | null> {
    try {
      const db = getSupabase();
      const initialIteration = result.iterations[0];
      const finalIteration = result.iterations[result.iterations.length - 1];

      // Prepare keyword improvements data
      const keywordImprovements = {
        added: finalIteration.similarityScore.matchedKeywords.filter(
          k => !initialIteration.similarityScore.matchedKeywords.includes(k)
        ),
        removed: initialIteration.similarityScore.matchedKeywords.filter(
          k => !finalIteration.similarityScore.matchedKeywords.includes(k)
        ),
        density_changes: {} as Record<string, { before: number; after: number }>
      };

      // Calculate density changes for common keywords
      const allKeywords = new Set([
        ...Object.keys(initialIteration.similarityScore.keywordDensity),
        ...Object.keys(finalIteration.similarityScore.keywordDensity)
      ]);

      allKeywords.forEach(keyword => {
        const before = initialIteration.similarityScore.keywordDensity[keyword] || 0;
        const after = finalIteration.similarityScore.keywordDensity[keyword] || 0;
        if (before !== after) {
          keywordImprovements.density_changes[keyword] = { before, after };
        }
      });

      // Prepare iteration scores array
      const iterationScores = result.iterations.map(iter => ({
        iteration: iter.iteration,
        score: iter.combinedScore,
        ats_score: iter.atsScore.totalScore,
        similarity_score: iter.similarityScore.score
      }));

      // Prepare feedback history
      const feedbackHistory = result.iterations.map(iter => ({
        iteration: iter.iteration,
        feedback: iter.feedback
      }));

      const { data, error } = await db
        .from('optimization_metrics')
        .insert({
          user_id: userId,
          job_id: jobId,
          resume_id: resumeId,
          initial_score: initialIteration.combinedScore,
          final_score: finalIteration.combinedScore,
          iterations: result.iterations.length,
          converged: result.converged,
          optimization_time_ms: result.optimizationTimeMs || 0,
          initial_keywords_matched: initialIteration.similarityScore.matchedKeywords.length,
          final_keywords_matched: finalIteration.similarityScore.matchedKeywords.length,
          keyword_improvements: keywordImprovements,
          initial_ats_score: {
            totalScore: initialIteration.atsScore.totalScore,
            breakdown: initialIteration.atsScore.breakdown,
            keywordCoverage: initialIteration.atsScore.keywordCoverage
          },
          final_ats_score: {
            totalScore: finalIteration.atsScore.totalScore,
            breakdown: finalIteration.atsScore.breakdown,
            keywordCoverage: finalIteration.atsScore.keywordCoverage
          },
          model_name: modelInfo?.name || 'gemini-2.0-flash-lite',
          model_version: modelInfo?.version || '2.0',
          optimization_strategy: 'resume-matcher-iterative',
          feedback_history: feedbackHistory,
          iteration_scores: iterationScores
        })
        .select()
        .single();

      if (error) {
        console.error('Failed to save optimization metrics:', error);
        return null;
      }

      return data?.id || null;
    } catch (error) {
      console.error('Error saving optimization metrics:', error);
      return null;
    }
  }

  /**
   * Analyze optimization results and provide insights
   */
  analyzeOptimizationResults(result: OptimizationResult): {
    summary: string;
    strengths: string[];
    improvements: string[];
    keyMetrics: { [key: string]: number };
  } {
    const initial = result.iterations[0];
    const final = result.iterations[result.iterations.length - 1];

    const strengths: string[] = [];
    const improvements: string[] = [];

    // Analyze improvements
    if (final.atsScore.breakdown.keywordMatch > initial.atsScore.breakdown.keywordMatch + 10) {
      strengths.push(`Keyword coverage improved by ${Math.round(final.atsScore.breakdown.keywordMatch - initial.atsScore.breakdown.keywordMatch)}%`);
    }

    if (final.similarityScore.matchedKeywords.length > initial.similarityScore.matchedKeywords.length) {
      strengths.push(`Added ${final.similarityScore.matchedKeywords.length - initial.similarityScore.matchedKeywords.length} relevant keywords`);
    }

    if (final.atsScore.breakdown.formatting >= 90) {
      strengths.push('ATS-friendly formatting achieved');
    }

    // Identify remaining improvements
    if (final.similarityScore.missingKeywords.length > 5) {
      improvements.push(`Still missing ${final.similarityScore.missingKeywords.length} keywords`);
    }

    if (final.atsScore.totalScore < 80) {
      improvements.push('ATS score could be further improved');
    }

    const summary = result.converged 
      ? `Optimization converged after ${result.iterations.length} iterations with ${result.improvement.toFixed(1)}% improvement`
      : `Completed ${result.iterations.length} iterations with ${result.improvement.toFixed(1)}% improvement`;

    const keyMetrics = {
      initialScore: initial.combinedScore,
      finalScore: final.combinedScore,
      improvement: result.improvement,
      keywordCoverage: final.atsScore.keywordCoverage,
      atsScore: final.atsScore.totalScore,
      similarityScore: Math.round(final.similarityScore.score * 100)
    };

    return {
      summary,
      strengths,
      improvements,
      keyMetrics
    };
  }
}