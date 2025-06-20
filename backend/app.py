#!/usr/bin/env python3
"""
Interactive Resume Builder Backend
Flask API with LM Studio integration for local AI processing
"""

import os
import json
import logging
import sqlite3
import threading
import time
import atexit
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
from services.linkedin_parser import LinkedInParser
from services.llm_factory import LLMFactory
from services.simple_resume_tailor import SimpleResumeTailor

# Security components removed - no auth needed for personal use
# Legacy unified service removed
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

# Import PDF converter at the top of the file
from services.pdf_converter import pdf_converter

# Load environment variables
load_dotenv()

# Configure logging - reduced verbosity for personal use
log_level = getattr(logging, os.getenv('LOG_LEVEL', 'WARNING').upper())
logging.basicConfig(
    level=log_level,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Set specific log levels to reduce noise
logging.getLogger('werkzeug').setLevel(logging.ERROR)  # Only show server errors
logging.getLogger('googleapiclient.discovery_cache').setLevel(logging.ERROR)
logging.getLogger('httpx').setLevel(logging.WARNING)
logging.getLogger('email_processing.services.dashboard_service').setLevel(logging.ERROR)  # Too verbose

# Only log important application events
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)  # Keep main app logs

# Database initialization

# Initialize simple resume tailor
simple_tailor = SimpleResumeTailor()

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
linkedin_parser = LinkedInParser()

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

# Initialize enhanced email service with new architecture
from services.enhanced_email_service import EnhancedEmailService
enhanced_email_service = EnhancedEmailService(db_manager, lm_studio)

# Initialize Gmail real-time sync (for Cloud Pub/Sub setup)
from gmail_realtime_setup import setup_gmail_realtime
gmail_realtime = setup_gmail_realtime(app)

# Background Gmail Sync
class BackgroundEmailSync:
    def __init__(self, email_service):
        self.email_service = email_service
        self.sync_interval = 300  # 5 minutes
        self.is_running = False
        self.thread = None
        
    def start(self):
        if not self.is_running:
            self.is_running = True
            self.thread = threading.Thread(target=self._sync_loop, daemon=True)
            self.thread.start()
            logger.info("🔄 Background email sync started (5 min intervals)")
            
    def stop(self):
        self.is_running = False
        if self.thread:
            logger.info("🛑 Background email sync stopped")
            
    def _sync_loop(self):
        while self.is_running:
            try:
                # Perform incremental sync
                result = self.email_service.refresh_emails_incremental(
                    user_email="me",
                    is_auto_refresh=True
                )
                if result.get('success'):
                    logger.debug(f"🔄 Auto sync: {result.get('message', 'Complete')}")
                else:
                    logger.warning(f"⚠️ Auto sync failed: {result.get('error', 'Unknown error')}")
            except Exception as e:
                logger.error(f"💥 Background sync error: {e}")
            
            # Wait for next sync
            time.sleep(self.sync_interval)

# Initialize background sync
background_sync = BackgroundEmailSync(enhanced_email_service)
atexit.register(background_sync.stop)

# Legacy services removed - using only enhanced_email_service now

# Initialize jobs API
from api.jobs_api import jobs_bp
from api.enhanced_jobs_api import enhanced_jobs_bp
from api.scraping_api import scraping_bp
app.register_blueprint(jobs_bp)
app.register_blueprint(enhanced_jobs_bp)
app.register_blueprint(scraping_bp)

# Initialize applications API
from api.applications_api import applications_bp
app.register_blueprint(applications_bp)

# Initialize Groq analytics API
from api.groq_analytics_api import groq_analytics_bp
app.register_blueprint(groq_analytics_bp)

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

