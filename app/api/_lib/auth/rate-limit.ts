/**
 * Simple in-memory rate limiting for authentication endpoints
 * Suitable for personal use applications
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
  lastAttempt: number;
}

// In-memory storage for rate limiting
const rateLimitStore = new Map<string, RateLimitEntry>();

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
  // 10 attempts per minute for passkey endpoints
  passkey: {
    maxAttempts: 10,
    windowMinutes: 1,
  },
  // 5 attempts per minute for other auth endpoints
  auth: {
    maxAttempts: 5,
    windowMinutes: 1,
  },
};

/**
 * Get client IP address from request
 */
function getClientIP(request: Request): string {
  // Check various headers for IP address
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const cfConnectingIP = request.headers.get('cf-connecting-ip');
  
  // Use the first IP from x-forwarded-for or fall back to other headers
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  
  if (realIP) {
    return realIP;
  }
  
  if (cfConnectingIP) {
    return cfConnectingIP;
  }
  
  // Default fallback (should not happen in production)
  return 'unknown';
}

/**
 * Clean up expired entries to prevent memory leaks
 */
function cleanupExpiredEntries(): void {
  const now = Date.now();
  
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Check if request is rate limited
 */
export function isRateLimited(
  request: Request,
  endpoint: 'passkey' | 'auth'
): {
  isLimited: boolean;
  remainingAttempts: number;
  resetTime: number;
} {
  const ip = getClientIP(request);
  const key = `${endpoint}:${ip}`;
  const config = RATE_LIMIT_CONFIG[endpoint];
  const now = Date.now();
  const windowMs = config.windowMinutes * 60 * 1000;
  
  // Clean up expired entries periodically
  if (Math.random() < 0.1) { // 10% chance to clean up
    cleanupExpiredEntries();
  }
  
  const entry = rateLimitStore.get(key);
  
  if (!entry) {
    // First request from this IP
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + windowMs,
      lastAttempt: now,
    });
    
    return {
      isLimited: false,
      remainingAttempts: config.maxAttempts - 1,
      resetTime: now + windowMs,
    };
  }
  
  // Check if window has expired
  if (now > entry.resetTime) {
    // Reset the window
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + windowMs,
      lastAttempt: now,
    });
    
    return {
      isLimited: false,
      remainingAttempts: config.maxAttempts - 1,
      resetTime: now + windowMs,
    };
  }
  
  // Check if rate limit exceeded
  if (entry.count >= config.maxAttempts) {
    return {
      isLimited: true,
      remainingAttempts: 0,
      resetTime: entry.resetTime,
    };
  }
  
  // Increment counter
  entry.count++;
  entry.lastAttempt = now;
  
  return {
    isLimited: false,
    remainingAttempts: config.maxAttempts - entry.count,
    resetTime: entry.resetTime,
  };
}

/**
 * Reset rate limit for a specific IP and endpoint (called on successful auth)
 */
export function resetRateLimit(request: Request, endpoint: 'passkey' | 'auth'): void {
  const ip = getClientIP(request);
  const key = `${endpoint}:${ip}`;
  
  rateLimitStore.delete(key);
}

/**
 * Get rate limit status for debugging
 */
export function getRateLimitStatus(request: Request, endpoint: 'passkey' | 'auth'): {
  currentCount: number;
  maxAttempts: number;
  resetTime: number;
} {
  const ip = getClientIP(request);
  const key = `${endpoint}:${ip}`;
  const config = RATE_LIMIT_CONFIG[endpoint];
  const entry = rateLimitStore.get(key);
  
  if (!entry) {
    return {
      currentCount: 0,
      maxAttempts: config.maxAttempts,
      resetTime: 0,
    };
  }
  
  return {
    currentCount: entry.count,
    maxAttempts: config.maxAttempts,
    resetTime: entry.resetTime,
  };
}

/**
 * Create rate limit response
 */
export function createRateLimitResponse(resetTime: number): Response {
  const resetTimeSeconds = Math.ceil((resetTime - Date.now()) / 1000);
  
  return new Response(
    JSON.stringify({
      error: 'Rate limit exceeded',
      message: 'Too many attempts. Please try again later.',
      retryAfter: resetTimeSeconds,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': resetTimeSeconds.toString(),
        'X-RateLimit-Reset': Math.ceil(resetTime / 1000).toString(),
      },
    }
  );
}