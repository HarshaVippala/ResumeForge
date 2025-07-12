/**
 * Robust JSON Parser Utility
 * Handles malformed AI responses and provides fallback mechanisms
 * 
 * Last updated: 2025-07-09
 * Enhanced with caching, performance tracking, and optimized strategies
 */

import { createHash } from 'node:crypto';

export interface JsonParseResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  method?: string;
  fromCache?: boolean;
  processingTimeMs?: number;
}

interface ParseMetrics {
  totalAttempts: number;
  successfulAttempts: number;
  strategySuccessRates: Record<string, { attempts: number; successes: number }>;
  averageProcessingTime: number;
  cacheHitRate: number;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  method: string;
  hitCount: number;
}

export class RobustJsonParser {
  private static cache = new Map<string, CacheEntry<any>>();
  private static metrics: ParseMetrics = {
    totalAttempts: 0,
    successfulAttempts: 0,
    strategySuccessRates: {},
    averageProcessingTime: 0,
    cacheHitRate: 0
  };
  
  // Cache settings
  private static readonly CACHE_MAX_SIZE = 1000;
  private static readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  private static readonly ENABLE_CACHE = true;
  
  // Optimized strategy order based on empirical success rates
  private static readonly STRATEGY_ORDER = [
    'direct',
    'markdown_cleaned',
    'extracted',
    'repaired',
    'regex_patterns'
  ];

  /**
   * Parse JSON with multiple fallback strategies and caching
   */
  static parse<T = any>(text: string, options: {
    strict?: boolean;
    maxAttempts?: number;
    logAttempts?: boolean;
    enableCache?: boolean;
  } = {}): JsonParseResult<T> {
    const { strict = false, maxAttempts = 5, logAttempts = false, enableCache = true } = options;
    const startTime = Date.now();
    
    if (!text || typeof text !== 'string') {
      return {
        success: false,
        error: 'Invalid input: text must be a non-empty string',
        processingTimeMs: Date.now() - startTime
      };
    }

    const cleanedText = text.trim();
    if (!cleanedText) {
      return {
        success: false,
        error: 'Empty input after trimming',
        processingTimeMs: Date.now() - startTime
      };
    }

    // Update metrics
    this.metrics.totalAttempts++;

    // Check cache first
    if (enableCache && this.ENABLE_CACHE) {
      const cacheKey = this.generateCacheKey(cleanedText);
      const cachedResult = this.getFromCache<T>(cacheKey);
      
      if (cachedResult) {
        this.updateCacheHitRate(true);
        return {
          ...cachedResult,
          fromCache: true,
          processingTimeMs: Date.now() - startTime
        };
      }
    }

    this.updateCacheHitRate(false);

    // Try strategies in optimized order
    const strategies = [
      { name: 'direct', fn: () => JSON.parse(cleanedText) },
      { name: 'markdown_cleaned', fn: () => JSON.parse(this.cleanMarkdownCodeBlocks(cleanedText)) },
      { name: 'extracted', fn: () => {
          const extracted = this.extractJsonFromText(cleanedText);
          return extracted ? JSON.parse(extracted) : null;
        }
      },
      { name: 'repaired', fn: () => JSON.parse(this.repairCommonJsonIssues(cleanedText)) },
      { name: 'regex_patterns', fn: () => strict ? null : this.parseWithRegexPatterns(cleanedText) }
    ];

    let lastError: any = null;
    
    for (const strategy of strategies) {
      try {
        this.trackStrategyAttempt(strategy.name);
        const result = strategy.fn();
        
        if (result !== null && result !== undefined) {
          // Success - update metrics and cache
          this.metrics.successfulAttempts++;
          this.trackStrategySuccess(strategy.name);
          
          const processingTime = Date.now() - startTime;
          this.updateAverageProcessingTime(processingTime);
          
          const successResult: JsonParseResult<T> = {
            success: true,
            data: result,
            method: strategy.name,
            fromCache: false,
            processingTimeMs: processingTime
          };
          
          // Cache the result
          if (enableCache && this.ENABLE_CACHE) {
            const cacheKey = this.generateCacheKey(cleanedText);
            this.saveToCache(cacheKey, successResult);
          }
          
          // Conditional logging for debugging
          if (logAttempts && strategy.name !== 'direct') {
            console.log(`JSON parsed successfully with strategy: ${strategy.name}`);
          }
          
          return successResult;
        }
      } catch (error) {
        lastError = error;
        
        // Only log on first strategy failure to reduce noise
        if (logAttempts && strategy.name === 'direct') {
          console.log('Direct JSON.parse failed, trying fallback strategies');
        }
      }
    }

    // All strategies failed
    const processingTime = Date.now() - startTime;
    this.updateAverageProcessingTime(processingTime);
    
    return {
      success: false,
      error: `All parsing strategies failed. Last error: ${lastError?.message || 'Unknown error'}`,
      method: 'none',
      processingTimeMs: processingTime
    };
  }

