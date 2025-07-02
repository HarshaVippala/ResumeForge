# API Authentication System

This directory contains a simple authentication middleware for protecting API endpoints in the ResumeForge personal application.

## Overview

The authentication system provides:
- **Same-origin access**: Browser requests from the same domain are automatically allowed
- **API key authentication**: External requests require a valid API key
- **Runtime compatibility**: Works with both Edge and Node.js Vercel runtimes

## Setup

1. Generate a secure API key:
   ```bash
   openssl rand -hex 32
   ```

2. Add to your `.env.local`:
   ```env
   # Backend API protection
   PERSONAL_API_KEY=your_generated_key_here
   
   # Frontend API access
   NEXT_PUBLIC_PERSONAL_API_KEY=your_generated_key_here
   ```

## Usage

### Node.js Runtime (Pages API)

```typescript
import { withAuthNode } from './_lib/auth/middleware';

async function handler(req: VercelRequest, res: VercelResponse) {
  // Your API logic here
  res.status(200).json({ data: 'Protected data' });
}

export default withAuthNode(handler);
```

### Edge Runtime (App Router)

```typescript
import { withAuthEdge } from './_lib/auth/middleware';

export const runtime = 'edge';

async function handleGET(request: NextRequest) {
  // Your API logic here
  return NextResponse.json({ data: 'Protected data' });
}

export const GET = withAuthEdge(handleGET);
```

## How It Works

1. **Same-Origin Requests**: Requests from your frontend are automatically allowed by checking:
   - Origin header matches the host
   - Referer header matches the host
   
2. **External Requests**: Must include the API key:
   ```bash
   curl -H "x-api-key: your_api_key" https://your-app.vercel.app/api/endpoint
   ```

3. **Frontend Integration**: The API config automatically includes the API key header in all requests.

## Security Notes

- Keep your API key secret and never commit it to version control
- Use environment variables for all sensitive configuration
- The API key is required for all external access (non-browser requests)
- Browser requests from your domain work without the API key for convenience

## Testing

To test external API access:

```bash
# Without API key (should fail)
curl https://your-app.vercel.app/api/analyze-job

# With API key (should succeed)
curl -H "x-api-key: your_api_key" \
     -H "Content-Type: application/json" \
     -X POST \
     -d '{"company":"Test","role":"Engineer","jobDescription":"Test job"}' \
     https://your-app.vercel.app/api/analyze-job
```