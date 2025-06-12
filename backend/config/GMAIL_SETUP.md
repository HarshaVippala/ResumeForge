# Gmail API Setup Instructions

## 📧 Gmail API Integration Setup

### Prerequisites
1. Google account with Gmail access
2. Google Cloud Console access

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Name it something like "Resume Job Tracker"

### Step 2: Enable Gmail API

1. In Google Cloud Console, go to **APIs & Services** > **Library**
2. Search for "Gmail API"
3. Click on **Gmail API** and click **Enable**

### Step 3: Create OAuth2 Credentials

1. Go to **APIs & Services** > **Credentials**
2. Click **+ CREATE CREDENTIALS** > **OAuth client ID**
3. If prompted, configure OAuth consent screen:
   - Choose **External** user type
   - Fill in required fields:
     - App name: "Resume Job Tracker"
     - User support email: Your email
     - Developer contact: Your email
   - Add scopes: `../auth/gmail.readonly`, `../auth/gmail.send`, `../auth/gmail.modify`
   - Add test users: Your email address

4. Create OAuth client ID:
   - Application type: **Desktop application**
   - Name: "Resume Job Tracker Desktop"
   - Click **Create**

### Step 4: Download Credentials

1. Download the JSON credentials file
2. Rename it to `gmail_credentials.json`
3. Place it in: `/backend/config/gmail_credentials.json`

### Step 5: Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### Step 6: Test Gmail Connection

```bash
cd backend
python services/gmail_service.py
```

This will:
1. Open your browser for Gmail authorization
2. Save authentication tokens
3. Test fetching recent job-related emails
4. Display sample email data

### Expected File Structure

```
backend/
├── config/
│   ├── gmail_credentials.json    # Your downloaded credentials
│   ├── gmail_token.json         # Auto-generated after auth
│   └── GMAIL_SETUP.md          # This file
└── services/
    └── gmail_service.py         # Gmail service implementation
```

### Security Notes

- **Never commit `gmail_credentials.json` or `gmail_token.json` to git**
- These files contain sensitive authentication data
- Add them to `.gitignore`

### Troubleshooting

**Error: "File not found: gmail_credentials.json"**
- Make sure you downloaded and placed the credentials file correctly

**Error: "Access blocked"**
- Make sure your app is in testing mode in OAuth consent screen
- Add your email as a test user

**Error: "Insufficient permissions"**
- Verify Gmail API is enabled
- Check OAuth scopes are correctly configured

### Next Steps

Once Gmail integration is working:
1. ✅ Fetch emails successfully  
2. 🔄 Implement email classification
3. 📊 Build workflow processing
4. 🗄️ Store in database
5. 📱 Display in dashboard

### API Rate Limits

Gmail API limits:
- **Quota**: 1 billion quota units per day
- **Per user rate limit**: 250 quota units per user per second
- **Batch requests**: Up to 100 requests per batch

Each email fetch ≈ 5 quota units, so you can fetch ~200 emails/second.