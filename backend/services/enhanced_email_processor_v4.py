#!/usr/bin/env python3
"""
Enhanced Email Processing Service V4
Fixes critical classification issues with few-shot examples and better filtering
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

class EnhancedEmailProcessorV4:
    """
    Advanced email processor with critical fixes for classification issues
    """
    
    def __init__(self, lm_studio_client=None):
        self.lm_studio = lm_studio_client
        
    def process_email_comprehensive(self, email_data: Dict[str, Any]) -> EnhancedEmailData:
        """
        Process email with improved classification and company extraction
        """
        try:
            # First check if email is job-related using strict filtering
            if not self._is_job_related_email(email_data):
                logger.debug(f"Skipping non-job email: {email_data.get('subject', '')[:50]}")
                return EnhancedEmailData(is_job_related=False, confidence_score=0.95)
            
            # Use structured extraction with few-shot examples
            extracted_data = self._extract_with_few_shot_examples(email_data)
            
            # Create EnhancedEmailData from extraction
            enhanced_data = self._create_enhanced_data(extracted_data, email_data)
            
            # Add fallback extractions for company names
            enhanced_data = self._add_critical_company_extraction(enhanced_data, email_data)
            
            # Calculate confidence score
            enhanced_data.confidence_score = self._calculate_confidence_score(enhanced_data)
            
            return enhanced_data
            
        except Exception as e:
            logger.error(f"Enhanced email processing error: {e}")
            return self._fallback_processing(email_data)
    
    def _is_job_related_email(self, email_data: Dict[str, Any]) -> bool:
        """
        Strict filtering to exclude non-job emails
        """
        subject = email_data.get('subject', '').lower()
        sender = email_data.get('sender', '').lower()
        content = email_data.get('snippet', '').lower()
        
        # Immediate exclusions for non-job emails
        exclusion_patterns = [
            # Product/service updates
            'product update', 'new feature', 'release notes', 'changelog',
            'now available', 'introducing', 'announcement',
            
            # Events/webinars (NOT job-related)
            'webinar', 'workshop', 'event', 'conference', 'meetup',
            'join us for', 'register now', 'save the date',
            
            # Marketing/newsletters
            'newsletter', 'digest', 'weekly roundup', 'monthly update',
            'unsubscribe', 'marketing', 'promotion',
            
            # System notifications
            'system update', 'maintenance', 'outage', 'service disruption',
            'password reset', 'account verification', 'security alert',
            
            # Social media
            'facebook', 'twitter', 'linkedin post', 'social media',
            
            # Gemini/AI product updates (definitely not job-related)
            'gemini', 'ai update', 'model update', 'api changes'
        ]
        
        # Check if email contains exclusion patterns
        email_text = f"{subject} {content}"
        for pattern in exclusion_patterns:
            if pattern in email_text:
                logger.debug(f"Excluding email due to pattern: {pattern}")
                return False
        
        # Sender domain exclusions
        exclusion_domains = [
            'noreply@', 'no-reply@', 'newsletter@', 'marketing@',
            'notifications@', 'updates@', 'info@'
        ]
        
        for domain in exclusion_domains:
            if domain in sender:
                # Only exclude if it's clearly a marketing email
                if any(word in email_text for word in ['newsletter', 'unsubscribe', 'marketing']):
                    return False
        
        # Positive indicators for job-related emails
        job_indicators = [
            # Application/recruitment terms
            'application', 'position', 'role', 'opportunity', 'hiring',
            'recruitment', 'candidate', 'resume', 'cv', 'interview',
            
            # Status updates
            'thank you for your interest', 'application status', 'next steps',
            'moving forward', 'selected', 'not selected', 'unfortunately',
            
            # Interview related
            'schedule', 'interview', 'call', 'meeting', 'phone screen',
            
            # Recruiter communication
            'recruiter', 'talent', 'hr', 'human resources'
        ]
        
        # Must have at least one job indicator
        return any(indicator in email_text for indicator in job_indicators)
    
    def _extract_with_few_shot_examples(self, email_data: Dict[str, Any]) -> Dict[str, Any]:
        """Extract email data using LM Studio with few-shot examples"""
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
                        "description": "The actual company name (NOT email service provider like greenhouse-mail)"
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
        
        # Prepare the prompt with few-shot examples
        subject = email_data.get('subject', '')
        sender = email_data.get('sender', '')
        content = email_data.get('snippet', email_data.get('content', ''))
        
        prompt = f"""Analyze this email and extract job-related information. Use these examples as guidance:

