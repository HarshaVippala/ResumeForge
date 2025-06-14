"""
Strategic Context Models
Maintains rich job analysis context throughout resume tailoring pipeline
"""

from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime

class RequirementItem(BaseModel):
    """Individual requirement with context"""
    skill: str = Field(..., description="The specific skill or requirement")
    evidence: str = Field(..., description="Why this is considered critical/important")
    frequency: int = Field(default=1, description="How often mentioned in job posting")
    context: str = Field(default="", description="Where/how it appeared in job description")

class SkillsEmphasis(BaseModel):
    """Strategic guidance for skills presentation"""
    primary_focus: List[str] = Field(default_factory=list, description="Top skills to highlight prominently")
    secondary_mention: List[str] = Field(default_factory=list, description="Skills to include but not emphasize")
    omit_or_minimize: List[str] = Field(default_factory=list, description="Skills to avoid highlighting")

class ExperiencePositioning(BaseModel):
    """Guidance for experience section emphasis"""
    lead_with: str = Field(default="", description="Primary experience type to feature")
    highlight_projects: List[str] = Field(default_factory=list, description="Types of projects to emphasize")
    scale_indicators: List[str] = Field(default_factory=list, description="What scale/complexity to mention")
    avoid_emphasis: List[str] = Field(default_factory=list, description="Experience areas to de-emphasize")

class GapMitigation(BaseModel):
    """Strategy for addressing missing requirements"""
    missing_critical: List[str] = Field(default_factory=list, description="Skills clearly required but potentially missing")
    learning_priorities: List[str] = Field(default_factory=list, description="Skills to acquire for competitiveness")
    compensation_strategies: List[str] = Field(default_factory=list, description="How to address gaps with existing experience")

class ResumeGuidance(BaseModel):
    """Strategic guidance for resume content"""
    skills_emphasis: SkillsEmphasis = Field(default_factory=SkillsEmphasis)
    experience_positioning: ExperiencePositioning = Field(default_factory=ExperiencePositioning)
    gap_mitigation: GapMitigation = Field(default_factory=GapMitigation)

class StrategicPositioning(BaseModel):
    """High-level positioning strategy"""
    target_seniority: str = Field(default="Mid-level", description="Junior/Mid/Senior based on requirements")
    role_specialization: str = Field(default="Software Development", description="Frontend/Backend/Full-stack/DevOps/etc")
    industry_focus: str = Field(default="", description="Domain expertise required")
    experience_level: str = Field(default="", description="X+ years experience")
    scale_context: str = Field(default="", description="Startup/Enterprise/etc")

class RequirementCriticality(BaseModel):
    """Categorized requirements by importance"""
    deal_breakers: List[RequirementItem] = Field(default_factory=list, description="Must-have requirements")
    competitive_edges: List[RequirementItem] = Field(default_factory=list, description="Differentiating skills")
    nice_to_haves: List[RequirementItem] = Field(default_factory=list, description="Bonus qualifications")

class TechnicalSkills(BaseModel):
    """Categorized technical skills from job analysis"""
    programming_languages: List[str] = Field(default_factory=list)
    frameworks_libraries: List[str] = Field(default_factory=list)
    databases: List[str] = Field(default_factory=list)
    cloud_devops: List[str] = Field(default_factory=list)
    ai_ml: List[str] = Field(default_factory=list)
    tools_platforms: List[str] = Field(default_factory=list)
    methodologies: List[str] = Field(default_factory=list)

class ATSOptimization(BaseModel):
    """ATS-specific optimization guidance"""
    critical_keywords: List[Dict[str, Any]] = Field(default_factory=list, description="Keywords with variations and weights")
    exact_matches_required: List[str] = Field(default_factory=list, description="Terms that must be precise")
    keyword_density_targets: Dict[str, int] = Field(default_factory=dict, description="Skill frequency targets")

