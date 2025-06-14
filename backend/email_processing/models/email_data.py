"""
Core data models for email processing
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional, Any
from enum import Enum

class EmailType(Enum):
    """Email classification types"""
    INTERVIEW = "interview"
    ASSESSMENT = "assessment" 
    REJECTION = "rejection"
    FOLLOW_UP = "follow_up"
    OFFER = "offer"
    RECRUITER_OUTREACH = "recruiter_outreach"
    RECRUITER_FOLLOWUP = "recruiter_followup"
    JOB_BOARD = "job_board"
    OTHER = "other"

class UrgencyLevel(Enum):
    """Urgency levels"""
    HIGH = "high"
    NORMAL = "normal"
    LOW = "low"

class ProcessingStage(Enum):
    """Processing stages"""
    CLASSIFICATION = "classification"
    CONTENT_EXTRACTION = "content_extraction"
    DATA_STRUCTURING = "data_structuring"
    COMPLETED = "completed"

@dataclass
class EmailData:
    """Input email data"""
    id: str
    subject: str
    sender: str
    recipient: str = ""
    date: datetime = None
    body: str = ""
    snippet: str = ""
    thread_id: str = ""
    is_read: bool = True
    
    def __post_init__(self):
        if self.date is None:
            self.date = datetime.now()
        # Clean and prepare data
        self.body = self._clean_body(self.body)
        self.snippet = self._clean_body(self.snippet)
    
    def _clean_body(self, text: str) -> str:
        """Clean email body text"""
        if not text:
            return ""
        # Remove excessive whitespace and clean up
        import re
        text = re.sub(r'\s+', ' ', text)
        return text.strip()

@dataclass 
class ClassificationResult:
    """Result of email classification stage"""
    is_job_related: bool
    email_type: EmailType
    confidence: float
    processing_time_ms: int
    model_used: str
    
    # Basic extraction
    company_detected: str = ""
    position_detected: str = ""
    urgency: UrgencyLevel = UrgencyLevel.NORMAL
    
    # Metadata
    tokens_used: int = 0
    stage: ProcessingStage = ProcessingStage.CLASSIFICATION

@dataclass
class ActionItem:
    """Extracted action item"""
    task: str
    deadline: str = ""
    priority: UrgencyLevel = UrgencyLevel.NORMAL
    action_type: str = "general"  # respond, schedule, complete, review, prepare

@dataclass
class KeyInfo:
    """Key extracted information"""
    label: str
    value: str
    info_type: str  # date, time, url, phone, platform, deadline
    confidence: float = 1.0

@dataclass
class ContentExtractionResult:
    """Result of content extraction stage"""
    # Enhanced company/position
    company: str
    position: str
    
    # Rich content
    actionable_summary: str
    key_insights: List[str] = field(default_factory=list)
    next_steps: List[str] = field(default_factory=list)
    
    # Context
    urgency: UrgencyLevel = UrgencyLevel.NORMAL
    sentiment: str = "neutral"  # positive, neutral, negative
    confidence: float = 0.0
    
    # Processing metadata
    processing_time_ms: int = 0
    model_used: str = ""
    tokens_used: int = 0
    stage: ProcessingStage = ProcessingStage.CONTENT_EXTRACTION

@dataclass
class StructuredDataResult:
    """Result of structured data extraction stage"""
    # Structured information
    key_info: List[KeyInfo] = field(default_factory=list)
    action_items: List[ActionItem] = field(default_factory=list)
    extracted_links: Dict[str, str] = field(default_factory=dict)
    
    # Interview/Assessment specific
    interview_date: str = ""
    interview_time: str = ""
    interview_platform: str = ""
    assessment_deadline: str = ""
    assessment_requirements: List[str] = field(default_factory=list)
    
    # Additional details
    salary_range: str = ""
    location: str = ""
    deadline_summary: str = ""
    
    # Processing metadata
    processing_time_ms: int = 0
    model_used: str = ""
    tokens_used: int = 0
    stage: ProcessingStage = ProcessingStage.DATA_STRUCTURING