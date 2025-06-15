"""
SECURE DATABASE LAYER
Prevents SQL injection and implements security best practices
"""

import sqlite3
import psycopg2
import psycopg2.extras
import logging
import os
import hashlib
import secrets
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from contextlib import contextmanager

logger = logging.getLogger(__name__)
security_logger = logging.getLogger('security')

class SecureDatabase:
    """Secure database abstraction layer with SQL injection prevention"""
    
    def __init__(self, database_url: str = None):
        self.database_url = database_url or os.getenv('DATABASE_URL', 'sqlite:///resume_builder.db')
        self.is_postgres = self.database_url.startswith('postgresql://') or self.database_url.startswith('postgres://')
        
        if self.is_postgres:
            self.connection_params = self._parse_postgres_url(self.database_url)
        else:
            self.db_path = self.database_url.replace('sqlite:///', '')
    
    def _parse_postgres_url(self, url: str) -> Dict:
        """Parse PostgreSQL connection URL safely"""
        try:
            # Remove protocol
            url = url.replace('postgresql://', '').replace('postgres://', '')
            
            # Split user:pass@host:port/db
            user_pass, host_port_db = url.split('@')
            user, password = user_pass.split(':')
            
            host_port, database = host_port_db.split('/')
            if ':' in host_port:
                host, port = host_port.split(':')
            else:
                host, port = host_port, '5432'
            
            return {
                'host': host,
                'port': int(port),
                'database': database,
                'user': user,
                'password': password,
                'sslmode': 'require'  # Always require SSL
            }
        except Exception as e:
            logger.error(f"Error parsing database URL: {e}")
            raise ValueError("Invalid database URL")
    
    @contextmanager
    def get_connection(self):
        """Get secure database connection with proper error handling"""
        conn = None
        try:
            if self.is_postgres:
                conn = psycopg2.connect(**self.connection_params)
                conn.set_session(autocommit=False)
            else:
                conn = sqlite3.connect(
                    self.db_path,
                    check_same_thread=False,
                    timeout=30.0
                )
                conn.row_factory = sqlite3.Row
            
            yield conn
            
        except (psycopg2.Error, sqlite3.Error) as e:
            if conn:
                conn.rollback()
            logger.error(f"Database error: {e}")
            raise
        except Exception as e:
            if conn:
                conn.rollback()
            logger.error(f"Unexpected database error: {e}")
            raise
        finally:
            if conn:
                conn.close()
    
    def execute_query(self, query: str, params: Tuple = (), fetch: str = None) -> Optional[List]:
        """Execute parameterized query safely"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                # Log query (without parameters for security)
                logger.debug(f"Executing query: {query[:100]}...")
                
                cursor.execute(query, params)
                
                if fetch == 'one':
                    result = cursor.fetchone()
                elif fetch == 'all':
                    result = cursor.fetchall()
                else:
                    result = cursor.rowcount
                
                conn.commit()
                return result
                
        except Exception as e:
            logger.error(f"Query execution failed: {e}")
            raise
    
    def create_user_session(self, user_id: str, session_data: Dict) -> str:
        """Create secure user session with parameterized query"""
        session_id = secrets.token_hex(32)
        
        query = """
        INSERT INTO user_sessions (id, user_id, session_data, created_at, expires_at)
        VALUES (?, ?, ?, ?, datetime('now', '+24 hours'))
        """ if not self.is_postgres else """
        INSERT INTO user_sessions (id, user_id, session_data, created_at, expires_at)
        VALUES (%s, %s, %s, %s, NOW() + INTERVAL '24 hours')
        """
        
        params = (
            session_id,
            user_id,
            str(session_data),  # JSON serialized
            datetime.now().isoformat()
        )
        
        try:
            self.execute_query(query, params)
            security_logger.info(f"Session created for user {user_id}")
            return session_id
        except Exception as e:
            logger.error(f"Error creating session: {e}")
            raise
    
    def get_user_by_email(self, email: str) -> Optional[Dict]:
        """Get user by email with parameterized query"""
        query = """
        SELECT id, email, password_hash, is_active, created_at
        FROM users 
        WHERE email = ? AND is_active = 1
        """ if not self.is_postgres else """
        SELECT id, email, password_hash, is_active, created_at
        FROM users 
        WHERE email = %s AND is_active = true
        """
        
        try:
            result = self.execute_query(query, (email,), fetch='one')
            if result:
                return dict(result) if hasattr(result, 'keys') else result
            return None
        except Exception as e:
            logger.error(f"Error getting user: {e}")
            raise
    
    def create_job_analysis_session(self, user_id: str, company: str, role: str, 
                                  job_description: str, analysis: str) -> str:
        """Create job analysis session with secure parameterized query"""
        session_id = secrets.token_hex(32)
        
        # Input validation
        if len(company) > 100 or len(role) > 100 or len(job_description) > 50000:
            raise ValueError("Input exceeds maximum length")
        
        query = """
        INSERT INTO job_analysis_sessions 
        (id, user_id, company, role, job_description, analysis, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """ if not self.is_postgres else """
        INSERT INTO job_analysis_sessions 
        (id, user_id, company, role, job_description, analysis, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        """
        
        params = (
            session_id,
            user_id,
            company,
            role,
            job_description,
            analysis,
            datetime.now().isoformat()
        )
        
        try:
            self.execute_query(query, params)
            logger.info(f"Job analysis session created: {session_id}")
            return session_id
        except Exception as e:
            logger.error(f"Error creating job analysis session: {e}")
            raise
    
    def get_user_sessions(self, user_id: str, limit: int = 10) -> List[Dict]:
        """Get user's recent sessions with pagination"""
        if limit > 100:  # Prevent excessive data retrieval
            limit = 100
        
        query = """
        SELECT id, company, role, created_at
        FROM job_analysis_sessions 
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ?
        """ if not self.is_postgres else """
        SELECT id, company, role, created_at
        FROM job_analysis_sessions 
        WHERE user_id = %s
        ORDER BY created_at DESC
        LIMIT %s
        """
        
        try:
            results = self.execute_query(query, (user_id, limit), fetch='all')
            return [dict(row) if hasattr(row, 'keys') else row for row in results or []]
        except Exception as e:
            logger.error(f"Error getting user sessions: {e}")
            raise
    
    def hash_password(self, password: str) -> str:
        """Securely hash password with salt"""
        salt = secrets.token_hex(16)
        password_hash = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000)
        return f"{salt}:{password_hash.hex()}"
    
    def verify_password(self, password: str, stored_hash: str) -> bool:
        """Verify password against stored hash"""
        try:
            salt, hash_hex = stored_hash.split(':')
            password_hash = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000)
            return password_hash.hex() == hash_hex
        except (ValueError, AttributeError):
            return False
    
    def create_user(self, email: str, password: str) -> str:
        """Create new user with secure password hashing"""
        user_id = secrets.token_hex(16)
        password_hash = self.hash_password(password)
        
        query = """
        INSERT INTO users (id, email, password_hash, is_active, created_at)
        VALUES (?, ?, ?, 1, ?)
        """ if not self.is_postgres else """
        INSERT INTO users (id, email, password_hash, is_active, created_at)
        VALUES (%s, %s, %s, true, %s)
        """
        
        params = (
            user_id,
            email.lower().strip(),
            password_hash,
            datetime.now().isoformat()
        )
        
        try:
            self.execute_query(query, params)
            security_logger.info(f"User created: {email}")
            return user_id
        except Exception as e:
            logger.error(f"Error creating user: {e}")
            raise
    
    def log_security_event(self, event_type: str, user_id: str = None, 
                          ip_address: str = None, details: str = None):
        """Log security events for monitoring"""
        query = """
        INSERT INTO security_logs (event_type, user_id, ip_address, details, timestamp)
        VALUES (?, ?, ?, ?, ?)
        """ if not self.is_postgres else """
        INSERT INTO security_logs (event_type, user_id, ip_address, details, timestamp)
        VALUES (%s, %s, %s, %s, %s)
        """
        
        params = (
            event_type,
            user_id,
            ip_address,
            details,
            datetime.now().isoformat()
        )
        
        try:
            self.execute_query(query, params)
        except Exception as e:
            logger.error(f"Error logging security event: {e}")
    
    def cleanup_expired_sessions(self):
        """Clean up expired sessions"""
        query = """
        DELETE FROM user_sessions 
        WHERE expires_at < ?
        """ if not self.is_postgres else """
        DELETE FROM user_sessions 
        WHERE expires_at < NOW()
        """
        
        try:
            if not self.is_postgres:
                count = self.execute_query(query, (datetime.now().isoformat(),))
            else:
                count = self.execute_query(query)
            logger.info(f"Cleaned up {count} expired sessions")
        except Exception as e:
            logger.error(f"Error cleaning up sessions: {e}")

# Create secure database tables
SECURE_SCHEMA_SQL = """
-- Users table with security features
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(32) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

-- User sessions for tracking
CREATE TABLE IF NOT EXISTS user_sessions (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(32) REFERENCES users(id),
    session_data TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT
);

-- Job analysis sessions with user association
CREATE TABLE IF NOT EXISTS job_analysis_sessions (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(32) REFERENCES users(id),
    company VARCHAR(100) NOT NULL,
    role VARCHAR(100) NOT NULL,
    job_description TEXT NOT NULL,
    analysis TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Security event logging
CREATE TABLE IF NOT EXISTS security_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type VARCHAR(50) NOT NULL,
    user_id VARCHAR(32),
    ip_address VARCHAR(45),
    details TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_analysis_user_id ON job_analysis_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_security_logs_timestamp ON security_logs(timestamp);
"""