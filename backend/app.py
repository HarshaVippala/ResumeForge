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
CORS(app, resources={r"/api/*": {"origins": ["http://localhost:3000", "http://localhost:3001"]}, 
                     r"/health": {"origins": ["http://localhost:3000", "http://localhost:3001"]}},
     supports_credentials=True)

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

def extract_email_details(lm_studio, email_content):
    """
    Extract detailed information from email using LM Studio
    """
    try:
        extraction_prompt = f"""
Extract information from this email. Find actual company names, email addresses, and details.

EMAIL:
{email_content}

Look for:
- Company names mentioned in the email text or signature
- Email addresses in From: line or content  
- Person's full name
- Job titles/positions mentioned
- Interview dates, times, platforms

Return JSON with actual values found (leave empty if not found):
{{
  "type": "recruiter",
  "company": "",
  "recruiter_name": "",
  "recruiter_email": "",
  "position": "",
  "urgency": "medium"
}}"""

        # Get email extraction model config
        from config.model_config import get_model_config
        email_config = get_model_config("email_extraction")
        
        # Call LM Studio with timeout protection
        logger.info(f"EMAIL EXTRACTION: Calling LM Studio for email {email_content[:100]}...")
        response = lm_studio.generate_completion(
            prompt=extraction_prompt,
            max_tokens=email_config["max_tokens"],
            temperature=email_config["temperature"],
            model=email_config["model"]
        )
        
        if response:
            logger.info(f"EMAIL EXTRACTION: LM Studio raw response: {response}")
            # Try to parse JSON response with improved extraction
            try:
                # Remove markdown code blocks if present
                clean_response = response.replace('```json', '').replace('```', '')
                
                # Find the first complete JSON object
                json_start = clean_response.find('{')
                if json_start >= 0:
                    # Find the matching closing brace
                    brace_count = 0
                    json_end = json_start
                    for i in range(json_start, len(clean_response)):
                        if clean_response[i] == '{':
                            brace_count += 1
                        elif clean_response[i] == '}':
                            brace_count -= 1
                            if brace_count == 0:
                                json_end = i + 1
                                break
                    
                    if json_end > json_start:
                        json_str = clean_response[json_start:json_end]
                        extracted_data = json.loads(json_str)
                        logger.info(f"EMAIL EXTRACTION: Successfully parsed: {extracted_data}")
                        
                        # Ensure all required fields are present with default values
                        complete_data = {
                            'type': extracted_data.get('type', 'other'),
                            'company': extracted_data.get('company', 'Unknown Company'),
                            'recruiter_name': extracted_data.get('recruiter_name', ''),
                            'recruiter_email': extracted_data.get('recruiter_email', ''),
                            'recruiter_phone': extracted_data.get('recruiter_phone', ''),
                            'position': extracted_data.get('position', ''),
                            'client_company': extracted_data.get('client_company', ''),
                            'interview_date': extracted_data.get('interview_date', ''),
                            'interview_time': extracted_data.get('interview_time', ''),
                            'interview_platform': extracted_data.get('interview_platform', ''),
                            'interview_link': extracted_data.get('interview_link', ''),
                            'salary_range': extracted_data.get('salary_range', ''),
                            'location': extracted_data.get('location', ''),
                            'urgency': extracted_data.get('urgency', 'medium'),
                            'action_required': extracted_data.get('action_required', '')
                        }
                        
                        logger.info(f"EMAIL EXTRACTION: Complete data: {complete_data}")
                        return complete_data
                        
            except json.JSONDecodeError as e:
                logger.warning(f"Failed to parse LM Studio JSON response: {response}, Error: {e}")
        else:
            logger.warning("EMAIL EXTRACTION: No response from LM Studio")
        
        # Fallback to keyword-based extraction
        logger.info("EMAIL EXTRACTION: Using fallback extraction")
        return fallback_extract_email_details(email_content)
        
    except Exception as e:
        logger.error(f"Error in LM Studio email extraction: {e}")
        return fallback_extract_email_details(email_content)

