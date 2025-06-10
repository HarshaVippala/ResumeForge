"""
Section Generator Service
Generates specific resume sections using selected keywords
"""

import logging
import json
from typing import Dict, List, Any, Optional
from services.lm_studio_client import LMStudioClient
from services.resume_parser import ResumeParser

logger = logging.getLogger(__name__)

class SectionGenerator:
    """Generate tailored resume sections with selected keywords"""
    
    def __init__(self, lm_studio_client: LMStudioClient):
        self.lm_studio = lm_studio_client
        self.resume_parser = ResumeParser()
        
        # Get base resume content
        self.base_content = self.resume_parser.get_base_resume_content()
        
        # Fallback templates for each section type
        self.fallback_templates = {
            "summary": self._generate_summary_fallback,
            "skills": self._generate_skills_fallback,
            "experience": self._generate_experience_fallback
        }
    
    def generate_section(
        self,
        section_type: str,
        selected_keywords: List[str],
        base_content: str,
        job_context: Dict[str, Any],
        preferences: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Generate content for a specific resume section
        
        Args:
            section_type: Type of section ('summary', 'skills', 'experience')
            selected_keywords: List of keywords to incorporate
            base_content: Current/original content for this section
            job_context: Context from job analysis
            preferences: User preferences for generation
            
        Returns:
            Generated section content
        """
        try:
            if not selected_keywords:
                raise ValueError("No keywords selected for generation")
            
            # If no base_content provided, get from base resume
            if not base_content:
                if section_type == "summary":
                    base_content = self.base_content.get("summary", "")
                elif section_type == "skills":
                    base_content = self.base_content.get("skills", "")
                elif section_type == "experience":
                    base_content = "\n".join(self.base_content.get("experience", []))
            
            # Try AI generation first
            if self.lm_studio.test_connection():
                logger.info(f"Generating {section_type} section with AI")
                result = self._generate_with_ai(
                    section_type, selected_keywords, base_content, job_context, preferences
                )
                if result:
                    return result
            
            # Fallback to template-based generation
            logger.info(f"Using fallback generation for {section_type}")
            return self._generate_with_fallback(
                section_type, selected_keywords, base_content, job_context, preferences
            )
            
        except Exception as e:
            logger.error(f"Error generating {section_type} section: {e}")
            return self._generate_with_fallback(
                section_type, selected_keywords, base_content, job_context, preferences
            )
    
    def _generate_with_ai(
        self,
        section_type: str,
        selected_keywords: List[str],
        base_content: str,
        job_context: Dict[str, Any],
        preferences: Optional[Dict[str, Any]]
    ) -> Optional[str]:
        """Generate section content using AI"""
        
        # Get section-specific prompt
        system_prompt = self._get_system_prompt(section_type)
        user_prompt = self._get_user_prompt(
            section_type, selected_keywords, base_content, job_context, preferences
        )
        
        try:
            # For sections that need structured output
            if section_type == "experience":
                result = self.lm_studio.generate_structured_response(
                    system_prompt=system_prompt,
                    user_prompt=user_prompt,
                    expected_format="JSON array of strings",
                    max_tokens=1000,
                    temperature=0.7
                )
                
                if result and isinstance(result, list):
                    return result
                elif result and 'bullets' in result:
                    return result['bullets']
            else:
                # For summary and skills, get plain text
                messages = [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ]
                
                result = self.lm_studio.generate_chat_completion(
                    messages=messages,
                    max_tokens=800,
                    temperature=0.7
                )
                
                if result:
                    return result.strip()
            
            return None
            
        except Exception as e:
            logger.error(f"AI generation failed for {section_type}: {e}")
            return None
    
    def _generate_with_fallback(
        self,
        section_type: str,
        selected_keywords: List[str],
        base_content: str,
        job_context: Dict[str, Any],
        preferences: Optional[Dict[str, Any]]
    ) -> str:
        """Generate section content using fallback templates"""
        
        generator = self.fallback_templates.get(section_type)
        if not generator:
            raise ValueError(f"Unknown section type: {section_type}")
        
        return generator(selected_keywords, base_content, job_context, preferences)
    
    def _get_system_prompt(self, section_type: str) -> str:
        """Get system prompt for specific section type"""
        
        base_prompt = """You are CareerForgeAI, an expert resume strategist creating ATS-optimized content that enhances authentic experience without fabrication.

CORE PRINCIPLES:
- Stay authentic to candidate's real experience (max 5 years experience)
- Pass ATS filters through strategic keyword integration
- Maintain perfect consistency across all sections
- Only add skills technically plausible given background
- Focus on quantified achievements and impact"""
        
        section_prompts = {
            "summary": f"""{base_prompt}

For PROFESSIONAL SUMMARY sections:
- STRICT: Maximum 5 years experience (never 6+, 7+, 8+)
- PREFERRED: "Software Engineer with 5 years of experience"
- Write 2-3 sentences (280-300 characters total)
- Start with job title and authentic years of experience
- Highlight 2-3 core technical competencies from base resume
- End with value proposition or current specialization
- Use active voice and strong action words
- Ensure natural keyword integration

Structure: [Role] with [4-5 years] of experience specializing in [2-3 core technologies]. [Current focus]. [Value proposition].

Example: "Software Engineer with 5 years of experience specializing in Node.js, TypeScript, and AWS. Currently building scalable microservices for retail platforms. Expert in API design and cloud-native architecture."

CRITICAL: 
- Keep under 300 characters for single-page fit
- Only mention technologies from candidate's actual background
- Ensure it sounds natural, not keyword-stuffed""",

            "skills": f"""{base_prompt}

For TECHNICAL SKILLS sections:
- Organize keywords into logical categories
- Use consistent formatting
- Prioritize most relevant skills first
- Group related technologies together
- Include proficiency context where appropriate

Format options:
1. Categorized: "Languages: Python, JavaScript | Frameworks: React, Django | Cloud: AWS, Docker"
2. Simple list: "Python, JavaScript, React, Django, AWS, Docker, Git, MySQL"
3. Detailed: "Languages & Frameworks: Python, JavaScript, React, Node.js | Cloud & DevOps: AWS, Docker, Kubernetes"

Choose the format that best showcases the selected keywords.""",

            "experience": f"""{base_prompt}

For WORK EXPERIENCE bullet points:
- Use STAR method (Situation, Task, Action, Result)
- Character limits: 200-250 chars each for recent roles, 180-220 for older
- Start with varied action verbs (max 2x same starter)
- Include quantified achievements when possible
- Naturally incorporate selected keywords from job description
- Focus on impact and measurable results
- Build on candidate's actual experience, don't fabricate

Bullet Construction Formula: [Action] [technical implementation with keywords] [quantified outcome]

Integration Techniques:
1. Natural Clustering: "Built React/Redux frontend consuming GraphQL APIs"
2. Soft Skills Through Action: "Led 5-engineer team to deliver...", "Partnered with product teams..."
3. Technology Depth: "Architected" (expert), "Implemented" (proficient), "Utilized" (familiar)

Sentence Starters (vary usage):
- Technical: Architected, Engineered, Implemented, Developed
- Leadership: Led, Mentored, Coordinated, Guided  
- Impact: Optimized, Reduced, Increased, Accelerated
- Innovation: Pioneered, Introduced, Modernized

Return a JSON array of 3-5 bullet point strings.

CRITICAL: 
- Build on real experience from base resume
- Each bullet should incorporate 1-2 selected keywords naturally
- Include quantified metrics when possible
- Stay within character limits for single-page fit"""
        }
        
        return section_prompts.get(section_type, base_prompt)
    
    def _get_user_prompt(
        self,
        section_type: str,
        selected_keywords: List[str],
        base_content: str,
        job_context: Dict[str, Any],
        preferences: Optional[Dict[str, Any]]
    ) -> str:
        """Get user prompt with context for section generation"""
        
        company = job_context.get('company', 'Company')
        role = job_context.get('role', 'Software Engineer')
        keywords_str = ", ".join(selected_keywords)
        
        tone = preferences.get('tone', 'professional') if preferences else 'professional'
        length = preferences.get('length', 'medium') if preferences else 'medium'
        
        # Get candidate background from base content
        candidate_info = f"""
CANDIDATE BACKGROUND:
- Current Role: Software Engineer II at 7-Eleven
- Total Experience: 4+ years (started Jan 2021)
- Key Technologies: Node.js, TypeScript, Python, AWS, MongoDB, Redis
- Recent Projects: EBT payment integration, microservices, IoT systems
- Background: Full-stack development, serverless architecture, payment systems
"""
        
        base_prompt = f"""Generate a {section_type} section for a resume targeting this role:

TARGET POSITION:
Company: {company}
Role: {role}

{candidate_info}

SELECTED KEYWORDS TO INCORPORATE: {keywords_str}

CURRENT SECTION CONTENT: {base_content}

GENERATION REQUIREMENTS:
- Build on the candidate's authentic 4-year experience background
- Naturally incorporate selected keywords from job description
- Enhance existing experience, don't fabricate new experience
- Maintain consistency with base resume achievements
- Focus on quantified results and technical depth
- Keep within character limits for single-page resume

Preferences:
- Tone: {tone}
- Length: {length}"""
        
        section_specific = {
            "summary": "\n\nGenerate a compelling professional summary that positions the candidate for this specific role.",
            "skills": "\n\nOrganize these keywords into a well-structured technical skills section.",
            "experience": "\n\nCreate 3-5 bullet points that demonstrate relevant experience using these keywords. Focus on achievements and impact."
        }
        
        return base_prompt + section_specific.get(section_type, "")
    
    def _generate_summary_fallback(
        self,
        keywords: List[str],
        base_content: str,
        job_context: Dict[str, Any],
        preferences: Optional[Dict[str, Any]]
    ) -> str:
        """Fallback summary generation"""
        
        # Extract key components
        tech_keywords = [k for k in keywords if any(tech in k.lower() for tech in 
                        ['python', 'javascript', 'react', 'node', 'aws', 'docker', 'sql'])]
        soft_keywords = [k for k in keywords if any(soft in k.lower() for soft in 
                        ['leadership', 'collaboration', 'team', 'communication'])]
        
        # Determine experience level
        years = "5 years"
        if any("senior" in k.lower() for k in keywords):
            years = "6+ years"
        elif any(y in " ".join(keywords).lower() for y in ["3 years", "4 years"]):
            years = "4 years"
        
        # Build summary
        tech_list = tech_keywords[:3]  # Top 3 technical skills
        tech_str = ", ".join(tech_list) if tech_list else "full-stack development"
        
        summary = f"Software Engineer with {years} of experience specializing in {tech_str}."
        
        if soft_keywords:
            summary += f" Proven {soft_keywords[0].lower()} experience in delivering scalable solutions."
        else:
            summary += " Expert in building scalable applications and system architecture."
        
        summary += " Passionate about delivering high-quality solutions in fast-paced environments."
        
        return summary
    
    def _generate_skills_fallback(
        self,
        keywords: List[str],
        base_content: str,
        job_context: Dict[str, Any],
        preferences: Optional[Dict[str, Any]]
    ) -> str:
        """Fallback skills generation"""
        
        # Categorize keywords
        categories = {
            "Languages": [],
            "Frameworks": [],
            "Cloud & DevOps": [],
            "Databases": [],
            "Tools": []
        }
        
        for keyword in keywords:
            kw_lower = keyword.lower()
            if any(lang in kw_lower for lang in ['python', 'javascript', 'java', 'typescript', 'go']):
                categories["Languages"].append(keyword)
            elif any(fw in kw_lower for fw in ['react', 'angular', 'vue', 'node', 'django', 'flask']):
                categories["Frameworks"].append(keyword)
            elif any(cloud in kw_lower for cloud in ['aws', 'azure', 'docker', 'kubernetes', 'ci/cd']):
                categories["Cloud & DevOps"].append(keyword)
            elif any(db in kw_lower for db in ['mysql', 'postgresql', 'mongodb', 'redis', 'sql']):
                categories["Databases"].append(keyword)
            else:
                categories["Tools"].append(keyword)
        
        # Build skills string
        skills_parts = []
        for category, skills in categories.items():
            if skills:
                skills_parts.append(f"{category}: {', '.join(skills)}")
        
        if skills_parts:
            return " | ".join(skills_parts)
        else:
            return ", ".join(keywords)
    
    def _generate_experience_fallback(
        self,
        keywords: List[str],
        base_content: str,
        job_context: Dict[str, Any],
        preferences: Optional[Dict[str, Any]]
    ) -> List[str]:
        """Fallback experience generation"""
        
        tech_keywords = [k for k in keywords if not any(soft in k.lower() for soft in 
                        ['leadership', 'collaboration', 'team', 'communication', 'years'])]
        soft_keywords = [k for k in keywords if any(soft in k.lower() for soft in 
                        ['leadership', 'collaboration', 'team', 'communication'])]
        
        bullets = []
        
        # Technical achievement bullet
        if tech_keywords:
            tech_list = tech_keywords[:3]
            bullets.append(f"Developed and maintained applications using {', '.join(tech_list)}, improving system performance and user experience")
        
        # Architecture bullet
        if any(arch in ' '.join(keywords).lower() for arch in ['microservices', 'api', 'architecture']):
            bullets.append("Designed and implemented scalable microservices architecture serving thousands of users")
        
        # Leadership bullet
        if soft_keywords:
            bullets.append(f"Demonstrated {soft_keywords[0].lower()} by mentoring team members and conducting code reviews")
        
        # Collaboration bullet
        if len(bullets) < 3:
            bullets.append("Collaborated with cross-functional teams to deliver high-quality software solutions on schedule")
        
        # DevOps/deployment bullet
        if any(devops in ' '.join(keywords).lower() for devops in ['docker', 'aws', 'ci/cd', 'kubernetes']):
            bullets.append("Implemented CI/CD pipelines and containerization, reducing deployment time by 50%")
        
        return bullets[:4]  # Return max 4 bullets