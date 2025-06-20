"""
OpenAI LLM Service Implementation
Implements the LLM service interface using OpenAI's API
"""

import openai
from typing import Dict, Any, Optional
from .llm_service import LLMService, LLMResponse
import logging
import json

logger = logging.getLogger(__name__)

class OpenAIService(LLMService):
    """OpenAI implementation of LLM service"""
    
    def __init__(self, api_key: str, model: str = "gpt-3.5-turbo"):
        super().__init__("OpenAI")
        self.api_key = api_key
        self.model = model
        self.client = openai.OpenAI(api_key=api_key)
    
    def test_connection(self) -> bool:
        """Test if OpenAI API is accessible"""
        try:
            # Test with a simple completion
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": "Hello"}],
                max_tokens=5
            )
            return True
        except Exception as e:
            self.logger.error(f"OpenAI connection test failed: {e}")
            return False
    
    def analyze_job_description(self, job_description: str, role: str) -> LLMResponse:
        """Analyze job description using OpenAI"""
        try:
            system_prompt = """You are an expert resume strategist. Analyze the job description and extract key information in JSON format.

Return a JSON object with the following structure:
{
    "technical_skills": ["skill1", "skill2"],
    "soft_skills": ["skill1", "skill2"], 
    "experience_requirements": ["requirement1", "requirement2"],
    "programming_languages": ["language1", "language2"],
    "frameworks_libraries_tools": ["tool1", "tool2"],
    "methodologies_concepts": ["methodology1", "methodology2"],
    "critical_keywords": ["keyword1", "keyword2"],
    "job_info": {
        "seniority": "Mid-level",
        "department": "Engineering"
    }
}"""
            
            user_prompt = f"Role: {role}\n\nJob Description:\n{job_description}"
            
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                max_tokens=1000,
                temperature=0.1
            )
            
            content = response.choices[0].message.content
            
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
                    "provider": "openai",
                    "model": self.model,
                    "tokens": response.usage.total_tokens if response.usage else None
                }
            )
            
        except Exception as e:
            self.logger.error(f"Error analyzing job description with OpenAI: {e}")
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
        """Generate resume section using OpenAI"""
        try:
            system_prompt = f"You are an expert resume writer. Generate a professional {section_type} section for a resume."
            
            user_prompt = f"Context: {json.dumps(context)}\nPreferences: {json.dumps(preferences or {})}\n\nGenerate a {section_type} section:"
            
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                max_tokens=500,
                temperature=0.3
            )
            
            content = response.choices[0].message.content
            
            return LLMResponse(
                content=content,
                success=True,
                usage={
                    "provider": "openai",
                    "model": self.model,
                    "tokens": response.usage.total_tokens if response.usage else None
                }
            )
            
        except Exception as e:
            self.logger.error(f"Error generating section with OpenAI: {e}")
            return LLMResponse(
                content="",
                success=False,
                error=str(e)
            )