# Response Sanitization

This module provides response sanitization to minimize sensitive data exposure in browser network requests.

## Usage

### Basic Usage

```typescript
import { sanitizeEmailResponse, sanitizeJobResponse } from './_lib/security/response-sanitizer';

// Sanitize single response
const sanitizedEmail = sanitizeEmailResponse(email);

// Sanitize array of responses
const sanitizedEmails = sanitizeBulkResponse(emails, sanitizeEmailResponse);
```

### Full Data Access

To get full unsanitized data, add `?full=true` to the request:

```bash
# Get full email data
GET /api/email?action=activities&full=true

# Get full job data
GET /api/jobs?full=true
```

You can also use the custom header:
```bash
X-Full-Data: true
```

## What Gets Sanitized

### Email Responses
- **Kept**: id, subject, sender info, 150-char preview, date, classification
- **Removed**: full content, gmail_message_id, thread_id, internal IDs

### Job Responses
- **Kept**: All public job info (title, company, location, salary, etc.)
- **Removed**: Internal database fields, tracking IDs

### Personal Information
- **Email**: `john.doe@example.com` → `joh****@example.com`
- **Phone**: `(555) 123-4567` → `(555) ***-**67`
- **SSN**: Fully masked
- **DOB**: Shows only year

### Application Responses
- **Kept**: Status, dates, basic references
- **Removed**: Detailed notes (shows "Has notes" indicator only)

## Implementation

The sanitization is implemented at the API layer before sending responses to the client. This ensures:

1. Reduced data exposure in browser developer tools
2. Smaller response payloads
3. Protection of sensitive information
4. Full data still accessible when needed for export/processing

## Adding New Sanitizers

To add a new sanitizer:

1. Create the sanitizer function in `response-sanitizer.ts`
2. Import and use in the relevant API endpoint
3. Always check `shouldReturnFullData(req)` to allow full data access
4. Document what fields are kept/removed

## Personal Use Note

Since this is a personal-use application, the sanitization is primarily for:
- Reducing accidental exposure when sharing screens
- Keeping browser network logs cleaner
- Good security practice

The `?full=true` parameter provides easy access to complete data when needed.