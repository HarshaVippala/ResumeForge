"""
Job Applications API Endpoints
Handles job application tracking and management for the Job Tracker screen
"""

import logging
import json
from datetime import datetime, date
from typing import Dict, List, Any, Optional
from flask import Blueprint, request, jsonify
from middleware.auth import auth
from services.database import DatabaseManager
from services.supabase_manager import SupabaseDatabaseManager
from config.database_config import db_config

logger = logging.getLogger(__name__)

# Create Blueprint for applications API
applications_bp = Blueprint('applications', __name__)

# Initialize database manager
if db_config.is_postgresql():
    db_manager = SupabaseDatabaseManager()
else:
    db_manager = DatabaseManager()

class ApplicationTrackingService:
    """Service for managing job application tracking data"""
    
    def __init__(self, db_manager):
        self.db_manager = db_manager
    
    def get_user_applications(self, user_id: str, limit: int = 50, offset: int = 0) -> List[Dict]:
        """Get job applications for a specific user with proper data transformation"""
        try:
            # Query job_opportunities table with companies
            # Since this is a personal-use app, we don't need user_id filtering
            query = """
            SELECT 
                jo.*,
                c.name as company_name,
                c.domain as company_domain,
                c.industry as company_industry,
                j.title as scraped_title,
                j.location as scraped_location,
                j.remote as scraped_remote,
                j.job_type as scraped_job_type,
                j.salary_min,
                j.salary_max,
                j.salary_currency,
                j.description as scraped_description,
                j.application_url as scraped_url,
                j.skills,
                j.experience_level
            FROM job_opportunities jo
            LEFT JOIN companies c ON jo.company_id = c.id
            LEFT JOIN jobs j ON jo.job_id = j.job_id
            ORDER BY jo.created_at DESC
            LIMIT %s OFFSET %s
            """
            
            results = self.db_manager.execute_query(query, [limit, offset])
            
            applications = []
            for row in results:
                # Transform database row to application format
                # Use salary from job_opportunities first, fall back to scraped job data
                salary_range = row.get('salary_range')
                if not salary_range and (row.get('salary_min') or row.get('salary_max')):
                    min_sal = f"${row['salary_min'] // 1000}K" if row.get('salary_min') else ""
                    max_sal = f"${row['salary_max'] // 1000}K" if row.get('salary_max') else ""
                    salary_range = f"{min_sal} - {max_sal}".strip(' - ')
                
                # Map database status to application status
                status_map = {
                    'sourced': 'applied',
                    'applied': 'applied',
                    'phone_screen': 'phone-interview',
                    'interview': 'technical-interview',
                    'offer': 'offer',
                    'rejected': 'rejected',
                    'accepted': 'accepted',
                    'withdrawn': 'withdrawn'
                }
                
                # Use company name from companies table or fall back to scraped data
                company_name = row.get('company_name') or row.get('company') or 'Unknown Company'
                
                # Use job title from job_opportunities or fall back to scraped data
                job_title = row.get('title') or row.get('scraped_title') or 'Unknown Position'
                
                # Determine location and work type
                location = row.get('location') or row.get('scraped_location') or 'Not specified'
                # Use location_type from job_opportunities or infer from scraped data
                if row.get('location_type'):
                    work_type = row['location_type']
                else:
                    is_remote = row.get('scraped_remote', False)
                    work_type = 'remote' if is_remote else 'onsite'
                
                application = {
                    'id': str(row['id']),
                    'company': company_name,
                    'role': job_title,
                    'department': None,  # Not in current schema
                    'salaryRange': salary_range,
                    'location': location,
                    'workType': work_type,
                    'applicationDate': row['application_date'].strftime('%Y-%m-%d') if row.get('application_date') else row['created_at'].strftime('%Y-%m-%d') if row.get('created_at') else None,
                    'jobPostingUrl': row.get('application_url') or row.get('scraped_url'),
                    'status': status_map.get(row.get('status', 'applied'), 'applied'),
                    'resumeId': None,  # Resume versions are linked separately
                    'contacts': [],  # TODO: Query contacts table
                    'applicationMethod': row.get('source', 'website'),
                    'timeline': [
                        {
                            'id': '1',
                            'date': row['application_date'].strftime('%Y-%m-%d') if row.get('application_date') else row['created_at'].strftime('%Y-%m-%d') if row.get('created_at') else None,
                            'type': 'application',
                            'title': 'Application Submitted',
                            'description': f"Applied to {company_name}"
                        }
                    ],
                    'notes': row.get('notes', ''),
                    'nextAction': None,  # Could derive from next_followup_date
                    'nextActionDate': row['next_followup_date'].strftime('%Y-%m-%d') if row.get('next_followup_date') else None,
                    'metadata': {
                        'industry': row.get('company_industry', 'technology'),
                        'companySize': '1000+',  # Default for now
                        'responseTime': None,
                        'lastActivity': row['updated_at'].strftime('%Y-%m-%d') if row.get('updated_at') else None,
                        'priority': row.get('priority', 'medium')
                    }
                }
                
                applications.append(application)
            
            # If no real applications exist and this is dev mode, return one sample
            if not applications and user_id == 'dev-user':
                logger.info("No job applications found in database for dev-user, returning sample data")
                return [{
                    'id': 'sample-1',
                    'company': 'Sample Company',
                    'role': 'Software Engineer',
                    'department': 'Engineering',
                    'salaryRange': '$100K - $150K',
                    'location': 'San Francisco, CA',
                    'workType': 'hybrid',
                    'applicationDate': datetime.now().strftime('%Y-%m-%d'),
                    'jobPostingUrl': 'https://example.com/jobs/123',
                    'status': 'applied',
                    'resumeId': None,
                    'contacts': [],
                    'applicationMethod': 'company-website',
                    'timeline': [
                        {
                            'id': '1',
                            'date': datetime.now().strftime('%Y-%m-%d'),
                            'type': 'application',
                            'title': 'Application Submitted',
                            'description': 'Applied through company website'
                        }
                    ],
                    'notes': 'This is sample data. Create job applications to see real data here.',
                    'nextAction': 'Add real job applications',
                    'nextActionDate': None,
                    'metadata': {
                        'industry': 'technology',
                        'companySize': '1000+',
                        'responseTime': 0,
                        'lastActivity': datetime.now().strftime('%Y-%m-%d')
                    }
                }]
            
            return applications
            
        except Exception as e:
            logger.error(f"Error fetching user applications: {e}")
            raise
    
    def get_application_by_id(self, user_id: str, application_id: str) -> Optional[Dict]:
        """Get a specific application by ID for the user"""
        try:
            # Directly query for the specific application
            query = """
            SELECT 
                jo.*,
                c.name as company_name,
                c.domain as company_domain,
                c.industry as company_industry,
                j.title as scraped_title,
                j.location as scraped_location,
                j.remote as scraped_remote,
                j.job_type as scraped_job_type,
                j.salary_min,
                j.salary_max,
                j.salary_currency,
                j.description as scraped_description,
                j.application_url as scraped_url,
                j.skills,
                j.experience_level
            FROM job_opportunities jo
            LEFT JOIN companies c ON jo.company_id = c.id
            LEFT JOIN jobs j ON jo.job_id = j.job_id
            WHERE jo.id = %s
            """
            
            results = self.db_manager.execute_query(query, [application_id])
            
            if results and len(results) > 0:
                # Use the same transformation logic
                applications = self.get_user_applications(user_id, limit=1, offset=0)
                return applications[0] if applications else None
            
            return None
        except Exception as e:
            logger.error(f"Error fetching application {application_id}: {e}")
            raise
    
    def update_application_status(self, user_id: str, application_id: str, new_status: str) -> bool:
        """Update application status"""
        try:
            # TODO: Implement database update
            logger.info(f"Updated application {application_id} status to {new_status} for user {user_id}")
            return True
        except Exception as e:
            logger.error(f"Error updating application status: {e}")
            raise
    
    def get_application_stats(self, user_id: str) -> Dict:
        """Get application statistics for dashboard"""
        try:
            # Get statistics directly from database for better performance
            stats_query = """
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN status NOT IN ('rejected', 'accepted', 'withdrawn') THEN 1 END) as active,
                COUNT(CASE WHEN status IN ('phone_screen', 'interview') THEN 1 END) as interviews,
                COUNT(CASE WHEN status = 'offer' THEN 1 END) as offers
            FROM job_opportunities
            """
            
            result = self.db_manager.execute_query(stats_query, [])
            
            if result and len(result) > 0:
                stats = {
                    'total': result[0]['total'] or 0,
                    'active': result[0]['active'] or 0,
                    'interviews': result[0]['interviews'] or 0,
                    'offers': result[0]['offers'] or 0,
                    'avgResponseTime': 0  # TODO: Calculate from actual response times when available
                }
            else:
                stats = {
                    'total': 0,
                    'active': 0,
                    'interviews': 0,
                    'offers': 0,
                    'avgResponseTime': 0
                }
            
            return stats
            
        except Exception as e:
            logger.error(f"Error calculating application stats: {e}")
            raise

