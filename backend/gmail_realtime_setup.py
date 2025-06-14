#!/usr/bin/env python3
"""
Gmail Real-Time Sync Implementation
Based on Google's Gmail API best practices for automatic email processing
"""

import os
import json
import base64
import logging
from typing import Dict, Any
from datetime import datetime, timedelta

from flask import Flask, request, jsonify
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
import google.auth.transport.requests

logger = logging.getLogger(__name__)

class GmailRealtimeSync:
    """
    Implements Gmail real-time synchronization using:
    1. Gmail Push Notifications (Cloud Pub/Sub)
    2. Watch Requests for automatic monitoring
    3. History API for efficient incremental sync
    """
    
    def __init__(self, credentials_path: str = None):
        self.credentials_path = credentials_path
        self.service = None
        self.topic_name = None
        self._setup_gmail_service()
    
    def _setup_gmail_service(self):
        """Initialize Gmail API service"""
        # Load credentials
        if os.path.exists('config/gmail_token.json'):
            creds = Credentials.from_authorized_user_file('config/gmail_token.json')
            if creds and creds.expired and creds.refresh_token:
                creds.refresh(google.auth.transport.requests.Request())
            self.service = build('gmail', 'v1', credentials=creds)
    
    def setup_push_notifications(self, topic_name: str, project_id: str) -> Dict[str, Any]:
        """
        Set up Gmail push notifications using Cloud Pub/Sub
        
        Steps required:
        1. Create Cloud Pub/Sub topic
        2. Grant Gmail API service account publish permissions
        3. Set up watch request with Gmail API
        """
        
        self.topic_name = f"projects/{project_id}/topics/{topic_name}"
        
        try:
            # Create watch request for Gmail inbox
            watch_request = {
                'labelIds': ['INBOX'],
                'topicName': self.topic_name,
                'labelFilterBehavior': 'INCLUDE'
            }
            
            # Execute watch request
            result = self.service.users().watch(userId='me', body=watch_request).execute()
            
            logger.info(f"Gmail watch request successful: {result}")
            return {
                'success': True,
                'history_id': result.get('historyId'),
                'expiration': result.get('expiration'),
                'topic_name': self.topic_name
            }
            
        except Exception as e:
            logger.error(f"Failed to setup Gmail push notifications: {e}")
            return {'success': False, 'error': str(e)}
    
    def create_webhook_endpoint(self, app: Flask):
        """
        Create Flask webhook endpoint to receive Gmail push notifications
        """
        
        @app.route('/api/gmail/webhook', methods=['POST'])
        def gmail_webhook():
            """
            Webhook endpoint that receives Gmail push notifications
            Triggers automatic email processing when new emails arrive
            """
            try:
                # Parse Pub/Sub message
                envelope = request.get_json()
                if not envelope:
                    logger.warning("No Pub/Sub message received")
                    return 'Bad Request', 400
                
                # Extract message data
                pubsub_message = envelope.get('message', {})
                if pubsub_message:
                    # Decode the message data
                    message_data = json.loads(
                        base64.b64decode(pubsub_message.get('data', '')).decode('utf-8')
                    ) if pubsub_message.get('data') else {}
                    
                    email_address = message_data.get('emailAddress')
                    history_id = message_data.get('historyId')
                    
                    logger.info(f"Gmail notification received for {email_address}, historyId: {history_id}")
                    
                    # Trigger automatic email processing
                    self._process_gmail_notification(email_address, history_id)
                
                return 'OK', 200
                
            except Exception as e:
                logger.error(f"Error processing Gmail webhook: {e}")
                return 'Internal Server Error', 500
    
    def _process_gmail_notification(self, email_address: str, history_id: str):
        """
        Process Gmail notification by triggering incremental sync
        This is where automatic email processing happens
        """
        try:
            # Import email processing service
            from services.enhanced_email_service import EnhancedEmailService
            from services.supabase_manager import SupabaseDatabaseManager
            from services.lm_studio_client import LMStudioClient
            
            # Initialize services
            db_manager = SupabaseDatabaseManager()
            lm_studio = LMStudioClient()
            email_service = EnhancedEmailService(db_manager, lm_studio)
            
            # Trigger incremental refresh with auto_refresh=True
            result = email_service.refresh_emails_incremental(
                user_email=email_address,
                is_auto_refresh=True,
                start_history_id=history_id
            )
            
            if result['success']:
                new_emails = result.get('new_emails', 0)
                if new_emails > 0:
                    logger.info(f"✅ Processed {new_emails} new emails automatically")
                    
                    # Optionally send notification to frontend
                    self._notify_frontend_new_emails(result)
                else:
                    logger.info("No new job-related emails to process")
            else:
                logger.error(f"Auto email processing failed: {result.get('error')}")
                
        except Exception as e:
            logger.error(f"Error in automatic email processing: {e}")
    
    def _notify_frontend_new_emails(self, processing_result: Dict[str, Any]):
        """
        Notify frontend about new processed emails
        Could use WebSockets, Server-Sent Events, or notification queue
        """
        # TODO: Implement real-time frontend notification
        # Options:
        # 1. WebSocket connection to push updates
        # 2. Server-Sent Events for real-time updates
        # 3. Database notification queue that frontend polls
        pass
    
    def get_incremental_changes(self, start_history_id: str) -> Dict[str, Any]:
        """
        Get incremental email changes using Gmail History API
        """
        try:
            # Get history changes since last sync
            history = self.service.users().history().list(
                userId='me',
                startHistoryId=start_history_id,
                historyTypes=['messageAdded', 'messageDeleted', 'labelAdded', 'labelRemoved']
            ).execute()
            
            changes = history.get('history', [])
            next_page_token = history.get('nextPageToken')
            
            # Process all pages of changes
            while next_page_token:
                page = self.service.users().history().list(
                    userId='me',
                    startHistoryId=start_history_id,
                    pageToken=next_page_token,
                    historyTypes=['messageAdded', 'messageDeleted', 'labelAdded', 'labelRemoved']
                ).execute()
                
                changes.extend(page.get('history', []))
                next_page_token = page.get('nextPageToken')
            
            return {
                'success': True,
                'changes': changes,
                'new_history_id': history.get('historyId')
            }
            
        except Exception as e:
            logger.error(f"Error getting incremental changes: {e}")
            return {'success': False, 'error': str(e)}
    
    def stop_watch(self):
        """Stop Gmail watch request"""
        try:
            result = self.service.users().stop(userId='me').execute()
            logger.info("Gmail watch stopped successfully")
            return {'success': True}
        except Exception as e:
            logger.error(f"Error stopping Gmail watch: {e}")
            return {'success': False, 'error': str(e)}


