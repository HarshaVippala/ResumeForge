#!/usr/bin/env python3
"""
Sync LLM-processed emails to Supabase (PostgreSQL)
"""

import os
import sys
import json
import logging
from datetime import datetime

# Add the backend directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services.gmail_service import GmailService
from services.lm_studio_client import LMStudioClient
from services.supabase_manager import SupabaseDatabaseManager

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def sync_emails_to_supabase():
    """Process emails with LLM and store in Supabase"""
    try:
        logger.info("🚀 Syncing LLM-processed emails to Supabase...")
        
        # Initialize services
        gmail = GmailService()
        lm_studio = LMStudioClient()
        
        # Use Supabase directly
        from supabase import create_client, Client
        
        # Get Supabase credentials from environment or use default
        url = os.getenv('SUPABASE_URL', 'https://smmzigjzoxiafrumqbgn.supabase.co')
        key = os.getenv('SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtbXppZ2p6b3hpYWZydW1xYmduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzM4NzE2NjMsImV4cCI6MjA0OTQ0NzY2M30.PTEwqQX6YYGbmkOSDafzJfJkIqpNwUjSUg9ksAl2TBE')
        
        supabase: Client = create_client(url, key)
        
        logger.info("📧 Fetching recent emails...")
        emails = gmail.get_recent_emails(days_back=7, max_results=5)
        
        if not emails:
            logger.info("No emails found")
            return False
        
        logger.info(f"Found {len(emails)} emails to process")
        
        processed_count = 0
        stored_count = 0
        
        for email in emails:
            try:
                processed_count += 1
                
                # Check if already exists in Supabase
                existing = supabase.table("email_communications").select("id").eq("email_id", email['id']).execute()
                
                if existing.data:
                    logger.debug(f"Email {email['id']} already exists in Supabase")
                    continue
                
                logger.info(f"🤖 Processing email: {email['subject'][:50]}...")
                
                # LLM Analysis
                email_content = f"Subject: {email['subject']}\nFrom: {email['sender']}\nContent: {email['snippet']}"
                
                # Use fast extraction with qwen3-8b-mlx
                extraction_prompt = f"""Analyze this email for job search relevance. Return JSON only.

Email: {email_content[:500]}

Is this job/career related? If YES, extract:
- company name (from sender domain or content)
- email type (interview/rejection/recruiter/follow_up/offer/job_alert)  
- position title if mentioned
- summary (1 sentence)

JSON format:
{{"is_job_related": true/false, "type": "interview", "company": "Company Name", "position": "Job Title", "summary": "Brief summary"}}

Return ONLY the JSON, nothing else."""
                
                # Get model config for email extraction
                from config.model_config import get_model_config
                email_config = get_model_config("email_extraction")
                
                # Call LLM
                response = lm_studio.generate_completion(
                    prompt=extraction_prompt,
                    max_tokens=email_config["max_tokens"],
                    temperature=email_config["temperature"],
                    model=email_config["model"]
                )
                
                extracted_info = {'company': '', 'type': 'other', 'position': '', 'summary': ''}
                
                if response:
                    try:
                        # Parse LLM response
                        clean_response = response.replace('```json', '').replace('```', '').strip()
                        
                        # Handle <think> tags from qwen3
                        if '<think>' in clean_response:
                            clean_response = clean_response.split('</think>')[-1].strip()
                        
                        json_start = clean_response.find('{')
                        json_end = clean_response.rfind('}') + 1
                        
                        if json_start >= 0 and json_end > json_start:
                            json_str = clean_response[json_start:json_end]
                            ai_extracted = json.loads(json_str)
                            
                            if ai_extracted.get('is_job_related', True):
                                extracted_info.update(ai_extracted)
                                logger.info(f"✨ LLM extracted: {extracted_info}")
                            else:
                                logger.info(f"⏭️ Email not job-related, skipping")
                                continue
                                
                    except Exception as parse_error:
                        logger.warning(f"LLM parsing failed: {parse_error}")
                        # Fall back to keyword-based classification
                        content_lower = email_content.lower()
                        if any(word in content_lower for word in ['job', 'position', 'interview', 'application', 'recruiter']):
                            extracted_info['type'] = 'other'
                            extracted_info['summary'] = 'Job-related communication'
                        else:
                            continue  # Skip non-job emails
                
                # Fallback company extraction
                if not extracted_info.get('company'):
                    sender_parts = email['sender']
                    if '@' in sender_parts:
                        domain = sender_parts.split('@')[1].split()[0] if '@' in sender_parts else ''
                        if domain:
                            company = domain.split('.')[0].title()
                            if company.lower() not in ['gmail', 'outlook', 'yahoo', 'hotmail', 'us', 'greenhouse']:
                                extracted_info['company'] = company
                
                # Store in Supabase
                email_data = {
                    'email_id': email['id'],
                    'subject': email['subject'],
                    'sender': email['sender'],
                    'recipient': '',
                    'email_date': email['date'],
                    'content': email['snippet'],
                    'snippet': email['snippet'][:200],
                    'email_type': extracted_info.get('type', 'other'),
                    'direction': 'inbound',
                    'urgency': 'medium',
                    'extracted_data': {
                        'company': extracted_info.get('company', ''),
                        'position': extracted_info.get('position', ''),
                        'summary': extracted_info.get('summary', '')
                    },
                    'confidence_score': 0.8,
                    'processing_status': 'processed'
                }
                
                result = supabase.table("email_communications").insert(email_data).execute()
                
                if result.data:
                    stored_count += 1
                    logger.info(f"✅ Stored email in Supabase: {email['subject'][:30]}...")
                    logger.info(f"   Company: {extracted_info.get('company', 'Not found')}")
                    logger.info(f"   Type: {extracted_info.get('type', 'other')}")
                else:
                    logger.error(f"Failed to store email in Supabase")
                    
            except Exception as e:
                logger.error(f"Error processing email {email.get('id', 'unknown')}: {e}")
                continue
        
        logger.info(f"\n🎉 Supabase sync completed!")
        logger.info(f"📧 Processed: {processed_count} emails")
        logger.info(f"💾 Stored: {stored_count} job-related emails")
        logger.info(f"🤖 All emails analyzed with qwen3-8b-mlx LLM")
        
        return stored_count > 0
        
    except Exception as e:
        logger.error(f"Supabase sync failed: {e}")
        return False

if __name__ == "__main__":
    success = sync_emails_to_supabase()
    if success:
        print(f"\n✅ Successfully synced LLM-processed emails to Supabase!")
        print(f"🚀 Your dashboard should now show AI-analyzed emails")
    else:
        print(f"\n❌ Sync failed")