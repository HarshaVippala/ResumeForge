"""
Enhanced Section Generator Service
Generates human-natural resume sections with space optimization and anti-AI detection
"""

import logging
import json
from typing import Dict, List, Any, Optional
from ..lm_studio_client import LMStudioClient
from .resume_parser import ResumeParser
from .strategic_context import StrategicContext
from .experience_prioritizer import ExperiencePrioritizer, PrioritizedExperience
from .prompt_manager import PromptManager
from .enhancers.human_natural_enhancer import HumanNaturalEnhancer
from .enhancers.space_optimizer import SpaceOptimizer
from .enhancers.skills_merger import SkillsMerger
from .prompts.human_voice_prompts import HumanVoicePrompts

logger = logging.getLogger(__name__)

class SectionGenerator:
    """Generate human-natural resume sections with space optimization"""
    
    def __init__(self, lm_studio_client: LMStudioClient):
        self.lm_studio = lm_studio_client
        self.resume_parser = ResumeParser()
        self.experience_prioritizer = ExperiencePrioritizer()
        self.prompt_manager = PromptManager()
        
        # Initialize enhancement modules
        self.human_enhancer = HumanNaturalEnhancer()
        self.space_optimizer = SpaceOptimizer()
        self.skills_merger = SkillsMerger()
        self.prompts = HumanVoicePrompts()
        
        # Get base resume content
        self.base_content = self.resume_parser.get_base_resume_content()
        
        # Fallback templates for each section type
        self.fallback_templates = {
            "summary": self._generate_summary_fallback,
            "skills": self._generate_skills_fallback,
            "experience": self._generate_experience_fallback
        }
    
    def generate_strategic_sections(
        self,
        strategic_context: StrategicContext,
        preferences: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Generate all resume sections using strategic context and experience prioritization
        
        Args:
            strategic_context: Rich context from job analysis
            preferences: User preferences for generation
            
        Returns:
            Dictionary with all generated sections and metadata
        """
        logger.info(f"Generating strategic sections for {strategic_context.job_info.job_title}")
        
        results = {
            "sections": {},
            "prioritized_experiences": [],
            "strategic_guidance_applied": {},
            "generation_metadata": {
                "used_ai": self.lm_studio.test_connection(),
                "experience_count": 0,
                "keywords_targeted": len(strategic_context.get_all_critical_keywords()),
                "human_enhancements_applied": []
            }
        }
        
        # Step 1: Prioritize experiences based on strategic context
        base_experiences = self.resume_parser.base_experiences
        prioritized_experiences = self.experience_prioritizer.prioritize_experiences(
            base_experiences, strategic_context
        )
        prioritized_experiences = self.experience_prioritizer.apply_bullet_limits(prioritized_experiences)
        
        results["prioritized_experiences"] = prioritized_experiences
        results["generation_metadata"]["experience_count"] = len(prioritized_experiences)
        
        # Step 2: Generate summary with strategic guidance
        summary_result = self._generate_strategic_summary(strategic_context, preferences)
        results["sections"]["summary"] = summary_result["content"]
        results["strategic_guidance_applied"]["summary"] = summary_result["guidance_applied"]
        results["generation_metadata"]["human_enhancements_applied"].extend(
            summary_result.get("enhancements", [])
        )
        
        # Step 3: Generate skills with intelligent merging
        skills_result = self._generate_strategic_skills(strategic_context, preferences)
        results["sections"]["skills"] = skills_result["content"]
        results["strategic_guidance_applied"]["skills"] = skills_result["guidance_applied"]
        
        # Step 4: Generate experience section from prioritized experiences
        experience_result = self._generate_strategic_experience(
            prioritized_experiences, strategic_context, preferences
        )
        results["sections"]["experience"] = experience_result["content"]
        results["strategic_guidance_applied"]["experience"] = experience_result["guidance_applied"]
        results["generation_metadata"]["human_enhancements_applied"].extend(
            experience_result.get("enhancements", [])
        )
        
        logger.info(f"Generated strategic sections: summary ({len(results['sections']['summary'])} chars), "
                   f"skills ({len(results['sections']['skills'])} chars), "
                   f"experience ({len(results['sections']['experience'])} bullets)")
        
        return results
    
    def _generate_strategic_summary(
        self, 
        strategic_context: StrategicContext, 
        preferences: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Generate summary using strategic guidance"""
        
        # Get priority skills for summary emphasis
        priority_skills = strategic_context.get_priority_skills_for_section("summary")
        
        # Get human voice context for natural generation
        human_context = strategic_context.get_human_voice_context()
        
        # Use current summary as base but enhance with strategic guidance
        base_summary = self.base_content.get("summary", "")
        
        # Create enhanced prompt focusing on authenticity
        if self.lm_studio.test_connection():
            enhanced_summary = self._generate_strategic_summary_with_ai(
                base_summary, strategic_context, priority_skills, human_context
            )
        else:
            enhanced_summary = self._generate_strategic_summary_fallback(
                base_summary, strategic_context, priority_skills
            )
        
        # Apply human-natural enhancement
        enhancement_result = self.human_enhancer.enhance_content_naturalness(
            enhanced_summary, 'summary'
        )
        final_summary = enhancement_result['enhanced']
        
        # Apply space optimization
        optimization_result = self.space_optimizer.optimize_content_length(
            final_summary, 'summary'
        )
        optimized_summary = optimization_result['optimized']
        
        return {
            "content": optimized_summary,
            "guidance_applied": {
                "priority_skills_emphasized": priority_skills[:3],
                "seniority_aligned": strategic_context.strategic_positioning.target_seniority,
                "role_specialized": strategic_context.strategic_positioning.role_specialization
            },
            "enhancements": enhancement_result.get('improvements_made', [])
        }
    
    def _generate_strategic_skills(
        self, 
        strategic_context: StrategicContext, 
        preferences: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Generate skills using intelligent merging"""
        
        # Get job keywords for skills integration
        job_keywords = strategic_context.get_all_critical_keywords()
        
        # Use skills merger for intelligent integration
        base_skills = self.resume_parser.base_profile
        enhanced_sections = self.skills_merger.merge_skills_with_job_keywords(
            base_skills=base_skills,
            job_keywords=job_keywords
        )
        
        # Format for response
        formatted_skills = self._format_skills_sections_for_response(enhanced_sections)
        
        # Apply human enhancement
        enhancement_result = self.human_enhancer.enhance_content_naturalness(
            formatted_skills, 'skills'
        )
        final_skills = enhancement_result['enhanced']
        
        return {
            "content": final_skills,
            "guidance_applied": {
                "job_keywords_integrated": len(job_keywords),
                "skills_sections_created": list(enhanced_sections.keys()),
                "emphasis_strategy": "priority_first"
            }
        }
    
    def _generate_strategic_experience(
        self, 
        prioritized_experiences: List[PrioritizedExperience],
        strategic_context: StrategicContext,
        preferences: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Generate experience section from prioritized experiences"""
        
        experience_bullets = []
        enhancements_applied = []
        
        for exp in prioritized_experiences:
            # Use the selected bullets from prioritization
            for bullet in exp.selected_bullets:
                # Enhance bullet with job-relevant keywords naturally
                enhanced_bullet = self._enhance_experience_bullet_naturally(
                    bullet, strategic_context, exp.get('technologies_used_in_role', [])
                )
                
                # Apply human-natural enhancement
                enhancement_result = self.human_enhancer.enhance_content_naturalness(
                    enhanced_bullet, 'experience_bullet'
                )
                final_bullet = enhancement_result['enhanced']
                
                # Apply space optimization
                optimization_result = self.space_optimizer.optimize_content_length(
                    final_bullet, 'experience_bullet'
                )
                optimized_bullet = optimization_result['optimized']
                
                experience_bullets.append(optimized_bullet)
                enhancements_applied.extend(enhancement_result.get('improvements_made', []))
        
        return {
            "content": experience_bullets,
            "guidance_applied": {
                "experiences_prioritized": len(prioritized_experiences),
                "total_bullets_selected": len(experience_bullets),
                "prioritization_scores": [exp.relevance_score for exp in prioritized_experiences],
                "lead_experience": prioritized_experiences[0].get('company_name', '') if prioritized_experiences else ""
            },
            "enhancements": enhancements_applied
        }
    
    def _generate_strategic_summary_with_ai(
        self,
        base_summary: str,
        strategic_context: StrategicContext,
        priority_skills: List[str],
        human_context: Dict[str, Any]
    ) -> str:
        """Generate enhanced summary using AI with strategic guidance"""
        
        # Create human-voice prompt for natural summary
        prompt = self.prompts.get_conversational_summary_prompt(
            keywords=priority_skills,
            base_content={"summary": base_summary},
            job_context={
                "company": strategic_context.job_info.company,
                "role": strategic_context.job_info.job_title
            }
        )
        
        system_prompt = self.prompts.get_human_voice_system_prompt()
        
        try:
            result = self.lm_studio.generate_structured_response(
                system_prompt=system_prompt,
                user_prompt=prompt,
                expected_format="JSON with variations",
                max_tokens=500,
                temperature=0.7
            )
            
            if result and isinstance(result, dict) and "variations" in result:
                # Pick the best variation (first one typically)
                variations = result["variations"]
                if variations and len(variations) > 0:
                    best_variation = variations[0]
                    if isinstance(best_variation, dict) and "text" in best_variation:
                        return best_variation["text"]
            
            # Fallback if AI generation doesn't work as expected
            return self._generate_strategic_summary_fallback(base_summary, strategic_context, priority_skills)
            
        except Exception as e:
            logger.error(f"AI summary generation failed: {e}")
            return self._generate_strategic_summary_fallback(base_summary, strategic_context, priority_skills)
    
    def _generate_strategic_summary_fallback(
        self,
        base_summary: str,
        strategic_context: StrategicContext,
        priority_skills: List[str]
    ) -> str:
        """Fallback summary generation with strategic enhancement"""
        
        # Start with base summary or create from strategic context
        if base_summary:
            enhanced_summary = base_summary
        else:
            enhanced_summary = f"Software Engineer with {strategic_context.strategic_positioning.experience_level or '5+ years'} of experience"
        
        # Add role specialization naturally
        role_spec = strategic_context.strategic_positioning.role_specialization
        if role_spec and role_spec.lower() not in enhanced_summary.lower():
            enhanced_summary += f" specializing in {role_spec.lower()}"
        
        # Add priority skills naturally
        if priority_skills:
            skills_text = ", ".join(priority_skills[:3])
            enhanced_summary += f". Expert in {skills_text}"
        
        # Add industry focus if specified
        if strategic_context.strategic_positioning.industry_focus:
            enhanced_summary += f" with focus on {strategic_context.strategic_positioning.industry_focus.lower()}"
        
        enhanced_summary += ". Passionate about building scalable, high-quality software solutions."
        
        return enhanced_summary
    
    def _enhance_experience_bullet_naturally(
        self,
        bullet: str,
        strategic_context: StrategicContext,
        experience_tech: List[str]
    ) -> str:
        """Enhance experience bullet with strategic keywords naturally"""
        
        # Get critical keywords that should be emphasized
        critical_skills = [item.skill for item in strategic_context.requirement_criticality.deal_breakers]
        
        enhanced_bullet = bullet
        
        # Look for opportunities to naturally integrate missing critical skills
        for skill in critical_skills:
            skill_lower = skill.lower()
            
            # Skip if already mentioned
            if skill_lower in enhanced_bullet.lower():
                continue
            
            # Check if this skill is related to the experience technology stack
            if any(tech.lower() in skill_lower or skill_lower in tech.lower() for tech in experience_tech):
                # Find natural integration points
                if 'api' in enhanced_bullet.lower() and 'api' in skill_lower:
                    enhanced_bullet = enhanced_bullet.replace('API', f'{skill} API')
                elif 'using' in enhanced_bullet.lower() and skill_lower in ['node.js', 'python', 'typescript']:
                    enhanced_bullet = enhanced_bullet.replace('using', f'using {skill},')
                elif 'with' in enhanced_bullet.lower() and skill_lower in ['aws', 'mongodb', 'redis']:
                    enhanced_bullet = enhanced_bullet.replace('with', f'with {skill} and')
        
        return enhanced_bullet
    
    def generate_human_natural_section(
        self,
        section_type: str,
        selected_keywords: List[str],
        base_content: str,
        job_context: Dict[str, Any],
        preferences: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Generate human-natural content with space optimization and validation
        
        Args:
            section_type: Type of section ('summary', 'skills', 'experience')
            selected_keywords: List of keywords to incorporate
            base_content: Current/original content for this section
            job_context: Context from job analysis
            preferences: User preferences for generation
            
        Returns:
            Dictionary with generated content, validation, and optimization results
        """
        try:
            if not selected_keywords:
                raise ValueError("No keywords selected for generation")
            
            logger.info(f"Generating human-natural {section_type} section")
            
            # Get base content if not provided
            if not base_content:
                base_content = self._get_base_content_for_section(section_type)
            
            # Generate content using human-natural approach
            generation_result = self._generate_with_human_natural_ai(
                section_type, selected_keywords, base_content, job_context, preferences
            )
            
            if not generation_result['success']:
                # Fallback to enhanced template generation
                logger.info(f"Using enhanced fallback for {section_type}")
                generation_result = self._generate_with_enhanced_fallback(
                    section_type, selected_keywords, base_content, job_context, preferences
                )
            
            return generation_result
            
        except Exception as e:
            logger.error(f"Error generating human-natural {section_type}: {e}")
            return self._generate_with_enhanced_fallback(
                section_type, selected_keywords, base_content, job_context, preferences
            )
    
    def generate_section(
        self,
        section_type: str,
        selected_keywords: List[str],
        base_content: str,
        job_context: Dict[str, Any],
        preferences: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Generate content for a specific resume section
        
        Args:
            section_type: Type of section ('summary', 'skills', 'experience')
            selected_keywords: List of keywords to incorporate
            base_content: Current/original content for this section
            job_context: Context from job analysis
            preferences: User preferences for generation
            
        Returns:
            Generated section content
        """
        try:
            if not selected_keywords:
                raise ValueError("No keywords selected for generation")
            
            # If no base_content provided, get from base resume
            if not base_content:
                if section_type == "summary":
                    base_content = self.base_content.get("summary", "")
                elif section_type == "skills":
                    base_content = self.base_content.get("skills", "")
                elif section_type == "experience":
                    base_content = "\n".join(self.base_content.get("experience", []))
            
            # Try AI generation first
            if self.lm_studio.test_connection():
                logger.info(f"Generating {section_type} section with AI")
                result = self._generate_with_ai(
                    section_type, selected_keywords, base_content, job_context, preferences
                )
                if result:
                    return result
            
            # Fallback to template-based generation
            logger.info(f"Using fallback generation for {section_type}")
            return self._generate_with_fallback(
                section_type, selected_keywords, base_content, job_context, preferences
            )
            
        except Exception as e:
            logger.error(f"Error generating {section_type} section: {e}")
            return self._generate_with_fallback(
                section_type, selected_keywords, base_content, job_context, preferences
            )
    
    def _generate_with_human_natural_ai(
        self,
        section_type: str,
        selected_keywords: List[str],
        base_content: str,
        job_context: Dict[str, Any],
        preferences: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Generate content using human-natural AI approach"""
        
        try:
            # Get appropriate prompt for section type
            if section_type == 'summary':
                prompt = self.prompts.get_conversational_summary_prompt(
                    selected_keywords, self.base_content, job_context
                )
                system_prompt = self.prompts.get_human_voice_system_prompt()
            elif section_type == 'experience':
                # For experience, generate bullets individually
                return self._generate_human_natural_experience(
                    selected_keywords, base_content, job_context, preferences
                )
            elif section_type == 'skills':
                # Use intelligent skills merger for skills sections
                return self._generate_enhanced_skills_sections(
                    selected_keywords, base_content, job_context, preferences
                )
            else:
                return {'success': False, 'error': f'Unknown section type: {section_type}'}
            
            # Generate with AI
            result = self.lm_studio.generate_structured_response(
                system_prompt=system_prompt,
                user_prompt=prompt,
                expected_format="JSON with variations",
                max_tokens=800,
                temperature=0.7
            )
            
            if result and isinstance(result, dict):
                # Process variations and apply enhancements
                return self._process_ai_variations(result, section_type, selected_keywords)
            
            return {'success': False, 'error': 'AI generation failed'}
            
        except Exception as e:
            logger.error(f"Human-natural AI generation failed: {e}")
            return {'success': False, 'error': str(e)}
    
    def _generate_human_natural_experience(
        self,
        selected_keywords: List[str],
        base_content: str,
        job_context: Dict[str, Any],
        preferences: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Generate experience bullets with human-natural approach using authentic experience data"""
        
        # Get authentic experience data from structured JSON
        base_experiences = self.resume_parser.base_experiences
        
        if not base_experiences:
            logger.warning("No base experiences found, using fallback")
            return self._generate_with_enhanced_fallback(
                'experience', selected_keywords, base_content, job_context, preferences
            )
        
        generated_bullets = []
        all_variations = []
        existing_patterns = []
        
        # Target count based on position (5-5-3 distribution from your format)
        target_count = 5  # Most recent position
        
        # Get the most recent experience (7-Eleven)
        current_experience = base_experiences[0]
        authentic_bullets = current_experience.get('experience_highlights', [])
        experience_tech = current_experience.get('technologies_used_in_role', [])
        
        logger.info(f"Using authentic experience from {current_experience.get('company_name')} with {len(authentic_bullets)} bullets")
        
        for bullet_index in range(target_count):
            try:
                # Use authentic bullet if available, otherwise generate new
                if bullet_index < len(authentic_bullets):
                    # Enhance authentic bullet with job keywords
                    authentic_bullet = authentic_bullets[bullet_index]
                    enhanced_bullet = self._enhance_authentic_bullet_with_keywords(
                        authentic_bullet, selected_keywords, experience_tech
                    )
                else:
                    # Generate new bullet based on authentic context
                    enhanced_bullet = self._generate_new_bullet_from_authentic_context(
                        current_experience, selected_keywords, bullet_index, existing_patterns
                    )
                
                # Apply human-natural enhancement
                enhancement_result = self.human_enhancer.enhance_content_naturalness(
                    enhanced_bullet, 'experience_bullet'
                )
                final_bullet = enhancement_result['enhanced']
                
                # Apply space optimization
                optimization_result = self.space_optimizer.optimize_content_length(
                    final_bullet, 'experience_bullet'
                )
                optimized_bullet = optimization_result['optimized']
                
                # Validation
                validation = self.human_enhancer.validate_human_naturalness(optimized_bullet, 'experience_bullet')
                constraints = self.space_optimizer.check_format_constraints(optimized_bullet, 'experience_bullet')
                
                generated_bullets.append(optimized_bullet)
                all_variations.append({
                    'text': optimized_bullet,
                    'source': 'authentic' if bullet_index < len(authentic_bullets) else 'generated',
                    'validation_score': validation['overall_score'],
                    'human_score': validation['human_score'],
                    'meets_constraints': constraints['overall_valid'],
                    'char_count': len(optimized_bullet),
                    'keywords_included': self._count_keywords_in_text(optimized_bullet, selected_keywords),
                    'enhancement_applied': enhancement_result['improvements_made'],
                    'optimization_applied': optimization_result['optimization_applied']
                })
                
                existing_patterns.extend(self._extract_patterns_from_bullet(optimized_bullet))
                
            except Exception as e:
                logger.error(f"Error processing bullet {bullet_index}: {e}")
                # Use fallback bullet
                fallback_bullet = self._generate_fallback_bullet_enhanced(
                    current_experience, selected_keywords, bullet_index
                )
                generated_bullets.append(fallback_bullet)
        
        return {
            'success': True,
            'best_content': generated_bullets,
            'all_variations': all_variations,
            'generation_method': 'authentic_experience_enhanced',
            'experience_source': current_experience.get('company_name'),
            'authentic_bullets_used': min(len(authentic_bullets), target_count),
            'keywords_integration_applied': True
        }
    
    def _process_ai_variations(self, ai_result: Dict[str, Any], section_type: str, keywords: List[str]) -> Dict[str, Any]:
        """Process AI-generated variations with enhancement and optimization"""
        
        processed_variations = []
        
        # Extract variations from AI result
        variations = ai_result.get('variations', [ai_result])
        
        for i, variation in enumerate(variations):
            if isinstance(variation, dict):
                content = variation.get('text', variation.get('optimized_skills', ''))
            else:
                content = str(variation)
            
            if not content:
                continue
            
            # Apply human-natural enhancement
            enhancement_result = self.human_enhancer.enhance_content_naturalness(content, section_type)
            enhanced_content = enhancement_result['enhanced']
            
            # Apply space optimization
            optimization_result = self.space_optimizer.optimize_content_length(enhanced_content, section_type)
            optimized_content = optimization_result['optimized']
            
            # Final validation
            validation = self.human_enhancer.validate_human_naturalness(optimized_content, section_type)
            constraints = self.space_optimizer.check_format_constraints(optimized_content, section_type)
            
            processed_variations.append({
                'text': optimized_content,
                'char_count': len(optimized_content),
                'line_count': self.space_optimizer.calculate_line_count(optimized_content, section_type),
                'validation_score': validation['overall_score'],
                'human_score': validation['human_score'],
                'meets_constraints': constraints['overall_valid'],
                'keywords_included': self._count_keywords_in_text(optimized_content, keywords),
                'enhancement_applied': enhancement_result['improvements_made'],
                'optimization_applied': optimization_result['optimization_applied']
            })
        
        # Sort by overall quality
        processed_variations.sort(key=lambda x: (
            x['meets_constraints'],
            x['validation_score'],
            x['human_score'],
            x['keywords_included']
        ), reverse=True)
        
        # Check if we actually have valid content
        if not processed_variations:
            return {'success': False, 'error': 'No valid variations generated'}
        
        return {
            'success': True,
            'best_content': processed_variations[0]['text'],
            'all_variations': processed_variations,
            'generation_method': 'human_natural_ai',
            'validation_score': processed_variations[0]['validation_score'],
            'human_score': processed_variations[0]['human_score'],
            'meets_constraints': processed_variations[0]['meets_constraints']
        }
    
    def _process_bullet_variations(self, ai_result: Dict[str, Any], keywords: List[str], existing_patterns: List[str]) -> Dict[str, Any]:
        """Process bullet variations with specific bullet constraints"""
        
        processed_bullets = []
        variations = ai_result.get('variations', [ai_result])
        
        for variation in variations:
            if isinstance(variation, dict):
                bullet_text = variation.get('text', '')
            else:
                bullet_text = str(variation)
            
            if not bullet_text:
                continue
            
            # Clean bullet format
            bullet_text = self._clean_bullet_format(bullet_text)
            
            # Apply human enhancement
            enhancement_result = self.human_enhancer.enhance_content_naturalness(bullet_text, 'experience_bullet')
            enhanced_bullet = enhancement_result['enhanced']
            
            # Apply space optimization
            optimization_result = self.space_optimizer.optimize_content_length(enhanced_bullet, 'experience_bullet')
            optimized_bullet = optimization_result['optimized']
            
            # Validate
            validation = self.human_enhancer.validate_human_naturalness(optimized_bullet, 'experience_bullet')
            constraints = self.space_optimizer.check_format_constraints(optimized_bullet, 'experience_bullet')
            
            # Check pattern repetition
            avoids_repetition = not self._matches_existing_pattern(optimized_bullet, existing_patterns)
            
            processed_bullets.append({
                'text': optimized_bullet,
                'char_count': len(optimized_bullet),
                'line_count': self.space_optimizer.calculate_line_count(optimized_bullet, 'experience_bullet'),
                'line_efficiency': self.space_optimizer.calculate_line_efficiency(optimized_bullet) if self.space_optimizer.calculate_line_count(optimized_bullet, 'experience_bullet') == 2 else 1.0,
                'validation_score': validation['overall_score'],
                'human_score': validation['human_score'],
                'meets_constraints': constraints['overall_valid'],
                'avoids_repetition': avoids_repetition,
                'keywords_included': self._count_keywords_in_text(optimized_bullet, keywords)
            })
        
        # Sort by quality
        processed_bullets.sort(key=lambda x: (
            x['meets_constraints'],
            x['avoids_repetition'],
            x['validation_score'],
            x['line_efficiency']
        ), reverse=True)
        
        return {
            'success': True,
            'best_bullet': processed_bullets[0] if processed_bullets else None,
            'all_variations': processed_bullets
        }
    
    def _generate_with_enhanced_fallback(
        self,
        section_type: str,
        selected_keywords: List[str],
        base_content: str,
        job_context: Dict[str, Any],
        preferences: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Enhanced fallback generation with human-natural characteristics"""
        
        # Use existing fallback but apply enhancements
        fallback_content = self._generate_with_fallback(
            section_type, selected_keywords, base_content, job_context, preferences
        )
        
        # Apply human enhancement
        enhancement_result = self.human_enhancer.enhance_content_naturalness(
            fallback_content, section_type
        )
        enhanced_content = enhancement_result['enhanced']
        
        # Apply space optimization
        optimization_result = self.space_optimizer.optimize_content_length(
            enhanced_content, section_type
        )
        optimized_content = optimization_result['optimized']
        
        # Final validation
        validation = self.human_enhancer.validate_human_naturalness(optimized_content, section_type)
        constraints = self.space_optimizer.check_format_constraints(optimized_content, section_type)
        
        return {
            'success': True,
            'best_content': optimized_content,
            'validation_score': validation['overall_score'],
            'human_score': validation['human_score'],
            'meets_constraints': constraints['overall_valid'],
            'generation_method': 'enhanced_fallback',
            'enhancement_applied': enhancement_result['improvements_made'],
            'optimization_applied': optimization_result['optimization_applied']
        }
    
    def _generate_with_ai(
        self,
        section_type: str,
        selected_keywords: List[str],
        base_content: str,
        job_context: Dict[str, Any],
        preferences: Optional[Dict[str, Any]]
    ) -> Optional[str]:
        """Generate section content using AI"""
        
        # Get section-specific prompt
        system_prompt = self._get_system_prompt(section_type)
        user_prompt = self._get_user_prompt(
            section_type, selected_keywords, base_content, job_context, preferences
        )
        
        try:
            # For sections that need structured output
            if section_type == "experience":
                result = self.lm_studio.generate_structured_response(
                    system_prompt=system_prompt,
                    user_prompt=user_prompt,
                    expected_format="JSON array of strings",
                    max_tokens=1000,
                    temperature=0.7
                )
                
                if result and isinstance(result, list):
                    return result
                elif result and 'bullets' in result:
                    return result['bullets']
            else:
                # For summary and skills, get plain text
                messages = [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ]
                
                result = self.lm_studio.generate_chat_completion(
                    messages=messages,
                    max_tokens=800,
                    temperature=0.7
                )
                
                if result:
                    return result.strip()
            
            return None
            
        except Exception as e:
            logger.error(f"AI generation failed for {section_type}: {e}")
            return None
    
    def _generate_with_fallback(
        self,
        section_type: str,
        selected_keywords: List[str],
        base_content: str,
        job_context: Dict[str, Any],
        preferences: Optional[Dict[str, Any]]
    ) -> str:
        """Generate section content using fallback templates"""
        
        generator = self.fallback_templates.get(section_type)
        if not generator:
            raise ValueError(f"Unknown section type: {section_type}")
        
        return generator(selected_keywords, base_content, job_context, preferences)
    
    def _get_system_prompt(self, section_type: str) -> str:
        """Get system prompt for specific section type"""
        
        base_prompt = """You are CareerForgeAI, an expert resume strategist creating ATS-optimized content that enhances authentic experience without fabrication.

CORE PRINCIPLES:
- Stay authentic to candidate's real experience (max 5 years experience)
- Pass ATS filters through strategic keyword integration
- Maintain perfect consistency across all sections
- Only add skills technically plausible given background
- Focus on quantified achievements and impact"""
        
        section_prompts = {
            "summary": f"""{base_prompt}

For PROFESSIONAL SUMMARY sections:
- STRICT: Maximum 5 years experience (never 6+, 7+, 8+)
- PREFERRED: "Software Engineer with 5 years of experience"
- Write 2-3 sentences (280-300 characters total)
- Start with job title and authentic years of experience
- Highlight 2-3 core technical competencies from base resume
- End with value proposition or current specialization
- Use active voice and strong action words
- Ensure natural keyword integration

Structure: [Role] with [4-5 years] of experience specializing in [2-3 core technologies]. [Current focus]. [Value proposition].

Example: "Software Engineer with 5 years of experience specializing in Node.js, TypeScript, and AWS. Currently building scalable microservices for retail platforms. Expert in API design and cloud-native architecture."

CRITICAL: 
- Keep under 300 characters for single-page fit
- Only mention technologies from candidate's actual background
- Ensure it sounds natural, not keyword-stuffed""",

            "skills": f"""{base_prompt}

For TECHNICAL SKILLS sections:
- Organize keywords into logical categories
- Use consistent formatting
- Prioritize most relevant skills first
- Group related technologies together
- Include proficiency context where appropriate

Format options:
1. Categorized: "Languages: Python, JavaScript | Frameworks: React, Django | Cloud: AWS, Docker"
2. Simple list: "Python, JavaScript, React, Django, AWS, Docker, Git, MySQL"
3. Detailed: "Languages & Frameworks: Python, JavaScript, React, Node.js | Cloud & DevOps: AWS, Docker, Kubernetes"

Choose the format that best showcases the selected keywords.""",

            "experience": f"""{base_prompt}

For WORK EXPERIENCE bullet points:
- Use STAR method (Situation, Task, Action, Result)
- Character limits: 200-250 chars each for recent roles, 180-220 for older
- Start with varied action verbs (max 2x same starter)
- Include quantified achievements when possible
- Naturally incorporate selected keywords from job description
- Focus on impact and measurable results
- Build on candidate's actual experience, don't fabricate

Bullet Construction Formula: [Action] [technical implementation with keywords] [quantified outcome]

Integration Techniques:
1. Natural Clustering: "Built React/Redux frontend consuming GraphQL APIs"
2. Soft Skills Through Action: "Led 5-engineer team to deliver...", "Partnered with product teams..."
3. Technology Depth: "Architected" (expert), "Implemented" (proficient), "Utilized" (familiar)

Sentence Starters (vary usage):
- Technical: Architected, Engineered, Implemented, Developed
- Leadership: Led, Mentored, Coordinated, Guided  
- Impact: Optimized, Reduced, Increased, Accelerated
- Innovation: Pioneered, Introduced, Modernized

Return a JSON array of 3-5 bullet point strings.

CRITICAL: 
- Build on real experience from base resume
- Each bullet should incorporate 1-2 selected keywords naturally
- Include quantified metrics when possible
- Stay within character limits for single-page fit"""
        }
        
        return section_prompts.get(section_type, base_prompt)
    
    def _get_user_prompt(
        self,
        section_type: str,
        selected_keywords: List[str],
        base_content: str,
        job_context: Dict[str, Any],
        preferences: Optional[Dict[str, Any]]
    ) -> str:
        """Get user prompt with context for section generation"""
        
        company = job_context.get('company', 'Company')
        role = job_context.get('role', 'Software Engineer')
        keywords_str = ", ".join(selected_keywords)
        
        tone = preferences.get('tone', 'professional') if preferences else 'professional'
        length = preferences.get('length', 'medium') if preferences else 'medium'
        
        # Get candidate background from base content
        candidate_info = f"""
CANDIDATE BACKGROUND:
- Current Role: Software Engineer II at 7-Eleven
- Total Experience: 4+ years (started Jan 2021)
- Key Technologies: Node.js, TypeScript, Python, AWS, MongoDB, Redis
- Recent Projects: EBT payment integration, microservices, IoT systems
- Background: Full-stack development, serverless architecture, payment systems
"""
        
        base_prompt = f"""Generate a {section_type} section for a resume targeting this role:

TARGET POSITION:
Company: {company}
Role: {role}

{candidate_info}

SELECTED KEYWORDS TO INCORPORATE: {keywords_str}

CURRENT SECTION CONTENT: {base_content}

GENERATION REQUIREMENTS:
- Build on the candidate's authentic 4-year experience background
- Naturally incorporate selected keywords from job description
- Enhance existing experience, don't fabricate new experience
- Maintain consistency with base resume achievements
- Focus on quantified results and technical depth
- Keep within character limits for single-page resume

Preferences:
- Tone: {tone}
- Length: {length}"""
        
        section_specific = {
            "summary": "\n\nGenerate a compelling professional summary that positions the candidate for this specific role.",
            "skills": "\n\nOrganize these keywords into a well-structured technical skills section.",
            "experience": "\n\nCreate 3-5 bullet points that demonstrate relevant experience using these keywords. Focus on achievements and impact."
        }
        
        return base_prompt + section_specific.get(section_type, "")
    
    def _generate_summary_fallback(
        self,
        keywords: List[str],
        base_content: str,
        job_context: Dict[str, Any],
        preferences: Optional[Dict[str, Any]]
    ) -> str:
        """Fallback summary generation with dynamic professional headline"""
        
        from .enhancers.professional_headline_generator import ProfessionalHeadlineGenerator
        
        # Generate professional headline
        headline_generator = ProfessionalHeadlineGenerator()
        target_role = job_context.get('role', 'Software Engineer')
        experience_years = 5  # Default, could be extracted from base content
        
        # Generate dynamic headline
        professional_headline = headline_generator.generate_professional_headline(
            target_role, keywords, experience_years
        )
        
        # Extract key components for additional content
        tech_keywords = [k for k in keywords if any(tech in k.lower() for tech in 
                        ['python', 'javascript', 'react', 'node', 'aws', 'docker', 'sql'])]
        soft_keywords = [k for k in keywords if any(soft in k.lower() for soft in 
                        ['leadership', 'collaboration', 'team', 'communication'])]
        
        # Build summary starting with professional headline
        summary = professional_headline + "."
        
        # Add additional context
        if 'currently' not in professional_headline.lower():
            summary += " Currently expert in building scalable applications and system architecture."
        else:
            summary += " Expert in building scalable applications and system architecture."
        
        # Add passion statement
        summary += " Passionate about delivering high-quality solutions in fast-paced environments."
        
        return summary
    
    def _generate_skills_fallback(
        self,
        keywords: List[str],
        base_content: str,
        job_context: Dict[str, Any],
        preferences: Optional[Dict[str, Any]]
    ) -> str:
        """Fallback skills generation"""
        
        # Categorize keywords
        categories = {
            "Languages": [],
            "Frameworks": [],
            "Cloud & DevOps": [],
            "Databases": [],
            "Tools": []
        }
        
        for keyword in keywords:
            kw_lower = keyword.lower()
            if any(lang in kw_lower for lang in ['python', 'javascript', 'java', 'typescript', 'go']):
                categories["Languages"].append(keyword)
            elif any(fw in kw_lower for fw in ['react', 'angular', 'vue', 'node', 'django', 'flask']):
                categories["Frameworks"].append(keyword)
            elif any(cloud in kw_lower for cloud in ['aws', 'azure', 'docker', 'kubernetes', 'ci/cd']):
                categories["Cloud & DevOps"].append(keyword)
            elif any(db in kw_lower for db in ['mysql', 'postgresql', 'mongodb', 'redis', 'sql']):
                categories["Databases"].append(keyword)
            else:
                categories["Tools"].append(keyword)
        
        # Build skills string
        skills_parts = []
        for category, skills in categories.items():
            if skills:
                skills_parts.append(f"{category}: {', '.join(skills)}")
        
        if skills_parts:
            return " | ".join(skills_parts)
        else:
            return ", ".join(keywords)
    
    def _generate_experience_fallback(
        self,
        keywords: List[str],
        base_content: str,
        job_context: Dict[str, Any],
        preferences: Optional[Dict[str, Any]]
    ) -> List[str]:
        """Fallback experience generation"""
        
        tech_keywords = [k for k in keywords if not any(soft in k.lower() for soft in 
                        ['leadership', 'collaboration', 'team', 'communication', 'years'])]
        soft_keywords = [k for k in keywords if any(soft in k.lower() for soft in 
                        ['leadership', 'collaboration', 'team', 'communication'])]
        
        bullets = []
        
        # Technical achievement bullet
        if tech_keywords:
            tech_list = tech_keywords[:3]
            bullets.append(f"Developed and maintained applications using {', '.join(tech_list)}, improving system performance and user experience")
        
        # Architecture bullet
        if any(arch in ' '.join(keywords).lower() for arch in ['microservices', 'api', 'architecture']):
            bullets.append("Designed and implemented scalable microservices architecture serving thousands of users")
        
        # Leadership bullet
        if soft_keywords:
            bullets.append(f"Demonstrated {soft_keywords[0].lower()} by mentoring team members and conducting code reviews")
        
        # Collaboration bullet
        if len(bullets) < 3:
            bullets.append("Collaborated with cross-functional teams to deliver high-quality software solutions on schedule")
        
        # DevOps/deployment bullet
        if any(devops in ' '.join(keywords).lower() for devops in ['docker', 'aws', 'ci/cd', 'kubernetes']):
            bullets.append("Implemented CI/CD pipelines and containerization, reducing deployment time by 50%")
        
        return bullets[:4]  # Return max 4 bullets
    
    # Helper methods for human-natural generation
    def _get_base_content_for_section(self, section_type: str) -> str:
        """Get base content for specific section type"""
        
        if section_type == "summary":
            return self.base_content.get("summary", "")
        elif section_type == "skills":
            return self.base_content.get("skills", "")
        elif section_type == "experience":
            return "\n".join(self.base_content.get("experience", []))
        return ""
    
    def _get_experience_context_for_bullet(self, base_experiences: List[Dict], position_index: int, bullet_index: int) -> Dict[str, Any]:
        """Get specific experience context for bullet generation"""
        
        if position_index < len(base_experiences):
            experience = base_experiences[position_index]
            return {
                'company': experience.get('company_name', 'Current Company'),
                'role': experience.get('job_title', 'Software Engineer'),
                'technologies': experience.get('technologies_used_in_role', ['Node.js', 'TypeScript', 'AWS']),
                'achievements': experience.get('experience_highlights', ['Built scalable applications'])
            }
        
        # Fallback context
        return {
            'company': 'Current Company',
            'role': 'Software Engineer',
            'technologies': ['Node.js', 'TypeScript', 'AWS'],
            'achievements': ['Built scalable applications']
        }
    
    def _clean_bullet_format(self, bullet_text: str) -> str:
        """Clean and format bullet point text"""
        
        import re
        
        # Remove bullet symbols if present
        bullet_text = re.sub(r'^[•\-\*]\s*', '', bullet_text.strip())
        
        # Ensure first letter is capitalized
        if bullet_text and bullet_text[0].islower():
            bullet_text = bullet_text[0].upper() + bullet_text[1:]
        
        # Remove trailing periods
        bullet_text = bullet_text.rstrip('.')
        
        return bullet_text
    
    def _count_keywords_in_text(self, text: str, keywords: List[str]) -> int:
        """Count how many keywords are present in text"""
        
        text_lower = text.lower()
        count = 0
        
        for keyword in keywords:
            if keyword.lower() in text_lower:
                count += 1
        
        return count
    
    def _matches_existing_pattern(self, text: str, patterns: List[str]) -> bool:
        """Check if text matches existing sentence patterns"""
        
        words = text.split()
        if not words:
            return False
        
        # Check if starting word pattern matches
        start_pattern = f"starts_with_{words[0].lower()}"
        if start_pattern in patterns:
            return True
        
        # Check length pattern
        length_pattern = "short_sentence" if len(words) <= 10 else "long_sentence" if len(words) >= 20 else ""
        if length_pattern and length_pattern in patterns:
            return True
        
        return False
    
    def _extract_patterns_from_bullet(self, bullet_text: str) -> List[str]:
        """Extract sentence patterns from bullet to avoid repetition"""
        
        patterns = []
        words = bullet_text.split()
        
        if words:
            # First word pattern
            patterns.append(f"starts_with_{words[0].lower()}")
            
            # Length pattern
            if len(words) <= 10:
                patterns.append("short_sentence")
            elif len(words) >= 20:
                patterns.append("long_sentence")
            
            # Structure pattern
            if ' and ' in bullet_text:
                patterns.append("compound_sentence")
            if bullet_text.count(',') >= 2:
                patterns.append("complex_listing")
        
        return patterns
    
    def _generate_fallback_bullet_enhanced(self, experience_context: Dict[str, Any], keywords: List[str], bullet_index: int) -> str:
        """Generate enhanced fallback bullet with context"""
        
        company = experience_context.get('company', 'Current Company')
        technologies = experience_context.get('technologies', [])
        
        # Enhanced fallback bullets based on actual context
        if bullet_index == 0 and keywords:
            return f"Built {keywords[0]} applications for {company}, improving system performance and user engagement"
        elif bullet_index == 1 and len(keywords) > 1:
            return f"Integrated {keywords[1]} systems enabling scalable {technologies[0] if technologies else 'backend'} architecture"
        elif bullet_index == 2:
            return f"Optimized API performance reducing response times by 40% while supporting increased traffic"
        elif bullet_index == 3:
            return f"Led development of payment integration features resulting in 15% increase in mobile orders"
        else:
            return f"Delivered high-quality {keywords[0] if keywords else 'software'} solutions in agile development environment"
    
    def _generate_enhanced_skills_sections(
        self,
        selected_keywords: List[str],
        base_content: str,
        job_context: Dict[str, Any],
        preferences: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Generate enhanced skills sections using intelligent merger"""
        
        try:
            # Get base skills from resume parser
            base_skills = self.resume_parser.base_profile
            
            # Merge job keywords with existing skills
            enhanced_sections = self.skills_merger.merge_skills_with_job_keywords(
                base_skills=base_skills,
                job_keywords=selected_keywords
            )
            
            # Apply human-natural enhancement and space optimization to each section
            optimized_sections = {}
            all_validations = {}
            
            for section_name, section_content in enhanced_sections.items():
                # Apply human enhancement
                enhancement_result = self.human_enhancer.enhance_content_naturalness(
                    section_content, 'skills'
                )
                enhanced_content = enhancement_result['enhanced']
                
                # Apply space optimization
                optimization_result = self.space_optimizer.optimize_content_length(
                    enhanced_content, 'skills'
                )
                optimized_content = optimization_result['optimized']
                
                # Validation
                validation = self.human_enhancer.validate_human_naturalness(optimized_content, 'skills')
                constraints = self.space_optimizer.check_format_constraints(optimized_content, 'skills')
                
                optimized_sections[section_name] = optimized_content
                all_validations[section_name] = {
                    'validation_score': validation['overall_score'],
                    'human_score': validation['human_score'],
                    'meets_constraints': constraints['overall_valid'],
                    'char_count': len(optimized_content),
                    'keywords_included': self._count_keywords_in_text(optimized_content, selected_keywords)
                }
            
            # Generate coverage report
            coverage_report = self.skills_merger.get_skills_coverage_report(
                base_skills, selected_keywords, enhanced_sections
            )
            
            # Format for API response (return as formatted skills string)
            formatted_skills = self._format_skills_sections_for_response(optimized_sections)
            
            return {
                'success': True,
                'best_content': formatted_skills,
                'skills_sections': optimized_sections,
                'validation_details': all_validations,
                'coverage_report': coverage_report,
                'generation_method': 'intelligent_skills_merger',
                'preserved_original_skills': True
            }
            
        except Exception as e:
            logger.error(f"Error in enhanced skills generation: {e}")
            
            # Fallback to original method
            return self._generate_with_enhanced_fallback(
                'skills', selected_keywords, base_content, job_context, preferences
            )
    
    def _format_skills_sections_for_response(self, optimized_sections: Dict[str, str]) -> str:
        """Format multiple skills sections into a single response string"""
        
        # Join sections with " | " separator for backward compatibility
        sections_list = []
        for section_name, content in optimized_sections.items():
            if content.strip():
                sections_list.append(f"{section_name}: {content}")
        
        return " | ".join(sections_list)
    
    def _enhance_authentic_bullet_with_keywords(
        self, 
        authentic_bullet: str, 
        job_keywords: List[str], 
        experience_tech: List[str]
    ) -> str:
        """Enhance authentic bullet points with job-relevant keywords while preserving authenticity"""
        
        # Start with the authentic bullet
        enhanced_bullet = authentic_bullet
        
        # Extract current technologies mentioned in the bullet
        current_tech = []
        for tech in experience_tech:
            if tech.lower() in authentic_bullet.lower():
                current_tech.append(tech)
        
        # Find relevant job keywords that can be naturally integrated
        relevant_keywords = []
        for keyword in job_keywords:
            keyword_lower = keyword.lower()
            
            # Skip if already mentioned
            if keyword_lower in authentic_bullet.lower():
                continue
            
            # Include if it's related to technologies used in this role
            if any(tech.lower() in keyword_lower or keyword_lower in tech.lower() for tech in experience_tech):
                relevant_keywords.append(keyword)
            
            # Include if it's a common tech term that fits the context
            elif any(term in keyword_lower for term in ['api', 'aws', 'cloud', 'database', 'framework', 'testing']):
                relevant_keywords.append(keyword)
        
        # Intelligently integrate keywords without changing the core meaning
        if relevant_keywords:
            # For EBT integration bullet, can add payment-related keywords
            if 'ebt' in authentic_bullet.lower() and any('payment' in kw.lower() for kw in relevant_keywords):
                payment_keywords = [kw for kw in relevant_keywords if 'payment' in kw.lower()]
                if payment_keywords and 'payment' not in authentic_bullet.lower():
                    enhanced_bullet = enhanced_bullet.replace('EBT', f'EBT {payment_keywords[0]}')
            
            # For API/performance bullets, can add specific tech keywords
            elif 'api' in authentic_bullet.lower():
                api_keywords = [kw for kw in relevant_keywords if any(term in kw.lower() for term in ['rest', 'graphql', 'microservice'])]
                if api_keywords:
                    enhanced_bullet = enhanced_bullet.replace('API', f'{api_keywords[0]} API')
            
            # For monitoring/observability bullets
            elif any(monitor_term in authentic_bullet.lower() for monitor_term in ['monitoring', 'relic', 'cloudwatch']):
                monitor_keywords = [kw for kw in relevant_keywords if any(term in kw.lower() for term in ['monitoring', 'observability', 'metrics', 'logging'])]
                if monitor_keywords:
                    # Add to existing monitoring setup
                    enhanced_bullet = enhanced_bullet.replace('monitoring', f'{monitor_keywords[0]} monitoring')
        
        return enhanced_bullet
    
    def _generate_new_bullet_from_authentic_context(
        self, 
        experience_data: Dict[str, Any], 
        job_keywords: List[str], 
        bullet_index: int, 
        existing_patterns: List[str]
    ) -> str:
        """Generate new bullet based on authentic experience context and job keywords"""
        
        company = experience_data.get('company_name', 'Current Company')
        role = experience_data.get('job_title', 'Software Engineer')
        technologies = experience_data.get('technologies_used_in_role', [])
        
        # Create contextually relevant bullets based on actual role
        if company == '7-Eleven':
            # Create bullets that fit the 7-Eleven mobile commerce context
            context_bullets = [
                f"Collaborated with product teams to enhance mobile checkout experience using {technologies[0] if technologies else 'Node.js'} and {job_keywords[0] if job_keywords else 'AWS'}",
                f"Implemented {job_keywords[1] if len(job_keywords) > 1 else 'payment'} security measures ensuring PCI compliance and data protection across retail transactions",
                f"Optimized database queries and caching strategies with {next((tech for tech in technologies if 'mongo' in tech.lower() or 'redis' in tech.lower()), 'MongoDB')} improving system reliability",
                f"Designed scalable {job_keywords[0] if job_keywords else 'microservices'} architecture supporting real-time transaction processing for nationwide retail operations"
            ]
        elif 'Liberty Mutual' in company:
            # Create bullets that fit insurance domain context
            context_bullets = [
                f"Developed insurance platform features using {technologies[0] if technologies else 'Python'} and {job_keywords[0] if job_keywords else 'Django'}",
                f"Built data analytics dashboards processing policyholder information with enhanced {job_keywords[1] if len(job_keywords) > 1 else 'reporting'} capabilities",
                f"Implemented automated testing frameworks ensuring regulatory compliance and system reliability",
                f"Collaborated with business analysts to deliver customer-facing features improving policy management experience"
            ]
        else:
            # Generic but contextually appropriate bullets
            context_bullets = [
                f"Developed scalable {job_keywords[0] if job_keywords else 'web'} applications using {technologies[0] if technologies else 'modern'} technology stack",
                f"Implemented {job_keywords[1] if len(job_keywords) > 1 else 'automated'} testing and deployment pipelines improving development efficiency",
                f"Collaborated with cross-functional teams to deliver high-quality software solutions meeting business requirements",
                f"Optimized application performance and monitoring using industry best practices and {job_keywords[0] if job_keywords else 'cloud'} technologies"
            ]
        
        # Select bullet based on index, avoiding pattern repetition
        selected_bullet = context_bullets[bullet_index % len(context_bullets)]
        
        # Ensure it doesn't match existing patterns
        attempt = 0
        while self._matches_existing_pattern(selected_bullet, existing_patterns) and attempt < 3:
            bullet_index = (bullet_index + 1) % len(context_bullets)
            selected_bullet = context_bullets[bullet_index]
            attempt += 1
        
        return selected_bullet