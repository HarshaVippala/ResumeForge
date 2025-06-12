#!/usr/bin/env python3
"""
Email-Job Integration Service
Handles the flow: Email → Company/Contact → Job Opportunity → Resume Version
"""

import logging
import json
from datetime import datetime, date
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
import sqlite3

logger = logging.getLogger(__name__)

@dataclass
class EmailJobMatch:
    """Result of matching email to job opportunity"""
    job_opportunity_id: Optional[int] = None
    company_id: Optional[int] = None
    contact_id: Optional[int] = None
    is_new_opportunity: bool = False
    confidence_score: float = 0.0
    match_reason: str = ""

class EmailJobIntegrator:
    """
    Integrates email communications with job tracking system
    """
    
    def __init__(self, db_path: str = "resume_builder.db"):
        self.db_path = db_path
        self.init_database()
    
    def init_database(self):
        """Initialize database with new schema"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                # Read and execute schema
                schema_path = "schemas/email_job_tracking_schema.sql"
                try:
                    with open(schema_path, 'r') as f:
                        schema_sql = f.read()
                    conn.executescript(schema_sql)
                    logger.info("Email-Job tracking database schema initialized")
                except FileNotFoundError:
                    logger.warning(f"Schema file not found: {schema_path}")
                    self._create_basic_tables(conn)
        except Exception as e:
            logger.error(f"Database initialization error: {e}")
    
    def _create_basic_tables(self, conn):
        """Create basic tables if schema file not found"""
        # Basic implementation - would contain table creation SQL
        pass
    
    def process_email_for_job_tracking(self, email_data: Dict, extracted_details: Dict) -> EmailJobMatch:
        """
        Process email and integrate with job tracking system
        
        Args:
            email_data: Raw email data from Gmail
            extracted_details: LM Studio extracted information
            
        Returns:
            EmailJobMatch with integration results
        """
        try:
            logger.info(f"Processing email for job tracking: {email_data.get('subject', 'No Subject')}")
            
            # Step 1: Find or create company
            company_id = self._find_or_create_company(extracted_details)
            
            # Step 2: Find or create contact
            contact_id = self._find_or_create_contact(extracted_details, company_id)
            
            # Step 3: Find or create job opportunity
            job_opportunity_id, is_new = self._find_or_create_job_opportunity(extracted_details, company_id)
            
            # Step 4: Save email communication
            self._save_email_communication(email_data, extracted_details, job_opportunity_id, contact_id)
            
            # Step 5: Handle specific email types
            if extracted_details.get('type') == 'interview':
                self._handle_interview_email(extracted_details, job_opportunity_id, email_data['id'])
            
            # Step 6: Update activity timeline
            self._update_activity_timeline(job_opportunity_id, 'email_received', 
                                         f"Email from {extracted_details.get('recruiter_name', 'contact')}")
            
            return EmailJobMatch(
                job_opportunity_id=job_opportunity_id,
                company_id=company_id,
                contact_id=contact_id,
                is_new_opportunity=is_new,
                confidence_score=0.8,
                match_reason="Successfully integrated email with job tracking"
            )
            
        except Exception as e:
            logger.error(f"Error processing email for job tracking: {e}")
            return EmailJobMatch(confidence_score=0.0, match_reason=f"Error: {str(e)}")
    
    def _find_or_create_company(self, extracted_details: Dict) -> int:
        """Find existing company or create new one"""
        company_name = extracted_details.get('company', 'Unknown Company')
        client_company = extracted_details.get('client_company', '')
        
        # Use client company if it's a recruiting firm
        primary_company = client_company if client_company else company_name
        
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            # Try to find existing company
            cursor.execute("""
                SELECT id FROM companies 
                WHERE LOWER(name) = LOWER(?) 
                LIMIT 1
            """, (primary_company,))
            
            result = cursor.fetchone()
            if result:
                return result[0]
            
            # Create new company
            cursor.execute("""
                INSERT INTO companies (name, notes, created_at)
                VALUES (?, ?, ?)
            """, (primary_company, f"Auto-created from email. Original: {company_name}", datetime.now()))
            
            return cursor.lastrowid
    
    def _find_or_create_contact(self, extracted_details: Dict, company_id: int) -> Optional[int]:
        """Find existing contact or create new one"""
        recruiter_name = extracted_details.get('recruiter_name', '')
        recruiter_email = extracted_details.get('recruiter_email', '')
        
        if not recruiter_name and not recruiter_email:
            return None
        
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            # Try to find existing contact by email or name
            if recruiter_email:
                cursor.execute("""
                    SELECT id FROM contacts 
                    WHERE LOWER(email) = LOWER(?) 
                    LIMIT 1
                """, (recruiter_email,))
            else:
                cursor.execute("""
                    SELECT id FROM contacts 
                    WHERE LOWER(name) = LOWER(?) AND company_id = ?
                    LIMIT 1
                """, (recruiter_name, company_id))
            
            result = cursor.fetchone()
            if result:
                return result[0]
            
            # Create new contact
            cursor.execute("""
                INSERT INTO contacts (company_id, name, email, phone, role_type, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                company_id,
                recruiter_name or 'Unknown Contact',
                recruiter_email,
                extracted_details.get('recruiter_phone', ''),
                'recruiter',  # Default assumption
                datetime.now()
            ))
            
            return cursor.lastrowid
    
    def _find_or_create_job_opportunity(self, extracted_details: Dict, company_id: int) -> Tuple[int, bool]:
        """Find existing job opportunity or create new one"""
        position = extracted_details.get('position', '')
        
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            # Try to find existing opportunity
            if position:
                cursor.execute("""
                    SELECT id FROM job_opportunities 
                    WHERE company_id = ? AND LOWER(title) = LOWER(?)
                    AND status NOT IN ('rejected', 'withdrawn')
                    ORDER BY created_at DESC
                    LIMIT 1
                """, (company_id, position))
                
                result = cursor.fetchone()
                if result:
                    return result[0], False
            
            # Create new job opportunity
            cursor.execute("""
                INSERT INTO job_opportunities (
                    company_id, title, application_type, status, 
                    salary_range, location, source, last_contact_date, created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                company_id,
                position or 'Unknown Position',
                'recruiter_outreach',
                'sourced',
                extracted_details.get('salary_range', ''),
                extracted_details.get('location', ''),
                'email',
                date.today(),
                datetime.now()
            ))
            
            return cursor.lastrowid, True
    
    def _save_email_communication(self, email_data: Dict, extracted_details: Dict, 
                                job_opportunity_id: int, contact_id: Optional[int]):
        """Save email communication record"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            cursor.execute("""
                INSERT OR REPLACE INTO email_communications (
                    email_id, job_opportunity_id, contact_id, subject, sender, 
                    email_date, is_unread, email_type, direction, urgency,
                    content, snippet, extracted_data, sentiment, action_required,
                    processed_at, processing_status, created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                email_data['id'],
                job_opportunity_id,
                contact_id,
                email_data['subject'],
                email_data['sender'],
                email_data['date'],
                email_data['is_unread'],
                extracted_details.get('type', 'other'),
                'inbound',  # Assuming inbound emails
                extracted_details.get('urgency', 'medium'),
                email_data.get('body', ''),
                email_data.get('snippet', ''),
                json.dumps(extracted_details),
                'neutral',  # Default sentiment
                extracted_details.get('action_required', ''),
                datetime.now(),
                'processed',
                datetime.now()
            ))
    
    def _handle_interview_email(self, extracted_details: Dict, job_opportunity_id: int, email_id: str):
        """Handle interview-specific email processing"""
        interview_date = extracted_details.get('interview_date', '')
        interview_time = extracted_details.get('interview_time', '')
        
        if interview_date:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                cursor.execute("""
                    INSERT INTO interview_schedules (
                        job_opportunity_id, email_communication_id, interview_type,
                        interview_date, interview_time, platform, meeting_link,
                        status, created_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    job_opportunity_id,
                    email_id,
                    'video',  # Default assumption
                    interview_date,
                    interview_time,
                    extracted_details.get('interview_platform', 'unknown'),
                    extracted_details.get('interview_link', ''),
                    'scheduled',
                    datetime.now()
                ))
    
    def _update_activity_timeline(self, job_opportunity_id: int, activity_type: str, description: str):
        """Update activity timeline"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            cursor.execute("""
                INSERT INTO activity_timeline (job_opportunity_id, activity_type, description, created_at)
                VALUES (?, ?, ?, ?)
            """, (job_opportunity_id, activity_type, description, datetime.now()))
    
    def get_job_opportunities_summary(self) -> List[Dict]:
        """Get summary of all job opportunities for dashboard"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT 
                    jo.id, jo.title, c.name as company_name, jo.status,
                    jo.salary_range, jo.location, jo.application_date,
                    COUNT(ec.id) as email_count,
                    MAX(ec.email_date) as last_email_date
                FROM job_opportunities jo
                JOIN companies c ON jo.company_id = c.id
                LEFT JOIN email_communications ec ON jo.id = ec.job_opportunity_id
                GROUP BY jo.id
                ORDER BY last_email_date DESC, jo.created_at DESC
            """)
            
            results = cursor.fetchall()
            columns = [description[0] for description in cursor.description]
            
            return [dict(zip(columns, row)) for row in results]
    
    def create_resume_version_for_opportunity(self, job_opportunity_id: int, 
                                            base_resume_content: Dict) -> int:
        """Create a resume version tailored for specific job opportunity"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            # Get job details for customization
            cursor.execute("""
                SELECT jo.title, c.name as company_name, jo.description, jo.requirements
                FROM job_opportunities jo
                JOIN companies c ON jo.company_id = c.id
                WHERE jo.id = ?
            """, (job_opportunity_id,))
            
            job_details = cursor.fetchone()
            if not job_details:
                raise ValueError(f"Job opportunity {job_opportunity_id} not found")
            
            title, company_name, description, requirements = job_details
            
            # Create version name
            version_name = f"{company_name} - {title}"
            
            # Insert resume version
            cursor.execute("""
                INSERT INTO resume_versions (
                    job_opportunity_id, version_name, content, 
                    status, customization_level, created_at
                )
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                job_opportunity_id,
                version_name,
                json.dumps(base_resume_content),
                'draft',
                'moderate',  # Will be determined by actual customization
                datetime.now()
            ))
            
            return cursor.lastrowid