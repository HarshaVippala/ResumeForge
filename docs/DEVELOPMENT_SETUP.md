# Development Setup Guide

## Project Structure

This project has both frontend (Next.js) and API (TypeScript/Vercel Functions) in the same repository:
- `/frontend` - Next.js application
- `/api` - Vercel Functions (TypeScript API)

## Prerequisites

1. Node.js 18+ installed
2. npm or yarn
3. Vercel CLI: `npm i -g vercel`

## Initial Setup

1. **Install dependencies**:
   ```bash
   # Install API dependencies
   npm install
   
   # Install frontend dependencies
   cd frontend
   npm install
   cd ..
   ```

2. **Set up environment variables**:
   ```bash
   # Copy example files
   cp .env.example .env.local
   cp frontend/.env.example frontend/.env.local
   ```

   Update the following in `.env.local`:
   - `OPENAI_API_KEY` - Your OpenAI API key
   - `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase URL
   - `SUPABASE_SERVICE_KEY` - Your Supabase service key
   - Personal resume data (USER_NAME, etc.)

## Development

### Option 1: Run Frontend with Integrated API (Recommended)

The frontend Next.js app will also serve the API functions:

```bash
cd frontend
npm run dev
```

This starts everything on http://localhost:3000:
- Frontend: http://localhost:3000
- API: http://localhost:3000/api/*

### Option 2: Run API Separately

If you want to run the API separately for testing:

```bash
# Terminal 1: Run API on port 3001
npm run dev:api

# Terminal 2: Run frontend on port 3000
cd frontend
npm run dev
```

Then update `frontend/.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### Option 3: Use Vercel CLI for Both

From the project root:
```bash
vercel dev
```

This will start both frontend and API using Vercel's local development environment.

## Testing

### Test API Endpoints

```bash
# Run the test script
node test-api.js

# Or test individual endpoints
curl http://localhost:3000/api/health

curl -X POST http://localhost:3000/api/analyze-job \
  -H "Content-Type: application/json" \
  -d '{"company":"Test","role":"Engineer","jobDescription":"..."}'
```

### Type Checking

```bash
npm run type-check
```

## Deployment

Deploy to Vercel:
```bash
vercel --prod
```

## Troubleshooting

### "Cannot find module" errors
- Make sure you've run `npm install` in both root and frontend directories

### "OPENAI_API_KEY not configured" 
- Check your `.env.local` file has the correct API key
- Restart the dev server after changing env variables

### API not responding
- Check if the API is running on the correct port
- Verify CORS settings in vercel.json
- Check browser console for errors

### TypeScript errors
- Run `npm run type-check` to see all errors
- Make sure @types packages are installed