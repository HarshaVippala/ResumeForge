# Gmail Integration Setup Guide

This guide walks you through setting up Gmail integration with Push Notifications via Google Cloud Pub/Sub.

## Overview

The Gmail integration uses:
- **OAuth 2.0** for authentication
- **Gmail API** for email access
- **Google Cloud Pub/Sub** for real-time push notifications
- **Encrypted token storage** in Supabase

## Prerequisites

1. Google Cloud Project
2. Gmail API enabled
3. Pub/Sub API enabled
4. Vercel deployment with public webhook URL

## Step 1: Google Cloud Project Setup

### 1.1 Create Project
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Note your Project ID

### 1.2 Enable APIs
1. Go to APIs & Services → Enable APIs
2. Enable:
   - Gmail API
   - Cloud Pub/Sub API

### 1.3 Create OAuth 2.0 Credentials
1. Go to APIs & Services → Credentials
2. Click "Create Credentials" → OAuth client ID
3. Configure consent screen first:
   - User type: External (or Internal for G Suite)
   - Add scopes: `gmail.readonly`, `gmail.modify`
4. Create OAuth client:
   - Application type: Web application
   - Authorized redirect URIs:
     ```
     https://your-app.vercel.app/api/oauth/callback
     http://localhost:3000/api/oauth/callback (for development)
     ```
5. Save Client ID and Client Secret

## Step 2: Pub/Sub Configuration

### 2.1 Create Topic
```bash
# Install gcloud CLI first
gcloud pubsub topics create gmail-push --project=YOUR_PROJECT_ID
```

### 2.2 Create Subscription
```bash
gcloud pubsub subscriptions create gmail-push-sub \
  --topic=gmail-push \
  --push-endpoint=https://your-app.vercel.app/api/gmail/webhook \
  --ack-deadline=600 \
  --project=YOUR_PROJECT_ID
```

### 2.3 Grant Gmail Publish Permission
```bash
gcloud pubsub topics add-iam-policy-binding gmail-push \
  --member=serviceAccount:gmail-api-push@system.gserviceaccount.com \
  --role=roles/pubsub.publisher \
  --project=YOUR_PROJECT_ID
```

## Step 3: Environment Variables

Add these to your Vercel project:

```env
# Google OAuth
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=https://your-app.vercel.app/api/oauth/callback

# Pub/Sub Configuration
PUBSUB_TOPIC_NAME=projects/YOUR_PROJECT_ID/topics/gmail-push
PUBSUB_PUSH_ENDPOINT=https://your-app.vercel.app/api/gmail/webhook

# Gmail Token Encryption (optional, uses SUPABASE_SERVICE_KEY if not set)
GMAIL_TOKEN_ENCRYPTION_KEY=your-32-char-encryption-key
```

## Step 4: Implementation Features

### 4.1 OAuth Flow
1. User visits `/api/oauth/authorize`
2. Redirected to Google consent screen
3. Callback to `/api/oauth/callback`
4. Tokens stored encrypted in Supabase

### 4.2 Email Sync Types

#### Initial Sync
- Fetches emails from last 30 days
- Sets up Gmail watch for push notifications
- Stores emails in `email_communications` table

#### Incremental Sync (via Push)
- Real-time notifications via Pub/Sub webhook
- Uses Gmail History API for efficient updates
- Automatic deduplication

#### Fallback Polling
- Optional periodic sync for reliability
- Can be triggered via Vercel Cron

### 4.3 Security Features
- **Token Encryption**: AES-256-GCM encryption for stored tokens
- **JWT Verification**: Validates Pub/Sub push tokens
- **CSRF Protection**: State parameter in OAuth flow
- **Idempotency**: Prevents duplicate message processing

## Step 5: API Endpoints

### Authentication
- `GET /api/oauth/authorize` - Start OAuth flow
- `GET /api/oauth/callback` - Handle OAuth callback
- `GET /api/oauth/status` - Check auth status

### Email Operations
- `POST /api/email/sync` - Trigger email sync
- `GET /api/email/sync` - Get sync status
- `GET /api/email/activities` - List emails with analytics
- `POST /api/send-email` - Send email via Gmail

### Webhook
- `POST /api/gmail/webhook` - Pub/Sub push endpoint

## Step 6: Testing

### 6.1 Test OAuth Flow
```bash
# Get authorization URL
curl https://your-app.vercel.app/api/oauth/authorize

# Visit the URL and authorize
# Check auth status
curl https://your-app.vercel.app/api/email/sync
```

### 6.2 Test Email Sync
```bash
# Initial sync
curl -X POST https://your-app.vercel.app/api/email/sync \
  -H "Content-Type: application/json" \
  -d '{"syncType": "initial"}'

# Check activities
curl https://your-app.vercel.app/api/email/activities
```

### 6.3 Test Pub/Sub Webhook
Send a test email to your Gmail account and watch the logs for webhook calls.

## Step 7: Monitoring

### 7.1 Vercel Logs
Monitor function logs for:
- OAuth errors
- Sync failures
- Webhook processing

### 7.2 Google Cloud Console
- Pub/Sub metrics
- Message delivery status
- Dead letter queue (if configured)

### 7.3 Database Monitoring
Check `sync_metadata` table for:
- Watch expiration times
- Sync history
- Failed jobs

## Troubleshooting

### Common Issues

1. **"Not authenticated" error**
   - User needs to authorize via `/api/oauth/authorize`
   - Check if tokens are expired

2. **Webhook not receiving messages**
   - Verify Pub/Sub subscription configuration
   - Check webhook URL is publicly accessible
   - Verify JWT validation is working

3. **Duplicate emails**
   - Check idempotency implementation
   - Verify message deduplication logic

4. **Watch expiration**
   - Set up daily cron to renew watches
   - Check `gmail_watch_*` entries in sync_metadata

## Best Practices

1. **Rate Limiting**
   - Gmail API: 250 quota units per user per second
   - Implement exponential backoff

2. **Error Handling**
   - Log all API errors
   - Implement retry logic
   - Use dead letter queues

3. **Performance**
   - Process emails in batches
   - Use streaming for large responses
   - Cache frequently accessed data

4. **Security**
   - Never log tokens or sensitive data
   - Rotate encryption keys periodically
   - Monitor for unauthorized access

## Next Steps

1. Set up Vercel Cron for watch renewal
2. Implement email AI processing
3. Add email search functionality
4. Create UI for email management