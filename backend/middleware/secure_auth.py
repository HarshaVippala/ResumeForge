"""
ENHANCED SECURE AUTHENTICATION MIDDLEWARE
Improved version with better security practices
"""

import jwt
import os
import logging
from functools import wraps
from datetime import datetime, timedelta
from flask import request, jsonify, current_app
import hashlib
import secrets

logger = logging.getLogger(__name__)
security_logger = logging.getLogger('security')

class SecureAuth:
    """Enhanced authentication with security best practices"""
    
    def __init__(self):
        self.jwt_secret = os.getenv('JWT_SECRET')
        self.jwt_algorithm = 'HS256'
        self.token_expiry_hours = int(os.getenv('JWT_EXPIRY_HOURS', '24'))
        
        # Rate limiting for authentication attempts
        self.failed_attempts = {}
        self.max_attempts = 5
        self.lockout_duration = 300  # 5 minutes
        
        if not self.jwt_secret:
            raise ValueError("JWT_SECRET environment variable is required")
    
    def generate_token(self, user_data):
        """Generate a secure JWT token"""
        try:
            payload = {
                'user_id': user_data.get('id'),
                'email': user_data.get('email'),
                'exp': datetime.utcnow() + timedelta(hours=self.token_expiry_hours),
                'iat': datetime.utcnow(),
                'jti': secrets.token_hex(16)  # Unique token ID
            }
            
            token = jwt.encode(payload, self.jwt_secret, algorithm=self.jwt_algorithm)
            
            security_logger.info(f"Token generated for user {user_data.get('id')}")
            return token
            
        except Exception as e:
            logger.error(f"Error generating token: {e}")
            raise
    
    def verify_token(self, token):
        """Verify and decode JWT token"""
        try:
            payload = jwt.decode(
                token, 
                self.jwt_secret, 
                algorithms=[self.jwt_algorithm],
                options={"verify_exp": True}
            )
            return payload
            
        except jwt.ExpiredSignatureError:
            security_logger.warning("Token expired")
            return None
        except jwt.InvalidTokenError as e:
            security_logger.warning(f"Invalid token: {e}")
            return None
        except Exception as e:
            logger.error(f"Error verifying token: {e}")
            return None
    
    def is_rate_limited(self, identifier):
        """Check if IP/user is rate limited"""
        if identifier not in self.failed_attempts:
            return False
            
        attempts, last_attempt = self.failed_attempts[identifier]
        
        # Reset if lockout period has passed
        if datetime.now() - last_attempt > timedelta(seconds=self.lockout_duration):
            del self.failed_attempts[identifier]
            return False
            
        return attempts >= self.max_attempts
    
    def record_failed_attempt(self, identifier):
        """Record a failed authentication attempt"""
        if identifier in self.failed_attempts:
            attempts, _ = self.failed_attempts[identifier]
            self.failed_attempts[identifier] = (attempts + 1, datetime.now())
        else:
            self.failed_attempts[identifier] = (1, datetime.now())
    
    def clear_failed_attempts(self, identifier):
        """Clear failed attempts for successful login"""
        if identifier in self.failed_attempts:
            del self.failed_attempts[identifier]

# Initialize auth instance
auth = SecureAuth()

def require_auth(f):
    """Enhanced authentication decorator with security logging"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        client_ip = request.environ.get('HTTP_X_FORWARDED_FOR', request.remote_addr)
        
        # Check rate limiting
        if auth.is_rate_limited(client_ip):
            security_logger.warning(f"Rate limited authentication attempt from {client_ip}")
            return jsonify({
                'error': 'Too many failed attempts. Please try again later.'
            }), 429
        
        # Get token from header
        auth_header = request.headers.get('Authorization')
        
        if not auth_header:
            security_logger.warning(f"Missing authorization header from {client_ip}")
            auth.record_failed_attempt(client_ip)
            return jsonify({'error': 'Authorization header required'}), 401
        
        # Extract token
        try:
            if not auth_header.startswith('Bearer '):
                raise ValueError("Invalid authorization format")
            token = auth_header[7:]  # Remove 'Bearer ' prefix
        except (ValueError, IndexError):
            security_logger.warning(f"Invalid authorization format from {client_ip}")
            auth.record_failed_attempt(client_ip)
            return jsonify({'error': 'Invalid authorization format'}), 401
        
        # Verify token
        payload = auth.verify_token(token)
        if not payload:
            security_logger.warning(f"Invalid/expired token from {client_ip}")
            auth.record_failed_attempt(client_ip)
            return jsonify({'error': 'Invalid or expired token'}), 401
        
        # Clear failed attempts on successful auth
        auth.clear_failed_attempts(client_ip)
        
        # Add user info to request
        request.user = payload
        
        # Log successful authentication
        security_logger.info(f"Authenticated request: user={payload.get('user_id')} ip={client_ip} endpoint={request.endpoint}")
        
        return f(*args, **kwargs)
    
    return decorated_function

def optional_auth(f):
    """Optional authentication decorator - doesn't require auth but processes if present"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        
        if auth_header and auth_header.startswith('Bearer '):
            try:
                token = auth_header[7:]
                payload = auth.verify_token(token)
                if payload:
                    request.user = payload
                else:
                    request.user = None
            except Exception:
                request.user = None
        else:
            request.user = None
        
        return f(*args, **kwargs)
    
    return decorated_function

def admin_required(f):
    """Require admin role"""
    @wraps(f)
    @require_auth
    def decorated_function(*args, **kwargs):
        if not request.user.get('is_admin', False):
            security_logger.warning(f"Admin access denied for user {request.user.get('user_id')}")
            return jsonify({'error': 'Admin access required'}), 403
        return f(*args, **kwargs)
    
    return decorated_function