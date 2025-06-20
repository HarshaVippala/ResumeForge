#!/usr/bin/env python3
"""
SECURE VERSION OF APP.PY - IMPLEMENTATION EXAMPLE
This shows how to fix the critical security vulnerabilities
"""

import os
import json
import logging
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from marshmallow import Schema, fields, validate
from dotenv import load_dotenv

# Import security middleware
from middleware.auth import require_auth

# Load environment variables
load_dotenv()

# Configure logging with security events
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('security.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)
security_logger = logging.getLogger('security')

# Initialize Flask app
app = Flask(__name__)

# SECURE CORS Configuration - No dynamic origins
allowed_origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001"
]

# Only add production origins if explicitly set
production_origin = os.getenv('PRODUCTION_ORIGIN')
if production_origin:
    allowed_origins.append(production_origin)

CORS(app, 
     resources={
         r"/api/*": {
             "origins": allowed_origins,
             "methods": ["GET", "POST"],
             "allow_headers": ["Content-Type", "Authorization"]
         }
     },
     supports_credentials=True
)

# Rate limiting setup
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["200 per day", "50 per hour"],
    storage_uri="memory://"
)

# Input validation schemas
class JobAnalysisSchema(Schema):
    company = fields.Str(
        required=True, 
        validate=validate.Length(min=1, max=100),
        error_messages={'required': 'Company name is required'}
    )
    role = fields.Str(
        required=True, 
        validate=validate.Length(min=1, max=100),
        error_messages={'required': 'Role is required'}
    )
    jobDescription = fields.Str(
        required=True, 
        validate=validate.Length(min=10, max=10000),
        error_messages={'required': 'Job description is required'}
    )
    provider = fields.Str(
        validate=validate.OneOf(['lmstudio', 'openai', 'gemini']),
        missing='lmstudio'
    )

class LinkedInParseSchema(Schema):
    jobUrl = fields.Url(
        required=True,
        error_messages={'required': 'Job URL is required'}
    )

# Security headers middleware
@app.after_request
def add_security_headers(response):
    """Add security headers to all responses"""
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    response.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';"
    return response

# Error handlers
@app.errorhandler(400)
def bad_request(error):
    return jsonify({'error': 'Bad request'}), 400

@app.errorhandler(401) 
def unauthorized(error):
    security_logger.warning(f"Unauthorized access attempt from {request.remote_addr}")
    return jsonify({'error': 'Unauthorized'}), 401

@app.errorhandler(403)
def forbidden(error):
    security_logger.warning(f"Forbidden access attempt from {request.remote_addr}")
    return jsonify({'error': 'Forbidden'}), 403

@app.errorhandler(429)
def ratelimit_handler(e):
    security_logger.warning(f"Rate limit exceeded from {request.remote_addr}")
    return jsonify({'error': 'Rate limit exceeded'}), 429

@app.errorhandler(500)
def internal_error(error):
    logger.error(f"Internal server error: {error}")
    return jsonify({'error': 'Internal server error'}), 500

# SECURE API Routes with authentication and validation

@app.route('/api/analyze-job-with-provider', methods=['POST'])
@limiter.limit("10/minute")  # Rate limiting
@require_auth  # Authentication required
def analyze_job_with_provider():
    """
    SECURE version of job analysis with proper validation
    """
    try:
        # Input validation
        schema = JobAnalysisSchema()
        try:
            data = schema.load(request.get_json() or {})
        except Exception as e:
            security_logger.warning(f"Invalid input from user {request.user.get('id', 'unknown')}: {e}")
            return jsonify({'error': 'Invalid input data', 'details': str(e)}), 400
        
        # Log successful authenticated request
        security_logger.info(f"Job analysis request from user {request.user.get('id', 'unknown')}")
        
        # Sanitize inputs (basic example)
        company = data['company'].strip()[:100]
        role = data['role'].strip()[:100] 
        job_description = data['jobDescription'].strip()[:10000]
        provider = data['provider']
        
        logger.info(f"Analyzing job with {provider}: {company} - {role}")
        
        # Use secure database operations (parameterized queries)
        # This would be implemented in your database layer
        
        return jsonify({
            'success': True,
            'message': 'Job analysis completed successfully'
        })
        
    except Exception as e:
        logger.error(f"Error in analyze_job_with_provider: {str(e)}")
        return jsonify({'error': 'Analysis failed'}), 500

