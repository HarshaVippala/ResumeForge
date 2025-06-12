#!/usr/bin/env python3
"""
Unified Email Processing Service
Handles all email operations with consistent database usage
"""

import logging
import json
from datetime import datetime, date
from typing import Dict, List, Optional, Any
import os

logger = logging.getLogger(__name__)

class UnifiedEmailService:
    """
    Unified service for all email operations
    """
    
    def __init__(self, database_manager, lm_studio_client=None):
        self.db_manager = database_manager
        self.lm_studio = lm_studio_client
        
        # Import enhanced services
        from .enhanced_email_processor_v4 import EnhancedEmailProcessorV4
        from .company_contact_manager import CompanyContactManager
        
        self.email_processor = EnhancedEmailProcessorV4(lm_studio_client)
        self.company_manager = CompanyContactManager(database_manager)
    
    def process_new_emails_background(self, days_back: int = 1, max_results: int = 20) -> Dict[str, Any]:
        """
        Background email processing - check for new emails and process quickly
        """
        try:
            logger.info(f"Background email processing: {days_back} days, {max_results} emails")
            
            # Get Gmail service
            from services.gmail_service import GmailService
            gmail = GmailService()
            
            # Fetch recent emails
            recent_emails = gmail.get_recent_emails(days_back=days_back, max_results=max_results)
            
            # Get already processed email IDs
            processed_email_ids = self._get_processed_email_ids(days_back)
            
            # Filter to only new emails
            new_emails = [email for email in recent_emails if email['id'] not in processed_email_ids]
            
            logger.info(f"Found {len(new_emails)} new emails to process")
            
            # Process new emails
            processed_emails = []
            for email in new_emails:
                processed_email = self._process_single_email(email, quick_mode=True)
                if processed_email:
                    processed_emails.append(processed_email)
            
            return {
                'success': True,
                'new_emails_count': len(new_emails),
                'processed_count': len(processed_emails),
                'emails': processed_emails
            }
            
        except Exception as e:
            logger.error(f"Background email processing error: {e}")
            return {
                'success': False,
                'error': str(e),
                'new_emails_count': 0,
                'processed_count': 0
            }
    
    def process_emails_comprehensive(self, days_back: int = 7, max_results: int = 50, force_reprocess: bool = False) -> Dict[str, Any]:
        """
        Comprehensive email processing - full LLM analysis and job integration
        """
        try:
            logger.info(f"Comprehensive email processing: {days_back} days, {max_results} emails")
            
            # Get Gmail service
            from services.gmail_service import GmailService
            gmail = GmailService()
            
            # Fetch emails
            recent_emails = gmail.get_recent_emails(days_back=days_back, max_results=max_results)
            
            # Get already processed email IDs if not forcing reprocess
            processed_email_ids = set()
            if not force_reprocess:
                processed_email_ids = self._get_processed_email_ids(days_back)
            
            # Filter emails to process
            emails_to_process = recent_emails
            if not force_reprocess:
                emails_to_process = [email for email in recent_emails if email['id'] not in processed_email_ids]
            
            logger.info(f"Processing {len(emails_to_process)} emails comprehensively")
            
            # Process emails with full analysis
            processed_emails = []
            companies_created = 0
            contacts_created = 0
            jobs_created = 0
            
            for email in emails_to_process:
                result = self._process_single_email(email, quick_mode=False)
                if result:
                    processed_emails.append(result)
                    
                    # Count new entities created
                    if result.get('company_match', {}).get('is_new'):
                        companies_created += 1
                    if result.get('contact_match', {}).get('is_new'):
                        contacts_created += 1
                    if result.get('job_opportunity_id'):
                        jobs_created += 1
            
            return {
                'success': True,
                'total_emails': len(recent_emails),
                'processed_count': len(processed_emails),
                'companies_created': companies_created,
                'contacts_created': contacts_created,
                'jobs_created': jobs_created,
                'emails': processed_emails
            }
            
        except Exception as e:
            logger.error(f"Comprehensive email processing error: {e}")
            return {
                'success': False,
                'error': str(e),
                'processed_count': 0
            }
    
    def get_email_activities(self, days_back: int = 14, limit: int = 50) -> Dict[str, Any]:
        """
        Get email activities from database for dashboard
        """
        try:
            logger.info(f"Getting email activities: {days_back} days, limit {limit}")
            
            # Get emails from database
            emails = self._get_emails_from_database(days_back, limit)
            
            # Format for dashboard
            dashboard_data = self._format_emails_for_dashboard(emails)
            
            return {
                'success': True,
                'emails_count': len(emails),
                'data': dashboard_data
            }
            
        except Exception as e:
            logger.error(f"Get email activities error: {e}")
            return {
                'success': False,
                'error': str(e),
                'data': {
                    'email_activities': [],
                    'attention_items': [],
                    'quick_updates': [],
                    'upcoming_events': []
                }
            }
    
    def _process_single_email(self, email_data: Dict[str, Any], quick_mode: bool = False) -> Optional[Dict[str, Any]]:
        """
        Process a single email with enhanced extraction and job integration
        """
        try:
            # Enhanced email processing
            enhanced_data = self.email_processor.process_email_comprehensive(email_data)
            
            # Skip if not job-related
            if not enhanced_data.is_job_related:
                logger.debug(f"Skipping non-job-related email: {email_data['subject'][:50]}")
                return None
            
            # Company/Contact integration (if not quick mode)
            company_match = None
            contact_match = None
            job_opportunity_id = None
            
            if not quick_mode:
                # Find or create company
                company_match = self.company_manager.find_or_create_company(enhanced_data)
                
                # Find or create contact
                contact_match = self.company_manager.find_or_create_contact(enhanced_data, company_match.company_id)
                
                # Create job opportunity if this is a new job-related email
                if enhanced_data.job_title and company_match.company_id:
                    job_opportunity_id = self._create_job_opportunity(enhanced_data, company_match.company_id)
            
            # Store email in database
            stored_email = self._store_email_in_database(
                email_data, 
                enhanced_data, 
                company_match.company_id if company_match else None,
                contact_match.contact_id if contact_match else None,
                job_opportunity_id
            )
            
            # Prepare result
            result = {
                'email_id': email_data['id'],
                'subject': email_data['subject'],
                'enhanced_data': enhanced_data.__dict__,
                'stored_email_id': stored_email,
                'company_match': company_match.__dict__ if company_match else None,
                'contact_match': contact_match.__dict__ if contact_match else None,
                'job_opportunity_id': job_opportunity_id
            }
            
            logger.info(f"Processed email: {email_data['subject'][:50]} -> {enhanced_data.email_type}")
            return result
            
        except Exception as e:
            logger.error(f"Error processing email {email_data.get('id', 'unknown')}: {e}")
            return None
    
    def _get_processed_email_ids(self, days_back: int) -> set:
        """Get already processed email IDs from database"""
        try:
            with self.db_manager.get_connection() as conn:
                cursor = conn.cursor()
                
                # Check database type by checking if it's a Supabase manager
                if hasattr(self.db_manager, 'database_url') and self.db_manager.database_url:  # Supabase/PostgreSQL
                    cursor.execute("""
                        SELECT email_id FROM email_communications 
                        WHERE email_date >= NOW() - INTERVAL '%s days'
                    """, (days_back,))
                else:  # SQLite
                    cursor.execute("""
                        SELECT email_id FROM email_communications 
                        WHERE email_date >= datetime('now', '-{} days')
                    """.format(days_back))
                
                return {row[0] for row in cursor.fetchall()}
                
        except Exception as e:
            logger.error(f"Error getting processed email IDs: {e}")
            return set()
    
    def _get_emails_from_database(self, days_back: int, limit: int) -> List[Dict[str, Any]]:
        """Get emails from database"""
        try:
            with self.db_manager.get_connection() as conn:
                cursor = conn.cursor()
                
                # Check database type by checking if it's a Supabase manager
                if hasattr(self.db_manager, 'database_url') and self.db_manager.database_url:  # Supabase/PostgreSQL
                    cursor.execute("""
                        SELECT e.*, c.name as company_name, co.name as contact_name, co.email as contact_email
                        FROM email_communications e
                        LEFT JOIN companies c ON e.company_id = c.id
                        LEFT JOIN contacts co ON e.contact_id = co.id
                        WHERE e.email_date >= NOW() - INTERVAL '%s days'
                        ORDER BY e.email_date DESC
                        LIMIT %s
                    """, (days_back, limit))
                else:  # SQLite
                    cursor.execute("""
                        SELECT e.*, c.name as company_name, co.name as contact_name, co.email as contact_email
                        FROM email_communications e
                        LEFT JOIN companies c ON e.company_id = c.id
                        LEFT JOIN contacts co ON e.contact_id = co.id
                        WHERE e.email_date >= datetime('now', '-{} days')
                        ORDER BY e.email_date DESC
                        LIMIT ?
                    """.format(days_back), (limit,))
                
                # Convert to dict format
                columns = [description[0] for description in cursor.description]
                emails = []
                
                for row in cursor.fetchall():
                    email_dict = dict(zip(columns, row))
                    
                    # Parse extracted_data JSON if exists
                    if email_dict.get('extracted_data'):
                        try:
                            if isinstance(email_dict['extracted_data'], str):
                                extracted = json.loads(email_dict['extracted_data'])
                            else:
                                extracted = email_dict['extracted_data']
                            email_dict['parsed_extracted_data'] = extracted
                        except:
                            email_dict['parsed_extracted_data'] = {}
                    
                    emails.append(email_dict)
                
                return emails
                
        except Exception as e:
            logger.error(f"Error getting emails from database: {e}")
            return []
    
    def _store_email_in_database(self, email_data: Dict, enhanced_data, company_id: Optional[int], contact_id: Optional[int], job_opportunity_id: Optional[int]) -> Optional[int]:
        """Store email in database with all extracted information"""
        try:
            with self.db_manager.get_connection() as conn:
                cursor = conn.cursor()
                
                # Prepare extracted data for storage
                extracted_data_json = json.dumps({
                    'company_name': enhanced_data.company_name,
                    'job_title': enhanced_data.job_title,
                    'recruiter_name': enhanced_data.recruiter_name,
                    'recruiter_email': enhanced_data.recruiter_email,
                    'recruiter_phone': enhanced_data.recruiter_phone,
                    'interview_date': enhanced_data.interview_date,
                    'interview_time': enhanced_data.interview_time,
                    'interview_platform': enhanced_data.interview_platform,
                    'salary_range': enhanced_data.salary_range,
                    'application_status': enhanced_data.application_status,
                    'summary': enhanced_data.summary
                })
                
                # Check database type by checking if it's a Supabase manager
                if hasattr(self.db_manager, 'database_url') and self.db_manager.database_url:  # Supabase/PostgreSQL
                    cursor.execute("""
                        INSERT INTO email_communications (
                            email_id, company_id, contact_id, job_opportunity_id,
                            subject, sender, recipient, email_date, is_unread,
                            email_type, direction, priority, sentiment,
                            content, snippet, extracted_data,
                            confidence_score, action_required, deadline,
                            application_status, follow_up_needed, follow_up_date,
                            processing_status, processed_at
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        RETURNING id
                    """, (
                        email_data['id'], company_id, contact_id, job_opportunity_id,
                        email_data['subject'], email_data['sender'], '', email_data['date'], 
                        not email_data.get('is_read', True),
                        enhanced_data.email_type, 'inbound', enhanced_data.priority, enhanced_data.sentiment,
                        email_data.get('snippet', ''), email_data.get('snippet', '')[:200], extracted_data_json,
                        enhanced_data.confidence_score, enhanced_data.action_required, 
                        enhanced_data.deadline if enhanced_data.deadline else None,
                        enhanced_data.application_status, enhanced_data.follow_up_needed,
                        enhanced_data.follow_up_date if enhanced_data.follow_up_date else None,
                        'processed', datetime.utcnow()
                    ))
                    result = cursor.fetchone()
                    email_id = result[0] if result else None
                else:  # SQLite
                    cursor.execute("""
                        INSERT OR REPLACE INTO email_communications (
                            email_id, company_id, contact_id, job_opportunity_id,
                            subject, sender, recipient, email_date, is_unread,
                            email_type, direction, urgency, sentiment,
                            content, snippet, extracted_data,
                            confidence_score, action_required,
                            processing_status, processed_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        email_data['id'], company_id, contact_id, job_opportunity_id,
                        email_data['subject'], email_data['sender'], '', email_data['date'],
                        not email_data.get('is_read', True),
                        enhanced_data.email_type, 'inbound', enhanced_data.priority, enhanced_data.sentiment,
                        email_data.get('snippet', ''), email_data.get('snippet', '')[:200], extracted_data_json,
                        enhanced_data.confidence_score, enhanced_data.action_required,
                        'processed', datetime.utcnow()
                    ))
                    email_id = cursor.lastrowid
                
                conn.commit()
                logger.info(f"Stored email in database: {email_data['subject'][:50]} (ID: {email_id})")
                return email_id
                
        except Exception as e:
            logger.error(f"Error storing email in database: {e}")
            return None
    
    def _create_job_opportunity(self, enhanced_data, company_id: int) -> Optional[int]:
        """Create job opportunity from email data"""
        try:
            if not enhanced_data.job_title or not company_id:
                return None
            
            with self.db_manager.get_connection() as conn:
                cursor = conn.cursor()
                
                # Check if similar job opportunity already exists
                if hasattr(self.db_manager, 'database_url') and self.db_manager.database_url:  # Supabase/PostgreSQL
                    cursor.execute("""
                        SELECT id FROM job_opportunities 
                        WHERE company_id = %s AND LOWER(title) = LOWER(%s)
                        AND created_at >= NOW() - INTERVAL '30 days'
                    """, (company_id, enhanced_data.job_title))
                else:  # SQLite
                    cursor.execute("""
                        SELECT id FROM job_opportunities 
                        WHERE company_id = ? AND LOWER(title) = LOWER(?)
                        AND created_at >= datetime('now', '-30 days')
                    """, (company_id, enhanced_data.job_title))
                
                existing = cursor.fetchone()
                if existing:
                    return existing[0]  # Return existing job opportunity
                
                # Create new job opportunity
                if hasattr(self.db_manager, 'database_url') and self.db_manager.database_url:  # Supabase/PostgreSQL
                    cursor.execute("""
                        INSERT INTO job_opportunities (
                            company_id, title, department, level, employment_type, location_type,
                            salary_range, application_date, status, source
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        RETURNING id
                    """, (
                        company_id, enhanced_data.job_title, enhanced_data.department,
                        enhanced_data.level, enhanced_data.employment_type, enhanced_data.location_type,
                        enhanced_data.salary_range, date.today(), 'applied', 'email'
                    ))
                    result = cursor.fetchone()
                    job_id = result[0] if result else None
                else:  # SQLite
                    cursor.execute("""
                        INSERT INTO job_opportunities (
                            company_id, title, department, level, employment_type, location_type,
                            salary_range, application_date, status, source
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        company_id, enhanced_data.job_title, enhanced_data.department,
                        enhanced_data.level, enhanced_data.employment_type, enhanced_data.location_type,
                        enhanced_data.salary_range, date.today(), 'applied', 'email'
                    ))
                    job_id = cursor.lastrowid
                
                conn.commit()
                logger.info(f"Created job opportunity: {enhanced_data.job_title} (ID: {job_id})")
                return job_id
                
        except Exception as e:
            logger.error(f"Error creating job opportunity: {e}")
            return None
    
    def _format_emails_for_dashboard(self, emails: List[Dict]) -> Dict[str, Any]:
        """Format emails for dashboard display"""
        dashboard_data = {
            'email_activities': [],
            'attention_items': [],
            'quick_updates': [],
            'upcoming_events': []
        }
        
        # Counters for summary
        interview_count = 0
        rejection_count = 0
        follow_up_count = 0
        
        for email in emails:
            try:
                # Create email activity entry
                activity = {
                    'id': email.get('email_id', email.get('id')),
                    'company': email.get('company_name', email.get('parsed_extracted_data', {}).get('company_name', '')),
                    'subject': email.get('subject', ''),
                    'sender': email.get('sender', ''),
                    'timestamp': email.get('email_date', ''),
                    'content': email.get('snippet', email.get('content', ''))[:200],
                    'summary': email.get('parsed_extracted_data', {}).get('summary', ''),
                    'status': 'read' if not email.get('is_unread', True) else 'unread',
                    'type': email.get('email_type', 'other'),
                    'extracted_details': email.get('parsed_extracted_data', {}),
                    'job_tracking': {
                        'company_id': email.get('company_id'),
                        'contact_id': email.get('contact_id'),
                        'job_opportunity_id': email.get('job_opportunity_id'),
                        'confidence_score': email.get('confidence_score', 0.0),
                        'is_new_opportunity': bool(email.get('job_opportunity_id'))
                    }
                }
                
                dashboard_data['email_activities'].append(activity)
                
                # Count email types
                email_type = email.get('email_type', 'other')
                if email_type == 'interview':
                    interview_count += 1
                elif email_type == 'rejection':
                    rejection_count += 1
                elif email_type == 'follow_up':
                    follow_up_count += 1
                
                # Create attention items for important emails
                if email_type in ['interview', 'offer'] or email.get('priority') == 'high':
                    dashboard_data['attention_items'].append({
                        'id': f"{email_type}_{email.get('email_id', email.get('id'))}",
                        'title': f"{email_type.replace('_', ' ').title()}",
                        'description': f"{email_type.replace('_', ' ').title()} from {email.get('company_name', 'Unknown')}",
                        'priority': email.get('priority', 'medium'),
                        'timestamp': email.get('email_date', ''),
                        'relatedEmails': [email.get('email_id', email.get('id'))]
                    })
                
                # Create upcoming events for interviews
                if email_type == 'interview':
                    interview_details = email.get('parsed_extracted_data', {})
                    dashboard_data['upcoming_events'].append({
                        'id': f"event_{email.get('email_id', email.get('id'))}",
                        'company': email.get('company_name', 'Unknown'),
                        'type': 'interview',
                        'title': f"Interview with {email.get('company_name', 'Unknown')}",
                        'date': interview_details.get('interview_date', 'TBD'),
                        'time': interview_details.get('interview_time', 'TBD'),
                        'platform': interview_details.get('interview_platform', 'unknown'),
                        'details': email.get('subject', ''),
                        'link': interview_details.get('interview_link', ''),
                        'duration': '60 minutes',
                        'contact': {
                            'name': interview_details.get('recruiter_name', ''),
                            'email': interview_details.get('recruiter_email', ''),
                            'phone': interview_details.get('recruiter_phone', '')
                        }
                    })
                
            except Exception as e:
                logger.error(f"Error formatting email for dashboard: {e}")
                continue
        
        # Add quick updates
        dashboard_data['quick_updates'] = [
            {
                'id': 'interview_summary',
                'title': 'Interview Activity',
                'summary': f'{interview_count} interview-related emails',
                'timestamp': datetime.utcnow().isoformat()
            },
            {
                'id': 'rejection_summary', 
                'title': 'Application Status',
                'summary': f'{rejection_count} application status updates',
                'timestamp': datetime.utcnow().isoformat()
            },
            {
                'id': 'followup_summary',
                'title': 'Follow-ups Needed', 
                'summary': f'{follow_up_count} applications may need follow-up',
                'timestamp': datetime.utcnow().isoformat()
            },
            {
                'id': 'email_pattern',
                'title': 'Email Activity Overview',
                'summary': f'Processed {len(emails)} job-related emails',
                'timestamp': datetime.utcnow().isoformat()
            }
        ]
        
        return dashboard_data