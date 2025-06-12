"""
LM Studio Client for local AI processing
Handles communication with LM Studio API
"""

import requests
import json
import logging
from typing import Optional, Dict, Any, Union, List
import time

logger = logging.getLogger(__name__)

class LMStudioClient:
    """Client for communicating with LM Studio local AI models"""
    
    def __init__(self, base_url: str = "http://localhost:1234"):
        self.base_url = base_url
        self.headers = {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer lm-studio'  # LM Studio API key as per docs
        }
        self.timeout = 300  # 5 minutes timeout for high-quality analysis
        self.model_name = "deepseek/deepseek-r1-0528-qwen3-8b"  # DeepSeek R1 reasoning model for highest quality strategic analysis
        
        logger.info(f"LM Studio client initialized with DeepSeek model: {self.model_name}")
        
    def test_connection(self) -> bool:
        """Test if LM Studio server is available"""
        try:
            response = requests.get(
                f"{self.base_url}/v1/models",
                timeout=5
            )
            return response.status_code == 200
        except requests.exceptions.RequestException:
            return False
    
    def get_available_models(self) -> list:
        """Get list of available models in LM Studio"""
        try:
            response = requests.get(
                f"{self.base_url}/v1/models",
                headers=self.headers,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                return [model['id'] for model in data.get('data', [])]
            else:
                logger.warning(f"Failed to get models: {response.status_code}")
                return []
                
        except requests.exceptions.RequestException as e:
            logger.error(f"Error getting models: {e}")
            return []
    
    def generate_completion(
        self, 
        prompt: str, 
        max_tokens: int = 2000,
        temperature: float = 0.7,
        model: Optional[str] = None,
        json_schema: Optional[Dict[str, Any]] = None,
        seed: Optional[int] = None,
        top_k: int = 40,
        top_p: float = 0.95,
        min_p: float = 0.05,
        repeat_penalty: float = 1.1,
        presence_penalty: float = 0.0,
        frequency_penalty: float = 0.0
    ) -> Optional[str]:
        """
        Generate text completion using LM Studio
        
        Args:
            prompt: Input prompt for the model
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature (0.0 to 1.0)
            model: Specific model to use (optional)
            json_schema: JSON schema for structured output (optional)
            seed: Random seed for reproducibility (optional)
            top_k: Limit vocab to top K tokens
            top_p: Nucleus sampling threshold
            min_p: Minimum probability threshold
            repeat_penalty: Penalty for repeating tokens
            presence_penalty: Penalty for using tokens already in context
            frequency_penalty: Penalty based on token frequency
            
        Returns:
            Generated text or None if failed
        """
        try:
            payload = {
                "prompt": prompt,
                "max_tokens": max_tokens,
                "temperature": temperature,
                "stream": False,
                "stop": ["Human:", "Assistant:", "\n\n---"],
                "top_k": top_k,
                "top_p": top_p,
                "min_p": min_p,
                "repeat_penalty": repeat_penalty,
                "presence_penalty": presence_penalty,
                "frequency_penalty": frequency_penalty
            }
            
            # Add seed if provided for reproducibility
            if seed is not None:
                payload["seed"] = seed
            
            # Always use DeepSeek model unless explicitly overridden
            payload["model"] = model or self.model_name
            
            # Add structured output if schema provided
            if json_schema:
                payload["response_format"] = {
                    "type": "json_schema",
                    "json_schema": json_schema
                }
                logger.info("Using structured output with JSON schema")
            
            logger.info(f"Sending request to LM Studio (max_tokens={max_tokens})")
            start_time = time.time()
            
            response = requests.post(
                f"{self.base_url}/v1/completions",
                headers=self.headers,
                json=payload,
                timeout=self.timeout
            )
            
            elapsed_time = time.time() - start_time
            logger.info(f"LM Studio response received in {elapsed_time:.2f}s")
            
            if response.status_code == 200:
                data = response.json()
                
                if 'choices' in data and len(data['choices']) > 0:
                    generated_text = data['choices'][0]['text'].strip()
                    logger.info(f"Generated {len(generated_text)} characters")
                    return generated_text
                else:
                    logger.error("No choices in response")
                    return None
                    
            else:
                logger.error(f"LM Studio API error: {response.status_code} - {response.text}")
                return None
                
        except requests.exceptions.Timeout:
            logger.error("LM Studio request timed out")
            return None
        except requests.exceptions.RequestException as e:
            logger.error(f"LM Studio request failed: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error in LM Studio client: {e}")
            return None
    
    def generate_chat_completion(
        self,
        messages: list,
        max_tokens: int = 2000,
        temperature: float = 0.7,
        model: Optional[str] = None,
        json_schema: Optional[Dict[str, Any]] = None,
        seed: Optional[int] = None,
        top_k: int = 40,
        top_p: float = 0.95,
        min_p: float = 0.05,
        repeat_penalty: float = 1.1,
        presence_penalty: float = 0.0,
        frequency_penalty: float = 0.0
    ) -> Optional[str]:
        """
        Generate chat completion using LM Studio chat endpoint
        
        Args:
            messages: List of message dicts with 'role' and 'content'
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature
            model: Specific model to use
            json_schema: JSON schema for structured output (optional)
            seed: Random seed for reproducibility (optional)
            top_k: Limit vocab to top K tokens
            top_p: Nucleus sampling threshold
            min_p: Minimum probability threshold
            repeat_penalty: Penalty for repeating tokens
            presence_penalty: Penalty for using tokens already in context
            frequency_penalty: Penalty based on token frequency
            
        Returns:
            Generated response or None if failed
        """
        try:
            payload = {
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": temperature,
                "stream": False,
                "top_k": top_k,
                "top_p": top_p,
                "min_p": min_p,
                "repeat_penalty": repeat_penalty,
                "presence_penalty": presence_penalty,
                "frequency_penalty": frequency_penalty
            }
            
            # Add seed if provided for reproducibility
            if seed is not None:
                payload["seed"] = seed
            
            # Always use DeepSeek model unless explicitly overridden
            payload["model"] = model or self.model_name
            
            # Add structured output if schema provided
            if json_schema:
                payload["response_format"] = {
                    "type": "json_schema",
                    "json_schema": json_schema
                }
                logger.info("Using structured output with JSON schema for chat")
            
            logger.info(f"Sending chat request to LM Studio")
            start_time = time.time()
            
            response = requests.post(
                f"{self.base_url}/v1/chat/completions",
                headers=self.headers,
                json=payload,
                timeout=self.timeout
            )
            
            elapsed_time = time.time() - start_time
            logger.info(f"LM Studio chat response received in {elapsed_time:.2f}s")
            
            if response.status_code == 200:
                data = response.json()
                
                if 'choices' in data and len(data['choices']) > 0:
                    message = data['choices'][0]['message']
                    generated_text = message['content'].strip()
                    logger.info(f"Generated {len(generated_text)} characters")
                    return generated_text
                else:
                    logger.error("No choices in chat response")
                    return None
                    
            else:
                logger.error(f"LM Studio chat API error: {response.status_code} - {response.text}")
                return None
                
        except requests.exceptions.Timeout:
            logger.error("LM Studio chat request timed out")
            return None
        except requests.exceptions.RequestException as e:
            logger.error(f"LM Studio chat request failed: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error in LM Studio chat: {e}")
            return None
    
    def generate_structured_response(
        self,
        system_prompt: str,
        user_prompt: str,
        expected_format: str = "JSON",
        max_tokens: int = 2000,
        temperature: float = 0.7,
        model: Optional[str] = None,
        json_schema: Optional[Dict[str, Any]] = None
    ) -> Optional[Union[Dict[str, Any], List[Any], str]]:
        """
        Generate a structured response using chat completion
        
        Args:
            system_prompt: System instructions
            user_prompt: User request
            expected_format: Expected response format (JSON, plain text, etc.)
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature
            model: Specific model to use
            json_schema: JSON schema for structured output
            
        Returns:
            Generated response (parsed if JSON expected) or None if failed
        """
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
        
        response = self.generate_chat_completion(
            messages=messages,
            max_tokens=max_tokens,
            temperature=temperature,
            model=model,
            json_schema=json_schema
        )
        
        if response and expected_format in ["JSON", "JSON array of strings"]:
            try:
                # Try to parse JSON response
                # First, try to extract JSON from the response if it contains extra text
                
                # Check for JSON object
                json_obj_start = response.find('{')
                json_obj_end = response.rfind('}') + 1
                
                # Check for JSON array
                json_arr_start = response.find('[')
                json_arr_end = response.rfind(']') + 1
                
                # Determine which comes first and is valid
                json_str = None
                if json_obj_start != -1 and (json_arr_start == -1 or json_obj_start < json_arr_start):
                    # JSON object comes first or is the only JSON
                    if json_obj_end > json_obj_start:
                        json_str = response[json_obj_start:json_obj_end]
                elif json_arr_start != -1:
                    # JSON array comes first or is the only JSON
                    if json_arr_end > json_arr_start:
                        json_str = response[json_arr_start:json_arr_end]
                
                if json_str:
                    parsed = json.loads(json_str)
                    logger.info(f"Successfully parsed JSON response of type: {type(parsed).__name__}")
                    return parsed
                else:
                    logger.error("No JSON object or array found in response")
                    return None
                    
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse JSON response: {e}")
                logger.debug(f"Raw response: {response[:500]}...")
                return None
            except Exception as e:
                logger.error(f"Unexpected error parsing response: {e}")
                return None
        
        # Return raw response for non-JSON formats
        return response
    
    def analyze_job_description(
        self,
        job_description: str,
        current_skills: list,
        experience_level: str = "senior"
    ) -> Optional[Dict[str, Any]]:
        """
        Analyze job description and provide strategic insights
        
        Args:
            job_description: Full job description text
            current_skills: List of candidate's current skills
            experience_level: Candidate's experience level
            
        Returns:
            Analysis results with keywords, insights, and recommendations
        """
        # For strategic analysis, always use the best model with reasoning
        analysis_prompt = f"""As an expert career advisor and resume strategist, analyze this job description and provide strategic insights.

Job Description:
{job_description}

Candidate's Current Skills:
{', '.join(current_skills)}

Experience Level: {experience_level}

Provide a comprehensive analysis including:
1. Key technical requirements and how they match candidate skills
2. Soft skills and cultural fit indicators
3. Strategic keywords for ATS optimization
4. Recommendations for resume customization
5. Potential interview focus areas
6. Growth opportunities in this role

Format your response as clear, actionable insights."""

        system_prompt = """You are CareerForgeAI, an expert career strategist specializing in resume optimization and job search strategy. 
You provide deep, strategic insights that help candidates stand out while maintaining authenticity.
Your analysis is thorough, practical, and focused on maximizing success rates."""

        response = self.generate_structured_response(
            system_prompt=system_prompt,
            user_prompt=analysis_prompt,
            max_tokens=3000,  # Allow comprehensive analysis
            temperature=0.7   # Balanced creativity and accuracy
        )
        
        if response:
            # Parse the response into structured format
            try:
                # The response is already well-structured text
                return {
                    "analysis": response,
                    "success": True
                }
            except Exception as e:
                logger.error(f"Error parsing analysis response: {e}")
                return {
                    "analysis": response,
                    "success": True,
                    "raw_response": True
                }
        
        return None