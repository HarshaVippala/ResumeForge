"""
Secure Gmail OAuth authentication service using environment variables and file-based token cache.
"""
import json
import os
from pathlib import Path
from typing import Optional, Dict, Any
import logging

from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build

logger = logging.getLogger(__name__)

class SecureGmailAuth:
    """Secure Gmail authentication with environment variable configuration."""
    
    def __init__(self):
        self.client_id = os.getenv('GOOGLE_CLIENT_ID')
        self.client_secret = os.getenv('GOOGLE_CLIENT_SECRET')
        self.token_file = Path('instance/gmail_token.json')  # Not in git
        
        if not self.client_id or not self.client_secret:
            raise ValueError(
                "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in environment variables"
            )
    
    def get_authorization_url(self) -> str:
        """Get the authorization URL for initial OAuth flow."""
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": ["http://localhost:8080/oauth/callback"]
                }
            },
            scopes=[
                'https://www.googleapis.com/auth/gmail.readonly',
                'https://www.googleapis.com/auth/gmail.modify'
            ]
        )
        flow.redirect_uri = "http://localhost:8080/oauth/callback"
        
        authorization_url, _ = flow.authorization_url(
            access_type='offline',  # Ensures refresh token
            include_granted_scopes='true'
        )
        return authorization_url
    
    def handle_oauth_callback(self, authorization_code: str) -> Dict[str, Any]:
        """Handle OAuth callback and save tokens."""
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": ["http://localhost:8080/oauth/callback"]
                }
            },
            scopes=[
                'https://www.googleapis.com/auth/gmail.readonly',
                'https://www.googleapis.com/auth/gmail.modify'
            ]
        )
        flow.redirect_uri = "http://localhost:8080/oauth/callback"
        
        # Exchange authorization code for tokens
        flow.fetch_token(code=authorization_code)
        
        # Save tokens securely
        credentials = flow.credentials
        token_data = {
            'token': credentials.token,
            'refresh_token': credentials.refresh_token,
            'token_uri': credentials.token_uri,
            'client_id': credentials.client_id,
            'client_secret': credentials.client_secret,
            'scopes': credentials.scopes
        }
        
        self._save_token(token_data)
        return token_data
    
    def _save_token(self, token_data: Dict[str, Any]) -> None:
        """Save token data to secure file."""
        # Ensure instance directory exists
        self.token_file.parent.mkdir(exist_ok=True)
        
        with open(self.token_file, 'w') as f:
            json.dump(token_data, f, indent=2)
        
        # Set restrictive permissions (owner read/write only)
        os.chmod(self.token_file, 0o600)
        logger.info("OAuth tokens saved securely")
    
    def _load_token(self) -> Optional[Dict[str, Any]]:
        """Load token data from secure file."""
        if not self.token_file.exists():
            return None
        
        try:
            with open(self.token_file, 'r') as f:
                return json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            logger.warning("Could not load token file")
            return None
    
    def get_gmail_service(self):
        """Get authenticated Gmail service."""
        token_data = self._load_token()
        if not token_data:
            raise ValueError("No valid tokens found. Please complete OAuth flow first.")
        
        # Create credentials from token data
        from google.oauth2.credentials import Credentials
        
        creds = Credentials(
            token=token_data.get('token'),
            refresh_token=token_data.get('refresh_token'),
            token_uri=token_data.get('token_uri'),
            client_id=self.client_id,
            client_secret=self.client_secret,
            scopes=token_data.get('scopes')
        )
        
        # Refresh if expired
        if creds.expired and creds.refresh_token:
            creds.refresh(Request())
            # Update saved token
            updated_token = {
                'token': creds.token,
                'refresh_token': creds.refresh_token,
                'token_uri': creds.token_uri,
                'client_id': creds.client_id,
                'client_secret': creds.client_secret,
                'scopes': creds.scopes
            }
            self._save_token(updated_token)
        
        return build('gmail', 'v1', credentials=creds)
    
    def is_authenticated(self) -> bool:
        """Check if valid authentication exists."""
        try:
            self.get_gmail_service()
            return True
        except Exception:
            return False