"""
LLM Factory
Creates appropriate LLM service instances based on provider configuration
"""

import os
from typing import Optional
from .llm_service import LLMService
from .lmstudio_service import LMStudioService
from .openai_service import OpenAIService
from .gemini_service import GeminiService
import logging

logger = logging.getLogger(__name__)

class LLMFactory:
    """Factory for creating LLM service instances"""
    
    @staticmethod
    def create_service(
        provider: str, 
        api_url: Optional[str] = None,
        model: Optional[str] = None
    ) -> LLMService:
        """
        Create an LLM service instance
        
        Args:
            provider: The LLM provider ("lmstudio", "openai", "gemini")
            api_url: API URL for local providers like LMStudio
            model: Model name to use
            
        Returns:
            LLMService instance
            
        Raises:
            ValueError: If provider is invalid or required API keys are missing
        """
        provider = provider.lower()
        
        if provider == "lmstudio":
            api_url = api_url or os.getenv("LMSTUDIO_API_URL", "http://localhost:1234")
            return LMStudioService(api_url=api_url)
        
        elif provider == "openai":
            api_key = os.getenv("OPENAI_API_KEY")
            if not api_key:
                raise ValueError("OpenAI API key not configured in environment variables")
            model = model or os.getenv("OPENAI_MODEL", "gpt-3.5-turbo")
            return OpenAIService(api_key=api_key, model=model)
        
        elif provider == "gemini":
            api_key = os.getenv("GEMINI_API_KEY")
            if not api_key:
                raise ValueError("Gemini API key not configured in environment variables")
            model = model or os.getenv("GEMINI_MODEL", "gemini-pro")
            return GeminiService(api_key=api_key, model=model)
        
        else:
            raise ValueError(f"Invalid LLM provider: {provider}. Supported: lmstudio, openai, gemini")
    
    @staticmethod
    def get_default_provider() -> str:
        """Get the default LLM provider from environment"""
        return os.getenv("DEFAULT_LLM_PROVIDER", "lmstudio")
    
    @staticmethod
    def create_default_service() -> LLMService:
        """Create service using default provider configuration"""
        provider = LLMFactory.get_default_provider()
        return LLMFactory.create_service(provider)
    
    @staticmethod
    def list_available_providers() -> list:
        """List all available LLM providers"""
        providers = []
        
        # Check LMStudio availability
        try:
            service = LMStudioService()
            if service.is_available():
                providers.append({
                    "name": "lmstudio",
                    "display_name": "LMStudio",
                    "available": True,
                    "requires_api_key": False
                })
            else:
                providers.append({
                    "name": "lmstudio", 
                    "display_name": "LMStudio",
                    "available": False,
                    "requires_api_key": False
                })
        except Exception:
            providers.append({
                "name": "lmstudio",
                "display_name": "LMStudio", 
                "available": False,
                "requires_api_key": False
            })
        
        # Check OpenAI availability
        openai_key = os.getenv("OPENAI_API_KEY")
        providers.append({
            "name": "openai",
            "display_name": "OpenAI GPT",
            "available": bool(openai_key),
            "requires_api_key": False  # Keys are handled in environment only
        })
        
        # Check Gemini availability
        gemini_key = os.getenv("GEMINI_API_KEY")
        providers.append({
            "name": "gemini",
            "display_name": "Google Gemini",
            "available": bool(gemini_key),
            "requires_api_key": False  # Keys are handled in environment only
        })
        
        return providers