# Deployment Guide

## Local Development

No changes needed! Your local setup will continue to work as before:
- Frontend: `npm run dev` (runs on http://localhost:3000)
- Backend: `python app.py` (runs on http://localhost:5001)

The `.env.local` file ensures local development uses the correct API URL.

## Vercel Deployment Configuration

### 1. Environment Variables in Vercel

Add these environment variables in your Vercel project settings:

```bash
# API Configuration (update with your production backend URL)
NEXT_PUBLIC_API_URL=https://your-backend-api.com

# Environment
NEXT_PUBLIC_ENVIRONMENT=production

# Feature Flags
NEXT_PUBLIC_ENABLE_JOB_SCRAPER=true
NEXT_PUBLIC_ENABLE_BACKGROUND_SYNC=true
NEXT_PUBLIC_DEBUG_MODE=false

# Authentication (if using Supabase Auth)
NEXT_PUBLIC_AUTH_ENABLED=true
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 2. Backend Deployment Options

Since your backend is Python/Flask, you have several options:

#### Option A: Deploy Backend on Vercel (Python Runtime)
- Create a separate Vercel project for the backend
- Add `vercel.json` to backend directory:
```json
{
  "functions": {
    "api/index.py": {
      "maxDuration": 30
    }
  },
  "rewrites": [
    { "source": "/(.*)", "destination": "/api/index" }
  ]
}
```

#### Option B: Deploy Backend on Railway/Render/Fly.io
- These platforms better support long-running Python processes
- Update `NEXT_PUBLIC_API_URL` in Vercel to point to your backend

#### Option C: Use Vercel Edge Functions with Supabase
- Migrate backend logic to Edge Functions
- Use Supabase for database and authentication

### 3. CORS Configuration

Update your Flask backend `app.py` to allow your Vercel domain:

```python
from flask_cors import CORS

# In production
CORS(app, origins=[
    "http://localhost:3000",  # Local development
    "https://your-app.vercel.app",  # Your Vercel domain
    "https://your-custom-domain.com"  # Custom domain if any
])
```

### 4. Authentication Setup

For production, you'll need proper authentication. Using Supabase Auth:

1. Install Supabase client:
```bash
npm install @supabase/supabase-js
```

2. Create auth context in frontend:
```typescript
// src/contexts/AuthContext.tsx
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

3. Protect API routes in backend with JWT validation

### 5. Security Checklist

- [ ] Enable authentication in production
- [ ] Use HTTPS for all API calls
- [ ] Add rate limiting to prevent abuse
- [ ] Validate and sanitize all inputs
- [ ] Use environment-specific API keys
- [ ] Enable CORS only for trusted domains
- [ ] Add API request logging and monitoring

## Quick Start Commands

### Local Development (No Changes!)
```bash
# Terminal 1 - Backend
cd backend
python app.py

# Terminal 2 - Frontend  
cd frontend
npm run dev
```

### Production Deployment
```bash
# Deploy frontend to Vercel
vercel --prod

# Deploy backend (example with Railway)
railway up
```

## Troubleshooting

1. **API calls failing in production**
   - Check NEXT_PUBLIC_API_URL is set correctly in Vercel
   - Verify CORS is configured for your Vercel domain
   - Check backend is accessible from internet

2. **Authentication errors**
   - Ensure Supabase environment variables are set
   - Check JWT token is being sent with requests
   - Verify backend is validating tokens correctly

3. **Jobs feature not working**
   - JobSpy requires backend to be running
   - Check rate limits aren't being hit
   - Verify database connection in production