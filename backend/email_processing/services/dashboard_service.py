"""
Dashboard Service
Provides rich dashboard data from multi-stage processed emails
"""

import logging
import re
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from ..models.email_data import EmailType, UrgencyLevel
from ..models.processing_result import ProcessingResult

logger = logging.getLogger(__name__)

class DashboardService:
    """Service for generating rich dashboard data from processed emails"""
    
    def __init__(self, storage_service):
        self.storage = storage_service
    
    def get_dashboard_data(self, 
                          days_back: int = 14, 
                          limit: int = 50,
                          user_email: str = "me") -> Dict[str, Any]:
        """Get comprehensive dashboard data"""
        
        try:
            # Get processed emails from storage
            emails = self.storage.get_processed_emails(
                days_back=days_back,
                limit=limit
            )
            
            logger.info(f"Retrieved {len(emails)} processed emails from storage (days_back={days_back}, limit={limit})")
            
            # Generate dashboard sections
            dashboard_data = {
                'email_activities': self._generate_email_activities(emails),
                'attention_items': self._generate_attention_items(emails),
                'upcoming_events': self._generate_upcoming_events(emails),
                'quick_updates': self._generate_quick_updates(emails),
                'summary_stats': self._generate_summary_stats(emails)
            }
            
            logger.info(f"Generated dashboard data: {len(emails)} emails processed")
            return dashboard_data
            
        except Exception as e:
            logger.error(f"Error generating dashboard data: {e}")
            return self._get_empty_dashboard()
    
    def _generate_email_activities(self, emails: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Generate email activities list with rich information"""
        
        activities = []
        
        for email in emails:
            # Validate email data format
            if not isinstance(email, dict):
                logger.warning(f"Skipping invalid email data (not a dict): {type(email)}")
                continue
            # Skip non-job-related emails
            extracted_data = email.get('extracted_data', {})
            classification = extracted_data.get('classification', {})
            is_job_related = classification.get('is_job_related', False)
            
            if not is_job_related:
                continue
            
            # Get extracted data for rich details
            extracted_data = email.get('extracted_data', {})
            classification = extracted_data.get('classification', {})
            content_extraction = extracted_data.get('content_extraction', {})
            
            activity = {
                'id': email.get('email_id', f"email_{hash(str(email))}"),  # Use email_id or generate unique ID
                'type': email.get('email_type', 'other'),
                'subject': email.get('subject', ''),
                'sender': email.get('sender', ''),
                'company': email.get('company', 'Unknown Company'),
                'position': email.get('position', ''),
                'timestamp': email.get('email_date', ''),
                'status': 'unread' if not email.get('is_read', True) else 'read',
                
                # Rich summary from multi-stage processing
                'actionable_summary': content_extraction.get('actionable_summary', email.get('summary', '')),
                'confidence': classification.get('confidence', 0.0),
                'urgency': classification.get('urgency', 'normal'),
                
                # Extracted details
                'extracted_details': self._extract_email_details(email),
                
                # Processing metadata
                'processing_quality': self._assess_processing_quality(email)
            }
            
            activities.append(activity)
        
        # Sort purely by date (newest first) - no urgency grouping
        activities.sort(key=lambda x: x['timestamp'], reverse=True)
        
        return activities
    
    def _generate_attention_items(self, emails: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Generate items requiring immediate attention"""
        
        attention_items = []
        
        for email in emails:
            # Validate email data format
            if not isinstance(email, dict):
                logger.warning(f"Skipping invalid email data in attention items: {type(email)}")
                continue
            # Check for high urgency or action required
            needs_attention = (
                email.get('urgency') == 'high' or
                bool(email.get('action_required')) or
                self._has_urgent_deadline(email)
            )
            
            if needs_attention and email.get('is_job_related', False):
                # Get specific action items from structured data
                action_items = email.get('action_items', [])
                
                if action_items:
                    # Create attention items from action items
                    for action in action_items:
                        if action.get('priority') == 'high':
                            # Generate unique ID using email_id or hash as fallback
                            email_id = email.get('email_id') or email.get('id') or f"hash_{abs(hash(str(email)))}"
                            unique_action_id = f"{email_id}_{abs(hash(action.get('task', '')))}"
                            
                            logger.debug(f"Creating attention item from action - email_id: {email_id}, unique_action_id: {unique_action_id}")
                            
                            attention_items.append({
                                'id': unique_action_id,
                                'title': f"{action.get('task')} - {email.get('company', 'Unknown')}",
                                'description': self._format_action_description(action, email),
                                'urgency': action.get('priority', 'normal'),
                                'deadline': action.get('deadline', ''),
                                'email_id': email_id,
                                'email_type': email.get('email_type'),
                                'company': email.get('company', 'Unknown')
                            })
                else:
                    # Fallback to general attention item
                    email_id = email.get('email_id') or email.get('id') or f"hash_{abs(hash(str(email)))}"
                    
                    logger.debug(f"Creating general attention item - email_id: {email_id}")
                    
                    attention_items.append({
                        'id': email_id,
                        'title': f"{email.get('email_type', 'Email').replace('_', ' ').title()} from {email.get('company', 'Unknown')}",
                        'description': email.get('actionable_summary', 'Requires attention'),
                        'urgency': email.get('urgency', 'normal'),
                        'deadline': self._extract_deadline_from_email(email),
                        'email_id': email_id,
                        'email_type': email.get('email_type'),
                        'company': email.get('company', 'Unknown')
                    })
        
        # Sort by urgency and deadline
        attention_items.sort(key=lambda x: (
            0 if x['urgency'] == 'high' else 1,
            x['deadline'] or '9999-12-31'  # Empty deadlines go to end
        ))
        
        return attention_items[:10]  # Limit to top 10 most urgent
    
    def _generate_upcoming_events(self, emails: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Generate upcoming events (interviews, deadlines)"""
        
        events = []
        processed_event_keys = set()  # Track processed events to prevent duplicates
        now = datetime.now()
        
        for email in emails:
            # Validate email data format
            if not isinstance(email, dict):
                logger.warning(f"Skipping invalid email data in upcoming events: {type(email)}")
                continue
            if not email.get('is_job_related', False):
                continue
            
            logger.debug(f"Processing email for upcoming events - email_id: {email.get('email_id')}, id: {email.get('id')}, type: {email.get('email_type')}, company: {email.get('company')}")
            
            # Extract interview events - check multiple possible sources
            interview_details = email.get('interview_details', {})
            extracted_data = email.get('extracted_data', {}) or {}
            
            # Try multiple sources for interview information
            event_date_str = None
            event_time_str = ''
            platform = ''
            
            # Source 1: Direct interview_details
            if interview_details.get('date'):
                event_date_str = interview_details['date']
                event_time_str = interview_details.get('time', '')
                platform = interview_details.get('platform', '')
                logger.debug(f"Found interview date from interview_details: '{event_date_str}', time: '{event_time_str}'")
            
            # Source 2: extracted_data content_extraction
            elif extracted_data.get('content_extraction', {}).get('interview_date'):
                content_extraction = extracted_data['content_extraction']
                event_date_str = content_extraction.get('interview_date')
                event_time_str = content_extraction.get('interview_time', '')
                platform = content_extraction.get('interview_platform', '')
                logger.debug(f"Found interview date from content_extraction: '{event_date_str}', time: '{event_time_str}'")
            
            # Source 3: Try to extract from actionable_summary or content
            elif email.get('email_type') == 'interview':
                # Look for date patterns in summary/content
                summary_text = (email.get('actionable_summary') or 
                               email.get('summary') or 
                               email.get('content') or '')
                
                # Look for date patterns like "Thursday, June 19th, 2025"
                import re
                date_pattern = r'(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+([A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4})'
                time_pattern = r'(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)(?:\s*[A-Z]{2,4})?)'
                
                date_match = re.search(date_pattern, summary_text)
                time_match = re.search(time_pattern, summary_text)
                
                logger.debug(f"Searching for date patterns in summary text: '{summary_text[:100]}...'")
                
                if date_match:
                    event_date_str = date_match.group(0)  # Full match including day of week
                    if time_match:
                        event_time_str = time_match.group(1)
                    
                    logger.debug(f"Found interview date from text patterns: '{event_date_str}', time: '{event_time_str}'")
                    
                    # Extract platform from text
                    if 'google meet' in summary_text.lower():
                        platform = 'Google Meet'
                    elif 'zoom' in summary_text.lower():
                        platform = 'Zoom'
                    elif 'teams' in summary_text.lower():
                        platform = 'Microsoft Teams'
                else:
                    logger.debug("No date patterns found in summary text")
            
            if event_date_str:
                logger.debug(f"Attempting to parse event date: '{event_date_str}' with time: '{event_time_str}'")
                event_date = self._parse_flexible_datetime(event_date_str, event_time_str)
                
                if event_date and event_date > now:  # Only future events
                    # Create stable key based on event content to prevent duplicates
                    company = email.get('company', 'Unknown')
                    position = email.get('position', 'Position')
                    stable_event_key = f"interview_{company}_{position}_{event_date_str}"
                    
                    if stable_event_key in processed_event_keys:
                        logger.debug(f"Skipping duplicate interview event: {stable_event_key}")
                        continue  # Skip this duplicate event
                    
                    processed_event_keys.add(stable_event_key)
                    
                    # Generate stable unique ID based on event content
                    unique_event_id = f"interview_{abs(hash(stable_event_key))}"
                    email_id = email.get('email_id') or email.get('id') or f"hash_{abs(hash(str(email)))}"
                    
                    logger.info(f"Creating interview event - stable_key: {stable_event_key}, unique_event_id: {unique_event_id}")
                    
                    events.append({
                        'id': unique_event_id,
                        'type': 'interview',
                        'title': f"Interview - {position}",
                        'company': company,
                        'position': position,
                        'date': event_date_str,  # Keep original string for display
                        'time': event_time_str,
                        'platform': platform or 'Unknown',
                        'description': f"Interview for {position} at {company}",
                        'email_id': email_id,
                        'parsed_date_obj': event_date  # Store parsed date for sorting
                    })
                    logger.info(f"Successfully created interview event: {unique_event_id} - {event_date_str} for {company}")
                elif event_date and event_date <= now:
                    logger.debug(f"Interview date is in the past, skipping: {event_date_str} for {email.get('company')}")
                else:
                    email_id = email.get('email_id') or email.get('id') or 'unknown'
                    logger.warning(f"Could not parse interview date: '{event_date_str}' for email {email_id}")
            elif email.get('email_type') == 'interview':
                email_id = email.get('email_id') or email.get('id') or 'unknown'
                logger.warning(f"Interview email found but no date extracted for email {email_id}")
            
            # Extract assessment deadlines
            key_info = email.get('key_info', [])
            for info in key_info:
                if info.get('type') == 'deadline' and info.get('value'):
                    deadline_date_str = info['value']
                    logger.debug(f"Processing deadline: '{deadline_date_str}' for email {email.get('email_id') or email.get('id')}")
                    
                    # Assuming deadline value might be just date or full datetime
                    deadline_date = self._parse_flexible_datetime(deadline_date_str, '')  # Pass empty string for time
                    if deadline_date and deadline_date > now:
                        # Create stable key based on event content to prevent duplicates
                        company = email.get('company', 'Unknown')
                        task_label = info.get('label', 'Task')
                        stable_event_key = f"deadline_{company}_{task_label}_{deadline_date_str}"
                        
                        if stable_event_key in processed_event_keys:
                            logger.debug(f"Skipping duplicate deadline event: {stable_event_key}")
                            continue
                        
                        processed_event_keys.add(stable_event_key)
                        
                        # Generate stable unique ID based on event content
                        unique_deadline_id = f"deadline_{abs(hash(stable_event_key))}"
                        email_id = email.get('email_id') or email.get('id') or f"hash_{abs(hash(str(email)))}"
                        
                        logger.info(f"Creating deadline event - stable_key: {stable_event_key}, unique_deadline_id: {unique_deadline_id}")
                        
                        events.append({
                            'id': unique_deadline_id,
                            'type': 'deadline',
                            'title': f"Deadline - {task_label}",
                            'company': company,
                            'date': info['value'],
                            'description': f"{task_label} deadline for {company}",
                            'email_id': email_id,
                            'urgency': 'high' if (deadline_date - now).days <= 3 else 'normal',
                            'parsed_date_obj': deadline_date
                        })
                        logger.info(f"Successfully created deadline event: {unique_deadline_id}")
                    else:
                        logger.debug(f"Deadline date is invalid or in the past: '{deadline_date_str}'")
        
        # Sort by parsed date
        events.sort(key=lambda x: x.get('parsed_date_obj', datetime.max))
        
        logger.info(f"Generated {len(events)} unique upcoming events from {len(emails)} emails (processed {len(processed_event_keys)} unique event keys)")
        for event in events[:5]:  # Log first 5 events for debugging
            logger.debug(f"Event: {event['id']} - {event['type']} - {event['date']} - {event['company']}")
        
        return events[:15]  # Limit to next 15 events
    
    def _generate_quick_updates(self, emails: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Generate quick status updates"""
        
        updates = []
        
        # Recent rejections with feedback
        recent_rejections = [
            email for email in emails
            if isinstance(email, dict) and 
               email.get('email_type') == 'rejection' and
               email.get('actionable_summary') and
               len(email.get('actionable_summary', '')) > 50
        ][:3]
        
        for rejection in recent_rejections:
            updates.append({
                'type': 'rejection_feedback',
                'title': f"Feedback from {rejection.get('company', 'Company')}",
                'message': rejection.get('actionable_summary', '')[:100] + "...",
                'timestamp': rejection.get('email_date'),
                'action': 'Review feedback and adjust strategy'
            })
        
        # Recent offers
        recent_offers = [
            email for email in emails
            if isinstance(email, dict) and email.get('email_type') == 'offer'
        ][:2]
        
        for offer in recent_offers:
            updates.append({
                'type': 'offer_received',
                'title': f"Offer from {offer.get('company', 'Company')}",
                'message': f"Job offer for {offer.get('position', 'position')} received",
                'timestamp': offer.get('email_date'),
                'action': 'Review offer details'
            })
        
        # Pending responses
        pending_responses = [
            email for email in emails
            if isinstance(email, dict) and 
               email.get('urgency') == 'high' and
               'respond' in email.get('actionable_summary', '').lower()
        ][:3]
        
        for pending in pending_responses:
            updates.append({
                'type': 'response_needed',
                'title': f"Response needed - {pending.get('company', 'Company')}",
                'message': pending.get('actionable_summary', '')[:100] + "...",
                'timestamp': pending.get('email_date'),
                'action': 'Respond promptly'
            })
        
        # Sort by timestamp
        updates.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
        
        return updates[:8]  # Limit to 8 updates
    
    def _generate_summary_stats(self, emails: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Generate summary statistics"""
        
        job_related_emails = [email for email in emails if isinstance(email, dict) and email.get('is_job_related', False)]
        
        if not job_related_emails:
            return {
                'total_emails': 0,
                'by_type': {},
                'by_urgency': {},
                'by_company': {},
                'response_rate': 0,
                'processing_quality': 0
            }
        
        # Count by type
        by_type = {}
        for email in job_related_emails:
            email_type = email.get('email_type', 'other')
            by_type[email_type] = by_type.get(email_type, 0) + 1
        
        # Count by urgency
        by_urgency = {}
        for email in job_related_emails:
            urgency = email.get('urgency', 'normal')
            by_urgency[urgency] = by_urgency.get(urgency, 0) + 1
        
        # Count by company
        by_company = {}
        for email in job_related_emails:
            company = email.get('company', 'Unknown')
            by_company[company] = by_company.get(company, 0) + 1
        
        # Calculate processing quality (average confidence)
        confidences = [email.get('confidence', 0) for email in job_related_emails]
        avg_confidence = sum(confidences) / len(confidences) if confidences else 0
        
        return {
            'total_emails': len(job_related_emails),
            'by_type': by_type,
            'by_urgency': by_urgency,
            'by_company': dict(sorted(by_company.items(), key=lambda x: x[1], reverse=True)[:10]),
            'processing_quality': round(avg_confidence * 100, 1),
            'high_priority_count': by_urgency.get('high', 0)
        }
    
    def _extract_email_details(self, email: Dict[str, Any]) -> Dict[str, Any]:
        """Extract detailed information for email activity"""
        
        details = {
            'position': email.get('position', ''),
            'recruiter_name': '',
            'action_required': email.get('actionable_summary', ''),
            'interview_date': '',
            'interview_time': '',
            'interview_platform': '',
            'urgency': email.get('urgency', 'normal'),
            'deadline': '',
            'confidence': email.get('confidence', 0.0)
        }
        
        # Extract from interview details
        interview_details = email.get('interview_details', {})
        if interview_details:
            details.update({
                'interview_date': interview_details.get('date', ''),
                'interview_time': interview_details.get('time', ''),
                'interview_platform': interview_details.get('platform', '')
            })
        
        # Extract deadline from key info
        key_info = email.get('key_info', [])
        for info in key_info:
            if info.get('type') == 'deadline':
                details['deadline'] = info.get('value', '')
                break
            elif info.get('type') == 'contact' and 'recruiter' in info.get('label', '').lower():
                details['recruiter_name'] = info.get('value', '')
        
        return details
    
    def _assess_processing_quality(self, email: Dict[str, Any]) -> str:
        """Assess the quality of email processing"""
        
        confidence = email.get('confidence', 0.0)
        has_actionable_summary = bool(email.get('actionable_summary'))
        has_company = bool(email.get('company')) and email.get('company') != 'Unknown Company'
        
        if confidence >= 0.8 and has_actionable_summary and has_company:
            return 'excellent'
        elif confidence >= 0.6 and (has_actionable_summary or has_company):
            return 'good'
        elif confidence >= 0.4:
            return 'fair'
        else:
            return 'poor'
    
    def _has_urgent_deadline(self, email: Dict[str, Any]) -> bool:
        """Check if email has an urgent deadline"""
        
        now = datetime.now()
        urgent_threshold = now + timedelta(days=2)  # Next 2 days
        
        # Check action items for deadlines
        action_items = email.get('action_items', [])
        for action in action_items:
            deadline_str = action.get('deadline', '')
            if deadline_str:
                try:
                    deadline = datetime.fromisoformat(deadline_str.replace('Z', '+00:00'))
                    if deadline <= urgent_threshold:
                        return True
                except (ValueError, TypeError):
                    pass
        
        # Check key info for deadlines
        key_info = email.get('key_info', [])
        for info in key_info:
            if info.get('type') == 'deadline':
                deadline_str = info.get('value', '')
                try:
                    deadline = datetime.fromisoformat(deadline_str.replace('Z', '+00:00'))
                    if deadline <= urgent_threshold:
                        return True
                except (ValueError, TypeError):
                    pass
        
        return False
    
    def _format_action_description(self, action: Dict[str, Any], email: Dict[str, Any]) -> str:
        """Format action item description for attention items"""
        
        task = action.get('task', '')
        deadline = action.get('deadline', '')
        
        if deadline:
            return f"{task} (Due: {deadline})"
        else:
            return task
    
    def _extract_deadline_from_email(self, email: Dict[str, Any]) -> str:
        """Extract the most relevant deadline from email"""
        
        # Check action items first
        action_items = email.get('action_items', [])
        for action in action_items:
            if action.get('deadline'):
                return action['deadline']
        
        # Check key info
        key_info = email.get('key_info', [])
        for info in key_info:
            if info.get('type') == 'deadline' and info.get('value'):
                return info['value']
        
        return ''
    
    def _get_empty_dashboard(self) -> Dict[str, Any]:
        """Return empty dashboard structure"""
        
        return {
            'email_activities': [],
            'attention_items': [],
            'upcoming_events': [],
            'quick_updates': [],
            'summary_stats': {
                'total_emails': 0,
                'by_type': {},
                'by_urgency': {},
                'by_company': {},
                'processing_quality': 0,
                'high_priority_count': 0
            }
        }
    
    # ===== EMAIL THREADING METHODS =====
    
    def get_threaded_dashboard_data(self, 
                                   days_back: int = 14, 
                                   limit: int = 50,
                                   user_email: str = "me") -> Dict[str, Any]:
        """Get dashboard data organized by email threads"""
        
        try:
            # Get email threads from storage
            threads = self.storage.get_email_threads(
                days_back=days_back,
                limit=limit
            )
            
            logger.info(f"Retrieved {len(threads)} email threads from storage (days_back={days_back}, limit={limit})")
            
            # Generate threaded dashboard sections
            dashboard_data = {
                'email_threads': self._generate_email_threads(threads),
                'attention_items': self._generate_attention_items_from_threads(threads),
                'upcoming_events': self._generate_upcoming_events_from_threads(threads),
                'quick_updates': self._generate_quick_updates_from_threads(threads),
                'summary_stats': self._generate_thread_summary_stats(threads)
            }
            
            logger.info(f"Generated threaded dashboard data: {len(threads)} threads processed -> {len(dashboard_data['email_threads'])} threads shown")
            return dashboard_data
            
        except Exception as e:
            logger.error(f"Error generating threaded dashboard data: {e}")
            return self._get_empty_threaded_dashboard()
    
    def get_thread_emails(self, thread_id: str) -> List[Dict[str, Any]]:
        """Get all emails in a specific thread with rich formatting"""
        
        try:
            emails = self.storage.get_emails_in_thread(thread_id)
            
            # Format emails for frontend consumption
            formatted_emails = []
            for email in emails:
                formatted_email = self._format_thread_email(email)
                formatted_emails.append(formatted_email)
            
            return formatted_emails
            
        except Exception as e:
            logger.error(f"Error getting thread emails for {thread_id}: {e}")
            return []
    
    def _generate_email_threads(self, threads: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Generate formatted email threads for the dashboard"""
        
        formatted_threads = []
        
        for thread in threads:
            latest_email = thread['latest_email']
            extracted_data = latest_email.get('extracted_data', {}) or {}
            
            # Skip non-job-related threads
            classification = extracted_data.get('classification', {})
            is_job_related = classification.get('is_job_related', False)
            
            # Also consider a thread job-related if a company has been extracted,
            # as this is a strong signal that the thread is relevant even if the latest email
            # (e.g., a "Thank you!" reply) isn't classified as job-related
            company = latest_email.get('company', 'Unknown Company')
            is_company_present = company and company != 'Unknown Company' and company != 'Unknown'
            
            if not is_job_related and not is_company_present:
                logger.debug(f"Skipping thread {thread['thread_id']} - not job-related and no company extracted")
                continue
            
            logger.debug(f"Including thread {thread['thread_id']} - is_job_related: {is_job_related}, company: {company}")
            
            thread_data = {
                'thread_id': thread['thread_id'],
                'email_count': thread['email_count'],
                'unread_count': thread['unread_count'],
                'latest_email_date': thread['latest_email_date'],
                'first_email_date': thread['first_email_date'],
                'participants': thread['participants'],
                
                # Latest email details for thread summary
                'subject': latest_email.get('subject', ''),
                'company': latest_email.get('company', 'Unknown Company'),
                'position': latest_email.get('position', ''),
                'email_type': latest_email.get('email_type', 'other'),
                'urgency': latest_email.get('urgency', 'normal'),
                'summary': latest_email.get('summary', ''),
                'sender': latest_email.get('sender', ''),
                'recipient': latest_email.get('recipient', ''),
                'application_status': latest_email.get('application_status', ''),
                'deadline': latest_email.get('deadline'),
                
                # Thread-specific details
                'has_unread': thread['unread_count'] > 0,
                'is_multi_email': thread['email_count'] > 1,
                'thread_duration_days': self._calculate_thread_duration(
                    thread['first_email_date'], 
                    thread['latest_email_date']
                ),
                
                # Extracted details from latest email
                'extracted_details': self._extract_email_details(latest_email),
                'processing_quality': self._assess_processing_quality(latest_email),
                'actionable_summary': self._get_actionable_summary(latest_email),
                'confidence': classification.get('confidence', 0.0)
            }
            
            formatted_threads.append(thread_data)
        
        # Sort by latest email date (newest first)
        formatted_threads.sort(key=lambda x: x['latest_email_date'], reverse=True)
        
        return formatted_threads
    
    def _format_thread_email(self, email: Dict[str, Any]) -> Dict[str, Any]:
        """Format an individual email within a thread"""
        
        extracted_data = email.get('extracted_data', {}) or {}
        
        return {
            'id': email.get('email_id', email.get('id')),
            'thread_id': email.get('thread_id'),
            'subject': email.get('subject', ''),
            'sender': email.get('sender', ''),
            'recipient': email.get('recipient', ''),
            'email_date': email.get('email_date'),
            'content': email.get('content', ''),
            'snippet': email.get('snippet', ''),
            'is_unread': email.get('is_unread', False),
            'company': email.get('company', ''),
            'position': email.get('position', ''),
            'email_type': email.get('email_type', 'other'),
            'urgency': email.get('urgency', 'normal'),
            'summary': email.get('summary', ''),
            'application_status': email.get('application_status', ''),
            'deadline': email.get('deadline'),
            'requires_action': email.get('requires_action', False),
            'confidence_score': email.get('confidence_score', 0.0),
            
            # Rich extracted details
            'extracted_details': self._extract_email_details(email),
            'actionable_summary': self._get_actionable_summary(email),
            'processing_quality': self._assess_processing_quality(email)
        }
    
    def _generate_attention_items_from_threads(self, threads: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Generate attention items from email threads"""
        
        attention_items = []
        
        for thread in threads:
            latest_email = thread['latest_email']
            
            # Check for urgent items or deadlines
            if (thread['unread_count'] > 0 and 
                latest_email.get('urgency') == 'high' or
                latest_email.get('requires_action', False)):
                
                item = {
                    'type': 'thread_attention',
                    'thread_id': thread['thread_id'],
                    'title': f"{thread['email_count']} emails from {latest_email.get('company', 'Unknown')}",
                    'description': latest_email.get('summary', 'Requires attention'),
                    'urgency': latest_email.get('urgency', 'normal'),
                    'deadline': latest_email.get('deadline'),
                    'unread_count': thread['unread_count']
                }
                attention_items.append(item)
        
        return attention_items[:10]  # Limit to top 10
    
    def _generate_upcoming_events_from_threads(self, threads: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Generate upcoming events from email threads"""
        
        events = []
        processed_event_keys = set()  # Track processed events to prevent duplicates
        now = datetime.now()
        
        for thread in threads:
            latest_email = thread['latest_email']
            extracted_data = latest_email.get('extracted_data', {}) or {}
            
            # Look for interview or meeting information
            if latest_email.get('email_type') == 'interview':
                content_extraction = extracted_data.get('content_extraction', {})
                interview_details = latest_email.get('interview_details', {})
                
                # Try multiple sources for interview information
                event_date_str = None
                event_time_str = ''
                platform = ''
                
                # Source 1: Direct interview_details
                if interview_details.get('date'):
                    event_date_str = interview_details['date']
                    event_time_str = interview_details.get('time', '')
                    platform = interview_details.get('platform', '')
                
                # Source 2: content_extraction
                elif content_extraction.get('interview_date'):
                    event_date_str = content_extraction.get('interview_date')
                    event_time_str = content_extraction.get('interview_time', '')
                    platform = content_extraction.get('interview_platform', '')
                
                # Source 3: deadline field
                elif latest_email.get('deadline'):
                    event_date_str = latest_email.get('deadline')
                
                # Source 4: Extract from summary/content text
                else:
                    summary_text = (latest_email.get('actionable_summary') or 
                                   latest_email.get('summary') or 
                                   latest_email.get('content') or '')
                    
                    # Look for date patterns like "Thursday, June 19th, 2025"
                    import re
                    date_pattern = r'(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+([A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4})'
                    time_pattern = r'(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)(?:\s*[A-Z]{2,4})?)'
                    
                    date_match = re.search(date_pattern, summary_text)
                    time_match = re.search(time_pattern, summary_text)
                    
                    if date_match:
                        event_date_str = date_match.group(0)  # Full match including day of week
                        if time_match:
                            event_time_str = time_match.group(1)
                        
                        # Extract platform from text
                        if 'google meet' in summary_text.lower():
                            platform = 'Google Meet'
                        elif 'zoom' in summary_text.lower():
                            platform = 'Zoom'
                        elif 'teams' in summary_text.lower():
                            platform = 'Microsoft Teams'
                
                if event_date_str:
                    parsed_event_date = self._parse_flexible_datetime(event_date_str, event_time_str)
                    
                    if parsed_event_date and parsed_event_date > now:  # Only future events
                        # Create stable key based on event content to prevent duplicates
                        company = latest_email.get('company', 'Unknown')
                        position = latest_email.get('position', '')
                        stable_event_key = f"interview_{company}_{position}_{event_date_str}"
                        
                        if stable_event_key in processed_event_keys:
                            logger.debug(f"Skipping duplicate thread interview event: {stable_event_key}")
                            continue  # Skip this duplicate event
                        
                        processed_event_keys.add(stable_event_key)
                        
                        events.append({
                            'type': 'interview',
                            'thread_id': thread['thread_id'],
                            'company': company,
                            'position': position,
                            'date': event_date_str,  # Keep original string for display
                            'time': event_time_str,
                            'platform': platform or content_extraction.get('interview_platform', 'Unknown'),
                            'link': content_extraction.get('interview_link'),
                            'location': content_extraction.get('interview_location'),
                            'parsed_date_obj': parsed_event_date  # Store parsed date for sorting
                        })
                        logger.info(f"Successfully parsed thread interview event: {stable_event_key} for {company}")
                    else:
                        logger.warning(f"Could not parse thread interview date: '{event_date_str}' for thread {thread['thread_id']}")
                else:
                    logger.warning(f"Interview thread found but no date extracted for thread {thread['thread_id']}")
        
        # Sort by parsed date
        events.sort(key=lambda x: x.get('parsed_date_obj', datetime.max))
        
        logger.info(f"Generated {len(events)} unique upcoming events from {len(threads)} threads (processed {len(processed_event_keys)} unique event keys)")
        
        return events
    
    def _generate_quick_updates_from_threads(self, threads: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Generate quick updates from email threads"""
        
        updates = []
        
        for thread in threads:
            if thread['email_count'] > 1:  # Multi-email threads
                latest_email = thread['latest_email']
                
                update = {
                    'type': 'thread_update',
                    'thread_id': thread['thread_id'],
                    'title': f"New activity: {latest_email.get('company', 'Unknown')}",
                    'description': latest_email.get('summary', 'Thread updated'),
                    'email_count': thread['email_count'],
                    'timestamp': thread['latest_email_date']
                }
                updates.append(update)
        
        return updates[:5]  # Limit to 5 most recent
    
    def _generate_thread_summary_stats(self, threads: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Generate summary statistics for threads"""
        
        if not threads:
            return self._get_empty_dashboard()['summary_stats']
        
        total_threads = len(threads)
        total_emails = sum(thread['email_count'] for thread in threads)
        total_unread = sum(thread['unread_count'] for thread in threads)
        
        # Count by email type (from latest emails)
        by_type = {}
        by_urgency = {}
        by_company = {}
        
        for thread in threads:
            latest_email = thread['latest_email']
            email_type = latest_email.get('email_type', 'other')
            urgency = latest_email.get('urgency', 'normal')
            company = latest_email.get('company', 'Unknown')
            
            by_type[email_type] = by_type.get(email_type, 0) + 1
            by_urgency[urgency] = by_urgency.get(urgency, 0) + 1
            by_company[company] = by_company.get(company, 0) + 1
        
        return {
            'total_threads': total_threads,
            'total_emails': total_emails,
            'total_unread': total_unread,
            'by_type': by_type,
            'by_urgency': by_urgency,
            'by_company': by_company,
            'avg_emails_per_thread': round(total_emails / total_threads, 1) if total_threads > 0 else 0,
            'high_priority_count': by_urgency.get('high', 0)
        }
    
    def _calculate_thread_duration(self, first_date, latest_date) -> int:
        """Calculate the duration of a thread in days"""
        
        try:
            if isinstance(first_date, str):
                first_date = datetime.fromisoformat(first_date.replace('Z', '+00:00'))
            if isinstance(latest_date, str):
                latest_date = datetime.fromisoformat(latest_date.replace('Z', '+00:00'))
            
            duration = (latest_date - first_date).days
            return max(0, duration)  # Ensure non-negative
            
        except Exception:
            return 0
    
    def _get_empty_threaded_dashboard(self) -> Dict[str, Any]:
        """Return empty threaded dashboard structure"""
        
        return {
            'email_threads': [],
            'attention_items': [],
            'upcoming_events': [],
            'quick_updates': [],
            'summary_stats': {
                'total_threads': 0,
                'total_emails': 0,
                'total_unread': 0,
                'by_type': {},
                'by_urgency': {},
                'by_company': {},
                'avg_emails_per_thread': 0,
                'high_priority_count': 0
            }
        }
    
    def _get_actionable_summary(self, email: Dict[str, Any]) -> str:
        """Get actionable summary from email data"""
        
        # Try various summary fields in order of preference
        extracted_data = email.get('extracted_data', {}) or {}
        content_extraction = extracted_data.get('content_extraction', {})
        
        return (
            content_extraction.get('actionable_summary') or
            email.get('actionable_summary') or
            email.get('summary') or
            email.get('snippet') or
            'No summary available'
        )
    
    def _parse_flexible_datetime(self, date_str: str, time_str: str) -> Optional[datetime]:
        """Helper to parse various date/time formats for events."""
        if not date_str:
            logger.debug("_parse_flexible_datetime: No date_str provided")
            return None
        
        logger.debug(f"_parse_flexible_datetime: Input - date_str='{date_str}', time_str='{time_str}'")
        
        full_datetime_str = f"{date_str} {time_str}".strip()
        logger.debug(f"_parse_flexible_datetime: Combined string: '{full_datetime_str}'")
        
        # Remove day of week (e.g., "Thursday, ") if present
        original_str = full_datetime_str
        full_datetime_str = re.sub(r'^\w+,\s*', '', full_datetime_str)
        if original_str != full_datetime_str:
            logger.debug(f"_parse_flexible_datetime: Removed day of week: '{original_str}' -> '{full_datetime_str}'")

        # Remove ordinal suffixes (st, nd, rd, th)
        original_str = full_datetime_str
        full_datetime_str = re.sub(r'(\d+)(st|nd|rd|th)', r'\1', full_datetime_str)
        if original_str != full_datetime_str:
            logger.debug(f"_parse_flexible_datetime: Removed ordinals: '{original_str}' -> '{full_datetime_str}'")
        
        # Remove common timezone abbreviations as strptime struggles with them
        original_str = full_datetime_str
        full_datetime_str = re.sub(r'\s+(?:EST|EDT|CST|CDT|MST|MDT|PST|PDT|UTC|GMT)$', '', full_datetime_str)
        if original_str != full_datetime_str:
            logger.debug(f"_parse_flexible_datetime: Removed timezone: '{original_str}' -> '{full_datetime_str}'")
        
        logger.debug(f"_parse_flexible_datetime: Final cleaned string: '{full_datetime_str}'")
        
        # Define expected formats to try
        formats = [
            # Datetime formats (most specific first)
            "%B %d, %Y at %I:%M %p",     # "June 19, 2025 at 1:30 PM"
            "%B %d, %Y %I:%M %p",        # "June 19, 2025 1:30 PM"
            "%Y-%m-%d %H:%M:%S%z",       # ISO format with timezone offset
            "%Y-%m-%dT%H:%M:%S%z",       # ISO format with T and timezone offset
            "%Y-%m-%d %H:%M:%S",         # ISO format without timezone
            "%Y-%m-%dT%H:%M:%S",         # ISO format without timezone
            
            # Date-only formats
            "%B %d, %Y",                 # "June 19, 2025"
            "%Y-%m-%d",                  # "2025-06-19"
        ]
        
        for i, fmt in enumerate(formats):
            try:
                dt_obj = datetime.strptime(full_datetime_str, fmt)
                logger.info(f"_parse_flexible_datetime: SUCCESS - Parsed '{full_datetime_str}' using format #{i+1}: '{fmt}' -> {dt_obj}")
                return dt_obj
            except ValueError as e:
                logger.debug(f"_parse_flexible_datetime: Format #{i+1} '{fmt}' failed: {e}")
                continue
        
        logger.warning(f"_parse_flexible_datetime: FAILED - Could not parse date string: '{full_datetime_str}' (original: '{date_str} {time_str}')")
        return None