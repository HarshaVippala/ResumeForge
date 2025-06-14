"""
OAuth API endpoints for secure Gmail authentication.
"""
from flask import Blueprint, request, redirect, jsonify, url_for
from services.secure_gmail_auth import SecureGmailAuth
import logging

logger = logging.getLogger(__name__)

oauth_bp = Blueprint('oauth', __name__, url_prefix='/api/oauth')

@oauth_bp.route('/authorize', methods=['GET'])
def authorize():
    """Initiate OAuth flow."""
    try:
        auth_service = SecureGmailAuth()
        authorization_url = auth_service.get_authorization_url()
        return jsonify({
            'authorization_url': authorization_url,
            'message': 'Visit this URL to authorize the application'
        })
    except Exception as e:
        logger.error(f"OAuth authorization error: {str(e)}")
        return jsonify({'error': 'Failed to initialize OAuth flow'}), 500

@oauth_bp.route('/callback', methods=['GET'])
def oauth_callback():
    """Handle OAuth callback."""
    authorization_code = request.args.get('code')
    error = request.args.get('error')
    
    if error:
        logger.error(f"OAuth error: {error}")
        return jsonify({'error': f'Authorization failed: {error}'}), 400
    
    if not authorization_code:
        return jsonify({'error': 'No authorization code received'}), 400
    
    try:
        auth_service = SecureGmailAuth()
        token_data = auth_service.handle_oauth_callback(authorization_code)
        
        return jsonify({
            'message': 'Authentication successful! Gmail integration is now active.',
            'authenticated': True
        })
    except Exception as e:
        logger.error(f"OAuth callback error: {str(e)}")
        return jsonify({'error': 'Failed to complete authentication'}), 500

@oauth_bp.route('/status', methods=['GET'])
def auth_status():
    """Check authentication status."""
    try:
        auth_service = SecureGmailAuth()
        is_authenticated = auth_service.is_authenticated()
        
        return jsonify({
            'authenticated': is_authenticated,
            'message': 'Gmail connected' if is_authenticated else 'Gmail not connected'
        })
    except Exception as e:
        logger.error(f"Auth status check error: {str(e)}")
        return jsonify({
            'authenticated': False,
            'error': 'Failed to check authentication status'
        }), 500

@oauth_bp.route('/revoke', methods=['POST'])
def revoke_auth():
    """Revoke authentication (delete local tokens)."""
    try:
        auth_service = SecureGmailAuth()
        # Remove the token file
        if auth_service.token_file.exists():
            auth_service.token_file.unlink()
        
        return jsonify({
            'message': 'Authentication revoked successfully',
            'authenticated': False
        })
    except Exception as e:
        logger.error(f"Auth revocation error: {str(e)}")
        return jsonify({'error': 'Failed to revoke authentication'}), 500