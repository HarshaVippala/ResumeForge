# Security Checklist for ResumeForge

This checklist ensures your personal ResumeForge instance is properly secured. Follow these steps before running the application.

## 🔴 Critical Security Variables (MUST SET)

These environment variables are **required** for security. The application will not function properly without them.

### 1. **PERSONAL_API_KEY**
- **Purpose**: Authenticates requests to your personal API endpoints
- **Security Risk**: Without this, anyone could access your API
- **How to Generate**:
  ```bash
  openssl rand -base64 32
  ```
- **Verification**: Check that it's at least 32 characters long
- **Example Format**: `xK9mP2nQ8vL5jH7wE3rT6yU1oI4aS0dF+gB2cV8nM7k=`

### 2. **ENCRYPTION_KEY**
- **Purpose**: Encrypts sensitive data in the database (OAuth tokens, credentials)
- **Security Risk**: Exposed data could compromise your Google account
- **How to Generate**:
  ```bash
  openssl rand -base64 32
  ```
- **Verification**: Must be exactly 32 bytes when base64 decoded
- **Example Format**: `aB3dE5gH7jK9mN2pQ4sT6vW8xY0zC1fG+hI3kL5nO7q=`

### 3. **NEXTAUTH_SECRET**
- **Purpose**: Secures session cookies and JWT tokens
- **Security Risk**: Session hijacking, unauthorized access
- **How to Generate**:
  ```bash
  openssl rand -base64 32
  ```
- **Verification**: Minimum 32 characters
- **Example Format**: `mN3pQ5rS7tV9wX1yZ3bC5dF7gH9jK1lN+oP3qR5sT7v=`

### 4. **SUPABASE_SERVICE_ROLE_KEY**
- **Purpose**: Server-side database access with full permissions
- **Security Risk**: Full database access if exposed
- **Where to Find**: Supabase Dashboard > Settings > API
- **Verification**: Starts with `eyJ` (JWT format)
- **⚠️ WARNING**: Never expose this in client-side code!

### 5. **GOOGLE_CLIENT_SECRET**
- **Purpose**: OAuth authentication with Google
- **Security Risk**: Unauthorized access to Gmail data
- **Where to Find**: Google Cloud Console > APIs & Services > Credentials
- **Verification**: Format varies, typically alphanumeric
- **⚠️ WARNING**: Keep this server-side only!

## 🟡 Important Security Variables (SHOULD SET)

These enhance security but the app can function without them (with reduced security).

### 6. **NEXTAUTH_URL**
- **Purpose**: Validates OAuth callbacks, prevents redirect attacks
- **Default**: `http://localhost:3000` (development only)
- **Production**: Must be your actual domain (e.g., `https://yourdomain.com`)

### 7. **API_RATE_LIMIT**
- **Purpose**: Prevents API abuse, accidental loops
- **Recommended**: 60 requests per minute for personal use
- **Verification**: Integer value > 0

## 🟢 Privacy-Sensitive Variables

These contain personal information. While not security critical, protect them for privacy.

### 8. **USER_* Variables**
- Variables: `USER_FULL_NAME`, `USER_EMAIL`, `USER_PHONE`, etc.
- **Purpose**: Default values for resume generation
- **Privacy Risk**: Personal information exposure
- **Recommendation**: Use real data only in secured environments

## 📋 Security Verification Steps

Run these checks before deploying or using the application:

### 1. Environment File Permissions
```bash
# Check that .env.local is not tracked by git
git status --ignored | grep .env.local

# Set proper file permissions (Unix/Linux/Mac)
chmod 600 .env.local

# Verify permissions
ls -la .env.local
# Should show: -rw------- (only owner can read/write)
```

### 2. Key Strength Verification
```bash
# Check key lengths
node -e "
const env = require('fs').readFileSync('.env.local', 'utf8');
const keys = ['PERSONAL_API_KEY', 'ENCRYPTION_KEY', 'NEXTAUTH_SECRET'];
keys.forEach(key => {
  const match = env.match(new RegExp(key + '=(.+)'));
  if (match) {
    console.log(key + ': ' + match[1].length + ' chars');
  }
});
"
```

### 3. No Secrets in Code
```bash
# Search for hardcoded secrets (should return no results)
grep -r "SUPABASE_SERVICE_ROLE_KEY\|GOOGLE_CLIENT_SECRET\|ENCRYPTION_KEY" --exclude-dir=node_modules --exclude-dir=.git --exclude="*.env*" .

# Check for exposed API keys
grep -r "eyJ\|AIza\|SG\." --exclude-dir=node_modules --exclude-dir=.git --exclude="*.env*" .
```

### 4. HTTPS Enforcement
- **Development**: OK to use HTTP
- **Production**: Must use HTTPS for:
  - `NEXTAUTH_URL`
  - `GOOGLE_REDIRECT_URI`
  - Any public-facing URLs

### 5. Database Security
```sql
-- Run in Supabase SQL Editor to verify RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';
-- All tables should show rowsecurity = true
```

## 🚨 Security Best Practices

1. **Rotate Keys Regularly**
   - Personal API Key: Every 3 months
   - Encryption Key: Only if compromised (requires data migration)
   - NextAuth Secret: Every 6 months

2. **Backup Encryption Keys**
   - Store encryption keys in a password manager
   - Without the encryption key, encrypted data cannot be recovered

3. **Monitor Access**
   - Check Supabase logs regularly
   - Monitor Google OAuth access in Google Account settings
   - Review Gmail API usage in Google Cloud Console

4. **Local Development**
   - Use different keys for development vs production
   - Never use production database in development

5. **Git Security**
   - Add `.env*` to `.gitignore`
   - Use git-secrets or similar tools
   - Review commits before pushing

## 🔧 Troubleshooting

### "Invalid API Key" Error
1. Check key length (minimum 32 characters)
2. Ensure no spaces or newlines in the key
3. Verify the key is properly base64 encoded

### "Encryption Failed" Error
1. Verify ENCRYPTION_KEY is exactly 32 bytes when decoded
2. Check for special characters that might need escaping
3. Ensure the key hasn't changed (would break existing encrypted data)

### OAuth Not Working
1. Verify redirect URIs match in Google Console
2. Check NEXTAUTH_URL matches your actual URL
3. Ensure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are from the same project

## 📝 Quick Security Audit Command

Run this command to perform a basic security audit:

```bash
npm run security:check
```

This will verify:
- All required environment variables are set
- Key lengths meet minimum requirements
- No secrets are exposed in the codebase
- File permissions are correct

---

**Remember**: This is a personal-use application. While these security measures might seem excessive for personal use, they protect your Google account, personal data, and ensure the application remains secure even if accidentally exposed to the internet.