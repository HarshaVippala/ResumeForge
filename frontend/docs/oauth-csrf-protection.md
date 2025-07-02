# Gmail OAuth CSRF Protection Implementation

## Overview
This implementation adds CSRF (Cross-Site Request Forgery) protection to the Gmail OAuth flow to prevent account hijacking attacks.

## Implementation Details

### 1. Authorization Endpoint (`/api/oauth/authorize`)
- Generates a cryptographically secure random state token using `crypto.randomBytes(32).toString('hex')`
- Stores the state token in an httpOnly cookie with the following security settings:
  - `httpOnly: true` - Prevents JavaScript access
  - `secure: true` (in production) - HTTPS only
  - `sameSite: 'lax'` - CSRF protection
  - `maxAge: 600` - 10-minute expiry
- Includes the state parameter in the OAuth authorization URL

### 2. Callback Endpoint (`/api/oauth/callback`)
- Validates that both `code` and `state` parameters are present
- Retrieves the stored state from the httpOnly cookie
- Compares the received state with the stored state
- Returns a 400 error if states don't match (possible CSRF attack)
- Clears the state cookie after validation (whether successful or not)

### 3. Security Features
- **State Token**: 32 bytes of cryptographically secure random data (256 bits of entropy)
- **Cookie Security**: httpOnly, secure (HTTPS), and sameSite settings
- **Time Limit**: State tokens expire after 10 minutes
- **Single Use**: State cookie is deleted after validation

## API Endpoints

### `GET /api/oauth/authorize`
Initiates the OAuth flow with CSRF protection.
- Sets state cookie
- Redirects to Google OAuth consent page

### `GET /api/oauth/callback`
Handles the OAuth callback with CSRF validation.
- Query parameters: `code`, `state`, `error` (optional)
- Validates CSRF state
- Exchanges code for tokens
- Stores encrypted tokens in database
- Redirects to `/settings?oauth=success` on success

### `POST /api/oauth/disconnect`
Revokes OAuth access and removes stored tokens.

### `GET /api/oauth/status`
Checks if the user has valid Gmail OAuth credentials.

## Usage Example

```typescript
import { useGmailOAuth } from '@/hooks/useGmailOAuth';

function GmailSettings() {
  const { isAuthenticated, isLoading, error, startOAuthFlow, disconnect } = useGmailOAuth();

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      {isAuthenticated ? (
        <button onClick={disconnect}>Disconnect Gmail</button>
      ) : (
        <button onClick={startOAuthFlow}>Connect Gmail</button>
      )}
      {error && <p>Error: {error}</p>}
    </div>
  );
}
```

## Environment Variables Required

```bash
# Google OAuth
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=https://yourdomain.com/api/oauth/callback # Optional, defaults to CORS_ALLOWED_ORIGIN/api/oauth/callback

# For personal app
DEFAULT_USER_ID=your-user-id # Optional, defaults to 'default-user'

# General
CORS_ALLOWED_ORIGIN=https://yourdomain.com # Required for redirects
```

## Security Considerations

1. **HTTPS Required**: In production, ensure all OAuth endpoints are served over HTTPS
2. **Cookie Settings**: The implementation uses secure cookie settings appropriate for production
3. **State Validation**: Always validates state parameter to prevent CSRF attacks
4. **Token Encryption**: OAuth tokens are encrypted before storage using AES-256-GCM
5. **Error Handling**: Provides clear error messages while not exposing sensitive information

## Testing CSRF Protection

To test the CSRF protection:
1. Start an OAuth flow and note the state parameter in the URL
2. Try to access the callback URL with a different state value
3. The request should be rejected with a 400 error

## Future Improvements

1. Implement proper user authentication system
2. Add rate limiting to OAuth endpoints
3. Add monitoring for failed CSRF validations
4. Consider implementing PKCE for additional security