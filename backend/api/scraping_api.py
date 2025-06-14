"""
Enhanced Scraping API Endpoints
Handles resilient job scraping with background processing
"""

import logging
from datetime import datetime
from typing import Dict, List, Any, Optional
from flask import Blueprint, request, jsonify
from services.enhanced_job_scraper import EnhancedJobScrapingService, BackgroundJobScraper
from services.enhanced_job_processor import EnhancedJobProcessor
from services.database import DatabaseManager
from services.supabase_manager import SupabaseDatabaseManager
from config.database_config import db_config

logger = logging.getLogger(__name__)

# Create Blueprint for scraping API
scraping_bp = Blueprint('scraping', __name__)

# Initialize services
enhanced_scraper = EnhancedJobScrapingService()
background_scraper = BackgroundJobScraper(enhanced_scraper)
enhanced_processor = EnhancedJobProcessor()

if db_config.is_postgresql():
    db_manager = SupabaseDatabaseManager()
else:
    db_manager = DatabaseManager()

@scraping_bp.route('/api/scraping/trigger', methods=['POST'])
def trigger_enhanced_scraping():
    """
    Trigger enhanced job scraping with background processing
    
    Body Parameters:
    - search_terms: List of search terms (optional)
    - locations: List of locations (optional)
    - platforms: List of platforms to scrape (optional)
    - results_per_search: Number of results per search (default: 30, max: 50)
    - process_immediately: Run LLM enhancement immediately (default: true)
    - background: Run as background task (default: false)
    """
    
    try:
        data = request.get_json() or {}
        
        # Extract parameters
        search_params = {}
        
        if 'search_terms' in data:
            search_params['search_term'] = data['search_terms']
        
        if 'locations' in data:
            search_params['location'] = data['locations']
            
        if 'results_per_search' in data:
            search_params['results_wanted'] = min(int(data['results_per_search']), 50)
        
        platforms = data.get('platforms')
        process_immediately = data.get('process_immediately', True)
        run_background = data.get('background', False)
        
        if run_background:
            # Start background task
            task_id = background_scraper.start_scraping_task(search_params)
            
            return jsonify({
                'success': True,
                'message': 'Scraping task started in background',
                'task_id': task_id,
                'status_url': f'/api/scraping/status/{task_id}'
            }), 202
        
        else:
            # Run synchronously (with timeout protection)
            logger.info("Starting enhanced scraping (synchronous mode)")
            
            results = enhanced_scraper.scrape_jobs_enhanced(
                search_params=search_params,
                platforms=platforms,
                process_immediately=process_immediately
            )
            
            return jsonify({
                'success': True,
                'message': 'Scraping completed successfully',
                'results': results,
                'statistics': enhanced_scraper.get_statistics()
            })
        
    except Exception as e:
        logger.error(f"Error during enhanced scraping: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@scraping_bp.route('/api/scraping/quick', methods=['POST'])
def quick_scrape():
    """
    Quick scraping endpoint for immediate results (smaller batches)
    
    Body Parameters:
    - search_term: Single search term (required)
    - location: Single location (default: "Remote USA")
    - platform: Single platform (default: "indeed")
    - limit: Number of jobs to fetch (default: 10, max: 20)
    """
    
    try:
        data = request.get_json() or {}
        
        search_term = data.get('search_term')
        if not search_term:
            return jsonify({'success': False, 'error': 'search_term is required'}), 400
        
        location = data.get('location', 'Remote USA')
        platform = data.get('platform', 'indeed')
        limit = min(int(data.get('limit', 10)), 20)
        
        # Quick scrape with minimal results
        results = enhanced_scraper.scrape_jobs_enhanced(
            search_params={
                'search_term': search_term,
                'location': location,
                'results_wanted': limit
            },
            platforms=[platform],
            process_immediately=False  # Skip LLM for speed
        )
        
        # Get the scraped jobs immediately
        jobs_query = """
        SELECT 
            id, job_id, title, company, location, remote, job_type,
            salary_min, salary_max, application_url,
            platform, date_posted, skills, experience_level,
            LEFT(description, 200) as description_preview
        FROM jobs 
        WHERE scraped_at >= NOW() - INTERVAL '5 minutes'
        ORDER BY scraped_at DESC
        LIMIT %s
        """
        
        recent_jobs = db_manager.execute_query(jobs_query, (limit,))
        
        # Format jobs for response
        formatted_jobs = []
        for job in recent_jobs:
            formatted_job = dict(job)
            if formatted_job.get('date_posted'):
                formatted_job['date_posted'] = formatted_job['date_posted'].isoformat()
            formatted_jobs.append(formatted_job)
        
        return jsonify({
            'success': True,
            'jobs': formatted_jobs,
            'count': len(formatted_jobs),
            'scraping_stats': results
        })
        
    except Exception as e:
        logger.error(f"Error during quick scrape: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@scraping_bp.route('/api/scraping/status/<task_id>', methods=['GET'])
def get_scraping_status(task_id):
    """Get status of a background scraping task"""
    
    try:
        status = background_scraper.get_task_status(task_id)
        
        if status['status'] == 'not_found':
            return jsonify({'success': False, 'error': 'Task not found'}), 404
        
        # Format response based on status
        response = {
            'success': True,
            'task_id': task_id,
            'status': status['status'],
            'started_at': status.get('started_at', '').isoformat() if status.get('started_at') else None
        }
        
        if status['status'] == 'completed':
            response['completed_at'] = status.get('completed_at', '').isoformat()
            response['results'] = status.get('results')
            
        elif status['status'] == 'failed':
            response['error'] = status.get('error')
            
        elif status['status'] == 'running':
            response['progress'] = status.get('progress', 0)
            response['total'] = status.get('total', 0)
        
        return jsonify(response)
        
    except Exception as e:
        logger.error(f"Error getting task status: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@scraping_bp.route('/api/scraping/platforms', methods=['GET'])
def get_platform_status():
    """Get current platform status and reliability scores"""
    
    try:
        stats = enhanced_scraper.get_statistics()
        
        # Get platform-specific information
        platform_info = []
        for platform, config in enhanced_scraper.platforms.items():
            info = {
                'platform': platform,
                'active': config['active'],
                'reliability': config['reliability'],
                'strategy': config['strategy'],
                'recent_failures': stats['platform_failures'].get(platform, 0)
            }
            
            # Add success rate if we have data
            if platform in stats.get('platform_results', {}):
                platform_stats = stats['platform_results'][platform]
                if platform_stats.get('searches_attempted', 0) > 0:
                    info['success_rate'] = (
                        platform_stats['searches_successful'] / 
                        platform_stats['searches_attempted']
                    ) * 100
            
            platform_info.append(info)
        
        return jsonify({
            'success': True,
            'platforms': platform_info,
            'recommended_platforms': [
                p['platform'] for p in platform_info 
                if p['active'] and p['reliability'] >= 0.7
            ],
            'last_scrape': stats.get('last_scrape_time', '').isoformat() if stats.get('last_scrape_time') else None
        })
        
    except Exception as e:
        logger.error(f"Error getting platform status: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@scraping_bp.route('/api/scraping/schedule', methods=['POST'])
def schedule_scraping():
    """
    Schedule automated scraping (for future cron job implementation)
    
    Body Parameters:
    - frequency: "hourly", "daily", "weekly"
    - search_params: Search parameters to use
    - platforms: Platforms to scrape
    """
    
    try:
        data = request.get_json() or {}
        
        frequency = data.get('frequency', 'daily')
        search_params = data.get('search_params', {})
        platforms = data.get('platforms')
        
        # For now, just trigger immediate scraping
        # In production, this would create a scheduled job
        task_id = background_scraper.start_scraping_task(search_params)
        
        return jsonify({
            'success': True,
            'message': f'Scraping scheduled ({frequency})',
            'immediate_task_id': task_id,
            'schedule': {
                'frequency': frequency,
                'next_run': 'Immediate',
                'search_params': search_params,
                'platforms': platforms or enhanced_scraper.get_statistics()['active_platforms']
            }
        })
        
    except Exception as e:
        logger.error(f"Error scheduling scraping: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@scraping_bp.route('/api/scraping/stats', methods=['GET'])
def get_scraping_statistics():
    """Get comprehensive scraping statistics"""
    
    try:
        # Get scraper statistics
        scraper_stats = enhanced_scraper.get_statistics()
        
        # Get database statistics
        db_stats_query = """
        SELECT 
            COUNT(*) as total_jobs,
            COUNT(*) FILTER (WHERE scraped_at >= NOW() - INTERVAL '24 hours') as jobs_24h,
            COUNT(*) FILTER (WHERE scraped_at >= NOW() - INTERVAL '7 days') as jobs_7d,
            COUNT(*) FILTER (WHERE processing_status = 'new') as unprocessed_jobs,
            COUNT(*) FILTER (WHERE processing_status = 'completed') as enhanced_jobs,
            COUNT(DISTINCT company) as unique_companies,
            COUNT(DISTINCT platform) as platforms_used
        FROM jobs 
        WHERE is_active = true
        """
        
        db_stats = db_manager.execute_query(db_stats_query)
        
        # Get jobs by platform
        platform_query = """
        SELECT platform, COUNT(*) as count
        FROM jobs 
        WHERE is_active = true
        GROUP BY platform
        ORDER BY count DESC
        """
        
        platform_counts = db_manager.execute_query(platform_query)
        
        return jsonify({
            'success': True,
            'scraper_stats': scraper_stats,
            'database_stats': db_stats[0] if db_stats else {},
            'jobs_by_platform': [
                {'platform': row['platform'], 'count': row['count']} 
                for row in platform_counts
            ],
            'enhancement_backlog': db_stats[0]['unprocessed_jobs'] if db_stats else 0
        })
        
    except Exception as e:
        logger.error(f"Error getting scraping statistics: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@scraping_bp.route('/api/scraping/cleanup', methods=['POST'])
def cleanup_old_jobs():
    """
    Clean up old job postings
    
    Body Parameters:
    - days_to_keep: Number of days to keep jobs (default: 30)
    """
    
    try:
        data = request.get_json() or {}
        days_to_keep = int(data.get('days_to_keep', 30))
        
        cleanup_query = """
        UPDATE jobs 
        SET is_active = false 
        WHERE scraped_at < NOW() - INTERVAL '%s days'
        AND is_active = true
        """
        
        db_manager.execute_query(cleanup_query, (days_to_keep,))
        
        # Get count of deactivated jobs
        count_query = """
        SELECT COUNT(*) as deactivated_count
        FROM jobs 
        WHERE is_active = false 
        AND updated_at >= NOW() - INTERVAL '1 minute'
        """
        
        result = db_manager.execute_query(count_query)
        deactivated_count = result[0]['deactivated_count'] if result else 0
        
        # Clean up old background tasks
        background_scraper.cleanup_old_tasks(hours=24)
        
        return jsonify({
            'success': True,
            'message': f'Cleanup completed',
            'jobs_deactivated': deactivated_count,
            'days_kept': days_to_keep
        })
        
    except Exception as e:
        logger.error(f"Error during cleanup: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500