#!/usr/bin/env python3
"""
Create Sample Job Applications
This script creates sample job applications in the database for testing
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime, timedelta
from services.database import DatabaseManager
from services.supabase_manager import SupabaseDatabaseManager
from config.database_config import db_config

# Initialize database manager
if db_config.is_postgresql():
    db_manager = SupabaseDatabaseManager()
else:
    db_manager = DatabaseManager()

def create_sample_data():
    """Create sample companies and job applications"""
    
    print("Creating sample companies...")
    
    # Create sample companies
    companies = [
        {
            'name': 'Meta',
            'domain': 'meta.com',
            'industry': 'Technology',
            'size': '10000+',
            'location': 'Menlo Park, CA',
            'website': 'https://meta.com'
        },
        {
            'name': 'Apple',
            'domain': 'apple.com',
            'industry': 'Technology',
            'size': '10000+',
            'location': 'Cupertino, CA',
            'website': 'https://apple.com'
        },
        {
            'name': 'Microsoft',
            'domain': 'microsoft.com',
            'industry': 'Technology',
            'size': '10000+',
            'location': 'Redmond, WA',
            'website': 'https://microsoft.com'
        }
    ]
    
    company_ids = {}
    for company in companies:
        # Check if company already exists
        existing = db_manager.execute_query(
            "SELECT id FROM companies WHERE name = %s",
            [company['name']]
        )
        
        if existing:
            company_ids[company['name']] = existing[0]['id']
            print(f"Company {company['name']} already exists")
        else:
            # For SQLite, we need to insert and then get the last insert ID
            if db_config.is_postgresql():
                result = db_manager.execute_query(
                    """INSERT INTO companies (name, domain, industry, size, location, website)
                       VALUES (%s, %s, %s, %s, %s, %s) RETURNING id""",
                    [company['name'], company['domain'], company['industry'], 
                     company['size'], company['location'], company['website']]
                )
                company_ids[company['name']] = result[0]['id']
            else:
                # SQLite doesn't support RETURNING, so we insert then query
                db_manager.execute_query(
                    """INSERT INTO companies (name, domain, industry, size, location, website)
                       VALUES (?, ?, ?, ?, ?, ?)""",
                    [company['name'], company['domain'], company['industry'], 
                     company['size'], company['location'], company['website']]
                )
                # Get the last inserted ID
                result = db_manager.execute_query(
                    "SELECT id FROM companies WHERE name = ?",
                    [company['name']]
                )
                company_ids[company['name']] = result[0]['id']
            print(f"Created company: {company['name']}")
    
    print("\nCreating sample job applications...")
    
    # Create sample job applications
    applications = [
        {
            'company_id': company_ids['Meta'],
            'title': 'Senior Software Engineer - Reality Labs',
            'job_id': 'META-2024-001',
            'application_type': 'direct_application',
            'status': 'interview',
            'priority': 'high',
            'description': 'Build cutting-edge AR/VR experiences',
            'salary_range': '$200K - $300K',
            'location': 'Menlo Park, CA',
            'remote_option': True,
            'application_date': (datetime.now() - timedelta(days=5)).date(),
            'source': 'company_website',
            'application_url': 'https://careers.meta.com/jobs/001',
            'notes': 'Strong match with my VR experience'
        },
        {
            'company_id': company_ids['Apple'],
            'title': 'iOS Engineer - Apple TV+',
            'job_id': 'APPLE-2024-002',
            'application_type': 'recruiter_outreach',
            'status': 'phone_screen',
            'priority': 'high',
            'description': 'Work on the Apple TV+ streaming platform',
            'salary_range': '$180K - $250K',
            'location': 'Cupertino, CA',
            'remote_option': False,
            'application_date': (datetime.now() - timedelta(days=3)).date(),
            'source': 'recruiter',
            'notes': 'Recruiter reached out via LinkedIn'
        },
        {
            'company_id': company_ids['Microsoft'],
            'title': 'Principal Engineer - Azure',
            'job_id': 'MSFT-2024-003',
            'application_type': 'direct_application',
            'status': 'applied',
            'priority': 'medium',
            'description': 'Lead Azure infrastructure development',
            'salary_range': '$220K - $320K',
            'location': 'Redmond, WA',
            'remote_option': True,
            'application_date': datetime.now().date(),
            'source': 'linkedin',
            'application_url': 'https://careers.microsoft.com/jobs/003',
            'notes': 'Applied through LinkedIn Easy Apply'
        }
    ]
    
    for app in applications:
        # Check if application already exists
        existing = db_manager.execute_query(
            "SELECT id FROM job_opportunities WHERE job_id = %s",
            [app['job_id']]
        )
        
        if existing:
            print(f"Application for {app['title']} already exists")
        else:
            if db_config.is_postgresql():
                result = db_manager.execute_query(
                    """INSERT INTO job_opportunities 
                       (company_id, title, job_id, application_type, status, priority,
                        description, salary_range, location, remote_option, 
                        application_date, source, application_url, notes)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                       RETURNING id""",
                    [app['company_id'], app['title'], app['job_id'], app['application_type'],
                     app['status'], app['priority'], app['description'], app['salary_range'],
                     app['location'], app['remote_option'], app['application_date'],
                     app['source'], app.get('application_url'), app['notes']]
                )
            else:
                # SQLite version
                db_manager.execute_query(
                    """INSERT INTO job_opportunities 
                       (company_id, title, job_id, application_type, status, priority,
                        description, salary_range, location, remote_option, 
                        application_date, source, application_url, notes)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    [app['company_id'], app['title'], app['job_id'], app['application_type'],
                     app['status'], app['priority'], app['description'], app['salary_range'],
                     app['location'], app['remote_option'], app['application_date'],
                     app['source'], app.get('application_url'), app['notes']]
                )
            print(f"Created application: {app['title']}")
    
    print("\nSample data created successfully!")
    print("\nYou can now refresh the Job Tracker page to see the real applications.")

if __name__ == '__main__':
    try:
        create_sample_data()
    except Exception as e:
        print(f"Error creating sample data: {e}")
        import traceback
        traceback.print_exc()