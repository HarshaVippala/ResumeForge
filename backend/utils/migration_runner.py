#!/usr/bin/env python3
"""
Database Migration Runner
Handles running SQL migrations safely with rollback capabilities
"""

import os
import psycopg2
import logging
from typing import List, Dict, Any
from pathlib import Path
from datetime import datetime
from services.supabase_manager import SupabaseDatabaseManager

logger = logging.getLogger(__name__)

class MigrationRunner:
    """Handles database migrations with proper tracking and rollback"""
    
    def __init__(self, db_manager: SupabaseDatabaseManager):
        self.db_manager = db_manager
        self.migrations_dir = Path(__file__).parent.parent / 'migrations'
        
    def init_migration_table(self):
        """Create migrations tracking table if it doesn't exist"""
        query = """
        CREATE TABLE IF NOT EXISTS schema_migrations (
            id SERIAL PRIMARY KEY,
            migration_name VARCHAR(255) UNIQUE NOT NULL,
            executed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            checksum VARCHAR(64),
            success BOOLEAN DEFAULT true,
            error_message TEXT
        );
        """
        
        try:
            with self.db_manager.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(query)
                logger.info("Migration tracking table initialized")
        except Exception as e:
            logger.error(f"Failed to initialize migration table: {e}")
            raise
    
    def get_executed_migrations(self) -> List[str]:
        """Get list of already executed migrations"""
        query = "SELECT migration_name FROM schema_migrations WHERE success = true"
        
        try:
            with self.db_manager.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(query)
                return [row[0] for row in cursor.fetchall()]
        except Exception as e:
            logger.error(f"Failed to get executed migrations: {e}")
            return []
    
    def get_migration_files(self) -> List[str]:
        """Get sorted list of migration files"""
        if not self.migrations_dir.exists():
            logger.warning(f"Migrations directory {self.migrations_dir} does not exist")
            return []
        
        migration_files = []
        for file in self.migrations_dir.glob('*.sql'):
            migration_files.append(file.name)
        
        return sorted(migration_files)
    
    def calculate_checksum(self, content: str) -> str:
        """Calculate MD5 checksum of migration content"""
        import hashlib
        return hashlib.md5(content.encode()).hexdigest()
    
    def execute_migration(self, migration_file: str) -> bool:
        """Execute a single migration file"""
        migration_path = self.migrations_dir / migration_file
        
        if not migration_path.exists():
            logger.error(f"Migration file {migration_file} not found")
            return False
        
        try:
            # Read migration content
            with open(migration_path, 'r') as f:
                migration_content = f.read()
            
            checksum = self.calculate_checksum(migration_content)
            
            logger.info(f"Executing migration: {migration_file}")
            
            with self.db_manager.get_connection() as conn:
                cursor = conn.cursor()
                
                # Execute the migration
                cursor.execute(migration_content)
                
                # Record successful migration
                cursor.execute("""
                    INSERT INTO schema_migrations (migration_name, checksum, success) 
                    VALUES (%s, %s, %s)
                    ON CONFLICT (migration_name) DO UPDATE SET
                        executed_at = CURRENT_TIMESTAMP,
                        checksum = EXCLUDED.checksum,
                        success = EXCLUDED.success,
                        error_message = NULL
                """, (migration_file, checksum, True))
                
                logger.info(f"Successfully executed migration: {migration_file}")
                return True
                
        except Exception as e:
            error_msg = str(e)
            logger.error(f"Failed to execute migration {migration_file}: {error_msg}")
            
            # Record failed migration
            try:
                with self.db_manager.get_connection() as conn:
                    cursor = conn.cursor()
                    cursor.execute("""
                        INSERT INTO schema_migrations (migration_name, success, error_message) 
                        VALUES (%s, %s, %s)
                        ON CONFLICT (migration_name) DO UPDATE SET
                            executed_at = CURRENT_TIMESTAMP,
                            success = EXCLUDED.success,
                            error_message = EXCLUDED.error_message
                    """, (migration_file, False, error_msg))
            except Exception as record_error:
                logger.error(f"Failed to record migration failure: {record_error}")
            
            return False
    
    def run_pending_migrations(self) -> Dict[str, Any]:
        """Run all pending migrations"""
        self.init_migration_table()
        
        executed_migrations = set(self.get_executed_migrations())
        available_migrations = self.get_migration_files()
        
        pending_migrations = [
            m for m in available_migrations 
            if m not in executed_migrations
        ]
        
        if not pending_migrations:
            logger.info("No pending migrations to execute")
            return {
                'success': True,
                'message': 'No pending migrations',
                'executed': [],
                'failed': []
            }
        
        logger.info(f"Found {len(pending_migrations)} pending migrations")
        
        executed = []
        failed = []
        
        for migration in pending_migrations:
            if self.execute_migration(migration):
                executed.append(migration)
            else:
                failed.append(migration)
                break  # Stop on first failure
        
        success = len(failed) == 0
        
        return {
            'success': success,
            'message': f"Executed {len(executed)} migrations" + (
                f", {len(failed)} failed" if failed else ""
            ),
            'executed': executed,
            'failed': failed
        }
    
    def get_migration_status(self) -> Dict[str, Any]:
        """Get status of all migrations"""
        self.init_migration_table()
        
        query = """
        SELECT migration_name, executed_at, success, error_message 
        FROM schema_migrations 
        ORDER BY migration_name
        """
        
        try:
            with self.db_manager.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(query)
                migrations = cursor.fetchall()
                
                return {
                    'total_migrations': len(migrations),
                    'successful': len([m for m in migrations if m[2]]),
                    'failed': len([m for m in migrations if not m[2]]),
                    'migrations': [
                        {
                            'name': m[0],
                            'executed_at': m[1].isoformat() if m[1] else None,
                            'success': m[2],
                            'error': m[3]
                        }
                        for m in migrations
                    ]
                }
        except Exception as e:
            logger.error(f"Failed to get migration status: {e}")
            return {'error': str(e)}