@app.route('/api/parse-linkedin-job', methods=['POST'])
@limiter.limit("5/minute")  # Stricter rate limiting for external API calls
@require_auth
def parse_linkedin_job():
    """
    SECURE LinkedIn URL parsing with validation
    """
    try:
        # Input validation
        schema = LinkedInParseSchema()
        try:
            data = schema.load(request.get_json() or {})
        except Exception as e:
            return jsonify({'error': 'Invalid input data', 'details': str(e)}), 400
        
        job_url = data['jobUrl']
        
        # Additional URL validation
        if not job_url.startswith('https://www.linkedin.com/jobs/'):
            return jsonify({'error': 'Invalid LinkedIn job URL'}), 400
            
        security_logger.info(f"LinkedIn parsing request from user {request.user.get('id', 'unknown')}")
        
        # Your parsing logic here...
        
        return jsonify({
            'success': True,
            'company': 'Extracted Company',
            'role': 'Extracted Role', 
            'jobDescription': 'Extracted Description'
        })
        
    except Exception as e:
        logger.error(f"Error in parse_linkedin_job: {str(e)}")
        return jsonify({'error': 'Parsing failed'}), 500

@app.route('/api/serve-document/<filename>')
@require_auth
def serve_document(filename):
    """
    SECURE file serving with path traversal protection
    """
    try:
        # Validate filename - prevent path traversal
        if not filename or '..' in filename or '/' in filename or '\\' in filename:
            security_logger.warning(f"Path traversal attempt from user {request.user.get('id', 'unknown')}: {filename}")
            return jsonify({'error': 'Invalid filename'}), 400
        
        # Only allow specific file extensions
        allowed_extensions = {'.pdf', '.docx', '.html'}
        if not any(filename.endswith(ext) for ext in allowed_extensions):
            return jsonify({'error': 'File type not allowed'}), 400
            
        # Validate filename length
        if len(filename) > 255:
            return jsonify({'error': 'Filename too long'}), 400
            
        output_dir = os.path.join(os.path.dirname(__file__), 'output')
        
        # Additional security check - ensure file is in allowed directory
        file_path = os.path.join(output_dir, filename)
        if not file_path.startswith(os.path.abspath(output_dir)):
            security_logger.warning(f"Directory traversal attempt from user {request.user.get('id', 'unknown')}")
            return jsonify({'error': 'Access denied'}), 403
        
        security_logger.info(f"File access: {filename} by user {request.user.get('id', 'unknown')}")
        
        # Use Flask's secure send_from_directory
        return send_from_directory(
            output_dir, 
            filename, 
            as_attachment=True
        )
        
    except FileNotFoundError:
        return jsonify({'error': 'File not found'}), 404
    except Exception as e:
        logger.error(f"Error serving document: {str(e)}")
        return jsonify({'error': 'Failed to serve document'}), 500

@app.route('/api/llm-providers', methods=['GET'])
@require_auth
def get_llm_providers():
    """
    Get available LLM providers - requires authentication
    """
    try:
        # This would use your existing LLMFactory logic
        providers = [
            {
                "name": "lmstudio",
                "display_name": "LMStudio", 
                "available": True,
                "requires_api_key": False
            }
        ]
        
        return jsonify({
            'success': True,
            'providers': providers,
            'current_provider': os.getenv('DEFAULT_LLM_PROVIDER', 'lmstudio')
        })
        
    except Exception as e:
        logger.error(f"Error getting LLM providers: {str(e)}")
        return jsonify({'error': 'Failed to get providers'}), 500

# Health check endpoint (no auth required)
@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'healthy', 'timestamp': datetime.now().isoformat()})

if __name__ == '__main__':
    # SECURE: Debug mode controlled by environment variable
    debug_mode = os.getenv('FLASK_DEBUG', 'False').lower() == 'true'
    
    if debug_mode:
        logger.warning("⚠️ Running in DEBUG mode - not suitable for production!")
    
    # Security startup checks
    required_env_vars = ['JWT_SECRET']
    missing_vars = [var for var in required_env_vars if not os.getenv(var)]
    
    if missing_vars:
        logger.error(f"Missing required environment variables: {missing_vars}")
        exit(1)
    
    logger.info("🔒 Starting SECURE Resume Builder API")
    logger.info(f"🛡️ Security features enabled: Authentication, Rate Limiting, Input Validation")
    
    app.run(
        debug=debug_mode,
        host='127.0.0.1',  # Bind to localhost only
        port=5001
    )