# Integration with existing Flask app
def setup_gmail_realtime(app: Flask):
    """
    Set up Gmail real-time sync with the existing Flask application
    """
    
    # Initialize Gmail real-time sync
    gmail_sync = GmailRealtimeSync()
    
    # Create webhook endpoint
    gmail_sync.create_webhook_endpoint(app)
    
    # Setup push notifications (requires Cloud Pub/Sub configuration)
    @app.route('/api/gmail/setup-realtime', methods=['POST'])
    def setup_realtime():
        """Endpoint to set up Gmail real-time notifications"""
        try:
            data = request.get_json() or {}
            project_id = data.get('project_id') or os.getenv('GOOGLE_CLOUD_PROJECT_ID')
            topic_name = data.get('topic_name', 'gmail-notifications')
            
            if not project_id:
                return jsonify({
                    'success': False,
                    'error': 'Google Cloud Project ID required'
                }), 400
            
            result = gmail_sync.setup_push_notifications(topic_name, project_id)
            return jsonify(result)
            
        except Exception as e:
            return jsonify({
                'success': False,
                'error': str(e)
            }), 500
    
    @app.route('/api/gmail/stop-realtime', methods=['POST'])
    def stop_realtime():
        """Endpoint to stop Gmail real-time notifications"""
        result = gmail_sync.stop_watch()
        return jsonify(result)
    
    return gmail_sync


if __name__ == "__main__":
    # Example usage
    print("Gmail Real-Time Sync Setup")
    print("=" * 50)
    print("This module provides:")
    print("1. Gmail Push Notifications via Cloud Pub/Sub")
    print("2. Webhook endpoints for automatic processing")
    print("3. History API integration for efficient sync")
    print("4. Real-time email processing when emails arrive")
    print()
    print("To enable real-time sync:")
    print("1. Set up Google Cloud Pub/Sub topic")
    print("2. Configure Gmail API permissions")
    print("3. Deploy webhook endpoint")
    print("4. Call /api/gmail/setup-realtime endpoint")