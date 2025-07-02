# API Consolidation Plan

## Current State: 14 API Endpoints (Need to reduce to 12 or fewer)

### Used Endpoints (10):
1. `analyze-job.ts` - ACTIVE
2. `export-simple-resume.ts` - ACTIVE
3. `generate-section.ts` - ACTIVE
4. `tailor-resume-complete.ts` - ACTIVE
5. `parse-linkedin-job.ts` - ACTIVE
6. `jobs.ts` - ACTIVE (already consolidated)
7. `email.ts` - ACTIVE (already consolidated)
8. `applications.ts` - ACTIVE
9. `llm-providers.ts` - ACTIVE
10. `health.ts` - ACTIVE

### Unused Endpoints (4):
1. `gmail/webhook.ts` - NOT USED
2. `oauth.ts` - NOT USED (auth disabled)
3. `resume-library/index.ts` - NOT USED
4. `send-email.ts` - NOT USED

## Consolidation Strategy

### Step 1: Remove Unused Endpoints
Remove these 4 unused endpoints to immediately get to 10 endpoints:
```bash
rm api/gmail/webhook.ts
rm api/oauth.ts
rm api/resume-library/index.ts
rm api/send-email.ts
```

### Step 2: Further Consolidation (if needed to add features later)

#### Option A: Combine Resume Generation Endpoints
Create `api/resume.ts` to handle:
- `analyze-job` → `POST /api/resume?action=analyze`
- `generate-section` → `POST /api/resume?action=generate-section`
- `tailor-resume-complete` → `POST /api/resume?action=tailor-complete`
- `export-simple-resume` → `POST /api/resume?action=export`

This would reduce 4 endpoints to 1.

#### Option B: Combine Utility Endpoints
Create `api/utils.ts` to handle:
- `parse-linkedin-job` → `POST /api/utils?action=parse-linkedin`
- `llm-providers` → `GET /api/utils?action=llm-providers`
- `health` → `GET /api/utils?action=health`

This would reduce 3 endpoints to 1.

## Implementation Plan

### Phase 1: Clean Up (Immediate)
1. Remove the 4 unused endpoint files
2. Clean up related imports and types
3. Remove from api.config.ts

### Phase 2: Test Current Setup
1. Verify app works with 10 endpoints
2. Deploy to Vercel to confirm under limit

### Phase 3: Future Consolidation (if needed)
If you need to add more endpoints later:
1. Implement Option A or B above
2. Update frontend API calls
3. Test thoroughly

## Benefits
- Immediately gets under Vercel's 12 function limit
- Removes dead code
- Simplifies codebase
- Leaves room for 2 more endpoints if needed

## Frontend Updates Required
None for Phase 1 - we're only removing unused endpoints.

For future consolidation, update:
- `src/components/generator/JobAnalysisForm.tsx`
- `src/components/generator/SectionEditor.tsx`
- `src/components/generator/SimpleResumeGenerator.tsx`
- Any other components using the consolidated endpoints