# ResumeForge Setup Guide

## Quick Start

1. **Copy Environment Template**
   ```bash
   cd frontend
   cp .env.example .env.local
   ```

2. **Set Up Supabase (Required for WebAuthn auth)**
   - Go to [supabase.com](https://supabase.com) and create a project
   - Get your project URL and service role key from Settings > API
   - Update `.env.local`:
     ```bash
     NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
     SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
     ```

3. **Set Up Google Gemini AI (Required for resume generation)**
   - Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
   - Create an API key
   - Update `.env.local`:
     ```bash
     GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_api_key
     ```

4. **Generate Security Keys**
   ```bash
   # Generate random keys
   openssl rand -base64 32  # Use for PERSONAL_API_KEY
   openssl rand -base64 32  # Use for JWT_SECRET
   openssl rand -base64 32  # Use for NEXTAUTH_SECRET
   ```

5. **Install and Run**
   ```bash
   npm install
   npm run dev
   ```

## Configuration Levels

### Level 1: Basic Resume Generation
**Requirements:** Google Gemini API key
**Features:** Resume tailoring, PDF export
**Setup:** Just set `GOOGLE_GENERATIVE_AI_API_KEY`

### Level 2: Full Authentication 
**Requirements:** Supabase + Security keys
**Features:** WebAuthn login, user sessions, data persistence
**Setup:** Configure all Supabase and security environment variables

### Level 3: Email Integration (Optional)
**Requirements:** Google OAuth credentials
**Features:** Gmail sync, job tracking from emails
**Setup:** Set up Google OAuth credentials

## Environment Variables Reference

| Variable | Required | Purpose |
|----------|----------|---------|
| `GOOGLE_GENERATIVE_AI_API_KEY` | Yes | Resume generation with Gemini AI |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes* | Database connection |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes* | Database authentication |
| `PERSONAL_API_KEY` | Yes* | API security |
| `JWT_SECRET` | Yes* | Session tokens |
| `NEXTAUTH_SECRET` | Yes* | NextAuth security |
| `GOOGLE_CLIENT_ID` | No | Gmail integration |
| `GOOGLE_CLIENT_SECRET` | No | Gmail integration |

*Required for WebAuthn authentication

## Troubleshooting

### "Missing Supabase configuration" Error
- Ensure `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set
- Check that your Supabase project is active
- Verify the service role key has proper permissions

### "Failed to generate authentication options" Error  
- This indicates missing Supabase configuration
- WebAuthn features will be disabled until Supabase is configured
- Basic resume generation will still work

### Build Errors
- Run `npm run type-check` to identify TypeScript issues
- Ensure all required environment variables are set
- Check that `.env.local` exists and is properly formatted

## Security Notes

- Never commit `.env.local` to git
- Use strong, unique keys for all security variables
- In production, use proper secret management
- Rotate API keys regularly