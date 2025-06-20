# Vercel Environment Variables

Add these environment variables to your Vercel project settings:

## Required Variables

```
# Supabase Configuration
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_KEY=your-supabase-service-key
SUPABASE_ANON_KEY=your-supabase-anon-key

# Next.js Configuration
NEXTAUTH_URL=https://jobs.harshavippala.com
NEXTAUTH_SECRET=your-nextauth-secret

# CORS Configuration
CORS_ALLOWED_ORIGIN=https://jobs.harshavippala.com

# Gmail OAuth Configuration
GOOGLE_CLIENT_ID=869888601212-cmluclmesb0kiq462605rvjbprovsro0.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=https://jobs.harshavippala.com/api/oauth/callback

# Gmail Pub/Sub Configuration (Optional for real-time sync)
PUBSUB_TOPIC_NAME=projects/your-project-id/topics/gmail-push
PUBSUB_PUSH_ENDPOINT=https://jobs.harshavippala.com/api/gmail/webhook
```

## Setting Environment Variables in Vercel

1. Go to your project dashboard
2. Navigate to Settings → Environment Variables
3. Add each variable with the appropriate value
4. Select the environments (Production, Preview, Development)
5. Save changes

## Important Notes

- Replace `your-project-id` with your actual Google Cloud Project ID
- The `NEXTAUTH_SECRET` should be a random string (use `openssl rand -base64 32`)
- After adding/updating variables, redeploy for changes to take effect