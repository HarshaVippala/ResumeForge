#!/usr/bin/env python3
"""
Enhanced Job Processor
Extends job data with H1B sponsorship detection and structured technology extraction using OpenAI
"""

import os
import json
import logging
import re
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime
import openai
from .database import DatabaseManager
from .supabase_manager import SupabaseDatabaseManager
from config.database_config import db_config

logger = logging.getLogger(__name__)

class EnhancedJobProcessor:
    """
    Enhanced job processor for H1B sponsorship detection and technology categorization
    Uses tiered LLM processing for cost optimization
    """
    
    def __init__(self):
        """Initialize OpenAI client and database manager"""
        # Handle both OPENAI_API_KEY and OPEN_AI_KEY environment variables
        api_key = os.getenv('OPENAI_API_KEY') or os.getenv('OPEN_AI_KEY')
        if not api_key:
            raise ValueError("OpenAI API key not found. Set OPENAI_API_KEY or OPEN_AI_KEY environment variable.")
        
        self.client = openai.OpenAI(api_key=api_key)
        
        # Initialize database manager
        if db_config.is_postgresql():
            self.db_manager = SupabaseDatabaseManager()
        else:
            self.db_manager = DatabaseManager()
        
        # Model configuration for tiered processing
        self.models = {
            'cheap': 'gpt-4o-mini',      # Fast, cost-effective model
            'premium': 'gpt-4.1-mini-2025-04-14'  # Higher accuracy model
        }
        
        self.max_tokens = 1500
        self.temperature = 0.1  # Low temperature for consistent classification
        
        # Deterministic sponsorship patterns for Stage 1 filtering
        self.negative_sponsorship_patterns = [
            r'will not sponsor',
            r'unable to sponsor', 
            r'cannot sponsor',
            r'does not sponsor',
            r'no sponsorship',
            r'require.*authorization.*without.*sponsor',
            r'authorized.*work.*without.*sponsor',
            r'must be authorized.*without.*sponsor',
            r'sponsorship.*not.*available',
            r'no.*visa.*sponsor'
        ]
        
        self.positive_sponsorship_patterns = [
            r'sponsor.*h1b',
            r'h1b.*sponsor',
            r'visa.*sponsor',
            r'sponsor.*visa',
            r'immigration.*sponsor',
            r'will.*sponsor',
            r'provide.*sponsor'
        ]
        
        # Processing statistics
        self.stats = {
            'total_jobs_processed': 0,
            'deterministic_classifications': 0,
            'cheap_model_classifications': 0,
            'premium_model_classifications': 0,
            'total_tokens_used': 0,
            'total_cost_saved': 0.0
        }
    
    def process_job_batch(self, limit: int = 20) -> Dict[str, Any]:
        """
        Process a batch of unprocessed jobs with enhanced data extraction
        
        Args:
            limit: Maximum number of jobs to process in this batch
            
        Returns:
            Dictionary with processing results and statistics
        """
        logger.info(f"Starting enhanced job processing batch (limit: {limit})")
        
        # Get unprocessed jobs
        unprocessed_jobs = self._get_unprocessed_jobs(limit)
        
        if not unprocessed_jobs:
            logger.info("No unprocessed jobs found")
            return {
                'processed': 0,
                'errors': 0,
                'results': []
            }
        
        results = {
            'processed': 0,
            'errors': 0,
            'results': []
        }
        
        for job in unprocessed_jobs:
            try:
                # Mark job as processing
                self._update_job_processing_status(job['id'], 'processing')
                
                # Perform enhanced processing
                enhanced_data = self._process_single_job(job)
                
                # Update job with enhanced data
                self._update_job_with_enhanced_data(job['id'], enhanced_data)
                
                # Mark job as completed
                self._update_job_processing_status(job['id'], 'completed')
                
                results['processed'] += 1
                results['results'].append({
                    'job_id': job['job_id'],
                    'sponsorship_status': enhanced_data['sponsorship']['status'],
                    'tech_count': len(enhanced_data['technologies']['technologies'])
                })
                
                logger.info(f"Processed job {job['job_id']}: {enhanced_data['sponsorship']['status']}")
                
            except Exception as e:
                logger.error(f"Error processing job {job['job_id']}: {e}")
                self._update_job_processing_status(job['id'], 'failed', str(e))
                results['errors'] += 1
        
        logger.info(f"Batch processing complete: {results['processed']} processed, {results['errors']} errors")
        return results
    
    def _get_unprocessed_jobs(self, limit: int) -> List[Dict[str, Any]]:
        """Get jobs that need enhanced processing"""
        query = """
        SELECT id, job_id, title, company, description, requirements
        FROM jobs 
        WHERE processing_status = 'new' 
        AND is_active = true
        AND description IS NOT NULL
        ORDER BY scraped_at ASC
        LIMIT %s
        """
        
        return self.db_manager.execute_query(query, (limit,))
    
    def _process_single_job(self, job: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process a single job with tiered LLM approach
        
        Stage 1: Deterministic pattern matching
        Stage 2: Cheap model classification  
        Stage 3: Premium model for ambiguous cases
        """
        job_text = f"{job['title']} {job['description']} {job.get('requirements', '')}"
        
        # Stage 1: Deterministic sponsorship detection
        sponsorship_result = self._deterministic_sponsorship_check(job_text)
        
        if sponsorship_result['confidence'] >= 0.9:
            logger.info(f"Job {job['job_id']}: Deterministic sponsorship classification")
            self.stats['deterministic_classifications'] += 1
            
            # Still need to extract technologies via LLM
            tech_result = self._extract_technologies_with_llm(job_text, model='cheap')
            
            return {
                'sponsorship': sponsorship_result,
                'technologies': tech_result
            }
        
        # Stage 2: Cheap model for full classification
        cheap_result = self._classify_with_llm(job_text, model='cheap')
        
        if cheap_result['sponsorship']['confidence'] >= 0.85:
            logger.info(f"Job {job['job_id']}: Cheap model classification")
            self.stats['cheap_model_classifications'] += 1
            return cheap_result
        
        # Stage 3: Premium model for ambiguous cases
        logger.info(f"Job {job['job_id']}: Escalating to premium model")
        self.stats['premium_model_classifications'] += 1
        premium_result = self._classify_with_llm(job_text, model='premium')
        
        return premium_result
    
    def _deterministic_sponsorship_check(self, job_text: str) -> Dict[str, Any]:
        """
        Stage 1: Fast deterministic sponsorship detection using regex patterns
        """
        job_text_lower = job_text.lower()
        
        # Check for explicit negative patterns
        for pattern in self.negative_sponsorship_patterns:
            if re.search(pattern, job_text_lower):
                return {
                    'status': 'NO_SPONSORSHIP',
                    'confidence': 1.0,
                    'reasoning': f'Deterministic: Found negative pattern "{pattern}"'
                }
        
        # Check for explicit positive patterns
        positive_matches = []
        for pattern in self.positive_sponsorship_patterns:
            if re.search(pattern, job_text_lower):
                positive_matches.append(pattern)
        
        if len(positive_matches) >= 2:  # Multiple positive indicators
            return {
                'status': 'SPONSORS_H1B',
                'confidence': 0.95,
                'reasoning': f'Deterministic: Found positive patterns {positive_matches}'
            }
        elif len(positive_matches) == 1:  # Single positive indicator
            return {
                'status': 'SPONSORS_H1B', 
                'confidence': 0.8,
                'reasoning': f'Deterministic: Found positive pattern {positive_matches[0]}'
            }
        
        # No clear deterministic match
        return {
            'status': 'UNCERTAIN',
            'confidence': 0.0,
            'reasoning': 'Deterministic: No clear patterns found'
        }
    
    def _classify_with_llm(self, job_text: str, model: str) -> Dict[str, Any]:
        """
        Stage 2/3: LLM-powered classification for sponsorship and technology extraction
        """
        prompt = self._create_classification_prompt(job_text)
        
        try:
            response = self.client.chat.completions.create(
                model=self.models[model],
                messages=[
                    {
                        "role": "system", 
                        "content": "You are an expert job analyst specializing in H1B visa sponsorship detection and technology stack extraction for software engineering roles. Provide accurate, structured analysis."
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
            
            result = json.loads(response.choices[0].message.content)
            
            # Track token usage
            self.stats['total_tokens_used'] += response.usage.total_tokens
            
            return {
                'sponsorship': result['sponsorship'],
                'technologies': result['technologies']
            }
            
        except Exception as e:
            logger.error(f"LLM classification failed: {e}")
            return {
                'sponsorship': {
                    'status': 'UNCERTAIN',
                    'confidence': 0.0,
                    'reasoning': f'LLM processing failed: {str(e)}'
                },
                'technologies': {
                    'technologies': [],
                    'summary': {'required_count': 0, 'preferred_count': 0}
                }
            }
    
    def _extract_technologies_with_llm(self, job_text: str, model: str) -> Dict[str, Any]:
        """Extract only technologies when sponsorship is already determined"""
        prompt = f"""
        Extract all technologies, tools, and platforms from this job description. 
        Categorize each as 'LANGUAGE', 'FRAMEWORK_LIBRARY', 'DATABASE', 'CLOUD_PLATFORM', 'DEVOPS_TOOL', or 'SOFTWARE'.
        Determine if each is 'REQUIRED' or 'PREFERRED' based on context.

        Job Description:
        {job_text[:2000]}

        Return JSON:
        {{
          "technologies": [
            {{"name": "Python", "category": "LANGUAGE", "level": "REQUIRED", "experience_years": "3+"}},
            {{"name": "AWS", "category": "CLOUD_PLATFORM", "level": "PREFERRED", "experience_years": "1+"}}
          ],
          "summary": {{
            "required_count": 5,
            "preferred_count": 3,
            "primary_language": "Python",
            "primary_framework": "Django"
          }}
        }}
        """
        
        try:
            response = self.client.chat.completions.create(
                model=self.models[model],
                messages=[{"role": "user", "content": prompt}],
                max_tokens=800,
                temperature=self.temperature,
                response_format={"type": "json_object"}
            )
            
            result = json.loads(response.choices[0].message.content)
            self.stats['total_tokens_used'] += response.usage.total_tokens
            
            return result
            
        except Exception as e:
            logger.error(f"Technology extraction failed: {e}")
            return {
                'technologies': [],
                'summary': {'required_count': 0, 'preferred_count': 0}
            }
    
    def _create_classification_prompt(self, job_text: str) -> str:
        """Create comprehensive prompt for sponsorship and technology classification"""
        return f"""
        Analyze this job posting for H1B visa sponsorship and extract the technology stack.

        Job Description:
        {job_text[:2500]}

        SPONSORSHIP ANALYSIS:
        Classify H1B sponsorship as 'SPONSORS_H1B', 'NO_SPONSORSHIP', or 'UNCERTAIN'.
        Look for phrases like:
        - Negative: "will not sponsor", "unable to sponsor", "requires authorization without sponsorship"
        - Positive: "sponsor H1B", "visa sponsorship available", "will sponsor"
        - Be conservative: when unclear, mark as UNCERTAIN

        TECHNOLOGY EXTRACTION:
        Extract all technologies and categorize them. Include experience requirements when mentioned.

        Return JSON:
        {{
          "sponsorship": {{
            "status": "SPONSORS_H1B|NO_SPONSORSHIP|UNCERTAIN",
            "confidence": 0.95,
            "reasoning": "Clear statement: 'We sponsor H1B visas'"
          }},
          "technologies": {{
            "technologies": [
              {{"name": "Python", "category": "LANGUAGE", "level": "REQUIRED", "experience_years": "3+"}},
              {{"name": "Django", "category": "FRAMEWORK_LIBRARY", "level": "REQUIRED", "experience_years": "2+"}},
              {{"name": "AWS", "category": "CLOUD_PLATFORM", "level": "PREFERRED", "experience_years": "1+"}}
            ],
            "summary": {{
              "required_count": 5,
              "preferred_count": 3,
              "primary_language": "Python",
              "primary_framework": "Django"
            }}
          }}
        }}
        """
    
    def _update_job_processing_status(self, job_id: str, status: str, error_msg: str = None):
        """Update job processing status in database"""
        query = """
        UPDATE jobs 
        SET processing_status = %s, 
            last_processed_at = NOW(),
            processing_error = %s
        WHERE id = %s
        """
        
        self.db_manager.execute_query(query, (status, error_msg, job_id))
    
    def _update_job_with_enhanced_data(self, job_id: str, enhanced_data: Dict[str, Any]):
        """Update job with sponsorship and technology data"""
        sponsorship = enhanced_data['sponsorship']
        technologies = enhanced_data['technologies']
        
        query = """
        UPDATE jobs 
        SET sponsorship_status = %s,
            sponsorship_confidence = %s,
            sponsorship_reasoning = %s,
            enhanced_tech_stack = %s,
            last_processed_at = NOW()
        WHERE id = %s
        """
        
        self.db_manager.execute_query(query, (
            sponsorship['status'],
            sponsorship['confidence'],
            sponsorship['reasoning'],
            json.dumps(technologies),
            job_id
        ))
    
    def get_processing_statistics(self) -> Dict[str, Any]:
        """Get processing statistics and cost analysis"""
        
        # Get database statistics
        db_stats_query = """
        SELECT 
            COUNT(*) as total_jobs,
            COUNT(*) FILTER (WHERE processing_status = 'completed') as processed_jobs,
            COUNT(*) FILTER (WHERE processing_status = 'failed') as failed_jobs,
            COUNT(*) FILTER (WHERE sponsorship_status = 'SPONSORS_H1B') as sponsors_h1b,
            COUNT(*) FILTER (WHERE sponsorship_status = 'NO_SPONSORSHIP') as no_sponsorship,
            COUNT(*) FILTER (WHERE sponsorship_status = 'UNCERTAIN') as uncertain_sponsorship
        FROM jobs 
        WHERE is_active = true
        """
        
        db_stats = self.db_manager.execute_query(db_stats_query)
        
        return {
            **self.stats,
            'database_stats': db_stats[0] if db_stats else {},
            'processing_efficiency': {
                'deterministic_percentage': (self.stats['deterministic_classifications'] / max(1, self.stats['total_jobs_processed'])) * 100,
                'cheap_model_percentage': (self.stats['cheap_model_classifications'] / max(1, self.stats['total_jobs_processed'])) * 100,
                'premium_model_percentage': (self.stats['premium_model_classifications'] / max(1, self.stats['total_jobs_processed'])) * 100
            }
        }

if __name__ == "__main__":
    # Test the processor
    logging.basicConfig(level=logging.INFO)
    
    processor = EnhancedJobProcessor()
    
    # Process a small batch
    results = processor.process_job_batch(limit=5)
    print(f"Processing results: {results}")
    
    # Get statistics
    stats = processor.get_processing_statistics()
    print(f"Processing statistics: {stats}")