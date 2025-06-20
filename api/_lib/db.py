"""
Supabase Database Connection for Vercel Functions
"""
import os
from typing import Optional
from supabase import create_client, Client

_supabase_client: Optional[Client] = None

def get_supabase() -> Client:
    """Get or create Supabase client singleton"""
    global _supabase_client
    
    if not _supabase_client:
        supabase_url = os.getenv('SUPABASE_URL')
        supabase_key = os.getenv('SUPABASE_KEY')
        
        if not supabase_url or not supabase_key:
            raise ValueError("Missing SUPABASE_URL or SUPABASE_KEY environment variables")
        
        _supabase_client = create_client(supabase_url, supabase_key)
    
    return _supabase_client

def reset_client():
    """Reset the client (useful for testing)"""
    global _supabase_client
    _supabase_client = None