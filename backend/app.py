#!/usr/bin/env python3
"""
Interactive Resume Builder Backend
Flask API with LM Studio integration for local AI processing
"""

import os
import json
import logging
import sqlite3
from datetime import datetime
from typing import Dict, List, Optional

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from dotenv import load_dotenv

# Import our custom services
from services.lm_studio_client import LMStudioClient
from services.keyword_extractor import KeywordExtractor
from services.database import DatabaseManager
from services.supabase_manager import SupabaseDatabaseManager
from services.unified_email_service import UnifiedEmailService
from services.resume import (
    SectionGenerator,
    ResumeProcessor,
    ResumeParser,
    DocumentPatcher,
    TemplatePreview as TemplatePreviewService
)
from config.database_config import db_config
import json
import re

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)

# Configure CORS based on environment
allowed_origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001"
]

# Add production origins from environment
if os.getenv('ALLOWED_ORIGINS'):
    # Format: ALLOWED_ORIGINS="https://app.vercel.app,https://custom-domain.com"
    production_origins = os.getenv('ALLOWED_ORIGINS').split(',')
    allowed_origins.extend([origin.strip() for origin in production_origins])

CORS(app, 
     resources={
         r"/api/*": {"origins": allowed_origins},
         r"/health": {"origins": allowed_origins}
     },
     supports_credentials=True,
     allow_headers=["Content-Type", "Authorization"],
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"]
)

# Initialize services
lm_studio = LMStudioClient()
keyword_extractor = KeywordExtractor(lm_studio)
section_generator = SectionGenerator(lm_studio)
resume_processor = ResumeProcessor()

# Initialize database manager based on configuration
if db_config.is_postgresql():
    db_manager = SupabaseDatabaseManager()
    logger.info("Using Supabase PostgreSQL database")
else:
    db_manager = DatabaseManager()
    logger.info("Using local SQLite database")

resume_parser = ResumeParser()
document_patcher = DocumentPatcher()
template_preview = TemplatePreviewService()

# Initialize unified email service
unified_email_service = UnifiedEmailService(db_manager, lm_studio)

# Initialize jobs API
from api.jobs_api import jobs_bp
app.register_blueprint(jobs_bp)

# Initialize database
db_manager.init_database()


