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
        """Create service using default provider configuration with automatic fallback"""
        provider = LLMFactory.get_default_provider()
        
        # Try the default provider first
        if provider == "lmstudio":
            try:
                service = LLMFactory.create_service(provider)
                if service.is_available():
                    logger.info(f"Using LMStudio (local) as LLM provider")
                    return service
                else:
                    logger.info("LMStudio not available, falling back to cloud provider")
            except Exception as e:
                logger.info(f"LMStudio initialization failed: {e}, falling back to cloud provider")
        
        # If LMStudio is not available or not the default, try cloud providers
        # First try OpenAI if configured
        if os.getenv("OPENAI_API_KEY"):
            try:
                service = LLMFactory.create_service("openai")
                logger.info("Using OpenAI as LLM provider")
                return service
            except Exception as e:
                logger.warning(f"OpenAI initialization failed: {e}")
        
        # Then try Gemini if configured
        if os.getenv("GEMINI_API_KEY"):
            try:
                service = LLMFactory.create_service("gemini")
                logger.info("Using Gemini as LLM provider")
                return service
            except Exception as e:
                logger.warning(f"Gemini initialization failed: {e}")
        
        # If we still don't have a provider, try the original default
        if provider != "lmstudio":
            try:
                service = LLMFactory.create_service(provider)
                logger.info(f"Using {provider} as LLM provider")
                return service
            except Exception as e:
                logger.error(f"Failed to initialize {provider}: {e}")
        
        raise ValueError("No LLM provider available. Please configure OPENAI_API_KEY or ensure LMStudio is running.")
    
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