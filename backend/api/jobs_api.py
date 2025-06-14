"""
Jobs API Endpoints
Handles job-related API routes for scraping, searching, and managing job postings
"""

import logging
import json
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from flask import Blueprint, request, jsonify
from services.job_scraper import JobScrapingService
from services.database import DatabaseManager
from services.supabase_manager import SupabaseDatabaseManager
from config.database_config import db_config

logger = logging.getLogger(__name__)

# Create Blueprint for jobs API
jobs_bp = Blueprint('jobs', __name__)

# Initialize services
job_scraper = JobScrapingService()

if db_config.is_postgresql():
    db_manager = SupabaseDatabaseManager()
else:
    db_manager = DatabaseManager()

@jobs_bp.route('/api/jobs', methods=['GET'])
def get_jobs():
    """
    Get jobs with filtering, searching, and pagination
    
    Query Parameters:
    - page: Page number (default: 1)
    - limit: Jobs per page (default: 20, max: 100)
    - search: Search query for title/company/description
    - company: Filter by company
    - location: Filter by location
    - remote: Filter remote jobs (true/false)
    - salary_min: Minimum salary filter
    - salary_max: Maximum salary filter
    - experience_level: Filter by experience level
    - platform: Filter by platform
    - job_type: Filter by job type
    - date_posted: Filter by date (1d, 7d, 30d)
    - sort_by: Sort field (date, salary, company)
    - sort_order: Sort order (asc, desc)
    """
    
    try:
        # Parse query parameters
        page = int(request.args.get('page', 1))
        limit = min(int(request.args.get('limit', 20)), 100)
        offset = (page - 1) * limit
        
        search = request.args.get('search', '').strip()
        company = request.args.get('company', '').strip()
        location = request.args.get('location', '').strip()
        remote = request.args.get('remote')
        salary_min = request.args.get('salary_min')
        salary_max = request.args.get('salary_max')
        experience_level = request.args.get('experience_level')
        platform = request.args.get('platform')
        job_type = request.args.get('job_type')
        date_posted = request.args.get('date_posted')
        sort_by = request.args.get('sort_by', 'date_posted')
        sort_order = request.args.get('sort_order', 'desc')
        
        # Build WHERE clause
        where_conditions = ["is_active = true"]
        params = []
        
        # Search across multiple fields
        if search:
            where_conditions.append("""
                (title ILIKE %s OR company ILIKE %s OR description ILIKE %s 
                 OR array_to_string(skills, ' ') ILIKE %s)
            """)
            search_term = f"%{search}%"
            params.extend([search_term, search_term, search_term, search_term])
        
        # Company filter
        if company:
            where_conditions.append("company ILIKE %s")
            params.append(f"%{company}%")
        
        # Location filter
        if location:
            where_conditions.append("location ILIKE %s")
            params.append(f"%{location}%")
        
        # Remote filter
        if remote is not None:
            where_conditions.append("remote = %s")
            params.append(remote.lower() == 'true')
        
        # Salary filters
        if salary_min:
            where_conditions.append("salary_min >= %s")
            params.append(int(salary_min))
        
        if salary_max:
            where_conditions.append("salary_max <= %s")
            params.append(int(salary_max))
        
        # Experience level filter
        if experience_level:
            where_conditions.append("experience_level = %s")
            params.append(experience_level)
        
        # Platform filter
        if platform:
            where_conditions.append("platform = %s")
            params.append(platform)
        
        # Job type filter
        if job_type:
            where_conditions.append("job_type = %s")
            params.append(job_type)
        
        # Date posted filter
        if date_posted:
            if date_posted == '1d':
                where_conditions.append("date_posted >= NOW() - INTERVAL '1 day'")
            elif date_posted == '7d':
                where_conditions.append("date_posted >= NOW() - INTERVAL '7 days'")
            elif date_posted == '30d':
                where_conditions.append("date_posted >= NOW() - INTERVAL '30 days'")
        
        # Build ORDER BY clause
        valid_sort_fields = {
            'date': 'date_posted',
            'date_posted': 'date_posted',
            'salary': 'salary_min',
            'company': 'company',
            'title': 'title'
        }
        
        sort_field = valid_sort_fields.get(sort_by, 'date_posted')
        sort_direction = 'ASC' if sort_order.lower() == 'asc' else 'DESC'
        
        # Construct query
        where_clause = " AND ".join(where_conditions)
        
        # Main query for jobs
        jobs_query = f"""
        SELECT 
            id, job_id, title, company, location, remote, job_type,
            salary_min, salary_max, salary_currency, description,
            application_url, company_logo_url, platform, date_posted,
            skills, experience_level, scraped_at
        FROM jobs 
        WHERE {where_clause}
        ORDER BY {sort_field} {sort_direction}
        LIMIT %s OFFSET %s
        """
        
        # Count query for pagination
        count_query = f"SELECT COUNT(*) as total FROM jobs WHERE {where_clause}"
        
        # Execute queries
        jobs = db_manager.execute_query(jobs_query, params + [limit, offset])
        total_result = db_manager.execute_query(count_query, params)
        total_jobs = total_result[0]['total'] if total_result else 0
        
        # Process jobs data
        processed_jobs = []
        for job in jobs:
            processed_job = dict(job)
            
            # Format dates
            if processed_job.get('date_posted'):
                processed_job['date_posted'] = processed_job['date_posted'].isoformat()
            if processed_job.get('scraped_at'):
                processed_job['scraped_at'] = processed_job['scraped_at'].isoformat()
            
            # Truncate description for list view
            if processed_job.get('description'):
                processed_job['description_preview'] = processed_job['description'][:300] + "..."
            
            processed_jobs.append(processed_job)
        
        # Calculate pagination info
        total_pages = (total_jobs + limit - 1) // limit
        has_next = page < total_pages
        has_prev = page > 1
        
        return jsonify({
            'success': True,
            'jobs': processed_jobs,
            'pagination': {
                'current_page': page,
                'total_pages': total_pages,
                'total_jobs': total_jobs,
                'jobs_per_page': limit,
                'has_next': has_next,
                'has_prev': has_prev
            }
        })
        
    except Exception as e:
        logger.error(f"Error fetching jobs: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@jobs_bp.route('/api/jobs/<job_id>', methods=['GET'])
def get_job_details(job_id):
    """Get detailed information for a specific job"""
    
    try:
        job_query = """
        SELECT * FROM jobs 
        WHERE (id = %s OR job_id = %s) AND is_active = true
        """
        
        jobs = db_manager.execute_query(job_query, [job_id, job_id])
        
        if not jobs:
            return jsonify({'success': False, 'error': 'Job not found'}), 404
        
        job = dict(jobs[0])
        
        # Format dates
        if job.get('date_posted'):
            job['date_posted'] = job['date_posted'].isoformat()
        if job.get('scraped_at'):
            job['scraped_at'] = job['scraped_at'].isoformat()
        if job.get('updated_at'):
            job['updated_at'] = job['updated_at'].isoformat()
        
        return jsonify({
            'success': True,
            'job': job
        })
        
    except Exception as e:
        logger.error(f"Error fetching job details: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@jobs_bp.route('/api/jobs/scrape', methods=['POST'])
def trigger_job_scraping():
    """
    Manually trigger job scraping
    
    Body Parameters:
    - platforms: List of platforms to scrape (optional)
    - search_term: Search term override (optional)
    - location: Location override (optional)
    - results_wanted: Number of results per platform (optional)
    """
    
    try:
        data = request.get_json() or {}
        
        # Extract configuration
        custom_config = {}
        if 'search_term' in data:
            custom_config['search_term'] = data['search_term']
        if 'location' in data:
            custom_config['location'] = data['location']
        if 'results_wanted' in data:
            custom_config['results_wanted'] = min(int(data['results_wanted']), 200)
        
        target_platforms = data.get('platforms')
        
        # Perform scraping
        logger.info("Manual job scraping triggered")
        results = job_scraper.scrape_jobs_for_software_engineering(
            custom_config=custom_config,
            target_platforms=target_platforms
        )
        
        return jsonify({
            'success': True,
            'message': 'Job scraping completed',
            'results': results
        })
        
    except Exception as e:
        logger.error(f"Error during manual scraping: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@jobs_bp.route('/api/jobs/stats', methods=['GET'])
def get_job_statistics():
    """Get job statistics and scraping information"""
    
    try:
        stats = job_scraper.get_scraping_statistics()
        
        # Get additional statistics
        additional_stats_query = """
        SELECT 
            COUNT(*) as total_active_jobs,
            COUNT(DISTINCT company) as unique_companies,
            COUNT(DISTINCT platform) as platforms_used,
            AVG(salary_min) as avg_salary_min,
            AVG(salary_max) as avg_salary_max,
            COUNT(*) FILTER (WHERE remote = true) as remote_jobs_count,
            COUNT(*) FILTER (WHERE date_posted >= NOW() - INTERVAL '24 hours') as jobs_last_24h,
            COUNT(*) FILTER (WHERE date_posted >= NOW() - INTERVAL '7 days') as jobs_last_week
        FROM jobs 
        WHERE is_active = true
        """
        
        additional_stats = db_manager.execute_query(additional_stats_query)
        
        if additional_stats:
            stats.update(additional_stats[0])
        
        # Get top companies
        top_companies_query = """
        SELECT company, COUNT(*) as job_count
        FROM jobs 
        WHERE is_active = true
        GROUP BY company 
        ORDER BY job_count DESC 
        LIMIT 10
        """
        
        top_companies = db_manager.execute_query(top_companies_query)
        stats['top_companies'] = top_companies
        
        # Get experience level distribution
        experience_dist_query = """
        SELECT experience_level, COUNT(*) as count
        FROM jobs 
        WHERE is_active = true
        GROUP BY experience_level
        ORDER BY count DESC
        """
        
        experience_dist = db_manager.execute_query(experience_dist_query)
        stats['experience_distribution'] = experience_dist
        
        return jsonify({
            'success': True,
            'statistics': stats
        })
        
    except Exception as e:
        logger.error(f"Error getting job statistics: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@jobs_bp.route('/api/jobs/save', methods=['POST'])
def save_job():
    """
    Save a job for user
    
    Body Parameters:
    - job_id: Job ID to save
    - user_email: User identifier
    - notes: Optional notes
    """
    
    try:
        data = request.get_json()
        
        if not data or 'job_id' not in data or 'user_email' not in data:
            return jsonify({'success': False, 'error': 'job_id and user_email required'}), 400
        
        job_id = data['job_id']
        user_email = data['user_email']
        notes = data.get('notes', '')
        
        # Check if job exists
        job_exists = db_manager.execute_query(
            "SELECT id FROM jobs WHERE (id = %s OR job_id = %s) AND is_active = true",
            [job_id, job_id]
        )
        
        if not job_exists:
            return jsonify({'success': False, 'error': 'Job not found'}), 404
        
        # Get actual job UUID
        actual_job_id = job_exists[0]['id']
        
        # Insert or update saved job
        save_query = """
        INSERT INTO saved_jobs (user_email, job_id, notes)
        VALUES (%s, %s, %s)
        ON CONFLICT (user_email, job_id) 
        DO UPDATE SET notes = EXCLUDED.notes, saved_at = NOW()
        """
        
        db_manager.execute_query(save_query, [user_email, actual_job_id, notes])
        
        return jsonify({
            'success': True,
            'message': 'Job saved successfully'
        })
        
    except Exception as e:
        logger.error(f"Error saving job: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@jobs_bp.route('/api/jobs/saved', methods=['GET'])
def get_saved_jobs():
    """Get user's saved jobs"""
    
    try:
        user_email = request.args.get('user_email')
        
        if not user_email:
            return jsonify({'success': False, 'error': 'user_email parameter required'}), 400
        
        saved_jobs_query = """
        SELECT 
            j.*, 
            sj.saved_at, 
            sj.notes, 
            sj.status
        FROM saved_jobs sj
        JOIN jobs j ON sj.job_id = j.id
        WHERE sj.user_email = %s AND j.is_active = true
        ORDER BY sj.saved_at DESC
        """
        
        saved_jobs = db_manager.execute_query(saved_jobs_query, [user_email])
        
        # Process saved jobs
        processed_jobs = []
        for job in saved_jobs:
            processed_job = dict(job)
            
            # Format dates
            for date_field in ['date_posted', 'scraped_at', 'saved_at']:
                if processed_job.get(date_field):
                    processed_job[date_field] = processed_job[date_field].isoformat()
            
            processed_jobs.append(processed_job)
        
        return jsonify({
            'success': True,
            'saved_jobs': processed_jobs
        })
        
    except Exception as e:
        logger.error(f"Error fetching saved jobs: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@jobs_bp.route('/api/jobs/extracted', methods=['GET'])
def get_extracted_jobs():
    """
    Get jobs extracted from email processing (job board emails)
    
    Query Parameters:
    - days_back: Number of days to look back (default: 30)
    - limit: Number of jobs to return (default: 50, max: 100)
    """
    
    try:
        from email_processing.services.storage_service import StorageService
        storage_service = StorageService(db_manager)
        
        # Parse query parameters
        days_back = int(request.args.get('days_back', 30))
        limit = min(int(request.args.get('limit', 50)), 100)
        
        # Get extracted jobs using the storage service
        extracted_jobs = storage_service.get_extracted_jobs(days_back=days_back, limit=limit)
        
        # Format the response for the frontend card interface
        formatted_jobs = []
        for job in extracted_jobs:
            formatted_job = {
                'id': job['id'],
                'title': job['title'],
                'company': job['company'],
                'location': job['location'],
                'remote': job['remote'],
                'job_type': job['job_type'],
                'salary_display': job['salary_display'],
                'application_url': job['application_url'],
                'platform': job['platform'],
                'scraped_at': job['scraped_at'].isoformat() if job.get('scraped_at') else None,
                'date_posted': job['date_posted'].isoformat() if job.get('date_posted') else None
            }
            formatted_jobs.append(formatted_job)
        
        return jsonify({
            'success': True,
            'jobs': formatted_jobs,
            'total': len(formatted_jobs),
            'source': 'email_extraction',
            'message': f'Retrieved {len(formatted_jobs)} jobs extracted from email processing'
        })
        
    except Exception as e:
        logger.error(f"Error fetching extracted jobs: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@jobs_bp.route('/api/jobs/filters', methods=['GET'])
def get_filter_options():
    """Get available filter options for job search"""
    
    try:
        # Get unique companies
        companies_query = """
        SELECT DISTINCT company 
        FROM jobs 
        WHERE is_active = true 
        ORDER BY company 
        LIMIT 100
        """
        
        # Get unique locations
        locations_query = """
        SELECT DISTINCT location 
        FROM jobs 
        WHERE is_active = true AND location IS NOT NULL AND location != ''
        ORDER BY location 
        LIMIT 100
        """
        
        # Get platforms
        platforms_query = """
        SELECT DISTINCT platform, COUNT(*) as job_count
        FROM jobs 
        WHERE is_active = true 
        GROUP BY platform 
        ORDER BY job_count DESC
        """
        
        companies = db_manager.execute_query(companies_query)
        locations = db_manager.execute_query(locations_query)
        platforms = db_manager.execute_query(platforms_query)
        
        # Get salary ranges
        salary_stats_query = """
        SELECT 
            MIN(salary_min) as min_salary,
            MAX(salary_max) as max_salary,
            PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY salary_min) as salary_25th,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY salary_min) as salary_median,
            PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY salary_min) as salary_75th
        FROM jobs 
        WHERE is_active = true AND salary_min IS NOT NULL
        """
        
        salary_stats = db_manager.execute_query(salary_stats_query)
        
        return jsonify({
            'success': True,
            'filters': {
                'companies': [row['company'] for row in companies],
                'locations': [row['location'] for row in locations],
                'platforms': platforms,
                'job_types': ['full-time', 'part-time', 'contract', 'internship', 'temporary'],
                'experience_levels': ['entry', 'mid', 'senior', 'executive'],
                'salary_stats': salary_stats[0] if salary_stats else None
            }
        })
        
    except Exception as e:
        logger.error(f"Error getting filter options: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500