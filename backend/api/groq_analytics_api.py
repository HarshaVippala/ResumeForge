#!/usr/bin/env python3
"""
Groq Analytics API
Provides endpoints for monitoring and optimizing Groq usage
"""

from flask import Blueprint, request, jsonify
import logging
import os

logger = logging.getLogger(__name__)

# Create blueprint
groq_analytics_bp = Blueprint('groq_analytics', __name__)

@groq_analytics_bp.route('/api/groq/analytics', methods=['GET'])
def get_groq_analytics():
    """
    Get comprehensive Groq processing analytics
    """
    try:
        # Import services
        from services.enhanced_email_service import EnhancedEmailService
        from services.database import DatabaseManager
        from services.supabase_manager import SupabaseDatabaseManager
        from services.lm_studio_client import LMStudioClient
        from config.database_config import db_config
        
        # Initialize services
        if db_config.is_postgresql():
            db_manager = SupabaseDatabaseManager()
        else:
            db_manager = DatabaseManager()
        
        lm_studio = LMStudioClient()
        
        # Initialize enhanced email service with new architecture
        enhanced_email_service = EnhancedEmailService(db_manager, lm_studio)
        
        # Get analytics
        analytics = enhanced_email_service.get_processing_analytics()
        
        # Add environment information
        analytics['environment'] = {
            'groq_api_key_configured': bool(os.getenv('GROQ_API_KEY')),
            'lm_studio_available': lm_studio is not None,
            'database_type': 'postgresql' if db_config.is_postgresql() else 'sqlite'
        }
        
        return jsonify({
            'success': True,
            'analytics': analytics
        })
        
    except Exception as e:
        logger.error(f"Error getting Groq analytics: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@groq_analytics_bp.route('/api/groq/preferences', methods=['GET', 'POST'])
def manage_processing_preferences():
    """
    Get or update email processing preferences
    """
    try:
        # Import services (same as above)
        from services.enhanced_email_service import EnhancedEmailService
        from services.database import DatabaseManager
        from services.supabase_manager import SupabaseDatabaseManager
        from services.lm_studio_client import LMStudioClient
        from config.database_config import db_config
        
        # Initialize services
        if db_config.is_postgresql():
            db_manager = SupabaseDatabaseManager()
        else:
            db_manager = DatabaseManager()
        
        lm_studio = LMStudioClient()
        enhanced_email_service = EnhancedEmailService(db_manager, lm_studio)
        
        if request.method == 'GET':
            return jsonify({
                'success': True,
                'preferences': enhanced_email_service.email_processor.get_model_recommendations()
            })
        
        elif request.method == 'POST':
            data = request.get_json()
            if not data:
                return jsonify({'error': 'No data provided'}), 400
            
            # For now, return success (preferences management can be enhanced later)
            return jsonify({
                'success': True,
                'message': 'Preferences noted (enhanced preferences management coming soon)',
                'preferences': data
            })
            
    except Exception as e:
        logger.error(f"Error managing processing preferences: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@groq_analytics_bp.route('/api/groq/test', methods=['POST'])
def test_groq_processing():
    """
    Test Groq processing with a sample email
    """
    try:
        data = request.get_json()
        if not data or 'email' not in data:
            return jsonify({'error': 'Email data required'}), 400
        
        email_data = data['email']
        priority = data.get('priority', 'normal')
        
        # Use enhanced email processing with Groq
        from services.enhanced_email_service import EnhancedEmailService
        from services.database import DatabaseManager
        from services.supabase_manager import SupabaseDatabaseManager
        from config.database_config import db_config
        
        groq_api_key = os.getenv('GROQ_API_KEY')
        if not groq_api_key:
            return jsonify({
                'success': False,
                'error': 'GROQ_API_KEY not configured'
            }), 400
        
        # Initialize database manager
        if db_config.is_postgresql():
            db_manager = SupabaseDatabaseManager()
        else:
            db_manager = DatabaseManager()
        
        enhanced_service = EnhancedEmailService(db_manager)
        
        # Create test EmailData object
        from email_processing.models.email_data import EmailData
        test_email = EmailData(
            id=email_data.get('id', 'test_id'),
            subject=email_data.get('subject', ''),
            sender=email_data.get('sender', ''),
            recipient=email_data.get('recipient', ''),
            date=email_data.get('date'),
            body=email_data.get('body', ''),
            snippet=email_data.get('snippet', ''),
            thread_id=email_data.get('thread_id', ''),
            is_read=email_data.get('is_read', True)
        )
        
        # Process test email
        result = enhanced_service.email_processor.process_email(test_email)
        
        # Get processing stats
        stats = enhanced_service.email_processor.get_processing_stats()
        
        return jsonify({
            'success': result.success,
            'result': result.to_dict(),
            'stats': stats,
            'message': f'Enhanced multi-stage processing: {result.processing_stage.value}'
        })
        
    except Exception as e:
        logger.error(f"Error testing Groq processing: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@groq_analytics_bp.route('/api/groq/compare', methods=['POST'])
def compare_processors():
    """
    Compare processing results between different processors
    """
    try:
        data = request.get_json()
        if not data or 'email' not in data:
            return jsonify({'error': 'Email data required'}), 400
        
        email_data = data['email']
        
        results = {}
        
        # Test new enhanced email processor with Groq
        try:
            from services.enhanced_email_service import EnhancedEmailService
            from services.database import DatabaseManager
            from services.supabase_manager import SupabaseDatabaseManager
            from config.database_config import db_config
            
            # Initialize database manager
            if db_config.is_postgresql():
                db_manager = SupabaseDatabaseManager()
            else:
                db_manager = DatabaseManager()
            
            enhanced_service = EnhancedEmailService(db_manager)
            
            # Create test EmailData object
            from email_processing.models.email_data import EmailData
            test_email = EmailData(
                id=email_data.get('id', 'test_id'),
                subject=email_data.get('subject', ''),
                sender=email_data.get('sender', ''),
                recipient=email_data.get('recipient', ''),
                date=email_data.get('date'),
                body=email_data.get('body', ''),
                snippet=email_data.get('snippet', ''),
                thread_id=email_data.get('thread_id', ''),
                is_read=email_data.get('is_read', True)
            )
            
            # Process single email
            result = enhanced_service.email_processor.process_email(test_email)
            results['enhanced_groq'] = {
                'success': result.success,
                'result': result.to_dict(),
                'stats': enhanced_service.email_processor.get_processing_stats()
            }
        except Exception as e:
            results['enhanced_groq'] = {'success': False, 'error': str(e)}
        
        # Legacy processors removed - only enhanced processor available now
        results['legacy_processors'] = {
            'success': False,
            'message': 'Legacy processors removed - using enhanced multi-stage processor only'
        }
        
        return jsonify({
            'success': True,
            'comparison': results,
            'email_preview': {
                'subject': email_data.get('subject', '')[:100],
                'body_length': len(email_data.get('body', '')),
                'sender': email_data.get('sender', '')
            }
        })
        
    except Exception as e:
        logger.error(f"Error comparing processors: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@groq_analytics_bp.route('/api/groq/reset-stats', methods=['POST'])
def reset_groq_stats():
    """
    Reset Groq processing statistics
    """
    try:
        # Reset enhanced email processor stats
        from services.enhanced_email_service import EnhancedEmailService
        from services.database import DatabaseManager
        from services.supabase_manager import SupabaseDatabaseManager
        from config.database_config import db_config
        
        # Initialize database manager
        if db_config.is_postgresql():
            db_manager = SupabaseDatabaseManager()
        else:
            db_manager = DatabaseManager()
        
        enhanced_service = EnhancedEmailService(db_manager)
        enhanced_service.email_processor.reset_stats()
        
        return jsonify({
            'success': True,
            'message': 'Groq processing statistics reset successfully'
        })
        
    except Exception as e:
        logger.error(f"Error resetting Groq stats: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500