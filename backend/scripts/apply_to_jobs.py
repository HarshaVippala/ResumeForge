#!/usr/bin/env python3
"""
Apply to Jobs - Convert scraped jobs to job applications
This script takes some scraped jobs and creates job applications from them
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime, timedelta
import random
from services.database import DatabaseManager
from services.supabase_manager import SupabaseDatabaseManager
from config.database_config import db_config

# Initialize database manager
if db_config.is_postgresql():
    db_manager = SupabaseDatabaseManager()
else:
    db_manager = DatabaseManager()

def apply_to_jobs():
    """Take some scraped jobs and create job applications from them"""
    
    print("Fetching scraped jobs...")
    
    # Get some recent scraped jobs
    jobs_query = """
    SELECT 
        job_id, title, company, location, remote, 
        salary_min, salary_max, description, application_url
    FROM jobs 
    WHERE is_active = true
    ORDER BY scraped_at DESC
    LIMIT 10
    """
    
    jobs = db_manager.execute_query(jobs_query, [])
    
    if not jobs:
        print("No scraped jobs found. Please run job scraping first.")
        return
    
    print(f"Found {len(jobs)} jobs. Creating applications for some of them...")
    
    # Select 3-5 random jobs to apply to
    selected_jobs = random.sample(jobs, min(5, len(jobs)))
    
    # Application statuses to use
    statuses = ['applied', 'phone_screen', 'interview', 'applied', 'applied']
    
    for i, job in enumerate(selected_jobs):
        # First, check if company exists, if not create it
        company_query = "SELECT id FROM companies WHERE name = %s"
        company_result = db_manager.execute_query(company_query, [job['company']])
        
        if company_result:
            company_id = company_result[0]['id']
        else:
            # Create the company
            print(f"Creating company: {job['company']}")
            if db_config.is_postgresql():
                # PostgreSQL with RETURNING
                insert_result = db_manager.execute_query(
                    "INSERT INTO companies (name) VALUES (%s) RETURNING id",
                    [job['company']]
                )
                if insert_result and len(insert_result) > 0:
                    company_id = insert_result[0]['id']
                else:
                    # Fallback: query for the inserted company
                    company_result = db_manager.execute_query(company_query, [job['company']])
                    company_id = company_result[0]['id'] if company_result else None
            else:
                # SQLite
                db_manager.execute_query(
                    "INSERT INTO companies (name) VALUES (?)",
                    [job['company']]
                )
                company_result = db_manager.execute_query(
                    "SELECT id FROM companies WHERE name = ?",
                    [job['company']]
                )
                company_id = company_result[0]['id'] if company_result else None
        
        if not company_id:
            print(f"Failed to get company ID for {job['company']}")
            continue
        
        # Check if application already exists
        existing_app = db_manager.execute_query(
            "SELECT id FROM job_opportunities WHERE job_id = %s",
            [job['job_id']]
        )
        
        if existing_app:
            print(f"Application for {job['title']} at {job['company']} already exists")
            continue
        
        # Create the job application
        app_data = {
            'company_id': company_id,
            'title': job['title'],
            'job_id': job['job_id'],
            'status': statuses[i % len(statuses)],
            'priority': random.choice(['high', 'medium', 'low']),
            'description': job['description'][:500] if job['description'] else 'No description available',
            'salary_range': f"${job['salary_min']//1000}K - ${job['salary_max']//1000}K" if job['salary_min'] and job['salary_max'] else None,
            'location': job['location'] or 'Not specified',
            'location_type': 'remote' if job['remote'] else 'onsite',
            'application_date': (datetime.now() - timedelta(days=random.randint(0, 7))).date(),
            'source': 'company_website',
            'notes': f"Applied to this position on {datetime.now().strftime('%Y-%m-%d')}"
        }
        
        # Insert the application
        insert_query = """
        INSERT INTO job_opportunities 
        (company_id, title, job_id, status, priority,
         description, salary_range, location, location_type, 
         application_date, source, notes)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        
        params = [
            app_data['company_id'], app_data['title'], app_data['job_id'],
            app_data['status'], app_data['priority'],
            app_data['description'], app_data['salary_range'], app_data['location'],
            app_data['location_type'], app_data['application_date'], app_data['source'],
            app_data['notes']
        ]
        
        # Use ? for SQLite, %s for PostgreSQL
        if not db_config.is_postgresql():
            insert_query = insert_query.replace('%s', '?')
        
        try:
            db_manager.execute_query(insert_query, params)
            print(f"Created application: {app_data['title']} at {job['company']} (Status: {app_data['status']})")
        except Exception as e:
            print(f"Failed to create application for {app_data['title']}: {e}")
    
    print("\nJob applications created successfully!")
    print("\nRefresh the Job Tracker page to see the applications.")

if __name__ == '__main__':
    try:
        apply_to_jobs()
    except Exception as e:
        print(f"Error creating job applications: {e}")
        import traceback
        traceback.print_exc()