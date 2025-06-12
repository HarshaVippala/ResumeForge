#!/usr/bin/env python3
"""
Email Workflow Processor
LangGraph-ready architecture for email processing and future autonomous outreach
"""

import logging
from datetime import datetime
from typing import Dict, List, Optional, TypedDict, Literal
from dataclasses import dataclass, asdict
import json

from .gmail_service import GmailService, EmailData
from .lm_studio_client import LMStudioClient

# Configure logging
logger = logging.getLogger(__name__)

# Workflow State Types
class EmailWorkflowState(TypedDict):
    """State object for email workflow processing (LangGraph compatible)"""
    email_id: str
    email_data: Optional[EmailData]
    classification: Optional[Dict]
    extracted_data: Optional[Dict]
    insights: Optional[List[Dict]]
    actions_needed: Optional[List[str]]
    workflow_status: Literal['pending', 'processing', 'completed', 'failed']
    error_message: Optional[str]
    created_at: datetime
    updated_at: datetime

@dataclass
class EmailClassification:
    """Email classification result"""
    category: Literal['rejection', 'interview', 'recruiter', 'follow_up', 'offer', 'other']
    confidence: float
    subcategory: Optional[str] = None
    sentiment: Literal['positive', 'negative', 'neutral'] = 'neutral'
    urgency: Literal['high', 'medium', 'low'] = 'medium'
    reasoning: Optional[str] = None

@dataclass
class ExtractedData:
    """Extracted data from email"""
    company_name: Optional[str] = None
    position_title: Optional[str] = None
    recruiter_name: Optional[str] = None
    recruiter_email: Optional[str] = None
    interview_date: Optional[datetime] = None
    interview_type: Optional[str] = None
    meeting_link: Optional[str] = None
    next_steps: Optional[List[str]] = None
    salary_mentioned: Optional[str] = None
    contact_info: Optional[Dict] = None

@dataclass
class ActionableInsight:
    """Actionable insight from email analysis"""
    type: Literal['follow_up', 'prepare_interview', 'send_thank_you', 'research_company', 'update_application']
    priority: Literal['high', 'medium', 'low']
    title: str
    description: str
    deadline: Optional[datetime] = None
    estimated_time: Optional[str] = None

