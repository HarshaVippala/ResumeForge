"""
Optimized Storage Service for Simplified Email Schema
Focused on job tracking use case with clean, simple operations
"""

import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from ..models.processing_result import ProcessingResult

logger = logging.getLogger(__name__)

class StorageService:
    """Simplified storage service for the optimized email schema"""
    
    def __init__(self, database_manager):
        self.db_manager = database_manager
    
    def store_processed_email(self, result: ProcessingResult) -> Optional[int]:
        """Store processed email result in simplified schema"""
        
        try:
            with self.db_manager.get_connection() as conn:
                cursor = conn.cursor()
                
                email_data = result.email_data
                
                # Extract core fields for fast queries
                company = self._extract_company(result)
                position = self._extract_position(result)
                summary = self._extract_summary(result)
                requires_action = self._determine_requires_action(result)
                deadline = self._extract_deadline(result)
                application_status = self._determine_application_status(result)
                
                # Store complete AI results in JSONB
                extracted_data = {
                    'classification': self._serialize_classification(result.classification),
                    'content_extraction': self._serialize_content_extraction(result.content_extraction),
                    'structured_data': self._serialize_structured_data(result.structured_data),
                    'processing_metrics': {
                        'total_time_ms': result.metrics.total_processing_time_ms,
                        'tokens_used': result.token_usage.total_tokens,
                        'models_used': result.metrics.models_used,
                        'confidence': result.confidence if hasattr(result, 'confidence') else 0.0
                    }
                }
                
                # Insert or update email
                cursor.execute("""
                    INSERT INTO email_communications (
                        email_id, thread_id, subject, sender, recipient, email_date,
                        content, snippet, is_unread, company, position, email_type,
                        urgency, summary, application_status, deadline, requires_action,
                        extracted_data, confidence_score, processing_status, processed_at
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                    )
                    ON CONFLICT (email_id) DO UPDATE SET
                        subject = EXCLUDED.subject,
                        company = EXCLUDED.company,
                        position = EXCLUDED.position,
                        email_type = EXCLUDED.email_type,
                        urgency = EXCLUDED.urgency,
                        summary = EXCLUDED.summary,
                        application_status = EXCLUDED.application_status,
                        deadline = EXCLUDED.deadline,
                        requires_action = EXCLUDED.requires_action,
                        extracted_data = EXCLUDED.extracted_data,
                        confidence_score = EXCLUDED.confidence_score,
                        processing_status = EXCLUDED.processing_status,
                        processed_at = EXCLUDED.processed_at,
                        updated_at = CURRENT_TIMESTAMP
                    RETURNING id
                """, (
                    email_data.id, email_data.thread_id, email_data.subject,
                    email_data.sender, email_data.recipient, email_data.date,
                    email_data.body, email_data.snippet, not email_data.is_read,
                    company, position, 
                    result.email_type.value if hasattr(result.email_type, 'value') else str(result.email_type) if result.email_type else 'other',
                    result.urgency.value if hasattr(result.urgency, 'value') else str(result.urgency) if result.urgency else 'normal',
                    summary, application_status, deadline, requires_action,
                    json.dumps(extracted_data), result.confidence if hasattr(result, 'confidence') else 0.0,
                    'processed', datetime.utcnow()
                ))
                
                stored_id = cursor.fetchone()[0]
                
                # Store extracted jobs if this is a job board email
                if result.extracted_jobs and len(result.extracted_jobs) > 0:
                    jobs_stored = self._store_extracted_jobs(result.extracted_jobs, email_data.id, cursor)
                    logger.info(f"Stored {jobs_stored} jobs from email: {email_data.subject[:50]}")
                
                conn.commit()
                
                email_type_str = result.email_type.value if hasattr(result.email_type, 'value') else str(result.email_type)
                logger.info(f"Stored email: {email_data.subject[:50]} -> {company} ({email_type_str})")
                return stored_id
                
        except Exception as e:
            logger.error(f"Error storing email {result.email_data.id}: {e}")
            return None
    
    def get_dashboard_emails(self, days_back: int = 14, limit: int = 50) -> List[Dict[str, Any]]:
        """Get recent job emails for dashboard display"""
        
        try:
            with self.db_manager.get_connection() as conn:
                cursor = conn.cursor()
                
                cursor.execute("""
                    SELECT 
                        id, email_id, subject, sender, company, position, email_type,
                        urgency, summary, application_status, deadline, requires_action,
                        email_date, is_unread, confidence_score
                    FROM email_communications
                    WHERE email_date >= NOW() - INTERVAL '%s days'
                        AND email_type != 'other'
                        AND processing_status = 'processed'
                    ORDER BY email_date DESC
                    LIMIT %s
                """, (days_back, limit))
                
                columns = [desc[0] for desc in cursor.description]
                emails = [dict(zip(columns, row)) for row in cursor.fetchall()]
                
                logger.info(f"Retrieved {len(emails)} dashboard emails")
                return emails
                
        except Exception as e:
            logger.error(f"Error retrieving dashboard emails: {e}")
            return []
    
    def get_action_items(self, limit: int = 20) -> List[Dict[str, Any]]:
        """Get emails that require user action"""
        
        try:
            with self.db_manager.get_connection() as conn:
                cursor = conn.cursor()
                
                cursor.execute("""
                    SELECT 
                        id, email_id, subject, sender, company, position, email_type,
                        urgency, summary, deadline, email_date
                    FROM email_communications
                    WHERE requires_action = true
                        AND processing_status = 'processed'
                    ORDER BY 
                        deadline ASC NULLS LAST,
                        CASE urgency WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
                        email_date DESC
                    LIMIT %s
                """, (limit,))
                
                columns = [desc[0] for desc in cursor.description]
                action_items = [dict(zip(columns, row)) for row in cursor.fetchall()]
                
                logger.info(f"Retrieved {len(action_items)} action items")
                return action_items
                
        except Exception as e:
            logger.error(f"Error retrieving action items: {e}")
            return []
    
    def get_company_emails(self, company: str, limit: int = 50) -> List[Dict[str, Any]]:
        """Get all emails for a specific company"""
        
        try:
            with self.db_manager.get_connection() as conn:
                cursor = conn.cursor()
                
                cursor.execute("""
                    SELECT 
                        id, email_id, subject, sender, position, email_type,
                        urgency, summary, application_status, deadline, email_date
                    FROM email_communications
                    WHERE company ILIKE %s
                        AND processing_status = 'processed'
                    ORDER BY email_date DESC
                    LIMIT %s
                """, (f'%{company}%', limit))
                
                columns = [desc[0] for desc in cursor.description]
                emails = [dict(zip(columns, row)) for row in cursor.fetchall()]
                
                logger.info(f"Retrieved {len(emails)} emails for company: {company}")
                return emails
                
        except Exception as e:
            logger.error(f"Error retrieving emails for company {company}: {e}")
            return []
    
    def get_application_summary(self) -> Dict[str, Any]:
        """Get summary of application status across companies"""
        
        try:
            with self.db_manager.get_connection() as conn:
                cursor = conn.cursor()
                
                cursor.execute("""
                    SELECT 
                        company,
                        position,
                        application_status,
                        COUNT(*) as email_count,
                        MAX(email_date) as latest_email,
                        SUM(CASE WHEN requires_action THEN 1 ELSE 0 END) as action_items
                    FROM email_communications
                    WHERE company IS NOT NULL 
                        AND email_type != 'other'
                        AND processing_status = 'processed'
                    GROUP BY company, position, application_status
                    ORDER BY latest_email DESC
                """)
                
                columns = [desc[0] for desc in cursor.description]
                applications = [dict(zip(columns, row)) for row in cursor.fetchall()]
                
                return {
                    'applications': applications,
                    'total_companies': len(set(app['company'] for app in applications)),
                    'total_positions': len(applications),
                    'total_action_items': sum(app['action_items'] for app in applications)
                }
                
        except Exception as e:
            logger.error(f"Error getting application summary: {e}")
            return {'applications': [], 'total_companies': 0, 'total_positions': 0, 'total_action_items': 0}
    
    def _extract_company(self, result: ProcessingResult) -> str:
        """Extract company name from processing result"""
        if result.content_extraction and result.content_extraction.company:
            return result.content_extraction.company
        elif result.classification and result.classification.company_detected:
            return result.classification.company_detected
        return ""
    
    def _extract_position(self, result: ProcessingResult) -> str:
        """Extract position from processing result"""
        if result.content_extraction and result.content_extraction.position:
            return result.content_extraction.position
        elif result.classification and result.classification.position_detected:
            return result.classification.position_detected
        return ""
    
    def _extract_summary(self, result: ProcessingResult) -> str:
        """Extract actionable summary"""
        if result.content_extraction and result.content_extraction.actionable_summary:
            return result.content_extraction.actionable_summary
        return ""
    
    def _determine_requires_action(self, result: ProcessingResult) -> bool:
        """Determine if email requires user action"""
        if not result.email_type:
            return False
        
        # High urgency emails usually require action
        urgency_val = result.urgency.value if hasattr(result.urgency, 'value') else str(result.urgency) if result.urgency else 'normal'
        if urgency_val == 'high':
            return True
        
        # Specific email types that typically need action
        action_types = ['interview', 'assessment', 'offer']
        email_type_val = result.email_type.value if hasattr(result.email_type, 'value') else str(result.email_type) if result.email_type else 'other'
        if email_type_val in action_types:
            return True
        
        return False
    
    def _extract_deadline(self, result: ProcessingResult) -> Optional[str]:
        """Extract deadline from structured data"""
        if result.structured_data and result.structured_data.assessment_deadline:
            deadline = result.structured_data.assessment_deadline
            # Clean up date format for PostgreSQL
            if deadline:
                try:
                    # Remove timezone abbreviations like "ET", "PT" that PostgreSQL can't parse
                    import re
                    cleaned = re.sub(r'\s+(ET|PT|EST|PST|CST|MST)$', '', deadline.strip())
                    # If it's just a date without time, that's fine
                    # If it has invalid format, return None to avoid DB errors
                    if len(cleaned) > 50:  # Sanity check for overly long strings
                        return None
                    return cleaned if cleaned else None
                except Exception:
                    return None
        return None
    
    def _determine_application_status(self, result: ProcessingResult) -> str:
        """Determine application status based on email type"""
        if not result.email_type:
            return 'unknown'
        
        status_mapping = {
            'rejection': 'rejected',
            'offer': 'offer',
            'interview': 'interviewing',
            'assessment': 'screening',
            'follow_up': 'applied',
            'recruiter_outreach': 'applied'
        }
        
        email_type_val = result.email_type.value if hasattr(result.email_type, 'value') else str(result.email_type) if result.email_type else 'other'
        return status_mapping.get(email_type_val, 'unknown')
    
    def _serialize_classification(self, classification) -> Dict:
        """Serialize classification result"""
        if not classification:
            return {}
        
        return {
            'is_job_related': classification.is_job_related,
            'email_type': classification.email_type.value if hasattr(classification.email_type, 'value') else str(classification.email_type) if classification.email_type else None,
            'company_detected': classification.company_detected,
            'position_detected': classification.position_detected,
            'confidence': classification.confidence,
            'urgency': classification.urgency.value if hasattr(classification.urgency, 'value') else str(classification.urgency) if classification.urgency else None
        }
    
    def _serialize_content_extraction(self, content_extraction) -> Dict:
        """Serialize content extraction result"""
        if not content_extraction:
            return {}
        
        return {
            'company': content_extraction.company,
            'position': content_extraction.position,
            'actionable_summary': content_extraction.actionable_summary,
            'key_insights': content_extraction.key_insights,
            'next_steps': content_extraction.next_steps,
            'confidence': content_extraction.confidence,
            'sentiment': content_extraction.sentiment
        }
    
    def _serialize_structured_data(self, structured_data) -> Dict:
        """Serialize structured data"""
        if not structured_data:
            return {}
        
        return {
            'interview_date': structured_data.interview_date,
            'interview_time': structured_data.interview_time,
            'interview_platform': structured_data.interview_platform,
            'assessment_deadline': structured_data.assessment_deadline,
            'deadline_summary': structured_data.deadline_summary,
            'extracted_links': structured_data.extracted_links
        }
    
    def get_gmail_history_id(self, user_email: str = "me") -> Optional[str]:
        """Get stored Gmail history ID for incremental sync"""
        try:
            with self.db_manager.get_connection() as conn:
                cursor = conn.cursor()
                
                cursor.execute("""
                    SELECT last_history_id 
                    FROM sync_metadata 
                    WHERE user_email = %s
                """, (user_email,))
                
                result = cursor.fetchone()
                return str(result[0]) if result and result[0] else None
                
        except Exception as e:
            logger.error(f"Error getting Gmail history ID: {e}")
            return None
    
    def store_gmail_history_id(self, history_id: str, user_email: str = "me") -> bool:
        """Store Gmail history ID for incremental sync"""
        try:
            with self.db_manager.get_connection() as conn:
                cursor = conn.cursor()
                
                cursor.execute("""
                    INSERT INTO sync_metadata (user_email, last_history_id, last_sync_timestamp)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (user_email) 
                    DO UPDATE SET 
                        last_history_id = EXCLUDED.last_history_id,
                        last_sync_timestamp = EXCLUDED.last_sync_timestamp,
                        updated_at = CURRENT_TIMESTAMP
                """, (user_email, history_id, datetime.now()))
                
                conn.commit()
                return True
                
        except Exception as e:
            logger.error(f"Error storing Gmail history ID: {e}")
            return False
    
    def get_processed_emails(self, days_back: int = 14, limit: int = 50) -> List[Dict]:
        """Get processed emails for dashboard display"""
        try:
            with self.db_manager.get_connection() as conn:
                cursor = conn.cursor()
                
                cutoff_date = datetime.now() - timedelta(days=days_back)
                
                cursor.execute("""
                    SELECT 
                        email_id, subject, company, position, email_type, 
                        summary, requires_action, deadline, urgency,
                        application_status, email_date, sender, is_unread,
                        extracted_data, confidence_score
                    FROM email_communications
                    WHERE email_date >= %s 
                        AND processing_status = 'processed'
                        AND email_type != 'other'
                        AND email_type != 'job_board'
                    ORDER BY email_date DESC
                    LIMIT %s
                """, (cutoff_date, limit))
                
                columns = [desc[0] for desc in cursor.description]
                emails = [dict(zip(columns, row)) for row in cursor.fetchall()]
                
                # Add is_job_related flag for dashboard service compatibility
                for email in emails:
                    # Mark all non-other and non-job_board emails as job-related for dashboard
                    email['is_job_related'] = email['email_type'] not in ['other', 'job_board']
                    # Add confidence as separate field for easy access
                    email['confidence'] = email.get('confidence_score', 0.0)
                
                return emails
                
        except Exception as e:
            logger.error(f"Error getting processed emails: {e}")
            return []
    
    def update_email_read_status(self, email_id: str, is_unread: bool) -> bool:
        """Update email read status"""
        try:
            with self.db_manager.get_connection() as conn:
                cursor = conn.cursor()
                
                cursor.execute("""
                    UPDATE email_communications 
                    SET is_unread = %s 
                    WHERE email_id = %s
                """, (is_unread, email_id))
                
                conn.commit()
                return True
                
        except Exception as e:
            logger.error(f"Error updating email read status: {e}")
            return False
    
    def delete_email(self, email_id: str) -> bool:
        """Delete email from storage"""
        try:
            with self.db_manager.get_connection() as conn:
                cursor = conn.cursor()
                
                cursor.execute("""
                    DELETE FROM email_communications 
                    WHERE email_id = %s
                """, (email_id,))
                
                conn.commit()
                return True
                
        except Exception as e:
            logger.error(f"Error deleting email: {e}")
            return False
    
    def _store_extracted_jobs(self, extracted_jobs: List[Dict[str, Any]], email_id: str, cursor) -> int:
        """Store extracted jobs from job board emails"""
        stored_count = 0
        
        for job in extracted_jobs:
            try:
                # Create unique job_id from content to avoid duplicates
                job_content = f"{job.get('title', '')}-{job.get('company', '')}-{job.get('location', '')}"
                import hashlib
                job_id = f"email_{email_id}_{hashlib.md5(job_content.encode()).hexdigest()[:8]}"
                
                # Parse salary if available
                salary_min, salary_max = self._parse_salary_range(job.get('salary', ''))
                
                cursor.execute("""
                    INSERT INTO jobs (
                        job_id, title, company, location, remote, job_type,
                        salary_min, salary_max, salary_currency, application_url,
                        platform, date_posted, scraped_at, is_active
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                    )
                    ON CONFLICT (job_id) DO UPDATE SET
                        title = EXCLUDED.title,
                        company = EXCLUDED.company,
                        location = EXCLUDED.location,
                        remote = EXCLUDED.remote,
                        job_type = EXCLUDED.job_type,
                        salary_min = EXCLUDED.salary_min,
                        salary_max = EXCLUDED.salary_max,
                        application_url = EXCLUDED.application_url,
                        updated_at = NOW()
                """, (
                    job_id,
                    job.get('title', ''),
                    job.get('company', ''),
                    job.get('location', ''),
                    job.get('location', '').lower() == 'remote',
                    job.get('employment_type', 'full-time').lower() or 'full-time',
                    salary_min,
                    salary_max,
                    'USD',
                    job.get('apply_link', ''),
                    job.get('job_board', 'lensa').lower(),
                    datetime.utcnow(),
                    datetime.utcnow(),
                    True
                ))
                
                stored_count += 1
                
            except Exception as e:
                logger.error(f"Error storing job {job.get('title', 'Unknown')}: {e}")
                continue
        
        return stored_count
    
    def _parse_salary_range(self, salary_str: str) -> tuple[Optional[int], Optional[int]]:
        """Parse salary range from string like '$60k - $80k / yr'"""
        if not salary_str:
            return None, None
        
        try:
            import re
            # Remove common prefixes/suffixes
            cleaned = re.sub(r'[$/yr\s,()]', '', salary_str.lower())
            
            # Look for range patterns like "60k-80k" or "60000-80000"
            range_match = re.search(r'(\d+)k?\s*[-–—]\s*(\d+)k?', cleaned)
            if range_match:
                min_val = int(range_match.group(1))
                max_val = int(range_match.group(2))
                
                # Convert k to thousands
                if 'k' in salary_str.lower():
                    min_val *= 1000
                    max_val *= 1000
                
                return min_val, max_val
            
            # Look for single value like "80k" or "80000"
            single_match = re.search(r'(\d+)k?', cleaned)
            if single_match:
                val = int(single_match.group(1))
                if 'k' in salary_str.lower():
                    val *= 1000
                return val, val
            
        except Exception as e:
            logger.error(f"Error parsing salary '{salary_str}': {e}")
        
        return None, None
    
    def get_extracted_jobs(self, days_back: int = 30, limit: int = 50) -> List[Dict[str, Any]]:
        """Get extracted jobs for the jobs feed"""
        try:
            with self.db_manager.get_connection() as conn:
                cursor = conn.cursor()
                
                cursor.execute("""
                    SELECT 
                        id, job_id, title, company, location, remote, job_type,
                        salary_min, salary_max, salary_currency, application_url,
                        platform, date_posted, scraped_at
                    FROM jobs
                    WHERE scraped_at >= NOW() - INTERVAL '%s days'
                        AND is_active = true
                    ORDER BY scraped_at DESC
                    LIMIT %s
                """, (days_back, limit))
                
                columns = [desc[0] for desc in cursor.description]
                jobs = [dict(zip(columns, row)) for row in cursor.fetchall()]
                
                # Format salary for display
                for job in jobs:
                    job['salary_display'] = self._format_salary_display(
                        job['salary_min'], job['salary_max'], job['salary_currency']
                    )
                
                logger.info(f"Retrieved {len(jobs)} extracted jobs")
                return jobs
                
        except Exception as e:
            logger.error(f"Error retrieving extracted jobs: {e}")
            return []
    
    def _format_salary_display(self, salary_min: Optional[int], salary_max: Optional[int], currency: str = 'USD') -> str:
        """Format salary for display"""
        if not salary_min and not salary_max:
            return ""
        
        def format_amount(amount):
            if amount >= 1000:
                return f"${amount//1000}k"
            return f"${amount}"
        
        if salary_min and salary_max and salary_min != salary_max:
            return f"{format_amount(salary_min)} - {format_amount(salary_max)}"
        elif salary_min:
            return format_amount(salary_min)
        elif salary_max:
            return format_amount(salary_max)
        
        return ""
    
    def get_processing_statistics(self) -> Dict[str, Any]:
        """Get processing statistics"""
        try:
            with self.db_manager.get_connection() as conn:
                cursor = conn.cursor()
                
                # Email processing stats
                cursor.execute("""
                    SELECT 
                        COUNT(*) as total_emails,
                        COUNT(*) FILTER (WHERE processed_at >= NOW() - INTERVAL '24 hours') as emails_last_24h,
                        COUNT(*) FILTER (WHERE email_type != 'other') as job_related_emails,
                        COUNT(*) FILTER (WHERE email_type = 'job_board') as job_board_emails
                    FROM email_communications
                    WHERE processing_status = 'processed'
                """)
                
                email_stats = dict(zip([desc[0] for desc in cursor.description], cursor.fetchone()))
                
                # Job extraction stats
                cursor.execute("""
                    SELECT 
                        COUNT(*) as total_jobs,
                        COUNT(*) FILTER (WHERE scraped_at >= NOW() - INTERVAL '24 hours') as jobs_last_24h,
                        COUNT(DISTINCT platform) as platforms_count,
                        COUNT(DISTINCT company) as companies_count
                    FROM jobs
                    WHERE is_active = true
                """)
                
                job_stats = dict(zip([desc[0] for desc in cursor.description], cursor.fetchone()))
                
                return {
                    'email_processing': email_stats,
                    'job_extraction': job_stats
                }
                
        except Exception as e:
            logger.error(f"Error getting processing statistics: {e}")
            return {'email_processing': {}, 'job_extraction': {}}
    
    # ===== EMAIL THREADING METHODS =====
    
    def get_email_threads(self, days_back: int = 14, limit: int = 50) -> List[Dict[str, Any]]:
        """Get email threads with latest email and thread statistics"""
        
        logger.info(f"Getting email threads: days_back={days_back}, limit={limit}")
        
        try:
            with self.db_manager.get_connection() as conn:
                cursor = conn.cursor()
                
                # Get threads with latest email info and thread stats
                cursor.execute("""
                    WITH thread_stats AS (
                        SELECT 
                            thread_id,
                            COUNT(*) as email_count,
                            COUNT(*) FILTER (WHERE is_unread = true) as unread_count,
                            MAX(email_date) as latest_email_date,
                            MIN(email_date) as first_email_date,
                            string_agg(DISTINCT sender, ', ' ORDER BY sender) as participants
                        FROM email_communications 
                        WHERE thread_id IS NOT NULL 
                            AND email_date >= NOW() - INTERVAL '%s days'
                            AND processing_status = 'processed'
                        GROUP BY thread_id
                    ),
                    latest_emails AS (
                        SELECT DISTINCT ON (thread_id)
                            thread_id,
                            id, email_id, subject, sender, recipient, company, position,
                            email_type, urgency, summary, application_status, deadline,
                            email_date, is_unread, extracted_data, confidence_score
                        FROM email_communications
                        WHERE thread_id IS NOT NULL 
                            AND email_date >= NOW() - INTERVAL '%s days'
                            AND processing_status = 'processed'
                            AND email_type NOT IN ('other', 'job_board')
                        ORDER BY thread_id, email_date DESC
                    )
                    SELECT 
                        ts.thread_id,
                        ts.email_count,
                        ts.unread_count,
                        ts.latest_email_date,
                        ts.first_email_date,
                        ts.participants,
                        le.id, le.email_id, le.subject, le.sender, le.recipient,
                        le.company, le.position, le.email_type, le.urgency, le.summary,
                        le.application_status, le.deadline, le.email_date, le.is_unread,
                        le.extracted_data, le.confidence_score
                    FROM thread_stats ts
                    JOIN latest_emails le ON ts.thread_id = le.thread_id
                    ORDER BY ts.latest_email_date DESC
                    LIMIT %s
                """, (days_back, days_back, limit))
                
                columns = [desc[0] for desc in cursor.description]
                threads = [dict(zip(columns, row)) for row in cursor.fetchall()]
                
                # Group threads by thread_id and structure the data
                structured_threads = []
                for thread in threads:
                    thread_data = {
                        'thread_id': thread['thread_id'],
                        'email_count': thread['email_count'],
                        'unread_count': thread['unread_count'],
                        'latest_email_date': thread['latest_email_date'],
                        'first_email_date': thread['first_email_date'],
                        'participants': thread['participants'],
                        
                        # Latest email details (for thread summary)
                        'latest_email': {
                            'id': thread['id'],
                            'email_id': thread['email_id'],
                            'subject': thread['subject'],
                            'sender': thread['sender'],
                            'recipient': thread['recipient'],
                            'company': thread['company'],
                            'position': thread['position'],
                            'email_type': thread['email_type'],
                            'urgency': thread['urgency'],
                            'summary': thread['summary'],
                            'application_status': thread['application_status'],
                            'deadline': thread['deadline'],
                            'email_date': thread['email_date'],
                            'is_unread': thread['is_unread'],
                            'extracted_data': thread['extracted_data'],
                            'confidence_score': thread['confidence_score']
                        }
                    }
                    structured_threads.append(thread_data)
                
                logger.info(f"Retrieved {len(structured_threads)} email threads")
                return structured_threads
                
        except Exception as e:
            logger.error(f"Error retrieving email threads: {e}")
            return []
    
    def get_emails_in_thread(self, thread_id: str, limit: int = 100) -> List[Dict[str, Any]]:
        """Get all emails in a specific thread, ordered chronologically"""
        
        try:
            with self.db_manager.get_connection() as conn:
                cursor = conn.cursor()
                
                cursor.execute("""
                    SELECT 
                        id, email_id, thread_id, subject, sender, recipient, email_date,
                        content, snippet, is_unread, company, position, email_type,
                        urgency, summary, application_status, deadline, requires_action,
                        extracted_data, confidence_score, processing_status, processed_at,
                        created_at, updated_at
                    FROM email_communications
                    WHERE thread_id = %s 
                        AND processing_status = 'processed'
                    ORDER BY email_date ASC
                    LIMIT %s
                """, (thread_id, limit))
                
                columns = [desc[0] for desc in cursor.description]
                emails = [dict(zip(columns, row)) for row in cursor.fetchall()]
                
                logger.info(f"Retrieved {len(emails)} emails for thread {thread_id}")
                return emails
                
        except Exception as e:
            logger.error(f"Error retrieving emails for thread {thread_id}: {e}")
            return []
    
    def get_thread_summary(self, thread_id: str) -> Optional[Dict[str, Any]]:
        """Get summary information for a specific thread"""
        
        try:
            with self.db_manager.get_connection() as conn:
                cursor = conn.cursor()
                
                cursor.execute("""
                    SELECT 
                        thread_id,
                        COUNT(*) as email_count,
                        COUNT(*) FILTER (WHERE is_unread = true) as unread_count,
                        MAX(email_date) as latest_email_date,
                        MIN(email_date) as first_email_date,
                        string_agg(DISTINCT sender, ', ' ORDER BY sender) as participants,
                        string_agg(DISTINCT company, ', ') as companies,
                        string_agg(DISTINCT position, ', ') as positions,
                        array_agg(DISTINCT email_type) as email_types,
                        MAX(CASE urgency WHEN 'high' THEN 3 WHEN 'normal' THEN 2 ELSE 1 END) as max_urgency_score
                    FROM email_communications 
                    WHERE thread_id = %s 
                        AND processing_status = 'processed'
                    GROUP BY thread_id
                """, (thread_id,))
                
                result = cursor.fetchone()
                if not result:
                    return None
                    
                columns = [desc[0] for desc in cursor.description]
                thread_summary = dict(zip(columns, result))
                
                # Convert urgency score back to text
                urgency_map = {3: 'high', 2: 'normal', 1: 'low'}
                thread_summary['max_urgency'] = urgency_map.get(thread_summary['max_urgency_score'], 'normal')
                
                return thread_summary
                
        except Exception as e:
            logger.error(f"Error getting thread summary for {thread_id}: {e}")
            return None