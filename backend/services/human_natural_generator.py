"""
Human-Natural Content Generator
Generates authentic, human-sounding resume content that avoids AI detection patterns
"""

import logging
import re
import json
from typing import Dict, List, Any, Optional
from .lm_studio_client import LMStudioClient
from .resume.resume_parser import ResumeParser

logger = logging.getLogger(__name__)

class HumanNaturalGenerator:
    """Generate human-sounding content that avoids AI detection patterns"""
    
    def __init__(self, lm_studio_client: LMStudioClient):
        self.lm_studio = lm_studio_client
        self.resume_parser = ResumeParser()
        self.base_content = self.resume_parser.get_base_resume_content()
        
        # Character limits for different sections
        self.char_limits = {
            'summary_min': 240,
            'summary_max': 360,
            'summary_line': 120,
            'skills_line': 75,
            'bullet_single': 130,
            'bullet_double': 260,
            'bullet_efficiency': 0.9  # 90% of second line must be used
        }
        
        # Human writing patterns
        self.human_patterns = {
            'natural_starters': ['Built', 'Led', 'Created', 'Designed', 'Optimized', 'Integrated', 'Delivered'],
            'avoid_starters': ['Responsible for', 'Tasked with', 'Worked on', 'Helped with'],
            'natural_connectors': ['Currently', 'With expertise in', 'Focused on', 'Specializing in'],
            'buzzwords_to_avoid': ['leverage', 'utilize', 'synergy', 'spearheaded', 'proven track record']
        }
    
    def generate_natural_summary(self, keywords: List[str], job_context: Dict[str, Any]) -> Dict[str, Any]:
        """Generate human-natural professional summary"""
        
        logger.info(f"Generating natural summary with {len(keywords)} keywords")
        
        # Get authentic base content
        base_summary = self.base_content.get('summary', '')
        
        prompt = self._create_conversational_summary_prompt(keywords, job_context, base_summary)
        
        try:
            result = self.lm_studio.generate_structured_response(
                system_prompt=self._get_human_voice_system_prompt(),
                user_prompt=prompt,
                expected_format="JSON with variations",
                max_tokens=800,
                temperature=0.7
            )
            
            if result and isinstance(result, dict):
                # Validate and optimize each variation
                validated_results = []
                
                for i, variation in enumerate(result.get('variations', [result])):
                    summary_text = variation if isinstance(variation, str) else variation.get('text', '')
                    
                    # Validate human characteristics
                    validation = self._validate_human_naturalness(summary_text, 'summary')
                    
                    # Check character constraints
                    char_count = len(summary_text)
                    line_count = self._calculate_line_count(summary_text, self.char_limits['summary_line'])
                    
                    validated_results.append({
                        'text': summary_text,
                        'char_count': char_count,
                        'line_count': line_count,
                        'validation_score': validation['overall_score'],
                        'meets_constraints': (
                            self.char_limits['summary_min'] <= char_count <= self.char_limits['summary_max'] and
                            2 <= line_count <= 3
                        ),
                        'keywords_included': self._count_keywords_in_text(summary_text, keywords),
                        'human_score': validation['human_score']
                    })
                
                # Sort by best overall score (human + constraints)
                validated_results.sort(key=lambda x: (
                    x['meets_constraints'],
                    x['validation_score'],
                    x['human_score']
                ), reverse=True)
                
                return {
                    'success': True,
                    'best_summary': validated_results[0] if validated_results else None,
                    'all_variations': validated_results,
                    'generation_method': 'human_natural'
                }
            
            # Fallback if AI generation fails
            return self._generate_fallback_summary(keywords, job_context)
            
        except Exception as e:
            logger.error(f"Error generating natural summary: {e}")
            return self._generate_fallback_summary(keywords, job_context)
    
    def generate_natural_experience_bullet(self, 
                                         experience_data: Dict[str, Any], 
                                         keywords: List[str], 
                                         position_index: int,
                                         bullet_index: int,
                                         existing_bullets: List[str] = None) -> Dict[str, Any]:
        """Generate human-natural experience bullet"""
        
        logger.info(f"Generating natural bullet {bullet_index+1} for position {position_index}")
        
        # Analyze existing patterns to avoid repetition
        existing_patterns = self._analyze_sentence_patterns(existing_bullets or [])
        
        # Get specific experience data
        experience_context = self._get_experience_context(experience_data, position_index)
        
        prompt = self._create_story_based_experience_prompt(
            experience_context, keywords, bullet_index, existing_patterns
        )
        
        try:
            result = self.lm_studio.generate_structured_response(
                system_prompt=self._get_storytelling_system_prompt(),
                user_prompt=prompt,
                expected_format="JSON with bullet variations",
                max_tokens=600,
                temperature=0.8
            )
            
            if result and isinstance(result, dict):
                validated_bullets = []
                
                for variation in result.get('variations', [result]):
                    bullet_text = variation if isinstance(variation, str) else variation.get('text', '')
                    
                    # Clean up bullet format
                    bullet_text = self._clean_bullet_format(bullet_text)
                    
                    # Validate characteristics
                    validation = self._validate_human_naturalness(bullet_text, 'experience_bullet')
                    
                    # Check space constraints
                    char_count = len(bullet_text)
                    line_count = self._calculate_line_count(bullet_text, self.char_limits['bullet_single'])
                    
                    # Calculate line efficiency for 2-line bullets
                    line_efficiency = 1.0
                    if line_count == 2:
                        line_efficiency = self._calculate_line_efficiency(bullet_text)
                    
                    validated_bullets.append({
                        'text': bullet_text,
                        'char_count': char_count,
                        'line_count': line_count,
                        'line_efficiency': line_efficiency,
                        'validation_score': validation['overall_score'],
                        'meets_constraints': self._check_bullet_constraints(bullet_text),
                        'keywords_included': self._count_keywords_in_text(bullet_text, keywords),
                        'human_score': validation['human_score'],
                        'avoids_repetition': not self._matches_existing_pattern(bullet_text, existing_patterns)
                    })
                
                # Sort by best overall quality
                validated_bullets.sort(key=lambda x: (
                    x['meets_constraints'],
                    x['avoids_repetition'],
                    x['validation_score'],
                    x['line_efficiency']
                ), reverse=True)
                
                return {
                    'success': True,
                    'best_bullet': validated_bullets[0] if validated_bullets else None,
                    'all_variations': validated_bullets,
                    'generation_method': 'human_natural'
                }
            
            # Fallback if AI generation fails
            return self._generate_fallback_bullet(experience_data, keywords, bullet_index)
            
        except Exception as e:
            logger.error(f"Error generating natural bullet: {e}")
            return self._generate_fallback_bullet(experience_data, keywords, bullet_index)
    
    def generate_natural_skills_section(self, 
                                      current_skills: Dict[str, str], 
                                      keywords: List[str], 
                                      section_name: str) -> Dict[str, Any]:
        """Generate naturally grouped skills section"""
        
        logger.info(f"Generating natural skills for {section_name}")
        
        # Skip hardcoded sections
        if section_name in ['Generative AI & ML', 'Certifications']:
            return {
                'success': True,
                'optimized_skills': current_skills.get(section_name, ''),
                'generation_method': 'preserved_hardcoded'
            }
        
        current_section_skills = current_skills.get(section_name, '')
        
        prompt = self._create_natural_skills_prompt(current_section_skills, keywords, section_name)
        
        try:
            result = self.lm_studio.generate_structured_response(
                system_prompt=self._get_skills_organization_system_prompt(),
                user_prompt=prompt,
                expected_format="JSON with optimized skills",
                max_tokens=400,
                temperature=0.6
            )
            
            if result and isinstance(result, dict):
                optimized_skills = result.get('optimized_skills', current_section_skills)
                
                # Validate length constraint
                char_count = len(optimized_skills)
                
                if char_count <= self.char_limits['skills_line']:
                    return {
                        'success': True,
                        'optimized_skills': optimized_skills,
                        'char_count': char_count,
                        'keywords_added': result.get('keywords_added', []),
                        'generation_method': 'human_natural'
                    }
                else:
                    # Truncate while preserving natural grouping
                    truncated = self._truncate_skills_naturally(optimized_skills, self.char_limits['skills_line'])
                    return {
                        'success': True,
                        'optimized_skills': truncated,
                        'char_count': len(truncated),
                        'generation_method': 'truncated_natural'
                    }
            
            # Fallback
            return {
                'success': True,
                'optimized_skills': current_section_skills,
                'generation_method': 'fallback_unchanged'
            }
            
        except Exception as e:
            logger.error(f"Error generating natural skills: {e}")
            return {
                'success': True,
                'optimized_skills': current_section_skills,
                'generation_method': 'error_fallback'
            }
    
    # Helper methods for prompt creation
    def _create_conversational_summary_prompt(self, keywords: List[str], job_context: Dict[str, Any], base_summary: str) -> str:
        """Create conversational prompt for summary generation"""
        
        company = job_context.get('company', 'the company')
        role = job_context.get('role', 'Software Engineer')
        
        return f"""
You're Harsha at a tech networking event. A senior engineer from {company} asks: "Tell me about yourself and what you do."

Your natural, authentic response should be conversational but professional.

CONVERSATION CONTEXT:
- They're hiring for: {role}
- They mentioned these technologies: {', '.join(keywords[:4])}
- You want to show relevant experience without sounding scripted

YOUR AUTHENTIC BACKGROUND:
{base_summary}

REAL ACHIEVEMENTS TO MENTION:
- 7-Eleven mobile checkout platform ($500K monthly sales across 60+ stores)
- EBT payment integration (15% increase in mobile orders)
- API optimization (40% response time improvement)
- 5 years of full-stack development experience

NATURAL CONVERSATION STYLE:
✓ "I'm a software engineer with about 5 years experience..."
✓ "Currently I'm working on [specific project]..."
✓ "I specialize in [relevant to their needs]..."
✓ Use first person ("I", "my", "I've")
✓ Include specific metrics that show impact
✓ Technical details that demonstrate expertise

AVOID RESUME-SPEAK:
✗ "Proven track record of..."
✗ "Responsible for developing..."
✗ "Highly motivated professional..."

STRICT CONSTRAINTS:
- 240-360 characters total (including spaces)
- 2-3 natural sentences
- Include {len(keywords[:4])} relevant keywords: {', '.join(keywords[:4])}
- Sound like you're actually talking to someone

Generate 3 variations with different conversational styles.
Return as JSON: {{"variations": ["{{"text": "...", "style": "..."}}, ...]}}
"""
    
    def _create_story_based_experience_prompt(self, experience_context: Dict[str, Any], keywords: List[str], bullet_index: int, existing_patterns: List[str]) -> str:
        """Create story-based prompt for experience bullets"""
        
        achievement_data = experience_context.get('achievements', [])[bullet_index] if bullet_index < len(experience_context.get('achievements', [])) else {}
        
        return f"""
You're explaining your work achievement to a fellow engineer over coffee. Tell the story naturally.

CONVERSATION STARTER:
"What's something cool you built recently?"

YOUR STORY TO TELL:
{achievement_data}

AUTHENTIC CONTEXT:
- Company: {experience_context.get('company', 'Current company')}
- Role: {experience_context.get('role', 'Software Engineer')}
- Technologies used: {experience_context.get('technologies', [])}

KEYWORDS TO NATURALLY INCLUDE: {', '.join(keywords[:2])}

STORYTELLING STYLE:
✓ "So we had this challenge where..."
✓ "I decided to..." / "My approach was..."
✓ "The result was..." / "We ended up..."
✓ First person perspective
✓ Technical details that show expertise
✓ Specific numbers and metrics
✓ Problem → Solution → Impact flow

AVOID THESE PATTERNS (already used):
{existing_patterns}

AVOID RESUME-SPEAK:
✗ "Responsible for..."
✗ "Utilized advanced..."
✗ "Leveraged cutting-edge..."

SPACE CONSTRAINTS:
- Preferred: 1 line (130 characters)
- Acceptable: 2 lines (260 characters, use 90%+ of second line)
- Must sound natural, not cramped

EXAMPLES OF NATURAL FLOW:
✓ "Built Node.js microservices for 7-Eleven's mobile checkout, handling $500K monthly sales across 60+ stores"
✓ "Integrated EBT payments with Forage API, adding tax exemptions and split tender support that boosted mobile orders 15%"

Generate 3 story variations with different emphasis.
Return as JSON: {{"variations": ["{{"text": "...", "focus": "..."}}, ...]}}
"""
    
    def _create_natural_skills_prompt(self, current_skills: str, keywords: List[str], section_name: str) -> str:
        """Create natural skills organization prompt"""
        
        return f"""
Organize the "{section_name}" section as you would naturally describe your tech stack to another engineer.

NATURAL CONVERSATION:
"What technologies do you work with in {section_name.lower()}?"

CURRENT SKILLS: {current_skills}
JOB-RELEVANT KEYWORDS TO INCLUDE: {', '.join(keywords[:6])}

NATURAL ORGANIZATION:
✓ Most frequently used technologies first
✓ Group related techs together (React/Redux, AWS/Lambda)
✓ Use common abbreviations (JavaScript→JS, TypeScript→TS)
✓ Version numbers only if they matter
✓ Flow from primary to secondary technologies

CONSTRAINTS:
- Exactly 1 line (max 75 characters)
- Comma-separated format
- Include relevant keywords naturally
- Maintain logical grouping

EXAMPLES:
✓ "Node.js, TypeScript, React, GraphQL, MongoDB" (primary stack)
✓ "AWS Lambda, S3, EC2, CloudFormation, Docker" (cloud tools)
✓ "Jest, Cypress, Jenkins, Git, Postman" (dev tools)

Generate optimized skills line.
Return as JSON: {{"optimized_skills": "...", "keywords_added": [...]}}
"""

    # System prompts for different content types
    def _get_human_voice_system_prompt(self) -> str:
        """System prompt for human voice generation"""
        return """
You are Harsha Vippala, a software engineer with 5 years of experience, writing in your own natural voice.

CORE PRINCIPLES:
- Write as yourself, not about yourself
- Use natural conversation patterns
- Include authentic technical details from your experience
- Avoid robotic or AI-generated language patterns
- Mix sentence lengths for natural rhythm
- Use specific metrics and technologies you actually work with

AUTHENTIC VOICE CHARACTERISTICS:
- Confident but not boastful
- Technical but accessible
- Specific rather than generic
- Action-oriented (built, led, created)
- Results-focused with real numbers

AVOID AI PATTERNS:
- Repetitive sentence structures
- Buzzword clustering
- Generic phrases that could apply to anyone
- Overly formal or robotic language
"""
    
    def _get_storytelling_system_prompt(self) -> str:
        """System prompt for storytelling-based content"""
        return """
You are telling authentic stories about your software engineering achievements.

STORYTELLING APPROACH:
- Every bullet point is a mini-story
- Include the challenge, your approach, and the result
- Use specific technical details that show expertise
- Include realistic metrics from actual experience
- Write as if explaining to a peer engineer

NATURAL STORY FLOW:
1. Context/Challenge ("We needed to...")
2. Your Solution ("I built/implemented...")
3. Specific Result ("This resulted in...")

AUTHENTICITY MARKERS:
- First-person perspective
- Specific technologies and versions
- Realistic timelines and metrics
- Technical decision-making process
- Business impact connection
"""
    
    def _get_skills_organization_system_prompt(self) -> str:
        """System prompt for skills organization"""
        return """
You are organizing technical skills as a software engineer would naturally group them.

ORGANIZATION PRINCIPLES:
- Primary technologies first (daily use)
- Related technologies grouped together
- Most relevant to target job emphasized
- Natural abbreviations where space is tight
- Logical flow from core to supporting technologies

AVOID:
- Alphabetical ordering
- Random technology mixing
- Buzzword stuffing
- Artificial groupings
"""

    # Validation and helper methods
    def _validate_human_naturalness(self, content: str, content_type: str) -> Dict[str, float]:
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
    
    def _analyze_sentence_patterns(self, existing_bullets: List[str]) -> List[str]:
        """Analyze existing sentence patterns to avoid repetition"""
        
        patterns = []
        for bullet in existing_bullets:
            if bullet:
                # Extract sentence structure patterns
                words = bullet.split()
                if words:
                    # First word pattern
                    patterns.append(f"starts_with_{words[0].lower()}")
                    
                    # Length pattern
                    if len(words) <= 10:
                        patterns.append("short_sentence")
                    elif len(words) >= 20:
                        patterns.append("long_sentence")
                    
                    # Structure pattern
                    if ' and ' in bullet:
                        patterns.append("compound_sentence")
                    if bullet.count(',') >= 2:
                        patterns.append("complex_listing")
        
        return patterns
    
    def _get_experience_context(self, experience_data: Dict[str, Any], position_index: int) -> Dict[str, Any]:
        """Get specific experience context for bullet generation"""
        
        # Get base experiences from resume parser
        base_experiences = self.base_content.get('raw_experiences', [])
        
        if position_index < len(base_experiences):
            experience = base_experiences[position_index]
            return {
                'company': experience.get('company_name', ''),
                'role': experience.get('job_title', ''),
                'technologies': experience.get('technologies_used_in_role', []),
                'achievements': experience.get('experience_highlights', [])
            }
        
        # Fallback
        return {
            'company': 'Current Company',
            'role': 'Software Engineer',
            'technologies': ['Node.js', 'TypeScript', 'AWS'],
            'achievements': ['Built scalable applications']
        }
    
    def _clean_bullet_format(self, bullet_text: str) -> str:
        """Clean and format bullet point text"""
        
        # Remove bullet symbols if present
        bullet_text = re.sub(r'^[•\-\*]\s*', '', bullet_text.strip())
        
        # Ensure first letter is capitalized
        if bullet_text and bullet_text[0].islower():
            bullet_text = bullet_text[0].upper() + bullet_text[1:]
        
        # Remove trailing periods
        bullet_text = bullet_text.rstrip('.')
        
        return bullet_text
    
    def _calculate_line_count(self, text: str, chars_per_line: int) -> int:
        """Calculate number of lines text will take"""
        return max(1, (len(text) + chars_per_line - 1) // chars_per_line)
    
    def _calculate_line_efficiency(self, text: str) -> float:
        """Calculate how efficiently text uses the second line"""
        
        chars_per_line = self.char_limits['bullet_single']
        if len(text) <= chars_per_line:
            return 1.0  # Single line, perfect efficiency
        
        # Calculate second line usage
        second_line_chars = len(text) - chars_per_line
        return second_line_chars / chars_per_line
    
    def _check_bullet_constraints(self, bullet_text: str) -> bool:
        """Check if bullet meets space constraints"""
        
        char_count = len(bullet_text)
        line_count = self._calculate_line_count(bullet_text, self.char_limits['bullet_single'])
        
        # Check basic length constraints
        if char_count > self.char_limits['bullet_double']:
            return False
        
        # Check line efficiency for 2-line bullets
        if line_count == 2:
            efficiency = self._calculate_line_efficiency(bullet_text)
            if efficiency < self.char_limits['bullet_efficiency']:
                return False
        
        return True
    
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
    
    def _split_sentences(self, text: str) -> List[str]:
        """Split text into sentences"""
        
        # Simple sentence splitting
        sentences = [s.strip() for s in text.split('.') if s.strip()]
        return sentences
    
    def _truncate_skills_naturally(self, skills_text: str, max_chars: int) -> str:
        """Truncate skills while preserving natural grouping"""
        
        if len(skills_text) <= max_chars:
            return skills_text
        
        # Split by commas and truncate
        skills = [skill.strip() for skill in skills_text.split(',')]
        truncated = []
        current_length = 0
        
        for skill in skills:
            # Account for comma and space
            needed_length = len(skill) + (2 if truncated else 0)
            
            if current_length + needed_length <= max_chars:
                truncated.append(skill)
                current_length += needed_length
            else:
                break
        
        return ', '.join(truncated)
    
    # Fallback methods
    def _generate_fallback_summary(self, keywords: List[str], job_context: Dict[str, Any]) -> Dict[str, Any]:
        """Generate fallback summary when AI fails"""
        
        base_summary = self.base_content.get('summary', '')
        
        # Simple keyword integration
        fallback_text = f"Software Engineer with 5 years of experience in {', '.join(keywords[:3])}. Currently building scalable applications at 7-Eleven with focus on payment systems and microservices architecture."
        
        return {
            'success': True,
            'best_summary': {
                'text': fallback_text,
                'char_count': len(fallback_text),
                'line_count': self._calculate_line_count(fallback_text, self.char_limits['summary_line']),
                'generation_method': 'fallback'
            }
        }
    
    def _generate_fallback_bullet(self, experience_data: Dict[str, Any], keywords: List[str], bullet_index: int) -> Dict[str, Any]:
        """Generate fallback bullet when AI fails"""
        
        # Simple fallback bullets
        fallback_bullets = [
            f"Built {keywords[0] if keywords else 'Node.js'} applications handling thousands of daily transactions",
            f"Optimized {keywords[1] if len(keywords) > 1 else 'database'} performance improving response times by 40%",
            f"Integrated {keywords[0] if keywords else 'payment'} systems enabling $500K monthly sales"
        ]
        
        bullet_text = fallback_bullets[bullet_index % len(fallback_bullets)]
        
        return {
            'success': True,
            'best_bullet': {
                'text': bullet_text,
                'char_count': len(bullet_text),
                'line_count': self._calculate_line_count(bullet_text, self.char_limits['bullet_single']),
                'generation_method': 'fallback'
            }
        }