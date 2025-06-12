"""
Professional Headline Generator
Generates dynamic professional headlines based on target role and experience
"""

import logging
from typing import Dict, List, Any, Optional, Tuple

logger = logging.getLogger(__name__)

class ProfessionalHeadlineGenerator:
    """Generate dynamic professional headlines for resumes"""
    
    def __init__(self):
        # Role-based headline templates
        self.headline_templates = {
            'software_engineer': [
                "Software Engineer specializing in {primary_tech}",
                "Full-Stack Software Engineer with {experience_years} years in {primary_tech}",
                "{experience_level} Software Engineer focused on {primary_domain}",
            ],
            'senior_software_engineer': [
                "Senior Software Engineer with expertise in {primary_tech}",
                "Senior Full-Stack Engineer specializing in {primary_domain}",
                "{experience_years}+ Year Senior Software Engineer - {primary_tech} & {secondary_tech}",
            ],
            'backend_engineer': [
                "Backend Engineer specializing in {primary_tech}",
                "Senior Backend Developer with {experience_years} years in {primary_tech}",
                "{experience_level} Backend Engineer focused on {primary_domain}",
            ],
            'frontend_engineer': [
                "Frontend Engineer specializing in {primary_tech}",
                "Senior Frontend Developer with expertise in {primary_tech}",
                "{experience_level} Frontend Engineer focused on {primary_domain}",
            ],
            'full_stack_engineer': [
                "Full-Stack Engineer with {primary_tech} & {secondary_tech} expertise",
                "Senior Full-Stack Developer specializing in {primary_domain}",
                "{experience_years}+ Year Full-Stack Engineer - {primary_tech} specialist",
            ],
            'default': [
                "Software Engineer with {experience_years} years of experience",
                "{experience_level} Engineer specializing in {primary_tech}",
                "Technology Professional focused on {primary_domain}",
            ]
        }
        
        # Technology groupings for primary tech identification
        self.tech_groups = {
            'javascript': ['JavaScript', 'JS', 'Node.js', 'React', 'TypeScript', 'TS'],
            'python': ['Python', 'Django', 'Flask', 'FastAPI'],
            'cloud': ['AWS', 'Azure', 'GCP', 'Kubernetes', 'Docker'],
            'data': ['SQL', 'MongoDB', 'PostgreSQL', 'Redis', 'DynamoDB'],
            'mobile': ['React Native', 'Swift', 'Kotlin', 'Flutter'],
            'devops': ['CI/CD', 'Jenkins', 'GitLab', 'Docker', 'Kubernetes']
        }
        
        # Domain mappings
        self.domain_mappings = {
            'payment': ['payment', 'fintech', 'ecommerce', 'financial'],
            'cloud': ['cloud', 'serverless', 'microservices', 'distributed'],
            'data': ['analytics', 'data', 'reporting', 'insights'],
            'mobile': ['mobile', 'app', 'ios', 'android'],
            'web': ['web', 'frontend', 'ui', 'ux']
        }
    
    def generate_professional_headline(
        self, 
        target_role: str, 
        job_keywords: List[str], 
        experience_years: int = 5
    ) -> str:
        """Generate a professional headline based on target role and keywords"""
        
        try:
            # Normalize target role
            role_key = self._normalize_role(target_role)
            
            # Extract primary technologies
            primary_tech, secondary_tech = self._extract_primary_technologies(job_keywords)
            
            # Determine primary domain
            primary_domain = self._determine_primary_domain(job_keywords)
            
            # Determine experience level
            experience_level = self._determine_experience_level(experience_years)
            
            # Get appropriate templates
            templates = self.headline_templates.get(role_key, self.headline_templates['default'])
            
            # Prepare template variables
            template_vars = {
                'primary_tech': primary_tech,
                'secondary_tech': secondary_tech,
                'primary_domain': primary_domain,
                'experience_years': experience_years,
                'experience_level': experience_level
            }
            
            # Select best template based on available variables
            best_template = self._select_best_template(templates, template_vars)
            
            # Generate headline
            headline = best_template.format(**template_vars)
            
            logger.info(f"Generated professional headline: {headline}")
            return headline
            
        except Exception as e:
            logger.error(f"Error generating professional headline: {e}")
            # Fallback to simple headline
            return f"Software Engineer with {experience_years} years of experience"
    
    def _normalize_role(self, target_role: str) -> str:
        """Normalize target role to a key"""
        
        role_lower = target_role.lower()
        
        if 'senior' in role_lower and 'software engineer' in role_lower:
            return 'senior_software_engineer'
        elif 'software engineer' in role_lower:
            return 'software_engineer'
        elif 'backend' in role_lower or 'back-end' in role_lower:
            return 'backend_engineer'
        elif 'frontend' in role_lower or 'front-end' in role_lower:
            return 'frontend_engineer'
        elif 'full stack' in role_lower or 'fullstack' in role_lower:
            return 'full_stack_engineer'
        else:
            return 'default'
    
    def _extract_primary_technologies(self, job_keywords: List[str]) -> Tuple[str, str]:
        """Extract primary and secondary technologies from keywords"""
        
        # Count technology occurrences by group
        tech_scores = {}
        
        for keyword in job_keywords:
            keyword_lower = keyword.lower()
            for tech_group, techs in self.tech_groups.items():
                for tech in techs:
                    if tech.lower() in keyword_lower or keyword_lower in tech.lower():
                        tech_scores[tech_group] = tech_scores.get(tech_group, 0) + 1
                        break
        
        # Sort by score
        sorted_techs = sorted(tech_scores.items(), key=lambda x: x[1], reverse=True)
        
        # Get primary tech names
        primary_tech = "Software Development"
        secondary_tech = "Cloud Technologies"
        
        if sorted_techs:
            primary_group = sorted_techs[0][0]
            primary_tech = self._get_representative_tech(primary_group, job_keywords)
            
            if len(sorted_techs) > 1:
                secondary_group = sorted_techs[1][0]
                secondary_tech = self._get_representative_tech(secondary_group, job_keywords)
        
        return primary_tech, secondary_tech
    
    def _get_representative_tech(self, tech_group: str, job_keywords: List[str]) -> str:
        """Get the most representative technology from a group"""
        
        group_techs = self.tech_groups.get(tech_group, [])
        
        # Find which specific tech from the group is mentioned in keywords
        for keyword in job_keywords:
            for tech in group_techs:
                if tech.lower() in keyword.lower() or keyword.lower() in tech.lower():
                    return tech
        
        # Fallback to group representative
        group_representatives = {
            'javascript': 'Node.js & React',
            'python': 'Python',
            'cloud': 'AWS',
            'data': 'Database Technologies',
            'mobile': 'Mobile Development',
            'devops': 'DevOps'
        }
        
        return group_representatives.get(tech_group, 'Technology')
    
    def _determine_primary_domain(self, job_keywords: List[str]) -> str:
        """Determine the primary domain from keywords"""
        
        domain_scores = {}
        
        for keyword in job_keywords:
            keyword_lower = keyword.lower()
            for domain, indicators in self.domain_mappings.items():
                for indicator in indicators:
                    if indicator in keyword_lower:
                        domain_scores[domain] = domain_scores.get(domain, 0) + 1
        
        if domain_scores:
            primary_domain_key = max(domain_scores, key=domain_scores.get)
            domain_names = {
                'payment': 'Payment Systems',
                'cloud': 'Cloud Architecture',
                'data': 'Data Engineering',
                'mobile': 'Mobile Development',
                'web': 'Web Development'
            }
            return domain_names.get(primary_domain_key, 'Software Development')
        
        return 'Scalable Applications'
    
    def _determine_experience_level(self, experience_years: int) -> str:
        """Determine experience level description"""
        
        if experience_years >= 7:
            return 'Senior'
        elif experience_years >= 4:
            return 'Experienced'
        elif experience_years >= 2:
            return 'Mid-Level'
        else:
            return 'Junior'
    
    def _select_best_template(self, templates: List[str], template_vars: Dict[str, Any]) -> str:
        """Select the best template based on available variables"""
        
        # Score templates based on variable availability and specificity
        template_scores = []
        
        for template in templates:
            score = 0
            
            # Check which variables are used in template
            if '{primary_tech}' in template and template_vars['primary_tech'] != 'Software Development':
                score += 3
            if '{secondary_tech}' in template and template_vars['secondary_tech'] != 'Cloud Technologies':
                score += 2
            if '{primary_domain}' in template and template_vars['primary_domain'] != 'Scalable Applications':
                score += 2
            if '{experience_years}' in template:
                score += 1
            if '{experience_level}' in template:
                score += 1
            
            template_scores.append((template, score))
        
        # Sort by score and return best template
        template_scores.sort(key=lambda x: x[1], reverse=True)
        return template_scores[0][0]