"""
Keyword Extractor Service
Analyzes job descriptions and extracts categorized keywords
"""

import logging
from typing import Dict, List, Any, Optional
from .llm_factory import LLMFactory
from .resume.resume_parser import ResumeParser
from .resume.prompt_manager import PromptManager
from .resume.strategic_context import (
    StrategicContext, StrategicPositioning, RequirementCriticality, 
    TechnicalSkills, ATSOptimization, ResumeGuidance, JobInfo,
    RequirementItem, SkillsEmphasis, ExperiencePositioning, GapMitigation
)

logger = logging.getLogger(__name__)

class KeywordExtractor:
    """Extract and categorize keywords from job descriptions"""
    
    def __init__(self, llm_service=None):
        # Use provided LLM service or create default
        self.llm_service = llm_service or LLMFactory.create_default_service()
        self.resume_parser = ResumeParser()
        self.prompt_manager = PromptManager()
        
        # Get base resume skills for analysis
        self.base_skills = self.resume_parser.get_skills_by_category()
        
    
    def analyze_job_description(
        self, 
        job_description: str, 
        role: str
    ) -> StrategicContext:
        """
        Analyze job description and extract strategic insights using AI
        
        Args:
            job_description: Full job description text
            role: Job role/title
            
        Returns:
            StrategicContext object with rich analysis
        """
        # Try AI extraction first
        logger.info(f"Using {type(self.llm_service).__name__} for strategic keyword extraction")
        ai_result = self._extract_with_ai(job_description, role)
        
        if ai_result:
            return self._create_strategic_context_from_ai(ai_result, job_description, role)
        else:
            logger.warning("AI extraction failed, falling back to basic extraction")
            return self._create_basic_strategic_context(job_description, role)
    
    def _extract_with_ai(
        self,
        job_description: str,
        role: str
    ) -> Optional[Dict[str, Any]]:
        """Extract keywords using AI model"""
        
        # Load prompts from external files
        system_prompt = self.prompt_manager.get_job_analysis_system_prompt()
        user_prompt = self.prompt_manager.get_job_analysis_user_prompt(job_description)

        try:
            # Combine prompts for LLM service
            full_prompt = f"{system_prompt}\n\n{user_prompt}"
            
            # Use the generic LLM service interface
            response = self.llm_service.analyze_job_description(job_description, role)
            
            if response.success and response.content:
                # Parse the response content
                import json
                if isinstance(response.content, str):
                    result = json.loads(response.content)
                else:
                    result = response.content
                
                if result and self._validate_extraction_result(result):
                    logger.info("Successfully extracted keywords with AI")
                    return result
                else:
                    logger.error("AI extraction failed validation")
                    return None
            else:
                logger.error(f"LLM service failed: {response.error}")
                return None
                
        except Exception as e:
            logger.error(f"AI extraction failed: {e}")
            return None

    def _create_strategic_context_from_ai(self, ai_result: Dict[str, Any], job_description: str, role: str) -> StrategicContext:
        """Create StrategicContext from AI analysis result"""
        
        try:
            # Extract strategic positioning
            positioning_data = ai_result.get("strategic_positioning", {})
            strategic_positioning = StrategicPositioning(
                target_seniority=positioning_data.get("target_seniority", "Mid-level"),
                role_specialization=positioning_data.get("role_specialization", "Software Development"),
                industry_focus=positioning_data.get("industry_focus", ""),
                experience_level=positioning_data.get("experience_level", ""),
                scale_context=positioning_data.get("scale_context", "")
            )
            
            # Extract requirement criticality
            criticality_data = ai_result.get("requirement_criticality", {})
            deal_breakers = [
                RequirementItem(
                    skill=item.get("skill", ""),
                    evidence=item.get("evidence", ""),
                    frequency=item.get("frequency", 1)
                )
                for item in criticality_data.get("deal_breakers", [])
                if isinstance(item, dict) and item.get("skill")
            ]
            
            competitive_edges = [
                RequirementItem(
                    skill=item.get("skill", ""),
                    evidence=item.get("advantage", ""),
                    frequency=1
                )
                for item in criticality_data.get("competitive_edges", [])
                if isinstance(item, dict) and item.get("skill")
            ]
            
            nice_to_haves = [
                RequirementItem(
                    skill=item.get("skill", ""),
                    evidence=item.get("value", ""),
                    frequency=1
                )
                for item in criticality_data.get("nice_to_haves", [])
                if isinstance(item, dict) and item.get("skill")
            ]
            
            requirement_criticality = RequirementCriticality(
                deal_breakers=deal_breakers,
                competitive_edges=competitive_edges,
                nice_to_haves=nice_to_haves
            )
            
            # Extract technical skills
            tech_data = ai_result.get("technical_skills", {})
            technical_skills = TechnicalSkills(
                programming_languages=tech_data.get("programming_languages", []),
                frameworks_libraries=tech_data.get("frameworks_libraries", []),
                databases=tech_data.get("databases", []),
                cloud_devops=tech_data.get("cloud_devops", []),
                ai_ml=tech_data.get("ai_ml", []),
                tools_platforms=tech_data.get("tools_platforms", []),
                methodologies=tech_data.get("methodologies", [])
            )
            
            # Extract ATS optimization
            ats_data = ai_result.get("ats_optimization", {})
            ats_optimization = ATSOptimization(
                critical_keywords=ats_data.get("critical_keywords", []),
                exact_matches_required=ats_data.get("exact_matches_required", []),
                keyword_density_targets=ats_data.get("keyword_density_targets", {})
            )
            
            # Extract resume guidance
            guidance_data = ai_result.get("resume_guidance", {})
            skills_emphasis_data = guidance_data.get("skills_emphasis", {})
            experience_positioning_data = guidance_data.get("experience_positioning", {})
            gap_mitigation_data = guidance_data.get("gap_mitigation", {})
            
            skills_emphasis = SkillsEmphasis(
                primary_focus=skills_emphasis_data.get("primary_focus", []),
                secondary_mention=skills_emphasis_data.get("secondary_mention", []),
                omit_or_minimize=skills_emphasis_data.get("omit_or_minimize", [])
            )
            
            experience_positioning = ExperiencePositioning(
                lead_with=experience_positioning_data.get("lead_with", ""),
                highlight_projects=experience_positioning_data.get("highlight_projects", []),
                scale_indicators=experience_positioning_data.get("scale_indicators", [])
            )
            
            gap_mitigation = GapMitigation(
                missing_critical=gap_mitigation_data.get("missing_critical", []),
                learning_priorities=gap_mitigation_data.get("learning_priorities", []),
                compensation_strategies=gap_mitigation_data.get("compensation_strategies", [])
            )
            
            resume_guidance = ResumeGuidance(
                skills_emphasis=skills_emphasis,
                experience_positioning=experience_positioning,
                gap_mitigation=gap_mitigation
            )
            
            # Create job info
            job_info = JobInfo(
                job_title=role,
                company="",  # Extract from job_description if needed
                seniority=strategic_positioning.target_seniority,
                department="Engineering",
                key_focus=strategic_positioning.role_specialization
            )
            
            # Create legacy keywords for backward compatibility
            legacy_keywords = []
            legacy_keywords.extend([item.skill for item in deal_breakers])
            legacy_keywords.extend(technical_skills.programming_languages)
            legacy_keywords.extend(technical_skills.frameworks_libraries[:5])
            
            # Create final StrategicContext
            context = StrategicContext(
                strategic_positioning=strategic_positioning,
                requirement_criticality=requirement_criticality,
                technical_skills=technical_skills,
                ats_optimization=ats_optimization,
                resume_guidance=resume_guidance,
                job_info=job_info,
                job_description=job_description,
                legacy_keywords=list(set(legacy_keywords))
            )
            
            logger.info(f"Created StrategicContext for {role} with {len(deal_breakers)} deal breakers and {len(legacy_keywords)} keywords")
            return context
            
        except Exception as e:
            logger.error(f"Error creating StrategicContext from AI result: {e}")
            return self._create_basic_strategic_context(job_description, role)

    def _determine_focus_from_skills(self, skills: List[str]) -> str:
        """Determine the key focus area based on extracted skills"""
        skills_text = " ".join(skills).lower()

        focus_areas = {
            "Frontend": ["react", "angular", "vue", "frontend", "front-end", "ui", "ux"],
            "Backend": ["backend", "back-end", "api", "server", "database", "node.js", "express"],
            "Full-stack": ["fullstack", "full-stack", "full stack"],
            "DevOps": ["devops", "infrastructure", "deployment", "ci/cd", "docker", "kubernetes"],
            "Mobile": ["mobile", "ios", "android", "react native", "flutter"],
            "Data": ["data", "analytics", "ml", "machine learning", "ai", "tensorflow", "pytorch"]
        }

        for focus, keywords in focus_areas.items():
            if any(keyword in skills_text for keyword in keywords):
                return focus

        return "Software Development"


    
    def _validate_extraction_result(self, result: Dict[str, Any]) -> bool:
        """Validate that AI extraction result has required strategic structure"""
        if not isinstance(result, dict):
            logger.warning("Result is not a dictionary")
            return False

        # Log what keys we actually received for debugging
        actual_keys = list(result.keys())
        logger.info(f"AI response keys: {actual_keys}")

        # Check for new strategic schema structure
        required_keys = ["strategic_positioning", "requirement_criticality", "technical_skills", "ats_optimization", "resume_guidance"]

        missing_keys = []
        for key in required_keys:
            if key not in result:
                missing_keys.append(key)
                logger.warning(f"Missing required key: {key}")
        
        if missing_keys:
            logger.error(f"Missing keys: {missing_keys}. Available keys: {actual_keys}")
            return False

        # Validate strategic_positioning structure
        positioning = result.get("strategic_positioning", {})
        if not isinstance(positioning, dict):
            logger.warning("strategic_positioning should be an object")
            return False

        # Validate technical_skills has the nested structure
        if not isinstance(result.get("technical_skills"), dict):
            logger.warning("technical_skills should be an object")
            return False

        # Check if we have some technical content
        tech_skills = result.get("technical_skills", {})
        tech_categories = ["programming_languages", "frameworks_libraries", "databases", "cloud_devops", "ai_ml", "tools_platforms", "methodologies"]
        has_tech_content = any(
            category in tech_skills and isinstance(tech_skills[category], list) and len(tech_skills[category]) > 0
            for category in tech_categories
        )

        # Validate resume_guidance structure
        guidance = result.get("resume_guidance", {})
        if not isinstance(guidance, dict) or "skills_emphasis" not in guidance:
            logger.warning("resume_guidance missing skills_emphasis")
            return False

        if not has_tech_content:
            logger.warning("No technical content extracted")
            return False

        return True
    
    def score_keyword_impact(self, keywords: List[str], job_description: str) -> Dict[str, str]:
        """Score keywords by their frequency in job description"""
        text = job_description.lower()
        scores = {}
        
        for keyword in keywords:
            keyword_lower = keyword.lower()
            count = text.count(keyword_lower)
            
            # Simple frequency-based scoring
            if count >= 3:
                scores[keyword] = "high"
            elif count >= 2:
                scores[keyword] = "medium"
            else:
                scores[keyword] = "low"
        
        return scores
    
    def _create_basic_strategic_context(self, job_description: str, role: str) -> StrategicContext:
        """Create basic StrategicContext when AI is not available"""
        logger.info("Creating basic strategic context fallback")
        
        # Simple keyword patterns to look for
        programming_keywords = ['python', 'javascript', 'java', 'c++', 'c#', 'ruby', 'go', 'rust', 'typescript', 'php', 'swift', 'kotlin']
        framework_keywords = ['react', 'angular', 'vue', 'django', 'flask', 'spring', 'express', 'rails', 'laravel', '.net', 'node.js']
        database_keywords = ['sql', 'mysql', 'postgresql', 'mongodb', 'redis', 'elasticsearch', 'cassandra', 'dynamodb']
        cloud_keywords = ['aws', 'azure', 'gcp', 'docker', 'kubernetes', 'jenkins', 'terraform', 'ansible']
        
        job_lower = job_description.lower()
        
        # Extract found keywords
        found_programming = [k for k in programming_keywords if k in job_lower]
        found_frameworks = [k for k in framework_keywords if k in job_lower]
        found_databases = [k for k in database_keywords if k in job_lower]
        found_cloud = [k for k in cloud_keywords if k in job_lower]
        
        # Determine seniority from common patterns
        seniority = "Mid-level"
        if any(term in job_lower for term in ['senior', 'lead', 'principal', 'staff', 'architect']):
            seniority = "Senior"
        elif any(term in job_lower for term in ['junior', 'entry level', 'associate', 'graduate']):
            seniority = "Junior"
        
        # Create basic components
        strategic_positioning = StrategicPositioning(
            target_seniority=seniority,
            role_specialization=self._determine_focus_from_skills(found_programming + found_frameworks),
            experience_level=f"{seniority} level"
        )
        
        # Create basic deal breakers from most important keywords
        deal_breakers = []
        for skill in (found_programming + found_frameworks)[:5]:
            deal_breakers.append(RequirementItem(
                skill=skill,
                evidence="Found multiple times in job description",
                frequency=job_lower.count(skill.lower())
            ))
        
        requirement_criticality = RequirementCriticality(deal_breakers=deal_breakers)
        
        technical_skills = TechnicalSkills(
            programming_languages=found_programming,
            frameworks_libraries=found_frameworks,
            databases=found_databases,
            cloud_devops=found_cloud
        )
        
        # Basic skills emphasis - prioritize what was found
        skills_emphasis = SkillsEmphasis(
            primary_focus=(found_programming + found_frameworks)[:8],
            secondary_mention=found_databases + found_cloud
        )
        
        resume_guidance = ResumeGuidance(skills_emphasis=skills_emphasis)
        
        job_info = JobInfo(
            job_title=role,
            seniority=seniority,
            key_focus=strategic_positioning.role_specialization
        )
        
        # Create legacy keywords for compatibility
        legacy_keywords = found_programming + found_frameworks + found_databases + found_cloud
        
        return StrategicContext(
            strategic_positioning=strategic_positioning,
            requirement_criticality=requirement_criticality,
            technical_skills=technical_skills,
            resume_guidance=resume_guidance,
            job_info=job_info,
            job_description=job_description,
            legacy_keywords=list(set(legacy_keywords))
        )