def main():
    """CLI interface for migration runner"""
    import sys
    from services.database import DatabaseManager
    from services.supabase_manager import SupabaseDatabaseManager
    from config.database_config import db_config
    
    # Initialize appropriate database manager
    if db_config.is_postgresql():
        db_manager = SupabaseDatabaseManager()
        print("Using Supabase PostgreSQL database")
    else:
        print("Migrations only supported for PostgreSQL databases")
        sys.exit(1)
    
    runner = MigrationRunner(db_manager)
    
    if len(sys.argv) > 1:
        command = sys.argv[1]
        
        if command == 'status':
            status = runner.get_migration_status()
            print(f"Migration Status:")
            print(f"  Total: {status.get('total_migrations', 0)}")
            print(f"  Successful: {status.get('successful', 0)}")
            print(f"  Failed: {status.get('failed', 0)}")
            
            if 'migrations' in status:
                print("\nMigrations:")
                for migration in status['migrations']:
                    status_icon = "✅" if migration['success'] else "❌"
                    print(f"  {status_icon} {migration['name']} - {migration['executed_at']}")
                    if migration['error']:
                        print(f"      Error: {migration['error']}")
        
        elif command == 'run':
            result = runner.run_pending_migrations()
            print(f"Migration Result: {result['message']}")
            
            if result['executed']:
                print("Executed migrations:")
                for migration in result['executed']:
                    print(f"  ✅ {migration}")
            
            if result['failed']:
                print("Failed migrations:")
                for migration in result['failed']:
                    print(f"  ❌ {migration}")
                sys.exit(1)
        
        else:
            print("Usage: python migration_runner.py [status|run]")
            sys.exit(1)
    else:
        print("Usage: python migration_runner.py [status|run]")
        sys.exit(1)

if __name__ == '__main__':
    main()