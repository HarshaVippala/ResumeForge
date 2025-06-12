"""
Database configuration for Resume Builder
Supports both SQLite (local development) and PostgreSQL (Supabase production)
"""

import os
from typing import Optional
from dotenv import load_dotenv

# Load environment variables at module import
load_dotenv()

class DatabaseConfig:
    """Database configuration manager"""
    
    def __init__(self):
        self.environment = os.getenv('ENVIRONMENT', 'development')
        self.database_url = os.getenv('DATABASE_URL')
        
    def get_database_url(self) -> str:
        """Get appropriate database URL based on environment"""
        if self.database_url:
            return self.database_url
        
        # Default to SQLite for local development
        return "sqlite:///resume_builder.db"
    
    def is_postgresql(self) -> bool:
        """Check if using PostgreSQL (Supabase)"""
        url = self.get_database_url()
        return url.startswith('postgresql://') or url.startswith('postgres://')
    
    def is_sqlite(self) -> bool:
        """Check if using SQLite"""
        url = self.get_database_url()
        return url.startswith('sqlite:///')

# Global config instance
db_config = DatabaseConfig()