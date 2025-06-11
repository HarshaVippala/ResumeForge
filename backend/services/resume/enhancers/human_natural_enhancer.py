"""
Human-Natural Content Enhancement
Enhances generated content with human writing characteristics and anti-AI detection
"""

import logging
import re
from typing import Dict, List, Any, Optional

logger = logging.getLogger(__name__)

class HumanNaturalEnhancer:
    """Enhance content for human-natural characteristics"""
    
    def __init__(self):
        # Human writing patterns
        self.human_patterns = {
            'natural_starters': ['Built', 'Led', 'Created', 'Designed', 'Optimized', 'Integrated', 'Delivered'],
            'avoid_starters': ['Responsible for', 'Tasked with', 'Worked on', 'Helped with'],
            'natural_connectors': ['Currently', 'With expertise in', 'Focused on', 'Specializing in'],
            'buzzwords_to_avoid': ['leverage', 'utilize', 'synergy', 'spearheaded', 'proven track record']
        }
    
    def enhance_content_naturalness(self, content: str, content_type: str) -> Dict[str, Any]:
        """Enhance content for human-natural characteristics"""
        
        # Apply natural enhancement based on content type
        if content_type == 'summary':
            enhanced = self._enhance_summary_naturalness(content)
        elif content_type == 'experience_bullet':
            enhanced = self._enhance_bullet_naturalness(content)
        elif content_type == 'skills':
            enhanced = self._enhance_skills_naturalness(content)
        else:
            enhanced = content
        
        # Validate enhancement quality
        validation = self.validate_human_naturalness(enhanced, content_type)
        
        return {
            'original': content,
            'enhanced': enhanced,
            'validation': validation,
            'improvements_made': self._identify_improvements(content, enhanced)
        }
    
    def validate_human_naturalness(self, content: str, content_type: str) -> Dict[str, float]:
        """Validate content for human-natural characteristics"""
        
        validation_scores = {
            'sentence_variation': self._check_sentence_variation(content),
            'natural_language': self._check_natural_language_patterns(content),
            'authenticity': self._check_authenticity_indicators(content),
            'specificity': self._check_specificity_level(content),
            'ai_detection_risk': self._assess_ai_detection_risk(content)
        }
        
        # Calculate weighted scores based on content type
        if content_type == 'summary':
            weights = {'sentence_variation': 0.25, 'natural_language': 0.3, 'authenticity': 0.25, 'specificity': 0.2}
        elif content_type == 'experience_bullet':
            weights = {'sentence_variation': 0.15, 'natural_language': 0.25, 'authenticity': 0.3, 'specificity': 0.3}
        else:
            weights = {'sentence_variation': 0.2, 'natural_language': 0.3, 'authenticity': 0.25, 'specificity': 0.25}
        
        # Calculate overall score
        overall_score = sum(validation_scores[key] * weights.get(key, 0.2) for key in validation_scores)
        validation_scores['overall_score'] = overall_score
        
        # Human score (inverse of AI detection risk)
        validation_scores['human_score'] = validation_scores['ai_detection_risk']
        
        return validation_scores
    
    def _enhance_summary_naturalness(self, content: str) -> str:
        """Enhance summary for natural flow"""
        
        # Remove em-dashes first (user requirement)
        content = content.replace('—', '-').replace('–', '-')
        
        # Add natural transitions between sentences
        sentences = content.split('. ')
        
        if len(sentences) > 1:
            enhanced_sentences = []
            for i, sentence in enumerate(sentences):
                if i == 1 and not any(sentence.startswith(word) for word in ['Currently', 'With', 'Focused', 'Leading']):
                    enhanced_sentences.append(f"Currently {sentence.lower()}")
                else:
                    enhanced_sentences.append(sentence)
            
            return '. '.join(enhanced_sentences)
        
        return content
    
    def _enhance_bullet_naturalness(self, content: str) -> str:
        """Enhance bullet for natural language patterns"""
        
        # Remove em-dashes first (user requirement)
        content = content.replace('—', '-').replace('–', '-')
        
        # Convert passive voice to active
        for passive, active in {
            'Responsible for developing': 'Developed',
            'Responsible for leading': 'Led', 
            'Tasked with creating': 'Created',
            'Worked on building': 'Built',
            'Involved in implementing': 'Implemented'
        }.items():
            if content.startswith(passive):
                content = content.replace(passive, active, 1)
        
        # Ensure proper capitalization
        if content and content[0].islower():
            content = content[0].upper() + content[1:]
        
        return content
    
    def _enhance_skills_naturalness(self, content: str) -> str:
        """Enhance skills for natural grouping"""
        
        # ATS-safe abbreviations for space optimization
        abbreviations = {
            'JavaScript': 'JS',
            'TypeScript': 'TS',
            'Kubernetes': 'K8s',
            'PostgreSQL': 'PostgreSQL'
        }
        
        enhanced = content
        
        # Remove em-dashes (user requirement)
        enhanced = enhanced.replace('—', '-').replace('–', '-')
        
        for full, abbrev in abbreviations.items():
            if len(enhanced) > 70:  # Only abbreviate if running long
                enhanced = enhanced.replace(full, abbrev)
        
        return enhanced
    
    def _check_sentence_variation(self, content: str) -> float:
        """Check for natural sentence length and structure variation"""
        
        sentences = self._split_sentences(content)
        
        if len(sentences) < 2:
            return 1.0  # Single sentence, no variation needed
        
        # Calculate length variation
        lengths = [len(sentence.split()) for sentence in sentences]
        if len(lengths) < 2:
            return 1.0
            
        # Standard deviation of sentence lengths
        mean_length = sum(lengths) / len(lengths)
        variance = sum((length - mean_length) ** 2 for length in lengths) / len(lengths)
        std_dev = variance ** 0.5
        
        # Normalize variation score (good variation is 2-8 words std dev)
        variation_score = min(std_dev / 6, 1.0)
        
        # Check structure variation (starting words)
        starters = [sentence.split()[0] for sentence in sentences if sentence.split()]
        unique_starters = len(set(starters))
        starter_variation = unique_starters / len(starters) if starters else 0
        
        # Combine metrics
        return (variation_score + starter_variation) / 2
    
    def _check_natural_language_patterns(self, content: str) -> float:
        """Check for natural vs robotic language patterns"""
        
        content_lower = content.lower()
        
        # Natural indicators
        natural_patterns = [
            r'\b(built|created|led|designed|optimized|integrated|delivered)\b',
            r'\b\d+[%$km]\b',  # Specific metrics
            r'\b(currently|specifically|recently)\b',
            r'\b(i|my|we|our)\b',  # First person
        ]
        
        # Robotic indicators
        robotic_patterns = [
            r'\bresponsible for\b',
            r'\btasked with\b',
            r'\bproven track record\b',
            r'\bhighly motivated\b',
            r'\bleveraged?\b',
            r'\butilized?\b',
            r'\bspearheaded\b'
        ]
        
        natural_count = sum(1 for pattern in natural_patterns if re.search(pattern, content_lower))
        robotic_count = sum(1 for pattern in robotic_patterns if re.search(pattern, content_lower))
        
        # Score based on natural vs robotic ratio
        total_patterns = natural_count + robotic_count
        if total_patterns == 0:
            return 0.7  # Neutral
        
        natural_ratio = natural_count / total_patterns
        return natural_ratio
    
    def _check_authenticity_indicators(self, content: str) -> float:
        """Check for authentic technical and experience indicators"""
        
        content_lower = content.lower()
        
        # Authentic technical indicators
        tech_indicators = [
            r'\bnode\.?js\b', r'\btypescript\b', r'\bpython\b', r'\breact\b', r'\baws\b',
            r'\bmongodb\b', r'\bredis\b', r'\bapi\b', r'\bmicroservices?\b',
            r'\b7-eleven\b', r'\bliberty mutual\b', r'\bebt\b', r'\bforage\b'
        ]
        
        # Authentic metric indicators  
        metric_indicators = [
            r'\$\d+k?\b', r'\d+%\b', r'\d+\+?\s?(stores?|users?|hours?|days?)\b',
            r'\d+x\b', r'\d+:\d+\b'  # ratios, times
        ]
        
        tech_count = sum(1 for pattern in tech_indicators if re.search(pattern, content_lower))
        metric_count = sum(1 for pattern in metric_indicators if re.search(pattern, content_lower))
        
        # Score based on authentic indicators present
        authenticity_score = min((tech_count * 0.3 + metric_count * 0.7) / 2, 1.0)
        
        return authenticity_score
    
    def _check_specificity_level(self, content: str) -> float:
        """Check for specific vs generic content"""
        
        content_lower = content.lower()
        
        # Specific indicators
        specific_patterns = [
            r'\b\d+\b',  # Any numbers
            r'\b[a-z]+\.[a-z]+\b',  # Technology with dots (node.js, etc.)
            r'\b[A-Z]{2,}\b',  # Acronyms (AWS, API, etc.)
            r'\b(million|thousand|billion)\b',
            r'\b(seconds?|minutes?|hours?|days?|weeks?|months?)\b'
        ]
        
        # Generic indicators
        generic_patterns = [
            r'\bvarious\b', r'\bmultiple\b', r'\bseveral\b', r'\bmany\b',
            r'\badvanced\b', r'\bcomplex\b', r'\bsophisticated\b'
        ]
        
        specific_count = sum(1 for pattern in specific_patterns if re.search(pattern, content_lower))
        generic_count = sum(1 for pattern in generic_patterns if re.search(pattern, content_lower))
        
        # Calculate specificity ratio
        total_indicators = specific_count + generic_count
        if total_indicators == 0:
            return 0.5  # Neutral
        
        specificity_ratio = specific_count / total_indicators
        return specificity_ratio
    
    def _assess_ai_detection_risk(self, content: str) -> float:
        """Assess risk of AI detection (lower risk = higher score)"""
        
        risk_factors = 0
        
        # Check for buzzword clustering
        buzzwords = self.human_patterns['buzzwords_to_avoid']
        buzzword_count = sum(1 for word in buzzwords if word.lower() in content.lower())
        if buzzword_count > 1:
            risk_factors += 0.3
        
        # Check for repetitive structure
        sentences = self._split_sentences(content)
        if len(sentences) > 1:
            starters = [sentence.split()[0] for sentence in sentences if sentence.split()]
            if len(set(starters)) < len(starters) * 0.7:  # Less than 70% unique starters
                risk_factors += 0.2
        
        # Check for uniform sentence length
        if len(sentences) > 1:
            lengths = [len(sentence.split()) for sentence in sentences]
            if all(abs(length - lengths[0]) <= 2 for length in lengths):  # All sentences similar length
                risk_factors += 0.2
        
        # Check for robotic language
        for avoided_starter in self.human_patterns['avoid_starters']:
            if avoided_starter.lower() in content.lower():
                risk_factors += 0.3
        
        # Return inverse risk (higher score = lower risk)
        return max(0, 1.0 - risk_factors)
    
    def _split_sentences(self, text: str) -> List[str]:
        """Split text into sentences"""
        
        # Simple sentence splitting
        sentences = [s.strip() for s in text.split('.') if s.strip()]
        return sentences
    
    def _identify_improvements(self, original: str, enhanced: str) -> List[str]:
        """Identify what improvements were made"""
        
        improvements = []
        
        if 'Currently' in enhanced and 'Currently' not in original:
            improvements.append('Added natural transition word')
        
        if any(starter in original for starter in self.human_patterns['avoid_starters']):
            if not any(starter in enhanced for starter in self.human_patterns['avoid_starters']):
                improvements.append('Converted passive voice to active')
        
        if len(enhanced) < len(original):
            improvements.append('Applied space-saving abbreviations')
        
        return improvements