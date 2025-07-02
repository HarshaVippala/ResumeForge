# Frontend Update Guide for API Consolidation

## Summary of Changes
We've consolidated the API from 21+ endpoints down to 10 endpoints to meet Vercel's hobby plan limit:

### Final API Endpoints (10 total):
1. `analyze-job.ts` - Job analysis
2. `applications.ts` - Application tracking  
3. `email.ts` - Email operations (consolidated)
4. `export-simple-resume.ts` - Resume export
5. `generate-section.ts` - Section generation
6. `health.ts` - Health check
7. `jobs.ts` - All job operations (consolidated)
8. `llm-providers.ts` - LLM provider info
9. `parse-linkedin-job.ts` - LinkedIn parsing
10. `tailor-resume-complete.ts` - Complete resume tailoring

### Removed Endpoints:
- `/api/gmail/webhook` (unused)
- `/api/oauth/*` (unused, auth disabled)
- `/api/resume-library/*` (unused)
- `/api/send-email` (unused)
- `/api/service-status` (redundant with health)
- All individual job endpoints (consolidated into jobs.ts)
- All individual email endpoints (consolidated into email.ts)

## Required Frontend Updates

### 1. Job-Related API Calls

The frontend already uses the correct pattern for jobs! No changes needed for:
- `backgroundJobScraper.ts` - Already uses `/api/jobs?action=scrape`
- Job components - Already use action parameters

### 2. Email-Related API Calls

Update in `frontend/src/services/emailService.ts`:
- Current: Points to `http://localhost:5001/api/emails/*`
- Needed: Update to use `/api/email?action=*` pattern

Example changes:
```typescript
// OLD
const response = await fetch('http://localhost:5001/api/emails/sync', { method: 'POST' })

// NEW  
const response = await fetch('/api/email?action=sync', { method: 'POST' })
```

### 3. Application Tracking

No changes needed - `applications.ts` maintains the same REST pattern.

### 4. Configuration Updates

Already completed in `api.config.ts`:
- Removed resume library endpoints
- Removed OAuth endpoints
- Email and job endpoints already use correct patterns

## Testing Checklist

1. ✅ Job listing and filtering
2. ✅ Job saving/unsaving  
3. ✅ Job scraping
4. ⚠️  Email sync (needs backend URL update)
5. ⚠️  Email activities (needs backend URL update)
6. ✅ Resume generation
7. ✅ Application tracking

## Deployment Steps

1. Deploy to Vercel - should now succeed with 10 endpoints
2. Update email service to use new endpoints
3. Test all functionality
4. Monitor for any issues

## Benefits

- ✅ Under Vercel's 12 function limit
- ✅ Cleaner, more maintainable API structure
- ✅ Removed 11 unused endpoints
- ✅ Consistent action-based pattern for related operations
- ✅ Room for 2 more endpoints if needed