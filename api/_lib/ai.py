"""
AI Service using Vercel AI SDK for Python
Handles all LLM interactions with streaming support
"""
import os
from typing import Dict, Any, Optional, AsyncIterator
from openai import AsyncOpenAI
import json

class AIService:
    def __init__(self):
        # Initialize with OpenAI by default
        self.client = AsyncOpenAI(
            api_key=os.getenv('OPENAI_API_KEY')
        )
        self.model = os.getenv('OPENAI_MODEL', 'gpt-4-turbo-preview')
    
    async def analyze_job_streaming(self, job_description: str, role: str) -> AsyncIterator[str]:
        """
        Analyze job description with streaming response
        Perfect for real-time UI updates
        """
        messages = [
            {
                "role": "system", 
                "content": """You are an expert resume optimization specialist. 
                Analyze the job description and extract:
                1. Key technical skills required
                2. Soft skills and competencies
                3. Experience requirements
                4. Industry-specific keywords
                5. ATS optimization suggestions
                
                Return your analysis in JSON format."""
            },
            {
                "role": "user",
                "content": f"Job Title: {role}\n\nJob Description:\n{job_description}"
            }
        ]
        
        stream = await self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=0.3,
            stream=True,
            response_format={"type": "json_object"}
        )
        
        async for chunk in stream:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content
    
    async def analyze_job(self, job_description: str, role: str) -> Dict[str, Any]:
        """
        Analyze job description and return structured data
        Non-streaming version for background processing
        """
        messages = [
            {
                "role": "system", 
                "content": """You are an expert resume optimization specialist. 
                Analyze the job description and extract:
                1. Key technical skills required
                2. Soft skills and competencies
                3. Experience requirements
                4. Industry-specific keywords
                5. ATS optimization suggestions
                
                Return your analysis in JSON format."""
            },
            {
                "role": "user",
                "content": f"Job Title: {role}\n\nJob Description:\n{job_description}"
            }
        ]
        
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=0.3,
            response_format={"type": "json_object"}
        )
        
        content = response.choices[0].message.content
        return json.loads(content)
    
    async def tailor_resume_streaming(
        self, 
        job_description: str, 
        company: str, 
        role: str,
        base_resume: Dict[str, Any]
    ) -> AsyncIterator[str]:
        """
        Tailor resume with streaming response for real-time updates
        """
        messages = [
            {
                "role": "system",
                "content": """You are an expert resume writer specializing in ATS-optimized resumes.
                Tailor the provided resume for the specific job posting.
                
                INSTRUCTIONS:
                1. Optimize the summary to directly address job requirements
                2. Emphasize relevant experiences and achievements
                3. Integrate keywords naturally (no keyword stuffing)
                4. Quantify achievements with specific metrics
                5. Ensure ATS-friendly formatting
                
                Return the tailored resume in JSON format with sections:
                - summary
                - experience (array of positions with achievements)
                - skills (categorized)
                - education
                """
            },
            {
                "role": "user",
                "content": f"""Target Company: {company}
                Target Role: {role}
                
                Job Description:
                {job_description}
                
                Current Resume:
                {json.dumps(base_resume, indent=2)}
                """
            }
        ]
        
        stream = await self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=0.7,
            stream=True,
            response_format={"type": "json_object"}
        )
        
        async for chunk in stream:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content
    
    async def generate_section(
        self,
        section_type: str,
        keywords: list[str],
        context: Dict[str, Any],
        base_content: Optional[str] = None
    ) -> str:
        """
        Generate a specific resume section
        """
        section_prompts = {
            "summary": "Write a compelling professional summary that highlights the candidate's fit for the role",
            "experience": "Generate achievement-focused bullet points that demonstrate impact and results",
            "skills": "Organize technical and soft skills in a clear, ATS-friendly format"
        }
        
        prompt = section_prompts.get(section_type, "Generate appropriate content for this resume section")
        
        messages = [
            {
                "role": "system",
                "content": f"""You are crafting a resume section. {prompt}
                
                Use these keywords naturally: {', '.join(keywords)}
                Make it compelling, specific, and results-oriented.
                """
            },
            {
                "role": "user",
                "content": f"""Section Type: {section_type}
                Role Context: {json.dumps(context)}
                Base Content: {base_content or 'Create new content'}
                """
            }
        ]
        
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=0.8,
            max_tokens=500
        )
        
        return response.choices[0].message.content

# Helper function for edge runtime compatibility
def create_ai_service() -> AIService:
    """Factory function to create AI service instance"""
    return AIService()