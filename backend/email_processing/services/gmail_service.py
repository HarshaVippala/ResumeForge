#!/usr/bin/env python3
"""
Gmail API Service
OAuth2 authentication and email processing for job search dashboard
"""

import os
import json
import base64
import email
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, TypedDict
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

import google.auth
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# Configure logging
logger = logging.getLogger(__name__)

# Gmail API scopes - READ ONLY (no send capabilities)
SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.modify'  # Only for marking as read
]

class EmailData(TypedDict):
    """Email data structure for workflow processing"""
    id: str
    thread_id: str
    subject: str
    sender: str
    sender_email: str
    recipient: str
    date: datetime
    body_text: str
    body_html: Optional[str]
    labels: List[str]
    is_unread: bool
    has_attachments: bool
    snippet: str

class GmailService:
    """
    Gmail API service with OAuth2 authentication
    Designed for LangGraph workflow integration
    """
    
    def __init__(self, credentials_file: str = None, token_file: str = None):
        """
        Initialize Gmail service
        
        Args:
            credentials_file: Path to OAuth2 credentials JSON
            token_file: Path to store OAuth2 tokens
        """
        self.credentials_file = credentials_file or os.path.join(
            os.path.dirname(__file__), '..', '..', 'config', 'gmail_credentials.json'
        )
        self.token_file = token_file or os.path.join(
            os.path.dirname(__file__), '..', '..', 'config', 'gmail_token.json'
        )
        self.service = None
        self._authenticate()
    
    def _authenticate(self) -> None:
        """Authenticate with Gmail API using OAuth2"""
        creds = None
        
        # Load existing token
        if os.path.exists(self.token_file):
            creds = Credentials.from_authorized_user_file(self.token_file, SCOPES)
        
        # If no valid credentials, get new ones
        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                try:
                    creds.refresh(Request())
                    logger.info("Gmail credentials refreshed successfully")
                except Exception as e:
                    logger.error(f"Failed to refresh Gmail credentials: {e}")
                    creds = None
            
            if not creds:
                if not os.path.exists(self.credentials_file):
                    raise FileNotFoundError(
                        f"Gmail credentials file not found: {self.credentials_file}\n"
                        "Please download from Google Cloud Console and place at this path."
                    )
                
                flow = InstalledAppFlow.from_client_secrets_file(
                    self.credentials_file, SCOPES
                )
                creds = flow.run_local_server(port=0)
                logger.info("Gmail authentication completed successfully")
            
            # Save credentials for future use
            with open(self.token_file, 'w') as token:
                token.write(creds.to_json())
        
        # Build Gmail service
        self.service = build('gmail', 'v1', credentials=creds)
        logger.info("Gmail service initialized successfully")
    
    def test_connection(self) -> bool:
        """Test Gmail API connection"""
        try:
            profile = self.service.users().getProfile(userId='me').execute()
            logger.info(f"Gmail connection successful. Email: {profile.get('emailAddress')}")
            return True
        except Exception as e:
            logger.error(f"Gmail connection failed: {e}")
            return False
    
    def get_recent_emails(self, 
                         query: str = None, 
                         max_results: int = 50,
                         days_back: int = 30,
                         primary_only: bool = True) -> List[EmailData]:
        """
        Fetch recent emails with job search focus
        
        Args:
            query: Gmail search query (default: job-related keywords)
            max_results: Maximum number of emails to fetch
            days_back: Number of days to look back
            primary_only: Only fetch from Primary inbox (recommended)
            
        Returns:
            List of processed email data
        """
        try:
            # Build query based on parameters
            if not query:
                # If no custom query provided, use default behavior
                date_filter = self._get_date_filter(days_back)
                primary_filter = " AND category:primary" if primary_only else ""
                
                # For first-time setup, get all emails from primary to let AI classify
                # This is more efficient than keyword filtering
                query = f"{date_filter}{primary_filter}"
            
            # Search for emails
            results = self.service.users().messages().list(
                userId='me',
                q=query,
                maxResults=max_results
            ).execute()
            
            messages = results.get('messages', [])
            logger.info(f"Found {len(messages)} emails matching query")
            
            # Process each email
            emails = []
            for message in messages:
                try:
                    email_data = self._process_email(message['id'])
                    if email_data:
                        emails.append(email_data)
                except Exception as e:
                    logger.error(f"Failed to process email {message['id']}: {e}")
                    continue
            
            logger.info(f"Successfully processed {len(emails)} emails")
            return emails
            
        except HttpError as e:
            logger.error(f"Gmail API error: {e}")
            return []
        except Exception as e:
            logger.error(f"Error fetching emails: {e}")
            return []
    
    def _process_email(self, message_id: str) -> Optional[EmailData]:
        """Process individual email message"""
        try:
            # Get full message
            message = self.service.users().messages().get(
                userId='me',
                id=message_id,
                format='full'
            ).execute()
            
            # Extract headers
            headers = {h['name']: h['value'] for h in message['payload']['headers']}
            
            # Extract body
            body_text, body_html = self._extract_body(message['payload'])
            
            # Parse date
            date_str = headers.get('Date', '')
            parsed_date = self._parse_email_date(date_str)
            
            # Extract sender info
            sender_full = headers.get('From', '')
            sender_name, sender_email = self._parse_sender(sender_full)
            
            # Check for attachments
            has_attachments = self._has_attachments(message['payload'])
            
            # Get labels
            labels = message.get('labelIds', [])
            is_unread = 'UNREAD' in labels
            
            return EmailData(
                id=message_id,
                thread_id=message['threadId'],
                subject=headers.get('Subject', ''),
                sender=sender_name,
                sender_email=sender_email,
                recipient=headers.get('To', ''),
                date=parsed_date,
                body_text=body_text,
                body_html=body_html,
                labels=labels,
                is_unread=is_unread,
                has_attachments=has_attachments,
                snippet=message.get('snippet', '')
            )
            
        except Exception as e:
            logger.error(f"Error processing email {message_id}: {e}")
            return None
    
    def _extract_body(self, payload: Dict) -> tuple[str, Optional[str]]:
        """Extract text and HTML body from email payload"""
        body_text = ""
        body_html = None
        
        def extract_from_part(part):
            nonlocal body_text, body_html
            
            if part.get('mimeType') == 'text/plain':
                data = part.get('body', {}).get('data', '')
                if data:
                    body_text = base64.urlsafe_b64decode(data).decode('utf-8', errors='ignore')
            
            elif part.get('mimeType') == 'text/html':
                data = part.get('body', {}).get('data', '')
                if data:
                    body_html = base64.urlsafe_b64decode(data).decode('utf-8', errors='ignore')
            
            # Handle multipart
            elif 'parts' in part:
                for subpart in part['parts']:
                    extract_from_part(subpart)
        
        extract_from_part(payload)
        return body_text, body_html
    
    def _parse_email_date(self, date_str: str) -> datetime:
        """Parse email date string to datetime"""
        try:
            # Parse RFC 2822 date format
            import email.utils
            timestamp = email.utils.parsedate_tz(date_str)
            if timestamp:
                return datetime.fromtimestamp(email.utils.mktime_tz(timestamp))
        except Exception:
            pass
        
        # Fallback to current time
        return datetime.now()
    
    def _parse_sender(self, sender_full: str) -> tuple[str, str]:
        """Parse sender name and email from 'Name <email>' format"""
        try:
            import email.utils
            name, email_addr = email.utils.parseaddr(sender_full)
            return name or email_addr, email_addr
        except Exception:
            return sender_full, sender_full
    
    def _has_attachments(self, payload: Dict) -> bool:
        """Check if email has attachments"""
        def check_parts(part):
            if part.get('filename'):
                return True
            if 'parts' in part:
                return any(check_parts(subpart) for subpart in part['parts'])
            return False
        
        return check_parts(payload)
    
    def _get_date_filter(self, days_back: int) -> str:
        """Generate Gmail date filter for recent emails"""
        date = datetime.now() - timedelta(days=days_back)
        return f"after:{date.strftime('%Y/%m/%d')}"
    
    # SEND EMAIL FUNCTIONALITY DISABLED FOR SECURITY
    # def send_email(self, ...): # REMOVED - No email sending allowed
    
    def mark_as_read(self, message_id: str) -> bool:
        """Mark email as read"""
        try:
            self.service.users().messages().modify(
                userId='me',
                id=message_id,
                body={'removeLabelIds': ['UNREAD']}
            ).execute()
            return True
        except Exception as e:
            logger.error(f"Failed to mark email as read: {e}")
            return False
    
    def add_label(self, message_id: str, label: str) -> bool:
        """Add label to email"""
        try:
            self.service.users().messages().modify(
                userId='me',
                id=message_id,
                body={'addLabelIds': [label]}
            ).execute()
            return True
        except Exception as e:
            logger.error(f"Failed to add label: {e}")
            return False
    
    def get_history_id(self) -> Optional[str]:
        """Get current history ID for incremental sync"""
        try:
            profile = self.service.users().getProfile(userId='me').execute()
            return profile.get('historyId')
        except Exception as e:
            logger.error(f"Failed to get history ID: {e}")
            return None
    
    def get_incremental_changes(self, start_history_id: str) -> List[Dict]:
        """Get incremental changes using Gmail History API"""
        try:
            changes = []
            next_page_token = None
            
            while True:
                history_request = {
                    'userId': 'me',
                    'startHistoryId': start_history_id,
                    'historyTypes': ['messageAdded', 'messageDeleted', 'labelAdded', 'labelRemoved']
                }
                
                if next_page_token:
                    history_request['pageToken'] = next_page_token
                
                history = self.service.users().history().list(**history_request).execute()
                
                if 'history' in history:
                    for record in history['history']:
                        # Process message additions
                        if 'messagesAdded' in record:
                            for msg_added in record['messagesAdded']:
                                message_id = msg_added['message']['id']
                                # Apply job-related filter
                                if self._is_job_related_message(message_id):
                                    changes.append({
                                        'type': 'added',
                                        'message_id': message_id,
                                        'history_id': record['id']
                                    })
                        
                        # Process message deletions
                        if 'messagesDeleted' in record:
                            for msg_deleted in record['messagesDeleted']:
                                changes.append({
                                    'type': 'deleted',
                                    'message_id': msg_deleted['message']['id'],
                                    'history_id': record['id']
                                })
                        
                        # Process label changes (for read status)
                        if 'labelsAdded' in record:
                            for label_added in record['labelsAdded']:
                                if 'UNREAD' in label_added.get('labelIds', []):
                                    changes.append({
                                        'type': 'marked_unread',
                                        'message_id': label_added['message']['id'],
                                        'history_id': record['id']
                                    })
                        
                        if 'labelsRemoved' in record:
                            for label_removed in record['labelsRemoved']:
                                if 'UNREAD' in label_removed.get('labelIds', []):
                                    changes.append({
                                        'type': 'marked_read',
                                        'message_id': label_removed['message']['id'],
                                        'history_id': record['id']
                                    })
                
                next_page_token = history.get('nextPageToken')
                if not next_page_token:
                    break
            
            logger.info(f"Found {len(changes)} incremental changes")
            return changes
            
        except HttpError as e:
            if e.resp.status == 404:
                logger.warning("History ID is too old, falling back to full sync")
                return []
            logger.error(f"Gmail History API error: {e}")
            return []
        except Exception as e:
            logger.error(f"Error getting incremental changes: {e}")
            return []
    
    def _is_job_related_message(self, message_id: str) -> bool:
        """Quick check if message is job-related using snippet"""
        try:
            message = self.service.users().messages().get(
                userId='me',
                id=message_id,
                format='minimal'
            ).execute()
            
            snippet = message.get('snippet', '').lower()
            headers = {h['name'].lower(): h['value'] for h in message.get('payload', {}).get('headers', [])}
            subject = headers.get('subject', '').lower()
            
            # Quick job-related keywords check
            job_keywords = [
                'interview', 'position', 'role', 'job', 'application', 'hiring',
                'recruiter', 'opportunity', 'candidate', 'offer', 'rejection',
                'screening', 'assessment', 'technical', 'onsite'
            ]
            
            text_to_check = f"{snippet} {subject}"
            return any(keyword in text_to_check for keyword in job_keywords)
            
        except Exception as e:
            logger.error(f"Error checking if message is job-related: {e}")
            return False
    
    def sync_incremental(self, start_history_id: str) -> Dict[str, any]:
        """Perform incremental sync from given history ID"""
        try:
            changes = self.get_incremental_changes(start_history_id)
            
            new_emails = []
            updated_emails = []
            deleted_email_ids = []
            
            for change in changes:
                if change['type'] == 'added':
                    # Process new email
                    email_data = self._process_email(change['message_id'])
                    if email_data:
                        new_emails.append(email_data)
                
                elif change['type'] == 'deleted':
                    deleted_email_ids.append(change['message_id'])
                
                elif change['type'] in ['marked_read', 'marked_unread']:
                    # Update read status
                    updated_emails.append({
                        'id': change['message_id'],
                        'is_unread': change['type'] == 'marked_unread'
                    })
            
            # Get current history ID for next sync
            current_history_id = self.get_history_id()
            
            return {
                'success': True,
                'new_emails': new_emails,
                'updated_emails': updated_emails,
                'deleted_email_ids': deleted_email_ids,
                'current_history_id': current_history_id,
                'changes_count': len(changes)
            }
            
        except Exception as e:
            logger.error(f"Error in incremental sync: {e}")
            return {
                'success': False,
                'error': str(e),
                'new_emails': [],
                'updated_emails': [],
                'deleted_email_ids': [],
                'current_history_id': None,
                'changes_count': 0
            }

if __name__ == "__main__":
    # Test the Gmail service
    logging.basicConfig(level=logging.INFO)
    
    try:
        gmail = GmailService()
        
        if gmail.test_connection():
            print("✅ Gmail connection successful!")
            
            # Test fetching recent emails
            emails = gmail.get_recent_emails(max_results=5)
            print(f"📧 Found {len(emails)} recent job-related emails")
            
            for email_data in emails[:3]:  # Show first 3
                print(f"\n📨 {email_data['subject']}")
                print(f"   From: {email_data['sender']} <{email_data['sender_email']}>")
                print(f"   Date: {email_data['date']}")
                print(f"   Snippet: {email_data['snippet'][:100]}...")
        else:
            print("❌ Gmail connection failed")
            
    except Exception as e:
        print(f"❌ Error: {e}")