# Vercel Deployment Guide for Resume Builder v2

This guide walks you through deploying the Resume Builder application to Vercel.

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **Supabase Project**: Create a project at [supabase.com](https://supabase.com)
3. **OpenAI API Key**: Get from [platform.openai.com](https://platform.openai.com)
4. **GitHub Repository**: Your code should be in a GitHub repo

## Step 1: Set Up Supabase

### 1.1 Create Supabase Project
1. Go to [supabase.com](https://supabase.com) and create a new project
2. Choose a strong database password and save it
3. Select a region closest to your users
4. Wait for project initialization (2-3 minutes)

### 1.2 Run Database Migrations
1. Go to SQL Editor in Supabase dashboard
2. Open `/supabase/migrations/001_initial_schema.sql` from this repo
3. Copy the entire SQL content
4. Paste and run in Supabase SQL Editor
5. Verify tables are created under Table Editor

### 1.3 Get Supabase Credentials
From your Supabase project settings, copy:
- Project URL (Settings → API → Project URL)
- Service Role Key (Settings → API → Service Role Key)
- Database Connection String (Settings → Database → Connection String)

## Step 2: Prepare for Vercel Deployment

### 2.1 Test Locally First
```bash
# Copy example env file
cp .env.local.example .env.local

# Fill in your actual values in .env.local
# Make sure to use production Supabase credentials

# Install dependencies
npm install

# Build the project
npm run build

# Test the build locally
cd frontend && npm run start
```

### 2.2 Verify Build Success
- Check for any TypeScript errors
- Ensure all API endpoints compile
- Test the frontend loads correctly

## Step 3: Deploy to Vercel

### 3.1 Connect GitHub Repository
1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Select the `resume-builder-v2` repository

### 3.2 Configure Build Settings
Vercel should auto-detect most settings, but verify:
- **Framework Preset**: Next.js
- **Root Directory**: `./` (leave empty)
- **Build Command**: `npm run build`
- **Output Directory**: `.next` (auto-detected)
- **Install Command**: `npm install`

### 3.3 Set Environment Variables
Click "Environment Variables" and add each of these:

#### Required Variables
```
CORS_ALLOWED_ORIGIN=[Your production URL, e.g., https://resume-builder.vercel.app]
NEXT_PUBLIC_SUPABASE_URL=[Your Supabase URL]
SUPABASE_SERVICE_KEY=[Your Supabase Service Key]
DEFAULT_LLM_PROVIDER=openai
OPENAI_API_KEY=[Your OpenAI API Key]
OPENAI_MODEL=gpt-4-turbo
LOG_LEVEL=INFO
NODE_ENV=production
```

#### Optional Variables (if using features)
```
DATABASE_URL=[PostgreSQL connection string]
GEMINI_API_KEY=[If using Gemini]
GEMINI_MODEL=gemini-1.5-pro
```

### 3.4 Deploy
1. Click "Deploy"
2. Wait for build to complete (3-5 minutes)
3. Vercel will provide a preview URL

## Step 4: Post-Deployment Setup

### 4.1 Update CORS Origin
1. Once deployed, copy your production URL
2. Go to Vercel project settings
3. Update `CORS_ALLOWED_ORIGIN` to your production URL
4. Redeploy to apply changes

### 4.2 Test Critical Endpoints
Test these endpoints on your production URL:
- `https://your-app.vercel.app/api/health` - Should return OK
- Frontend should load without CORS errors
- Try analyzing a job to test AI integration
- Generate and export a resume

### 4.3 Set Up Custom Domain (Optional)
1. Go to Vercel project settings → Domains
2. Add your custom domain
3. Follow DNS configuration instructions
4. Update `CORS_ALLOWED_ORIGIN` to new domain

## Step 5: Monitoring & Maintenance

### 5.1 Monitor Functions
- Check Vercel dashboard → Functions tab
- Monitor execution times (should be < 10s)
- Watch for errors or timeouts

### 5.2 Check Logs
- Vercel dashboard → Functions → View logs
- Look for any API errors
- Monitor Supabase logs for database issues

### 5.3 Set Up Alerts (Optional)
- Configure Vercel monitoring
- Set up error tracking (e.g., Sentry)
- Monitor API usage and costs

## Troubleshooting

### Common Issues

#### 1. CORS Errors
- Verify `CORS_ALLOWED_ORIGIN` matches your frontend URL exactly
- No trailing slashes
- Check browser console for exact error

#### 2. Database Connection Errors
- Verify Supabase credentials are correct
- Check Supabase project is active (not paused)
- Ensure tables exist (run migrations)

#### 3. API Timeout Errors
- Functions have 10-second limit on Hobby plan
- Optimize AI prompts for faster responses
- Consider upgrading to Pro for longer timeouts

#### 4. Build Failures
- Check TypeScript errors in build logs
- Ensure all dependencies are in package.json
- Verify environment variables are set

### Debug Commands
```bash
# Check TypeScript compilation
npm run build

# Test API endpoints locally
curl http://localhost:3000/api/health

# Verify environment variables
npx vercel env pull .env.local
```

## Next Steps

1. **Enable Additional Features**
   - Set up email integration (when implemented)
   - Configure job scraper locally

2. **Optimize Performance**
   - Enable Vercel Analytics
   - Implement caching strategies
   - Optimize bundle size

3. **Security Hardening**
   - Regularly rotate API keys
   - Review CORS settings
   - Implement rate limiting

4. **Backup Strategy**
   - Regular Supabase backups
   - Export production data periodically

## Support Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- Project Issues: Create issue in GitHub repo

## Deployment Checklist

Before going live:
- [ ] All environment variables configured
- [ ] Database migrations completed
- [ ] CORS properly configured
- [ ] API endpoints tested
- [ ] Frontend loads without errors
- [ ] AI features working
- [ ] PDF export functional
- [ ] No console errors
- [ ] Monitoring set up
- [ ] Backup plan in place

Remember: Start with a preview deployment first, test thoroughly, then promote to production!