"""
Prompt Manager
Manages and loads prompts from external files for easy testing and tweaking
"""

import os
import logging
from typing import Dict, Optional
from pathlib import Path

logger = logging.getLogger(__name__)

class PromptManager:
    """Manages prompts loaded from external files"""
    
    def __init__(self, prompts_dir: Optional[str] = None):
        if prompts_dir is None:
            # Default to prompts directory relative to this file
            current_dir = Path(__file__).parent.parent.parent
            prompts_dir = current_dir / "prompts"
        
        self.prompts_dir = Path(prompts_dir)
        self._prompt_cache = {}
        
        logger.info(f"PromptManager initialized with directory: {self.prompts_dir}")
    
    def load_prompt(self, prompt_name: str, use_cache: bool = True) -> str:
        """
        Load a prompt from file
        
        Args:
            prompt_name: Name of the prompt file (without .txt extension)
            use_cache: Whether to use cached version if available
            
        Returns:
            Prompt content as string
        """
        if use_cache and prompt_name in self._prompt_cache:
            return self._prompt_cache[prompt_name]
        
        prompt_file = self.prompts_dir / f"{prompt_name}.txt"
        
        try:
            with open(prompt_file, 'r', encoding='utf-8') as f:
                content = f.read().strip()
            
            if use_cache:
                self._prompt_cache[prompt_name] = content
            
            logger.debug(f"Loaded prompt: {prompt_name} ({len(content)} chars)")
            return content
            
        except FileNotFoundError:
            logger.error(f"Prompt file not found: {prompt_file}")
            raise FileNotFoundError(f"Prompt file '{prompt_name}.txt' not found in {self.prompts_dir}")
        
        except Exception as e:
            logger.error(f"Error loading prompt {prompt_name}: {e}")
            raise
    
    def get_job_analysis_system_prompt(self) -> str:
        """Get the job analysis system prompt"""
        return self.load_prompt("job_analysis_system_prompt")
    
    def get_job_analysis_user_prompt(self, job_description: str) -> str:
        """Get the job analysis user prompt with job description"""
        template = self.load_prompt("job_analysis_user_prompt")
        return template.format(job_description=job_description)
    
    def get_section_generation_system_prompt(self, section_type: str) -> str:
        """
        Get system prompt for section generation
        
        Args:
            section_type: Type of section (summary, skills, experience)
            
        Returns:
            Complete system prompt for the section type
        """
        # Load base prompt
        base_prompt = self.load_prompt("section_generation_base_prompt")
        
        # Load section-specific prompt
        try:
            section_prompt = self.load_prompt(f"{section_type}_generation_prompt")
            return f"{base_prompt}\n\n{section_prompt}"
        except FileNotFoundError:
            logger.warning(f"Section-specific prompt not found for {section_type}, using base prompt")
            return base_prompt
    
    def get_section_generation_user_prompt(
        self,
        section_type: str,
        company: str,
        role: str,
        keywords_str: str,
        base_content: str,
        tone: str = "professional",
        length: str = "medium"
    ) -> str:
        """
        Get user prompt for section generation with variables filled in
        
        Args:
            section_type: Type of section being generated
            company: Target company name
            role: Target role
            keywords_str: Comma-separated keywords string
            base_content: Current section content
            tone: Writing tone preference
            length: Length preference
            
        Returns:
            Formatted user prompt
        """
        template = self.load_prompt("user_prompt_template")
        
        return template.format(
            section_type=section_type,
            company=company,
            role=role,
            keywords_str=keywords_str,
            base_content=base_content,
            tone=tone,
            length=length
        )
    
    def reload_prompts(self) -> None:
        """Clear cache and reload all prompts"""
        self._prompt_cache.clear()
        logger.info("Prompt cache cleared - prompts will be reloaded on next access")
    
    def list_available_prompts(self) -> list:
        """List all available prompt files"""
        try:
            prompt_files = list(self.prompts_dir.glob("*.txt"))
            return [f.stem for f in prompt_files]
        except Exception as e:
            logger.error(f"Error listing prompt files: {e}")
            return []
    
    def validate_prompts(self) -> Dict[str, bool]:
        """
        Validate that all expected prompt files exist
        
        Returns:
            Dictionary with prompt names and their existence status
        """
        expected_prompts = [
            "job_analysis_system_prompt",
            "job_analysis_user_prompt", 
            "section_generation_base_prompt",
            "summary_generation_prompt",
            "skills_generation_prompt",
            "experience_generation_prompt",
            "user_prompt_template"
        ]
        
        validation_results = {}
        
        for prompt_name in expected_prompts:
            prompt_file = self.prompts_dir / f"{prompt_name}.txt"
            validation_results[prompt_name] = prompt_file.exists()
        
        return validation_results
    
    def get_prompt_info(self, prompt_name: str) -> Dict[str, any]:
        """
        Get information about a specific prompt file
        
        Args:
            prompt_name: Name of the prompt
            
        Returns:
            Dictionary with prompt metadata
        """
        prompt_file = self.prompts_dir / f"{prompt_name}.txt"
        
        if not prompt_file.exists():
            return {"exists": False}
        
        try:
            stat = prompt_file.stat()
            content = self.load_prompt(prompt_name, use_cache=False)
            
            return {
                "exists": True,
                "file_path": str(prompt_file),
                "size_bytes": stat.st_size,
                "character_count": len(content),
                "line_count": len(content.splitlines()),
                "modified_time": stat.st_mtime
            }
            
        except Exception as e:
            return {
                "exists": True,
                "error": str(e)
            }