  /**
   * Clean markdown code blocks and formatting
   */
  private static cleanMarkdownCodeBlocks(text: string): string {
    return text
      // Remove ```json and ``` markers
      .replace(/```json\s*/gi, '')
      .replace(/```\s*$/gm, '')
      // Remove backticks
      .replace(/^`+|`+$/g, '')
      // Remove leading/trailing whitespace
      .trim();
  }

  /**
   * Extract JSON from surrounding text using multiple strategies
   */
  private static extractJsonFromText(text: string): string | null {
    // Strategy 1: Find content between first { and last }
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1 && firstBrace < lastBrace) {
      const candidate = text.substring(firstBrace, lastBrace + 1);
      if (this.isValidJsonStructure(candidate)) {
        return candidate;
      }
    }

    // Strategy 2: Find content between first [ and last ]
    const firstBracket = text.indexOf('[');
    const lastBracket = text.lastIndexOf(']');
    
    if (firstBracket !== -1 && lastBracket !== -1 && firstBracket < lastBracket) {
      const candidate = text.substring(firstBracket, lastBracket + 1);
      if (this.isValidJsonStructure(candidate)) {
        return candidate;
      }
    }

    // Strategy 3: Use regex to find JSON-like structures
    const jsonRegex = /(\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})/g;
    const matches = text.match(jsonRegex);
    
    if (matches) {
      for (const match of matches) {
        if (this.isValidJsonStructure(match)) {
          return match;
        }
      }
    }

    return null;
  }

  /**
   * Repair common JSON issues
   */
  private static repairCommonJsonIssues(text: string): string {
    let repaired = text;

    // Remove leading/trailing non-JSON characters
    repaired = repaired.replace(/^[^{[]*/, '').replace(/[^}\]]*$/, '');

    // Fix trailing commas
    repaired = repaired.replace(/,(\s*[}\]])/g, '$1');

    // Fix single quotes to double quotes
    repaired = repaired.replace(/'/g, '"');

    // Fix unquoted keys (common AI mistake)
    repaired = repaired.replace(/(\w+):/g, '"$1":');

    // Fix escaped quotes in strings
    repaired = repaired.replace(/\\"/g, '\\"');

    // Fix boolean values
    repaired = repaired.replace(/:\s*True\b/g, ': true');
    repaired = repaired.replace(/:\s*False\b/g, ': false');
    repaired = repaired.replace(/:\s*None\b/g, ': null');

    // Fix missing quotes around string values
    repaired = repaired.replace(/:\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*([,}\]])/g, ': "$1"$2');

    return repaired;
  }

  /**
   * Parse using regex patterns for common structures
   */
  private static parseWithRegexPatterns(text: string): any | null {
    // Pattern for classification result
    const classificationPattern = /{[^{}]*"isJobRelated"[^{}]*}/i;
    const classificationMatch = text.match(classificationPattern);
    
    if (classificationMatch) {
      try {
        return JSON.parse(classificationMatch[0]);
      } catch (e) {
        // Try to extract fields manually
        const isJobRelated = /"isJobRelated":\s*(true|false)/i.exec(text);
        const category = /"category":\s*"([^"]+)"/i.exec(text);
        const confidence = /"confidence":\s*([\d.]+)/i.exec(text);
        const reasoning = /"reasoning":\s*"([^"]+)"/i.exec(text);

        if (isJobRelated) {
          return {
            isJobRelated: isJobRelated[1] === 'true',
            category: category ? category[1] : 'not_job_related',
            confidence: confidence ? parseFloat(confidence[1]) : 0.5,
            reasoning: reasoning ? reasoning[1] : 'Parsed from malformed response'
          };
        }
      }
    }

    // Pattern for extraction result
    const extractionPattern = /{[^{}]*"company"[^{}]*}/i;
    const extractionMatch = text.match(extractionPattern);
    
    if (extractionMatch) {
      try {
        return JSON.parse(extractionMatch[0]);
      } catch (e) {
        // Try to extract fields manually
        const company = /"company":\s*"([^"]+)"/i.exec(text);
        const position = /"position":\s*"([^"]+)"/i.exec(text);
        
        return {
          company: company ? company[1] : null,
          position: position ? position[1] : null,
        };
      }
    }

    // Pattern for summary result
    const summaryPattern = /{[^{}]*"summary"[^{}]*}/i;
    const summaryMatch = text.match(summaryPattern);
    
    if (summaryMatch) {
      try {
        return JSON.parse(summaryMatch[0]);
      } catch (e) {
        const summary = /"summary":\s*"([^"]+)"/i.exec(text);
        const urgency = /"urgency":\s*"([^"]+)"/i.exec(text);
        
        return {
          summary: summary ? summary[1] : 'Unable to parse summary',
          keyPoints: [],
          actionItems: [],
          urgency: urgency ? urgency[1] : 'low'
        };
      }
    }

    return null;
  }

  /**
   * Basic validation to check if text looks like JSON
   */
  private static isValidJsonStructure(text: string): boolean {
    const trimmed = text.trim();
    
    // Must start with { or [
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
      return false;
    }

    // Must end with } or ]
    if (!trimmed.endsWith('}') && !trimmed.endsWith(']')) {
      return false;
    }

    // Count braces and brackets
    let braceCount = 0;
    let bracketCount = 0;
    let inString = false;
    let escaped = false;

    for (let i = 0; i < trimmed.length; i++) {
      const char = trimmed[i];
      
      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === '\\') {
        escaped = true;
        continue;
      }

      if (char === '"' && !escaped) {
        inString = !inString;
        continue;
      }

      if (!inString) {
        if (char === '{') braceCount++;
        else if (char === '}') braceCount--;
        else if (char === '[') bracketCount++;
        else if (char === ']') bracketCount--;
      }
    }

    return braceCount === 0 && bracketCount === 0;
  }

  /**
   * Validate that parsed result has expected structure
   */
  static validateStructure<T>(data: any, expectedFields: string[]): data is T {
    if (!data || typeof data !== 'object') {
      return false;
    }

    return expectedFields.every(field => field in data);
  }

  /**
   * Parse with validation
   */
  static parseAndValidate<T>(
    text: string,
    expectedFields: string[],
    options: {
      strict?: boolean;
      maxAttempts?: number;
      logAttempts?: boolean;
      enableCache?: boolean;
    } = {}
  ): JsonParseResult<T> {
    const result = this.parse<T>(text, options);
    
    if (result.success && result.data) {
      if (this.validateStructure<T>(result.data, expectedFields)) {
        return result;
      } else {
        return {
          success: false,
          error: `Parsed data is missing expected fields: ${expectedFields.join(', ')}`
        };
      }
    }

    return result;
  }

  /**
   * Generate cache key for consistent hashing
   */
  private static generateCacheKey(text: string): string {
    return createHash('md5').update(text).digest('hex');
  }

  /**
   * Get cached result if available and not expired
   */
  private static getFromCache<T>(key: string): JsonParseResult<T> | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    // Check if cache entry is expired
    if (Date.now() - entry.timestamp > this.CACHE_TTL_MS) {
      this.cache.delete(key);
      return null;
    }
    
    // Update hit count
    entry.hitCount++;
    
    return {
      success: true,
      data: entry.data,
      method: entry.method,
      fromCache: true
    };
  }

  /**
   * Save result to cache with LRU eviction
   */
  private static saveToCache<T>(key: string, result: JsonParseResult<T>): void {
    // Ensure cache doesn't exceed max size
    if (this.cache.size >= this.CACHE_MAX_SIZE) {
      // Remove oldest entry (simple LRU)
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
    
    if (result.success && result.data !== undefined) {
      this.cache.set(key, {
        data: result.data,
        timestamp: Date.now(),
        method: result.method || 'unknown',
        hitCount: 0
      });
    }
  }

  /**
   * Track strategy attempt for metrics
   */
  private static trackStrategyAttempt(strategy: string): void {
    if (!this.metrics.strategySuccessRates[strategy]) {
      this.metrics.strategySuccessRates[strategy] = { attempts: 0, successes: 0 };
    }
    this.metrics.strategySuccessRates[strategy].attempts++;
  }

  /**
   * Track strategy success for metrics
   */
  private static trackStrategySuccess(strategy: string): void {
    if (!this.metrics.strategySuccessRates[strategy]) {
      this.metrics.strategySuccessRates[strategy] = { attempts: 0, successes: 0 };
    }
    this.metrics.strategySuccessRates[strategy].successes++;
  }

  /**
   * Update cache hit rate
   */
  private static updateCacheHitRate(isHit: boolean): void {
    const totalCacheQueries = this.metrics.totalAttempts;
    if (totalCacheQueries > 0) {
      const hits = isHit ? 1 : 0;
      this.metrics.cacheHitRate = (this.metrics.cacheHitRate * (totalCacheQueries - 1) + hits) / totalCacheQueries;
    }
  }

  /**
   * Update average processing time
   */
  private static updateAverageProcessingTime(processingTime: number): void {
    if (this.metrics.totalAttempts > 0) {
      this.metrics.averageProcessingTime = 
        (this.metrics.averageProcessingTime * (this.metrics.totalAttempts - 1) + processingTime) / this.metrics.totalAttempts;
    }
  }

  /**
   * Get comprehensive performance metrics
   */
  static getPerformanceMetrics(): ParseMetrics & {
    cacheSize: number;
    cacheEntries: Array<{ key: string; method: string; hitCount: number; age: number }>;
    strategyRankings: Array<{ strategy: string; successRate: number; avgProcessingTime: number }>;
  } {
    // Calculate strategy rankings
    const strategyRankings = Object.entries(this.metrics.strategySuccessRates)
      .map(([strategy, stats]) => ({
        strategy,
        successRate: stats.attempts > 0 ? stats.successes / stats.attempts : 0,
        avgProcessingTime: this.metrics.averageProcessingTime
      }))
      .sort((a, b) => b.successRate - a.successRate);

    // Get cache entry details
    const cacheEntries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key: key.substring(0, 8) + '...', // Show partial key for privacy
      method: entry.method,
      hitCount: entry.hitCount,
      age: Date.now() - entry.timestamp
    }));

    return {
      ...this.metrics,
      cacheSize: this.cache.size,
      cacheEntries,
      strategyRankings
    };
  }

  /**
   * Clear all metrics and cache
   */
  static clearMetrics(): void {
    this.metrics = {
      totalAttempts: 0,
      successfulAttempts: 0,
      strategySuccessRates: {},
      averageProcessingTime: 0,
      cacheHitRate: 0
    };
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  static getCacheStats(): {
    size: number;
    hitRate: number;
    totalHits: number;
    avgAge: number;
    topMethods: Array<{ method: string; count: number }>;
  } {
    const entries = Array.from(this.cache.values());
    const totalHits = entries.reduce((sum, entry) => sum + entry.hitCount, 0);
    const avgAge = entries.length > 0 
      ? entries.reduce((sum, entry) => sum + (Date.now() - entry.timestamp), 0) / entries.length 
      : 0;

    // Count methods
    const methodCounts = entries.reduce((acc, entry) => {
      acc[entry.method] = (acc[entry.method] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topMethods = Object.entries(methodCounts)
      .map(([method, count]) => ({ method, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      size: this.cache.size,
      hitRate: this.metrics.cacheHitRate,
      totalHits,
      avgAge,
      topMethods
    };
  }
}