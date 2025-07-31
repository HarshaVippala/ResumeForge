/**
 * AI Rate Limiter Module
 * 
 * Handles rate limiting for AI API calls across multiple providers.
 * Implements exponential backoff, request queuing, and model fallback.
 * 
 * Last updated: 2025-07-09
 */

import { Redis } from '@upstash/redis';

// API Rate Limits Configuration
export const API_RATE_LIMITS = {
  // Google Gemini Tier 1 (Paid) - Updated 2025-07-09
  'gemini-2.0-flash': {
    requestsPerMinute: 1000, // Tier 1 limit
    requestsPerDay: 1_500_000, // Tier 1 limit
    tokensPerMinute: 4_000_000, // 4M TPM for Tier 1
    tokensPerDay: null, // No daily token limit
    burstSize: 50, // Allow larger burst with Tier 1
    provider: 'google',
    tier: 'tier1',
    costPerMillionTokens: 0.075 // $0.075 per million input tokens
  },
  'gemini-1.5-flash': {
    requestsPerMinute: 1000, // Tier 1 limit
    requestsPerDay: 1_500_000, // Tier 1 limit
    tokensPerMinute: 4_000_000, // 4M TPM for Tier 1
    tokensPerDay: null,
    burstSize: 50,
    provider: 'google',
    tier: 'tier1',
    costPerMillionTokens: 0.075
  },
  'gemini-1.5-pro': {
    requestsPerMinute: 360, // Tier 1 limit for Pro
    requestsPerDay: 30_000, // Tier 1 limit for Pro
    tokensPerMinute: 4_000_000, // 4M TPM for Tier 1
    tokensPerDay: null,
    burstSize: 20,
    provider: 'google',
    tier: 'tier1',
    costPerMillionTokens: 1.25 // $1.25 per million input tokens
  },
  // Alternative free models (future expansion)
  'claude-instant-1.2': {
    requestsPerMinute: 0, // Not available on free tier
    requestsPerDay: 0,
    tokensPerMinute: 0,
    tokensPerDay: 0,
    burstSize: 0,
    provider: 'anthropic',
    tier: 'paid',
    costPerMillionTokens: 0.80
  },
  'gpt-3.5-turbo': {
    requestsPerMinute: 3, // OpenAI free tier is very limited
    requestsPerDay: 200,
    tokensPerMinute: 40_000,
    tokensPerDay: null,
    burstSize: 1,
    provider: 'openai',
    tier: 'free',
    costPerMillionTokens: 0.50
  }
} as const;

export type ModelName = keyof typeof API_RATE_LIMITS;

// Rate limiting strategy
export interface RateLimitStrategy {
  initialSync: {
    models: ModelName[];
    batchSize: number;
    delayBetweenBatches: number;
    maxConcurrent: number;
  };
  realtime: {
    models: ModelName[];
    maxRetries: number;
    baseDelay: number;
  };
}

// Default strategies - Updated for Tier 1
export const RATE_LIMIT_STRATEGIES: Record<string, RateLimitStrategy> = {
  conservative: {
    initialSync: {
      models: ['gemini-2.0-flash', 'gemini-1.5-flash'],
      batchSize: 10, // Increased for Tier 1
      delayBetweenBatches: 1000, // 1 second - reduced for Tier 1
      maxConcurrent: 5
    },
    realtime: {
      models: ['gemini-2.0-flash', 'gemini-1.5-flash'],
      maxRetries: 3,
      baseDelay: 500
    }
  },
  aggressive: {
    initialSync: {
      models: ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'],
      batchSize: 20, // Much larger batches with Tier 1
      delayBetweenBatches: 500, // 0.5 seconds
      maxConcurrent: 10
    },
    realtime: {
      models: ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'],
      maxRetries: 5,
      baseDelay: 200
    }
  },
  tier1: {
    initialSync: {
      models: ['gemini-2.0-flash'], // Use best model with Tier 1
      batchSize: 30, // Optimal for Tier 1 limits
      delayBetweenBatches: 200, // Minimal delay
      maxConcurrent: 15
    },
    realtime: {
      models: ['gemini-2.0-flash', 'gemini-1.5-flash'],
      maxRetries: 3,
      baseDelay: 100
    }
  },
  development: {
    initialSync: {
      models: ['gemini-2.0-flash'], // Use 2.0 Flash in dev too
      batchSize: 5,
      delayBetweenBatches: 2000, // 2 seconds
      maxConcurrent: 3
    },
    realtime: {
      models: ['gemini-2.0-flash'],
      maxRetries: 2,
      baseDelay: 1000
    }
  }
};

// Request queue item
interface QueueItem {
  id: string;
  model: ModelName;
  priority: number;
  timestamp: number;
  retries: number;
  callback: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
}