EXAMPLE 1:
Subject: Thank you for your interest in Headspace
From: recruiting@greenhouse-mail.io
Content: Thank you for your interest in Headspace. Unfortunately, we have decided to move forward with other candidates.
EXTRACTION: {{"company_name": "Headspace", "email_type": "rejection", "is_job_related": true, "summary": "Rejection from Headspace for applied position"}}

EXAMPLE 2:
Subject: Important information about your application to Twitch
From: jobs@twitch.tv
Content: We wanted to reach out regarding your application for the Software Engineer position. Unfortunately, we will not be moving forward.
EXTRACTION: {{"company_name": "Twitch", "email_type": "rejection", "is_job_related": true, "summary": "Application rejection from Twitch for Software Engineer position"}}

EXAMPLE 3:
Subject: Following up on your application
From: recruiter@company.com
Content: Hi, I wanted to follow up on your application and see if you're still interested. Do you have any questions about the role?
EXTRACTION: {{"company_name": "", "email_type": "follow_up", "is_job_related": true, "summary": "Recruiter following up on application with questions"}}

EXAMPLE 5:
Subject: Checking in on your application
From: hr@company.com
Content: Hi Harsha, I hope you're doing well. I wanted to check in on your application for the Software Engineer position. Are you still interested? Let me know if you have questions.
EXTRACTION: {{"company_name": "", "email_type": "follow_up", "is_job_related": true, "summary": "HR checking in on application status and interest level"}}

EXAMPLE 4:
Subject: Join us for our product launch event
From: events@notion.so
Content: We're excited to invite you to our product launch event next week. Learn about our new features and network with the team.
EXTRACTION: {{"company_name": "Notion", "email_type": "other", "is_job_related": false, "summary": "Product launch event invitation from Notion"}}

NOW ANALYZE THIS EMAIL:
Subject: {subject}
From: {sender}
Content: {content}

