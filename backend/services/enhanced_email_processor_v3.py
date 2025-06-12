#!/usr/bin/env python3
"""
Enhanced Email Processing Service V3
Uses LM Studio structured outputs for reliable JSON extraction
"""

import json
import re
import logging
from datetime import datetime
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass
import os

logger = logging.getLogger(__name__)

@dataclass
class EnhancedEmailData:
    """Comprehensive email data structure"""
    # Email Classification
    is_job_related: bool = False
    email_type: str = "other"
    priority: str = "medium"
    sentiment: str = "neutral"
    
    # Company Intelligence
    company_name: str = ""
    company_domain: str = ""
    industry: str = ""
    company_size: str = ""
    location: str = ""
    
    # Contact Extraction
    recruiter_name: str = ""
    recruiter_email: str = ""
    recruiter_phone: str = ""
    recruiter_title: str = ""
    recruiter_linkedin: str = ""
    contact_type: str = ""
    
    # Job Opportunity
    job_title: str = ""
    job_id: str = ""
    department: str = ""
    level: str = ""
    employment_type: str = ""
    location_type: str = ""
    salary_range: str = ""
    application_deadline: str = ""
    
    # Action Intelligence
    action_required: str = ""
    deadline: str = ""
    next_steps: List[str] = None
    
    # Interview Details
    interview_date: str = ""
    interview_time: str = ""
    interview_platform: str = ""
    interview_duration: str = ""
    interview_type: str = ""
    interviewers: List[str] = None
    
    # Application Tracking
    application_status: str = ""
    application_date: str = ""
    response_time: int = 0
    follow_up_needed: bool = False
    follow_up_date: str = ""
    
    # Meta
    confidence_score: float = 0.0
    summary: str = ""
    
    def __post_init__(self):
        if self.next_steps is None:
            self.next_steps = []
        if self.interviewers is None:
            self.interviewers = []

