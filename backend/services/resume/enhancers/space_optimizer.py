"""
Space Optimization Utilities
Handles character constraints and line optimization for 1-page resume format
"""

import logging
import math
from typing import Dict, List, Any, Optional, Tuple

logger = logging.getLogger(__name__)

class SpaceOptimizer:
    """Optimize content for space constraints and line efficiency"""
    
    def __init__(self):
        # Character limits for different sections based on resume format analysis
        # Updated for more aggressive 1-page optimization
        self.char_limits = {
            'summary_min': 200,
            'summary_max': 280,  # Reduced from 360 for 1-page constraint
            'summary_line': 120,
            'skills_line': 65,  # Reduced from 75, compromise for 1-page constraint
            'bullet_single': 130,
            'bullet_double': 220,  # Reduced from 260 for 1-page constraint
            'bullet_efficiency': 0.8  # Reduced from 0.9 for more flexibility
        }
    
    def optimize_content_length(self, content: str, content_type: str, target_lines: int = None) -> Dict[str, Any]:
        """Optimize content for space constraints"""
        
        char_count = len(content)
        line_count = self.calculate_line_count(content, content_type)
        
        optimization_result = {
            'original': content,
            'optimized': content,
            'char_count': char_count,
            'line_count': line_count,
            'meets_constraints': False,
            'optimization_applied': []
        }
        
        # Apply optimization based on content type
        if content_type == 'summary':
            optimization_result = self._optimize_summary(content, optimization_result)
        elif content_type == 'experience_bullet':
            optimization_result = self._optimize_bullet(content, optimization_result)
        elif content_type == 'skills':
            optimization_result = self._optimize_skills(content, optimization_result)
        
        return optimization_result
    
    def calculate_line_count(self, text: str, content_type: str) -> int:
        """Calculate number of lines text will take"""
        
        if content_type == 'summary':
            chars_per_line = self.char_limits['summary_line']
        elif content_type == 'skills':
            chars_per_line = self.char_limits['skills_line']
        else:
            chars_per_line = self.char_limits['bullet_single']
        
        return max(1, math.ceil(len(text) / chars_per_line))
    
    def calculate_line_efficiency(self, text: str, content_type: str = 'bullet') -> float:
        """Calculate how efficiently text uses the second line"""
        
        chars_per_line = self.char_limits['bullet_single']
        if len(text) <= chars_per_line:
            return 1.0  # Single line, perfect efficiency
        
        # Calculate second line usage
        second_line_chars = len(text) - chars_per_line
        return second_line_chars / chars_per_line
    
    def check_format_constraints(self, content: str, content_type: str) -> Dict[str, Any]:
        """Check if content meets format constraints"""
        
        char_count = len(content)
        line_count = self.calculate_line_count(content, content_type)
        
        constraints = {
            'char_count_valid': False,
            'line_count_valid': False,
            'line_efficiency_valid': True,  # Default true, only check for 2-line bullets
            'overall_valid': False,
            'issues': []
        }
        
        if content_type == 'summary':
            constraints['char_count_valid'] = self.char_limits['summary_min'] <= char_count <= self.char_limits['summary_max']
            constraints['line_count_valid'] = 2 <= line_count <= 3
            
            if not constraints['char_count_valid']:
                constraints['issues'].append(f"Summary must be {self.char_limits['summary_min']}-{self.char_limits['summary_max']} characters")
            if not constraints['line_count_valid']:
                constraints['issues'].append("Summary must be 2-3 lines")
        
        elif content_type == 'experience_bullet':
            constraints['char_count_valid'] = char_count <= self.char_limits['bullet_double']
            constraints['line_count_valid'] = line_count <= 2
            
            # Check line efficiency for 2-line bullets
            if line_count == 2:
                efficiency = self.calculate_line_efficiency(content)
                constraints['line_efficiency_valid'] = efficiency >= self.char_limits['bullet_efficiency']
                if not constraints['line_efficiency_valid']:
                    constraints['issues'].append(f"Two-line bullets must use {self.char_limits['bullet_efficiency']*100:.0f}%+ of second line")
            
            if not constraints['char_count_valid']:
                constraints['issues'].append(f"Bullet must be ≤{self.char_limits['bullet_double']} characters")
            if not constraints['line_count_valid']:
                constraints['issues'].append("Bullet must be 1-2 lines")
        
        elif content_type == 'skills':
            constraints['char_count_valid'] = char_count <= self.char_limits['skills_line']
            constraints['line_count_valid'] = line_count == 1
            
            if not constraints['char_count_valid']:
                constraints['issues'].append(f"Skills section must be ≤{self.char_limits['skills_line']} characters")
            if not constraints['line_count_valid']:
                constraints['issues'].append("Skills section must be exactly 1 line")
        
        constraints['overall_valid'] = (
            constraints['char_count_valid'] and 
            constraints['line_count_valid'] and 
            constraints['line_efficiency_valid']
        )
        
        return constraints
    
    def _optimize_summary(self, content: str, result: Dict[str, Any]) -> Dict[str, Any]:
        """Optimize summary for 2-3 line constraint"""
        
        char_count = len(content)
        
        # If too long, apply compression techniques
        if char_count > self.char_limits['summary_max']:
            optimized = self._apply_compression_techniques(content, self.char_limits['summary_max'])
            result['optimized'] = optimized
            result['char_count'] = len(optimized)
            result['line_count'] = self.calculate_line_count(optimized, 'summary')
            result['optimization_applied'].append('Content compression')
        
        # If too short, suggest expansion
        elif char_count < self.char_limits['summary_min']:
            result['optimization_applied'].append('Needs expansion')
        
        # Check final constraints
        constraints = self.check_format_constraints(result['optimized'], 'summary')
        result['meets_constraints'] = constraints['overall_valid']
        result['issues'] = constraints.get('issues', [])
        
        return result
    
    def _optimize_bullet(self, content: str, result: Dict[str, Any]) -> Dict[str, Any]:
        """Optimize bullet for line efficiency"""
        
        char_count = len(content)
        line_count = self.calculate_line_count(content, 'experience_bullet')
        
        # If exactly 2 lines, check efficiency
        if line_count == 2:
            efficiency = self.calculate_line_efficiency(content)
            if efficiency < self.char_limits['bullet_efficiency']:
                # Try to optimize to either 1 line or better 2-line efficiency
                single_line_target = self.char_limits['bullet_single']
                
                if char_count <= single_line_target * 1.1:  # Close to single line
                    optimized = self._apply_compression_techniques(content, single_line_target)
                    result['optimization_applied'].append('Compressed to single line')
                else:
                    # Expand to better fill second line
                    optimized = self._expand_for_efficiency(content)
                    result['optimization_applied'].append('Expanded for line efficiency')
                
                result['optimized'] = optimized
                result['char_count'] = len(optimized)
                result['line_count'] = self.calculate_line_count(optimized, 'experience_bullet')
        
        # If too long, compress
        elif char_count > self.char_limits['bullet_double']:
            optimized = self._apply_compression_techniques(content, self.char_limits['bullet_double'])
            result['optimized'] = optimized
            result['char_count'] = len(optimized)
            result['line_count'] = self.calculate_line_count(optimized, 'experience_bullet')
            result['optimization_applied'].append('Content compression')
        
        # Check final constraints
        constraints = self.check_format_constraints(result['optimized'], 'experience_bullet')
        result['meets_constraints'] = constraints['overall_valid']
        result['issues'] = constraints.get('issues', [])
        
        return result
    
    def _optimize_skills(self, content: str, result: Dict[str, Any]) -> Dict[str, Any]:
        """Optimize skills for single line constraint"""
        
        char_count = len(content)
        
        if char_count > self.char_limits['skills_line']:
            optimized = self._optimize_skills_length(content)
            result['optimized'] = optimized
            result['char_count'] = len(optimized)
            result['line_count'] = self.calculate_line_count(optimized, 'skills')
            result['optimization_applied'].append('Skills compression and abbreviation')
        
        # Check final constraints
        constraints = self.check_format_constraints(result['optimized'], 'skills')
        result['meets_constraints'] = constraints['overall_valid']
        result['issues'] = constraints.get('issues', [])
        
        return result
    
    def _apply_compression_techniques(self, content: str, target_length: int) -> str:
        """Apply various compression techniques to fit target length"""
        
        if len(content) <= target_length:
            return content
        
        compressed = content
        
        # 1. Common abbreviations
        abbreviations = {
            'JavaScript': 'JS',
            'TypeScript': 'TS',
            'Kubernetes': 'K8s',
            'application': 'app',
            'applications': 'apps',
            'development': 'dev',
            'implementation': 'impl',
            'optimization': 'opt',
            'performance': 'perf',
            'experience': 'exp',
            'architecture': 'arch',
            'microservices': 'microservices',  # Keep as is
            'and': '&'
        }
        
        for full, abbrev in abbreviations.items():
            if len(compressed) > target_length:
                compressed = compressed.replace(full, abbrev)
        
        # 2. Remove redundant words
        redundant_patterns = [
            (' and ', ' & '),
            (' the ', ' '),
            (' for ', ' '),
            (' with ', ' w/ '),
            (', ', ','),
            ('  ', ' ')  # Double spaces
        ]
        
        for old, new in redundant_patterns:
            if len(compressed) > target_length:
                compressed = compressed.replace(old, new)
        
        # 3. Trim from end if still too long
        if len(compressed) > target_length:
            compressed = compressed[:target_length].rsplit(' ', 1)[0]
        
        return compressed.strip()
    
    def _expand_for_efficiency(self, content: str) -> str:
        """Expand content to better utilize second line"""
        
        target_length = self.char_limits['bullet_single'] + (self.char_limits['bullet_single'] * self.char_limits['bullet_efficiency'])
        
        if len(content) >= target_length:
            return content
        
        # Simple expansion by adding descriptive words
        expanded = content
        
        # Add quantification if missing
        if not any(char.isdigit() for char in content):
            if 'users' in content.lower():
                expanded = expanded.replace('users', '1000+ users')
            elif 'performance' in content.lower():
                expanded = expanded.replace('performance', 'performance by 25%')
        
        # Add technical specificity
        if 'API' in content and 'REST' not in content:
            expanded = expanded.replace('API', 'REST API')
        
        return expanded[:int(target_length)]
    
    def _optimize_skills_length(self, skills_text: str) -> str:
        """Optimize skills section for single line"""
        
        if len(skills_text) <= self.char_limits['skills_line']:
            return skills_text
        
        # Split by commas and prioritize
        skills = [skill.strip() for skill in skills_text.split(',')]
        
        # Apply abbreviations
        abbreviations = {
            'JavaScript': 'JS',
            'TypeScript': 'TS',
            'Kubernetes': 'K8s',
            'PostgreSQL': 'PostgreSQL'  # Keep full name
        }
        
        optimized_skills = []
        for skill in skills:
            optimized_skill = skill
            for full, abbrev in abbreviations.items():
                optimized_skill = optimized_skill.replace(full, abbrev)
            optimized_skills.append(optimized_skill)
        
        # Reconstruct and check length
        optimized_text = ', '.join(optimized_skills)
        
        # If still too long, remove lower priority skills
        if len(optimized_text) > self.char_limits['skills_line']:
            # Keep removing from end until it fits
            while len(optimized_text) > self.char_limits['skills_line'] and optimized_skills:
                optimized_skills.pop()
                optimized_text = ', '.join(optimized_skills)
        
        return optimized_text
    
    def suggest_improvements(self, content: str, content_type: str) -> List[str]:
        """Suggest specific improvements for space optimization"""
        
        suggestions = []
        constraints = self.check_format_constraints(content, content_type)
        
        if not constraints['overall_valid']:
            suggestions.extend(constraints['issues'])
        
        # Content-specific suggestions
        if content_type == 'experience_bullet':
            line_count = self.calculate_line_count(content, content_type)
            if line_count == 2:
                efficiency = self.calculate_line_efficiency(content)
                if efficiency < 0.7:
                    suggestions.append("Consider expanding to better fill second line or compressing to single line")
        
        if content_type == 'summary':
            if len(content) < self.char_limits['summary_min']:
                suggestions.append("Add more specific technical details or achievements")
        
        return suggestions
    
    def optimize_for_one_page(self, sections: Dict[str, Any]) -> Dict[str, Any]:
        """Aggressive optimization specifically for 1-page constraint"""
        
        optimized_sections = sections.copy()
        
        # 1. Optimize summary to minimum viable length
        if 'summary' in optimized_sections:
            summary = optimized_sections['summary']
            if len(summary) > 280:  # Target 2.3 lines max
                optimized_summary = self._apply_compression_techniques(summary, 280)
                optimized_sections['summary'] = optimized_summary
        
        # 2. Optimize experience bullets more aggressively
        if 'experience' in optimized_sections and isinstance(optimized_sections['experience'], list):
            optimized_bullets = []
            for bullet in optimized_sections['experience']:
                # Target 220 chars max per bullet (ensures 1.7 lines max)
                optimized_bullet = self._apply_compression_techniques(bullet, 220)
                optimized_bullets.append(optimized_bullet)
            optimized_sections['experience'] = optimized_bullets
        
        # 3. Optimize skills to ultra-compact format
        if 'skills' in optimized_sections:
            skills = optimized_sections['skills']
            optimized_skills = self._optimize_skills_ultra_compact(skills)
            optimized_sections['skills'] = optimized_skills
        
        return optimized_sections
    
    def _optimize_skills_ultra_compact(self, skills_text: str) -> str:
        """Ultra-compact skills optimization for 1-page constraint"""
        
        if len(skills_text) <= 65:  # Already compact enough
            return skills_text
        
        # More aggressive skill compression
        compressed = skills_text
        
        # Replace verbose category names with shorter versions
        category_replacements = {
            'Languages & Frameworks:': 'Languages:',
            'Cloud & DevOps:': 'Cloud:',
            'APIs & Integration:': 'APIs:',
            'Architecture & Design:': 'Architecture:',
            'Databases & Storage:': 'Databases:',
            'Monitoring & Observability:': 'Monitoring:',
            'Testing & CI/CD:': 'Testing:'
        }
        
        for old, new in category_replacements.items():
            compressed = compressed.replace(old, new)
        
        # Keep separators intact for parsing compatibility
        # Only compress internal spaces, not separators
        # compressed = compressed.replace(' | ', '|').replace(': ', ':')  # This breaks parsing!
        # Instead, just compress the category names but keep separators
        
        # If still too long, try more compression before dropping categories
        if len(compressed) > 65:
            # Split into categories for targeted compression
            if ' | ' in compressed:
                categories = compressed.split(' | ')
                compressed_categories = []
                
                for category in categories:
                    if ':' in category:
                        cat_name, skills = category.split(':', 1)
                        # Further compress individual skills within each category
                        skills_list = [s.strip() for s in skills.split(',')]
                        # Keep most important skills, compress names
                        important_skills = skills_list[:4]  # Max 4 skills per category
                        compressed_category = f"{cat_name.strip()}: {', '.join(important_skills)}"
                        compressed_categories.append(compressed_category)
                
                compressed = ' | '.join(compressed_categories)
            
            # Only drop categories if still too long after skill-level compression
            if len(compressed) > 65:
                categories = compressed.split(' | ')
                priority_categories = ['Languages:', 'Cloud:', 'Databases:', 'APIs:', 'Testing:', 'Architecture:', 'Monitoring:']  # All categories are important
                
                prioritized = []
                for category in categories:
                    if any(priority in category for priority in priority_categories):
                        prioritized.append(category)
                
                # Add other categories if space allows
                for category in categories:
                    if not any(priority in category for priority in priority_categories):
                        test_addition = ' | '.join(prioritized + [category])
                        if len(test_addition) <= 65:
                            prioritized.append(category)
                
                if prioritized:  # Only use prioritized if we have some categories
                    compressed = ' | '.join(prioritized)
        
        return compressed