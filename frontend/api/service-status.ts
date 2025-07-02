import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// Re-export health endpoint functionality
export { GET } from './health';

// This endpoint is a duplicate of /api/health
// Keeping for backward compatibility with frontend