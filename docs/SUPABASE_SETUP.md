# Connecting to Existing Supabase Project

## Quick Setup Guide

### 1. Get Your Supabase Credentials

From your Supabase project dashboard:

1. Go to **Settings → API**
2. Copy these values:
   - **Project URL**: `https://YOUR_PROJECT_REF.supabase.co`
   - **Anon public key**: (for client-side, not needed for this project)
   - **Service role key**: (for server-side operations - KEEP SECRET!)

3. Go to **Settings → Database**
4. Copy the **Connection string** (if needed for direct DB access)

### 2. Generate TypeScript Types

Run this command to generate types from your existing database:

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Login to Supabase
supabase login

# Generate types (replace YOUR_PROJECT_REF with your actual project reference)
npx supabase gen types typescript --project-id YOUR_PROJECT_REF > api/_lib/db/generated-types.ts
```

### 3. Verify Database Schema

Check if your existing database has these tables:
- `resume_sessions` (or `sessions`)
- `jobs`
- `saved_jobs`
- `job_applications`
- `job_alerts`
- `resume_library`
- `section_versions`
- `sync_metadata`
- `email_communications`

If any tables are missing, run the migration script:
1. Go to SQL Editor in Supabase
2. Paste contents of `/supabase/migrations/001_initial_schema.sql`
3. Run the query

### 4. Create .env.local File

```bash
# Copy the example
cp .env.local.example .env.local
```

Then fill in your actual values:

```env
# Your frontend URL (for local dev)
CORS_ALLOWED_ORIGIN=http://localhost:3000

# Your Supabase credentials
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Optional: Direct database connection
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR_PROJECT_REF].supabase.co:5432/postgres

# OpenAI Configuration
DEFAULT_LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4-turbo

# Application Settings
LOG_LEVEL=DEBUG
NODE_ENV=development
```

### 5. Test the Connection

```bash
# Start the development server
npm run dev

# In another terminal, test the health endpoint
curl http://localhost:3000/api/health
```

You should see:
- `"database_status": "connected"` (if properly configured)
- `"openai": "connected"` (if API key is valid)

### 6. Deploy to Vercel

1. Push your changes to GitHub
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import your repository
4. Add the same environment variables (but with production values):
   - Use your production frontend URL for `CORS_ALLOWED_ORIGIN`
   - Same Supabase credentials
   - Set `NODE_ENV=production`
   - Set `LOG_LEVEL=INFO`

### Common Issues

**Database not connected:**
- Verify SUPABASE_SERVICE_KEY is the service role key, not the anon key
- Check that the URL doesn't have trailing slashes
- Ensure your Supabase project is not paused

**CORS errors:**
- Make sure CORS_ALLOWED_ORIGIN matches your frontend URL exactly
- No trailing slashes
- For Vercel preview deployments, you might need to temporarily use `*`

**Type mismatches:**
- If your existing schema differs, generate types as shown above
- Update `api/_lib/db/types.ts` with the generated types