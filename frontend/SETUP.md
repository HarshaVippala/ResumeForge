# Quick Setup Guide for ResumeForge

This guide will help you get ResumeForge running on your local machine in under 10 minutes.

## Prerequisites

- Node.js 18+ installed
- A Supabase account (free tier works)
- A Google Cloud account for AI and OAuth

## Step 1: Clone and Install

```bash
# Clone the repository
git clone [your-repo-url]
cd ResumeForge/frontend

# Install dependencies
npm install
```

## Step 2: Set Up Environment Variables

1. **Copy the example file:**
   ```bash
   cp .env.example .env.local
   ```

2. **Generate security keys:**
   ```bash
   # Run this 3 times to generate different keys
   openssl rand -base64 32
   ```
   
   Use these for:
   - `PERSONAL_API_KEY`
   - `ENCRYPTION_KEY`
   - `NEXTAUTH_SECRET`

3. **Get Supabase credentials:**
   - Go to [Supabase Dashboard](https://app.supabase.com)
   - Create a new project (or use existing)
   - Go to Settings > API
   - Copy:
     - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
     - Anon/Public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - Service Role key → `SUPABASE_SERVICE_ROLE_KEY`

4. **Get Google AI (Gemini) API key:**
   - Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
   - Create an API key
   - Copy to `GOOGLE_GENERATIVE_AI_API_KEY`

5. **Set up Google OAuth:**
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Create a new project or select existing
   - Enable Gmail API
   - Create OAuth 2.0 credentials
   - Add authorized redirect URI: `http://localhost:3000/api/oauth/callback`
   - Copy Client ID and Client Secret

6. **Add your personal info:**
   - Update `USER_*` variables with your actual information

## Step 3: Verify Security

Run the security check to ensure everything is configured correctly:

```bash
npm run security:check
```

This will verify:
- ✅ All required environment variables are set
- ✅ Keys meet security requirements
- ✅ No secrets are exposed in code
- ✅ File permissions are correct

## Step 4: Initialize Database

1. Go to your Supabase project SQL editor
2. Run the schema initialization script (found in `/database/schema.sql`)
3. Enable Row Level Security on all tables

## Step 5: Start the Application

```bash
# Start the development server
npm run dev
```

Visit http://localhost:3000 and you should see the login page!

## Step 6: First-Time Setup

1. **Connect Gmail:**
   - Click "Connect Gmail" in settings
   - Authorize access to your Gmail
   - Email sync will start automatically

2. **Test Resume Generation:**
   - Go to Generator page
   - Paste a job description
   - Click "Analyze Job"
   - Generate your first tailored resume!

## Troubleshooting

### "Invalid API Key" Error
- Check that all keys are at least 32 characters
- Ensure no spaces or newlines in keys
- Run `npm run env:validate` to check configuration

### Gmail OAuth Not Working
- Verify redirect URI matches exactly: `http://localhost:3000/api/oauth/callback`
- Check that Gmail API is enabled in Google Cloud Console
- Ensure `NEXTAUTH_URL` is set correctly

### Database Connection Failed
- Verify Supabase project is active (not paused)
- Check that all Supabase keys are from the same project
- Test connection in Supabase dashboard

## Security Best Practices

⚠️ **IMPORTANT**: This is a personal-use application with access to your Gmail and personal data.

1. **Never commit `.env.local` to git**
2. **Use strong, unique keys** (generated with openssl)
3. **Keep your Supabase service role key secret**
4. **Regularly check security:** `npm run security:check`
5. **Review the full security checklist:** `/docs/security-checklist.md`

## Next Steps

- 📖 Read the full documentation in `/docs`
- 🔧 Customize the resume templates in your profile
- 🚀 Deploy to Vercel when ready for production
- 🛡️ Set up regular security audits

---

Need help? Check the `/docs` folder or open an issue!