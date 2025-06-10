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
from services.section_generator import SectionGenerator
from services.resume_processor import ResumeProcessor
from services.database import DatabaseManager
from services.supabase_manager import SupabaseDatabaseManager
from services.resume_parser import ResumeParser
from services.document_patcher import DocumentPatcher
from services.template_preview import TemplatePreviewService
from config.database_config import db_config

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
CORS(app)  # Allow all origins for development

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

# Initialize database
db_manager.init_database()

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
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
    
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat(),
        'lm_studio_connected': lm_studio.test_connection(),
        'database_status': db_status,
        'database_type': 'postgresql' if db_config.is_postgresql() else 'sqlite'
    })

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
        
        # Generate section content
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

if __name__ == '__main__':
    # Check LM Studio connection on startup
    if lm_studio.test_connection():
        logger.info("✅ LM Studio connected successfully")
    else:
        logger.warning("⚠️ LM Studio not available - using fallback responses")
    
    logger.info("🚀 Starting Interactive Resume Builder API")
    logger.info("📝 Frontend: http://localhost:5173")
    logger.info("🔧 API: http://localhost:5001")
    
    app.run(
        host='0.0.0.0',
        port=5001,
        debug=True
    )