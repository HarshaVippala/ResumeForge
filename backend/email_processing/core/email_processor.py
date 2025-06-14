"""
Main Email Processor
Orchestrates multi-stage email processing pipeline
"""

import logging
import time
from typing import List, Optional

from ..models.email_data import EmailData, ProcessingStage
from ..models.processing_result import ProcessingResult, TokenUsage, ProcessingMetrics
# Legacy imports moved to archive - EmailProcessor now uses OpenAI unified processor
# from .legacy.email_classifier import EmailClassifier
# from .legacy.content_extractor import ContentExtractor  
# from .legacy.data_structurer import DataStructurer

logger = logging.getLogger(__name__)

class EmailProcessor:
    """
    DEPRECATED: Main email processor that orchestrates the multi-stage pipeline
    
    ⚠️  This multi-stage processor is deprecated. 
        Use OpenAIEmailProcessor for unified single-API-call processing.
    Stage 1: Classification (fast, focused)
    Stage 2: Content Extraction (quality, actionable insights)
    Stage 3: Data Structuring (structured information)
    """
    
    def __init__(self, api_key: str = None):
        # Initialize stage processors
        self.classifier = EmailClassifier(api_key)
        self.content_extractor = ContentExtractor(api_key)
        self.data_structurer = DataStructurer(api_key)
        
        # Processing stats
        self.stats = {
            'emails_processed': 0,
            'successful_classifications': 0,
            'successful_extractions': 0,
            'successful_structuring': 0,
            'total_tokens_used': 0,
            'total_processing_time_ms': 0
        }
    
    def process_email(self, email_data: EmailData, 
                     skip_non_job_related: bool = True,
                     max_stages: int = 3) -> ProcessingResult:
        """
        Process a single email through all stages
        
        Args:
            email_data: Input email data
            skip_non_job_related: Skip content extraction for non-job emails
            max_stages: Maximum number of stages to run (1-3)
        """
        
        # Initialize result
        result = ProcessingResult(
            email_data=email_data,
            token_usage=TokenUsage(),
            metrics=ProcessingMetrics()
        )
        
        try:
            # Stage 1: Classification
            logger.info(f"Processing email: {email_data.subject[:50]}...")
            classification = self.classifier.classify_email(email_data)
            result.update_from_classification(classification)
            self.stats['successful_classifications'] += 1
            
            # Early exit for non-job emails if requested
            if skip_non_job_related and not classification.is_job_related:
                logger.info(f"Email not job-related, skipping further processing")
                result.success = True
                result.processing_stage = ProcessingStage.COMPLETED
                result.metrics.mark_complete()
                return result
            
            # Stage 2: Content Extraction (if max_stages >= 2)
            if max_stages >= 2 and classification.is_job_related:
                content_extraction = self.content_extractor.extract_content(
                    email_data, classification
                )
                result.update_from_content_extraction(content_extraction)
                self.stats['successful_extractions'] += 1
            
            # Stage 3: Data Structuring (if max_stages >= 3)
            if max_stages >= 3 and classification.is_job_related and result.content_extraction:
                structured_data = self.data_structurer.structure_data(
                    email_data, result.content_extraction, classification.email_type
                )
                result.update_from_structured_data(structured_data)
                self.stats['successful_structuring'] += 1
            
            # Update global stats
            self.stats['emails_processed'] += 1
            self.stats['total_tokens_used'] += result.token_usage.total_tokens
            self.stats['total_processing_time_ms'] += result.metrics.total_processing_time_ms
            
            logger.info(f"Email processed successfully: {result.email_type.value} from {result.company}")
            return result
            
        except Exception as e:
            logger.error(f"Email processing failed for {email_data.id}: {e}")
            result.mark_failed(str(e), result.processing_stage)
            return result
    
    def process_emails_batch(self, 
                           emails: List[EmailData],
                           skip_non_job_related: bool = True,
                           max_stages: int = 3,
                           max_parallel: int = 5) -> List[ProcessingResult]:
        """
        Process multiple emails in batch with optional parallelization
        
        Args:
            emails: List of email data to process
            skip_non_job_related: Skip content extraction for non-job emails
            max_stages: Maximum number of stages to run per email
            max_parallel: Maximum number of emails to process in parallel (future enhancement)
        """
        
        results = []
        successful_count = 0
        
        logger.info(f"Starting batch processing of {len(emails)} emails")
        
        for i, email_data in enumerate(emails, 1):
            try:
                logger.info(f"Processing email {i}/{len(emails)}: {email_data.subject[:50]}")
                
                result = self.process_email(
                    email_data,
                    skip_non_job_related=skip_non_job_related,
                    max_stages=max_stages
                )
                
                results.append(result)
                
                if result.success:
                    successful_count += 1
                
                # Log progress every 10 emails
                if i % 10 == 0:
                    logger.info(f"Batch progress: {i}/{len(emails)} processed, {successful_count} successful")
                
            except Exception as e:
                logger.error(f"Failed to process email {i}: {e}")
                # Create error result
                error_result = ProcessingResult(email_data=email_data)
                error_result.mark_failed(str(e), ProcessingStage.CLASSIFICATION)
                results.append(error_result)
        
        logger.info(f"Batch processing complete: {successful_count}/{len(emails)} successful")
        return results
    
    def process_emails_smart_batch(self, 
                                 emails: List[EmailData],
                                 target_tokens_per_minute: int = 8000) -> List[ProcessingResult]:
        """
        Process emails with intelligent batching based on token limits
        
        Args:
            emails: List of email data to process
            target_tokens_per_minute: Target token usage per minute
        """
        
        results = []
        
        # Get suggested batch size from model selector
        batch_size = self.classifier.model_selector.suggest_processing_batch_size()
        batch_size = min(batch_size, len(emails))
        
        logger.info(f"Smart batch processing: {len(emails)} emails in batches of {batch_size}")
        
        for i in range(0, len(emails), batch_size):
            batch = emails[i:i + batch_size]
            
            logger.info(f"Processing batch {i//batch_size + 1}: emails {i+1}-{min(i+batch_size, len(emails))}")
            
            batch_results = self.process_emails_batch(
                batch,
                skip_non_job_related=True,
                max_stages=3
            )
            
            results.extend(batch_results)
            
            # Reset usage tracking between batches for fresh token limits
            self.classifier.model_selector.reset_usage_tracking()
            self.content_extractor.model_selector.reset_usage_tracking()
            self.data_structurer.model_selector.reset_usage_tracking()
        
        return results
    
    def get_processing_stats(self) -> dict:
        """Get comprehensive processing statistics"""
        
        # Get stats from individual processors
        classifier_stats = self.classifier.get_classification_stats()
        
        return {
            'overall_stats': self.stats,
            'model_usage': classifier_stats['model_usage'],
            'recommendations': classifier_stats['recommendations'],
            'success_rates': {
                'classification': (self.stats['successful_classifications'] / max(self.stats['emails_processed'], 1)) * 100,
                'content_extraction': (self.stats['successful_extractions'] / max(self.stats['emails_processed'], 1)) * 100,
                'data_structuring': (self.stats['successful_structuring'] / max(self.stats['emails_processed'], 1)) * 100
            },
            'performance_metrics': {
                'avg_processing_time_ms': self.stats['total_processing_time_ms'] / max(self.stats['emails_processed'], 1),
                'avg_tokens_per_email': self.stats['total_tokens_used'] / max(self.stats['emails_processed'], 1),
                'emails_processed': self.stats['emails_processed']
            }
        }
    
    def reset_stats(self):
        """Reset processing statistics"""
        self.stats = {
            'emails_processed': 0,
            'successful_classifications': 0,
            'successful_extractions': 0,
            'successful_structuring': 0,
            'total_tokens_used': 0,
            'total_processing_time_ms': 0
        }
        
        # Reset model selector usage tracking
        self.classifier.model_selector.reset_usage_tracking()
        self.content_extractor.model_selector.reset_usage_tracking()
        self.data_structurer.model_selector.reset_usage_tracking()
    
    def validate_email_data(self, email_data: EmailData) -> bool:
        """Validate email data before processing"""
        
        if not email_data.id:
            logger.warning("Email missing ID")
            return False
        
        if not email_data.subject and not email_data.body:
            logger.warning(f"Email {email_data.id} missing both subject and body")
            return False
        
        return True
    
    def preprocess_emails(self, raw_emails: List[dict]) -> List[EmailData]:
        """Convert raw email data to EmailData objects with validation"""
        
        processed_emails = []
        
        for raw_email in raw_emails:
            try:
                # Create EmailData object
                email_data = EmailData(
                    id=raw_email.get('id', ''),
                    subject=raw_email.get('subject', ''),
                    sender=raw_email.get('sender', ''),
                    recipient=raw_email.get('recipient', ''),
                    date=raw_email.get('date'),
                    body=raw_email.get('body', ''),
                    snippet=raw_email.get('snippet', ''),
                    thread_id=raw_email.get('thread_id', ''),
                    is_read=raw_email.get('is_read', True)
                )
                
                # Validate
                if self.validate_email_data(email_data):
                    processed_emails.append(email_data)
                else:
                    logger.warning(f"Skipping invalid email: {email_data.id}")
                    
            except Exception as e:
                logger.error(f"Error preprocessing email: {e}")
                continue
        
        logger.info(f"Preprocessed {len(processed_emails)}/{len(raw_emails)} emails")
        return processed_emails
    
    def get_model_recommendations(self) -> dict:
        """Get model usage recommendations"""
        return {
            'classifier': self.classifier.model_selector.get_model_recommendations(),
            'content_extractor': self.content_extractor.model_selector.get_model_recommendations(),
            'data_structurer': self.data_structurer.model_selector.get_model_recommendations(),
        }
    
    def health_check(self) -> dict:
        """Check health of all processors"""
        health = {
            'overall_status': 'healthy',
            'issues': []
        }
        
        try:
            # Test prompt loader
            self.classifier.prompt_loader.get_available_prompts()
            
            # Check model selector capacity
            classifier_capacity = self.classifier.model_selector.suggest_processing_batch_size()
            if classifier_capacity < 5:
                health['issues'].append("Low classifier capacity")
            
            # More health checks can be added here
            
        except Exception as e:
            health['overall_status'] = 'unhealthy'
            health['issues'].append(f"Health check failed: {e}")
        
        return health