@app.route('/api/parse-linkedin-job', methods=['POST'])
def parse_linkedin_job():
    """
    Parse LinkedIn job URL and extract job information
    
    Expected payload:
    {
        "jobUrl": "https://www.linkedin.com/jobs/view/12345/"
    }
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No JSON data provided'}), 400
            
        job_url = data.get('jobUrl', '').strip()
        
        if not job_url:
            return jsonify({'error': 'Missing required field: jobUrl'}), 400
        
        logger.info(f"Parsing LinkedIn job URL: {job_url}")
        
        # Parse the LinkedIn job URL
        job_data = linkedin_parser.parse_job_url(job_url)
        
        if not job_data.success:
            return jsonify({
                'success': False,
                'error': job_data.error
            }), 400
        
        return jsonify({
            'success': True,
            'company': job_data.company,
            'role': job_data.role,
            'jobDescription': job_data.description
        })
        
    except Exception as e:
        logger.error(f"Error in parse_linkedin_job: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/llm-providers', methods=['GET'])
def get_llm_providers():
    """
    Get list of available LLM providers and their status
    """
    try:
        providers = LLMFactory.list_available_providers()
        current_provider = os.getenv("DEFAULT_LLM_PROVIDER", "lmstudio")
        
        return jsonify({
            'success': True,
            'providers': providers,
            'current_provider': current_provider
        })
        
    except Exception as e:
        logger.error(f"Error getting LLM providers: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/analyze-job-with-provider', methods=['POST'])
def analyze_job_with_provider():
    """
    Analyze job description with specified LLM provider
    
    Expected payload:
    {
        "company": "Google",
        "role": "Senior Software Engineer", 
        "jobDescription": "...",
        "provider": "openai"
    }
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No JSON data provided'}), 400
            
        company = data.get('company', '').strip()
        role = data.get('role', '').strip()
        job_description = data.get('jobDescription', '').strip()
        provider = data.get('provider', 'lmstudio').strip()
        # API keys are now only read from environment variables
        
        if not all([company, role, job_description]):
            return jsonify({'error': 'Missing required fields: company, role, jobDescription'}), 400
        
        logger.info(f"Analyzing job with {provider}: {company} - {role}")
        
        # Create LLM service for the specified provider
        try:
            llm_service = LLMFactory.create_service(provider)
        except ValueError as e:
            return jsonify({'error': str(e)}), 400
        
        # Test connection first
        if not llm_service.is_available():
            return jsonify({
                'error': f'{provider} service is not available. Please check configuration.'
            }), 503
        
        # Analyze job description
        analysis_response = llm_service.analyze_job_description(job_description, role)
        
        if not analysis_response.success:
            return jsonify({
                'error': f'Analysis failed: {analysis_response.error}'
            }), 500
        
        # Parse the analysis content if it's a JSON string
        try:
            if isinstance(analysis_response.content, str):
                import json
                analysis_data = json.loads(analysis_response.content)
            else:
                analysis_data = analysis_response.content
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse analysis JSON: {e}")
            return jsonify({
                'error': 'Failed to parse analysis response from LLM provider'
            }), 500
        
        # Create session record (store the raw content for database)
        session_id = db_manager.create_session(company, role, job_description, analysis_data)
        
        return jsonify({
            'success': True,
            'session_id': session_id,
            'analysis': analysis_data,  # Return parsed object, not string
            'provider_used': provider,
            'usage': analysis_response.usage
        })
        
    except Exception as e:
        logger.error(f"Error in analyze_job_with_provider: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/tailor-resume-complete', methods=['POST'])
def tailor_resume_complete():
    """
    Simple complete resume tailoring for personal use
    
    Expected payload:
    {
        "company": "Google",
        "role": "Senior Software Engineer", 
        "jobDescription": "..."
    }
    
    Returns complete tailored resume with simple insights
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
        
        logger.info(f"Tailoring complete resume for: {company} - {role}")
        
        # Generate complete tailored resume
        tailored_resume, insights = simple_tailor.tailor_resume_complete(
            job_description=job_description,
            company=company,
            role=role
        )
        
        return jsonify({
            'success': True,
            'tailored_resume': tailored_resume,
            'insights': insights,
            'company': company,
            'role': role
        })
        
    except Exception as e:
        logger.error(f"Error in tailor_resume_complete: {str(e)}")
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
        
        # Use enhanced email service for comprehensive processing
        result = enhanced_email_service.process_emails_comprehensive(
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
        dashboard_result = enhanced_email_service.get_email_activities(days_back=days_back, limit=max_results)
        
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

@app.route('/api/emails/sync-enhanced', methods=['POST'])
def sync_emails_enhanced():
    """Enhanced email sync with Groq integration and intelligent processing"""
    try:
        # Get request parameters
        data = request.get_json() or {}
        days_back = data.get('days_back', 14)
        max_results = data.get('max_results', 50)
        force_reprocess = data.get('force_reprocess', False)
        prefer_groq = data.get('prefer_groq', True)
        
        logger.info(f"ENHANCED EMAIL SYNC: Processing emails from past {days_back} days (max {max_results}), prefer_groq={prefer_groq}")
        
        # Use new enhanced email service with multi-stage processing
        result = enhanced_email_service.process_emails_comprehensive(
            days_back=days_back,
            max_results=max_results,
            force_reprocess=force_reprocess,
            prefer_groq=prefer_groq
        )
        
        if not result["success"]:
            return jsonify({
                "success": False,
                "error": result.get("error", "Enhanced email processing failed"),
                "data": {
                    "emails_processed": 0,
                    "email_activities": [],
                    "attention_items": [],
                    "quick_updates": [],
                    "upcoming_events": []
                },
                "processing_summary": result.get("processing_summary", {})
            }), 500
        
        # Get formatted dashboard data
        dashboard_result = enhanced_email_service.get_email_activities(days_back=days_back, limit=max_results)
        
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
            "processing_summary": result.get("processing_summary", {}),
            "recommendations": result.get("recommendations", []),
            "processor_stats": result.get("processor_stats", {}),
            "message": f"Enhanced processing: {result.get('processed_count', 0)} emails processed with intelligent routing"
        })
        
    except Exception as e:
        logger.error(f"Error in enhanced email sync: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e),
            'data': {
                'emails_processed': 0,
                'email_activities': [],
                'attention_items': [],
                'quick_updates': [],
                'upcoming_events': []
            },
            'processing_summary': {'errors': 1}
        }), 500

@app.route('/api/emails/refresh', methods=['POST'])
def refresh_emails_incremental():
    """
    Enhanced incremental email refresh - replaces old days_back approach
    Uses Gmail History API for true incremental sync
    """
    try:
        # Get request parameters
        data = request.get_json() or {}
        is_auto_refresh = data.get('is_auto_refresh', False)
        user_email = data.get('user_email', 'me')
        
        logger.info(f"INCREMENTAL REFRESH: Starting for {user_email}, auto_refresh={is_auto_refresh}")
        
        # Use new enhanced email service with multi-stage processing
        result = enhanced_email_service.refresh_emails_incremental(
            user_email=user_email,
            is_auto_refresh=is_auto_refresh
        )
        
        if result['success']:
            return jsonify({
                'success': True,
                'sync_method': result['sync_method'],
                'emails_processed': result['emails_processed'],
                'new_emails': result['new_emails'],
                'tokens_used': result['tokens_used'],
                'duration_seconds': result['duration_seconds'],
                'data': result.get('dashboard_data', {}),
                'message': result['message']
            })
        else:
            return jsonify({
                'success': False,
                'error': result['error'],
                'sync_method': result.get('sync_method', 'failed'),
                'message': result['message']
            }), 500
            
    except Exception as e:
        logger.error(f"Error in incremental email refresh: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e),
            'sync_method': 'error',
            'message': 'Failed to perform incremental refresh'
        }), 500

@app.route('/api/emails/threads', methods=['GET'])
def get_email_threads():
    """Get threaded dashboard data for email threads view"""
    try:
        # Get query parameters
        days_back = request.args.get('days_back', 14, type=int)
        limit = request.args.get('limit', 50, type=int)
        user_email = request.args.get('user_email', 'me')
        
        logger.info(f"THREADS: Fetching threaded dashboard data (past {days_back} days, limit {limit})")
        
        # Use enhanced email service to get threaded dashboard data
        result = enhanced_email_service.get_threaded_dashboard_data(
            days_back=days_back, 
            limit=limit, 
            user_email=user_email
        )
        
        if not result['success']:
            return jsonify({
                'success': False,
                'error': result.get('error', 'Failed to fetch threaded data'),
                'data': {
                    'email_threads': [],
                    'attention_items': [],
                    'upcoming_events': [],
                    'quick_updates': [],
                    'summary_stats': {}
                }
            }), 500
        
        return jsonify({
            'success': True,
            'data': result.get('data', {}),
            'message': f'Loaded {len(result.get("data", {}).get("email_threads", []))} email threads'
        })
        
    except Exception as e:
        logger.error(f"Error fetching email threads: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e),
            'data': {
                'email_threads': [],
                'attention_items': [],
                'upcoming_events': [],
                'quick_updates': [],
                'summary_stats': {}
            }
        }), 500

@app.route('/api/emails/threads/<thread_id>/emails', methods=['GET'])
def get_thread_emails(thread_id):
    """Get all emails within a specific thread"""
    try:
        logger.info(f"THREAD EMAILS: Fetching emails for thread {thread_id}")
        
        # Use enhanced email service to get thread emails
        result = enhanced_email_service.get_thread_emails(thread_id)
        
        if not result['success']:
            return jsonify({
                'success': False,
                'error': result.get('error', 'Failed to fetch thread emails'),
                'data': []
            }), 500
        
        return jsonify({
            'success': True,
            'data': result.get('data', []),
            'message': f'Loaded {len(result.get("data", []))} emails from thread'
        })
        
    except Exception as e:
        logger.error(f"Error fetching thread emails for {thread_id}: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e),
            'data': []
        }), 500

@app.route('/api/emails/activities', methods=['GET'])
def get_email_activities():
    """Get recent email activities from database for dashboard"""
    try:
        # Get query parameters
        days_back = request.args.get('days_back', 14, type=int)
        limit = request.args.get('limit', 50, type=int)
        
        logger.info(f"DASHBOARD: Fetching stored emails from enhanced service (past {days_back} days, limit {limit})")
        
        # Use new enhanced email service with multi-stage processing
        result = enhanced_email_service.get_email_activities(days_back=days_back, limit=limit)
        
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
        
        # Use enhanced email service for background processing
        result = enhanced_email_service.refresh_emails_incremental(
            user_email="me",
            is_auto_refresh=True
        )
        
        return jsonify({
            'success': result['success'],
            'new_emails_count': result.get('emails_processed', 0),
            'processed_count': result.get('emails_processed', 0),
            'message': f'Background sync: {result.get("emails_processed", 0)} new emails processed'
        })
        
    except Exception as e:
        logger.error(f"Error in background email sync: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e),
            'new_emails_count': 0,
            'processed_count': 0
        }), 500

# Recruiter tracking endpoints
@app.route('/api/recruiters', methods=['GET'])
def get_recruiters():
    """Get list of tracked recruiters with interaction history"""
    try:
        with db_manager.get_connection() as conn:
            cursor = conn.cursor()
            
            # Get active recruiters with interaction counts
            cursor.execute("""
                SELECT 
                    r.id, r.name, r.email, r.agency_name, r.recruiter_type,
                    r.linkedin_url, r.interaction_count, r.last_interaction,
                    r.rating, COUNT(DISTINCT et.thread_id) as active_threads,
                    COUNT(DISTINCT rc.company_id) as companies_represented
                FROM recruiters r
                LEFT JOIN email_threads et ON r.id = et.recruiter_id AND et.status = 'active'
                LEFT JOIN recruiter_companies rc ON r.id = rc.recruiter_id
                WHERE r.is_active = true
                GROUP BY r.id, r.name, r.email, r.agency_name, r.recruiter_type,
                         r.linkedin_url, r.interaction_count, r.last_interaction, r.rating
                ORDER BY r.last_interaction DESC
                LIMIT 50
            """)
            
            recruiters = []
            for row in cursor.fetchall():
                recruiters.append({
                    'id': row[0],
                    'name': row[1],
                    'email': row[2],
                    'agency_name': row[3],
                    'recruiter_type': row[4],
                    'linkedin_url': row[5],
                    'interaction_count': row[6],
                    'last_interaction': row[7].isoformat() if row[7] else None,
                    'rating': row[8],
                    'active_threads': row[9],
                    'companies_represented': row[10]
                })
            
            return jsonify({
                'success': True,
                'recruiters': recruiters,
                'total_count': len(recruiters)
            })
            
    except Exception as e:
        logger.error(f"Error fetching recruiters: {e}")
        return jsonify({
            'success': False,
            'error': str(e),
            'recruiters': []
        }), 500

@app.route('/api/sync/status', methods=['GET'])
def get_sync_status():
    """Get current sync status and metadata"""
    try:
        user_email = request.args.get('user_email', 'me')
        
        with db_manager.get_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT 
                    last_sync_timestamp, last_gmail_date, sync_status,
                    processed_count, tokens_used, error_message, updated_at
                FROM sync_metadata
                WHERE user_email = %s
            """, (user_email,))
            
            row = cursor.fetchone()
            
            if row:
                return jsonify({
                    'success': True,
                    'sync_metadata': {
                        'last_sync_timestamp': row[0].isoformat() if row[0] else None,
                        'last_gmail_date': row[1],
                        'sync_status': row[2],
                        'processed_count': row[3],
                        'tokens_used': row[4],
                        'error_message': row[5],
                        'updated_at': row[6].isoformat() if row[6] else None
                    }
                })
            else:
                return jsonify({
                    'success': True,
                    'sync_metadata': {
                        'last_sync_timestamp': None,
                        'sync_status': 'never_synced',
                        'message': 'No sync history found'
                    }
                })
                
    except Exception as e:
        logger.error(f"Error fetching sync status: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# Old email helper functions are now replaced by the unified service

# =====================================
# AUTHENTICATION ENDPOINTS
# =====================================

# Authentication endpoints removed - no login needed for personal use

# =====================================
# HEALTH CHECK ENDPOINT
# =====================================

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
        from services.secure_gmail_service import SecureGmailService
        gmail = SecureGmailService()
        gmail_status = gmail.test_connection()
    except Exception as e:
        logger.error(f"Gmail connection test failed: {e}")
        gmail_status = False
    
    # Test enhanced email processing system
    email_processing_status = 'healthy'
    try:
        # Use the openai_processor health check method
        health_check = enhanced_email_service.openai_processor.health_check()
        if health_check.get('status') != 'healthy':
            email_processing_status = 'degraded'
    except Exception as e:
        logger.error(f"Email processing health check failed: {e}")
        email_processing_status = 'unhealthy'
    
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'lm_studio_connected': lm_studio.test_connection(),
        'gmail_connected': gmail_status,
        'database_status': db_status,
        'database_type': 'postgresql' if db_config.is_postgresql() else 'sqlite',
        'email_processing_status': email_processing_status,
        'email_architecture': 'multi_stage_groq_enhanced'
          })

