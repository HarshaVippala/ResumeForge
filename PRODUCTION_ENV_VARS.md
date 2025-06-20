# Production Environment Variables for Vercel Deployment

## Critical Environment Variables

These variables MUST be set in your Vercel project settings before deployment:

### 1. CORS Configuration
```
CORS_ALLOWED_ORIGIN=https://your-frontend-domain.vercel.app
```
- Replace with your actual frontend URL
- Do NOT include trailing slash
- Required for secure API access

### 2. Supabase Configuration
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```
- Get these from your Supabase project settings
- `SUPABASE_SERVICE_KEY` is the service_role key (keep secret!)
- `DATABASE_URL` is the direct connection string (if needed)

### 3. OpenAI Configuration
```
DEFAULT_LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4-turbo
OPENAI_ORG_ID=org-... (optional)
```
- Required for AI-powered resume features
- Use production-ready models only

### 4. Alternative AI Provider (Optional)
```
GEMINI_API_KEY=AIzaSy...
GEMINI_MODEL=gemini-1.5-pro
```
- Only if using Google Gemini as backup/alternative

### 5. Application Settings
```
LOG_LEVEL=INFO
NODE_ENV=production
```

### 6. Gmail Integration (Now Implemented!)
```
# OAuth Credentials
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=https://your-app.vercel.app/api/oauth/callback

# Pub/Sub Configuration
PUBSUB_TOPIC_NAME=projects/YOUR_PROJECT_ID/topics/gmail-push
PUBSUB_PUSH_ENDPOINT=https://your-app.vercel.app/api/gmail/webhook

# Optional: Custom encryption key (uses SUPABASE_SERVICE_KEY if not set)
GMAIL_TOKEN_ENCRYPTION_KEY=your-32-char-encryption-key
```
- Get OAuth credentials from Google Cloud Console
- Set up Pub/Sub topic for real-time email notifications
- See GMAIL_INTEGRATION_SETUP.md for detailed setup

## Optional Environment Variables

These can be added later as features are implemented:

```
# Email Service
EMAIL_SYNC_ENABLED=false
EMAIL_SERVICE_ACCOUNT=your-email@gmail.com

# Job Scraping
JOB_SCRAPER_ENABLED=false
SCRAPER_API_KEY=...

# Analytics (if needed)
VERCEL_ANALYTICS_ID=...
```

## Security Notes

1. **Never commit these values to Git**
2. **Use Vercel's environment variable UI** to set these securely
3. **Different values for preview/production** environments
4. **Rotate API keys regularly**

## Setting Environment Variables in Vercel

1. Go to your Vercel project dashboard
2. Navigate to Settings → Environment Variables
3. Add each variable with appropriate values
4. Select which environments (Production/Preview/Development) should have access
5. Save changes

## Testing Production Configuration Locally

Create a `.env.local` file (gitignored) with production-like values:

```bash
# .env.local
CORS_ALLOWED_ORIGIN=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
OPENAI_API_KEY=your-openai-key
DEFAULT_LLM_PROVIDER=openai
OPENAI_MODEL=gpt-4-turbo
LOG_LEVEL=DEBUG
```

Then test with:
```bash
npm run build
npm run start
```

## Deployment Checklist

- [ ] All critical environment variables set in Vercel
- [ ] CORS_ALLOWED_ORIGIN points to production frontend URL
- [ ] Supabase project created and configured
- [ ] API keys are valid and have appropriate permissions
- [ ] Test deployment with preview branch first
- [ ] Monitor logs for any missing configuration