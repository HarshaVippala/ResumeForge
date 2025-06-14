#!/usr/bin/env python3
"""
OpenAI Unified Email Processor
Single API call for classification + content extraction + data structuring
"""

import os
import json
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime
import openai
from ..models.email_data import EmailData, EmailType, UrgencyLevel
from ..models.processing_result import ProcessingResult, TokenUsage

logger = logging.getLogger(__name__)

class OpenAIEmailProcessor:
    """
    Unified email processor using OpenAI GPT-4o-mini for all stages:
    - Classification (job-related detection, email type, company)
    - Content extraction (actionable summary, insights, next steps)
    - Data structuring (dates, links, action items)
    """
    
    def __init__(self):
        """Initialize OpenAI client"""
        # Handle both OPENAI_API_KEY and OPEN_AI_KEY environment variables
        api_key = os.getenv('OPENAI_API_KEY') or os.getenv('OPEN_AI_KEY')
        if not api_key:
            raise ValueError("OpenAI API key not found. Set OPENAI_API_KEY or OPEN_AI_KEY environment variable.")
        
        self.client = openai.OpenAI(
            api_key=api_key
        )
        self.model = "gpt-4.1-mini-2025-04-14"
        self.max_tokens = 2000
        self.temperature = 0.1  # Low temperature for consistent classification
        
        # Processing statistics
        self.stats = {
            'total_emails_processed': 0,
            'successful_processing': 0,
            'failed_processing': 0,
            'total_tokens_used': 0,
            'average_processing_time_ms': 0,
            'job_related_count': 0,
            'non_job_related_count': 0
        }
    
    def process_email(self, email_data: EmailData) -> ProcessingResult:
        """
        Process email through unified OpenAI analysis
        Returns complete ProcessingResult with all stages combined
        """
        start_time = datetime.now()
        
        try:
            # Create unified prompt
            prompt = self._create_unified_prompt(email_data)
            
            # Single OpenAI API call
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system", 
                        "content": "You are an expert job search assistant that analyzes emails for job seekers. You provide accurate classification, detailed summaries, and structured data extraction in a single comprehensive analysis."
                    },
                    {
                        "role": "user", 
                        "content": prompt
                    }
                ],
                max_tokens=self.max_tokens,
                temperature=self.temperature,
                response_format={"type": "json_object"}
            )
            
            # Parse response
            result_json = json.loads(response.choices[0].message.content)
            
            # Create processing result
            processing_result = self._create_processing_result(
                email_data, result_json, response.usage, start_time
            )
            
            # Update statistics
            self._update_stats(processing_result, start_time)
            
            return processing_result
            
        except Exception as e:
            logger.error(f"OpenAI processing failed for email {email_data.id}: {e}")
            return self._create_error_result(email_data, str(e), start_time)
    
    def _create_unified_prompt(self, email_data: EmailData) -> str:
        """Create comprehensive prompt that combines all processing stages"""
        
        return f"""
Analyze this email comprehensively for a job seeker. Provide classification, content analysis, and structured data extraction.

EMAIL TO ANALYZE:
Subject: {email_data.subject}
From: {email_data.sender}
Date: {email_data.date}
Body: {email_data.body[:2000] if email_data.body else "No body content"}

ANALYSIS REQUIREMENTS:

1. CLASSIFICATION (Is this job-related for dashboard?)
   - Job-related emails (show in dashboard): Interview scheduling, assessments, application updates, recruiter outreach, offers, rejections
   - Job board emails (extract jobs separately): Lensa, Indeed, LinkedIn Jobs, ZipRecruiter, Glassdoor, Monster, CareerBuilder, Dice, AngelList, Stack Overflow Jobs
   - NOT job-related: Sports clubs, recreational activities, community organizations, newsletters, social media, personal correspondence, health/medical, educational (non-hiring), shopping, travel
   - Be especially careful with: cricket leagues, sports teams, hobby clubs, volunteer organizations, social events

2. CONTENT ANALYSIS (If job-related)
   - Create actionable summary (250+ characters) telling candidate exactly what to do next
   - Extract key insights and next steps
   - Determine urgency based on deadlines and requirements

3. STRUCTURED DATA EXTRACTION
   - Extract specific dates, times, platforms, deadlines
   - Identify action items with priorities
   - Parse relevant links and requirements

Return JSON in this exact structure:
{{
  "classification": {{
    "is_job_related": true/false,
    "email_type": "interview|assessment|rejection|follow_up|offer|recruiter_outreach|job_board|application_confirmation|other",
    "company": "exact company name (empty string if unclear)",
    "position": "specific job title (empty string if unclear)",
    "urgency": "high|normal|low",
    "confidence": 0.0-1.0,
    "reasoning": "brief explanation of classification decision"
  }},
  "job_extractions": {{
    "is_job_board": true/false,
    "jobs": [
      {{
        "title": "specific job title",
        "company": "company name",
        "location": "city, state or remote",
        "salary": "salary range if mentioned",
        "employment_type": "full-time|part-time|contract|intern",
        "apply_link": "application URL if found",
        "job_board": "source job board name"
      }}
    ]
  }},
  "content_analysis": {{
    "actionable_summary": "detailed summary with specific next steps and deadlines",
    "key_insights": ["insight1", "insight2", "insight3"],
    "next_steps": ["specific action1", "specific action2", "specific action3"],
    "sentiment": "positive|neutral|negative",
    "requires_response": true/false,
    "deadline_mentioned": true/false
  }},
  "structured_data": {{
    "interview_date": "YYYY-MM-DD or empty string",
    "interview_time": "HH:MM AM/PM timezone or empty string",
    "interview_platform": "Zoom|Teams|Google Meet|Phone|In-person|etc or empty string",
    "interview_duration": "duration in minutes or empty string",
    "assessment_deadline": "YYYY-MM-DD HH:MM timezone or empty string",
    "response_deadline": "YYYY-MM-DD or empty string",
    "assessment_type": "coding|system_design|behavioral|technical|other or empty string",
    "location": "city, state or remote or empty string",
    "salary_mentioned": true/false,
    "salary_range": "salary range if mentioned or empty string",
    "extracted_links": {{
      "calendar": "calendar link if found",
      "assessment": "assessment link if found", 
      "portal": "application portal link if found",
      "other": "other relevant links"
    }},
    "action_items": [
      {{
        "task": "specific task description",
        "deadline": "YYYY-MM-DD or empty string",
        "priority": "high|normal|low",
        "action_type": "respond|complete|prepare|schedule|review"
      }}
    ],
    "contact_info": {{
      "recruiter_name": "name if mentioned",
      "recruiter_email": "email if different from sender",
      "interviewer_names": ["name1", "name2"]
    }}
  }}
}}

CRITICAL RULES:
- Return ONLY valid JSON, no additional text
- Use empty strings ("") not null or "Empty String" 
- Be conservative with is_job_related - when in doubt, mark as false
- For sports/recreation emails, always mark is_job_related as false
- For job board emails (Lensa, Indeed, etc.), mark is_job_related as false but set email_type as "job_board" and extract jobs
- Make actionable_summary specific and helpful (include company, position, next steps)
- Extract ALL mentioned dates and deadlines accurately
- Set high urgency only for same-day or next-day deadlines
- For job board emails, extract individual job postings with complete details
"""
    
    def _create_processing_result(self, email_data: EmailData, result_json: Dict, 
                                usage, start_time: datetime) -> ProcessingResult:
        """Create ProcessingResult from OpenAI response"""
        
        try:
            classification = result_json.get('classification', {})
            content_analysis = result_json.get('content_analysis', {})
            structured_data = result_json.get('structured_data', {})
            job_extractions = result_json.get('job_extractions', {})
            
            # Create processing result with unified data
            processing_time = (datetime.now() - start_time).total_seconds() * 1000
            
            # Token usage
            token_usage = TokenUsage(
                classification_tokens=usage.prompt_tokens,
                content_extraction_tokens=0,  # Not applicable in unified approach
                data_structuring_tokens=0,    # Not applicable in unified approach
                total_tokens=usage.total_tokens
            )
            
            # Create proper result objects for compatibility
            from ..models.email_data import ClassificationResult, ContentExtractionResult, StructuredDataResult
            
            classification_result = ClassificationResult(
                is_job_related=classification.get('is_job_related', False),
                email_type=classification.get('email_type', 'other'),
                confidence=classification.get('confidence', 0.0),
                processing_time_ms=int(processing_time),
                model_used=self.model,
                company_detected=classification.get('company', ''),
                position_detected=classification.get('position', ''),
                urgency=classification.get('urgency', 'normal'),
                tokens_used=usage.total_tokens
            )
            
            content_result = ContentExtractionResult(
                company=classification.get('company', ''),
                position=classification.get('position', ''),
                actionable_summary=content_analysis.get('actionable_summary', ''),
                key_insights=content_analysis.get('key_insights', []),
                next_steps=content_analysis.get('next_steps', []),
                sentiment=content_analysis.get('sentiment', 'neutral'),
                confidence=classification.get('confidence', 0.0)
            )
            
            structured_result = StructuredDataResult(
                interview_date=structured_data.get('interview_date', ''),
                interview_time=structured_data.get('interview_time', ''),
                interview_platform=structured_data.get('interview_platform', ''),
                assessment_deadline=structured_data.get('assessment_deadline', ''),
                deadline_summary=f"Interview: {structured_data.get('interview_date', '')} {structured_data.get('interview_time', '')}".strip(),
                extracted_links=structured_data.get('extracted_links', {})
            )
            
            # Create metrics
            from ..models.processing_result import ProcessingMetrics
            metrics = ProcessingMetrics()
            metrics.total_processing_time_ms = int(processing_time)
            metrics.models_used = {'unified': self.model}
            
            result = ProcessingResult(
                email_data=email_data,
                success=True,
                token_usage=token_usage,
                metrics=metrics,
                processing_time_ms=int(processing_time),
                
                # Include structured results for compatibility
                classification=classification_result,
                content_extraction=content_result,
                structured_data=structured_result,
                
                # Direct access fields for convenience
                is_job_related=classification.get('is_job_related', False),
                email_type=self._convert_to_email_type(classification.get('email_type', 'other')),
                company=classification.get('company', ''),
                position=classification.get('position', ''),
                actionable_summary=content_analysis.get('actionable_summary', ''),
                urgency=self._convert_to_urgency_level(classification.get('urgency', 'normal')),
                confidence=classification.get('confidence', 0.0),
                
                # Job extractions for job board emails
                extracted_jobs=job_extractions.get('jobs', []) if job_extractions.get('is_job_board', False) else []
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Error creating processing result: {e}")
            return self._create_error_result(email_data, f"Result parsing error: {e}", start_time)
    
    def _create_error_result(self, email_data: EmailData, error_msg: str, 
                           start_time: datetime) -> ProcessingResult:
        """Create error result for failed processing"""
        
        processing_time = (datetime.now() - start_time).total_seconds() * 1000
        
        # Create error metrics
        from ..models.processing_result import ProcessingMetrics
        metrics = ProcessingMetrics()
        metrics.total_processing_time_ms = int(processing_time)
        metrics.models_used = {'unified': self.model}
        
        return ProcessingResult(
            email_data=email_data,
            success=False,
            error_message=error_msg,
            token_usage=TokenUsage(0, 0, 0, 0),
            metrics=metrics,
            processing_time_ms=int(processing_time),
            
            # Default values for failed processing
            is_job_related=False,
            email_type=EmailType.OTHER,
            company='',
            position='',
            urgency=UrgencyLevel.NORMAL,
            confidence=0.0,
            actionable_summary='',
            extracted_jobs=[]
        )
    
    def _update_stats(self, result: ProcessingResult, start_time: datetime):
        """Update processing statistics"""
        self.stats['total_emails_processed'] += 1
        
        if result.success:
            self.stats['successful_processing'] += 1
            if result.is_job_related:
                self.stats['job_related_count'] += 1
            else:
                self.stats['non_job_related_count'] += 1
        else:
            self.stats['failed_processing'] += 1
        
        self.stats['total_tokens_used'] += result.token_usage.total_tokens
        
        # Update average processing time
        current_avg = self.stats['average_processing_time_ms']
        total_processed = self.stats['total_emails_processed']
        new_time = result.processing_time_ms
        self.stats['average_processing_time_ms'] = (
            (current_avg * (total_processed - 1) + new_time) / total_processed
        )
    
    def process_emails_batch(self, emails: List[EmailData]) -> List[ProcessingResult]:
        """Process multiple emails (sequentially for now)"""
        results = []
        
        logger.info(f"Processing {len(emails)} emails with OpenAI unified approach")
        
        for i, email in enumerate(emails):
            logger.info(f"Processing email {i+1}/{len(emails)}: {email.subject[:50]}...")
            result = self.process_email(email)
            results.append(result)
            
            # Log progress
            if result.success:
                status = "✅ Job-related" if result.is_job_related else "❌ Not job-related"
                logger.info(f"  {status} | Company: {result.company} | Type: {result.email_type}")
            else:
                logger.error(f"  ❌ Processing failed: {result.error_message}")
        
        success_count = sum(1 for r in results if r.success)
        job_related_count = sum(1 for r in results if r.success and r.is_job_related)
        
        logger.info(f"Batch complete: {success_count}/{len(emails)} successful, {job_related_count} job-related")
        
        return results
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get processing statistics"""
        return {
            **self.stats,
            'success_rate': (
                self.stats['successful_processing'] / max(1, self.stats['total_emails_processed'])
            ) * 100,
            'job_related_percentage': (
                self.stats['job_related_count'] / max(1, self.stats['successful_processing'])
            ) * 100,
            'average_tokens_per_email': (
                self.stats['total_tokens_used'] / max(1, self.stats['successful_processing'])
            ),
            'model_used': self.model
        }
    
    def health_check(self) -> Dict[str, Any]:
        """Health check for the processor"""
        try:
            # Test API connection with minimal request
            test_response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": "Test: respond with just 'OK'"}],
                max_tokens=5,
                temperature=0
            )
            
            return {
                'status': 'healthy',
                'api_accessible': True,
                'model': self.model,
                'test_response': test_response.choices[0].message.content
            }
        except Exception as e:
            return {
                'status': 'unhealthy',
                'api_accessible': False,
                'error': str(e),
                'model': self.model
            }
    
    def _convert_to_email_type(self, email_type_str: str) -> EmailType:
        """Convert string to EmailType enum"""
        type_mapping = {
            'interview': EmailType.INTERVIEW,
            'assessment': EmailType.ASSESSMENT,
            'rejection': EmailType.REJECTION,
            'follow_up': EmailType.FOLLOW_UP,
            'offer': EmailType.OFFER,
            'recruiter_outreach': EmailType.RECRUITER_OUTREACH,
            'recruiter_followup': EmailType.RECRUITER_FOLLOWUP,
            'job_board': EmailType.JOB_BOARD,
            'application_confirmation': EmailType.FOLLOW_UP,  # Map to follow_up
            'other': EmailType.OTHER
        }
        return type_mapping.get(email_type_str.lower(), EmailType.OTHER)
    
    def _convert_to_urgency_level(self, urgency_str: str) -> UrgencyLevel:
        """Convert string to UrgencyLevel enum"""
        urgency_mapping = {
            'high': UrgencyLevel.HIGH,
            'normal': UrgencyLevel.NORMAL,
            'low': UrgencyLevel.LOW
        }
        return urgency_mapping.get(urgency_str.lower(), UrgencyLevel.NORMAL)

if __name__ == "__main__":
    # Test the processor
    logging.basicConfig(level=logging.INFO)
    
    processor = OpenAIEmailProcessor()
    
    # Health check
    health = processor.health_check()
    print(f"Health check: {health}")
    
    if health['status'] == 'healthy':
        print("✅ OpenAI Email Processor is ready for use!")
    else:
        print("❌ OpenAI Email Processor health check failed")