class EnhancedEmailProcessorV3:
    """
    Advanced email processor using LM Studio structured outputs
    """
    
    def __init__(self, lm_studio_client=None):
        self.lm_studio = lm_studio_client
        
    def process_email_comprehensive(self, email_data: Dict[str, Any]) -> EnhancedEmailData:
        """
        Process email with structured output extraction
        """
        try:
            # Use structured extraction with JSON schema
            extracted_data = self._extract_with_structured_output(email_data)
            
            # Create EnhancedEmailData from extraction
            enhanced_data = self._create_enhanced_data(extracted_data, email_data)
            
            # Add fallback extractions
            enhanced_data = self._add_fallback_extractions(enhanced_data, email_data)
            
            # Calculate confidence score
            enhanced_data.confidence_score = self._calculate_confidence_score(enhanced_data)
            
            return enhanced_data
            
        except Exception as e:
            logger.error(f"Enhanced email processing error: {e}")
            return self._fallback_processing(email_data)
    
    def _extract_with_structured_output(self, email_data: Dict[str, Any]) -> Dict[str, Any]:
        """Extract email data using LM Studio structured outputs"""
        if not self.lm_studio:
            return {}
        
        # Define JSON schema for email extraction
        json_schema = {
            "name": "email_extraction",
            "strict": True,
            "schema": {
                "type": "object",
                "properties": {
                    "company_name": {
                        "type": "string",
                        "description": "The company name from the email (e.g., 'Headspace', 'Toast', 'Google')"
                    },
                    "email_type": {
                        "type": "string",
                        "enum": ["interview", "rejection", "recruiter", "offer", "application_confirmation", "follow_up", "other"],
                        "description": "Type of job-related email"
                    },
                    "is_job_related": {
                        "type": "boolean",
                        "description": "Whether this email is related to jobs/careers"
                    },
                    "summary": {
                        "type": "string",
                        "description": "One sentence summary of the email"
                    },
                    "job_title": {
                        "type": "string",
                        "description": "Job position mentioned in the email"
                    },
                    "recruiter_name": {
                        "type": "string",
                        "description": "Name of the recruiter or contact person"
                    },
                    "recruiter_email": {
                        "type": "string",
                        "description": "Email address of the recruiter"
                    },
                    "action_required": {
                        "type": "string",
                        "description": "Any action required from the recipient"
                    },
                    "interview_date": {
                        "type": "string",
                        "description": "Interview date if mentioned"
                    },
                    "interview_time": {
                        "type": "string",
                        "description": "Interview time if mentioned"
                    },
                    "interview_platform": {
                        "type": "string",
                        "enum": ["zoom", "teams", "phone", "googlemeet", "onsite", "other", ""],
                        "description": "Interview platform if mentioned"
                    },
                    "application_status": {
                        "type": "string",
                        "enum": ["applied", "under_review", "interview_scheduled", "interviewed", "offer", "rejected", ""],
                        "description": "Current application status"
                    }
                },
                "required": ["company_name", "email_type", "is_job_related", "summary"]
            }
        }
        
        # Prepare the prompt
        subject = email_data.get('subject', '')
        sender = email_data.get('sender', '')
        content = email_data.get('snippet', email_data.get('content', ''))
        
        prompt = f"""Analyze this email and extract job-related information.

Subject: {subject}
From: {sender}
Content: {content}

Focus on:
1. Extract the actual company name (not the email service like 'greenhouse-mail')
2. For rejections, look for phrases like "unfortunately", "not selected", "decided to move forward with other candidates"
3. Extract any job titles, recruiter names, and action items mentioned"""

        try:
            # Use structured output with optimized parameters
            response = self.lm_studio.generate_completion(
                prompt=prompt,
                max_tokens=200,  # Enough for structured data
                temperature=0.1,  # Very low for consistency
                model="qwen3-8b-mlx",  # Use the working model
                json_schema=json_schema,
                seed=42,  # For reproducibility
                top_k=10,  # More focused selection
                top_p=0.9,  # Slightly lower for more deterministic output
                repeat_penalty=1.0,  # No penalty needed for structured output
                presence_penalty=0.0,
                frequency_penalty=0.0
            )
            
            if response:
                try:
                    # Parse the JSON response
                    return json.loads(response)
                except json.JSONDecodeError:
                    logger.error(f"Failed to parse structured response: {response[:100]}")
                    return {}
            
        except Exception as e:
            logger.error(f"Structured extraction error: {e}")
        
        return {}
    
    def _create_enhanced_data(self, extracted: Dict[str, Any], email_data: Dict[str, Any]) -> EnhancedEmailData:
        """Create EnhancedEmailData from extracted data"""
        return EnhancedEmailData(
            # From extraction
            is_job_related=extracted.get('is_job_related', False),
            email_type=extracted.get('email_type', 'other'),
            company_name=extracted.get('company_name', ''),
            summary=extracted.get('summary', ''),
            job_title=extracted.get('job_title', ''),
            recruiter_name=extracted.get('recruiter_name', ''),
            recruiter_email=extracted.get('recruiter_email', ''),
            action_required=extracted.get('action_required', ''),
            interview_date=extracted.get('interview_date', ''),
            interview_time=extracted.get('interview_time', ''),
            interview_platform=extracted.get('interview_platform', ''),
            application_status=extracted.get('application_status', ''),
            
            # Set priority based on type
            priority='high' if extracted.get('email_type') in ['interview', 'offer'] else 'medium'
        )
    
    def _add_fallback_extractions(self, enhanced_data: EnhancedEmailData, email_data: Dict[str, Any]) -> EnhancedEmailData:
        """Add fallback extractions for missing data"""
        
        # Extract company domain from sender
        if email_data.get('sender'):
            sender = email_data['sender']
            if '@' in sender:
                domain = sender.split('@')[1].split()[0].replace('>', '')
                enhanced_data.company_domain = domain
                
                # If no company name extracted, try to infer from domain
                if not enhanced_data.company_name and domain:
                    # Special handling for known email services
                    if 'greenhouse' in domain:
                        # Try to extract company from subject
                        subject = email_data.get('subject', '')
                        # Look for patterns like "Thank you for your interest in [Company]"
                        patterns = [
                            r'Thank you for your interest in ([A-Z][a-z]+)',
                            r'application (?:with|to|at) ([A-Z][a-z]+)',
                            r'position (?:with|at) ([A-Z][a-z]+)',
                            r'from ([A-Z][a-z]+)',
                            r'([A-Z][a-z]+) - [A-Z][a-z]+ (?:Engineer|Developer|Position)',
                        ]
                        for pattern in patterns:
                            match = re.search(pattern, subject)
                            if match:
                                enhanced_data.company_name = match.group(1)
                                break
        
        # Extract recruiter email if missing
        if not enhanced_data.recruiter_email and enhanced_data.company_domain:
            enhanced_data.recruiter_email = email_data.get('sender', '')
        
        return enhanced_data
    
    def _calculate_confidence_score(self, enhanced_data: EnhancedEmailData) -> float:
        """Calculate confidence score based on data completeness"""
        score = 0.0
        
        # Base score for classification
        if enhanced_data.is_job_related:
            score += 0.2
        
        # Company information
        if enhanced_data.company_name and enhanced_data.company_name != 'Greenhouse-Mail':
            score += 0.2
        
        # Email type classification
        if enhanced_data.email_type != 'other':
            score += 0.2
        
        # Summary quality
        if enhanced_data.summary and len(enhanced_data.summary) > 10:
            score += 0.2
        
        # Additional details
        if enhanced_data.job_title:
            score += 0.1
        if enhanced_data.recruiter_name:
            score += 0.1
        
        return min(score, 1.0)
    
    def _fallback_processing(self, email_data: Dict[str, Any]) -> EnhancedEmailData:
        """Enhanced fallback processing when LLM fails"""
        subject = email_data.get('subject', '').lower()
        sender = email_data.get('sender', '')
        content = (email_data.get('snippet', '') + ' ' + email_data.get('content', '')).lower()
        
        # Initialize result
        enhanced_data = EnhancedEmailData()
        
        # Extract company name with better patterns
        company_name = ""
        
        # First try subject line patterns
        subject_patterns = [
            # Headspace pattern: "Thank you for your interest in Headspace"
            r'Thank you for your interest in ([A-Z][a-zA-Z]+)',
            # Toast pattern: "Toast - Software Engineer Position Update"
            r'^([A-Z][a-zA-Z]+) - .* Position',
            # General patterns
            r'(?:application|position|role|opportunity) (?:with|at|for) ([A-Z][a-zA-Z]+)',
            r'([A-Z][a-zA-Z]+) (?:is|are) (?:hiring|looking|seeking)',
            r'Update (?:on|from) ([A-Z][a-zA-Z]+)',
        ]
        
        for pattern in subject_patterns:
            match = re.search(pattern, email_data.get('subject', ''), re.IGNORECASE)
            if match:
                company_name = match.group(1)
                break
        
        # If not found in subject, try content
        if not company_name:
            content_patterns = [
                r'position at ([A-Z][a-zA-Z]+)',
                r'opportunity at ([A-Z][a-zA-Z]+)',
                r'team at ([A-Z][a-zA-Z]+)',
                r'([A-Z][a-zA-Z]+) team',
                r'interest in ([A-Z][a-zA-Z]+)',
            ]
            
            for pattern in content_patterns:
                match = re.search(pattern, content, re.IGNORECASE)
                if match:
                    potential_company = match.group(1)
                    # Filter out common words
                    if potential_company.lower() not in ['the', 'our', 'your', 'this', 'that']:
                        company_name = potential_company
                        break
        
        enhanced_data.company_name = company_name
        
        # Better email type detection
        if any(phrase in content for phrase in [
            'unfortunately', 'not selected', 'decided to move forward with other',
            'not be moving forward', 'regret to inform', 'not a match',
            'pursue other candidates', 'will not be proceeding'
        ]):
            enhanced_data.email_type = "rejection"
            enhanced_data.is_job_related = True
            enhanced_data.summary = f"Rejection from {company_name or 'company'}"
        elif any(word in content for word in ['interview', 'meeting', 'call with', 'schedule']):
            enhanced_data.email_type = "interview"
            enhanced_data.is_job_related = True
            enhanced_data.summary = f"Interview invitation from {company_name or 'company'}"
        elif any(word in content for word in ['opportunity', 'position', 'role', 'hiring']):
            enhanced_data.email_type = "recruiter"
            enhanced_data.is_job_related = True
            enhanced_data.summary = f"Job opportunity from {company_name or 'recruiter'}"
        
        # Extract domain
        if '@' in sender:
            enhanced_data.company_domain = sender.split('@')[1].split()[0].replace('>', '')
        
        enhanced_data.confidence_score = 0.4  # Lower confidence for fallback
        
        return enhanced_data