"""
LM Studio Client for local AI processing
Handles communication with LM Studio API
"""

import requests
import json
import logging
from typing import Optional, Dict, Any
import time

logger = logging.getLogger(__name__)

class LMStudioClient:
    """Client for communicating with LM Studio local AI models"""
    
    def __init__(self, base_url: str = "http://localhost:1234"):
        self.base_url = base_url
        self.headers = {
            'Content-Type': 'application/json'
        }
        self.timeout = 300  # 5 minutes timeout for high-quality analysis
        self.model_name = "deepseek/deepseek-r1-0528-qwen3-8b"  # DeepSeek R1 reasoning model for highest quality strategic analysis
        
        logger.info(f"LM Studio client initialized with DeepSeek model: {self.model_name}")
        
    def test_connection(self) -> bool:
        """Test if LM Studio server is available"""
        try:
            response = requests.get(
                f"{self.base_url}/health", 
                timeout=5
            )
            return response.status_code == 200
        except requests.exceptions.RequestException:
            # Try alternative health check
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
        model: Optional[str] = None
    ) -> Optional[str]:
        """
        Generate text completion using LM Studio
        
        Args:
            prompt: Input prompt for the model
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature (0.0 to 1.0)
            model: Specific model to use (optional)
            
        Returns:
            Generated text or None if failed
        """
        try:
            payload = {
                "prompt": prompt,
                "max_tokens": max_tokens,
                "temperature": temperature,
                "stream": False,
                "stop": ["Human:", "Assistant:", "\n\n---"]
            }
            
            # Always use DeepSeek model unless explicitly overridden
            payload["model"] = model or self.model_name
            
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
        model: Optional[str] = None
    ) -> Optional[str]:
        """
        Generate chat completion using LM Studio chat endpoint
        
        Args:
            messages: List of message dicts with 'role' and 'content'
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature
            model: Specific model to use
            
        Returns:
            Generated response or None if failed
        """
        try:
            payload = {
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": temperature,
                "stream": False
            }
            
            # Always use DeepSeek model unless explicitly overridden
            payload["model"] = model or self.model_name
            
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
        temperature: float = 0.3
    ) -> Optional[Dict[str, Any]]:
        """
        Generate structured response (JSON) from LM Studio
        
        Args:
            system_prompt: System/instruction prompt
            user_prompt: User input prompt
            expected_format: Expected response format description
            max_tokens: Maximum tokens to generate
            temperature: Lower temperature for more consistent JSON
            
        Returns:
            Parsed JSON response or None if failed
        """
        try:
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ]
            
            response = self.generate_chat_completion(
                messages=messages,
                max_tokens=max_tokens,
                temperature=temperature
            )
            
            if not response:
                return None
            
            # Clean up response and try to extract JSON
            cleaned_response = response.strip()
            
            # Remove markdown code block formatting if present
            if cleaned_response.startswith("```json"):
                cleaned_response = cleaned_response[7:]
            if cleaned_response.startswith("```"):
                cleaned_response = cleaned_response[3:]
            if cleaned_response.endswith("```"):
                cleaned_response = cleaned_response[:-3]
            
            cleaned_response = cleaned_response.strip()
            
            # Try to parse as JSON
            try:
                return json.loads(cleaned_response)
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse JSON response: {e}")
                logger.error(f"Raw response: {cleaned_response[:500]}...")
                return None
                
        except Exception as e:
            logger.error(f"Error generating structured response: {e}")
            return None