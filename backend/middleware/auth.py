"""
Authentication Middleware
Simple JWT validation for production environments
"""

import os
import jwt
from functools import wraps
from flask import request, jsonify
from typing import Optional, Dict, Any

class AuthMiddleware:
    def __init__(self):
        self.enabled = os.getenv('AUTH_ENABLED', 'false').lower() == 'true'
        self.secret_key = os.getenv('JWT_SECRET_KEY', 'dev-secret-key')
        self.algorithm = 'HS256'
    
    def verify_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Verify JWT token and return payload"""
        if not self.enabled:
            return {'user_id': 'dev-user', 'email': 'dev@local.test'}
        
        try:
            # Remove 'Bearer ' prefix if present
            if token.startswith('Bearer '):
                token = token[7:]
            
            payload = jwt.decode(
                token,
                self.secret_key,
                algorithms=[self.algorithm]
            )
            return payload
        except jwt.ExpiredSignatureError:
            return None
        except jwt.InvalidTokenError:
            return None
    
    def require_auth(self, f):
        """Decorator to require authentication for routes"""
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Skip auth in development
            if not self.enabled:
                request.user = {'user_id': 'dev-user', 'email': 'dev@local.test'}
                return f(*args, **kwargs)
            
            # Check for Authorization header
            auth_header = request.headers.get('Authorization')
            if not auth_header:
                return jsonify({'error': 'No authorization header'}), 401
            
            # Verify token
            user_data = self.verify_token(auth_header)
            if not user_data:
                return jsonify({'error': 'Invalid or expired token'}), 401
            
            # Add user data to request
            request.user = user_data
            return f(*args, **kwargs)
        
        return decorated_function
    
    def optional_auth(self, f):
        """Decorator for routes where auth is optional"""
        @wraps(f)
        def decorated_function(*args, **kwargs):
            request.user = None
            
            # Try to get user data if token is provided
            auth_header = request.headers.get('Authorization')
            if auth_header:
                user_data = self.verify_token(auth_header)
                if user_data:
                    request.user = user_data
            
            return f(*args, **kwargs)
        
        return decorated_function

# Create singleton instance
auth = AuthMiddleware()