class EmailWorkflowProcessor:
    """
    Email workflow processor with LangGraph-compatible architecture
    Processes emails through classification, extraction, and insight generation
    """
    
    def __init__(self, gmail_service: GmailService = None, lm_studio: LMStudioClient = None):
        """Initialize email workflow processor"""
        self.gmail = gmail_service or GmailService()
        self.lm_studio = lm_studio or LMStudioClient()
        
    # Node Functions (Future LangGraph nodes)
    
    def read_emails_node(self, state: EmailWorkflowState = None) -> List[EmailWorkflowState]:
        """
        Node: Read recent emails from Gmail
        
        Args:
            state: Optional existing state (for single email processing)
            
        Returns:
            List of workflow states for each email
        """
        try:
            logger.info("Reading emails from Gmail...")
            
            if state and state.get('email_id'):
                # Process single email (for re-processing)
                email_data = self._fetch_single_email(state['email_id'])
                if email_data:
                    return [self._create_initial_state(email_data)]
                return []
            
            # Fetch recent job-related emails
            emails = self.gmail.get_recent_emails(
                max_results=20,
                days_back=7  # Focus on recent emails
            )
            
            # Create workflow states
            states = []
            for email_data in emails:
                initial_state = self._create_initial_state(email_data)
                states.append(initial_state)
            
            logger.info(f"Created {len(states)} email workflow states")
            return states
            
        except Exception as e:
            logger.error(f"Error reading emails: {e}")
            return []
    
    def classify_email_node(self, state: EmailWorkflowState) -> EmailWorkflowState:
        """
        Node: Classify email content using LLM
        
        Args:
            state: Email workflow state
            
        Returns:
            Updated state with classification
        """
        try:
            state['workflow_status'] = 'processing'
            state['updated_at'] = datetime.now()
            
            email_data = state['email_data']
            if not email_data:
                raise ValueError("No email data in state")
            
            logger.info(f"Classifying email: {email_data['subject']}")
            
            # Prepare prompt for LLM classification
            classification_prompt = self._build_classification_prompt(email_data)
            
            # Get classification from LLM
            response = self.lm_studio.generate_completion(
                prompt=classification_prompt,
                max_tokens=200,
                temperature=0.1
            )
            
            # Parse classification response
            classification = self._parse_classification_response(response)
            
            state['classification'] = asdict(classification)
            logger.info(f"Email classified as: {classification.category} (confidence: {classification.confidence})")
            
            return state
            
        except Exception as e:
            logger.error(f"Error classifying email {state.get('email_id')}: {e}")
            state['workflow_status'] = 'failed'
            state['error_message'] = str(e)
            return state
    
    def extract_data_node(self, state: EmailWorkflowState) -> EmailWorkflowState:
        """
        Node: Extract structured data from email
        
        Args:
            state: Email workflow state with classification
            
        Returns:
            Updated state with extracted data
        """
        try:
            email_data = state['email_data']
            classification = state.get('classification', {})
            
            if not email_data or not classification:
                raise ValueError("Missing email data or classification")
            
            logger.info(f"Extracting data from {classification.get('category', 'unknown')} email")
            
            # Build extraction prompt based on email category
            extraction_prompt = self._build_extraction_prompt(email_data, classification)
            
            # Get structured data from LLM
            response = self.lm_studio.generate_completion(
                prompt=extraction_prompt,
                max_tokens=300,
                temperature=0.1
            )
            
            # Parse extracted data
            extracted_data = self._parse_extraction_response(response, classification.get('category'))
            
            state['extracted_data'] = asdict(extracted_data)
            logger.info(f"Extracted data: company={extracted_data.company_name}, position={extracted_data.position_title}")
            
            return state
            
        except Exception as e:
            logger.error(f"Error extracting data from email {state.get('email_id')}: {e}")
            state['error_message'] = str(e)
            return state
    
    def generate_insights_node(self, state: EmailWorkflowState) -> EmailWorkflowState:
        """
        Node: Generate actionable insights and recommendations
        
        Args:
            state: Email workflow state with extracted data
            
        Returns:
            Updated state with insights and actions
        """
        try:
            classification = state.get('classification', {})
            extracted_data = state.get('extracted_data', {})
            
            logger.info(f"Generating insights for {classification.get('category', 'unknown')} email")
            
            # Generate insights based on email type
            insights = self._generate_insights_for_category(classification, extracted_data)
            
            # Convert insights to serializable format
            state['insights'] = [asdict(insight) for insight in insights]
            state['actions_needed'] = [insight.title for insight in insights if insight.priority == 'high']
            
            state['workflow_status'] = 'completed'
            state['updated_at'] = datetime.now()
            
            logger.info(f"Generated {len(insights)} insights with {len(state['actions_needed'])} high-priority actions")
            
            return state
            
        except Exception as e:
            logger.error(f"Error generating insights for email {state.get('email_id')}: {e}")
            state['error_message'] = str(e)
            return state
    
    # Helper Methods
    
    def _create_initial_state(self, email_data: EmailData) -> EmailWorkflowState:
        """Create initial workflow state for email"""
        return EmailWorkflowState(
            email_id=email_data['id'],
            email_data=email_data,
            classification=None,
            extracted_data=None,
            insights=None,
            actions_needed=None,
            workflow_status='pending',
            error_message=None,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
    
    def _build_classification_prompt(self, email_data: EmailData) -> str:
        """Build LLM prompt for email classification"""
        return f"""
Classify this job search related email. Analyze the subject, sender, and content to determine the category.

EMAIL DETAILS:
Subject: {email_data['subject']}
From: {email_data['sender']} <{email_data['sender_email']}>
Date: {email_data['date']}
Content: {email_data['body_text'][:1000]}...

CATEGORIES:
- rejection: Job application rejected
- interview: Interview invitation or scheduling
- recruiter: Recruiter reaching out with opportunities  
- follow_up: Follow-up communication or status update
- offer: Job offer or offer-related communication
- other: Not job search related

RESPONSE FORMAT (JSON):
{{
    "category": "category_name",
    "confidence": 0.95,
    "subcategory": "phone_screen|onsite|final_round|etc",
    "sentiment": "positive|negative|neutral",
    "urgency": "high|medium|low",
    "reasoning": "Brief explanation"
}}

Classification:"""
    
    def _build_extraction_prompt(self, email_data: EmailData, classification: Dict) -> str:
        """Build LLM prompt for data extraction"""
        category = classification.get('category', 'other')
        
        base_prompt = f"""
Extract structured information from this {category} email.

EMAIL CONTENT:
Subject: {email_data['subject']}
From: {email_data['sender']} <{email_data['sender_email']}>
Content: {email_data['body_text'][:1500]}...

EXTRACT:
- company_name: Company name
- position_title: Job position/role
- recruiter_name: Recruiter/HR person name
- recruiter_email: Recruiter email
"""
        
        # Add category-specific extraction fields
        if category == 'interview':
            base_prompt += """
- interview_date: Date/time (ISO format if found)
- interview_type: phone|video|onsite|panel
- meeting_link: Zoom/Teams/Meet link
- next_steps: Array of next steps mentioned
"""
        elif category == 'offer':
            base_prompt += """
- salary_mentioned: Salary/compensation details
- next_steps: Response deadline, next actions
"""
        elif category == 'recruiter':
            base_prompt += """
- contact_info: Phone, LinkedIn, etc.
- next_steps: How to respond or next actions
"""
        
        base_prompt += """
RESPONSE FORMAT (JSON):
{
    "company_name": "value_or_null",
    "position_title": "value_or_null",
    "recruiter_name": "value_or_null",
    ...
}

Extracted data:"""
        
        return base_prompt
    
    def _parse_classification_response(self, response: str) -> EmailClassification:
        """Parse LLM classification response"""
        try:
            # Try to extract JSON from response
            import re
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group())
                return EmailClassification(
                    category=data.get('category', 'other'),
                    confidence=float(data.get('confidence', 0.5)),
                    subcategory=data.get('subcategory'),
                    sentiment=data.get('sentiment', 'neutral'),
                    urgency=data.get('urgency', 'medium'),
                    reasoning=data.get('reasoning')
                )
        except Exception as e:
            logger.warning(f"Failed to parse classification response: {e}")
        
        # Fallback classification
        return EmailClassification(category='other', confidence=0.3)
    
    def _parse_extraction_response(self, response: str, category: str) -> ExtractedData:
        """Parse LLM extraction response"""
        try:
            import re
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group())
                
                # Parse interview date if present
                interview_date = None
                if data.get('interview_date'):
                    try:
                        from dateutil.parser import parse
                        interview_date = parse(data['interview_date'])
                    except:
                        pass
                
                return ExtractedData(
                    company_name=data.get('company_name'),
                    position_title=data.get('position_title'),
                    recruiter_name=data.get('recruiter_name'),
                    recruiter_email=data.get('recruiter_email'),
                    interview_date=interview_date,
                    interview_type=data.get('interview_type'),
                    meeting_link=data.get('meeting_link'),
                    next_steps=data.get('next_steps'),
                    salary_mentioned=data.get('salary_mentioned'),
                    contact_info=data.get('contact_info')
                )
        except Exception as e:
            logger.warning(f"Failed to parse extraction response: {e}")
        
        return ExtractedData()
    
    def _generate_insights_for_category(self, classification: Dict, extracted_data: Dict) -> List[ActionableInsight]:
        """Generate category-specific insights"""
        insights = []
        category = classification.get('category', 'other')
        urgency = classification.get('urgency', 'medium')
        
        if category == 'interview':
            insights.append(ActionableInsight(
                type='prepare_interview',
                priority='high',
                title='Prepare for interview',
                description=f"Research {extracted_data.get('company_name', 'company')} and prepare for {extracted_data.get('interview_type', 'interview')}",
                estimated_time='2-3 hours'
            ))
            
            if extracted_data.get('interview_date'):
                insights.append(ActionableInsight(
                    type='follow_up',
                    priority='medium',
                    title='Confirm interview attendance',
                    description='Send confirmation email if not already done',
                    deadline=extracted_data.get('interview_date')
                ))
        
        elif category == 'rejection':
            insights.append(ActionableInsight(
                type='follow_up',
                priority='low',
                title='Request feedback',
                description='Consider asking for constructive feedback',
                estimated_time='15 minutes'
            ))
        
        elif category == 'recruiter':
            insights.append(ActionableInsight(
                type='follow_up',
                priority='high' if urgency == 'high' else 'medium',
                title='Respond to recruiter',
                description=f"Follow up with {extracted_data.get('recruiter_name', 'recruiter')} about the opportunity",
                estimated_time='30 minutes'
            ))
        
        elif category == 'offer':
            insights.append(ActionableInsight(
                type='follow_up',
                priority='high',
                title='Review job offer',
                description='Carefully review offer details and negotiate if needed',
                estimated_time='1-2 hours'
            ))
        
        return insights
    
    def _fetch_single_email(self, email_id: str) -> Optional[EmailData]:
        """Fetch single email by ID"""
        try:
            # This would need to be implemented in Gmail service
            # For now, fetch recent emails and find by ID
            emails = self.gmail.get_recent_emails(max_results=100)
            for email in emails:
                if email['id'] == email_id:
                    return email
            return None
        except Exception:
            return None
    
    # Main Processing Method
    
    def process_recent_emails(self) -> List[EmailWorkflowState]:
        """Process recent emails through full workflow"""
        try:
            logger.info("Starting email workflow processing...")
            
            # Step 1: Read emails
            states = self.read_emails_node()
            logger.info(f"Processing {len(states)} emails through workflow")
            
            # Step 2-4: Process each email through workflow
            completed_states = []
            for state in states:
                try:
                    # Classify
                    state = self.classify_email_node(state)
                    if state['workflow_status'] == 'failed':
                        completed_states.append(state)
                        continue
                    
                    # Extract data
                    state = self.extract_data_node(state)
                    
                    # Generate insights
                    state = self.generate_insights_node(state)
                    
                    completed_states.append(state)
                    
                except Exception as e:
                    logger.error(f"Error processing email {state.get('email_id')}: {e}")
                    state['workflow_status'] = 'failed'
                    state['error_message'] = str(e)
                    completed_states.append(state)
            
            logger.info(f"Completed processing {len(completed_states)} emails")
            return completed_states
            
        except Exception as e:
            logger.error(f"Error in email workflow processing: {e}")
            return []

if __name__ == "__main__":
    # Test the email workflow processor
    logging.basicConfig(level=logging.INFO)
    
    try:
        processor = EmailWorkflowProcessor()
        
        # Process recent emails
        results = processor.process_recent_emails()
        
        print(f"✅ Processed {len(results)} emails")
        
        # Show sample results
        for result in results[:3]:
            classification = result.get('classification', {})
            extracted = result.get('extracted_data', {})
            
            print(f"\n📧 Email: {result['email_data']['subject']}")
            print(f"   Category: {classification.get('category', 'unknown')}")
            print(f"   Company: {extracted.get('company_name', 'N/A')}")
            print(f"   Actions: {len(result.get('actions_needed', []))}")
            print(f"   Status: {result['workflow_status']}")
            
    except Exception as e:
        print(f"❌ Error: {e}")