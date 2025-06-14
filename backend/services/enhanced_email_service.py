#!/usr/bin/env python3
"""
Enhanced Email Service
Integrates the new email_processing module with existing API contracts
Replaces legacy unified services with modern architecture
"""

import logging
import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any

# Import our new email processing module
from email_processing.core.email_processor import EmailProcessor
from email_processing.models.email_data import EmailData
from email_processing.services.dashboard_service import DashboardService
from email_processing.services.storage_service import StorageService

logger = logging.getLogger(__name__)

class EnhancedEmailService:
    """
    Modern email service using the new email_processing module
    Maintains compatibility with existing API contracts
    """
    
    def __init__(self, database_manager, lm_studio_client=None):
        self.db_manager = database_manager
        self.lm_studio = lm_studio_client
        
        # Initialize new email processing components
        from email_processing.processors.openai_email_processor import OpenAIEmailProcessor
        
        # Use OpenAI unified processor
        self.openai_processor = OpenAIEmailProcessor()
        # Legacy EmailProcessor removed - using only OpenAI unified approach
        self.storage_service = StorageService(database_manager)
        self.dashboard_service = DashboardService(self.storage_service)
        
        # Simplified - no legacy dependency management
        self.company_manager = None
        
        # Processing stats
        self.processing_stats = {
            'emails_processed': 0,
            'successful_processing': 0,
            'companies_created': 0,
            'contacts_created': 0,
            'total_tokens_used': 0
        }
    
    def process_emails_comprehensive(self, 
                                   days_back: int = 14,
                                   max_results: int = 50,
                                   force_reprocess: bool = False) -> Dict[str, Any]:
        """
        Process emails using OpenAI unified processor
        Maintains compatibility with existing API
        """
        try:
            logger.info(f"Enhanced processing: {days_back} days, {max_results} emails, using OpenAI unified processor")
            
            # Get secure Gmail service
            from services.secure_gmail_service import SecureGmailService
            gmail = SecureGmailService()
            
            # Fetch recent emails from ALL categories (not just Primary)
            recent_emails = gmail.get_recent_emails(
                days_back=days_back, 
                max_results=max_results,
                primary_only=False  # Search all categories, not just Primary
            )
            logger.info(f"Fetched {len(recent_emails)} emails from Gmail for processing")
            
            if not recent_emails:
                return {
                    "success": False,
                    "error": "No emails found",
                    "total_emails": 0,
                    "processed_count": 0
                }
            
            # Convert to EmailData objects
            email_data_list = self._convert_to_email_data(recent_emails)
            
            # Filter already processed emails unless force_reprocess
            if not force_reprocess:
                email_data_list = self._filter_unprocessed_emails(email_data_list, days_back)
            
            logger.info(f"Processing {len(email_data_list)} emails with new architecture")
            
            # Process emails using OpenAI unified processor for better accuracy
            processing_results = self.openai_processor.process_emails_batch(email_data_list)
            
            # Store processed results and update company/contact data
            stored_count = 0
            companies_created = 0
            contacts_created = 0
            
            for result in processing_results:
                if result.success:
                    # Store in database
                    stored_id = self.storage_service.store_processed_email(result)
                    if stored_id:
                        stored_count += 1
                        
                        # Simplified - no complex company/contact tracking
            
            # Update stats
            self.processing_stats['emails_processed'] += len(email_data_list)
            self.processing_stats['successful_processing'] += stored_count
            self.processing_stats['companies_created'] += companies_created
            self.processing_stats['contacts_created'] += contacts_created
            
            # Get processing statistics from OpenAI processor
            openai_stats = self.openai_processor.get_statistics()
            self.processing_stats['total_tokens_used'] += openai_stats.get('total_tokens_used', 0)
            
            return {
                "success": True,
                "total_emails": len(recent_emails),
                "processed_count": stored_count,
                "processing_summary": {
                    "success_rate": (stored_count / len(email_data_list)) * 100 if email_data_list else 0,
                    "avg_tokens_per_email": openai_stats.get('average_tokens_per_email', 0),
                    "processing_time_ms": openai_stats.get('average_processing_time_ms', 0)
                }
            }
            
        except Exception as e:
            logger.error(f"Error in enhanced email processing: {e}")
            return {
                "success": False,
                "error": str(e),
                "total_emails": 0,
                "processed_count": 0
            }
    
    def get_email_activities(self, days_back: int = 14, limit: int = 50) -> Dict[str, Any]:
        """
        Get email activities using new dashboard service
        Maintains compatibility with existing frontend API contract
        """
        logger.info(f"Getting email activities: {days_back} days, limit {limit}")
        
        # Get dashboard data from new service
        dashboard_data = self.dashboard_service.get_dashboard_data(
            days_back=days_back,
            limit=limit
        )
        
        # Transform to match existing API format
        formatted_data = self._format_dashboard_data_for_api(dashboard_data)
        
        return {
            "success": True,
            "data": formatted_data,
            "emails_count": formatted_data.get("emails_processed", 0)
        }
    
    def refresh_emails_incremental(self, 
                                 user_email: str = "me",
                                 is_auto_refresh: bool = False) -> Dict[str, Any]:
        """
        True incremental email refresh using Gmail History API
        """
        start_time = datetime.now()
        
        try:
            from services.secure_gmail_service import SecureGmailService
            gmail = SecureGmailService()
            
            # Get last stored history ID
            last_history_id = self.storage_service.get_gmail_history_id(user_email)
            
            # Check if we have sufficient emails for incremental sync (need at least 5 for a good baseline)
            dashboard_check = self.get_email_activities(days_back=365*10, limit=10)
            email_count = dashboard_check.get("emails_count", 0)
            needs_full_sync = email_count < 5  # Force full sync if less than 5 emails
            
            if last_history_id and not needs_full_sync:
                # Perform true incremental sync using Gmail History API
                logger.info(f"Performing incremental sync from history ID: {last_history_id}")
                sync_result = gmail.sync_incremental(last_history_id)
                
                if sync_result['success']:
                    # Process new emails through multi-stage pipeline
                    new_emails_processed = 0
                    updated_emails_count = 0
                    deleted_emails_count = 0
                    
                    # Process new emails
                    if sync_result['new_emails']:
                        email_data_list = self._convert_gmail_to_email_data(sync_result['new_emails'])
                        processing_results = self.openai_processor.process_emails_batch(email_data_list)
                        
                        for result in processing_results:
                            if result.success:
                                stored_id = self.storage_service.store_processed_email(result)
                                if stored_id:
                                    new_emails_processed += 1
                    
                    # Handle updated emails (read status changes)
                    for updated_email in sync_result['updated_emails']:
                        success = self.storage_service.update_email_read_status(
                            updated_email['id'], 
                            updated_email['is_unread']
                        )
                        if success:
                            updated_emails_count += 1
                    
                    # Handle deleted emails
                    for deleted_email_id in sync_result['deleted_email_ids']:
                        success = self.storage_service.delete_email(deleted_email_id)
                        if success:
                            deleted_emails_count += 1
                    
                    # Store new history ID for next sync
                    if sync_result['current_history_id']:
                        self.storage_service.store_gmail_history_id(
                            sync_result['current_history_id'], user_email
                        )
                    
                    duration = (datetime.now() - start_time).total_seconds()
                    
                    # Get updated dashboard data
                    dashboard_data = self.get_email_activities(days_back=7, limit=50)
                    
                    return {
                        "success": True,
                        "sync_method": "gmail_history_api_incremental",
                        "emails_processed": new_emails_processed,
                        "new_emails": new_emails_processed,
                        "updated_emails": updated_emails_count,
                        "deleted_emails": deleted_emails_count,
                        "changes_detected": sync_result['changes_count'],
                        "tokens_used": 0,  # Incremental sync uses minimal tokens
                        "duration_seconds": duration,
                        "dashboard_data": dashboard_data.get("data", {}),
                        "message": f"Incremental sync: {new_emails_processed} new, {updated_emails_count} updated, {deleted_emails_count} deleted"
                    }
                else:
                    # History ID might be too old, fallback to full sync
                    logger.warning("Incremental sync failed, falling back to full sync")
                    
            # Fallback to full sync (first time, incremental failed, or insufficient emails)
            if needs_full_sync:
                logger.info(f"Performing full sync because database has insufficient emails ({email_count} < 5)")
            else:
                logger.info("Performing full sync (no history ID or incremental failed)")
            
            # Lightweight sync for auto-refresh vs comprehensive for manual, but do full historical sync if insufficient emails
            if needs_full_sync:
                days_back = 14  # Full 2-week historical sync for first time
                max_results = 100  # More emails for initial import
            else:
                days_back = 1 if is_auto_refresh else 3
                max_results = 20 if is_auto_refresh else 50
            
            # Process recent emails
            result = self.process_emails_comprehensive(
                days_back=days_back,
                max_results=max_results,
                force_reprocess=False
            )
            
            # Store current history ID for future incremental syncs
            current_history_id = gmail.get_history_id()
            if current_history_id:
                self.storage_service.store_gmail_history_id(current_history_id, user_email)
            
            duration = (datetime.now() - start_time).total_seconds()
            
            if result["success"]:
                # Get dashboard data for response
                dashboard_data = self.get_email_activities(days_back=days_back, limit=max_results)
                
                return {
                    "success": True,
                    "sync_method": "full_sync_with_history_setup",
                    "emails_processed": result["processed_count"],
                    "new_emails": result["processed_count"],
                    "tokens_used": result.get("processing_summary", {}).get("total_tokens", 0),
                    "duration_seconds": duration,
                    "dashboard_data": dashboard_data.get("data", {}),
                    "message": f"Full sync: {result['processed_count']} emails processed, incremental sync enabled"
                }
            else:
                return {
                    "success": False,
                    "error": result["error"],
                    "sync_method": "full_sync_failed",
                    "message": "Full email sync failed"
                }
                
        except Exception as e:
            logger.error(f"Error in incremental email refresh: {e}")
            return {
                "success": False,
                "error": str(e),
                "sync_method": "error",
                "tokens_used": 0,
                "message": "Failed to perform email refresh"
            }
    
    def get_processing_analytics(self) -> Dict[str, Any]:
        """
        Get processing analytics for email processing
        """
        # Get stats from OpenAI processor
        openai_stats = self.openai_processor.get_statistics()
        
        # Get storage statistics
        storage_stats = self.storage_service.get_processing_statistics()
        
        return {
            "processing_stats": self.processing_stats,
            "openai_processor_stats": openai_stats,
            "storage_statistics": storage_stats,
            "health_check": self.openai_processor.health_check()
        }
    
    def _convert_to_email_data(self, gmail_emails: List[Dict]) -> List[EmailData]:
        """Convert Gmail service EmailData to email_processing EmailData objects"""
        email_data_list = []
        
        for email in gmail_emails:
            email_data = EmailData(
                id=email.get('id', ''),
                subject=email.get('subject', ''),
                sender=email.get('sender', ''),
                recipient=email.get('recipient', ''),
                date=email.get('date'),
                body=email.get('body_text', ''),  # Map body_text to body
                snippet=email.get('snippet', ''),
                thread_id=email.get('thread_id', ''),
                is_read=not email.get('is_unread', False)  # Convert is_unread to is_read
            )
            email_data_list.append(email_data)
        
        return email_data_list
    
    def _filter_unprocessed_emails(self, email_data_list: List[EmailData], days_back: int) -> List[EmailData]:
        """Filter out already processed emails"""
        # Get processed email IDs from storage service
        processed_emails = self.storage_service.get_processed_emails(
            days_back=days_back,
            limit=1000  # Large limit to check all recent emails
        )
        processed_ids = {email['email_id'] for email in processed_emails}
        
        # Filter unprocessed emails
        unprocessed = [email for email in email_data_list if email.id not in processed_ids]
        
        logger.info(f"Filtered {len(email_data_list) - len(unprocessed)} already processed emails")
        return unprocessed
    
    # Simplified - removed complex company/contact tracking
    
    def _convert_gmail_to_email_data(self, gmail_emails: List[Dict]) -> List[EmailData]:
        """Convert Gmail service EmailData to email_processing EmailData objects"""
        email_data_list = []
        
        for gmail_email in gmail_emails:
            email_data = EmailData(
                id=gmail_email.get('id', ''),
                subject=gmail_email.get('subject', ''),
                sender=gmail_email.get('sender', ''),
                recipient=gmail_email.get('recipient', ''),
                date=gmail_email.get('date'),
                body=gmail_email.get('body_text', ''),
                snippet=gmail_email.get('snippet', ''),
                thread_id=gmail_email.get('thread_id', ''),
                is_read=not gmail_email.get('is_unread', False)
            )
            email_data_list.append(email_data)
        
        return email_data_list

    def _format_dashboard_data_for_api(self, dashboard_data: Dict[str, Any]) -> Dict[str, Any]:
        """Transform dashboard service output to match API format"""
        # Map new format to existing API contract
        formatted_data = {
            "email_activities": dashboard_data.get("email_activities", []),
            "attention_items": dashboard_data.get("attention_items", []),
            "quick_updates": dashboard_data.get("quick_updates", []),
            "upcoming_events": dashboard_data.get("upcoming_events", []),
            "emails_processed": dashboard_data.get("summary_stats", {}).get("total_emails", 0)
        }
        
        # Ensure email_activities have the expected structure
        for activity in formatted_data["email_activities"]:
            if "extracted_details" not in activity:
                activity["extracted_details"] = {}
            
            extracted_details = activity["extracted_details"]
            if "urgency" not in extracted_details:
                extracted_details["urgency"] = activity.get("urgency", "normal")
            if "confidence" not in extracted_details:
                extracted_details["confidence"] = activity.get("confidence", 0.0)
        
        return formatted_data
    
    # ===== EMAIL THREADING METHODS =====
    
    def get_threaded_dashboard_data(self, 
                                   days_back: int = 14, 
                                   limit: int = 50,
                                   user_email: str = "me") -> Dict[str, Any]:
        """
        Get threaded dashboard data using new dashboard service
        Maintains compatibility with frontend threading API
        """
        logger.info(f"Getting threaded dashboard data: {days_back} days, limit {limit}")
        
        try:
            # Get threaded dashboard data from new service
            dashboard_data = self.dashboard_service.get_threaded_dashboard_data(
                days_back=days_back,
                limit=limit,
                user_email=user_email
            )
            
            # Transform to match API format
            formatted_data = self._format_threaded_dashboard_for_api(dashboard_data)
            
            return {
                "success": True,
                "data": formatted_data,
                "threads_count": len(formatted_data.get("email_threads", []))
            }
            
        except Exception as e:
            logger.error(f"Error getting threaded dashboard data: {e}")
            return {
                "success": False,
                "error": str(e),
                "data": {
                    "email_threads": [],
                    "attention_items": [],
                    "upcoming_events": [],
                    "quick_updates": [],
                    "summary_stats": {}
                }
            }
    
    def get_thread_emails(self, thread_id: str) -> Dict[str, Any]:
        """
        Get all emails in a specific thread using dashboard service
        """
        logger.info(f"Getting emails for thread: {thread_id}")
        
        try:
            # Get thread emails from dashboard service
            thread_emails = self.dashboard_service.get_thread_emails(thread_id)
            
            return {
                "success": True,
                "data": thread_emails,
                "email_count": len(thread_emails)
            }
            
        except Exception as e:
            logger.error(f"Error getting thread emails for {thread_id}: {e}")
            return {
                "success": False,
                "error": str(e),
                "data": []
            }
    
    def _format_threaded_dashboard_for_api(self, dashboard_data: Dict[str, Any]) -> Dict[str, Any]:
        """Transform threaded dashboard service output to match API format"""
        
        formatted_data = {
            "email_threads": dashboard_data.get("email_threads", []),
            "attention_items": dashboard_data.get("attention_items", []),
            "upcoming_events": dashboard_data.get("upcoming_events", []),
            "quick_updates": dashboard_data.get("quick_updates", []),
            "summary_stats": dashboard_data.get("summary_stats", {})
        }
        
        # Ensure email_threads have the expected structure for frontend
        for thread in formatted_data["email_threads"]:
            # Ensure all required fields exist with defaults
            thread.setdefault("extracted_details", {})
            thread.setdefault("processing_quality", "good")
            thread.setdefault("actionable_summary", thread.get("summary", ""))
            
            # Ensure extracted_details has expected fields
            extracted_details = thread["extracted_details"]
            extracted_details.setdefault("urgency", thread.get("urgency", "normal"))
            extracted_details.setdefault("confidence", thread.get("confidence", 0.0))
            extracted_details.setdefault("position", thread.get("position", ""))
            extracted_details.setdefault("recruiter_name", "")
            extracted_details.setdefault("action_required", thread.get("actionable_summary", ""))
            extracted_details.setdefault("interview_date", "")
            extracted_details.setdefault("interview_time", "")
            extracted_details.setdefault("interview_platform", "")
            extracted_details.setdefault("deadline", thread.get("deadline", ""))
        
        return formatted_data