@app.route('/api/analyze-job', methods=['POST'])
def analyze_job():
    """
    Analyze job description and extract categorized keywords
    
    Expected payload:
    {
        "company": "Google",
        "role": "Senior Software Engineer", 
        "jobDescription": "..."
    }
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No JSON data provided'}), 400
            
        company = data.get('company', '').strip()
        role = data.get('role', '').strip()
        job_description = data.get('jobDescription', '').strip()
        
        if not all([company, role, job_description]):
            return jsonify({'error': 'Missing required fields: company, role, jobDescription'}), 400
        
        logger.info(f"Analyzing job: {company} - {role}")
        
        # Extract and categorize keywords
        analysis = keyword_extractor.analyze_job_description(
            job_description, role
        )
        
        # Create session record
        session_id = db_manager.create_session(company, role, job_description, analysis)
        
        return jsonify({
            'success': True,
            'session_id': session_id,
            'analysis': analysis
        })
        
    except Exception as e:
        logger.error(f"Error in analyze_job: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/generate-section', methods=['POST'])
def generate_section():
    """
    Generate content for a specific resume section
    
    Expected payload:
    {
        "session_id": "uuid",
        "section_type": "summary",
        "selected_keywords": ["React", "Node.js", "Leadership"],
        "base_content": "Current section content...",
        "preferences": {"tone": "professional", "length": "medium"}
    }
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No JSON data provided'}), 400
            
        session_id = data.get('session_id')
        section_type = data.get('section_type')
        selected_keywords = data.get('selected_keywords', [])
        base_content = data.get('base_content', '')
        preferences = data.get('preferences', {})
        
        if not all([session_id, section_type]):
            return jsonify({'error': 'Missing required fields: session_id, section_type'}), 400
            
        if not selected_keywords:
            return jsonify({'error': 'At least one keyword must be selected'}), 400
        
        logger.info(f"Generating {section_type} section with {len(selected_keywords)} keywords")
        
        # Get session data for context
        session_data = db_manager.get_session(session_id)
        if not session_data:
            return jsonify({'error': 'Invalid session_id'}), 400
        
        # Check if human-natural generation is requested
        use_human_natural = preferences.get('human_natural', False)
        
        if use_human_natural:
            # Generate with human-natural approach
            generation_result = section_generator.generate_human_natural_section(
                section_type=section_type,
                selected_keywords=selected_keywords,
                base_content=base_content,
                job_context=session_data['analysis_data'],
                preferences=preferences
            )
            
            generated_content = generation_result.get('best_content', '')
            
            # Save section version with enhanced metadata
            version_id = db_manager.save_section_version(
                session_id=session_id,
                section_type=section_type,
                content=generated_content,
                keywords=selected_keywords
            )
            
            return jsonify({
                'success': True,
                'content': generated_content,
                'version_id': version_id,
                'generation_result': generation_result
            })
        else:
            # Use original generation method
            generated_content = section_generator.generate_section(
                section_type=section_type,
                selected_keywords=selected_keywords,
                base_content=base_content,
                job_context=session_data['analysis_data'],
                preferences=preferences
            )
            
            # Save section version
            version_id = db_manager.save_section_version(
                session_id=session_id,
                section_type=section_type,
                content=generated_content,
                keywords=selected_keywords
            )
            
            return jsonify({
                'success': True,
                'content': generated_content,
                'version_id': version_id
            })
        
    except Exception as e:
        logger.error(f"Error in generate_section: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/preview-resume', methods=['POST'])
def preview_resume():
    """
    Generate live preview of complete resume
    
    Expected payload:
    {
        "session_id": "uuid",
        "sections": {
            "summary": "Generated summary content...",
            "skills": "Generated skills content...",
            "experience": ["bullet1", "bullet2", "bullet3"]
        }
    }
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No JSON data provided'}), 400
            
        session_id = data.get('session_id')
        sections = data.get('sections', {})
        
        if not session_id:
            return jsonify({'error': 'Missing session_id'}), 400
        
        # Get session data
        session_data = db_manager.get_session(session_id)
        if not session_data:
            return jsonify({'error': 'Invalid session_id'}), 400
        
        # Generate preview
        preview_data = resume_processor.create_preview(
            sections=sections,
            job_info={
                'company': session_data['company'],
                'role': session_data['role']
            }
        )
        
        return jsonify({
            'success': True,
            'preview': preview_data
        })
        
    except Exception as e:
        logger.error(f"Error in preview_resume: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/export-resume', methods=['POST'])
def export_resume():
    """
    Export complete resume in specified format
    
    Expected payload:
    {
        "session_id": "uuid",
        "sections": {...},
        "format": "pdf",  // "pdf", "docx", "latex"
        "template": "modern"
    }
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No JSON data provided'}), 400
            
        session_id = data.get('session_id')
        sections = data.get('sections', {})
        export_format = data.get('format', 'pdf')
        template = data.get('template', 'modern')
        
        if not session_id:
            return jsonify({'error': 'Missing session_id'}), 400
        
        # Get session data
        session_data = db_manager.get_session(session_id)
        if not session_data:
            return jsonify({'error': 'Invalid session_id'}), 400
        
        # Generate and export resume
        file_path = resume_processor.export_resume(
            sections=sections,
            format=export_format,
            template=template,
            job_info={
                'company': session_data['company'],
                'role': session_data['role']
            }
        )
        
        # Save to resume library
        db_manager.save_to_library(
            session_id=session_id,
            file_path=file_path,
            format=export_format
        )
        
        return send_file(
            file_path,
            as_attachment=True,
            download_name=f"{session_data['company']}_{session_data['role']}_Resume.{export_format}"
        )
        
    except Exception as e:
        logger.error(f"Error in export_resume: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/resume-library', methods=['GET'])
def get_resume_library():
    """Get list of saved resumes"""
    try:
        resumes = db_manager.get_resume_library()
        return jsonify({
            'success': True,
            'resumes': resumes
        })
        
    except Exception as e:
        logger.error(f"Error in get_resume_library: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/session/<session_id>', methods=['GET'])
def get_session(session_id):
    """Get session data"""
    try:
        session_data = db_manager.get_session(session_id)
        if not session_data:
            return jsonify({'error': 'Session not found'}), 404
            
        return jsonify({
            'success': True,
            'session': session_data
        })
        
    except Exception as e:
        logger.error(f"Error in get_session: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/base-resume', methods=['GET'])
def get_base_resume():
    """Get base resume content"""
    try:
        base_content = resume_parser.get_base_resume_content()
        
        return jsonify({
            'success': True,
            'base_resume': base_content
        })
        
    except Exception as e:
        logger.error(f"Error getting base resume: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/template-export', methods=['POST'])
def export_with_template():
    """Export resume using template patching"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No JSON data provided'}), 400
            
        session_id = data.get('session_id')
        sections = data.get('sections', {})
        template_name = data.get('template', 'placeholder_resume.docx')
        
        if not session_id:
            return jsonify({'error': 'Missing session_id'}), 400
        
        # Get session data
        session_data = db_manager.get_session(session_id)
        if not session_data:
            return jsonify({'error': 'Invalid session_id'}), 400
        
        # Patch resume template
        output_path = document_patcher.patch_resume_template(
            sections=sections,
            session_data=session_data,
            template_name=template_name
        )
        
        # Save to resume library
        db_manager.save_to_library(
            session_id=session_id,
            file_path=output_path,
            format="docx"
        )
        
        return send_file(
            output_path,
            as_attachment=True,
            download_name=f"{session_data['company']}_{session_data['role']}_Resume.docx"
        )
        
    except Exception as e:
        logger.error(f"Error in template export: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/preview-document', methods=['POST'])
def preview_document():
    """Generate and serve document for preview"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No JSON data provided'}), 400
            
        session_id = data.get('session_id')
        sections = data.get('sections', {})
        template_name = data.get('template', 'placeholder_resume.docx')
        
        # Debug: Log what data we're receiving
        logger.info(f"Preview request - Session: {session_id}")
        logger.info(f"Preview request - Sections: {sections}")
        
        if not session_id:
            return jsonify({'error': 'Missing session_id'}), 400
        
        # Get session data
        session_data = db_manager.get_session(session_id)
        if not session_data:
            return jsonify({'error': 'Invalid session_id'}), 400
        
        # Patch resume template
        output_path = document_patcher.patch_resume_template(
            sections=sections,
            session_data=session_data,
            template_name=template_name
        )
        
        filename = os.path.basename(output_path)
        document_url = f"http://localhost:5001/api/serve-document/{filename}"
        
        # Try to convert to HTML for preview
        try:
            import pypandoc
            
            # Convert Word document to HTML
            html_filename = filename.replace('.docx', '.html')
            html_path = os.path.join(os.path.dirname(output_path), html_filename)
            
            # Convert with pandoc
            pypandoc.convert_file(output_path, 'html', outputfile=html_path)
            
            html_url = f"http://localhost:5001/api/serve-document/{html_filename}"
            
            return jsonify({
                'document_url': document_url,  # Word document for download
                'preview_url': html_url,       # HTML for preview
                'filename': filename,
                'preview_type': 'html'
            })
            
        except Exception as e:
            logger.warning(f"Could not generate HTML preview: {e}")
            
            # Fallback to direct document
            return jsonify({
                'document_url': document_url,
                'filename': filename,
                'preview_type': 'direct'
            })
        
    except Exception as e:
        logger.error(f"Error in preview document: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/serve-document/<filename>', methods=['GET'])
def serve_document(filename):
    """Serve generated document files"""
    try:
        output_dir = os.path.join(os.path.dirname(__file__), 'output')
        file_path = os.path.join(output_dir, filename)
        
        if not os.path.exists(file_path):
            return jsonify({'error': 'Document not found'}), 404
        
        # Determine MIME type based on file extension
        if filename.endswith('.html'):
            mimetype = 'text/html'
        elif filename.endswith('.docx'):
            mimetype = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        else:
            mimetype = 'application/octet-stream'
            
        return send_file(
            file_path,
            as_attachment=False,
            mimetype=mimetype
        )
        
    except Exception as e:
        logger.error(f"Error serving document: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/relevant-experience', methods=['POST'])
def get_relevant_experience():
    """Get relevant experience based on keywords"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No JSON data provided'}), 400
            
        keywords = data.get('keywords', [])
        
        if not keywords:
            return jsonify({'error': 'No keywords provided'}), 400
        
        # Search for relevant experiences
        relevant_exp = resume_parser.search_experiences_by_keywords(keywords)
        
        return jsonify({
            'success': True,
            'relevant_experiences': relevant_exp
        })
        
    except Exception as e:
        logger.error(f"Error getting relevant experience: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/template-preview', methods=['GET'])
def get_template_preview():
    """
    Get template preview content for display
    
    Returns:
        Template structure with placeholders for preview
    """
    try:
        template_content = template_preview.get_template_preview()
        
        return jsonify({
            'success': True,
            'template': template_content
        })
        
    except Exception as e:
        logger.error(f"Error in template_preview: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/live-preview', methods=['POST'])
def get_live_preview():
    """
    Generate live preview with user's content and keyword highlighting
    
    Expected payload:
    {
        "sections": {
            "summary": "Generated summary text",
            "skills": "Generated skills text", 
            "experience": ["Generated bullet 1", "Generated bullet 2"]
        },
        "keywords": ["Python", "React", "AWS"]
    }
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No JSON data provided'}), 400
        
        sections = data.get('sections', {})
        keywords = data.get('keywords', [])
        
        preview_content = template_preview.generate_live_preview(
            sections=sections,
            selected_keywords=keywords
        )
        
        return jsonify({
            'success': True,
            'preview': preview_content
        })
        
    except Exception as e:
        logger.error(f"Error in live_preview: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/validate-content', methods=['POST'])
def validate_content():
    """
    Validate content for human-naturalness and space constraints
    
    Expected payload:
    {
        "content": "Text to validate",
        "content_type": "summary", // "summary", "experience_bullet", "skills"
        "keywords": ["Python", "React"] // for keyword density check
    }
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No JSON data provided'}), 400
        
        content = data.get('content', '')
        content_type = data.get('content_type', 'summary')
        keywords = data.get('keywords', [])
        
        if not content:
            return jsonify({'error': 'Content is required'}), 400
        
        # Validate human-naturalness
        human_validation = section_generator.human_enhancer.validate_human_naturalness(content, content_type)
        
        # Validate space constraints
        space_validation = section_generator.space_optimizer.check_format_constraints(content, content_type)
        
        # Get optimization suggestions
        space_suggestions = section_generator.space_optimizer.suggest_improvements(content, content_type)
        
        # Calculate additional metrics
        char_count = len(content)
        line_count = section_generator.space_optimizer.calculate_line_count(content, content_type)
        keyword_count = section_generator._count_keywords_in_text(content, keywords)
        
        validation_result = {
            'content_metrics': {
                'char_count': char_count,
                'line_count': line_count,
                'keyword_count': keyword_count,
                'keyword_density': keyword_count / len(keywords) if keywords else 0
            },
            'human_validation': human_validation,
            'space_validation': space_validation,
            'suggestions': space_suggestions,
            'overall_score': (human_validation['overall_score'] + (1.0 if space_validation['overall_valid'] else 0.5)) / 2
        }
        
        return jsonify({
            'success': True,
            'validation': validation_result
        })
        
    except Exception as e:
        logger.error(f"Error in validate_content: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/emails/sync', methods=['POST'])
def sync_emails():
    """Sync recent emails and process with comprehensive workflow"""
    try:
        # Get request parameters
        data = request.get_json() or {}
        days_back = data.get('days_back', 14)
        max_results = data.get('max_results', 50)
        force_reprocess = data.get('force_reprocess', False)
        
        logger.info(f"EMAIL SYNC: Processing emails from past {days_back} days (max {max_results})")
        
        # Use unified email service for comprehensive processing
        result = unified_email_service.process_emails_comprehensive(
            days_back=days_back,
            max_results=max_results,
            force_reprocess=force_reprocess
        )
        
        if not result["success"]:
            return jsonify({
                "success": False,
                "error": result.get("error", "Email processing failed"),
                "data": {
                    "emails_processed": 0,
                    "email_activities": [],
                    "attention_items": [],
                    "quick_updates": [],
                    "upcoming_events": []
                }
            }), 500
        
        # Get formatted dashboard data
        dashboard_result = unified_email_service.get_email_activities(days_back=days_back, limit=max_results)
        
        return jsonify({
            "success": True,
            "data": dashboard_result.get("data", {}),
            "summary": {
                "total_emails": result.get("total_emails", 0),
                "processed_count": result.get("processed_count", 0),
                "companies_created": result.get("companies_created", 0),
                "contacts_created": result.get("contacts_created", 0),
                "jobs_created": result.get("jobs_created", 0)
            },
            "message": f"Successfully processed {result.get("processed_count", 0)} emails with comprehensive analysis"
        })
        
    except Exception as e:
        logger.error(f"Error syncing emails: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e),
            'data': {
                'emails_processed': 0,
                'email_activities': [],
                'attention_items': [],
                'quick_updates': [],
                'upcoming_events': []
            }
        }), 500

@app.route('/api/emails/activities', methods=['GET'])
def get_email_activities():
    """Get recent email activities from database for dashboard"""
    try:
        # Get query parameters
        days_back = request.args.get('days_back', 14, type=int)
        limit = request.args.get('limit', 50, type=int)
        
        logger.info(f"DASHBOARD: Fetching stored emails from unified service (past {days_back} days, limit {limit})")
        
        # Use unified email service for fast database retrieval
        result = unified_email_service.get_email_activities(days_back=days_back, limit=limit)
        
        if not result['success']:
            return jsonify({
                'success': False,
                'error': result.get('error', 'Failed to fetch email activities'),
                'data': {
                    'emails_processed': 0,
                    'email_activities': [],
                    'attention_items': [],
                    'quick_updates': [],
                    'upcoming_events': []
                }
            }), 500
        
        return jsonify({
            'success': True,
            'data': result.get('data', {}),
            'message': f'Loaded {result.get("emails_count", 0)} emails from database'
        })
        
    except Exception as e:
        logger.error(f"Error fetching email activities: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e),
            'data': {
                'emails_processed': 0,
                'email_activities': [],
                'attention_items': [],
                'quick_updates': [],
                'upcoming_events': []
            }
        }), 500

# Add background email processing endpoint
@app.route('/api/emails/background-sync', methods=['POST'])
def background_sync_emails():
    """Background email processing - lightweight sync for dashboard updates"""
    try:
        # Get request parameters (smaller defaults for background)
        data = request.get_json() or {}
        days_back = data.get('days_back', 1)  # Only check last day for background
        max_results = data.get('max_results', 20)  # Fewer emails for speed
        
        logger.info(f"BACKGROUND SYNC: Processing emails from past {days_back} days (max {max_results})")
        
        # Use unified email service for background processing
        result = unified_email_service.process_new_emails_background(
            days_back=days_back,
            max_results=max_results
        )
        
        return jsonify({
            'success': result['success'],
            'new_emails_count': result.get('new_emails_count', 0),
            'processed_count': result.get('processed_count', 0),
            'message': f'Background sync: {result.get("processed_count", 0)} new emails processed'
        })
        
    except Exception as e:
        logger.error(f"Error in background email sync: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e),
            'new_emails_count': 0,
            'processed_count': 0
        }), 500

# Old email helper functions are now replaced by the unified service

@app.route('/health', methods=['GET'])
def health_check():
    """Enhanced health check including Gmail connectivity"""
    # Test database connection
    try:
        if db_config.is_postgresql():
            with db_manager.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT 1")
                db_status = "connected"
        else:
            with db_manager.get_connection() as conn:
                conn.execute("SELECT 1")
                db_status = "connected"
    except Exception as e:
        logger.error(f"Database connection failed: {e}")
        db_status = "disconnected"
    
    # Test Gmail connection
    gmail_status = False
    try:
        from services.gmail_service import GmailService
        gmail = GmailService()
        gmail_status = gmail.test_connection()
    except Exception as e:
        logger.error(f"Gmail connection test failed: {e}")
        gmail_status = False
    
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat(),
        'lm_studio_connected': lm_studio.test_connection(),
        'gmail_connected': gmail_status,
        'database_status': db_status,
        'database_type': 'postgresql' if db_config.is_postgresql() else 'sqlite'
    })

if __name__ == '__main__':
    # Check connections on startup
    if lm_studio.test_connection():
        logger.info("✅ LM Studio connected successfully")
    else:
        logger.warning("⚠️ LM Studio not available - using fallback responses")
    
    # Test Gmail connection
    try:
        from services.gmail_service import GmailService
        gmail = GmailService()
        if gmail.test_connection():
            logger.info("✅ Gmail connected successfully")
        else:
            logger.warning("⚠️ Gmail not connected - check credentials")
    except Exception as e:
        logger.warning(f"⚠️ Gmail connection failed: {e}")
    
    logger.info("🚀 Starting Interactive Resume Builder API")
    logger.info("📝 Frontend: http://localhost:3000")
    logger.info("🔧 API: http://localhost:5001")
    
    app.run(
        host='0.0.0.0',
        port=5001,
        debug=True
    )