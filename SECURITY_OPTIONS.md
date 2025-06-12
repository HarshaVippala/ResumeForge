# Security Options for Personal Use

## Option 1: Simple API Key (Recommended for Personal Use)

This is the simplest approach - just use a secret API key in your environment variables.

### Frontend (.env in Vercel):
```
NEXT_PUBLIC_API_KEY=your-secret-api-key-here
```

### Backend (.env):
```
API_KEY=your-secret-api-key-here
```

### Implementation:

1. **Frontend** - Add API key to all requests:
```typescript
// In api.config.ts
headers['X-API-Key'] = process.env.NEXT_PUBLIC_API_KEY
```

2. **Backend** - Simple middleware:
```python
def require_api_key(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        api_key = request.headers.get('X-API-Key')
        if api_key != os.getenv('API_KEY'):
            return jsonify({'error': 'Invalid API key'}), 401
        return f(*args, **kwargs)
    return decorated_function
```

## Option 2: Vercel Authentication (Built-in)

Use Vercel's password protection feature:
- Go to your Vercel project settings
- Under "Password Protection", enable it
- Set a password
- Anyone visiting your site needs the password to access it

## Option 3: Basic Auth with Vercel Edge

Add a simple password check at the edge:

```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const basicAuth = request.headers.get('authorization')
  
  if (!basicAuth) {
    return new Response('Authentication required', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Secure Area"' }
    })
  }
  
  const auth = basicAuth.split(' ')[1]
  const [user, pwd] = Buffer.from(auth, 'base64').toString().split(':')
  
  if (user !== 'your-username' || pwd !== 'your-password') {
    return new Response('Invalid credentials', { status: 401 })
  }
}
```

## Option 4: No Authentication (Simplest)

If your backend will only be accessible from your Vercel app:

1. **Deploy backend to a platform with private networking** (Railway, Fly.io)
2. **Use environment variables** for the backend URL
3. **Don't expose the backend URL publicly**

This way, only your Vercel app knows the backend URL.

## Recommended Approach for Personal Use

**Use Option 1 (API Key) + Option 2 (Vercel Password)**:
- Quick to implement
- Secure enough for personal use
- No user management needed
- Can be enhanced later if needed

### Quick Implementation:

1. Generate a random API key:
```bash
openssl rand -hex 32
```

2. Add to Vercel environment variables:
```
NEXT_PUBLIC_API_KEY=<generated-key>
```

3. Add simple check in backend:
```python
# In app.py, add this decorator to protected routes
def require_api_key(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if os.getenv('FLASK_ENV') == 'development':
            return f(*args, **kwargs)  # Skip in dev
        
        api_key = request.headers.get('X-API-Key')
        if api_key != os.getenv('API_KEY'):
            abort(401)
        return f(*args, **kwargs)
    return decorated

# Use it:
@app.route('/api/jobs')
@require_api_key
def get_jobs():
    # ... your code
```

This is secure enough for personal use and takes 5 minutes to implement!