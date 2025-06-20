"""
Abstract LLM Service Interface
Defines common interface for different AI providers (LMStudio, OpenAI, Gemini)
"""

from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)

@dataclass
class LLMResponse:
    """Standard response format for LLM services"""
    content: str
    success: bool = True
    error: Optional[str] = None
    usage: Optional[Dict[str, Any]] = None

class LLMService(ABC):
    """Abstract base class for LLM services"""
    
    def __init__(self, provider_name: str):
        self.provider_name = provider_name
        self.logger = logging.getLogger(f"LLM.{provider_name}")
    
    @abstractmethod
    def test_connection(self) -> bool:
        """Test if the LLM service is available"""
        pass
    
    @abstractmethod
    def analyze_job_description(self, job_description: str, role: str) -> LLMResponse:
        """Analyze job description and extract strategic insights"""
        pass
    
    @abstractmethod
    def generate_resume_section(
        self, 
        section_type: str, 
        context: Dict[str, Any],
        preferences: Optional[Dict[str, Any]] = None
    ) -> LLMResponse:
        """Generate content for a specific resume section"""
        pass
    
    def is_available(self) -> bool:
        """Check if the service is available and working"""
        try:
            return self.test_connection()
        except Exception as e:
            self.logger.error(f"Error checking availability: {e}")
            return False