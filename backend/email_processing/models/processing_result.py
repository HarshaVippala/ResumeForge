"""
Final processing results and metrics
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional, Any
from .email_data import (
    EmailData, ClassificationResult, ContentExtractionResult, 
    StructuredDataResult, EmailType, UrgencyLevel, ProcessingStage
)

@dataclass
class TokenUsage:
    """Token usage tracking"""
    classification_tokens: int = 0
    content_extraction_tokens: int = 0
    data_structuring_tokens: int = 0
    total_tokens: int = 0
    
    def add_usage(self, stage: ProcessingStage, tokens: int):
        """Add token usage for a stage"""
        if stage == ProcessingStage.CLASSIFICATION:
            self.classification_tokens += tokens
        elif stage == ProcessingStage.CONTENT_EXTRACTION:
            self.content_extraction_tokens += tokens
        elif stage == ProcessingStage.DATA_STRUCTURING:
            self.data_structuring_tokens += tokens
        self.total_tokens += tokens

@dataclass
class ProcessingMetrics:
    """Processing performance metrics"""
    total_processing_time_ms: int = 0
    classification_time_ms: int = 0
    content_extraction_time_ms: int = 0
    data_structuring_time_ms: int = 0
    
    stages_completed: List[ProcessingStage] = field(default_factory=list)
    models_used: Dict[str, str] = field(default_factory=dict)  # stage -> model
    
    processing_started_at: datetime = field(default_factory=datetime.now)
    processing_completed_at: Optional[datetime] = None
    
    def mark_stage_complete(self, stage: ProcessingStage, time_ms: int, model: str):
        """Mark a processing stage as complete"""
        self.stages_completed.append(stage)
        self.models_used[stage.value] = model
        
        if stage == ProcessingStage.CLASSIFICATION:
            self.classification_time_ms = time_ms
        elif stage == ProcessingStage.CONTENT_EXTRACTION:
            self.content_extraction_time_ms = time_ms
        elif stage == ProcessingStage.DATA_STRUCTURING:
            self.data_structuring_time_ms = time_ms
        
        self.total_processing_time_ms += time_ms
    
    def mark_complete(self):
        """Mark processing as fully complete"""
        self.processing_completed_at = datetime.now()

@dataclass
class ProcessingResult:
    """Final combined result from all processing stages"""
    # Input data
    email_data: EmailData
    
    # Stage results
    classification: Optional[ClassificationResult] = None
    content_extraction: Optional[ContentExtractionResult] = None
    structured_data: Optional[StructuredDataResult] = None
    
    # Aggregated results for easy access
    is_job_related: bool = False
    email_type: EmailType = EmailType.OTHER
    company: str = ""
    position: str = ""
    actionable_summary: str = ""
    urgency: UrgencyLevel = UrgencyLevel.NORMAL
    confidence: float = 0.0
    
    # Job board extractions
    extracted_jobs: List[Dict[str, Any]] = field(default_factory=list)
    
    # Processing metadata
    token_usage: TokenUsage = field(default_factory=TokenUsage)
    metrics: ProcessingMetrics = field(default_factory=ProcessingMetrics)
    processing_time_ms: int = 0
    
    # Status
    success: bool = False
    error_message: str = ""
    processing_stage: ProcessingStage = ProcessingStage.CLASSIFICATION
    
    def update_from_classification(self, result: ClassificationResult):
        """Update with classification results"""
        self.classification = result
        self.is_job_related = result.is_job_related
        self.email_type = result.email_type
        self.company = result.company_detected
        self.position = result.position_detected
        self.urgency = result.urgency
        self.confidence = result.confidence
        self.processing_stage = ProcessingStage.CONTENT_EXTRACTION
        
        # Update metrics
        self.token_usage.add_usage(ProcessingStage.CLASSIFICATION, result.tokens_used)
        self.metrics.mark_stage_complete(
            ProcessingStage.CLASSIFICATION, 
            result.processing_time_ms, 
            result.model_used
        )
    
    def update_from_content_extraction(self, result: ContentExtractionResult):
        """Update with content extraction results"""
        self.content_extraction = result
        # Override with more detailed results
        self.company = result.company or self.company
        self.position = result.position or self.position
        self.actionable_summary = result.actionable_summary
        self.urgency = result.urgency
        if result.confidence > self.confidence:
            self.confidence = result.confidence
        self.processing_stage = ProcessingStage.DATA_STRUCTURING
        
        # Update metrics
        self.token_usage.add_usage(ProcessingStage.CONTENT_EXTRACTION, result.tokens_used)
        self.metrics.mark_stage_complete(
            ProcessingStage.CONTENT_EXTRACTION,
            result.processing_time_ms,
            result.model_used
        )
    
    def update_from_structured_data(self, result: StructuredDataResult):
        """Update with structured data results"""
        self.structured_data = result
        self.processing_stage = ProcessingStage.COMPLETED
        
        # Update metrics
        self.token_usage.add_usage(ProcessingStage.DATA_STRUCTURING, result.tokens_used)
        self.metrics.mark_stage_complete(
            ProcessingStage.DATA_STRUCTURING,
            result.processing_time_ms,
            result.model_used
        )
        self.metrics.mark_complete()
        self.success = True
    
    def mark_failed(self, error: str, stage: ProcessingStage):
        """Mark processing as failed"""
        self.success = False
        self.error_message = error
        self.processing_stage = stage
        self.metrics.mark_complete()
    
    def to_dict(self) -> Dict:
        """Convert to dictionary for API responses"""
        return {
            'email_id': self.email_data.id,
            'subject': self.email_data.subject,
            'sender': self.email_data.sender,
            'is_job_related': self.is_job_related,
            'email_type': self.email_type.value,
            'company': self.company,
            'position': self.position,
            'actionable_summary': self.actionable_summary,
            'urgency': self.urgency.value,
            'confidence': self.confidence,
            'processing_stage': self.processing_stage.value,
            'success': self.success,
            'error_message': self.error_message,
            'token_usage': {
                'total_tokens': self.token_usage.total_tokens,
                'stages': {
                    'classification': self.token_usage.classification_tokens,
                    'content_extraction': self.token_usage.content_extraction_tokens,
                    'data_structuring': self.token_usage.data_structuring_tokens
                }
            },
            'metrics': {
                'total_time_ms': self.metrics.total_processing_time_ms,
                'stages_completed': [s.value for s in self.metrics.stages_completed],
                'models_used': self.metrics.models_used
            },
            # Include stage-specific data
            'key_info': [
                {
                    'label': info.label,
                    'value': info.value,
                    'type': info.info_type,
                    'confidence': info.confidence
                } for info in (self.structured_data.key_info if self.structured_data else [])
            ],
            'action_items': [
                {
                    'task': action.task,
                    'deadline': action.deadline,
                    'priority': action.priority.value,
                    'type': action.action_type
                } for action in (self.structured_data.action_items if self.structured_data else [])
            ],
            'extracted_links': self.structured_data.extracted_links if self.structured_data else {},
            'interview_details': {
                'date': self.structured_data.interview_date if self.structured_data else "",
                'time': self.structured_data.interview_time if self.structured_data else "",
                'platform': self.structured_data.interview_platform if self.structured_data else ""
            } if self.structured_data else {}
        }