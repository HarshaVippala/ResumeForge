"""
LMStudio LLM Service Implementation
Wraps the existing LMStudioClient to work with the new LLM service interface
"""

from typing import Dict, Any, Optional
from .llm_service import LLMService, LLMResponse
from .lm_studio_client import LMStudioClient
from .keyword_extractor import KeywordExtractor
import logging

logger = logging.getLogger(__name__)

class LMStudioService(LLMService):
    """LMStudio implementation of LLM service"""
    
    def __init__(self, api_url: str = "http://localhost:1234"):
        super().__init__("LMStudio")
        self.client = LMStudioClient(api_url)
        self.keyword_extractor = KeywordExtractor(self.client)
    
    def test_connection(self) -> bool:
        """Test if LMStudio server is available"""
        return self.client.test_connection()
    
    def analyze_job_description(self, job_description: str, role: str) -> LLMResponse:
        """Analyze job description using LMStudio"""
        try:
            # Use existing keyword extractor
            analysis = self.keyword_extractor.analyze_job_description(job_description, role)
            
            return LLMResponse(
                content=str(analysis),  # Convert to string representation
                success=True,
                usage={"provider": "lmstudio"}
            )
        except Exception as e:
            self.logger.error(f"Error analyzing job description: {e}")
            return LLMResponse(
                content="",
                success=False,
                error=str(e)
            )
    
    def generate_resume_section(
        self, 
        section_type: str, 
        context: Dict[str, Any],
        preferences: Optional[Dict[str, Any]] = None
    ) -> LLMResponse:
        """Generate resume section using LMStudio"""
        try:
            # This would use the existing section generator
            # For now, return a placeholder
            return LLMResponse(
                content=f"Generated {section_type} section using LMStudio",
                success=True,
                usage={"provider": "lmstudio"}
            )
        except Exception as e:
            self.logger.error(f"Error generating section: {e}")
            return LLMResponse(
                content="",
                success=False,
                error=str(e)
            )