"""
Gemini LLM Service Implementation
Implements the LLM service interface using Google's Gemini API
"""

import google.generativeai as genai
from typing import Dict, Any, Optional
from .llm_service import LLMService, LLMResponse
import logging
import json

logger = logging.getLogger(__name__)

class GeminiService(LLMService):
    """Gemini implementation of LLM service"""
    
    def __init__(self, api_key: str, model: str = "gemini-pro"):
        super().__init__("Gemini")
        self.api_key = api_key
        self.model_name = model
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel(model)
    
    def test_connection(self) -> bool:
        """Test if Gemini API is accessible"""
        try:
            # Test with a simple generation
            response = self.model.generate_content("Hello")
            return True
        except Exception as e:
            self.logger.error(f"Gemini connection test failed: {e}")
            return False
    
    def analyze_job_description(self, job_description: str, role: str) -> LLMResponse:
        """Analyze job description using Gemini"""
        try:
            prompt = f"""You are an expert resume strategist. Analyze the job description and extract key information in JSON format.

Role: {role}

Job Description:
{job_description}

Return a JSON object with the following structure:
{{
    "technical_skills": ["skill1", "skill2"],
    "soft_skills": ["skill1", "skill2"], 
    "experience_requirements": ["requirement1", "requirement2"],
    "programming_languages": ["language1", "language2"],
    "frameworks_libraries_tools": ["tool1", "tool2"],
    "methodologies_concepts": ["methodology1", "methodology2"],
    "critical_keywords": ["keyword1", "keyword2"],
    "job_info": {{
        "seniority": "Mid-level",
        "department": "Engineering"
    }}
}}"""
            
            response = self.model.generate_content(
                prompt,
                generation_config=genai.types.GenerationConfig(
                    max_output_tokens=1000,
                    temperature=0.1
                )
            )
            
            content = response.text
            
            # Try to parse as JSON
            try:
                analysis = json.loads(content)
            except json.JSONDecodeError:
                # If not valid JSON, return the raw content
                analysis = {"raw_response": content}
            
            return LLMResponse(
                content=json.dumps(analysis),
                success=True,
                usage={
                    "provider": "gemini",
                    "model": self.model_name
                }
            )
            
        except Exception as e:
            self.logger.error(f"Error analyzing job description with Gemini: {e}")
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
        """Generate resume section using Gemini"""
        try:
            prompt = f"""You are an expert resume writer. Generate a professional {section_type} section for a resume.

Context: {json.dumps(context)}
Preferences: {json.dumps(preferences or {})}

Generate a {section_type} section that is:
- Professional and engaging
- Tailored to the job requirements
- Optimized for ATS systems
- Concise but impactful"""
            
            response = self.model.generate_content(
                prompt,
                generation_config=genai.types.GenerationConfig(
                    max_output_tokens=500,
                    temperature=0.3
                )
            )
            
            content = response.text
            
            return LLMResponse(
                content=content,
                success=True,
                usage={
                    "provider": "gemini",
                    "model": self.model_name
                }
            )
            
        except Exception as e:
            self.logger.error(f"Error generating section with Gemini: {e}")
            return LLMResponse(
                content="",
                success=False,
                error=str(e)
            )