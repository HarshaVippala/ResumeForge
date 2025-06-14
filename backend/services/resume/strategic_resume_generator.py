"""
Strategic Resume Generator
Main orchestrator for the new strategic resume generation pipeline
"""

import logging
from typing import Dict, List, Any, Optional

from ..lm_studio_client import LMStudioClient
from ..keyword_extractor import KeywordExtractor
from .section_generator import SectionGenerator
from .resume_processor import ResumeProcessor
from .strategic_context import StrategicContext

logger = logging.getLogger(__name__)

class StrategicResumeGenerator:
    """
    Main orchestrator for strategic resume generation using rich context
    """
    
    def __init__(self):
        self.lm_studio = LMStudioClient()
        self.keyword_extractor = KeywordExtractor(self.lm_studio)
        self.section_generator = SectionGenerator(self.lm_studio)
        self.resume_processor = ResumeProcessor()
    
    def generate_tailored_resume(
        self,
        job_description: str,
        company_name: str,
        role: str,
        preferences: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Generate a strategically tailored resume using the new pipeline
        
        Args:
            job_description: Full job description text
            company_name: Target company name
            role: Target job title
            preferences: User preferences for generation
            
        Returns:
            Complete tailored resume with metadata
        """
        logger.info(f"Generating strategic resume for {role} at {company_name}")
        
        try:
            # Step 1: Analyze job and create strategic context
            strategic_context = self.keyword_extractor.analyze_job_description(
                job_description, role
            )
            
            # Update company name in context
            strategic_context.job_info.company = company_name
            
            # Step 2: Generate all sections using strategic guidance
            section_results = self.section_generator.generate_strategic_sections(
                strategic_context, preferences
            )
            
            # Step 3: Create preview for frontend
            job_info = {
                "company": company_name,
                "role": role
            }
            
            preview = self.resume_processor.create_preview(
                section_results["sections"], job_info
            )
            
            # Step 4: Prepare complete response
            response = {
                "success": True,
                "sections": section_results["sections"],
                "preview": preview,
                "strategic_analysis": {
                    "target_seniority": strategic_context.strategic_positioning.target_seniority,
                    "role_specialization": strategic_context.strategic_positioning.role_specialization,
                    "keywords_targeted": len(strategic_context.get_all_critical_keywords()),
                    "deal_breakers_count": len(strategic_context.requirement_criticality.deal_breakers),
                    "experiences_prioritized": section_results["generation_metadata"]["experience_count"],
                    "prioritization_scores": section_results["strategic_guidance_applied"]["experience"].get("prioritization_scores", [])
                },
                "generation_metadata": section_results["generation_metadata"],
                "strategic_guidance_applied": section_results["strategic_guidance_applied"],
                "human_naturalness_features": {
                    "anti_ai_detection": True,
                    "conversational_tone": True,
                    "authentic_experience_based": True,
                    "natural_keyword_integration": True
                }
            }
            
            logger.info(f"Strategic resume generated successfully: "
                       f"{len(response['sections']['summary'])} char summary, "
                       f"{len(response['sections']['experience'])} experience bullets")
            
            return response
            
        except Exception as e:
            logger.error(f"Strategic resume generation failed: {e}")
            
            # Fallback to basic generation
            return self._generate_fallback_resume(job_description, company_name, role, preferences)
    
    def _generate_fallback_resume(
        self,
        job_description: str,
        company_name: str,
        role: str,
        preferences: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Fallback to basic resume generation if strategic approach fails"""
        
        logger.info("Using fallback resume generation")
        
        try:
            # Create basic strategic context
            strategic_context = self.keyword_extractor._create_basic_strategic_context(
                job_description, role
            )
            strategic_context.job_info.company = company_name
            
            # Generate using fallback methods from section generator
            summary = self.section_generator._generate_strategic_summary_fallback(
                "", strategic_context, strategic_context.get_priority_skills_for_section("summary")
            )
            
            skills = strategic_context.legacy_keywords[:10]  # Use basic keywords
            skills_text = ", ".join(skills) if skills else "Python, JavaScript, AWS, Node.js"
            
            experience = [
                "Built scalable applications using modern technology stack",
                "Collaborated with cross-functional teams to deliver high-quality software",
                "Optimized system performance and implemented best practices"
            ]
            
            sections = {
                "summary": summary,
                "skills": skills_text,
                "experience": experience
            }
            
            job_info = {"company": company_name, "role": role}
            preview = self.resume_processor.create_preview(sections, job_info)
            
            return {
                "success": True,
                "sections": sections,
                "preview": preview,
                "strategic_analysis": {
                    "target_seniority": strategic_context.strategic_positioning.target_seniority,
                    "role_specialization": strategic_context.strategic_positioning.role_specialization,
                    "keywords_targeted": len(strategic_context.legacy_keywords),
                    "generation_method": "fallback"
                },
                "generation_metadata": {
                    "used_ai": False,
                    "fallback_method": "basic_strategic_context"
                }
            }
            
        except Exception as e:
            logger.error(f"Fallback generation also failed: {e}")
            
            # Ultimate fallback - minimal response
            return {
                "success": False,
                "error": "Resume generation failed",
                "sections": {
                    "summary": "Experienced software engineer with strong technical skills",
                    "skills": "Python, JavaScript, Node.js, AWS, MongoDB",
                    "experience": ["Built software applications", "Worked with development teams"]
                }
            }
    
    def get_strategic_insights(self, job_description: str, role: str) -> Dict[str, Any]:
        """
        Get strategic insights about a job posting without generating full resume
        
        Args:
            job_description: Job description text
            role: Target role
            
        Returns:
            Strategic analysis insights
        """
        try:
            strategic_context = self.keyword_extractor.analyze_job_description(
                job_description, role
            )
            
            return {
                "success": True,
                "insights": {
                    "target_seniority": strategic_context.strategic_positioning.target_seniority,
                    "role_specialization": strategic_context.strategic_positioning.role_specialization,
                    "industry_focus": strategic_context.strategic_positioning.industry_focus,
                    "deal_breakers": [
                        {
                            "skill": item.skill,
                            "evidence": item.evidence,
                            "frequency": item.frequency
                        }
                        for item in strategic_context.requirement_criticality.deal_breakers
                    ],
                    "competitive_edges": [
                        {
                            "skill": item.skill,
                            "evidence": item.evidence
                        }
                        for item in strategic_context.requirement_criticality.competitive_edges
                    ],
                    "technical_requirements": {
                        "programming_languages": strategic_context.technical_skills.programming_languages,
                        "frameworks": strategic_context.technical_skills.frameworks_libraries,
                        "databases": strategic_context.technical_skills.databases,
                        "cloud_devops": strategic_context.technical_skills.cloud_devops
                    },
                    "resume_guidance": {
                        "skills_to_emphasize": strategic_context.resume_guidance.skills_emphasis.primary_focus,
                        "experience_focus": strategic_context.resume_guidance.experience_positioning.lead_with,
                        "gaps_to_address": strategic_context.resume_guidance.gap_mitigation.missing_critical
                    }
                }
            }
            
        except Exception as e:
            logger.error(f"Strategic insights generation failed: {e}")
            return {
                "success": False,
                "error": str(e)
            }