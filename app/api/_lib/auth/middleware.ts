import { NextRequest, NextResponse } from 'next/server';
import { VercelRequest, VercelResponse } from '@vercel/node';
import { development, features } from '../config';

/**
 * Authentication middleware for API routes
 * - Allows same-origin requests (browser access)
 * - Requires API key for external access
 * - Works with both Edge and Node runtimes
 * - Can be disabled in development with DISABLE_AUTH_IN_DEV=true
 */

// Log auth bypass warning once per process
let authBypassWarningLogged = false;

/**
 * Check if the request is from the same origin (Edge runtime)
 */
function isSameOriginEdge(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const host = request.headers.get('host');
  
  if (!origin && !referer) {
    // Direct API call without origin/referer (could be server-side)
    return false;
  }
  
  const requestUrl = new URL(request.url);
  const baseUrl = `${requestUrl.protocol}//${host}`;
  
  // Check if origin matches
  if (origin && origin === baseUrl) {
    return true;
  }
  
  // Check if referer matches
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      return refererUrl.origin === baseUrl;
    } catch {
      return false;
    }
  }
  
  return false;
}

/**
 * Check if the request is from the same origin (Node runtime)
 */
function isSameOriginNode(req: VercelRequest): boolean {
  const origin = req.headers.origin as string | undefined;
  const referer = req.headers.referer as string | undefined;
  const host = req.headers.host as string | undefined;
  
  if (!origin && !referer) {
    // Direct API call without origin/referer (could be server-side)
    return false;
  }
  
  // Construct base URL
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const baseUrl = `${protocol}://${host}`;
  
  // Check if origin matches
  if (origin && origin === baseUrl) {
    return true;
  }
  
  // Check if referer matches
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      return refererUrl.origin === baseUrl;
    } catch {
      return false;
    }
  }
  
  return false;
}

/**
 * Authenticate the request (Edge runtime)
 */
export function authenticateEdge(request: NextRequest): NextResponse | null {
  // DEVELOPMENT ONLY: Skip auth if disabled
  if (development.disableAuth) {
    if (!authBypassWarningLogged) {
      console.warn('⚠️  WARNING: Authentication is DISABLED in development mode!');
      console.warn('   This is configured via DISABLE_AUTH_IN_DEV=true');
      console.warn('   Set DISABLE_AUTH_IN_DEV=false to enable authentication');
      authBypassWarningLogged = true;
    }
    return null; // Continue to handler
  }

  // SETUP MODE: Skip auth if setup mode is enabled
  if (features.setupMode) {
    if (!authBypassWarningLogged) {
      console.warn('⚠️  WARNING: Authentication is DISABLED - Setup mode is enabled!');
      console.warn('   This is configured via ENABLE_SETUP_MODE=true');
      console.warn('   Set ENABLE_SETUP_MODE=false after initial setup');
      authBypassWarningLogged = true;
    }
    return null; // Continue to handler
  }
  
  // Allow same-origin requests (browser access)
  if (isSameOriginEdge(request)) {
    return null; // Continue to handler
  }
  
  // For external requests, check API key
  const apiKey = request.headers.get('x-api-key');
  const expectedApiKey = process.env.PERSONAL_API_KEY;
  
  // If no API key is configured, deny all external requests
  if (!expectedApiKey) {
    return NextResponse.json(
      { error: 'API authentication not configured' },
      { status: 500 }
    );
  }
  
  // Check if API key is provided and valid
  if (!apiKey || apiKey !== expectedApiKey) {
    return NextResponse.json(
      { error: 'Unauthorized - Invalid or missing API key' },
      { status: 401 }
    );
  }
  
  return null; // Continue to handler
}

/**
 * Authenticate the request (Node runtime)
 */
export function authenticateNode(req: VercelRequest, res: VercelResponse): boolean {
  // DEVELOPMENT ONLY: Skip auth if disabled
  if (development.disableAuth) {
    if (!authBypassWarningLogged) {
      console.warn('⚠️  WARNING: Authentication is DISABLED in development mode!');
      console.warn('   This is configured via DISABLE_AUTH_IN_DEV=true');
      console.warn('   Set DISABLE_AUTH_IN_DEV=false to enable authentication');
      authBypassWarningLogged = true;
    }
    return true; // Continue to handler
  }

  // SETUP MODE: Skip auth if setup mode is enabled
  if (features.setupMode) {
    if (!authBypassWarningLogged) {
      console.warn('⚠️  WARNING: Authentication is DISABLED - Setup mode is enabled!');
      console.warn('   This is configured via ENABLE_SETUP_MODE=true');
      console.warn('   Set ENABLE_SETUP_MODE=false after initial setup');
      authBypassWarningLogged = true;
    }
    return true; // Continue to handler
  }
  
  // Allow same-origin requests (browser access)
  if (isSameOriginNode(req)) {
    return true; // Continue to handler
  }
  
  // For external requests, check API key
  const apiKey = req.headers['x-api-key'] as string | undefined;
  const expectedApiKey = process.env.PERSONAL_API_KEY;
  
  // If no API key is configured, deny all external requests
  if (!expectedApiKey) {
    res.status(500).json({ error: 'API authentication not configured' });
    return false;
  }
  
  // Check if API key is provided and valid
  if (!apiKey || apiKey !== expectedApiKey) {
    res.status(401).json({ error: 'Unauthorized - Invalid or missing API key' });
    return false;
  }
  
  return true; // Continue to handler
}

/**
 * Higher-order function to wrap Edge API handlers with authentication
 * 
 * Example usage:
 * ```typescript
 * export const GET = withAuthEdge(async (request: NextRequest) => {
 *   // Your handler logic here
 *   return NextResponse.json({ data: 'Protected data' });
 * });
 * ```
 */
export function withAuthEdge<T extends (...args: any[]) => any>(
  handler: T
): T {
  return (async (request: NextRequest, ...args: any[]) => {
    // Check authentication
    const authResponse = authenticateEdge(request);
    if (authResponse) {
      return authResponse;
    }
    
    // Call the original handler
    return handler(request, ...args);
  }) as T;
}

/**
 * Higher-order function to wrap Node API handlers with authentication
 * 
 * Example usage:
 * ```typescript
 * export default withAuthNode(async (req: VercelRequest, res: VercelResponse) => {
 *   // Your handler logic here
 *   res.status(200).json({ data: 'Protected data' });
 * });
 * ```
 */
export function withAuthNode<T extends (req: VercelRequest, res: VercelResponse) => any>(
  handler: T
): T {
  return (async (req: VercelRequest, res: VercelResponse) => {
    // Check authentication
    const isAuthenticated = authenticateNode(req, res);
    if (!isAuthenticated) {
      return; // Response already sent
    }
    
    // Call the original handler
    return handler(req, res);
  }) as T;
}

/**
 * Middleware for API routes that need authentication (Edge runtime)
 * Can be used in middleware.ts for route-level protection
 * 
 * Example in middleware.ts:
 * ```typescript
 * import { authMiddleware } from '@/api/_lib/auth/middleware';
 * 
 * export function middleware(request: NextRequest) {
 *   if (request.nextUrl.pathname.startsWith('/api/')) {
 *     return authMiddleware(request);
 *   }
 * }
 * ```
 */
export function authMiddleware(request: NextRequest): NextResponse | undefined {
  const authResponse = authenticateEdge(request);
  if (authResponse) {
    return authResponse;
  }
  
  // Continue to the route handler
  return NextResponse.next();
}