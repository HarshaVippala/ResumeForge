"""
Database Manager Service
Handles SQLite database operations for resume sessions and library
"""

import sqlite3
import json
import uuid
import logging
from datetime import datetime
from typing import Dict, List, Optional, Any
from contextlib import contextmanager

logger = logging.getLogger(__name__)

class DatabaseManager:
    """Manage SQLite database for resume sessions and library"""
    
    def __init__(self, db_path: str = "resume_builder.db"):
        self.db_path = db_path
        
    def init_database(self):
        """Initialize database with required tables"""
        try:
            with self.get_connection() as conn:
                # Resume sessions table
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS resume_sessions (
                        id TEXT PRIMARY KEY,
                        company TEXT NOT NULL,
                        role TEXT NOT NULL,
                        job_description TEXT NOT NULL,
                        analysis_data TEXT NOT NULL,  -- JSON string
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                
                # Section versions table
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS section_versions (
                        id TEXT PRIMARY KEY,
                        session_id TEXT NOT NULL,
                        section_type TEXT NOT NULL,
                        version_number INTEGER NOT NULL,
                        content TEXT NOT NULL,
                        keywords TEXT NOT NULL,  -- JSON array
                        score INTEGER DEFAULT 0,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (session_id) REFERENCES resume_sessions (id)
                    )
                """)
                
                # Resume library table
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS resume_library (
                        id TEXT PRIMARY KEY,
                        session_id TEXT NOT NULL,
                        title TEXT NOT NULL,
                        company TEXT NOT NULL,
                        role TEXT NOT NULL,
                        final_score INTEGER DEFAULT 0,
                        file_paths TEXT NOT NULL,  -- JSON object
                        tags TEXT DEFAULT '[]',  -- JSON array
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (session_id) REFERENCES resume_sessions (id)
                    )
                """)
                
                # Email communications table
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS email_communications (
                        id TEXT PRIMARY KEY,
                        gmail_message_id TEXT UNIQUE NOT NULL,
                        subject TEXT NOT NULL,
                        sender TEXT NOT NULL,
                        recipient TEXT,
                        email_date TIMESTAMP NOT NULL,
                        content TEXT,
                        email_type TEXT DEFAULT 'other',  -- interview, rejection, recruiter, follow_up, offer, job_alert, other
                        is_read BOOLEAN DEFAULT FALSE,
                        company_name TEXT,
                        position TEXT,
                        recruiter_name TEXT,
                        recruiter_email TEXT,
                        recruiter_phone TEXT,
                        client_company TEXT,
                        summary TEXT,
                        interview_date TEXT,
                        interview_time TEXT,
                        interview_platform TEXT,
                        interview_link TEXT,
                        salary_range TEXT,
                        location TEXT,
                        urgency TEXT DEFAULT 'medium',
                        action_required TEXT,
                        processing_status TEXT DEFAULT 'processed',
                        confidence_score REAL DEFAULT 0.0,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                
                # Create indexes for better performance
                conn.execute("CREATE INDEX IF NOT EXISTS idx_sessions_company ON resume_sessions(company)")
                conn.execute("CREATE INDEX IF NOT EXISTS idx_sessions_created ON resume_sessions(created_at)")
                conn.execute("CREATE INDEX IF NOT EXISTS idx_library_company ON resume_library(company)")
                conn.execute("CREATE INDEX IF NOT EXISTS idx_library_created ON resume_library(created_at)")
                # Email indexes - match existing schema
                conn.execute("CREATE INDEX IF NOT EXISTS idx_emails_date ON email_communications(email_date)")
                conn.execute("CREATE INDEX IF NOT EXISTS idx_emails_type ON email_communications(email_type)")
                conn.execute("CREATE INDEX IF NOT EXISTS idx_emails_email_id ON email_communications(email_id)")
                
                conn.commit()
                logger.info("Database initialized successfully")
                
        except Exception as e:
            logger.error(f"Error initializing database: {e}")
            raise
    
    @contextmanager
    def get_connection(self):
        """Get database connection with automatic cleanup"""
        conn = None
        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row  # Enable column access by name
            yield conn
        except Exception as e:
            if conn:
                conn.rollback()
            raise e
        finally:
            if conn:
                conn.close()
    
    def create_session(
        self, 
        company: str, 
        role: str, 
        job_description: str, 
        analysis_data: Dict[str, Any]
    ) -> str:
        """Create a new resume session"""
        try:
            session_id = str(uuid.uuid4())
            
            with self.get_connection() as conn:
                conn.execute("""
                    INSERT INTO resume_sessions 
                    (id, company, role, job_description, analysis_data)
                    VALUES (?, ?, ?, ?, ?)
                """, (
                    session_id,
                    company,
                    role,
                    job_description,
                    json.dumps(analysis_data)
                ))
                conn.commit()
                
            logger.info(f"Created session {session_id} for {company} - {role}")
            return session_id
            
        except Exception as e:
            logger.error(f"Error creating session: {e}")
            raise
    
    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get session data by ID"""
        try:
            with self.get_connection() as conn:
                cursor = conn.execute("""
                    SELECT * FROM resume_sessions WHERE id = ?
                """, (session_id,))
                
                row = cursor.fetchone()
                if not row:
                    return None
                
                return {
                    'id': row['id'],
                    'company': row['company'],
                    'role': row['role'],
                    'job_description': row['job_description'],
                    'analysis_data': json.loads(row['analysis_data']),
                    'created_at': row['created_at'],
                    'updated_at': row['updated_at']
                }
                
        except Exception as e:
            logger.error(f"Error getting session {session_id}: {e}")
            return None
    
    def save_section_version(
        self,
        session_id: str,
        section_type: str,
        content: str,
        keywords: List[str],
        score: int = 0
    ) -> str:
        """Save a new version of a resume section"""
        try:
            version_id = str(uuid.uuid4())
            
            with self.get_connection() as conn:
                # Get next version number for this session/section
                cursor = conn.execute("""
                    SELECT COALESCE(MAX(version_number), 0) + 1 as next_version
                    FROM section_versions 
                    WHERE session_id = ? AND section_type = ?
                """, (session_id, section_type))
                
                next_version = cursor.fetchone()['next_version']
                
                # Insert new version
                conn.execute("""
                    INSERT INTO section_versions 
                    (id, session_id, section_type, version_number, content, keywords, score)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    version_id,
                    session_id,
                    section_type,
                    next_version,
                    content,
                    json.dumps(keywords),
                    score
                ))
                
                conn.commit()
                
            logger.info(f"Saved {section_type} version {next_version} for session {session_id}")
            return version_id
            
        except Exception as e:
            logger.error(f"Error saving section version: {e}")
            raise
    
    def get_section_versions(
        self, 
        session_id: str, 
        section_type: str
    ) -> List[Dict[str, Any]]:
        """Get all versions of a section for a session"""
        try:
            with self.get_connection() as conn:
                cursor = conn.execute("""
                    SELECT * FROM section_versions 
                    WHERE session_id = ? AND section_type = ?
                    ORDER BY version_number DESC
                """, (session_id, section_type))
                
                versions = []
                for row in cursor.fetchall():
                    versions.append({
                        'id': row['id'],
                        'session_id': row['session_id'],
                        'section_type': row['section_type'],
                        'version_number': row['version_number'],
                        'content': row['content'],
                        'keywords': json.loads(row['keywords']),
                        'score': row['score'],
                        'created_at': row['created_at']
                    })
                
                return versions
                
        except Exception as e:
            logger.error(f"Error getting section versions: {e}")
            return []
    
    def save_to_library(
        self,
        session_id: str,
        file_path: str,
        format: str,
        title: Optional[str] = None
    ) -> str:
        """Save completed resume to library"""
        try:
            library_id = str(uuid.uuid4())
            
            # Get session data for context
            session = self.get_session(session_id)
            if not session:
                raise ValueError(f"Session {session_id} not found")
            
            # Generate title if not provided
            if not title:
                title = f"{session['company']} - {session['role']}"
            
            # File paths as JSON object
            file_paths = {format: file_path}
            
            with self.get_connection() as conn:
                conn.execute("""
                    INSERT INTO resume_library 
                    (id, session_id, title, company, role, file_paths)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (
                    library_id,
                    session_id,
                    title,
                    session['company'],
                    session['role'],
                    json.dumps(file_paths)
                ))
                
                conn.commit()
                
            logger.info(f"Saved resume to library: {title}")
            return library_id
            
        except Exception as e:
            logger.error(f"Error saving to library: {e}")
            raise
    
    def get_resume_library(
        self, 
        limit: int = 50, 
        company_filter: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get resumes from library with optional filtering"""
        try:
            with self.get_connection() as conn:
                query = """
                    SELECT * FROM resume_library 
                    WHERE 1=1
                """
                params = []
                
                if company_filter:
                    query += " AND company LIKE ?"
                    params.append(f"%{company_filter}%")
                
                query += " ORDER BY created_at DESC LIMIT ?"
                params.append(limit)
                
                cursor = conn.execute(query, params)
                
                resumes = []
                for row in cursor.fetchall():
                    resumes.append({
                        'id': row['id'],
                        'session_id': row['session_id'],
                        'title': row['title'],
                        'company': row['company'],
                        'role': row['role'],
                        'final_score': row['final_score'],
                        'file_paths': json.loads(row['file_paths']),
                        'tags': json.loads(row['tags']),
                        'created_at': row['created_at']
                    })
                
                return resumes
                
        except Exception as e:
            logger.error(f"Error getting resume library: {e}")
            return []
    
    def search_resumes(
        self, 
        search_term: str, 
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """Search resumes by company, role, or title"""
        try:
            with self.get_connection() as conn:
                cursor = conn.execute("""
                    SELECT * FROM resume_library 
                    WHERE company LIKE ? OR role LIKE ? OR title LIKE ?
                    ORDER BY created_at DESC LIMIT ?
                """, (f"%{search_term}%", f"%{search_term}%", f"%{search_term}%", limit))
                
                resumes = []
                for row in cursor.fetchall():
                    resumes.append({
                        'id': row['id'],
                        'session_id': row['session_id'],
                        'title': row['title'],
                        'company': row['company'],
                        'role': row['role'],
                        'final_score': row['final_score'],
                        'file_paths': json.loads(row['file_paths']),
                        'tags': json.loads(row['tags']),
                        'created_at': row['created_at']
                    })
                
                return resumes
                
        except Exception as e:
            logger.error(f"Error searching resumes: {e}")
            return []
    
    def update_session(self, session_id: str, **kwargs):
        """Update session data"""
        try:
            # Build dynamic update query
            set_clauses = []
            params = []
            
            for key, value in kwargs.items():
                if key in ['company', 'role', 'job_description']:
                    set_clauses.append(f"{key} = ?")
                    params.append(value)
                elif key == 'analysis_data':
                    set_clauses.append("analysis_data = ?")
                    params.append(json.dumps(value))
            
            if not set_clauses:
                return
            
            set_clauses.append("updated_at = CURRENT_TIMESTAMP")
            params.append(session_id)
            
            with self.get_connection() as conn:
                query = f"UPDATE resume_sessions SET {', '.join(set_clauses)} WHERE id = ?"
                conn.execute(query, params)
                conn.commit()
                
            logger.info(f"Updated session {session_id}")
            
        except Exception as e:
            logger.error(f"Error updating session: {e}")
            raise
    
    def delete_session(self, session_id: str):
        """Delete a session and all related data"""
        try:
            with self.get_connection() as conn:
                # Delete in order due to foreign key constraints
                conn.execute("DELETE FROM section_versions WHERE session_id = ?", (session_id,))
                conn.execute("DELETE FROM resume_library WHERE session_id = ?", (session_id,))
                conn.execute("DELETE FROM resume_sessions WHERE id = ?", (session_id,))
                conn.commit()
                
            logger.info(f"Deleted session {session_id}")
            
        except Exception as e:
            logger.error(f"Error deleting session: {e}")
            raise
    
    def store_email(self, email_data: Dict[str, Any]) -> str:
        """Store email in database"""
        try:
            email_id = str(uuid.uuid4())
            
            with self.get_connection() as conn:
                # Check if email already exists
                cursor = conn.execute(
                    "SELECT id FROM email_communications WHERE gmail_message_id = ?",
                    (email_data.get('gmail_message_id'),)
                )
                existing = cursor.fetchone()
                
                if existing:
                    # Update existing email
                    conn.execute("""
                        UPDATE email_communications SET
                            subject = ?, sender = ?, recipient = ?, email_date = ?,
                            content = ?, email_type = ?, is_read = ?, company_name = ?,
                            position = ?, recruiter_name = ?, recruiter_email = ?,
                            recruiter_phone = ?, client_company = ?, summary = ?,
                            interview_date = ?, interview_time = ?, interview_platform = ?,
                            interview_link = ?, salary_range = ?, location = ?,
                            urgency = ?, action_required = ?, confidence_score = ?,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE gmail_message_id = ?
                    """, (
                        email_data.get('subject', ''),
                        email_data.get('sender', ''),
                        email_data.get('recipient', ''),
                        email_data.get('email_date', datetime.utcnow()),
                        email_data.get('content', ''),
                        email_data.get('email_type', 'other'),
                        email_data.get('is_read', False),
                        email_data.get('company_name', ''),
                        email_data.get('position', ''),
                        email_data.get('recruiter_name', ''),
                        email_data.get('recruiter_email', ''),
                        email_data.get('recruiter_phone', ''),
                        email_data.get('client_company', ''),
                        email_data.get('summary', ''),
                        email_data.get('interview_date', ''),
                        email_data.get('interview_time', ''),
                        email_data.get('interview_platform', ''),
                        email_data.get('interview_link', ''),
                        email_data.get('salary_range', ''),
                        email_data.get('location', ''),
                        email_data.get('urgency', 'medium'),
                        email_data.get('action_required', ''),
                        email_data.get('confidence_score', 0.0),
                        email_data.get('gmail_message_id')
                    ))
                    return existing['id']
                else:
                    # Insert new email
                    conn.execute("""
                        INSERT INTO email_communications (
                            id, gmail_message_id, subject, sender, recipient, email_date,
                            content, email_type, is_read, company_name, position,
                            recruiter_name, recruiter_email, recruiter_phone, client_company,
                            summary, interview_date, interview_time, interview_platform,
                            interview_link, salary_range, location, urgency, action_required,
                            confidence_score
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        email_id,
                        email_data.get('gmail_message_id'),
                        email_data.get('subject', ''),
                        email_data.get('sender', ''),
                        email_data.get('recipient', ''),
                        email_data.get('email_date', datetime.utcnow()),
                        email_data.get('content', ''),
                        email_data.get('email_type', 'other'),
                        email_data.get('is_read', False),
                        email_data.get('company_name', ''),
                        email_data.get('position', ''),
                        email_data.get('recruiter_name', ''),
                        email_data.get('recruiter_email', ''),
                        email_data.get('recruiter_phone', ''),
                        email_data.get('client_company', ''),
                        email_data.get('summary', ''),
                        email_data.get('interview_date', ''),
                        email_data.get('interview_time', ''),
                        email_data.get('interview_platform', ''),
                        email_data.get('interview_link', ''),
                        email_data.get('salary_range', ''),
                        email_data.get('location', ''),
                        email_data.get('urgency', 'medium'),
                        email_data.get('action_required', ''),
                        email_data.get('confidence_score', 0.0)
                    ))
                
                conn.commit()
                
            logger.info(f"Stored email {email_data.get('gmail_message_id')} from {email_data.get('sender')}")
            return email_id
            
        except Exception as e:
            logger.error(f"Error storing email: {e}")
            raise
    
    def get_stored_emails(self, days_back: int = 14, limit: int = 50) -> List[Dict[str, Any]]:
        """Get stored emails from database"""
        try:
            with self.get_connection() as conn:
                cursor = conn.execute("""
                    SELECT * FROM email_communications 
                    WHERE email_date >= datetime('now', '-{} days')
                    ORDER BY email_date DESC 
                    LIMIT ?
                """.format(days_back), (limit,))
                
                emails = []
                for row in cursor.fetchall():
                    # Convert sqlite3.Row to dict
                    email_dict = dict(row)
                    emails.append(email_dict)
                
                logger.info(f"Retrieved {len(emails)} emails from database (past {days_back} days)")
                return emails
                
        except Exception as e:
            logger.error(f"Error retrieving stored emails: {e}")
            return []