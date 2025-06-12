"""
Keyword Extractor Service
Analyzes job descriptions and extracts categorized keywords
"""

import logging
from typing import Dict, List, Any, Optional
from .lm_studio_client import LMStudioClient
from .resume.resume_parser import ResumeParser

logger = logging.getLogger(__name__)

class KeywordExtractor:
    """Extract and categorize keywords from job descriptions"""
    
    def __init__(self, lm_studio_client: Optional[LMStudioClient] = None):
        self.lm_studio = lm_studio_client or LMStudioClient()
        self.resume_parser = ResumeParser()
        
        # Get base resume skills for analysis
        self.base_skills = self.resume_parser.get_skills_by_category()
        
    
    def analyze_job_description(
        self, 
        job_description: str, 
        role: str
    ) -> Dict[str, Any]:
        """
        Analyze job description and extract strategic insights using AI
        
        Args:
            job_description: Full job description text
            role: Job role/title
            
        Returns:
            Dictionary with strategic analysis
        """
        # AI-only extraction for clean, high-quality results
        if not self.lm_studio.test_connection():
            raise ConnectionError("LM Studio not available. Please ensure LM Studio is running.")
        
        logger.info("Using LM Studio for strategic keyword extraction")
        result = self._extract_with_ai(job_description, role)
        
        if not result:
            raise ValueError("AI extraction failed. Please check model configuration.")
            
        return result
    
    def _extract_with_ai(
        self,
        job_description: str,
        role: str
    ) -> Optional[Dict[str, Any]]:
        """Extract keywords using LM Studio AI model with Resume_Tailored quality"""
        
        system_prompt = """You are a strategic resume optimization analyst specializing in technical roles. Your goal is to extract actionable intelligence from job descriptions that enables targeted resume improvements and competitive positioning.

STRATEGIC ANALYSIS FRAMEWORK:

1. REQUIREMENT CRITICALITY ANALYSIS:
   - DEAL-BREAKERS: Skills/experience that likely cause rejection if missing ("must have", "required", "essential", mentioned multiple times)
   - COMPETITIVE-EDGES: Skills that differentiate strong candidates ("preferred", "plus", domain expertise, advanced skills)  
   - NICE-TO-HAVES: Bonus qualifications that add value but aren't critical

2. POSITIONING INTELLIGENCE:
   - Seniority Level: Extract specific years, leadership indicators, scope of responsibility
   - Role Specialization: Analyze tech stack to determine Frontend/Backend/Full-stack/DevOps focus
   - Industry Context: Domain-specific requirements (fintech, healthcare, crypto, etc.)
   - Scale Indicators: Team size, user base, system complexity (startup vs enterprise)

3. KEYWORD OPTIMIZATION STRATEGY:
   - ATS Critical: Exact terms that automated systems will scan for
   - Variations Mapping: All ways to express the same skill (React/ReactJS/React.js)
   - Frequency Weighting: Skills mentioned multiple times vs once
   - Context Quality: Requirements section vs company fluff sections

4. RESUME GUIDANCE GENERATION:
   - Skills to Emphasize: From typical skillsets, what should be prominent
   - Experience to Highlight: What projects/roles to feature based on requirements
   - Gap Mitigation: Missing requirements and how to address them
   - Competitive Positioning: How to frame background for this specific role

IGNORE COMPLETELY: Company history, funding, office locations, benefits, salary, mission statements, "why work here" marketing copy, application instructions, legal disclaimers

EXTRACTION PRIORITIES:
- Preserve exact formatting and versions ("Python 3.8+", "Node.js 16+", "AWS Certified")
- Include both abbreviations and full forms ("ML" and "Machine Learning")
- Identify compound terms precisely ("React Native", "CI/CD", "DevOps")
- Note specific indicators: "3+ years", "Senior", "Lead", "team of 5", "startup experience"

OUTPUT this strategic analysis JSON:
{
  "strategic_positioning": {
    "target_seniority": "Junior/Mid/Senior based on requirements",
    "role_specialization": "Frontend/Backend/Full-stack/DevOps/etc",
    "industry_focus": "Domain expertise required",
    "experience_level": "X+ years",
    "scale_context": "Startup/Enterprise/etc"
  },
  "requirement_criticality": {
    "deal_breakers": [{"skill": "name", "evidence": "why critical", "frequency": count}],
    "competitive_edges": [{"skill": "name", "advantage": "why differentiating"}],
    "nice_to_haves": [{"skill": "name", "value": "bonus value"}]
  },
  "technical_skills": {
    "programming_languages": [],
    "frameworks_libraries": [],
    "databases": [],
    "cloud_devops": [],
    "ai_ml": [],
    "tools_platforms": [],
    "methodologies": []
  },
  "ats_optimization": {
    "critical_keywords": [{"term": "name", "variations": ["alt1", "alt2"], "weight": "critical/important/standard"}],
    "exact_matches_required": ["terms that must be precise"],
    "keyword_density_targets": {"skill": frequency_mentioned}
  },
  "resume_guidance": {
    "skills_emphasis": {
      "primary_focus": ["top 3-5 skills to highlight prominently"],
      "secondary_mention": ["skills to include but not emphasize"],
      "omit_or_minimize": ["skills to avoid highlighting"]
    },
    "experience_positioning": {
      "lead_with": "Primary experience type to feature",
      "highlight_projects": ["types of projects to emphasize"],
      "scale_indicators": ["what scale/complexity to mention"]
    },
    "gap_mitigation": {
      "missing_critical": ["skills clearly required but potentially missing"],
      "learning_priorities": ["skills to acquire for competitiveness"],
      "compensation_strategies": ["how to address gaps with existing experience"]
    }
  }
}

Think strategically about competitive positioning and resume optimization, not just keyword extraction."""

        user_prompt = f"""Analyze this job posting to provide strategic resume optimization guidance:

<job_posting>
{job_description}
</job_posting>

Focus on competitive positioning and actionable resume improvement strategies. Return only the JSON object."""

        try:
            result = self.lm_studio.generate_structured_response(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                expected_format="JSON",
                max_tokens=2500,
                temperature=0.3
            )
            
            if result and self._validate_extraction_result(result):
                logger.info("Successfully extracted keywords with AI")
                # Convert new format to legacy format for compatibility
                return self._convert_ai_result_to_legacy_format(result, role)
            else:
                logger.error("AI extraction failed validation")
                return None
                
        except Exception as e:
            logger.error(f"AI extraction failed: {e}")
            return None

    def _convert_ai_result_to_legacy_format(self, ai_result: Dict[str, Any], role: str) -> Dict[str, Any]:
        """Convert new strategic AI response format to legacy format for compatibility"""

        # Extract from strategic positioning
        positioning = ai_result.get("strategic_positioning", {})
        seniority = positioning.get("target_seniority", "Mid-level")
        role_specialization = positioning.get("role_specialization", "Software Development")
        experience_level = positioning.get("experience_level", "")

        # Extract from nested technical_skills structure
        tech_skills = ai_result.get("technical_skills", {})

        # Combine all technical skills for the technical_skills field
        all_technical = []
        tech_categories = ["programming_languages", "frameworks_libraries", "databases", "cloud_devops", "ai_ml", "tools_platforms", "methodologies"]

        for category in tech_categories:
            skills = tech_skills.get(category, [])
            if isinstance(skills, list):
                all_technical.extend(skills)

        # Extract experience requirements from strategic analysis
        criticality = ai_result.get("requirement_criticality", {})
        experience_reqs = []
        if experience_level:
            experience_reqs.append(experience_level)
        
        # Add leadership indicators from deal breakers
        deal_breakers = criticality.get("deal_breakers", [])
        for item in deal_breakers:
            if isinstance(item, dict) and "skill" in item:
                skill = item["skill"]
                if any(term in skill.lower() for term in ["lead", "senior", "principal", "architect", "years"]):
                    experience_reqs.append(skill)

        # Extract critical keywords from ATS optimization and deal breakers
        ats_opt = ai_result.get("ats_optimization", {})
        critical_keywords = []
        
        # Get critical keywords from ATS optimization
        critical_kw = ats_opt.get("critical_keywords", [])
        for kw in critical_kw:
            if isinstance(kw, dict) and "term" in kw:
                critical_keywords.append(kw["term"])
            elif isinstance(kw, str):
                critical_keywords.append(kw)
        
        # Add deal breaker skills as critical keywords
        for item in deal_breakers:
            if isinstance(item, dict) and "skill" in item:
                critical_keywords.append(item["skill"])

        # Extract soft skills from resume guidance or deal breakers
        soft_skills = []
        guidance = ai_result.get("resume_guidance", {})
        
        # Look for soft skills in various places
        for item in deal_breakers + criticality.get("competitive_edges", []):
            if isinstance(item, dict) and "skill" in item:
                skill = item["skill"]
                if any(soft_term in skill.lower() for soft_term in ["leadership", "communication", "collaboration", "teamwork", "mentoring"]):
                    soft_skills.append(skill)

        return {
            "programming_languages": tech_skills.get("programming_languages", []),
            "frameworks_libraries_tools": tech_skills.get("frameworks_libraries", []) + tech_skills.get("tools_platforms", []),
            "databases": tech_skills.get("databases", []),
            "cloud_devops": tech_skills.get("cloud_devops", []),
            "ai_ml_data_tech": tech_skills.get("ai_ml", []),
            "methodologies_concepts": tech_skills.get("methodologies", []),
            "experience_requirements": list(set(experience_reqs))[:10],
            "certifications_education": [],  # Not captured in new schema
            "technical_skills": all_technical[:50],
            "soft_skills": soft_skills[:15],
            "critical_keywords": list(set(critical_keywords))[:15],
            "job_info": {
                "seniority": seniority,
                "department": "Engineering", 
                "key_focus": role_specialization,
                "job_title": role,
                "specialization": role_specialization
            },
            # Add strategic guidance as new fields for enhanced functionality
            "strategic_analysis": {
                "positioning": positioning,
                "criticality": criticality,
                "resume_guidance": guidance,
                "ats_optimization": ats_opt
            }
        }

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