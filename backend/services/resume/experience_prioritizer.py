"""
Experience Prioritizer Service
Intelligently selects and scores resume experiences based on job context
"""

import logging
import re
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime
from .strategic_context import StrategicContext

logger = logging.getLogger(__name__)

class PrioritizedExperience(Dict):
    """Enhanced experience object with prioritization data"""
    def __init__(self, experience_data: Dict[str, Any], relevance_score: float, 
                 justification: str, selected_bullets: List[str], **kwargs):
        super().__init__(experience_data)
        self.relevance_score = relevance_score
        self.justification = justification
        self.selected_bullets = selected_bullets
        self.enhancement_suggestions = kwargs.get('enhancement_suggestions', [])

class ExperiencePrioritizer:
    """Prioritize and select resume experiences based on strategic context"""
    
    def __init__(self):
        # Recency decay factor (lower = more emphasis on recent experience)
        self.recency_decay = 0.15
        
        # Maximum experiences to include
        self.max_experiences = 3
        
        # Experience bullet limits by position priority
        self.bullet_limits = {
            0: 5,  # Most recent/relevant position
            1: 4,  # Second position  
            2: 3   # Third position
        }
    
    def prioritize_experiences(
        self, 
        base_experiences: List[Dict[str, Any]], 
        strategic_context: StrategicContext
    ) -> List[PrioritizedExperience]:
        """
        Prioritize experiences based on job relevance and strategic context
        
        Args:
            base_experiences: Raw experience data from resume parser
            strategic_context: Rich context from job analysis
            
        Returns:
            List of prioritized experiences with enhanced data
        """
        logger.info(f"Prioritizing {len(base_experiences)} experiences for {strategic_context.job_info.job_title}")
        
        scored_experiences = []
        
        for exp in base_experiences:
            score = self._calculate_relevance_score(exp, strategic_context)
            justification = self._generate_justification(exp, strategic_context, score)
            selected_bullets = self._select_best_bullets(exp, strategic_context)
            
            prioritized_exp = PrioritizedExperience(
                experience_data=exp,
                relevance_score=score,
                justification=justification,
                selected_bullets=selected_bullets
            )
            
            scored_experiences.append(prioritized_exp)
        
        # Sort by relevance score (highest first)
        scored_experiences.sort(key=lambda x: x.relevance_score, reverse=True)
        
        # Return top experiences
        return scored_experiences[:self.max_experiences]
    
    def _calculate_relevance_score(
        self, 
        experience: Dict[str, Any], 
        context: StrategicContext
    ) -> float:
        """Calculate relevance score for an experience"""
        
        # Get critical skills and keywords
        critical_skills = [item.skill.lower() for item in context.requirement_criticality.deal_breakers]
        competitive_skills = [item.skill.lower() for item in context.requirement_criticality.competitive_edges]
        all_tech_skills = self._get_all_tech_skills(context)
        
        # Calculate keyword matching score
        keyword_score = self._calculate_keyword_match_score(
            experience, critical_skills, competitive_skills, all_tech_skills
        )
        
        # Calculate recency score
        recency_score = self._calculate_recency_score(experience)
        
        # Calculate role alignment score
        role_alignment_score = self._calculate_role_alignment_score(experience, context)
        
        # Calculate technology overlap score
        tech_overlap_score = self._calculate_tech_overlap_score(experience, context)
        
        # Weighted final score
        final_score = (
            keyword_score * 0.35 +      # Most important: keyword relevance
            role_alignment_score * 0.25 + # Role/responsibility alignment
            tech_overlap_score * 0.25 +   # Technology stack relevance
            recency_score * 0.15           # Recency (less weight)
        )
        
        logger.debug(f"Experience scoring for {experience.get('company_name', 'Unknown')}: "
                    f"keyword={keyword_score:.2f}, role={role_alignment_score:.2f}, "
                    f"tech={tech_overlap_score:.2f}, recency={recency_score:.2f}, "
                    f"final={final_score:.2f}")
        
        return final_score
    
    def _calculate_keyword_match_score(
        self,
        experience: Dict[str, Any],
        critical_skills: List[str],
        competitive_skills: List[str], 
        all_tech_skills: List[str]
    ) -> float:
        """Calculate how well experience matches job keywords"""
        
        # Get all text from experience
        experience_text = self._get_experience_text(experience).lower()
        
        # Count matches
        critical_matches = sum(1 for skill in critical_skills if skill in experience_text)
        competitive_matches = sum(1 for skill in competitive_skills if skill in experience_text)
        tech_matches = sum(1 for skill in all_tech_skills if skill in experience_text)
        
        # Calculate weighted score
        total_critical = len(critical_skills) or 1
        total_competitive = len(competitive_skills) or 1
        total_tech = len(all_tech_skills) or 1
        
        critical_ratio = critical_matches / total_critical
        competitive_ratio = competitive_matches / total_competitive  
        tech_ratio = tech_matches / total_tech
        
        # Weight critical skills most heavily
        keyword_score = (
            critical_ratio * 0.5 +
            competitive_ratio * 0.3 +
            tech_ratio * 0.2
        )
        
        return min(keyword_score, 1.0)  # Cap at 1.0
    
    def _calculate_recency_score(self, experience: Dict[str, Any]) -> float:
        """Calculate recency score with exponential decay"""
        
        dates = experience.get('dates', '')
        
        # Try to extract end year
        years = re.findall(r'\b(20\d{2})\b', dates)
        if not years:
            return 0.5  # Default for unparseable dates
        
        # Use the latest year (end year or start year if current)
        latest_year = max(int(year) for year in years)
        current_year = datetime.now().year
        
        # Handle "Present" jobs
        if 'present' in dates.lower() or latest_year == current_year:
            years_ago = 0
        else:
            years_ago = current_year - latest_year
        
        # Exponential decay
        recency_score = 1.0 * (1 - self.recency_decay) ** years_ago
        
        return max(recency_score, 0.1)  # Minimum score
    
    def _calculate_role_alignment_score(
        self, 
        experience: Dict[str, Any], 
        context: StrategicContext
    ) -> float:
        """Calculate how well the role aligns with target position"""
        
        current_title = experience.get('job_title', '').lower()
        target_title = context.job_info.job_title.lower()
        target_specialization = context.strategic_positioning.role_specialization.lower()
        
        # Direct title matching
        title_words = set(re.findall(r'\b\w+\b', current_title))
        target_words = set(re.findall(r'\b\w+\b', target_title))
        
        title_overlap = len(title_words.intersection(target_words))
        title_total = len(target_words) or 1
        title_score = title_overlap / title_total
        
        # Specialization alignment
        specialization_score = 0
        if target_specialization in current_title:
            specialization_score = 0.8
        elif any(spec in current_title for spec in ['engineer', 'developer', 'architect']):
            specialization_score = 0.5
        
        # Seniority alignment
        target_seniority = context.strategic_positioning.target_seniority.lower()
        seniority_score = 0
        
        if 'senior' in target_seniority and 'senior' in current_title:
            seniority_score = 0.8
        elif 'senior' not in target_seniority and 'senior' not in current_title:
            seniority_score = 0.6
        elif 'lead' in current_title or 'principal' in current_title:
            seniority_score = 0.7
        
        # Combined role alignment score
        role_score = (title_score * 0.4 + specialization_score * 0.4 + seniority_score * 0.2)
        
        return min(role_score, 1.0)
    
    def _calculate_tech_overlap_score(
        self, 
        experience: Dict[str, Any], 
        context: StrategicContext
    ) -> float:
        """Calculate technology stack overlap"""
        
        experience_tech = set(tech.lower() for tech in experience.get('technologies_used_in_role', []))
        
        # Get job technology requirements
        job_tech = set()
        job_tech.update(skill.lower() for skill in context.technical_skills.programming_languages)
        job_tech.update(skill.lower() for skill in context.technical_skills.frameworks_libraries)
        job_tech.update(skill.lower() for skill in context.technical_skills.databases)
        job_tech.update(skill.lower() for skill in context.technical_skills.cloud_devops)
        
        if not job_tech:
            return 0.5  # No tech requirements specified
        
        # Calculate overlap
        overlap = len(experience_tech.intersection(job_tech))
        total_job_tech = len(job_tech)
        
        tech_score = overlap / total_job_tech
        
        return min(tech_score, 1.0)
    
    def _select_best_bullets(
        self, 
        experience: Dict[str, Any], 
        context: StrategicContext
    ) -> List[str]:
        """Select the most relevant bullet points for this experience"""
        
        bullets = experience.get('experience_highlights', [])
        if not bullets:
            return []
        
        # Score each bullet
        bullet_scores = []
        for bullet in bullets:
            score = self._score_bullet_relevance(bullet, context)
            bullet_scores.append((bullet, score))
        
        # Sort by relevance
        bullet_scores.sort(key=lambda x: x[1], reverse=True)
        
        # Return top bullets (limit based on position priority will be applied later)
        return [bullet for bullet, _ in bullet_scores[:6]]  # Max 6, will be filtered later
    
    def _score_bullet_relevance(self, bullet: str, context: StrategicContext) -> float:
        """Score individual bullet point relevance"""
        
        bullet_lower = bullet.lower()
        
        # Critical keyword matches (weighted highly)
        critical_matches = sum(
            1 for item in context.requirement_criticality.deal_breakers
            if item.skill.lower() in bullet_lower
        )
        
        # Competitive edge matches
        competitive_matches = sum(
            1 for item in context.requirement_criticality.competitive_edges  
            if item.skill.lower() in bullet_lower
        )
        
        # Look for quantified achievements (metrics are valuable)
        has_metrics = bool(re.search(r'\d+[%$kmb]|\d+\+|\d+x|reduced|increased|improved', bullet_lower))
        
        # Look for action-oriented language (not passive)
        strong_verbs = ['built', 'led', 'created', 'designed', 'optimized', 'implemented', 'delivered']
        has_strong_action = any(verb in bullet_lower for verb in strong_verbs)
        
        # Calculate relevance score
        relevance_score = (
            critical_matches * 0.4 +
            competitive_matches * 0.3 +
            (0.2 if has_metrics else 0) +
            (0.1 if has_strong_action else 0)
        )
        
        return relevance_score
    
    def _generate_justification(
        self, 
        experience: Dict[str, Any], 
        context: StrategicContext, 
        score: float
    ) -> str:
        """Generate human-readable justification for prioritization"""
        
        company = experience.get('company_name', 'Unknown Company')
        title = experience.get('job_title', 'Unknown Role')
        
        if score >= 0.7:
            return f"High relevance: {title} at {company} closely matches target role requirements"
        elif score >= 0.4:
            return f"Moderate relevance: {title} at {company} has transferable skills and experience"
        else:
            return f"Lower relevance: {title} at {company} provides supporting background experience"
    
    def _get_experience_text(self, experience: Dict[str, Any]) -> str:
        """Get all searchable text from experience"""
        
        text_parts = [
            experience.get('job_title', ''),
            experience.get('company_name', ''),
            ' '.join(experience.get('experience_highlights', [])),
            ' '.join(experience.get('technologies_used_in_role', []))
        ]
        
        return ' '.join(text_parts)
    
    def _get_all_tech_skills(self, context: StrategicContext) -> List[str]:
        """Get all technical skills from context as lowercase list"""
        
        all_skills = []
        all_skills.extend(context.technical_skills.programming_languages)
        all_skills.extend(context.technical_skills.frameworks_libraries)
        all_skills.extend(context.technical_skills.databases)
        all_skills.extend(context.technical_skills.cloud_devops)
        all_skills.extend(context.technical_skills.tools_platforms)
        
        return [skill.lower() for skill in all_skills]
    
    def apply_bullet_limits(self, prioritized_experiences: List[PrioritizedExperience]) -> List[PrioritizedExperience]:
        """Apply bullet point limits based on experience priority"""
        
        for i, exp in enumerate(prioritized_experiences):
            limit = self.bullet_limits.get(i, 2)  # Default to 2 bullets for lower priority
            exp.selected_bullets = exp.selected_bullets[:limit]
        
        return prioritized_experiences