CRITICAL RULES:
1. Extract the REAL company name (Headspace, Twitch, Toast) NOT the email service (greenhouse-mail, lever-mail)
2. If email contains "unfortunately", "not selected", "move forward with other candidates" → email_type: "rejection"
3. If recruiter is asking questions, checking in, or following up WITHOUT rejection words → email_type: "follow_up" (NOT rejection)
4. If it's about events, product updates, or newsletters → is_job_related: false
5. Look for follow-up indicators: "still interested", "any questions", "checking in", "wanted to follow up", "hope you're doing well"
6. Look for job titles like "Software Engineer", "Product Manager", etc."""

        try:
            # Use structured output with optimized parameters
            response = self.lm_studio.generate_completion(
                prompt=prompt,
                max_tokens=250,  # Enough for structured data
                temperature=0.05,  # Very low for consistency
                model="qwen3-8b-mlx",  # Use the working model
                json_schema=json_schema,
                seed=123,  # For reproducibility
                top_k=5,  # More focused selection
                top_p=0.8,  # Lower for more deterministic output
                repeat_penalty=1.05,  # Slight penalty to avoid repetition
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
    
    def _add_critical_company_extraction(self, enhanced_data: EnhancedEmailData, email_data: Dict[str, Any]) -> EnhancedEmailData:
        """
        Critical company name extraction with specific patterns for known issues
        """
        
        # Extract company domain from sender
        if email_data.get('sender'):
            sender = email_data['sender']
            if '@' in sender:
                domain = sender.split('@')[1].split()[0].replace('>', '')
                enhanced_data.company_domain = domain
        
        # If no company name extracted or it's generic, use aggressive extraction
        if not enhanced_data.company_name or enhanced_data.company_name in ['Greenhouse-Mail', 'Lever-Mail']:
            subject = email_data.get('subject', '')
            content = email_data.get('snippet', '') + ' ' + email_data.get('content', '')
            
            # Critical patterns for known companies
            critical_patterns = [
                # Twitch patterns
                (r'application to Twitch', 'Twitch'),
                (r'position at Twitch', 'Twitch'),
                (r'from Twitch', 'Twitch'),
                (r'@twitch\.', 'Twitch'),
                
                # Headspace patterns  
                (r'interest in Headspace', 'Headspace'),
                (r'from Headspace', 'Headspace'),
                (r'Headspace team', 'Headspace'),
                
                # Toast patterns
                (r'Toast - ', 'Toast'),
                (r'position at Toast', 'Toast'),
                (r'from Toast', 'Toast'),
                (r'@toast', 'Toast'),
                
                # General patterns
                (r'Thank you for your interest in ([A-Z][a-zA-Z]+)', None),
                (r'application (?:to|at|with) ([A-Z][a-zA-Z]+)', None),
                (r'position (?:at|with) ([A-Z][a-zA-Z]+)', None),
                (r'opportunity at ([A-Z][a-zA-Z]+)', None),
                (r'^([A-Z][a-zA-Z]+) - .+(?:Position|Engineer|Developer)', None),
                (r'from ([A-Z][a-zA-Z]+)', None),
            ]
            
            search_text = f"{subject} {content}"
            
            for pattern, fixed_name in critical_patterns:
                match = re.search(pattern, search_text, re.IGNORECASE)
                if match:
                    if fixed_name:
                        enhanced_data.company_name = fixed_name
                        logger.info(f"Fixed company name using critical pattern: {fixed_name}")
                        break
                    else:
                        potential_company = match.group(1)
                        # Filter out common false positives
                        if potential_company.lower() not in ['the', 'our', 'your', 'this', 'that', 'position', 'role', 'team']:
                            enhanced_data.company_name = potential_company
                            logger.info(f"Extracted company name: {potential_company}")
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
            score += 0.3
        
        # Company information (critical)
        if enhanced_data.company_name and enhanced_data.company_name not in ['Greenhouse-Mail', 'Lever-Mail', '']:
            score += 0.3
        
        # Email type classification
        if enhanced_data.email_type != 'other':
            score += 0.2
        
        # Summary quality
        if enhanced_data.summary and len(enhanced_data.summary) > 10:
            score += 0.1
        
        # Additional details
        if enhanced_data.job_title:
            score += 0.05
        if enhanced_data.recruiter_name:
            score += 0.05
        
        return min(score, 1.0)
    
    def _fallback_processing(self, email_data: Dict[str, Any]) -> EnhancedEmailData:
        """Enhanced fallback processing when LLM fails"""
        subject = email_data.get('subject', '').lower()
        sender = email_data.get('sender', '')
        content = (email_data.get('snippet', '') + ' ' + email_data.get('content', '')).lower()
        
        # Initialize result
        enhanced_data = EnhancedEmailData()
        
        # Check if job-related using strict filtering
        if not self._is_job_related_email(email_data):
            enhanced_data.is_job_related = False
            enhanced_data.confidence_score = 0.9
            return enhanced_data
        
        enhanced_data.is_job_related = True
        
        # Extract company name with critical patterns
        enhanced_data = self._add_critical_company_extraction(enhanced_data, email_data)
        
        # Better email type detection
        if any(phrase in content for phrase in [
            'unfortunately', 'not selected', 'decided to move forward with other',
            'not be moving forward', 'regret to inform', 'not a match',
            'pursue other candidates', 'will not be proceeding'
        ]):
            enhanced_data.email_type = "rejection"
            enhanced_data.summary = f"Rejection from {enhanced_data.company_name or 'company'}"
        elif any(phrase in content for phrase in [
            'follow up', 'following up', 'checking in', 'any questions',
            'still interested', 'want to connect', 'hope you\'re doing well',
            'wanted to check', 'see if you\'re still', 'touching base'
        ]) and not any(phrase in content for phrase in ['unfortunately', 'not selected', 'regret to inform']):
            enhanced_data.email_type = "follow_up"
            enhanced_data.summary = f"Follow-up from {enhanced_data.company_name or 'recruiter'}"
        elif any(word in content for word in ['interview', 'meeting', 'call with', 'schedule']):
            enhanced_data.email_type = "interview"
            enhanced_data.summary = f"Interview invitation from {enhanced_data.company_name or 'company'}"
        elif any(word in content for word in ['opportunity', 'position', 'role', 'hiring']):
            enhanced_data.email_type = "recruiter"
            enhanced_data.summary = f"Job opportunity from {enhanced_data.company_name or 'recruiter'}"
        
        # Extract domain
        if '@' in sender:
            enhanced_data.company_domain = sender.split('@')[1].split()[0].replace('>', '')
        
        enhanced_data.confidence_score = 0.6  # Higher confidence for improved fallback
        
        return enhanced_data