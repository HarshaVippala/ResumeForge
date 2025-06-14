"""
Supabase Database Manager
Handles PostgreSQL database operations for resume sessions and library using psycopg2
"""

import psycopg2
import psycopg2.extras
import json
import uuid
import logging
from datetime import datetime
from typing import Dict, List, Optional, Any
from contextlib import contextmanager
from config.database_config import db_config

logger = logging.getLogger(__name__)

class SupabaseDatabaseManager:
    """Manage PostgreSQL database for resume sessions and library"""
    
    def __init__(self, database_url: Optional[str] = None):
        self.database_url = database_url or db_config.get_database_url()
        
    @contextmanager
    def get_connection(self):
        """Get database connection with context manager"""
        conn = None
        try:
            conn = psycopg2.connect(self.database_url)
            yield conn
            conn.commit()
        except Exception as e:
            if conn:
                conn.rollback()
            logger.error(f"Database error: {e}")
            raise
        finally:
            if conn:
                conn.close()
                
    def execute_query(self, query: str, params: tuple = None) -> List[Dict[str, Any]]:
        """Execute a query and return results as list of dictionaries"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
                
                if params:
                    cursor.execute(query, params)
                else:
                    cursor.execute(query)
                
                # For SELECT queries, fetch results
                if query.strip().upper().startswith('SELECT'):
                    return [dict(row) for row in cursor.fetchall()]
                else:
                    # For INSERT/UPDATE/DELETE, return empty list but commit is handled by context manager
                    return []
                    
        except Exception as e:
            logger.error(f"Query execution failed: {e}")
            logger.error(f"Query: {query}")
            logger.error(f"Params: {params}")
            raise

    def init_database(self):
        """Initialize database with required tables"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                # Resume sessions table
                cursor.execute("""
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
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS section_versions (
                        id TEXT PRIMARY KEY,
                        session_id TEXT NOT NULL,
                        section_type TEXT NOT NULL,
                        version_number INTEGER NOT NULL,
                        content TEXT NOT NULL,
                        keywords TEXT NOT NULL,  -- JSON array
                        score INTEGER DEFAULT 0,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (session_id) REFERENCES resume_sessions (id) ON DELETE CASCADE
                    )
                """)
                
                # Resume library table
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS resume_library (
                        id TEXT PRIMARY KEY,
                        session_id TEXT,
                        title TEXT NOT NULL,
                        company TEXT NOT NULL,
                        role TEXT NOT NULL,
                        final_score INTEGER DEFAULT 0,
                        file_paths TEXT,  -- JSON object
                        tags TEXT,  -- JSON array
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (session_id) REFERENCES resume_sessions (id) ON DELETE SET NULL
                    )
                """)
                
                # Jobs table for storing scraped job postings
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS jobs (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        job_id VARCHAR(255) UNIQUE NOT NULL,
                        title VARCHAR(500) NOT NULL,
                        company VARCHAR(255) NOT NULL,
                        location VARCHAR(255),
                        remote BOOLEAN DEFAULT false,
                        job_type VARCHAR(50),
                        salary_min INTEGER,
                        salary_max INTEGER,
                        salary_currency VARCHAR(10) DEFAULT 'USD',
                        description TEXT,
                        requirements TEXT,
                        benefits TEXT,
                        application_url VARCHAR(1000),
                        company_logo_url VARCHAR(1000),
                        platform VARCHAR(50) NOT NULL,
                        date_posted TIMESTAMP,
                        scraped_at TIMESTAMP DEFAULT NOW(),
                        updated_at TIMESTAMP DEFAULT NOW(),
                        is_active BOOLEAN DEFAULT true,
                        skills TEXT[],
                        experience_level VARCHAR(50),
                        company_size VARCHAR(50),
                        industry VARCHAR(100),
                        employment_type VARCHAR(50),
                        seniority_level VARCHAR(50),
                        search_vector tsvector,
                        
                        CONSTRAINT valid_platform CHECK (platform IN ('indeed', 'linkedin', 'glassdoor', 'ziprecruiter', 'google', 'bayt', 'naukri')),
                        CONSTRAINT valid_job_type CHECK (job_type IN ('full-time', 'part-time', 'contract', 'internship', 'temporary')),
                        CONSTRAINT valid_experience_level CHECK (experience_level IN ('entry', 'mid', 'senior', 'executive', 'intern'))
                    )
                """)
                
                # Saved jobs table for user preferences
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS saved_jobs (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        user_email VARCHAR(255) NOT NULL,
                        job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
                        saved_at TIMESTAMP DEFAULT NOW(),
                        notes TEXT,
                        status VARCHAR(50) DEFAULT 'saved',
                        
                        UNIQUE(user_email, job_id)
                    )
                """)
                
                # Job alerts table for user notifications
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS job_alerts (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        user_email VARCHAR(255) NOT NULL,
                        search_query VARCHAR(500) NOT NULL,
                        location_filter VARCHAR(255),
                        salary_min INTEGER,
                        salary_max INTEGER,
                        remote_only BOOLEAN DEFAULT false,
                        platforms TEXT[],
                        experience_levels TEXT[],
                        is_active BOOLEAN DEFAULT true,
                        created_at TIMESTAMP DEFAULT NOW(),
                        last_triggered TIMESTAMP,
                        email_notifications BOOLEAN DEFAULT true,
                        frequency VARCHAR(20) DEFAULT 'daily'
                    )
                """)
                
                # Job applications table
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS job_applications (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        user_email VARCHAR(255) NOT NULL,
                        job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
                        applied_at TIMESTAMP DEFAULT NOW(),
                        application_method VARCHAR(100),
                        cover_letter_used TEXT,
                        resume_version_used VARCHAR(255),
                        status VARCHAR(50) DEFAULT 'applied',
                        notes TEXT,
                        interview_date TIMESTAMP,
                        interview_type VARCHAR(50),
                        interview_notes TEXT,
                        
                        UNIQUE(user_email, job_id)
                    )
                """)
                
                # Search vector function and trigger for jobs
                cursor.execute("""
                    CREATE OR REPLACE FUNCTION update_jobs_search_vector()
                    RETURNS TRIGGER AS $$
                    BEGIN
                        NEW.search_vector := 
                            setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
                            setweight(to_tsvector('english', COALESCE(NEW.company, '')), 'B') ||
                            setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'C') ||
                            setweight(to_tsvector('english', COALESCE(array_to_string(NEW.skills, ' '), '')), 'B');
                        NEW.updated_at := NOW();
                        RETURN NEW;
                    END;
                    $$ LANGUAGE plpgsql
                """)
                
                cursor.execute("""
                    DROP TRIGGER IF EXISTS jobs_search_vector_update ON jobs;
                    CREATE TRIGGER jobs_search_vector_update
                        BEFORE INSERT OR UPDATE ON jobs
                        FOR EACH ROW
                        EXECUTE FUNCTION update_jobs_search_vector()
                """)
                
                # Create indexes for better performance
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_sessions_company ON resume_sessions (company)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_sessions_role ON resume_sessions (role)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_sessions_created ON resume_sessions (created_at)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_versions_session ON section_versions (session_id)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_versions_type ON section_versions (section_type)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_library_company ON resume_library (company)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_library_role ON resume_library (role)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_library_created ON resume_library (created_at)")
                
                # Jobs table indexes
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_jobs_location ON jobs(location)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs(company)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_jobs_date_posted ON jobs(date_posted DESC)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_jobs_platform ON jobs(platform)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_jobs_active ON jobs(is_active) WHERE is_active = true")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_jobs_remote ON jobs(remote) WHERE remote = true")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_jobs_salary ON jobs(salary_min, salary_max)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_jobs_experience ON jobs(experience_level)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_jobs_scraped_at ON jobs(scraped_at DESC)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_jobs_search ON jobs USING GIN(search_vector)")
                
                # Saved jobs indexes
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_saved_jobs_user ON saved_jobs(user_email)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_saved_jobs_status ON saved_jobs(status)")
                
                # Job alerts indexes
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_job_alerts_user ON job_alerts(user_email)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_job_alerts_active ON job_alerts(is_active) WHERE is_active = true")
                
                # Job applications indexes
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_job_applications_user ON job_applications(user_email)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_job_applications_status ON job_applications(status)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_job_applications_applied_at ON job_applications(applied_at DESC)")
                
                # Sync metadata table for Gmail incremental sync
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS sync_metadata (
                        user_email VARCHAR(255) PRIMARY KEY,
                        gmail_history_id VARCHAR(255),
                        last_sync_timestamp TIMESTAMP,
                        last_gmail_date TIMESTAMP,
                        sync_status VARCHAR(50) DEFAULT 'idle',
                        processed_count INTEGER DEFAULT 0,
                        tokens_used INTEGER DEFAULT 0,
                        error_message TEXT,
                        created_at TIMESTAMP DEFAULT NOW(),
                        updated_at TIMESTAMP DEFAULT NOW()
                    )
                """)
                
                # Email communications table for processed emails
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS email_communications (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        email_id VARCHAR(255) UNIQUE NOT NULL,
                        thread_id VARCHAR(255),
                        subject TEXT,
                        sender VARCHAR(500),
                        recipient VARCHAR(500),
                        email_date TIMESTAMP,
                        email_type VARCHAR(50) DEFAULT 'other',
                        extracted_data JSONB,
                        confidence_score DECIMAL(3,2) DEFAULT 0.0,
                        sentiment VARCHAR(20),
                        urgency VARCHAR(20) DEFAULT 'normal',
                        action_required TEXT,
                        rich_summary TEXT,
                        key_info JSONB,
                        processing_status VARCHAR(50) DEFAULT 'pending',
                        processed_at TIMESTAMP,
                        contact_id UUID,
                        job_opportunity_id UUID,
                        recruiter_id UUID,
                        conversation_stage VARCHAR(50),
                        is_unread BOOLEAN DEFAULT true,
                        error_message TEXT,
                        created_at TIMESTAMP DEFAULT NOW(),
                        updated_at TIMESTAMP DEFAULT NOW(),
                        
                        CONSTRAINT valid_email_type CHECK (email_type IN ('application_confirmation', 'interview_invitation', 'interview_confirmation', 'interview_reschedule', 'rejection', 'offer', 'follow_up', 'recruiter_outreach', 'assessment_invite', 'reference_request', 'other')),
                        CONSTRAINT valid_urgency CHECK (urgency IN ('low', 'normal', 'high')),
                        CONSTRAINT valid_sentiment CHECK (sentiment IN ('positive', 'neutral', 'negative')),
                        CONSTRAINT valid_processing_status CHECK (processing_status IN ('pending', 'processing', 'processed', 'failed', 'skipped'))
                    )
                """)
                
                # Email communications indexes
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_email_comms_email_id ON email_communications(email_id)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_email_comms_thread_id ON email_communications(thread_id)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_email_comms_sender ON email_communications(sender)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_email_comms_email_date ON email_communications(email_date DESC)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_email_comms_email_type ON email_communications(email_type)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_email_comms_urgency ON email_communications(urgency)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_email_comms_processing_status ON email_communications(processing_status)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_email_comms_is_unread ON email_communications(is_unread) WHERE is_unread = true")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_email_comms_processed_at ON email_communications(processed_at DESC)")
                
                # Sync metadata indexes
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_sync_metadata_updated_at ON sync_metadata(updated_at DESC)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_sync_metadata_sync_status ON sync_metadata(sync_status)")
                
                logger.info("Database initialized successfully with PostgreSQL including jobs tables and email processing")
                
        except Exception as e:
            logger.error(f"Failed to initialize database: {e}")
            raise
    
    def create_session(self, company: str, role: str, job_description: str, analysis_data: Dict) -> str:
        """Create a new resume session"""
        session_id = str(uuid.uuid4())
        
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO resume_sessions (id, company, role, job_description, analysis_data)
                    VALUES (%s, %s, %s, %s, %s)
                """, (session_id, company, role, job_description, json.dumps(analysis_data)))
                
                logger.info(f"Created session {session_id} for {company} - {role}")
                return session_id
                
        except Exception as e:
            logger.error(f"Failed to create session: {e}")
            raise
    
    def get_session(self, session_id: str) -> Optional[Dict]:
        """Get session by ID"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
                cursor.execute("""
                    SELECT * FROM resume_sessions WHERE id = %s
                """, (session_id,))
                
                row = cursor.fetchone()
                if row:
                    result = dict(row)
                    result['analysis_data'] = json.loads(result['analysis_data'])
                    return result
                return None
                
        except Exception as e:
            logger.error(f"Failed to get session {session_id}: {e}")
            raise
    
    def update_session(self, session_id: str, analysis_data: Dict) -> bool:
        """Update session analysis data"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    UPDATE resume_sessions 
                    SET analysis_data = %s, updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                """, (json.dumps(analysis_data), session_id))
                
                success = cursor.rowcount > 0
                if success:
                    logger.info(f"Updated session {session_id}")
                return success
                
        except Exception as e:
            logger.error(f"Failed to update session {session_id}: {e}")
            raise
    
    def save_section_version(self, session_id: str, section_type: str, content: str, 
                           keywords: List[str], score: int = 0) -> str:
        """Save a new version of a resume section"""
        version_id = str(uuid.uuid4())
        
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                # Get next version number
                cursor.execute("""
                    SELECT COALESCE(MAX(version_number), 0) + 1 
                    FROM section_versions 
                    WHERE session_id = %s AND section_type = %s
                """, (session_id, section_type))
                
                version_number = cursor.fetchone()[0]
                
                cursor.execute("""
                    INSERT INTO section_versions 
                    (id, session_id, section_type, version_number, content, keywords, score)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                """, (version_id, session_id, section_type, version_number, content, 
                     json.dumps(keywords), score))
                
                logger.info(f"Saved {section_type} version {version_number} for session {session_id}")
                return version_id
                
        except Exception as e:
            logger.error(f"Failed to save section version: {e}")
            raise
    
    def get_section_versions(self, session_id: str, section_type: str) -> List[Dict]:
        """Get all versions of a section"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
                cursor.execute("""
                    SELECT * FROM section_versions 
                    WHERE session_id = %s AND section_type = %s
                    ORDER BY version_number DESC
                """, (session_id, section_type))
                
                rows = cursor.fetchall()
                results = []
                for row in rows:
                    result = dict(row)
                    result['keywords'] = json.loads(result['keywords'])
                    results.append(result)
                
                return results
                
        except Exception as e:
            logger.error(f"Failed to get section versions: {e}")
            raise
    
    def save_to_library(self, session_id: Optional[str], title: str, company: str, 
                       role: str, final_score: int, file_paths: Dict, tags: List[str]) -> str:
        """Save completed resume to library"""
        library_id = str(uuid.uuid4())
        
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO resume_library 
                    (id, session_id, title, company, role, final_score, file_paths, tags)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """, (library_id, session_id, title, company, role, final_score,
                     json.dumps(file_paths), json.dumps(tags)))
                
                logger.info(f"Saved resume {title} to library")
                return library_id
                
        except Exception as e:
            logger.error(f"Failed to save to library: {e}")
            raise
    
    def get_library_resumes(self, limit: int = 50, offset: int = 0) -> List[Dict]:
        """Get resumes from library with pagination"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
                cursor.execute("""
                    SELECT * FROM resume_library 
                    ORDER BY created_at DESC
                    LIMIT %s OFFSET %s
                """, (limit, offset))
                
                rows = cursor.fetchall()
                results = []
                for row in rows:
                    result = dict(row)
                    result['file_paths'] = json.loads(result['file_paths']) if result['file_paths'] else {}
                    result['tags'] = json.loads(result['tags']) if result['tags'] else []
                    results.append(result)
                
                return results
                
        except Exception as e:
            logger.error(f"Failed to get library resumes: {e}")
            raise
    
    def search_library(self, query: str, limit: int = 20) -> List[Dict]:
        """Search resumes by company, role, or title"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
                search_pattern = f"%{query}%"
                cursor.execute("""
                    SELECT * FROM resume_library 
                    WHERE title ILIKE %s OR company ILIKE %s OR role ILIKE %s
                    ORDER BY created_at DESC
                    LIMIT %s
                """, (search_pattern, search_pattern, search_pattern, limit))
                
                rows = cursor.fetchall()
                results = []
                for row in rows:
                    result = dict(row)
                    result['file_paths'] = json.loads(result['file_paths']) if result['file_paths'] else {}
                    result['tags'] = json.loads(result['tags']) if result['tags'] else []
                    results.append(result)
                
                return results
                
        except Exception as e:
            logger.error(f"Failed to search library: {e}")
            raise
    
    def delete_session(self, session_id: str) -> bool:
        """Delete session and all related data"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                # Delete section versions first (due to foreign key)
                cursor.execute("DELETE FROM section_versions WHERE session_id = %s", (session_id,))
                
                # Delete session
                cursor.execute("DELETE FROM resume_sessions WHERE id = %s", (session_id,))
                
                success = cursor.rowcount > 0
                if success:
                    logger.info(f"Deleted session {session_id}")
                return success
                
        except Exception as e:
            logger.error(f"Failed to delete session {session_id}: {e}")
            raise
    
    def delete_library_resume(self, resume_id: str) -> bool:
        """Delete resume from library"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("DELETE FROM resume_library WHERE id = %s", (resume_id,))
                
                success = cursor.rowcount > 0
                if success:
                    logger.info(f"Deleted library resume {resume_id}")
                return success
                
        except Exception as e:
            logger.error(f"Failed to delete library resume {resume_id}: {e}")
            raise