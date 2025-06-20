#!/usr/bin/env python3
"""
Initialize authentication database schema
Run this script to set up the secure authentication database
"""

import os
import sys
import sqlite3
import logging
from datetime import datetime
from dotenv import load_dotenv
from secure_database import SecureDatabase

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def init_auth_database():
    """Initialize the authentication database with secure schema"""
    try:
        # Initialize secure database
        secure_db = SecureDatabase()
        
        # Create tables using the secure schema
        with secure_db.get_connection() as conn:
            cursor = conn.cursor()
            
            # PostgreSQL compatible schema
            schema_sql = """
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

            -- Security event logging (PostgreSQL uses SERIAL, SQLite uses AUTOINCREMENT)
            CREATE TABLE IF NOT EXISTS security_logs (
                id SERIAL PRIMARY KEY,
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
            
            # Execute the secure schema SQL
            for statement in schema_sql.split(';'):
                statement = statement.strip()
                if statement:
                    cursor.execute(statement)
            
            conn.commit()
            logger.info("✅ Authentication database schema created successfully")
        
        # Create a default admin user for testing
        try:
            admin_email = "admin@jobtracker.dev"
            admin_password = "Admin123!"  # Change this in production
            
            # Check if admin user already exists
            existing_admin = secure_db.get_user_by_email(admin_email)
            if not existing_admin:
                admin_id = secure_db.create_user(admin_email, admin_password)
                
                # Update user to be admin
                with secure_db.get_connection() as conn:
                    cursor = conn.cursor()
                    if secure_db.is_postgres:
                        cursor.execute(
                            "UPDATE users SET is_admin = %s WHERE id = %s",
                            (True, admin_id)
                        )
                    else:
                        cursor.execute(
                            "UPDATE users SET is_admin = ? WHERE id = ?",
                            (True, admin_id)
                        )
                    conn.commit()
                
                logger.info(f"✅ Admin user created: {admin_email}")
                logger.info(f"🔑 Admin password: {admin_password}")
                logger.info("⚠️  Please change the admin password in production!")
            else:
                logger.info("ℹ️  Admin user already exists")
                
        except Exception as e:
            logger.error(f"Error creating admin user: {e}")
        
        # Test the authentication system
        try:
            from middleware.secure_auth import auth
            
            # Test JWT token generation
            test_token = auth.generate_token({
                'id': 'test-user-id',
                'email': 'test@example.com'
            })
            
            # Test token verification
            payload = auth.verify_token(test_token)
            if payload and payload.get('email') == 'test@example.com':
                logger.info("✅ JWT authentication system working correctly")
            else:
                logger.error("❌ JWT authentication test failed")
                
        except Exception as e:
            logger.error(f"JWT authentication test failed: {e}")
        
        logger.info("\n🎉 Authentication system initialized successfully!")
        logger.info("📋 Next steps:")
        logger.info("1. Set JWT_SECRET environment variable")
        logger.info("2. Update API endpoints to use @require_auth decorator")
        logger.info("3. Test login functionality")
        
    except Exception as e:
        logger.error(f"❌ Failed to initialize authentication database: {e}")
        sys.exit(1)

if __name__ == "__main__":
    init_auth_database()