# Initialize service
tracking_service = ApplicationTrackingService(db_manager)

@applications_bp.route('/api/applications', methods=['GET'])
@auth.require_auth
def get_applications():
    """
    Get job applications for the authenticated user
    
    Query Parameters:
    - page: Page number (default: 1)
    - limit: Applications per page (default: 50, max: 100)
    - status: Filter by application status
    - company: Filter by company name
    """
    
    try:
        user_id = request.user['user_id']
        
        # Parse query parameters
        page = int(request.args.get('page', 1))
        limit = min(int(request.args.get('limit', 50)), 100)
        offset = (page - 1) * limit
        status_filter = request.args.get('status')
        company_filter = request.args.get('company')
        
        logger.info(f"Fetching applications for user {user_id}, page {page}, limit {limit}")
        
        # Get applications
        applications = tracking_service.get_user_applications(user_id, limit, offset)
        
        # Apply filters
        if status_filter:
            applications = [app for app in applications if app['status'] == status_filter]
        
        if company_filter:
            applications = [app for app in applications if company_filter.lower() in app['company'].lower()]
        
        # Get stats
        stats = tracking_service.get_application_stats(user_id)
        
        return jsonify({
            'success': True,
            'applications': applications,
            'stats': stats,
            'pagination': {
                'current_page': page,
                'total_applications': len(applications),
                'applications_per_page': limit
            }
        })
        
    except Exception as e:
        logger.error(f"Error fetching applications: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@applications_bp.route('/api/applications/<application_id>', methods=['GET'])
@auth.require_auth
def get_application_details(application_id):
    """Get detailed information for a specific application"""
    
    try:
        user_id = request.user['user_id']
        
        application = tracking_service.get_application_by_id(user_id, application_id)
        
        if not application:
            return jsonify({'success': False, 'error': 'Application not found'}), 404
        
        return jsonify({
            'success': True,
            'application': application
        })
        
    except Exception as e:
        logger.error(f"Error fetching application details: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@applications_bp.route('/api/applications/<application_id>/status', methods=['PUT'])
@auth.require_auth
def update_application_status(application_id):
    """Update application status"""
    
    try:
        user_id = request.user['user_id']
        data = request.get_json()
        
        if not data or 'status' not in data:
            return jsonify({'success': False, 'error': 'Status is required'}), 400
        
        new_status = data['status']
        
        # Validate status
        valid_statuses = ['applied', 'screening', 'phone-interview', 'technical-interview', 
                         'onsite-interview', 'offer', 'rejected', 'accepted', 'withdrawn']
        
        if new_status not in valid_statuses:
            return jsonify({'success': False, 'error': 'Invalid status'}), 400
        
        success = tracking_service.update_application_status(user_id, application_id, new_status)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Application status updated successfully'
            })
        else:
            return jsonify({'success': False, 'error': 'Failed to update status'}), 500
        
    except Exception as e:
        logger.error(f"Error updating application status: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@applications_bp.route('/api/applications/stats', methods=['GET'])
@auth.require_auth
def get_application_statistics():
    """Get application statistics for the user"""
    
    try:
        user_id = request.user['user_id']
        
        stats = tracking_service.get_application_stats(user_id)
        
        return jsonify({
            'success': True,
            'stats': stats
        })
        
    except Exception as e:
        logger.error(f"Error getting application statistics: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500