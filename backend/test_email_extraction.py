#!/usr/bin/env python3
"""
Test Email Extraction
Debug the LM Studio email extraction issue
"""

import sys
import os
sys.path.append(os.path.dirname(__file__))

from services.lm_studio_client import LMStudioClient
from config.model_config import get_model_config
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_email_extraction():
    """Test email extraction with a sample email"""
    
    # Sample email content
    sample_email = """Subject: Technical Interview - Software Engineer Position
From: sarah.jones@techcorp.com
Content: Hello! I hope this email finds you well. I'm reaching out regarding your application for the Senior Software Engineer position at TechCorp. We were impressed with your background and would like to schedule a technical interview. 

Are you available for a 1-hour technical interview next Wednesday, June 14th at 2:00 PM EST? We'll be using Zoom for the interview. Please let me know if this time works for you.

Looking forward to hearing from you!

Best regards,
Sarah Jones
Senior Technical Recruiter
TechCorp Inc.
sarah.jones@techcorp.com
(555) 123-4567"""

    # Initialize LM Studio client
    lm_studio = LMStudioClient()
    
    # Test connection first
    if not lm_studio.test_connection():
        print("❌ LM Studio not connected")
        return
    
    print("✅ LM Studio connected")
    
    # Get email extraction config
    email_config = get_model_config("email_extraction")
    print(f"📧 Using model: {email_config['model']}")
    
    # Create extraction prompt
    extraction_prompt = f"""
You are an email analysis assistant. Analyze this job-related email and extract key information.

Email content:
{sample_email}

Please extract the following information and format as JSON:
- type: interview, rejection, recruiter, follow_up, offer, or other  
- company: company name or recruiting firm
- recruiter_name: full name of contact person
- recruiter_email: email address
- recruiter_phone: phone number
- position: job title mentioned
- client_company: end client company if different
- interview_date: date if mentioned
- interview_time: time if mentioned
- interview_platform: zoom, teams, phone, googlemeet, or other
- interview_link: meeting link if provided
- salary_range: salary if mentioned
- location: job location
- urgency: high, medium, or low
- action_required: what action needed from candidate

Respond with only the JSON object:
"""

    print("🔍 Testing email extraction...")
    print(f"📝 Prompt length: {len(extraction_prompt)} chars")
    
    # Call LM Studio
    response = lm_studio.generate_completion(
        prompt=extraction_prompt,
        max_tokens=email_config["max_tokens"],
        temperature=email_config["temperature"],
        model=email_config["model"]
    )
    
    if response:
        print("✅ Got response from LM Studio:")
        print("-" * 50)
        print(response)
        print("-" * 50)
        
        # Try to parse JSON
        try:
            import json
            json_start = response.find('{')
            json_end = response.rfind('}') + 1
            if json_start >= 0 and json_end > json_start:
                json_str = response[json_start:json_end]
                parsed = json.loads(json_str)
                print("✅ Successfully parsed JSON:")
                for key, value in parsed.items():
                    print(f"  {key}: {value}")
            else:
                print("❌ No valid JSON found in response")
        except json.JSONDecodeError as e:
            print(f"❌ JSON parsing failed: {e}")
    else:
        print("❌ No response from LM Studio")

if __name__ == "__main__":
    test_email_extraction()