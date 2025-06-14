"""
Data models for email processing
"""

from .email_data import EmailData, ClassificationResult, ContentExtractionResult, StructuredDataResult
from .processing_result import ProcessingResult, TokenUsage, ProcessingMetrics

__all__ = [
    'EmailData', 'ClassificationResult', 'ContentExtractionResult', 
    'StructuredDataResult', 'ProcessingResult', 'TokenUsage', 'ProcessingMetrics'
]