@app.route('/api/export-simple-resume', methods=['POST'])
def export_simple_resume():
    """
    Export resume directly from simple tailor results
    
    Expected payload:
    {
        "tailored_resume": {...},  // The complete tailored resume object
        "company": "Google",
        "role": "Senior Software Engineer",
        "format": "docx"  // "docx", "pdf"
    }
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No JSON data provided'}), 400
            
        tailored_resume = data.get('tailored_resume')
        company = data.get('company', 'Company')
        role = data.get('role', 'Position')
        export_format = data.get('format', 'docx')
        
        if not tailored_resume:
            return jsonify({'error': 'Missing tailored_resume data'}), 400
        
        logger.info(f"Exporting simple resume for: {company} - {role} as {export_format}")
        
        # Convert tailored resume to sections format expected by document patcher
        sections = {
            'summary': tailored_resume.get('summary', ''),
            'experience': [],
            'skills': ''
        }
        
        # Convert experience format - extract ALL bullets and let document patcher handle job mapping
        if 'experience' in tailored_resume and tailored_resume['experience']:
            # For the simple tailor, we get tailored bullets that should replace JOB1 bullets
            # The document patcher will handle JOB2 and JOB3 from base resume data
            all_bullets = []
            for exp in tailored_resume['experience']:
                achievements = exp.get('achievements', [])
                all_bullets.extend(achievements)
            
            # Use the tailored bullets for the current position (JOB1)
            sections['experience'] = all_bullets
        
        # Convert skills format to match template expectations
        if 'skills' in tailored_resume:
            skills_data = tailored_resume['skills']
            
            # The template expects specific skill category placeholders
            # Let's format the skills to match the template's structure
            if isinstance(skills_data, dict):
                skills_parts = []
                
                # Map to template's expected skill categories
                skill_mapping = {
                    'languages': 'Languages/Frameworks',
                    'frameworks': 'Cloud/DevOps', 
                    'tools': 'APIs/Integration',
                    'technical': 'Architecture/Design',
                    'databases': 'Databases/Storage',
                    'monitoring': 'Monitoring/Observability',
                    'testing': 'Testing/CI-CD'
                }
                
                for key, label in skill_mapping.items():
                    if key in skills_data and skills_data[key]:
                        skills_list = skills_data[key]
                        if isinstance(skills_list, list):
                            skills_parts.append(f"{label}: {', '.join(skills_list)}")
                        else:
                            skills_parts.append(f"{label}: {skills_list}")
                
                # Join all skill categories with separators that the template expects
                sections['skills'] = ' | '.join(skills_parts)
            else:
                # If skills is already a string, use as-is
                sections['skills'] = str(skills_data)
        
        # Create session data for document patcher
        session_data = {
            'company': company,
            'role': role
        }
        
        if export_format.lower() == 'docx':
            # Use document patcher for DOCX
            logger.debug(f"Using sections for template: {sections}")
            logger.debug(f"Using session data: {session_data}")
            
            output_path = document_patcher.patch_resume_template(
                sections=sections,
                session_data=session_data,
                template_name='placeholder_resume.docx'  # Use the main template
            )
            
            return send_file(
                output_path,
                as_attachment=True,
                download_name=f"{company}_{role}_Resume.docx"
            )
            
        elif export_format.lower() == 'pdf':
            # For PDF, create DOCX first then convert to PDF
            try:
                # First create DOCX using document patcher
                docx_path = document_patcher.patch_resume_template(
                    sections=sections,
                    session_data=session_data,
                    template_name='placeholder_resume.docx'
                )
                
                # Check if PDF conversion is available
                if pdf_converter.is_pdf_conversion_available():
                    # Convert DOCX to PDF
                    pdf_path = pdf_converter.convert_docx_to_pdf(docx_path)
                    
                    return send_file(
                        pdf_path,
                        as_attachment=True,
                        download_name=f"{company}_{role}_Resume.pdf"
                    )
                else:
                    # Fallback to DOCX if PDF conversion not available
                    logger.warning("PDF conversion not available, returning DOCX")
                    return send_file(
                        docx_path,
                        as_attachment=True,
                        download_name=f"{company}_{role}_Resume.docx"
                    )
                    
            except Exception as pdf_error:
                logger.error(f"PDF generation failed: {pdf_error}")
                # Fallback to DOCX if PDF conversion fails
                output_path = document_patcher.patch_resume_template(
                    sections=sections,
                    session_data=session_data,
                    template_name='placeholder_resume.docx'
                )
                
                return send_file(
                    output_path,
                    as_attachment=True,
                    download_name=f"{company}_{role}_Resume.docx"
                )
        else:
            return jsonify({'error': f'Unsupported format: {export_format}'}), 400
            
    except Exception as e:
        logger.error(f"Error in export_simple_resume: {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # Start background email sync
    background_sync.start()
    
    logger.info("🚀 Starting Interactive Resume Builder API")
    logger.info("📝 Frontend: http://localhost:3000")
    logger.info("🔧 API: http://localhost:5001")
    
    app.run(
        host='0.0.0.0',
        port=5001,
        debug=True
    )