class JobInfo(BaseModel):
    """Basic job information"""
    job_title: str = Field(default="", description="Target job title")
    company: str = Field(default="", description="Target company name")
    seniority: str = Field(default="Mid-level", description="Position seniority level")
    department: str = Field(default="Engineering", description="Department/team")
    key_focus: str = Field(default="Software Development", description="Primary focus area")

class StrategicContext(BaseModel):
    """
    Rich context object that preserves strategic intelligence throughout
    the resume tailoring pipeline
    """
    
    # Schema versioning for backward compatibility
    schema_version: str = Field(default="1.0", description="Context schema version")
    
    # Timestamp for context freshness
    created_at: datetime = Field(default_factory=datetime.utcnow, description="When context was created")
    
    # Core strategic analysis
    strategic_positioning: StrategicPositioning = Field(default_factory=StrategicPositioning)
    requirement_criticality: RequirementCriticality = Field(default_factory=RequirementCriticality)
    technical_skills: TechnicalSkills = Field(default_factory=TechnicalSkills)
    ats_optimization: ATSOptimization = Field(default_factory=ATSOptimization)
    resume_guidance: ResumeGuidance = Field(default_factory=ResumeGuidance)
    
    # Job context
    job_info: JobInfo = Field(default_factory=JobInfo)
    
    # Raw job description for reference
    job_description: str = Field(default="", description="Original job description text")
    
    # Legacy compatibility fields (will be deprecated)
    legacy_keywords: List[str] = Field(default_factory=list, description="Flat keyword list for backward compatibility")
    
    def get_all_critical_keywords(self) -> List[str]:
        """Extract all critical keywords for legacy compatibility"""
        keywords = []
        
        # From deal breakers
        for item in self.requirement_criticality.deal_breakers:
            keywords.append(item.skill)
        
        # From ATS critical keywords
        for kw_item in self.ats_optimization.critical_keywords:
            if isinstance(kw_item, dict) and "term" in kw_item:
                keywords.append(kw_item["term"])
        
        # From technical skills
        for category in [
            self.technical_skills.programming_languages,
            self.technical_skills.frameworks_libraries,
            self.technical_skills.databases,
            self.technical_skills.cloud_devops
        ]:
            keywords.extend(category)
        
        return list(set(keywords))  # Remove duplicates
    
    def get_priority_skills_for_section(self, section_type: str) -> List[str]:
        """Get prioritized skills for specific resume section"""
        if section_type == "summary":
            return self.resume_guidance.skills_emphasis.primary_focus[:5]
        elif section_type == "skills":
            return self.resume_guidance.skills_emphasis.primary_focus
        elif section_type == "experience":
            # Return skills that should be emphasized in experience bullets
            return self.resume_guidance.skills_emphasis.primary_focus[:8]
        
        return []
    
    def get_experience_guidance(self) -> Dict[str, Any]:
        """Get structured guidance for experience section"""
        return {
            "lead_with": self.resume_guidance.experience_positioning.lead_with,
            "highlight_projects": self.resume_guidance.experience_positioning.highlight_projects,
            "scale_indicators": self.resume_guidance.experience_positioning.scale_indicators,
            "critical_skills": [item.skill for item in self.requirement_criticality.deal_breakers],
            "competitive_skills": [item.skill for item in self.requirement_criticality.competitive_edges]
        }
    
    def get_human_voice_context(self) -> Dict[str, Any]:
        """Get context optimized for human-natural content generation"""
        return {
            "authentic_tone": True,
            "avoid_buzzwords": True,
            "conversational_style": True,
            "specific_metrics": True,
            "first_person_ok": True,
            "company_context": self.job_info.company,
            "role_context": self.job_info.job_title,
            "seniority_level": self.strategic_positioning.target_seniority,
            "industry_focus": self.strategic_positioning.industry_focus
        }
    
    class Config:
        """Pydantic configuration"""
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
        
        # Allow for schema evolution
        extra = "allow"