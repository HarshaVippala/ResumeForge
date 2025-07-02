"""
Storage Service for Vercel Functions
Handles file storage with Supabase Storage
"""
import os
import tempfile
import uuid
from typing import BinaryIO, Optional, Callable, Any
from .db import get_supabase

class StorageService:
    def __init__(self):
        self.supabase = get_supabase()
        self.templates_bucket = 'resume-templates'
        self.documents_bucket = 'generated-documents'
    
    def save_document(self, content: bytes, filename: str, content_type: str = 'application/octet-stream') -> str:
        """
        Save document to Supabase Storage and return public URL
        
        Args:
            content: File content as bytes
            filename: Name for the file
            content_type: MIME type of the file
            
        Returns:
            Public URL of the uploaded file
        """
        # Ensure unique filename
        unique_filename = f"{uuid.uuid4()}_{filename}"
        
        # Upload to Supabase Storage
        response = self.supabase.storage.from_(self.documents_bucket).upload(
            unique_filename,
            content,
            {
                "content-type": content_type,
                "cache-control": "3600"
            }
        )
        
        # Get public URL
        return self.supabase.storage.from_(self.documents_bucket).get_public_url(unique_filename)
    
    def get_template(self, template_name: str) -> bytes:
        """
        Get template from bundled files (stored with the function)
        Templates are deployed with the function code
        
        Args:
            template_name: Name of the template file
            
        Returns:
            Template content as bytes
        """
        # Templates are bundled with deployment
        template_path = os.path.join(
            os.path.dirname(os.path.dirname(__file__)), 
            'templates', 
            template_name
        )
        
        if not os.path.exists(template_path):
            # Try to download from Supabase Storage as fallback
            try:
                response = self.supabase.storage.from_(self.templates_bucket).download(template_name)
                return response
            except Exception as e:
                raise FileNotFoundError(f"Template {template_name} not found: {str(e)}")
        
        with open(template_path, 'rb') as f:
            return f.read()
    
    def process_with_temp_file(self, callback: Callable[[str], Any], extension: str = '.tmp') -> Any:
        """
        Process files using /tmp directory for serverless environment
        
        Args:
            callback: Function that takes a temp file path and returns a result
            extension: File extension for the temp file
            
        Returns:
            Result from the callback function
        """
        with tempfile.NamedTemporaryFile(suffix=extension, delete=True) as tmp_file:
            temp_path = tmp_file.name
            result = callback(temp_path)
            return result
    
    def delete_document(self, filename: str) -> bool:
        """
        Delete a document from storage
        
        Args:
            filename: Name of the file to delete
            
        Returns:
            True if successful, False otherwise
        """
        try:
            self.supabase.storage.from_(self.documents_bucket).remove([filename])
            return True
        except Exception:
            return False