# Resume Builder v2 - Endpoint Audit Report

## Overview
This document provides a comprehensive audit of all Flask backend endpoints and their usage in the frontend application.

## Core Resume Generation Endpoints (Used in Frontend)

### 1. `/api/analyze-job` (POST)
- **Purpose**: Analyze job description and extract categorized keywords
- **Frontend Usage**: Used in JobAnalysisForm component
- **Status**: ✅ ACTIVE - Core feature
- **Migration Priority**: 🔴 CRITICAL

### 2. `/api/tailor-resume-complete` (POST)
- **Purpose**: Complete resume tailoring with simple insights
- **Frontend Usage**: Used in SimpleResumeGenerator component
- **Status**: ✅ ACTIVE - Core feature  
- **Migration Priority**: 🔴 CRITICAL

### 3. `/api/export-simple-resume` (POST)
- **Purpose**: Export resume from simple tailor results
- **Frontend Usage**: Used in ResumeResultView component
- **Status**: ✅ ACTIVE - Core feature
- **Migration Priority**: 🔴 CRITICAL

### 4. `/api/parse-linkedin-job` (POST)
- **Purpose**: Parse LinkedIn job URL to extract job details
- **Frontend Usage**: Used in JobAnalysisForm component
- **Status**: ✅ ACTIVE
- **Migration Priority**: 🟡 HIGH

### 5. `/health` (GET)
- **Purpose**: API health check including LM Studio and Gmail connectivity
- **Frontend Usage**: Used for API availability check
- **Status**: ✅ ACTIVE
- **Migration Priority**: 🔴 CRITICAL

## Endpoints NOT in Frontend Config (But in Backend)

### Resume Generation & Library
1. `/api/generate-section` (POST) - Generate specific resume sections
2. `/api/preview-resume` (POST) - Generate live preview
3. `/api/export-resume` (POST) - Export in multiple formats
4. `/api/template-export` (POST) - Export using template patching
5. `/api/preview-document` (POST) - Generate document preview
6. `/api/serve-document/<filename>` (GET) - Serve generated documents
7. `/api/relevant-experience` (POST) - Get relevant experience by keywords
8. `/api/template-preview` (GET) - Get template preview
9. `/api/live-preview` (POST) - Generate live preview with highlighting
10. `/api/validate-content` (POST) - Validate content naturalness
11. `/api/base-resume` (GET) - Get base resume content
12. `/api/session/<session_id>` (GET) - Get session data

### LLM Providers
1. `/api/llm-providers` (GET) - List available LLM providers
2. `/api/analyze-job-with-provider` (POST) - Analyze with specific provider

### Email Integration
1. `/api/emails/sync` (POST) - Sync emails with basic processing
2. `/api/emails/sync-enhanced` (POST) - Enhanced sync with Groq
3. `/api/emails/refresh` (POST) - Incremental email refresh
4. `/api/emails/threads` (GET) - Get threaded email data
5. `/api/emails/threads/<thread_id>/emails` (GET) - Get thread emails
6. `/api/emails/activities` (GET) - Get email activities
7. `/api/emails/background-sync` (POST) - Background email sync
8. `/api/recruiters` (GET) - Get recruiter list
9. `/api/sync/status` (GET) - Get sync status

### Jobs API (from jobs_bp)
- Multiple endpoints under `/api/jobs/*` blueprint
- Enhanced jobs endpoints under `/api/enhanced-jobs/*`
- Scraping endpoints under `/api/scraping/*`

### Applications API (from applications_bp)
- Application tracking endpoints

### Groq Analytics API (from groq_analytics_bp)
- Analytics endpoints using Groq

## Deprecated/Unused Endpoints
- Authentication endpoints (removed for personal use)
- OAuth endpoints (if any)

## Frontend Endpoint Configuration Summary

The frontend `api.config.ts` only defines these endpoints:
```typescript
- analyzeJob: '/api/analyze-job'
- parseLinkedInJob: '/api/parse-linkedin-job'
- llmProviders: '/api/llm-providers'
- generateSection: '/api/generate-section'
- exportResume: '/api/export-resume'
- tailorResumeComplete: '/api/tailor-resume-complete'
- exportSimpleResume: '/api/export-simple-resume'
- resumeLibrary: '/api/resume-library'
- jobs: '/api/jobs'
- serviceStatus: '/api/service-status'
- sendEmail: '/api/send-email'
```

## Migration Recommendations

### Phase 1 - Critical (Week 1)
1. `/health` - Infrastructure
2. `/api/analyze-job` - Core feature
3. `/api/tailor-resume-complete` - Core feature
4. `/api/export-simple-resume` - Core feature

### Phase 2 - High Priority (Week 2)
1. `/api/parse-linkedin-job` - Job parsing
2. `/api/llm-providers` - Provider listing
3. Resume library endpoints (if actually used)

### Phase 3 - Medium Priority (Week 3)
1. Job management endpoints (check actual usage)
2. Email endpoints (determine if needed)

### Phase 4 - Low Priority
1. Advanced resume generation endpoints
2. Analytics endpoints
3. Recruiter tracking

## Notes
1. Many backend endpoints are NOT referenced in the frontend config
2. Focus migration on actually used endpoints first
3. Email and job scraping features may not be actively used
4. Consider removing unused endpoints rather than migrating them