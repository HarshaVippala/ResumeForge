"""
Smart Skills Merger
Intelligently merges job-relevant keywords with existing resume skills
"""

import logging
from typing import Dict, List, Any, Optional, Set

logger = logging.getLogger(__name__)

class SkillsMerger:
    """Merge job keywords with existing resume skills intelligently"""
    
    def __init__(self):
        # Character limits for skills sections
        self.char_limit_per_line = 75
        
        # Skill category mappings for intelligent grouping
        self.category_keywords = {
            'languages': {
                'aliases': ['programming_languages', 'languages', 'language'],
                'patterns': ['js', 'javascript', 'typescript', 'python', 'java', 'go', 'rust', 'c++', 'c#', 'php', 'ruby']
            },
            'frameworks': {
                'aliases': ['frameworks_libraries_tools', 'frameworks', 'libraries', 'tools'],
                'patterns': ['react', 'angular', 'vue', 'node', 'express', 'nest', 'next', 'django', 'flask', 'spring']
            },
            'cloud': {
                'aliases': ['cloud_devops_tools', 'cloud', 'devops', 'infrastructure'],
                'patterns': ['aws', 'azure', 'gcp', 'docker', 'kubernetes', 'terraform', 'lambda', 'ec2', 's3']
            },
            'databases': {
                'aliases': ['databases', 'database', 'storage'],
                'patterns': ['mongodb', 'mysql', 'postgresql', 'redis', 'dynamodb', 'elasticsearch', 'kafka']
            },
            'testing': {
                'aliases': ['testing', 'quality', 'testing_tools'],
                'patterns': ['jest', 'cypress', 'junit', 'pytest', 'selenium', 'mocha', 'chai', 'testing']
            },
            'monitoring': {
                'aliases': ['monitoring', 'observability', 'monitoring_tools'],
                'patterns': ['datadog', 'new relic', 'cloudwatch', 'grafana', 'elk', 'prometheus', 'splunk']
            }
        }
    
    def merge_skills_with_job_keywords(
        self, 
        base_skills: Dict[str, Any], 
        job_keywords: List[str],
        target_sections: Optional[List[str]] = None
    ) -> Dict[str, str]:
        """
        Merge job keywords with existing skills while preserving all original skills
        
        Args:
            base_skills: Original resume skills from base_resume_profile.json
            job_keywords: Keywords extracted from job description
            target_sections: Specific sections to focus on (optional)
            
        Returns:
            Dictionary with optimized skills sections
        """
        
        logger.info(f"Merging {len(job_keywords)} job keywords with existing skills")
        
        # Categorize job keywords
        categorized_keywords = self._categorize_job_keywords(job_keywords)
        
        # Create enhanced skills sections
        enhanced_sections = {}
        
        # Process each category
        for section_name, section_data in self._get_target_sections(base_skills, target_sections).items():
            enhanced_section = self._merge_section_skills(
                section_name=section_name,
                existing_skills=section_data,
                relevant_keywords=categorized_keywords.get(section_name, []),
                all_keywords=job_keywords
            )
            enhanced_sections[section_name] = enhanced_section
        
        return enhanced_sections
    
    def _categorize_job_keywords(self, job_keywords: List[str]) -> Dict[str, List[str]]:
        """Categorize job keywords into skill sections"""
        
        categorized = {category: [] for category in self.category_keywords.keys()}
        uncategorized = []
        
        for keyword in job_keywords:
            keyword_lower = keyword.lower()
            placed = False
            
            # Try to match to a category
            for category, config in self.category_keywords.items():
                # Check patterns
                if any(pattern in keyword_lower for pattern in config['patterns']):
                    categorized[category].append(keyword)
                    placed = True
                    break
            
            if not placed:
                uncategorized.append(keyword)
        
        # Try to place uncategorized keywords using broader matching
        for keyword in uncategorized:
            if any(tech in keyword.lower() for tech in ['api', 'service', 'framework']):
                categorized['frameworks'].append(keyword)
            elif any(infra in keyword.lower() for infra in ['deployment', 'ci/cd', 'devops']):
                categorized['cloud'].append(keyword)
            else:
                # Default to frameworks for general tech keywords
                categorized['frameworks'].append(keyword)
        
        # Remove empty categories
        return {k: v for k, v in categorized.items() if v}
    
    def _get_target_sections(self, base_skills: Dict[str, Any], target_sections: Optional[List[str]]) -> Dict[str, List[str]]:
        """Get sections to process with proper mapping"""
        
        # Create section mapping
        section_mapping = {
            'Languages & Frameworks': base_skills.get('programming_languages', []) + base_skills.get('frameworks_libraries_tools', [])[:8],
            'Cloud & DevOps': base_skills.get('cloud_devops_tools', []),
            'APIs & Integration': [skill for skill in base_skills.get('frameworks_libraries_tools', []) if any(api_term in skill.lower() for api_term in ['api', 'graphql', 'grpc', 'swagger', 'oauth'])],
            'Architecture & Design': base_skills.get('architecture_design_concepts', []),
            'Databases & Storage': base_skills.get('databases', []),
            'Monitoring & Observability': [skill for skill in base_skills.get('frameworks_libraries_tools', []) if any(monitor_term in skill.lower() for monitor_term in ['new relic', 'datadog', 'cloudwatch', 'elk', 'grafana', 'telemetry'])],
            'Testing & CI/CD': [skill for skill in base_skills.get('frameworks_libraries_tools', []) if any(test_term in skill.lower() for test_term in ['jest', 'cypress', 'jenkins', 'github actions', 'gitlab'])],
        }
        
        if target_sections:
            return {section: skills for section, skills in section_mapping.items() if section in target_sections}
        
        return section_mapping
    
    def _merge_section_skills(
        self, 
        section_name: str, 
        existing_skills: List[str], 
        relevant_keywords: List[str], 
        all_keywords: List[str]
    ) -> str:
        """Merge skills for a specific section"""
        
        # Start with existing skills
        all_skills = existing_skills.copy()
        
        # Add relevant job keywords that aren't already present
        for keyword in relevant_keywords:
            if not self._skill_already_present(keyword, all_skills):
                all_skills.append(keyword)
        
        # Prioritize job-relevant skills first
        prioritized_skills = self._prioritize_skills(all_skills, relevant_keywords + all_keywords)
        
        # Optimize for character limit
        optimized_skills = self._optimize_for_character_limit(prioritized_skills, section_name)
        
        return optimized_skills
    
    def _skill_already_present(self, keyword: str, existing_skills: List[str]) -> bool:
        """Check if a keyword is already present in existing skills"""
        
        keyword_lower = keyword.lower()
        
        for skill in existing_skills:
            skill_lower = skill.lower()
            
            # Exact match
            if keyword_lower == skill_lower:
                return True
            
            # Substring match (for variations like "JS" vs "JavaScript")
            if keyword_lower in skill_lower or skill_lower in keyword_lower:
                # But avoid false positives like "S3" in "HTTPS"
                if len(keyword_lower) >= 3 and len(skill_lower) >= 3:
                    return True
        
        return False
    
    def _prioritize_skills(self, skills: List[str], job_keywords: List[str]) -> List[str]:
        """Prioritize skills based on job relevance"""
        
        job_keywords_lower = [k.lower() for k in job_keywords]
        
        # Separate into job-relevant and other skills
        job_relevant = []
        other_skills = []
        
        for skill in skills:
            if any(keyword in skill.lower() or skill.lower() in keyword for keyword in job_keywords_lower):
                job_relevant.append(skill)
            else:
                other_skills.append(skill)
        
        # Return job-relevant first, then others
        return job_relevant + other_skills
    
    def _optimize_for_character_limit(self, skills: List[str], section_name: str) -> str:
        """Optimize skills list to fit character limit"""
        
        if not skills:
            return ""
        
        # Apply abbreviations to save space
        abbreviated_skills = [self._apply_abbreviations(skill) for skill in skills]
        
        # Build skills string within character limit
        skills_parts = []
        current_length = 0
        
        for skill in abbreviated_skills:
            # Calculate length if we add this skill
            separator = ", " if skills_parts else ""
            needed_length = len(separator + skill)
            
            if current_length + needed_length <= self.char_limit_per_line:
                skills_parts.append(skill)
                current_length += needed_length
            else:
                # Stop adding if we've reached the limit
                break
        
        result = ", ".join(skills_parts)
        
        logger.debug(f"Optimized {section_name}: {len(result)} chars - {result}")
        
        return result
    
    def _apply_abbreviations(self, skill: str) -> str:
        """Apply common abbreviations to save space"""
        
        abbreviations = {
            'JavaScript': 'JS',
            'TypeScript': 'TS',
            'PostgreSQL': 'PostgreSQL',  # Keep full name for clarity
            'Kubernetes': 'K8s',
            'New Relic': 'New Relic',  # Keep full name
            'GitHub Actions': 'GitHub Actions',  # Keep full name
            'GitLab CI/CD': 'GitLab CI/CD',  # Keep full name
            'Open Telemetry': 'OpenTelemetry',
        }
        
        return abbreviations.get(skill, skill)
    
    def get_skills_coverage_report(
        self, 
        base_skills: Dict[str, Any], 
        job_keywords: List[str], 
        enhanced_sections: Dict[str, str]
    ) -> Dict[str, Any]:
        """Generate a report showing skills coverage"""
        
        # Count original skills
        total_original_skills = sum(len(skills) for skills in base_skills.values() if isinstance(skills, list))
        
        # Count skills in enhanced sections
        enhanced_skills_count = 0
        for section_content in enhanced_sections.values():
            enhanced_skills_count += len([s.strip() for s in section_content.split(',') if s.strip()])
        
        # Count job keywords included
        job_keywords_included = 0
        all_enhanced_text = " ".join(enhanced_sections.values()).lower()
        for keyword in job_keywords:
            if keyword.lower() in all_enhanced_text:
                job_keywords_included += 1
        
        return {
            'original_skills_count': total_original_skills,
            'enhanced_skills_count': enhanced_skills_count,
            'job_keywords_total': len(job_keywords),
            'job_keywords_included': job_keywords_included,
            'keyword_coverage_percentage': (job_keywords_included / len(job_keywords) * 100) if job_keywords else 0,
            'skills_preservation_percentage': (enhanced_skills_count / total_original_skills * 100) if total_original_skills else 0
        }