def fallback_extract_email_details(email_content):
    """
    Fallback extraction using simple keyword matching
    """
    content_lower = email_content.lower()
    
    # Determine email type
    email_type = 'other'
    if any(word in content_lower for word in ['interview', 'meeting', 'call', 'schedule']):
        email_type = 'interview'
    elif any(word in content_lower for word in ['reject', 'unfortunately', 'not move forward', 'not selected']):
        email_type = 'rejection'
    elif any(word in content_lower for word in ['recruiter', 'opportunity', 'position', 'role']):
        email_type = 'recruiter'
    elif any(word in content_lower for word in ['follow up', 'update', 'status', 'next steps']):
        email_type = 'follow_up'
    
    # Extract company from sender domain
    company = 'Unknown Company'
    if 'from:' in content_lower:
        sender_match = re.search(r'from: .*@([^.\s]+)', content_lower)
        if sender_match:
            domain = sender_match.group(1)
            if domain not in ['gmail', 'outlook', 'yahoo', 'hotmail']:
                company = domain.title()
    
    return {
        'type': email_type,
        'company': company,
        'recruiter_name': '',
        'position': '',
        'urgency': 'medium'
    }

@app.route('/api/emails/sync', methods=['POST'])
def sync_emails():
    """Sync recent emails and process with simplified workflow"""
    try:
        from services.gmail_service import GmailService
        
        # Initialize Gmail service
        gmail = GmailService()
        
        # Get emails from past 5 days for initial sync
        recent_emails = gmail.get_recent_emails(days_back=5, max_results=50)
        
        # Format results for dashboard
        dashboard_data = {
            'emails_processed': len(recent_emails),
            'email_activities': [],
            'attention_items': [],
            'quick_updates': [],
            'upcoming_events': [],
            'total_applications': 0,
            'interviews_scheduled': 0,
            'response_rate': 0,
            'active_resumes': 0
        }
        
        # Enhanced processing with LM Studio for detailed extraction
        interview_count = 0
        rejection_count = 0
        follow_up_count = 0
        
        # Initialize LM Studio for detailed extraction
        lm_studio = LMStudioClient()
        
        # Initialize job tracking integrator
        from services.email_job_integrator import EmailJobIntegrator
        job_integrator = EmailJobIntegrator()
        
        for email in recent_emails:
            try:
                # Get full email content for analysis
                email_content = f"Subject: {email['subject']}\nFrom: {email['sender']}\nContent: {email['snippet']}"
                
                # Use LM Studio to extract detailed information
                extracted_info = extract_email_details(lm_studio, email_content)
                
                # Use extracted information or fall back to simple classification
                email_type = extracted_info.get('type', 'other')
                company = extracted_info.get('company', 'Unknown Company')
                recruiter_name = extracted_info.get('recruiter_name', '')
                position = extracted_info.get('position', '')
                
                # Count types
                if email_type == 'interview':
                    interview_count += 1
                elif email_type == 'rejection':
                    rejection_count += 1
                elif email_type == 'follow_up':
                    follow_up_count += 1
                
                # Generate summary of email content
                def generate_summary(email_type, company, position, recruiter_name):
                    if email_type == 'interview':
                        if position and recruiter_name:
                            return f"Interview invitation for {position} role from {recruiter_name}"
                        elif position:
                            return f"Interview invitation for {position} role"
                        else:
                            return "Interview invitation received"
                    elif email_type == 'recruiter':
                        if position and company:
                            return f"Job opportunity for {position} at {company}"
                        elif position:
                            return f"Job opportunity for {position}"
                        else:
                            return "New job opportunity from recruiter"
                    elif email_type == 'rejection':
                        if company:
                            return f"Application status update from {company}"
                        else:
                            return "Application status update received"
                    elif email_type == 'follow_up':
                        if company:
                            return f"Follow-up needed for application at {company}"
                        else:
                            return "Follow-up required for application"
                    else:
                        return "Job-related communication received"
                
                summary = generate_summary(email_type, company, position, recruiter_name)

                # Create email activity record with detailed extracted information
                email_activity = {
                    'id': email['id'],
                    'company': company,
                    'subject': email['subject'],
                    'sender': email['sender'],
                    'timestamp': email['date'].isoformat(),
                    'content': email['snippet'][:200] + '...' if len(email['snippet']) > 200 else email['snippet'],
                    'summary': summary,
                    'status': 'unread' if email['is_unread'] else 'read',
                    'type': email_type,
                    'extracted_details': {
                        'recruiter_name': recruiter_name,
                        'position': position,
                        'client_company': extracted_info.get('client_company', ''),
                        'recruiter_email': extracted_info.get('recruiter_email', ''),
                        'recruiter_phone': extracted_info.get('recruiter_phone', ''),
                        'interview_date': extracted_info.get('interview_date', ''),
                        'interview_time': extracted_info.get('interview_time', ''),
                        'interview_platform': extracted_info.get('interview_platform', ''),
                        'interview_link': extracted_info.get('interview_link', ''),
                        'salary_range': extracted_info.get('salary_range', ''),
                        'location': extracted_info.get('location', ''),
                        'urgency': extracted_info.get('urgency', 'medium'),
                        'action_required': extracted_info.get('action_required', '')
                    }
                }
                
                dashboard_data['email_activities'].append(email_activity)
                
                # Integrate with job tracking system
                try:
                    job_match = job_integrator.process_email_for_job_tracking(email, extracted_info)
                    logger.info(f"Email integrated with job tracking: {job_match.match_reason}")
                    
                    # Add job tracking info to email activity
                    email_activity['job_tracking'] = {
                        'job_opportunity_id': job_match.job_opportunity_id,
                        'company_id': job_match.company_id,
                        'is_new_opportunity': job_match.is_new_opportunity,
                        'confidence_score': job_match.confidence_score
                    }
                except Exception as e:
                    logger.error(f"Failed to integrate email with job tracking: {e}")
                
                # Create attention items with detailed information
                urgency = extracted_info.get('urgency', 'medium')
                action_required = extracted_info.get('action_required', '')
                
                if email_type == 'interview' and email['is_unread']:
                    title = f"Interview: {position}" if position else "New Interview Invitation"
                    description = f"From {recruiter_name} at {company}" if recruiter_name else f"Interview invitation from {company}"
                    if extracted_info.get('interview_date'):
                        description += f" - Scheduled for {extracted_info.get('interview_date')}"
                    if action_required:
                        description += f" - {action_required}"
                    
                    dashboard_data['attention_items'].append({
                        'id': f"interview_{email['id']}",
                        'title': title,
                        'description': description,
                        'priority': 'high' if urgency == 'high' else 'high',
                        'timestamp': email['date'].isoformat(),
                        'relatedEmails': [email['id']],
                        'contact': {
                            'name': recruiter_name,
                            'email': extracted_info.get('recruiter_email', ''),
                            'phone': extracted_info.get('recruiter_phone', '')
                        }
                    })
                elif email_type == 'follow_up' and email['is_unread']:
                    title = f"Follow-up: {position}" if position else "Follow-up Required"
                    description = f"For application at {company}"
                    if recruiter_name:
                        description += f" (Contact: {recruiter_name})"
                    
                    dashboard_data['attention_items'].append({
                        'id': f"followup_{email['id']}",
                        'title': title,
                        'description': description,
                        'priority': 'high' if urgency == 'high' else 'medium',
                        'timestamp': email['date'].isoformat(),
                        'relatedEmails': [email['id']],
                        'contact': {
                            'name': recruiter_name,
                            'email': extracted_info.get('recruiter_email', ''),
                            'phone': extracted_info.get('recruiter_phone', '')
                        }
                    })
                elif email_type == 'rejection':
                    title = f"Status Update: {position}" if position else "Application Update"
                    description = f"Application status update from {company}"
                    if recruiter_name:
                        description += f" ({recruiter_name})"
                    
                    dashboard_data['attention_items'].append({
                        'id': f"rejection_{email['id']}",
                        'title': title,
                        'description': description,
                        'priority': 'low',
                        'timestamp': email['date'].isoformat(),
                        'relatedEmails': [email['id']]
                    })
                elif email_type == 'recruiter' and email['is_unread']:
                    title = f"New Opportunity: {position}" if position else "New Job Opportunity"
                    description = f"From {recruiter_name} at {company}" if recruiter_name else f"Job opportunity from {company}"
                    if extracted_info.get('salary_range'):
                        description += f" - Salary: {extracted_info.get('salary_range')}"
                    
                    dashboard_data['attention_items'].append({
                        'id': f"opportunity_{email['id']}",
                        'title': title,
                        'description': description,
                        'priority': 'high' if urgency == 'high' else 'medium',
                        'timestamp': email['date'].isoformat(),
                        'relatedEmails': [email['id']],
                        'contact': {
                            'name': recruiter_name,
                            'email': extracted_info.get('recruiter_email', ''),
                            'phone': extracted_info.get('recruiter_phone', '')
                        }
                    })
                
                # Create upcoming events for interviews with detailed information
                if email_type == 'interview':
                    interview_date = extracted_info.get('interview_date', 'TBD')
                    interview_time = extracted_info.get('interview_time', 'TBD')
                    interview_platform = extracted_info.get('interview_platform', 'unknown')
                    interview_link = extracted_info.get('interview_link', '')
                    
                    # Only create event if we have some scheduling info or it's mentioned
                    if interview_date != '' or interview_time != '' or interview_platform != 'unknown' or interview_link != '':
                        event_title = f"Interview: {position}" if position else f"Interview with {company}"
                        if recruiter_name:
                            event_title += f" ({recruiter_name})"
                        
                        dashboard_data['upcoming_events'].append({
                            'id': f"event_{email['id']}",
                            'company': company,
                            'type': 'interview',
                            'title': event_title,
                            'date': interview_date or 'TBD',
                            'time': interview_time or 'TBD',
                            'platform': interview_platform or 'unknown',
                            'details': f"Position: {position}\nContact: {recruiter_name}\nPhone: {extracted_info.get('recruiter_phone', 'N/A')}" if position and recruiter_name else email['snippet'][:150] + '...',
                            'link': interview_link or '',
                            'duration': '60 minutes',
                            'contact': {
                                'name': recruiter_name,
                                'email': extracted_info.get('recruiter_email', ''),
                                'phone': extracted_info.get('recruiter_phone', '')
                            }
                        })
                    
            except Exception as e:
                logger.error(f"Error processing email {email.get('id')}: {e}")
                continue
        
        # Add quick updates based on email analysis
        if interview_count > 0:
            dashboard_data['quick_updates'].append({
                'id': 'interview_summary',
                'title': 'Interview Activity',
                'summary': f'{interview_count} interview-related emails in the past 5 days',
                'timestamp': datetime.utcnow().isoformat()
            })
        
        if rejection_count > 0:
            dashboard_data['quick_updates'].append({
                'id': 'rejection_summary',
                'title': 'Application Status',
                'summary': f'{rejection_count} application status updates received',
                'timestamp': datetime.utcnow().isoformat()
            })
        
        if follow_up_count > 0:
            dashboard_data['quick_updates'].append({
                'id': 'followup_summary',
                'title': 'Follow-ups Needed',
                'summary': f'{follow_up_count} applications may need follow-up',
                'timestamp': datetime.utcnow().isoformat()
            })
        
        # Add general insights
        dashboard_data['quick_updates'].append({
            'id': 'email_pattern',
            'title': 'Email Activity Overview',
            'summary': f'Processed {len(recent_emails)} job-related emails from the past 5 days',
            'timestamp': datetime.utcnow().isoformat()
        })
        
        # Update stats
        dashboard_data['total_applications'] = len(recent_emails)
        dashboard_data['interviews_scheduled'] = interview_count
        dashboard_data['response_rate'] = round((interview_count / max(1, len(recent_emails))) * 100) if len(recent_emails) > 0 else 0
        dashboard_data['active_resumes'] = 1  # Default for now
        
        # Sort by timestamp (latest first)
        dashboard_data['email_activities'].sort(key=lambda x: x['timestamp'], reverse=True)
        dashboard_data['attention_items'].sort(key=lambda x: x['timestamp'], reverse=True)
        dashboard_data['quick_updates'].sort(key=lambda x: x['timestamp'], reverse=True)
        
        return jsonify({
            'success': True,
            'data': dashboard_data,
            'message': f'Successfully processed {len(recent_emails)} emails from the past 5 days'
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
                'upcoming_events': [],
                'total_applications': 0,
                'interviews_scheduled': 0,
                'response_rate': 0,
                'active_resumes': 0
            }
        }), 500

@app.route('/api/emails/activities', methods=['GET'])
def get_email_activities():
    """Get recent email activities for dashboard"""
    try:
        # This could be enhanced to fetch from database
        # For now, return mock data structure
        activities = [
            {
                'id': 'mock_1',
                'company': 'Google',
                'subject': 'Thank you for your application',
                'type': 'rejection',
                'timestamp': datetime.utcnow().isoformat(),
                'content': 'Thank you for your interest in the Software Engineer position...',
                'status': 'read',
                'extractedInfo': {
                    'sentiment': 'negative',
                    'urgency': 'low'
                }
            }
        ]
        
        return jsonify({
            'success': True,
            'activities': activities
        })
        
    except Exception as e:
        logger.error(f"Error fetching email activities: {str(e)}")
        return jsonify({'error': str(e)}), 500

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