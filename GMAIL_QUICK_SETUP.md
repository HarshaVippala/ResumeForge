# Gmail Integration Quick Setup

Quick setup guide for Gmail integration:

## 1. Environment Variables for Vercel

Add these to your Vercel project settings:

```
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=https://resume-forge.vercel.app/api/oauth/callback
```

## 2. Update OAuth Redirect URIs in Google Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Click on your OAuth 2.0 Client ID
3. Add these Authorized redirect URIs:
   - `https://resume-forge.vercel.app/api/oauth/callback`
   - `http://localhost:3000/api/oauth/callback` (for local testing)
4. Save changes

## 3. Set Up Pub/Sub (For Real-time Email Sync)

### Option A: Simple Polling (Easier)
Skip Pub/Sub setup and use periodic sync instead. The app will check for new emails when you trigger sync manually.

### Option B: Real-time Push Notifications (Advanced)
1. Enable Pub/Sub API in Google Cloud Console
2. Create a topic:
   ```bash
   gcloud pubsub topics create gmail-push
   ```
3. Add these additional environment variables:
   ```
   PUBSUB_TOPIC_NAME=projects/YOUR_PROJECT_ID/topics/gmail-push
   PUBSUB_PUSH_ENDPOINT=https://resume-forge.vercel.app/api/gmail/webhook
   ```

## 4. Test Locally First

Create `.env.local` in your project root with your actual credentials.

## 5. Quick Test Commands

```bash
# Install dependencies
npm install

# Run locally
npm run dev

# Test OAuth flow
curl http://localhost:3000/api/oauth/authorize

# After authorizing, test sync
curl -X POST http://localhost:3000/api/email/sync \
  -H "Content-Type: application/json" \
  -d '{"syncType": "initial"}'
```

## 6. Deploy to Vercel

1. Commit and push changes
2. Deploy to Vercel
3. Add environment variables in Vercel dashboard
4. Test production OAuth flow

## API Endpoints Available

- `GET /api/oauth/authorize` - Start Gmail authentication
- `GET /api/oauth/callback` - OAuth callback (automatic)
- `POST /api/email/sync` - Sync emails
- `GET /api/email/activities` - View synced emails
- `POST /api/send-email` - Send email via Gmail

## Troubleshooting

1. **"Redirect URI mismatch" error**
   - Make sure the redirect URI in Google Console matches exactly
   - No trailing slashes!

2. **"Not authenticated" error**
   - User needs to authorize first via `/api/oauth/authorize`
   - Check if tokens are stored in sync_metadata table

3. **CORS errors**
   - Verify CORS_ALLOWED_ORIGIN matches your frontend URL