// Rate limiter state
interface RateLimiterState {
  requests: Map<ModelName, number[]>; // Timestamps of recent requests
  tokens: Map<ModelName, number>; // Tokens used in current window
  dailyRequests: Map<ModelName, number>; // Daily request count
  queue: QueueItem[];
  processing: boolean;
}

/**
 * AI Rate Limiter Class
 * 
 * Manages rate limiting across multiple AI providers and models.
 */
export class AIRateLimiter {
  private state: RateLimiterState;
  private strategy: RateLimitStrategy;
  private redis?: Redis;
  private instanceId: string;

  constructor(
    strategyName: keyof typeof RATE_LIMIT_STRATEGIES = 'conservative',
    redisUrl?: string
  ) {
    this.state = {
      requests: new Map(),
      tokens: new Map(),
      dailyRequests: new Map(),
      queue: [],
      processing: false
    };

    this.strategy = RATE_LIMIT_STRATEGIES[strategyName];
    this.instanceId = `rate-limiter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Initialize Redis for distributed rate limiting (optional)
    if (redisUrl) {
      try {
        this.redis = new Redis({ url: redisUrl });
      } catch (error) {
        console.warn('Failed to initialize Redis for rate limiting:', error);
      }
    }

    // Initialize state for all models
    Object.keys(API_RATE_LIMITS).forEach(model => {
      this.state.requests.set(model as ModelName, []);
      this.state.tokens.set(model as ModelName, 0);
      this.state.dailyRequests.set(model as ModelName, 0);
    });

    // Start queue processor
    this.startQueueProcessor();

    // Reset daily counters at midnight
    this.scheduleDailyReset();
  }

  /**
   * Check if a request can be made for a given model
   */
  async canMakeRequest(
    model: ModelName,
    estimatedTokens: number = 0
  ): Promise<{ allowed: boolean; waitTime?: number; reason?: string }> {
    const limits = API_RATE_LIMITS[model];
    const now = Date.now();
    const oneMinuteAgo = now - 60_000;

    // Clean up old request timestamps
    const recentRequests = (this.state.requests.get(model) || [])
      .filter(timestamp => timestamp > oneMinuteAgo);
    this.state.requests.set(model, recentRequests);

    // Check rate limit
    if (recentRequests.length >= limits.requestsPerMinute) {
      const oldestRequest = Math.min(...recentRequests);
      const waitTime = 60_000 - (now - oldestRequest);
      return {
        allowed: false,
        waitTime,
        reason: `Rate limit exceeded: ${limits.requestsPerMinute} requests per minute`
      };
    }

    // Check daily limit
    const dailyCount = await this.getDailyRequestCount(model);
    if (limits.requestsPerDay && dailyCount >= limits.requestsPerDay) {
      return {
        allowed: false,
        reason: `Daily limit exceeded: ${limits.requestsPerDay} requests per day`
      };
    }

    // Check token limit
    const recentTokens = this.state.tokens.get(model) || 0;
    if (limits.tokensPerMinute && recentTokens + estimatedTokens > limits.tokensPerMinute) {
      return {
        allowed: false,
        waitTime: 60_000, // Wait a full minute for token reset
        reason: `Token limit exceeded: ${limits.tokensPerMinute} tokens per minute`
      };
    }

    return { allowed: true };
  }

  /**
   * Record a request for rate limiting
   */
  async recordRequest(
    model: ModelName,
    tokensUsed: number = 0
  ): Promise<void> {
    const now = Date.now();
    
    // Record timestamp
    const requests = this.state.requests.get(model) || [];
    requests.push(now);
    this.state.requests.set(model, requests);

    // Record tokens
    const currentTokens = this.state.tokens.get(model) || 0;
    this.state.tokens.set(model, currentTokens + tokensUsed);

    // Increment daily counter
    await this.incrementDailyRequestCount(model);

    // Schedule token reset after 1 minute
    setTimeout(() => {
      const tokens = this.state.tokens.get(model) || 0;
      this.state.tokens.set(model, Math.max(0, tokens - tokensUsed));
    }, 60_000);
  }

  /**
   * Execute a request with rate limiting
   */
  async executeWithRateLimit<T>(
    callback: () => Promise<T>,
    options: {
      model?: ModelName;
      priority?: number;
      estimatedTokens?: number;
      fallbackModels?: ModelName[];
    } = {}
  ): Promise<T> {
    const {
      model = 'gemini-2.0-flash',
      priority = 5,
      estimatedTokens = 0,
      fallbackModels = this.strategy.realtime.models.filter(m => m !== model)
    } = options;

    // Try primary model first
    const canUse = await this.canMakeRequest(model, estimatedTokens);
    if (canUse.allowed) {
      try {
        await this.recordRequest(model, estimatedTokens);
        return await this.executeWithRetry(callback, model);
      } catch (error: any) {
        if (error?.status === 429) {
          console.warn(`Rate limit hit for ${model}, trying fallback models`);
        } else if (this.isRetryableError(error)) {
          console.warn(`Retryable error for ${model}: ${error.message}`);
        } else {
          throw error;
        }
      }
    }

    // Try fallback models
    for (const fallbackModel of fallbackModels) {
      const canUseFallback = await this.canMakeRequest(fallbackModel, estimatedTokens);
      if (canUseFallback.allowed) {
        try {
          console.log(`Using fallback model: ${fallbackModel}`);
          await this.recordRequest(fallbackModel, estimatedTokens);
          return await this.executeWithRetry(callback, fallbackModel);
        } catch (error: any) {
          if (error?.status !== 429 && !this.isRetryableError(error)) {
            throw error;
          }
        }
      }
    }

    // If all models are rate limited, queue the request
    return this.queueRequest(callback, model, priority);
  }

  /**
   * Queue a request for later execution
   */
  private async queueRequest<T>(
    callback: () => Promise<T>,
    model: ModelName,
    priority: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const item: QueueItem = {
        id: `${Date.now()}-${Math.random()}`,
        model,
        priority,
        timestamp: Date.now(),
        retries: 0,
        callback,
        resolve,
        reject
      };

      // Insert in priority order (higher priority first)
      const insertIndex = this.state.queue.findIndex(q => q.priority < priority);
      if (insertIndex === -1) {
        this.state.queue.push(item);
      } else {
        this.state.queue.splice(insertIndex, 0, item);
      }

      console.log(`Request queued. Queue size: ${this.state.queue.length}`);
    });
  }

  /**
   * Process queued requests
   */
  private async startQueueProcessor(): Promise<void> {
    if (this.state.processing) return;
    this.state.processing = true;

    while (true) {
      if (this.state.queue.length === 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }

      const item = this.state.queue[0];
      const canUse = await this.canMakeRequest(item.model);

      if (canUse.allowed) {
        this.state.queue.shift(); // Remove from queue
        
        try {
          await this.recordRequest(item.model);
          const result = await item.callback();
          item.resolve(result);
        } catch (error) {
          item.retries++;
          
          // Check if error is retryable
          if (item.retries < this.strategy.realtime.maxRetries && this.isRetryableError(error)) {
            // Re-queue with exponential backoff
            const delay = this.calculateBackoffDelay(item.retries - 1);
            console.log(`Retrying request after ${delay}ms (attempt ${item.retries}/${this.strategy.realtime.maxRetries})`);
            
            setTimeout(() => {
              this.state.queue.push(item);
            }, delay);
          } else {
            // Log final error details
            console.error('Queue item failed after all retries:', {
              id: item.id,
              model: item.model,
              retries: item.retries,
              error: error instanceof Error ? error.message : 'Unknown error',
              isRetryable: this.isRetryableError(error)
            });
            item.reject(error);
          }
        }
      } else {
        // Wait before checking again
        await new Promise(resolve => setTimeout(resolve, canUse.waitTime || 5000));
      }
    }
  }

  /**
   * Get current queue status
   */
  getQueueStatus(): {
    queueLength: number;
    processing: boolean;
    modelStatus: Record<ModelName, {
      recentRequests: number;
      dailyRequests: number;
      availableRequests: number;
    }>;
  } {
    const modelStatus: any = {};
    
    for (const [model, limits] of Object.entries(API_RATE_LIMITS)) {
      const recentRequests = (this.state.requests.get(model as ModelName) || [])
        .filter(ts => ts > Date.now() - 60_000).length;
      const dailyRequests = this.state.dailyRequests.get(model as ModelName) || 0;
      
      modelStatus[model] = {
        recentRequests,
        dailyRequests,
        availableRequests: limits.requestsPerMinute - recentRequests
      };
    }

    return {
      queueLength: this.state.queue.length,
      processing: this.state.processing,
      modelStatus
    };
  }

  /**
   * Get optimal batch size for initial sync
   */
  getOptimalBatchSize(totalEmails: number): {
    batchSize: number;
    estimatedTime: number;
    strategy: string;
  } {
    const { batchSize, delayBetweenBatches } = this.strategy.initialSync;
    const batches = Math.ceil(totalEmails / batchSize);
    const estimatedTime = batches * delayBetweenBatches + (batches * batchSize * 2000); // 2s per email estimate

    return {
      batchSize,
      estimatedTime,
      strategy: `Process ${batchSize} emails per batch with ${delayBetweenBatches}ms delay`
    };
  }

  /**
   * Reset rate limiter state
   */
  reset(): void {
    this.state.requests.clear();
    this.state.tokens.clear();
    this.state.queue = [];
    
    // Reinitialize
    Object.keys(API_RATE_LIMITS).forEach(model => {
      this.state.requests.set(model as ModelName, []);
      this.state.tokens.set(model as ModelName, 0);
    });
  }

  /**
   * Get daily request count (with Redis support)
   */
  private async getDailyRequestCount(model: ModelName): Promise<number> {
    if (this.redis) {
      try {
        const key = `rate-limit:daily:${model}:${new Date().toISOString().split('T')[0]}`;
        const count = await this.redis.get(key);
        return count ? parseInt(count as string, 10) : 0;
      } catch (error) {
        console.warn('Redis error, falling back to local state:', error);
      }
    }
    
    return this.state.dailyRequests.get(model) || 0;
  }

  /**
   * Increment daily request count
   */
  private async incrementDailyRequestCount(model: ModelName): Promise<void> {
    const current = this.state.dailyRequests.get(model) || 0;
    this.state.dailyRequests.set(model, current + 1);

    if (this.redis) {
      try {
        const key = `rate-limit:daily:${model}:${new Date().toISOString().split('T')[0]}`;
        await this.redis.incr(key);
        await this.redis.expire(key, 86400); // Expire after 24 hours
      } catch (error) {
        console.warn('Redis error:', error);
      }
    }
  }

  /**
   * Schedule daily counter reset
   */
  private scheduleDailyReset(): void {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const msUntilMidnight = tomorrow.getTime() - now.getTime();
    
    setTimeout(() => {
      // Reset daily counters
      for (const model of Object.keys(API_RATE_LIMITS)) {
        this.state.dailyRequests.set(model as ModelName, 0);
      }
      
      console.log('Daily rate limit counters reset');
      
      // Schedule next reset
      this.scheduleDailyReset();
    }, msUntilMidnight);
  }

  /**
   * Execute callback with retry logic for transient errors
   */
  private async executeWithRetry<T>(
    callback: () => Promise<T>,
    model: ModelName,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await callback();
      } catch (error: any) {
        lastError = error;
        
        if (!this.isRetryableError(error)) {
          throw error;
        }
        
        if (attempt < maxRetries - 1) {
          const delay = this.calculateBackoffDelay(attempt);
          console.log(`Retry attempt ${attempt + 1}/${maxRetries} for ${model} after ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    if (!error) return false;
    
    // HTTP status codes that indicate transient errors
    const retryableStatuses = [500, 502, 503, 504, 429];
    if (error.status && retryableStatuses.includes(error.status)) {
      return true;
    }
    
    // Error messages that indicate transient issues
    const errorMessage = error.message?.toLowerCase() || '';
    const retryableMessages = [
      'network error',
      'connection error',
      'timeout',
      'internal server error',
      'service unavailable',
      'bad gateway',
      'gateway timeout'
    ];
    
    return retryableMessages.some(msg => errorMessage.includes(msg));
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoffDelay(attempt: number): number {
    const baseDelay = 1000; // 1 second
    const maxDelay = 30000; // 30 seconds
    const jitter = Math.random() * 0.1; // 10% jitter
    
    const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
    return Math.floor(delay * (1 + jitter));
  }

  /**
   * Get rate limit recommendations
   */
  getRecommendations(emailCount: number): {
    model: ModelName;
    strategy: string;
    warnings: string[];
  } {
    const warnings: string[] = [];
    let recommendedModel: ModelName = 'gemini-2.0-flash';
    let strategy = 'tier1';

    // Calculate requests needed (3 per email: classify, extract, summarize)
    const requestsNeeded = emailCount * 3;

    // With Tier 1, we can handle much larger volumes
    if (requestsNeeded > 1_500_000) {
      warnings.push(`Processing ${emailCount} emails requires ${requestsNeeded} API calls, which exceeds daily Tier 1 limits`);
      warnings.push('Consider processing over multiple days');
    }

    if (emailCount > 10000) {
      warnings.push('Very large email volume detected. Processing will be optimized for Tier 1 limits');
      strategy = 'Process in optimized batches of 30 with minimal delays';
    }

    // Calculate estimated time
    const batchSize = 30;
    const batches = Math.ceil(emailCount / batchSize);
    const estimatedMinutes = Math.round((batches * 0.2 + emailCount * 0.1) / 60);
    
    if (estimatedMinutes > 30) {
      warnings.push(`Estimated processing time: ${estimatedMinutes} minutes`);
    }

    return {
      model: recommendedModel,
      strategy,
      warnings
    };
  }
}

// Export singleton instance with Tier 1 strategy
export const aiRateLimiter = new AIRateLimiter(
  process.env.NODE_ENV === 'development' ? 'development' : 'tier1'
);