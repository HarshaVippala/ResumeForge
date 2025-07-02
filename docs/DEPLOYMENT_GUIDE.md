# TypeScript API Deployment Guide

## Overview
This guide covers deploying the TypeScript/Vercel API for the Resume Builder application.

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **Environment Variables**: Copy `.env.example` to `.env.local` and fill in:
   - `OPENAI_API_KEY` - Your OpenAI API key
   - `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
   - `SUPABASE_SERVICE_KEY` - Your Supabase service role key
   - Personal resume data (USER_NAME, USER_EMAIL, etc.)

## Local Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Run type checking**:
   ```bash
   npm run type-check
   ```

3. **Start Vercel dev server**:
   ```bash
   npm run dev
   ```

   This will start both the Next.js frontend and API functions on http://localhost:3000

## Testing the Migration

1. **Test individual endpoints**:
   ```bash
   # Health check
   curl http://localhost:3000/api/health

   # Analyze job (POST)
   curl -X POST http://localhost:3000/api/analyze-job \
     -H "Content-Type: application/json" \
     -d '{"company":"Test Co","role":"Engineer","jobDescription":"..."}'
   ```

2. **Enable TypeScript API in frontend**:
   - Set `NEXT_PUBLIC_USE_TYPESCRIPT_API=true` in `.env.local`
   - Or manually edit `frontend/src/config/migration.config.ts`

## Deployment to Vercel

1. **Install Vercel CLI**:
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy**:
   ```bash
   vercel
   ```

   Follow the prompts:
   - Link to existing project or create new
   - Confirm project settings
   - Deploy

4. **Set environment variables in Vercel**:
   ```bash
   vercel env add OPENAI_API_KEY
   vercel env add NEXT_PUBLIC_SUPABASE_URL
   vercel env add SUPABASE_SERVICE_KEY
   # Add other variables...
   ```

5. **Deploy to production**:
   ```bash
   vercel --prod
   ```

## Gradual Migration Strategy

1. **Phase 1 - Test Core Endpoints** (Current):
   - ✅ /api/health
   - ✅ /api/analyze-job
   - ✅ /api/tailor-resume-complete
   - ✅ /api/export-simple-resume
   - ✅ /api/parse-linkedin-job

2. **Phase 2 - Enable in Production**:
   - Deploy to Vercel with `NEXT_PUBLIC_USE_TYPESCRIPT_API=false`
   - Test each endpoint individually
   - Monitor for errors

3. **Phase 3 - Gradual Rollout**:
   - Enable TypeScript API for specific endpoints in `migration.config.ts`
   - Test thoroughly
   - Monitor performance

4. **Phase 4 - Full Migration**:
   - Set `NEXT_PUBLIC_USE_TYPESCRIPT_API=true`
   - Remove Flask backend
   - Update all environment variables

## Monitoring

1. **Vercel Dashboard**:
   - Function logs: https://vercel.com/[your-username]/[project]/functions
   - Analytics: https://vercel.com/[your-username]/[project]/analytics

2. **Health Checks**:
   - Monitor `/api/health` endpoint
   - Check service connectivity

## Rollback Plan

If issues occur:

1. **Quick rollback**:
   - Set `NEXT_PUBLIC_USE_TYPESCRIPT_API=false` in Vercel env
   - Redeploy: `vercel --prod`

2. **Endpoint-specific rollback**:
   - Edit `migration.config.ts`
   - Set specific endpoints to `false`
   - Redeploy

## Troubleshooting

### Common Issues

1. **"Function timeout" errors**:
   - Check if operations complete within 10 seconds
   - Optimize prompts for faster responses
   - Consider streaming for long operations

2. **"Missing environment variables"**:
   - Verify all required env vars are set in Vercel
   - Check variable names match exactly

3. **CORS errors**:
   - Verify allowed origins in `vercel.json`
   - Check frontend URL configuration

### Debug Commands

```bash
# View function logs
vercel logs [deployment-url] --follow

# Check environment variables
vercel env ls

# Redeploy specific function
vercel --force
```

## Performance Tips

1. **Cold Starts**:
   - First request may be slower
   - Consider warming critical endpoints

2. **Optimization**:
   - Keep functions small and focused
   - Use Edge runtime for simple endpoints
   - Cache responses where appropriate

## Next Steps

After successful deployment:

1. Monitor function performance
2. Migrate remaining endpoints as needed
3. Optimize based on usage patterns
4. Consider adding more features