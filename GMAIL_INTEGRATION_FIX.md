# Gmail Integration Fix & Vercel Function Limit Solution

## Issue Summary
1. TypeScript errors in Gmail webhook implementation
2. Vercel deployment failing due to 12 function limit on hobby plan (you have 21 functions)

## Solution 1: Fix TypeScript Errors (Already Applied)
- Fixed type assertion in `api/gmail/webhook.ts` with proper validation
- Removed unused NextRequest import from `api/llm-providers.ts`

## Solution 2: Reduce API Functions to Meet Vercel Limit

### Current API Endpoints (21 total):
1. analyze-job.ts
2. export-simple-resume.ts
3. generate-section.ts
4. gmail/webhook.ts
5. health.ts
6. jobs/[id].ts
7. jobs/filters.ts
8. jobs/index.ts
9. jobs/save.ts
10. jobs/saved.ts
11. jobs/stats.ts
12. llm-providers.ts
13. oauth/authorize.ts
14. oauth/callback.ts
15. parse-linkedin-job.ts
16. resume-library/index.ts
17. send-email.ts
18. service-status.ts
19. tailor-resume-complete.ts
20. email/activities.ts
21. email/sync.ts

### Recommended Consolidation (to get under 12):

#### Option A: Combine Related Endpoints
1. **Combine all job endpoints** into `jobs/index.ts` with different methods:
   - GET /api/jobs - list jobs
   - GET /api/jobs?saved=true - get saved jobs
   - GET /api/jobs/stats - get stats
   - GET /api/jobs/filters - get filters
   - GET /api/jobs/:id - get single job
   - POST /api/jobs/:id/save - save job

2. **Combine email endpoints** into `email/index.ts`:
   - GET /api/email/activities - get activities
   - POST /api/email/sync - trigger sync

3. **Combine OAuth endpoints** into `oauth/index.ts`:
   - GET /api/oauth?action=authorize - authorize
   - GET /api/oauth?action=callback - callback

4. **Combine status endpoints** into `status/index.ts`:
   - GET /api/status/health
   - GET /api/status/services
   - GET /api/status/llm-providers

This would reduce from 21 to ~10 endpoints.

#### Option B: Move to Edge Functions Pattern
Create a single API router that handles multiple endpoints:

```typescript
// api/v2/[...path].ts
export async function GET(req: Request) {
  const url = new URL(req.url);
  const path = url.pathname.replace('/api/v2/', '');
  
  switch(path) {
    case 'jobs': return handleJobsList(req);
    case 'jobs/saved': return handleSavedJobs(req);
    // etc...
  }
}
```

### Immediate Fix for Deployment

1. **Temporarily disable non-critical endpoints** by renaming them:
   ```bash
   # Rename less critical endpoints to .ts.disabled
   mv api/parse-linkedin-job.ts api/parse-linkedin-job.ts.disabled
   mv api/service-status.ts api/service-status.ts.disabled
   mv api/llm-providers.ts api/llm-providers.ts.disabled
   mv api/send-email.ts api/send-email.ts.disabled
   ```

2. **Or upgrade to Vercel Pro** ($20/month) for unlimited functions

## Gmail Integration Architecture Review

### Current Setup Issues:
1. Dual backend architecture (TypeScript API + Python Flask) is complex
2. PubSub webhook requires proper Google Cloud setup
3. Type safety issues between services

### Recommended Simplification:
1. Use polling instead of PubSub for personal use
2. Consolidate to TypeScript-only backend
3. Use Gmail API's history endpoint for efficient syncing

### Simple Gmail Sync Implementation:
```typescript
// api/email/sync.ts
export async function POST(req: Request) {
  const gmail = await getGmailClient(userId);
  const lastHistoryId = await getLastSyncedHistoryId(userId);
  
  // Use history.list for efficient sync
  const history = await gmail.users.history.list({
    userId: 'me',
    startHistoryId: lastHistoryId,
    historyTypes: ['messageAdded']
  });
  
  // Process new messages
  for (const record of history.data.history || []) {
    await processHistoryRecord(record);
  }
  
  return Response.json({ synced: true });
}
```

## Recommended Action Plan

1. **Immediate (for deployment):**
   - Consolidate API endpoints to get under 12
   - Or temporarily disable non-critical endpoints
   - Or upgrade Vercel plan

2. **Short-term (Gmail stability):**
   - Replace PubSub with polling-based sync
   - Simplify to TypeScript-only implementation
   - Add proper error handling and retry logic

3. **Long-term:**
   - Consider using Next.js API routes pattern
   - Implement proper queue system for background jobs
   - Add monitoring and alerting

## Environment Variables Needed:
```env
# Gmail OAuth
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=https://yourdomain.com/api/oauth/callback

# Remove PubSub-related vars if switching to polling
# PUBSUB_TOPIC_NAME=...
# PUBSUB_PUSH_ENDPOINT=...
```