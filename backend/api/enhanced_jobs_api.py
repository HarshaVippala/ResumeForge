"""
Enhanced Jobs API Endpoints
Handles H1B sponsorship detection and enhanced job data processing
"""

import logging
import json
from datetime import datetime
from typing import Dict, List, Any, Optional
from flask import Blueprint, request, jsonify
from services.enhanced_job_processor import EnhancedJobProcessor
from services.database import DatabaseManager
from services.supabase_manager import SupabaseDatabaseManager
from config.database_config import db_config

logger = logging.getLogger(__name__)

# Create Blueprint for enhanced jobs API
enhanced_jobs_bp = Blueprint('enhanced_jobs', __name__)

# Initialize services
enhanced_processor = EnhancedJobProcessor()

if db_config.is_postgresql():
    db_manager = SupabaseDatabaseManager()
else:
    db_manager = DatabaseManager()

@enhanced_jobs_bp.route('/api/jobs/enhanced', methods=['GET'])
def get_enhanced_jobs():
    """
    Get jobs with enhanced sponsorship and technology data
    
    Query Parameters:
    - page: Page number (default: 1)
    - limit: Jobs per page (default: 20)
    - sponsorship_filter: SPONSORS_H1B, NO_SPONSORSHIP, UNCERTAIN, or all
    - tech_filter: Filter by specific technology
    - confidence_min: Minimum confidence score (0.0-1.0)
    """
    
    try:
        # Parse query parameters
        page = int(request.args.get('page', 1))
        limit = min(int(request.args.get('limit', 20)), 100)
        offset = (page - 1) * limit
        
        sponsorship_filter = request.args.get('sponsorship_filter', 'all')
        tech_filter = request.args.get('tech_filter', '')
        confidence_min = float(request.args.get('confidence_min', 0.0))
        
        # Build WHERE clause
        where_conditions = ["is_active = true", "processing_status = 'completed'"]
        params = []
        
        # Sponsorship filter
        if sponsorship_filter != 'all':
            where_conditions.append("sponsorship_status = %s")
            params.append(sponsorship_filter)
        
        # Confidence filter
        if confidence_min > 0:
            where_conditions.append("sponsorship_confidence >= %s")
            params.append(confidence_min)
        
        # Technology filter
        if tech_filter:
            where_conditions.append("enhanced_tech_stack::text ILIKE %s")
            params.append(f"%{tech_filter}%")
        
        # Construct main query
        where_clause = " AND ".join(where_conditions)
        
        jobs_query = f"""
        SELECT 
            id, job_id, title, company, location, remote, job_type,
            salary_min, salary_max, salary_currency, description,
            application_url, platform, date_posted, experience_level,
            sponsorship_status, sponsorship_confidence, sponsorship_reasoning,
            enhanced_tech_stack, last_processed_at, scraped_at
        FROM jobs 
        WHERE {where_clause}
        ORDER BY 
            CASE WHEN sponsorship_status = 'SPONSORS_H1B' THEN 1
                 WHEN sponsorship_status = 'UNCERTAIN' THEN 2  
                 ELSE 3 END,
            sponsorship_confidence DESC,
            date_posted DESC
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
            for date_field in ['date_posted', 'last_processed_at', 'scraped_at']:
                if processed_job.get(date_field):
                    processed_job[date_field] = processed_job[date_field].isoformat()
            
            # Parse enhanced tech stack
            if processed_job.get('enhanced_tech_stack'):
                try:
                    processed_job['enhanced_tech_stack'] = json.loads(processed_job['enhanced_tech_stack'])
                except json.JSONDecodeError:
                    processed_job['enhanced_tech_stack'] = None
            
            # Add sponsorship confidence category
            confidence = processed_job.get('sponsorship_confidence', 0.0)
            if confidence >= 0.9:
                processed_job['confidence_category'] = 'high'
            elif confidence >= 0.7:
                processed_job['confidence_category'] = 'medium'
            else:
                processed_job['confidence_category'] = 'low'
            
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
        logger.error(f"Error fetching enhanced jobs: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@enhanced_jobs_bp.route('/api/jobs/sponsorship-summary', methods=['GET'])
def get_sponsorship_summary():
    """Get summary of jobs by sponsorship status for dashboard"""
    
    try:
        summary_query = """
        SELECT 
            sponsorship_status,
            COUNT(*) as count,
            AVG(sponsorship_confidence) as avg_confidence,
            COUNT(*) FILTER (WHERE sponsorship_confidence >= 0.9) as high_confidence,
            COUNT(*) FILTER (WHERE sponsorship_confidence >= 0.7) as medium_confidence,
            COUNT(*) FILTER (WHERE sponsorship_confidence < 0.7) as low_confidence
        FROM jobs 
        WHERE is_active = true AND processing_status = 'completed'
        GROUP BY sponsorship_status
        ORDER BY 
            CASE WHEN sponsorship_status = 'SPONSORS_H1B' THEN 1
                 WHEN sponsorship_status = 'UNCERTAIN' THEN 2  
                 ELSE 3 END
        """
        
        results = db_manager.execute_query(summary_query)
        
        # Get total unprocessed jobs
        unprocessed_query = """
        SELECT COUNT(*) as unprocessed_count
        FROM jobs 
        WHERE is_active = true AND processing_status = 'new'
        """
        
        unprocessed_result = db_manager.execute_query(unprocessed_query)
        unprocessed_count = unprocessed_result[0]['unprocessed_count'] if unprocessed_result else 0
        
        return jsonify({
            'success': True,
            'sponsorship_summary': results,
            'unprocessed_jobs': unprocessed_count,
            'processing_stats': enhanced_processor.get_processing_statistics()
        })
        
    except Exception as e:
        logger.error(f"Error getting sponsorship summary: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@enhanced_jobs_bp.route('/api/jobs/process-enhancement', methods=['POST'])
def trigger_enhancement_processing():
    """
    Trigger enhanced processing for unprocessed jobs
    
    Body Parameters:
    - batch_size: Number of jobs to process (default: 20, max: 50)
    """
    
    try:
        data = request.get_json() or {}
        batch_size = min(int(data.get('batch_size', 20)), 50)
        
        logger.info(f"Starting enhanced job processing batch (size: {batch_size})")
        
        # Process the batch
        results = enhanced_processor.process_job_batch(batch_size)
        
        return jsonify({
            'success': True,
            'message': 'Enhanced processing completed',
            'results': results,
            'statistics': enhanced_processor.get_processing_statistics()
        })
        
    except Exception as e:
        logger.error(f"Error during enhanced processing: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@enhanced_jobs_bp.route('/api/jobs/<job_id>/sponsorship-override', methods=['POST'])
def override_sponsorship_classification(job_id):
    """
    Manual override for sponsorship classification
    
    Body Parameters:
    - sponsorship_status: SPONSORS_H1B, NO_SPONSORSHIP, or UNCERTAIN
    - reasoning: Reason for manual override
    """
    
    try:
        data = request.get_json()
        
        if not data or 'sponsorship_status' not in data:
            return jsonify({'success': False, 'error': 'sponsorship_status required'}), 400
        
        sponsorship_status = data['sponsorship_status']
        reasoning = data.get('reasoning', 'Manual override by user')
        
        # Validate sponsorship status
        valid_statuses = ['SPONSORS_H1B', 'NO_SPONSORSHIP', 'UNCERTAIN']
        if sponsorship_status not in valid_statuses:
            return jsonify({'success': False, 'error': f'Invalid status. Must be one of: {valid_statuses}'}), 400
        
        # Update the job
        update_query = """
        UPDATE jobs 
        SET sponsorship_status = %s,
            sponsorship_confidence = 1.0,
            sponsorship_reasoning = %s,
            last_processed_at = NOW()
        WHERE (id = %s OR job_id = %s) AND is_active = true
        """
        
        result = db_manager.execute_query(update_query, (
            sponsorship_status, 
            f"MANUAL_OVERRIDE: {reasoning}",
            job_id, 
            job_id
        ))
        
        return jsonify({
            'success': True,
            'message': 'Sponsorship classification updated',
            'new_status': sponsorship_status
        })
        
    except Exception as e:
        logger.error(f"Error updating sponsorship classification: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@enhanced_jobs_bp.route('/api/jobs/technology-summary', methods=['GET'])
def get_technology_summary():
    """Get summary of most common technologies across all jobs"""
    
    try:
        # Get all enhanced tech stacks
        tech_query = """
        SELECT enhanced_tech_stack
        FROM jobs 
        WHERE is_active = true 
        AND processing_status = 'completed'
        AND enhanced_tech_stack IS NOT NULL
        """
        
        results = db_manager.execute_query(tech_query)
        
        # Aggregate technology counts
        tech_counts = {}
        category_counts = {}
        required_vs_preferred = {'REQUIRED': 0, 'PREFERRED': 0}
        
        for row in results:
            try:
                tech_data = json.loads(row['enhanced_tech_stack'])
                
                for tech in tech_data.get('technologies', []):
                    name = tech.get('name')
                    category = tech.get('category', 'OTHER')
                    level = tech.get('level', 'REQUIRED')
                    
                    if name:
                        tech_counts[name] = tech_counts.get(name, 0) + 1
                        category_counts[category] = category_counts.get(category, 0) + 1
                        required_vs_preferred[level] = required_vs_preferred.get(level, 0) + 1
                        
            except (json.JSONDecodeError, TypeError):
                continue
        
        # Get top technologies
        top_technologies = sorted(tech_counts.items(), key=lambda x: x[1], reverse=True)[:20]
        top_categories = sorted(category_counts.items(), key=lambda x: x[1], reverse=True)
        
        return jsonify({
            'success': True,
            'top_technologies': [{'name': name, 'count': count} for name, count in top_technologies],
            'category_distribution': [{'category': cat, 'count': count} for cat, count in top_categories],
            'requirement_levels': required_vs_preferred,
            'total_jobs_analyzed': len(results)
        })
        
    except Exception as e:
        logger.error(f"Error getting technology summary: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500