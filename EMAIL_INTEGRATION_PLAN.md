
# Email→JobTracker Integration Plan

## Overview
Personal Gmail integration for automatic job application tracking using local LM Studio models.

## Core Features
- Monitor Gmail for job application status emails (confirmations, rejections, interviews)
- Extract key information using LM Studio
- Auto-update JobTracker with email activity
- Match emails to existing job applications

## Architecture
```
Gmail API → Python Backend → LM Studio → Job Matching → JobTracker Update
```

## Implementation Plan

### 1. Gmail Integration (Python Backend)
```python
# Using Gmail API directly in Flask backend
from googleapiclient.discovery import build
from google.auth.transport.requests import Request

# Monitor emails with specific queries
query = "from:noreply OR from:recruiting OR subject:application"
```

### 2. Email Processing Pipeline
```python
# services/email_processor.py
class EmailJobProcessor:
    def __init__(self, lm_studio_client):
        self.lm_client = lm_studio_client
    
    def classify_email(self, email_content):
        # Send to LM Studio for classification
        prompt = f"""
        Analyze this email and extract:
        1. Company name
        2. Email type (application_confirmation, interview_invite, rejection)
        3. Job role/position
        4. Key details (interview date, next steps)
        
        Email: {email_content}
        """
        return self.lm_client.generate(prompt)
```

### 3. Job Matching Logic
- Match extracted company name to existing JobTracker entries
- Update job status based on email type
- Add email activity to job history

### 4. JobTracker Backend Integration
```python
# Add new endpoint to existing Flask app
@app.route('/api/process-emails', methods=['POST'])
def process_emails():
    # Fetch recent emails
    # Process with LM Studio
    # Update job tracker entries
    # Return updates for frontend
```

## Target Email Types
- **Application Confirmations**: "Thank you for applying"
- **Interview Invitations**: Schedule/reschedule requests
- **Rejections**: "We've decided to move forward with other candidates"
- **Status Updates**: "Your application is under review"

## Gmail API Requirements
- OAuth 2.0 setup for Gmail access
- Scopes: `gmail.readonly` for email monitoring
- Rate limits: Batch processing to avoid API limits

## Questions to Resolve
1. Gmail OAuth setup process
2. Processing frequency (batch vs real-time)
3. LM Studio model selection for text analysis
4. Error handling for failed email parsing

## Next Steps
1. Set up Gmail API credentials
2. Implement basic email fetching
3. Create LM Studio integration for email classification
4. Build job matching algorithm
5. Update JobTracker UI with email indicators

---
*Status: Planning Phase - Major prerequisite work needed before implementation*